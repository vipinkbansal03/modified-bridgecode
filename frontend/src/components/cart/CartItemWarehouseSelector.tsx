import { useState } from "react";
import { useProductWarehouses } from "@/hooks/api/useProducts";
import { WarehouseSelectorModal } from "../product/WarehouseSelectorModal";
import type { CartItem } from "@/contexts/CartContext";
import type { QuoteCartItem } from "@/contexts/QuoteCartContext";
import { useDeliveryAddress } from "@/contexts/DeliveryAddressContext";

interface CartItemWarehouseSelectorProps {
  item: CartItem | QuoteCartItem;
  updateWarehouse: (
    variantId: string,
    warehouseId: string | undefined,
    warehouseName: string,
    estimatedDeliveryDays?: number | string,
    isLocalWarehouse?: boolean
  ) => void;
}

export function CartItemWarehouseSelector({ item, updateWarehouse }: CartItemWarehouseSelectorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { selectedAddress } = useDeliveryAddress();

  const { data: warehouses, isLoading } = useProductWarehouses(
    item.productSlug,
    item.variantId,
    selectedAddress?.state
  );

  // Filter warehouses to only show those that have sufficient stock for this item's quantity
  // and prioritize those if multiple exist.
  const eligibleWarehouses = (warehouses || []).filter(w => w.stock >= item.quantity);

  const handleChangeSellerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px] text-steel">Sold by {item.warehouseName || "Default Seller"}</span>
      <span className="text-[12px] text-emerald-600 font-medium flex items-center gap-2">
        <span>Estimated Delivery: {item.estimatedDeliveryDays || "3-5"} days</span>
        
        <button
          type="button"
          onClick={handleChangeSellerClick}
          className="text-[12px] font-medium text-brand hover:underline ml-1"
        >
          Change
        </button>
      </span>

      <WarehouseSelectorModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        warehouses={eligibleWarehouses}
        selectedWarehouseId={item.warehouseId || "default"}
        onSelect={(id) => {
          const wh = eligibleWarehouses.find(w => w.id === id);
          if (wh) {
            updateWarehouse(item.variantId, wh.id === "default" ? undefined : wh.id, wh.name, wh.estimatedDeliveryDays, wh.isLocal);
          } else {
            updateWarehouse(item.variantId, undefined, "Default Seller");
          }
          setIsModalOpen(false);
        }}
        isLoading={isLoading}
      />
    </div>
  );
}
