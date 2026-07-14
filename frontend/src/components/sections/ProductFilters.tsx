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

interface ProductFiltersProps {
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
  availableAttributeValues?: Array<{ attributeName: string; value: string }>;
}

export function ProductFilters({ value, onChange, availableAttributeValues = [] }: ProductFiltersProps) {
  const { data: categories = [] } = useCategories();
  const [openGroup, setOpenGroup] = useState<string | null>("Categories");

  const attributeGroups = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const row of availableAttributeValues) {
      const existing = groups.get(row.attributeName) ?? [];
      if (!existing.includes(row.value)) existing.push(row.value);
      groups.set(row.attributeName, existing);
    }
    return Array.from(groups.entries()).map(([attributeName, options]) => ({
      attributeName,
      options: options.sort((a, b) => a.localeCompare(b)),
    }));
  }, [availableAttributeValues]);

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
                  <label key={option} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13.5px] text-steel">
                    <input
                      type="checkbox"
                      className="accent-brand"
                      checked={value.attributeValues.includes(option)}
                      onChange={(event) => toggleAttributeValue(option, event.target.checked)}
                    />
                    {option}
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
