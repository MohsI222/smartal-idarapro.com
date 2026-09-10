/** استدعاءات خادم مختبر الوسائط — لا تستخدم api() لأنها تتوقع JSON. */

export async function enhanceImageWithServer(
  file: File,
  token: string | null,
  opts?: { removeBg?: boolean }
): Promise<Blob> {
  const fd = new FormData();
  fd.append("image", file, file.name);
  if (opts?.removeBg) fd.append("removeBg", "1");
  const res = await fetch("/api/media/enhance-image", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? res.statusText);
  }
  return res.blob();
}
