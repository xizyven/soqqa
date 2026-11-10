"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarCheck, CircleCheck, Eye, Feather, Flame, ListChecks, PiggyBank, Scale, ShieldCheck, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { KHATAM_PATH, Rhomb } from "../brand/ornaments";
import { cn, KhatamProgress } from "../ui/primitives";
import { IconTile } from "../ui/icon";
import type { BadgeStatus } from "@/lib/domain/achievements";
import type { GapPrompt } from "@/lib/domain/activity";
import type { HealthScore } from "@/lib/domain/health";
import { addDays } from "@/lib/domain/dates";
import { formatDay, formatMoney, relativeDay } from "@/lib/i18n";
import { notificationSettings, type DayReviewStatus, type Transaction } from "@/lib/domain/types";
import { smartDefaults } from "@/lib/domain/smart";
import { parseAmount } from "@/lib/money/money";
import type { TKey } from "@/lib/i18n/translate";

const BADGE_ICONS: Record<string, LucideIcon> = { feather: Feather, "list-checks": ListChecks, flame: Flame, "calendar-check": CalendarCheck, eye: Eye, "shield-check": ShieldCheck, "piggy-bank": PiggyBank, scale: Scale };
const TIER: Record<BadgeStatus["tier"], { ring: string; fill: string; icon: string }> = {
  bronze: { ring: "#B87333", fill: "#2A1A0E", icon: "#E8B48A" },
  silver: { ring: "#A9B7D6", fill: "#16233F", icon: "#DCE6FB" },
  gold: { ring: "#C9921F", fill: "#071330", icon: "#F2CF7E" },
};

/** Khatam medallion for a badge: navy tile with a tier-coloured star ring. Locked badges show progress. */
export function BadgeMedal({ badge, size = 72 }: { badge: BadgeStatus; size?: number }) {
  const unlocked = !!badge.unlockedAt || badge.earned;
  const Icon = BADGE_ICONS[badge.icon] ?? Sparkles;
  const tier = TIER[badge.tier];
  const h = Math.round((size * 23) / 24);
  if (!unlocked) {
    return (
      <KhatamProgress value={badge.current / badge.target} size={size} color="var(--brand)" strokeWidth={1.4}>
        <Icon size={Math.round(size * 0.3)} className="text-fg-3" strokeWidth={1.8} />
      </KhatamProgress>
    );
  }
  return (
    <motion.span initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 380, damping: 22 }} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: h }}>
      <svg width={size} height={h} viewBox="0 0 24 23" className="absolute inset-0" aria-hidden>
        <path d={KHATAM_PATH} fill={tier.fill} stroke={tier.ring} strokeWidth={1.3} strokeLinejoin="round" />
      </svg>
      <Icon size={Math.round(size * 0.32)} style={{ color: tier.icon }} className="relative" strokeWidth={1.9} />
    </motion.span>
  );
}

/** The forgotten-expense question for one day, with the three possible answers. */
export function GapPromptCard({ gap, compact }: { gap: GapPrompt; compact?: boolean }) {
  const { t, locale, today, repo, toast, openQuickAdd } = useApp();
  const [busy, setBusy] = useState(false);
  const date = relativeDay(gap.date, today, locale);
  const answer = async (status: DayReviewStatus) => {
    setBusy(true);
    try {
      await repo.reviewDay({ local_date: gap.date, status });
      toast({ message: t("remind.saved"), tone: "success" });
      if (status === "needs_review") openQuickAdd({ type: "expense", date: gap.date });
    } finally {
      setBusy(false);
    }
  };
  const title = t(`remind.title_${gap.reason}` as TKey, { date });
  const body = t(`remind.body_${gap.reason}` as TKey, { typical: gap.typical, recorded: gap.recorded });
  return (
    <div className={cn("flex flex-col gap-3", !compact && "card p-5")}>
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-warning-soft text-warning"><Rhomb size={8} /></span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-fg">{title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-fg-2">{body}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => void answer("no_spending")} className="h-9 rounded-[10px] border border-line-strong bg-surface px-3 text-[12.5px] font-semibold text-fg hover:bg-surface-2">{t("remind.no_spending")}</button>
        <button disabled={busy} onClick={() => void answer("complete")} className="h-9 rounded-[10px] border border-line-strong bg-surface px-3 text-[12.5px] font-semibold text-fg hover:bg-surface-2">{t("remind.complete")}</button>
        <button disabled={busy} onClick={() => void answer("needs_review")} className="h-9 rounded-[10px] bg-brand-fill px-3 text-[12.5px] font-semibold text-white hover:bg-brand-hi">{t("remind.review")}</button>
      </div>
      {!compact && <p className="text-[11.5px] leading-snug text-fg-3">{t("remind.note")}</p>}
    </div>
  );
}

const BAND_COLOR: Record<HealthScore["band"], string> = { strong: "#0F8A60", good: "#2F69E8", fair: "#C9921F", weak: "#E11D48" };

/** Compact health score tile for the dashboard. */
export function HealthTile({ health, streak }: { health: HealthScore | null; streak: number }) {
  const { t } = useApp();
  return (
    <Link href="/progress" className="card card-hover flex items-center gap-4 p-5">
      <KhatamProgress value={(health?.score ?? 0) / 100} size={76} color={health ? BAND_COLOR[health.band] : "var(--border-strong)"} label={`${health?.score ?? 0}/100`}>
        <span className="num text-[19px] font-semibold text-fg">{health?.score ?? "—"}</span>
      </KhatamProgress>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[12.5px] font-semibold text-fg-2">{t("health.title")}</span>
        <span className="display text-[17px] font-semibold text-fg">{health ? t(`health.band_${health.band}` as TKey) : t("health.limited")}</span>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-3"><Flame size={13} className="text-warning" />{t("remind.streak", { n: streak })}</span>
      </span>
    </Link>
  );
}

export function healthColor(band: HealthScore["band"]) {
  return BAND_COLOR[band];
}

interface Template {
  key: string;
  label: string;
  categoryId: string | null;
  walletId: string;
  amount: string;
  merchant: string;
  note: string;
  count: number;
}

/** Repeated expenses (same merchant/note, category, wallet and amount ≥3 times in 60 days). */
function frequentTemplates(txs: readonly Transaction[], today: string): Template[] {
  const since = addDays(today, -60);
  const m = new Map<string, Template>();
  for (const t of txs) {
    if (t.deleted_at || t.type !== "expense" || t.local_date < since) continue;
    const label = (t.merchant || t.note).trim();
    if (!label) continue;
    const key = [label.toLowerCase(), t.category_id, t.wallet_id, t.amount].join("|");
    const cur = m.get(key);
    if (cur) cur.count += 1;
    else m.set(key, { key, label, categoryId: t.category_id, walletId: t.wallet_id, amount: t.amount, merchant: t.merchant, note: t.merchant ? "" : t.note, count: 1 });
  }
  return [...m.values()].filter((x) => x.count >= 3).sort((a, b) => b.count - a.count).slice(0, 6);
}

/** One-tap recording: frequent expenses save instantly (with undo); category buttons open a pre-filled form. */
export function QuickRecord() {
  const { t, ledger, today, prefs, repo, toast, openQuickAdd, categoryName, locale } = useApp();
  const settings = notificationSettings(prefs);
  const cats = useMemo(() => {
    if (!ledger) return [];
    const expense = ledger.categories.filter((c) => c.kind === "expense" && !c.archived);
    const pinned = settings.quick_categories.map((id) => expense.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
    if (pinned.length) return pinned.slice(0, 8);
    const learned = smartDefaults(ledger, "expense", today).categoryIds.map((id) => expense.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c);
    const rest = expense.filter((c) => !learned.includes(c)).sort((a, b) => a.sort - b.sort);
    return [...learned, ...rest].slice(0, 8);
  }, [ledger, settings.quick_categories, today]);
  const templates = useMemo(() => frequentTemplates(ledger?.transactions ?? [], today), [ledger, today]);
  const wallets = ledger?.wallets.filter((w) => !w.archived) ?? [];

  const saveTemplate = async (tpl: Template) => {
    const wallet = wallets.find((w) => w.id === tpl.walletId);
    if (!wallet) return openQuickAdd({ type: "expense", categoryId: tpl.categoryId ?? undefined });
    const tx = await repo.saveTransaction({ type: "expense", wallet_id: tpl.walletId, amount: tpl.amount, category_id: tpl.categoryId, local_date: today, note: tpl.note, merchant: tpl.merchant, source: "manual" });
    toast({ message: t("smart.quickSaved", { label: tpl.label }), tone: "success", action: { label: t("common.undo"), run: () => void repo.deleteTransaction(tx.id) } });
  };

  if (!ledger || wallets.length === 0) return null;
  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display flex items-center gap-2 text-[17px] font-semibold text-fg"><Zap size={16} className="text-brand" />{t("smart.quickTitle")}</h2>
        <span className="text-[12px] text-fg-3">{t("smart.quickHint")}</span>
      </div>
      {templates.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="eyebrow">{t("smart.quickFrequent")}</span>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => {
              const cat = ledger.categories.find((c) => c.id === tpl.categoryId);
              const wallet = wallets.find((w) => w.id === tpl.walletId);
              return (
                <button key={tpl.key} onClick={() => void saveTemplate(tpl)} className="group flex items-center gap-2 rounded-[12px] border border-line-strong bg-surface py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-brand-line hover:bg-surface-2">
                  <IconTile name={cat?.icon ?? "circle-dashed"} color={cat?.color ?? "#64748B"} size={28} />
                  <span className="flex flex-col leading-tight">
                    <span className="max-w-[140px] truncate text-[13px] font-semibold text-fg">{tpl.label}</span>
                    <span className="num text-[11.5px] text-fg-3">{wallet ? formatMoney(parseAmount(tpl.amount), wallet.currency, locale) : ""}</span>
                  </span>
                  <CircleCheck size={15} className="ml-1 text-fg-3 transition-colors group-hover:text-income" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <span className="eyebrow">{t("smart.quickCategories")}</span>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {cats.map((c) => (
            <button key={c.id} onClick={() => openQuickAdd({ type: "expense", categoryId: c.id })} className="flex flex-col items-center gap-1.5 rounded-[12px] px-1 py-2.5 text-center transition-colors hover:bg-surface-2">
              <IconTile name={c.icon} color={c.color} size={38} />
              <span className="w-full truncate text-[11.5px] font-medium text-fg-2">{categoryName(c)}</span>
            </button>
          ))}
        </div>
      </div>
      {templates.length === 0 && <p className="text-[12px] text-fg-3">{t("smart.quickEmpty")}</p>}
    </section>
  );
}

export function formatUnlocked(at: string, locale: Parameters<typeof formatDay>[1]) {
  return formatDay(at.slice(0, 10), locale, { year: true });
}
