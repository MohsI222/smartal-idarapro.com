declare module "arabic-persian-reshaper" {
  const arabicPersianReshaper: {
    ArabicShaper: { convertArabic(s: string): string };
    PersianShaper: { convertPersian(s: string): string };
  };
  export default arabicPersianReshaper;
}
