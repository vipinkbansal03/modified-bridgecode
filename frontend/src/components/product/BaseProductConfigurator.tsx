"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ShoppingBag, ShieldCheck, Zap, Lock, CheckCircle2 } from "lucide-react";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { StockBadge } from "./StockBadge";
import { QuantityInput } from "./QuantityInput";
import { WishlistButton } from "./WishlistButton";
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

  const { selectedCurrency } = useCurrencyContext();
  const { t } = useStaticTranslations();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // For a base product, we use the price matching selected currency, or the first available price
  const basePrice =
    apiProduct.prices?.find((p) => p.currencyCode === selectedCurrency) ??
    apiProduct.prices?.[0];

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
        {t("ui.pdp.pricingNotAvailableOnline")}
      </div>
    );
  }

  const totalAvailableStock = apiProduct.warehouseInventories?.length
    ? apiProduct.warehouseInventories.reduce((sum, inv) => sum + inv.available, 0)
    : (apiProduct.inventory?.available ?? 0);
  const isOutOfStock = totalAvailableStock <= 0;

  const handleAddToCart = async (continueShopping = false) => {
    if (isOutOfStock || totalAvailableStock <= 0) return;
    try {
      setIsAdding(true);
      addItem({
        productId: apiProduct.id,
        productSlug: apiProduct.slug,
        productTitle: apiProduct.title,
        variantId: apiProduct.id,
        variantTitle: "Standard",
        image:
          apiProduct.thumbnail?.trim() ||
          (typeof apiProduct.images?.[0] === "string"
            ? apiProduct.images[0]
            : (apiProduct.images?.[0] as any)?.url ?? null),
        sku: apiProduct.productCode || null,
        quantity: quantity,
        unitPrice: Number(basePrice.sellingPrice),
        currencyCode: basePrice.currencyCode,
        currencySymbol: basePrice.currencySymbol,
        countryCode: basePrice.countryCode,
        countryName: basePrice.countryName,
        selectedAttributes: {},
        availableStock: totalAvailableStock,
        isOutOfStock: isOutOfStock,
      });

      showToast({
        title: "Added to Cart",
        message: `${quantity}x ${apiProduct.title} has been added to your cart.`,
        type: "success",
      });

      if (continueShopping) {
        router.push("/products");
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
    <div className="flex flex-col gap-4">
      {/* Top Controls Grid: Availability & Quantity */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-red-50/25 border border-red-100 p-3.5 sm:p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-red-100 text-[#E31E24] shadow-2xs">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#111827]/70">{t("ui.pdp.availabilityStatus")}</span>
            <StockBadge
              available={totalAvailableStock}
              status={totalAvailableStock > 0 ? (apiProduct.inventory?.status ?? "IN_STOCK") : "OUT_OF_STOCK"}
              className="mt-0.5"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#111827]/70">{t("ui.pdp.quantity")}</label>
            <span className="text-[12px] font-semibold text-[#111827]">
              {totalAvailableStock > 0 ? t("ui.pdp.maxUnits", { count: totalAvailableStock }) : t("ui.stock.unavailable")}
            </span>
          </div>
          <QuantityInput 
            value={isOutOfStock ? 0 : quantity}
            onChange={setQuantity}
            min={isOutOfStock ? 0 : 1}
            max={totalAvailableStock > 0 ? totalAvailableStock : 0}
            disabled={isOutOfStock || isAdding}
          />
        </div>
      </div>

      {/* Dynamic Subtotal & Price Summary Row */}
      {basePrice && (
        <div className="flex items-center justify-between rounded-xl bg-[#FAFAFA] border border-[#F3F4F6] px-4 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-semibold text-[#111827]/70">{t("ui.pdp.estimation")}</span>
            <span className="text-[13px] font-bold text-[#111827]">
              {formatMoney(basePrice.currencySymbol, Number(basePrice.sellingPrice))} &times; {quantity}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[12px] font-bold uppercase text-[#111827]/60">{t("ui.pdp.subtotal")}</span>
            <span className="text-[18px] font-extrabold text-[#E31E24]">
              {formatMoney(basePrice.currencySymbol, Number(basePrice.sellingPrice) * quantity)}
            </span>
          </div>
        </div>
      )}

      {/* Available Discounts Box */}
      {((visibleMoqPricing && visibleMoqPricing.length > 0) || 
        (visibleTierPricing && visibleTierPricing.length > 0)) && (
        <div className="rounded-xl border border-[#E31E24] bg-white p-4">
          <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[#111827]">{t("ui.pdp.volumeDiscounts")}</h4>
          <div className="space-y-3">
            {visibleTierPricing && visibleTierPricing.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#111827] block">{t("ui.pdp.tierPricing")}</span>
                <div className="grid grid-cols-1 gap-1 text-[12.5px]">
                  {visibleTierPricing.map((tp) => (
                    <div key={tp.id} className="flex justify-between border-b border-red-100 pb-1">
                      <span className="text-[#111827] font-medium">{tp.tier.name}</span>
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
                <span className="text-[11px] font-bold text-[#111827] block">{t("ui.pdp.moqPricing")}</span>
                <div className="space-y-1 text-[12.5px]">
                  {visibleMoqPricing.map((mp) => (
                    <div key={mp.id} className="flex justify-between border-b border-red-100 pb-1">
                      <span className="text-[#111827] font-medium">
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

      {/* Main Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => handleAddToCart(false)}
          disabled={isOutOfStock || isAdding}
          className="flex flex-1 min-w-[150px] h-12 items-center justify-center gap-2 whitespace-nowrap rounded-pill bg-[#E31E24] px-6 text-[14px] font-bold text-white shadow-xs transition-all hover:bg-[#B5151B] hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          <ShoppingBag size={17} />
          {isOutOfStock ? t("ui.stock.outOfStock") : isAdding ? t("ui.pdp.addingToCart") : t("ui.pdp.addToCart")}
        </button>
        <button
          type="button"
          onClick={() => handleAddToCart(true)}
          disabled={isOutOfStock || isAdding}
          className="flex flex-1 min-w-[155px] h-12 items-center justify-center whitespace-nowrap rounded-pill border border-[#E31E24] bg-white px-5 text-[13.5px] font-bold text-[#111827] shadow-2xs transition-all hover:bg-red-50 hover:text-[#E31E24] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {t("ui.pdp.continueShopping")}
        </button>
        <WishlistButton
          productId={apiProduct.id}
          showText={true}
          className="h-12 px-5 border border-[#E31E24] bg-white text-[#111827] hover:bg-red-50 hover:text-[#E31E24] shadow-2xs text-[13.5px] font-bold cursor-pointer whitespace-nowrap"
          iconSize={18}
        />
      </div>

      {/* Micro Trust Perks Row */}
      <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-[11.5px] text-[#111827]">
        <div className="flex items-center gap-1.5 justify-center font-medium">
          <ShieldCheck size={14} className="text-[#E31E24] shrink-0" />
          <span>{t("ui.pdp.perkMedicalGrade")}</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center font-medium border-x border-slate-100">
          <Zap size={14} className="text-[#E31E24] shrink-0" />
          <span>{t("ui.pdp.perkDirectDispatch")}</span>
        </div>
        <div className="flex items-center gap-1.5 justify-center font-medium">
          <Lock size={14} className="text-[#E31E24] shrink-0" />
          <span>{t("ui.pdp.perkSecureCheckout")}</span>
        </div>
      </div>
    </div>
  );
}
