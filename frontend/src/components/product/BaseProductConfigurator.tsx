"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ShoppingBag } from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { StockBadge } from "./StockBadge";
import { QuantityInput } from "./QuantityInput";
import type { ApiProductDetail } from "@/types/api.types";

interface BaseProductConfiguratorProps {
  apiProduct: ApiProductDetail;
}

function formatMoney(symbol: string, amount: number) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "";
  const val = Number(amount);
  const hasDecimals = Math.abs(val % 1) > 0.001;
  const formatted = val.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function BaseProductConfigurator({ apiProduct }: BaseProductConfiguratorProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const { currencySymbol } = useCurrencyContext();
  const { addItem } = useCart();

  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // For a base product, we use the first price from apiProduct.prices (which should be for the current region)
  const basePrice = apiProduct.prices?.[0];
  
  if (!basePrice) {
    return (
      <div className="rounded-lg border border-[#FDE8E8] bg-[#FEF2F2] p-4 text-[13.5px] text-[#B91C1C]">
        Pricing for this product is not available online. Please request a quote.
      </div>
    );
  }

  const inventory = apiProduct.inventory;
  const isOutOfStock = inventory?.status === "OUT_OF_STOCK" || inventory?.available === 0;

  const handleAddToCart = async (buyNow = false) => {
    try {
      setIsAdding(true);
      addItem({
        productId: apiProduct.id,
        productSlug: apiProduct.slug,
        productTitle: apiProduct.title,
        variantId: apiProduct.id, // Using product ID as variant ID for base products
        variantTitle: "Base Product",
        sku: apiProduct.productCode,
        quantity,
        unitPrice: basePrice.sellingPrice,
        currencyCode: basePrice.currencyCode,
        currencySymbol: basePrice.currencySymbol,
        countryCode: basePrice.countryCode,
        countryName: basePrice.countryName,
        selectedAttributes: {},
        availableStock: inventory?.available,
        isOutOfStock: isOutOfStock,
      });

      if (buyNow) {
        router.push("/checkout");
      } else {
        showToast({
          title: "Added to Cart",
          message: `${quantity}x ${apiProduct.title} has been added to your cart.`,
          type: "success",
        });
      }
    } catch (err: any) {
      showToast({
        title: "Cart Error",
        message: err.message || "Failed to add item to cart.",
        type: "error",
      });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex-1 space-y-3">
          <label className="text-[12px] font-semibold uppercase tracking-wider text-steel-2">Availability</label>
          {inventory ? (
            <StockBadge available={inventory.available} status={inventory.status} className="mt-1" />
          ) : (
            <div className="text-[13px] text-steel">Checking stock...</div>
          )}
        </div>
        
        <div className="w-full sm:w-auto">
          <label className="mb-2.5 block text-[12px] font-semibold uppercase tracking-wider text-steel-2">Quantity</label>
          <QuantityInput 
            value={quantity}
            onChange={setQuantity}
            min={1}
            max={inventory?.available || 999}
            disabled={isOutOfStock || isAdding}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleAddToCart(false)}
          disabled={isOutOfStock || isAdding}
          className="flex flex-1 items-center justify-center gap-2 rounded-pill bg-[#1a1a1a] px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShoppingBag size={16} />
          {isAdding ? "Adding..." : "Add to Cart"}
        </button>
        <button
          onClick={() => handleAddToCart(true)}
          disabled={isOutOfStock || isAdding}
          className="flex flex-1 items-center justify-center rounded-pill bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}
