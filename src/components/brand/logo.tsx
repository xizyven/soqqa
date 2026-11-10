import { useId } from "react";
import mark from "./mark.json";

/**
 * The Soqqa mark: wallet + letter S — a blue ribbon folding into an "S" around a
 * navy card with a light chip. Redrawn as a vector from the brand sheet (shared
 * geometry in mark.json, also used to rasterise the PWA icons).
 */
export function LogoMark({ size = 28, className, title }: { size?: number; className?: string; title?: string }) {
  const uid = useId().replace(/[:«»]/g, "");
  const [w, h] = mark.viewBox;
  const grads = mark.gradients as Record<string, { from: number[]; to: number[]; stops: (number | string)[][] }>;
  return (
    <svg width={(size * w) / h} height={size} viewBox={`0 0 ${w} ${h}`} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        {Object.entries(grads).map(([id, g]) => (
          <linearGradient key={id} id={`${uid}-${id}`} x1={g.from[0]} y1={g.from[1]} x2={g.to[0]} y2={g.to[1]}>
            {g.stops.map((s, i) => (
              <stop key={i} offset={s[0] as number} stopColor={s[1] as string} stopOpacity={(s[2] as number | undefined) ?? 1} />
            ))}
          </linearGradient>
        ))}
      </defs>
      {mark.layers.map((l, i) => (
        <path key={i} d={l.d} fill={l.fill.startsWith("#") ? l.fill : `url(#${uid}-${l.fill})`} opacity={(l as { opacity?: number }).opacity} />
      ))}
      <path d={`M${mark.stripe.from.join(" ")} L${mark.stripe.to.join(" ")}`} stroke={mark.stripe.color} strokeOpacity={mark.stripe.opacity} strokeWidth={mark.stripe.width} strokeLinecap="round" />
      <path d={mark.chip.d} fill={mark.chip.color} />
    </svg>
  );
}

/** "soqqa" wordmark set in Outfit, matching the logo lettering. */
export function Wordmark({ className }: { className?: string }) {
  return <span className={`font-display font-medium lowercase tracking-[-0.035em] text-fg ${className ?? ""}`}>soqqa</span>;
}

export function Logo({ collapsed, size = 26, className, tagline }: { collapsed?: boolean; size?: number; className?: string; tagline?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`} aria-label="Soqqa">
      <LogoMark size={size} />
      {!collapsed && (
        <span className="flex flex-col">
          <Wordmark className="text-[23px] leading-[0.9]" />
          {tagline && <span className="mt-1 whitespace-nowrap text-[8px] font-semibold uppercase tracking-[0.2em] text-fg-3">{tagline}</span>}
        </span>
      )}
    </span>
  );
}

/** App-icon tile: the mark on a rounded square (navy in dark, white in light). */
export function AppIcon({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[28%] border border-line bg-surface shadow-[var(--shadow)] ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <LogoMark size={Math.round(size * 0.56)} />
    </span>
  );
}
