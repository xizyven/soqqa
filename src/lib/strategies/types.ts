import type { Cents } from "../money/money";
import type { Locale, StrategySlug } from "../domain/types";

/** A string in every supported language. Uzbek (Latin) is primary. */
export type L = Record<Locale, string>;

export type ProfessionKey =
  | "student"
  | "university"
  | "freelancer"
  | "salaried"
  | "entrepreneur"
  | "small_business"
  | "teacher"
  | "it"
  | "sales"
  | "family"
  | "irregular"
  | "retiree";

export type LifeStage = "16-20" | "21-25" | "26-35" | "36-50" | "51+";

/** Concrete things a user can do in SOQQA to apply a strategy. */
export type ActionKey = "tool" | "budgets" | "goals" | "recurring" | "categories" | "analytics" | "advisor" | "wallets" | "quick_income";

export interface Reference {
  title: string;
  author: string;
  year: string;
  /** Publicly reachable page when one exists. */
  url?: string;
  /** What this source supports. */
  supports: L;
}

export interface ExampleRow {
  label: L;
  amount: Cents;
  emphasis?: boolean;
}

export interface StrategyContent {
  slug: StrategySlug;
  name: L;
  /** Internationally recognised original name. */
  original: string;
  /** Visual identity colour (used sparingly: art, accents). */
  accent: string;
  /** 1 = simple … 3 = demanding. */
  complexity: 1 | 2 | 3;
  discipline: 1 | 2 | 3;
  flexibility: 1 | 2 | 3;
  purpose: L;
  summary: L;
  benefits: L[];
  drawbacks: L[];
  origin: {
    /** "known" = identifiable creator; "popularized" = associated people, not inventors; "uncertain" = no single origin. */
    certainty: "known" | "popularized" | "uncertain";
    /** Short card line. */
    label: L;
    history: L;
    advocates: L;
  };
  overview: L;
  steps: L[];
  science: L;
  professions: { key: ProfessionKey; why: L }[];
  situations: L[];
  stages: LifeStage[];
  stageNote: L;
  /** Business-oriented strategies show a prominent notice. */
  businessOnly?: boolean;
  example: { intro: L; rows: ExampleRow[]; outro: L };
  implement: { action: ActionKey; text: L }[];
  references: Reference[];
}
