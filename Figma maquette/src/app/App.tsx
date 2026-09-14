import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, HelpCircle, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { ActuatorControls } from "../components/dashboard/ActuatorControls";
import { AlertsHistory } from "../components/dashboard/AlertsHistory";
import { AlertsLog } from "../components/dashboard/AlertsLog";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { SensorCards } from "../components/dashboard/SensorCards";
import { SensorCharts } from "../components/dashboard/SensorCharts";
import type { TelemetryData } from "../hooks/useTelemetryWebSocket";
import { useTelemetryWebSocket } from "../hooks/useTelemetryWebSocket";

const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', sans-serif";

function StatusSummary({ telemetry }: { telemetry: TelemetryData }) {
  const activeActuators = [
    telemetry.actuators.chauffage,
    telemetry.actuators.filtration,
    telemetry.actuators.oxygene,
    telemetry.actuators.buzzer,
    telemetry.actuators.feeder,
  ].filter(Boolean).length;

  const avgTemp = telemetry.sensors.temp ?? 0;
  const items = [
    { label: "Uptime", value: "47d 13h 22m", color: "#39ff14" },
    { label: "Readings", value: "1,247,832", color: "#00d4ff" },
    { label: "Alerts Today", value: String(telemetry.alertes.length), color: "#ef4444" },
    { label: "Avg Temp", value: `${avgTemp.toFixed(1)} \u00b0C`, color: "#ff6b35" },
    { label: "Active Actuators", value: `${activeActuators} / 5`, color: "#b35cff" },
    { label: "Mode", value: telemetry.actuators.mode, color: telemetry.actuators.mode === "AUTO" ? "#00d4ff" : "#f59e0b" },
  ];

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-7 gap-y-4 px-8 py-5"
      style={{
        borderRadius: 8,
        background: "rgba(0,212,255,0.045)",
        border: "1px solid rgba(0,212,255,0.12)",
      }}
    >
      {items.map((item) => (
        <div key={item.label} className="flex shrink-0 items-baseline gap-3">
          <span style={{ fontFamily: sans, fontSize: 15, color: "rgba(118,143,178,0.72)" }}>
            {item.label}:
          </span>
          <span
            style={{
              fontFamily: mono,
              fontSize: 16,
              fontWeight: 900,
              color: item.color,
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function ManualModeBanner({ error }: { error?: string | null }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-5 py-3"
      style={{
        borderRadius: 8,
        background: error
          ? "linear-gradient(90deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))"
          : "linear-gradient(90deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))",
        border: error ? "1px solid rgba(245,158,11,0.32)" : "1px solid rgba(239,68,68,0.32)",
      }}
    >
      <AlertTriangle size={18} color={error ? "#f59e0b" : "#ef4444"} />
      <span
        style={{
          fontFamily: mono,
          fontSize: 13,
          fontWeight: 900,
          color: error ? "#f59e0b" : "#ef4444",
          letterSpacing: "0.12em",
        }}
      >
        {error ? "CONNECTION NOTICE" : "MANUAL MODE ACTIVE"}
      </span>
      <span style={{ fontFamily: sans, fontSize: 14, color: error ? "rgba(245,158,11,0.75)" : "rgba(239,68,68,0.75)" }}>
        {error || "Automations are paused. Keep manual monitoring active."}
      </span>
    </div>
  );
}

function EmergencyStopBanner({ pending }: { pending: boolean | null }) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 px-5 py-3"
      style={{
        borderRadius: 8,
        background: "linear-gradient(90deg, rgba(239,68,68,0.2), rgba(127,29,29,0.08))",
        border: "1px solid rgba(239,68,68,0.52)",
        boxShadow: "0 0 28px rgba(239,68,68,0.12)",
      }}
    >
      <AlertTriangle size={19} color="#ff6262" />
      <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 900, color: "#ff6262", letterSpacing: "0.12em" }}>
        ARRET D'URGENCE
      </span>
      <span style={{ fontFamily: sans, fontSize: 14, color: "rgba(255,150,150,0.82)" }}>
        {pending !== null
          ? "Commande envoyee, attente de confirmation de l'ESP32."
          : "Actionneurs coupes. Alarme sonore maintenue."}
      </span>
    </div>
  );
}

function ComingSoonSection({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  return (
    <div
      className="flex min-h-[420px] flex-col items-center justify-center gap-4"
      style={{
        borderRadius: 8,
        background: "linear-gradient(145deg, #0f1729 0%, #0b1222 100%)",
        border: "1px solid rgba(0,212,255,0.13)",
      }}
    >
      <Icon size={42} color="rgba(0,212,255,0.42)" />
      <div
        style={{
          fontFamily: mono,
          fontSize: 14,
          fontWeight: 900,
          color: "rgba(0,212,255,0.58)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <div style={{ fontFamily: sans, fontSize: 14, color: "rgba(118,143,178,0.66)" }}>
        Section en cours de preparation
      </div>
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [killSwitchPending, setKillSwitchPending] = useState<boolean | null>(null);
  const { telemetry, history, isConnected, error, sendCommand } = useTelemetryWebSocket();

  const currentTelemetry = telemetry;
  const isAutoMode = currentTelemetry?.actuators.mode !== "MANUAL";
  const killSwitchActive = currentTelemetry?.actuators.kill_switch ?? false;
  const emergencyLocked = killSwitchActive || killSwitchPending !== null;

  useEffect(() => {
    if (killSwitchPending !== null && killSwitchActive === killSwitchPending) {
      setKillSwitchPending(null);
    }
  }, [killSwitchActive, killSwitchPending]);

  const handleModeChange = (newMode: "AUTO" | "MANUAL") => {
    if (!currentTelemetry || emergencyLocked) return;

    sendCommand({
      mode: newMode,
      ...(newMode === "MANUAL" && {
        actuators: {
          chauffage: currentTelemetry.actuators.chauffage,
          filtration: currentTelemetry.actuators.filtration,
          oxygene: currentTelemetry.actuators.oxygene,
          buzzer: currentTelemetry.actuators.buzzer,
          feeder: currentTelemetry.actuators.feeder ?? false,
          eclairage_pwm: currentTelemetry.actuators.eclairage_pwm,
        },
      }),
    });
  };

  const handleKillSwitchChange = async (active: boolean) => {
    if (!currentTelemetry) return false;

    setKillSwitchPending(active);
    const sent = await sendCommand({
      mode: currentTelemetry.actuators.mode,
      kill_switch: active,
      feed_now: false,
      actuators: {
        chauffage: currentTelemetry.actuators.chauffage,
        filtration: currentTelemetry.actuators.filtration,
        oxygene: currentTelemetry.actuators.oxygene,
        buzzer: currentTelemetry.actuators.buzzer,
        feeder: false,
        eclairage_pwm: currentTelemetry.actuators.eclairage_pwm,
      },
    });

    if (!sent) setKillSwitchPending(null);
    return sent;
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []);

  const content = useMemo(() => {
    if (!currentTelemetry) {
      return (
        <div className="flex min-h-[360px] items-center justify-center" style={{ color: "rgba(0,212,255,0.5)" }}>
          Connexion au flux de telemetrie...
        </div>
      );
    }

    if (activeSection === "charts") {
      return <SensorCharts telemetry={currentTelemetry} history={history} />;
    }

    if (activeSection === "alerts-history") {
      return <AlertsHistory />;
    }

    if (activeSection === "settings") {
      return <ComingSoonSection title="Settings" icon={Settings} />;
    }

    if (activeSection === "help") {
      return <ComingSoonSection title="Help" icon={HelpCircle} />;
    }

    return (
      <div key={refreshKey} className="flex flex-col gap-8">
        <SensorCards telemetry={currentTelemetry} />
        <ActuatorControls
          telemetry={currentTelemetry}
          isAutoMode={isAutoMode}
          emergencyActive={emergencyLocked}
          onSendCommand={sendCommand}
        />
        <AlertsLog alertes={currentTelemetry.alertes} />
      </div>
    );
  }, [activeSection, currentTelemetry, emergencyLocked, history, isAutoMode, refreshKey, sendCommand]);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{
        background: "#060c18",
        color: "#e8f4ff",
        fontFamily: sans,
      }}
    >
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardHeader
          isAutoMode={isAutoMode}
          onModeChange={handleModeChange}
          isConnected={isConnected}
          error={error}
          onRefresh={handleRefresh}
          killSwitchActive={killSwitchActive}
          killSwitchPending={killSwitchPending}
          onKillSwitchChange={handleKillSwitchChange}
          activeAlertCount={currentTelemetry?.alertes.length ?? 0}
        />

        <div
          className="flex-1 overflow-y-auto px-[30px] py-[30px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,212,255,0.025), rgba(0,0,0,0) 250px), #060c18",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,212,255,0.2) transparent",
          }}
        >
          <div className="flex w-full flex-col gap-8">
            {emergencyLocked ? (
              <EmergencyStopBanner pending={killSwitchPending} />
            ) : (
              (!isAutoMode || error) && <ManualModeBanner error={error} />
            )}

            {content}

            <footer
              className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t py-5"
              style={{
                borderColor: "rgba(0,212,255,0.08)",
                fontFamily: mono,
                fontSize: 12,
                color: "rgba(0,212,255,0.35)",
                letterSpacing: "0.12em",
              }}
            >
              <span>EDGEBRAIN AQUA - IIoT PLATFORM - NODE-ID: {currentTelemetry?.device_id ?? "EB-AQ-7F3C"}</span>
              <span>SECURE CHANNEL - TLS 1.3 - AES-256</span>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
