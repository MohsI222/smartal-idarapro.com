/**
 * محتوى تصدير PDF الإداري: وضع مبسّط (بدون مقاطع قانونية)، وتحديد مسافة خاصة لطلبات تغيير عنوان السكن.
 */

/** إزالة المقاطع القانونية الإرشادية بين سطر الموضوع وبداية صورة المُعنِي — لوضع «طلب مبسّط». */
export function stripLegalBoilerplateForSimpleExport(body: string, lang: string): string {
  const t = body.trim();
  if (!t) return t;
  const l = lang.toLowerCase();

  if (l.startsWith("ar")) {
    const salIdx = t.indexOf("تحية طيبة وبعد،");
    const subj = t.match(/الموضوع:[^\n]*/);
    if (subj && subj.index !== undefined && salIdx > subj.index + subj[0].length) {
      const afterSubj = subj.index + subj[0].length;
      const mid = t.slice(afterSubj, salIdx).trim();
      if (
        mid.length > 40 &&
        /الإطار|الفصل|القانون|بناءً|طلاباً|قانون|الظهير|دستور/i.test(mid)
      ) {
        return `${t.slice(0, afterSubj).trimEnd()}\n\n${t.slice(salIdx).trimStart()}`.trim();
      }
    }
    return t;
  }

  if (l.startsWith("fr")) {
    const subj = t.match(/Objet\s*:[^\n]*/i);
    const sign = t.indexOf("Je soussigné");
    if (subj && subj.index !== undefined && sign > subj.index + subj[0].length) {
      const afterSubj = subj.index + subj[0].length;
      const mid = t.slice(afterSubj, sign).trim();
      if (mid.length > 40 && /Cadre juridique|Dahir|procédure|code|loi n/i.test(mid)) {
        return `${t.slice(0, afterSubj).trimEnd()}\n\n${t.slice(sign).trimStart()}`.trim();
      }
    }
    return t;
  }

  if (l.startsWith("es")) {
    const subj = t.match(/Asunto\s*:[^\n]*/i);
    const sign = t.search(/(?:^|\n)Yo,?\s+/m);
    if (subj && subj.index !== undefined && sign > subj.index + subj[0].length) {
      const afterSubj = subj.index + subj[0].length;
      const mid = t.slice(afterSubj, sign).trim();
      if (mid.length > 40 && /Marco jurídico|Constitución|Dahir|procedimiento/i.test(mid)) {
        return `${t.slice(0, afterSubj).trimEnd()}\n\n${t.slice(sign).trimStart()}`.trim();
      }
    }
    return t;
  }

  const subj = t.match(/Subject\s*:[^\n]*/i);
  const sign = t.indexOf("I, the undersigned");
  if (subj && subj.index !== undefined && sign > subj.index + subj[0].length) {
    const afterSubj = subj.index + subj[0].length;
    const mid = t.slice(afterSubj, sign).trim();
    if (mid.length > 40 && /Legal framework|Dahir|Procedure|Code|Law\s/i.test(mid)) {
      return `${t.slice(0, afterSubj).trimEnd()}\n\n${t.slice(sign).trimStart()}`.trim();
    }
  }
  return t;
}

/** مسافات أوضح للواجهة: طلب «تبديل عنوان السكن» أو ما يعادله. */
export function isAddressChangeRequestProfile(
  requestTypeId: string,
  requestTypeLabel: string,
  customLabel: string
): boolean {
  if (requestTypeId === "address_change") return true;
  const blob = `${requestTypeLabel}\n${customLabel}`.replace(/\s+/g, " ");
  return (
    /تبديل\s+عنوان\s+السكن|تغيير\s+عنوان\s+السكن|تبديل\s+السكن|change\s+of\s+address|changement\s+d\u2019?adresse|changement\s+d'adresse|domicile/i.test(
      blob
    ) || /عنوان\s+السكن.*تبديل|address\s+change/i.test(blob)
  );
}
