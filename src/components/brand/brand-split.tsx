"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { LogoMark, Wordmark } from "./logo";
import { Khatam } from "./ornaments";
import { Select } from "../ui/primitives";
import { LOCALES } from "@/lib/i18n";
import type { Locale } from "@/lib/domain/types";

/**
 * Two-column brand layout for onboarding and authentication: the navy brand
 * panel (logo, motto, girih field, hoshiya frieze) beside the content.
 * Collapses to a compact header on phones.
 */
export function BrandSplit({ children }: { children: ReactNode }) {
  const { t, prefs, repo, resolvedTheme, toggleTheme } = useApp();
  return (
    <div className="flex min-h-dvh bg-bg">
      <aside className="girih relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-[#071330] p-10 text-white [--ornament:rgba(159,192,255,0.16)] lg:flex xl:p-14">
        <div className="relative flex items-center gap-3">
          <LogoMark size={42} />
          <span className="flex flex-col">
            <span className="font-display text-[32px] font-medium leading-[0.85] tracking-[-0.035em] text-white">soqqa</span>
            <span className="mt-2 text-[9px] font-semibold uppercase tracking-[0.3em] text-[#8EA3CF]">{t("app.motto")}</span>
          </span>
        </div>
        <motion.div className="relative" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}>
          <p className="font-display text-[46px] font-medium leading-[1.04] tracking-[-0.035em] text-white xl:text-[56px]">{t("app.motto").replace(/ · /g, ". ")}.</p>
          <div className="hoshiya my-8 -mx-10 xl:-mx-14" aria-hidden />
          <p className="max-w-sm text-[16px] leading-relaxed text-[#C3CFE8]">{t("app.slogan")}</p>
        </motion.div>
        <div className="relative flex items-center gap-2 text-[12.5px] font-medium text-[#A9B7D6]">
          <Khatam size={11} className="text-[#7AA7F7]" />
          {t("onboarding.privacy")}
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <span className="flex items-center gap-2.5 lg:invisible">
            <LogoMark size={28} />
            <Wordmark className="text-[22px] leading-none" />
          </span>
          <div className="flex items-center gap-2">
            <button onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })} className="rounded-[10px] p-2 text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg" aria-label={t("nav.theme")}>
              {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Select value={prefs.locale} onChange={(e) => void repo.savePreferences({ locale: e.target.value as Locale })} className="h-9 w-auto text-[13px]" aria-label={t("settings.language")}>
              {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </Select>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="w-full max-w-[440px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
