"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { qk, STALE } from "@/lib/queryConfig";
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
    queryKey: qk.wishlist.all,
    queryFn: getCustomerWishlist,
    enabled: isLoggedIn,
    staleTime: STALE.short,
  });
}

export function useWishlistCount() {
  const { currentCustomer } = useCustomerAuth();
  const isLoggedIn = Boolean(currentCustomer);

  return useQuery({
    queryKey: qk.wishlist.count,
    queryFn: getWishlistCount,
    enabled: isLoggedIn,
    staleTime: STALE.short,
    select: (data) => data.count,
  });
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => toggleWishlist(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.wishlist.all });
      queryClient.invalidateQueries({ queryKey: qk.wishlist.count });
    },
  });
}

export function useAddWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => addToWishlist(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.wishlist.all });
      queryClient.invalidateQueries({ queryKey: qk.wishlist.count });
    },
  });
}

export function useRemoveWishlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productId: string) => removeFromWishlist(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.wishlist.all });
      queryClient.invalidateQueries({ queryKey: qk.wishlist.count });
    },
  });
}
