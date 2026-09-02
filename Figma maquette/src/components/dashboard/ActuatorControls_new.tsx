import { Flame, Filter, Wind, Lightbulb, Lock, Zap, AlertTriangle, BellRing } from "lucide-react";
import { Switch } from "../ui/switch";
import { TelemetryData } from "../../hooks/useTelemetryWebSocket";
import { useState, useEffect } from "react";

interface ToggleSwitchProps {
  enabled: boolean;
  onChange?: (val: boolean) => void;
  disabled?: boolean;
  color?: string;
  isLoading?: boolean;
}

function ToggleSwitch({ enabled, onChange, disabled, color = "#00d4ff", isLoading }: ToggleSwitchProps) {
  return (
    <div style={{ position: "relative" }}>
      <Switch 
        checked={enabled} 
        onCheckedChange={onChange} 
        disabled={disabled || isLoading}
        style={{ opacity: isLoading ? 0.6 : 1 }}
      />
      {isLoading && (
        <div
          className="absolute inset-0 rounded-full animate-spin"
          style={{
            width: 20,
            height: 20,
            border: "2px solid transparent",
            borderTopColor: color,
            borderRightColor: color,
          }}
        />
      )}
    </div>
  );
}

interface ActuatorRowProps {
  icon: React.ReactNode;
  name: string;
  description: string;
  enabled: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  lockedOn?: boolean;
  color: string;
  glowColor: string;
  powerDraw?: string;
  badge?: string;
  badgeColor?: string;
  isLoading?: boolean;
}

function ActuatorRow({
  icon,
  name,
  description,
  enabled,
  onChange,
  disabled,
  lockedOn,
  color,
  glowColor,
  powerDraw,
  badge,
  badgeColor,
  isLoading,
}: ActuatorRowProps) {
  return (
    <div
      className="flex items-center gap-4 rounded-xl px-4 py-3 transition-all duration-300"
      style={{
        background: enabled
          ? `linear-gradient(90deg, ${color}0a, transparent)`
          : "rgba(13,22,40,0.5)",
        border: `1px solid ${enabled ? color + "25" : "rgba(0,212,255,0.07)"}`,
        boxShadow: enabled ? `inset 0 0 20px ${color}08` : "none",
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      {/* Icon */}
      <div
        className="flex items-center justify-center rounded-xl shrink-0 relative"
        style={{
          width: 40,
          height: 40,
          background: enabled ? `${color}18` : "rgba(30,40,60,0.6)",
          border: `1px solid ${enabled ? color + "35" : "rgba(80,100,130,0.2)"}`,
          boxShadow: enabled ? `0 0 10px ${color}30` : "none",
        }}
      >
        {icon}
        {isLoading && (
          <div
            className="absolute inset-0 rounded-xl animate-spin"
            style={{
              border: `2px solid transparent`,
              borderTopColor: color,
              borderRightColor: color,
              opacity: 0.5,
            }}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 600,
              color: enabled ? "#e8f4ff" : "rgba(150,180,210,0.6)",
            }}
          >
            {name}
          </span>
          {badge && (
            <span
              className="px-2 py-0.5 rounded-md"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                fontWeight: 700,
                background: `${badgeColor || color}18`,
                border: `1px solid ${badgeColor || color}35`,
                color: badgeColor || color,
                letterSpacing: "0.08em",
              }}
            >
              {badge}
            </span>
          )}
          {lockedOn && (
            <div className="flex items-center gap-1">
              <Lock size={10} color="rgba(239,68,68,0.7)" />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: "rgba(239,68,68,0.7)",
                  letterSpacing: "0.06em",
                }}
              >
                SAFETY LOCK
              </span>
            </div>
          )}
          {isLoading && (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 8,
                color: color,
                letterSpacing: "0.06em",
                animation: "pulse 1.5s infinite",
              }}
            >
              SYNCING...
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            color: "rgba(120,150,180,0.5)",
            marginTop: 1,
          }}
        >
          {description}
        </div>
      </div>

      {/* Power draw */}
      {powerDraw && (
        <div className="flex items-center gap-1 shrink-0">
          <Zap size={10} color={enabled ? color : "rgba(100,120,150,0.4)"} />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: enabled ? color : "rgba(100,120,150,0.4)",
            }}
          >
            {powerDraw}
          </span>
        </div>
      )}

      {/* Status Dot */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div
          className={isLoading ? "animate-pulse" : ""}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: enabled ? color : "rgba(80,100,130,0.4)",
            boxShadow: enabled ? `0 0 6px ${glowColor}` : "none",
          }}
        />
      </div>

      {/* Toggle */}
      <ToggleSwitch
        enabled={lockedOn ? true : enabled}
        onChange={onChange}
        disabled={disabled || lockedOn}
        color={lockedOn ? "#ef4444" : color}
        isLoading={isLoading}
      />
    </div>
  );
}

interface LedSliderProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

function LedSlider({ value, onChange, disabled, isLoading }: LedSliderProps) {
  const percentage = Math.round((value / 255) * 100);

  return (
    <div
      className="rounded-xl px-4 py-3 transition-all duration-300"
      style={{
        background: value > 0
          ? "linear-gradient(90deg, rgba(251,191,36,0.06), transparent)"
          : "rgba(13,22,40,0.5)",
        border: `1px solid ${value > 0 ? "rgba(251,191,36,0.2)" : "rgba(0,212,255,0.07)"}`,
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className="flex items-center justify-center rounded-xl shrink-0 relative"
          style={{
            width: 40,
            height: 40,
            background: value > 0 ? "rgba(251,191,36,0.15)" : "rgba(30,40,60,0.6)",
            border: `1px solid ${value > 0 ? "rgba(251,191,36,0.3)" : "rgba(80,100,130,0.2)"}`,
            boxShadow: value > 0 ? "0 0 10px rgba(251,191,36,0.25)" : "none",
          }}
        >
          <Lightbulb
            size={18}
            color={value > 0 ? "#fbbf24" : "rgba(100,120,150,0.5)"}
            style={{ filter: value > 0 ? "drop-shadow(0 0 4px #fbbf24)" : "none" }}
          />
          {isLoading && (
            <div
              className="absolute inset-0 rounded-xl animate-spin"
              style={{
                border: `2px solid transparent`,
                borderTopColor: "#fbbf24",
                borderRightColor: "#fbbf24",
                opacity: 0.5,
              }}
            />
          )}
        </div>

        {/* Info & Slider */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    color: value > 0 ? "#e8f4ff" : "rgba(150,180,210,0.6)",
                  }}
                >
                  LED Lighting
                </span>
                <span
                  className="px-2 py-0.5 rounded-md"
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 8,
                    background: "rgba(251,191,36,0.12)",
                    border: "1px solid rgba(251,191,36,0.25)",
                    color: "#fbbf24",
                    letterSpacing: "0.08em",
                  }}
                >
                  PWM
                </span>
                {isLoading && (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 8,
                      color: "#fbbf24",
                      letterSpacing: "0.06em",
                      animation: "pulse 1.5s infinite",
                    }}
                  >
                    SYNCING...
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  color: "rgba(120,150,180,0.5)",
                  marginTop: 1,
                }}
              >
                Spectrum control · 0–255 range
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="rounded-lg px-3 py-1"
                style={{
                  background: "rgba(13,22,40,0.8)",
                  border: "1px solid rgba(0,212,255,0.15)",
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 15,
                    fontWeight: 700,
                    color: value > 0 ? "#fbbf24" : "rgba(100,120,150,0.5)",
                  }}
                >
                  {value}
                </span>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "rgba(100,120,150,0.5)",
                    marginLeft: 3,
                  }}
                >
                  / 255
                </span>
              </div>
              <div
                className="rounded-lg px-2 py-1"
                style={{
                  background: "rgba(251,191,36,0.1)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  minWidth: 44,
                  textAlign: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#fbbf24",
                  }}
                >
                  {percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="relative">
            <div
              className="relative rounded-full"
              style={{
                height: 6,
                background: "rgba(30,40,60,0.8)",
                border: "1px solid rgba(0,212,255,0.08)",
              }}
            >
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all duration-150"
                style={{
                  width: `${percentage}%`,
                  background:
                    value > 0
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "transparent",
                  boxShadow: value > 0 ? "0 0 8px rgba(251,191,36,0.5)" : "none",
                }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={255}
              value={value}
              disabled={disabled || isLoading}
              onChange={(e) => onChange(Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: 6, margin: 0, cursor: disabled || isLoading ? "not-allowed" : "pointer" }}
            />
          </div>

          {/* Scale marks */}
          <div className="flex justify-between mt-1">
            {[0, 64, 128, 192, 255].map((mark) => (
              <span
                key={mark}
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 8,
                  color: "rgba(100,120,150,0.4)",
                }}
              >
                {mark}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ActuatorControlsProps {
  telemetry: TelemetryData;
  isAutoMode: boolean;
  onSendCommand: (command: any) => void;
}

export function ActuatorControls({ telemetry, isAutoMode, onSendCommand }: ActuatorControlsProps) {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({
    chauffage: false,
    filtration: false,
    oxygene: false,
    buzzer: false,
    eclairage_pwm: false,
  });

  // Réinitialiser le loading state après 1.5s
  useEffect(() => {
    const timers = Object.entries(loadingStates).map(([key, isLoading]) => {
      if (isLoading) {
        return setTimeout(() => {
          setLoadingStates((prev) => ({ ...prev, [key]: false }));
        }, 1500);
      }
      return null;
    });

    return () => timers.forEach((t) => t && clearTimeout(t));
  }, [loadingStates]);

  const handleToggleActuator = (
    actuator: "chauffage" | "filtration" | "oxygene" | "buzzer",
    newState: boolean
  ) => {
    // Feedback immédiat - show loading state
    setLoadingStates((prev) => ({ ...prev, [actuator]: true }));

    const command = {
      mode: "MANUAL",
      actuators: {
        ...telemetry.actuators,
        [actuator]: newState,
      },
    };
    onSendCommand(command);
  };

  const handleLightingChange = (newValue: number) => {
    // Feedback immédiat
    setLoadingStates((prev) => ({ ...prev, eclairage_pwm: true }));

    const command = {
      mode: "MANUAL",
      actuators: {
        ...telemetry.actuators,
        eclairage_pwm: newValue,
      },
    };
    onSendCommand(command);
  };

  const actuators = telemetry.actuators;

  return (
    <div className="flex flex-col gap-3">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: "rgba(0,212,255,0.7)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          ▸ Actuator Controls
        </div>
        {isAutoMode && (
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-1"
            style={{
              background: "rgba(251,191,36,0.08)",
              border: "1px solid rgba(251,191,36,0.2)",
            }}
          >
            <AlertTriangle size={11} color="#f59e0b" />
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
                color: "#f59e0b",
              }}
            >
              AUTO MODE active — manual overrides limited
            </span>
          </div>
        )}
      </div>

      {/* Controls Grid */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{
          background: "linear-gradient(145deg, #0d1628 0%, #0a1020 100%)",
          border: "1px solid rgba(0,212,255,0.1)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        }}
      >
        {/* Heater */}
        <ActuatorRow
          icon={
            <Flame
              size={18}
              color={actuators.chauffage ? "#ff6b35" : "rgba(100,120,150,0.5)"}
              style={{ filter: actuators.chauffage ? "drop-shadow(0 0 4px #ff6b35)" : "none" }}
            />
          }
          name="Water Heater"
          description="Target 26.5 °C · Thermostat auto-cutoff enabled"
          enabled={actuators.chauffage}
          onChange={(v) => handleToggleActuator("chauffage", v)}
          disabled={isAutoMode}
          color="#ff6b35"
          glowColor="#ff6b35"
          powerDraw="200W"
          badge="HEATER"
          badgeColor="#ff6b35"
          isLoading={loadingStates.chauffage}
        />

        {/* Filter */}
        <ActuatorRow
          icon={
            <Filter
              size={18}
              color={actuators.filtration ? "#00d4ff" : "rgba(100,120,150,0.5)"}
              style={{ filter: actuators.filtration ? "drop-shadow(0 0 4px #00d4ff)" : "none" }}
            />
          }
          name="Water Filter"
          description="Canister filter · 800L/h flow rate"
          enabled={actuators.filtration}
          onChange={(v) => handleToggleActuator("filtration", v)}
          disabled={isAutoMode}
          color="#00d4ff"
          glowColor="#00d4ff"
          powerDraw="18W"
          badge="FILTER"
          badgeColor="#00d4ff"
          isLoading={loadingStates.filtration}
        />

        {/* Oxygen — locked ON */}
        <ActuatorRow
          icon={
            <Wind
              size={18}
              color="#39ff14"
              style={{ filter: "drop-shadow(0 0 4px #39ff14)" }}
            />
          }
          name="Oxygen Pump"
          description="Forced ON — critical for fish safety · Do not disable"
          enabled={true}
          lockedOn={true}
          color="#39ff14"
          glowColor="#39ff14"
          powerDraw="5W"
          badge="O₂ CRITICAL"
          badgeColor="#ef4444"
          isLoading={loadingStates.oxygene}
        />

        {/* Buzzer */}
        <ActuatorRow
          icon={
            <BellRing
              size={18}
              color={actuators.buzzer ? "#f59e0b" : "rgba(100,120,150,0.5)"}
              style={{ filter: actuators.buzzer ? "drop-shadow(0 0 4px #f59e0b)" : "none" }}
            />
          }
          name="Alert Buzzer"
          description="Audible alarm · Triggers on critical sensor thresholds"
          enabled={actuators.buzzer}
          onChange={(v) => handleToggleActuator("buzzer", v)}
          disabled={isAutoMode}
          color="#f59e0b"
          glowColor="#f59e0b"
          badge="BUZZER"
          badgeColor="#f59e0b"
          isLoading={loadingStates.buzzer}
        />

        {/* LED Lighting */}
        <LedSlider
          value={actuators.eclairage_pwm}
          onChange={handleLightingChange}
          disabled={isAutoMode}
          isLoading={loadingStates.eclairage_pwm}
        />
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
