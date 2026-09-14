const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mqtt = require("mqtt");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://127.0.0.1:1883";
const DEVICE_ID = process.env.DEVICE_ID || "aqua_01";
const MQTT_TELEMETRY_TOPIC = process.env.MQTT_TELEMETRY_TOPIC || `aquarium/${DEVICE_ID}/telemetry`;
const MQTT_COMMAND_TOPIC = process.env.MQTT_COMMAND_TOPIC || `aquarium/${DEVICE_ID}/command`;
const KAFKA_TOPIC = process.env.KAFKA_TOPIC || "kafka_telemetry_all";
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "256kb" }));

let latestTelemetry = null;
let mqttConnected = false;
let kafkaProducer = null;
let firebaseDb = null;
let lastAlertLogSignature = "";

function optionalRequire(name) {
  try {
    return require(name);
  } catch (error) {
    console.warn(`[Optional] ${name} unavailable: ${error.message}`);
    return null;
  }
}

async function setupKafka() {
  const kafkaModule = optionalRequire("kafkajs");
  if (!kafkaModule) return;

  try {
    const kafka = new kafkaModule.Kafka({
      clientId: "aquarium-gateway",
      brokers: (process.env.KAFKA_BROKERS || "127.0.0.1:9092").split(","),
    });
    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    console.log("[Kafka] Producer connected");
  } catch (error) {
    kafkaProducer = null;
    console.error("[Kafka] Connection error:", error.message);
  }
}

function setupFirebase() {
  const firebaseApp = optionalRequire("firebase/app");
  const firebaseDbModule = optionalRequire("firebase/database");
  if (!firebaseApp || !firebaseDbModule) return;

  try {
    const firebaseConfig = {
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        "https://influx-1117c-default-rtdb.europe-west1.firebasedatabase.app/",
    };

    const firebaseInstance = firebaseApp.getApps().length
      ? firebaseApp.getApp()
      : firebaseApp.initializeApp(firebaseConfig);

    firebaseDb = {
      db: firebaseDbModule.getDatabase(firebaseInstance),
      ref: firebaseDbModule.ref,
      set: firebaseDbModule.set,
      onChildAdded: firebaseDbModule.onChildAdded,
      remove: firebaseDbModule.remove,
    };

    firebaseDb.onChildAdded(firebaseDb.ref(firebaseDb.db, "commands"), (snapshot) => {
      const command = snapshot.val();
      console.log("[Firebase] Command received:", command);
      publishCommand(command, "firebase");
      firebaseDb.remove(snapshot.ref);
    });

    console.log("[Firebase] Realtime bridge enabled");
  } catch (error) {
    firebaseDb = null;
    console.error("[Firebase] Setup error:", error.message);
  }
}

function normalizeAnomalyScore(value) {
  const rawScore = Number(value ?? 0);
  if (!Number.isFinite(rawScore)) return 0;
  return rawScore;
}

function normalizeTelemetry(payload) {
  const sensors = payload?.sensors || {};
  const actuators = payload?.actuators || {};

  return {
    ...payload,
    device_id: payload?.device_id || DEVICE_ID,
    sensors: {
      temp: sensors.temp ?? null,
      ph: Number(sensors.ph ?? 0),
      tds: Number(sensors.tds ?? 0),
      lux: Number(sensors.lux ?? 0),
      remplissage_pct: Number(sensors.remplissage_pct ?? 0),
      flotteur: sensors.flotteur || "UNKNOWN",
      anomaly_score: normalizeAnomalyScore(sensors.anomaly_score),
    },
    actuators: {
      chauffage: Boolean(actuators.chauffage),
      filtration: Boolean(actuators.filtration),
      oxygene: Boolean(actuators.oxygene),
      buzzer: Boolean(actuators.buzzer),
      feeder: Boolean(actuators.feeder || actuators.temps_repas),
      eclairage_pwm: Number(actuators.eclairage_pwm ?? 0),
      mode: actuators.mode === "MANUAL" ? "MANUAL" : "AUTO",
      temps_repas: Boolean(actuators.temps_repas),
      kill_switch: Boolean(actuators.kill_switch),
    },
    alertes: Array.isArray(payload?.alertes) ? payload.alertes : [],
    updatedAt: Date.now(),
  };
}

function currentActuators() {
  return {
    chauffage: Boolean(latestTelemetry?.actuators?.chauffage),
    filtration: Boolean(latestTelemetry?.actuators?.filtration),
    oxygene: latestTelemetry?.actuators?.oxygene !== false,
    buzzer: Boolean(latestTelemetry?.actuators?.buzzer),
    feeder: false,
    eclairage_pwm: Number(latestTelemetry?.actuators?.eclairage_pwm ?? 0),
  };
}

function normalizeCommand(command = {}) {
  const requestedMode = command.mode === "AUTO" ? "AUTO" : "MANUAL";
  const incomingActuators = command.actuators && typeof command.actuators === "object" ? command.actuators : {};
  const feedNow = Boolean(command.feed_now || incomingActuators.feeder);
  const hasKillSwitch = Object.prototype.hasOwnProperty.call(command, "kill_switch");

  if (hasKillSwitch && typeof command.kill_switch !== "boolean") {
    throw new Error("kill_switch must be a boolean");
  }

  const normalized = {
    ...command,
    mode: requestedMode,
    timestamp: command.timestamp || Date.now(),
  };

  if (hasKillSwitch) {
    normalized.kill_switch = command.kill_switch;
  }

  if (requestedMode === "MANUAL") {
    normalized.actuators = {
      ...currentActuators(),
      ...incomingActuators,
      feeder: feedNow,
      eclairage_pwm: Math.max(0, Math.min(255, Number(incomingActuators.eclairage_pwm ?? currentActuators().eclairage_pwm))),
    };
  }

  if (feedNow) {
    normalized.feed_now = true;
  }

  return normalized;
}

function broadcast(message) {
  const encoded = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(encoded);
    }
  }
}

function publishCommand(command, source = "api") {
  const normalized = normalizeCommand(command);
  const encoded = JSON.stringify(normalized);

  if (!mqttConnected) {
    console.warn("[MQTT] Publishing while disconnected; client will try anyway");
  }

  mqttClient.publish(MQTT_COMMAND_TOPIC, encoded, { qos: 0 }, (error) => {
    if (error) {
      console.error("[MQTT] Command publish error:", error.message);
      return;
    }
    console.log(`[Command:${source}] -> ${MQTT_COMMAND_TOPIC}`, normalized);
    broadcast({ type: "command", data: normalized, source });
  });

  return normalized;
}

const mqttClient = mqtt.connect(MQTT_BROKER, {
  reconnectPeriod: 3000,
  connectTimeout: 10000,
});

mqttClient.on("connect", () => {
  mqttConnected = true;
  console.log(`[MQTT] Connected to ${MQTT_BROKER}`);
  mqttClient.subscribe(MQTT_TELEMETRY_TOPIC, (error) => {
    if (error) console.error("[MQTT] Subscribe error:", error.message);
    else console.log(`[MQTT] Subscribed: ${MQTT_TELEMETRY_TOPIC}`);
  });
  broadcast({ type: "status", data: { mqttConnected: true } });
});

mqttClient.on("close", () => {
  mqttConnected = false;
  broadcast({ type: "status", data: { mqttConnected: false } });
});

mqttClient.on("error", (error) => {
  console.error("[MQTT] Error:", error.message);
});

mqttClient.on("message", async (topic, message) => {
  if (topic !== MQTT_TELEMETRY_TOPIC) return;

  try {
    const payload = JSON.parse(message.toString());
    latestTelemetry = normalizeTelemetry(payload);

    broadcast({ type: "telemetry", data: latestTelemetry });

    if (firebaseDb) {
      const aquariumPath = `aquariums/${latestTelemetry.device_id}`;

      firebaseDb.set(firebaseDb.ref(firebaseDb.db, `${aquariumPath}/etat_actuel`), latestTelemetry).catch((error) => {
        console.error("[Firebase] Live sync error:", error.message);
      });

      const timestamp = Date.now();
      const historyData = {
        ...latestTelemetry.sensors,
        feeder_actif: latestTelemetry.actuators.feeder ? 1 : 0,
      };

      firebaseDb.set(firebaseDb.ref(firebaseDb.db, `${aquariumPath}/historique/${timestamp}`), historyData).catch((error) => {
        console.error("[Firebase] History sync error:", error.message);
      });

      const alertes = Array.isArray(latestTelemetry.alertes) ? latestTelemetry.alertes.filter(Boolean) : [];
      const alertSignature = alertes.length > 0 ? alertes.join("|") : "";

      if (alertSignature && alertSignature !== lastAlertLogSignature) {
        firebaseDb.set(firebaseDb.ref(firebaseDb.db, `${aquariumPath}/alertes_log/${timestamp}`), { alertes }).catch((error) => {
          console.error("[Firebase] Alerts log sync error:", error.message);
        });
      }

      lastAlertLogSignature = alertSignature;
    }

    if (kafkaProducer) {
      try {
        await kafkaProducer.send({
          topic: KAFKA_TOPIC,
          messages: [{ value: JSON.stringify(latestTelemetry) }],
        });
      } catch (error) {
        console.error("[Kafka] Publish error:", error.message);
      }
    }
  } catch (error) {
    console.error("[MQTT] Telemetry payload error:", error.message);
  }
});

wss.on("connection", (socket) => {
  socket.send(JSON.stringify({ type: "status", data: { mqttConnected } }));
  if (latestTelemetry) {
    socket.send(JSON.stringify({ type: "telemetry", data: latestTelemetry }));
  }

  socket.on("message", (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      if (message.type === "command") {
        publishCommand(message.data, "websocket");
      }
    } catch (error) {
      socket.send(JSON.stringify({ type: "error", error: error.message }));
    }
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mqttConnected,
    hasTelemetry: Boolean(latestTelemetry),
    firebaseEnabled: Boolean(firebaseDb),
    kafkaEnabled: Boolean(kafkaProducer),
  });
});

app.get("/api/telemetry", (_req, res) => {
  if (!latestTelemetry) {
    res.status(404).json({ error: "No telemetry received yet" });
    return;
  }
  res.json(latestTelemetry);
});

app.post("/api/commands", (req, res) => {
  try {
    const command = publishCommand(req.body, "api");
    res.status(202).json({ ok: true, command });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

setupFirebase();
setupKafka();

server.listen(PORT, "0.0.0.0", () => {
  console.log(`EdgeBrain Aqua gateway listening on http://0.0.0.0:${PORT}`);
  console.log(`Telemetry: ${MQTT_TELEMETRY_TOPIC}`);
  console.log(`Commands:  ${MQTT_COMMAND_TOPIC}`);
});
