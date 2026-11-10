"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Calculator, Cloud, HardDrive, Send, ShieldCheck, Sparkles, WifiOff } from "lucide-react";
import { KHATAM_PATH, Rhomb } from "@/components/brand/ornaments";
import { useApp } from "@/components/providers/app-provider";
import { Badge, cn } from "@/components/ui/primitives";
import { answerQuestion, buildAdvisorSummary, detectIntent, type AdvisorAnswer, type AdvisorFormatters, type AdvisorIntent } from "@/lib/ai/advisor";
import { cloudAdvisor } from "@/lib/ai/client";
import { formatDay, formatMoney, formatMonth, formatPercent } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/translate";

type Msg =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; offline: AdvisorAnswer; cloud?: string; note?: string; pending?: boolean };

const SUGGESTIONS: { intent: AdvisorIntent; key: TKey }[] = [
  { intent: "where", key: "advisor.suggestions.where" },
  { intent: "why", key: "advisor.suggestions.why" },
  { intent: "save", key: "advisor.suggestions.save" },
  { intent: "reduce", key: "advisor.suggestions.reduce" },
  { intent: "goal", key: "advisor.suggestions.goal" },
  { intent: "compare", key: "advisor.suggestions.compare" },
  { intent: "category", key: "assistant.q_category" },
  { intent: "top_increase", key: "assistant.q_top_increase" },
  { intent: "budget", key: "assistant.q_budget" },
  { intent: "improve", key: "assistant.q_improve" },
];

export default function AdvisorPage() {
  const { t, ledger, prefs, today, locale, categoryName } = useApp();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const base = prefs.base_currency;

  const fmt: AdvisorFormatters = useMemo(
    () => ({
      money: (c) => formatMoney(c, base, locale),
      moneyIn: (c, cur) => formatMoney(c, cur, locale),
      pct: (v, signed) => formatPercent(v, locale, { sign: signed }),
      category: (id) => categoryName(ledger?.categories.find((c) => c.id === id)),
      day: (d) => formatDay(d, locale),
      month: (k) => formatMonth(k, locale),
    }),
    [base, locale, categoryName, ledger],
  );

  useEffect(() => {
    // Block body on purpose: newer browsers return a Promise from scrollIntoView,
    // and an effect must not return anything but a cleanup function.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const ask = async (question: string, forced?: AdvisorIntent) => {
    if (!ledger || !question.trim()) return;
    const intent = forced ?? detectIntent(question);
    const offline = answerQuestion(intent, ledger, base, today, fmt, question);
    const uid = ++idRef.current;
    const aid = ++idRef.current;
    const useCloud = prefs.ai_cloud_enabled;
    setMsgs((m) => [...m, { id: uid, role: "user", text: question }, { id: aid, role: "assistant", offline, pending: useCloud }]);
    setInput("");
    if (!useCloud) return;
    try {
      const history = msgs
        .slice(-8)
        .map((m) => (m.role === "user" ? { role: "user" as const, content: m.text } : { role: "assistant" as const, content: m.cloud ?? "" }))
        .filter((m) => m.content);
      const summary = buildAdvisorSummary(ledger, base, today, (id) => categoryName(ledger.categories.find((c) => c.id === id)));
      const { answer } = await cloudAdvisor({ question, locale, summary, history });
      setMsgs((m) => m.map((x) => (x.id === aid && x.role === "assistant" ? { ...x, cloud: answer, pending: false } : x)));
    } catch {
      setMsgs((m) => m.map((x) => (x.id === aid && x.role === "assistant" ? { ...x, pending: false, note: t("advisor.cloudError") } : x)));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-7">
      <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5">
        <header className="flex animate-rise flex-wrap items-center gap-3.5">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-ai-strong text-white">
            <Sparkles size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="display text-[26px] font-semibold leading-none tracking-[-0.03em] text-fg sm:text-[32px]">{t("advisor.title")}</h1>
            <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-fg-3">
              <span className={cn("size-[7px] rounded-full", prefs.ai_cloud_enabled ? "bg-income" : "bg-fg-3")} />
              {prefs.ai_cloud_enabled ? t("advisor.cloudOn") : t("advisor.cloudOff")} · {t("advisor.subtitle")}
            </p>
          </div>
          <Link href="/settings#ai" className="text-[13px] font-semibold text-brand hover:text-brand-hi lg:hidden">{t("settings.ai")} →</Link>
        </header>

        <div className="flex flex-col gap-5" aria-live="polite">
          {msgs.length === 0 && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s.intent} onClick={() => void ask(t(s.key), s.intent)} className="card card-hover flex items-center gap-3 px-4 py-3.5 text-left text-[13.5px] font-medium text-fg-2 hover:text-fg">
                  <Rhomb size={7} className="shrink-0 text-ai" />
                  {t(s.key)}
                </button>
              ))}
            </div>
          )}
          {msgs.length > 0 && <DayDivider label={t("common.today")} />}
          {msgs.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="ml-auto max-w-[80%] rounded-[16px] rounded-br-[4px] bg-bubble px-4 py-3 text-[14px] leading-relaxed text-white">{m.text}</div>
            ) : (
              <AssistantBubble key={m.id} msg={m} onSuggest={(s) => void ask(t(s.key), s.intent)} />
            ),
          )}
          <div ref={endRef} />
        </div>

        {msgs.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
            {SUGGESTIONS.map((s) => (
              <button key={s.intent} onClick={() => void ask(t(s.key), s.intent)} className="h-8 shrink-0 rounded-full border border-line-strong bg-surface px-3 text-[12.5px] font-medium text-fg-2 hover:text-fg">
                {t(s.key)}
              </button>
            ))}
          </div>
        )}

        <form
          className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] flex items-center gap-2 rounded-[16px] border border-line-strong bg-surface p-2 pl-4 shadow-[0_10px_28px_-18px_rgba(10,20,48,0.45)] md:bottom-5"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
        >
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder={t("advisor.placeholder")} className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-3" aria-label={t("advisor.placeholder")} />
          <span className="num hidden h-[26px] items-center rounded-[7px] bg-surface-3 px-2 text-[11px] font-semibold uppercase text-fg-2 sm:inline-flex">{locale}</span>
          <button type="submit" disabled={!input.trim()} className="inline-flex size-10 items-center justify-center rounded-[11px] bg-brand-fill text-white transition-colors hover:bg-brand-hi disabled:opacity-40" aria-label={t("advisor.send")}>
            <Send size={16} />
          </button>
        </form>
        <p className="text-center text-[11.5px] text-fg-3">{t("advisor.disclaimer")}</p>
      </div>

      <aside className="hidden flex-col gap-5 lg:flex">
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="display text-[16px] font-semibold text-fg">{t("ishkor.advisorSees")}</h2>
          <Badge tone={prefs.ai_cloud_enabled ? "ai" : "neutral"} className="w-fit">
            {prefs.ai_cloud_enabled ? <Cloud size={11} /> : <HardDrive size={11} />}
            {prefs.ai_cloud_enabled ? t("advisor.cloudOn") : t("advisor.cloudOff")}
          </Badge>
          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-fg-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-income" />
            {prefs.ai_cloud_enabled ? t("advisor.cloudPrivacy") : t("ishkor.advisorSeesOffline")}
          </p>
          <Link href="/settings#ai" className="text-[13px] font-semibold text-brand hover:text-brand-hi">{t("settings.ai")} →</Link>
        </section>

        <section className="brand-panel girih flex flex-col gap-2 overflow-hidden p-5">
          <span className="flex items-center gap-2 text-[13px] font-semibold text-white"><WifiOff size={15} className="text-[#7AA7F7]" />{t("ishkor.offlineTitle")}</span>
          <p className="text-[12.5px] leading-relaxed text-[#C3CFE8]">{t("ishkor.offlineBody")}</p>
        </section>

        <section className="card flex flex-col gap-1 p-5">
          <h2 className="display mb-2 text-[16px] font-semibold text-fg">{t("ishkor.quickQuestions")}</h2>
          {SUGGESTIONS.map((s) => (
            <button key={s.intent} onClick={() => void ask(t(s.key), s.intent)} className="-mx-2 flex items-center gap-2.5 rounded-[10px] px-2 py-2 text-left text-[13px] font-medium text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg">
              <Rhomb size={6} className="shrink-0 text-ai" />
              {t(s.key)}
            </button>
          ))}
        </section>
      </aside>
    </div>
  );
}

/** Day divider: hairlines with a hoshiya-style trio of lozenges. */
function DayDivider({ label }: { label: string }) {
  const trio = (
    <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden>
      <path d="M5 0L10 5L5 10L0 5Z" fill="var(--border-strong)" />
      <path d="M17 0L22 5L17 10L12 5Z" fill="var(--brand)" />
      <path d="M29 0L34 5L29 10L24 5Z" fill="var(--border-strong)" />
    </svg>
  );
  return (
    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-3" role="separator">
      <span className="h-px flex-1 bg-line-strong" />
      {trio}
      {label}
      {trio}
      <span className="h-px flex-1 bg-line-strong" />
    </div>
  );
}

function AssistantBubble({ msg, onSuggest }: { msg: Extract<Msg, { role: "assistant" }>; onSuggest: (s: (typeof SUGGESTIONS)[number]) => void }) {
  const { t } = useApp();
  const a = msg.offline;
  const line = (l: { key: string; params?: Record<string, string | number> }, i: number) => <li key={i}>{t(l.key as TKey, l.params)}</li>;
  return (
    <div className="mr-auto flex max-w-[94%] gap-3">
      <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center text-ai">
        <svg width="32" height="31" viewBox="0 0 24 23" className="absolute inset-0" aria-hidden><path d={KHATAM_PATH} fill="var(--ai-soft)" stroke="currentColor" strokeWidth="1" /></svg>
        <Sparkles size={13} className="relative" />
      </span>
      <div className="card min-w-0 flex-1 px-4 py-3.5 text-[14px] leading-relaxed text-fg">
        {msg.cloud ? (
          <RichText text={msg.cloud} />
        ) : a.intent === null ? (
          <div>
            <p className="text-fg-2">{t("advisor.unknownQuestion")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s.intent} onClick={() => onSuggest(s)} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] text-fg-2 hover:text-fg">{t(s.key)}</button>
              ))}
            </div>
          </div>
        ) : a.noData ? (
          <p className="text-fg-2">{t("advisor.noData")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {a.facts.length > 0 && (
              <section>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-income">{t("advisor.facts")}</h3>
                <ul className="list-disc space-y-1 pl-4 marker:text-fg-3">{a.facts.map(line)}</ul>
              </section>
            )}
            {a.estimates.length > 0 && (
              <section>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-warning">{t("advisor.estimates")}</h3>
                <ul className="list-disc space-y-1 pl-4 marker:text-fg-3">{a.estimates.map(line)}</ul>
              </section>
            )}
            {a.method && (
              <p className="flex items-start gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-fg-2">
                <Calculator size={13} className="mt-0.5 shrink-0" />
                <span><b className="font-semibold">{t("advisor.method")}:</b> {t(a.method.key as TKey, a.method.params)}</span>
              </p>
            )}
          </div>
        )}
        {msg.pending && <p className="mt-2 animate-pulse text-[12px] text-ai">{t("advisor.thinking")}</p>}
        {msg.note && <p className="mt-2 text-[12px] text-warning">{msg.note}</p>}
      </div>
    </div>
  );
}

/** Minimal, safe markdown subset (paragraphs, bullets, **bold**) — rendered as React nodes, never HTML. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={i} className="font-semibold">{p.slice(2, -2)}</b> : <span key={i}>{p.replace(/^#+\s*/, "")}</span>));
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l)))
          return <ul key={i} className={cn("list-disc space-y-1 pl-4 marker:text-fg-3")}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>)}</ul>;
        return <p key={i}>{lines.map((l, j) => <span key={j}>{inline(l)}{j < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}
