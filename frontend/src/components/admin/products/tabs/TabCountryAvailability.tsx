"use client";

import { useState } from "react";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { useToast } from "@/components/admin/AdminComponents";
import {
  useAdminProductCountries,
  useUpdateProductCountries,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

export type CountryAvailability = {
  id: string;
  name: string;
  code: string;
  status: string;
  enabled: boolean;
  currency?: { symbol?: string | null; code?: string | null; exchangeRate?: number | string | null } | null;
};

export interface TabCountryAvailabilityProps {
  productId: string;
  onRefreshAll?: () => Promise<void>;
  isRefreshingProduct?: boolean;
}

export function TabCountryAvailability({
  productId,
  onRefreshAll,
  isRefreshingProduct = false,
}: TabCountryAvailabilityProps) {
  const { showToast } = useToast();
  const { data: productCountries = [], isLoading: countriesLoading } = useAdminProductCountries(productId);
  const updateProductCountries = useUpdateProductCountries(productId);
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});

  const saveCountryAvailability = async () => {
    try {
      await updateProductCountries.mutateAsync(
        (productCountries as CountryAvailability[]).map((country) => ({
          countryId: country.id,
          enabled: countryOverrides[country.id] ?? country.enabled,
        }))
      );
      setCountryOverrides({});
      showToast("Country availability saved.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save country availability."), "error");
    }
  };

  const activeCountries = (productCountries as CountryAvailability[]).filter((c) => c.status === "ACTIVE");
  const enabledCount = activeCountries.filter(
    (country) => countryOverrides[country.id] ?? country.enabled
  ).length;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Country Availability</h3>
          <p className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-[#6B6B6B]">
            Availability controls where this product is visible. New products start invisible everywhere until countries are enabled here.
            Enabling a country also enables that country on this product&apos;s category and active variants so it can appear on the storefront.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#9A9A9A]">
            {enabledCount} enabled
          </span>
          {onRefreshAll && (
            <RefreshButton onRefresh={onRefreshAll} isRefreshing={isRefreshingProduct} className="shrink-0" />
          )}
          <button
            type="button"
            onClick={saveCountryAvailability}
            disabled={updateProductCountries.isPending || countriesLoading}
            className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50 cursor-pointer"
          >
            {updateProductCountries.isPending ? "Saving..." : "Save Availability"}
          </button>
        </div>
      </div>

      {countriesLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-[#F2F2F2]" />
      ) : (productCountries as CountryAvailability[]).length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
          No countries found.
        </div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {activeCountries.map((country) => (
            <label key={country.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E6E6E6] px-3 py-2 cursor-pointer">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-[#1A1A1A]">{country.name}</span>
                <span className="text-[11.5px] text-[#9A9A9A]">{country.code}{country.status !== "ACTIVE" ? ` · ${country.status}` : ""}</span>
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#E31E24] cursor-pointer"
                checked={countryOverrides[country.id] ?? country.enabled}
                onChange={(e) => setCountryOverrides((current) => ({ ...current, [country.id]: e.target.checked }))}
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default TabCountryAvailability;
