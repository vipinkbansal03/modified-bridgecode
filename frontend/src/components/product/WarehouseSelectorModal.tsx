"use client";

import { Modal } from "@/components/ui/Modal";
import type { ProductWarehouse } from "@/hooks/api/useProducts";
import { Check, MapPin, Package, Truck } from "lucide-react";

interface WarehouseSelectorModalProps {
  open: boolean;
  onClose: () => void;
  warehouses: ProductWarehouse[];
  selectedWarehouseId: string | null;
  onSelect: (warehouseId: string) => void;
  isLoading?: boolean;
}

export function WarehouseSelectorModal({
  open,
  onClose,
  warehouses,
  selectedWarehouseId,
  onSelect,
  isLoading,
}: WarehouseSelectorModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Choose Seller / Warehouse">
      <div className="p-5">
        <p className="mb-4 text-[13px] text-[#6B6B6B]">
          Multiple warehouses can deliver this product to your selected location.
          Please choose your preferred seller based on delivery time and availability.
        </p>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
          </div>
        ) : warehouses.length === 0 ? (
          <div className="text-center text-[13px] text-steel py-4">
            No warehouses available for your selected delivery country.
          </div>
        ) : (
          <div className="space-y-3">
            {warehouses.map((w) => {
              const isSelected = w.id === selectedWarehouseId;
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    onSelect(w.id);
                    onClose();
                  }}
                  className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
                    isSelected
                      ? "border-[#E31E24] bg-[#E31E24]/5 ring-1 ring-[#E31E24]"
                      : "border-[#E0E0E0] hover:border-[#B0B0B0]"
                  }`}
                >
                  <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-[#E31E24] bg-[#E31E24]" : "border-[#9A9A9A]"}`}>
                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className={`text-[14px] font-semibold ${isSelected ? "text-[#E31E24]" : "text-[#1A1A1A]"}`}>
                        {w.name}
                      </h4>
                      {w.isLocal && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 tracking-wide uppercase">
                          Local Delivery
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2 text-[12px] text-[#6B6B6B]">
                        <Truck size={14} className="text-steel" />
                        <span>Estimated Delivery: <strong>{w.estimatedDeliveryDays} days</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[#6B6B6B]">
                        <Package size={14} className="text-steel" />
                        <span>Stock Available: <strong>{w.stock} units</strong></span>
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-[#6B6B6B]">
                        <MapPin size={14} className="text-steel" />
                        <span>Ships from: <strong>{w.countryName}</strong></span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
