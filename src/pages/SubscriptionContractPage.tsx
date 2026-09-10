import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, Home } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PLAN_OPTIONS, planPriceDh, type BillingPeriod } from "@/constants/plans";
import { useI18n } from "@/i18n/I18nProvider";
import { getContractPdfClauses, getContractPdfRowLabels, getContractPaymentNotes } from "@/i18n/contractPdfClauses";
import { translate } from "@/i18n/strings";
import { buildSubscriptionContractPdfHtml } from "@/lib/subscriptionContractPdfHtml";
import { downloadPdfFromFullHtmlDocument } from "@/lib/pdfCanvasExport";
import { addCalendarYearsIsoLocal, todayIsoLocal } from "@/lib/todayIso";
import { cn } from "@/lib/utils";

const ENTITY_IDS = [
  "enterprise",
  "commerce",
  "institute",
  "center",
  "library",
  "lawyer",
  "adoul",
  "accountant",
  "auto_entrepreneur",
  "other",
] as const;

export function SubscriptionContractPage() {
  const { t, locale, formatNumber, latinize } = useI18n();
  const [planId, setPlanId] = useState(PLAN_OPTIONS[0]?.id ?? "");
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [entityId, setEntityId] = useState<(typeof ENTITY_IDS)[number]>("enterprise");

  const [directorName, setDirectorName] = useState("");
  const [directorCin, setDirectorCin] = useState("");
  const [directorAddress, setDirectorAddress] = useState("");
  const [directorPhone, setDirectorPhone] = useState("");
  const [subscriberName, setSubscriberName] = useState("");
  const [subscriberCin, setSubscriberCin] = useState("");
  const [subscriberAddress, setSubscriberAddress] = useState("");
  const [subscriberPhone, setSubscriberPhone] = useState("");
  const [startDate, setStartDate] = useState(() => todayIsoLocal());
  const [endDate, setEndDate] = useState(() => addCalendarYearsIsoLocal(todayIsoLocal(), 1));
  const [signaturePlace, setSignaturePlace] = useState("");
  const [busy, setBusy] = useState(false);

  const plan = useMemo(() => PLAN_OPTIONS.find((p) => p.id === planId) ?? PLAN_OPTIONS[0], [planId]);
  const priceDh = plan ? planPriceDh(plan, billing) : 0;

  const planLabelAr = useMemo(
    () => (plan ? latinize(translate("ar-MA", plan.labelKey)) : ""),
    [plan, latinize]
  );
  const planLabelOther = useMemo(
    () => (plan ? latinize(translate(locale, plan.labelKey)) : ""),
    [plan, locale, latinize]
  );

  const billingAr = latinize(
    translate("ar-MA", billing === "monthly" ? "contract.billingMonthly" : "contract.billingYearly")
  );
  const billingOther = latinize(
    translate(locale, billing === "monthly" ? "contract.billingMonthly" : "contract.billingYearly")
  );

  const entityAr = latinize(translate("ar-MA", `contract.entity.${entityId}`));
  const entityOther = latinize(translate(locale, `contract.entity.${entityId}`));

  const downloadPdf = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const clauses = getContractPdfClauses(locale);
      const rowLabels = getContractPdfRowLabels(locale);
      const pay = getContractPaymentNotes(locale);
      const logoSrc = new URL("/logo.svg", window.location.origin).href;
      const html = buildSubscriptionContractPdfHtml({
        logoSrc,
        clauses,
        fields: {
          directorName,
          directorCin,
          directorAddress,
          directorPhone,
          subscriberName,
          subscriberCin,
          subscriberAddress,
          subscriberPhone,
          entityTypeLabelAr: entityAr,
          entityTypeLabelOther: entityOther,
          planLabelAr,
          planLabelOther,
          billingPeriodLabelAr: billingAr,
          billingPeriodLabelOther: billingOther,
          priceDh,
          startDate: startDate || "—",
          endDate: endDate || "—",
          signaturePlace: signaturePlace || "—",
          paymentNoteAr: pay.ar,
          paymentNoteOther: pay.other,
          rowLabels,
        },
      });
      await downloadPdfFromFullHtmlDocument(html, {
        fileName: `Smart_Al-Idara_convention_abonnement.pdf`,
        fitSinglePage: false,
        preCaptureDelayMs: 120,
      });
      toast.success(t("contract.pdfOk"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("contract.pdfErr"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030711] text-white" dir="auto">
      <div className="border-b border-slate-800 bg-[#0a1628]/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" className="gap-2 text-slate-300" asChild>
            <Link to="/">
              <Home className="size-4" />
              {t("common.back")}
            </Link>
          </Button>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 pb-24">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-l from-[#C1272D] via-[#006233] to-[#0052CC] bg-clip-text text-transparent">
            {t("contract.pageTitle")}
          </h1>
          <p className="text-slate-400 mt-2 text-sm leading-relaxed">{t("contract.pageSubtitle")}</p>
        </div>

        <Card className="border-slate-700/80 bg-[#0a1628]/90 backdrop-blur-xl">
          <CardHeader>
            <h2 className="text-lg font-bold text-white">{t("contract.sectionParties")}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-slate-500">{t("contract.directorHint")}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("contract.directorName")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={directorName}
                  onChange={(e) => setDirectorName(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("contract.directorCin")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={directorCin}
                  onChange={(e) => setDirectorCin(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("contract.address")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={directorAddress}
                  onChange={(e) => setDirectorAddress(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("contract.phone")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={directorPhone}
                  onChange={(e) => setDirectorPhone(e.target.value)}
                />
              </div>
            </div>

            <h3 className="text-sm font-bold text-slate-300 pt-2">{t("contract.subscriberBlock")}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("contract.subscriberName")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={subscriberName}
                  onChange={(e) => setSubscriberName(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("contract.subscriberCin")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={subscriberCin}
                  onChange={(e) => setSubscriberCin(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("contract.address")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={subscriberAddress}
                  onChange={(e) => setSubscriberAddress(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("contract.phone")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={subscriberPhone}
                  onChange={(e) => setSubscriberPhone(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700/80 bg-[#0a1628]/90 backdrop-blur-xl">
          <CardHeader>
            <h2 className="text-lg font-bold text-white">{t("contract.sectionPlan")}</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("contract.entityType")}</Label>
              <select
                className={cn(
                  "mt-1 w-full h-11 rounded-md border border-slate-600 bg-[#050a12]/80 px-3 text-sm",
                  "text-white"
                )}
                value={entityId}
                onChange={(e) => setEntityId(e.target.value as (typeof ENTITY_IDS)[number])}
              >
                {ENTITY_IDS.map((id) => (
                  <option key={id} value={id}>
                    {latinize(translate(locale, `contract.entity.${id}`))}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("contract.pickPlan")}</Label>
              <select
                className="mt-1 w-full h-11 rounded-md border border-slate-600 bg-[#050a12]/80 px-3 text-sm text-white"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {latinize(translate(locale, p.labelKey))}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="bill"
                  checked={billing === "monthly"}
                  onChange={() => setBilling("monthly")}
                />
                {t("contract.billingMonthly")} —{" "}
                <span dir="ltr" className="font-digits-latin">
                  {plan ? formatNumber(plan.priceMonthlyDh, { maximumFractionDigits: 0 }) : "—"}
                </span>{" "}
                MAD
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="bill"
                  checked={billing === "yearly"}
                  onChange={() => setBilling("yearly")}
                />
                {t("contract.billingYearly")} —{" "}
                <span dir="ltr" className="font-digits-latin">
                  {plan ? formatNumber(plan.priceYearlyDh, { maximumFractionDigits: 0 }) : "—"}
                </span>{" "}
                MAD
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("contract.startDate")}</Label>
                <Input
                  type="date"
                  lang="en"
                  dir="ltr"
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>{t("contract.endDate")}</Label>
                <Input
                  type="date"
                  lang="en"
                  dir="ltr"
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>{t("contract.signaturePlace")}</Label>
                <Input
                  className="mt-1 bg-[#050a12]/80 border-slate-600"
                  placeholder={t("contract.signaturePlacePh")}
                  value={signaturePlace}
                  onChange={(e) => setSignaturePlace(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-[#0a1628]/90">
          <CardHeader>
            <h2 className="text-lg font-bold text-white">{t("contract.paymentSection")}</h2>
          </CardHeader>
          <CardContent className="text-sm text-slate-400 space-y-2 leading-relaxed">
            <p>{t("contract.paymentBody")}</p>
          </CardContent>
        </Card>

        <Button
          type="button"
          size="lg"
          disabled={busy}
          className="w-full h-12 font-bold bg-gradient-to-l from-[#006233] to-[#0052CC] hover:opacity-95 gap-2"
          onClick={() => void downloadPdf()}
        >
          <FileDown className="size-5" />
          {busy ? t("legalAi.exporting") : t("contract.downloadPdf")}
        </Button>

        <p className="text-[11px] text-slate-600 text-center leading-relaxed">{t("contract.disclaimer")}</p>
      </div>
    </div>
  );
}
