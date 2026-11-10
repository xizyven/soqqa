"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Moon, Search, Sparkles, FlaskConical } from "lucide-react";
import { useApp } from "../providers/app-provider";
import { NAV } from "./nav";
import { cn, Kbd } from "../ui/primitives";

interface Cmd {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useApp();
  return (
    <AnimatePresence>
      {paletteOpen && (
        <div className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[12vh]" onKeyDown={(e) => e.key === "Escape" && setPaletteOpen(false)}>
          <motion.div data-overlay className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-[3px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPaletteOpen(false)} />
          <PaletteBody />
        </div>
      )}
    </AnimatePresence>
  );
}

/** Mounted only while open, so the query and selection start fresh each time. */
function PaletteBody() {
  const { setPaletteOpen, t, openQuickAdd, repo, resolvedTheme, mode, setMode } = useApp();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const commands = useMemo<Cmd[]>(() => {
    const close = () => setPaletteOpen(false);
    const nav: Cmd[] = NAV.map((n) => ({
      id: n.href,
      label: t(n.label),
      group: t("palette.navigation"),
      icon: <n.icon size={16} />,
      hint: `G ${n.key.toUpperCase()}`,
      run: () => {
        router.push(n.href);
        close();
      },
    }));
    const actions: Cmd[] = [
      { id: "new-expense", label: t("palette.newExpense"), group: t("palette.actions"), icon: <ArrowUpRight size={16} className="text-expense" />, hint: "N", run: () => (close(), openQuickAdd({ type: "expense" })) },
      { id: "new-income", label: t("palette.newIncome"), group: t("palette.actions"), icon: <ArrowDownLeft size={16} className="text-income" />, run: () => (close(), openQuickAdd({ type: "income" })) },
      { id: "new-transfer", label: t("palette.newTransfer"), group: t("palette.actions"), icon: <ArrowLeftRight size={16} className="text-accent" />, run: () => (close(), openQuickAdd({ type: "transfer" })) },
      { id: "ai", label: t("palette.aiEntry"), group: t("palette.actions"), icon: <Sparkles size={16} className="text-ai" />, hint: "A", run: () => (close(), openQuickAdd({ ai: true })) },
      {
        id: "theme",
        label: t("palette.toggleTheme"),
        group: t("palette.actions"),
        icon: <Moon size={16} />,
        run: () => {
          close();
          void repo.savePreferences({ theme: resolvedTheme === "dark" ? "light" : "dark" });
        },
      },
      {
        id: "demo",
        label: mode === "demo" ? t("demo.exit") : t("demo.load"),
        group: t("palette.actions"),
        icon: <FlaskConical size={16} className="text-ai" />,
        run: () => {
          close();
          void setMode(mode === "demo" ? "personal" : "demo");
        },
      },
    ];
    return [...actions, ...nav];
  }, [t, router, setPaletteOpen, openQuickAdd, repo, resolvedTheme, mode, setMode]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? commands.filter((c) => c.label.toLowerCase().includes(s)) : commands;
  }, [q, commands]);

  return (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("shortcuts.palette")}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="relative w-full max-w-[580px] overflow-hidden rounded-[20px] border border-line-strong bg-surface shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={16} className="text-fg-3" />
              <input
                autoFocus
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setIdx((i) => Math.min(filtered.length - 1, i + 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setIdx((i) => Math.max(0, i - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    filtered[idx]?.run();
                  }
                }}
                placeholder={t("palette.placeholder")}
                className="h-13 w-full bg-transparent py-4 text-[15px] text-fg outline-none placeholder:text-fg-3"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={filtered[idx] ? `cmd-${filtered[idx].id}` : undefined}
              />
              <Kbd>Esc</Kbd>
            </div>
            <ul id="palette-list" role="listbox" className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 && <li className="px-3 py-8 text-center text-sm text-fg-3">{t("palette.empty")}</li>}
              {filtered.map((c, i) => (
                <li key={c.id}>
                  {(i === 0 || filtered[i - 1].group !== c.group) && <div className="eyebrow px-3 pb-1.5 pt-3">{c.group}</div>}
                  <button
                    id={`cmd-${c.id}`}
                    role="option"
                    aria-selected={i === idx}
                    onMouseEnter={() => setIdx(i)}
                    onClick={c.run}
                    className={cn("flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left text-sm font-medium transition-colors duration-100", i === idx ? "bg-brand-soft text-fg" : "text-fg-2")}
                  >
                    <span className="text-fg-2">{c.icon}</span>
                    <span className="flex-1">{c.label}</span>
                    {c.hint && <span className="font-mono text-[10px] text-fg-3">{c.hint}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
  );
}
