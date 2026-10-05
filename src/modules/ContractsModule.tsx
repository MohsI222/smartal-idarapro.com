/** Contracts Module - وحدة العقود والتوقيع الإلكتروني */
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Share2, Trash2, Eye, Copy, CheckCircle, ArrowLeft, Download } from "lucide-react";
import { fetchContracts, createContract, updateContract, deleteContract, fetchTemplates, createTemplate, fetchContract } from "@/lib/contracts/api";
import { CONTRACT_STATUS_LABELS, CONTRACT_TYPE_LABELS, type Contract, type ContractType } from "@/lib/contracts/types";
import html2pdf from 'html2pdf.js';
import { useI18n } from "@/i18n/I18nProvider";

export function ContractsModule() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useI18n();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [signatures, setSignatures] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    contract_type: "custom" as ContractType,
    content: "",
    start_date: "",
    end_date: "",
    expires_at: "",
    logo_url: "",
    is_public: false,
  });

  useEffect(() => {
    if (id) {
      loadContractDetails(id);
    } else {
      loadData();
    }
  }, [id, loadData, loadContractDetails]); // Only reload when id changes

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("idara_token");
      if (!token) {
        toast.error("يجب تسجيل الدخول أولاً");
        navigate("/login");
        return;
      }

      const [contractsData, templatesData] = await Promise.all([
        fetchContracts(),
        fetchTemplates(),
      ]);
      setContracts(contractsData);
      setTemplates(templatesData);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        toast.error("انتهتت جلسة العمل، يرجى تسجيل الدخول مرة أخرى");
        localStorage.removeItem("idara_token");
        navigate("/login");
      } else {
        toast.error(error instanceof Error ? error.message : "فشل تحميل البيانات");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const loadContractDetails = useCallback(async (contractId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem("idara_token");
      if (!token) {
        toast.error("يجب تسجيل الدخول أولاً");
        navigate("/login");
        return;
      }

      const data = await fetchContract(contractId);
      console.log("[ContractsModule] Contract data loaded:", data);
      console.log("[ContractsModule] Contract content:", data.contract?.content);
      console.log("[ContractsModule] Signatures count:", data.signatures?.length);
      console.log("[ContractsModule] First signature data length:", data.signatures?.[0]?.signature_data?.length);
      setSelectedContract(data.contract);
      setSignatures(data.signatures || []);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unauthorized")) {
        toast.error("انتهتت جلسة العمل، يرجى تسجيل الدخول مرة أخرى");
        localStorage.removeItem("idara_token");
        navigate("/login");
      } else {
        toast.error(error instanceof Error ? error.message : "فشل تحميل العقد");
        navigate("/app/contracts");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleCreateContract = useCallback(async () => {
    if (!formData.title || !formData.content) {
      toast.error(t("common.requiredFields"));
      return;
    }

    try {
      // Add logo to content if provided
      let content = formData.content;
      if (formData.logo_url) {
        const logoHtml = `<div style="text-align: center; margin-bottom: 20px;">
          <img src="${formData.logo_url}" alt="شعار" style="max-width: 200px; max-height: 100px; margin: 0 auto; display: block;" />
        </div>`;
        content = logoHtml + content;
      }

      const contractId = await createContract({
        ...formData,
        content,
      });
      toast.success("تم إنشاء العقد بنجاح");
      setCreateDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        contract_type: "custom",
        content: "",
        parties: "",
        start_date: "",
        end_date: "",
        expires_at: "",
        logo_url: "",
        is_public: false,
      });
      loadData();
      navigate(`/contracts/${contractId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "فشل إنشاء العقد");
    }
  }, [formData, loadData, navigate]);

  const handleDeleteContract = useCallback(async (id: string) => {
    if (!confirm(t("contracts.deleteConfirm"))) return;

    try {
      await deleteContract(id);
      toast.success(t("contracts.deleteSuccess"));
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("contracts.deleteError"));
    }
  }, [loadData]);

  const handleShareContract = useCallback((contract: Contract) => {
    const token = localStorage.getItem("idara_token");
    if (!token) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    const url = `${window.location.origin}/sign-contract/${contract.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t("contracts.shareSuccess"));
  }, []);

  const handleSendForSigning = useCallback((contract: Contract) => {
    const token = localStorage.getItem("idara_token");
    if (!token) {
      toast.error("يجب تسجيل الدخول أولاً");
      return;
    }

    updateContract(contract.id, { status: "pending_signature" })
      .then(() => {
        toast.success(t("contracts.sendSuccess"));
        loadData();
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : t("contracts.sendError"));
      });
  }, [loadData]);

  const handleExportPDF = useCallback((contract: Contract) => {
    const element = document.getElementById('contract-content');
    if (!element) {
      toast.error(t("contracts.contentNotFound"));
      return;
    }

    try {
      // Clone the element and process it for better formatting
      const clone = element.cloneNode(true) as HTMLElement;
      
      // Add proper styling to preserve line breaks
      clone.style.cssText = `
        line-height: 2.5;
        color: #333;
        text-align: right;
        white-space: pre-wrap;
        word-wrap: break-word;
        max-width: 100%;
        overflow-wrap: break-word;
      `;
      
      // Process all elements to ensure proper spacing
      const allElements = clone.querySelectorAll('*');
      allElements.forEach(el => {
        const htmlEl = el as HTMLElement;
        // Ensure block elements have proper spacing
        if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(el.tagName)) {
          htmlEl.style.marginBottom = '20px';
          htmlEl.style.display = 'block';
          htmlEl.style.wordBreak = 'break-word';
        }
        // Ensure images are properly sized
        if (el.tagName === 'IMG') {
          htmlEl.style.maxWidth = '200px';
          htmlEl.style.maxHeight = '100px';
          htmlEl.style.display = 'block';
          htmlEl.style.margin = '0 auto';
        }
        // Add spacing to br elements
        if (el.tagName === 'BR') {
          htmlEl.style.display = 'block';
          htmlEl.style.marginBottom = '10px';
        }
      });
      
      const content = clone.innerHTML;
      
      const printContent = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>${contract.title}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              direction: rtl;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .container {
              max-width: 210mm;
              margin: 0 auto;
            }
            .header { 
              background: white; 
              text-align: center; 
              padding: 15px; 
              border-radius: 8px; 
              margin-bottom: 10px; 
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .title { color: #667eea; font-size: 18px; font-weight: bold; margin: 0; }
            .description { color: #666; margin-top: 5px; font-size: 10px; }
            .status { display: inline-block; margin-top: 8px; padding: 4px 12px; border-radius: 15px; font-size: 10px; font-weight: bold; color: white; background: ${contract.status === 'signed' ? '#10b981' : contract.status === 'pending_signature' ? '#f59e0b' : '#6b7280'}; }
            .content { 
              background: white;
              line-height: 1.5; 
              color: #333; 
              text-align: right; 
              margin-bottom: 10px; 
              padding: 12px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              white-space: pre-wrap; 
              word-wrap: break-word;
              font-size: 10px;
            }
            .content p { margin-bottom: 6px; display: block; }
            .content div { margin-bottom: 6px; display: block; }
            .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 { margin-bottom: 5px; display: block; color: #667eea; font-weight: bold; font-size: 11px; }
            .content li { margin-bottom: 4px; display: list-item; }
            .content img { max-width: 100px; max-height: 50px; display: block; margin: 0 auto; }
            .content br { display: block; margin: 3px 0; }
            .metadata { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 8px; 
              padding: 10px; 
              background: white; 
              margin: 10px 0; 
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .metadata-item { margin-bottom: 5px; }
            .metadata-label { color: #667eea; font-weight: bold; font-size: 9px; margin-bottom: 2px; }
            .metadata-value { color: #333; font-size: 9px; }
            .signatures { 
              background: white;
              padding: 12px; 
              margin-top: 10px; 
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .signature-item { 
              background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); 
              padding: 8px; 
              margin-bottom: 8px; 
              border-radius: 6px; 
              border: 1px solid #667eea;
            }
            .signature-info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px; }
            .signature-img { max-width: 150px; height: auto; border: 1px solid #667eea; border-radius: 6px; background: white; padding: 4px; display: block; margin: 0 auto; }
            .footer { 
              background: white;
              text-align: center; 
              padding: 10px; 
              margin-top: 10px; 
              color: #666; 
              font-size: 8px; 
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .footer-bold { font-weight: bold; color: #667eea; margin-bottom: 3px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              ${contract.logo_url ? `<img src="${contract.logo_url}" style="max-width: 100px; max-height: 50px; margin-bottom: 8px;">` : ''}
              <h1 class="title">${contract.title}</h1>
              ${contract.description ? `<p class="description">${contract.description}</p>` : ''}
              <div class="status">${CONTRACT_STATUS_LABELS[contract.status]}</div>
            </div>
            <div class="content">${content}</div>
            <div class="metadata">
              <div class="metadata-item">
                <div class="metadata-label">${t("contracts.details.type")}</div>
                <div class="metadata-value">${CONTRACT_TYPE_LABELS[contract.contract_type]}</div>
              </div>
              ${contract.start_date ? `<div class="metadata-item"><div class="metadata-label">${t("contracts.details.starts")}</div><div class="metadata-value">${new Date(contract.start_date).toLocaleDateString('ar-MA')}</div></div>` : ''}
              ${contract.end_date ? `<div class="metadata-item"><div class="metadata-label">${t("contracts.details.ends")}</div><div class="metadata-value">${new Date(contract.end_date).toLocaleDateString('ar-MA')}</div></div>` : ''}
              ${contract.expires_at ? `<div class="metadata-item"><div class="metadata-label">${t("contracts.details.expires")}</div><div class="metadata-value">${new Date(contract.expires_at).toLocaleDateString('ar-MA')}</div></div>` : ''}
            </div>
            ${signatures.length > 0 ? `
            <div class="signatures">
              <h2 style="color: #667eea; font-size: 12px; font-weight: bold; margin-bottom: 8px; text-align: center;">${t("contracts.signatures.title")}</h2>
              ${signatures.map(sig => `
                <div class="signature-item">
                  <div class="signature-info">
                    <div><div class="metadata-label">${t("contracts.signatures.signerName")}</div><div class="metadata-value">${sig.signer_name}</div></div>
                    <div><div class="metadata-label">${t("contracts.signatures.signerEmail")}</div><div class="metadata-value">${sig.signer_email}</div></div>
                    ${sig.signer_phone ? `<div><div class="metadata-label">${t("contracts.signatures.signerPhone")}</div><div class="metadata-value">${sig.signer_phone}</div></div>` : ''}
                    <div><div class="metadata-label">${t("contracts.signatures.signedAt")}</div><div class="metadata-value">${new Date(sig.signed_at).toLocaleString('ar-MA')}</div></div>
                  </div>
                  ${sig.signature_data ? `<img src="${sig.signature_data}" class="signature-img">` : ''}
                </div>
              `).join('')}
            </div>
            ` : ''}
            <div class="footer">
              <div class="footer-bold">${t("contracts.smartContracts")}</div>
              <div>${t("contracts.createdElectronically")} ${new Date().toLocaleDateString('ar-MA')}</div>
              <div style="margin-top: 3px;">Ref: ${contract.id}</div>
            </div>
          </div>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error("فشل فتح نافذة الطباعة - يرجى السماح بالنوافذ المنبثقة");
        return;
      }

      printWindow.document.write(printContent);
      printWindow.document.close();

      setTimeout(() => {
        printWindow.print();
      }, 500);

      toast.success(t("contracts.printSuccess"));
    } catch (error) {
      console.error("Print error:", error);
      toast.error(t("contracts.printError"));
    }
  }, [signatures, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">جاري التحميل...</div>
      </div>
    );
  }

  // Show contract details view if id is present
  if (id && selectedContract) {
    console.log("[ContractsModule] Rendering contract details, selectedContract:", selectedContract);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 contracts-print-hide">
          <Button variant="outline" onClick={() => navigate("/app/contracts")}>
            <ArrowLeft className="h-4 w-4 ml-2" />
            {t("contracts.back")}
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedContract.title}</h1>
            <p className="text-slate-400">{selectedContract.description}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {t("contracts.details.title")}
                </CardTitle>
              </div>
              <Badge variant={selectedContract.status === "signed" ? "default" : "secondary"}>
                {CONTRACT_STATUS_LABELS[selectedContract.status]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedContract.logo_url && (
              <div style={{ textAlign: 'center', marginBottom: '16px', display: 'block', visibility: 'visible' }}>
                <img
                  src={selectedContract.logo_url}
                  alt="شعار"
                  style={{ maxWidth: '200px', maxHeight: '100px', display: 'block', visibility: 'visible', margin: '0 auto' }}
                />
              </div>
            )}
            <div>
              <Label>{t("contracts.details.type")}</Label>
              <p className="text-slate-600">{CONTRACT_TYPE_LABELS[selectedContract.contract_type]}</p>
            </div>
            <div>
              <Label>{t("contracts.details.content")}</Label>
              <div
                id="contract-content"
                className="mt-2 p-4 bg-slate-50 rounded-lg whitespace-pre-wrap"
                style={{ display: 'block', visibility: 'visible', color: '#000' }}
              >
                {selectedContract.logo_url && (
                  <div style={{ textAlign: 'center', marginBottom: '16px', display: 'block', visibility: 'visible' }}>
                    <img
                      src={selectedContract.logo_url}
                      alt="شعار"
                      style={{ maxWidth: '200px', maxHeight: '100px', display: 'block', visibility: 'visible', margin: '0 auto' }}
                    />
                  </div>
                )}
                <div dangerouslySetInnerHTML={{ __html: selectedContract.content }} />
              </div>
            </div>
            {selectedContract.parties && (
              <div>
                <Label>{t("contracts.details.parties")}</Label>
                <p className="text-slate-600">{selectedContract.parties}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {selectedContract.start_date && (
                <div>
                  <Label>{t("contracts.details.starts")}</Label>
                  <p className="text-slate-600">{new Date(selectedContract.start_date).toLocaleDateString('ar-MA')}</p>
                </div>
              )}
              {selectedContract.end_date && (
                <div>
                  <Label>{t("contracts.details.ends")}</Label>
                  <p className="text-slate-600">{new Date(selectedContract.end_date).toLocaleDateString('ar-MA')}</p>
                </div>
              )}
            </div>
            {selectedContract.expires_at && (
              <div>
                <Label>{t("contracts.details.expires")}</Label>
                <p className="text-slate-600">{new Date(selectedContract.expires_at).toLocaleDateString('ar-MA')}</p>
              </div>
            )}
            <div className="flex gap-2 pt-4 contracts-print-hide">
              <Button
                variant="outline"
                onClick={() => handleShareContract(selectedContract)}
              >
                <Share2 className="h-4 w-4 ml-2" />
                {t("contracts.share")}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportPDF(selectedContract)}
              >
                <Download className="h-4 w-4 ml-2" />
                {t("contracts.exportPdf")}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  try {
                    // Create a print-friendly version
                    const printWindow = window.open('', '_blank');
                    if (!printWindow) {
                      toast.error(t("contracts.printOpenError"));
                      return;
                    }

                    // Helper function to convert oklch to hex
                    const convertOklchToHex = (color: string): string => {
                      if (!color || typeof color !== 'string') return '#000000';
                      if (color.startsWith('#') || color.startsWith('rgb')) return color;
                      if (color.includes('oklch')) {
                        const match = color.match(/oklch\(([\d.]+)/);
                        if (match) {
                          const l = parseFloat(match[1]);
                          const gray = Math.round(l * 255);
                          return `rgb(${gray}, ${gray}, ${gray})`;
                        }
                      }
                      return '#000000';
                    };

                    // Get translations for print content
                    const translations = {
                      contractType: t("contracts.details.type"),
                      startDate: t("contracts.details.starts"),
                      endDate: t("contracts.details.ends"),
                      expiresAt: t("contracts.details.expires"),
                      signatures: t("contracts.signatures.title"),
                      signerName: t("contracts.signatures.signerName"),
                      signerEmail: t("contracts.signatures.signerEmail"),
                      signerPhone: t("contracts.signatures.signerPhone"),
                      signedAt: t("contracts.signatures.signedAt"),
                      signature: t("contracts.signatures.signature"),
                      smartContracts: "إدارة العقود الذكية",
                      createdElectronically: "تم إنشاء هذا العقد إلكترونياً بتاريخ",
                      ref: "Ref:"
                    };

                    // Create print content
                    const printContent = `
                      <!DOCTYPE html>
                      <html dir="rtl">
                      <head>
                        <title>${contract.title}</title>
                        <style>
                          body {
                            font-family: 'Arial', 'Helvetica', sans-serif;
                            margin: 0;
                            padding: 20px;
                            direction: rtl;
                          }
                          .header {
                            text-align: center;
                            padding: 20px;
                            border-bottom: 2px solid #667eea;
                            margin-bottom: 20px;
                          }
                          .logo {
                            max-width: 150px;
                            max-height: 80px;
                            margin-bottom: 15px;
                          }
                          .title {
                            color: #667eea;
                            font-size: 28px;
                            font-weight: bold;
                            margin: 0;
                          }
                          .description {
                            color: #666;
                            margin-top: 10px;
                            font-size: 14px;
                          }
                          .content {
                            padding: 20px;
                            line-height: 1.8;
                            color: #333;
                            text-align: right;
                          }
                          .content h1, .content h2, .content h3 {
                            color: #667eea;
                            margin-top: 20px;
                            margin-bottom: 10px;
                            font-weight: bold;
                          }
                          .content p {
                            margin-bottom: 15px;
                            text-align: justify;
                          }
                          .metadata {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 15px;
                            padding: 20px;
                            background: #f5f5f5;
                            margin: 20px 0;
                            border-radius: 8px;
                          }
                          .metadata-item {
                            margin-bottom: 10px;
                          }
                          .metadata-label {
                            color: #667eea;
                            font-weight: bold;
                            font-size: 12px;
                            margin-bottom: 5px;
                          }
                          .metadata-value {
                            color: #333;
                            font-size: 14px;
                          }
                          .signatures {
                            padding: 20px;
                            margin-top: 20px;
                          }
                          .signature-item {
                            background: #f5f5f5;
                            padding: 15px;
                            margin-bottom: 15px;
                            border-radius: 8px;
                            border: 1px solid #ddd;
                          }
                          .signature-info {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 10px;
                            margin-bottom: 15px;
                          }
                          .signature-img {
                            max-width: 300px;
                            height: auto;
                            border: 1px solid #667eea;
                            border-radius: 8px;
                            background: white;
                            padding: 10px;
                          }
                          .footer {
                            text-align: center;
                            padding: 20px;
                            margin-top: 20px;
                            color: #666;
                            font-size: 12px;
                            border-top: 1px solid #ddd;
                          }
                          @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="header">
                          ${contract.logo_url ? `<img src="${contract.logo_url}" class="logo" alt="شعار">` : ''}
                          <h1 class="title">${contract.title}</h1>
                          ${contract.description ? `<p class="description">${contract.description}</p>` : ''}
                        </div>
                        <div class="content">
                          ${selectedContract.content}
                        </div>
                        <div class="metadata">
                          <div class="metadata-item">
                            <div class="metadata-label">${translations.contractType}</div>
                            <div class="metadata-value">${CONTRACT_TYPE_LABELS[contract.contract_type]}</div>
                          </div>
                          ${contract.start_date ? `
                          <div class="metadata-item">
                            <div class="metadata-label">${translations.startDate}</div>
                            <div class="metadata-value">${new Date(contract.start_date).toLocaleDateString('ar-MA')}</div>
                          </div>
                          ` : ''}
                          ${contract.end_date ? `
                          <div class="metadata-item">
                            <div class="metadata-label">${translations.endDate}</div>
                            <div class="metadata-value">${new Date(contract.end_date).toLocaleDateString('ar-MA')}</div>
                          </div>
                          ` : ''}
                          ${contract.expires_at ? `
                          <div class="metadata-item">
                            <div class="metadata-label">${translations.expiresAt}</div>
                            <div class="metadata-value">${new Date(contract.expires_at).toLocaleDateString('ar-MA')}</div>
                          </div>
                          ` : ''}
                        </div>
                        ${signatures.length > 0 ? `
                        <div class="signatures">
                          <h2 style="color: #667eea; font-size: 24px; font-weight: bold; margin-bottom: 20px; text-align: center;">${translations.signatures}</h2>
                          ${signatures.map(sig => `
                            <div class="signature-item">
                              <div class="signature-info">
                                <div>
                                  <div class="metadata-label">${translations.signerName}</div>
                                  <div class="metadata-value">${sig.signer_name}</div>
                                </div>
                                <div>
                                  <div class="metadata-label">${translations.signerEmail}</div>
                                  <div class="metadata-value">${sig.signer_email}</div>
                                </div>
                                ${sig.signer_phone ? `
                                <div>
                                  <div class="metadata-label">${translations.signerPhone}</div>
                                  <div class="metadata-value">${sig.signer_phone}</div>
                                </div>
                                ` : ''}
                                <div>
                                  <div class="metadata-label">${translations.signedAt}</div>
                                  <div class="metadata-value">${new Date(sig.signed_at).toLocaleString('ar-MA')}</div>
                                </div>
                              </div>
                              ${sig.signature_data ? `<img src="${sig.signature_data}" class="signature-img" alt="${translations.signature}">` : ''}
                            </div>
                          `).join('')}
                        </div>
                        ` : ''}
                        <div class="footer">
                          <div style="color: #667eea; font-weight: bold; margin-bottom: 5px;">${translations.smartContracts}</div>
                          <div>${translations.createdElectronically} ${new Date().toLocaleDateString('ar-MA')}</div>
                          <div style="margin-top: 5px;">${translations.ref} ${contract.id} | ${new Date(contract.created_at).toLocaleDateString('ar-MA')}</div>
                        </div>
                      </body>
                      </html>
                    `;

                    printWindow.document.write(printContent);
                    printWindow.document.close();
                    
                    // Wait for content to load then print
                    printWindow.onload = () => {
                      setTimeout(() => {
                        printWindow.print();
                      }, 500);
                    };
                  } catch (error) {
                    console.error("Print error:", error);
                    toast.error("فشل فتح نافذة الطباعة");
                  }
                }}
              >
                <Eye className="h-4 w-4 ml-2" />
                {t("contracts.print")}
              </Button>
              {selectedContract.status === "draft" && (
                <Button
                  onClick={() => handleSendForSigning(selectedContract)}
                >
                  <CheckCircle className="h-4 w-4 ml-2" />
                  {t("contracts.sendForSigning")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {signatures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                {t("contracts.signatures.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ display: 'block', visibility: 'visible' }}>
                {signatures.map((sig) => (
                  <div key={sig.id} style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '16px', display: 'block', visibility: 'visible' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'block', visibility: 'visible' }}>
                        <Label style={{ fontSize: '12px', color: '#64748b', display: 'block', visibility: 'visible' }}>{t("contracts.signatures.signerName")}</Label>
                        <p style={{ fontWeight: '500', display: 'block', visibility: 'visible', color: '#000' }}>{sig.signer_name}</p>
                      </div>
                      <div style={{ display: 'block', visibility: 'visible' }}>
                        <Label style={{ fontSize: '12px', color: '#64748b', display: 'block', visibility: 'visible' }}>{t("contracts.signatures.signerEmail")}</Label>
                        <p style={{ fontWeight: '500', display: 'block', visibility: 'visible', color: '#000' }}>{sig.signer_email}</p>
                      </div>
                      {sig.signer_phone && (
                        <div style={{ display: 'block', visibility: 'visible' }}>
                          <Label style={{ fontSize: '12px', color: '#64748b', display: 'block', visibility: 'visible' }}>{t("contracts.signatures.signerPhone")}</Label>
                          <p style={{ fontWeight: '500', display: 'block', visibility: 'visible', color: '#000' }}>{sig.signer_phone}</p>
                        </div>
                      )}
                      <div style={{ display: 'block', visibility: 'visible' }}>
                        <Label style={{ fontSize: '12px', color: '#64748b', display: 'block', visibility: 'visible' }}>{t("contracts.signatures.signedAt")}</Label>
                        <p style={{ fontWeight: '500', display: 'block', visibility: 'visible', color: '#000' }}>
                          {new Date(sig.signed_at).toLocaleString('ar-MA')}
                        </p>
                      </div>
                    </div>
                    {sig.signature_data && (
                      <div style={{ marginTop: '16px', display: 'block', visibility: 'visible' }}>
                        <Label style={{ fontSize: '12px', color: '#64748b', display: 'block', visibility: 'visible' }}>التوقيع</Label>
                        <img
                          src={sig.signature_data}
                          alt="التوقيع"
                          style={{
                            display: 'block',
                            visibility: 'visible',
                            marginTop: '8px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            maxWidth: '100%',
                            height: 'auto',
                            maxHeight: '200px',
                            minWidth: '200px',
                            minHeight: '100px',
                            backgroundColor: '#fff'
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("contracts.title")}</h1>
          <p className="text-slate-400">{t("contracts.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FileText className="h-4 w-4 ml-2" />
                {t("contracts.newTemplate")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("contracts.newTemplate")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("contracts.template.name")}</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={t("contracts.template.name")}
                  />
                </div>
                <div>
                  <Label>{t("contracts.form.type")}</Label>
                  <Select
                    value={formData.contract_type}
                    onValueChange={(value) => setFormData({ ...formData, contract_type: value as ContractType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("contracts.template.content")}</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder={t("contracts.template.content")}
                    rows={10}
                  />
                </div>
                <div>
                  <Label>{t("contracts.form.logo")}</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({ ...formData, logo_url: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {formData.logo_url && (
                    <img
                      src={formData.logo_url}
                      alt="شعار"
                      style={{ marginTop: '8px', maxWidth: '150px', maxHeight: '150px', display: 'block', visibility: 'visible' }}
                    />
                  )}
                </div>
                <div>
                  <Label>{t("contracts.template.description")}</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("contracts.template.description")}
                    rows={2}
                  />
                </div>
                <div>
                  <Label>{t("contracts.template.isPublic")}</Label>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      id="is_public"
                      checked={formData.is_public || false}
                      onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    />
                    <label htmlFor="is_public" className="text-sm text-slate-600">
                      {t("contracts.template.publicLabel")}
                    </label>
                  </div>
                </div>
                <Button onClick={() => {
                  // Add logo to content if provided
                  let content = formData.content;
                  if (formData.logo_url) {
                    const logoHtml = `<div style="text-align: center; margin-bottom: 20px;">
                      <img src="${formData.logo_url}" alt="شعار" style="max-width: 200px; max-height: 100px; margin: 0 auto; display: block;" />
                    </div>`;
                    content = logoHtml + content;
                  }

                  createTemplate({
                    name: formData.title,
                    description: formData.description,
                    contract_type: formData.contract_type,
                    content,
                    is_public: formData.is_public,
                    logo_url: formData.logo_url,
                  })
                    .then(() => {
                      toast.success("تم إنشاء القالب");
                      setTemplateDialogOpen(false);
                      setFormData({ ...formData, title: "", description: "", content: "", logo_url: "", is_public: false });
                      loadData();
                    })
                    .catch((error) => toast.error(error.message));
                }} className="w-full">
                  إنشاء القالب
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                عقد جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>إنشاء عقد جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>عنوان العقد</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="مثال: عقد إيجار شقة"
                  />
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="وصف مختصر للعقد..."
                    rows={2}
                  />
                </div>
                <div>
                  <Label>نوع العقد</Label>
                  <Select
                    value={formData.contract_type}
                    onValueChange={(value) => setFormData({ ...formData, contract_type: value as ContractType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {templates.length > 0 && (
                  <div>
                    <Label>استخدم قالب</Label>
                    <Select
                      onValueChange={(templateId) => {
                        const template = templates.find((t) => t.id === templateId);
                        if (template) {
                          setFormData({
                            ...formData,
                            content: template.content,
                            contract_type: template.contract_type,
                            logo_url: template.logo_url || "",
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر قالباً" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>محتوى العقد</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="اكتب محتوى العقد هنا..."
                    rows={12}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>تاريخ البدء</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>تاريخ الانتهاء</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>تاريخ انتهاء صلاحية التوقيع</Label>
                  <Input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                </div>
                <div>
                  <Label>شعار الشركة (اختياري)</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({ ...formData, logo_url: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  {formData.logo_url && (
                    <img
                      src={formData.logo_url}
                      alt="شعار"
                      style={{ marginTop: '8px', maxWidth: '150px', maxHeight: '150px', display: 'block', visibility: 'visible' }}
                    />
                  )}
                </div>
                <Button onClick={handleCreateContract} className="w-full">
                  إنشاء العقد
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-slate-400 mb-4" />
            <p className="text-slate-400 mb-4">لا توجد عقود بعد</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              إنشاء عقد جديد
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {contract.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {contract.description}
                    </CardDescription>
                  </div>
                  <Badge variant={contract.status === "signed" ? "default" : "secondary"}>
                    {CONTRACT_STATUS_LABELS[contract.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/app/contracts/${contract.id}`)}
                    >
                      <Eye className="h-4 w-4 ml-2" />
                      عرض
                    </Button>
                    {contract.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSendForSigning(contract)}
                      >
                        <Share2 className="h-4 w-4 ml-2" />
                        إرسال للتوقيع
                      </Button>
                    )}
                    {contract.status === "pending_signature" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShareContract(contract)}
                      >
                        <Copy className="h-4 w-4 ml-2" />
                        نسخ رابط التوقيع
                      </Button>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteContract(contract.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
