"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { X } from "lucide-react";
import { cn, Button } from "./primitives";

const MOBILE_QUERY = "(max-width: 767px)";
function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useIsMobile() {
  return useSyncExternalStore(subscribeMobile, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}
const noopSubscribe = () => () => {};

/**
 * Responsive overlay: a bottom sheet on phones, a centered dialog on larger
 * screens. Traps focus, closes on Escape and backdrop click, restores focus.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  width = 520,
  accent,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  accent?: "ai";
  labelledBy?: string;
}) {
  const mobile = useIsMobile();
  const dragControls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panelRef.current;
      el?.focus();
    }, 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey, true);
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <motion.div
            data-overlay
            className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line-strong bg-surface shadow-[var(--shadow-lg)] outline-none",
              mobile ? "rounded-t-[24px] pb-safe" : "rounded-[22px]",
              accent === "ai" && "ring-1 ring-ai/25",
            )}
            style={mobile ? undefined : { maxWidth: width }}
            initial={mobile ? { y: "100%" } : { opacity: 0, y: 14, scale: 0.97 }}
            animate={mobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={mobile ? { y: "100%" } : { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ type: "spring", damping: 34, stiffness: 420, mass: 0.9 }}
            drag={mobile ? "y" : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            {mobile && (
              <div className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2" onPointerDown={(e) => dragControls.start(e)} aria-hidden>
                <div className="h-1 w-10 rounded-full bg-line-strong" />
              </div>
            )}
            {title !== undefined && (
              <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
                <h2 id={labelledBy} className="display text-[18px] font-semibold text-fg">{title}</h2>
                <button onClick={onClose} aria-label="Close" className="-mr-2 inline-flex size-8 items-center justify-center rounded-[9px] text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg">
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
            {footer && <div className="shrink-0 border-t border-line bg-surface px-5 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open={open} onClose={onClose} title={title} width={420}>
      <p className="text-sm leading-relaxed text-fg-2">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{cancelLabel}</Button>
        <Button
          data-autofocus
          variant={danger ? "danger" : "primary"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
