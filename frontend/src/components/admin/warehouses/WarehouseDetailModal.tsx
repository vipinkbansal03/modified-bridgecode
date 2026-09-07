"use client";

import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/admin/AdminComponents";
import { formatDateTime } from "@/utils/formatDate";
import {
  Warehouse,
  MapPin,
  Building,
  Calendar,
  Package,
  Clock,
  Truck,
  Receipt,
  Layers,
  Globe,
  AlertTriangle,
  History,
} from "lucide-react";

interface WarehouseDetailModalProps {
  open: boolean;
  onClose: () => void;
  warehouse: any | null;
}

export function WarehouseDetailModal({
  open,
  onClose,
  warehouse,
}: WarehouseDetailModalProps) {
  if (!warehouse) return null;

  const dep = warehouse.dependencyCounts || {
    orders: warehouse._count?.orders || 0,
    orderItems: warehouse._count?.orderItems || 0,
    shipments: warehouse._count?.shipments || 0,
    inventories: warehouse._count?.inventories || 0,
    activeStock: 0,
    adjustments: 0,
  };

  const deliveryZones = Array.isArray(warehouse.deliveryZones)
    ? warehouse.deliveryZones
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#E31E24]">
            <Warehouse size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1A1A1A]">
              {warehouse.name}
            </h2>
            <p className="text-xs text-[#7A7A7A]">
              Warehouse Details & History
            </p>
          </div>
        </div>
      }
      size="lg"
    >
      <div className="space-y-6">
        {/* TOP STATUS HEADER BANNER */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#EBEBEB] bg-[#F9F9F9] p-4">
          <div className="flex items-center gap-3">
            <StatusBadge status={warehouse.status} />
            {warehouse.deletedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                <AlertTriangle size={12} /> Archived
              </span>
            )}
          </div>
          <div className="text-xs text-[#7A7A7A]">
            ID: <span className="font-mono text-[#1A1A1A]">{warehouse.id}</span>
          </div>
        </div>

        {/* LOCATION & IDENTIFICATION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-[#EBEBEB] p-4 bg-white">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#7A7A7A]">
              <Building size={14} className="text-[#E31E24]" />
              Physical Address
            </div>
            <div className="text-sm space-y-1 text-[#333]">
              {warehouse.addressLine1 && <div>{warehouse.addressLine1}</div>}
              {warehouse.addressLine2 && <div>{warehouse.addressLine2}</div>}
              <div>
                {[warehouse.city, warehouse.state, warehouse.postalCode]
                  .filter(Boolean)
                  .join(", ")}
              </div>
              <div className="font-medium text-[#1A1A1A] pt-1">
                {warehouse.country?.name || warehouse.countryId}
                {warehouse.country?.code && ` (${warehouse.country.code})`}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#EBEBEB] p-4 bg-white">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#7A7A7A]">
              <Receipt size={14} className="text-[#E31E24]" />
              Tax & Identification
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#7A7A7A]">GSTIN / Tax ID:</span>
                <span className="font-mono font-medium text-[#1A1A1A]">
                  {warehouse.gstin || "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A7A7A]">Origin State:</span>
                <span className="font-medium text-[#1A1A1A]">
                  {warehouse.state || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#7A7A7A]">Fulfillment Eligible:</span>
                <span className="font-medium text-[#1A1A1A]">
                  {warehouse.status === "ACTIVE" && !warehouse.deletedAt
                    ? "Active & Available"
                    : "Excluded (Inactive / Archived)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* OPERATIONAL / HISTORICAL DEPENDENCIES METRICS */}
        <div className="rounded-lg border border-[#EBEBEB] p-4 bg-white">
          <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#7A7A7A]">
            <Layers size={14} className="text-[#E31E24]" />
            Historical & Operational Dependencies
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            <div className="rounded-md border border-[#F0F0F0] bg-[#FAFAFA] p-3 text-center">
              <div className="text-xs text-[#7A7A7A]">Orders</div>
              <div className="text-lg font-bold text-[#1A1A1A] mt-0.5">
                {dep.orders}
              </div>
            </div>
            <div className="rounded-md border border-[#F0F0F0] bg-[#FAFAFA] p-3 text-center">
              <div className="text-xs text-[#7A7A7A]">Order Items</div>
              <div className="text-lg font-bold text-[#1A1A1A] mt-0.5">
                {dep.orderItems}
              </div>
            </div>
            <div className="rounded-md border border-[#F0F0F0] bg-[#FAFAFA] p-3 text-center">
              <div className="text-xs text-[#7A7A7A]">Shipments</div>
              <div className="text-lg font-bold text-[#1A1A1A] mt-0.5">
                {dep.shipments}
              </div>
            </div>
            <div className="rounded-md border border-[#F0F0F0] bg-[#FAFAFA] p-3 text-center">
              <div className="text-xs text-[#7A7A7A]">Inventory Rows</div>
              <div className="text-lg font-bold text-[#1A1A1A] mt-0.5">
                {dep.inventories}
              </div>
            </div>
            <div className="rounded-md border border-[#F0F0F0] bg-[#FAFAFA] p-3 text-center">
              <div className="text-xs text-[#7A7A7A]">Active Stock</div>
              <div
                className={`text-lg font-bold mt-0.5 ${
                  dep.activeStock > 0 ? "text-green-600" : "text-[#1A1A1A]"
                }`}
              >
                {dep.activeStock}
              </div>
            </div>
            <div className="rounded-md border border-[#F0F0F0] bg-[#FAFAFA] p-3 text-center">
              <div className="text-xs text-[#7A7A7A]">Stock Logs</div>
              <div className="text-lg font-bold text-[#1A1A1A] mt-0.5">
                {dep.adjustments}
              </div>
            </div>
          </div>
          {warehouse.permanentDeleteBlockReason && (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
              <span>{warehouse.permanentDeleteBlockReason}</span>
            </div>
          )}
        </div>

        {/* DELIVERY ZONES */}
        {deliveryZones.length > 0 && (
          <div className="rounded-lg border border-[#EBEBEB] p-4 bg-white">
            <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-[#7A7A7A]">
              <Globe size={14} className="text-[#E31E24]" />
              Configured Delivery Zones ({deliveryZones.length})
            </div>
            <div className="space-y-2">
              {deliveryZones.map((zone: any, idx: number) => (
                <div
                  key={idx}
                  className="rounded-md border border-[#F0F0F0] p-2.5 bg-[#FAFAFA] text-xs"
                >
                  <div className="font-medium text-[#1A1A1A] mb-1">
                    Country ID: {zone.countryId}
                  </div>
                  <div className="text-[#666]">
                    Covered States:{" "}
                    {zone.states && zone.states.length > 0 ? (
                      <span className="font-medium text-[#333]">
                        {zone.states.join(", ")}
                      </span>
                    ) : (
                      <span className="italic text-[#888]">All states in country</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TIMESTAMPS */}
        <div className="flex flex-wrap items-center justify-between text-xs text-[#7A7A7A] border-t border-[#EBEBEB] pt-4">
          <div>
            Created:{" "}
            <span className="font-medium text-[#333]">
              {formatDateTime(warehouse.createdAt)}
            </span>
          </div>
          <div>
            Updated:{" "}
            <span className="font-medium text-[#333]">
              {formatDateTime(warehouse.updatedAt)}
            </span>
          </div>
          {warehouse.deletedAt && (
            <div className="text-red-600 font-medium">
              Archived: {formatDateTime(warehouse.deletedAt)}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
