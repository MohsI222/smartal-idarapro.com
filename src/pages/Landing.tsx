import type { ComponentType } from "react";
import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Building2,
  Calculator,
  Facebook,
  GraduationCap,
  Scale,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumPlanCard } from "@/components/pricing/PremiumPlanCard";
import { PlatformGuideAssistant } from "@/components/PlatformGuideAssistant";
import { OFFICIAL_EMAIL, OFFICIAL_WHATSAPP_DIGITS } from "@/constants/contact";
import { PLAN_OPTIONS } from "@/constants/plans";
import { HOW_IT_WORKS_VIDEO_IDS, YOUTUBE_CHANNEL_URL } from "@/constants/youtube";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { getApiUrlPrefix } from "@/lib/api";

function LandingFooter() {
  const { t } = useI18n();
  const [socialSettings, setSocialSettings] = useState<Record<string, string> | null>(null);
  const year = new Date().getFullYear();

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.json())
      .then((d: { settings?: Record<string, string> }) => setSocialSettings(d.settings ?? null))
      .catch(() => setSocialSettings(null));
  }, []);

  const whatsappUrl = socialSettings?.social_whatsapp?.trim() || `https://wa.me/${OFFICIAL_WHATSAPP_DIGITS}`;
  const facebookUrl = socialSettings?.social_facebook?.trim() || "https://www.facebook.com/";
  const tiktokUrl = socialSettings?.social_tiktok?.trim() || "https://www.tiktok.com/";
  const instagramUrl = socialSettings?.social_instagram?.trim() || "https://www.instagram.com/";
  const youtubeUrl = socialSettings?.social_youtube?.trim() || "https://www.youtube.com/@SmartAlIdaraPro";
  const linkedinUrl = socialSettings?.social_linkedin?.trim() || "https://www.linkedin.com/";

  return (
    <footer className="border-t border-slate-800 py-10 text-center space-y-6">
      <div className="flex flex-wrap justify-center gap-4 text-slate-400 text-sm">
        <a href={`mailto:${OFFICIAL_EMAIL}`} className="hover:text-orange-400 transition-colors font-medium">
          {OFFICIAL_EMAIL}
        </a>
      </div>
      <div className="flex justify-center gap-4 flex-wrap">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-[#25D366] p-3 text-white hover:opacity-95 transition-opacity"
          aria-label="WhatsApp"
        >
          <WhatsAppIcon />
        </a>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-[#1877F2] p-3 text-white hover:opacity-95 transition-opacity"
          aria-label="Facebook"
        >
          <Facebook className="size-7" />
        </a>
        <a
          href={tiktokUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-black p-3 text-white border border-slate-700 hover:bg-zinc-900 transition-colors"
          aria-label="TikTok"
        >
          <TikTokIcon />
        </a>
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-gradient-to-br from-[#f09433] via-[#dc2743] to-[#bc1888] p-3 text-white hover:opacity-95 transition-opacity"
          aria-label="Instagram"
        >
          <InstagramIcon />
        </a>
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-[#FF0000] p-3 text-white hover:opacity-95 transition-opacity"
          aria-label="YouTube"
        >
          <YouTubeIcon />
        </a>
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-2xl bg-[#0A66C2] p-3 text-white hover:opacity-95 transition-opacity"
          aria-label="LinkedIn"
        >
          <LinkedInIcon />
        </a>
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <Link to="/subscription-contract" className="hover:text-orange-400 transition-colors">
          {t("landing.linkContract")}
        </Link>
        <span className="text-slate-700" aria-hidden>
          ·
        </span>
        <Link to="/security-privacy" className="hover:text-orange-400 transition-colors">
          {t("landing.linkSecurity")}
        </Link>
        <span className="text-slate-700" aria-hidden>
          ·
        </span>
        <Link to="/cgu" className="hover:text-orange-400 transition-colors">
          {t("landing.linkCgu")}
        </Link>
        <span className="text-slate-700" aria-hidden>
          ·
        </span>
        <Link to="/trust" className="hover:text-orange-400 transition-colors">
          {t("landing.linkTrust")}
        </Link>
      </div>
      <p className="text-slate-600 text-sm">{t("landing.footer").replace("{year}", year)}</p>
    </footer>
  );
}

function extractYoutubeId(line: string): string | null {
  const u = line.trim();
  if (!u) return null;
  const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(u)) return u;
  return null;
}

function toYoutubeEmbedUrl(url: string): string | null {
  const id = extractYoutubeId(url);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`;
}

export function Landing() {
  const { t, isRtl } = useI18n();
  const { token, loading } = useAuth();
  const year = String(new Date().getFullYear());
  const [howItWorksSettings, setHowItWorksSettings] = useState<{ mediaUrl?: string; mediaType?: string }>({});
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    void fetch(`${getApiUrlPrefix().replace(/\/$/, "")}/settings/public`)
      .then((r) => r.json() as Promise<{ settings?: Record<string, string> }>)
      .then((j) => {
        if (j.settings) {
          setHowItWorksSettings({
            mediaUrl: j.settings.how_it_works_media_url,
            mediaType: j.settings.how_it_works_media_type,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060d18] flex items-center justify-center text-slate-400">
        {t("common.loading")}
      </div>
    );
  }
  if (token) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-[#060d18] text-white" dir={isRtl ? "rtl" : "ltr"}>
      <header className="border-b border-slate-800/80 backdrop-blur sticky top-0 z-50 bg-[#0c1929]/90">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xl font-black bg-gradient-to-l from-orange-500 to-blue-500 bg-clip-text text-transparent">
            {t("common.appTitle")}
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <LanguageSwitcher />
            <Button variant="outline" size="sm" asChild>
              <Link to="/login">{t("landing.ctaLogin")}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">{t("landing.ctaRegister")}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-10 md:py-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm text-orange-300 mb-6">
          <Sparkles className="size-4" />
          {t("landing.badge")}
        </div>

        <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-orange-500/10 mb-10 max-w-5xl mx-auto">
          <img
            src="/hero-team.png"
            alt={t("landing.heroAlt")}
            className="w-full h-auto object-cover max-h-[420px] object-center"
            loading="eager"
            decoding="async"
          />
        </div>

        <h1 className="text-4xl md:text-6xl font-black leading-tight max-w-4xl mx-auto">
          {t("landing.heroTitle")}
        </h1>
        <p className="mt-6 text-slate-400 max-w-2xl mx-auto text-lg">{t("landing.heroSub")}</p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Button
            size="lg"
            asChild
            className={cn(
              "relative overflow-hidden font-black text-lg px-8 py-7 shadow-lg shadow-orange-500/30",
              "animate-pulse ring-2 ring-orange-400/60 ring-offset-2 ring-offset-[#060d18]",
              "hover:animate-none hover:ring-orange-300/80"
            )}
          >
            <Link to={`/register?next=${encodeURIComponent("/app/pay")}`}>{t("landing.subscribeNow")}</Link>
          </Button>
          <Button
            size="lg"
            asChild
            className="font-black text-lg px-8 py-7 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 hover:opacity-95 border-0 shadow-lg shadow-fuchsia-500/30"
          >
            <Link to={`/register?trial=1&next=${encodeURIComponent("/app")}`}>{t("landing.tryFree")}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">{t("landing.ctaLogin")}</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-slate-600 max-w-xl mx-auto">{t("landing.afterLoginPay")}</p>
      </section>

      <section id="plans" className="max-w-6xl mx-auto px-4 pb-16 scroll-mt-24">
        <div className="text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400/90">
            {t("landing.plansBadge")}
          </span>
          <h2 className="text-3xl md:text-4xl font-black mt-2">{t("landing.plansTitle")}</h2>
          <p className="text-slate-500 mt-2 max-w-2xl mx-auto">{t("landing.plansSubtitle")}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {PLAN_OPTIONS.map((p) => (
            <PremiumPlanCard
              key={p.id}
              mode="landing"
              plan={p}
              registerHref={`/register?next=${encodeURIComponent(`/app/pay?plan=${p.id}`)}`}
              ctaLabel={t("landing.subscribeNow")}
            />
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="text-center mb-10">
          <span className="text-xs font-bold uppercase tracking-widest text-cyan-400/90">
            {t("guide.title")}
          </span>
          <h2 className="text-3xl md:text-4xl font-black mt-2">{t("guide.subtitle")}</h2>
          <p className="text-slate-500 mt-2 max-w-2xl mx-auto">{t("guide.description")}</p>
        </div>
        <div className="max-w-2xl mx-auto">
          <PlatformGuideAssistant isPreSubscription={true} />
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="rounded-3xl border border-purple-500/25 bg-gradient-to-br from-purple-950/40 via-[#0a1628] to-[#050a12] p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
            <div className="text-right max-w-xl">
              <div className="inline-flex p-3 rounded-2xl bg-purple-500/15 border border-purple-500/30 mb-4">
                <GraduationCap className="size-10 text-purple-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white">{t("landing.eduSpotlightTitle")}</h2>
              <p className="text-slate-400 mt-3 leading-relaxed">{t("landing.eduSpotlightDesc")}</p>
            </div>
            <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto">
              <Button size="lg" className="font-bold" asChild>
                <Link to={`/register?next=${encodeURIComponent("/app/edu")}`}>{t("dashboard.enter")}</Link>
              </Button>
              <p className="text-[11px] text-slate-600 text-center md:text-right">{t("landing.afterLoginPay")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-black">{t("landing.howTitle")}</h2>
          <p className="text-slate-500 mt-2 max-w-2xl mx-auto">{t("landing.howSubtitle")}</p>
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm font-bold text-orange-400 hover:text-orange-300"
          >
            {YOUTUBE_CHANNEL_URL}
          </a>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          {howItWorksSettings.mediaUrl && howItWorksSettings.mediaType ? (
            <div className="aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-xl">
              {videoError ? (
                <div className="h-full w-full flex flex-col items-center justify-center bg-black/50 p-4 text-center">
                  <p className="text-sm text-white/90 mb-2">فشل تحميل الوسائط</p>
                  <a
                    href={howItWorksSettings.mediaType === 'youtube' 
                      ? `https://www.youtube.com/watch?v=${extractYoutubeId(howItWorksSettings.mediaUrl)}`
                      : howItWorksSettings.mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-orange-400 hover:text-orange-300"
                  >
                    مشاهدة مباشرة
                  </a>
                </div>
              ) : howItWorksSettings.mediaType === 'youtube' ? (
                <iframe
                  title={t("landing.howTitle")}
                  src={toYoutubeEmbedUrl(howItWorksSettings.mediaUrl) || ''}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  onError={() => setVideoError(true)}
                />
              ) : howItWorksSettings.mediaType === 'video' ? (
                <video
                  src={howItWorksSettings.mediaUrl}
                  controls
                  autoPlay
                  muted
                  loop
                  className="h-full w-full"
                  onError={() => setVideoError(true)}
                />
              ) : (
                <img
                  src={howItWorksSettings.mediaUrl}
                  alt={t("landing.howTitle")}
                  className="h-full w-full object-cover"
                  onError={() => setVideoError(true)}
                />
              )}
            </div>
          ) : HOW_IT_WORKS_VIDEO_IDS.length > 0 ? (
            HOW_IT_WORKS_VIDEO_IDS.map((vid) => (
              <div
                key={vid}
                className="aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-xl"
              >
                <iframe
                  title={t("landing.howTitle")}
                  src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ))
          ) : (
            <div className="rounded-2xl overflow-hidden border border-slate-800 aspect-video bg-black shadow-xl flex items-center justify-center">
              <div className="text-center p-6">
                <p className="text-slate-400 mb-3">لم يتم إضافة فيديوهات بعد</p>
                <a
                  href={YOUTUBE_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-orange-400 hover:text-orange-300"
                >
                  شاهد قناتنا على YouTube
                </a>
              </div>
            </div>
          )}
          <div className="rounded-2xl overflow-hidden border border-slate-800 aspect-video lg:aspect-auto min-h-[200px]">
            <img
              src="/hero-team.png"
              alt=""
              className="w-full h-full object-cover opacity-90"
              loading="lazy"
              decoding="async"
            />
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pb-20 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Feature
          icon={Building2}
          titleKey="feat.hr.title"
          descKey="feat.hr.desc"
        />
        <Feature icon={Scale} titleKey="feat.law.title" descKey="feat.law.desc" />
        <Feature icon={Calculator} titleKey="feat.acc.title" descKey="feat.acc.desc" />
        <Feature icon={Users} titleKey="feat.public.title" descKey="feat.public.desc" />
        <Feature icon={GraduationCap} titleKey="feat.edu.title" descKey="feat.edu.desc" />
        <Feature
          icon={ShieldCheck}
          titleKey="feat.security.title"
          descKey="feat.security.desc"
        />
        <Feature icon={Smartphone} titleKey="feat.ocr.title" descKey="feat.ocr.desc" />
      </section>

      <LandingFooter />
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="size-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg className="size-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="size-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg className="size-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="size-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function Feature({
  icon: Icon,
  titleKey,
  descKey,
}: {
  icon: ComponentType<{ className?: string }>;
  titleKey: string;
  descKey: string;
}) {
  const { t } = useI18n();
  return (
    <Card className="border-slate-800 bg-[#121214]">
      <CardContent className="p-6">
        <Icon className="size-10 text-orange-400 mb-3" />
        <h3 className="font-bold text-lg">{t(titleKey)}</h3>
        <p className="text-slate-500 text-sm mt-2">{t(descKey)}</p>
      </CardContent>
    </Card>
  );
}
