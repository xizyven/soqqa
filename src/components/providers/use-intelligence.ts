"use client";

import { useMemo } from "react";
import { useApp } from "./app-provider";
import { useFinance } from "./use-finance";
import { detectGaps, indexActivity, streaks, type GapPrompt } from "@/lib/domain/activity";
import { evaluateBadges, type BadgeStatus } from "@/lib/domain/achievements";
import { healthScore, type HealthScore } from "@/lib/domain/health";
import { goalProgress } from "@/lib/domain/planning";
import type { Insight } from "@/lib/domain/insights";
import { addDays } from "@/lib/domain/dates";
import { notificationSettings, type NotificationSettings } from "@/lib/domain/types";

export type NotificationKind = "budget" | "reminder" | "achievement" | "insight" | "milestone";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  /** Sort key: most recent first (ISO date or instant). */
  at: string;
  insight?: Insight;
  gap?: GapPrompt;
  badge?: BadgeStatus;
  goalId?: string;
  href: string;
}

/** Current hour in the user's timezone. */
export function localHour(timezone: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(new Date()));
  } catch {
    return new Date().getHours();
  }
}

const BUDGET_KINDS = new Set<Insight["kind"]>(["budget_over", "budget_warning", "budget_pace"]);

export interface Intelligence {
  settings: NotificationSettings;
  badges: BadgeStatus[];
  gaps: GapPrompt[];
  streak: ReturnType<typeof streaks>;
  health: HealthScore | null;
  notifications: AppNotification[];
}

/** Derived, memoised view of habits, reminders, badges, health and notifications. */
export function useIntelligence(): Intelligence {
  const { ledger, extras, prefs, today } = useApp();
  const f = useFinance();
  const hour = localHour(prefs.timezone);

  return useMemo(() => {
    const settings = notificationSettings(prefs);
    const txs = ledger?.transactions ?? [];
    const ix = indexActivity(txs, extras.reviews);
    const gaps = ledger ? detectGaps(ix, today, { hour, reminderHour: settings.reminder_hour }) : [];
    const streak = streaks(ix, today);
    const badges = ledger ? evaluateBadges(ledger, prefs.base_currency, today, extras.reviews, extras.achievements) : [];
    const health = ledger && txs.length ? healthScore(ledger, prefs.base_currency, today, { reviews: extras.reviews, plans: extras.plans }) : null;

    const notifications: AppNotification[] = [];
    for (const i of f.insights) {
      const budget = BUDGET_KINDS.has(i.kind);
      if (budget ? !settings.budget : !settings.insights) continue;
      if (i.severity === "positive" || i.kind === "rule_503020" || i.kind === "savings_rate") continue; // keep the centre for things to act on
      notifications.push({ id: `i:${i.id}`, kind: budget ? "budget" : "insight", at: today, insight: i, href: budget ? "/budgets" : "/analytics" });
    }
    if (settings.reminders) for (const g of gaps) notifications.push({ id: `g:${g.date}:${g.reason}`, kind: "reminder", at: g.date, gap: g, href: "/" });
    if (settings.achievements)
      for (const b of badges)
        if (b.unlockedAt && b.unlockedAt.slice(0, 10) >= addDays(today, -14)) notifications.push({ id: `a:${b.key}`, kind: "achievement", at: b.unlockedAt, badge: b, href: "/progress" });
    if (ledger && settings.achievements)
      for (const g of ledger.goals) {
        if (g.status === "archived") continue;
        const p = goalProgress(g, ledger.contributions, today);
        if (p.state === "completed") notifications.push({ id: `m:${g.id}`, kind: "milestone", at: today, goalId: g.id, href: "/goals" });
      }
    notifications.sort((a, b) => b.at.localeCompare(a.at));
    return { settings, badges, gaps, streak, health, notifications };
  }, [ledger, extras, prefs, today, hour, f.insights]);
}
