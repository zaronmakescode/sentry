import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function Card({
  title,
  right,
  children,
  className = "",
  delay = 0,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`glass glass-hover flex min-h-0 flex-col p-4 ${className}`}
    >
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="label shrink-0">{title}</h2>
        {right}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.section>
  );
}

/** Convert samples to a smooth cubic-bezier SVG path. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx.toFixed(2)},${p0.y.toFixed(2)} ${mx.toFixed(2)},${p1.y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
  }
  return d;
}

export function Sparkline({
  data,
  max,
  color = "#22d3ee",
  height = 44,
  grid = false,
  dot = false,
  fillOpacity = 0.22,
}: {
  data: number[];
  max?: number;
  color?: string;
  height?: number;
  grid?: boolean;
  dot?: boolean;
  fillOpacity?: number;
}) {
  const w = 100;
  const m = max ?? Math.max(...data, 1);
  const pad = 3;
  const pts = data.map((v, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * w,
    y: height - pad - (Math.min(v, m) / m) * (height - pad * 2),
  }));
  const line = smoothPath(pts);
  const last = pts[pts.length - 1];
  const gid = `g${color.replace(/[^a-z0-9]/gi, "")}${height}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid &&
        [0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1="0"
            x2={w}
            y1={height * f}
            y2={height * f}
            stroke="rgba(255,255,255,0.045)"
            strokeWidth="0.5"
          />
        ))}
      {line && (
        <>
          <path
            d={`${line} L ${w},${height} L 0,${height} Z`}
            fill={`url(#${gid})`}
          />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {dot && last && (
            <circle cx={last.x} cy={last.y} r="1.8" fill={color}>
              <animate
                attributeName="opacity"
                values="1;0.35;1"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </>
      )}
    </svg>
  );
}

/** 270° radial gauge — the hero visual for a single live metric. */
export function Gauge({
  pct,
  size = 148,
  stroke = 9,
  color = "#22d3ee",
  value,
  unit,
  label,
  sub,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  value: string;
  unit?: string;
  label: string;
  sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* rotate so the 90° gap faces down */}
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.055)"
          strokeWidth={stroke}
          strokeDasharray={`${arc} ${c}`}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          initial={{ strokeDashoffset: arc }}
          animate={{ strokeDashoffset: arc - (clamped / 100) * arc }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 5px ${color}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="num text-[30px] font-extralight leading-none text-white">
          {value}
          {unit && <span className="ml-0.5 text-[14px] text-white/40">{unit}</span>}
        </div>
        <div className="label mt-1.5">{label}</div>
        {sub && <div className="num mt-0.5 text-[10px] text-white/40">{sub}</div>}
      </div>
    </div>
  );
}

export function Ring({
  pct,
  size = 92,
  stroke = 6,
  color,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const col =
    color ?? (clamped > 66 ? "#7dd3a8" : clamped > 33 ? "#e5b567" : "#f2757f");
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (clamped / 100) * c }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 4px ${col}38)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function Bar({
  pct,
  color = "#22d3ee",
  className = "",
}: {
  pct: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-white/[0.05] ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 6px ${color}45` }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/** Per-core load heatmap — one cell per logical core. */
export function CoreHeatmap({
  cores,
}: {
  cores: { usage: number; freq_mhz: number }[];
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cores.map((c, i) => {
        const a = 0.05 + (Math.min(c.usage, 100) / 100) * 0.8;
        return (
          <div
            key={i}
            title={`Core ${i} — ${c.usage.toFixed(0)}%`}
            className="flex h-9 items-center justify-center rounded-md border border-white/[0.04] transition-colors duration-500"
            style={{ background: `rgba(34,211,238,${a.toFixed(3)})` }}
          >
            <span
              className="num text-[9px]"
              style={{ color: c.usage > 55 ? "rgba(3,4,5,0.85)" : "rgba(255,255,255,0.45)" }}
            >
              {c.usage.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
