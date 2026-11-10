"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Columns3, Compass } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Button, PageHeader } from "@/components/ui/primitives";
import { FinderSheet, StrategyCard } from "@/components/strategies/shared";
import { StrategyArt } from "@/components/strategies/art";
import { STRATEGIES, getStrategy, tl } from "@/lib/strategies";
import type { StrategySlug } from "@/lib/domain/types";

export default function StrategiesPage() {
  const { t, locale, extras } = useApp();
  const router = useRouter();
  const [selected, setSelected] = useState<StrategySlug[]>([]);
  const [finder, setFinder] = useState(false);
  const mine = extras.plans.filter((p) => p.status !== "archived");

  const toggle = (slug: StrategySlug) => setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : s.length >= 3 ? [...s.slice(1), slug] : [...s, slug]));

  return (
    <div className="flex flex-col gap-6 pb-16">
      <PageHeader title={t("strat.title")} description={t("strat.subtitle")} />

      <section className="brand-panel girih flex flex-col gap-5 overflow-hidden p-6 sm:flex-row sm:items-center sm:p-7">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-white/10 text-[#7AA7F7]"><Compass size={26} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="display text-[20px] font-semibold text-white">{t("strat.find")}</h2>
          <p className="mt-1 text-[13.5px] text-[#C3CFE8]">{t("strat.findHint")}</p>
        </div>
        <button onClick={() => setFinder(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-white px-5 text-[14px] font-semibold text-[#071330] transition-colors hover:bg-[#E9F0FD]">
          {t("strat.find")}
          <ArrowRight size={16} />
        </button>
      </section>

      {mine.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="display text-[18px] font-semibold text-fg">{t("strat.myStrategies")}</h2>
          <div className="flex flex-wrap gap-3">
            {mine.map((p) => {
              const s = getStrategy(p.strategy)!;
              return (
                <Link key={p.id} href={`/strategies/${p.strategy}`} className="card card-hover flex items-center gap-3 py-2 pl-2 pr-4">
                  <span className="overflow-hidden rounded-[10px] bg-[#071330]"><StrategyArt slug={s.slug} accent={s.accent} size={40} /></span>
                  <span className="flex flex-col">
                    <span className="text-[13.5px] font-semibold text-fg">{tl(s.name, locale)}</span>
                    <span className="text-[11.5px] text-fg-3">{p.status === "active" ? t("strat.active") : t("strat.paused")}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-[12.5px] text-fg-3">{t("strat.compareHint")}</p>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {STRATEGIES.map((s) => (
          <StrategyCard key={s.slug} s={s} selected={selected.includes(s.slug)} onToggle={() => toggle(s.slug)} />
        ))}
      </div>
      <p className="text-center text-[11.5px] text-fg-3">{t("strat.disclaimer")}</p>

      {selected.length > 0 && (
        <div className="fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl items-center gap-3 rounded-[16px] border border-line-strong bg-surface p-2.5 pl-4 shadow-[var(--shadow-lg)] md:bottom-6">
          <Columns3 size={17} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-fg">{t("strat.compareSelected", { n: selected.length })} · {selected.map((x) => tl(getStrategy(x)!.name, locale)).join(", ")}</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>{t("strat.compareClear")}</Button>
          <Button size="sm" variant="primary" disabled={selected.length < 2} onClick={() => router.push(`/strategies/compare?s=${selected.join(",")}`)}>{t("strat.compare")}</Button>
        </div>
      )}
      <FinderSheet open={finder} onClose={() => setFinder(false)} />
    </div>
  );
}
