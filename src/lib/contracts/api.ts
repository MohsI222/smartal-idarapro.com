/** Contracts API Client Functions */
import type { Contract, ContractSignature, ContractTemplate, ContractStatus, ContractType } from "./types";

class ContractsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractsError";
  }
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("idara_token");
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "فشل الاتصال بالخادم" }));
    throw new ContractsError(error.error || "حدث خطأ غير متوقع");
  }

  return res.json();
}

// Contracts

export async function fetchContracts(): Promise<Contract[]> {
  try {
    const data = await api<{ contracts: Contract[] }>("/contracts");
    return data.contracts;
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل تحميل العقود");
  }
}

export async function fetchContract(id: string): Promise<{ contract: Contract; signatures: ContractSignature[] }> {
  try {
    return await api<{ contract: Contract; signatures: ContractSignature[] }>(`/contracts/${id}`);
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل تحميل العقد");
  }
}

export async function createContract(data: {
  title: string;
  description?: string;
  contract_type: ContractType;
  content: string;
  parties?: string;
  start_date?: string;
  end_date?: string;
  expires_at?: string;
  template_id?: string;
  logo_url?: string;
}): Promise<string> {
  try {
    const res = await api<{ contract_id: string }>("/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.contract_id;
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل إنشاء العقد");
  }
}

export async function updateContract(id: string, data: {
  title?: string;
  description?: string;
  content?: string;
  parties?: string;
  start_date?: string;
  end_date?: string;
  expires_at?: string;
  status?: ContractStatus;
  logo_url?: string;
}): Promise<void> {
  try {
    await api(`/contracts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل تحديث العقد");
  }
}

export async function deleteContract(id: string): Promise<void> {
  try {
    await api(`/contracts/${id}`, { method: "DELETE" });
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل حذف العقد");
  }
}

export async function fetchPublicContract(id: string): Promise<Contract> {
  try {
    const res = await fetch(`/api/contracts/public/${id}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "فشل الاتصال بالخادم" }));
      throw new ContractsError(error.error || "حدث خطأ غير متوقع");
    }
    const data = await res.json();
    return data.contract;
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل تحميل العقد");
  }
}

export async function submitSignature(contractId: string, data: {
  signer_name: string;
  signer_email: string;
  signer_phone?: string;
  signature_data: string;
}): Promise<string> {
  try {
    const res = await fetch(`/api/contracts/${contractId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "فشل الاتصال بالخادم" }));
      throw new ContractsError(error.error || "حدث خطأ غير متوقع");
    }
    const result = await res.json();
    return result.signature_id;
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل حفظ التوقيع");
  }
}

// Contract Templates

export async function fetchTemplates(): Promise<ContractTemplate[]> {
  try {
    const data = await api<{ templates: ContractTemplate[] }>("/contract-templates");
    return data.templates;
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل تحميل القوالب");
  }
}

export async function createTemplate(data: {
  name: string;
  description?: string;
  contract_type: ContractType;
  content: string;
  is_public?: boolean;
  logo_url?: string;
}): Promise<string> {
  try {
    const res = await api<{ template_id: string }>("/contract-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.template_id;
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل إنشاء القالب");
  }
}

export async function updateTemplate(id: string, data: {
  name?: string;
  description?: string;
  content?: string;
  is_public?: boolean;
  logo_url?: string;
}): Promise<void> {
  try {
    await api(`/contract-templates/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل تحديث القالب");
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    await api(`/contract-templates/${id}`, { method: "DELETE" });
  } catch (e) {
    throw new ContractsError(e instanceof Error ? e.message : "فشل حذف القالب");
  }
}
