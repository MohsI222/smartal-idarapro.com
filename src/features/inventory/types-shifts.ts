export type ShiftId = 1 | 2 | 3;

export interface ShiftInfo {
  id: ShiftId;
  name: string;
  startHour: number; // 0-23
  endHour: number; // 0-23
  description: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  shiftId: ShiftId;
  shiftName: string;
  userId: string;
  userName: string;
  action: string;
  actionType: 'sale' | 'stock_add' | 'stock_edit' | 'import' | 'export' | 'delete' | 'other';
  details: string;
  metadata?: Record<string, unknown>;
}

export const SHIFTS: Record<ShiftId, ShiftInfo> = {
  1: {
    id: 1,
    name: 'Shift 1',
    startHour: 6,
    endHour: 14,
    description: 'النوبة الصباحية (06:00 - 14:00)',
  },
  2: {
    id: 2,
    name: 'Shift 2',
    startHour: 14,
    endHour: 22,
    description: 'النوبة المسائية (14:00 - 22:00)',
  },
  3: {
    id: 3,
    name: 'Shift 3',
    startHour: 22,
    endHour: 6,
    description: 'النوبة الليلية (22:00 - 06:00)',
  },
};
