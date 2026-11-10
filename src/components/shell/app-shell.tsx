"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Ellipsis, FlaskConical, Moon, PanelLeftClose, PanelLeftOpen, Plus, Search, Sparkles, Sun } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { NAV, isActive } from "./nav";
import { LogoMark } from "../brand/logo";
import { Khatam } from "../brand/ornaments";
import { SyncIndicator } from "./sync-indicator";
import { CommandPalette } from "./command-palette";
import { Toaster } from "../ui/toaster";
import { Sheet } from "../ui/sheet";
import { cn, Kbd } from "../ui/primitives";
import { QuickAdd } from "../transactions/quick-add";
import { PwaManager } from "./pwa-manager";
import { IntelligenceWatcher, NotificationBell } from "../intelligence/notifications";

const COLLAPSE_KEY = "soqqa-sidebar-collapsed";
const FINANCE = NAV.filter((n) => !["/advisor", "/settings"].includes(n.href));
const TOOLS = NAV.filter((n) => n.href === "/advisor");
const SETTINGS = NAV.find((n) => n.href === "/settings")!;

export function AppShell({ children }: { children: ReactNode }) {
  const { t, mode, setMode, openQuickAdd, setPaletteOpen, paletteOpen, quickAdd, prefs, ready, resolvedTheme, toggleTheme } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // First run: route to onboarding.
  useEffect(() => {
    if (ready && mode === "personal" && !prefs.onboarded && pathname !== "/welcome") router.replace("/welcome");
  }, [ready, mode, prefs.onboarded, pathname, router]);

  // Keyboard shortcuts.
  const gPending = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || quickAdd.open || paletteOpen) return;
      if (gPending.current) {
        const item = NAV.find((n) => n.key === e.key.toLowerCase());
        window.clearTimeout(gPending.current);
        gPending.current = null;
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (e.key === "g") gPending.current = window.setTimeout(() => (gPending.current = null), 900);
      else if (e.key === "n") {
        e.preventDefault();
        openQuickAdd({ type: "expense" });
      } else if (e.key === "a") {
        e.preventDefault();
        openQuickAdd({ ai: true });
      } else if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, quickAdd.open, openQuickAdd, setPaletteOpen, router]);

  const current = NAV.find((n) => isActive(pathname, n.href));
  const mobileTabs = [NAV[0], NAV[1], NAV[4], NAV[5]];
  const themeToggle = (e: React.MouseEvent) => toggleTheme({ x: e.clientX, y: e.clientY });

  const navLink = (n: (typeof NAV)[number]) => {
    const active = isActive(pathname, n.href);
    const ai = n.href === "/advisor";
    return (
      <Link
        key={n.href}
        href={n.href}
        title={collapsed ? t(n.label) : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex h-10 items-center gap-3 rounded-[10px] text-[13.5px] font-semibold transition-colors duration-150",
          collapsed ? "justify-center" : "px-2.5",
          active ? "text-rail-fg" : "text-rail-fg-2 hover:text-rail-fg",
        )}
      >
        {active && (
          <motion.span
            layoutId="nav-active"
            className="absolute inset-0 rounded-[10px] bg-rail-active shadow-[inset_0_0_0_1px_var(--rail-active-ring)]"
            transition={{ type: "spring", stiffness: 480, damping: 38 }}
          />
        )}
        {!active && <span className="absolute inset-0 rounded-[10px] bg-white/[0.04] opacity-0 transition-opacity duration-150 group-hover:opacity-100" />}
        <n.icon size={18} strokeWidth={1.9} className={cn("relative z-10 shrink-0 transition-colors", ai ? "text-[#A99CFF]" : active ? "text-[#7AA7F7]" : "")} />
        {!collapsed && <span className="relative z-10 flex-1 truncate">{t(n.label)}</span>}
        {!collapsed && active && <Khatam size={10} className={cn("relative z-10", ai ? "text-[#A99CFF]" : "text-[#7AA7F7]")} />}
      </Link>
    );
  };

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar — the navy rail, in both themes */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-dvh shrink-0 flex-col bg-rail text-rail-fg shadow-[1px_0_0_var(--rail-edge)] transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex h-[76px] items-center", collapsed ? "justify-center" : "justify-between pl-5 pr-3")}>
          <Link href="/" aria-label={t("app.name")} className="flex items-center gap-2.5 rounded-lg">
            <LogoMark size={collapsed ? 30 : 33} />
            {!collapsed && (
              <span className="flex flex-col gap-1">
                <span className="font-display text-[25px] font-medium leading-[0.85] tracking-[-0.035em] text-white">soqqa</span>
                <span className="whitespace-nowrap text-[8.5px] font-semibold uppercase tracking-[0.24em] text-[#8EA3CF]">{t("app.motto")}</span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button onClick={toggleCollapsed} className="rounded-[8px] p-1.5 text-rail-fg-3 transition-colors hover:bg-white/[0.06] hover:text-rail-fg" aria-label={t("nav.collapse")} title={t("nav.collapse")}>
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>

        <div className={cn("px-4 pb-5", collapsed && "px-3.5")}>
          <button
            onClick={() => openQuickAdd({ type: "expense" })}
            className={cn(
              "group flex h-11 w-full items-center gap-2 rounded-[12px] bg-brand-fill text-[14px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-brand-hi active:scale-[0.98]",
              collapsed ? "justify-center" : "px-3.5",
            )}
            title={`${t("shortcuts.quickAdd")} (N)`}
          >
            <Plus size={18} strokeWidth={2.3} className="transition-transform duration-200 group-hover:rotate-90" />
            {!collapsed && (
              <>
                <span className="flex-1 text-left">{t("quick.title")}</span>
                <span className="rounded-[5px] bg-white/[0.16] px-1.5 py-0.5 font-mono text-[10px]">N</span>
              </>
            )}
          </button>
        </div>

        <nav className="scroll-thin flex flex-1 flex-col gap-0.5 overflow-y-auto px-4" aria-label="Main">
          {!collapsed && <p className="px-2.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-rail-fg-3">{t("nav.sectionFinance")}</p>}
          {FINANCE.map(navLink)}
          {!collapsed ? (
            <p className="px-2.5 pb-2 pt-6 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-rail-fg-3">{t("nav.sectionTools")}</p>
          ) : (
            <div className="mx-2 my-3 h-px bg-white/10" />
          )}
          {TOOLS.map(navLink)}
          {navLink(SETTINGS)}
        </nav>

        <div className="p-4">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1">
              <button onClick={themeToggle} className="rounded-[9px] p-2 text-rail-fg-3 transition-colors hover:bg-white/[0.06] hover:text-rail-fg" aria-label={t("nav.theme")}>
                {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button onClick={toggleCollapsed} className="rounded-[9px] p-2 text-rail-fg-3 transition-colors hover:bg-white/[0.06] hover:text-rail-fg" aria-label={t("nav.expand")} title={t("nav.expand")}>
                <PanelLeftOpen size={16} />
              </button>
            </div>
          ) : (
            <div className="girih rail-girih overflow-hidden rounded-[14px] bg-[var(--rail-card)] p-3.5 shadow-[inset_0_0_0_1px_rgba(160,190,255,0.14)]">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-rail-fg-3">{t("nav.theme")}</span>
                <ThemeSwitch />
              </div>
              <button
                onClick={() => setPaletteOpen(true)}
                className="mt-3 flex h-8 w-full items-center justify-between rounded-[9px] bg-white/[0.05] px-2.5 text-[12px] font-medium text-rail-fg-2 shadow-[inset_0_0_0_1px_rgba(160,190,255,0.12)] transition-colors hover:text-rail-fg"
              >
                <span className="flex items-center gap-1.5"><Search size={13} />{t("shortcuts.palette")}</span>
                <span className="font-mono text-[10px] text-rail-fg-3">Ctrl K</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {mode === "demo" && (
          <div className="no-print flex items-center justify-center gap-2.5 border-b border-ai/20 bg-ai-soft px-4 py-2 text-[12.5px] font-medium text-fg">
            <Khatam size={11} className="shrink-0 text-ai" />
            <span className="min-w-0 truncate sm:whitespace-normal">{t("demo.banner")}</span>
            <button onClick={() => void setMode("personal")} className="shrink-0 rounded-[7px] px-2 py-0.5 font-semibold text-ai transition-colors hover:bg-ai/15">
              {t("demo.exit")}
            </button>
          </div>
        )}

        <header
          className={cn(
            "no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-bg/95 px-4 backdrop-blur-sm transition-[border-color] duration-200 md:h-[74px] md:px-10",
            scrolled ? "border-line" : "border-line md:border-transparent",
          )}
        >
          <Link href="/" aria-label={t("app.name")} className="md:hidden">
            <LogoMark size={24} />
          </Link>
          <span className="display ml-1 min-w-0 truncate text-[17px] font-semibold text-fg md:hidden">{current ? t(current.label) : ""}</span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden h-[42px] w-[min(420px,36vw)] min-w-0 items-center gap-2.5 rounded-[12px] border border-line bg-surface px-3.5 text-[13.5px] text-fg-3 transition-colors hover:border-line-strong md:flex"
          >
            <Search size={16} className="shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{t("palette.placeholder")}</span>
            <Kbd>Ctrl K</Kbd>
          </button>
          <div className="flex-1" />
          <button onClick={() => setPaletteOpen(true)} className="rounded-[10px] p-2 text-fg-2 hover:bg-surface-2 md:hidden" aria-label={t("common.search")}>
            <Search size={18} />
          </button>
          <SyncIndicator />
          <NotificationBell />
          <button onClick={themeToggle} className="rounded-[10px] p-2.5 text-fg-2 transition-colors hover:bg-surface-2 hover:text-fg" aria-label={t("nav.theme")} title={t("nav.theme")}>
            <motion.span key={resolvedTheme} initial={{ rotate: -40, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="block">
              {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </motion.span>
          </button>
          <button
            onClick={() => openQuickAdd({ ai: true })}
            className="hidden h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-ai-soft px-3 text-[13px] font-semibold text-ai transition-colors hover:brightness-95 md:flex xl:px-3.5"
            title={`${t("palette.aiEntry")} (A)`}
            aria-label={t("palette.aiEntry")}
          >
            <Sparkles size={15} />
            <span className="hidden xl:inline">{t("palette.aiEntry")}</span>
          </button>
        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-[calc(108px+env(safe-area-inset-bottom))] pt-5 md:px-10 md:pb-14 md:pt-9 2xl:max-w-[1400px]">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 bg-bg-2/95 pb-safe shadow-[0_-1px_0_var(--border)] backdrop-blur-md md:hidden" aria-label="Main">
        <div className="relative mx-auto grid h-[68px] max-w-md grid-cols-5 items-center">
          {mobileTabs.slice(0, 2).map((n) => (
            <TabLink key={n.href} href={n.href} label={t(n.label)} active={isActive(pathname, n.href)} icon={<n.icon size={22} strokeWidth={1.9} />} />
          ))}
          <div className="flex justify-center">
            <button
              onClick={() => openQuickAdd({ type: "expense" })}
              className="-mt-9 flex size-14 rotate-45 items-center justify-center rounded-[17px] bg-brand-fill text-white shadow-[0_0_0_6px_var(--bg),0_14px_28px_-10px_var(--brand-fill)] transition-transform duration-150 active:scale-90"
              aria-label={t("quick.title")}
            >
              <Plus size={26} strokeWidth={2.3} className="-rotate-45" />
            </button>
          </div>
          {mobileTabs.slice(2, 3).map((n) => (
            <TabLink key={n.href} href={n.href} label={t(n.label)} active={isActive(pathname, n.href)} icon={<n.icon size={22} strokeWidth={1.9} />} />
          ))}
          <TabButton
            onClick={() => setMoreOpen(true)}
            active={["/wallets", "/budgets", "/goals", "/strategies", "/progress", "/advisor", "/settings"].some((h) => isActive(pathname, h))}
            label={t("nav.more")}
            icon={<Ellipsis size={22} strokeWidth={1.9} />}
          />
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("nav.more")}>
        <div className="grid grid-cols-3 gap-2 pb-2">
          {NAV.filter((n) => !mobileTabs.slice(0, 3).includes(n)).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-[14px] border px-2 py-4 text-center text-[12px] font-semibold transition-colors",
                isActive(pathname, n.href) ? "border-brand-line bg-brand-soft text-fg" : "border-line bg-surface text-fg-2",
              )}
            >
              <n.icon size={20} className={n.href === "/advisor" ? "text-ai" : "text-brand"} />
              {t(n.label)}
            </Link>
          ))}
          <button onClick={(e) => toggleTheme({ x: e.clientX, y: e.clientY })} className="flex flex-col items-center gap-2 rounded-[14px] border border-line bg-surface px-2 py-4 text-[12px] font-semibold text-fg-2">
            {resolvedTheme === "dark" ? <Sun size={20} className="text-brand" /> : <Moon size={20} className="text-brand" />}
            {t("nav.theme")}
          </button>
          {mode === "demo" && (
            <button onClick={() => void setMode("personal")} className="flex flex-col items-center gap-2 rounded-[14px] bg-ai-soft px-2 py-4 text-[12px] font-semibold text-ai">
              <FlaskConical size={20} />
              {t("demo.exit")}
            </button>
          )}
        </div>
      </Sheet>

      <QuickAdd />
      <CommandPalette />
      <Toaster />
      <PwaManager />
      <IntelligenceWatcher />
    </div>
  );
}

function ThemeSwitch() {
  const { resolvedTheme, setThemePref } = useApp();
  return (
    <div className="relative flex rounded-[9px] bg-white/[0.06] p-0.5">
      {(["light", "dark"] as const).map((v) => (
        <button
          key={v}
          onClick={(e) => setThemePref(v, { x: e.clientX, y: e.clientY })}
          aria-pressed={resolvedTheme === v}
          aria-label={v}
          className={cn("relative flex h-[26px] w-[30px] items-center justify-center rounded-[7px] transition-colors", resolvedTheme === v ? (v === "light" ? "text-[#071330]" : "text-white") : "text-rail-fg-2 hover:text-rail-fg")}
        >
          {resolvedTheme === v && <motion.span layoutId="theme-pill" className={cn("absolute inset-0 rounded-[7px]", v === "light" ? "bg-white" : "bg-[#1A2C5C]")} transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          {v === "light" ? <Sun size={14} className="relative" /> : <Moon size={14} className="relative" />}
        </button>
      ))}
    </div>
  );
}

function TabLink({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("relative flex h-full flex-col items-center justify-start gap-1 pt-3 text-[10.5px] font-semibold transition-colors", active ? "text-fg" : "text-fg-3")}>
      {active && <motion.span layoutId="tab-active" className="absolute top-0 h-[3px] w-6 rounded-b-full bg-brand" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
      <span className={cn("transition-colors", active && "text-brand")}>{icon}</span>
      <span className="max-w-[72px] truncate">{label}</span>
    </Link>
  );
}

function TabButton({ onClick, active, label, icon }: { onClick: () => void; active: boolean; label: string; icon: ReactNode }) {
  return (
    <button onClick={onClick} className={cn("relative flex h-full flex-col items-center justify-start gap-1 pt-3 text-[10.5px] font-semibold transition-colors", active ? "text-fg" : "text-fg-3")}>
      {active && <span className="absolute top-0 h-[3px] w-6 rounded-b-full bg-brand" />}
      <span className={cn(active && "text-brand")}>{icon}</span>
      {label}
    </button>
  );
}
