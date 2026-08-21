/**
 * Visa Radar Configuration - Dynamic Location System
 * Structured configuration for countries, cities, and visa centers
 */

export interface VisaCenter {
  id: string;
  country: string;
  countryAr: string;
  city: string;
  cityAr: string;
  provider: string;
  url: string;
  enabled: boolean;
  priority: number; // Higher = checked more frequently
}

export interface CountryConfig {
  code: string;
  name: string;
  nameAr: string;
  flag: string;
  centers: VisaCenter[];
}

export const VISA_RADAR_CONFIG: CountryConfig[] = [
  {
    code: "ES",
    name: "Spain",
    nameAr: "إسبانيا",
    flag: "🇪🇸",
    centers: [
      {
        id: "es-tangier",
        country: "Spain",
        countryAr: "إسبانيا",
        city: "Tangier",
        cityAr: "طنجة",
        provider: "BLS",
        url: "https://spain.blsspainvisa.com/morocco/tangier/index.php",
        enabled: true,
        priority: 10
      },
      {
        id: "es-rabat",
        country: "Spain",
        countryAr: "إسبانيا",
        city: "Rabat",
        cityAr: "الرباط",
        provider: "BLS",
        url: "https://spain.blsspainvisa.com/morocco/rabat/index.php",
        enabled: true,
        priority: 10
      },
      {
        id: "es-casablanca",
        country: "Spain",
        countryAr: "إسبانيا",
        city: "Casablanca",
        cityAr: "الدار البيضاء",
        provider: "BLS",
        url: "https://spain.blsspainvisa.com/morocco/casablanca/index.php",
        enabled: true,
        priority: 10
      },
      {
        id: "es-agadir",
        country: "Spain",
        countryAr: "إسبانيا",
        city: "Agadir",
        cityAr: "أكادير",
        provider: "BLS",
        url: "https://spain.blsspainvisa.com/morocco/agadir/index.php",
        enabled: true,
        priority: 8
      },
      {
        id: "es-marrakech",
        country: "Spain",
        countryAr: "إسبانيا",
        city: "Marrakech",
        cityAr: "مراكش",
        provider: "BLS",
        url: "https://spain.blsspainvisa.com/morocco/marrakech/index.php",
        enabled: true,
        priority: 8
      },
      {
        id: "es-fes",
        country: "Spain",
        countryAr: "إسبانيا",
        city: "Fes",
        cityAr: "فاس",
        provider: "BLS",
        url: "https://spain.blsspainvisa.com/morocco/fes/index.php",
        enabled: true,
        priority: 7
      }
    ]
  },
  {
    code: "FR",
    name: "France",
    nameAr: "فرنسا",
    flag: "🇫🇷",
    centers: [
      {
        id: "fr-casablanca",
        country: "France",
        countryAr: "فرنسا",
        city: "Casablanca",
        cityAr: "الدار البيضاء",
        provider: "TLS",
        url: "https://www.france-visas.gouv.fr/web/casablanca",
        enabled: true,
        priority: 9
      },
      {
        id: "fr-rabat",
        country: "France",
        countryAr: "فرنسا",
        city: "Rabat",
        cityAr: "الرباط",
        provider: "TLS",
        url: "https://www.france-visas.gouv.fr/web/rabat",
        enabled: true,
        priority: 9
      },
      {
        id: "fr-tangier",
        country: "France",
        countryAr: "فرنسا",
        city: "Tangier",
        cityAr: "طنجة",
        provider: "TLS",
        url: "https://www.france-visas.gouv.fr/web/tangier",
        enabled: true,
        priority: 9
      },
      {
        id: "fr-agadir",
        country: "France",
        countryAr: "فرنسا",
        city: "Agadir",
        cityAr: "أكادير",
        provider: "TLS",
        url: "https://www.france-visas.gouv.fr/web/agadir",
        enabled: true,
        priority: 7
      }
    ]
  },
  {
    code: "IT",
    name: "Italy",
    nameAr: "إيطاليا",
    flag: "🇮🇹",
    centers: [
      {
        id: "it-casablanca",
        country: "Italy",
        countryAr: "إيطاليا",
        city: "Casablanca",
        cityAr: "الدار البيضاء",
        provider: "VFS",
        url: "https://visa.vfsglobal.com/mar/en/ita",
        enabled: true,
        priority: 8
      },
      {
        id: "it-rabat",
        country: "Italy",
        countryAr: "إيطاليا",
        city: "Rabat",
        cityAr: "الرباط",
        provider: "VFS",
        url: "https://visa.vfsglobal.com/mar/en/ita",
        enabled: true,
        priority: 8
      }
    ]
  },
  {
    code: "DE",
    name: "Germany",
    nameAr: "ألمانيا",
    flag: "🇩🇪",
    centers: [
      {
        id: "de-casablanca",
        country: "Germany",
        countryAr: "ألمانيا",
        city: "Casablanca",
        cityAr: "الدار البيضاء",
        provider: "VFS",
        url: "https://visa.vfsglobal.com/mar/en/deu",
        enabled: true,
        priority: 8
      }
    ]
  },
  {
    code: "PT",
    name: "Portugal",
    nameAr: "البرتغال",
    flag: "🇵🇹",
    centers: [
      {
        id: "pt-casablanca",
        country: "Portugal",
        countryAr: "البرتغال",
        city: "Casablanca",
        cityAr: "الدار البيضاء",
        provider: "VFS",
        url: "https://visa.vfsglobal.com/mar/en/prt",
        enabled: true,
        priority: 7
      }
    ]
  }
];

export function getEnabledCenters(): VisaCenter[] {
  const allCenters: VisaCenter[] = [];
  for (const country of VISA_RADAR_CONFIG) {
    for (const center of country.centers) {
      if (center.enabled) {
        allCenters.push(center);
      }
    }
  }
  return allCenters.sort((a, b) => b.priority - a.priority);
}

export function getCenterById(id: string): VisaCenter | undefined {
  for (const country of VISA_RADAR_CONFIG) {
    const center = country.centers.find(c => c.id === id);
    if (center) return center;
  }
  return undefined;
}

export function getCentersByCountry(countryCode: string): VisaCenter[] {
  const country = VISA_RADAR_CONFIG.find(c => c.code === countryCode);
  return country?.centers.filter(c => c.enabled) || [];
}
