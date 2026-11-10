import type { CategoryBucket, CategoryKind } from "./types";

export interface SystemCategory {
  key: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  bucket: CategoryBucket | null;
}

/** Built-in categories. Names are translated in the UI via `category.<key>`. */
export const SYSTEM_CATEGORIES: SystemCategory[] = [
  { key: "food", kind: "expense", icon: "utensils", color: "#d95926", bucket: "wants" },
  { key: "transport", kind: "expense", icon: "car", color: "#3987e5", bucket: "needs" },
  { key: "shopping", kind: "expense", icon: "shopping-bag", color: "#d55181", bucket: "wants" },
  { key: "groceries", kind: "expense", icon: "shopping-cart", color: "#199e70", bucket: "needs" },
  { key: "housing", kind: "expense", icon: "home", color: "#9085e9", bucket: "needs" },
  { key: "utilities", kind: "expense", icon: "zap", color: "#c98500", bucket: "needs" },
  { key: "education", kind: "expense", icon: "graduation-cap", color: "#008300", bucket: "needs" },
  { key: "entertainment", kind: "expense", icon: "clapperboard", color: "#e66767", bucket: "wants" },
  { key: "health", kind: "expense", icon: "heart-pulse", color: "#e34948", bucket: "needs" },
  { key: "subscriptions", kind: "expense", icon: "repeat", color: "#6250d6", bucket: "wants" },
  { key: "travel", kind: "expense", icon: "plane", color: "#2a78d6", bucket: "wants" },
  { key: "other_expense", kind: "expense", icon: "circle-dashed", color: "#64748B", bucket: "wants" },
  { key: "salary", kind: "income", icon: "briefcase", color: "#199e70", bucket: null },
  { key: "freelance", kind: "income", icon: "laptop", color: "#3987e5", bucket: null },
  { key: "business", kind: "income", icon: "store", color: "#9085e9", bucket: null },
  { key: "investments", kind: "income", icon: "trending-up", color: "#c98500", bucket: null },
  { key: "gifts", kind: "income", icon: "gift", color: "#d55181", bucket: null },
  { key: "other_income", kind: "income", icon: "circle-plus", color: "#64748B", bucket: null },
];

export const WALLET_ICONS = ["credit-card", "banknote", "piggy-bank", "wallet", "landmark", "smartphone", "globe", "coins", "briefcase", "gem"] as const;
export const CATEGORY_ICONS = [
  "utensils", "car", "shopping-bag", "shopping-cart", "home", "zap", "graduation-cap", "clapperboard", "heart-pulse", "repeat",
  "plane", "circle-dashed", "briefcase", "laptop", "store", "trending-up", "gift", "circle-plus", "coffee", "dumbbell",
  "baby", "dog", "shirt", "fuel", "phone", "wifi", "book", "music", "gamepad-2", "wrench",
] as const;
export const GOAL_ICONS = ["target", "laptop", "plane", "shield", "smartphone", "graduation-cap", "car", "home", "gem", "gift"] as const;

/** Validated categorical steps (dark-surface variants, see dataviz validator). */
export const PALETTE = [
  "#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767", "#64748B", "#0ea5e9",
] as const;
