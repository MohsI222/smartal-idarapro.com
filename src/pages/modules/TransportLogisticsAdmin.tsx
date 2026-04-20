import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Loader2, Trash2, UserPlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import {
  TL_DEPT_SLUGS,
  tlCreateWorker,
  tlDeleteIncident,
  tlDeleteWorker,
  tlIncidents,
  tlOps,
  tlPatchWorker,
  tlRegenerateMagic,
  tlVehicleDeps,
  tlVehicles,
  tlWorkers,
  type TlIncident,
  type TlOpsLog,
  type TlVehicleLog,
  type TlWorker,
} from "@/lib/tlApi";
import { ensureLatinDigitsInString, formatTlLatinNum } from "@/lib/tlLatinNums";
import { exportTlErpPdfByDepartment } from "@/pages/tl/tlPdfExport";
import { getPublicOrigin } from "@/lib/publicOrigin";
import { cn } from "@/lib/utils";

export function TransportLogisticsAdmin() {
  const { token, approvedModules } = useAuth();
  const { t, isRtl, locale } = useI18n();
  const [workers, setWorkers] = useState<TlWorker[]>([]);
  const [incidents, setIncidents] = useState<TlIncident[]>([]);
  const [deptVehicles, setDeptVehicles] = useState<Record<string, TlVehicleLog[]>>({});
  const [deptOps, setDeptOps] = useState<Record<string, TlOpsLog[]>>({});
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    employee_id: "",
    center: "",
    role_title: "",
    department: "transport" as string,
    hierarchy_role: "employee",
    reports_to_worker_id: "",
  });
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerFieldErr, setWorkerFieldErr] = useState<"full_name" | "employee_id" | null>(null);
  const fullNameWrapRef = useRef<HTMLDivElement>(null);
  const employeeIdWrapRef = useRef<HTMLDivElement>(null);

  const allowed = approvedModules.includes("transport_logistics");

  const reload = useCallback(async () => {
    if (!token || !allowed) return;
    setLoading(true);
    try {
      const [w, inc] = await Promise.all([tlWorkers(token), tlIncidents(token)]);
      setWorkers(w.workers);
      setIncidents(inc.incidents);
      const veh: Record<string, TlVehicleLog[]> = {};
      const opsMap: Record<string, TlOpsLog[]> = {};
      await Promise.all(
        TL_DEPT_SLUGS.map(async (d) => {
          if (tlVehicleDeps(d)) {
            const v = await tlVehicles(token, d);
            veh[d] = v.logs;
          } else {
            const o = await tlOps(token, d);
            opsMap[d] = o.logs;
          }
        })
      );
      setDeptVehicles(veh);
      setDeptOps(opsMap);
    } catch {
      toast.error(t("tl.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [token, allowed, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** رابط يمر عبر تسجيل الدخول ثم يوجّه للقسم مع الرمز السحري — صالح للأجهزة الجديدة */
  const magicLoginUrl = (w: TlWorker) => {
    const base = getPublicOrigin();
    const target = `/dept/${w.department}?magic=${encodeURIComponent(w.magic_token ?? "")}&pwa=1`;
    return `${base}/login?next=${encodeURIComponent(target)}`;
  };

  const magicRegisterUrl = (w: TlWorker) => {
    const base = getPublicOrigin();
    const target = `/dept/${w.department}?magic=${encodeURIComponent(w.magic_token ?? "")}&pwa=1`;
    return `${base}/register?next=${encodeURIComponent(target)}`;
  };

  const copyMagic = async (w: TlWorker) => {
    if (!w.magic_token) return;
    await navigator.clipboard.writeText(magicLoginUrl(w));
    toast.success(t("tl.copiedLoginLink"));
  };

  const copyMagicRegister = async (w: TlWorker) => {
    if (!w.magic_token) return;
    await navigator.clipboard.writeText(magicRegisterUrl(w));
    toast.success(t("tl.copiedRegisterLink"));
  };

  const regenMagic = async (id: string) => {
    if (!token) return;
    try {
      await tlRegenerateMagic(token, id);
      toast.success(t("tl.magicRegenerated"));
      void reload();
    } catch {
      toast.error(t("tl.saveErr"));
    }
  };

  const addWorker = async () => {
    if (!token) return;
    setWorkerFieldErr(null);
    if (!form.full_name.trim()) {
      setWorkerFieldErr("full_name");
      fullNameWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(t("validation.fillField", { field: t("tl.fieldFullName") }));
      return;
    }
    if (!form.employee_id.trim()) {
      setWorkerFieldErr("employee_id");
      employeeIdWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(t("validation.fillField", { field: t("tl.fieldEmployeeId") }));
      return;
    }
    try {
      if (editingWorkerId) {
        await tlPatchWorker(token, editingWorkerId, {
          full_name: form.full_name,
          employee_id: form.employee_id,
          center: form.center,
          role_title: form.role_title,
          department: form.department,
          hierarchy_role: form.hierarchy_role,
          reports_to_worker_id: form.reports_to_worker_id.trim() || null,
        });
        toast.success(t("tl.workerUpdated"));
      } else {
        await tlCreateWorker(token, {
          full_name: form.full_name,
          employee_id: form.employee_id,
          center: form.center,
          role_title: form.role_title,
          department: form.department,
          hierarchy_role: form.hierarchy_role,
          reports_to_worker_id: form.reports_to_worker_id.trim() || null,
        });
        toast.success(t("tl.workerSaved"));
      }
      setEditingWorkerId(null);
      setForm({
        full_name: "",
        employee_id: "",
        center: "",
        role_title: "",
        department: form.department,
        hierarchy_role: "employee",
        reports_to_worker_id: "",
      });
      void reload();
    } catch {
      toast.error(t("tl.saveErr"));
    }
  };

  const startEdit = (w: TlWorker) => {
    setEditingWorkerId(w.id);
    setForm({
      full_name: w.full_name,
      employee_id: w.employee_id,
      center: w.center,
      role_title: w.role_title,
      department: w.department,
      hierarchy_role: w.hierarchy_role,
      reports_to_worker_id: w.reports_to_worker_id ?? "",
    });
  };

  const removeWorker = async (id: string) => {
    if (!token) return;
    if (!confirm(t("tl.confirmDelete"))) return;
    try {
      await tlDeleteWorker(token, id);
      toast.success(t("tl.deleted"));
      void reload();
    } catch {
      toast.error(t("tl.saveErr"));
    }
  };

  const dismissIncident = async (id: string) => {
    if (!token) return;
    try {
      await tlDeleteIncident(token, id);
      void reload();
    } catch {
      toast.error(t("tl.saveErr"));
    }
  };

  const runPdf = async () => {
    if (!token) return;
    setPdfBusy(true);
    try {
      const inc = await tlIncidents(token);
      const byDept = TL_DEPT_SLUGS.map((slug) => ({
        slug,
        vehicles: deptVehicles[slug] ?? [],
        ops: deptOps[slug] ?? [],
      }));
      await exportTlErpPdfByDepartment({
        direction: isRtl ? "rtl" : "ltr",
        lang: locale,
        title: t("tl.pdfReportTitle"),
        byDept,
        incidents: inc.incidents,
        t,
        fileName: `tl-erp-${Date.now()}.pdf`,
      });
      toast.success(t("tl.pdfDone"));
    } catch {
      toast.error(t("tl.pdfErr"));
    } finally {
      setPdfBusy(false);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <p className="text-orange-200 font-bold">{t("tl.lockedTitle")}</p>
        <Button asChild variant="secondary">
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl pb-16">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-slate-400">
          <Link to="/app/tl">
            <ArrowLeft className="size-4" />
            {t("tl.backHub")}
          </Link>
        </Button>
        <h1 className="text-xl md:text-2xl font-black text-white">{t("tl.adminTitle")}</h1>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#050a12]/90 p-6 space-y-4">
        <h2 className="text-lg font-bold text-[#FF8C00] flex items-center gap-2">
          <UserPlus className="size-5" />
          {t("tl.addWorker")}
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div ref={fullNameWrapRef}>
            <Label>{t("tl.fieldFullName")}</Label>
            <Input
              className={cn(
                "mt-1 bg-black/40 border-white/15",
                workerFieldErr === "full_name" && "ring-2 ring-red-500 border-red-500"
              )}
              value={form.full_name}
              onChange={(e) => {
                setForm((p) => ({ ...p, full_name: e.target.value }));
                if (workerFieldErr === "full_name") setWorkerFieldErr(null);
              }}
            />
          </div>
          <div ref={employeeIdWrapRef}>
            <Label>{t("tl.fieldEmployeeId")}</Label>
            <Input
              className={cn(
                "mt-1 bg-black/40 border-white/15",
                workerFieldErr === "employee_id" && "ring-2 ring-red-500 border-red-500"
              )}
              value={form.employee_id}
              onChange={(e) => {
                setForm((p) => ({ ...p, employee_id: e.target.value }));
                if (workerFieldErr === "employee_id") setWorkerFieldErr(null);
              }}
            />
          </div>
          <div>
            <Label>{t("tl.fieldCenter")}</Label>
            <Input
              className="mt-1 bg-black/40 border-white/15"
              value={form.center}
              onChange={(e) => setForm((p) => ({ ...p, center: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("tl.fieldRoleTitle")}</Label>
            <Input
              className="mt-1 bg-black/40 border-white/15"
              value={form.role_title}
              onChange={(e) => setForm((p) => ({ ...p, role_title: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t("tl.fieldDepartment")}</Label>
            <select
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              value={form.department}
              onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
            >
              {TL_DEPT_SLUGS.map((d) => (
                <option key={d} value={d}>
                  {t(`tl.dept.${d}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("tl.fieldHierarchy")}</Label>
            <select
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              value={form.hierarchy_role}
              onChange={(e) => setForm((p) => ({ ...p, hierarchy_role: e.target.value }))}
            >
              {["employee", "team_leader", "manager", "hr", "admin"].map((r) => (
                <option key={r} value={r}>
                  {t(`tl.role.${r}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>{t("tl.fieldReportsTo")}</Label>
            <select
              className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white"
              value={form.reports_to_worker_id}
              onChange={(e) => setForm((p) => ({ ...p, reports_to_worker_id: e.target.value }))}
            >
              <option value="">{t("tl.none")}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name} — {w.employee_id}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="bg-[#0052CC]" onClick={() => void addWorker()}>
            {editingWorkerId ? t("tl.updateWorker") : t("tl.saveWorker")}
          </Button>
          {editingWorkerId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditingWorkerId(null);
                setForm({
                  full_name: "",
                  employee_id: "",
                  center: "",
                  role_title: "",
                  department: form.department,
                  hierarchy_role: "employee",
                  reports_to_worker_id: "",
                });
              }}
            >
              {t("tl.cancelEdit")}
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-500/25 bg-amber-950/10 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-amber-200">{t("tl.incidentsTitle")}</h2>
          <Button
            type="button"
            variant="secondary"
            disabled={pdfBusy}
            className="gap-2"
            onClick={() => void runPdf()}
          >
            {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {t("tl.exportPdf")}
          </Button>
        </div>
        {loading ? (
          <Loader2 className="size-8 animate-spin text-slate-500" />
        ) : incidents.length === 0 ? (
          <p className="text-slate-500 text-sm">{t("tl.noIncidents")}</p>
        ) : (
          <ul className="space-y-2">
            {incidents.map((i) => (
              <li
                key={i.id}
                className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border p-3 ${
                  i.severity === "red"
                    ? "border-red-500/40 bg-red-950/30"
                    : "border-orange-500/40 bg-orange-950/20"
                }`}
              >
                <div>
                  <p className="font-bold text-white">{i.summary}</p>
                  <p className="text-xs text-slate-400">{i.detail}</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {ensureLatinDigitsInString(i.created_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-slate-400"
                  onClick={() => void dismissIncident(i.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-cyan-500/25 bg-cyan-950/15 p-6 space-y-10 overflow-x-auto">
        <h2 className="text-lg font-bold text-cyan-200">{t("tl.isolatedReportsTitle")}</h2>
        {loading ? (
          <Loader2 className="size-8 animate-spin text-slate-500" />
        ) : (
          TL_DEPT_SLUGS.map((d) => (
            <div key={d} className="space-y-3">
              <h3 className="text-base font-bold text-white border-b border-cyan-500/20 pb-2">
                {t(`tl.dept.${d}`)}
              </h3>
              {tlVehicleDeps(d) ? (
                <div className="overflow-x-auto rounded-lg border border-white/10" lang="en" dir="ltr">
                  <table className="w-full text-xs md:text-sm border-collapse min-w-[720px] font-mono tabular-nums">
                    <thead>
                      <tr className="bg-white/5 text-slate-400 text-left">
                        <th className="p-2">{t("tl.pdf.colVehicle")}</th>
                        <th className="p-2">{t("tl.pdf.colDriver")}</th>
                        <th className="p-2">{t("tl.pdf.colPhone")}</th>
                        <th className="p-2">{t("tl.pdf.colExpected")}</th>
                        <th className="p-2">{t("tl.pdf.colEntry")}</th>
                        <th className="p-2">{t("tl.pdf.colStatus")}</th>
                        <th className="p-2">{t("tl.pdf.colDelay")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(deptVehicles[d] ?? []).length === 0 ? (
                        <tr>
                          <td className="p-3 text-slate-500 font-sans" colSpan={7}>
                            {t("tl.reportNoRows")}
                          </td>
                        </tr>
                      ) : (
                        (deptVehicles[d] ?? []).map((r) => (
                          <tr key={r.id} className="border-t border-white/5">
                            <td className="p-2">{ensureLatinDigitsInString(String(r.vehicle_id))}</td>
                            <td className="p-2 font-sans">{r.driver_name}</td>
                            <td className="p-2">{ensureLatinDigitsInString(String(r.driver_phone))}</td>
                            <td className="p-2 whitespace-nowrap">{ensureLatinDigitsInString(r.expected_entry_at)}</td>
                            <td className="p-2 whitespace-nowrap">
                              {r.entry_at ? ensureLatinDigitsInString(r.entry_at) : "—"}
                            </td>
                            <td className="p-2 font-sans">{r.alert_level}</td>
                            <td className="p-2">{ensureLatinDigitsInString(String(r.delay_minutes))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-white/10" lang="en" dir="ltr">
                  <table className="w-full text-xs md:text-sm border-collapse min-w-[640px] font-mono tabular-nums">
                    <thead>
                      <tr className="bg-white/5 text-slate-400 text-left">
                        <th className="p-2">{t("tl.pdf.colEmployee")}</th>
                        <th className="p-2">{t("tl.pdf.colTime")}</th>
                        <th className="p-2">{t("tl.pdf.colQty")}</th>
                        <th className="p-2">{t("tl.pdf.colTarget")}</th>
                        <th className="p-2">{t("tl.pdf.colDelayReason")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(deptOps[d] ?? []).length === 0 ? (
                        <tr>
                          <td className="p-3 text-slate-500 font-sans" colSpan={5}>
                            {t("tl.reportNoRows")}
                          </td>
                        </tr>
                      ) : (
                        (deptOps[d] ?? []).map((r) => (
                          <tr key={r.id} className="border-t border-white/5">
                            <td className="p-2 font-sans">{r.worker_full_name ?? r.worker_id}</td>
                            <td className="p-2 whitespace-nowrap">{ensureLatinDigitsInString(r.log_time)}</td>
                            <td className="p-2">{formatTlLatinNum(r.quantity)}</td>
                            <td className="p-2">{formatTlLatinNum(r.target_pct)}%</td>
                            <td className="p-2 font-sans max-w-[220px] truncate">{r.delay_reason}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <section className="rounded-2xl border border-white/10 p-6 overflow-x-auto">
        <h2 className="text-lg font-bold text-white mb-4">{t("tl.workersList")}</h2>
        {loading ? (
          <Loader2 className="size-8 animate-spin" />
        ) : (
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="p-2">{t("tl.fieldFullName")}</th>
                <th className="p-2">{t("tl.fieldEmployeeId")}</th>
                <th className="p-2">{t("tl.fieldDepartment")}</th>
                <th className="p-2">{t("tl.magicLink")}</th>
                <th className="p-2">{t("tl.edit")}</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id} className="border-b border-white/5">
                  <td className="p-2 text-white">{w.full_name}</td>
                  <td className="p-2 font-mono text-xs">
                    {ensureLatinDigitsInString(String(w.employee_id))}
                  </td>
                  <td className="p-2">{t(`tl.dept.${w.department}`)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <Button type="button" size="sm" variant="outline" title={t("tl.shareLoginLink")} onClick={() => void copyMagic(w)}>
                        <Copy className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        title={t("tl.shareRegisterLink")}
                        onClick={() => void copyMagicRegister(w)}
                      >
                        +
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={() => void regenMagic(w.id)}>
                        {t("tl.regenerate")}
                      </Button>
                    </div>
                  </td>
                  <td className="p-2 space-x-1">
                    <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(w)}>
                      {t("tl.edit")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => void removeWorker(w.id)}>
                      <Trash2 className="size-4 text-red-400" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
