import { useState, useMemo } from "react";
import { Clock, User, Phone, MapPin, Package, DollarSign, Edit, Trash2, Save, X, Download, FileSpreadsheet, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkerShift, WorkerShiftFormState } from "../types";

type TranslateFn = (key: string) => string;

type WorkerTrackingSectionProps = {
  t: TranslateFn;
  workerShifts: WorkerShift[];
  onAddShift: (shift: Omit<WorkerShift, "id" | "created_at" | "updated_at">) => void | Promise<void>;
  onUpdateShift: (id: string, shift: Partial<WorkerShift>) => void | Promise<void>;
  onDeleteShift: (id: string) => void | Promise<void>;
  onExportPdf: () => void | Promise<void>;
  onExportExcel: () => void | Promise<void>;
};

export function WorkerTrackingSection({
  t,
  workerShifts,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onExportPdf,
  onExportExcel,
}: WorkerTrackingSectionProps) {
  const [form, setForm] = useState<WorkerShiftFormState>({
    worker_id: "",
    worker_name: "",
    phone: "",
    center: "",
    entry_time: "",
    exit_time: "",
    products_sold: "0",
    money_earned: "0",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<Partial<WorkerShiftFormState>>({});
  const [viewingId, setViewingId] = useState<string | null>(null);

  const calculateHoursWorked = (entryTime: string, exitTime: string): number => {
    if (!entryTime || !exitTime) return 0;
    
    const entry = new Date(`2000-01-01T${entryTime}`);
    const exit = new Date(`2000-01-01T${exitTime}`);
    
    if (exit < entry) {
      exit.setDate(exit.getDate() + 1);
    }
    
    const diffMs = exit.getTime() - entry.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.round(diffHours * 100) / 100;
  };

  const currentHoursWorked = useMemo(() => {
    return calculateHoursWorked(form.entry_time, form.exit_time);
  }, [form.entry_time, form.exit_time]);

  const editingHoursWorked = useMemo(() => {
    if (!editingId) return 0;
    const entry = editingForm.entry_time || "";
    const exit = editingForm.exit_time || "";
    return calculateHoursWorked(entry, exit);
  }, [editingId, editingForm.entry_time, editingForm.exit_time]);

  const handleSubmit = async () => {
    if (!form.worker_id.trim() || !form.worker_name.trim() || !form.phone.trim() || !form.center.trim()) {
      return;
    }
    if (!form.entry_time || !form.exit_time) {
      return;
    }

    await onAddShift({
      worker_id: form.worker_id.trim(),
      worker_name: form.worker_name.trim(),
      phone: form.phone.trim(),
      center: form.center.trim(),
      entry_time: form.entry_time,
      exit_time: form.exit_time,
      hours_worked: currentHoursWorked,
      products_sold: Number(form.products_sold) || 0,
      money_earned: Number(form.money_earned) || 0,
    });

    setForm({
      worker_id: "",
      worker_name: "",
      phone: "",
      center: "",
      entry_time: "",
      exit_time: "",
      products_sold: "0",
      money_earned: "0",
    });
  };

  const handleEdit = (shift: WorkerShift) => {
    setEditingId(shift.id);
    setEditingForm({
      worker_id: shift.worker_id,
      worker_name: shift.worker_name,
      phone: shift.phone,
      center: shift.center,
      entry_time: shift.entry_time,
      exit_time: shift.exit_time,
      products_sold: String(shift.products_sold),
      money_earned: String(shift.money_earned),
    });
    setViewingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    if (!editingForm.worker_id?.trim() || !editingForm.worker_name?.trim() || !editingForm.phone?.trim() || !editingForm.center?.trim()) {
      return;
    }

    await onUpdateShift(editingId, {
      worker_id: editingForm.worker_id.trim(),
      worker_name: editingForm.worker_name.trim(),
      phone: editingForm.phone.trim(),
      center: editingForm.center.trim(),
      entry_time: editingForm.entry_time || "",
      exit_time: editingForm.exit_time || "",
      hours_worked: editingHoursWorked,
      products_sold: Number(editingForm.products_sold) || 0,
      money_earned: Number(editingForm.money_earned) || 0,
    });

    setEditingId(null);
    setEditingForm({});
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t("inv.confirmDelete"))) {
      await onDeleteShift(id);
    }
  };

  const handleView = (shift: WorkerShift) => {
    setViewingId(shift.id);
    setEditingId(null);
  };

  const closeView = () => {
    setViewingId(null);
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-black text-white">{t("inv.workerTracking.title")}</p>
              <p className="text-[11px] text-slate-500 mt-1">{t("inv.workerTracking.subtitle")}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                onClick={() => void onExportPdf()}
              >
                <Download className="size-4 mr-1" />
                PDF
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                onClick={() => void onExportExcel()}
              >
                <FileSpreadsheet className="size-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <Label className="flex items-center gap-2">
                <User className="size-4" />
                {t("inv.workerTracking.workerId")}
              </Label>
              <Input
                className="mt-1 bg-[#0c1222] border-slate-700"
                value={form.worker_id}
                onChange={(e) => setForm({ ...form, worker_id: e.target.value })}
                placeholder={t("inv.workerTracking.workerIdPlaceholder")}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <User className="size-4" />
                {t("inv.workerTracking.workerName")}
              </Label>
              <Input
                className="mt-1 bg-[#0c1222] border-slate-700"
                value={form.worker_name}
                onChange={(e) => setForm({ ...form, worker_name: e.target.value })}
                placeholder={t("inv.workerTracking.workerNamePlaceholder")}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Phone className="size-4" />
                {t("inv.workerTracking.phone")}
              </Label>
              <Input
                className="mt-1 bg-[#0c1222] border-slate-700"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder={t("inv.workerTracking.phonePlaceholder")}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <MapPin className="size-4" />
                {t("inv.workerTracking.center")}
              </Label>
              <Input
                className="mt-1 bg-[#0c1222] border-slate-700"
                value={form.center}
                onChange={(e) => setForm({ ...form, center: e.target.value })}
                placeholder={t("inv.workerTracking.centerPlaceholder")}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="size-4" />
                {t("inv.workerTracking.entryTime")}
              </Label>
              <Input
                type="time"
                className="mt-1 bg-[#0c1222] border-slate-700"
                value={form.entry_time}
                onChange={(e) => setForm({ ...form, entry_time: e.target.value })}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="size-4" />
                {t("inv.workerTracking.exitTime")}
              </Label>
              <Input
                type="time"
                className="mt-1 bg-[#0c1222] border-slate-700"
                value={form.exit_time}
                onChange={(e) => setForm({ ...form, exit_time: e.target.value })}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Clock className="size-4" />
                {t("inv.workerTracking.hoursWorked")}
              </Label>
              <Input
                className="mt-1 bg-[#0c1222] border-slate-700 text-emerald-400 font-bold"
                value={currentHoursWorked > 0 ? `${currentHoursWorked} ${t("inv.workerTracking.hours")}` : ""}
                readOnly
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <Package className="size-4" />
                {t("inv.workerTracking.productsSold")}
              </Label>
              <Input
                type="number"
                min="0"
                className="mt-1 bg-[#0c1222] border-slate-700"
                value={form.products_sold}
                onChange={(e) => setForm({ ...form, products_sold: e.target.value })}
              />
            </div>
            <div>
              <Label className="flex items-center gap-2">
                <DollarSign className="size-4" />
                {t("inv.workerTracking.moneyEarned")}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="mt-1 bg-[#0c1222] border-slate-700"
                value={form.money_earned}
                onChange={(e) => setForm({ ...form, money_earned: e.target.value })}
              />
            </div>
          </div>
          <Button
            type="button"
            className="w-full bg-[#0052CC]"
            onClick={() => void handleSubmit()}
          >
            {t("inv.workerTracking.addShift")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-[#0a1628]/90">
        <CardHeader className="border-b border-slate-800 py-3">
          <p className="font-black text-white">{t("inv.workerTracking.shiftsList")}</p>
        </CardHeader>
        <CardContent className="pt-4">
          {workerShifts.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">{t("inv.workerTracking.noShifts")}</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {workerShifts.map((shift) => {
                const isEditing = editingId === shift.id;
                const isViewing = viewingId === shift.id;
                
                return (
                  <div
                    key={shift.id}
                    className={`border rounded-lg p-3 ${
                      isEditing ? "border-[#0052CC] bg-[#0052CC]/10" : 
                      isViewing ? "border-[#FF8C00] bg-[#FF8C00]/10" : 
                      "border-slate-800 bg-black/20"
                    }`}
                  >
                    {isViewing ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-white">{shift.worker_name}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                            onClick={closeView}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.workerId")}:</p>
                            <p className="text-white">{shift.worker_id}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.phone")}:</p>
                            <p className="text-white">{shift.phone}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.center")}:</p>
                            <p className="text-white">{shift.center}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.entryTime")}:</p>
                            <p className="text-white">{shift.entry_time}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.exitTime")}:</p>
                            <p className="text-white">{shift.exit_time}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.hoursWorked")}:</p>
                            <p className="text-emerald-400 font-bold">{shift.hours_worked} {t("inv.workerTracking.hours")}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.productsSold")}:</p>
                            <p className="text-white">{shift.products_sold}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.moneyEarned")}:</p>
                            <p className="text-[#FF8C00] font-bold">{shift.money_earned.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">{t("inv.workerTracking.date")}:</p>
                            <p className="text-white">{new Date(shift.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    ) : isEditing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.workerId")}</Label>
                            <Input
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={editingForm.worker_id || ""}
                              onChange={(e) => setEditingForm({ ...editingForm, worker_id: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.workerName")}</Label>
                            <Input
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={editingForm.worker_name || ""}
                              onChange={(e) => setEditingForm({ ...editingForm, worker_name: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.phone")}</Label>
                            <Input
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={editingForm.phone || ""}
                              onChange={(e) => setEditingForm({ ...editingForm, phone: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.center")}</Label>
                            <Input
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={editingForm.center || ""}
                              onChange={(e) => setEditingForm({ ...editingForm, center: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.entryTime")}</Label>
                            <Input
                              type="time"
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={editingForm.entry_time || ""}
                              onChange={(e) => setEditingForm({ ...editingForm, entry_time: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.exitTime")}</Label>
                            <Input
                              type="time"
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={editingForm.exit_time || ""}
                              onChange={(e) => setEditingForm({ ...editingForm, exit_time: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.hoursWorked")}</Label>
                            <Input
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm text-emerald-400 font-bold"
                              value={editingHoursWorked > 0 ? `${editingHoursWorked} ${t("inv.workerTracking.hours")}` : ""}
                              readOnly
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.productsSold")}</Label>
                            <Input
                              type="number"
                              min="0"
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={editingForm.products_sold || "0"}
                              onChange={(e) => setEditingForm({ ...editingForm, products_sold: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{t("inv.workerTracking.moneyEarned")}</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-8 bg-[#0c1222] border-slate-700 text-sm"
                              value={editingForm.money_earned || "0"}
                              onChange={(e) => setEditingForm({ ...editingForm, money_earned: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 text-emerald-400 hover:text-emerald-300"
                            onClick={() => void handleSaveEdit()}
                          >
                            <Save className="size-4 mr-1" />
                            {t("common.save")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 text-slate-400 hover:text-white"
                            onClick={handleCancelEdit}
                          >
                            <X className="size-4 mr-1" />
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white truncate">{shift.worker_name}</p>
                          <p className="text-[11px] text-slate-500">
                            {t("inv.workerTracking.workerId")}: {shift.worker_id} · {shift.phone} · {shift.center} · {shift.entry_time} - {shift.exit_time}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <div className="text-right">
                            <p className="text-[11px] text-slate-500">{t("inv.workerTracking.hoursWorked")}</p>
                            <p className="text-emerald-400 font-bold text-sm">{shift.hours_worked} {t("inv.workerTracking.hours")}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-slate-500">{t("inv.workerTracking.moneyEarned")}</p>
                            <p className="text-[#FF8C00] font-bold text-sm">{shift.money_earned.toFixed(2)}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
                            onClick={() => handleView(shift)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-[#0052CC] hover:text-[#0052CC]/80"
                            onClick={() => handleEdit(shift)}
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                            onClick={() => void handleDelete(shift.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
