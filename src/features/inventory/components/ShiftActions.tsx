import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShifts } from '../ShiftContext';
import * as XLSX from 'xlsx';
import { downloadXlsxWorkbook } from '@/lib/excelDownload';
import { useI18n } from '@/i18n/I18nProvider';

export function ShiftActions() {
  const { currentShift, currentDate, getLogsByShift } = useShifts();
  const { locale } = useI18n();

  const closeShiftAndExport = () => {
    const shiftLogs = getLogsByShift(currentShift.id, currentDate);

    // Calculate summary
    const salesCount = shiftLogs.filter(log => log.actionType === 'sale').length;
    const stockAddCount = shiftLogs.filter(log => log.actionType === 'stock_add').length;
    const stockEditCount = shiftLogs.filter(log => log.actionType === 'stock_edit').length;
    const importCount = shiftLogs.filter(log => log.actionType === 'import').length;
    const exportCount = shiftLogs.filter(log => log.actionType === 'export').length;
    const deleteCount = shiftLogs.filter(log => log.actionType === 'delete').length;

    // Create Excel report
    const isArabic = locale.startsWith('ar');
    const summaryAoA = [
      [isArabic ? 'تقرير نوبة العمل' : 'Shift Report', ''],
      [isArabic ? 'التاريخ' : 'Date', currentDate],
      [isArabic ? 'النوبة' : 'Shift', currentShift.name],
      [isArabic ? 'الوصف' : 'Description', currentShift.description],
      [''],
      [isArabic ? 'ملخص العمليات' : 'Operations Summary', ''],
      [isArabic ? 'عدد المبيعات' : 'Sales Count', salesCount],
      [isArabic ? 'إضافة مخزون' : 'Stock Added', stockAddCount],
      [isArabic ? 'تعديل مخزون' : 'Stock Edited', stockEditCount],
      [isArabic ? 'استيراد' : 'Imports', importCount],
      [isArabic ? 'تصدير' : 'Exports', exportCount],
      [isArabic ? 'حذف' : 'Deletes', deleteCount],
      [isArabic ? 'إجمالي العمليات' : 'Total Operations', shiftLogs.length],
      [''],
      [isArabic ? 'تفاصيل العمليات' : 'Operations Details', ''],
      [isArabic ? 'التاريخ' : 'Date', isArabic ? 'الوقت' : 'Time', isArabic ? 'النوبة' : 'Shift', isArabic ? 'المستخدم' : 'User', isArabic ? 'الإجراء' : 'Action', isArabic ? 'النوع' : 'Type', isArabic ? 'التفاصيل' : 'Details'],
      ...shiftLogs.map((log) => [
        String(log.date || ''),
        String(log.time || ''),
        String(log.shiftName || ''),
        String(log.userName || ''),
        String(log.action || ''),
        String(log.actionType || ''),
        String(log.details || ''),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(summaryAoA);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Shift Report');
    downloadXlsxWorkbook(wb, `shift-${currentShift.id}-${currentDate}.xlsx`);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={closeShiftAndExport}
        size="sm"
        variant="outline"
        className="border-slate-600 text-white hover:bg-slate-800"
      >
        <Download className="h-4 w-4 mr-2" />
        تصدير Excel
      </Button>
    </div>
  );
}
