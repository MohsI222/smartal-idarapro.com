/**
 * مراكز تأشيرة — روابط رسمية (فتح في نافذة جديدة).
 * يُوسَّع ليشمل جميع المدن المغربية الرئيسية (ليس الدار البيضاء فقط).
 */
export type VisaCenterEntry = {
  id: string;
  countryKey: string;
  embassyKey: string;
  cityKey: string;
  providerKey: string;
  flag: string;
  centerUrl: string;
};

const MOROCCAN_CITIES: { slug: string; cityKey: string }[] = [
  { slug: "casablanca", cityKey: "visa.city.casablanca" },
  { slug: "rabat", cityKey: "visa.city.rabat" },
  { slug: "tangier", cityKey: "visa.city.tangier" },
  { slug: "agadir", cityKey: "visa.city.agadir" },
  { slug: "marrakech", cityKey: "visa.city.marrakech" },
  { slug: "fes", cityKey: "visa.city.fes" },
  { slug: "meknes", cityKey: "visa.city.meknes" },
  { slug: "oujda", cityKey: "visa.city.oujda" },
];

type CountrySeed = {
  idBase: string;
  countryKey: string;
  embassyKey: string;
  providerKey: string;
  flag: string;
  centerUrl: string;
};

const COUNTRIES: CountrySeed[] = [
  {
    idBase: "es",
    countryKey: "visa.spain",
    embassyKey: "visa.embassy.spain",
    providerKey: "visa.provider.bls",
    flag: "🇪🇸",
    centerUrl: "https://blsspainmorocco.com/",
  },
  {
    idBase: "fr",
    countryKey: "visa.france",
    embassyKey: "visa.embassy.france",
    providerKey: "visa.provider.tls",
    flag: "🇫🇷",
    centerUrl: "https://www.france-visas.gouv.fr/",
  },
  {
    idBase: "it",
    countryKey: "visa.italy",
    embassyKey: "visa.embassy.italy",
    providerKey: "visa.provider.vfs",
    flag: "🇮🇹",
    centerUrl: "https://visa.vfsglobal.com/mar/en/ita",
  },
  {
    idBase: "de",
    countryKey: "visa.germany",
    embassyKey: "visa.embassy.germany",
    providerKey: "visa.provider.vfs",
    flag: "🇩🇪",
    centerUrl: "https://visa.vfsglobal.com/mar/en/deu",
  },
  {
    idBase: "pt",
    countryKey: "visa.portugal",
    embassyKey: "visa.embassy.portugal",
    providerKey: "visa.provider.vfs",
    flag: "🇵🇹",
    centerUrl: "https://visa.vfsglobal.com/mar/en/prt",
  },
  {
    idBase: "nl",
    countryKey: "visa.netherlands",
    embassyKey: "visa.embassy.netherlands",
    providerKey: "visa.provider.vfs",
    flag: "🇳🇱",
    centerUrl: "https://visa.vfsglobal.com/mar/en/nld",
  },
  {
    idBase: "be",
    countryKey: "visa.belgium",
    embassyKey: "visa.embassy.belgium",
    providerKey: "visa.provider.vfs",
    flag: "🇧🇪",
    centerUrl: "https://visa.vfsglobal.com/mar/en/bel",
  },
  {
    idBase: "at",
    countryKey: "visa.austria",
    embassyKey: "visa.embassy.austria",
    providerKey: "visa.provider.vfs",
    flag: "🇦🇹",
    centerUrl: "https://visa.vfsglobal.com/mar/en/aut",
  },
];

export const VISA_CENTER_ENTRIES: VisaCenterEntry[] = COUNTRIES.flatMap((c) =>
  MOROCCAN_CITIES.map((city) => ({
    id: `${c.idBase}-${city.slug}`,
    countryKey: c.countryKey,
    embassyKey: c.embassyKey,
    cityKey: city.cityKey,
    providerKey: c.providerKey,
    flag: c.flag,
    centerUrl: c.centerUrl,
  }))
);
