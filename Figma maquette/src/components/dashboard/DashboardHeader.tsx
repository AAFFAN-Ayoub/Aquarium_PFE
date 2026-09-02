import { useEffect, useState } from "react";
import { Clock, Loader, OctagonAlert, RefreshCw, Wifi } from "lucide-react";

interface DashboardHeaderProps {
  isAutoMode: boolean;
  onModeChange: (mode: "AUTO" | "MANUAL") => void;
  isConnected?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  killSwitchActive: boolean;
  killSwitchPending: boolean | null;
  onKillSwitchChange: (active: boolean) => Promise<boolean>;
  activeAlertCount: number;
}

export function DashboardHeader({
  isAutoMode,
  onModeChange,
  isConnected = true,
  error = null,
  onRefresh,
  killSwitchActive,
  killSwitchPending,
  onKillSwitchChange,
  activeAlertCount,
}: DashboardHeaderProps) {
  const [time, setTime] = useState(new Date());
  const [spinning, setSpinning] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);
  const [killSwitchSending, setKillSwitchSending] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => d.toLocaleTimeString("en-US", { hour12: false });
  const formatDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const handleRefresh = () => {
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 650);
    onRefresh?.();
  };

  const handleModeClick = (mode: "AUTO" | "MANUAL") => {
    if ((mode === "AUTO") === isAutoMode || modeLoading || killSwitchActive || killSwitchPending !== null) return;
    setModeLoading(true);
    onModeChange(mode);
    window.setTimeout(() => setModeLoading(false), 900);
  };

  const handleKillSwitch = async () => {
    if (killSwitchSending) return;

    const nextState = !killSwitchActive;
    const confirmationMessage = nextState
      ? "Confirmer l'activation de l'arret d'urgence ?"
      : "Confirmer la levee de l'arret d'urgence ?";

    if (!window.confirm(confirmationMessage)) return;

    setKillSwitchSending(true);
    await onKillSwitchChange(nextState);
    setKillSwitchSending(false);
  };

  const emergencyLocked = killSwitchActive || killSwitchPending !== null;
  const emergencyVisualActive = killSwitchActive || killSwitchPending === true;

  return (
    <header
      className="shrink-0 px-4 py-5 2xl:px-[30px]"
      style={{
        minHeight: 105,
        background: "linear-gradient(180deg, #0b1222 0%, #0a1020 100%)",
        borderBottom: "1px solid rgba(0,212,255,0.13)",
      }}
    >
      <div className="flex h-full items-start justify-between gap-3 2xl:gap-5">
        <div className="min-w-[185px] 2xl:min-w-[250px]">
          <div className="flex items-center">
            <h1
              style={{
                margin: 0,
                fontFamily: "'Inter', sans-serif",
                fontSize: 25,
                fontWeight: 900,
                lineHeight: 1.05,
                color: "#00d4ff",
              }}
            >
              EdgeBrain Aqua
            </h1>
          </div>

          <p
            style={{
              margin: "10px 0 0",
              maxWidth: 250,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              lineHeight: 1.45,
              color: "rgba(0,212,255,0.58)",
              letterSpacing: "0.08em",
            }}
          >
            Smart Aquarium Control System
          </p>
        </div>

        <div className="flex flex-1 flex-nowrap items-start justify-end gap-2 2xl:gap-5">
          <div
            role="status"
            aria-live="polite"
            title={activeAlertCount > 0 ? `${activeAlertCount} active alert(s)` : "No active alerts"}
            className={
              activeAlertCount > 0
                ? "flex h-[65px] w-[112px] shrink-0 flex-col items-center justify-center animate-pulse 2xl:w-[168px]"
                : "flex h-[65px] w-[112px] shrink-0 flex-col items-center justify-center 2xl:w-[168px]"
            }
            style={{
              borderRadius: 8,
              background: activeAlertCount > 0 ? "rgba(239,68,68,0.14)" : "rgba(57,255,20,0.05)",
              border: activeAlertCount > 0
                ? "1px solid rgba(255,92,92,0.62)"
                : "1px solid rgba(57,255,20,0.2)",
              boxShadow: activeAlertCount > 0 ? "0 0 22px rgba(239,68,68,0.2)" : "none",
              userSelect: "none",
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 900,
                color: activeAlertCount > 0 ? "#ff6262" : "rgba(57,255,20,0.68)",
                letterSpacing: "0.1em",
              }}
            >
              {activeAlertCount > 0 ? "ALERT!" : "NO ALERT"}
            </span>
            {activeAlertCount > 0 && (
              <span
                style={{
                  marginTop: 5,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  fontWeight: 900,
                  color: "rgba(255,150,150,0.78)",
                }}
              >
                {activeAlertCount} ACTIVE
              </span>
            )}
          </div>

          <div
            className="flex h-[65px] w-[112px] items-center gap-1 px-2 py-3 2xl:w-[168px] 2xl:gap-2 2xl:px-3"
            style={{
              borderRadius: 8,
              background: "rgba(0, 212, 255, 0.07)",
              border: "1px solid rgba(0,212,255,0.17)",
            }}
          >
            <Clock size={16} color="rgba(0,212,255,0.72)" />
            <div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "clamp(16px, 1.15vw, 22px)",
                  fontWeight: 900,
                  color: "#e9f7ff",
                  lineHeight: 1,
                  letterSpacing: "0.08em",
                }}
              >
                {formatTime(time)}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 10,
                  color: "rgba(150,190,214,0.58)",
                  textAlign: "center",
                }}
              >
                {formatDate(time)}
              </div>
            </div>
          </div>

          <div
            className="flex h-[65px] w-[112px] items-center gap-2 px-2 py-3 2xl:w-[168px] 2xl:px-4"
            style={{
              borderRadius: 8,
              background: isConnected ? "rgba(57,255,20,0.08)" : "rgba(245,158,11,0.08)",
              border: isConnected ? "1px solid rgba(57,255,20,0.28)" : "1px solid rgba(245,158,11,0.28)",
            }}
          >
            <span
              className="relative flex items-center justify-center"
              style={{ width: 12, height: 12 }}
            >
              <span
                className="absolute rounded-full animate-ping"
                style={{
                  width: 8,
                  height: 8,
                  background: isConnected ? "#39ff14" : "#f59e0b",
                  opacity: 0.4,
                }}
              />
              <span
                className="rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: isConnected ? "#39ff14" : "#f59e0b",
                  boxShadow: isConnected ? "0 0 14px #39ff14" : "0 0 14px #f59e0b",
                }}
              />
            </span>
            <div className="min-w-0">
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13,
                  fontWeight: 900,
                  color: isConnected ? "#39ff14" : "#f59e0b",
                  letterSpacing: "0.14em",
                }}
              >
                {isConnected ? "ONLINE" : "OFFLINE"}
              </div>
            </div>
            <Wifi size={15} color={isConnected ? "#39ff14" : "#f59e0b"} />
          </div>

          <button
            type="button"
            disabled={killSwitchSending}
            onClick={handleKillSwitch}
            aria-pressed={killSwitchActive}
            aria-label={killSwitchActive ? "Lever l'arret d'urgence" : "Activer l'arret d'urgence"}
            title={killSwitchActive ? "Cliquer pour demander la reprise" : "Couper immediatement les actionneurs"}
            className={`flex h-[65px] w-[112px] shrink-0 items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-95 2xl:w-[168px] 2xl:gap-3 ${
              emergencyVisualActive ? "animate-pulse" : ""
            }`}
            style={{
              borderRadius: 8,
              background: emergencyVisualActive
                ? "linear-gradient(180deg, #ef4444 0%, #991b1b 100%)"
                : "linear-gradient(180deg, #dc2626 0%, #7f1d1d 100%)",
              border: "2px solid rgba(255,120,120,0.95)",
              boxShadow: emergencyVisualActive
                ? "0 4px 0 #450a0a, 0 0 30px rgba(239,68,68,0.58), inset 0 1px 0 rgba(255,255,255,0.22)"
                : "0 4px 0 #450a0a, 0 0 18px rgba(239,68,68,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
              color: "#ffffff",
              cursor: killSwitchSending ? "wait" : "pointer",
            }}
          >
            {killSwitchSending ? <Loader size={22} className="animate-spin" /> : <OctagonAlert size={25} />}
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 900,
                lineHeight: 1.35,
                letterSpacing: "0.08em",
                textAlign: "left",
                textShadow: "0 1px 2px rgba(0,0,0,0.45)",
              }}
            >
              {killSwitchPending !== null
                ? "EN ATTENTE"
                : killSwitchActive
                  ? "ARRET ACTIF"
                  : "ARRET URGENCE"}
            </span>
          </button>

          <div className="flex items-center gap-2 2xl:gap-4">
            <div
              className="flex p-1"
              style={{
                borderRadius: 8,
                background: "#070d1b",
                border: "1px solid rgba(0,212,255,0.18)",
              }}
            >
              <button
                type="button"
                disabled={modeLoading || emergencyLocked}
                onClick={() => handleModeClick("AUTO")}
                className="relative flex h-[55px] w-[112px] min-w-[112px] items-center justify-center transition-all duration-200 2xl:w-[168px] 2xl:min-w-[168px]"
                style={{
                  borderRadius: 8,
                  border: isAutoMode ? "1px solid rgba(0,212,255,0.6)" : "1px solid transparent",
                  background: isAutoMode ? "rgba(0,212,255,0.22)" : "transparent",
                  boxShadow: isAutoMode ? "0 0 28px rgba(0,212,255,0.18)" : "none",
                  color: isAutoMode ? "#00d4ff" : "rgba(107,126,164,0.68)",
                  cursor: modeLoading || emergencyLocked ? "not-allowed" : "pointer",
                  opacity: emergencyLocked ? 0.45 : 1,
                }}
              >
                <ModeButtonText loading={modeLoading && isAutoMode} text="AUTO MODE" />
              </button>

              <button
                type="button"
                disabled={modeLoading || emergencyLocked}
                onClick={() => handleModeClick("MANUAL")}
                className="relative flex h-[55px] w-[112px] min-w-[112px] items-center justify-center transition-all duration-200 2xl:w-[168px] 2xl:min-w-[168px]"
                style={{
                  borderRadius: 8,
                  border: !isAutoMode ? "1px solid rgba(245,158,11,0.55)" : "1px solid transparent",
                  background: !isAutoMode ? "rgba(245,158,11,0.12)" : "transparent",
                  color: !isAutoMode ? "#f59e0b" : "rgba(107,126,164,0.68)",
                  cursor: modeLoading || emergencyLocked ? "not-allowed" : "pointer",
                  opacity: emergencyLocked ? 0.45 : 1,
                }}
              >
                <ModeButtonText loading={modeLoading && !isAutoMode} text="MANUAL MODE" />
              </button>
            </div>

            <button
              aria-label="Refresh dashboard"
              type="button"
              onClick={handleRefresh}
              className="flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
              style={{
                width: 45,
                height: 45,
                borderRadius: 15,
                background: "rgba(0,212,255,0.07)",
                border: "1px solid rgba(0,212,255,0.2)",
                color: "#00d4ff",
                cursor: "pointer",
              }}
            >
              <RefreshCw
                size={20}
                style={{
                  transition: "transform 0.65s ease",
                  transform: spinning ? "rotate(360deg)" : "rotate(0deg)",
                }}
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function ModeButtonText({ loading, text }: { loading: boolean; text: string }) {
  const [first, second] = text.split(" ");

  return (
    <span className="flex items-center gap-2">
      {loading && <Loader size={14} className="animate-spin" />}
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "clamp(13px, 1.05vw, 17px)",
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "0.08em",
          textAlign: "center",
        }}
      >
        {first} {second}
      </span>
    </span>
  );
}
