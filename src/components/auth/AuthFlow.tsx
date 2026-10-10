"use client";
// Knight FM — AuthFlow (Task 2-a): full authentication experience.
// View state machine: login → register → verify → forgot → reset.
// Premium dark panel (knight-emerald accent), shadcn/ui, i18n via auth namespace,
// captcha helper, zustand session store. Responsive single column, max-w-md.

import "@/lib/i18n/dict/auth";

import React, { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Globe,
  Info,
  KeyRound,
  Loader2,
  MailCheck,
  Palette,
  ShieldCheck,
  X,
} from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { KnightLogo } from "@/components/knight-logo";
import { useTheme } from "@/components/theme-provider";
import { LANGUAGES, THEMES, type Language, type ThemeId } from "@/lib/themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { useAuth, apiFetch, ApiError } from "./store";
import { getCaptchaToken } from "./captcha";

// Convenience re-exports for sibling modules.
export { useAuth, apiFetch };

type View = "login" | "register" | "verify" | "forgot" | "reset";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Maps typed API errors to translated, user-safe messages (never leaks enumeration). */
function describeError(err: unknown, t: TFn): string {
  // Captcha widget failures (script blocked by CSP/ad-blocker, timeout, widget
  // error) surface as plain Errors with a TURNSTILE_ prefix — give them an
  // actionable message instead of the generic one.
  if (err instanceof Error && err.message.startsWith("TURNSTILE_")) {
    return t("auth.err.captchaUnavailable");
  }
  if (err instanceof ApiError) {
    const secs = typeof err.extra?.retryAfterSec === "number" ? (err.extra.retryAfterSec as number) : 60;
    switch (err.code) {
      case "CAPTCHA_INVALID":
        return t("auth.err.captcha");
      case "REGISTER_CONFLICT":
        return t("auth.err.conflict");
      // Task 39 (anti-multicuenta): the platform allows exactly one account per IP.
      case "MULTI_ACCOUNT_BLOCKED":
        return t("auth.err.multiAccount");
      // Task 41 (anti-multicuenta, USER MANDATE): 2+ accounts on the same IP
      // within the configured window (default 30 days) → every involved
      // account is auto-blocked; the unlock is admin-only. Blocked accounts
      // (multi-account or manual) never get a session back on their own.
      case "MULTI_ACCOUNT_IP_BLOCKED":
        return t("auth.err.multiAccountIp");
      case "ACCOUNT_BLOCKED":
        return t("auth.err.accountBlocked");
      case "INVALID_CREDENTIALS":
        return t("auth.err.invalidCredentials");
      case "EMAIL_NOT_VERIFIED":
        return t("auth.err.emailNotVerified");
      case "LOCKED":
        return t("auth.err.locked", { secs });
      case "RATE_LIMITED":
        return t("auth.err.rateLimited", { secs });
      case "PASSWORD_POLICY":
        return t(err.message || "auth.err.policy");
      case "TOKEN_INVALID":
        return t("auth.err.tokenInvalid");
      // Task 27-f: maintenance gate on login — show the server's configured
      // message verbatim, falling back to the generic maintenance notice.
      case "MAINTENANCE":
        return err.message || t("err.maintenance");
      default:
        return t("auth.err.generic");
    }
  }
  return t("auth.err.generic");
}

// ─── Password policy checklist (live) ─────────────────────────────

interface PolicyCheck {
  key: string;
  ok: boolean;
}

function policyChecks(pw: string): PolicyCheck[] {
  return [
    { key: "auth.policy.length", ok: pw.length >= 12 },
    { key: "auth.policy.upper", ok: /[A-Z]/.test(pw) },
    { key: "auth.policy.lower", ok: /[a-z]/.test(pw) },
    { key: "auth.policy.digit", ok: /[0-9]/.test(pw) },
    { key: "auth.policy.symbol", ok: /[^A-Za-z0-9]/.test(pw) },
  ];
}

function PolicyList({ pw }: { pw: string }) {
  const { t } = useI18n();
  const checks = useMemo(() => policyChecks(pw), [pw]);
  if (!pw) return null;
  return (
    <div className="mt-2 space-y-1" aria-live="polite">
      <p className="text-xs font-medium text-muted-foreground">{t("auth.policy.title")}</p>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-1.5 text-xs">
            {c.ok ? (
              <Check className="size-3.5 text-primary" aria-hidden="true" />
            ) : (
              <X className="size-3.5 text-muted-foreground/60" aria-hidden="true" />
            )}
            <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{t(c.key)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Spinner button label ─────────────────────────────────────────

function SubmitLabel({ busy, label }: { busy: boolean; label: string }) {
  return (
    <>
      {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {busy ? "" : label}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────

export default function AuthFlow() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const loginAction = useAuth((s) => s.login);

  const [view, setView] = useState<View>("login");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ref, setRef] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  // Console-transport fallbacks: when email delivery is not configured the API
  // returns the code/token so the flow stays completable on-premise.
  const [devCode, setDevCode] = useState("");
  const [devToken, setDevToken] = useState("");
  // True after a reset request that ran in console mode (no email provider) —
  // the UI then uses honest sandbox wording instead of "we emailed you".
  const [noEmailProvider, setNoEmailProvider] = useState(false);

  const reportError = useCallback(
    (err: unknown) => {
      const msg = describeError(err, t);
      setFormError(msg);
      toast({ title: msg, variant: "destructive" });
    },
    [t, toast]
  );

  const doLogin = useCallback(
    async (mail: string, pw: string) => {
      const captchaToken = await getCaptchaToken();
      const user = await loginAction(mail, pw, captchaToken);
      toast({
        title: t("auth.ok.loggedIn"),
        description: t("auth.welcome.back", { name: user.username }),
      });
    },
    [loginAction, t, toast]
  );

  // ── Handlers ────────────────────────────────────────────────────

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await doLogin(email.trim(), password);
      setPassword("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setPendingEmail(email.trim());
        setView("verify");
        toast({ title: t("auth.err.emailNotVerified"), variant: "destructive" });
      } else {
        reportError(err);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const captchaToken = await getCaptchaToken();
      const res = await apiFetch<{ email: string; devCode?: string }>("/api/auth/register", {
        method: "POST",
        body: {
          email: email.trim(),
          username: username.trim(),
          password,
          captchaToken,
          ...(ref.trim() ? { ref: ref.trim() } : {}),
        },
      });
      setPendingEmail(email.trim());
      if (res?.devCode) {
        setDevCode(res.devCode);
        setCode(res.devCode);
      } else {
        setDevCode("");
      }
      setView("verify");
      toast({ title: t("auth.ok.registered") });
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await apiFetch("/api/auth/verify-email", {
        method: "POST",
        body: { email: pendingEmail, code: code.trim() },
      });
      toast({ title: t("auth.ok.verified") });
      setDevCode("");
      try {
        await doLogin(pendingEmail, password);
        setPassword("");
        setCode("");
      } catch {
        setView("login");
      }
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setFormError("");
    try {
      const captchaToken = await getCaptchaToken();
      const res = await apiFetch<{ sent: boolean; devCode?: string }>("/api/auth/resend-verification", {
        method: "POST",
        body: { email: pendingEmail, captchaToken },
      });
      if (res?.devCode) {
        setDevCode(res.devCode);
        setCode(res.devCode);
      }
      toast({ title: t("auth.ok.codeSent") });
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const captchaToken = await getCaptchaToken();
      const res = await apiFetch<{ sent: boolean; devToken?: string; provider?: "console" | "email" }>(
        "/api/auth/password-reset/request",
        {
          method: "POST",
          body: { email: email.trim(), captchaToken },
        }
      );
      const consoleMode = res?.provider === "console";
      setNoEmailProvider(consoleMode);
      if (res?.devToken) {
        setDevToken(res.devToken);
        setResetToken(res.devToken);
      } else {
        setDevToken("");
      }
      // Console mode gets an honest toast: nothing is emailed — the token (if
      // the account exists) shows on the next screen.
      toast({ title: t(consoleMode ? "auth.ok.resetSentConsole" : "auth.ok.resetSent") });
      setView("reset");
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await apiFetch("/api/auth/password-reset/confirm", {
        method: "POST",
        body: { token: resetToken.trim(), newPassword: password },
      });
      toast({ title: t("auth.ok.resetDone") });
      setResetToken("");
      setDevToken("");
      setNoEmailProvider(false);
      setPassword("");
      setView("login");
    } catch (err) {
      reportError(err);
    } finally {
      setBusy(false);
    }
  };

  // ── Sub-renders ─────────────────────────────────────────────────

  const selectors = (
    <div className="flex items-center gap-2">
      <Select value={lang} onValueChange={(v) => setLang(v as Language)}>
        <SelectTrigger
          size="sm"
          className="w-[118px] border-border/60 bg-card/40 text-xs"
          aria-label={t("auth.langLabel")}
        >
          <Globe className="size-3.5 text-primary" aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l.id} value={l.id} className="text-xs">
              {l.flag} {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={theme} onValueChange={(v) => setTheme(v as ThemeId)}>
        <SelectTrigger
          size="sm"
          className="w-[118px] border-border/60 bg-card/40 text-xs"
          aria-label={t("auth.themeLabel")}
        >
          <Palette className="size-3.5 text-primary" aria-hidden="true" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THEMES.map((th) => (
            <SelectItem key={th.id} value={th.id} className="text-xs">
              {t(`auth.theme.${th.id}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const panelHeader = (
    <CardHeader className="space-y-3 text-center">
      <KnightLogo size={64} priority className="mx-auto drop-shadow-[0_0_28px_rgba(16,185,129,0.35)]" />
      <div className="space-y-1.5">
        <CardTitle className="text-xl font-semibold tracking-tight">{t("auth.panelTitle")}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">{t("auth.panelSubtitle")}</CardDescription>
      </div>
    </CardHeader>
  );

  const sandboxHint = (text: string) => (
    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );

  const authTabs =
    view === "login" || view === "register" ? (
      <Tabs value={view} onValueChange={(v) => setView(v as View)} className="px-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t("auth.tab.login")}</TabsTrigger>
          <TabsTrigger value="register">{t("auth.tab.register")}</TabsTrigger>
        </TabsList>
      </Tabs>
    ) : null;

  const backToLoginButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="w-full text-muted-foreground hover:text-foreground"
      onClick={() => {
        setFormError("");
        setView("login");
      }}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t("auth.action.backToLogin")}
    </Button>
  );

  // ── Forms ───────────────────────────────────────────────────────

  const loginForm = (
    <form onSubmit={handleLogin} className="space-y-4" noValidate>
      <div className="space-y-1.5 text-center">
        <h2 className="text-lg font-semibold">{t("auth.login.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.login.desc")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-email">{t("auth.field.email")}</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder={t("auth.placeholder.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">{t("auth.field.password")}</Label>
          <button
            type="button"
            className="text-xs text-primary underline-offset-4 hover:underline"
            onClick={() => {
              setFormError("");
              setView("forgot");
            }}
          >
            {t("auth.forgot.title")}
          </button>
        </div>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder={t("auth.placeholder.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy}>
        <SubmitLabel busy={busy} label={t("auth.action.login")} />
      </Button>
    </form>
  );

  const registerForm = (
    <form onSubmit={handleRegister} className="space-y-4" noValidate>
      <div className="space-y-1.5 text-center">
        <h2 className="text-lg font-semibold">{t("auth.register.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.register.desc")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-email">{t("auth.field.email")}</Label>
        <Input
          id="reg-email"
          type="email"
          autoComplete="email"
          placeholder={t("auth.placeholder.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-username">{t("auth.field.username")}</Label>
        <Input
          id="reg-username"
          type="text"
          autoComplete="username"
          placeholder={t("auth.placeholder.username")}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={24}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-password">{t("auth.field.password")}</Label>
        <Input
          id="reg-password"
          type="password"
          autoComplete="new-password"
          placeholder={t("auth.placeholder.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PolicyList pw={password} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reg-ref">
          {t("auth.field.referral")} <span className="text-xs text-muted-foreground">({t("common.optional")})</span>
        </Label>
        <Input
          id="reg-ref"
          type="text"
          placeholder={t("auth.placeholder.referral")}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("auth.referral.note")}</p>
      </div>
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy}>
        <SubmitLabel busy={busy} label={t("auth.action.register")} />
      </Button>
    </form>
  );

  const verifyForm = (
    <form onSubmit={handleVerify} className="space-y-4" noValidate>
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
        <MailCheck className="size-6 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-1.5 text-center">
        <h2 className="text-lg font-semibold">{t("auth.verify.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.verify.desc", { email: pendingEmail })}</p>
      </div>
      {devCode && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300"
          role="status"
        >
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
          <span>
            {t("auth.verify.devBanner", { code: devCode })}{" "}
            <span className="font-mono text-sm font-bold tracking-[0.3em] text-amber-200">{devCode}</span>
          </span>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="verify-code" className="sr-only">
          {t("auth.field.code")}
        </Label>
        <Input
          id="verify-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t("auth.placeholder.code")}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="text-center text-lg font-semibold tracking-[0.4em]"
          maxLength={6}
          required
        />
      </div>
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy || code.length !== 6}>
        <SubmitLabel busy={busy} label={t("auth.action.verify")} />
      </Button>
      <Button
        type="button"
        variant="outline"
        className="w-full border-border/60"
        onClick={handleResend}
        disabled={busy}
      >
        {busy ? t("auth.action.resending") : t("auth.action.resend")}
      </Button>
      {sandboxHint(t("auth.verify.hint"))}
      {backToLoginButton}
    </form>
  );

  const forgotForm = (
    <form onSubmit={handleForgot} className="space-y-4" noValidate>
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
        <KeyRound className="size-6 text-primary" aria-hidden="true" />
      </div>
      <div className="space-y-1.5 text-center">
        <h2 className="text-lg font-semibold">{t("auth.forgot.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.forgot.desc")}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="forgot-email">{t("auth.field.email")}</Label>
        <Input
          id="forgot-email"
          type="email"
          autoComplete="email"
          placeholder={t("auth.placeholder.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy}>
        <SubmitLabel busy={busy} label={t("auth.action.forgot")} />
      </Button>
      {sandboxHint(t("auth.forgot.hint"))}
      {backToLoginButton}
    </form>
  );

  const resetForm = (
    <form onSubmit={handleReset} className="space-y-4" noValidate>
      <div className="space-y-1.5 text-center">
        <h2 className="text-lg font-semibold">{t("auth.reset.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("auth.reset.desc")}</p>
      </div>
      {devToken && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300"
          role="status"
        >
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
          <span>
            {t("auth.reset.devBanner", { token: devToken })}{" "}
            <span className="break-all font-mono text-sm font-bold text-amber-200">{devToken}</span>
          </span>
        </div>
      )}
      {!devToken && noEmailProvider && (
        <div
          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300"
          role="note"
        >
          <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden="true" />
          <span>{t("auth.reset.noTokenConsole")}</span>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="reset-token">{t("auth.field.token")}</Label>
        <Input
          id="reset-token"
          type="text"
          placeholder={t("auth.placeholder.token")}
          value={resetToken}
          onChange={(e) => setResetToken(e.target.value)}
          autoComplete="off"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reset-password">{t("auth.field.newPassword")}</Label>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          placeholder={t("auth.placeholder.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <PolicyList pw={password} />
      </div>
      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy}>
        <SubmitLabel busy={busy} label={t("auth.action.reset")} />
      </Button>
      {backToLoginButton}
    </form>
  );

  const body =
    view === "login"
      ? loginForm
      : view === "register"
        ? registerForm
        : view === "verify"
          ? verifyForm
          : view === "forgot"
            ? forgotForm
            : resetForm;

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#070c0a] px-4 py-10 text-foreground">
      {/* Ambient emerald glow (knight-emerald accent) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px 300px at 50% 0%, rgba(16,185,129,0.12), transparent 70%), radial-gradient(800px 500px at 50% 110%, rgba(16,185,129,0.06), transparent 70%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="mb-4 flex justify-end">{selectors}</div>
        <Card className="border-border/60 bg-card/80 shadow-2xl shadow-black/40 backdrop-blur">
          {panelHeader}
          {authTabs}
          <CardContent className="pt-6">
            <ShieldCheck className="sr-only" aria-hidden="true" />
            {body}
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          Knight FM · {t("app.name")} — {t("app.tagline")}
        </p>
      </motion.div>
    </main>
  );
}
