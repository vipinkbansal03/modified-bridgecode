"use client";

import { useState, useEffect } from "react";
import { adminApi as api } from "@/services/adminApi";
import { Search, ChevronDown, Trash2, Eye, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";

export default function AdminNotificationsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewModal, setViewModal] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get("/notifications/admin/all", { 
        baseURL: api.defaults.baseURL?.replace(/\/admin$/, '') 
      });
      setHistory(data.data || []);
    } catch (err) {
      console.error("Failed to fetch notifications history", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHistory = history.filter(h => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const recipient = h.targetType === 'SPECIFIC_CUSTOMER' && h.customer 
      ? `${h.customer.firstName} ${h.customer.lastName}`.toLowerCase()
      : h.targetType.replace('_', ' ').toLowerCase();
    
    return recipient.includes(q) || 
           h.title.toLowerCase().includes(q) || 
           h.message.toLowerCase().includes(q);
  });

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredHistory.map(h => h.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm("Are you sure you want to delete the selected notifications?")) return;
    
    try {
      await Promise.all(selectedIds.map(id => api.delete(`/notifications/admin/${id}`, {
        baseURL: api.defaults.baseURL?.replace(/\/admin$/, '')
      })));
      setHistory(prev => prev.filter(h => !selectedIds.includes(h.id)));
      setSelectedIds([]);
    } catch (err) {
      console.error("Failed to delete notifications", err);
      alert("Failed to delete some notifications");
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;
    try {
      await api.delete(`/notifications/admin/${id}`, {
        baseURL: api.defaults.baseURL?.replace(/\/admin$/, '')
      });
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
      alert("Failed to delete notification");
    }
  };

  return (
    <AdminLayout title="Notifications" breadcrumb={[{ label: "Notifications" }]}>
      <div className="bg-white min-h-[calc(100vh-64px)] rounded-tl-lg overflow-hidden flex flex-col">


        <div className="p-6 flex-1 bg-[#FDFDFD]">
          <h1 className="text-xl font-medium text-[#1A1A1A] mb-6">Notifications</h1>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9A9A]" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by recipient, subject..." 
                className="w-full pl-9 pr-4 py-2 text-[13px] border border-[#E6E6E6] rounded focus:outline-none focus:border-[#1A1A1A]"
              />
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
          <div className="border border-[#E6E6E6] bg-white rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E6E6E6]">
                    <th className="px-4 py-3 w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-[#cccccc] text-[#1A1A1A] focus:ring-0"
                        checked={filteredHistory.length > 0 && selectedIds.length === filteredHistory.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Channel</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Recipient</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Message</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Provider</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Sent</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-[#9A9A9A]">Loading...</td>
                    </tr>
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-[13px] text-[#9A9A9A]">No notifications found.</td>
                    </tr>
                  ) : (
                    filteredHistory.map((h) => (
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
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border border-[#CDEBE3] bg-[#EAF5EC] text-[#1D7A32] tracking-wider uppercase">
                            PUSH
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[12px] font-medium text-[#1A1A1A]">
                            {h.targetType === 'SPECIFIC_CUSTOMER' && h.customer 
                              ? `${h.customer.firstName} ${h.customer.lastName}` 
                              : h.targetType.replace('_', ' ')}
                          </div>
                          <div className="text-[11px] text-[#9A9A9A] mt-0.5">user</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[12px] text-[#6B6B6B] truncate max-w-[200px]">
                            {h.title} - {h.message}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border border-[#CDEBE3] bg-[#EAF5EC] text-[#1D7A32] tracking-wider uppercase">
                            SENT
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-[#6B6B6B]">fcm</td>
                        <td className="px-4 py-3 text-[11px] text-[#6B6B6B]">
                          {new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(h.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#6B6B6B]">
                          {new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(h.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
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
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {viewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E6E6]">
              <h2 className="text-[18px] font-serif text-[#1A1A1A]">Notification Details</h2>
              <button 
                onClick={() => setViewModal(null)}
                className="p-1.5 text-[#9A9A9A] hover:text-[#1A1A1A] hover:bg-[#F5F5F5] rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="border border-[#E6E6E6] rounded">
                <DetailRow label="CHANNEL" value="push" />
                <DetailRow label="TITLE" value={viewModal.title} />
                <DetailRow label="MESSAGE" value={viewModal.message} />
                <DetailRow label="STATUS" value="SENT" />
                <DetailRow label="PROVIDER" value="fcm" />
                <DetailRow label="PROVIDER REFERENCE ID" value={`ref_${viewModal.id.substring(0, 8)}`} />
                <DetailRow label="JOB ID" value="-" />
                <DetailRow label="ERROR MESSAGE" value="-" />
                <DetailRow label="CREATED AT" value={`${new Date(viewModal.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date(viewModal.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}`} />
                <DetailRow label="SENT AT" value={`${new Date(viewModal.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date(viewModal.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}`} />
                
                <div className="flex border-t border-[#E6E6E6]">
                  <div className="w-48 py-3 px-4 bg-[#FAFAFA] text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider border-r border-[#E6E6E6]">
                    METADATA
                  </div>
                  <div className="flex-1 p-4">
                    <div className="border border-[#E6E6E6] rounded divide-y divide-[#E6E6E6]">
                      <MetaRow label="TARGET_TYPE" value={viewModal.targetType} />
                      <MetaRow label="CUSTOMER_ID" value={viewModal.customerId || '-'} />
                      <MetaRow label="LINK" value={viewModal.link || '-'} />
                    </div>
                  </div>
                </div>
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

function DropdownFilter({ label }: { label: string }) {
  return (
    <button className="flex items-center gap-2 px-3 py-2 text-[12px] text-[#1A1A1A] border border-[#E6E6E6] rounded bg-white hover:bg-[#FAFAFA] transition-colors">
      {label}
      <ChevronDown className="w-3.5 h-3.5 text-[#9A9A9A]" />
    </button>
  );
}

function DetailRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex border-b border-[#E6E6E6] last:border-b-0">
      <div className="w-48 py-3 px-4 bg-[#FAFAFA] text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider border-r border-[#E6E6E6] flex-shrink-0">
        {label}
      </div>
      <div className="flex-1 py-3 px-4 text-[13px] text-[#1A1A1A]">
        {value}
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="px-4 py-2">
      <div className="text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[12px] text-[#1A1A1A]">{value}</div>
    </div>
  );
}
