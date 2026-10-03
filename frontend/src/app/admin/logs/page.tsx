"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, Pagination, AdminSelect, AdminInput } from "@/components/admin/AdminComponents";
import { useAdminLogs } from "@/hooks/admin/useAdminHooks";
import { Modal } from "@/components/ui/Modal";
import {
  ExternalLink,
  Copy,
  Check,
  Shield,
  Search,
  Filter,
  Eye,
  Activity,
  Layers,
  ShoppingBag,
  FileText,
  Users,
  Tag,
  Clock,
  Globe,
} from "lucide-react";

interface LogUser {
  id: string;
  name: string;
  email: string;
  role?: { id: string; name: string } | null;
}

interface Log {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  user?: LogUser | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
  createdAt: string;
}

const CATEGORY_TABS = [
  { key: "MAIN", label: "Main Business Logs", icon: Activity },
  { key: "PRODUCTS", label: "Products", icon: Layers },
  { key: "ORDERS", label: "Orders", icon: ShoppingBag },
  { key: "QUOTES", label: "Quotes", icon: FileText },
  { key: "CUSTOMERS", label: "Customers & Users", icon: Users },
  { key: "PRICING", label: "Pricing & Currency", icon: Tag },
  { key: "ALL", label: "All Logs", icon: Filter },
];

function getEntityLink(entityType?: string | null, entityId?: string | null): string | null {
  if (!entityId || !entityType) return null;
  const type = entityType.toUpperCase();
  if (type.includes("PRODUCT")) return `/admin/products?search=${encodeURIComponent(entityId)}`;
  if (type.includes("ORDER") || type.includes("INVOICE") || type.includes("SHIPMENT")) return `/admin/orders/${entityId}`;
  if (type.includes("QUOTE")) return `/admin/quotes/${entityId}`;
  if (type.includes("CUSTOMER")) return `/admin/customers?search=${encodeURIComponent(entityId)}`;
  if (type.includes("USER")) return `/admin/users?search=${encodeURIComponent(entityId)}`;
  if (type.includes("PRICING") || type.includes("PRICE")) return `/admin/pricing`;
  if (type.includes("CURRENCY")) return `/admin/currencies`;
  if (type.includes("DISCOUNT") || type.includes("COUPON")) return `/admin/discounts`;
  if (type.includes("INVENTORY")) return `/admin/inventory?search=${encodeURIComponent(entityId)}`;
  return null;
}

function getActionBadgeStyle(action: string) {
  const act = action.toUpperCase();
  if (act.includes("CREATE") || act.includes("PLACED") || act.includes("RESTORE") || act.includes("APPROVED")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (act.includes("UPDATE") || act.includes("EDIT") || act.includes("SYNC") || act.includes("DELIVER") || act.includes("SHIP")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (act.includes("DELETE") || act.includes("REMOVE") || act.includes("CANCEL") || act.includes("REJECT") || act.includes("ARCHIVE")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (act.includes("LOGIN") || act.includes("AUTH")) {
    return "bg-purple-50 text-purple-700 border-purple-200";
  }
  return "bg-gray-100 text-gray-700 border-gray-200";
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("MAIN");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading } = useAdminLogs({
    page,
    limit: 15,
    category: category === "ALL" ? undefined : category,
    entityType: entityType || undefined,
    search: search.trim() || undefined,
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const columns: Column<Log>[] = [
    {
      key: "action",
      label: "Action",
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className={`font-mono text-[11.5px] px-2.5 py-0.5 rounded-full border font-medium ${getActionBadgeStyle(r.action)}`}>
            {r.action}
          </span>
        </div>
      ),
    },
    {
      key: "entityType",
      label: "Entity",
      width: "120px",
      render: (r) => <span className="text-[13px] font-medium text-[#1A1A1A]">{r.entityType || "—"}</span>,
    },
    {
      key: "entityId",
      label: "Entity ID",
      render: (r) => {
        if (!r.entityId) return <span className="text-[#9A9A9A] text-[12px]">—</span>;
        const link = getEntityLink(r.entityType, r.entityId);
        const truncated = r.entityId.length > 14 ? `${r.entityId.slice(0, 8)}...${r.entityId.slice(-4)}` : r.entityId;

        return (
          <div className="flex items-center gap-1.5 group">
            {link ? (
              <Link
                href={link}
                className="inline-flex items-center gap-1 font-mono text-[12px] font-medium text-[#E31E24] hover:underline bg-[#FFF1F2] px-2 py-0.5 rounded border border-[#FECDD3]"
                title={`View ${r.entityType || "Entity"}: ${r.entityId}`}
              >
                <span>{truncated}</span>
                <ExternalLink size={11} />
              </Link>
            ) : (
              <span className="font-mono text-[12px] text-[#555] bg-[#F5F5F5] px-2 py-0.5 rounded border border-[#E5E5E5]" title={r.entityId}>
                {truncated}
              </span>
            )}
            <button
              onClick={() => handleCopy(r.entityId!, r.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[#EAEAEA] rounded text-[#777]"
              title="Copy full ID"
            >
              {copiedId === r.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
            </button>
          </div>
        );
      },
    },
    {
      key: "user",
      label: "Actor",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-[13px] text-[#1A1A1A] truncate">{r.user?.name || "System"}</div>
          {r.user?.email && <div className="text-[11px] text-[#9A9A9A] truncate">{r.user.email}</div>}
        </div>
      ),
    },
    {
      key: "ipAddress",
      label: "IP Address",
      width: "140px",
      render: (r) => {
        const ip = r.ipAddress || "127.0.0.1";
        return (
          <div className="flex items-center gap-1.5 text-[12px] font-mono text-[#555]">
            <Globe size={12} className="text-[#9A9A9A]" />
            <span>{ip}</span>
          </div>
        );
      },
    },
    {
      key: "createdAt",
      label: "Date & Time",
      width: "170px",
      render: (r) => (
        <div className="text-[12px] text-[#555]">
          <div className="font-medium text-[#1A1A1A]">{new Date(r.createdAt).toLocaleDateString()}</div>
          <div className="text-[11px] text-[#9A9A9A]">{new Date(r.createdAt).toLocaleTimeString()}</div>
        </div>
      ),
    },
    {
      key: "details",
      label: "",
      width: "70px",
      render: (r) => (
        <button
          onClick={() => setSelectedLog(r)}
          className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A] transition-colors"
          title="View full details"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  return (
    <AdminLayout title="Activity Logs" breadcrumb={[{ label: "Logs" }]}>
      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-[#E5E5E5] pb-2 mb-4 scrollbar-none">
        {CATEGORY_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = category === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setCategory(tab.key);
                setEntityType("");
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap ${
                isActive ? "bg-[#111111] text-white" : "text-[#666666] hover:bg-[#F2F2F2] hover:text-[#1A1A1A]"
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-[280px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
          <AdminInput
            placeholder="Search action, entity, user, IP…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-[13px]"
          />
        </div>

        {category === "ALL" && (
          <div className="w-[180px]">
            <AdminSelect
              options={[
                { value: "", label: "All Entity Types" },
                { value: "Product", label: "Product" },
                { value: "Order", label: "Order" },
                { value: "Quote", label: "Quote" },
                { value: "Customer", label: "Customer" },
                { value: "User", label: "User" },
                { value: "Pricing", label: "Pricing" },
                { value: "Currency", label: "Currency" },
                { value: "Discount", label: "Discount" },
                { value: "Inventory", label: "Inventory" },
              ]}
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="h-9 text-[13px]"
            />
          </div>
        )}
      </div>

      {/* Logs Table */}
      <DataTable<Log>
        columns={columns}
        data={data?.data || []}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No activity logs found for the selected filter."
      />

      <div className="mt-4">
        <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Modal
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="Activity Log Details"
        >
          <div className="space-y-4 text-[13px]">
            <div className="grid grid-cols-2 gap-3 bg-[#F9FAFB] p-3 rounded-md border border-[#E5E7EB]">
              <div>
                <span className="text-[11px] text-[#6B7280] uppercase tracking-wider block font-medium">Action</span>
                <span className={`inline-block mt-1 font-mono text-[12px] px-2.5 py-0.5 rounded-full border font-medium ${getActionBadgeStyle(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[#6B7280] uppercase tracking-wider block font-medium">Entity Type</span>
                <span className="font-semibold text-[#111827] block mt-1">{selectedLog.entityType || "—"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[11px] text-[#6B7280] uppercase tracking-wider block font-medium">Entity ID</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[12px] text-[#111827] bg-white px-2 py-1 rounded border border-[#E5E7EB] break-all">
                    {selectedLog.entityId || "—"}
                  </span>
                  {selectedLog.entityId && (
                    <button
                      onClick={() => handleCopy(selectedLog.entityId!, "modal-entity")}
                      className="p-1 hover:bg-[#EAEAEA] rounded text-[#777]"
                      title="Copy ID"
                    >
                      {copiedId === "modal-entity" ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                  {getEntityLink(selectedLog.entityType, selectedLog.entityId) && (
                    <Link
                      href={getEntityLink(selectedLog.entityType, selectedLog.entityId)!}
                      className="inline-flex items-center gap-1 text-[12px] text-[#E31E24] hover:underline font-medium ml-1"
                    >
                      Open Entity <ExternalLink size={12} />
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-[#F9FAFB] p-3 rounded-md border border-[#E5E7EB]">
              <div>
                <span className="text-[11px] text-[#6B7280] uppercase tracking-wider block font-medium">Actor</span>
                <span className="font-medium text-[#111827] block mt-0.5">{selectedLog.user?.name || "System"}</span>
                {selectedLog.user?.email && <span className="text-[11.5px] text-[#6B7280]">{selectedLog.user.email}</span>}
              </div>
              <div>
                <span className="text-[11px] text-[#6B7280] uppercase tracking-wider block font-medium">IP Address</span>
                <span className="font-mono text-[12.5px] text-[#111827] block mt-0.5">{selectedLog.ipAddress || "127.0.0.1"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[11px] text-[#6B7280] uppercase tracking-wider block font-medium">Timestamp</span>
                <span className="text-[#111827] block mt-0.5">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </span>
              </div>
              {selectedLog.userAgent && (
                <div className="col-span-2">
                  <span className="text-[11px] text-[#6B7280] uppercase tracking-wider block font-medium">User Agent</span>
                  <span className="font-mono text-[11px] text-[#6B7280] block mt-0.5 break-all">
                    {selectedLog.userAgent}
                  </span>
                </div>
              )}
            </div>

            {Boolean(selectedLog.metadata) && (
              <div>
                <span className="text-[11px] text-[#6B7280] uppercase tracking-wider block font-medium mb-1">Metadata</span>
                <pre className="bg-[#111827] text-emerald-400 p-3 rounded-md text-[11.5px] font-mono overflow-x-auto max-h-[220px]">
                  {String(JSON.stringify(selectedLog.metadata, null, 2))}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
