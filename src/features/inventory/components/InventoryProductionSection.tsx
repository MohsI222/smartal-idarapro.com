import { useState } from "react";
import { Download, FileSpreadsheet, FileText, MessageSquare, Paperclip, Plus, Search, Send, Trash2, X } from "lucide-react";
import type { HrStaffRow, LogisticsQueueItem, ProductionRequestRow } from "@/lib/supabaseClient";
import type { TlMessage, TlWorker } from "@/lib/tlApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventorySourceRow, MessageRecipient, ProductionBomItem } from "../types";

type TranslateFn = (key: string, values?: Record<string, string>) => string;

export type InventoryProductionSectionProps = {
  t: TranslateFn;
  inventoryItemsCount: number;
  inventorySearch: string;
  filteredInventoryRows: InventorySourceRow[];
  onInventorySearchChange: (value: string) => void;
  onAddFirstSearchMatchToBom: () => void;
  onAddBomItem: (item: InventorySourceRow) => void;
  tlWorkerList: TlWorker[];
  effectiveSender: TlWorker | null;
  selectedProductionWorkerId: string;
  selectedLogisticsAssignee: string;
  onSelectedProductionWorkerIdChange: (value: string) => void;
  onSelectedLogisticsAssigneeChange: (value: string) => void;
  ctxWorker: TlWorker | null;
  hrStaff: HrStaffRow[];
  bomItems: ProductionBomItem[];
  onBomQuantityChange: (materialId: string, quantity: number) => void;
  onReserveBomMaterial: (materialId: string) => void;
  onCreateProductionRequest: () => void;
  isCreatingRequest: boolean;
  productionRequests: ProductionRequestRow[];
  logisticsQueue: LogisticsQueueItem[];
  workerNameById: Map<string, string>;
  onAssignLogisticsQueueItem: (id: string) => void;
  isAssigningLogistics: boolean;
  messages: TlMessage[];
  messageRecipients: MessageRecipient[];
  messageTo: string;
  messageBody: string;
  messageFile: File | null;
  onMessageToChange: (value: string) => void;
  onMessageBodyChange: (value: string) => void;
  onMessageFileChange: (file: File | null) => void;
  onSendInventoryMessage: () => void;
  isSendingMessage: boolean;
  onOpenInventoryMessageAttachment: (message: TlMessage) => void;
  onExportInventoryPdf: () => void | Promise<void>;
  onExportInventoryExcel: () => void;
  onDeleteProductionRequest: (id: string) => void;
  onDeleteLogisticsQueueItem: (id: string) => void;
  onDeleteSelectedProductionRequests: (ids: string[]) => void;
  onDeleteSelectedLogisticsQueueItems: (ids: string[]) => void;
};

export function InventoryProductionSection({
  t,
  inventoryItemsCount,
  inventorySearch,
  filteredInventoryRows,
  onInventorySearchChange,
  onAddFirstSearchMatchToBom,
  onAddBomItem,
  tlWorkerList,
  effectiveSender,
  selectedProductionWorkerId,
  selectedLogisticsAssignee,
  onSelectedProductionWorkerIdChange,
  onSelectedLogisticsAssigneeChange,
  ctxWorker,
  hrStaff,
  bomItems,
  onBomQuantityChange,
  onReserveBomMaterial,
  onCreateProductionRequest,
  isCreatingRequest,
  productionRequests,
  logisticsQueue,
  workerNameById,
  onAssignLogisticsQueueItem,
  isAssigningLogistics,
  messages,
  messageRecipients,
  messageTo,
  messageBody,
  messageFile,
  onMessageToChange,
  onMessageBodyChange,
  onMessageFileChange,
  onSendInventoryMessage,
  isSendingMessage,
  onOpenInventoryMessageAttachment,
  onExportInventoryPdf,
  onExportInventoryWord,
  onExportInventoryExcel,
  onDeleteProductionRequest,
  onDeleteLogisticsQueueItem,
  onDeleteSelectedProductionRequests,
  onDeleteSelectedLogisticsQueueItems,
}: InventoryProductionSectionProps) {
  // Safe data guards
  const safeFilteredInventoryRows = filteredInventoryRows || [];
  const safeTlWorkerList = tlWorkerList || [];
  const safeHrStaff = hrStaff || [];
  const safeBomItems = bomItems || [];
  const safeProductionRequests = productionRequests || [];
  const safeLogisticsQueue = logisticsQueue || [];
  const safeMessages = messages || [];
  const safeMessageRecipients = messageRecipients || [];

  const [selectedProductionRequests, setSelectedProductionRequests] = useState<Set<string>>(new Set());
  const [selectedLogisticsQueueItems, setSelectedLogisticsQueueItems] = useState<Set<string>>(new Set());
  return (
    <Card className="border-slate-800 bg-[#0a1628]/90">
      <CardHeader className="border-b border-slate-800">
        <p className="font-black text-white">{t("inv.production.title")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-semibold text-white">{t("inv.production.inventoryTitle")}</p>
                <p className="text-xs text-slate-500">
                  {inventoryItemsCount > 0
                    ? t("inv.production.sourceSupabase")
                    : t("inv.production.sourceFallback")}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                  onClick={() => void onExportInventoryPdf()}
                >
                  <Download className="size-4 mr-1" />
                  PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
                  onClick={onExportInventoryExcel}
                >
                  <FileSpreadsheet className="size-4 mr-1" />
                  Excel
                </Button>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 gap-2 sm:max-w-md">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={inventorySearch}
                  onChange={(e) => onInventorySearchChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onAddFirstSearchMatchToBom();
                  }}
                  placeholder={t("inv.production.searchPlaceholder")}
                  className="bg-[#0c1222] border-slate-700 ps-9"
                />
              </div>
              <Button type="button" variant="secondary" className="gap-2" onClick={onAddFirstSearchMatchToBom}>
                <Plus className="size-4" />
                {t("common.add")}
              </Button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#020715]/80">
              <table className="w-full text-sm text-slate-200">
                <thead>
                  <tr className="text-left border-b border-slate-700 text-slate-400">
                    <th className="py-2 pe-4">{t("inv.production.col.name")}</th>
                    <th className="py-2 pe-4">{t("inv.production.col.qty")}</th>
                    <th className="py-2 pe-4">{t("inv.production.col.ref")}</th>
                    <th className="py-2">{t("inv.production.col.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {safeFilteredInventoryRows.length ? (
                    safeFilteredInventoryRows.map((item) => (
                      <tr key={`${item.source}-${item.id}`} className="border-b border-slate-800/80">
                        <td className="py-2 pe-4 font-semibold">
                          {item.name}
                          <span className="ms-2 rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-500">
                            {item.source === "supabase" ? "SB" : "API"}
                          </span>
                        </td>
                        <td className="py-2 pe-4 text-emerald-300 font-semibold">{item.qty}</td>
                        <td className="py-2 pe-4 text-xs text-slate-500">
                          {item.sku || item.barcode || item.reference || "—"}
                        </td>
                        <td className="py-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1 bg-slate-900/80"
                            onClick={() => {
                              if (typeof onAddBomItem === 'function') {
                                onAddBomItem(item);
                              }
                            }}
                          >
                            <Plus className="size-3" />
                            {t("inv.production.addBom")}
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        {t("inv.production.noMatches")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-slate-300">{t("inv.production.supervisorSender")}</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
                  value={effectiveSender?.id ?? selectedProductionWorkerId}
                  disabled={Boolean(ctxWorker)}
                  onChange={(e) => onSelectedProductionWorkerIdChange(e.target.value)}
                >
                  {safeTlWorkerList.length === 0 && <option value="">{t("inv.production.noTlWorkers")}</option>}
                  {safeTlWorkerList.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name} · {worker.department}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-slate-300">{t("inv.production.logisticsEmployee")}</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
                  value={selectedLogisticsAssignee}
                  onChange={(e) => onSelectedLogisticsAssigneeChange(e.target.value)}
                >
                  {safeTlWorkerList.length === 0 && <option value="">{t("inv.production.noEmployees")}</option>}
                  {safeTlWorkerList.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name} · {worker.hierarchy_role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-slate-300">
              <p className="font-semibold text-cyan-200">
                {t("inv.production.rhSync", { staff: String(safeHrStaff.length), workers: String(safeTlWorkerList.length) })}
              </p>
              <p className="mt-1 text-slate-500">
                {ctxWorker
                  ? t("inv.production.magicResolved", {
                      name: ctxWorker.full_name,
                      department: ctxWorker.department,
                    })
                  : t("inv.production.magicDashboard")}
              </p>
            </div>
            <p className="font-semibold text-white">{t("inv.production.bomTitle")}</p>
            <div className="space-y-3 rounded-xl border border-slate-800 bg-[#020715]/80 p-4">
              {safeBomItems.length === 0 ? (
                <p className="text-slate-400">{t("inv.production.bomEmpty")}</p>
              ) : (
                <div className="space-y-3">
                  {safeBomItems.map((item) => (
                    <div
                      key={item.material_id}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 p-3"
                    >
                      <div className="min-w-[140px] flex-1 text-slate-200">
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {t("inv.production.available")}: {item.available} · {item.source}
                        </p>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) => onBomQuantityChange(item.material_id, Number(event.target.value))}
                        className="w-24 bg-[#0c1222] border-slate-700"
                      />
                      <Button size="sm" variant="outline" onClick={() => onReserveBomMaterial(item.material_id)}>
                        {t("inv.production.reserve")}
                      </Button>
                    </div>
                  ))}
                  <Button className="w-full bg-[#0052CC]" disabled={isCreatingRequest} onClick={onCreateProductionRequest}>
                    {isCreatingRequest ? t("inv.production.creating") : t("inv.production.createRequest")}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-[#020715]/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-white">{t("inv.production.requests")}</p>
              {selectedProductionRequests.size > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="gap-1"
                  onClick={() => {
                    onDeleteSelectedProductionRequests(Array.from(selectedProductionRequests));
                    setSelectedProductionRequests(new Set());
                  }}
                >
                  <Trash2 className="size-3" />
                  {t("inv.production.deleteSelected")}
                </Button>
              )}
            </div>
            <div className="space-y-2 mt-3 max-h-72 overflow-y-auto">
              {safeProductionRequests.length ? (
                safeProductionRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedProductionRequests.has(request.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedProductionRequests);
                            if (e.target.checked) {
                              newSet.add(request.id);
                            } else {
                              newSet.delete(request.id);
                            }
                            setSelectedProductionRequests(newSet);
                          }}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-semibold">{request.title || request.product_id || request.id}</p>
                          <p className="text-[11px] text-slate-500">
                            {t("inv.production.requestedBy")}:{" "}
                            {workerNameById.get(request.requested_by ?? "") ?? request.requested_by ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">
                          {request.target_quantity ?? request.quantity ?? 0} {t("inv.production.qtySuffix")} ·{" "}
                          {request.status ?? t("inv.production.statusPending")}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => onDeleteProductionRequest(request.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">{t("inv.production.noRequests")}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#020715]/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-white">{t("inv.production.logisticsQueue")}</p>
              {selectedLogisticsQueueItems.size > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="gap-1"
                  onClick={() => {
                    onDeleteSelectedLogisticsQueueItems(Array.from(selectedLogisticsQueueItems));
                    setSelectedLogisticsQueueItems(new Set());
                  }}
                >
                  <Trash2 className="size-3" />
                  {t("inv.production.deleteSelected")}
                </Button>
              )}
            </div>
            <div className="space-y-2 mt-3 max-h-72 overflow-y-auto">
              {safeLogisticsQueue.length ? (
                safeLogisticsQueue.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedLogisticsQueueItems.has(item.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedLogisticsQueueItems);
                            if (e.target.checked) {
                              newSet.add(item.id);
                            } else {
                              newSet.delete(item.id);
                            }
                            setSelectedLogisticsQueueItems(newSet);
                          }}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-semibold">{item.title || item.product_id || item.id}</p>
                          <p className="text-[11px] text-slate-500">
                            {t("inv.production.assigned")}: {workerNameById.get(item.assigned_to ?? "") ?? item.assigned_to ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={isAssigningLogistics || !selectedLogisticsAssignee}
                          onClick={() => onAssignLogisticsQueueItem(item.id)}
                        >
                          {t("inv.production.assign")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => onDeleteLogisticsQueueItem(item.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">{t("inv.production.noLogistics")}</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#020715]/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquare className="size-5 text-cyan-300" />
            <p className="font-semibold text-white">{t("inv.msg.title")}</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">{t("inv.msg.to")}</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-[#0c1222] px-2 text-sm text-white"
                  value={messageTo}
                  onChange={(e) => onMessageToChange(e.target.value)}
                  disabled={!effectiveSender || safeMessageRecipients.length === 0}
                >
                  {safeMessageRecipients.length === 0 && <option value="">{t("inv.msg.noRecipients")}</option>}
                  {safeMessageRecipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.full_name} · {recipient.department ?? t("inv.msg.teamFallback")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-slate-300">{t("inv.msg.body")}</Label>
                <textarea
                  className="mt-1 min-h-24 w-full rounded-md border border-slate-700 bg-[#0c1222] px-3 py-2 text-sm text-white"
                  value={messageBody}
                  onChange={(e) => onMessageBodyChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-slate-300">
                  <Paperclip className="size-4" />
                  {t("inv.msg.file")}
                </Label>
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv,image/*"
                  className="text-xs text-slate-400 file:mr-2 file:rounded-lg file:border file:border-white/20 file:bg-white/10 file:px-2 file:py-1"
                  onChange={(e) => onMessageFileChange(e.target.files?.[0] ?? null)}
                />
                {messageFile && <p className="text-xs text-amber-300">{messageFile.name}</p>}
              </div>
              <Button
                type="button"
                className="gap-2 bg-cyan-600"
                disabled={isSendingMessage || !effectiveSender || !messageTo || (!messageBody.trim() && !messageFile)}
                onClick={onSendInventoryMessage}
              >
                <Send className="size-4" />
                {isSendingMessage ? t("common.processing") : t("inv.msg.send")}
              </Button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {safeMessages.length ? (
                safeMessages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-cyan-200">
                        {message.from_name} → {message.to_name}
                      </p>
                      <span className="text-[10px] text-slate-500">{message.created_at}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
                    {message.attachment_original_name && message.attachment_stored_path && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="mt-2 gap-1"
                        onClick={() => onOpenInventoryMessageAttachment(message)}
                      >
                        <FileText className="size-3" />
                        {message.attachment_original_name}
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">{t("inv.msg.empty")}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
