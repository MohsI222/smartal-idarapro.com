/** تبويب رمز الـ QR والطباعة — QR code + printable A4/A5 flyer. */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Printer, Download } from "lucide-react";
import type { Store } from "@/lib/deliveryHub/types";

export function QrTab({ store }: { store: Store }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const storeUrl = `${window.location.origin}/m/${store.slug}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(storeUrl, { width: 480, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => toast.error("تعذر توليد رمز QR"));
    return () => {
      cancelled = true;
    };
  }, [storeUrl]);

  function handleCopyLink() {
    navigator.clipboard
      .writeText(storeUrl)
      .then(() => toast.success("تم نسخ رابط المتجر ✅"))
      .catch(() => toast.error("تعذر نسخ الرابط"));
  }

  function handleDownloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-${store.slug}.png`;
    a.click();
  }

  function handlePrintFlyer() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>رمز QR لمتجرك</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {qrDataUrl && <img src={qrDataUrl} alt="QR" className="h-56 w-56 rounded-xl border border-slate-800 bg-white p-2" />}
          <p className="text-sm text-slate-400 break-all text-center">{storeUrl}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={handleCopyLink}>
              <Copy className="h-4 w-4" /> نسخ رابط المتجر
            </Button>
            <Button variant="outline" onClick={handleDownloadQr}>
              <Download className="h-4 w-4" /> تحميل رمز QR
            </Button>
            <Button onClick={handlePrintFlyer}>
              <Printer className="h-4 w-4" /> تحميل ملصق المحل للطباعة (A4/A5)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* الملصق القابل للطباعة — يظهر فقط عند الطباعة */}
      <div ref={printRef} className="delivery-hub-flyer-only">
        <div
          style={{
            width: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
            padding: "24px",
            fontFamily: "Arial, 'Noto Naskh Arabic', sans-serif",
            direction: "rtl",
            textAlign: "center",
          }}
        >
          {store.logo_url && (
            <img src={store.logo_url} alt={store.name} style={{ height: 90, objectFit: "contain" }} />
          )}
          <h1 style={{ fontSize: "34pt", fontWeight: 900, color: "#0f172a", margin: 0 }}>{store.name}</h1>
          {store.tagline && <p style={{ fontSize: "16pt", color: "#334155", margin: 0 }}>{store.tagline}</p>}
          {qrDataUrl && <img src={qrDataUrl} alt="QR" style={{ width: 320, height: 320 }} />}
          <p style={{ fontSize: "20pt", fontWeight: 800, color: "#ea580c", margin: 0 }}>
            سكانـي واطلب أونلاين 📱
          </p>
          <p style={{ fontSize: "12pt", color: "#64748b" }}>{storeUrl}</p>
        </div>
      </div>
    </div>
  );
}
