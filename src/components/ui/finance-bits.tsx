import type { GoalProgress } from "@/lib/domain/planning";

/** Small card glyph in the wallet's colour — echoes the card in the logo. */
export function WalletChip({ color, className }: { color: string; className?: string }) {
  return (
    <span className={`relative h-7 w-10 shrink-0 rounded-[7px] ${className ?? ""}`} style={{ background: color }} aria-hidden>
      <span className="absolute left-1.5 top-[7px] h-[7px] w-[9px] rounded-[2px] bg-white/80" />
    </span>
  );
}

/** Badge tone for a goal state. */
export function goalTone(s: GoalProgress["state"]): "income" | "warning" | "expense" | "neutral" | "gold" {
  return s === "completed" ? "gold" : s === "on_track" ? "income" : s === "behind" ? "warning" : s === "overdue" ? "expense" : "neutral";
}
