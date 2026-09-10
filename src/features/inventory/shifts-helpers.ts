import type { ShiftId, ShiftInfo } from './types-shifts';
import { SHIFTS } from './types-shifts';

/**
 * Get current shift based on current time
 */
export function getCurrentShift(): ShiftInfo {
  const now = new Date();
  const hour = now.getHours();

  // Shift 3: 22:00 - 06:00 (next day)
  if (hour >= 22 || hour < 6) {
    return SHIFTS[3];
  }
  // Shift 1: 06:00 - 14:00
  if (hour >= 6 && hour < 14) {
    return SHIFTS[1];
  }
  // Shift 2: 14:00 - 22:00
  return SHIFTS[2];
}

/**
 * Get shift ID based on a specific date/time
 */
export function getShiftForDate(date: Date): ShiftId {
  const hour = date.getHours();

  if (hour >= 22 || hour < 6) return 3;
  if (hour >= 6 && hour < 14) return 1;
  return 2;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format time as HH:MM:SS
 */
export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Check if a timestamp falls within a specific shift on a specific date
 */
export function isTimestampInShift(timestamp: string, shiftId: ShiftId, date: string): boolean {
  const tsDate = new Date(timestamp);
  const tsDateStr = formatDate(tsDate);
  
  // Check if it's the same date
  if (tsDateStr !== date) {
    // For shift 3, it might span to the next day
    if (shiftId === 3) {
      const nextDay = new Date(tsDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = formatDate(nextDay);
      return tsDateStr === nextDayStr;
    }
    return false;
  }

  const shift = SHIFTS[shiftId];
  const hour = tsDate.getHours();

  if (shiftId === 3) {
    // Shift 3: 22:00 - 06:00
    return hour >= 22 || hour < 6;
  }

  return hour >= shift.startHour && hour < shift.endHour;
}
