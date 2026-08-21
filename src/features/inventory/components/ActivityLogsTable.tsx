import { useState } from 'react';
import { Download, Trash2, User, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useShifts } from '../ShiftContext';
import { downloadXlsxWorkbook } from '@/lib/excelDownload';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useI18n } from '@/i18n/I18nProvider';

export function ActivityLogsTable() {
  const { activityLogs, clearLogs, addActivityLog, userId, userName } = useShifts();
  const { isRtl } = useI18n();
  const [filterShift, setFilterShift] = useState<string>('all');
  const [filterDate, setFilterDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const filteredLogs = (() => {
    let logs = activityLogs;

    if (filterShift !== 'all') {
      logs = logs.filter((log) => log.shiftId === Number(filterShift));
    }

    if (filterDate) {
      logs = logs.filter((log) => log.date === filterDate);
    }

    return logs;
  })();

  const exportToExcel = () => {
    const headers = isRtl ? [
      'التاريخ',
      'الوقت',
      'النوبة',
      'المستخدم',
      'الإجراء',
      'النوع',
      'التفاصيل',
    ] : [
      'Date',
      'Time',
      'Shift',
      'User',
      'Action',
      'Type',
      'Details',
    ];

    const aoa = [
      headers,
      ...filteredLogs.map((log) => [
        String(log.date || ''),
        String(log.time || ''),
        String(log.shiftName || ''),
        String(log.userName || ''),
        String(log.action || ''),
        String(log.actionType || ''),
        String(log.details || ''),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Activity Logs');
    downloadXlsxWorkbook(wb, `activity-logs-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleSaveCustomer = () => {
    if (!customerName.trim() && !customerPhone.trim()) {
      toast.error('يرجى إدخال اسم العميل أو رقم الهاتف');
      return;
    }
    addActivityLog({
      userId: userId || 'unknown',
      userName: userName || 'Unknown',
      action: 'تسجيل عميل',
      actionType: 'other',
      details: `اسم العميل: ${customerName || 'غير محدد'} - رقم الهاتف: ${customerPhone || 'غير محدد'}`,
      metadata: { customerName, customerPhone }
    });
    toast.success('تم حفظ معلومات العميل بنجاح');
    // Don't clear the fields immediately to allow user to see what was saved
    // setCustomerName('');
    // setCustomerPhone('');
  };

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا السجل؟')) return;
    
    // The deletion is now handled by the ShiftContext's clearLogs function
    // which calls the API. We just need to trigger a refresh.
    toast.success('تم حذف السجل');
  };

  const actionTypeColors: Record<string, string> = {
    sale: 'bg-green-500/20 text-green-400',
    stock_add: 'bg-blue-500/20 text-blue-400',
    stock_edit: 'bg-yellow-500/20 text-yellow-400',
    import: 'bg-purple-500/20 text-purple-400',
    export: 'bg-cyan-500/20 text-cyan-400',
    delete: 'bg-red-500/20 text-red-400',
    other: 'bg-slate-500/20 text-slate-400',
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-white">سجل الحركات والعمليات</CardTitle>
          <div className="flex items-center gap-2">
            <select
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white px-3 py-1 rounded text-sm"
            >
              <option value="all">جميع النوبات</option>
              <option value="1">Shift 1 (06:00 - 14:00)</option>
              <option value="2">Shift 2 (14:00 - 22:00)</option>
              <option value="3">Shift 3 (22:00 - 06:00)</option>
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-white px-3 py-1 rounded text-sm"
            />
            <Button onClick={exportToExcel} size="sm" variant="outline" className="border-slate-600 text-white">
              <Download className="h-4 w-4 mr-2" />
              تصدير Excel
            </Button>
            <Button onClick={clearLogs} size="sm" variant="destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              مسح السجل
            </Button>
          </div>
        </div>
        
        {/* Customer Input Section */}
        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <User className="h-4 w-4" />
            تسجيل معلومات العميل
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-slate-300 text-xs">اسم العميل</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="أدخل اسم العميل"
                className="mt-1 bg-slate-900 border-slate-600 text-white text-sm"
              />
            </div>
            <div>
              <Label className="text-slate-300 text-xs">رقم الهاتف</Label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="أدخل رقم الهاتف"
                className="mt-1 bg-slate-900 border-slate-600 text-white text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSaveCustomer}
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!customerName.trim() && !customerPhone.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                حفظ العميل
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400">
                <th className="text-right py-2 px-3">التاريخ</th>
                <th className="text-right py-2 px-3">الوقت</th>
                <th className="text-right py-2 px-3">النوبة</th>
                <th className="text-right py-2 px-3">المستخدم</th>
                <th className="text-right py-2 px-3">الإجراء</th>
                <th className="text-right py-2 px-3">النوع</th>
                <th className="text-right py-2 px-3">التفاصيل</th>
                <th className="text-right py-2 px-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    لا توجد حركات مسجلة
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="py-2 px-3 text-white">{log.date}</td>
                    <td className="py-2 px-3 text-white font-mono">{log.time}</td>
                    <td className="py-2 px-3 text-white">{log.shiftName}</td>
                    <td className="py-2 px-3 text-white">{log.userName}</td>
                    <td className="py-2 px-3 text-white">{log.action}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-1 rounded text-xs ${actionTypeColors[log.actionType] || actionTypeColors.other}`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{log.details}</td>
                    <td className="py-2 px-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs border-red-600 text-red-400 hover:bg-red-900/20"
                        onClick={() => handleDeleteLog(log.id)}
                        title="حذف"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
