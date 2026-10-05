/** Public Contract Signing Page - صفحة التوقيع العامة للعقود */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileText, AlertCircle, Download } from "lucide-react";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { fetchPublicContract, submitSignature } from "@/lib/contracts/api";
import html2pdf from 'html2pdf.js';

export function SignContractPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  
  const [formData, setFormData] = useState({
    signer_name: "",
    signer_email: "",
    signer_phone: "",
  });
  const [signatureData, setSignatureData] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadContract(id);
    }
  }, [id]);

  async function loadContract(contractId: string) {
    try {
      setLoading(true);
      const data = await fetchPublicContract(contractId);
      setContract(data);
      
      if (data.status === "signed") {
        setSigned(true);
        toast.info("هذا العقد موقع بالفعل");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل تحميل العقد");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    console.log("[SignContract] handleSubmit called");
    console.log("[SignContract] formData:", formData);
    console.log("[SignContract] signatureData length:", signatureData?.length);

    if (!formData.signer_name || !formData.signer_email) {
      toast.error("الاسم والبريد الإلكتروني مطلوبان");
      return;
    }

    if (!signatureData) {
      toast.error("يرجى التوقيع أولاً");
      return;
    }

    try {
      console.log("[SignContract] Submitting signature to API...");
      await submitSignature(id!, {
        ...formData,
        signature_data: signatureData,
      });
      console.log("[SignContract] Signature submitted successfully");
      toast.success("تم التوقيع بنجاح ✅");
      setSigned(true);
      
      // Reload the contract to show updated status
      setTimeout(() => {
        loadContract(id!);
      }, 1000);
    } catch (err) {
      console.error("[SignContract] Error submitting signature:", err);
      toast.error(err instanceof Error ? err.message : "فشل حفظ التوقيع");
    }
  }

  function handleExportPDF() {
    const element = document.getElementById('contract-content');
    if (!element) {
      toast.error("فشل العثور على محتوى العقد");
      return;
    }

    try {
      // Helper function to convert oklch to hex (simplified)
      const convertOklchToHex = (color: string): string => {
        if (!color || typeof color !== 'string') return '#000000';
        
        // Return standard hex colors as-is
        if (color.startsWith('#') || color.startsWith('rgb')) return color;
        
        // Convert oklch to simple hex (fallback)
        if (color.includes('oklch')) {
          // Extract lightness from oklch and convert to grayscale
          const match = color.match(/oklch\(([\d.]+)/);
          if (match) {
            const l = parseFloat(match[1]);
            const gray = Math.round(l * 255);
            return `rgb(${gray}, ${gray}, ${gray})`;
          }
        }
        
        // Fallback for any other color format
        return '#000000';
      };

      // Helper function to convert all colors in an element
      const convertElementColors = (el: HTMLElement) => {
        const computedStyle = window.getComputedStyle(el);
        
        // Convert color properties
        const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 
                           'borderBottomColor', 'borderLeftColor', 'borderRightColor'];
        
        colorProps.forEach(prop => {
          const value = computedStyle.getPropertyValue(prop);
          if (value && value.includes('oklch')) {
            (el.style as any)[prop] = convertOklchToHex(value);
          }
        });
        
        // Process all children
        Array.from(el.children).forEach(child => {
          if (child instanceof HTMLElement) {
            convertElementColors(child);
          }
        });
      };

      // Create a professional PDF container with all content
      const container = document.createElement('div');
      container.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 40px;
        font-family: 'Arial', 'Helvetica', sans-serif;
        direction: rtl;
        max-width: 210mm;
        margin: 0 auto;
      `;

      // Header with logo and title
      const header = document.createElement('div');
      header.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        margin-bottom: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        text-align: center;
      `;

      if (contract.logo_url) {
        const logo = document.createElement('img');
        logo.src = contract.logo_url;
        logo.style.cssText = 'max-width: 150px; max-height: 80px; margin-bottom: 15px;';
        header.appendChild(logo);
      }

      const title = document.createElement('h1');
      title.textContent = contract.title;
      title.style.cssText = `
        color: #667eea;
        font-size: 28px;
        font-weight: bold;
        margin: 0;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
      `;
      header.appendChild(title);

      if (contract.description) {
        const desc = document.createElement('p');
        desc.textContent = contract.description;
        desc.style.cssText = 'color: #666; margin-top: 10px; font-size: 14px;';
        header.appendChild(desc);
      }

      // Contract status badge
      const statusBadge = document.createElement('div');
      statusBadge.textContent = contract.status === 'signed' ? 'موقع ✅' : contract.status === 'pending_signature' ? 'بانتظار التوقيع ✍️' : 'مسودة 📝';
      statusBadge.style.cssText = `
        display: inline-block;
        margin-top: 15px;
        padding: 8px 20px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: bold;
        color: white;
        background: ${contract.status === 'signed' ? '#10b981' : contract.status === 'pending_signature' ? '#f59e0b' : '#6b7280'};
      `;
      header.appendChild(statusBadge);

      container.appendChild(header);

      // Contract content with professional styling
      const contentWrapper = document.createElement('div');
      contentWrapper.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        margin-bottom: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        line-height: 1.8;
        color: #333;
      `;

      // Clone and style the contract content
      const contentClone = element.cloneNode(true) as HTMLElement;
      contentClone.style.cssText = `
        direction: rtl;
        text-align: right;
        color: #333;
        line-height: 1.8;
      `;
      
      // Convert all oklch colors to compatible formats
      convertElementColors(contentClone);

      // Style all headings in the content
      const headings = contentClone.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(h => {
        (h as HTMLElement).style.cssText = `
          color: #667eea;
          margin-top: 20px;
          margin-bottom: 10px;
          font-weight: bold;
        `;
      });

      // Style paragraphs
      const paragraphs = contentClone.querySelectorAll('p');
      paragraphs.forEach(p => {
        (p as HTMLElement).style.cssText = `
          margin-bottom: 15px;
          text-align: justify;
        `;
      });

      contentWrapper.appendChild(contentClone);
      container.appendChild(contentWrapper);

      // Contract metadata
      const metadata = document.createElement('div');
      metadata.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
      `;

      const addMetadataItem = (label: string, value: string) => {
        const item = document.createElement('div');
        item.innerHTML = `
          <div style="color: #667eea; font-weight: bold; font-size: 12px; margin-bottom: 5px;">${label}</div>
          <div style="color: #333; font-size: 14px;">${value}</div>
        `;
        return item;
      };

      if (contract.start_date) {
        metadata.appendChild(addMetadataItem('تاريخ البدء', new Date(contract.start_date).toLocaleDateString('ar-MA')));
      }
      if (contract.end_date) {
        metadata.appendChild(addMetadataItem('تاريخ الانتهاء', new Date(contract.end_date).toLocaleDateString('ar-MA')));
      }
      if (contract.expires_at) {
        metadata.appendChild(addMetadataItem('تاريخ انتهاء الصلاحية', new Date(contract.expires_at).toLocaleDateString('ar-MA')));
      }

      container.appendChild(metadata);

      // Signature section if signed
      if (signed && signatureData) {
        const signatureSection = document.createElement('div');
        signatureSection.style.cssText = `
          background: white;
          padding: 30px;
          border-radius: 10px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;

        const sigTitle = document.createElement('h2');
        sigTitle.textContent = 'التوقيع';
        sigTitle.style.cssText = `
          color: #667eea;
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 20px;
          text-align: center;
        `;
        signatureSection.appendChild(sigTitle);

        const sigInfo = document.createElement('div');
        sigInfo.style.cssText = `
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 15px;
          border: 2px solid #667eea;
        `;

        sigInfo.innerHTML = `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
            <div>
              <div style="color: #667eea; font-weight: bold; font-size: 12px;">اسم الموقع</div>
              <div style="color: #333; font-size: 14px; font-weight: 500;">${formData.signer_name}</div>
            </div>
            <div>
              <div style="color: #667eea; font-weight: bold; font-size: 12px;">البريد الإلكتروني</div>
              <div style="color: #333; font-size: 14px; font-weight: 500;">${formData.signer_email}</div>
            </div>
            ${formData.signer_phone ? `
            <div>
              <div style="color: #667eea; font-weight: bold; font-size: 12px;">رقم الهاتف</div>
              <div style="color: #333; font-size: 14px; font-weight: 500;">${formData.signer_phone}</div>
            </div>
            ` : ''}
            <div>
              <div style="color: #667eea; font-weight: bold; font-size: 12px;">تاريخ التوقيع</div>
              <div style="color: #333; font-size: 14px; font-weight: 500;">${new Date().toLocaleString('ar-MA')}</div>
            </div>
          </div>
        `;

        signatureSection.appendChild(sigInfo);

        const sigImg = document.createElement('img');
        sigImg.src = signatureData;
        sigImg.style.cssText = `
          width: 100%;
          max-width: 300px;
          height: auto;
          border: 2px solid #667eea;
          border-radius: 8px;
          background: white;
          padding: 10px;
          display: block;
          margin: 0 auto;
        `;
        signatureSection.appendChild(sigImg);

        container.appendChild(signatureSection);
      }

      // Footer
      const footer = document.createElement('div');
      footer.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        color: #666;
        font-size: 12px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      `;
      footer.innerHTML = `
        <div style="color: #667eea; font-weight: bold; margin-bottom: 5px;">إدارة العقود الذكية</div>
        <div>تم إنشاء هذا العقد إلكترونياً بتاريخ ${new Date().toLocaleDateString('ar-MA')}</div>
        <div style="margin-top: 5px;">Ref: ${contract.id} | ${new Date().toLocaleDateString('ar-MA')}</div>
      `;
      container.appendChild(footer);

      // PDF options
      const opt = {
        margin: 0,
        filename: `${contract.title}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          letterRendering: true,
          allowTaint: true,
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      toast.info("جاري تصدير PDF...");

      // Use setTimeout to prevent UI blocking
      setTimeout(() => {
        html2pdf().set(opt).from(container).save()
          .then(() => {
            toast.success("تم تصدير PDF بنجاح");
          })
          .catch((error) => {
            console.error("PDF export error:", error);
            toast.error("فشل تصدير PDF: " + (error.message || "خطأ غير معروف"));
          });
      }, 100);
    } catch (error) {
      console.error("PDF export setup error:", error);
      toast.error("فشل إعداد تصدير PDF");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">جاري التحميل...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle className="h-8 w-8" />
              <CardTitle>خطأ</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400">{error}</p>
            <Button onClick={() => navigate("/")} className="mt-4 w-full">
              العودة للرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            {contract.logo_url && (
              <div style={{ textAlign: 'center', marginBottom: '16px', display: 'block', visibility: 'visible' }}>
                <img
                  src={contract.logo_url}
                  alt="شعار"
                  style={{ maxWidth: '200px', maxHeight: '100px', display: 'block', visibility: 'visible', margin: '0 auto' }}
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-500" />
              <div>
                <CardTitle>{contract.title}</CardTitle>
                {contract.description && (
                  <CardDescription>{contract.description}</CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div
              id="contract-content"
              className="prose prose-invert max-w-none whitespace-pre-wrap"
              style={{ direction: 'rtl', textAlign: 'right', color: '#e2e8f0', lineHeight: '1.8' }}
              dangerouslySetInnerHTML={{ __html: contract.content }}
            />
          </CardContent>
          <div className="contracts-print-hide">
            <Button
              variant="outline"
              onClick={handleExportPDF}
              className="w-full"
            >
              <Download className="h-4 w-4 ml-2" />
              تصدير PDF
            </Button>
          </div>
        </Card>

        {signed ? (
          <Card className="border-green-500">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <h2 className="text-2xl font-bold text-green-500">تم التوقيع بنجاح</h2>
                <p className="text-slate-400">شكراً لك، تم حفظ توقيعك على هذا العقد</p>
                <Button onClick={() => navigate("/")} className="mt-4">
                  العودة للرئيسية
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>معلومات الموقع</CardTitle>
              <CardDescription>يرجى ملء المعلومات والتوقيع أدناه</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>الاسم الكامل *</Label>
                <Input
                  value={formData.signer_name}
                  onChange={(e) => setFormData({ ...formData, signer_name: e.target.value })}
                  placeholder="أدخل اسمك الكامل"
                />
              </div>
              <div>
                <Label>البريد الإلكتروني *</Label>
                <Input
                  type="email"
                  value={formData.signer_email}
                  onChange={(e) => setFormData({ ...formData, signer_email: e.target.value })}
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input
                  type="tel"
                  value={formData.signer_phone}
                  onChange={(e) => setFormData({ ...formData, signer_phone: e.target.value })}
                  placeholder="06XXXXXXXX"
                />
              </div>
              <div style={{ display: 'block', visibility: 'visible' }}>
                <Label style={{ display: 'block', visibility: 'visible', color: '#000' }}>التوقيع الإلكتروني *</Label>
                <div style={{ display: 'block', visibility: 'visible', marginTop: '8px' }}>
                  <SignatureCanvas
                    onSave={(data) => setSignatureData(data)}
                    width={600}
                    height={200}
                  />
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full" size="lg">
                تأكيد التوقيع
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
