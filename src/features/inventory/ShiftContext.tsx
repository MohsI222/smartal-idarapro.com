import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { ActivityLog, ShiftInfo, ShiftId } from './types-shifts';
import { getCurrentShift, formatDate, formatTime, getCurrentTimestamp } from './shifts-helpers';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface ShiftContextType {
  currentShift: ShiftInfo;
  currentDate: string;
  currentTime: string;
  activityLogs: ActivityLog[];
  addActivityLog: (log: Omit<ActivityLog, 'id' | 'timestamp' | 'date' | 'time' | 'shiftId' | 'shiftName'>) => void;
  getLogsByShift: (shiftId: ShiftId, date?: string) => ActivityLog[];
  getLogsByDate: (date: string) => ActivityLog[];
  clearLogs: () => void;
  userId: string;
  userName: string;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children, userId, userName }: { children: ReactNode; userId: string; userName: string }) {
  const [currentShift, setCurrentShift] = useState<ShiftInfo>(getCurrentShift());
  const [currentDate, setCurrentDate] = useState(formatDate(new Date()));
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const { token } = useAuth();

  // Update shift, date, and time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentShift(getCurrentShift());
      setCurrentDate(formatDate(now));
      setCurrentTime(formatTime(now));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load logs from API on mount
  useEffect(() => {
    if (!token) return;
    
    const loadLogs = async () => {
      try {
        const response = await api<{ logs: ActivityLog[] }>('/inventory/activity-logs', { token });
        if (response.logs) {
          setActivityLogs(response.logs);
        }
      } catch (error) {
        console.error('Failed to load activity logs from API:', error);
      }
    };
    
    loadLogs();
  }, [token]);

  const addActivityLog = useCallback(async (log: Omit<ActivityLog, 'id' | 'timestamp' | 'date' | 'time' | 'shiftId' | 'shiftName'>) => {
    if (!token) return;
    
    const timestamp = getCurrentTimestamp();
    const now = new Date();
    const newLog: ActivityLog = {
      id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      date: formatDate(now),
      time: formatTime(now),
      shiftId: currentShift.id,
      shiftName: currentShift.name,
      ...log,
    };
    
    // Update local state immediately for responsiveness
    setActivityLogs((prev) => [newLog, ...prev]);
    
    // Save to API
    try {
      await api('/inventory/activity-logs', {
        method: 'POST',
        token,
        body: JSON.stringify({
          timestamp: newLog.timestamp,
          date: newLog.date,
          time: newLog.time,
          shift_id: newLog.shiftId,
          shift_name: newLog.shiftName,
          action_type: newLog.actionType,
          product_id: newLog.productId,
          product_name: newLog.productName,
          quantity: newLog.quantity,
          notes: newLog.notes,
        }),
      });
    } catch (error) {
      console.error('Failed to save activity log to API:', error);
      // Revert local state on error
      setActivityLogs((prev) => prev.filter((l) => l.id !== newLog.id));
    }
  }, [currentShift, token]);

  const getLogsByShift = useCallback((shiftId: ShiftId, date?: string) => {
    const targetDate = date || currentDate;
    return activityLogs.filter((log) => log.shiftId === shiftId && log.date === targetDate);
  }, [activityLogs, currentDate]);

  const getLogsByDate = useCallback((date: string) => {
    return activityLogs.filter((log) => log.date === date);
  }, [activityLogs]);

  const clearLogs = useCallback(async () => {
    if (!token) return;
    
    // Delete all logs from API
    try {
      for (const log of activityLogs) {
        await api(`/inventory/activity-logs/${log.id}`, {
          method: 'DELETE',
          token,
        });
      }
      setActivityLogs([]);
    } catch (error) {
      console.error('Failed to clear activity logs from API:', error);
    }
  }, [activityLogs, token]);

  return (
    <ShiftContext.Provider
      value={{
        currentShift,
        currentDate,
        currentTime,
        activityLogs,
        addActivityLog,
        getLogsByShift,
        getLogsByDate,
        clearLogs,
        userId,
        userName,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShifts() {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error('useShifts must be used within a ShiftProvider');
  }
  return context;
}
