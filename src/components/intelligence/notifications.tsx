"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, PartyPopper } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "../providers/app-provider";
import { useIntelligence, type AppNotification } from "../providers/use-intelligence";
import { Sheet } from "../ui/sheet";
import { cn } from "../ui/primitives";
import { InsightItem, useInsightText } from "../insights/insight-item";
import { BadgeMedal, GapPromptCard } from "./parts";
import { newlyEarned } from "@/lib/domain/achievements";
import type { TKey } from "@/lib/i18n/translate";

const READ_KEY = "notif_read";
const SENT_KEY = "notif_sent";

/** Bell button + panel. Read state is kept per device (local meta). */
export function NotificationBell() {
  const { t, db, ledger } = useApp();
  const intel = useIntelligence();
  const [open, setOpen] = useState(false);
  const read = useLiveQuery(async () => new Set((await db.getMeta<string[]>(READ_KEY)) ?? []), [db]) ?? new Set<string>();
  const unread = intel.notifications.filter((n) => !read.has(n.id));

  const markAll = async () => {
    const ids = [...new Set([...read, ...intel.notifications.map((n) => n.id)])].slice(-500);
    await db.setMeta(READ_KEY, ids);
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="relative rounded-[10px] p-2.5 text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg" aria-label={`${t("notif.title")}${unread.length ? ` (${unread.length})` : ""}`}>
        <Bell size={18} />
        {unread.length > 0 && <span className="num absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-expense-strong px-1 text-[10px] font-semibold text-white">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("notif.title")} width={460}>
        <div className="flex flex-col gap-3">
          {intel.notifications.length > 0 && (
            <button onClick={() => void markAll()} className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:text-brand-hi">
              <CheckCheck size={14} />
              {t("notif.markRead")}
            </button>
          )}
          {intel.notifications.length === 0 ? (
            <p className="py-10 text-center text-[13.5px] text-fg-3">{t("notif.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {intel.notifications.map((n) => (
                <li key={n.id} className={cn("relative py-3 pl-3", !read.has(n.id) && "before:absolute before:left-0 before:top-5 before:size-1.5 before:rounded-full before:bg-brand")}>
                  <NotificationBody n={n} goalName={n.goalId ? ledger?.goals.find((g) => g.id === n.goalId)?.name : undefined} onNavigate={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </>
  );
}

function NotificationBody({ n, goalName, onNavigate }: { n: AppNotification; goalName?: string; onNavigate: () => void }) {
  const { t } = useApp();
  if (n.insight)
    return (
      <Link href={n.href} onClick={onNavigate} className="-my-2.5 block rounded-lg hover:bg-surface-2">
        <InsightItem insight={n.insight} />
      </Link>
    );
  if (n.gap) return <GapPromptCard gap={n.gap} compact />;
  if (n.badge)
    return (
      <Link href={n.href} onClick={onNavigate} className="flex items-center gap-3">
        <BadgeMedal badge={n.badge} size={40} />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-fg">{t("badges.toast", { name: t(`badges.name.${n.badge.key}` as TKey) })}</span>
          <span className="block text-[12px] text-fg-3">{t(`badges.desc.${n.badge.key}` as TKey)}</span>
        </span>
      </Link>
    );
  return (
    <Link href={n.href} onClick={onNavigate} className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-[10px] bg-income-soft text-income"><PartyPopper size={17} /></span>
      <span className="text-[13.5px] font-semibold text-fg">{t("goals.states.completed")}: {goalName}</span>
    </Link>
  );
}

/**
 * Background effects: persists newly earned badges exactly once (with a
 * celebration toast) and, when enabled, mirrors new important items as
 * system notifications while the app is open.
 */
export function IntelligenceWatcher() {
  const { t, repo, db, toast, ledger } = useApp();
  const intel = useIntelligence();
  const render = useInsightText();
  const unlocking = useRef(false);

  useEffect(() => {
    if (!ledger || unlocking.current) return;
    const fresh = newlyEarned(intel.badges);
    if (!fresh.length) return;
    unlocking.current = true;
    void repo
      .unlockAchievements(fresh)
      .then((keys) => {
        if (intel.settings.achievements)
          for (const k of keys) toast({ message: t("badges.toast", { name: t(`badges.name.${k}` as TKey) }), tone: "success" });
      })
      .finally(() => {
        unlocking.current = false;
      });
  }, [intel.badges, intel.settings.achievements, ledger, repo, toast, t]);

  useEffect(() => {
    if (!intel.settings.system || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const important = intel.notifications.filter((n) => n.kind === "budget" || n.kind === "reminder" || n.kind === "achievement");
    if (!important.length) return;
    let cancelled = false;
    void (async () => {
      const sent = new Set((await db.getMeta<string[]>(SENT_KEY)) ?? []);
      const next = important.filter((n) => !sent.has(n.id)).slice(0, 3);
      if (cancelled || !next.length) return;
      for (const n of next) {
        const body = n.insight ? render(n.insight).text : n.gap ? t(`remind.body_${n.gap.reason}` as TKey, { typical: n.gap.typical, recorded: n.gap.recorded }) : n.badge ? t(`badges.desc.${n.badge.key}` as TKey) : "";
        const title = n.badge ? t("badges.toast", { name: t(`badges.name.${n.badge.key}` as TKey) }) : n.gap ? t(`remind.title_${n.gap.reason}` as TKey, { date: n.gap.date }) : "Soqqa";
        try {
          new Notification(title, { body, icon: "/icons/icon-192.png", tag: n.id });
        } catch {
          /* some platforms only allow notifications from a service worker */
        }
        sent.add(n.id);
      }
      await db.setMeta(SENT_KEY, [...sent].slice(-500));
    })();
    return () => {
      cancelled = true;
    };
  }, [intel.notifications, intel.settings.system, db, render, t]);

  return null;
}

