"use client";

import { CircleAlert, Info, Lightbulb, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { insightBasis, type Insight } from "@/lib/domain/insights";
import type { Category, Currency, Goal } from "@/lib/domain/types";
import { formatDay, formatMoney, formatPercent } from "@/lib/i18n";
import { cn } from "../ui/primitives";

/** Renders a computed insight as a localized sentence. All numbers come from the engine. */
export function useInsightText() {
  const { t, locale, categoryName, prefs, ledger } = useApp();
  const base: Currency = prefs.base_currency;
  const m = (c: bigint, cur: Currency = base) => formatMoney(c, cur, locale, { compact: false });
  const pct = (v: number) => formatPercent(Math.abs(v), locale);
  const cat = (id: string | null) => categoryName(ledger?.categories.find((c: Category) => c.id === id));
  return (i: Insight): { text: string; detail?: string } => {
    switch (i.kind) {
      case "category_up":
        return { text: t("insight.category_up", { category: cat(i.categoryId), pct: pct(i.change), prev: m(i.previous), cur: m(i.current) }) };
      case "category_down":
        return { text: t("insight.category_down", { category: cat(i.categoryId), pct: pct(i.change) }) };
      case "budget_over":
        return { text: t("insight.budget_over", { category: cat(i.categoryId), amount: m(i.spent - i.limit) }) };
      case "budget_warning":
        return { text: t("insight.budget_warning", { category: cat(i.categoryId), pct: pct(i.utilization), amount: m(i.remaining) }) };
      case "small_expenses":
        return {
          text: t("insight.small_expenses", { pct: pct(i.reductionBps / 10000), amount: m(i.monthlySaving) }),
          detail: t("insight.small_expenses_detail", { count: i.count, threshold: m(i.threshold), total: m(i.monthlyTotal) }),
        };
      case "projection_over":
        return { text: t("insight.projection_over", { projected: m(i.projected), average: m(i.average) }) };
      case "pace_good":
        return { text: t("insight.pace_good", { pct: pct(i.change) }) };
      case "anomaly":
        return { text: t("insight.anomaly", { category: cat(i.categoryId), amount: m(i.amount), multiple: i.multiple.toFixed(1) }) };
      case "savings_rate":
        return { text: t("insight.savings_rate", { pct: formatPercent(i.rate, locale) }) };
      case "rule_503020":
        return { text: t("insight.rule_503020", { needs: pct(i.needs), wants: pct(i.wants), savings: formatPercent(i.savings, locale) }) };
      case "goal_behind": {
        const g = ledger?.goals.find((x: Goal) => x.id === i.goalId);
        return { text: t("insight.goal_behind", { goal: g?.name ?? "", required: m(i.required, i.currency), recent: m(i.recent, i.currency) }) };
      }
      case "budget_pace":
        return { text: t("insight.budget_pace", { category: cat(i.categoryId), used: pct(i.utilization), elapsed: pct(i.elapsed), projected: m(i.projected), limit: m(i.limit) }) };
      case "category_pace":
        return { text: t("insight.category_pace", { category: cat(i.categoryId), pct: pct(i.change), prev: m(i.previous), cur: m(i.current) }) };
      case "bill_upcoming":
        return { text: t("insight.bill_upcoming", { date: formatDay(i.date, locale), name: i.name, amount: m(i.amount, i.currency) }) };
    }
  };
}

export function InsightItem({ insight }: { insight: Insight }) {
  const render = useInsightText();
  const { t } = useApp();
  const basis = insightBasis(insight.kind);
  const { text, detail } = render(insight);
  const icon =
    insight.severity === "critical" ? <CircleAlert size={16} /> :
    insight.severity === "warning" ? <TriangleAlert size={16} /> :
    insight.severity === "positive" ? (insight.kind === "category_down" || insight.kind === "pace_good" ? <TrendingDown size={16} /> : <TrendingUp size={16} />) :
    insight.kind === "small_expenses" ? <Lightbulb size={16} /> : <Info size={16} />;
  const tone =
    insight.severity === "critical" ? "bg-expense-soft text-expense" :
    insight.severity === "warning" ? "bg-warning-soft text-warning" :
    insight.severity === "positive" ? "bg-income-soft text-income" : "bg-ai-soft text-ai";
  return (
    <div className="flex gap-3 py-2.5">
      <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg", tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[13.5px] leading-snug text-fg">{text}</p>
        <span className={cn("mt-1 inline-flex h-[18px] items-center rounded-[5px] px-1.5 text-[10.5px] font-semibold", basis === "fact" ? "bg-surface-3 text-fg-2" : basis === "estimate" ? "bg-ai-soft text-ai" : "bg-warning-soft text-warning")}>{t(`notif.${basis}`)}</span>
        {detail && <p className="mt-0.5 text-[12px] text-fg-3">{detail}</p>}
      </div>
    </div>
  );
}
