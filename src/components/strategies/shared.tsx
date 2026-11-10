"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Pause, Play, Plus, X } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { Badge, Button, cn } from "../ui/primitives";
import { Sheet } from "../ui/sheet";
import { Rhomb } from "../brand/ornaments";
import { StrategyArt } from "./art";
import { LEVEL, LIFE_STAGES, PROFESSIONS, STRATEGIES, getStrategy, tl, type StrategyContent } from "@/lib/strategies";
import { recommendStrategies, type FinderAnswers } from "@/lib/strategies/recommend";
import type { StrategyPlan, StrategySlug } from "@/lib/domain/types";
import { formatDay } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/translate";

export function usePlan(slug: StrategySlug): StrategyPlan | undefined {
  const { extras } = useApp();
  return extras.plans.find((p) => p.strategy === slug && p.status !== "archived");
}

/** Saves a plan's configuration (and status) for a strategy. */
export function useSavePlan() {
  const { repo, toast, t } = useApp();
  return async (slug: StrategySlug, configuration: Record<string, unknown>, status: StrategyPlan["status"] = "active", quiet = false) => {
    try {
      await repo.saveStrategyPlan({ strategy: slug, status, configuration });
      if (!quiet) toast({ message: t("strat.planSaved"), tone: "success" });
    } catch {
      toast({ message: t("errors.generic"), tone: "error" });
    }
  };
}

export function LevelDots({ value, label }: { value: 1 | 2 | 3; label: string }) {
  const { locale } = useApp();
  return (
    <span className="flex items-center gap-2" title={`${label}: ${tl(LEVEL[value], locale)}`}>
      <span className="flex gap-1" aria-hidden>
        {[1, 2, 3].map((i) => (
          <svg key={i} width="9" height="9" viewBox="0 0 10 10"><path d="M5 0L10 5L5 10L0 5Z" fill={i <= value ? "var(--brand)" : "var(--border-strong)"} /></svg>
        ))}
      </span>
      <span className="sr-only">{label}: {tl(LEVEL[value], locale)}</span>
    </span>
  );
}

export function StrategyCard({ s, selected, onToggle }: { s: StrategyContent; selected: boolean; onToggle: () => void }) {
  const { t, locale } = useApp();
  const plan = usePlan(s.slug);
  return (
    <article className={cn("card card-hover group flex flex-col overflow-hidden", selected && "ring-2 ring-brand")}>
      <div className="relative flex items-center justify-between gap-3 overflow-hidden bg-[#071330] px-5 pb-4 pt-5">
        <div className="relative z-10 flex min-w-0 flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#A9B7D6]">{s.original}</span>
          <h2 className="display text-[19px] font-semibold leading-tight text-white">{tl(s.name, locale)}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {plan && <span className="inline-flex h-[22px] items-center gap-1 rounded-[6px] bg-[rgba(60,203,156,0.16)] px-2 text-[11px] font-semibold text-[#5EE0B0]"><Check size={11} strokeWidth={3} />{plan.status === "active" ? t("strat.active") : t("strat.paused")}</span>}
            {s.businessOnly && <span className="inline-flex h-[22px] items-center rounded-[6px] bg-white/10 px-2 text-[11px] font-semibold text-[#F2CF7E]">{tl(PROFESSIONS.small_business, locale)}</span>}
          </div>
        </div>
        <StrategyArt slug={s.slug} accent={s.accent} size={86} className="shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5" />
      </div>
      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <p className="text-[13.5px] leading-relaxed text-fg-2">{tl(s.summary, locale)}</p>
        <ul className="flex flex-col gap-1.5 text-[13px]">
          {s.benefits.slice(0, 2).map((b, i) => (
            <li key={i} className="flex gap-2 text-fg"><Check size={14} className="mt-0.5 shrink-0 text-income" strokeWidth={2.6} />{tl(b, locale)}</li>
          ))}
          <li className="flex gap-2 text-fg-2"><X size={14} className="mt-0.5 shrink-0 text-expense" strokeWidth={2.6} />{tl(s.drawbacks[0], locale)}</li>
        </ul>
        <dl className="grid gap-2 border-t border-line pt-3 text-[12px]">
          <div className="flex gap-2"><dt className="w-[92px] shrink-0 text-fg-3">{t("strat.suits")}</dt><dd className="text-fg">{s.professions.slice(0, 3).map((p) => tl(PROFESSIONS[p.key], locale)).join(", ")}</dd></div>
          <div className="flex gap-2"><dt className="w-[92px] shrink-0 text-fg-3">{t("strat.stages")}</dt><dd className="num text-fg">{s.stages.join(" · ")}</dd></div>
          <div className="flex gap-2"><dt className="w-[92px] shrink-0 text-fg-3">{t(`strat.origin_${s.origin.certainty}` as TKey)}</dt><dd className="text-fg">{tl(s.origin.label, locale)}</dd></div>
        </dl>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link href={`/strategies/${s.slug}`} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[11px] bg-brand-fill text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-hi">
            {t("strat.explore")}
            <ArrowRight size={15} />
          </Link>
          <button onClick={onToggle} aria-pressed={selected} className={cn("inline-flex h-10 items-center gap-1.5 rounded-[11px] border px-3 text-[12.5px] font-semibold transition-colors", selected ? "border-brand bg-brand-soft text-brand" : "border-line-strong text-fg-2 hover:text-fg")}>
            {selected ? <Check size={14} /> : <Plus size={14} />}
            {t("strat.compare")}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Activate / pause / remove controls for a strategy plan. */
export function PlanControls({ slug, configuration }: { slug: StrategySlug; configuration?: Record<string, unknown> }) {
  const { t, locale } = useApp();
  const plan = usePlan(slug);
  const save = useSavePlan();
  if (!plan)
    return (
      <Button variant="primary" icon={<Play size={15} />} onClick={() => void save(slug, configuration ?? {})}>
        {t("strat.activate")}
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={plan.status === "active" ? "income" : "neutral"} glyph="star">
        {plan.status === "active" ? t("strat.activeSince", { date: formatDay(plan.selected_at.slice(0, 10), locale) }) : t("strat.paused")}
      </Badge>
      <Button size="sm" variant="secondary" icon={plan.status === "active" ? <Pause size={13} /> : <Play size={13} />} onClick={() => void save(slug, plan.configuration, plan.status === "active" ? "paused" : "active")}>
        {plan.status === "active" ? t("strat.pause") : t("strat.resume")}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => void save(slug, plan.configuration, "archived")}>{t("strat.stop")}</Button>
    </div>
  );
}

const QUESTIONS: { key: keyof FinderAnswers; options: string[] }[] = [
  { key: "income", options: ["regular", "irregular", "business"] },
  { key: "goal", options: ["control", "save", "debt", "safety", "purchase", "business"] },
  { key: "style", options: ["simple", "detailed", "reflective"] },
  { key: "debt", options: ["none", "some", "heavy"] },
  { key: "reserve", options: ["none", "partial", "full"] },
  { key: "raise", options: ["yes", "no"] },
];

export function FinderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useApp();
  const [answers, setAnswers] = useState<Partial<FinderAnswers>>({});
  const complete = QUESTIONS.every((q) => answers[q.key]);
  const results = complete ? recommendStrategies(answers as FinderAnswers) : [];
  return (
    <Sheet open={open} onClose={onClose} title={t("strat.finder.title")} width={560}>
      <div className="flex flex-col gap-5">
        <p className="text-[12.5px] text-fg-3">{t("strat.finder.intro")}</p>
        {QUESTIONS.map((q, qi) => (
          <fieldset key={q.key} className="flex flex-col gap-2">
            <legend className="mb-2 text-[14px] font-semibold text-fg"><span className="num mr-2 text-fg-3">{qi + 1}.</span>{t(`strat.finder.q_${q.key}` as TKey)}</legend>
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => {
                const on = answers[q.key] === o;
                return (
                  <button key={o} onClick={() => setAnswers((a) => ({ ...a, [q.key]: o }))} aria-pressed={on} className={cn("h-9 rounded-[10px] px-3 text-[13px] font-semibold transition-colors", on ? "bg-brand-fill text-white" : "border border-line-strong bg-surface text-fg-2 hover:text-fg")}>
                    {t(`strat.finder.o_${q.key}_${o}` as TKey)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        {complete && (
          <section className="flex flex-col gap-3 border-t border-line pt-5">
            <h3 className="display text-[17px] font-semibold text-fg">{t("strat.finder.result")}</h3>
            {results.map((r, i) => {
              const s = getStrategy(r.slug)!;
              return (
                <Link key={r.slug} href={`/strategies/${r.slug}`} onClick={onClose} className="card card-hover flex items-start gap-3 p-4">
                  <span className="num flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-soft text-[13px] font-semibold text-brand">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-fg">{tl(s.name, locale)}</span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-fg-2">
                      {r.reasons.map((x) => <span key={x} className="inline-flex items-center gap-1.5"><Rhomb size={5} className="text-brand" />{t(`strat.finder.reason.${x}` as TKey)}</span>)}
                    </span>
                  </span>
                  <ArrowRight size={16} className="mt-1 text-fg-3" />
                </Link>
              );
            })}
            <p className="text-[12px] text-fg-3">{t("strat.finder.disclaimer")}</p>
            <Button variant="ghost" onClick={() => setAnswers({})} className="self-start">{t("strat.finder.retake")}</Button>
          </section>
        )}
      </div>
    </Sheet>
  );
}

export function stageLabels(s: StrategyContent, locale: Parameters<typeof tl>[1]) {
  return s.stages.map((x) => tl(LIFE_STAGES[x], locale));
}

export { STRATEGIES };
