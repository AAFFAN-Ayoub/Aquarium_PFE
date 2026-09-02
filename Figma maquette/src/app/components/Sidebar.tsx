import { useState } from "react";
import {
  Activity,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Fish,
  HelpCircle,
  LayoutDashboard,
  Settings,
} from "lucide-react";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "charts", label: "Sensor Charts", icon: Activity },
  { id: "alerts-history", label: "Alerts History", icon: BellRing },
];

const bottomItems = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "help", label: "Help", icon: HelpCircle },
];

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="relative flex h-full flex-col transition-all duration-300"
      style={{
        width: collapsed ? 72 : 275,
        flexShrink: 0,
        background: "linear-gradient(180deg, #0a1020 0%, #080d1a 100%)",
        borderRight: "1px solid rgba(0, 212, 255, 0.14)",
      }}
    >
      <div
        className="flex items-center gap-3 px-5"
        style={{ height: 102, borderBottom: "1px solid rgba(0, 212, 255, 0.08)" }}
      >
        <div
          className="flex shrink-0 items-center justify-center"
          style={{
              width: 50,
              height: 50,
              borderRadius: 17,
            background: "linear-gradient(145deg, rgba(0,212,255,0.18), rgba(0,212,255,0.04))",
            border: "1px solid rgba(0, 212, 255, 0.42)",
            boxShadow: "0 0 24px rgba(0, 212, 255, 0.2)",
          }}
        >
          <Fish size={28} color="#00d4ff" />
        </div>

        {!collapsed && (
          <div className="min-w-0">
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 17,
                fontWeight: 800,
                color: "#00d4ff",
                letterSpacing: "0.06em",
                lineHeight: 1,
              }}
            >
              EDGEBRAIN
            </div>
            <div
              style={{
                marginTop: 7,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: "rgba(0,212,255,0.64)",
                letterSpacing: "0.18em",
                whiteSpace: "nowrap",
              }}
            >
              AQUA v2.4.1
            </div>
          </div>
        )}
      </div>

      <button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => setCollapsed((value) => !value)}
        className="absolute z-20 flex items-center justify-center transition-transform duration-200 hover:scale-105"
        style={{
          right: -15,
          top: 79,
          width: 30,
          height: 30,
          borderRadius: 15,
          background: "#0b1324",
          border: "1px solid rgba(0, 212, 255, 0.38)",
          color: "#00d4ff",
          cursor: "pointer",
        }}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>

      {!collapsed && (
        <div
          className="px-5 pb-3 pt-7"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(0,212,255,0.45)",
            letterSpacing: "0.18em",
          }}
        >
          NAVIGATION
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-2 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className="group relative flex items-center transition-all duration-200"
              style={{
                gap: collapsed ? 0 : 15,
                justifyContent: collapsed ? "center" : "flex-start",
                minHeight: 52,
                padding: collapsed ? "0 0" : "0 15px",
                borderRadius: 8,
                background: isActive
                  ? "linear-gradient(90deg, rgba(0,212,255,0.18), rgba(0,212,255,0.05))"
                  : "transparent",
                border: isActive ? "1px solid rgba(0,212,255,0.35)" : "1px solid transparent",
                boxShadow: isActive ? "0 0 28px rgba(0,212,255,0.12)" : "none",
                cursor: "pointer",
              }}
            >
              {isActive && (
                <span
                  className="absolute left-0"
                  style={{
                    width: 4,
                    height: 28,
                    borderRadius: "0 8px 8px 0",
                    background: "#00d4ff",
                    boxShadow: "0 0 16px #00d4ff",
                  }}
                />
              )}

              <Icon
                size={21}
                color={isActive ? "#00d4ff" : "rgba(137, 158, 191, 0.68)"}
                style={{ filter: isActive ? "drop-shadow(0 0 10px rgba(0,212,255,0.75))" : "none" }}
              />

              {!collapsed && (
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 17,
                    fontWeight: isActive ? 800 : 500,
                    color: isActive ? "#e9f7ff" : "rgba(150,170,204,0.72)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
              )}

              {collapsed && (
                <span
                  className="pointer-events-none absolute left-full ml-4 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: "#101a2d",
                    border: "1px solid rgba(0,212,255,0.25)",
                    color: "#e9f7ff",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div
        className="flex flex-col gap-2 px-4 pb-6 pt-7"
        style={{ borderTop: "1px solid rgba(0,212,255,0.08)" }}
      >
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className="flex items-center transition-colors duration-200"
              style={{
                gap: collapsed ? 0 : 15,
                justifyContent: collapsed ? "center" : "flex-start",
                minHeight: 40,
                borderRadius: 8,
                border: "1px solid transparent",
                background: isActive ? "rgba(0,212,255,0.08)" : "transparent",
                cursor: "pointer",
              }}
            >
              <Icon size={21} color={isActive ? "#00d4ff" : "rgba(137,158,191,0.7)"} />
              {!collapsed && (
                <span
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 17,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#dff7ff" : "rgba(150,170,204,0.76)",
                  }}
                >
                  {item.label}
                </span>
              )}
            </button>
          );
        })}

      </div>
    </aside>
  );
}
