import { ArrowLeftRight, ChartColumn, Compass, LayoutDashboard, PiggyBank, Settings, Sparkles, Target, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import type { TKey } from "@/lib/i18n/translate";

export interface NavItem {
  href: string;
  label: TKey;
  icon: LucideIcon;
  /** Two-key "g x" shortcut. */
  key: string;
}

export const NAV: NavItem[] = [
  { href: "/", label: "nav.overview", icon: LayoutDashboard, key: "o" },
  { href: "/transactions", label: "nav.transactions", icon: ArrowLeftRight, key: "t" },
  { href: "/wallets", label: "nav.wallets", icon: Wallet, key: "w" },
  { href: "/budgets", label: "nav.budgets", icon: PiggyBank, key: "b" },
  { href: "/analytics", label: "nav.analytics", icon: ChartColumn, key: "a" },
  { href: "/goals", label: "nav.goals", icon: Target, key: "g" },
  { href: "/strategies", label: "nav.strategies", icon: Compass, key: "r" },
  { href: "/progress", label: "nav.progress", icon: TrendingUp, key: "p" },
  { href: "/advisor", label: "nav.advisor", icon: Sparkles, key: "i" },
  { href: "/settings", label: "nav.settings", icon: Settings, key: "s" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
