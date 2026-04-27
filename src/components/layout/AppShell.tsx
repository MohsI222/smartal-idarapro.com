import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Smartphone,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn, toWesternDigits } from "@/lib/utils";
import { PLATFORM_NAV, PRIMARY_NAV, SECONDARY_NAV } from "@/constants/appNav";
import { navItemVisibleForModules } from "@/constants/navModuleMap";
import type { SectionId } from "@/constants/sections";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PwaInstallControl } from "@/components/PwaInstallControl";
import { StockRadarTicker } from "@/components/StockRadarTicker";
import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import { AccountLockedScreen } from "@/components/AccountLockedScreen";
import { SubscriptionExpiredScreen } from "@/components/SubscriptionExpiredScreen";
import { OFFICIAL_WHATSAPP_DIGITS } from "@/constants/contact";
import { isPrimaryAdminClient } from "@/lib/adminClient";
import { useGlobalDomDigitLatinize } from "@/hooks/useGlobalDomDigitLatinize";

export function AppShell() {
  const { pathname } = useLocation();
  const {
    token,
    user,
    logout,
    subscriptionExpired,
    approvedModules,
    subscriptionDaysRemaining,
    subscriptionExpiryUrgent,
    subscriptionExpiryNotice,
    subscriptionCountdown,
    accountLocked,
    subscription,
    trialActive,
  } = useAuth();
  const { t, isRtl, formatNumber } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [headerLogo, setHeaderLogo] = useState<string | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useGlobalDomDigitLatinize(true);

  useEffect(() => {
    document.title = "سمارت الإدارة برو";
  }, []);

  useEffect(() => {
    if (!token) {
      setHeaderLogo(null);
      return;
    }
    void api<{ branding: { logoDataUrl?: string } }>("/user/branding", { token })
      .then((r) => {
        const u = r.branding?.logoDataUrl;
        setHeaderLogo(typeof u === "string" && u.startsWith("data:image") ? u : null);
      })
      .catch(() => setHeaderLogo(null));
  }, [token, user?.id]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const modSet = approvedModules as SectionId[];

  const navItems: {
    to: string;
    icon: LucideIcon;
    label: string;
    end: boolean;
    emphasize?: boolean;
  }[] = useMemo(
    () => {
      const core = [
        { to: "/app", icon: Home, label: t("nav.home"), end: true },
        ...PLATFORM_NAV.filter((n) => navItemVisibleForModules(n.to, modSet)).map((n) => ({
          to: n.to,
          icon: n.icon,
          label: t(n.labelKey),
          end: false as boolean,
          emphasize: n.emphasize,
        })),
        ...PRIMARY_NAV.filter((n) => navItemVisibleForModules(n.to, modSet)).map((n) => ({
          to: n.to,
          icon: n.icon,
          label: t(n.labelKey),
          end: false as boolean,
        })),
      ];
      return core;
    },
    [t, modSet]
  );

  const secondaryNavItems = useMemo(
    () =>
      SECONDARY_NAV.filter((n) => navItemVisibleForModules(n.to, modSet)).map((n) => ({
        to: n.to,
        icon: n.icon,
        label: t(n.labelKey),
      })),
    [t, modSet]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return { main: navItems, sec: secondaryNavItems };
    const match = (label: string) => label.toLowerCase().includes(q);
    return {
      main: navItems.filter((i) => match(i.label)),
      sec: secondaryNavItems.filter((i) => match(i.label)),
    };
  }, [navItems, secondaryNavItems, search]);

  const sidebarW = collapsed ? "md:w-[4.75rem]" : "md:w-72";

  const allowWhenExpired =
    pathname === "/app/pay" ||
    pathname.startsWith("/app/devices");
  const allowWhenLocked =
    pathname === "/app/support" ||
    pathname === "/app/devices" ||
    pathname === "/app/pay";
  const blockForAccountLock =
    accountLocked &&
    user?.role !== "superadmin" &&
    !isPrimaryAdminClient(user?.email, user?.name) &&
    !allowWhenLocked;

  if (blockForAccountLock) {
    return <AccountLockedScreen />;
  }

  const blockForExpiry =
    subscriptionExpired &&
    user?.role !== "superadmin" &&
    !isPrimaryAdminClient(user?.email, user?.name) &&
    !allowWhenExpired;

  if (blockForExpiry) {
    return <SubscriptionExpiredScreen />;
  }

  return (
    <div
      data-app-shell
      className="min-h-screen bg-gradient-to-br from-[#050a12] via-[#0a1628] to-[#050a12] text-white flex flex-col md:flex-row selection:bg-[#0052CC]/40 print:bg-white"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col border-slate-800/80 bg-[#0a1628]/85 backdrop-blur-2xl shadow-2xl transition-[width] duration-300 ease-out print:hidden",
          isRtl ? "border-l" : "border-r",
          sidebarW
        )}
      >
        <div className={cn("flex flex-col h-full min-h-0", collapsed ? "px-2 py-5" : "px-4 py-6")}>
          <div className={cn("flex items-center gap-2", collapsed && "justify-center flex-col gap-3")}>
            <Brand collapsed={collapsed} tagline={t("brand.tagline")} logoUrl={headerLogo} />
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                "rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-[#FF8C00] transition-colors shrink-0",
                collapsed && "order-first"
              )}
              aria-label={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
            >
              {collapsed ? (
                isRtl ? (
                  <PanelLeftOpen className="size-5" />
                ) : (
                  <PanelLeftOpen className="size-5" />
                )
              ) : isRtl ? (
                <PanelLeftClose className="size-5" />
              ) : (
                <PanelLeftClose className="size-5" />
              )}
            </button>
          </div>

          <nav className="flex flex-col gap-0.5 mt-6 flex-1 overflow-y-auto scrollbar-thin">
            <NavGroup label={t("shell.navGroup.platform")} collapsed={collapsed} />
            {filtered.main.map((item) => (
              <ShellNavLink key={item.to + item.label} item={item} collapsed={collapsed} />
            ))}
            <p
              className={cn(
                "text-[10px] uppercase tracking-wider text-slate-600 mt-4 mb-1 px-1",
                collapsed && "sr-only"
              )}
            >
              {t("nav.moreSections")}
            </p>
            {filtered.sec.map((item) => (
              <ShellNavLink
                key={item.to + item.label}
                item={{ ...item, end: false }}
                collapsed={collapsed}
              />
            ))}
            <ShellNavLink
              item={{ to: "/app/reminders", icon: Bell, label: t("nav.reminders"), end: false }}
              collapsed={collapsed}
            />
            <ShellNavLink
              item={{ to: "/app/devices", icon: Smartphone, label: t("nav.devices"), end: false }}
              collapsed={collapsed}
            />
            <ShellNavLink
              item={{ to: "/app/pay", icon: Wallet, label: t("nav.pay"), end: false }}
              collapsed={collapsed}
            />
            {user?.role === "superadmin" && (
              <NavLink
                to="/app/admin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium mt-3 border transition-all duration-200",
                    collapsed && "justify-center px-2",
                    isActive
                      ? "bg-[#0052CC] text-white border-[#0052CC] idara-sidebar-active"
                      : "border-[#FF8C00]/30 text-[#FF8C00] hover:bg-white/5"
                  )
                }
              >
                <LayoutDashboard className="size-5 shrink-0" />
                {!collapsed && <span>{t("nav.admin")}</span>}
              </NavLink>
            )}
          </nav>

          <div className={cn("mt-auto pt-4 border-t border-slate-800/80 space-y-2", collapsed && "px-0")}>
            <div className={cn(collapsed && "flex justify-center")}>
              <PwaInstallControl variant="sidebar" collapsedSidebar={collapsed} />
            </div>
            {!collapsed && (
              <p className="text-[10px] text-slate-600 leading-relaxed px-1">{t("common.brandFooter")}</p>
            )}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen pb-20 md:pb-0 min-w-0 print:pb-0 print:bg-white print:text-black">
        <header className="sticky top-0 z-40 flex flex-col gap-3 border-b border-slate-800/80 bg-[#0a1628]/95 backdrop-blur-xl px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="md:hidden shrink-0">
              <Brand compact tagline={t("brand.tagline")} logoUrl={headerLogo} />
            </div>
            <div className="relative flex-1 max-w-xl">
              <Search
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 size-4 text-slate-500 pointer-events-none",
                  isRtl ? "right-3" : "left-3"
                )}
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("shell.searchPlaceholder")}
                className={cn(
                  "w-full rounded-xl border border-slate-700/80 bg-[#050a12]/80 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/50 focus:border-[#0052CC]/60",
                  isRtl ? "pr-10 pl-4" : "pl-10 pr-4"
                )}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="secondary"
                className={cn(
                  "shrink-0 rounded-xl border-2 gap-1.5 text-[10px] sm:text-[11px] font-black px-2 sm:px-2.5 py-2 h-auto",
                  theme === "neon"
                    ? "border-cyan-400/50 bg-fuchsia-950/35 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.25)]"
                    : "border-slate-600 bg-[#050a12]/80"
                )}
                onClick={toggleTheme}
                title={t("theme.neonToggle")}
              >
                <Zap className="size-4 text-fuchsia-400 shrink-0" />
                <span className="hidden sm:inline max-w-[72px] truncate">{t("theme.neonShort")}</span>
              </Button>
              <PwaInstallControl variant="header" />
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
            </div>
            <div className="relative shrink-0" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#050a12]/60 px-2 py-1.5 hover:border-[#0052CC]/50 transition-colors"
              >
                <span className="size-9 rounded-lg bg-gradient-to-br from-[#0052CC] to-[#003d99] flex items-center justify-center text-sm font-bold">
                  {(user?.name ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden lg:flex flex-col items-start max-w-[160px]">
                  <span className="text-xs font-semibold truncate w-full text-left">
                    {user?.name ?? "—"}
                  </span>
                  {user?.role === "superadmin" && (
                    <span className="text-[9px] font-bold text-[#FF8C00]/90 truncate w-full">
                      {t("admin.roleGeneralManager")}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500 truncate w-full">{user?.email}</span>
                  {typeof user?.trial_balance === "number" && (
                    <span className="text-[10px] font-semibold text-emerald-400/95 truncate w-full">
                      رصيد تجريبي:{" "}
                      <span dir="ltr" className="font-digits-latin">
                        {formatNumber(Math.round(user.trial_balance))}
                      </span>
                    </span>
                  )}
                </span>
                <ChevronLeft
                  className={cn(
                    "size-4 text-slate-500 hidden lg:block transition-transform",
                    profileOpen && "rotate-180",
                    isRtl && "rotate-180"
                  )}
                />
              </button>
              {profileOpen && (
                <div
                  className={cn(
                    "absolute top-full mt-2 w-56 rounded-xl border border-slate-700/80 bg-[#0a1628] shadow-2xl py-1 z-50 idara-animate-in",
                    isRtl ? "left-0" : "right-0"
                  )}
                >
                  <Link
                    to="/app/devices"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Settings className="size-4 text-[#FF8C00]" />
                    {t("nav.devices")}
                  </Link>
                  <Link
                    to="/app/pay"
                    className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5"
                    onClick={() => setProfileOpen(false)}
                  >
                    <Wallet className="size-4 text-[#0052CC]" />
                    {t("nav.pay")}
                  </Link>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      logout();
                      navigate("/login");
                    }}
                  >
                    <LogOut className="size-4" />
                    {t("shell.logout")}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="sm:hidden">
            <LanguageSwitcher />
          </div>
          <p className="hidden md:block text-slate-500 text-xs truncate">
            {pathname === "/app" ? t("common.dashboard") : pathname}
          </p>
        </header>

        <StockRadarTicker />

        {user?.role !== "superadmin" && !isPrimaryAdminClient(user?.email, user?.name) && (
          <div className="px-4 md:px-8 pt-3 space-y-2">
            {subscriptionCountdown && (
              <div className="rounded-xl border border-sky-500/45 bg-sky-950/30 px-4 py-2.5 text-sm text-sky-100">
                {t("sub.countdownLine", {
                  days: formatNumber(subscriptionCountdown.days),
                  hours: formatNumber(subscriptionCountdown.hours),
                })}
              </div>
            )}
            {subscriptionExpiryNotice === "7" && (
              <div className="rounded-xl border border-orange-500/50 bg-orange-950/30 px-4 py-2.5 text-sm text-orange-100">
                {t("sub.alert7")}
              </div>
            )}
            {subscriptionExpiryNotice === "3" && (
              <div className="rounded-xl border border-amber-500/55 bg-amber-950/35 px-4 py-2.5 text-sm text-amber-100">
                {t("sub.alert3")}
              </div>
            )}
            {subscriptionExpiryNotice === "1" && (
              <div className="rounded-xl border border-red-500/50 bg-red-950/35 px-4 py-2.5 text-sm text-red-100">
                {t("sub.alert1")}
              </div>
            )}
            {subscriptionExpiryUrgent &&
              subscriptionDaysRemaining !== null &&
              subscriptionExpiryNotice === null && (
              <div className="rounded-xl border border-amber-500/50 bg-amber-950/35 px-4 py-3 text-sm text-amber-100 flex flex-wrap items-center justify-between gap-3">
                <span>
                  {t("sub.urgentBanner", {
                    days: formatNumber(subscriptionDaysRemaining),
                    end: toWesternDigits(subscription?.ends_at ?? "—"),
                  })}
                </span>
                <Link
                  to="/app/pay"
                  className="shrink-0 font-bold text-white underline decoration-amber-400"
                >
                  {t("sub.renewCta")}
                </Link>
              </div>
            )}
            {trialActive && (
              <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/25 px-4 py-2.5 text-xs text-cyan-100">
                {t("sub.trialWatermarkHint")}
              </div>
            )}
            <a
              href={`https://wa.me/${OFFICIAL_WHATSAPP_DIGITS}?text=${encodeURIComponent(t("sub.whatsappWelcome"))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/20 px-4 py-2.5 text-sm text-emerald-100 hover:bg-emerald-950/35 transition-colors"
            >
              <MessageCircle className="size-4 text-emerald-400 shrink-0" />
              {t("sub.dashboardWhatsapp")}
            </a>
          </div>
        )}

        <div className="flex-1 p-4 md:p-8 overflow-auto idara-animate-in">
          <Suspense
            fallback={
              <div className="flex min-h-[32vh] items-center justify-center text-slate-400 text-sm">
                {t("common.loading")}
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-slate-800/80 bg-[#0a1628]/98 backdrop-blur-xl py-2 safe-area-pb print:hidden">
        <div className="flex overflow-x-auto gap-1 px-2 scrollbar-none justify-start items-end">
          <PwaInstallControl variant="bottomBar" />
          {navItems.slice(0, 8).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 flex-col items-center gap-0.5 text-[10px] font-medium px-2.5 py-1.5 rounded-xl min-w-[4.25rem] transition-colors",
                  isActive
                    ? "text-[#FF8C00] bg-[#0052CC]/15 border border-[#0052CC]/30"
                    : "text-slate-500"
                )
              }
            >
              <item.icon className="size-5" />
              {item.label.length > 10 ? item.label.slice(0, 9) + "…" : item.label}
            </NavLink>
          ))}
          <NavLink
            to="/app/tools"
            className={({ isActive }) =>
              cn(
                "flex shrink-0 flex-col items-center gap-0.5 text-[10px] font-medium px-2.5 py-1.5 rounded-xl min-w-[4.25rem] transition-colors",
                isActive ? "text-[#FF8C00] bg-[#0052CC]/15" : "text-slate-500"
              )
            }
          >
            <ChevronRight className="size-5" />
            {t("shell.more")}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

function NavGroup({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null;
  return (
    <p className="text-[10px] uppercase tracking-wider text-slate-600 mb-1 px-1">
      {label}
    </p>
  );
}

function ShellNavLink({
  item,
  collapsed,
}: {
  item: { to: string; icon: LucideIcon; label: string; end?: boolean; emphasize?: boolean };
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          collapsed && "justify-center px-2",
          item.emphasize &&
            "ring-1 ring-inset ring-[#FF8C00]/45 bg-gradient-to-l from-[#FF8C00]/14 to-transparent",
          isActive
            ? "bg-[#0052CC]/20 text-white border border-[#0052CC]/40 shadow-[0_0_20px_rgba(0,82,204,0.12)]"
            : "text-slate-400 hover:bg-white/5 hover:text-white border border-transparent hover:[&_svg]:text-[#FF8C00]"
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              "size-5 shrink-0 transition-colors",
              isActive ? "text-[#FF8C00]" : "text-slate-500"
            )}
          />
          {!collapsed && <span>{item.label}</span>}
        </>
      )}
    </NavLink>
  );
}

const DEFAULT_APP_LOGO = "/logo.svg";

function Brand({
  compact,
  collapsed,
  tagline,
  logoUrl,
}: {
  compact?: boolean;
  collapsed?: boolean;
  tagline?: string;
  logoUrl?: string | null;
}) {
  const branded = Boolean(logoUrl?.startsWith("data:image"));
  const imgSrc = branded ? logoUrl! : DEFAULT_APP_LOGO;

  if (branded) {
    return (
      <div className={cn("flex min-w-0 flex-col", compact && "origin-right scale-95", collapsed && "items-center")}>
        <img
          src={imgSrc}
          alt=""
          className={cn(
            "object-contain rounded-lg border border-white/10 bg-white/5",
            collapsed ? "h-8 max-w-[3rem]" : "h-10 max-w-[160px]"
          )}
        />
        {tagline && !collapsed && (
          <span
            className={cn(
              "mt-1 max-w-[200px] truncate text-[10px] tracking-wide text-slate-500",
              compact && "max-w-[140px] text-[9px]"
            )}
          >
            {tagline}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        compact && "scale-95 origin-right",
        collapsed && "flex-col gap-1.5 items-center"
      )}
    >
      <img
        src={imgSrc}
        alt=""
        className={cn(
          "object-contain rounded-lg border border-white/10 bg-[#0c1929]/80 shrink-0 shadow-sm",
          collapsed ? "size-9" : "size-10"
        )}
      />
      {!collapsed && (
        <div className="min-w-0 flex flex-col">
          <span
            className={cn(
              "font-black bg-gradient-to-l from-[#FF8C00] via-[#ffa033] to-[#0052CC] bg-clip-text text-transparent leading-tight",
              compact ? "text-base" : "text-lg"
            )}
          >
            سمارت الإدارة برو
          </span>
          {tagline && (
            <span
              className={cn(
                "text-[10px] text-slate-500 tracking-wide truncate max-w-[200px]",
                compact && "text-[9px] max-w-[140px]"
              )}
            >
              {tagline}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
