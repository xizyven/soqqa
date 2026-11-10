"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { LevelDots } from "@/components/strategies/shared";
import { StrategyArt } from "@/components/strategies/art";
import { PROFESSIONS, getStrategy, tl, type StrategyContent } from "@/lib/strategies";

export default function ComparePage() {
  const { t, locale } = useApp();
  const [items] = useState<StrategyContent[]>(() => {
    const raw = typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("s") ?? "";
    return raw.split(",").map((s) => getStrategy(s)).filter((s): s is StrategyContent => !!s).slice(0, 3);
  });

  const rows: { label: string; render: (s: StrategyContent) => React.ReactNode }[] = [
    { label: t("strat.purpose"), render: (s) => <span className="text-fg">{tl(s.purpose, locale)}</span> },
    { label: t("strat.complexity"), render: (s) => <LevelDots value={s.complexity} label={t("strat.complexity")} /> },
    { label: t("strat.discipline"), render: (s) => <LevelDots value={s.discipline} label={t("strat.discipline")} /> },
    { label: t("strat.flexibility"), render: (s) => <LevelDots value={s.flexibility} label={t("strat.flexibility")} /> },
    { label: t("strat.bestFor"), render: (s) => <ul className="flex flex-col gap-1">{s.situations.map((x, i) => <li key={i}>{tl(x, locale)}</li>)}</ul> },
    { label: t("strat.sec_pros"), render: (s) => <ul className="flex flex-col gap-1">{s.benefits.map((x, i) => <li key={i} className="flex gap-1.5"><Check size={13} className="mt-0.5 shrink-0 text-income" />{tl(x, locale)}</li>)}</ul> },
    { label: t("strat.sec_cons"), render: (s) => <ul className="flex flex-col gap-1">{s.drawbacks.map((x, i) => <li key={i} className="flex gap-1.5"><X size={13} className="mt-0.5 shrink-0 text-expense" />{tl(x, locale)}</li>)}</ul> },
    { label: t("strat.suits"), render: (s) => s.professions.map((p) => tl(PROFESSIONS[p.key], locale)).join(", ") },
    { label: t("strat.stages"), render: (s) => <span className="num">{s.stages.join(" · ")}</span> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/strategies" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-fg-3 hover:text-fg"><ArrowLeft size={15} />{t("strat.back")}</Link>
      <PageHeader title={t("strat.cmp.title")} />
      {items.length < 2 ? (
        <Card><EmptyState title={t("strat.cmp.title")} body={t("strat.cmp.empty")} /></Card>
      ) : (
        <>
          {/* Phones: one card per strategy, attributes stacked */}
          <div className="grid gap-4 md:hidden">
            {items.map((s) => (
              <Card key={s.slug} title={tl(s.name, locale)}>
                <dl className="flex flex-col gap-3 text-[13px]">
                  {rows.map((r) => (
                    <div key={r.label}><dt className="eyebrow mb-1">{r.label}</dt><dd className="text-fg-2">{r.render(s)}</dd></div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
          {/* Desktop: side-by-side columns */}
          <div className="card hidden overflow-hidden md:block">
            <div className="grid" style={{ gridTemplateColumns: `180px repeat(${items.length}, minmax(0, 1fr))` }}>
              <div />
              {items.map((s) => (
                <Link key={s.slug} href={`/strategies/${s.slug}`} className="flex items-center gap-3 border-b border-l border-line bg-[#071330] p-4">
                  <StrategyArt slug={s.slug} accent={s.accent} size={48} />
                  <span className="display text-[16px] font-semibold text-white">{tl(s.name, locale)}</span>
                </Link>
              ))}
              {rows.map((r) => (
                <div key={r.label} className="contents">
                  <div className="border-b border-line p-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-3">{r.label}</div>
                  {items.map((s) => <div key={s.slug} className="border-b border-l border-line p-4 text-[13px] leading-relaxed text-fg-2">{r.render(s)}</div>)}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
