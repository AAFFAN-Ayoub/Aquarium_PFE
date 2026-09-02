import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Droplets, FlaskConical, RefreshCw, Shield, Sun, Thermometer, Waves } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TelemetryData, TelemetryHistoryPoint } from "../../hooks/useTelemetryWebSocket";

const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', sans-serif";

type RangeKey = "5 min" | "30 min" | "1 h" | "6 h" | "24 h" | "Personnalise";
type CustomRange = { start: number; end: number } | null;

interface ChartPoint {
  timestamp: number;
  time: string;
  value: number;
}

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string; minWidth: number }> = [
  { key: "5 min", label: "5 min", minWidth: 82 },
  { key: "30 min", label: "30 min", minWidth: 82 },
  { key: "1 h", label: "1 h", minWidth: 82 },
  { key: "6 h", label: "6 h", minWidth: 82 },
  { key: "24 h", label: "24 h", minWidth: 82 },
  { key: "Personnalise", label: "PERSONNALISE", minWidth: 132 },
];

const RANGE_MS: Record<Exclude<RangeKey, "Personnalise">, number> = {
  "5 min": 5 * 60 * 1000,
  "30 min": 30 * 60 * 1000,
  "1 h": 60 * 60 * 1000,
  "6 h": 6 * 60 * 60 * 1000,
  "24 h": 24 * 60 * 60 * 1000,
};

function timeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTimeLocal(timestamp: number) {
  if (!Number.isFinite(timestamp)) return "";

  const date = new Date(timestamp);
  const localTimestamp = date.getTime() - date.getTimezoneOffset() * 60_000;
  return new Date(localTimestamp).toISOString().slice(0, 16);
}

function rangeFooterLabel(range: RangeKey, customRange: CustomRange) {
  if (range !== "Personnalise" || !customRange) return range.toUpperCase();

  return `${new Date(customRange.start).toLocaleString("fr-FR")} - ${new Date(customRange.end).toLocaleString("fr-FR")}`;
}

function currentHistoryPoint(telemetry: TelemetryData): TelemetryHistoryPoint {
  return {
    timestamp: telemetry.updatedAt ?? Date.now(),
    temp: telemetry.sensors.temp,
    ph: telemetry.sensors.ph,
    tds: telemetry.sensors.tds,
    lux: telemetry.sensors.lux,
    remplissage_pct: telemetry.sensors.remplissage_pct,
    anomaly_score: telemetry.sensors.anomaly_score ?? telemetry.alertes.length * 15,
    feeder_actif: telemetry.actuators.feeder || telemetry.actuators.temps_repas ? 1 : 0,
  };
}

function mergeHistory(history: TelemetryHistoryPoint[], telemetry: TelemetryData) {
  const merged = new Map<number, TelemetryHistoryPoint>();
  history.forEach((point) => {
    if (Number.isFinite(point.timestamp)) merged.set(point.timestamp, point);
  });
  const livePoint = currentHistoryPoint(telemetry);
  if (Number.isFinite(livePoint.timestamp)) merged.set(livePoint.timestamp, livePoint);
  return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function thinSeries(points: ChartPoint[], maxPoints = 720) {
  if (points.length <= maxPoints) return points;

  const bucketSize = Math.ceil(points.length / maxPoints);
  const thinned: ChartPoint[] = [];

  for (let index = 0; index < points.length; index += bucketSize) {
    const bucket = points.slice(index, index + bucketSize);
    const minPoint = bucket.reduce((best, point) => (point.value < best.value ? point : best), bucket[0]);
    const maxPoint = bucket.reduce((best, point) => (point.value > best.value ? point : best), bucket[0]);
    const bucketPoints =
      minPoint.timestamp === maxPoint.timestamp
        ? [minPoint]
        : [minPoint, maxPoint].sort((a, b) => a.timestamp - b.timestamp);
    thinned.push(...bucketPoints);
  }

  const last = points[points.length - 1];
  if (thinned[thinned.length - 1]?.timestamp !== last.timestamp) {
    thinned.push(last);
  }

  return thinned;
}

function buildSeries(
  history: TelemetryHistoryPoint[],
  range: RangeKey,
  customRange: CustomRange,
  pickValue: (point: TelemetryHistoryPoint) => number | null,
) {
  const source =
    range === "Personnalise"
        ? customRange
          ? history.filter((point) => point.timestamp >= customRange.start && point.timestamp <= customRange.end)
          : history.slice(-1)
      : (() => {
          const newestTimestamp = history[history.length - 1]?.timestamp ?? Date.now();
          const cutoff = newestTimestamp - RANGE_MS[range];
          const ranged = history.filter((point) => point.timestamp >= cutoff);
          return ranged.length > 0 ? ranged : history.slice(-1);
        })();

  return thinSeries(
    source
      .map((point) => {
        const value = pickValue(point);
        if (value === null || !Number.isFinite(value)) return null;
        return {
          timestamp: point.timestamp,
          time: timeLabel(point.timestamp),
          value,
        };
      })
      .filter((point): point is ChartPoint => point !== null),
  );
}

function stats(points: ChartPoint[]) {
  if (points.length === 0) {
    return { min: 0, max: 0, avg: 0, now: 0, delta: 0 };
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const now = values[values.length - 1];
  const previous = values[values.length - 4] ?? now;

  return { min, max, avg, now, delta: now - previous };
}

function formatNumber(value: number, decimals: number) {
  return value.toFixed(decimals);
}

function SectionHeader({
  range,
  lastUpdate,
  customStart,
  customEnd,
  customError,
  onRangeChange,
  onCustomStartChange,
  onCustomEndChange,
  onApplyCustomRange,
}: {
  range: RangeKey;
  lastUpdate: number;
  onRangeChange: (range: RangeKey) => void;
  customStart: string;
  customEnd: string;
  customError: string | null;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  onApplyCustomRange: () => void;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
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
          Sensor History Charts
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
          Last update: {new Date(lastUpdate).toLocaleTimeString("en-US", { hour12: false })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div
          className="flex overflow-hidden"
          style={{
            borderRadius: 8,
            background: "rgba(9,16,31,0.92)",
            border: "1px solid rgba(0,212,255,0.17)",
          }}
        >
          {RANGE_OPTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onRangeChange(item.key)}
              style={{
                minWidth: item.minWidth,
                padding: "13px 18px",
                background: range === item.key ? "rgba(0,212,255,0.18)" : "transparent",
                border: "none",
                borderRight: item.key === "Personnalise" ? "none" : "1px solid rgba(0,212,255,0.09)",
                color: range === item.key ? "#00d4ff" : "rgba(119,140,175,0.76)",
                fontFamily: mono,
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="flex items-center gap-3"
          style={{
            borderRadius: 8,
            padding: "13px 20px",
            background: "rgba(0,212,255,0.08)",
            border: "1px solid rgba(0,212,255,0.24)",
            color: "#00d4ff",
            fontFamily: mono,
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: "0.1em",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={17} />
          REFRESH
        </button>
      </div>

      {range === "Personnalise" && (
        <div
          className="basis-full"
          style={{
            borderRadius: 8,
            background: "rgba(0,212,255,0.045)",
            border: "1px solid rgba(0,212,255,0.13)",
            padding: 14,
          }}
        >
          <div className="flex flex-wrap items-end gap-4">
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
                onChange={(event) => onCustomStartChange(event.target.value)}
                style={{
                  height: 44,
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
                onChange={(event) => onCustomEndChange(event.target.value)}
                style={{
                  height: 44,
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
              onClick={onApplyCustomRange}
              style={{
                height: 44,
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
        </div>
      )}
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  unit: string;
  color: string;
  icon: ReactNode;
  points: ChartPoint[];
  decimals: number;
  maxLine?: number;
  minLine?: number;
  yDomain?: [number, number];
  full?: boolean;
}

function ChartCard({
  title,
  subtitle,
  unit,
  color,
  icon,
  points,
  decimals,
  maxLine,
  minLine,
  yDomain,
  full = false,
}: ChartCardProps) {
  const chartStats = stats(points);
  const hasPoints = points.length > 0;
  const trendColor = chartStats.delta >= 0 ? "#39ff14" : "#ef4444";

  return (
    <article
      className={`${full ? "xl:col-span-2" : ""} p-6`}
      style={{
        minHeight: full ? 368 : 380,
        borderRadius: 8,
        background: "linear-gradient(145deg, #0f1729 0%, #0b1222 100%)",
        border: `1px solid ${color}2c`,
        boxShadow: "0 18px 42px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div
            className="flex shrink-0 items-center justify-center"
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: `${color}18`,
              border: `1px solid ${color}38`,
              boxShadow: `0 0 24px ${color}22`,
            }}
          >
            {icon}
          </div>
          <div>
            <div style={{ fontFamily: sans, fontSize: 21, fontWeight: 900, color: "#dcecff" }}>{title}</div>
            <div
              style={{
                marginTop: 2,
                fontFamily: mono,
                fontSize: 13,
                color: "rgba(99,124,160,0.78)",
                letterSpacing: "0.12em",
              }}
            >
              {subtitle} - LIVE
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div
            style={{
              borderRadius: 8,
              padding: "10px 12px",
              background: `${trendColor}12`,
              border: `1px solid ${trendColor}32`,
              color: trendColor,
              fontFamily: mono,
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            {hasPoints ? `${chartStats.delta >= 0 ? "+" : ""}${formatNumber(chartStats.delta, decimals)}` : "--"}
          </div>
          <div
            style={{
              minWidth: 108,
              borderRadius: 8,
              padding: "10px 16px",
              background: "rgba(9,16,31,0.86)",
              border: `1px solid ${color}28`,
              color,
              fontFamily: mono,
              fontSize: 26,
              fontWeight: 900,
              textAlign: "center",
              textShadow: `0 0 18px ${color}55`,
            }}
          >
            {hasPoints ? formatNumber(chartStats.now, decimals) : "--"}
            {hasPoints && (
              <span style={{ marginLeft: 5, fontSize: 13, color: "rgba(123,144,176,0.75)" }}>{unit}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: full ? 205 : 192 }}>
        {hasPoints ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(0,212,255,0.06)" strokeDasharray="4 6" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: "rgba(85,111,150,0.7)", fontSize: 12, fontFamily: mono }}
                tickLine={false}
                axisLine={false}
                minTickGap={18}
              />
              <YAxis
                tick={{ fill: "rgba(85,111,150,0.7)", fontSize: 12, fontFamily: mono }}
                tickLine={false}
                axisLine={false}
                domain={yDomain}
                width={48}
              />
              {maxLine !== undefined && (
                <ReferenceLine
                  y={maxLine}
                  stroke="rgba(239,68,68,0.46)"
                  strokeDasharray="5 5"
                  label={{ value: "Max", position: "insideTop", fill: "rgba(239,68,68,0.58)", fontSize: 12 }}
                />
              )}
              {minLine !== undefined && (
                <ReferenceLine
                  y={minLine}
                  stroke="rgba(0,212,255,0.35)"
                  strokeDasharray="5 5"
                  label={{ value: "Min", position: "insideBottom", fill: "rgba(0,212,255,0.5)", fontSize: 12 }}
                />
              )}
              <Tooltip
                contentStyle={{
                  background: "#0c1426",
                  border: "1px solid rgba(0,212,255,0.24)",
                  borderRadius: 8,
                  color: "#e8f4ff",
                  fontFamily: mono,
                  fontSize: 12,
                  padding: "8px 10px",
                }}
                formatter={(value: number) => [`${formatNumber(value, decimals)} ${unit}`, title]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2.6}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex h-full items-center justify-center"
            style={{ fontFamily: mono, fontSize: 13, color: "rgba(119,140,175,0.74)", letterSpacing: "0.08em" }}
          >
            Aucune donnee pour cette periode
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-7">
        <Stat label="MIN" value={hasPoints ? formatNumber(chartStats.min, decimals) : "--"} unit={hasPoints ? unit : ""} color="#00d4ff" />
        <Stat label="AVG" value={hasPoints ? formatNumber(chartStats.avg, decimals) : "--"} unit={hasPoints ? unit : ""} color="#dcecff" />
        <Stat label="MAX" value={hasPoints ? formatNumber(chartStats.max, decimals) : "--"} unit={hasPoints ? unit : ""} color="#ff6b35" />
      </div>
    </article>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ fontFamily: mono, fontSize: 14, color: "rgba(97,117,153,0.78)", letterSpacing: "0.12em" }}>
      {label}{" "}
      <span style={{ color, fontWeight: 900, letterSpacing: 0 }}>
        {value} {unit}
      </span>
    </div>
  );
}

export function SensorCharts({
  telemetry,
  history,
}: {
  telemetry: TelemetryData;
  history: TelemetryHistoryPoint[];
}) {
  const [range, setRange] = useState<RangeKey>("5 min");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customRange, setCustomRange] = useState<CustomRange>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const historyPoints = useMemo(() => mergeHistory(history, telemetry), [history, telemetry]);
  const lastUpdate = historyPoints[historyPoints.length - 1]?.timestamp ?? telemetry.updatedAt ?? Date.now();

  const handleRangeChange = (nextRange: RangeKey) => {
    if (nextRange !== "Personnalise") {
      setRange(nextRange);
      setCustomError(null);
      return;
    }

    const parsedEnd = customEnd ? new Date(customEnd).getTime() : Number.NaN;
    const end = Number.isFinite(parsedEnd) ? parsedEnd : lastUpdate;
    const parsedStart = customStart ? new Date(customStart).getTime() : Number.NaN;
    const start = Number.isFinite(parsedStart) ? parsedStart : end - 60 * 60 * 1000;

    setRange("Personnalise");
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

    setRange("Personnalise");
    setCustomRange({ start, end });
    setCustomError(null);
  };

  const series = useMemo(
    () => ({
      temp: buildSeries(historyPoints, range, customRange, (point) => point.temp),
      ph: buildSeries(historyPoints, range, customRange, (point) => point.ph),
      tds: buildSeries(historyPoints, range, customRange, (point) => point.tds),
      lux: buildSeries(historyPoints, range, customRange, (point) => point.lux),
      water: buildSeries(historyPoints, range, customRange, (point) => point.remplissage_pct),
      anomaly: buildSeries(historyPoints, range, customRange, (point) => point.anomaly_score),
    }),
    [customRange, historyPoints, range],
  );

  return (
    <section>
      <SectionHeader
        range={range}
        lastUpdate={lastUpdate}
        customStart={customStart}
        customEnd={customEnd}
        customError={customError}
        onRangeChange={handleRangeChange}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
        onApplyCustomRange={applyCustomRange}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard
          title="Temperature"
          subtitle="C"
          unit={"\u00b0C"}
          color="#ff6b35"
          icon={<Thermometer size={26} color="#ff6b35" />}
          points={series.temp}
          decimals={2}
          maxLine={28}
          minLine={24}
        />
        <ChartCard
          title="pH Level"
          subtitle="pH"
          unit="pH"
          color="#b35cff"
          icon={<FlaskConical size={26} color="#b35cff" />}
          points={series.ph}
          decimals={3}
          maxLine={7.8}
          minLine={6.5}
        />
        <ChartCard
          title="Water Quality (TDS)"
          subtitle="ppm"
          unit="ppm"
          color="#00d4ff"
          icon={<Droplets size={26} color="#00d4ff" />}
          points={series.tds}
          decimals={0}
          maxLine={500}
        />
        <ChartCard
          title="Light Intensity"
          subtitle="Lux"
          unit="Lux"
          color="#fbbf24"
          icon={<Sun size={26} color="#fbbf24" />}
          points={series.lux}
          decimals={0}
        />
        <ChartCard
          title="Water Level"
          subtitle="%"
          unit="%"
          color="#39ff14"
          icon={<Waves size={26} color="#39ff14" />}
          points={series.water}
          decimals={2}
          minLine={50}
        />
        <ChartCard
          title="Anomaly Score"
          subtitle="K-Means distance"
          unit=""
          color="#39ff14"
          icon={<Shield size={26} color="#39ff14" />}
          points={series.anomaly}
          decimals={2}
          full
        />
      </div>

      <div
        className="mt-8 border-t py-5 text-center"
        style={{
          borderColor: "rgba(0,212,255,0.08)",
          fontFamily: mono,
          fontSize: 13,
          color: "rgba(0,212,255,0.35)",
          letterSpacing: "0.14em",
        }}
      >
        DATA REFRESHES EVERY 3s - HISTORY SHOWN FOR {rangeFooterLabel(range, customRange)}
      </div>
    </section>
  );
}
