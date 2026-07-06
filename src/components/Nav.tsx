import { motion } from "framer-motion";
import type { ReactNode } from "react";

export type PageId = "overview" | "drives" | "actions";

const ICONS: Record<PageId, ReactNode> = {
  overview: (
    <path d="M3 13.5 L8 8.5 L11.5 12 L17 5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  drives: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="10" cy="5.5" rx="6" ry="2.4" />
      <path d="M4 5.5 V14.5 C4 15.8 6.7 16.9 10 16.9 C13.3 16.9 16 15.8 16 14.5 V5.5" />
      <path d="M4 10 C4 11.3 6.7 12.4 10 12.4 C13.3 12.4 16 11.3 16 10" />
    </g>
  ),
  actions: (
    <path d="M9 2 L4 11 H9 L8 18 L16 8 H10 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  ),
};

const LABELS: Record<PageId, string> = {
  overview: "Overview",
  drives: "Drives",
  actions: "Actions",
};

const ORDER: PageId[] = ["overview", "drives", "actions"];

export function Nav({
  active,
  onChange,
}: {
  active: PageId;
  onChange: (p: PageId) => void;
}) {
  return (
    <nav className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.05] py-4">
      {ORDER.map((id) => {
        const on = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="group relative flex h-14 w-full flex-col items-center justify-center gap-1"
          >
            {on && (
              <motion.span
                layoutId="nav-active"
                className="absolute left-0 top-1/2 h-7 w-[2px] -translate-y-1/2 rounded-full bg-accent"
                style={{ boxShadow: "0 0 10px rgba(34,211,238,0.6)" }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              className={`transition-colors ${
                on ? "text-accent" : "text-white/40 group-hover:text-white/75"
              }`}
            >
              {ICONS[id]}
            </svg>
            <span
              className={`text-[9px] font-medium tracking-wide transition-colors ${
                on ? "text-white/85" : "text-white/35 group-hover:text-white/60"
              }`}
            >
              {LABELS[id]}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
