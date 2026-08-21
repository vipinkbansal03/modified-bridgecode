"use client";

import { useState } from "react";
import { Search, Trash2, Eye, X, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useToast } from "@/components/admin/AdminComponents";
import { useNotificationLogs, useDeleteNotificationLog, useBulkDeleteNotificationLogs } from "@/hooks/api";

const CHANNELS = [
  { value: "all", label: "All Channels" },
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "push", label: "Push Notification" },
];

const STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "QUEUED", label: "Queued" },
  { value: "PROCESSING", label: "Processing" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
];

export default function AdminNotificationsPage() {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const { showToast, ToastComponent } = useToast();

  const { data, isLoading } = useNotificationLogs({
    page,
    limit,
    search,
    status,
    channel,
  });

  const deleteMutation = useDeleteNotificationLog();
  const bulkDeleteMutation = useBulkDeleteNotificationLogs();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewModal, setViewModal] = useState<any | null>(null);

  const logs = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(logs.map((h: any) => h.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm("Are you sure you want to delete the selected logs?")) return;
    
    try {
      await bulkDeleteMutation.mutateAsync(selectedIds);
      setSelectedIds([]);
      showToast(`${selectedIds.length} notification log(s) deleted successfully.`, "success");
    } catch (err) {
      showToast("Failed to delete selected notifications.", "error");
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification log?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      showToast("Notification log deleted successfully.", "success");
    } catch (err) {
      showToast("Failed to delete notification log.", "error");
    }
  };

  const getChannelBadge = (ch: string) => {
    const base = "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border tracking-wider uppercase";
    switch (ch) {
      case "email":
        return `${base} border-[#CDEBE3] bg-[#EAF5EC] text-[#1D7A32]`;
      case "whatsapp":
        return `${base} border-[#CDEBE3] bg-[#EAF5EC] text-[#1D7A32]`;
      case "sms":
        return `${base} border-[#E6E6E6] bg-[#FAFAFA] text-[#6B6B6B]`;
      case "push":
        return `${base} border-blue-200 bg-blue-50 text-blue-700`;
      case "in_app":
        return `${base} border-purple-200 bg-purple-50 text-purple-700`;
      default:
        return `${base} border-[#E6E6E6] bg-[#FAFAFA] text-[#6B6B6B]`;
    }
  };

  const getStatusBadge = (stat: string) => {
    const base = "inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border tracking-wider uppercase";
    switch (stat) {
      case "SENT":
        return `${base} border-[#CDEBE3] bg-[#EAF5EC] text-[#1D7A32]`;
      case "FAILED":
        return `${base} border-[#FBD6D6] bg-[#FEEFEF] text-[#D32F2F]`;
      case "PROCESSING":
        return `${base} border-blue-200 bg-blue-50 text-blue-700`;
      case "QUEUED":
        return `${base} border-yellow-200 bg-yellow-50 text-yellow-700`;
      default:
        return `${base} border-[#E6E6E6] bg-[#FAFAFA] text-[#6B6B6B]`;
    }
  };

  return (
    <AdminLayout title="Notifications" breadcrumb={[{ label: "Notifications" }]}>
      {ToastComponent}
      <div className="bg-white min-h-[calc(100vh-64px)] rounded-tl-lg overflow-hidden flex flex-col p-6 bg-[#FDFDFD]">
        
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-medium text-[#1A1A1A]">Delivery Logs</h1>
            <p className="text-[13px] text-[#6B6B6B] mt-1">Review notification delivery logs, statuses, and recipient history.</p>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A]" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by recipient..." 
                className="w-full pl-9 pr-4 py-2 text-[12px] border border-[#E6E6E6] rounded focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>

            <select
              value={channel}
              onChange={(e) => { setChannel(e.target.value); setPage(1); }}
              className="py-2 px-3 text-[12px] border border-[#E6E6E6] rounded bg-white focus:outline-none"
            >
              {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>

            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="py-2 px-3 text-[12px] border border-[#E6E6E6] rounded bg-white focus:outline-none"
            >
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold tracking-wider text-[#6B6B6B] hover:text-[#1A1A1A] disabled:opacity-50 disabled:cursor-not-allowed uppercase border border-transparent hover:border-[#E6E6E6] rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              DELETE SELECTED
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="border border-[#E6E6E6] bg-white rounded overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#E6E6E6]">
                  <th className="px-4 py-3 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-[#cccccc] text-[#1A1A1A] focus:ring-0"
                      checked={logs.length > 0 && selectedIds.length === logs.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Channel</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Recipient</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Message</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Provider</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Sent At</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Created At</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E6]">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-[#9A9A9A]">Loading logs...</td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-[#9A9A9A]">No logs found.</td>
                  </tr>
                ) : (
                  logs.map((h: any) => (
                    <tr key={h.id} className="hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-[#cccccc] text-[#1A1A1A] focus:ring-0"
                          checked={selectedIds.includes(h.id)}
                          onChange={() => toggleSelect(h.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={getChannelBadge(h.channel)}>{h.channel}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[12px] font-medium text-[#1A1A1A]">{h.to}</div>
                        <div className="text-[10px] text-[#9A9A9A] mt-0.5">{h.type}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[12px] text-[#6B6B6B] truncate max-w-[200px]" title={h.message}>
                          {h.subject ? `[${h.subject}] ` : ""}{h.message}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadge(h.status)}>{h.status}</span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[#6B6B6B]">{h.provider || "—"}</td>
                      <td className="px-4 py-3 text-[11px] text-[#6B6B6B]">
                        {h.sentAt ? new Date(h.sentAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#6B6B6B]">
                        {new Date(h.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setViewModal(h)}
                            className="p-1.5 text-[#9A9A9A] hover:text-[#1A1A1A] hover:bg-[#E6E6E6] rounded transition-colors border border-[#E6E6E6]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSingle(h.id)}
                            className="p-1.5 text-[#9A9A9A] hover:text-[#D32F2F] hover:bg-[#FEEFEF] rounded transition-colors border border-[#E6E6E6] hover:border-[#FBD6D6]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar */}
          <div className="border-t border-[#E6E6E6] px-4 py-3 flex items-center justify-between bg-[#FAFAFA] text-[12px] text-[#6B6B6B]">
            <div>
              Showing {logs.length > 0 ? (page - 1) * limit + 1 : 0}-{Math.min(page * limit, total)} of {total} records
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 border border-[#E6E6E6] rounded bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#FAFAFA]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-medium text-[#1A1A1A]">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 border border-[#E6E6E6] rounded bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#FAFAFA]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Detail Modal */}
      {viewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E6E6]">
              <h2 className="text-[16px] font-serif text-[#1A1A1A]">Notification Log Details</h2>
              <button onClick={() => setViewModal(null)} className="p-1.5 text-[#9A9A9A] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] rounded transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="border border-[#E6E6E6] rounded">
                <DetailRow label="CHANNEL" value={viewModal.channel} />
                <DetailRow label="RECIPIENT" value={viewModal.to} />
                <DetailRow label="SUBJECT" value={viewModal.subject || "—"} />
                <DetailRow label="MESSAGE" value={viewModal.message} />
                <DetailRow label="STATUS" value={viewModal.status} />
                <DetailRow label="PROVIDER" value={viewModal.provider || "—"} />
                <DetailRow label="PROVIDER REFERENCE ID" value={viewModal.providerReferenceId || "—"} />
                <DetailRow label="JOB ID" value={viewModal.jobId || "—"} />
                <DetailRow label="ERROR MESSAGE" value={viewModal.errorMessage || "—"} />
                <DetailRow label="CREATED AT" value={new Date(viewModal.createdAt).toLocaleString()} />
                <DetailRow label="SENT AT" value={viewModal.sentAt ? new Date(viewModal.sentAt).toLocaleString() : "—"} />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[#E6E6E6] flex justify-end">
              <button 
                onClick={() => setViewModal(null)}
                className="px-6 py-2 text-[11px] font-bold tracking-wider text-[#6B6B6B] uppercase border border-[#E6E6E6] hover:bg-[#FAFAFA] rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function DetailRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex border-b border-[#E6E6E6] last:border-b-0">
      <div className="w-48 py-3 px-4 bg-[#FAFAFA] text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider border-r border-[#E6E6E6] flex-shrink-0">
        {label}
      </div>
      <div className="flex-1 py-3 px-4 text-[13px] text-[#1A1A1A] whitespace-pre-wrap break-all">
        {value}
      </div>
    </div>
  );
}
