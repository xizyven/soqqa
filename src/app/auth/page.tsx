"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, CloudOff, LogIn, LogOut, MailCheck, UserPlus } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { BrandSplit } from "@/components/brand/brand-split";
import { AppIcon } from "@/components/brand/logo";
import { IslimiDivider } from "@/components/brand/ornaments";
import { Button, Field, Input, Segmented } from "@/components/ui/primitives";
import { getSupabase } from "@/lib/supabase/client";

/** Email sign-in / sign-up for cloud sync. Local mode keeps working without it. */
export default function AuthPage() {
  const { t, auth } = useApp();
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { error: err, data } = tab === "in" ? await sb.auth.signInWithPassword({ email, password }) : await sb.auth.signUp({ email, password });
    setBusy(false);
    if (err) return setError(err.message);
    if (tab === "up" && !data.session) return setSent(true);
    router.replace("/settings");
  };

  return (
    <BrandSplit>
      <Link href="/settings" className="mb-8 flex w-fit items-center gap-1.5 text-[13px] font-semibold text-fg-3 transition-colors hover:text-fg">
        <ArrowLeft size={15} />
        {t("common.back")}
      </Link>
      <AppIcon size={56} />
      <h1 className="display mt-6 text-[30px] font-semibold leading-tight text-fg">{auth.session ? t("settings.account") : tab === "in" ? t("settings.signIn") : t("settings.signUp")}</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{t("settings.authHint")}</p>

      <div className="mt-8">
        {!auth.configured ? (
          <div className="card flex items-start gap-3 p-4 text-[13.5px] leading-relaxed text-fg-2">
            <CloudOff size={18} className="mt-0.5 shrink-0 text-fg-3" />
            {t("settings.cloudNotConfigured")}
          </div>
        ) : auth.session ? (
          <div className="card flex flex-col gap-4 p-5">
            <p className="text-[14px] text-fg">{t("settings.signedInAs", { email: auth.session.user.email ?? "" })}</p>
            <Button variant="secondary" icon={<LogOut size={15} />} onClick={() => void getSupabase()?.auth.signOut()}>{t("settings.signOut")}</Button>
          </div>
        ) : sent ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card flex items-start gap-3 p-5 text-[14px] text-fg">
            <MailCheck size={20} className="mt-0.5 shrink-0 text-income" />
            {t("settings.checkEmail")}
          </motion.div>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <Segmented className="w-full" value={tab} onChange={setTab} options={[{ value: "in", label: t("settings.signIn") }, { value: "up", label: t("settings.signUp") }]} />
            <Field label={t("settings.email")} htmlFor="auth-email">
              <Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("settings.password")} htmlFor="auth-pass">
              <Input id="auth-pass" type="password" autoComplete={tab === "in" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <AnimatePresence>
              {error && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="text-[13px] font-medium text-expense" role="alert">
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
            <Button type="submit" variant="primary" size="lg" loading={busy} icon={tab === "in" ? <LogIn size={16} /> : <UserPlus size={16} />}>
              {tab === "in" ? t("settings.signIn") : t("settings.signUp")}
            </Button>
          </form>
        )}
      </div>

      <IslimiDivider className="my-8" />
      <p className="text-[12.5px] leading-relaxed text-fg-3">{t("sync.localHint")}</p>
    </BrandSplit>
  );
}
