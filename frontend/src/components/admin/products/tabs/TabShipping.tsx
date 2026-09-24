"use client";

import { useEffect, useState } from "react";
import { AdminInput, useToast } from "@/components/admin/AdminComponents";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

export interface TabShippingProps {
  productId: string;
  product: any;
}

export function TabShipping({ productId, product }: TabShippingProps) {
  const { showToast } = useToast();
  const [shippingPackageWeight, setShippingPackageWeight] = useState(
    product?.packageWeight != null ? String(product.packageWeight) : ""
  );
  const [shippingPackageLength, setShippingPackageLength] = useState(
    product?.packageLength != null ? String(product.packageLength) : ""
  );
  const [shippingPackageWidth, setShippingPackageWidth] = useState(
    product?.packageWidth != null ? String(product.packageWidth) : ""
  );
  const [shippingPackageHeight, setShippingPackageHeight] = useState(
    product?.packageHeight != null ? String(product.packageHeight) : ""
  );
  const [shippingClass, setShippingClass] = useState(product?.shippingClass || "");
  const [shippingFragile, setShippingFragile] = useState(product?.fragile || false);
  const [shippingHazardous, setShippingHazardous] = useState(product?.hazardous || false);
  const [savingShipping, setSavingShipping] = useState(false);

  useEffect(() => {
    if (!product) return;
    setShippingPackageWeight(product.packageWeight != null ? String(product.packageWeight) : "");
    setShippingPackageLength(product.packageLength != null ? String(product.packageLength) : "");
    setShippingPackageWidth(product.packageWidth != null ? String(product.packageWidth) : "");
    setShippingPackageHeight(product.packageHeight != null ? String(product.packageHeight) : "");
    setShippingClass(product.shippingClass || "");
    setShippingFragile(product.fragile || false);
    setShippingHazardous(product.hazardous || false);
  }, [product]);

  const handleSaveShipping = async () => {
    setSavingShipping(true);
    try {
      await adminApi.put(`/products/${productId}/shipping-info`, {
        packageWeight: shippingPackageWeight ? Number(shippingPackageWeight) : null,
        packageLength: shippingPackageLength ? Number(shippingPackageLength) : null,
        packageWidth: shippingPackageWidth ? Number(shippingPackageWidth) : null,
        packageHeight: shippingPackageHeight ? Number(shippingPackageHeight) : null,
        shippingClass: shippingClass || null,
        fragile: shippingFragile,
        hazardous: shippingHazardous,
      });
      showToast("Shipping info saved.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save shipping info."), "error");
    } finally {
      setSavingShipping(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="mb-4">
        <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Shipping Information</h3>
        <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">
          Package weight and dimensions used by the shipping calculator.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AdminInput
          label="Package Weight (kg)"
          type="text"
          placeholder="e.g. 0.5"
          value={shippingPackageWeight}
          onChange={(e) => setShippingPackageWeight(e.target.value)}
        />
        <AdminInput
          label="Package Length (cm)"
          type="text"
          placeholder="e.g. 30"
          value={shippingPackageLength}
          onChange={(e) => setShippingPackageLength(e.target.value)}
        />
        <AdminInput
          label="Package Width (cm)"
          type="text"
          placeholder="e.g. 20"
          value={shippingPackageWidth}
          onChange={(e) => setShippingPackageWidth(e.target.value)}
        />
        <AdminInput
          label="Package Height (cm)"
          type="text"
          placeholder="e.g. 10"
          value={shippingPackageHeight}
          onChange={(e) => setShippingPackageHeight(e.target.value)}
        />

        <div className="flex items-end gap-6 pb-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={shippingFragile}
              onChange={(e) => setShippingFragile(e.target.checked)}
              className="rounded accent-[#E31E24]"
            />
            <span className="text-[13.5px] text-[#1A1A1A]">Fragile</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={shippingHazardous}
              onChange={(e) => setShippingHazardous(e.target.checked)}
              className="rounded accent-[#E31E24]"
            />
            <span className="text-[13.5px] text-[#1A1A1A]">Hazardous</span>
          </label>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSaveShipping}
          disabled={savingShipping}
          className="rounded-md bg-[#E31E24] px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60 cursor-pointer"
        >
          {savingShipping ? "Saving…" : "Save Shipping Info"}
        </button>
      </div>
    </div>
  );
}

export default TabShipping;
