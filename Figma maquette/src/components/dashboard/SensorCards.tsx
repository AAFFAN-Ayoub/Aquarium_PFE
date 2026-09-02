import { Droplets, FlaskConical, Sun, Thermometer, Waves } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TelemetryData } from "../../hooks/useTelemetryWebSocket";

const cardBase = {
  borderRadius: 8,
  background: "linear-gradient(145deg, #0f1729 0%, #0b1222 100%)",
  border: "1px solid rgba(0,212,255,0.14)",
  boxShadow: "0 18px 42px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)",
};

const mono = "'JetBrains Mono', monospace";
const sans = "'Inter', sans-serif";

type Point = { v: number };

function spark(base: number, wave = 1): Point[] {
  return Array.from({ length: 12 }, (_, index) => ({
    v: Number((base + Math.sin(index * 0.8) * wave + (index % 3) * wave * 0.22).toFixed(2)),
  }));
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
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
        {title}
      </div>
    </div>
  );
}

function MiniLine({ data, color }: { data: Point[]; color: string }) {
  return (
    <div style={{ height: 72, marginTop: "auto" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 18, right: 6, bottom: 8, left: 6 }}>
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "#0c1426",
              border: "1px solid rgba(0,212,255,0.24)",
              borderRadius: 8,
              color: "#e8f4ff",
              fontFamily: mono,
              fontSize: 11,
              padding: "6px 8px",
            }}
            formatter={(value: number) => [value, ""]}
            labelFormatter={() => ""}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MetricCardProps {
  icon: ReactNode;
  title: string;
  value: string;
  unit: string;
  color: string;
  data: Point[];
  span?: string;
}

function MetricCard({
  icon,
  title,
  value,
  unit,
  color,
  data,
  span = "",
}: MetricCardProps) {
  return (
    <article
      className={`flex min-h-[226px] flex-col p-6 ${span}`}
      style={{
        ...cardBase,
        borderColor: `${color}24`,
      }}
    >
      <div className="mb-5 flex items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `${color}18`,
              border: `1px solid ${color}35`,
              boxShadow: `0 0 22px ${color}20`,
            }}
          >
            {icon}
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: 14,
              fontWeight: 900,
              color: "rgba(162,181,210,0.88)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1.45,
            }}
          >
            {title}
          </div>
        </div>
      </div>

      <div className="flex items-end gap-2">
        <span
          style={{
            fontFamily: mono,
            fontSize: 36,
            fontWeight: 900,
            color: "#e9f7ff",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span
          style={{
            marginBottom: 6,
            fontFamily: sans,
            fontSize: 17,
            color: "rgba(143,164,195,0.78)",
          }}
        >
          {unit}
        </span>
      </div>

      <MiniLine data={data} color={color} />
    </article>
  );
}

function CircularLevel({ value, color }: { value: number; color: string }) {
  const size = 92;
  const strokeWidth = 9;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.max(0, Math.min(100, value));
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)", overflow: "visible" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          style={{
            filter: `drop-shadow(0 0 12px ${color})`,
            transition: "stroke-dashoffset 0.5s ease",
          }}
        />
      </svg>
      <div className="absolute text-center">
        <div
          style={{
            fontFamily: mono,
            fontSize: 19,
            fontWeight: 900,
            color,
            textShadow: `0 0 16px ${color}`,
          }}
        >
          {safeValue}%
        </div>
      </div>
    </div>
  );
}

function WaterLevelCard({ value }: { value: number }) {
  return (
    <article className="flex min-h-[226px] flex-col p-6" style={cardBase}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "rgba(56,189,248,0.14)",
              border: "1px solid rgba(56,189,248,0.35)",
            }}
          >
            <Waves size={20} color="#38bdf8" />
          </div>
          <div
            style={{
              fontFamily: sans,
              fontSize: 14,
              fontWeight: 900,
              color: "rgba(162,181,210,0.88)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              lineHeight: 1.45,
            }}
          >
            Water
            <br />
            Level
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <CircularLevel value={value} color="#38bdf8" />
      </div>
    </article>
  );
}

export function SensorCards({ telemetry }: { telemetry: TelemetryData }) {
  const sensors = telemetry.sensors;
  const temp = sensors.temp ?? 0;

  return (
    <section>
      <SectionTitle title="Sensor Telemetry" />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        <MetricCard
          title="Temperature"
          value={temp ? temp.toFixed(1) : "--"}
          unit={"\u00b0C"}
          icon={<Thermometer size={24} color="#ff6b35" />}
          color="#ff6b35"
          data={spark(temp || 26.5, 0.18)}
        />

        <MetricCard
          title="pH Level"
          value={sensors.ph.toFixed(1)}
          unit="pH"
          icon={<FlaskConical size={24} color="#b35cff" />}
          color="#b35cff"
          data={spark(sensors.ph, 0.04)}
        />

        <MetricCard
          title="Water Quality"
          value={String(sensors.tds)}
          unit="ppm"
          icon={<Droplets size={24} color="#00d4ff" />}
          color="#00d4ff"
          data={spark(sensors.tds, 5)}
        />

        <MetricCard
          title="Light Intensity"
          value={String(sensors.lux)}
          unit="Lux"
          icon={<Sun size={24} color="#fbbf24" />}
          color="#fbbf24"
          data={spark(sensors.lux, 8)}
          span=""
        />

        <WaterLevelCard value={sensors.remplissage_pct} />
      </div>
    </section>
  );
}
