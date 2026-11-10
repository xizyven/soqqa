/**
 * Uzbek-inspired ornament primitives, kept deliberately quiet:
 *  - Khatam: the eight-pointed star of girih tilework (Registan, Shah-i-Zinda).
 *  - Rhomb: the ikat / suzani lozenge, used as a bullet.
 *  - Girih field: a tileable star-and-cross lattice for large surfaces at ~4% ink.
 *  - Islimi divider: a hairline with a central khatam.
 * Everything draws with currentColor so it inherits the theme.
 */
import type { CSSProperties } from "react";

/** Eight-pointed star: two squares, one rotated 45°. */
export const KHATAM_PATH =
  "M12 1.5L14.93 4.43L19.07 4.43L19.07 8.57L22 11.5L19.07 14.43L19.07 18.57L14.93 18.57L12 21.5L9.07 18.57L4.93 18.57L4.93 14.43L2 11.5L4.93 8.57L4.93 4.43L9.07 4.43Z";

export function Khatam({ size = 12, className, filled = true, style }: { size?: number; className?: string; filled?: boolean; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 23" className={className} style={style} aria-hidden>
      <path d={KHATAM_PATH} fill={filled ? "currentColor" : "none"} stroke={filled ? "none" : "currentColor"} strokeWidth={filled ? 0 : 1.4} strokeLinejoin="round" />
      {filled && <circle cx="12" cy="11.5" r="2.6" fill="var(--khatam-core, transparent)" />}
    </svg>
  );
}

export function Rhomb({ size = 6, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" className={className} aria-hidden>
      <path d="M5 0L10 5L5 10L0 5Z" fill="currentColor" />
    </svg>
  );
}

/** Hairline divider with a central star, for section breaks. */
export function IslimiDivider({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-line-strong ${className ?? ""}`} aria-hidden>
      <span className="h-px flex-1 bg-current" />
      <Khatam size={10} className="text-brand/60" filled={false} />
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}

/**
 * A single rosette built from nested khatams — used as a quiet corner flourish
 * on hero surfaces and inside empty states.
 */
export function Rosette({ size = 120, className, style }: { size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} style={style} aria-hidden fill="none" stroke="currentColor" strokeWidth="1">
      <g transform="translate(60 60)">
        {[56, 42, 28].map((r, i) => (
          <g key={r} opacity={1 - i * 0.18}>
            <rect x={-r * 0.7} y={-r * 0.7} width={r * 1.4} height={r * 1.4} />
            <rect x={-r * 0.7} y={-r * 0.7} width={r * 1.4} height={r * 1.4} transform="rotate(45)" />
          </g>
        ))}
        <circle r="10" />
        <circle r="56" opacity=".5" />
      </g>
    </svg>
  );
}
