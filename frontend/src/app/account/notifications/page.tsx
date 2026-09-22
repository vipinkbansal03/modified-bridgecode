"use client";

import { useState, useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { Eye, Bell, Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useRouter } from "next/navigation";
import { useNotifications, useMarkNotificationRead, useDeleteCustomerNotification, useBulkDeleteCustomerNotifications } from "@/hooks/api";

export default function CustomerNotificationsPage() {
  const { data: notificationsData, isLoading } = useNotifications("customer");
  const history = notificationsData || [];
  const markReadMutation = useMarkNotificationRead("customer");
  const deleteMutation = useDeleteCustomerNotification();
  const bulkDeleteMutation = useBulkDeleteCustomerNotifications();
  const { currentCustomer } = useCustomerAuth();
  const router = useRouter();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await markReadMutation.mutateAsync(id);
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;
    try {
      await deleteMutation.mutateAsync(id);
      setSelectedIds(prev => prev.filter(i => i !== id));
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(history.map((n) => n.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedIds.length} selected notification(s)?`)) return;
    try {
      await bulkDeleteMutation.mutateAsync(selectedIds);
      setSelectedIds([]);
    } catch (err) {
      console.error("Failed to delete notifications", err);
    }
  };

  return (
    <div className="bg-[#F8F9FA] min-h-screen py-8 sm:py-12">
      <Container className="space-y-6">
        <div className="space-y-2">
          <div>
            <Link
              href="/account"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#374151] shadow-2xs transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]"
            >
              <ArrowLeft size={14} className="text-[#E31E24]" />
              <span>Back to Account</span>
            </Link>
          </div>
          <nav className="text-[13px] text-steel-2">
            <Link href="/" className="hover:text-brand">Home</Link> /{" "}
            <Link href="/account" className="hover:text-brand">Your Account</Link> /{" "}
            <span className="font-semibold text-[#111827]">Notifications & Alerts</span>
          </nav>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E7EB] pb-5">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-[#111827] flex items-center gap-2">
              <Bell className="w-6 h-6 text-[#E31E24]" />
              Notifications & Alerts
            </h1>
            <p className="mt-1 text-[14px] text-[#6B7280]">
              Stay informed about order progress, shipment updates, quote status, and account activity.
            </p>
          </div>
          {selectedIds.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#E31E24] hover:bg-[#B5151B] text-white text-[12.5px] font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({selectedIds.length})
            </button>
          )}
        </div>

        <div className="flex-1 bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-2xs">

            <div className="border border-[#E6E6E6] bg-white rounded overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#FAFAFA] border-b border-[#E6E6E6]">
                      <th className="px-4 py-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={history.length > 0 && selectedIds.length === history.length}
                          onChange={toggleSelectAll}
                          className="rounded border-[#cccccc] text-[#e31e24] focus:ring-0 cursor-pointer animate-none"
                        />
                      </th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Message</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Received</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E6E6]">
                    {!mounted || isLoading ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-[#9A9A9A]">Loading...</td>
                      </tr>
                    ) : history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-[13px] text-[#9A9A9A]">No notifications found.</td>
                      </tr>
                    ) : (
                      history.map((h) => (
                        <tr key={h.id} className={`transition-colors ${h.isRead ? 'hover:bg-[#FAFAFA]' : 'bg-[#fff9f9] hover:bg-[#ffefef]'}`}>
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(h.id)}
                              onChange={() => toggleSelect(h.id)}
                              className="rounded border-[#cccccc] text-[#e31e24] focus:ring-0 cursor-pointer animate-none"
                            />
                          </td>
                          <td className="px-4 py-4">
                            {!h.isRead ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border border-[#FBD6D6] bg-[#FEEFEF] text-[#D32F2F] tracking-wider uppercase">
                                NEW
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border border-line bg-grey text-steel tracking-wider uppercase">
                                READ
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className={`text-[13px] ${h.isRead ? 'font-medium text-ink' : 'font-bold text-ink'}`}>
                              {h.title}
                            </div>
                            <div className="text-[12px] text-steel mt-0.5">
                              {h.message}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-[12px] text-steel">
                            {new Date(h.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(h.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase()}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-4">
                              {h.link ? (
                                <button 
                                  onClick={async () => {
                                    if (!h.isRead) {
                                      await markAsRead(h.id);
                                    }
                                    if (h.link) {
                                      router.push(h.link);
                                    }
                                  }}
                                  className="text-[12px] font-medium text-[#0056b3] hover:underline"
                                >
                                  View Details
                                </button>
                              ) : !h.isRead ? (
                                <button 
                                  onClick={() => {
                                    markAsRead(h.id);
                                  }}
                                  className="text-[12px] font-medium text-steel hover:text-ink hover:underline"
                                >
                                  Mark as read
                                </button>
                              ) : null}
                              <button
                                onClick={() => deleteNotification(h.id)}
                                className="text-steel hover:text-[#e31e24] transition-colors p-1"
                                title="Delete Notification"
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
      </Container>
    </div>
  );
}
