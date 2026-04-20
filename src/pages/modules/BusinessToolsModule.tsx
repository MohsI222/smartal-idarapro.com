import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bot, Building2, Calculator, Landmark, Package, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { navItemVisibleForModules } from "@/constants/navModuleMap";
import type { SectionId } from "@/constants/sections";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n/I18nProvider";

const TOOLS: {
  to: string;
  titleKey: string;
  descKey: string;
  icon: typeof Building2;
  gradient: string;
}[] = [
  {
    to: "/app/gov",
    titleKey: "tools.publicGateway",
    descKey: "tools.publicGatewayDesc",
    icon: Landmark,
    gradient: "from-cyan-500/30 to-[#0052CC]/25",
  },
  {
    to: "/app/company",
    titleKey: "tools.sarl",
    descKey: "tools.sarlDesc",
    icon: Building2,
    gradient: "from-[#0052CC]/40 to-[#003d99]/20",
  },
  {
    to: "/app/inventory?tab=dash",
    titleKey: "tools.inventory",
    descKey: "tools.inventoryDesc",
    icon: Package,
    gradient: "from-teal-500/25 to-[#0052CC]/20",
  },
  {
    to: "/app/hr",
    titleKey: "tools.hr",
    descKey: "tools.hrDesc",
    icon: Building2,
    gradient: "from-[#FF8C00]/30 to-[#cc7000]/15",
  },
  {
    to: "/app/acc",
    titleKey: "tools.tax",
    descKey: "tools.taxDesc",
    icon: Calculator,
    gradient: "from-emerald-500/25 to-emerald-900/20",
  },
  {
    to: "/app/legal-ai",
    titleKey: "tools.legalAi",
    descKey: "tools.legalAiDesc",
    icon: Scale,
    gradient: "from-violet-500/25 to-[#0052CC]/20",
  },
];

export function BusinessToolsModule() {
  const { t } = useI18n();
  const { isApproved, approvedModules } = useAuth();
  const mods = approvedModules as SectionId[];
  const visibleTools = useMemo(
    () => TOOLS.filter((tool) => isApproved && navItemVisibleForModules(tool.to, mods)),
    [isApproved, mods]
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">{t("tools.title")}</h1>
        <p className="text-slate-400 mt-1">{t("tools.subtitle")}</p>
      </div>

      {visibleTools.length === 0 && (
        <p className="text-sm text-slate-500 rounded-xl border border-slate-800 p-6 bg-[#0a1628]/60">
          {t("tools.emptyForPlan")}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleTools.map((tool, i) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.titleKey} to={tool.to} className="block group idara-animate-in" style={{ animationDelay: `${i * 70}ms` }}>
              <Card className="h-full border-slate-800/80 bg-[#0a1628]/80 hover:border-[#0052CC]/50 transition-all duration-300 overflow-hidden">
                <CardContent className="p-0 flex flex-col sm:flex-row">
                  <div
                    className={`sm:w-36 shrink-0 bg-gradient-to-br ${tool.gradient} flex items-center justify-center py-10 sm:py-0 border-b sm:border-b-0 sm:border-e border-slate-800/60`}
                  >
                    <Icon className="size-12 text-white drop-shadow-md" strokeWidth={1.25} />
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-center">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-lg font-bold text-white group-hover:text-[#FF8C00] transition-colors">
                        {t(tool.titleKey)}
                      </h2>
                      <Bot className="size-5 text-slate-600 group-hover:text-[#0052CC] shrink-0" />
                    </div>
                    <p className="text-sm text-slate-400 mt-2 leading-relaxed">{t(tool.descKey)}</p>
                    <span className="text-xs text-[#0052CC] mt-4 font-medium">{t("tools.open")} →</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
