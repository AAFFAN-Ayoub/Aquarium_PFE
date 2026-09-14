import { useCallback, useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase, onValue, orderByKey, push, query, ref, set } from "firebase/database";

const firebaseConfig = {
  databaseURL: "https://influx-1117c-default-rtdb.europe-west1.firebasedatabase.app/",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

export interface TelemetryData {
  device_id?: string;
  sensors: {
    temp: number | null;
    ph: number;
    tds: number;
    lux: number;
    remplissage_pct: number;
    flotteur: string;
    anomaly_score?: number;
  };
  actuators: {
    chauffage: boolean;
    filtration: boolean;
    oxygene: boolean;
    buzzer: boolean;
    feeder?: boolean;
    eclairage_pwm: number;
    mode: "AUTO" | "MANUAL";
    temps_repas?: boolean;
    kill_switch: boolean;
  };
  alertes: string[];
  updatedAt?: number;
}

export interface TelemetryHistoryPoint {
  timestamp: number;
  temp: number | null;
  ph: number;
  tds: number;
  lux: number;
  remplissage_pct: number;
  anomaly_score: number;
  feeder_actif: number;
}

type ActuatorCommandState = {
  chauffage: boolean;
  filtration: boolean;
  oxygene: boolean;
  buzzer: boolean;
  feeder: boolean;
  eclairage_pwm: number;
};

type FirebaseCommand = {
  mode: "AUTO" | "MANUAL";
  kill_switch: boolean;
  feed_now: boolean;
  actuators: ActuatorCommandState;
  timestamp: number;
};

export const DEFAULT_TELEMETRY: TelemetryData = {
  device_id: "EB-AQ-7F3C",
  sensors: {
    temp: 26.5,
    ph: 7,
    tds: 450,
    lux: 150,
    remplissage_pct: 70,
    flotteur: "NOMINAL",
    anomaly_score: 34,
  },
  actuators: {
    chauffage: false,
    filtration: true,
    oxygene: true,
    buzzer: false,
    feeder: false,
    eclairage_pwm: 150,
    mode: "AUTO",
    temps_repas: false,
    kill_switch: false,
  },
  alertes: [],
  updatedAt: Date.now(),
};

function toNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true" || value === "ON") return true;
  if (value === 0 || value === "0" || value === "false" || value === "OFF") return false;
  return fallback;
}

function normalizeAnomalyScore(value: unknown, fallback: number) {
  return toNumber(value, fallback);
}

export function normalizeTelemetry(raw: any): TelemetryData {
  const sensors = raw?.sensors ?? raw ?? {};
  const actuators = raw?.actuators ?? {};

  const tempSource = sensors.temp ?? raw?.sensors_temp ?? DEFAULT_TELEMETRY.sensors.temp;
  const temp =
    tempSource === null || tempSource === undefined
      ? null
      : toNumber(tempSource, DEFAULT_TELEMETRY.sensors.temp ?? 0);

  const mode = actuators.mode === "MANUAL" ? "MANUAL" : "AUTO";
  const incomingAlerts = Array.isArray(raw?.alertes)
    ? raw.alertes
    : typeof raw?.alertes === "string"
      ? [raw.alertes]
      : [];

  const tempsRepas = toBoolean(actuators.temps_repas, DEFAULT_TELEMETRY.actuators.temps_repas ?? false);

  return {
    device_id: raw?.device_id ?? DEFAULT_TELEMETRY.device_id,
    sensors: {
      temp,
      ph: toNumber(sensors.ph ?? raw?.sensors_ph, DEFAULT_TELEMETRY.sensors.ph),
      tds: Math.round(toNumber(sensors.tds ?? raw?.sensors_tds, DEFAULT_TELEMETRY.sensors.tds)),
      lux: Math.round(toNumber(sensors.lux ?? raw?.sensors_lux, DEFAULT_TELEMETRY.sensors.lux)),
      remplissage_pct: Math.round(
        toNumber(sensors.remplissage_pct, DEFAULT_TELEMETRY.sensors.remplissage_pct),
      ),
      flotteur: String(sensors.flotteur ?? DEFAULT_TELEMETRY.sensors.flotteur),
      anomaly_score: normalizeAnomalyScore(sensors.anomaly_score, DEFAULT_TELEMETRY.sensors.anomaly_score ?? 0),
    },
    actuators: {
      chauffage: toBoolean(actuators.chauffage, DEFAULT_TELEMETRY.actuators.chauffage),
      filtration: toBoolean(actuators.filtration, DEFAULT_TELEMETRY.actuators.filtration),
      oxygene: toBoolean(actuators.oxygene, DEFAULT_TELEMETRY.actuators.oxygene),
      buzzer: toBoolean(actuators.buzzer, DEFAULT_TELEMETRY.actuators.buzzer),
      feeder: toBoolean(actuators.feeder, tempsRepas),
      eclairage_pwm: Math.max(
        0,
        Math.min(255, Math.round(toNumber(actuators.eclairage_pwm, DEFAULT_TELEMETRY.actuators.eclairage_pwm))),
      ),
      mode,
      temps_repas: tempsRepas,
      kill_switch: toBoolean(actuators.kill_switch, DEFAULT_TELEMETRY.actuators.kill_switch),
    },
    alertes: incomingAlerts,
    updatedAt: raw?.updatedAt ?? Date.now(),
  };
}

function normalizeHistoryPoint(timestamp: number, raw: any): TelemetryHistoryPoint {
  const sensors = raw?.sensors ?? raw ?? {};
  const defaultSensors = DEFAULT_TELEMETRY.sensors;
  const tempSource = sensors.temp ?? raw?.temp ?? defaultSensors.temp;

  return {
    timestamp,
    temp:
      tempSource === null || tempSource === undefined
        ? null
        : toNumber(tempSource, defaultSensors.temp ?? 0),
    ph: toNumber(sensors.ph ?? raw?.ph, defaultSensors.ph),
    tds: Math.round(toNumber(sensors.tds ?? raw?.tds, defaultSensors.tds)),
    lux: Math.round(toNumber(sensors.lux ?? raw?.lux, defaultSensors.lux)),
    remplissage_pct: Math.round(
      toNumber(sensors.remplissage_pct ?? raw?.remplissage_pct, defaultSensors.remplissage_pct),
    ),
    anomaly_score: normalizeAnomalyScore(
      sensors.anomaly_score ?? raw?.anomaly_score ?? raw?.score_anomalie,
      defaultSensors.anomaly_score ?? 0,
    ),
    feeder_actif: toBoolean(raw?.feeder_actif, false) ? 1 : 0,
  };
}

function buildFirebaseCommand(command: any, telemetry: TelemetryData | null): FirebaseCommand {
  const mode = command?.mode === "AUTO" ? "AUTO" : "MANUAL";
  const feedNow = Boolean(command?.feed_now);
  const incomingActuators =
    command?.actuators && typeof command.actuators === "object" ? command.actuators : {};
  const currentActuators = telemetry?.actuators ?? DEFAULT_TELEMETRY.actuators;

  return {
    mode,
    kill_switch: toBoolean(command?.kill_switch, currentActuators.kill_switch),
    feed_now: feedNow,
    actuators: {
      chauffage: toBoolean(incomingActuators.chauffage, currentActuators.chauffage),
      filtration: toBoolean(incomingActuators.filtration, currentActuators.filtration),
      oxygene: toBoolean(incomingActuators.oxygene, currentActuators.oxygene),
      buzzer: toBoolean(incomingActuators.buzzer, currentActuators.buzzer),
      feeder: feedNow,
      eclairage_pwm: Math.max(
        0,
        Math.min(255, Math.round(toNumber(incomingActuators.eclairage_pwm, currentActuators.eclairage_pwm))),
      ),
    },
    timestamp: Date.now(),
  };
}

export function useTelemetryWebSocket() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(DEFAULT_TELEMETRY);
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const configuredDeviceId = (import.meta.env.VITE_DEVICE_ID as string | undefined) || "aqua_01";
    const telemetryPaths = Array.from(
      new Set([
        `aquariums/${configuredDeviceId}/etat_actuel`,
        `aquariums/${DEFAULT_TELEMETRY.device_id}/etat_actuel`,
        "telemetry_live",
      ]),
    );

    const unsubscribes = telemetryPaths.map((path) =>
      onValue(
        ref(db, path),
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            setTelemetry(normalizeTelemetry(data));
            setIsConnected(true);
            setError(null);
          }
        },
        (firebaseError) => {
          setIsConnected(false);
          setError(firebaseError.message);
        },
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  useEffect(() => {
    const configuredDeviceId = (import.meta.env.VITE_DEVICE_ID as string | undefined) || "aqua_01";
    const historyPaths = Array.from(
      new Set([
        `aquariums/${configuredDeviceId}/historique`,
        `aquariums/${DEFAULT_TELEMETRY.device_id}/historique`,
      ]),
    );

    const unsubscribes = historyPaths.map((path) =>
      onValue(
        query(ref(db, path), orderByKey()),
        (snapshot) => {
          const data = snapshot.val();
          if (!data || typeof data !== "object") return;

          const points = Object.entries(data)
            .map(([key, value]) => normalizeHistoryPoint(Number(key), value))
            .filter((point) => Number.isFinite(point.timestamp))
            .sort((a, b) => a.timestamp - b.timestamp);

          if (points.length > 0) {
            setHistory(points);
          }
        },
        (firebaseError) => {
          setError(firebaseError.message);
        },
      ),
    );

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  const sendCommand = useCallback(async (command: any) => {
    try {
      const commandRef = push(ref(db, "commands"));
      await set(commandRef, buildFirebaseCommand(command, telemetry));
      setError(null);
      return true;
    } catch (firebaseError) {
      setError(firebaseError instanceof Error ? firebaseError.message : "Firebase command failed");
      return false;
    }
  }, [telemetry]);

  return { telemetry, history, isConnected, error, sendCommand };
}
