import { useMemo, useState } from "react";
import { Car, Search, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/I18nProvider";

const MODELS = [
  "Dacia Logan / Sandero",
  "Peugeot 208 / 308",
  "Renault Clio / Megane",
  "Volkswagen Golf / Polo",
  "Mercedes C-Class",
  "BMW Série 3",
];

export function TechAutoModule() {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState("");
  const [model, setModel] = useState(MODELS[0]);

  const hint = useMemo(() => {
    const c = code.trim().toUpperCase();
    if (!c) return t("techauto.searchHint");
    if (c.startsWith("P0")) return t("techauto.obd.powertrain");
    if (c.startsWith("P1")) return t("techauto.obd.generic");
    if (c.startsWith("C")) return t("techauto.obd.chassis");
    return t("techauto.obd.lookup");
  }, [code, t]);

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-start gap-4">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[#0052CC]/20 border border-[#0052CC]/40 shrink-0">
          <Wrench className="size-6 text-[#FF8C00]" />
        </span>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">{t("techauto.title")}</h1>
          <p className="text-slate-400 mt-1">{t("techauto.subtitle")}</p>
        </div>
      </div>

      <Card className="border-slate-800/80 bg-[#0a1628]/80">
        <CardHeader>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Search className="size-5 text-[#0052CC]" />
            {t("techauto.diagnosisTitle")}
          </h2>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="obd">{t("techauto.obdCode")}</Label>
            <div className="relative">
              <Input
                id="obd"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="P0420"
                className="bg-[#050a12] border-slate-700 font-mono uppercase pr-10"
              />
              <Search className="absolute top-1/2 -translate-y-1/2 size-4 text-slate-500 end-3" />
            </div>
            <p className="text-xs text-[#FF8C00]/90">{hint}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model" className="flex items-center gap-2">
              <Car className="size-4 text-slate-400" />
              {t("techauto.carModel")}
            </Label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-10 rounded-md border border-slate-700 bg-[#050a12] px-3 text-sm text-white"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prob">{t("techauto.problemDesc")}</Label>
            <textarea
              id="prob"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              rows={5}
              className="w-full rounded-md border border-slate-700 bg-[#050a12] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#0052CC]/50"
              placeholder={t("techauto.problemPlaceholder")}
            />
          </div>

          <Button type="button" className="bg-[#0052CC] hover:bg-[#0044a8]">
            {t("techauto.saveReport")}
          </Button>
        </CardContent>
      </Card>
      <TintWrapWidget currentLang="ar" />
    </div>
  );
}
// ==========================================
// 2. TINT & WRAP MASTER FEATURE
// ==========================================

const mockVehicles = [
  {
    id: 'dacia-logan',
    brand: 'Dacia',
    model: 'Logan',
    type: 'car',
    dimensions: {
      frontWindshield: 1.20,
      rearWindshield: 1.10,
      sideFrontRight: 0.40,
      sideFrontLeft: 0.40,
      sideRearRight: 0.40,
      sideRearLeft: 0.40,
      commercialWrap: 0
    }
  },
  {
    id: 'volkswagen-golf7',
    brand: 'Volkswagen',
    model: 'Golf 7',
    type: 'car',
    dimensions: {
      frontWindshield: 1.30,
      rearWindshield: 1.00,
      sideFrontRight: 0.35,
      sideFrontLeft: 0.35,
      sideRearRight: 0.35,
      sideRearLeft: 0.35,
      commercialWrap: 0
    }
  },
  {
    id: 'renault-kangoo',
    brand: 'Renault',
    model: 'Kangoo',
    type: 'van',
    dimensions: {
      frontWindshield: 1.50,
      rearWindshield: 1.20,
      sideFrontRight: 0.45,
      sideFrontLeft: 0.45,
      sideRearRight: 0.30,
      sideRearLeft: 0.30,
      commercialWrap: 4.50
    }
  },
  {
    id: 'mercedes-sprinter',
    brand: 'Mercedes',
    model: 'Sprinter (Fourgon)',
    type: 'truck',
    dimensions: {
      frontWindshield: 1.80,
      rearWindshield: 0, 
      sideFrontRight: 0.50,
      sideFrontLeft: 0.50,
      sideRearRight: 0,
      sideRearLeft: 0,
      commercialWrap: 12.00
    }
  },
  {
    id: 'bus-isuzu',
    brand: 'Isuzu',
    model: 'Bus / الحافلات',
    type: 'bus',
    dimensions: {
      frontWindshield: 2.80,
      rearWindshield: 2.20,
      sideFrontRight: 1.10,
      sideFrontLeft: 1.10,
      sideRearRight: 6.50,
      sideRearLeft: 6.50,
      commercialWrap: 25.00
    }
  }
];

const widgetTranslations = {
  ar: {
    title: "📊 الحساب الذكي للفيمي والملصقات (Tint & Wrap)",
    selectVehicle: "-- اختر المركبة أو أدخل يدوياً --",
    customVehicle: "✍️ كتابة مركبة مخصصة (يدوياً)",
    vehicleType: "نوع المركبة المخصصة:",
    brandLabel: "الماركة / الشركة (مثال: Toyota):",
    modelLabel: "الموديل / الاسم (مثال: Hilux):",
    partsTitle: "اختر الأجزاء والجهات بالتفصيل:",
    frontWindshield: "الزجاج الأمامي (Pare-brise Avant)",
    rearWindshield: "الزجاج الخلفي (Lunette Arrière)",
    sideFrontRight: "الزجاج الجانبي الأمامي - يمين (Droit)",
    sideFrontLeft: "الزجاج الجانبي الأمامي - شمال (Gauche)",
    sideRearRight: "الزجاج الجانبي الخلفي - يمين (Droit)",
    sideRearLeft: "الزجاج الجانبي الخلفي - شمال (Gauche)",
    commercialWrap: "تغليف إشهاري كامل للمركبة (Wrapping)",
    customDimensions: "المساحة الإجمالية (متر مربع m²):",
    generateBtn: "🤖 توليد الحساب الذكي للمقاسات",
    totalArea: "المساحة الإجمالية المطلوبة:",
    ceramicNote: "ملاحظة: المقاسات تعطي المساحة الصافية بالـ m²، يرجى إضافة 10% للهدر أثناء التقطيع.",
    car: "سيارة صغيرة", van: "سيارة تجارية / غوندا", truck: "شاحنة / فورغون", bus: "حافلة كبيرة"
  },
  fr: {
    title: "📊 Calculateur Intelligent de Teintage & Wrapping",
    selectVehicle: "-- Choisir le véhicule ou saisir manuellement --",
    customVehicle: "✍️ Saisir un véhicule personnalisé",
    vehicleType: "Type de véhicule personnalisé:",
    brandLabel: "Marque (Ex: Toyota):",
    modelLabel: "Modèle (Ex: Hilux):",
    partsTitle: "Choisir les zones et côtés en détail :",
    frontWindshield: "Pare-brise Avant",
    rearWindshield: "Lunette Arrière",
    sideFrontRight: "Vitre Latérale Avant - Droit",
    sideFrontLeft: "Vitre Latérale Avant - Gauche",
    sideRearRight: "Vitre Latérale Arrière - Droit",
    sideRearLeft: "Vitre Latérale Arrière - Gauche",
    commercialWrap: "Wrapping Publicitaire Complet",
    customDimensions: "Surface Totale (m²) :",
    generateBtn: "🤖 Générer l'estimation intelligente",
    totalArea: "Surface Totale Requise :",
    ceramicNote: "Note : Dimensions nettes en m². Ajoutez 10% pour les chutes.",
    car: "Voiture", van: "Utilitaire / Camionnette", truck: "Camion / Fourgon", bus: "Autobus"
  }
};

export function TintWrapWidget({ currentLang }: { currentLang: string }) {
  const isArabic = currentLang && currentLang.startsWith('ar');
  const t = isArabic ? widgetTranslations.ar : widgetTranslations.fr;

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  
  const [customBrand, setCustomBrand] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [customType, setCustomType] = useState('car');
  const [customArea, setCustomArea] = useState(0);

  const [selections, setSelections] = useState({
    frontWindshield: false,
    rearWindshield: false,
    sideFrontRight: false,
    sideFrontLeft: false,
    sideRearRight: false,
    sideRearLeft: false,
    commercialWrap: false
  });

  const handleVehicleChange = (e: any) => {
    const val = e.target.value;
    setSelectedVehicleId(val);
    setIsCustom(val === 'custom');
    if (val !== 'custom') {
      setCustomArea(0);
    }
  };

  const toggleSelection = (part: any) => {
    setSelections((prev: any) => ({ ...prev, [part]: !prev[part] }));
  };

  // ميزة التوليد الذكي المحلي للمركبات المخصصة بناءً على أجزائها ونوعها
  const handleLocalGeneration = () => {
    // مقادير افتراضية ذكية لكل نوع سيارة في حالة الإدخال اليدوي
    const baseSpecs: Record<string, Record<string, number>> = {
      car: { front: 1.25, rear: 1.05, sideFR: 0.38, sideFL: 0.38, sideRR: 0.38, sideRL: 0.38, wrap: 0 },
      van: { front: 1.50, rear: 1.20, sideFR: 0.45, sideFL: 0.45, sideRR: 0.35, sideRL: 0.35, wrap: 5.00 },
      truck: { front: 1.85, rear: 0, sideFR: 0.52, sideFL: 0.52, sideRR: 0, sideRL: 0, wrap: 14.00 },
      bus: { front: 2.90, rear: 2.30, sideFR: 1.15, sideFL: 1.15, sideRR: 6.80, sideRL: 6.80, wrap: 28.00 }
    };

    const specs = baseSpecs[customType] || baseSpecs.car;
    let generatedSum = 0;

    if (selections.frontWindshield) generatedSum += specs.front;
    if (selections.rearWindshield) generatedSum += specs.rear;
    if (selections.sideFrontRight) generatedSum += specs.sideFR;
    if (selections.sideFrontLeft) generatedSum += specs.sideFL;
    if (selections.sideRearRight) generatedSum += specs.sideRR;
    if (selections.sideRearLeft) generatedSum += specs.sideRL;
    if (selections.commercialWrap) generatedSum += specs.wrap;

    setCustomArea(parseFloat(generatedSum.toFixed(2)));
  };

  const calculateTotal = () => {
    if (isCustom) return customArea;
    const vehicle = mockVehicles.find(v => v.id === selectedVehicleId);
    if (!vehicle) return 0;

    let total = 0;
    if (selections.frontWindshield) total += vehicle.dimensions.frontWindshield;
    if (selections.rearWindshield) total += vehicle.dimensions.rearWindshield;
    if (selections.sideFrontRight) total += vehicle.dimensions.sideFrontRight;
    if (selections.sideFrontLeft) total += vehicle.dimensions.sideFrontLeft;
    if (selections.sideRearRight) total += vehicle.dimensions.sideRearRight;
    if (selections.sideRearLeft) total += vehicle.dimensions.sideRearLeft;
    if (selections.commercialWrap) total += vehicle.dimensions.commercialWrap;
    
    return parseFloat(total.toFixed(2));
  };

  const totalArea = calculateTotal();

  return (
    <div className="mt-6 p-6 bg-[#0f172a] rounded-xl border border-slate-800 text-white shadow-xl" dir={isArabic ? 'rtl' : 'ltr'}>
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-slate-800 pb-3">
        {t.title}
      </h3>

      <div className="mb-4">
        <select 
          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          value={selectedVehicleId}
          onChange={handleVehicleChange}
        >
          <option value="">{t.selectVehicle}</option>
          {mockVehicles.map(v => (
            <option key={v.id} value={v.id}>{v.brand} {v.model} ({t[v.type as keyof typeof t] || v.type})</option>
          ))}
          <option value="custom">{t.customVehicle}</option>
        </select>
      </div>

      {isCustom && (
        <div className="p-4 bg-slate-900/60 rounded-lg border border-dashed border-slate-700 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.vehicleType}</label>
              <select className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none" value={customType} onChange={(e: any) => setCustomType(e.target.value)}>
                <option value="car">{t.car}</option>
                <option value="van">{t.van}</option>
                <option value="truck">{t.truck}</option>
                <option value="bus">{t.bus}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.brandLabel}</label>
              <input type="text" className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white text-sm" value={customBrand} onChange={(e: any) => setCustomBrand(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t.modelLabel}</label>
              <input type="text" className="w-full p-2 bg-slate-800 border border-slate-700 rounded text-white text-sm" value={customModel} onChange={(e: any) => setCustomModel(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {selectedVehicleId && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-semibold text-blue-400 mb-2">{t.partsTitle}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition">
              <input type="checkbox" className="rounded text-blue-600" checked={selections.frontWindshield} onChange={() => toggleSelection('frontWindshield')} />
              <span className="text-sm">{t.frontWindshield}</span>
            </label>
            <label className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition">
              <input type="checkbox" className="rounded text-blue-600" checked={selections.rearWindshield} onChange={() => toggleSelection('rearWindshield')} />
              <span className="text-sm">{t.rearWindshield}</span>
            </label>
            <label className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition">
              <input type="checkbox" className="rounded text-blue-600" checked={selections.sideFrontRight} onChange={() => toggleSelection('sideFrontRight')} />
              <span className="text-sm">{t.sideFrontRight}</span>
            </label>
            <label className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition">
              <input type="checkbox" className="rounded text-blue-600" checked={selections.sideFrontLeft} onChange={() => toggleSelection('sideFrontLeft')} />
              <span className="text-sm">{t.sideFrontLeft}</span>
            </label>
            <label className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition">
              <input type="checkbox" className="rounded text-blue-600" checked={selections.sideRearRight} onChange={() => toggleSelection('sideRearRight')} />
              <span className="text-sm">{t.sideRearRight}</span>
            </label>
            <label className="flex items-center gap-3 p-2.5 bg-slate-900 rounded-lg cursor-pointer hover:bg-slate-800 transition">
              <input type="checkbox" className="rounded text-blue-600" checked={selections.sideRearLeft} onChange={() => toggleSelection('sideRearLeft')} />
              <span className="text-sm">{t.sideRearLeft}</span>
            </label>
          </div>
          <div className="pt-2 border-t border-slate-800/60 mt-2">
            <label className="flex items-center gap-3 p-2.5 bg-blue-950/20 border border-blue-900/40 rounded-lg cursor-pointer hover:bg-blue-950/40 transition">
              <input type="checkbox" className="rounded text-emerald-500" checked={selections.commercialWrap} onChange={() => toggleSelection('commercialWrap')} />
              <span className="text-sm text-slate-200 font-medium">{t.commercialWrap}</span>
            </label>
          </div>

          {/* زر التوليد الذكي يظهر فقط للمركبات المخصصة يدوياً */}
          {isCustom && (
            <button 
              type="button"
              onClick={handleLocalGeneration}
              className="w-full mt-3 p-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-sm rounded-lg transition shadow-md active:scale-[0.99]"
            >
              {t.generateBtn}
            </button>
          )}
        </div>
      )}

      {isCustom && (
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <label className="block text-xs text-slate-400 mb-1">{t.customDimensions}</label>
          <input 
            type="number" 
            step="0.01" 
            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-base focus:outline-none focus:border-emerald-500" 
            placeholder="0.00"
            value={customArea || ''} 
            onChange={(e: any) => setCustomArea(parseFloat(e.target.value) || 0)} 
          />
        </div>
      )}

      <div className="p-4 bg-emerald-950/30 border border-emerald-900/50 rounded-xl flex justify-between items-center mt-5">
        <span className="font-semibold text-slate-300 text-sm">{t.totalArea}</span>
        <span className="text-2xl font-black text-emerald-400">{totalArea} m²</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-2 italic text-center">{t.ceramicNote}</p>
    </div>
  );
}