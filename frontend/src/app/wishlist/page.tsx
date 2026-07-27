"use client";

import Link from "next/link";
import Image from "next/image";
import { Heart, ImageOff, ShoppingBag, Trash2, ArrowRight, UserCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useRemoveWishlist, useWishlist } from "@/hooks/api/useWishlist";
import { useToast } from "@/components/ui/ToastProvider";

export default function WishlistPage() {
  const { currentCustomer, isLoading: authLoading } = useCustomerAuth();
  const { data: wishlist = [], isLoading: wishlistLoading } = useWishlist();
  const removeWishlist = useRemoveWishlist();
  const { showToast } = useToast();

  const handleRemove = (productId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeWishlist.mutate(productId, {
      onSuccess: () => {
        showToast("Item removed from wishlist.");
      },
      onError: () => {
        showToast("Failed to remove item.", "error");
      },
    });
  };

  const isLoading = authLoading || (Boolean(currentCustomer) && wishlistLoading);

  return (
    <div className="py-8 sm:py-12 bg-[#FAFAFA] min-h-[70vh]">
      <Container>
        {/* Breadcrumbs */}
        <nav className="mb-6 text-[13px] text-steel">
          <Link href="/" className="hover:text-brand transition-colors">
            Home
          </Link>{" "}
          / <span className="font-medium text-ink">My Wishlist</span>
        </nav>

        {/* Title Section */}
        <div className="mb-8 flex items-center justify-between border-b border-line pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              My Wishlist
            </h1>
            <p className="mt-1 text-sm text-steel">
              Keep track of products you want to purchase later.
            </p>
          </div>
          {currentCustomer && !isLoading && wishlist.length > 0 && (
            <span className="rounded-full bg-grey px-3 py-1 text-xs font-semibold text-ink">
              {wishlist.length} {wishlist.length === 1 ? "Item" : "Items"}
            </span>
          )}
        </div>

        {/* Loading Skeleton State */}
        {isLoading && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-48 w-full rounded-md" />
                <Skeleton className="mt-4 h-4 w-1/3" />
                <Skeleton className="mt-2 h-5 w-3/4" />
                <Skeleton className="mt-2 h-4 w-1/2" />
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-9 w-full rounded-md" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Unauthenticated State */}
        {!isLoading && !currentCustomer && (
          <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-brand">
              <UserCheck size={32} />
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink">Sign in to view your wishlist</h3>
            <p className="mt-2 text-sm text-steel">
              Log in to your account to save products, sync across devices, and access your saved items anytime.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link href="/login">
                <Button variant="primary" className="w-full">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="secondary" className="w-full">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Empty Wishlist State */}
        {!isLoading && currentCustomer && wishlist.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-brand">
              <Heart size={32} className="fill-brand/10 text-brand" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink">Your wishlist is empty</h3>
            <p className="mt-2 text-sm text-steel">
              Explore our product catalogue and click the heart icon on any product to save it for later.
            </p>
            <div className="mt-6">
              <Link href="/products">
                <Button variant="primary" className="inline-flex items-center gap-2">
                  <span>Explore Products</span>
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Wishlist Items Grid */}
        {!isLoading && currentCustomer && wishlist.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {wishlist.map((item) => {
              const p = item.product;
              return (
                <Card key={item.id} className="group relative flex h-full flex-col overflow-hidden bg-white transition-all hover:shadow-md">
                  {/* Remove Button Overlay */}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(p.id, e)}
                    disabled={removeWishlist.isPending}
                    title="Remove from wishlist"
                    aria-label="Remove from wishlist"
                    className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-steel shadow-sm border border-line/60 transition-all hover:bg-red-50 hover:text-[#E31E24]"
                  >
                    <Trash2 size={15} />
                  </button>

                  {/* Image Link */}
                  <Link href={`/products/${p.slug}`} className="block">
                    <div className="relative h-[200px] w-full bg-offwhite">
                      {p.image ? (
                        <Image
                          src={p.image}
                          alt={p.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-steel-2">
                          <ImageOff size={24} />
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* Content Area */}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    {p.category && (
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-steel-2">
                        {p.category}
                      </span>
                    )}

                    <Link href={`/products/${p.slug}`} className="mt-1 block">
                      <h4 className="text-[15px] font-medium text-ink transition-colors group-hover:text-brand line-clamp-1">
                        {p.title}
                      </h4>
                    </Link>

                    {p.shortDescription && (
                      <p className="mt-1.5 text-xs leading-relaxed text-steel line-clamp-2">
                        {p.shortDescription}
                      </p>
                    )}

                    <div className="mt-auto pt-4">
                      {p.price && (
                        <p className="mb-3 text-base font-bold text-ink">
                          {p.price}
                        </p>
                      )}

                      <Link href={`/products/${p.slug}`} className="block">
                        <Button variant="primary" className="w-full text-xs font-semibold py-2">
                          <ShoppingBag size={14} className="mr-1.5 inline-block" />
                          <span>View Product</span>
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
