"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useCategories } from "@/hooks/api/useCategories";
import { cn } from "@/utils/cn";


export interface ProductFilterState {
  featuredOnly: boolean;
  categorySlugs: string[];
  attributeValues: string[];
}

export interface AttributeFilterConfig {
  attributeId: string;
  attributeName: string;
  enabled: boolean;
  displayType: "DROPDOWN" | "X_GRID" | "Y_GRID";
  sortOrder: number;
  allowedValueIds: string[];
}

export interface ProductFilterConfig {
  id: string;
  featuredOnly: boolean;
  categoryFilterEnabled: boolean;
  attributeFilters: AttributeFilterConfig[];
}

interface ProductFiltersProps {
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
  availableAttributeValues?: Array<{ attributeName: string; value: string; attributeId?: string; attributeValueId?: string }>;
  filterConfig?: ProductFilterConfig | null;
}

export function ProductFilters({ value, onChange, availableAttributeValues = [], filterConfig }: ProductFiltersProps) {
  const { data: categories = [] } = useCategories();
  const [openGroup, setOpenGroup] = useState<string | null>("Availability");

  // Build attribute groups from available values, but filter by config.
  // When no config is present OR the config has no attribute filters defined,
  // we fall back to showing every available attribute group (previous behaviour).
  const attributeGroups = useMemo(() => {
    const hasConfigFilters = !!filterConfig && filterConfig.attributeFilters.length > 0;

    const groups = new Map<string, { attributeName: string; displayType: string; options: Array<{ value: string; attributeValueId?: string }> }>();

    // Only restrict to enabled config filters when a config with filters exists.
    if (hasConfigFilters) {
      const enabledFilters = filterConfig!.attributeFilters
        .filter((af) => af.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      for (const filter of enabledFilters) {
        groups.set(filter.attributeName, {
          attributeName: filter.attributeName,
          displayType: filter.displayType,
          options: [],
        });
      }
    }

    // Populate options from available attribute values
    for (const row of availableAttributeValues) {
      const attrName = row.attributeName;
      let group = groups.get(attrName);
      if (!group) {
        // No config restriction for this attribute — show it with a default display type
        if (hasConfigFilters) continue;
        group = { attributeName: attrName, displayType: "DROPDOWN", options: [] };
        groups.set(attrName, group);
      }
      const existing = group.options.find((o) => o.value === row.value);
      if (!existing) {
        if (hasConfigFilters) {
          const configFilter = filterConfig?.attributeFilters.find((af) => af.attributeName === attrName);
          if (configFilter && configFilter.allowedValueIds && configFilter.allowedValueIds.length > 0 && row.attributeValueId) {
            if (!configFilter.allowedValueIds.includes(row.attributeValueId)) {
              continue;
            }
          }
        }
        group.options.push({
          value: row.value,
          attributeValueId: row.attributeValueId,
        });
      }
    }

    // Sort options within each group
    for (const group of groups.values()) {
      group.options.sort((a, b) => a.value.localeCompare(b.value));
    }

    return Array.from(groups.values()).filter((group) => group.options.length > 0);
  }, [availableAttributeValues, filterConfig]);

  const toggleCategory = (slug: string, checked: boolean) => {
    const categorySlugs = checked
      ? [...value.categorySlugs, slug]
      : value.categorySlugs.filter((entry) => entry !== slug);
    onChange({ ...value, categorySlugs });
  };

  const toggleAttributeValue = (attributeValue: string, checked: boolean) => {
    const attributeValues = checked
      ? [...value.attributeValues, attributeValue]
      : value.attributeValues.filter((entry) => entry !== attributeValue);
    onChange({ ...value, attributeValues });
  };

  const clearFilters = () => {
    onChange({ featuredOnly: false, categorySlugs: [], attributeValues: [] });
  };

  const hasActiveFilters = value.featuredOnly || value.categorySlugs.length > 0 || value.attributeValues.length > 0;

  // Availability and Categories are core storefront filters and are always shown.
  const showAvailability = true;
  const showCategories = true;

  return (
    <aside>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-steel-2">Filters</p>
        {hasActiveFilters && (
          <button type="button" onClick={clearFilters} className="text-[12px] font-medium text-brand hover:underline">
            Clear
          </button>
        )}
      </div>

      {showAvailability && (
        <div className="border-b border-line">
          <button
            type="button"
            onClick={() => setOpenGroup(openGroup === "Availability" ? null : "Availability")}
            className="flex w-full items-center justify-between py-4.5 text-left text-[15px] font-semibold text-ink"
          >
            Availability
            <ChevronDown size={12} className={cn("text-steel transition-transform duration-200", openGroup === "Availability" && "rotate-180")} />
          </button>
          {openGroup === "Availability" && (
            <div className="pb-3">
              <label className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13.5px] text-steel">
                <input
                  type="checkbox"
                  className="accent-brand"
                  checked={value.featuredOnly}
                  onChange={(event) => onChange({ ...value, featuredOnly: event.target.checked })}
                />
                Featured only
              </label>
            </div>
          )}
        </div>
      )}

      {showCategories && (
        <div className="border-b border-line">
          <button
            type="button"
            onClick={() => setOpenGroup(openGroup === "Categories" ? null : "Categories")}
            className="flex w-full items-center justify-between py-4.5 text-left text-[15px] font-semibold text-ink"
          >
            Categories
            <ChevronDown size={12} className={cn("text-steel transition-transform duration-200", openGroup === "Categories" && "rotate-180")} />
          </button>
          {openGroup === "Categories" && (
            <div className="pb-3">
              {categories.length === 0 ? (
                <p className="py-1.5 text-[13px] text-steel-2">No categories available.</p>
              ) : (
                categories.map((category) => (
                  <label key={category.slug} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13.5px] text-steel">
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={value.categorySlugs.includes(category.slug)}
                      onChange={(event) => toggleCategory(category.slug, event.target.checked)}
                    />
                    <span className="flex-1">{category.name}</span>
                    {typeof category.productCount === "number" && (
                      <span className="text-[11px] text-steel-2">{category.productCount}</span>
                    )}
                  </label>
                ))
              )}
              <Link href="/products" className="mt-2 inline-block text-[12px] font-medium text-brand hover:underline">
                Browse all products
              </Link>
            </div>
          )}
        </div>
      )}

      {attributeGroups.map((group) => {
        const open = openGroup === group.attributeName;
        return (
          <div key={group.attributeName} className="border-b border-line">
            <button
              type="button"
              onClick={() => setOpenGroup(open ? null : group.attributeName)}
              className="flex w-full items-center justify-between py-4.5 text-left text-[15px] font-semibold text-ink"
            >
              {group.attributeName}
              <ChevronDown size={12} className={cn("text-steel transition-transform duration-200", open && "rotate-180")} />
            </button>
            {open && (
              <div className="pb-3">
                {group.options.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13.5px] text-steel">
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={value.attributeValues.includes(option.value)}
                      onChange={(event) => toggleAttributeValue(option.value, event.target.checked)}
                    />
                    {option.value}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}

