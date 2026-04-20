import { api, ApiError, getApiUrlPrefix } from "@/lib/api";

const API_BASE = getApiUrlPrefix();

export type TlWorker = {
  id: string;
  user_id: string;
  full_name: string;
  employee_id: string;
  center: string;
  role_title: string;
  department: string;
  hierarchy_role: string;
  reports_to_worker_id: string | null;
  magic_token: string | null;
  created_at: string;
};

export type TlVehicleLog = {
  id: string;
  user_id: string;
  department: string;
  vehicle_id: string;
  driver_name: string;
  driver_phone: string;
  driver_id_doc: string;
  vehicle_kind: "bus" | "truck";
  expected_entry_at: string;
  entry_at: string | null;
  exit_at: string | null;
  passenger_count: number | null;
  seat_count: number | null;
  cargo_count: number | null;
  box_count: number | null;
  marked_success: number;
  alert_level: string;
  delay_minutes: number;
  notes: string | null;
  created_at: string;
};

export type TlOpsLog = {
  id: string;
  user_id: string;
  department: string;
  worker_id: string;
  log_time: string;
  quantity: number;
  delay_reason: string;
  target_pct: number;
  created_at: string;
  worker_full_name?: string;
};

export type TlIncident = {
  id: string;
  user_id: string;
  ref_kind: string;
  ref_id: string;
  severity: string;
  summary: string;
  detail: string | null;
  created_at: string;
};

export type TlMessage = {
  id: string;
  user_id: string;
  from_worker_id: string;
  to_worker_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  from_name?: string;
  to_name?: string;
  attachment_original_name?: string | null;
  attachment_stored_path?: string | null;
  attachment_mime?: string | null;
};

export const TL_DEPT_SLUGS = [
  "transport",
  "logistics",
  "production",
  "quality",
  "maintenance",
  "utilities",
] as const;
export type TlDeptSlug = (typeof TL_DEPT_SLUGS)[number];

export function isTlDept(s: string): s is TlDeptSlug {
  return (TL_DEPT_SLUGS as readonly string[]).includes(s);
}

export function tlVehicleDeps(dept: string): boolean {
  return dept === "transport" || dept === "logistics";
}

export async function tlResolveMagic(token: string | null, authToken: string | null) {
  if (!token?.trim() || !authToken) return null;
  return api<{ worker: TlWorker }>(`/tl/resolve-magic?token=${encodeURIComponent(token)}`, { token: authToken });
}

export async function tlWorkers(token: string, department?: string) {
  const q = department ? `?department=${encodeURIComponent(department)}` : "";
  return api<{ workers: TlWorker[] }>(`/tl/workers${q}`, { token });
}

export async function tlCreateWorker(token: string, body: Partial<TlWorker>) {
  return api<{ worker: TlWorker }>("/tl/workers", { method: "POST", token, body: JSON.stringify(body) });
}

export async function tlPatchWorker(token: string, id: string, body: Partial<TlWorker>) {
  return api<{ worker: TlWorker }>(`/tl/workers/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
}

export async function tlRegenerateMagic(token: string, id: string) {
  return api<{ worker: TlWorker; magic_token: string }>(`/tl/workers/${id}/regenerate-magic`, {
    method: "POST",
    token,
    body: JSON.stringify({}),
  });
}

export async function tlDeleteWorker(token: string, id: string) {
  return api<{ ok: boolean }>(`/tl/workers/${id}`, { method: "DELETE", token });
}

export async function tlVehicles(token: string, department: string) {
  return api<{ logs: TlVehicleLog[] }>(`/tl/vehicles?department=${encodeURIComponent(department)}`, { token });
}

export async function tlCreateVehicle(token: string, body: Record<string, unknown>) {
  return api<{ log: TlVehicleLog }>("/tl/vehicles", { method: "POST", token, body: JSON.stringify(body) });
}

export async function tlPatchVehicle(token: string, id: string, body: Record<string, unknown>) {
  return api<{ log: TlVehicleLog }>(`/tl/vehicles/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
}

export async function tlDeleteVehicle(token: string, id: string) {
  return api<{ ok: boolean }>(`/tl/vehicles/${id}`, { method: "DELETE", token });
}

export async function tlOps(token: string, department: string) {
  return api<{ logs: TlOpsLog[] }>(`/tl/ops?department=${encodeURIComponent(department)}`, { token });
}

export async function tlCreateOps(token: string, body: Record<string, unknown>) {
  return api<{ log: TlOpsLog }>("/tl/ops", { method: "POST", token, body: JSON.stringify(body) });
}

export async function tlPatchOps(token: string, id: string, body: Record<string, unknown>) {
  return api<{ log: TlOpsLog }>(`/tl/ops/${id}`, { method: "PATCH", token, body: JSON.stringify(body) });
}

export async function tlDeleteOps(token: string, id: string) {
  return api<{ ok: boolean }>(`/tl/ops/${id}`, { method: "DELETE", token });
}

export async function tlIncidents(token: string) {
  return api<{ incidents: TlIncident[] }>("/tl/incidents", { token });
}

export async function tlDeleteIncident(token: string, id: string) {
  return api<{ ok: boolean }>(`/tl/incidents/${id}`, { method: "DELETE", token });
}

export async function tlMessages(token: string, workerId: string) {
  return api<{ messages: TlMessage[]; allowedRecipientIds: string[] }>(
    `/tl/messages?worker_id=${encodeURIComponent(workerId)}`,
    { token }
  );
}

export async function tlMessageRecipients(token: string, fromWorkerId: string) {
  return api<{ recipients: { id: string; full_name: string; hierarchy_role: string; department: string }[] }>(
    `/tl/messages/eligible/${encodeURIComponent(fromWorkerId)}`,
    { token }
  );
}

export async function tlSendMessage(token: string, body: { from_worker_id: string; to_worker_id: string; body: string }) {
  return api<{ message: TlMessage }>("/tl/messages", { method: "POST", token, body: JSON.stringify(body) });
}

export async function tlSendMessageWithFile(
  token: string,
  fields: { from_worker_id: string; to_worker_id: string; body?: string },
  file: File | null
) {
  const fd = new FormData();
  fd.append("from_worker_id", fields.from_worker_id);
  fd.append("to_worker_id", fields.to_worker_id);
  fd.append("body", fields.body ?? "");
  if (file) fd.append("file", file);
  const res = await fetch(`${API_BASE}/tl/messages/with-attachment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error ?? res.statusText, res.status);
  }
  return data as { message: TlMessage };
}

export async function tlFetchMessageAttachmentBlob(token: string, messageId: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/tl/messages/${encodeURIComponent(messageId)}/attachment`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ApiError("download_failed", res.status);
  return res.blob();
}
