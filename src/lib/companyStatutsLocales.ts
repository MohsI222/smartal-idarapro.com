/** نسخ FR / ES / EN للنظام الأساسي SARLAU — وثيقة رسمية بيضاء/سوداء */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const bw = "font-family:'Noto Sans','Segoe UI',sans-serif;line-height:1.75;padding:32px;max-width:800px;margin:0 auto;color:#000;background:#fff";

export function buildFrStatutsHtml(p: {
  denomination: string;
  capital: string;
  siege: string;
  objet: string;
  associes: string;
  dateIso: string;
}): string {
  return `<!DOCTYPE html><html lang="fr" dir="ltr"><head><meta charset="utf-8"/><title>${esc(p.denomination)} — Statuts</title></head>
<body style="${bw}">
<div style="text-align:center;font-weight:700;font-size:18px;margin-bottom:4px">Royaume du Maroc</div>
<div style="text-align:center;font-size:13px;margin-bottom:20px">Statuts constitutifs d’une société à responsabilité limitée à associé unique (SARLAU)</div>
<p style="font-size:12px;text-align:justify;margin-bottom:20px"><strong>Référence légale :</strong> les présents statuts sont établis conformément au <strong>Code des sociétés (loi n° 5.15)</strong> promulgué par le Dahir n° 1-15-16 du 20 août 2015 et ses textes d’application, notamment les dispositions relatives à la SARLAU.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Titre I — Dénomination, forme, durée et siège</h2>
<p><strong>Article 1 — Forme et dénomination :</strong> Il est constitué une société à responsabilité limitée à associé unique, dénommée « ${esc(p.denomination)} ».</p>
<p><strong>Article 2 — Durée :</strong> La durée de la société court à compter de son immatriculation au registre de commerce ; elle expire le ………… sauf prorogation décidée par l’associé unique conformément à la loi.</p>
<p><strong>Article 3 — Siège social :</strong> Le siège social est fixé à : ${esc(p.siege)}. Il peut être transféré en tout autre lieu du Royaume sur décision de l’associé unique, avec les formalités légales, commerciales et fiscales requises.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Titre II — Objet social</h2>
<p><strong>Article 4 — Objet :</strong> L’objet social est : ${esc(p.objet)}. L’associé unique peut décider d’étendre ou de modifier l’objet dans les formes prévues par la loi.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Titre III — Capital et parts</h2>
<p><strong>Article 5 — Capital :</strong> Le capital social est fixé à <strong>${esc(p.capital)} dirhams</strong>, divisé en une ou plusieurs parts détenues par l’associé unique, tel que mentionné au tableau des parts ou ci-dessous, et enregistré auprès des autorités compétentes.</p>
<p><strong>Article 6 — Responsabilité :</strong> L’associé unique est tenu des dettes sociales jusqu’à concurrence de ses parts ; il n’y a pas de solidarité entre l’associé et la société au-delà des limites légales.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Titre IV — Associé unique et décisions</h2>
<p><strong>Article 7 — Associé :</strong> L’associé unique est : ${esc(p.associes)}</p>
<p><strong>Article 8 — Décisions :</strong> L’associé unique prend seul les décisions relatives à la gestion et à l’orientation de la société, conformément à la loi et aux statuts, avec procès-verbaux ou décisions aux formes requises pour dépôt et publication le cas échéant.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Titre V — Gestion</h2>
<p><strong>Article 9 — Gérant :</strong> La société est gérée par un ou plusieurs gérants nommés par l’associé unique. Le gérant représente la société dans ses rapports avec les tiers dans les limites des pouvoirs qui lui sont conférés.</p>
<p><strong>Article 10 — Délégation :</strong> Le gérant peut déléguer certains pouvoirs sous réserve des interdictions légales.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Titres VI et VII — Comptabilité, modification, dissolution, litiges</h2>
<p><strong>Articles 11 à 15 :</strong> Exercice social, comptabilité conforme à la réglementation, déclarations fiscales auprès de l’administration compétente ; modification des statuts selon le Code des sociétés et le registre de commerce ; dissolution et liquidation selon la loi ; litiges soumis aux tribunaux marocains compétents.</p>
<p style="margin-top:28px;font-size:12px">Projet établi le : ${esc(p.dateIso)}</p>
<p style="margin-top:32px"><strong>Signatures</strong></p>
<p style="margin-top:16px">Associé unique : ________________________ Date : __________</p>
<p style="margin-top:12px">Gérant (si distinct) : ________________________ Date : __________</p>
<hr style="margin:28px 0;border:none;border-top:1px solid #000"/>
<p style="font-size:12px;font-weight:700">Annexe — Démarches indicatives (Tribunal de commerce, RC, DGI)</p>
<p style="font-size:11px">Dépôt des statuts, immatriculation, conformité fiscale. Projet indicatif — validation par un professionnel avant signature.</p>
</body></html>`;
}

export function buildEsStatutsHtml(p: {
  denomination: string;
  capital: string;
  siege: string;
  objet: string;
  associes: string;
  dateIso: string;
}): string {
  return `<!DOCTYPE html><html lang="es" dir="ltr"><head><meta charset="utf-8"/><title>${esc(p.denomination)} — Estatutos</title></head>
<body style="${bw}">
<div style="text-align:center;font-weight:700;font-size:18px;margin-bottom:4px">Reino de Marruecos</div>
<div style="text-align:center;font-size:13px;margin-bottom:20px">Estatutos sociales de una sociedad de responsabilidad limitada unipersonal (SARLAU)</div>
<p style="font-size:12px;text-align:justify;margin-bottom:20px"><strong>Marco legal :</strong> los presentes estatutos se redactan conforme al <strong>Código de Sociedades (ley n.º 5.15)</strong> promulgado por el Dahir n.º 1-15-16 de 20 de agosto de 2015 y normas de desarrollo, en particular las relativas a la SARLAU.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Título I — Denominación, forma, duración y domicilio</h2>
<p><strong>Artículo 1 — Forma y denominación :</strong> Se constituye una sociedad de responsabilidad limitada unipersonal, denominada « ${esc(p.denomination)} ».</p>
<p><strong>Artículo 2 — Duración :</strong> La duración comienza con la inscripción en el registro mercantil y termina el ………… salvo prórroga del socio único según la ley.</p>
<p><strong>Artículo 3 — Domicilio social :</strong> El domicilio social se fija en: ${esc(p.siege)}. Podrá trasladarse a otro lugar del Reino con decisión del socio único y cumplimiento de requisitos legales y fiscales.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Título II — Objeto social</h2>
<p><strong>Artículo 4 — Objeto :</strong> El objeto social es: ${esc(p.objet)}. El socio único podrá ampliar o modificar el objeto en la forma legalmente prevista.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Título III — Capital y participaciones</h2>
<p><strong>Artículo 5 — Capital :</strong> El capital social se fija en <strong>${esc(p.capital)} dirhams</strong>, dividido en una o varias participaciones del socio único, según cuadro o mención adjunta, inscrito ante las autoridades competentes.</p>
<p><strong>Artículo 6 — Responsabilidad :</strong> El socio único responde hasta el límite de sus participaciones; no hay solidaridad entre el socio y la sociedad más allá de lo previsto por la ley.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Título IV — Socio único y decisiones</h2>
<p><strong>Artículo 7 — Socio :</strong> El socio único es: ${esc(p.associes)}</p>
<p><strong>Artículo 8 — Decisiones :</strong> El socio único adopta las decisiones de gestión y orientación, con actas o acuerdos según formalidades de depósito y publicación cuando proceda.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Título V — Administración</h2>
<p><strong>Artículo 9 — Gerente :</strong> La sociedad es administrada por uno o varios gerentes designados por el socio único. El gerente representa a la sociedad frente a terceros en el ámbito de sus poderes.</p>
<p><strong>Artículo 10 — Delegación :</strong> El gerente podrá delegar facultades sin perjuicio de las prohibiciones legales.</p>
<p><strong>Artículos 11 a 15 :</strong> Ejercicio fiscal, contabilidad, modificaciones estatutarias, disolución y liquidación, litigios ante tribunales marroquíes competentes, conforme a la ley.</p>
<p style="margin-top:28px;font-size:12px">Borrador fechado: ${esc(p.dateIso)}</p>
<p style="margin-top:32px"><strong>Firmas</strong></p>
<p style="margin-top:16px">Socio único: ________________________ Fecha: __________</p>
<p style="margin-top:12px">Gerente (si distinto): ________________________ Fecha: __________</p>
<hr style="margin:28px 0;border:none;border-top:1px solid #000"/>
<p style="font-size:11px">Anexo indicativo — Tribunal de comercio, registro mercantil, administración fiscal (DGI). Borrador orientativo — revisión profesional antes de firma.</p>
</body></html>`;
}

export function buildEnStatutsHtml(p: {
  denomination: string;
  capital: string;
  siege: string;
  objet: string;
  associes: string;
  dateIso: string;
}): string {
  return `<!DOCTYPE html><html lang="en" dir="ltr"><head><meta charset="utf-8"/><title>${esc(p.denomination)} — Articles</title></head>
<body style="${bw}">
<div style="text-align:center;font-weight:700;font-size:18px;margin-bottom:4px">Kingdom of Morocco</div>
<div style="text-align:center;font-size:13px;margin-bottom:20px">Articles of association — single-member limited liability company (SARLAU)</div>
<p style="font-size:12px;text-align:justify;margin-bottom:20px"><strong>Legal basis:</strong> these articles are drawn up under the <strong>Companies Code (Act 5.15)</strong> enacted by Dahir 1-15-16 of 20 August 2015 and implementing regulations, including provisions on single-member SARLAU.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Part I — Name, form, duration and registered office</h2>
<p><strong>Article 1 — Form and name:</strong> A single-member limited liability company is formed under the name « ${esc(p.denomination)} ».</p>
<p><strong>Article 2 — Duration:</strong> The company’s term runs from its registration in the commercial register and ends on ………… unless extended by the sole member as provided by law.</p>
<p><strong>Article 3 — Registered office:</strong> The registered office is located at: ${esc(p.siege)}. It may be transferred elsewhere in the Kingdom subject to legal, commercial and tax formalities.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Part II — Corporate purpose</h2>
<p><strong>Article 4 — Purpose:</strong> The corporate purpose is: ${esc(p.objet)}. The sole member may extend or amend the purpose in accordance with the law.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Part III — Share capital and shares</h2>
<p><strong>Article 5 — Capital:</strong> Share capital is set at <strong>${esc(p.capital)} Moroccan dirhams (MAD)</strong>, divided into one or more shares held by the sole member, as stated in the attached schedule, and registered with the competent authorities.</p>
<p><strong>Article 6 — Liability:</strong> The sole member is liable only up to the amount of shares; there is no unlimited liability between the member and the company beyond what the law provides.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Part IV — Sole member and decisions</h2>
<p><strong>Article 7 — Member:</strong> The sole member is: ${esc(p.associes)}</p>
<p><strong>Article 8 — Decisions:</strong> The sole member adopts all management and strategic decisions, with minutes or resolutions in the forms required for filing and publication where applicable.</p>
<h2 style="font-size:15px;font-weight:700;border-bottom:1px solid #000;padding-bottom:6px;margin-top:24px">Part V — Management</h2>
<p><strong>Article 9 — Manager:</strong> The company is managed by one or more managers appointed by the sole member. The manager represents the company towards third parties within granted powers.</p>
<p><strong>Article 10 — Delegation:</strong> The manager may delegate powers subject to legal restrictions.</p>
<p><strong>Articles 11–15:</strong> Financial year, accounting and tax filings with the competent administration, amendment of articles, dissolution and liquidation, disputes before competent Moroccan courts.</p>
<p style="margin-top:28px;font-size:12px">Draft dated: ${esc(p.dateIso)}</p>
<p style="margin-top:32px"><strong>Signatures</strong></p>
<p style="margin-top:16px">Sole member: ________________________ Date: __________</p>
<p style="margin-top:12px">Manager (if different): ________________________ Date: __________</p>
<hr style="margin:28px 0;border:none;border-top:1px solid #000"/>
<p style="font-size:11px">Indicative annex — commercial court, trade register, tax authority (DGI). Draft for professional review before signature.</p>
</body></html>`;
}
