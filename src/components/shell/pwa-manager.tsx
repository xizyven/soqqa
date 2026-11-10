"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { useApp } from "../providers/app-provider";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED = "soqqa-install-dismissed";

/** Registers the service worker, surfaces updates and the install prompt. */
export function PwaManager() {
  const { t } = useApp();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    const track = (r: ServiceWorkerRegistration) => {
      if (r.waiting && navigator.serviceWorker.controller) setWaiting(r.waiting);
      r.addEventListener("updatefound", () => {
        const sw = r.installing;
        sw?.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) setWaiting(sw);
        });
      });
    };
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => {
        reg = r;
        track(r);
      })
      .catch((e) => console.warn("[soqqa] service worker registration failed", e));
    const onCtrl = () => {
      if (reloading.current) return;
      reloading.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onCtrl);
    const iv = setInterval(() => void reg?.update().catch(() => undefined), 30 * 60 * 1000);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onCtrl);
      clearInterval(iv);
    };
  }, []);

  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault();
      try {
        if (localStorage.getItem(INSTALL_DISMISSED)) return;
      } catch {
        /* ignore */
      }
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", on);
    return () => window.removeEventListener("beforeinstallprompt", on);
  }, []);

  if (waiting) {
    return (
      <Banner>
        <RefreshCw size={16} className="shrink-0 text-accent" />
        <span className="flex-1">{t("pwa.updateReady")}</span>
        <button className="rounded-md bg-brand-fill px-3 py-1.5 text-[13px] font-semibold text-white" onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })}>
          {t("pwa.reload")}
        </button>
      </Banner>
    );
  }
  if (installEvt) {
    return (
      <Banner>
        <Download size={16} className="shrink-0 text-accent" />
        <span className="flex-1 text-[13px] leading-snug">
          <b className="block text-fg">{t("pwa.install")}</b>
          <span className="text-fg-2">{t("pwa.installHint")}</span>
        </span>
        <button
          className="rounded-md bg-brand-fill px-3 py-1.5 text-[13px] font-semibold text-white"
          onClick={async () => {
            await installEvt.prompt();
            setInstallEvt(null);
          }}
        >
          {t("pwa.install")}
        </button>
        <button
          aria-label={t("common.close")}
          className="p-1 text-fg-3"
          onClick={() => {
            setInstallEvt(null);
            try {
              localStorage.setItem(INSTALL_DISMISSED, "1");
            } catch {
              /* ignore */
            }
          }}
        >
          <X size={14} />
        </button>
      </Banner>
    );
  }
  return null;
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-print fixed inset-x-3 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[58] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line-strong bg-surface-2 px-3 py-2.5 text-sm shadow-2xl md:bottom-6 md:left-auto md:right-6">
      {children}
    </div>
  );
}
