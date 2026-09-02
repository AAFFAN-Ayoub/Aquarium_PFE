import { useEffect, useMemo, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase, endAt, onValue, orderByKey, query, ref, startAt } from "firebase/database";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

const firebaseConfig = {
  databaseURL: "https://influx-1117c-default-rtdb.europe-west1.firebasedatabase.app/",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', sans-serif";

interface AlertHistoryEntry {
  id: string;
  timestamp: number;
  dateTime: string;
  alertType: string;
}

type PeriodKey = "5 min" | "30 min" | "1 heure" | "6 heures" | "24 heures" | "Personnalise";

type PeriodOption = {
  key: PeriodKey;
  label: string;
  valueMs: number | null;
};

const PERIOD_OPTIONS: PeriodOption[] = [
  { key: "5 min", label: "5 min", valueMs: 5 * 60 * 1000 },
  { key: "30 min", label: "30 min", valueMs: 30 * 60 * 1000 },
  { key: "1 heure", label: "1 heure", valueMs: 60 * 60 * 1000 },
  { key: "6 heures", label: "6 heures", valueMs: 6 * 60 * 60 * 1000 },
  { key: "24 heures", label: "24 heures", valueMs: 24 * 60 * 60 * 1000 },
  { key: "Personnalise", label: "PERSONNALISE", valueMs: null },
];

type CustomRange = { start: number; end: number } | null;

function formatDateTime(timestamp: number) {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${day} à ${time}`;
}

function formatDateTimeLocal(timestamp: number) {
  if (!Number.isFinite(timestamp)) return "";

  const date = new Date(timestamp);
  const localTimestamp = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(localTimestamp).toISOString().slice(0, 16);
}

function normalizeAlerts(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "string") return value;
  return "ALERTE_INCONNUE";
}

export function AlertsHistory() {
  const [entries, setEntries] = useState<AlertHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("5 min");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customRange, setCustomRange] = useState<CustomRange>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const deviceId = useMemo(() => (import.meta.env.VITE_DEVICE_ID as string | undefined) || "aqua_01", []);
  const selectedPeriodLabel = useMemo(
    () => PERIOD_OPTIONS.find((option) => option.key === selectedPeriod)?.label ?? "5 min",
    [selectedPeriod],
  );

  useEffect(() => {
    const alertsRef = ref(db, `aquariums/${deviceId}/alertes_log`);
    const selectedOption = PERIOD_OPTIONS.find((option) => option.key === selectedPeriod);
    const alertsQuery =
      selectedPeriod === "Personnalise" && customRange
        ? query(alertsRef, orderByKey(), startAt(String(customRange.start)), endAt(String(customRange.end)))
        : query(alertsRef, orderByKey(), startAt(String(Date.now() - (selectedOption?.valueMs ?? 5 * 60 * 1000))));

    const unsubscribe = onValue(
      alertsQuery,
      (snapshot) => {
        const data = snapshot.val();

        if (!data || typeof data !== "object") {
          setEntries([]);
          setError(null);
          return;
        }

        const nextEntries = Object.entries(data)
          .map(([key, value]) => {
            const timestamp = Number(key);

            return {
              id: key,
              timestamp,
              dateTime: Number.isFinite(timestamp) ? formatDateTime(timestamp) : key,
              alertType: normalizeAlerts((value as { alertes?: unknown })?.alertes),
            };
          })
          .sort((a, b) => b.timestamp - a.timestamp);

        setEntries(nextEntries);
        setError(null);
      },
      (firebaseError) => {
        setError(firebaseError.message);
      },
    );

    return () => unsubscribe();
  }, [customRange, deviceId, selectedPeriod]);

  const handlePeriodChange = (option: PeriodOption) => {
    if (option.key !== "Personnalise") {
      setSelectedPeriod(option.key);
      setCustomError(null);
      return;
    }

    const now = Date.now();
    const existingEnd = customEnd ? new Date(customEnd).getTime() : Number.NaN;
    const end = Number.isFinite(existingEnd) ? existingEnd : now;
    const existingStart = customStart ? new Date(customStart).getTime() : Number.NaN;
    const start = Number.isFinite(existingStart) ? existingStart : end - 60 * 60 * 1000;

    setSelectedPeriod("Personnalise");
    setCustomStart(formatDateTimeLocal(start));
    setCustomEnd(formatDateTimeLocal(end));
    setCustomRange({ start, end });
    setCustomError(null);
  };

  const applyCustomRange = () => {
    const start = new Date(customStart).getTime();
    const end = new Date(customEnd).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setCustomError("Choisis une date de debut et de fin valides");
      return;
    }

    if (start > end) {
      setCustomError("La date de debut doit etre avant la date de fin");
      return;
    }

    setSelectedPeriod("Personnalise");
    setCustomRange({ start, end });
    setCustomError(null);
  };

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div
            style={{
              fontFamily: sans,
              fontSize: 19,
              fontWeight: 900,
              color: "rgba(0,212,255,0.82)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Alerts History
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: mono,
              fontSize: 13,
              color: "rgba(85,111,150,0.82)",
              letterSpacing: "0.1em",
            }}
          >
          Derniers evenements critiques
          </div>
        </div>

        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{
            borderRadius: 8,
            background: entries.length > 0 ? "rgba(239,68,68,0.09)" : "rgba(57,255,20,0.08)",
            border: entries.length > 0 ? "1px solid rgba(239,68,68,0.28)" : "1px solid rgba(57,255,20,0.22)",
          }}
        >
          {entries.length > 0 ? <AlertTriangle size={15} color="#ef4444" /> : <CheckCircle2 size={15} color="#39ff14" />}
          <span
            style={{
              fontFamily: mono,
              fontSize: 12,
              fontWeight: 900,
              color: entries.length > 0 ? "#ef4444" : "#39ff14",
              letterSpacing: "0.12em",
            }}
          >
            {entries.length > 0 ? `${entries.length} RECENT` : "SYSTEM CLEAR"}
          </span>
        </div>
      </div>

      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{
          borderRadius: 8,
          background: "rgba(0,212,255,0.045)",
          border: "1px solid rgba(0,212,255,0.12)",
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontSize: 12,
            color: "rgba(114,142,180,0.82)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Filtre temporel:{" "}
          <span style={{ color: "#00d4ff", fontWeight: 900 }}>{selectedPeriodLabel}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((option) => {
            const isActive = option.key === selectedPeriod;

            return (
              <button
                key={option.label}
                type="button"
                onClick={() => handlePeriodChange(option)}
                style={{
                  borderRadius: 8,
                  padding: "9px 12px",
                  background: isActive ? "rgba(0,212,255,0.18)" : "rgba(9,16,31,0.76)",
                  border: isActive ? "1px solid rgba(0,212,255,0.42)" : "1px solid rgba(0,212,255,0.13)",
                  boxShadow: isActive ? "0 0 18px rgba(0,212,255,0.16)" : "none",
                  color: isActive ? "#00d4ff" : "rgba(141,163,198,0.82)",
                  cursor: "pointer",
                  fontFamily: mono,
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedPeriod === "Personnalise" && (
        <div
          className="mb-4 flex flex-wrap items-end gap-4 px-4 py-3"
          style={{
            borderRadius: 8,
            background: "rgba(0,212,255,0.045)",
            border: "1px solid rgba(0,212,255,0.12)",
          }}
        >
          <label className="flex flex-col gap-2">
            <span
              style={{
                fontFamily: mono,
                fontSize: 11,
                color: "rgba(119,140,175,0.78)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Debut
            </span>
            <input
              type="datetime-local"
              value={customStart}
              onChange={(event) => setCustomStart(event.target.value)}
              style={{
                height: 42,
                minWidth: 220,
                borderRadius: 8,
                background: "rgba(9,16,31,0.92)",
                border: "1px solid rgba(0,212,255,0.18)",
                color: "#dcecff",
                fontFamily: mono,
                fontSize: 13,
                padding: "0 12px",
                outline: "none",
              }}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span
              style={{
                fontFamily: mono,
                fontSize: 11,
                color: "rgba(119,140,175,0.78)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Fin
            </span>
            <input
              type="datetime-local"
              value={customEnd}
              onChange={(event) => setCustomEnd(event.target.value)}
              style={{
                height: 42,
                minWidth: 220,
                borderRadius: 8,
                background: "rgba(9,16,31,0.92)",
                border: "1px solid rgba(0,212,255,0.18)",
                color: "#dcecff",
                fontFamily: mono,
                fontSize: 13,
                padding: "0 12px",
                outline: "none",
              }}
            />
          </label>

          <button
            type="button"
            onClick={applyCustomRange}
            style={{
              height: 42,
              borderRadius: 8,
              padding: "0 18px",
              background: "rgba(0,212,255,0.16)",
              border: "1px solid rgba(0,212,255,0.35)",
              color: "#00d4ff",
              cursor: "pointer",
              fontFamily: mono,
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: "0.1em",
            }}
          >
            APPLIQUER
          </button>

          {customError && (
            <span
              style={{
                fontFamily: mono,
                fontSize: 12,
                color: "#f59e0b",
                letterSpacing: "0.08em",
              }}
            >
              {customError}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          borderRadius: 8,
          overflow: "hidden",
          background: "linear-gradient(145deg, rgba(13,22,40,0.96), rgba(9,16,31,0.98))",
          border: "1px solid rgba(0,212,255,0.13)",
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(0,212,255,0.08)" }}>
              <th
                style={{
                  width: "34%",
                  padding: "16px 22px",
                  textAlign: "left",
                  fontFamily: mono,
                  fontSize: 12,
                  fontWeight: 900,
                  color: "rgba(0,212,255,0.74)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                Date & Heure
              </th>
              <th
                style={{
                  padding: "16px 22px",
                  textAlign: "left",
                  fontFamily: mono,
                  fontSize: 12,
                  fontWeight: 900,
                  color: "rgba(0,212,255,0.74)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                }}
              >
                Type d'Alerte
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                style={{
                  borderTop: "1px solid rgba(0,212,255,0.08)",
                  background: "rgba(239,68,68,0.035)",
                }}
              >
                <td
                  style={{
                    padding: "17px 22px",
                    fontFamily: mono,
                    fontSize: 14,
                    color: "rgba(165,188,220,0.82)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.dateTime}
                </td>
                <td
                  style={{
                    padding: "17px 22px",
                    fontFamily: mono,
                    fontSize: 14,
                    fontWeight: 900,
                    color: "#ef4444",
                    letterSpacing: "0.08em",
                  }}
                >
                  {entry.alertType}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {entries.length === 0 && (
          <div
            className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center"
            style={{
              borderTop: "1px solid rgba(0,212,255,0.08)",
            }}
          >
            <CheckCircle2 size={34} color="#39ff14" />
            <div
              style={{
                fontFamily: sans,
                fontSize: 18,
                fontWeight: 900,
                color: "#dcecff",
              }}
            >
              Aucune anomalie détectée
            </div>
            {error && (
              <div style={{ fontFamily: mono, fontSize: 12, color: "#f59e0b", letterSpacing: "0.08em" }}>
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
