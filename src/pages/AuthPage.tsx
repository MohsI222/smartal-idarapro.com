import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { consumeAuthAttempt } from "@/lib/authClientRateLimit";

type FieldKey = "name" | "email" | "password" | null;

function scrollToField(el: HTMLElement | null) {
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * صفحة مصادقة موحّدة: تبديل واضح بين تسجيل الدخول وإنشاء الحساب، مع دعم Supabase والخادم.
 */
export function AuthPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const { login, register, token, loading } = useAuth();
  const { t } = useI18n();

  const isRegister = pathname === "/register";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [err, setErr] = useState("");
  const [fieldErr, setFieldErr] = useState<FieldKey>(null);

  const nameWrapRef = useRef<HTMLDivElement>(null);
  const emailWrapRef = useRef<HTMLDivElement>(null);
  const passwordWrapRef = useRef<HTMLDivElement>(null);

  const nextParam = searchParams.get("next")?.trim();
  const refFromUrl = searchParams.get("ref")?.trim() ?? "";
  const trialMode = searchParams.get("trial") === "1";

  const loginQs = new URLSearchParams();
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    loginQs.set("next", nextParam);
  }
  const loginHref = `/login${loginQs.toString() ? `?${loginQs}` : ""}`;

  const registerQs = new URLSearchParams();
  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    registerQs.set("next", nextParam);
  }
  if (refFromUrl) registerQs.set("ref", refFromUrl);
  if (trialMode) registerQs.set("trial", "1");
  const registerHref = `/register${registerQs.toString() ? `?${registerQs}` : ""}`;

  useEffect(() => {
    setErr("");
    setFieldErr(null);
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060d18] text-slate-400">
        {t("common.loading")}
      </div>
    );
  }
  if (token) {
    if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
      return <Navigate to={nextParam} replace />;
    }
    return <Navigate to="/app" replace />;
  }

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setFieldErr(null);

    if (!email.trim()) {
      setFieldErr("email");
      scrollToField(emailWrapRef.current);
      toast.error(t("validation.fillField", { field: t("auth.email") }));
      return;
    }
    if (!password) {
      setFieldErr("password");
      scrollToField(passwordWrapRef.current);
      toast.error(t("validation.fillField", { field: t("auth.password") }));
      return;
    }

    try {
      await login(email, password, rememberMe);
      const next = searchParams.get("next")?.trim();
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        navigate(next);
      } else {
        navigate("/app");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("auth.errLogin");
      if (msg.includes("DEVICE_LIMIT") || msg.includes("3")) {
        setErr(t("auth.errDevice"));
      } else {
        setErr(msg);
      }
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setFieldErr(null);

    if (!name.trim()) {
      setFieldErr("name");
      scrollToField(nameWrapRef.current);
      toast.error(t("validation.fillField", { field: t("auth.fullName") }));
      return;
    }
    if (!email.trim()) {
      setFieldErr("email");
      scrollToField(emailWrapRef.current);
      toast.error(t("validation.fillField", { field: t("auth.email") }));
      return;
    }
    if (!password) {
      setFieldErr("password");
      scrollToField(passwordWrapRef.current);
      toast.error(t("validation.fillField", { field: t("auth.password") }));
      return;
    }
    if (password.length < 6) {
      setFieldErr("password");
      scrollToField(passwordWrapRef.current);
      toast.error(t("validation.passwordMin"));
      return;
    }

    const rl = consumeAuthAttempt("register");
    if (!rl.ok) {
      const minutes = String(Math.max(1, Math.ceil(rl.retryAfterMs / 60000)));
      toast.error(t("auth.rateLimitClient", { minutes }));
      return;
    }

    try {
      const res = await register(email, password, name, {
        referralCode: refFromUrl || undefined,
        startTrial: trialMode,
      });
      if (res?.needsEmailConfirmation) {
        toast.success(t("auth.checkEmail"));
        return;
      }
      if (res?.whatsappNotifyUrl && typeof window !== "undefined") {
        window.open(res.whatsappNotifyUrl, "_blank", "noopener,noreferrer");
      }
      const next = searchParams.get("next")?.trim();
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        navigate(next);
      } else {
        navigate("/app");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("auth.errGeneric"));
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#030711]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(0,82,204,0.35),transparent_55%),radial-gradient(ellipse_80%_50%_at_100%_50%,rgba(249,115,22,0.12),transparent_50%)]"
        aria-hidden
      />
      <div className="relative z-10 flex flex-col flex-1 items-center justify-center p-4 gap-6 pb-12">
        <div className="w-full max-w-md flex justify-between items-center gap-3">
          <Link to="/" className="flex items-center gap-2 min-w-0 group">
            <img
              src="/logo.svg"
              alt=""
              width={40}
              height={40}
              className="size-10 rounded-lg border border-white/10 bg-[#0c1929]/80 shadow-lg shrink-0"
            />
            <div className="min-w-0 text-start">
              <span className="block font-black text-lg sm:text-xl bg-gradient-to-l from-[#FF8C00] via-[#ffa033] to-[#0052CC] bg-clip-text text-transparent leading-tight truncate">
                سمارت الإدارة برو
              </span>
              <span className="block text-[10px] text-slate-500 truncate">{t("brand.tagline")}</span>
            </div>
          </Link>
          <LanguageSwitcher />
        </div>

        <Card className="w-full max-w-md border-slate-700/80 bg-[#0a1628]/80 backdrop-blur-xl shadow-2xl shadow-black/40 ring-1 ring-white/[0.06]">
          <CardHeader className="space-y-4 pb-2 text-center">
            <div
              className="flex rounded-2xl border border-slate-600/60 bg-[#050a12]/90 p-1 gap-1"
              role="tablist"
              aria-label={t("auth.modeToggleLabel")}
            >
              <Link
                to={loginHref}
                role="tab"
                aria-selected={!isRegister}
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-sm font-bold transition-all text-center",
                  !isRegister
                    ? "bg-gradient-to-l from-[#0052CC] to-[#003d99] text-white shadow-lg shadow-[#0052CC]/25"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {t("auth.loginTab")}
              </Link>
              <Link
                to={registerHref}
                role="tab"
                aria-selected={isRegister}
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-sm font-bold transition-all text-center",
                  isRegister
                    ? "bg-gradient-to-l from-[#FF8C00]/95 to-[#0052CC]/90 text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                {t("auth.registerTab")}
              </Link>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {isRegister ? t("auth.registerTitle") : t("auth.loginTitle")}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {isRegister ? t("auth.registerSubtitle") : t("auth.loginSubtitle")}
              </p>
            </div>
            {isRegister && refFromUrl && (
              <p className="text-center text-xs text-emerald-400/90">كود إحالة: {refFromUrl}</p>
            )}
            {isRegister && trialMode && (
              <p className="text-center text-xs text-amber-400 font-bold">تجربة 5 أيام مجاناً</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
            {!isRegister ? (
              <form onSubmit={(e) => void submitLogin(e)} className="space-y-4" noValidate>
                <div ref={emailWrapRef}>
                  <Label className="text-slate-300">{t("auth.email")}</Label>
                  <Input
                    type="email"
                    className={cn(
                      "mt-1.5 h-11 bg-[#050a12]/80 border-slate-600/80",
                      fieldErr === "email" && "ring-2 ring-red-500 border-red-500"
                    )}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErr === "email") setFieldErr(null);
                    }}
                    autoComplete="email"
                  />
                </div>
                <div ref={passwordWrapRef}>
                  <Label className="text-slate-300">{t("auth.password")}</Label>
                  <Input
                    type="password"
                    className={cn(
                      "mt-1.5 h-11 bg-[#050a12]/80 border-slate-600/80",
                      fieldErr === "password" && "ring-2 ring-red-500 border-red-500"
                    )}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErr === "password") setFieldErr(null);
                    }}
                    autoComplete="current-password"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  {t("auth.rememberMe")}
                </label>
                {err && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5">
                    <p className="text-sm text-red-300 text-center font-medium">{err}</p>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold bg-gradient-to-l from-[#0052CC] to-[#003d99] hover:from-[#0061f2] hover:to-[#0052CC] border-0 shadow-lg shadow-[#0052CC]/30 transition-all duration-200"
                >
                  {t("auth.submitLogin")}
                </Button>
              </form>
            ) : (
              <form onSubmit={(e) => void submitRegister(e)} className="space-y-4" noValidate>
                <div ref={nameWrapRef}>
                  <Label className="text-slate-300">{t("auth.fullName")}</Label>
                  <Input
                    className={cn(
                      "mt-1.5 h-11 bg-[#050a12]/80 border-slate-600/80",
                      fieldErr === "name" && "ring-2 ring-red-500 border-red-500"
                    )}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErr === "name") setFieldErr(null);
                    }}
                    autoComplete="name"
                  />
                </div>
                <div ref={emailWrapRef}>
                  <Label className="text-slate-300">{t("auth.email")}</Label>
                  <Input
                    type="email"
                    className={cn(
                      "mt-1.5 h-11 bg-[#050a12]/80 border-slate-600/80",
                      fieldErr === "email" && "ring-2 ring-red-500 border-red-500"
                    )}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldErr === "email") setFieldErr(null);
                    }}
                    autoComplete="email"
                  />
                </div>
                <div ref={passwordWrapRef}>
                  <Label className="text-slate-300">{t("auth.password")}</Label>
                  <Input
                    type="password"
                    className={cn(
                      "mt-1.5 h-11 bg-[#050a12]/80 border-slate-600/80",
                      fieldErr === "password" && "ring-2 ring-red-500 border-red-500"
                    )}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (fieldErr === "password") setFieldErr(null);
                    }}
                    autoComplete="new-password"
                  />
                </div>
                {err && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5">
                    <p className="text-sm text-red-300 text-center font-medium">{err}</p>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full h-11 font-semibold bg-gradient-to-l from-[#FF8C00]/90 to-[#0052CC] hover:opacity-95 border-0 shadow-lg transition-all duration-200"
                >
                  {t("auth.submitRegister")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-slate-600 max-w-md leading-relaxed px-2">
          {t("auth.secureLoginHint")}
        </p>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500 max-w-md px-2">
          <Link to="/subscription-contract" className="hover:text-orange-400/90 underline-offset-2 hover:underline">
            {t("landing.linkContract")}
          </Link>
          <span className="text-slate-700">·</span>
          <Link to="/security-privacy" className="hover:text-orange-400/90 underline-offset-2 hover:underline">
            {t("landing.linkSecurity")}
          </Link>
          <span className="text-slate-700">·</span>
          <Link to="/cgu" className="hover:text-orange-400/90 underline-offset-2 hover:underline">
            {t("landing.linkCgu")}
          </Link>
        </div>
      </div>
    </div>
  );
}
