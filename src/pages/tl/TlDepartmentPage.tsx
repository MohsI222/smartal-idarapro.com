import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGlobalDomDigitLatinize } from "@/hooks/useGlobalDomDigitLatinize";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Bus,
  Download,
  FileSpreadsheet,
  FileText,
  Home,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Truck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PwaInstallControl } from "@/components/PwaInstallControl";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { tlCombineTodayWithTime, tlDefaultExpectedEntryLocal } from "@/lib/tlDateTimeLocal";
import { ensureLatinDigitsInString, formatTlLatinInt, formatTlLatinNum } from "@/lib/tlLatinNums";
import { cn } from "@/lib/utils";
import {
  isTlDept,
  tlCreateOps,
  tlCreateVehicle,
  tlDeleteOps,
  tlDeleteVehicle,
  tlFetchMessageAttachmentBlob,
  tlIncidents,
  tlMessageRecipients,
  tlMessages,
  tlOps,
  tlPatchVehicle,
  tlResolveMagic,
  tlSendMessage,
  tlSendMessageWithFile,
  tlVehicles,
  tlWorkers,
  tlVehicleDeps,
  type TlMessage,
  type TlOpsLog,
  type TlVehicleLog,
  type TlWorker,
} from "@/lib/tlApi";
import {
  buildGridExcelFile,
  exportCurrentGridExcel,
  exportCurrentGridPdf,
} from "@/pages/tl/tlGridExport";

function statusPill(
  alert: string,
  marked: boolean,
  t: (k: string, params?: Record<string, string>) => string
) {
  if (marked || alert === "green") {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
        {t("tl.status.onTime")}
      </span>
    );
  }
  if (alert === "orange") {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
        {t("tl.status.delayed")}
      </span>
    );
  }
  if (alert === "red") {
    return (
      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
        {t("tl.status.critical")}
      </span>
    );
  }
  return (
    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-slate-500/20 text-slate-400">
      {t("tl.status.pending")}
    </span>
  );
}

export function TlDepartmentPage() {
  useGlobalDomDigitLatinize(true);
  const { dept } = useParams<{ dept: string }>();
  const [search] = useSearchParams();
  const magicParam = search.get("magic");
  const pwaInvite = search.get("pwa") === "1";
  const { token, approvedModules } = useAuth();
  const { t, isRtl, locale } = useI18n();
  const { install, canNativeInstall } = usePwaInstall();
  const [workers, setWorkers] = useState<TlWorker[]>([]);
  const [ctxWorker, setCtxWorker] = useState<TlWorker | null>(null);
  const [tab, setTab] = useState<"ops" | "msg">("ops");
  const [vehicleLogs, setVehicleLogs] = useState<TlVehicleLog[]>([]);
  const [opsLogs, setOpsLogs] = useState<TlOpsLog[]>([]);
  const [messages, setMessages] = useState<TlMessage[]>([]);
  const [recipients, setRecipients] = useState<{ id: string; full_name: string }[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [msgTo, setMsgTo] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const allowed = approvedModules.includes("transport_logistics");
  const slug = dept && isTlDept(dept) ? dept : null;

  const isVehicle = slug ? tlVehicleDeps(slug) : false;

  const [vForm, setVForm] = useState({
    vehicle_id: "",
    driver_name: "",
    driver_phone: "",
    driver_id_doc: "",
    vehicle_kind: "truck" as "bus" | "truck",
    /** HH:mm — date = today */
    expected_entry_time: "",
    entry_time: "",
    exit_time: "",
    passenger_count: "",
    seat_count: "",
    cargo_count: "",
    box_count: "",
    notes: "",
    marked_success: false,
  });

  const [oForm, setOForm] = useState({
    worker_id: "",
    /** HH:mm — date = today */
    log_time: "",
    quantity: "0",
    delay_reason: "",
    target_pct: "100",
  });

  const vehicleIdWrapRef = useRef<HTMLDivElement>(null);
  const [vFieldErr, setVFieldErr] = useState<"vehicle_id" | null>(null);
  const opsWorkerWrapRef = useRef<HTMLDivElement>(null);
  const [opsFieldErr, setOpsFieldErr] = useState<"worker_id" | null>(null);

  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
    const prev = link?.getAttribute("href") ?? "";
    if (slug && link) {
      link.setAttribute("href", `/manifest-tl-${slug}.webmanifest`);
    }
    return () => {
      if (link && prev) link.setAttribute("href", prev || "/manifest.webmanifest");
    };
  }, [slug]);

  const loadData = useCallback(async () => {
    if (!token || !slug || !allowed) return;
    setLoading(true);
    try {
      const w = await tlWorkers(token, slug);
      setWorkers(w.workers);
      if (isVehicle) {
        const v = await tlVehicles(token, slug);
        setVehicleLogs(v.logs);
      } else {
        const o = await tlOps(token, slug);
        setOpsLogs(o.logs);
      }
    } catch {
      toast.error(t("tl.loadErr"));
    } finally {
      setLoading(false);
    }
  }, [token, slug, allowed, isVehicle, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!token || !magicParam || !slug) return;
    void tlResolveMagic(magicParam, token)
      .then((r) => {
        if (r?.worker && r.worker.department === slug) setCtxWorker(r.worker);
      })
      .catch(() => {
        /* ignore */
      });
  }, [token, magicParam, slug]);

  useEffect(() => {
    if (!magicParam && !pwaInvite) return;
    const timer = window.setTimeout(() => {
      if (canNativeInstall) void install();
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [magicParam, pwaInvite, canNativeInstall, install]);

  const effectiveSender = useMemo(() => {
    if (ctxWorker && ctxWorker.department === slug) return ctxWorker;
    return workers[0] ?? null;
  }, [ctxWorker, workers, slug]);

  const loadMessages = useCallback(async () => {
    if (!token || !effectiveSender) return;
    try {
      const m = await tlMessages(token, effectiveSender.id);
      setMessages(m.messages);
      const rec = await tlMessageRecipients(token, effectiveSender.id);
      setRecipients(rec.recipients.map((r) => ({ id: r.id, full_name: r.full_name })));
      if (!msgTo && rec.recipients[0]) setMsgTo(rec.recipients[0].id);
    } catch {
      toast.error(t("tl.msgErr"));
    }
  }, [token, effectiveSender, t, msgTo]);

  useEffect(() => {
    if (tab === "msg" && effectiveSender) void loadMessages();
  }, [tab, effectiveSender, loadMessages]);

  const saveVehicle = async () => {
    if (!token || !slug) return;
    setVFieldErr(null);
    if (!vForm.vehicle_id.trim()) {
      setVFieldErr("vehicle_id");
      vehicleIdWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(t("validation.fillField", { field: t("tl.vVehicleId") }));
      return;
    }
    const expected_entry_at =
      tlCombineTodayWithTime(vForm.expected_entry_time) ?? tlDefaultExpectedEntryLocal();
    const entry_at = tlCombineTodayWithTime(vForm.entry_time);
    const exit_at = tlCombineTodayWithTime(vForm.exit_time);
    setSaving(true);
    try {
      await tlCreateVehicle(token, {
        department: slug,
        vehicle_id: vForm.vehicle_id,
        driver_name: vForm.driver_name,
        driver_phone: vForm.driver_phone,
        driver_id_doc: vForm.driver_id_doc,
        vehicle_kind: vForm.vehicle_kind,
        expected_entry_at,
        entry_at,
        exit_at,
        passenger_count: vForm.passenger_count ? Number(vForm.passenger_count) : null,
        seat_count: vForm.seat_count ? Number(vForm.seat_count) : null,
        cargo_count: vForm.cargo_count ? Number(vForm.cargo_count) : null,
        box_count: vForm.box_count ? Number(vForm.box_count) : null,
        marked_success: vForm.marked_success,
        notes: vForm.notes || null,
      });
      toast.success(t("tl.saved"));
      setVForm((p) => ({
        ...p,
        vehicle_id: "",
        driver_name: "",
        driver_phone: "",
        driver_id_doc: "",
        expected_entry_time: "",
        entry_time: "",
        exit_time: "",
        passenger_count: "",
        seat_count: "",
        cargo_count: "",
        box_count: "",
        notes: "",
        marked_success: false,
      }));
      void loadData();
    } catch {
      toast.error(t("tl.saveErr"));
    } finally {
      setSaving(false);
    }
  };

  const toggleVehicleSuccess = async (row: TlVehicleLog) => {
    if (!token) return;
    try {
      await tlPatchVehicle(token, row.id, { marked_success: !row.marked_success });
      void loadData();
    } catch {
      toast.error(t("tl.saveErr"));
    }
  };

  const deleteVehicle = async (id: string) => {
    if (!token) return;
    try {
      await tlDeleteVehicle(token, id);
      void loadData();
    } catch {
      toast.error(t("tl.saveErr"));
    }
  };

  const saveOps = async () => {
    if (!token || !slug) return;
    setOpsFieldErr(null);
    if (!oForm.worker_id) {
      setOpsFieldErr("worker_id");
      opsWorkerWrapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error(t("validation.fillField", { field: t("tl.opsWorker") }));
      return;
    }
    const log_time = tlCombineTodayWithTime(oForm.log_time) ?? tlDefaultExpectedEntryLocal();
    setSaving(true);
    try {
      await tlCreateOps(token, {
        department: slug,
        worker_id: oForm.worker_id,
        log_time,
        quantity: Number(oForm.quantity),
        delay_reason: oForm.delay_reason,
        target_pct: Number(oForm.target_pct),
      });
      toast.success(t("tl.saved"));
      setOForm((p) => ({
        ...p,
        log_time: "",
        quantity: "0",
        delay_reason: "",
        target_pct: "100",
      }));
      void loadData();
    } catch {
      toast.error(t("tl.saveErr"));
    } finally {
      setSaving(false);
    }
  };

  const deleteOps = async (id: string) => {
    if (!token) return;
    try {
      await tlDeleteOps(token, id);
      void loadData();
    } catch {
      toast.error(t("tl.saveErr"));
    }
  };

  const sendMsg = async () => {
    if (!token || !effectiveSender || !msgTo) return;
    if (!msgBody.trim() && !pendingFile) {
      toast.error(t("tl.msgNeedTextOrFile"));
      return;
    }
    try {
      if (pendingFile) {
        await tlSendMessageWithFile(
          token,
          { from_worker_id: effectiveSender.id, to_worker_id: msgTo, body: msgBody },
          pendingFile
        );
        setPendingFile(null);
      } else {
        await tlSendMessage(token, { from_worker_id: effectiveSender.id, to_worker_id: msgTo, body: msgBody });
      }
      setMsgBody("");
      toast.success(t("tl.msgSent"));
      void loadMessages();
    } catch {
      toast.error(t("tl.msgErr"));
    }
  };

  const openAttachment = async (m: TlMessage) => {
    if (!token || !m.attachment_stored_path) return;
    try {
      const blob = await tlFetchMessageAttachmentBlob(token, m.id);
      const u = URL.createObjectURL(blob);
      window.open(u, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(u), 60_000);
    } catch {
      toast.error(t("tl.downloadFail"));
    }
  };

  const attachGridExcel = async () => {
    if (!slug) return;
    try {
      const f = await buildGridExcelFile({
        isVehicle,
        vehicles: vehicleLogs,
        ops: opsLogs,
        deptLabel: slug,
        fileBase: "tl-grid",
      });
      setPendingFile(f);
      setTab("msg");
      toast.success(t("tl.gridAttachedHint"));
    } catch {
      toast.error(t("tl.exportErr"));
    }
  };

  if (!slug) {
    return (
      <div className="min-h-screen bg-[#050a12] text-white p-8 text-center">
        <p>{t("tl.badDept")}</p>
        <Link to="/app/tl" className="text-[#0052CC] underline">
          {t("tl.backHub")}
        </Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#050a12] text-white p-8 text-center space-y-4">
        <p>{t("tl.lockedTitle")}</p>
        <Link to="/app/pay" className="text-[#0052CC] underline">
          {t("dashboard.subscribe")}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050a12] text-slate-100 flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#050a12]/95 backdrop-blur-md px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[#FF8C00] font-black text-sm">
          {isVehicle ? <Truck className="size-5" /> : <Bus className="size-5" />}
          {t(`tl.dept.${slug}`)}
        </div>
        <div className="flex-1" />
        <LanguageSwitcher />
        <PwaInstallControl variant="header" />
        <Button asChild size="sm" variant="outline" className="border-white/20">
          <Link to="/app/tl">
            <Home className="size-4" />
            {t("tl.fullPlatform")}
          </Link>
        </Button>
      </header>

      <div className="flex gap-2 p-3 border-b border-white/10">
        <Button
          type="button"
          size="sm"
          variant={tab === "ops" ? "default" : "ghost"}
          className={tab === "ops" ? "bg-[#0052CC]" : ""}
          onClick={() => setTab("ops")}
        >
          {t("tl.tabOps")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "msg" ? "default" : "ghost"}
          className={tab === "msg" ? "bg-[#0052CC]" : ""}
          onClick={() => setTab("msg")}
        >
          <MessageSquare className="size-4" />
          {t("tl.tabMessages")}
        </Button>
      </div>

      <main className="flex-1 p-4 max-w-6xl mx-auto w-full space-y-6">
        {magicParam && ctxWorker && (
          <p className="text-xs text-emerald-400/90 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2">
            {t("tl.magicContext")}: <strong>{ctxWorker.full_name}</strong>
          </p>
        )}

        {tab === "msg" && (
          <div className="rounded-2xl border border-cyan-500/25 p-4 space-y-3 bg-black/30">
            {!effectiveSender ? (
              <p className="text-sm text-slate-400">{t("tl.msgNeedWorker")}</p>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  {t("tl.msgFrom")}: <strong>{effectiveSender.full_name}</strong>
                </p>
                <div className="flex flex-wrap gap-2 pb-2 border-b border-white/10">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    onClick={() => void attachGridExcel()}
                  >
                    <FileSpreadsheet className="size-4" />
                    {t("tl.msgAttachGrid")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => void (async () => {
                      if (!token || !slug) return;
                      try {
                        await exportCurrentGridExcel({
                          isVehicle,
                          vehicles: vehicleLogs,
                          ops: opsLogs,
                          deptLabel: slug,
                          fileBase: "tl-export",
                        });
                        toast.success(t("tl.excelDone"));
                      } catch {
                        toast.error(t("tl.exportErr"));
                      }
                    })()}
                  >
                    <Download className="size-4" />
                    {t("tl.msgDownloadExcel")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => void (async () => {
                      if (!token || !slug) return;
                      try {
                        const inc = await tlIncidents(token);
                        await exportCurrentGridPdf({
                          direction: isRtl ? "rtl" : "ltr",
                          lang: locale,
                          title: `${t(`tl.dept.${slug}`)} — ${t("tl.workReport")}`,
                          vehicles: vehicleLogs,
                          ops: opsLogs,
                          incidents: inc.incidents,
                          t,
                          fileBase: "tl-work-report",
                        });
                        toast.success(t("tl.pdfDone"));
                      } catch {
                        toast.error(t("tl.pdfErr"));
                      }
                    })()}
                  >
                    <FileText className="size-4" />
                    {t("tl.msgDownloadPdf")}
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label>{t("tl.msgTo")}</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm"
                      value={msgTo}
                      onChange={(e) => setMsgTo(e.target.value)}
                    >
                      {recipients.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>{t("tl.msgBody")}</Label>
                    <textarea
                      className="mt-1 w-full min-h-[88px] rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm"
                      value={msgBody}
                      onChange={(e) => setMsgBody(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <Label className="flex items-center gap-2">
                      <Upload className="size-4" />
                      {t("tl.msgUploadFile")}
                    </Label>
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      className="text-xs text-slate-400 file:mr-2 file:rounded-lg file:border file:border-white/20 file:bg-white/10 file:px-2 file:py-1"
                      onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
                    />
                    {pendingFile && (
                      <p className="text-xs text-amber-300 flex items-center gap-2">
                        <Paperclip className="size-3 shrink-0" />
                        {pendingFile.name}
                        <button
                          type="button"
                          className="text-slate-400 underline"
                          onClick={() => setPendingFile(null)}
                        >
                          {t("tl.removeFile")}
                        </button>
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  className="gap-2 bg-cyan-600"
                  disabled={!msgBody.trim() && !pendingFile}
                  onClick={() => void sendMsg()}
                >
                  <Send className="size-4" />
                  {t("tl.msgSend")}
                </Button>
                <ul className="space-y-2 max-h-80 overflow-y-auto text-sm">
                  {messages.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-lg border border-white/10 p-3 bg-black/20 space-y-2"
                      lang={isRtl ? "ar" : "en"}
                    >
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                        {ensureLatinDigitsInString(m.created_at)}
                      </span>
                      <p className="text-cyan-200/90 text-sm">
                        {m.from_name} → {m.to_name}
                      </p>
                      <p className="whitespace-pre-wrap text-slate-200">{m.body}</p>
                      {m.attachment_original_name && m.attachment_stored_path && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="gap-1 text-xs"
                            onClick={() => void openAttachment(m)}
                          >
                            <FileText className="size-3" />
                            {m.attachment_original_name}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs"
                            onClick={async () => {
                              if (!token) return;
                              try {
                                const blob = await tlFetchMessageAttachmentBlob(token, m.id);
                                const u = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = u;
                                a.download = m.attachment_original_name ?? "attachment";
                                a.click();
                                URL.revokeObjectURL(u);
                              } catch {
                                toast.error(t("tl.downloadFail"));
                              }
                            }}
                          >
                            <Download className="size-3" />
                            {t("tl.download")}
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {tab === "ops" && loading && <Loader2 className="size-10 animate-spin text-[#0052CC] mx-auto" />}

        {tab === "ops" && !loading && isVehicle && (
          <div className="space-y-6">
            <section
              lang="en"
              dir="ltr"
              className="rounded-2xl border border-white/10 p-4 space-y-3 bg-gradient-to-br from-sky-950/40 to-transparent font-mono tabular-nums"
              style={{ fontVariantNumeric: "lining-nums" }}
            >
              <h2 className="font-bold text-sky-300 font-sans">{t("tl.vehicleAdd")}</h2>
              <p className="text-[11px] text-slate-500 font-sans leading-relaxed">{t("tl.partialSaveHint")}</p>
              <p className="text-[11px] text-cyan-300/80 font-sans leading-relaxed">{t("tl.timeOnlyHint")}</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div ref={vehicleIdWrapRef}>
                  <Label className="font-sans">{t("tl.vVehicleId")} *</Label>
                  <Input
                    className={cn(
                      "mt-1 bg-black/40 border-white/15",
                      vFieldErr === "vehicle_id" && "ring-2 ring-red-500 border-red-500"
                    )}
                    value={vForm.vehicle_id}
                    onChange={(e) => {
                      setVForm((p) => ({ ...p, vehicle_id: e.target.value }));
                      if (vFieldErr === "vehicle_id") setVFieldErr(null);
                    }}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label className="font-sans">{t("tl.vDriver")}</Label>
                  <Input
                    className="mt-1 bg-black/40 border-white/15"
                    value={vForm.driver_name}
                    onChange={(e) => setVForm((p) => ({ ...p, driver_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="font-sans">{t("tl.vPhone")}</Label>
                  <Input
                    className="mt-1 bg-black/40 border-white/15"
                    value={vForm.driver_phone}
                    onChange={(e) => setVForm((p) => ({ ...p, driver_phone: e.target.value }))}
                    inputMode="tel"
                    lang="en-US"
                  />
                </div>
                <div>
                  <Label className="font-sans">{t("tl.vIdDoc")}</Label>
                  <Input
                    className="mt-1 bg-black/40 border-white/15"
                    value={vForm.driver_id_doc}
                    onChange={(e) => setVForm((p) => ({ ...p, driver_id_doc: e.target.value }))}
                    inputMode="numeric"
                    lang="en-US"
                  />
                </div>
                <div>
                  <Label className="font-sans">{t("tl.vKind")}</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm font-sans"
                    value={vForm.vehicle_kind}
                    onChange={(e) =>
                      setVForm((p) => ({ ...p, vehicle_kind: e.target.value === "bus" ? "bus" : "truck" }))
                    }
                  >
                    <option value="truck">{t("tl.kindTruck")}</option>
                    <option value="bus">{t("tl.kindBus")}</option>
                  </select>
                </div>
                <div lang="en-US" dir="ltr">
                  <Label className="font-sans">{t("tl.vExpected")} (HH:mm)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{2}:[0-9]{2}"
                    placeholder="HH:mm"
                    lang="en"
                    dir="ltr"
                    className="mt-1 bg-black/40 border-white/15 font-mono tabular-nums"
                    value={vForm.expected_entry_time}
                    onChange={(e) => setVForm((p) => ({ ...p, expected_entry_time: e.target.value.replace(/[^\d:]/g, "").slice(0, 5) }))}
                  />
                </div>
                <div lang="en-US" dir="ltr">
                  <Label className="font-sans">{t("tl.vEntry")} (HH:mm)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{2}:[0-9]{2}"
                    placeholder="HH:mm"
                    lang="en"
                    dir="ltr"
                    className="mt-1 bg-black/40 border-white/15 font-mono tabular-nums"
                    value={vForm.entry_time}
                    onChange={(e) => setVForm((p) => ({ ...p, entry_time: e.target.value.replace(/[^\d:]/g, "").slice(0, 5) }))}
                  />
                </div>
                <div lang="en-US" dir="ltr">
                  <Label className="font-sans">{t("tl.vExit")} (HH:mm)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{2}:[0-9]{2}"
                    placeholder="HH:mm"
                    lang="en"
                    dir="ltr"
                    className="mt-1 bg-black/40 border-white/15 font-mono tabular-nums"
                    value={vForm.exit_time}
                    onChange={(e) => setVForm((p) => ({ ...p, exit_time: e.target.value.replace(/[^\d:]/g, "").slice(0, 5) }))}
                  />
                </div>
                {vForm.vehicle_kind === "bus" ? (
                  <>
                    <div>
                      <Label className="font-sans">{t("tl.vPassengers")}</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        lang="en-US"
                        className="mt-1 bg-black/40 border-white/15"
                        value={vForm.passenger_count}
                        onChange={(e) => setVForm((p) => ({ ...p, passenger_count: e.target.value.replace(/[^\d.-]/g, "") }))}
                      />
                    </div>
                    <div>
                      <Label className="font-sans">{t("tl.vSeats")}</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        lang="en-US"
                        className="mt-1 bg-black/40 border-white/15"
                        value={vForm.seat_count}
                        onChange={(e) => setVForm((p) => ({ ...p, seat_count: e.target.value.replace(/[^\d.-]/g, "") }))}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label className="font-sans">{t("tl.vCargo")}</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        lang="en-US"
                        className="mt-1 bg-black/40 border-white/15"
                        value={vForm.cargo_count}
                        onChange={(e) => setVForm((p) => ({ ...p, cargo_count: e.target.value.replace(/[^\d.-]/g, "") }))}
                      />
                    </div>
                    <div>
                      <Label className="font-sans">{t("tl.vBoxes")}</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        lang="en-US"
                        className="mt-1 bg-black/40 border-white/15"
                        value={vForm.box_count}
                        onChange={(e) => setVForm((p) => ({ ...p, box_count: e.target.value.replace(/[^\d.-]/g, "") }))}
                      />
                    </div>
                  </>
                )}
                <div className="sm:col-span-2 md:col-span-3">
                  <Label className="font-sans">{t("tl.vNotes")}</Label>
                  <Input
                    className="mt-1 bg-black/40 border-white/15 font-sans"
                    value={vForm.notes}
                    onChange={(e) => setVForm((p) => ({ ...p, notes: e.target.value }))}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-3 font-sans">
                  <input
                    type="checkbox"
                    checked={vForm.marked_success}
                    onChange={(e) => setVForm((p) => ({ ...p, marked_success: e.target.checked }))}
                  />
                  {t("tl.vMarkSuccess")}
                </label>
              </div>
              <Button
                type="button"
                disabled={saving}
                className="bg-sky-600 font-sans"
                onClick={() => void saveVehicle()}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : t("tl.saveRow")}
              </Button>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1"
                onClick={() => void attachGridExcel()}
              >
                <FileSpreadsheet className="size-4" />
                {t("tl.shareGridInChat")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => void (async () => {
                  if (!token || !slug) return;
                  try {
                    await exportCurrentGridExcel({
                      isVehicle: true,
                      vehicles: vehicleLogs,
                      ops: [],
                      deptLabel: slug,
                      fileBase: "tl-vehicles",
                    });
                    toast.success(t("tl.excelDone"));
                  } catch {
                    toast.error(t("tl.exportErr"));
                  }
                })()}
              >
                <Download className="size-4" />
                {t("tl.msgDownloadExcel")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => void (async () => {
                  if (!token || !slug) return;
                  try {
                    const inc = await tlIncidents(token);
                    await exportCurrentGridPdf({
                      direction: isRtl ? "rtl" : "ltr",
                      lang: locale,
                      title: `${t(`tl.dept.${slug}`)} — ${t("tl.workReport")}`,
                      vehicles: vehicleLogs,
                      ops: [],
                      incidents: inc.incidents,
                      t,
                      fileBase: "tl-vehicles-report",
                    });
                    toast.success(t("tl.pdfDone"));
                  } catch {
                    toast.error(t("tl.pdfErr"));
                  }
                })()}
              >
                <FileText className="size-4" />
                {t("tl.msgDownloadPdf")}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10" lang="en" dir="ltr">
              <table className="w-full text-xs md:text-sm border-collapse min-w-[800px] font-mono tabular-nums">
                <thead>
                  <tr className="bg-white/5 text-slate-400 text-left">
                    <th className="p-2">{t("tl.vVehicleId")}</th>
                    <th className="p-2">{t("tl.vDriver")}</th>
                    <th className="p-2">{t("tl.vPhone")}</th>
                    <th className="p-2">{t("tl.vExpected")}</th>
                    <th className="p-2">{t("tl.vEntry")}</th>
                    <th className="p-2">{t("tl.vExit")}</th>
                    <th className="p-2">{t("tl.colExtra")}</th>
                    <th className="p-2">{t("tl.colStatus")}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {vehicleLogs.map((r) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="p-2">{ensureLatinDigitsInString(String(r.vehicle_id))}</td>
                      <td className="p-2 font-sans">{r.driver_name}</td>
                      <td className="p-2">{ensureLatinDigitsInString(String(r.driver_phone))}</td>
                      <td className="p-2 whitespace-nowrap">{ensureLatinDigitsInString(r.expected_entry_at)}</td>
                      <td className="p-2 whitespace-nowrap">
                        {r.entry_at ? ensureLatinDigitsInString(r.entry_at) : "—"}
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        {r.exit_at ? ensureLatinDigitsInString(r.exit_at) : "—"}
                      </td>
                      <td className="p-2 font-sans text-[11px]">
                        {r.vehicle_kind === "bus"
                          ? `${t("tl.vPassengers")}: ${formatTlLatinInt(r.passenger_count)} / ${t("tl.vSeats")}: ${formatTlLatinInt(r.seat_count)}`
                          : `${t("tl.vCargo")}: ${formatTlLatinInt(r.cargo_count)} / ${t("tl.vBoxes")}: ${formatTlLatinInt(r.box_count)}`}
                      </td>
                      <td className="p-2">
                        {statusPill(r.alert_level, Boolean(r.marked_success), t)}
                        {r.delay_minutes > 0 && (
                          <span className="block text-[10px] text-slate-500 mt-1">
                            Δ {formatTlLatinInt(r.delay_minutes)} {t("tl.minutes")}
                          </span>
                        )}
                      </td>
                      <td className="p-2 space-x-1">
                        <Button type="button" size="sm" variant="secondary" onClick={() => void toggleVehicleSuccess(r)}>
                          {r.marked_success ? t("tl.unmarkSuccess") : t("tl.markSuccess")}
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => void deleteVehicle(r.id)}>
                          {t("tl.delete")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "ops" && !loading && !isVehicle && (
          <div className="space-y-6">
            <section className="rounded-2xl border border-violet-500/25 p-4 space-y-3 bg-violet-950/20">
              <h2 className="font-bold text-violet-300">{t("tl.opsAdd")}</h2>
              <p className="text-[11px] text-violet-200/80">{t("tl.timeOnlyHint")}</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div
                  ref={opsWorkerWrapRef}
                  className={cn(
                    "sm:col-span-2 rounded-lg transition-[box-shadow]",
                    opsFieldErr === "worker_id" && "ring-2 ring-red-500 ring-offset-2 ring-offset-[#1a0f2e]"
                  )}
                >
                  <Label>{t("tl.opsWorker")}</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm"
                    value={oForm.worker_id}
                    onChange={(e) => {
                      setOForm((p) => ({ ...p, worker_id: e.target.value }));
                      if (opsFieldErr === "worker_id") setOpsFieldErr(null);
                    }}
                  >
                    <option value="">{t("tl.pickWorker")}</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name} ({ensureLatinDigitsInString(String(w.employee_id ?? ""))})
                      </option>
                    ))}
                  </select>
                </div>
                <div lang="en-US" dir="ltr">
                  <Label>{t("tl.opsTime")} (HH:mm)</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{2}:[0-9]{2}"
                    placeholder="HH:mm"
                    lang="en"
                    dir="ltr"
                    className="mt-1 bg-black/40 border-white/15 font-mono tabular-nums"
                    style={{ fontVariantNumeric: "lining-nums" }}
                    value={oForm.log_time}
                    onChange={(e) => setOForm((p) => ({ ...p, log_time: e.target.value.replace(/[^\d:]/g, "").slice(0, 5) }))}
                  />
                </div>
                <div lang="en-US" dir="ltr">
                  <Label>{t("tl.opsQty")}</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    lang="en-US"
                    className="mt-1 bg-black/40 border-white/15 font-mono tabular-nums"
                    style={{ fontVariantNumeric: "lining-nums" }}
                    value={oForm.quantity}
                    onChange={(e) => setOForm((p) => ({ ...p, quantity: e.target.value.replace(/[^\d.-]/g, "") }))}
                  />
                </div>
                <div lang="en-US" dir="ltr">
                  <Label>{t("tl.opsTarget")}</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    lang="en-US"
                    className="mt-1 bg-black/40 border-white/15 font-mono tabular-nums"
                    style={{ fontVariantNumeric: "lining-nums" }}
                    value={oForm.target_pct}
                    onChange={(e) =>
                      setOForm((p) => ({ ...p, target_pct: e.target.value.replace(/[^\d.-]/g, "") }))
                    }
                  />
                </div>
                <div className="sm:col-span-2 md:col-span-3">
                  <Label>{t("tl.opsDelay")}</Label>
                  <Input
                    className="mt-1 bg-black/40 border-white/15"
                    value={oForm.delay_reason}
                    onChange={(e) => setOForm((p) => ({ ...p, delay_reason: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="button" disabled={saving} className="bg-violet-600" onClick={() => void saveOps()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : t("tl.saveRow")}
              </Button>
            </section>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1"
                onClick={() => void attachGridExcel()}
              >
                <FileSpreadsheet className="size-4" />
                {t("tl.shareGridInChat")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => void (async () => {
                  if (!token || !slug) return;
                  try {
                    await exportCurrentGridExcel({
                      isVehicle: false,
                      vehicles: [],
                      ops: opsLogs,
                      deptLabel: slug,
                      fileBase: "tl-ops",
                    });
                    toast.success(t("tl.excelDone"));
                  } catch {
                    toast.error(t("tl.exportErr"));
                  }
                })()}
              >
                <Download className="size-4" />
                {t("tl.msgDownloadExcel")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => void (async () => {
                  if (!token || !slug) return;
                  try {
                    const inc = await tlIncidents(token);
                    await exportCurrentGridPdf({
                      direction: isRtl ? "rtl" : "ltr",
                      lang: locale,
                      title: `${t(`tl.dept.${slug}`)} — ${t("tl.workReport")}`,
                      vehicles: [],
                      ops: opsLogs,
                      incidents: inc.incidents,
                      t,
                      fileBase: "tl-ops-report",
                    });
                    toast.success(t("tl.pdfDone"));
                  } catch {
                    toast.error(t("tl.pdfErr"));
                  }
                })()}
              >
                <FileText className="size-4" />
                {t("tl.msgDownloadPdf")}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10" lang="en" dir="ltr">
              <table className="w-full text-xs md:text-sm border-collapse min-w-[640px] font-mono tabular-nums">
                <thead>
                  <tr className="bg-white/5 text-slate-400 text-left">
                    <th className="p-2 font-sans">{t("tl.opsWorker")}</th>
                    <th className="p-2 font-sans">{t("tl.opsTime")}</th>
                    <th className="p-2 font-sans">{t("tl.opsQty")}</th>
                    <th className="p-2 font-sans">{t("tl.opsTarget")}</th>
                    <th className="p-2 font-sans">{t("tl.opsDelay")}</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {opsLogs.map((r) => (
                    <tr key={r.id} className="border-t border-white/5">
                      <td className="p-2 font-sans">{r.worker_full_name}</td>
                      <td className="p-2 whitespace-nowrap">{ensureLatinDigitsInString(r.log_time)}</td>
                      <td className="p-2">{formatTlLatinNum(r.quantity)}</td>
                      <td className="p-2">
                        <span
                          className={
                            r.target_pct >= 100
                              ? "text-emerald-400"
                              : r.target_pct >= 80
                                ? "text-amber-400"
                                : "text-red-400"
                          }
                        >
                          {formatTlLatinInt(r.target_pct)}%
                        </span>
                      </td>
                      <td className="p-2 max-w-[200px] truncate">{r.delay_reason}</td>
                      <td className="p-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => void deleteOps(r.id)}>
                          {t("tl.delete")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
