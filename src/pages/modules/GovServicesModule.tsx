/**
 * Official / utility links are plain <a href="..."> only — no prefetch, no fetch, no embedding.
 */
import { Link } from "react-router-dom";
import {
  Briefcase,
  Building2,
  Car,
  FileBadge,
  FileText,
  Fingerprint,
  Globe2,
  Landmark,
  Lock,
  Plane,
  PlugZap,
  Train,
  Wallet,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

type GovItem = {
  id: string;
  labelKey: string;
  icon: typeof Landmark;
  accent: string;
  href: string;
};

const ESSENTIAL_ITEMS: GovItem[] = [
  {
    id: "cnss",
    labelKey: "gov.cnss",
    icon: Building2,
    accent: "from-[#0052CC]/40 to-[#003d99]/30",
    href: "https://www.cnss.ma/",
  },
  {
    id: "passport",
    labelKey: "gov.passport",
    icon: FileBadge,
    accent: "from-[#FF8C00]/35 to-[#cc7000]/25",
    href: "https://www.passeport.ma/",
  },
  {
    id: "casier",
    labelKey: "gov.casier",
    icon: Fingerprint,
    accent: "from-slate-600/40 to-slate-800/30",
    href: "https://www.justice.gov.ma/",
  },
  {
    id: "ae",
    labelKey: "gov.autoEntrepreneur",
    icon: Briefcase,
    accent: "from-emerald-500/30 to-emerald-800/20",
    href: "https://www.portail-autoentrepreneur.ma/accueil.aspx",
  },
  {
    id: "dgi",
    labelKey: "gov.dgi",
    icon: Landmark,
    accent: "from-[#0052CC]/35 to-cyan-900/25",
    href: "https://www.tax.gov.ma/",
  },
  {
    id: "narsa",
    labelKey: "gov.narsa",
    icon: Car,
    accent: "from-[#FF8C00]/30 to-amber-900/25",
    href: "https://www.narsa.ma/",
  },
];

type GatewayTile = {
  id: string;
  labelKey: string;
  stepsKey: string;
  href: string;
  icon: typeof PlugZap;
  accent: string;
};

const GATEWAY_UTILITIES: GatewayTile[] = [
  {
    id: "onee",
    labelKey: "gov.util.onee",
    stepsKey: "gov.util.oneeSteps",
    href: "https://www.onee.ma/fr",
    icon: PlugZap,
    accent: "from-cyan-500/35 to-[#0052CC]/30",
  },
  {
    id: "lydec",
    labelKey: "gov.util.lydec",
    stepsKey: "gov.util.lydecSteps",
    href: "https://www.lydec.ma/",
    icon: Wallet,
    accent: "from-sky-500/30 to-blue-900/25",
  },
  {
    id: "orange",
    labelKey: "gov.util.orange",
    stepsKey: "gov.util.orangeSteps",
    href: "https://www.orange.ma/",
    icon: Wifi,
    accent: "from-orange-500/35 to-[#cc7000]/25",
  },
  {
    id: "inwi",
    labelKey: "gov.util.inwi",
    stepsKey: "gov.util.inwiSteps",
    href: "https://www.inwi.ma/",
    icon: Wifi,
    accent: "from-purple-500/30 to-fuchsia-900/20",
  },
];

const GATEWAY_DOCS: GatewayTile[] = [
  {
    id: "portal",
    labelKey: "gov.doc.portal",
    stepsKey: "gov.doc.portalSteps",
    href: "https://www.portailnational.ma/",
    icon: Globe2,
    accent: "from-[#0052CC]/40 to-emerald-700/20",
  },
  {
    id: "civil",
    labelKey: "gov.doc.civil",
    stepsKey: "gov.doc.civilSteps",
    href: "https://www.interieur.gov.ma/",
    icon: FileText,
    accent: "from-amber-500/30 to-rose-800/20",
  },
  {
    id: "forms",
    labelKey: "gov.doc.forms",
    stepsKey: "gov.doc.formsSteps",
    href: "https://www.service-public.ma/",
    icon: FileBadge,
    accent: "from-teal-500/25 to-[#003d99]/25",
  },
];

const GATEWAY_TRAVEL: GatewayTile[] = [
  {
    id: "dv",
    labelKey: "gov.tr.dv",
    stepsKey: "gov.tr.dvSteps",
    href: "https://travel.state.gov/content/travel/en/us-visas/immigrate/diversity-visa-program-entry/diversity-visa-instructions.html",
    icon: Plane,
    accent: "from-indigo-500/35 to-[#0052CC]/25",
  },
  {
    id: "anapec",
    labelKey: "gov.tr.anapec",
    stepsKey: "gov.tr.anapecSteps",
    href: "https://www.anapec.ma/",
    icon: Briefcase,
    accent: "from-emerald-500/30 to-cyan-800/20",
  },
  {
    id: "oncf",
    labelKey: "gov.tr.oncf",
    stepsKey: "gov.tr.oncfSteps",
    href: "https://www.oncf.ma/",
    icon: Train,
    accent: "from-[#FF8C00]/35 to-red-900/20",
  },
  {
    id: "ram",
    labelKey: "gov.tr.ram",
    stepsKey: "gov.tr.ramSteps",
    href: "https://www.royalairmaroc.com/",
    icon: Plane,
    accent: "from-red-600/30 to-slate-800/25",
  },
];

export function GovServicesModule() {
  const { t } = useI18n();
  const { isApproved, approvedModules } = useAuth();
  const allowed = isApproved && approvedModules.includes("gov");

  if (!allowed) {
    return (
      <div className="rounded-2xl border border-orange-500/30 p-8 text-center space-y-4 max-w-lg mx-auto">
        <Lock className="size-12 mx-auto text-orange-400" />
        <h2 className="text-xl font-bold">{t("gov.lockedTitle")}</h2>
        <p className="text-slate-400 text-sm">{t("gov.lockedDesc")}</p>
        <Button asChild>
          <Link to="/app/pay">{t("dashboard.subscribe")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-6xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">{t("gov.title")}</h1>
        <p className="text-slate-400 mt-1 text-sm md:text-base font-semibold">{t("gov.subtitle")}</p>
      </div>

      <section
        className="rounded-3xl border border-[#0052CC]/35 bg-gradient-to-br from-[#0a1628] via-[#0d1f35] to-[#050a12] p-5 md:p-8 shadow-[0_20px_60px_rgba(0,82,204,0.12)]"
        aria-labelledby="gateway-heading"
      >
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FF8C00]/20 border border-[#FF8C00]/40 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-[#FF8C00]">
            <Globe2 className="size-4" />
            {t("gov.gatewayBadge")}
          </span>
          <p className="text-sm text-slate-300 flex-1 min-w-[200px]">{t("gov.gatewayLead")}</p>
        </div>

        <h2 id="gateway-heading" className="text-lg font-black text-white mb-4 flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#0052CC]" />
          {t("gov.sec.utilities")}
        </h2>
        <GatewayGrid items={GATEWAY_UTILITIES} t={t} />

        <h2 className="text-lg font-black text-white mt-10 mb-4 flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#FF8C00]" />
          {t("gov.sec.docs")}
        </h2>
        <GatewayGrid items={GATEWAY_DOCS} t={t} />

        <h2 className="text-lg font-black text-white mt-10 mb-4 flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400" />
          {t("gov.sec.travel")}
        </h2>
        <GatewayGrid items={GATEWAY_TRAVEL} t={t} />
      </section>

      <section aria-labelledby="essential-heading">
        <h2 id="essential-heading" className="text-lg font-bold text-white mb-4">
          {t("gov.essentialShortcuts")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {ESSENTIAL_ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-right rounded-2xl border border-slate-800/80 bg-[#0a1628]/60 p-1 hover:border-[#0052CC] hover:bg-[#0a1628] hover:shadow-[0_8px_30px_rgba(0,82,204,0.12)] transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/50 focus:ring-offset-2 focus:ring-offset-[#050a12] idara-animate-in active:scale-[0.98]"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <Card className="border-0 bg-transparent shadow-none h-full">
                  <CardContent className="p-4 md:p-6 flex flex-col items-center text-center gap-3">
                    <div
                      className={`size-14 md:size-16 rounded-2xl bg-gradient-to-br ${item.accent} border-2 border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="size-7 md:size-8 text-white drop-shadow-lg" strokeWidth={2} />
                    </div>
                    <span className="text-sm md:text-base font-black text-white leading-snug">
                      {t(item.labelKey)}
                    </span>
                    <span className="text-[10px] font-bold text-[#0052CC] opacity-80">{t("gov.tapOpen")}</span>
                  </CardContent>
                </Card>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function GatewayGrid({
  items,
  t,
}: {
  items: GatewayTile[];
  t: (k: string) => string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group rounded-2xl border border-slate-700/80 bg-[#050a12]/50 hover:border-[#FF8C00]/50 hover:bg-[#0a1628]/90 transition-all duration-300 p-4 flex gap-4 text-right items-start idara-animate-in"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div
              className={`shrink-0 size-14 rounded-2xl bg-gradient-to-br ${item.accent} border border-white/10 flex items-center justify-center shadow-lg group-hover:scale-[1.03] transition-transform`}
            >
              <Icon className="size-7 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className="text-sm md:text-base font-black text-white leading-snug group-hover:text-[#FF8C00] transition-colors">
                {t(item.labelKey)}
              </h3>
              <p className="text-[11px] md:text-xs text-slate-400 leading-relaxed border-s border-[#0052CC]/40 ps-3">
                <span className="font-bold text-[#0052CC]/90 block mb-1">{t("gov.stepsTitle")}</span>
                {t(item.stepsKey)}
              </p>
              <span className="inline-flex text-[10px] font-bold text-emerald-400/90">{t("gov.openOfficial")} →</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
