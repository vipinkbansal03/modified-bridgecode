"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
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
  const [openGroup, setOpenGroup] = useState<string | null>(null);

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

  // Availability and Categories are core storefront filters and are shown unless explicitly disabled in config.
  const showAvailability = filterConfig?.featuredOnly !== undefined ? filterConfig.featuredOnly : true;
  const showCategories = filterConfig?.categoryFilterEnabled !== undefined ? filterConfig.categoryFilterEnabled : true;

  return (
    <div className="w-full">
      <div className="pb-2">
        <h3 className="text-[16px] font-bold text-ink tracking-tight">Filters</h3>
      </div>

      {showCategories && categories.length > 0 && (
        <div className="border-b border-line py-3.5">
          <button
            type="button"
            onClick={() => setOpenGroup(openGroup === "Category" ? null : "Category")}
            className="flex w-full items-center justify-between text-left text-[14px] font-semibold text-ink cursor-pointer"
          >
            <span>Category</span>
            <ChevronDown size={14} className={cn("text-steel transition-transform duration-200", openGroup === "Category" && "rotate-180")} />
          </button>
          {openGroup === "Category" && (
            <div className="mt-3 space-y-2">
              {categories.map((cat) => (
                <label key={cat.id || cat.slug} className="flex cursor-pointer items-center justify-between text-[13.5px] text-steel hover:text-ink">
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-line accent-[#E31E24] cursor-pointer"
                      checked={value.categorySlugs.includes(cat.slug)}
                      onChange={(event) => toggleCategory(cat.slug, event.target.checked)}
                    />
                    <span>{cat.name || cat.title}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {attributeGroups.map((group) => {
        const open = openGroup === group.attributeName;
        return (
          <div key={group.attributeName} className="border-b border-line py-3.5">
            <button
              type="button"
              onClick={() => setOpenGroup(open ? null : group.attributeName)}
              className="flex w-full items-center justify-between text-left text-[14px] font-semibold text-ink cursor-pointer"
            >
              <span>{group.attributeName}</span>
              <ChevronDown size={14} className={cn("text-steel transition-transform duration-200", open && "rotate-180")} />
            </button>
            {open && (
              <div className="mt-3 space-y-2">
                {group.options.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-center justify-between text-[13.5px] text-steel hover:text-ink">
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-line accent-[#E31E24] cursor-pointer"
                        checked={value.attributeValues.includes(option.value)}
                        onChange={(event) => toggleAttributeValue(option.value, event.target.checked)}
                      />
                      <span>{option.value}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {showAvailability && (
        <div className="border-b border-line py-3.5">
          <button
            type="button"
            onClick={() => setOpenGroup(openGroup === "Availability" ? null : "Availability")}
            className="flex w-full items-center justify-between text-left text-[14px] font-semibold text-ink cursor-pointer"
          >
            <span>Availability</span>
            <ChevronDown size={14} className={cn("text-steel transition-transform duration-200", openGroup === "Availability" && "rotate-180")} />
          </button>
          {openGroup === "Availability" && (
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-center justify-between text-[13.5px] text-steel hover:text-ink">
                <span className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-line accent-[#E31E24] cursor-pointer"
                    checked={value.featuredOnly}
                    onChange={(event) => onChange({ ...value, featuredOnly: event.target.checked })}
                  />
                  <span>Featured only</span>
                </span>
              </label>
            </div>
          )}
        </div>
      )}

      {hasActiveFilters && (
        <div className="pt-4">
          <button
            type="button"
            onClick={clearFilters}
            className="text-[13px] font-semibold text-[#E31E24] hover:underline cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

