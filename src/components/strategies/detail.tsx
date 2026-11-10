"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ExternalLink, TriangleAlert, X } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { Card, EmptyState, cn } from "../ui/primitives";
import { Rhomb } from "../brand/ornaments";
import { StrategyArt } from "./art";
import { LevelDots, PlanControls } from "./shared";
import { LIFE_STAGES, PROFESSIONS, getStrategy, tl } from "@/lib/strategies";
import type { ActionKey } from "@/lib/strategies/types";
import { formatMoney } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/translate";

const ACTION_HREF: Record<ActionKey, string> = {
  tool: "/goals",
  budgets: "/budgets",
  goals: "/goals",
  recurring: "/budgets",
  categories: "/settings",
  analytics: "/analytics",
  advisor: "/advisor",
  wallets: "/wallets",
  quick_income: "/?add=income",
};

export function StrategyDetail({ slug }: { slug: string }) {
  const { t, locale } = useApp();
  const s = getStrategy(slug);
  if (!s) return <Card><EmptyState title={t("strat.title")} body={t("strat.cmp.empty")} /></Card>;
  const L = (x: Parameters<typeof tl>[0]) => tl(x, locale);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/strategies" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-fg-3 hover:text-fg"><ArrowLeft size={15} />{t("strat.back")}</Link>

      <section className="brand-panel girih flex flex-col gap-6 overflow-hidden p-6 sm:flex-row sm:items-center sm:p-8">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A9B7D6]">{s.original}</span>
          <h1 className="display mt-2 text-[28px] font-semibold leading-tight text-white sm:text-[36px]">{L(s.name)}</h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-[#C3CFE8]">{L(s.summary)}</p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-[12.5px] text-[#C3CFE8]">
            {(["complexity", "discipline", "flexibility"] as const).map((k) => (
              <span key={k} className="flex items-center gap-2">{t(`strat.${k}`)} <LevelDots value={s[k]} label={t(`strat.${k}`)} /></span>
            ))}
          </div>
        </div>
        <StrategyArt slug={s.slug} accent={s.accent} size={150} className="shrink-0 self-center" />
      </section>

      {s.businessOnly && (
        <p className="flex items-start gap-2.5 rounded-[14px] bg-warning-soft p-4 text-[13.5px] font-medium text-warning"><TriangleAlert size={17} className="mt-0.5 shrink-0" />{t("strat.businessNotice")}</p>
      )}

      <div className="flex flex-wrap items-center gap-3"><PlanControls slug={s.slug} /></div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={t("strat.sec_overview")}>
          <p className="text-[14px] leading-relaxed text-fg-2">{L(s.overview)}</p>
          <h3 className="display mb-2 mt-5 text-[15px] font-semibold text-fg">{t("strat.sec_how")}</h3>
          <ol className="flex flex-col gap-2">
            {s.steps.map((x, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] text-fg"><span className="num flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-brand-soft text-[12px] font-semibold text-brand">{i + 1}</span>{L(x)}</li>
            ))}
          </ol>
          <h3 className="display mb-2 mt-5 text-[15px] font-semibold text-fg">{t("strat.sec_science")}</h3>
          <p className="text-[13.5px] leading-relaxed text-fg-2">{L(s.science)}</p>
        </Card>
        <Card title={t("strat.sec_history")}>
          <p className="eyebrow mb-1">{t(`strat.origin_${s.origin.certainty}` as TKey)}</p>
          <p className="mb-3 text-[14px] font-semibold text-fg">{L(s.origin.label)}</p>
          <p className="text-[13.5px] leading-relaxed text-fg-2">{L(s.origin.history)}</p>
          <h3 className="display mb-1.5 mt-4 text-[15px] font-semibold text-fg">{t("strat.sec_advocates")}</h3>
          <p className="text-[13.5px] leading-relaxed text-fg-2">{L(s.origin.advocates)}</p>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title={t("strat.sec_pros")}>
          <ul className="flex flex-col gap-2">{s.benefits.map((x, i) => <li key={i} className="flex gap-2 text-[13.5px] text-fg"><Check size={15} className="mt-0.5 shrink-0 text-income" strokeWidth={2.6} />{L(x)}</li>)}</ul>
        </Card>
        <Card title={t("strat.sec_cons")}>
          <ul className="flex flex-col gap-2">{s.drawbacks.map((x, i) => <li key={i} className="flex gap-2 text-[13.5px] text-fg"><X size={15} className="mt-0.5 shrink-0 text-expense" strokeWidth={2.6} />{L(x)}</li>)}</ul>
        </Card>
      </div>

      <Card title={t("strat.sec_who")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {s.professions.map((p) => (
            <li key={p.key} className="rounded-[12px] bg-surface-2 p-3.5">
              <p className="text-[13.5px] font-semibold text-fg">{L(PROFESSIONS[p.key])}</p>
              <p className="mt-1 text-[12.5px] leading-snug text-fg-2">{L(p.why)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>
            <p className="eyebrow mb-2">{t("strat.sec_situations")}</p>
            <ul className="flex flex-col gap-1.5">{s.situations.map((x, i) => <li key={i} className="flex gap-2 text-[13px] text-fg"><Rhomb size={6} className="mt-1.5 shrink-0 text-brand" />{L(x)}</li>)}</ul>
          </div>
          <div>
            <p className="eyebrow mb-2">{t("strat.stages")}</p>
            <div className="flex flex-wrap gap-1.5">{s.stages.map((x) => <span key={x} className="rounded-[7px] bg-brand-soft px-2 py-1 text-[12px] font-semibold text-brand">{L(LIFE_STAGES[x])}</span>)}</div>
            <p className="mt-2 text-[12.5px] text-fg-2">{L(s.stageNote)}</p>
            <p className="mt-1 text-[11.5px] text-fg-3">{t("strat.illustrative")}</p>
          </div>
        </div>
      </Card>

      <Card title={t("strat.sec_example")} subtitle={L(s.example.intro)}>
        <dl className="divide-y divide-line">
          {s.example.rows.map((r, i) => (
            <div key={i} className={cn("flex items-center justify-between gap-4 py-2.5 text-[13.5px]", r.emphasis && "font-semibold")}>
              <dt className={r.emphasis ? "text-fg" : "text-fg-2"}>{L(r.label)}</dt>
              <dd className={cn("num whitespace-nowrap", r.emphasis ? "text-brand" : "text-fg")}>{formatMoney(r.amount, "UZS", locale)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 rounded-[12px] bg-surface-2 p-3 text-[13px] text-fg-2">{L(s.example.outro)}</p>
      </Card>

      <Card title={t("strat.sec_implement")}>
        <ul className="flex flex-col gap-2">
          {s.implement.map((x, i) => (
            <li key={i}>
              <Link href={ACTION_HREF[x.action]} className="group flex items-start gap-3 rounded-[12px] p-2.5 transition-colors hover:bg-surface-2">
                <span className="num flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-brand-soft text-[12px] font-semibold text-brand">{i + 1}</span>
                <span className="flex-1 text-[13.5px] leading-snug text-fg">{L(x.text)}</span>
                <ArrowRight size={15} className="mt-1 text-fg-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t("strat.sec_refs")}>
        <ul className="flex flex-col gap-3">
          {s.references.map((r, i) => (
            <li key={i} className="text-[13px]">
              <p className="font-semibold text-fg">
                {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">{r.title}<ExternalLink size={12} /></a> : r.title}
              </p>
              <p className="text-fg-3">{r.author} · {r.year}</p>
              <p className="mt-0.5 text-fg-2"><span className="text-fg-3">{t("strat.supports")}:</span> {L(r.supports)}</p>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-center text-[11.5px] text-fg-3">{t("strat.disclaimer")}</p>
    </div>
  );
}
