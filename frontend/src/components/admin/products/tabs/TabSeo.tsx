import React from "react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminComponents";

export interface TabSeoProps {
  form: {
    getFieldProps: (name: any) => any;
    values: any;
    errors: any;
    [key: string]: any;
  };
  product: {
    title?: string;
    slug?: string;
    shortDescription?: string | null;
  };
}

export function TabSeo({ form, product }: TabSeoProps) {
  return (
    <div className="p-6 space-y-4">
      <AdminInput
        label="SEO Title (max 60 chars)"
        maxLength={60}
        {...form.getFieldProps("seoTitle")}
        error={form.errors.seoTitle as string}
      />
      <div className="text-[12px] text-[#9A9A9A]">
        {(form.values.seoTitle || "").length}/60 characters
      </div>
      <AdminTextarea
        label="SEO Description (max 160 chars)"
        rows={3}
        maxLength={160}
        {...form.getFieldProps("seoDescription")}
      />
      <div className="text-[12px] text-[#9A9A9A]">
        {(form.values.seoDescription || "").length}/160 characters
      </div>
      <AdminInput
        label="SEO Keywords"
        placeholder="Comma-separated"
        {...form.getFieldProps("seoKeywords")}
      />
      <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#F8F8F8] p-4">
        <p className="mb-2 text-[11.5px] font-medium uppercase text-[#9A9A9A]">Google Preview</p>
        <p className="cursor-pointer text-[16px] font-medium text-[#1A0DAB] hover:underline">
          {form.values.seoTitle || product.title}
        </p>
        <p className="text-[13px] text-[#006621]">modortho.com › products › {product.slug}</p>
        <p className="mt-1 line-clamp-2 text-[13.5px] text-[#545454]">
          {form.values.seoDescription || product.shortDescription || "No meta description."}
        </p>
      </div>
    </div>
  );
}

export default TabSeo;
