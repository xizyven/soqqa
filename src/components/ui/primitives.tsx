"use client";

import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, LoaderCircle } from "lucide-react";
import { KHATAM_PATH, Khatam, Rhomb, Rosette } from "../brand/ornaments";

export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ai" | "income" | "outline";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-fill text-white hover:bg-brand-hi active:bg-brand-deep",
  secondary: "bg-surface text-fg border border-line-strong hover:bg-surface-2",
  outline: "border border-line-strong text-fg hover:bg-surface-2",
  ghost: "text-fg-2 hover:text-fg hover:bg-surface-2",
  danger: "bg-expense-soft text-expense hover:bg-expense-strong hover:text-white",
  ai: "bg-ai-strong text-white hover:brightness-110",
  income: "bg-income-strong text-white hover:brightness-110",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, icon, className, children, disabled, ...rest },
  ref,
) {
  const sizes = { sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[9px]", md: "h-10 px-4 text-sm gap-2 rounded-[11px]", lg: "h-12 px-5 text-[15px] gap-2 rounded-xl" };
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.005em] transition-[background-color,border-color,color,filter,transform,box-shadow] duration-150 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45",
        sizes[size],
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="animate-spin" size={16} /> : icon}
      {children}
    </button>
  );
});

export function IconButton({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn("inline-flex size-9 items-center justify-center rounded-[10px] text-fg-2 transition-colors duration-150 hover:bg-surface-2 hover:text-fg active:scale-95", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, htmlFor }: { label?: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="eyebrow">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-expense" role="alert">
          <Rhomb size={5} />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] leading-snug text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "h-11 w-full rounded-[11px] border border-line bg-surface-2 px-3.5 text-[15px] text-fg placeholder:text-fg-3 outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-line-strong focus:border-brand-line focus:bg-surface focus:shadow-[0_0_0_4px_var(--brand-soft)]";

/**
 * Base input classes minus the height, width and font size a caller overrides,
 * so `className="h-8 w-auto text-[13px]"` actually wins (no class-merge library).
 */
function fieldClasses(className?: string): string {
  if (!className) return inputBase;
  const own = className.split(/\s+/);
  const has = (re: RegExp) => own.some((c) => re.test(c));
  return inputBase
    .split(" ")
    .filter((c) => !((/^h-/.test(c) && has(/^h-/)) || (/^w-/.test(c) && has(/^w-/)) || (/^text-\[/.test(c) && has(/^text-\[/))))
    .join(" ");
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input(
  { className, invalid, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(fieldClasses(className), invalid && "border-expense/60 focus:border-expense", className)} {...rest} />;
});

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a93a7' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E\")";

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClasses(className), "cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9", className)} style={{ backgroundImage: CHEVRON }} {...rest}>
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-fg">{label}</label>
        {description && <p className="mt-0.5 text-[13px] leading-snug text-fg-3">{description}</p>}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-[42px] shrink-0 rounded-full border transition-colors duration-200", checked ? "border-brand-fill bg-brand-fill" : "border-line-strong bg-surface-3")}
      >
        <motion.span
          className="absolute top-[2px] size-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
        />
      </button>
    </div>
  );
}

/** Segmented control with a sliding indicator. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; tone?: "income" | "expense" | "ai" | "accent" }[];
  size?: "sm" | "md";
  className?: string;
}) {
  const uid = useId();
  const tones = { income: "text-income", expense: "text-expense", ai: "text-ai", accent: "text-brand" };
  return (
    <div role="tablist" className={cn("inline-flex rounded-[12px] border border-line bg-surface-2 p-[3px]", className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-[9px] font-semibold transition-colors duration-150",
              size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3.5 text-[13px]",
              active ? cn("text-fg", o.tone && tones[o.tone]) : "text-fg-3 hover:text-fg-2",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${uid}`}
                className="absolute inset-0 rounded-[9px] bg-surface shadow-[0_1px_2px_rgba(10,20,48,0.12)] ring-1 ring-line"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const BAR_COLORS = { accent: "bg-brand", income: "bg-viz-income", expense: "bg-viz-expense", warning: "bg-[#C9921F]", ai: "bg-ai-strong" };

/**
 * Progress bar. `marker` (0–1) draws the "today" pace tick — where spending
 * should be by now — so a bar is read against time, not only against the limit.
 */
export function Progress({ value, tone = "accent", className, label, marker }: { value: number; tone?: "accent" | "income" | "expense" | "warning" | "ai"; className?: string; label?: string; marker?: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const over = value > 1;
  return (
    <div className={cn("relative h-2 w-full rounded-full bg-surface-3", className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <motion.div className={cn("h-full rounded-full", BAR_COLORS[tone])} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
        {over && <div className="hatch absolute inset-y-0 right-0 w-1/4 text-white/40" aria-hidden />}
      </div>
      {marker !== undefined && marker > 0 && marker < 1 && (
        <span className={cn("absolute -bottom-1 -top-1 w-[2px] rounded-full", pct > marker * 100 ? "bg-white/85" : "bg-fg/45")} style={{ left: `calc(${marker * 100}% - 1px)` }} aria-hidden />
      )}
    </div>
  );
}

/**
 * Khatam progress — the eight-pointed star outline fills as a goal is reached.
 * Uses pathLength so the stroke maps 1:1 to percent.
 */
export function KhatamProgress({ value, size = 72, color = "var(--brand)", track = "var(--border)", strokeWidth = 1.5, children, label }: { value: number; size?: number; color?: string; track?: string; strokeWidth?: number; children?: ReactNode; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const h = Math.round((size * 23) / 24);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: h }}>
      <svg width={size} height={h} viewBox="0 0 24 23" className="absolute inset-0" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
        <path d={KHATAM_PATH} fill="none" stroke={track} strokeWidth={strokeWidth} strokeLinejoin="round" />
        <path d={KHATAM_PATH} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} className="khatam-progress" />
      </svg>
      <span className="relative flex flex-col items-center">{children}</span>
    </span>
  );
}

type BadgeTone = "neutral" | "income" | "expense" | "warning" | "ai" | "accent" | "gold";
type BadgeGlyph = "star" | "rhomb" | "up" | "down" | "none";

/**
 * Badge — a small tile with an ornament glyph. Status badges carry the khatam
 * star, labels the ikat rhomb, deltas an arrow; colour is never the only signal.
 */
export function Badge({ children, tone = "neutral", glyph, className }: { children: ReactNode; tone?: BadgeTone; glyph?: BadgeGlyph; className?: string }) {
  const tones: Record<BadgeTone, string> = {
    neutral: "bg-surface-3 text-fg-2",
    income: "bg-income-soft text-income",
    expense: "bg-expense-soft text-expense",
    warning: "bg-warning-soft text-warning",
    ai: "bg-ai-soft text-ai",
    accent: "bg-brand-soft text-brand",
    gold: "bg-panel text-[#F2CF7E]",
  };
  const g = glyph ?? "none";
  return (
    <span className={cn("inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-[11.5px] font-semibold leading-none", tones[tone], className)}>
      {g === "star" && <Khatam size={9} />}
      {g === "rhomb" && <Rhomb size={5} />}
      {g === "up" && <ArrowUpRight size={11} strokeWidth={2.4} />}
      {g === "down" && <ArrowDownRight size={11} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

export function Card({
  children,
  className,
  title,
  action,
  subtitle,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cn("card min-w-0", padded && "p-4 sm:p-6", className)}>
      {(title || action) && (
        <header className={cn("mb-4 flex items-start justify-between gap-3", !padded && "px-4 pt-4 sm:px-6 sm:pt-6")}>
          <div className="min-w-0">
            {title && <h2 className="display text-[17px] font-semibold text-fg sm:text-[18px]">{title}</h2>}
            {subtitle && <p className="mt-1 text-[12.5px] text-fg-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/** Page heading: display title, optional description and actions. */
export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex animate-rise flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2 flex items-center gap-2"><Khatam size={10} className="text-brand" />{eyebrow}</p>}
        <h1 className="display text-[28px] font-semibold leading-none tracking-[-0.03em] text-fg sm:text-[38px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[14px] text-fg-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="relative mb-4 flex size-20 items-center justify-center">
        <Rosette size={80} className="absolute inset-0 text-brand/20" />
        {icon && <div className="relative flex size-11 items-center justify-center rounded-[13px] border border-brand-line bg-surface text-brand">{icon}</div>}
      </div>
      <p className="display text-[16px] font-semibold text-fg">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-fg-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line-strong bg-surface px-1 font-mono text-[10px] font-medium text-fg-3 shadow-[0_1px_0_var(--border)]">{children}</kbd>;
}

/** Delta pill for month-over-month changes. */
export function Delta({ value, goodWhenUp, label }: { value: number | null; goodWhenUp?: boolean; label: string }) {
  if (value === null) return null;
  const good = goodWhenUp ? value >= 0 : value <= 0;
  return (
    <Badge tone={value === 0 ? "neutral" : good ? "income" : "expense"} glyph={value > 0 ? "up" : value < 0 ? "down" : "none"}>
      {label}
    </Badge>
  );
}
