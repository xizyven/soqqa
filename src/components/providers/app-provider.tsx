"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { Session } from "@supabase/supabase-js";
import { SoqqaDB, type DbKind } from "@/lib/data/db";
import { defaultPreferences, Repo, type UserExtras } from "@/lib/data/repo";
import { loadDemoData } from "@/lib/data/demo";
import { todayLocal } from "@/lib/domain/dates";
import type { Category, Ledger, Locale, Preferences, TransactionType } from "@/lib/domain/types";
import { SyncEngine, type SyncStatus } from "@/lib/sync/engine";
import { rpcTransport } from "@/lib/sync/rpc-transport";
import { TransportError } from "@/lib/sync/protocol";
import { cloudConfigured, getSupabase } from "@/lib/supabase/client";
import { makeT, tDynamic, type TFunction } from "@/lib/i18n/translate";
import { BootScreen } from "../brand/boot-screen";

const MODE_KEY = "soqqa-mode";
const THEME_KEY = "soqqa-theme";

export interface Toast {
  id: number;
  message: string;
  tone?: "default" | "success" | "error";
  action?: { label: string; run: () => void };
}

export interface QuickAddState {
  open: boolean;
  /** Increments on every open so the form remounts with fresh state. */
  nonce?: number;
  type?: TransactionType;
  editId?: string;
  ai?: boolean;
  relatedId?: string;
  walletId?: string;
  /** Pre-selected category (one-tap entry). */
  categoryId?: string;
  /** Pre-set date (reviewing a forgotten day). */
  date?: string;
}

export interface AuthState {
  configured: boolean;
  session: Session | null;
  /** Local data belongs to a different account: sync is blocked to prevent mixing. */
  ownerMismatch: boolean;
}

interface AppContextValue {
  ready: boolean;
  mode: DbKind;
  setMode: (m: DbKind) => Promise<void>;
  db: SoqqaDB;
  repo: Repo;
  ledger: Ledger | undefined;
  /** Strategy plans, day reviews and unlocked achievements. */
  extras: UserExtras;
  prefs: Preferences;
  locale: Locale;
  t: TFunction;
  today: string;
  categoryName: (c: Category | undefined | null) => string;
  sync: SyncStatus;
  syncNow: () => void;
  auth: AuthState;
  toast: (t: Omit<Toast, "id">) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  quickAdd: QuickAddState;
  openQuickAdd: (s?: Omit<QuickAddState, "open" | "nonce">) => void;
  closeQuickAdd: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  resolvedTheme: "dark" | "light";
  /** Changes the theme preference with a smooth transition (origin = point to reveal from). */
  setThemePref: (pref: Preferences["theme"], origin?: { x: number; y: number }) => void;
  toggleTheme: (origin?: { x: number; y: number }) => void;
  reloadDemo: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

// --------------------------------------------------------------- external stores

/** Which local database is active ("personal" or "demo"), persisted in localStorage. */
const modeListeners = new Set<() => void>();
const modeStore = {
  get(): DbKind {
    try {
      return localStorage.getItem(MODE_KEY) === "demo" ? "demo" : "personal";
    } catch {
      return "personal";
    }
  },
  set(m: DbKind) {
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage unavailable: mode lasts for this session only */
    }
    modeListeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    modeListeners.add(l);
    return () => modeListeners.delete(l);
  },
};

function subscribeDarkScheme(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** One Dexie instance per database for the page lifetime. */
const dbCache: Partial<Record<DbKind, SoqqaDB>> = {};
function getDb(kind: DbKind): SoqqaDB {
  return (dbCache[kind] ??= new SoqqaDB(kind));
}

let toastCounter = 0;
const EMPTY_EXTRAS: UserExtras = { plans: [], reviews: [], achievements: [] };

const LOCAL_STATUS: SyncStatus = { state: "local", pending: 0, failed: 0, conflicts: 0, lastSyncedAt: null, lastError: null, nextRetryAt: null };

export function AppProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(modeStore.subscribe, modeStore.get, () => null);
  const db = useMemo(() => (mode ? getDb(mode) : null), [mode]);
  const repo = useMemo(() => (db ? new Repo(db) : null), [db]);
  const [seeded, setSeeded] = useState<DbKind | null>(null);

  useEffect(() => {
    if (!repo || !mode) return;
    let cancelled = false;
    (async () => {
      await repo.ensureSeeded();
      if (mode === "demo" && (await repo.db.wallets.count()) === 0) {
        const personalPrefs = await getDb("personal").preferences.toArray();
        await loadDemoData(repo.db, todayLocal(personalPrefs[0]?.timezone), personalPrefs[0]?.locale ?? "uz");
      }
      if (!cancelled) setSeeded(mode);
    })().catch((e) => console.error("[soqqa] failed to open local database", e));
    return () => {
      cancelled = true;
    };
  }, [repo, mode]);

  const prefsRow = useLiveQuery(() => (repo ? repo.preferences() : undefined), [repo]);
  const ledger = useLiveQuery(() => (repo && seeded === mode ? repo.loadLedger() : undefined), [repo, seeded, mode]);
  const extrasRow = useLiveQuery(() => (repo && seeded === mode ? repo.loadExtras() : undefined), [repo, seeded, mode]);
  const extras = useMemo<UserExtras>(() => extrasRow ?? EMPTY_EXTRAS, [extrasRow]);
  const prefs = useMemo(() => prefsRow ?? defaultPreferences(new Date(0).toISOString()), [prefsRow]);
  const locale = prefs.locale;
  const t = useMemo(() => makeT(locale), [locale]);

  // "today" in the user's timezone, re-evaluated every minute (handles midnight).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(iv);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` intentionally re-runs the clock read
  const today = useMemo(() => todayLocal(prefs.timezone), [prefs.timezone, tick]);

  // Theme
  const systemDark = useSyncExternalStore(subscribeDarkScheme, () => window.matchMedia("(prefers-color-scheme: dark)").matches, () => true);
  const resolvedTheme: "dark" | "light" = prefs.theme === "system" ? (systemDark ? "dark" : "light") : prefs.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.lang = locale;
    try {
      localStorage.setItem(THEME_KEY, resolvedTheme);
    } catch {
      /* storage unavailable */
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolvedTheme === "dark" ? "#07080D" : "#F4F6FA");
  }, [resolvedTheme, locale]);

  const setThemePref = useCallback(
    (pref: Preferences["theme"], origin?: { x: number; y: number }) => {
      const next: "dark" | "light" = pref === "system" ? (systemDark ? "dark" : "light") : pref;
      const root = document.documentElement;
      const apply = () => {
        root.dataset.theme = next;
      };
      void repo?.savePreferences({ theme: pref });
      if (root.dataset.theme === next) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
      if (!reduce && doc.startViewTransition && origin) {
        const t = doc.startViewTransition(apply);
        const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
        void t.ready.then(() => {
          root.animate(
            { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
            { duration: 520, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
          );
        });
        return;
      }
      if (!reduce) {
        root.classList.add("theme-anim");
        setTimeout(() => root.classList.remove("theme-anim"), 420);
      }
      apply();
    },
    [repo, systemDark],
  );
  const toggleTheme = useCallback((origin?: { x: number; y: number }) => setThemePref(resolvedTheme === "dark" ? "light" : "dark", origin), [setThemePref, resolvedTheme]);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (tt: Omit<Toast, "id">) => {
      const id = ++toastCounter;
      setToasts((ts) => [...ts.slice(-2), { ...tt, id }]);
      setTimeout(() => dismissToast(id), tt.action ? 6000 : 3500);
    },
    [dismissToast],
  );

  // Auth (Supabase) — optional.
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Sync engine (personal database only).
  const [engine, setEngine] = useState<{ engine: SyncEngine; ownerMismatch: boolean } | null>(null);
  const [engineStatus, setEngineStatus] = useState<SyncStatus>(LOCAL_STATUS);
  useEffect(() => {
    if (!db || mode !== "personal") return;
    let cancelled = false;
    let unsub = () => {};
    (async () => {
      let transport = null;
      let ownerMismatch = false;
      const sb = getSupabase();
      const userId = session?.user.id;
      if (sb && userId) {
        const owner = await db.getMeta<string>("owner_user_id");
        if (owner && owner !== userId) ownerMismatch = true;
        else {
          if (!owner) await db.setMeta("owner_user_id", userId);
          transport = rpcTransport(async (fn, args) => {
            const { data, error } = await sb.rpc(fn, args);
            if (error) {
              const authProblem = /jwt|auth|not_authenticated|permission/i.test(error.message);
              throw new TransportError(error.message, !authProblem);
            }
            return data;
          });
        }
      }
      if (cancelled) return;
      const e = new SyncEngine(db, transport);
      unsub = e.subscribe(setEngineStatus);
      setEngine({ engine: e, ownerMismatch });
      await e.refreshCounts();
      void e.sync();
    })();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [db, mode, session]);
  const activeEngine = mode === "personal" ? engine?.engine ?? null : null;
  const sync = mode === "personal" ? engineStatus : LOCAL_STATUS;

  // Trigger sync when the outbox changes, on reconnect, and on a retry timer.
  const outboxCount = useLiveQuery(() => (db && mode === "personal" ? db.outbox.count() : 0), [db, mode]);
  useEffect(() => {
    if (!activeEngine) return;
    const h = setTimeout(() => void activeEngine.sync(), 800);
    return () => clearTimeout(h);
  }, [outboxCount, activeEngine]);
  useEffect(() => {
    if (!activeEngine) return;
    const on = () => void activeEngine.sync();
    const off = () => void activeEngine.refreshCounts();
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const iv = setInterval(() => {
      const s = activeEngine.getStatus();
      if (s.pending > 0 && (!s.nextRetryAt || s.nextRetryAt <= Date.now())) void activeEngine.sync();
    }, 15_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      clearInterval(iv);
    };
  }, [activeEngine]);
  const syncNow = useCallback(() => void activeEngine?.sync(), [activeEngine]);

  const setMode = useCallback(async (m: DbKind) => {
    setSeeded(null);
    modeStore.set(m);
  }, []);

  const reloadDemo = useCallback(async () => {
    if (!db || db.kind !== "demo") return;
    await loadDemoData(db, todayLocal(prefs.timezone), prefs.locale);
  }, [db, prefs.timezone, prefs.locale]);

  // Quick add & palette
  const [quickAdd, setQuickAdd] = useState<QuickAddState>({ open: false, nonce: 0 });
  const openQuickAdd = useCallback((s: Omit<QuickAddState, "open" | "nonce"> = {}) => setQuickAdd((q) => ({ ...s, open: true, nonce: (q.nonce ?? 0) + 1 })), []);
  const closeQuickAdd = useCallback(() => setQuickAdd((q) => ({ ...q, open: false })), []);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const categoryName = useCallback(
    (c: Category | undefined | null) => {
      if (!c) return t("categories.uncategorized");
      if (c.name) return c.name;
      return c.system_key ? tDynamic(locale, `category.${c.system_key}`, c.system_key) : t("categories.uncategorized");
    },
    [locale, t],
  );

  const ready = !!(db && repo && seeded === mode && prefsRow);
  const auth = useMemo<AuthState>(() => ({ configured: cloudConfigured, session, ownerMismatch: mode === "personal" && !!engine?.ownerMismatch }), [session, mode, engine]);

  const value = useMemo<AppContextValue | null>(() => {
    if (!db || !repo || !mode) return null;
    return {
      ready, mode, setMode, db, repo, ledger, extras, prefs, locale, t, today, categoryName, sync, syncNow, auth, toast, toasts, dismissToast,
      quickAdd, openQuickAdd, closeQuickAdd, paletteOpen, setPaletteOpen, resolvedTheme, setThemePref, toggleTheme, reloadDemo,
    };
  }, [ready, mode, setMode, db, repo, ledger, extras, prefs, locale, t, today, categoryName, sync, syncNow, auth, toast, toasts, dismissToast, quickAdd, openQuickAdd, closeQuickAdd, paletteOpen, resolvedTheme, setThemePref, toggleTheme, reloadDemo]);

  if (!value) return <BootScreen />;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export { BootScreen } from "../brand/boot-screen";
