import type { AppLocale } from "@/i18n/strings";
import type { ContractPdfClauseCopy, SubscriptionContractFieldSet } from "@/lib/subscriptionContractPdfHtml";

function otherLang(locale: AppLocale): "en" | "fr" | "es" {
  if (locale === "fr") return "fr";
  if (locale === "es") return "es";
  if (locale === "ar-MA" || locale === "ar-SA") return "en";
  return "en";
}

const AR: ContractPdfClauseCopy = {
  docTitleAr: "اتفاقية اشتراك — منصّة سمارت الإدارة",
  docTitleOther: "",
  kingdomAr: "المملكة المغربية",
  kingdomOther: "",
  introAr:
    "تمهيد: يُبرم هذا الاتفاق بين ممثل منصّة Smart Al-Idara Pro (الطرف الأول) وبين المشترك المُحدَّد أعلاه (الطرف الثاني)، وفقاً للتشريع الجاري به العمل المتعلّق بحماية المعطيات ذات الطابع الشخصي (القانون 09-08) والمقتضيات المتعلقة بالاقتصاد الرقمي بالمغرب.",
  introOther: "",
  partiesAr:
    "أطراف الاتفاق: يقرّ الطرفان بأهليتهما الكاملة للتعاقد، وبصحة البيانات المدخلة في هذا النموذج، على أن يُرفق بالنسخ الأصلية عند التصديق عند الاقتضاء.",
  partiesOther: "",
  objectAr:
    "موضوع الاتفاق: يمنح الاشتراك حق استخدام الخدمات الرقمية للمنصّة (حسب الباقة المختارة) ضمن حدود المدة والأجر المتفق عليهما، دون أن يُفهم من ذلك منح أي امتياز غير منصوص عليه صراحة.",
  objectOther: "",
  financialAr:
    "الالتزامات المالية: يُسدَّد الأجر وفق الدورة المختارة (شهرية أو سنوية) بالدرهم المغربي، عبر الوسائل المعتمدة من المنصّة (تحويل بنكي، وكلاء معتمدون، أو بوابة دفع عند توفرها). لا تُعتبر الخدمة مؤكدة إلا بعد استيفاء إجراءات التحقق الاداريّة للدفع عند الاقتضاء.",
  financialOther: "",
  durationAr:
    "المدة والإنهاء: يبدأ الاشتراك من تاريخ البدء وينتهي في تاريخ الانتهاء المذكورين، ويجوز تمديده باتفاق كتابي. يحتفظ الطرف الأول بحق تعليق الوصول في حالة مخالفة جدية لشروط الاستخدام أو عدم السداد.",
  durationOther: "",
  validityAr:
    "الشفافية والامتثال: يقرّ الطرفان بأن العملية قائمة على أساس شفاف، وبلا غش يمسّ سلامة المعاملات الإلكترونية، وبما يتوافق مع المساطر المعمول بها في إطار الاقتصاد الرقمي بالمغرب. تُعالَج المعطيات الشخصية وفق سياسة الخصوصية المنشورة وبما ينسجم مع القانون 09-08.",
  validityOther: "",
  signaturesAr:
    "التوقيعات: يُوقَّع هذا النموذج في المكان والتاريخ المذكورين، ويُمكن إنجاز التصديق أمام السلطات المختصة (جماعة، مقاطعة، عدول، إلخ) بحسب الحالة. توقيع الطرف الأول — توقيع الطرف الثاني.",
  signaturesOther: "",
  colArabic: "النسخة العربية (مرجع ثابت)",
  colTranslation: "",
};

const EN: Partial<ContractPdfClauseCopy> = {
  docTitleOther: "Subscription agreement — Smart Al-Idara platform",
  kingdomOther: "Kingdom of Morocco",
  introOther:
    "Preamble: this agreement is entered into between the representative of Smart Al-Idara Pro (Party A) and the subscriber identified above (Party B), in accordance with applicable law on personal data protection (Law 09-08) and Morocco’s digital economy framework.",
  partiesOther:
    "Parties: both parties declare legal capacity and the accuracy of the information provided; originals may be required for legalization where applicable.",
  objectOther:
    "Purpose: the subscription grants use of the platform’s digital services (per the selected plan) for the agreed term and fee, without implying any rights not expressly stated.",
  financialOther:
    "Payment: fees are due in Moroccan dirhams (MAD) according to the billing cycle, via approved methods (bank transfer, authorized agents, or online payment when available). Access may require administrative payment verification.",
  durationOther:
    "Term & termination: the subscription runs from the start date to the end date and may be renewed in writing. Party A may suspend access in case of serious breach or non-payment.",
  validityOther:
    "Transparency & compliance: the parties affirm a transparent process, without fraud affecting e-transactions, consistent with Morocco’s digital economy rules. Personal data is processed per the published privacy policy and Law 09-08.",
  signaturesOther:
    "Signatures: executed at the place and on the principles stated; legalization may be completed before the competent authority (commune, préfecture, adoul, etc.) as required. Party A — Party B.",
  colTranslation: "Selected language column (EN)",
};

const FR: Partial<ContractPdfClauseCopy> = {
  docTitleOther: "Convention d’abonnement — plateforme Smart Al-Idara",
  kingdomOther: "Royaume du Maroc",
  introOther:
    "Préambule : le présent acte lie le représentant de Smart Al-Idara Pro (partie A) et l’abonné désigné ci-dessus (partie B), conformément au droit applicable en matière de protection des données à caractère personnel (loi 09-08) et au cadre de l’économie numérique au Maroc.",
  partiesOther:
    "Parties : les parties déclarent avoir la capacité juridique et l’exactitude des informations ; des originaux peuvent être exigés pour la légalisation le cas échéant.",
  objectOther:
    "Objet : l’abonnement ouvre un droit d’usage des services numériques (selon l’offre) pour la durée et la redevance convenues, sans autre garantie expresse.",
  financialOther:
    "Modalités financières : la redevance est payable en dirhams selon la périodicité choisie, via les moyens agréés (virement, agents, paiement en ligne si disponible). Une vérification administrative peut être requise.",
  durationOther:
    "Durée et résiliation : l’abonnement court entre les dates indiquées et peut être prorogé par écrit. La partie A peut suspendre l’accès en cas de manquement grave ou d’impayé.",
  validityOther:
    "Transparence et conformité : les parties affirment la transparence de l’opération et l’absence de fraude portant atteinte aux transactions électroniques, en cohérence avec l’économie numérique au Maroc. Les données sont traitées selon la politique de confidentialité et la loi 09-08.",
  signaturesOther:
    "Signatures : fait au lieu et selon les principes indiqués ; légalisation possible auprès de l’autorité compétente (commune, préfecture, adoul, etc.). Partie A — Partie B.",
  colTranslation: "Colonne langue choisie (FR)",
};

const ES: Partial<ContractPdfClauseCopy> = {
  docTitleOther: "Contrato de suscripción — plataforma Smart Al-Idara",
  kingdomOther: "Reino de Marruecos",
  introOther:
    "Preámbulo: el presente acuerdo vincula al representante de Smart Al-Idara Pro (parte A) y al suscriptor indicado (parte B), conforme a la normativa de protección de datos personales (ley 09-08) y al marco de la economía digital en Marruecos.",
  partiesOther:
    "Partes: ambas declaran capacidad jurídica y veracidad de los datos; pueden exigirse originales para legalización cuando proceda.",
  objectOther:
    "Objeto: la suscripción otorga el uso de los servicios digitales según el plan elegido, por el plazo y precio convenidos, sin otros derechos no expresados.",
  financialOther:
    "Pagos: el precio se paga en dirhams según la periodicidad, mediante medios autorizados (transferencia, agentes, pago en línea si existe). Puede requerirse verificación administrativa.",
  durationOther:
    "Plazo y terminación: la suscripción va desde la fecha de inicio hasta la de fin y puede prorrogarse por escrito. La parte A puede suspender el acceso por incumplimiento grave o impago.",
  validityOther:
    "Transparencia y cumplimiento: las partes afirman transparencia y ausencia de fraude en las transacciones electrónicas, alineado con la economía digital en Marruecos. Los datos se tratan según la política de privacidad y la ley 09-08.",
  signaturesOther:
    "Firmas: firmado en el lugar indicado; legalización ante la autoridad competente si aplica. Parte A — Parte B.",
  colTranslation: "Columna idioma seleccionado (ES)",
};

export function getContractPdfClauses(locale: AppLocale): ContractPdfClauseCopy {
  const ol = otherLang(locale);
  const patch = ol === "fr" ? FR : ol === "es" ? ES : EN;
  return { ...AR, ...patch, docTitleOther: patch.docTitleOther ?? EN.docTitleOther ?? "" };
}

const ROW_AR: SubscriptionContractFieldSet["rowLabels"] = {
  partyAAr: "بيانات الطرف الأول (ممثل المنصّة)",
  partyAOther: "",
  partyBAr: "بيانات الطرف الثاني (المشترك)",
  partyBOther: "",
  entityAr: "نوع الكيان / الجهة",
  entityOther: "",
  planAr: "باقة الاشتراك",
  planOther: "",
  billingAr: "دورة الفوترة",
  billingOther: "",
  feeAr: "الأجر المتفق عليه (درهم)",
  feeOther: "",
  startAr: "تاريخ البدء",
  startOther: "",
  endAr: "تاريخ الانتهاء",
  endOther: "",
  placeAr: "مكان التوقيع (جماعة / مقاطعة)",
  placeOther: "",
  payAr: "الدفع",
  payOther: "",
};

const ROW_EN: Partial<SubscriptionContractFieldSet["rowLabels"]> = {
  partyAOther: "Party A (platform representative)",
  partyBOther: "Party B (subscriber)",
  entityOther: "Entity type",
  planOther: "Subscription plan",
  billingOther: "Billing cycle",
  feeOther: "Agreed fee (MAD)",
  startOther: "Start date",
  endOther: "End date",
  placeOther: "Place of signing (commune / préfecture)",
  payOther: "Payment",
};

const ROW_FR: Partial<SubscriptionContractFieldSet["rowLabels"]> = {
  partyAOther: "Partie A (représentant de la plateforme)",
  partyBOther: "Partie B (abonné)",
  entityOther: "Type d’entité",
  planOther: "Offre d’abonnement",
  billingOther: "Période de facturation",
  feeOther: "Redevance convenue (MAD)",
  startOther: "Date de début",
  endOther: "Date de fin",
  placeOther: "Lieu de signature (commune / préfecture)",
  payOther: "Paiement",
};

const ROW_ES: Partial<SubscriptionContractFieldSet["rowLabels"]> = {
  partyAOther: "Parte A (representante de la plataforma)",
  partyBOther: "Parte B (suscriptor)",
  entityOther: "Tipo de entidad",
  planOther: "Plan de suscripción",
  billingOther: "Ciclo de facturación",
  feeOther: "Tarifa acordada (MAD)",
  startOther: "Fecha de inicio",
  endOther: "Fecha de fin",
  placeOther: "Lugar de firma (comuna / prefectura)",
  payOther: "Pago",
};

export function getContractPdfRowLabels(locale: AppLocale): SubscriptionContractFieldSet["rowLabels"] {
  const ol = otherLang(locale);
  const patch = ol === "fr" ? ROW_FR : ol === "es" ? ROW_ES : ROW_EN;
  return { ...ROW_AR, ...patch };
}

const PAY_AR =
  "تحويل بنكي، Wafacash، Cash Plus، أو الدفع عبر المنصّة عند توفر بوابة آمنة. يُرفق وصل الدفع للتحقق الإداري.";

const PAY_EN =
  "Bank transfer, Wafacash, Cash Plus, or on-platform payment when a secure gateway is available. Attach the receipt for administrative verification.";

const PAY_FR =
  "Virement bancaire, Wafacash, Cash Plus, ou paiement via la plateforme si un tunnel sécurisé est disponible. Joindre le reçu pour vérification administrative.";

const PAY_ES =
  "Transferencia bancaria, Wafacash, Cash Plus o pago en la plataforma si hay pasarela segura. Adjuntar el comprobante para verificación administrativa.";

export function getContractPaymentNotes(locale: AppLocale): { ar: string; other: string } {
  const ol = otherLang(locale);
  return {
    ar: PAY_AR,
    other: ol === "fr" ? PAY_FR : ol === "es" ? PAY_ES : PAY_EN,
  };
}
