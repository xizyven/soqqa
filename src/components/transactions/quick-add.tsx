"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, Check, ChevronDown, Delete, Sparkles, Wand2 } from "lucide-react";
import { useApp, type QuickAddState } from "../providers/app-provider";
import { Sheet } from "../ui/sheet";
import { Button, cn, Field, Input, Segmented } from "../ui/primitives";
import { IconTile } from "../ui/icon";
import { Money } from "../ui/money";
import { addDays } from "@/lib/domain/dates";
import { walletBalances } from "@/lib/domain/ledger";
import { RateBook } from "@/lib/domain/rates";
import { refundableAmount } from "@/lib/domain/transactions";
import type { Category, Ledger, Transaction, TransactionType, Wallet } from "@/lib/domain/types";
import { smartDefaults } from "@/lib/domain/smart";
import { evaluateExpression, hasOperator, pressKey } from "@/lib/money/expression";
import { parseAmount, toAmountString } from "@/lib/money/money";
import { formatDay, formatMoney } from "@/lib/i18n";
import { errorMessage, fieldError } from "@/lib/i18n/translate";
import { ValidationError } from "@/lib/data/repo";
import { parseTransactionText, type ParsedTransaction } from "@/lib/ai/parser";
import { cloudParse } from "@/lib/ai/client";

type FormType = "expense" | "income" | "transfer" | "refund";

interface FormState {
  type: FormType;
  expr: string;
  walletId: string | null;
  toWalletId: string | null;
  toAmount: string;
  categoryId: string | null;
  date: string;
  note: string;
  merchant: string;
  relatedId: string | null;
  source: Transaction["source"];
}

export function QuickAdd() {
  const { quickAdd, closeQuickAdd, t } = useApp();
  return (
    <Sheet open={quickAdd.open} onClose={closeQuickAdd} title={quickAdd.editId ? t("tx.edit") : t("quick.title")} width={560} accent={quickAdd.ai ? "ai" : undefined} labelledBy="quick-add-title">
      <QuickAddForm key={quickAdd.nonce} />
    </Sheet>
  );
}

function initialForm(quickAdd: QuickAddState, ledger: Ledger | undefined, today: string, wallets: Wallet[]): { form: FormState; details: boolean } {
  const editing = quickAdd.editId ? ledger?.transactions.find((x) => x.id === quickAdd.editId) : undefined;
  if (editing) {
    return {
      form: {
        type: editing.type === "reversal" ? "refund" : (editing.type as FormType),
        expr: trimAmount(editing.amount),
        walletId: editing.wallet_id,
        toWalletId: editing.to_wallet_id,
        toAmount: editing.to_amount ? trimAmount(editing.to_amount) : "",
        categoryId: editing.category_id,
        date: editing.local_date,
        note: editing.note,
        merchant: editing.merchant,
        relatedId: editing.related_id,
        source: editing.source,
      },
      details: !!(editing.note || editing.merchant),
    };
  }
  const orig = quickAdd.relatedId ? ledger?.transactions.find((x) => x.id === quickAdd.relatedId) : undefined;
  if (orig && ledger) {
    const left = refundableAmount(orig, ledger.transactions);
    return { form: { ...emptyForm(today), type: "refund", expr: trimAmount(toAmountString(left)), walletId: orig.wallet_id, categoryId: orig.category_id, relatedId: orig.id, merchant: orig.merchant }, details: false };
  }
  const type = (quickAdd.type as FormType) ?? "expense";
  const d = ledger ? smartDefaults(ledger, type === "income" ? "income" : "expense", today) : { walletId: null };
  return { form: { ...emptyForm(today), type, walletId: quickAdd.walletId ?? d.walletId ?? wallets[0]?.id ?? null, categoryId: quickAdd.categoryId ?? null, date: quickAdd.date ?? today }, details: false };
}

function QuickAddForm() {
  const { quickAdd, closeQuickAdd, t, ledger, repo, today, categoryName, toast, locale } = useApp();
  const wallets = useMemo(() => (ledger?.wallets ?? []).filter((w) => !w.archived).sort((a, b) => a.sort - b.sort), [ledger]);
  const [init] = useState(() => initialForm(quickAdd, ledger, today, wallets));
  const [tab, setTab] = useState<"manual" | "ai">(quickAdd.ai ? "ai" : "manual");
  const [form, setForm] = useState<FormState>(init.form);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const [showDetails, setShowDetails] = useState(init.details);
  const [aiBanner, setAiBanner] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const smart = useMemo(
    () => (ledger ? { income: smartDefaults(ledger, "income", today).categoryIds, expense: smartDefaults(ledger, "expense", today).categoryIds } : { income: [], expense: [] }),
    [ledger, today],
  );

  const balances = useMemo(() => (ledger ? walletBalances(ledger) : new Map<string, bigint>()), [ledger]);
  const editing = quickAdd.editId ? ledger?.transactions.find((x) => x.id === quickAdd.editId) : undefined;
  const related = form.relatedId ? ledger?.transactions.find((x) => x.id === form.relatedId) : undefined;

  const wallet = wallets.find((w) => w.id === form.walletId) ?? (editing ? ledger?.wallets.find((w) => w.id === editing.wallet_id) : undefined);
  const toWallet = wallets.find((w) => w.id === form.toWalletId);
  const currency = wallet?.currency ?? "UZS";
  const evaluated = evaluateExpression(form.expr);

  const categories = useMemo(() => {
    const kind = form.type === "income" ? "income" : "expense";
    const list = (ledger?.categories ?? []).filter((c) => c.kind === kind && !c.archived);
    const order = kind === "income" ? smart.income : smart.expense;
    return [...list].sort((a, b) => {
      const ia = order.indexOf(a.id);
      const ib = order.indexOf(b.id);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      return a.sort - b.sort;
    });
  }, [ledger, form.type, smart]);

  const crossCurrency = form.type === "transfer" && wallet && toWallet && wallet.currency !== toWallet.currency;
  const suggestedToAmount = useMemo(() => {
    if (!crossCurrency || !evaluated || evaluated <= 0n || !ledger) return null;
    try {
      return new RateBook(ledger.rates).convert(evaluated, wallet!.currency, toWallet!.currency, form.date);
    } catch {
      return null;
    }
  }, [crossCurrency, evaluated, ledger, wallet, toWallet, form.date]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useCallback(
    async (again: boolean) => {
      setErrors({});
      const amount = evaluateExpression(form.expr);
      if (!amount || amount <= 0n) {
        setErrors({ amount: "invalid_amount" });
        amountRef.current?.focus();
        return;
      }
      setSaving(true);
      try {
        const type: TransactionType = form.type === "refund" ? (editing?.type === "reversal" ? "reversal" : "refund") : form.type;
        await repo.saveTransaction(
          {
            type,
            wallet_id: form.walletId ?? "",
            amount: toAmountString(amount),
            category_id: form.type === "transfer" ? null : form.categoryId,
            local_date: form.date,
            note: form.note,
            merchant: form.merchant,
            to_wallet_id: form.type === "transfer" ? form.toWalletId : null,
            to_amount: crossCurrency ? (form.toAmount ? toAmountString(parseAmount(form.toAmount)) : null) : null,
            related_id: form.relatedId,
            source: form.source,
          },
          editing?.id,
        );
        toast({ message: t("tx.saved"), tone: "success" });
        if (again) {
          setForm((f) => ({ ...f, expr: "", note: "", merchant: "", source: "manual" }));
          setAiBanner(false);
          amountRef.current?.focus();
        } else closeQuickAdd();
      } catch (e) {
        if (e instanceof ValidationError) setErrors(e.issues);
        else toast({ message: errorMessage(e, t), tone: "error" });
      } finally {
        setSaving(false);
      }
    },
    [form, repo, editing, crossCurrency, toast, t, closeQuickAdd],
  );

  const applyDraft = (p: ParsedTransaction) => {
    const cat = p.categoryKey ? ledger?.categories.find((c) => c.system_key === p.categoryKey && c.kind === p.type) : undefined;
    let walletId = p.walletId ?? form.walletId ?? wallets[0]?.id ?? null;
    if (p.currency && !p.walletId) walletId = wallets.find((w) => w.currency === p.currency)?.id ?? walletId;
    setForm({
      ...emptyForm(today),
      type: p.type,
      expr: p.amount ? trimAmount(p.amount) : "",
      walletId,
      categoryId: cat?.id ?? null,
      date: p.date,
      note: p.note,
      merchant: p.merchant,
      source: "ai",
    });
    setShowDetails(true);
    setAiBanner(true);
    setTab("manual");
  };

  const typeTone = form.type === "income" ? "text-income" : form.type === "expense" ? "text-expense" : form.type === "refund" ? "text-income" : "text-accent";

  return (
    <>
      {wallets.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-fg-2">{t("quick.needWallet")}</p>
          <Link href="/wallets?new=1" onClick={closeQuickAdd} className="mt-4 inline-flex h-10 items-center rounded-[10px] bg-brand-fill px-4 text-sm font-semibold text-white">
            {t("quick.createWallet")}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!editing && !related && (
            <div className="flex items-center gap-2">
              <Segmented
                className="flex-1"
                value={tab === "ai" ? ("ai" as string) : form.type}
                onChange={(v) => {
                  if (v === "ai") setTab("ai");
                  else {
                    setTab("manual");
                    setForm((f) => ({ ...f, type: v as FormType, categoryId: null, toWalletId: v === "transfer" ? f.toWalletId : null }));
                  }
                }}
                options={[
                  { value: "expense", label: t("tx.types.expense"), tone: "expense" },
                  { value: "income", label: t("tx.types.income"), tone: "income" },
                  { value: "transfer", label: t("tx.types.transfer"), tone: "accent" },
                  { value: "ai", label: <span className="inline-flex items-center gap-1"><Sparkles size={13} />AI</span>, tone: "ai" },
                ]}
              />
            </div>
          )}

          {tab === "ai" ? (
            <AiEntry onDraft={applyDraft} />
          ) : (
            <>
              {aiBanner && (
                <div className="flex items-start gap-2 rounded-xl border border-ai/25 bg-ai-soft px-3 py-2.5 text-[13px] text-fg">
                  <Wand2 size={15} className="mt-0.5 shrink-0 text-ai" />
                  <span>
                    <b className="font-semibold">{t("ai.preview")}.</b> <span className="text-fg-2">{t("ai.previewHint")}</span>
                  </span>
                </div>
              )}
              {related && (
                <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[13px]">
                  <span className="text-fg-3">{t("tx.original")}: </span>
                  <span className="text-fg">{related.merchant || related.note || categoryName(ledger?.categories.find((c) => c.id === related.category_id))}</span>
                  <span className="text-fg-3"> · </span>
                  <Money value={parseAmount(related.amount)} currency={related.currency} />
                </div>
              )}

              {/* Amount */}
              <div className="rounded-2xl border border-line bg-surface-2 px-4 pb-3 pt-3">
                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">
                  <span>{form.type === "refund" ? t("tx.types.refund") : t("common.amount")}</span>
                  <span>{currency}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={cn("num text-2xl font-semibold", typeTone)}>{form.type === "income" || form.type === "refund" ? "+" : form.type === "expense" ? "−" : ""}</span>
                  <input
                    ref={amountRef}
                    data-autofocus
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={t("common.amount")}
                    aria-invalid={!!errors.amount}
                    value={displayExpr(form.expr, locale)}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[\s ]/g, "").replace(/,/g, ".").replace(/-/g, "−");
                      if (/^[\d.+−]*$/.test(raw)) set("expr", raw);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void save(e.shiftKey);
                      }
                    }}
                    className="num w-full min-w-0 bg-transparent text-[34px] font-semibold leading-tight tracking-[-0.03em] text-fg outline-none placeholder:text-fg-3 sm:text-[40px]"
                  />
                </div>
                {hasOperator(form.expr) && evaluated !== null && (
                  <div className="num mt-0.5 text-sm text-fg-2">= {formatMoney(evaluated, currency, locale)}</div>
                )}
                {errors.amount && <p className="mt-1 text-[12px] text-expense">{fieldError(errors.amount, t)}</p>}
                <Keypad onKey={(k) => set("expr", pressKey(form.expr, k, currency === "UZS" ? 2 : 2))} />
              </div>

              {/* Wallet(s) */}
              <Field label={form.type === "transfer" ? t("tx.fromWallet") : t("common.wallet")} error={fieldError(errors.wallet_id, t)}>
                <WalletPicker wallets={wallets} balances={balances} value={form.walletId} onChange={(id) => set("walletId", id)} disabled={!!related} exclude={null} />
              </Field>
              {form.type === "transfer" && (
                <>
                  <div className="-my-2 flex justify-center text-fg-3"><ArrowDown size={16} /></div>
                  <Field label={t("tx.toWallet")} error={fieldError(errors.to_wallet_id, t)}>
                    <WalletPicker wallets={wallets} balances={balances} value={form.toWalletId} onChange={(id) => set("toWalletId", id)} exclude={form.walletId} />
                  </Field>
                  {crossCurrency && (
                    <Field
                      label={`${t("tx.receivedAmount")} (${toWallet!.currency})`}
                      hint={suggestedToAmount !== null ? `≈ ${formatMoney(suggestedToAmount, toWallet!.currency, locale)} · ${t("common.estimate")}` : t("errors.missing_rate", { currency: toWallet!.currency })}
                    >
                      <Input inputMode="decimal" value={form.toAmount} placeholder={suggestedToAmount !== null ? toAmountString(suggestedToAmount) : ""} onChange={(e) => set("toAmount", e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))} className="num" />
                    </Field>
                  )}
                  <p className="-mt-1 text-[12px] text-fg-3">{t("tx.excludedNote")}</p>
                </>
              )}

              {/* Category */}
              {form.type !== "transfer" && !related && (
                <Field label={t("common.category")} error={fieldError(errors.category_id, t)}>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {(showAllCats ? categories : categories.slice(0, 7)).map((c) => (
                      <CategoryChip key={c.id} c={c} name={categoryName(c)} active={form.categoryId === c.id} onClick={() => set("categoryId", c.id)} />
                    ))}
                    {!showAllCats && categories.length > 7 && (
                      <button onClick={() => setShowAllCats(true)} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong py-2 text-[11px] text-fg-3 hover:text-fg">
                        <ChevronDown size={16} />
                        {t("quick.moreCategories")}
                      </button>
                    )}
                  </div>
                </Field>
              )}

              {/* Date */}
              <Field label={t("common.date")} error={fieldError(errors.local_date, t)}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { d: today, l: t("common.today") },
                    { d: addDays(today, -1), l: t("common.yesterday") },
                  ].map((o) => (
                    <button key={o.d} onClick={() => set("date", o.d)} className={cn("h-9 rounded-[9px] border px-3 text-[13px] font-medium", form.date === o.d ? "border-accent bg-accent-soft text-fg" : "border-line bg-surface-2 text-fg-2")}>
                      {o.l}
                    </button>
                  ))}
                  <input
                    type="date"
                    value={form.date}
                    max={addDays(today, 366)}
                    onChange={(e) => e.target.value && set("date", e.target.value)}
                    aria-label={t("quick.pickDate")}
                    className={cn("h-9 rounded-[9px] border bg-surface-2 px-2.5 text-[13px] text-fg outline-none", form.date !== today && form.date !== addDays(today, -1) ? "border-accent" : "border-line")}
                  />
                </div>
              </Field>

              {/* Details */}
              {showDetails ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={`${t("common.note")} · ${t("common.optional")}`}>
                    <Input value={form.note} maxLength={500} onChange={(e) => set("note", e.target.value)} placeholder={t("quick.notePlaceholder")} />
                  </Field>
                  {form.type !== "transfer" && (
                    <Field label={`${t("tx.merchant")} · ${t("common.optional")}`}>
                      <Input value={form.merchant} maxLength={120} onChange={(e) => set("merchant", e.target.value)} placeholder={t("quick.merchantPlaceholder")} />
                    </Field>
                  )}
                </div>
              ) : (
                <button onClick={() => setShowDetails(true)} className="-mt-1 self-start text-[13px] font-medium text-accent hover:underline">
                  + {t("common.note")} / {t("tx.merchant")}
                </button>
              )}

              <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-line bg-surface px-5 py-3">
                {!editing && (
                  <Button variant="secondary" className="flex-1" onClick={() => void save(true)} disabled={saving}>
                    {t("quick.saveAnother")}
                  </Button>
                )}
                <Button variant={form.type === "income" || form.type === "refund" ? "income" : "primary"} className="flex-1" loading={saving} onClick={() => void save(false)} icon={<Check size={16} />}>
                  {t("quick.save")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

function emptyForm(today: string): FormState {
  return { type: "expense", expr: "", walletId: null, toWalletId: null, toAmount: "", categoryId: null, date: today, note: "", merchant: "", relatedId: null, source: "manual" };
}

function trimAmount(a: string): string {
  return a.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

/** Groups digits of each operand for readability while typing. */
function displayExpr(expr: string, locale: string): string {
  const sep = locale === "en" ? "," : " ";
  return expr.replace(/\d+(?=\.|$|[+−])/g, (m, offset: number) => {
    const prev = expr[offset - 1];
    if (prev === ".") return m; // decimals
    return m.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  });
}

function Keypad({ onKey }: { onKey: (k: string) => void }) {
  const keys = ["1", "2", "3", "+", "4", "5", "6", "−", "7", "8", "9", "back", "000", "0", ".", "clear"];
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5 md:hidden">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onKey(k)}
          aria-label={k === "back" ? "Backspace" : k === "clear" ? "Clear" : k}
          className={cn(
            "num flex h-12 items-center justify-center rounded-xl text-lg font-medium transition active:scale-95",
            k === "+" || k === "−" ? "bg-accent-soft text-accent" : k === "back" || k === "clear" ? "bg-surface-3 text-fg-2" : "bg-surface text-fg",
          )}
        >
          {k === "back" ? <Delete size={18} /> : k === "clear" ? "C" : k}
        </button>
      ))}
    </div>
  );
}

function WalletPicker({ wallets, balances, value, onChange, exclude, disabled }: { wallets: Wallet[]; balances: Map<string, bigint>; value: string | null; onChange: (id: string) => void; exclude: string | null; disabled?: boolean }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {wallets
        .filter((w) => w.id !== exclude)
        .map((w) => (
          <button
            key={w.id}
            disabled={disabled && w.id !== value}
            onClick={() => onChange(w.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-left transition disabled:opacity-40",
              value === w.id ? "border-accent bg-accent-soft" : "border-line bg-surface-2 hover:border-line-strong",
            )}
          >
            <IconTile name={w.icon} color={w.color} size={30} />
            <span className="flex flex-col">
              <span className="max-w-[130px] truncate text-[13px] font-medium text-fg">{w.name}</span>
              <Money value={balances.get(w.id) ?? 0n} currency={w.currency} className="text-[11px] text-fg-3" />
            </span>
          </button>
        ))}
    </div>
  );
}

function CategoryChip({ c, name, active, onClick }: { c: Category; name: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn("flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 transition", active ? "border-accent bg-accent-soft" : "border-transparent hover:bg-surface-2")}
    >
      <IconTile name={c.icon} color={c.color} size={34} />
      <span className="w-full truncate text-center text-[11px] font-medium text-fg-2">{name}</span>
    </button>
  );
}

function AiEntry({ onDraft }: { onDraft: (p: ParsedTransaction) => void }) {
  const { t, ledger, today, prefs, locale, categoryName } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ParsedTransaction | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const wallets = (ledger?.wallets ?? []).filter((w) => !w.archived);
  const examples = locale === "ru" ? ["Вчера потратил 150 тысяч сум на такси", "Получил зарплату 7,5 млн"] : locale === "en" ? ["Received $500 from freelance work", "Lunch 45k cash today"] : ["Bugun tushlikka 45 ming so'm sarfladim, naqd puldan", "Kecha 200 dollar oylik oldim"];

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setNote(null);
    const pw = wallets.map((w) => ({ id: w.id, name: w.name, currency: w.currency, icon: w.icon }));
    let parsed = parseTransactionText(text, { today, wallets: pw });
    if (prefs.ai_cloud_enabled) {
      try {
        const cats = (ledger?.categories ?? []).filter((c) => c.system_key).map((c) => ({ key: c.system_key!, name: categoryName(c), kind: c.kind }));
        const { draft } = await cloudParse({ text, locale, today, categories: cats, wallets: pw });
        parsed = {
          ...parsed,
          amount: draft.amount ?? parsed.amount,
          currency: draft.currency ?? parsed.currency,
          type: draft.type ?? parsed.type,
          categoryKey: draft.categoryKey ?? parsed.categoryKey,
          walletId: draft.walletId && pw.some((w) => w.id === draft.walletId) ? draft.walletId : parsed.walletId,
          date: draft.date ?? parsed.date,
          merchant: draft.merchant ?? parsed.merchant,
          source: "cloud",
        };
      } catch {
        setNote(t("ai.cloudUnavailable"));
      }
    }
    setResult(parsed);
    setBusy(false);
  };

  const cat = result?.categoryKey ? ledger?.categories.find((c) => c.system_key === result.categoryKey && c.kind === result.type) : undefined;
  const wallet = result?.walletId ? wallets.find((w) => w.id === result.walletId) : undefined;
  const row = (label: string, value: React.ReactNode, ok: boolean | null) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[13px] text-fg-3">{label}</span>
      <span className="flex min-w-0 items-center gap-2 text-right text-[13px] font-medium text-fg">
        <span className="truncate">{value}</span>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", ok === true ? "bg-income-soft text-income" : ok === false ? "bg-warning-soft text-warning" : "bg-surface-3 text-fg-3")}>
          {ok === true ? t("ai.recognized") : ok === false ? t("ai.guessed") : t("ai.notFound")}
        </span>
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-ai/30 bg-ai-soft p-1 focus-within:border-ai/60">
        <textarea
          data-autofocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void run();
            }
          }}
          rows={3}
          maxLength={300}
          placeholder={t("ai.inputPlaceholder")}
          className="w-full resize-none rounded-xl bg-surface px-3 py-2.5 text-[15px] text-fg outline-none placeholder:text-fg-3"
        />
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-ai">
            <Sparkles size={12} />
            {prefs.ai_cloud_enabled ? t("ai.cloud") : t("ai.offline")}
          </span>
          <Button size="sm" variant="ai" loading={busy} onClick={() => void run()} disabled={!text.trim()}>
            {busy ? t("ai.parsing") : t("ai.parse")}
          </Button>
        </div>
      </div>
      {!result && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">{t("ai.examples")}</p>
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button key={ex} onClick={() => setText(ex)} className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-left text-[12.5px] text-fg-2 hover:text-fg">
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
      {note && <p className="text-[12px] text-warning">{note}</p>}
      {result && (
        <div className="rounded-2xl border border-line bg-surface-2 px-4 py-2">
          <div className="divide-y divide-line">
            {row(t("common.type"), t(`tx.types.${result.type}`), result.recognized.type || result.source === "cloud" ? true : false)}
            {row(t("common.amount"), result.amount ? <span className="num">{formatMoney(parseAmount(result.amount), result.currency ?? wallet?.currency ?? "UZS", locale)}</span> : "—", result.amount ? true : null)}
            {row(t("common.category"), cat ? categoryName(cat) : "—", cat ? (result.recognized.category || result.source === "cloud" ? true : false) : null)}
            {row(t("common.wallet"), wallet?.name ?? "—", wallet ? (result.recognized.wallet ? true : false) : null)}
            {row(t("common.date"), formatDay(result.date, locale, { weekday: true }), result.recognized.date ? true : false)}
            {result.merchant && row(t("tx.merchant"), result.merchant, true)}
          </div>
          {!result.amount && <p className="py-2 text-[12px] text-warning">{t("ai.noAmount")}</p>}
          <Button variant="ai" className="my-2 w-full" onClick={() => onDraft(result)} icon={<Wand2 size={15} />}>
            {t("ai.useDraft")}
          </Button>
        </div>
      )}
    </div>
  );
}
