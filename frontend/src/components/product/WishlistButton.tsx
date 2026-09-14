"use client";

import { useMemo } from "react";
import { Heart } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useToast } from "@/components/ui/ToastProvider";
import { useToggleWishlist, useWishlist } from "@/hooks/api/useWishlist";
import { cn } from "@/utils/cn";

export interface WishlistButtonProps {
  productId: string;
  className?: string;
  iconSize?: number;
  showText?: boolean;
}

export function WishlistButton({
  productId,
  className,
  iconSize = 18,
  showText = false,
}: WishlistButtonProps) {
  const { currentCustomer } = useCustomerAuth();
  const { showToast } = useToast();
  const { data: wishlist = [] } = useWishlist();
  const toggleWishlist = useToggleWishlist();

  const isInWishlist = useMemo(() => {
    if (!productId || !wishlist.length) return false;
    return wishlist.some(
      (item) => item.productId === productId || item.product?.id === productId
    );
  }, [productId, wishlist]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!productId) return;

    toggleWishlist.mutate(productId, {
      onSuccess: (data) => {
        if (data.inWishlist) {
          showToast("Added to wishlist.");
        } else {
          showToast("Removed from wishlist.");
        }
      },
      onError: () => {
        showToast("Failed to update wishlist.", "error");
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={toggleWishlist.isPending}
      aria-label={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
      title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
      className={cn(
        "flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer",
        showText ? "rounded-pill px-4 py-2.5 gap-2 text-[13px] font-semibold" : "rounded-full p-2",
        isInWishlist
          ? "bg-red-50 text-[#E31E24] border border-red-200"
          : "bg-white/90 text-steel hover:bg-white hover:text-ink shadow-sm border border-line/60",
        className
      )}
    >
      <Heart
        size={iconSize}
        className={cn(
          "transition-colors shrink-0",
          isInWishlist ? "fill-[#E31E24] text-[#E31E24]" : "stroke-[1.75]"
        )}
      />
      {showText && (
        <span className="whitespace-nowrap">
          {isInWishlist ? "Saved to Wishlist" : "Add to Wishlist"}
        </span>
      )}
    </button>
  );
}
