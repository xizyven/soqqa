"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { cn } from "./primitives";

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:pr-6" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className="pointer-events-auto flex min-h-12 w-full max-w-sm items-center gap-3 rounded-[14px] border border-line-strong bg-surface py-2 pl-3.5 pr-2 text-[13.5px] font-medium text-fg shadow-[var(--shadow-lg)]"
          >
            {t.tone === "error" ? <CircleAlert size={16} className="shrink-0 text-expense" /> : t.tone === "success" ? <CircleCheck size={16} className="shrink-0 text-income" /> : null}
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                className={cn("rounded-[8px] px-2.5 py-1 text-[13px] font-semibold text-brand hover:bg-brand-soft")}
                onClick={() => {
                  t.action!.run();
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="rounded-md p-1 text-fg-3 hover:text-fg">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
