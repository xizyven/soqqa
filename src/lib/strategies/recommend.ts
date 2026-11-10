/**
 * "Find my strategy": a transparent rule-based matcher. Each answer adds
 * points to the strategies it supports, with a reason the UI shows. It
 * suggests starting points; it never promises outcomes.
 */
import type { StrategySlug } from "../domain/types";

export interface FinderAnswers {
  income: "regular" | "irregular" | "business";
  goal: "control" | "save" | "debt" | "safety" | "purchase" | "business";
  style: "simple" | "detailed" | "reflective";
  debt: "none" | "some" | "heavy";
  reserve: "none" | "partial" | "full";
  raise: "yes" | "no";
}

export type FinderReason =
  | "income_regular" | "income_irregular" | "income_business"
  | "goal_control" | "goal_save" | "goal_debt" | "goal_safety" | "goal_purchase" | "goal_business"
  | "style_simple" | "style_detailed" | "style_reflective"
  | "debt_some" | "debt_heavy" | "reserve_none" | "reserve_partial" | "raise_yes";

type Rule = [StrategySlug, number, FinderReason];

const RULES: { [K in keyof FinderAnswers]: Record<FinderAnswers[K], Rule[]> } = {
  income: {
    regular: [["pay-yourself-first", 2, "income_regular"], ["rule-50-30-20", 2, "income_regular"], ["zero-based", 1, "income_regular"]],
    irregular: [["emergency-fund", 3, "income_irregular"], ["envelopes", 2, "income_irregular"], ["pay-yourself-first", 2, "income_irregular"]],
    business: [["profit-first", 5, "income_business"], ["emergency-fund", 1, "income_business"]],
  },
  goal: {
    control: [["envelopes", 3, "goal_control"], ["zero-based", 3, "goal_control"], ["rule-50-30-20", 1, "goal_control"]],
    save: [["pay-yourself-first", 3, "goal_save"], ["lifestyle-inflation", 2, "goal_save"], ["rule-50-30-20", 1, "goal_save"]],
    debt: [["debt-payoff", 5, "goal_debt"], ["zero-based", 1, "goal_debt"]],
    safety: [["emergency-fund", 5, "goal_safety"], ["pay-yourself-first", 1, "goal_safety"]],
    purchase: [["sinking-funds", 5, "goal_purchase"], ["pay-yourself-first", 1, "goal_purchase"]],
    business: [["profit-first", 5, "goal_business"]],
  },
  style: {
    simple: [["rule-50-30-20", 3, "style_simple"], ["pay-yourself-first", 2, "style_simple"]],
    detailed: [["zero-based", 3, "style_detailed"], ["envelopes", 2, "style_detailed"]],
    reflective: [["kakeibo", 4, "style_reflective"]],
  },
  debt: {
    none: [],
    some: [["debt-payoff", 2, "debt_some"]],
    heavy: [["debt-payoff", 4, "debt_heavy"], ["zero-based", 1, "debt_heavy"]],
  },
  reserve: {
    none: [["emergency-fund", 4, "reserve_none"]],
    partial: [["emergency-fund", 2, "reserve_partial"]],
    full: [],
  },
  raise: {
    yes: [["lifestyle-inflation", 3, "raise_yes"]],
    no: [],
  },
};

export interface Recommendation {
  slug: StrategySlug;
  score: number;
  reasons: FinderReason[];
}

export function recommendStrategies(a: FinderAnswers, top = 3): Recommendation[] {
  const acc = new Map<StrategySlug, Recommendation>();
  (Object.keys(RULES) as (keyof FinderAnswers)[]).forEach((q) => {
    const rules = (RULES[q] as Record<string, Rule[]>)[a[q]] ?? [];
    for (const [slug, pts, reason] of rules) {
      const r = acc.get(slug) ?? { slug, score: 0, reasons: [] };
      r.score += pts;
      if (!r.reasons.includes(reason)) r.reasons.push(reason);
      acc.set(slug, r);
    }
  });
  // Profit First is only suggested when there is a business.
  if (a.income !== "business" && a.goal !== "business") acc.delete("profit-first");
  return [...acc.values()].sort((x, y) => y.score - x.score || x.slug.localeCompare(y.slug)).slice(0, top);
}
