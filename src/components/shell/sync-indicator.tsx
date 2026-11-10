"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cloud, CloudOff, HardDrive, LoaderCircle, RefreshCw, TriangleAlert, CircleCheck, FlaskConical } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { cn } from "../ui/primitives";
import { formatTime } from "@/lib/i18n";

/** Honest sync state: never shows "synced" unless the server acknowledged everything. */
export function SyncIndicator({ compact }: { compact?: boolean }) {
  const { sync, t, mode, syncNow, locale, prefs } = useApp();
  const [open, setOpen] = useState(false);

  let icon = <HardDrive size={14} />;
  let label = t("sync.local");
  let hint = t("sync.localHint");
  let tone = "text-fg-3";
  if (mode === "demo") {
    icon = <FlaskConical size={14} />;
    label = t("sync.demo");
    hint = t("demo.banner");
    tone = "text-ai";
  } else if (sync.state === "offline") {
    icon = <CloudOff size={14} />;
    label = sync.pending ? `${t("sync.offline")} · ${sync.pending}` : t("sync.offline");
    hint = t("sync.offlineHint");
    tone = "text-warning";
  } else if (sync.state === "syncing") {
    icon = <LoaderCircle size={14} className="animate-spin" />;
    label = t("sync.syncing");
    hint = t("sync.pending", { n: sync.pending });
    tone = "text-accent";
  } else if (sync.state === "error" || sync.failed > 0) {
    icon = <TriangleAlert size={14} />;
    label = sync.failed > 0 ? t("sync.failed", { n: sync.failed }) : t("sync.error");
    hint = sync.lastError ? `${t("sync.errorHint")} (${sync.lastError})` : t("sync.errorHint");
    tone = "text-expense";
  } else if (sync.state === "pending") {
    icon = <Cloud size={14} />;
    label = t("sync.pending", { n: sync.pending });
    hint = t("sync.errorHint");
    tone = "text-warning";
  } else if (sync.state === "synced") {
    icon = <CircleCheck size={14} />;
    label = t("sync.synced");
    hint = sync.lastSyncedAt ? t("sync.syncedAt", { time: formatTime(sync.lastSyncedAt, locale, prefs.timezone) }) : "";
    tone = "text-income";
  } else if (sync.state === "local" && sync.pending > 0) {
    label = t("sync.local");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn("flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-[12px] font-semibold transition-colors hover:bg-surface-2", tone)}
        aria-label={`${label}. ${hint}`}
        aria-expanded={open}
      >
        {icon}
        {!compact && <span className="hidden max-w-[160px] truncate xl:inline">{label}</span>}
      </button>
      <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-11 z-50 w-72 rounded-[16px] border border-line-strong bg-surface p-4 text-sm shadow-[var(--shadow-lg)]"
          >
            <div className={cn("flex items-center gap-2 font-semibold", tone)}>
              {icon}
              {label}
            </div>
            {hint && <p className="mt-1.5 text-[13px] leading-snug text-fg-2">{hint}</p>}
            {sync.conflicts > 0 && <p className="mt-1.5 text-[13px] text-warning">{t("sync.conflicts", { n: sync.conflicts })}</p>}
            {mode === "personal" && sync.state !== "local" && (
              <button onClick={syncNow} className="mt-3 inline-flex items-center gap-1.5 rounded-[9px] border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] font-semibold text-fg transition-colors hover:border-line-strong">
                <RefreshCw size={13} />
                {t("sync.syncNow")}
              </button>
            )}
          </motion.div>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}
