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
      <header className="mb-3 flex items-center justify-between">
        <h2 className="label">{title}</h2>
        {right}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </motion.section>
  );
}

export function Sparkline({
  data,
  max,
  color = "#22d3ee",
  height = 44,
}: {
  data: number[];
  max?: number;
  color?: string;
  height?: number;
}) {
  const w = 100;
  const m = max ?? Math.max(...data, 1);
  const pts = data.length
    ? data
        .map((v, i) => {
          const x = (i / Math.max(data.length - 1, 1)) * w;
          const y = height - 2 - (Math.min(v, m) / m) * (height - 6);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ")
    : "";
  const gid = `g${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="h-full w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {pts && (
        <>
          <polygon
            points={`0,${height} ${pts} ${w},${height}`}
            fill={`url(#${gid})`}
          />
          <polyline
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth="1.4"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
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
          stroke="rgba(255,255,255,0.07)"
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
          style={{ filter: `drop-shadow(0 0 4px ${col}44)` }}
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
    <div className={`h-1 overflow-hidden rounded-full bg-white/[0.06] ${className}`}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}55` }}
        animate={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}
