"use client";

import { useState } from "react";
import { useApp } from "../providers/app-provider";
import { Button, cn, Field, Input, Segmented, Switch } from "../ui/primitives";
import { Icon } from "../ui/icon";
import { PALETTE, WALLET_ICONS } from "@/lib/domain/defaults";
import { CURRENCIES, type Currency, type Wallet } from "@/lib/domain/types";
import { ValidationError } from "@/lib/data/repo";
import { errorMessage, fieldError } from "@/lib/i18n/translate";

export function WalletForm({ wallet, onDone, submitLabel }: { wallet?: Wallet; onDone: (w: Wallet) => void; submitLabel?: string }) {
  const { t, repo, toast } = useApp();
  const [name, setName] = useState(wallet?.name ?? "");
  const [currency, setCurrency] = useState<Currency>(wallet?.currency ?? "UZS");
  const [icon, setIcon] = useState(wallet?.icon ?? "credit-card");
  const [color, setColor] = useState(wallet?.color ?? PALETTE[0]);
  const [opening, setOpening] = useState(wallet ? wallet.opening_balance.replace(/\.00$/, "") : "");
  const [spendable, setSpendable] = useState(wallet?.spendable ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const w = await repo.saveWallet({ name, currency, icon, color, opening_balance: opening.replace(/[\s ]/g, "").replace(",", ".") || "0", spendable }, wallet?.id);
      onDone(w);
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.issues);
      else toast({ message: errorMessage(e, t), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label={t("common.name")} error={fieldError(errors.name, t)} htmlFor="w-name">
        <Input id="w-name" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={t("onboarding.walletNamePlaceholder")} invalid={!!errors.name} />
      </Field>
      <Field label={t("common.currency")} error={fieldError(errors.currency, t)}>
        <Segmented value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
      </Field>
      <Field label={t("wallets.openingBalance")} error={fieldError(errors.opening_balance, t)} htmlFor="w-open">
        <Input id="w-open" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value.replace(/[^\d.,\-\s]/g, ""))} placeholder="0" className="num" invalid={!!errors.opening_balance} />
      </Field>
      <Field label={t("common.icon")}>
        <div className="flex flex-wrap gap-1.5">
          {WALLET_ICONS.map((i) => (
            <button type="button" key={i} onClick={() => { setIcon(i); if (!wallet && i === "piggy-bank") setSpendable(false); }} aria-pressed={icon === i} aria-label={i} className={cn("flex size-10 items-center justify-center rounded-xl border transition", icon === i ? "border-accent bg-accent-soft text-fg" : "border-line bg-surface-2 text-fg-2")}>
              <Icon name={i} size={18} />
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("common.color")}>
        <div className="flex flex-wrap gap-2">
          {PALETTE.map((c) => (
            <button type="button" key={c} onClick={() => setColor(c)} aria-label={c} aria-pressed={color === c} className={cn("size-8 rounded-full ring-offset-2 ring-offset-surface transition", color === c && "ring-2 ring-fg")} style={{ background: c }} />
          ))}
        </div>
      </Field>
      <Switch checked={spendable} onChange={setSpendable} label={t("wallets.spendable")} description={t("wallets.spendableHint")} />
      {errors.currency === "currency_locked" && <p className="text-[12px] text-expense">{t("wallets.currencyLocked")}</p>}
      <Button type="submit" variant="primary" loading={busy} className="mt-1">
        {submitLabel ?? t("common.save")}
      </Button>
    </form>
  );
}
