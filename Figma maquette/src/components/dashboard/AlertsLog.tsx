import { useMemo } from "react";
import type { CSSProperties } from "react";
import { CheckCircle } from "lucide-react";

type Severity = "DANGER" | "WARNING" | "INFO" | "OK";

interface AlertEntry {
  id: string;
  timestamp: string;
  message: string;
  severity: Severity;
}

const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', sans-serif";

function detectSeverity(text: string): Severity {
  const upper = text.toUpperCase();
  if (upper.includes("DANGER") || upper.includes("CRITIQUE") || upper.includes("CRITICAL")) return "DANGER";
  if (upper.includes("ALERTE") || upper.includes("WARNING") || upper.includes("ELEVATED") || upper.includes("SPIKE")) {
    return "WARNING";
  }
  if (upper.includes("OK") || upper.includes("NOMINAL")) return "OK";
  return "INFO";
}

function buildEntries(alertes: string[]): AlertEntry[] {
  return alertes.map((raw, index) => {
    const severity = detectSeverity(raw);

    return {
      id: `${raw}-${index}`,
      timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
      message: raw,
      severity,
    };
  });
}

export function AlertsLog({ alertes }: { alertes: string[] }) {
  const entries = useMemo(() => buildEntries(alertes ?? []), [alertes]);
  const unacknowledged = entries.length;

  if (!entries.length) {
    return (
      <section>
        <Header unacknowledged={0} />
        <div
          className="flex items-center gap-4 p-6"
          style={{
            borderRadius: 8,
            background: "linear-gradient(145deg, rgba(57,255,20,0.08), rgba(57,255,20,0.02))",
            border: "1px solid rgba(57,255,20,0.25)",
          }}
        >
          <CheckCircle size={24} color="#39ff14" />
          <div>
            <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 900, color: "#39ff14" }}>System Healthy</div>
            <div style={{ marginTop: 4, fontFamily: sans, fontSize: 14, color: "rgba(157,216,185,0.72)" }}>
              No active alerts. All parameters are within operating range.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <Header unacknowledged={unacknowledged} />

      <div
        className="overflow-hidden"
        style={{
          borderRadius: 8,
          background: "linear-gradient(145deg, #0f1729 0%, #0b1222 100%)",
          border: "1px solid rgba(0,212,255,0.13)",
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
        }}
      >
        <div>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,212,255,0.06)" }}>
                {["Timestamp", "Message"].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      width: heading === "Timestamp" ? 260 : "auto",
                      padding: "16px 24px",
                      textAlign: "left",
                      color: "rgba(0,212,255,0.62)",
                      fontFamily: mono,
                      fontSize: 13,
                      fontWeight: 900,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                  <tr
                    key={entry.id}
                    style={{
                      background: entry.severity === "DANGER" ? "rgba(239,68,68,0.08)" : "rgba(10,18,34,0.7)",
                      borderTop: index ? "1px solid rgba(0,212,255,0.06)" : "none",
                    }}
                  >
                    <td style={cellStyle("rgba(137,158,191,0.74)", mono)}>{entry.timestamp}</td>
                    <td style={cellStyle("rgba(205,218,237,0.85)", sans)}>
                      <span style={{ overflowWrap: "anywhere" }}>{entry.message}</span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Header({ unacknowledged }: { unacknowledged: number }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-4">
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
        System Alerts
      </div>
      {unacknowledged > 0 && (
        <span
          style={{
            borderRadius: 8,
            padding: "8px 14px",
            background: "rgba(239,68,68,0.14)",
            border: "1px solid rgba(239,68,68,0.35)",
            color: "#ef4444",
            fontFamily: mono,
            fontSize: 13,
            fontWeight: 900,
            letterSpacing: "0.12em",
          }}
        >
          {unacknowledged} ALERTES
        </span>
      )}
    </div>
  );
}

function cellStyle(color: string, fontFamily: string): CSSProperties {
  return {
    padding: "21px 24px",
    color,
    fontFamily,
    fontSize: 16,
    lineHeight: 1.45,
    verticalAlign: "middle",
  };
}
