/** Contracts Module Types */

export type ContractStatus = "draft" | "pending_signature" | "signed" | "rejected" | "expired";
export type ContractType = "rental" | "sales" | "employment" | "service" | "custom";

export interface Contract {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  contract_type: ContractType;
  status: ContractStatus;
  template_id: string | null;
  content: string;
  pdf_url: string | null;
  parties: string; // JSON array
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  logo_url: string | null;
}

export interface ContractSignature {
  id: string;
  contract_id: string;
  signer_name: string;
  signer_email: string;
  signer_phone: string;
  signature_data: string;
  signed_at: string;
  ip_address: string;
  user_agent: string;
}

export interface ContractTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  contract_type: ContractType;
  content: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  logo_url: string | null;
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "مسودة 📝",
  pending_signature: "بانتظار التوقيع ✍️",
  signed: "موقع ✅",
  rejected: "مرفوض ❌",
  expired: "منتهي ⏰",
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  rental: "إيجار",
  sales: "بيع",
  employment: "توظيف",
  service: "خدمة",
  custom: "مخصص",
};
