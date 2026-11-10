"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Flame, Lightbulb } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { useIntelligence } from "@/components/providers/use-intelligence";
import { Badge, Card, cn, EmptyState, KhatamProgress, PageHeader, Progress, Skeleton } from "@/components/ui/primitives";
import { BadgeMedal, formatUnlocked, healthColor } from "@/components/intelligence/parts";
import { healthHistory } from "@/lib/domain/health";
import { formatDay, formatMonth } from "@/lib/i18n";
import { monthKey } from "@/lib/domain/dates";
import type { TKey } from "@/lib/i18n/translate";
import type { HealthFactorKey } from "@/lib/domain/health";

const TIP_LINK: Record<string, string> = {
  "health.tip.tracking": "/",
  "health.tip.budgets_create": "/budgets",
  "health.tip.budgets_pace": "/budgets",
  "health.tip.savings_contribute": "/goals",
  "health.tip.savings_goal": "/strategies/emergency-fund",
  "health.tip.stability": "/strategies/sinking-funds",
  "health.tip.planning_safety": "/strategies/emergency-fund",
  "health.tip.planning_strategy": "/strategies",
  "health.tip.planning_recurring": "/budgets",
};

export default function ProgressPage() {
  const { t, ledger, extras, prefs, today, locale } = useApp();
  const intel = useIntelligence();
  const history = useMemo(() => (ledger ? healthHistory(ledger, prefs.base_currency, today, { reviews: extras.reviews, plans: extras.plans }) : []), [ledger, extras, prefs.base_currency, today]);

  if (!ledger) return <Skeleton className="h-96" />;
  const h = intel.health;
  const unlocked = intel.badges.filter((b) => b.unlockedAt || b.earned).sort((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""));
  const locked = intel.badges.filter((b) => !(b.unlockedAt || b.earned)).sort((a, b) => b.current / b.target - a.current / a.target);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.progress")} description={t("health.habits")} />

      {!h ? (
        <Card><EmptyState icon={<CalendarCheck size={20} />} title={t("health.title")} body={t("health.reason.tracking_none")} /></Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <section className="brand-panel girih flex flex-col items-center gap-4 overflow-hidden p-7 text-center">
            <span className="text-[12.5px] font-semibold text-[#A9B7D6]">{t("health.title")}</span>
            <KhatamProgress value={h.score / 100} size={168} color={healthColor(h.band)} track="rgba(160,190,255,0.22)" strokeWidth={1.2} label={`${h.score}/100`}>
              <span className="num text-[44px] font-medium leading-none text-white">{h.score}</span>
              <span className="mt-1 text-[11.5px] text-[#A9B7D6]">{t("health.outOf")}</span>
            </KhatamProgress>
            <span className="display text-[22px] font-semibold text-white">{t(`health.band_${h.band}` as TKey)}</span>
            <div className="grid w-full grid-cols-2 gap-3 rounded-[14px] bg-white/[0.06] p-4 text-left">
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[11.5px] text-[#A9B7D6]"><Flame size={13} className="text-[#F2CF7E]" />{t("remind.streak", { n: intel.streak.current })}</span>
                <span className="num text-[15px] font-semibold text-white">{intel.streak.current} / {intel.streak.longest}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11.5px] text-[#A9B7D6]">{t("health.factor.tracking")}</span>
                <span className="num text-[15px] font-semibold text-white">{intel.streak.accounted30} / {intel.streak.window30}</span>
              </div>
            </div>
          </section>

          <Card title={t("health.details")} subtitle={t("health.habits")}>
            <ul className="flex flex-col gap-4">
              {h.factors.map((f) => (
                <li key={f.key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
                      {t(`health.factor.${f.key as HealthFactorKey}` as TKey)}
                      {f.limitedData && <Badge tone="neutral" glyph="rhomb">{t("health.limited")}</Badge>}
                    </span>
                    <span className="num text-[13.5px] font-semibold text-fg">{f.points} <span className="text-fg-3">/ 20</span></span>
                  </div>
                  <Progress value={f.points / 20} tone={f.points >= 15 ? "income" : f.points >= 8 ? "warning" : "expense"} label={t(`health.factor.${f.key}` as TKey)} />
                  <p className="text-[12.5px] text-fg-3">{t(f.reason.key as TKey, f.reason.params)}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {h && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title={t("health.recommendations")}>
            {h.factors.filter((f) => f.tip).length === 0 ? (
              <p className="text-[13px] text-fg-3">{t("answers.improve_none")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {h.factors.filter((f) => f.tip).sort((a, b) => a.points - b.points).map((f) => (
                  <li key={f.key}>
                    <Link href={TIP_LINK[f.tip!] ?? "/"} className="group flex items-start gap-3 rounded-[12px] p-2.5 transition-colors hover:bg-surface-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-ai-soft text-ai"><Lightbulb size={15} /></span>
                      <span className="flex-1 text-[13.5px] leading-snug text-fg">{t(f.tip as TKey)}</span>
                      <ArrowRight size={15} className="mt-1 text-fg-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t("health.history")}>
            <HistoryChart points={history} />
          </Card>
        </div>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-[18px] font-semibold text-fg">{t("badges.title")}</h2>
          <span className="num text-[13px] text-fg-3">{unlocked.length} / {intel.badges.length}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...unlocked, ...locked].map((b) => {
            const isUnlocked = !!(b.unlockedAt || b.earned);
            return (
              <div key={b.key} className={cn("card flex items-center gap-4 p-5", !isUnlocked && "bg-surface-2/60")}>
                <BadgeMedal badge={b} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-fg">{t(`badges.name.${b.key}` as TKey)}</p>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">{t(`badges.desc.${b.key}` as TKey)}</p>
                  {isUnlocked ? (
                    <p className="mt-2 text-[12px] font-semibold text-income">{b.unlockedAt ? t("badges.unlockedOn", { date: formatUnlocked(b.unlockedAt, locale) }) : t("badges.unlocked")}</p>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={b.current / b.target} className="h-1.5" label={t(`badges.name.${b.key}` as TKey)} />
                      <span className="num shrink-0 text-[11.5px] text-fg-3">{b.current}/{b.target}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <p className="text-center text-[11.5px] text-fg-3">{formatDay(today, locale, { year: true })} · {formatMonth(monthKey(today), locale)}</p>
    </div>
  );
}

function HistoryChart({ points }: { points: { date: string; score: number }[] }) {
  const { locale, t } = useApp();
  if (points.length < 2) return <p className="text-[13px] text-fg-3">{t("health.reason.stability_limited")}</p>;
  const X = (i: number) => 30 + (i * 350) / (points.length - 1);
  const Y = (v: number) => 150 - (v / 100) * 130;
  return (
    <svg role="img" aria-label={points.map((p) => `${p.date}: ${p.score}`).join(", ")} viewBox="0 0 400 180" width="100%">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <path d={`M30 ${Y(v)}H390`} stroke="var(--viz-grid)" />
          <text x="0" y={Y(v) + 4} fontSize="10.5" className="fill-fg-3">{v}</text>
        </g>
      ))}
      <polyline points={points.map((p, i) => `${X(i)},${Y(p.score)}`).join(" ")} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={X(i)} cy={Y(p.score)} r="4" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />
          <text x={X(i)} y={Y(p.score) - 9} textAnchor="middle" fontSize="10.5" fontWeight="600" fontFamily="var(--font-mono)" className="fill-fg">{p.score}</text>
          <text x={X(i)} y="172" textAnchor="middle" fontSize="10" className="fill-fg-3">{i === points.length - 1 ? t("common.today") : formatMonth(monthKey(p.date), locale, true)}</text>
        </g>
      ))}
    </svg>
  );
}
