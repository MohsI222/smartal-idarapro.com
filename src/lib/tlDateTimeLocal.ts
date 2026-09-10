/**
 * Build local YYYY-MM-DDTHH:mm for TL APIs from today's date + time (HH:mm).
 * Any non–Latin-9 digits in the string are normalized before parsing.
 */

import { toWesternDigits } from "@/lib/unicodeDigits";

export function tlTodayYmdLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Current local time as HH:mm (for default time inputs). */
export function tlNowHmLocal(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * @param timeHm value from &lt;input type="time" /&gt; (may include Eastern Arabic numerals)
 * @returns YYYY-MM-DDTHH:mm in local calendar today, or null if empty/invalid
 */
export function tlCombineTodayWithTime(timeHm: string | undefined | null): string | null {
  if (timeHm == null) return null;
  const raw = toWesternDigits(timeHm.trim());
  if (raw === "") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (!m) return null;
  let hh = parseInt(m[1]!, 10);
  let min = parseInt(m[2]!, 10);
  if (!Number.isFinite(hh) || !Number.isFinite(min)) return null;
  hh = Math.min(23, Math.max(0, hh));
  min = Math.min(59, Math.max(0, min));
  const ymd = tlTodayYmdLocal();
  return `${ymd}T${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Default expected entry when user leaves time empty: today at current local time. */
export function tlDefaultExpectedEntryLocal(): string {
  return `${tlTodayYmdLocal()}T${tlNowHmLocal()}`;
}
