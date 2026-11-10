"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, FlaskConical, Lock, Wallet } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Button, cn, Field, Segmented, Select } from "@/components/ui/primitives";
import { AppIcon } from "@/components/brand/logo";
import { BrandSplit } from "@/components/brand/brand-split";
import { WalletForm } from "@/components/wallets/wallet-form";
import { LOCALES } from "@/lib/i18n";
import { CURRENCIES, type Currency, type Locale } from "@/lib/domain/types";

type Step = "welcome" | "prefs" | "wallet" | "done";

/** Greeting shown in each language's own words beside the language name. */
const GREETING: Record<Locale, string> = { uz: "Xush kelibsiz", ru: "Добро пожаловать", en: "Welcome" };

export default function WelcomePage() {
  const { t, prefs, repo, setMode, mode, ledger, openQuickAdd } = useApp();
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const steps: Step[] = ["prefs", "wallet", "done"];

  const finish = async (addFirst: boolean) => {
    await repo.savePreferences({ onboarded: true });
    router.replace("/");
    if (addFirst) setTimeout(() => openQuickAdd({ type: "expense" }), 300);
  };

  return (
    <BrandSplit>
      <div>
        {step !== "welcome" && (
          <div className="mb-8 flex gap-1.5" aria-hidden>
            {steps.map((s) => <span key={s} className={cn("h-1 w-10 rounded-full transition-colors", steps.indexOf(s) <= steps.indexOf(step) ? "bg-brand-fill" : "bg-surface-3")} />)}
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="py-2">
            {step === "welcome" && (
              <div className="flex flex-col">
                <AppIcon size={60} />
                <h1 className="display mt-6 text-[32px] font-semibold leading-tight text-fg">{t("onboarding.welcomeTitle")}</h1>
                <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{t("onboarding.welcomeBody")}</p>
                <div className="mt-7">
                  <p className="display text-[17px] font-semibold text-fg">{t("ishkor.chooseLanguage")}</p>
                  <p className="mt-0.5 text-[12.5px] text-fg-3">{t("ishkor.chooseLanguageHint")}</p>
                  <div role="radiogroup" aria-label={t("settings.language")} className="mt-3 grid gap-2">
                    {LOCALES.map((l) => {
                      const on = prefs.locale === l.code;
                      return (
                        <button
                          key={l.code}
                          role="radio"
                          aria-checked={on}
                          onClick={() => void repo.savePreferences({ locale: l.code })}
                          className={cn("flex h-14 items-center gap-3 rounded-[14px] px-3.5 text-left transition-shadow", on ? "bg-brand-soft shadow-[inset_0_0_0_1.5px_var(--brand)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--border-strong)] hover:shadow-[inset_0_0_0_1px_var(--brand-line)]")}
                        >
                          <span className={cn("num flex h-6 w-9 items-center justify-center rounded-[6px] text-[11px] font-semibold uppercase", on ? "bg-brand-fill text-white" : "bg-surface-3 text-fg-2")}>{l.code}</span>
                          <span className="flex flex-1 flex-col">
                            <span className="text-[14.5px] font-semibold text-fg">{l.label}</span>
                            <span lang={l.code} className="text-[12px] text-fg-3">{GREETING[l.code]}</span>
                          </span>
                          <span className={cn("flex size-[22px] items-center justify-center rounded-full", on ? "bg-brand-fill text-white" : "shadow-[inset_0_0_0_1.5px_var(--border-strong)]")}>
                            {on && <Check size={12} strokeWidth={3.2} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-7 grid w-full gap-2">
                  <button
                    onClick={() => (mode === "personal" ? setStep("prefs") : void setMode("personal").then(() => setStep("prefs")))}
                    className="flex items-center gap-3 rounded-[14px] bg-brand px-4 py-3.5 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_10px_24px_-12px_var(--brand)] transition-colors hover:bg-brand-hi"
                  >
                    <Wallet size={18} />
                    <span className="flex-1">
                      <span className="block text-[14px] font-semibold">{t("onboarding.start")}</span>
                      <span className="block text-[12px] text-white/75">{t("onboarding.startHint")}</span>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={async () => {
                      await setMode("demo");
                      router.replace("/");
                    }}
                    className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5 text-left shadow-[var(--shadow-sm)] transition-colors hover:border-ai/40"
                  >
                    <FlaskConical size={18} className="text-ai" />
                    <span className="flex-1">
                      <span className="block text-[14px] font-semibold text-fg">{t("onboarding.tryDemo")}</span>
                      <span className="block text-[12px] text-fg-2">{t("onboarding.tryDemoHint")}</span>
                    </span>
                    <ArrowRight size={16} className="text-ai" />
                  </button>
                </div>
                <p className="mt-6 text-[13.5px] text-fg-2">
                  {t("ishkor.haveAccount")} <Link href="/auth" className="font-semibold text-brand hover:text-brand-hi">{t("settings.signIn")}</Link>
                </p>
                <p className="mt-3 flex items-center gap-2 text-[12px] text-fg-3"><Lock size={12} />{t("ishkor.offlineFirst")}</p>
              </div>
            )}
            {step === "prefs" && (
              <div className="flex flex-col gap-4">
                <h2 className="display text-[26px] font-semibold text-fg">{t("onboarding.prefsTitle")}</h2>
                <Field label={t("settings.language")}>
                  <Segmented value={prefs.locale} onChange={(v: Locale) => void repo.savePreferences({ locale: v })} options={LOCALES.map((l) => ({ value: l.code, label: l.label }))} />
                </Field>
                <Field label={t("settings.baseCurrency")} hint={t("settings.baseCurrencyHint")}>
                  <Segmented value={prefs.base_currency} onChange={(v: Currency) => void repo.savePreferences({ base_currency: v })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
                </Field>
                <Field label={t("settings.timezone")}>
                  <Select value={prefs.timezone} onChange={(e) => void repo.savePreferences({ timezone: e.target.value })}>
                    {Array.from(new Set([prefs.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone, "Asia/Tashkent", "Asia/Samarkand", "Europe/Moscow", "UTC"])).map((z) => <option key={z}>{z}</option>)}
                  </Select>
                </Field>
                <div className="mt-2 flex justify-between">
                  <Button variant="ghost" onClick={() => setStep("welcome")}>{t("common.back")}</Button>
                  <Button variant="primary" onClick={() => setStep((ledger?.wallets.length ?? 0) > 0 ? "done" : "wallet")} icon={<ArrowRight size={15} />}>{t("common.next")}</Button>
                </div>
              </div>
            )}
            {step === "wallet" && (
              <div className="flex flex-col gap-3">
                <h2 className="display text-[26px] font-semibold text-fg">{t("onboarding.walletTitle")}</h2>
                <p className="text-[13.5px] text-fg-2">{t("onboarding.walletBody")}</p>
                <WalletForm onDone={() => setStep("done")} submitLabel={t("common.next")} />
                <Button variant="ghost" onClick={() => setStep("prefs")}>{t("common.back")}</Button>
              </div>
            )}
            {step === "done" && (
              <div className="flex flex-col items-start">
                <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-income-soft text-income"><Check size={28} /></span>
                <h2 className="display mt-5 text-[28px] font-semibold text-fg">{t("onboarding.finishTitle")}</h2>
                <p className="mt-2 text-[14px] text-fg-2">{t("onboarding.finishBody")}</p>
                <div className="mt-6 grid w-full gap-2">
                  <Button variant="primary" size="lg" onClick={() => void finish(true)}>{t("onboarding.addFirst")}</Button>
                  <Button variant="ghost" onClick={() => void finish(false)}>{t("common.done")}</Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </BrandSplit>
  );
}
