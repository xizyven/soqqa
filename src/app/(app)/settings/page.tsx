"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Archive, ArchiveRestore, Check, CloudOff, Download, FlaskConical, LogIn, LogOut, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Badge, Button, Card, cn, Field, Input, Kbd, Segmented, Select, Switch, PageHeader } from "@/components/ui/primitives";
import { Icon, IconTile } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { LOCALES, formatDay, formatTime } from "@/lib/i18n";
import { CATEGORY_ICONS, PALETTE } from "@/lib/domain/defaults";
import { RateBook } from "@/lib/domain/rates";
import { CURRENCIES, type Category, type CategoryBucket, type Currency, type Locale, type ThemePref } from "@/lib/domain/types";
import { download, exportJson, transactionsCsv } from "@/lib/data/export";
import { ValidationError } from "@/lib/data/repo";
import { errorMessage, fieldError } from "@/lib/i18n/translate";
import { getSupabase } from "@/lib/supabase/client";

const TIMEZONES = ["Asia/Tashkent", "Asia/Samarkand", "Asia/Almaty", "Asia/Dubai", "Europe/Moscow", "Europe/Istanbul", "Europe/London", "Europe/Berlin", "America/New_York", "Asia/Seoul", "UTC"];

export default function SettingsPage() {
  const { t, prefs, repo } = useApp();
  const save = (patch: Parameters<typeof repo.savePreferences>[0]) => void repo.savePreferences(patch);
  const deviceTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Tashkent";
  const tzs = Array.from(new Set([prefs.timezone, deviceTz, ...TIMEZONES]));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <PageHeader title={t("settings.title")} />
      <Card title={t("ishkor.appearance")}>
        <div className="flex flex-col gap-5">
          <ThemeTiles value={prefs.theme} onChange={(v) => save({ theme: v })} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <span className="text-[13.5px] font-semibold text-fg">{t("settings.language")}</span>
            <Segmented value={prefs.locale} onChange={(v: Locale) => save({ locale: v })} options={LOCALES.map((l) => ({ value: l.code, label: l.label }))} />
          </div>
        </div>
      </Card>
      <Card title={t("settings.general")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("settings.baseCurrency")} hint={t("settings.baseCurrencyHint")}>
            <Select value={prefs.base_currency} onChange={(e) => save({ base_currency: e.target.value as Currency })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label={t("settings.timezone")}>
            <Select value={prefs.timezone} onChange={(e) => save({ timezone: e.target.value })}>
              {tzs.map((z) => <option key={z}>{z}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      <RatesSection />
      <CategoriesSection />

      <Card title={<span id="ai">{t("settings.ai")}</span>}>
        <Switch checked={prefs.ai_cloud_enabled} onChange={(v) => save({ ai_cloud_enabled: v })} label={t("settings.aiCloud")} description={t("settings.aiCloudHint")} />
        <p className="mt-3 text-[12px] text-fg-3">{t("advisor.cloudPrivacy")}</p>
      </Card>

      <AccountSection />
      <DataSection />

      <Card title={t("settings.shortcuts")}>
        <ul className="grid gap-2 text-[13px] text-fg-2 sm:grid-cols-2">
          {[
            [["Ctrl", "K"], t("shortcuts.palette")],
            [["N"], t("palette.newExpense")],
            [["A"], t("palette.aiEntry")],
            [["G", "O"], `${t("shortcuts.goTo")}: ${t("nav.overview")}`],
            [["G", "T"], `${t("shortcuts.goTo")}: ${t("nav.transactions")}`],
            [["G", "A"], `${t("shortcuts.goTo")}: ${t("nav.analytics")}`],
            [["Enter"], t("common.save")],
            [["Esc"], t("common.close")],
          ].map(([keys, label]) => (
            <li key={label as string} className="flex items-center justify-between gap-3">
              <span>{label as string}</span>
              <span className="flex gap-1">{(keys as string[]).map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="pb-2 text-center text-[12px] text-fg-3">Soqqa · {t("settings.version")} 0.1.0 · {t("onboarding.privacy")}</p>
    </div>
  );
}

/** Theme picker drawn as miniature app previews (navy rail in both themes). */
function ThemeTiles({ value, onChange }: { value: ThemePref; onChange: (v: ThemePref) => void }) {
  const { t } = useApp();
  const tile = (v: ThemePref) => {
    const dark = v === "dark";
    return (
      <span className={cn("relative block h-[92px] overflow-hidden rounded-[12px]", dark ? "bg-[#060E24]" : "bg-[#F3F5F9]")}>
        {v === "system" && <span className="absolute inset-0 bg-[#060E24] [clip-path:polygon(100%_0,100%_100%,0_100%)]" />}
        <span className={cn("absolute inset-y-0 left-0 w-[28%]", dark ? "bg-[#040A1C]" : "bg-[#071330]")} />
        <span className={cn("absolute left-[36%] top-3.5 h-2 w-[36%] rounded-[3px]", dark ? "bg-[#EDF2FF]" : "bg-[#0A1430]")} />
        <span className={cn("absolute left-[36%] right-2.5 top-8 h-[22px] rounded-[6px]", dark ? "bg-[#0B1736] ring-1 ring-[#1A2A52]" : "bg-white ring-1 ring-[#E3E7EF]")} />
        <span className={cn("absolute left-[36%] top-[60px] h-[22px] w-[26%] rounded-[6px]", dark ? "bg-[#0B1736] ring-1 ring-[#1A2A52]" : "bg-white ring-1 ring-[#E3E7EF]")} />
        <span className={cn("absolute left-[66%] right-2.5 top-[60px] h-[22px] rounded-[6px]", dark ? "bg-[#4C86F7]" : "bg-[#2F69E8]")} />
      </span>
    );
  };
  return (
    <div role="radiogroup" aria-label={t("settings.theme")} className="grid grid-cols-3 gap-3">
      {(["light", "dark", "system"] as const).map((v) => (
        <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)} className="group flex flex-col gap-2 text-left">
          <span className={cn("relative rounded-[14px] p-[3px] transition-shadow", value === v ? "shadow-[0_0_0_2px_var(--brand)]" : "shadow-[0_0_0_1px_var(--border-strong)] group-hover:shadow-[0_0_0_1px_var(--brand-line)]")}>
            {tile(v)}
            {value === v && (
              <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-brand-fill text-white">
                <Check size={11} strokeWidth={3.2} />
              </span>
            )}
          </span>
          <span className="text-[13px] font-semibold text-fg">{t(`settings.themes.${v}`)}</span>
        </button>
      ))}
    </div>
  );
}

function RatesSection() {
  const { t, ledger, repo, toast, today, locale } = useApp();
  const [currency, setCurrency] = useState<"USD" | "EUR" | "RUB">("USD");
  const [rate, setRate] = useState("");
  const [date, setDate] = useState(today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fetching, setFetching] = useState(false);
  const book = useMemo(() => new RateBook(ledger?.rates ?? []), [ledger]);

  const add = async () => {
    setErrors({});
    try {
      await repo.addRate({ currency, uzs_per_unit: rate.replace(/[\s ]/g, "").replace(",", "."), effective_date: date, source: "manual" });
      setRate("");
      toast({ message: t("tx.saved"), tone: "success" });
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.issues);
      else toast({ message: errorMessage(e, t), tone: "error" });
    }
  };
  const fetchCbu = async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/rates/cbu");
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { rates: { currency: "USD" | "EUR" | "RUB"; rate: string; date: string }[] };
      const added = await repo.addRatesIfNew(data.rates.map((r) => ({ currency: r.currency, uzs_per_unit: r.rate, effective_date: r.date, source: "cbu" as const })));
      toast({ message: added ? t("settings.ratesFetched", { n: added }) : t("settings.ratesUpToDate"), tone: "success" });
    } catch {
      toast({ message: t("settings.ratesFailed"), tone: "error" });
    } finally {
      setFetching(false);
    }
  };

  return (
    <Card title={<span id="rates">{t("settings.rates")}</span>} subtitle={t("settings.ratesHint")} action={<Button size="sm" variant="secondary" loading={fetching} icon={<RefreshCw size={14} />} onClick={() => void fetchCbu()}>{fetching ? t("settings.fetchingRates") : t("settings.fetchRates")}</Button>}>
      <ul className="divide-y divide-line">
        {(["USD", "EUR", "RUB"] as const).map((c) => {
          const latest = book.latest(c);
          const chip = c === "USD" ? "bg-warning-soft text-warning" : c === "EUR" ? "bg-brand-soft text-brand" : "bg-expense-soft text-expense";
          return (
            <li key={c} className="flex items-center gap-3 py-3">
              <span className={cn("num flex h-7 w-12 items-center justify-center rounded-[7px] text-[12px] font-semibold", chip)}>{c}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg-3">
                {latest ? `${formatDay(latest.effective_date, locale, { year: true })} · ${t(`settings.source.${latest.source}`)}` : t("settings.noRates")}
              </span>
              <span className="num text-[15px] font-semibold text-fg">{latest ? latest.uzs_per_unit : "—"}</span>
              <span className="w-8 text-[11.5px] text-fg-3">UZS</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2 sm:grid-cols-[auto_1fr_auto_auto]">
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as "USD")} className="w-24" aria-label={t("common.currency")}>
          {(["USD", "EUR", "RUB"] as const).map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,\s]/g, ""))} placeholder={t("settings.rateLabel", { currency })} className="num" invalid={!!errors.uzs_per_unit} aria-label={t("settings.rateLabel", { currency })} />
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("settings.effectiveDate")} className="col-span-1" />
        <Button variant="primary" icon={<Plus size={15} />} onClick={() => void add()} disabled={!rate}>{t("settings.addRate")}</Button>
      </div>
      {errors.uzs_per_unit && <p className="mt-1 text-[12px] text-expense">{fieldError(errors.uzs_per_unit, t)}</p>}
      <details className="mt-3 text-[13px]">
        <summary className="cursor-pointer text-fg-3 hover:text-fg">{t("wallets.history")} ({ledger?.rates.length ?? 0})</summary>
        <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto scroll-thin">
          {[...(ledger?.rates ?? [])].sort((a, b) => b.effective_date.localeCompare(a.effective_date) || b.created_at.localeCompare(a.created_at)).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-fg-2">{formatDay(r.effective_date, locale, { year: true })} · {r.currency}</span>
              <span className="flex items-center gap-2"><span className="num text-fg">{r.uzs_per_unit}</span><Badge>{t(`settings.source.${r.source}`)}</Badge></span>
            </li>
          ))}
          {!ledger?.rates.length && <li className="py-2 text-fg-3">{t("settings.noRates")}</li>}
        </ul>
      </details>
    </Card>
  );
}

function CategoriesSection() {
  const { t, ledger, repo, toast, categoryName } = useApp();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [editing, setEditing] = useState<{ open: boolean; cat?: Category }>({ open: false });
  const cats = (ledger?.categories ?? []).filter((c) => c.kind === kind).sort((a, b) => Number(a.archived) - Number(b.archived) || a.sort - b.sort);
  return (
    <Card title={t("settings.categories")} action={<Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setEditing({ open: true })}>{t("categories.new")}</Button>}>
      <Segmented size="sm" value={kind} onChange={setKind} options={[{ value: "expense", label: t("categories.expense"), tone: "expense" }, { value: "income", label: t("categories.income"), tone: "income" }]} />
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {cats.map((c) => (
          <li key={c.id} className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2", c.archived && "opacity-50")}>
            <IconTile name={c.icon} color={c.color} size={30} />
            <button className="min-w-0 flex-1 truncate text-left text-[13.5px] text-fg" onClick={() => setEditing({ open: true, cat: c })}>{categoryName(c)}</button>
            {c.bucket && <span className="text-[11px] text-fg-3">{t(`categories.${c.bucket}`)}</span>}
            <button className="rounded-md p-1.5 text-fg-3 hover:text-fg" aria-label={c.archived ? t("common.unarchive") : t("common.archive")} title={c.archived ? t("common.unarchive") : t("common.archive")} onClick={async () => { await repo.setCategoryArchived(c.id, !c.archived); toast({ message: t("tx.saved") }); }}>
              {c.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            </button>
          </li>
        ))}
      </ul>
      <CategoryForm state={editing} defaultKind={kind} onClose={() => setEditing({ open: false })} />
    </Card>
  );
}

function CategoryForm({ state, defaultKind, onClose }: { state: { open: boolean; cat?: Category }; defaultKind: "expense" | "income"; onClose: () => void }) {
  const { t, repo, toast, categoryName } = useApp();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("circle-dashed");
  const [color, setColor] = useState<string>(PALETTE[0]);
  const [bucket, setBucket] = useState<CategoryBucket>("wants");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastOpen, setLastOpen] = useState(false);
  if (state.open !== lastOpen) {
    setLastOpen(state.open);
    if (state.open) {
      setName(state.cat ? categoryName(state.cat) : "");
      setIcon(state.cat?.icon ?? "circle-dashed");
      setColor(state.cat?.color ?? PALETTE[0]);
      setBucket(state.cat?.bucket ?? "wants");
      setErrors({});
    }
  }
  const kind = state.cat?.kind ?? defaultKind;
  const save = async () => {
    try {
      await repo.saveCategory({ name, kind, icon, color, bucket: kind === "expense" ? bucket : null }, state.cat?.id);
      toast({ message: t("tx.saved"), tone: "success" });
      onClose();
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.issues);
      else toast({ message: errorMessage(e, t), tone: "error" });
    }
  };
  return (
    <Sheet open={state.open} onClose={onClose} title={state.cat ? t("categories.edit") : t("categories.new")} width={460}>
      <div className="flex flex-col gap-4">
        <Field label={t("common.name")} error={fieldError(errors.name, t)}>
          <Input data-autofocus value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        {kind === "expense" && (
          <Field label={t("categories.bucket")}>
            <Segmented value={bucket} onChange={setBucket} options={[{ value: "needs", label: t("categories.needs") }, { value: "wants", label: t("categories.wants") }]} />
          </Field>
        )}
        <Field label={t("common.icon")}>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_ICONS.map((i) => (
              <button key={i} type="button" aria-label={i} aria-pressed={icon === i} onClick={() => setIcon(i)} className={cn("flex size-9 items-center justify-center rounded-lg border", icon === i ? "border-accent bg-accent-soft text-fg" : "border-line bg-surface-2 text-fg-2")}>
                <Icon name={i} size={16} />
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("common.color")}>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface", color === c && "ring-2 ring-fg")} style={{ background: c }} />)}
          </div>
        </Field>
        <Button variant="primary" onClick={() => void save()}>{t("common.save")}</Button>
      </div>
    </Sheet>
  );
}

function AccountSection() {
  const { t, auth, sync, syncNow, db, repo, toast, mode, locale, prefs } = useApp();
  const conflicts = useLiveQuery(() => db.conflicts.filter((c) => !c.dismissed).reverse().sortBy("created_at"), [db]) ?? [];
  const failed = useLiveQuery(() => db.outbox.where("status").equals("failed").toArray(), [db]) ?? [];


  return (
    <Card title={t("settings.account")}>
      {!auth.configured ? (
        <p className="flex items-start gap-2 text-[13px] text-fg-2"><CloudOff size={15} className="mt-0.5 shrink-0 text-fg-3" />{t("settings.cloudNotConfigured")}</p>
      ) : auth.session ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13.5px] text-fg">{t("settings.signedInAs", { email: auth.session.user.email ?? "" })}</p>
            <Button size="sm" variant="secondary" icon={<LogOut size={14} />} onClick={() => void getSupabase()?.auth.signOut()}>{t("settings.signOut")}</Button>
          </div>
          {auth.ownerMismatch && <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">{t("settings.otherAccount")}</p>}
          <div className="flex items-center gap-2 text-[13px] text-fg-2">
            <Badge tone={sync.state === "synced" ? "income" : sync.state === "error" ? "expense" : sync.state === "pending" || sync.state === "offline" ? "warning" : "neutral"}>
              {sync.state === "pending" ? t("sync.pending", { n: sync.pending }) : sync.state === "syncing" ? t("sync.syncing") : sync.state === "synced" ? t("sync.synced") : sync.state === "offline" ? t("sync.offline") : sync.state === "error" ? t("sync.error") : t("sync.local")}
            </Badge>
            {sync.pending > 0 && sync.state !== "pending" && <span>{t("sync.pending", { n: sync.pending })}</span>}
            {sync.lastSyncedAt && <span className="text-fg-3">{t("sync.syncedAt", { time: formatTime(sync.lastSyncedAt, locale, prefs.timezone) })}</span>}
            <button onClick={syncNow} className="ml-auto inline-flex items-center gap-1 text-accent hover:underline"><RefreshCw size={13} />{t("sync.syncNow")}</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-fg-2">{t("settings.authHint")}</p>
          <Link href="/auth" className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-hi">
            <LogIn size={15} />
            {t("settings.signIn")}
          </Link>
        </div>
      )}
      {mode === "personal" && failed.length > 0 && (
        <div className="mt-4 rounded-xl border border-expense/30 bg-expense-soft p-3">
          <p className="text-[13px] font-semibold text-expense">{t("settings.failedOps")} ({failed.length})</p>
          <p className="mt-0.5 text-[12.5px] text-fg-2">{t("settings.failedHint")}</p>
          <ul className="mt-2 space-y-0.5 text-[12px] text-fg-3">{failed.slice(0, 5).map((f) => <li key={f.op_id}>{f.table} · {f.last_error}</li>)}</ul>
          <Button size="sm" variant="secondary" className="mt-2" icon={<RotateCcw size={13} />} onClick={async () => { await repo.retryFailedOps(); syncNow(); }}>{t("settings.retryFailed")}</Button>
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="mt-4">
          <p className="text-[13px] font-semibold text-fg">{t("settings.conflicts")} ({conflicts.length})</p>
          <p className="mt-0.5 text-[12.5px] text-fg-3">{t("settings.conflictsHint")}</p>
          <ul className="mt-2 divide-y divide-line">
            {conflicts.slice(0, 20).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                <span className="min-w-0 text-fg-2">
                  {c.table} · {String(c.discarded.name ?? c.discarded.note ?? c.discarded.merchant ?? c.entity_id).slice(0, 40)}
                  <span className="block text-fg-3">{t("settings.conflictDiscarded")}: {String(c.discarded.updated_at ?? "").slice(0, 16).replace("T", " ")} · {t("settings.conflictKept")}: {String(c.kept.updated_at ?? "").slice(0, 16).replace("T", " ")}</span>
                </span>
                <span className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={async () => { await repo.restoreConflictVersion(c.id); toast({ message: t("tx.saved") }); }}>{t("settings.restoreVersion")}</Button>
                  <Button size="sm" variant="ghost" onClick={() => void repo.dismissConflict(c.id)}>{t("settings.dismiss")}</Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function DataSection() {
  const { t, db, ledger, repo, mode, setMode, reloadDemo, toast, today, categoryName } = useApp();
  const router = useRouter();
  const [wipeOpen, setWipeOpen] = useState(false);
  const [word, setWord] = useState("");
  return (
    <Card title={t("settings.data")}>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={async () => download(`soqqa-${mode}-${today}.json`, await exportJson(db), "application/json")}>{t("settings.exportJson")}</Button>
        <Button size="sm" variant="secondary" icon={<Download size={14} />} disabled={!ledger?.transactions.length} onClick={() => ledger && download(`soqqa-transactions-${today}.csv`, transactionsCsv(ledger.transactions, ledger, categoryName), "text/csv;charset=utf-8")}>{t("settings.exportCsv")}</Button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {mode === "demo" ? (
          <>
            <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} onClick={async () => { await reloadDemo(); toast({ message: t("demo.resetDone"), tone: "success" }); }}>{t("demo.reset")}</Button>
            <Button size="sm" variant="ai" icon={<FlaskConical size={14} />} onClick={() => void setMode("personal")}>{t("demo.exit")}</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" icon={<FlaskConical size={14} className="text-ai" />} onClick={() => void setMode("demo")}>{t("demo.load")}</Button>
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => { setWord(""); setWipeOpen(true); }}>{t("settings.wipe")}</Button>
          </>
        )}
      </div>
      <Sheet open={wipeOpen} onClose={() => setWipeOpen(false)} title={t("settings.wipe")} width={440}>
        <p className="text-[13.5px] leading-relaxed text-fg-2">{t("settings.wipeConfirm")}</p>
        <Input className="mt-3" value={word} onChange={(e) => setWord(e.target.value)} placeholder={t("settings.wipeWord")} aria-label={t("settings.wipeWord")} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setWipeOpen(false)}>{t("common.cancel")}</Button>
          <Button
            variant="danger"
            disabled={word.trim() !== t("settings.wipeWord")}
            onClick={async () => {
              await repo.wipe();
              await repo.ensureSeeded();
              setWipeOpen(false);
              router.replace("/welcome");
            }}
          >
            {t("common.delete")}
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}
