import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, BellRing, Filter, Flame, Lightbulb, Lock, Utensils, Wind } from "lucide-react";
import { Switch } from "../ui/switch";
import type { TelemetryData } from "../../hooks/useTelemetryWebSocket";

const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', sans-serif";

interface ActuatorRowProps {
  icon: ReactNode;
  name: string;
  enabled: boolean;
  color: string;
  locked?: boolean;
  disabled?: boolean;
  action?: ReactNode;
  onChange?: (enabled: boolean) => void;
  loading?: boolean;
}

function SectionTitle({ isAutoMode, emergencyActive }: { isAutoMode: boolean; emergencyActive: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div
        style={{
          fontFamily: sans,
          fontSize: 16,
          fontWeight: 900,
          color: "rgba(0,212,255,0.82)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Actuator Controls
      </div>
      {(isAutoMode || emergencyActive) && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{
            borderRadius: 8,
            background: emergencyActive ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.08)",
            border: emergencyActive ? "1px solid rgba(239,68,68,0.38)" : "1px solid rgba(245,158,11,0.28)",
          }}
        >
          <AlertTriangle size={14} color={emergencyActive ? "#ef4444" : "#f59e0b"} />
          <span style={{ fontFamily: sans, fontSize: 13, color: emergencyActive ? "#ef4444" : "#f59e0b" }}>
            {emergencyActive ? "EMERGENCY STOP active - controls locked" : "AUTO MODE active - manual overrides limited"}
          </span>
        </div>
      )}
    </div>
  );
}

function ActuatorRow({
  icon,
  name,
  enabled,
  color,
  locked = false,
  disabled = false,
  action,
  onChange,
  loading = false,
}: ActuatorRowProps) {
  const inactive = disabled && !enabled;

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 transition-all duration-200"
      style={{
        minHeight: 74,
        borderRadius: 8,
        background: enabled ? `linear-gradient(90deg, ${color}10, rgba(13,22,40,0.46))` : "rgba(13,22,40,0.48)",
        border: enabled ? `1px solid ${color}32` : "1px solid rgba(0,212,255,0.08)",
        boxShadow: enabled ? `inset 0 0 28px ${color}08` : "none",
        opacity: inactive ? 0.58 : 1,
      }}
    >
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{
          width: 50,
          height: 50,
          borderRadius: 15,
          background: enabled ? `${color}18` : "rgba(39,51,77,0.62)",
          border: enabled ? `1px solid ${color}40` : "1px solid rgba(120,145,180,0.12)",
          boxShadow: enabled ? `0 0 26px ${color}22` : "none",
        }}
      >
        {icon}
        {loading && (
          <span
            className="absolute inset-0 animate-spin"
            style={{
              borderRadius: 15,
              border: "2px solid transparent",
              borderTopColor: color,
              borderRightColor: color,
            }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <span
            style={{
              fontFamily: sans,
              fontSize: 17,
              fontWeight: 900,
              color: enabled ? "#e8f4ff" : "rgba(151,169,199,0.7)",
            }}
          >
            {name}
          </span>
          {locked && (
            <span className="flex items-center gap-2" style={{ color: "#ef4444" }}>
              <Lock size={14} />
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.12em" }}>SAFETY LOCK</span>
            </span>
          )}
        </div>
      </div>

      <span
        className={enabled ? "animate-pulse" : ""}
        style={{
          width: 10,
          height: 10,
          flexShrink: 0,
          borderRadius: 999,
          background: enabled ? color : "rgba(80,101,138,0.52)",
          boxShadow: enabled ? `0 0 14px ${color}` : "none",
        }}
      />

      {action ?? (
        <Switch checked={locked ? true : enabled} disabled={disabled || locked || loading} onCheckedChange={onChange} />
      )}
    </div>
  );
}

function LedSlider({
  value,
  disabled,
  loading,
  onChange,
}: {
  value: number;
  disabled: boolean;
  loading: boolean;
  onChange: (value: number) => void;
}) {
  const percent = Math.round((value / 255) * 100);

  return (
    <div
      className="px-5 py-4"
      style={{
        borderRadius: 8,
        background: "linear-gradient(90deg, rgba(251,191,36,0.09), rgba(13,22,40,0.5))",
        border: "1px solid rgba(251,191,36,0.28)",
        opacity: disabled ? 0.78 : 1,
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div
          className="flex shrink-0 items-center justify-center"
          style={{
            width: 50,
            height: 50,
            borderRadius: 15,
            background: "rgba(251,191,36,0.15)",
            border: "1px solid rgba(251,191,36,0.38)",
            boxShadow: "0 0 26px rgba(251,191,36,0.2)",
          }}
        >
          <Lightbulb size={23} color="#fbbf24" />
        </div>

        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span style={{ fontFamily: sans, fontSize: 17, fontWeight: 900, color: "#e8f4ff" }}>
              LED Lighting
            </span>
            {loading && (
              <span style={{ fontFamily: mono, fontSize: 10, color: "#fbbf24", letterSpacing: "0.12em" }}>
                SYNCING
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            style={{
              minWidth: 104,
              borderRadius: 8,
              padding: "8px 14px",
              background: "rgba(9,16,31,0.88)",
              border: "1px solid rgba(0,212,255,0.18)",
              textAlign: "center",
            }}
          >
            <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 900, color: "#fbbf24" }}>{value}</span>
            <span style={{ marginLeft: 6, fontFamily: mono, fontSize: 11, color: "rgba(107,126,164,0.72)" }}>
              / 255
            </span>
          </div>
          <div
            style={{
              minWidth: 58,
              borderRadius: 8,
              padding: "9px 12px",
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.32)",
              textAlign: "center",
              fontFamily: mono,
              fontSize: 15,
              fontWeight: 900,
              color: "#fbbf24",
            }}
          >
            {percent}%
          </div>
        </div>
      </div>

      <div className="relative">
        <div
          style={{
            height: 8,
            borderRadius: 8,
            background: "rgba(29,43,68,0.95)",
            border: "1px solid rgba(0,212,255,0.08)",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 8,
              background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
              boxShadow: "0 0 18px rgba(251,191,36,0.55)",
            }}
          />
        </div>
        <input
          aria-label="LED intensity"
          type="range"
          min={0}
          max={255}
          value={value}
          disabled={disabled || loading}
          onChange={(event) => onChange(Number(event.target.value))}
          className="absolute inset-0 w-full opacity-0"
          style={{ height: 8, cursor: disabled || loading ? "not-allowed" : "pointer" }}
        />
      </div>
      <div className="mt-2 flex justify-between">
        {[0, 64, 128, 192, 255].map((mark) => (
          <span key={mark} style={{ fontFamily: mono, fontSize: 10, color: "rgba(96,116,151,0.55)" }}>
            {mark}
          </span>
        ))}
      </div>
    </div>
  );
}

interface ActuatorControlsProps {
  telemetry: TelemetryData;
  isAutoMode: boolean;
  emergencyActive: boolean;
  onSendCommand: (command: any) => void;
}

export function ActuatorControls({ telemetry, isAutoMode, emergencyActive, onSendCommand }: ActuatorControlsProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  const actuators = telemetry.actuators;
  const controlsDisabled = isAutoMode || emergencyActive;

  useEffect(() => {
    const timers = Object.entries(loadingStates).map(([key, loading]) => {
      if (!loading) return null;
      return window.setTimeout(() => {
        setLoadingStates((current) => ({ ...current, [key]: false }));
      }, 900);
    });

    return () => timers.forEach((timer) => timer && window.clearTimeout(timer));
  }, [loadingStates]);

  const sendActuator = (key: "chauffage" | "filtration" | "oxygene" | "buzzer", value: boolean) => {
    setLoadingStates((current) => ({ ...current, [key]: true }));
    onSendCommand({
      mode: "MANUAL",
      actuators: {
        ...actuators,
        [key]: value,
      },
    });
  };

  const sendLighting = (value: number) => {
    setLoadingStates((current) => ({ ...current, eclairage_pwm: true }));
    onSendCommand({
      mode: "MANUAL",
      actuators: {
        ...actuators,
        eclairage_pwm: value,
      },
    });
  };

  const feedNow = () => {
    setLoadingStates((current) => ({ ...current, feeder: true }));
    onSendCommand({
      mode: "MANUAL",
      feed_now: true,
      actuators: {
        ...actuators,
        feeder: true,
      },
    });
  };

  return (
    <section>
      <SectionTitle isAutoMode={isAutoMode} emergencyActive={emergencyActive} />

      <div
        className="flex flex-col gap-3 p-5"
        style={{
          borderRadius: 8,
          background: "linear-gradient(145deg, rgba(13,22,40,0.96), rgba(9,16,31,0.98))",
          border: "1px solid rgba(0,212,255,0.13)",
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
        }}
      >
        <ActuatorRow
          icon={<Flame size={23} color={actuators.chauffage ? "#ff6b35" : "rgba(108,130,165,0.58)"} />}
          name="Water Heater"
          enabled={actuators.chauffage}
          color="#ff6b35"
          disabled={controlsDisabled}
          loading={loadingStates.chauffage}
          onChange={(value) => sendActuator("chauffage", value)}
        />

        <ActuatorRow
          icon={<Filter size={23} color={actuators.filtration ? "#00d4ff" : "rgba(108,130,165,0.58)"} />}
          name="Water Filter"
          enabled={actuators.filtration}
          color="#00d4ff"
          disabled={controlsDisabled}
          loading={loadingStates.filtration}
          onChange={(value) => sendActuator("filtration", value)}
        />

        <ActuatorRow
          icon={<Wind size={23} color={emergencyActive ? "rgba(108,130,165,0.58)" : "#39ff14"} />}
          name="Oxygen Pump"
          enabled={!emergencyActive}
          color="#39ff14"
          locked={!emergencyActive}
          disabled={emergencyActive}
        />

        <ActuatorRow
          icon={<Utensils size={23} color="rgba(108,130,165,0.58)" />}
          name="Fish Feeder"
          enabled={Boolean(actuators.feeder || actuators.temps_repas)}
          color="#a855f7"
          disabled={controlsDisabled || loadingStates.feeder}
          loading={loadingStates.feeder}
          action={
            <button
              type="button"
              disabled={controlsDisabled || loadingStates.feeder}
              onClick={feedNow}
              className="transition-all duration-200 hover:brightness-125 active:scale-95"
              style={{
                borderRadius: 8,
                padding: "10px 18px",
                background: controlsDisabled || loadingStates.feeder
                  ? "rgba(118,135,170,0.08)"
                  : "rgba(168,85,247,0.18)",
                border: controlsDisabled || loadingStates.feeder
                  ? "1px solid rgba(118,135,170,0.16)"
                  : "1px solid rgba(168,85,247,0.58)",
                boxShadow: controlsDisabled || loadingStates.feeder ? "none" : "0 0 20px rgba(168,85,247,0.2)",
                color: controlsDisabled || loadingStates.feeder ? "rgba(151,169,199,0.48)" : "#c084fc",
                fontFamily: mono,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.14em",
                cursor: controlsDisabled || loadingStates.feeder ? "not-allowed" : "pointer",
              }}
            >
              FEED NOW
            </button>
          }
        />

        <ActuatorRow
          icon={<BellRing size={23} color={actuators.buzzer ? "#f59e0b" : "rgba(108,130,165,0.58)"} />}
          name="Alert Buzzer"
          enabled={actuators.buzzer}
          color="#f59e0b"
          disabled={controlsDisabled}
          loading={loadingStates.buzzer}
          onChange={(value) => sendActuator("buzzer", value)}
        />

        <LedSlider
          value={actuators.eclairage_pwm}
          disabled={controlsDisabled}
          loading={loadingStates.eclairage_pwm}
          onChange={sendLighting}
        />
      </div>
    </section>
  );
}
