"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { qk, STALE } from "@/lib/queryConfig";
import { apiClient, unwrapPaginated } from "@/lib/apiClient";
import {
  addToWishlist,
  getCustomerWishlist,
  getWishlistCount,
  removeFromWishlist,
  toggleWishlist,
  type WishlistItem,
} from "@/services/customerApi";

export function useWishlist() {
  const { currentCustomer } = useCustomerAuth();
  const isLoggedIn = Boolean(currentCustomer);

  return useQuery<WishlistItem[]>({
    queryKey: isLoggedIn ? qk.wishlist.all : ["guest-wishlist"],
    queryFn: async () => {
      if (isLoggedIn) {
        return getCustomerWishlist();
      }

      // Guest wishlist fallback
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("guest_wishlist") : null;
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (ids.length === 0) return [];

      const res = await apiClient.get("/products", { params: { ids: ids.join(",") } });
      const unwrapped = unwrapPaginated<any>(res);
      const products = unwrapped.data || [];

      return products.map((p: any) => {
        let priceFormatted = "";
        const priceObj = p.prices?.[0] || null;
        if (priceObj && priceObj.sellingPrice != null) {
          const val = Number(priceObj.sellingPrice);
          const symbol = priceObj.currency?.symbol ?? "";
          priceFormatted = `${symbol}${val.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
        }

        return {
          id: `guest-${p.id}`,
          productId: p.id,
          createdAt: new Date().toISOString(),
          product: {
            id: p.id,
            title: p.title,
            slug: p.slug,
            shortDescription: p.shortDescription ?? "",
            category: p.category?.name ?? "",
            categorySlug: p.category?.slug ?? "",
            image: p.thumbnail,
            price: priceFormatted,
            rawPrice: priceObj
              ? {
                  sellingPrice: Number(priceObj.sellingPrice),
                  mrp: priceObj.mrp != null ? Number(priceObj.mrp) : null,
                  currencySymbol: priceObj.currency?.symbol ?? "",
                }
              : null,
          },
        };
      });
    },
    staleTime: STALE.short,
  });
}

export function useWishlistCount() {
  const { currentCustomer } = useCustomerAuth();
  const isLoggedIn = Boolean(currentCustomer);

  return useQuery({
    queryKey: isLoggedIn ? qk.wishlist.count : ["guest-wishlist-count"],
    queryFn: async () => {
      if (isLoggedIn) {
        return getWishlistCount();
      }

      // Guest wishlist count fallback
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("guest_wishlist") : null;
      const ids: string[] = raw ? JSON.parse(raw) : [];
      return { count: ids.length };
    },
    staleTime: STALE.short,
    select: (data) => data.count,
  });
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();
  const { currentCustomer } = useCustomerAuth();
  const isLoggedIn = Boolean(currentCustomer);

  return useMutation({
    mutationFn: async (productId: string) => {
      if (isLoggedIn) {
        return toggleWishlist(productId);
      }

      // Guest wishlist fallback logic
      const raw = window.localStorage.getItem("guest_wishlist");
      let ids: string[] = raw ? JSON.parse(raw) : [];
      const exists = ids.includes(productId);
      if (exists) {
        ids = ids.filter((id) => id !== productId);
      } else {
        ids.push(productId);
      }
      window.localStorage.setItem("guest_wishlist", JSON.stringify(ids));
      return { inWishlist: !exists };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isLoggedIn ? qk.wishlist.all : ["guest-wishlist"] });
      queryClient.invalidateQueries({ queryKey: isLoggedIn ? qk.wishlist.count : ["guest-wishlist-count"] });
    },
  });
}

export function useAddWishlist() {
  const queryClient = useQueryClient();
  const { currentCustomer } = useCustomerAuth();
  const isLoggedIn = Boolean(currentCustomer);

  return useMutation({
    mutationFn: async (productId: string) => {
      if (isLoggedIn) {
        return addToWishlist(productId);
      }

      // Guest wishlist fallback logic
      const raw = window.localStorage.getItem("guest_wishlist");
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(productId)) {
        ids.push(productId);
        window.localStorage.setItem("guest_wishlist", JSON.stringify(ids));
      }
      return { isNew: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isLoggedIn ? qk.wishlist.all : ["guest-wishlist"] });
      queryClient.invalidateQueries({ queryKey: isLoggedIn ? qk.wishlist.count : ["guest-wishlist-count"] });
    },
  });
}

export function useRemoveWishlist() {
  const queryClient = useQueryClient();
  const { currentCustomer } = useCustomerAuth();
  const isLoggedIn = Boolean(currentCustomer);

  return useMutation({
    mutationFn: async (productId: string) => {
      if (isLoggedIn) {
        return removeFromWishlist(productId);
      }

      // Guest wishlist fallback logic
      const raw = window.localStorage.getItem("guest_wishlist");
      let ids: string[] = raw ? JSON.parse(raw) : [];
      ids = ids.filter((id) => id !== productId);
      window.localStorage.setItem("guest_wishlist", JSON.stringify(ids));
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: isLoggedIn ? qk.wishlist.all : ["guest-wishlist"] });
      queryClient.invalidateQueries({ queryKey: isLoggedIn ? qk.wishlist.count : ["guest-wishlist-count"] });
    },
  });
}
