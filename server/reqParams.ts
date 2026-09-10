/** Express 5 types `req.params` values as `string | string[]` for catch-alls. */
export function paramString(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}
