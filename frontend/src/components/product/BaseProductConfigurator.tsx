"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ShoppingBag } from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
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
  const { addItem } = useCart();
  const { currentCustomer } = useCustomerAuth();

  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // For a base product, we use the first price from apiProduct.prices (which should be for the current region)
  const basePrice = apiProduct.prices?.[0];

  const getTierDiscountPercent = (tp: any) => {
    if (tp.discountPercent != null) return tp.discountPercent;
    if (tp.fixedPrice != null && basePrice?.mrp) {
      return Math.round(((basePrice.mrp - tp.fixedPrice) / basePrice.mrp) * 100);
    }
    return 0;
  };

  const getMoqDiscountPercent = (mp: any) => {
    if (mp.discountPercent != null) return mp.discountPercent;
    if (mp.fixedPrice != null && basePrice?.mrp) {
      return Math.round(((basePrice.mrp - mp.fixedPrice) / basePrice.mrp) * 100);
    }
    return 0;
  };

  const customerTierId = currentCustomer?.tierId;
  const currentTierPricing = apiProduct.tierPricing?.find(
    (tp) => tp.tier.id === customerTierId
  );
  const currentTierDiscount = currentTierPricing ? getTierDiscountPercent(currentTierPricing) : 0;

  const visibleTierPricing = (apiProduct.tierPricing || []).filter(
    (tp) => getTierDiscountPercent(tp) > currentTierDiscount
  );

  const visibleMoqPricing = (apiProduct.moqPricing || []).filter(
    (mp) => getMoqDiscountPercent(mp) > currentTierDiscount
  );
  
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

      {((visibleMoqPricing && visibleMoqPricing.length > 0) || 
        (visibleTierPricing && visibleTierPricing.length > 0)) && (
        <div className="rounded-lg border border-line bg-offwhite p-4">
          <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-steel-2">Available Discounts</h4>
          <div className="space-y-3">
            {visibleTierPricing && visibleTierPricing.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-steel block">Tier Pricing</span>
                <div className="grid grid-cols-1 gap-1 text-[12.5px]">
                  {visibleTierPricing.map((tp) => (
                    <div key={tp.id} className="flex justify-between border-b border-line/50 pb-1">
                      <span className="text-steel">{tp.tier.name}</span>
                      <strong className="text-[#15803D]">
                        {tp.discountPercent ? `${tp.discountPercent}% off` : formatMoney(basePrice.currencySymbol, tp.fixedPrice || 0)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {visibleMoqPricing && visibleMoqPricing.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-steel block">Volume MOQ Pricing</span>
                <div className="space-y-1 text-[12.5px]">
                  {visibleMoqPricing.map((mp) => (
                    <div key={mp.id} className="flex justify-between border-b border-line/50 pb-1">
                      <span className="text-steel">
                        {mp.maxQuantity ? `${mp.minQuantity} - ${mp.maxQuantity} units` : `${mp.minQuantity}+ units`}
                      </span>
                      <strong className="text-[#15803D]">
                        {mp.discountPercent ? `${mp.discountPercent}% off` : formatMoney(basePrice.currencySymbol, mp.fixedPrice || 0)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
