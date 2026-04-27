import { useCallback, useEffect, useRef, useState } from "react";
import { useGlobalDomDigitLatinize } from "@/hooks/useGlobalDomDigitLatinize";
import {
  Barcode,
  Bell,
  Building2,
  Calculator,
  CreditCard,
  Database,
  GraduationCap,
  LayoutDashboard,
  Radar,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import type { SectionId } from "@/constants/sections";

const SECTION_ICONS: Record<string, LucideIcon> = {
  hr: Building2,
  law: Scale,
  acc: Calculator,
  edu: GraduationCap,
  public: Users,
  visa: Radar,
  inventory: Barcode,
  members: Users,
  company: Building2,
  academy: GraduationCap,
  gov: Building2,
  legal_ai: Scale,
  media_lab: Sparkles,
};

const PLAN_LABEL_KEYS: Record<string, string> = {
  full: "plan.fullManagement",
  full_management: "plan.fullManagement",
  simple_commerce: "plan.simpleCommerce",
  inventory_pro: "plan.inventoryPro",
  members_org: "plan.membersOrg",
  visa_premium: "section.visa.title",
  companies: "plan.fullManagement",
  professionals: "plan.fullManagement",
  commerce: "plan.simpleCommerce",
  enterprise: "plan.fullManagement",
  hr_priority: "plan.inventoryPro",
  legal_pro: "plan.fullManagement",
  starter: "plan.simpleCommerce",
  enterprises_schools: "plan.enterprisesSchools",
  lawyers: "plan.lawyers",
  libraries_base: "plan.librariesBase",
  libraries_plus: "plan.librariesPlus",
  retail: "plan.retail",
  institutes: "plan.institutes",
  accountants: "plan.accountants",
};

const PAYMENT_LABEL_KEYS: Record<string, string> = {
  bank_transfer: "pay.method.bank",
  wafacash: "pay.method.wafacash",
  cashplus: "pay.method.cashplus",
  recharge: "pay.method.recharge",
};

type PendingRow = {
  id: string;
  user_id: string;
  plan_id: string;
  modules: string;
  payment_method: string;
  status: string;
  created_at: string;
  email: string;
  user_name: string;
};

type ReferralRewardRow = {
  id: string;
  user_id: string;
  tier: string;
  status: string;
  created_at: string;
  email: string;
  user_name: string;
};

type AdminSalesAnalytics = {
  invoiceCount: number;
  todayRevenue: number;
  hourRevenue: number;
  todayNetProfit: number;
  hourNetProfit: number;
  chart: { day: string; revenue: number; profit: number }[];
};

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  plan_id: string | null;
  sub_status: string | null;
  sub_ends_at: string | null;
  payment_method: string | null;
  account_locked: number | boolean;
};

type AdminSubStats = {
  activeSubscriptions: number;
  expiredSubscriptions: number;
  activeTrials: number;
};

type SupportInboxRow = {
  id: string;
  user_id: string;
  from_admin: number | boolean;
  body: string;
  created_at: string;
  email: string;
  user_name: string;
};

export function SuperAdminDashboard() {
  useGlobalDomDigitLatinize(true);
  const { token, user } = useAuth();
  const { t, isRtl, formatNumber } = useI18n();
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [referralRewards, setReferralRewards] = useState<ReferralRewardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<AdminSalesAnalytics | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [subStats, setSubStats] = useState<AdminSubStats | null>(null);
  const [supportInbox, setSupportInbox] = useState<SupportInboxRow[]>([]);
  const [replyUserId, setReplyUserId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [mainTab, setMainTab] = useState("payments");
  const [sidebarActive, setSidebarActive] = useState<"dash" | "users" | "subs">("dash");
  const tabsAnchorRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [r, s, rw, u, st, sup] = await Promise.all([
        api<{ pending: PendingRow[] }>("/admin/pending", { token }),
        api<AdminSalesAnalytics>("/admin/sales-analytics", { token }).catch(() => null),
        api<{ rewards: ReferralRewardRow[] }>("/admin/referral-rewards", { token }).catch(() => ({
          rewards: [],
        })),
        api<{ users: AdminUserRow[] }>("/admin/users", { token }).catch(() => ({ users: [] })),
        api<AdminSubStats>("/admin/subscription-stats", { token }).catch(() => null),
        api<{ messages: SupportInboxRow[] }>("/admin/support/inbox", { token }).catch(() => ({
          messages: [],
        })),
      ]);
      setPending(r.pending);
      setSales(s);
      setReferralRewards(rw.rewards ?? []);
      setAdminUsers(u.users ?? []);
      setSubStats(st);
      setSupportInbox(sup.messages ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    if (!token) return;
    await api(`/admin/approve/${id}`, { method: "POST", token });
    await load();
  };

  const approveReferralReward = async (rewardId: string) => {
    if (!token) return;
    await api(`/admin/referral-reward/approve/${rewardId}`, { method: "POST", token });
    await load();
  };

  const reject = async (id: string) => {
    if (!token) return;
    await api(`/admin/reject/${id}`, { method: "POST", token });
    await load();
  };

  const setLocked = async (targetUserId: string, locked: boolean) => {
    if (!token) return;
    await api(`/admin/users/${targetUserId}/locked`, {
      method: "POST",
      token,
      body: JSON.stringify({ locked }),
    });
    await load();
  };

  const sendSupportReply = async () => {
    if (!token) return;
    const uid = replyUserId.trim();
    const body = replyBody.trim();
    if (!uid || !body) return;
    await api("/admin/support/reply", {
      method: "POST",
      token,
      body: JSON.stringify({ userId: uid, body }),
    });
    setReplyBody("");
    await load();
  };

  const scrollToTabs = () => {
    tabsAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setSubscriptionAccess = async (targetUserId: string, mode: "active" | "expired") => {
    if (!token) return;
    await api(`/admin/users/${targetUserId}/subscription-access`, {
      method: "POST",
      token,
      body: JSON.stringify({ mode }),
    });
    await load();
  };

  if (user?.role !== "superadmin") {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400">{t("admin.forbidden")}</p>
        <Button asChild className="mt-4">
          <Link to="/app">{t("admin.back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      <aside className="w-full md:w-64 bg-[#121214] border-b md:border-b-0 md:border-l border-gray-800 p-6 flex flex-col gap-8 shadow-2xl shrink-0">
        <h1 className="text-2xl font-black bg-gradient-to-l from-orange-500 to-blue-500 bg-clip-text text-transparent">
          {t("admin.sidebarTitle")}
        </h1>

        <nav className="flex flex-col gap-2">
          <NavItem
            icon={LayoutDashboard}
            label={t("admin.navDash")}
            active={sidebarActive === "dash"}
            onClick={() => {
              setSidebarActive("dash");
              setMainTab("payments");
              scrollToTabs();
            }}
          />
          <NavItem icon={Database} label={t("admin.navData")} />
          <NavItem
            icon={Users}
            label={t("admin.navUsers")}
            active={sidebarActive === "users"}
            onClick={() => {
              setSidebarActive("users");
              setMainTab("users");
              scrollToTabs();
            }}
          />
          <NavItem icon={ShieldCheck} label={t("admin.navSecurity")} />
          <NavItem
            icon={CreditCard}
            label={t("admin.navSubs")}
            active={sidebarActive === "subs"}
            onClick={() => {
              setSidebarActive("subs");
              setMainTab("subs");
              scrollToTabs();
            }}
          />
        </nav>

        <div className="mt-auto border-t border-gray-800 pt-6">
          <div className="flex items-center gap-3 p-3 bg-black/40 rounded-xl border border-orange-500/20">
            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center font-bold text-white">
              L
            </div>
            <div>
              <p className="text-sm font-bold">لحسن الموتوكل</p>
              <p className="text-xs text-gray-500">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20 text-blue-500">
              <Bell size={20} />
            </div>
            <p className="text-gray-400 text-sm">{t("admin.welcomeLine")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-orange-500/50 hover:bg-orange-500/10" asChild>
              <Link to="/app/support">{t("nav.support")}</Link>
            </Button>
            <Button variant="outline" className="border-orange-500/50 hover:bg-orange-500/10" asChild>
              <Link to="/app/admin/platform">{t("nav.adminPlatform")}</Link>
            </Button>
            <Button variant="outline" className="border-orange-500/50 hover:bg-orange-500/10" asChild>
              <Link to="/app">{t("admin.openMain")}</Link>
            </Button>
          </div>
        </div>

        <Card className="bg-[#121214] border border-orange-500/25 mb-8 overflow-hidden">
          <CardContent className="p-6">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="size-6 text-orange-400 shrink-0" />
                {t("admin.salesChartTitle")}
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">{t("admin.salesChartHint")}</p>
            </div>
            {sales && sales.chart.length > 0 ? (
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sales.chart.map((c) => ({ ...c, label: c.day.slice(5) }))}>
                    <defs>
                      <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb923c" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#fb923c" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="adminProfGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => formatNumber(Number(v), { maximumFractionDigits: 0 })}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0a1628",
                        border: "1px solid rgba(251,146,60,0.45)",
                        borderRadius: 12,
                      }}
                      formatter={(value: number | string, name: string) => [
                        formatNumber(Number(value), { maximumFractionDigits: 2 }),
                        name,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#fb923c"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#adminRevGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#adminProfGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-slate-500 text-sm py-10 text-center">
                {loading ? t("admin.loading") : "—"}
              </p>
            )}
          </CardContent>
        </Card>

        {subStats && (
          <Card className="mb-8 border border-cyan-500/25 bg-[#121214]">
            <CardContent className="p-6">
              <h2 className="mb-4 text-lg font-bold text-white">{t("admin.subsChartTitle")}</h2>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="h-[240px] w-full">
                  {subStats.activeSubscriptions + subStats.expiredSubscriptions === 0 ? (
                    <p className="flex h-full items-center justify-center text-center text-sm text-slate-500">
                      {t("admin.subsChartEmpty")}
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: t("admin.statsActiveSubs"), value: subStats.activeSubscriptions },
                            { name: t("admin.statsExpiredSubs"), value: subStats.expiredSubscriptions },
                          ]}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          <Cell fill="#22c55e" />
                          <Cell fill="#64748b" />
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "#0a1628",
                            border: "1px solid rgba(34,211,238,0.35)",
                            borderRadius: 12,
                          }}
                          formatter={(value: number) => [
                            formatNumber(value, { maximumFractionDigits: 0 }),
                            "",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="flex flex-col justify-center gap-3 text-sm text-slate-300">
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-bold text-emerald-400">{t("admin.statsActiveSubs")}:</span>
                    <span dir="ltr" className="font-digits-latin">
                      {formatNumber(subStats.activeSubscriptions)}
                    </span>
                  </p>
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-bold text-slate-400">{t("admin.statsExpiredSubs")}:</span>
                    <span dir="ltr" className="font-digits-latin">
                      {formatNumber(subStats.expiredSubscriptions)}
                    </span>
                  </p>
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-bold text-cyan-300">{t("admin.statsTrials")}:</span>
                    <span dir="ltr" className="font-digits-latin">
                      {formatNumber(subStats.activeTrials)}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div ref={tabsAnchorRef} />
        <Tabs
          value={mainTab}
          onValueChange={(v) => {
            setMainTab(v);
            if (v === "users") setSidebarActive("users");
            else if (v === "subs") setSidebarActive("subs");
            else if (v === "payments") setSidebarActive("dash");
            else setSidebarActive("dash");
          }}
          className="w-full"
        >
          <TabsList className="bg-[#0a1628] border border-slate-800 mb-6">
            <TabsTrigger value="payments" className="data-[state=active]:bg-[#0052CC]/40">
              {t("admin.tabPayments")}
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[#0052CC]/40">
              {t("admin.tabUsers")}
            </TabsTrigger>
            <TabsTrigger value="subs" className="data-[state=active]:bg-[#0052CC]/40">
              {t("admin.tabSubscriptions")}
            </TabsTrigger>
            <TabsTrigger value="referrals" className="data-[state=active]:bg-[#0052CC]/40">
              {t("admin.referralRewardsTitle")}
            </TabsTrigger>
            <TabsTrigger value="support" className="data-[state=active]:bg-[#0052CC]/40">
              {t("admin.tabSupport")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payments">
            <h2 className="text-lg font-bold mb-4">{t("admin.pendingTitle")}</h2>
            {loading ? (
              <p className="text-slate-500">{t("admin.loading")}</p>
            ) : pending.length === 0 ? (
              <p className="text-slate-500">{t("admin.noPending")}</p>
            ) : (
              <div className="space-y-4">
                {pending.map((p) => {
                  let mods: string[] = [];
                  try {
                    mods = JSON.parse(p.modules) as string[];
                  } catch {
                    mods = [];
                  }
                  const planKey = PLAN_LABEL_KEYS[p.plan_id];
                  const payKey = PAYMENT_LABEL_KEYS[p.payment_method];
                  return (
                    <Card key={p.id} className="bg-[#121214] border-gray-800">
                      <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                          <p className="font-bold">{p.user_name}</p>
                          <p className="text-sm text-slate-500">{p.email}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="secondary">
                              {t("admin.planBadge")}: {planKey ? t(planKey) : p.plan_id}
                            </Badge>
                            <Badge variant="outline">
                              {payKey ? t(payKey) : p.payment_method}
                            </Badge>
                            {mods.map((m) => {
                              const Icon = SECTION_ICONS[m] ?? Building2;
                              const sid = m as SectionId;
                              const label =
                                m === "hr" ||
                                m === "law" ||
                                m === "acc" ||
                                m === "edu" ||
                                m === "public" ||
                                m === "members" ||
                                m === "inventory"
                                  ? t(`section.${sid}.short`)
                                  : m;
                              return (
                                <span
                                  key={m}
                                  className="inline-flex items-center gap-1 text-xs text-slate-400"
                                >
                                  <Icon className="size-3" /> {label}
                                </span>
                              );
                            })}
                          </div>
                          <p className="text-xs text-slate-600 mt-2">{p.created_at}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button onClick={() => void approve(p.id)}>{t("admin.verifyPayment")}</Button>
                          <Button variant="destructive" onClick={() => void reject(p.id)}>
                            {t("admin.reject")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="users">
            <Card className="border-gray-800 bg-[#121214]">
              <CardContent className="overflow-x-auto p-4">
                {loading ? (
                  <p className="text-slate-500">{t("admin.loading")}</p>
                ) : (
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="py-2 pe-3">{t("admin.colUser")}</th>
                        <th className="py-2 pe-3">{t("admin.colPlan")}</th>
                        <th className="py-2 pe-3">{t("admin.colSubStatus")}</th>
                        <th className="py-2 pe-3">{t("admin.colEnds")}</th>
                        <th className="py-2 pe-3">{t("admin.colSubControl")}</th>
                        <th className="py-2">{t("admin.colLock")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminUsers.map((u) => {
                        const pk = u.plan_id ? PLAN_LABEL_KEYS[u.plan_id] : null;
                        const access = subscriptionAccessState(u);
                        return (
                          <tr key={u.id} className="border-b border-slate-800/80">
                            <td className="py-2 pe-3 align-top">
                              <div className="font-semibold text-white">{u.name}</div>
                              <div className="text-xs text-slate-500">{u.email}</div>
                            </td>
                            <td className="py-2 pe-3 align-top text-slate-300">
                              {pk ? t(pk) : u.plan_id ?? "—"}
                            </td>
                            <td className="py-2 pe-3 align-top text-slate-300">
                              {u.sub_status ?? "—"}
                              {access === "active" && (
                                <Badge className="ms-2 border-emerald-600/50 bg-emerald-950/40 text-emerald-300">
                                  {t("admin.subStateActive")}
                                </Badge>
                              )}
                              {access === "expired" && (
                                <Badge className="ms-2 border-slate-600 bg-slate-900/60 text-slate-400">
                                  {t("admin.subStateExpired")}
                                </Badge>
                              )}
                              {u.payment_method && (
                                <span className="block text-[10px] text-slate-500">{u.payment_method}</span>
                              )}
                            </td>
                            <td className="py-2 pe-3 align-top font-mono text-xs text-slate-400">
                              {u.sub_ends_at ?? "—"}
                            </td>
                            <td className="py-2 pe-3 align-top">
                              {u.role !== "superadmin" ? (
                                <div className="flex flex-wrap gap-1.5">
                                  <Button
                                    size="sm"
                                    variant={access === "active" ? "default" : "outline"}
                                    className="h-8 border-emerald-600/40"
                                    onClick={() => void setSubscriptionAccess(u.id, "active")}
                                  >
                                    {t("admin.setActive")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={access === "expired" ? "secondary" : "outline"}
                                    className="h-8"
                                    onClick={() => void setSubscriptionAccess(u.id, "expired")}
                                  >
                                    {t("admin.setExpired")}
                                  </Button>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-2 align-top">
                              {u.role !== "superadmin" && (
                                <Button
                                  size="sm"
                                  variant={u.account_locked ? "default" : "outline"}
                                  onClick={() => void setLocked(u.id, !u.account_locked)}
                                >
                                  {u.account_locked ? t("admin.unlock") : t("admin.lock")}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subs">
            <Card className="border-gray-800 bg-[#121214]">
              <CardContent className="space-y-4 p-6 text-slate-300 text-sm leading-relaxed">
                <p>{t("admin.subsTabHint")}</p>
                {subStats ? (
                  <ul className="list-disc space-y-2 ps-5 text-slate-200">
                    <li>
                      {t("admin.statsActiveSubs")}:{" "}
                      <span dir="ltr" className="font-digits-latin">
                        {formatNumber(subStats.activeSubscriptions)}
                      </span>
                    </li>
                    <li>
                      {t("admin.statsExpiredSubs")}:{" "}
                      <span dir="ltr" className="font-digits-latin">
                        {formatNumber(subStats.expiredSubscriptions)}
                      </span>
                    </li>
                    <li>
                      {t("admin.statsTrials")}:{" "}
                      <span dir="ltr" className="font-digits-latin">
                        {formatNumber(subStats.activeTrials)}
                      </span>
                    </li>
                  </ul>
                ) : (
                  <p className="text-slate-500">{loading ? t("admin.loading") : "—"}</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="support">
            <h2 className="mb-4 text-lg font-bold">{t("admin.supportInboxTitle")}</h2>
            <Card className="mb-6 border border-emerald-500/25 bg-[#121214]">
              <CardContent className="space-y-3 p-4">
                <p className="text-xs text-slate-500">{t("admin.supportReplyHint")}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="flex-1 rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                    placeholder={t("admin.supportReplyUserPlaceholder")}
                    value={replyUserId}
                    onChange={(e) => setReplyUserId(e.target.value)}
                  />
                  <Button type="button" onClick={() => void sendSupportReply()}>
                    {t("admin.supportSendReply")}
                  </Button>
                </div>
                <textarea
                  className="min-h-[80px] w-full rounded-lg border border-slate-700 bg-black/40 px-3 py-2 text-sm"
                  placeholder={t("support.placeholder")}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
              </CardContent>
            </Card>
            <div className="max-h-[480px] space-y-3 overflow-y-auto">
              {supportInbox.map((m) => (
                <Card key={m.id} className="border-slate-700 bg-[#121214]">
                  <CardContent className="p-4 text-sm">
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {m.user_name} · {m.email}
                      </span>
                      <span className="font-mono">{m.created_at}</span>
                    </div>
                    <Badge variant="outline" className="mt-2 border-slate-600">
                      {m.from_admin ? t("support.fromTeam") : t("support.fromYou")}
                    </Badge>
                    <p className="mt-2 whitespace-pre-wrap text-slate-200">{m.body}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="referrals">
            <h2 className="text-lg font-bold mb-4">{t("admin.referralRewardsTitle")}</h2>
            {loading ? (
              <p className="text-slate-500">{t("admin.loading")}</p>
            ) : referralRewards.length === 0 ? (
              <p className="text-slate-500">{t("admin.noReferralRewards")}</p>
            ) : (
              <div className="space-y-4">
                {referralRewards.map((rw) => (
                  <Card key={rw.id} className="bg-[#121214] border-amber-500/30">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-bold">{rw.user_name}</p>
                        <p className="text-sm text-slate-500">{rw.email}</p>
                        <Badge variant="outline" className="mt-2 border-amber-500/50 text-amber-200">
                          {rw.tier === "10" ? t("admin.refRewardTier10") : t("admin.refRewardTier5")}
                        </Badge>
                        <p className="text-xs text-slate-600 mt-2">{rw.created_at}</p>
                      </div>
                      <Button onClick={() => void approveReferralReward(rw.id)}>{t("admin.refRewardApprove")}</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            title={t("admin.statsSales")}
            value={
              sales
                ? formatNumber(sales.todayRevenue, { maximumFractionDigits: 2 })
                : "—"
            }
            trend={
              sales
                ? `${t("dashboard.revenueHour")}: ${formatNumber(sales.hourRevenue, { maximumFractionDigits: 2 })}`
                : t("admin.statsTrendAnalytics")
            }
          />
          <StatCard
            title={t("admin.statsProfitToday")}
            value={
              sales
                ? formatNumber(sales.todayNetProfit, { maximumFractionDigits: 2 })
                : "—"
            }
            trend={
              sales
                ? `${t("dashboard.profitHour")}: ${formatNumber(sales.hourNetProfit, { maximumFractionDigits: 2 })}`
                : t("admin.statsTrendAnalytics")
            }
          />
          <StatCard
            title={t("admin.statsNew")}
            value={String(pending.length)}
            trend={t("admin.statsTrendPending")}
          />
          <StatCard title={t("admin.statsDevices")} value="DRM" trend={t("admin.statsTrendDrm")} />
          <StatCard
            title={t("admin.statsAlerts")}
            value="HR"
            trend={t("admin.statsTrendRenewal")}
            color="text-red-400"
          />
        </div>
      </main>
    </div>
  );
}

function subscriptionAccessState(u: AdminUserRow): "active" | "expired" | "neutral" {
  if (u.sub_status !== "approved") return "neutral";
  const end = u.sub_ends_at?.trim();
  if (!end) return "neutral";
  const t = new Date(end).getTime();
  if (!Number.isFinite(t)) return "neutral";
  return t > Date.now() ? "active" : "expired";
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
        onClick ? "cursor-pointer" : "cursor-default"
      } ${
        active
          ? "bg-orange-600 text-white shadow-lg"
          : "hover:bg-gray-800 text-gray-400"
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function StatCard({
  title,
  value,
  trend,
  color = "text-white",
}: {
  title: string;
  value: string;
  trend: string;
  color?: string;
}) {
  return (
    <div className="bg-[#121214] p-6 rounded-2xl border border-gray-800">
      <p className="text-gray-500 text-sm mb-2">{title}</p>
      <div className="flex items-end justify-between gap-2">
        <h4 dir="ltr" className={`text-2xl font-bold tabular-nums font-digits-latin ${color}`}>
          {value}
        </h4>
        <span className="text-xs text-green-500 font-bold text-end min-w-0 max-w-[55%] font-digits-latin" dir="ltr">
          {trend}
        </span>
      </div>
    </div>
  );
}
