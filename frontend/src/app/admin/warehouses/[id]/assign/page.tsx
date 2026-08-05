"use client";

import { useState, useLayoutEffect, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight, PackageOpen, Search, ArrowLeft } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useToast } from "@/components/admin/AdminComponents";
import { useAdminProducts, useAdminProductVariants, useBulkUpdateProducts } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

const ProductRow = ({ warehouseId, p, selectedProductIds, setSelectedProductIds, selectedVariantIds, setSelectedVariantIds, fullVariantProductIds, setFullVariantProductIds, productStockMap, setProductStockMap, variantStockMap, setVariantStockMap }: any) => {
  const [expanded, setExpanded] = useState(false);
  const [variantSearch, setVariantSearch] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const { data: variantsData, isLoading } = useAdminProductVariants(p.id, expanded);
  
  const hasVariants = p.hasVariants || (p._count && p._count.variants > 0);
  const totalProductStock = p.inventories?.reduce((sum: number, inv: any) => sum + inv.stock, 0) || 0;
  const isProductSelected = selectedProductIds.includes(p.id);
  const isAllVariantsSelected = fullVariantProductIds.includes(p.id);

  const warehouseInventory = p.inventories?.find((inv: any) => inv.warehouseId === warehouseId && inv.variantId === null);
  const isAssigned = !!warehouseInventory;
  const warehouseStock = warehouseInventory?.stock || 0;

  // Auto-selection of assigned items has been removed to avoid forcing checkboxes to be checked by default.

  const toggleProduct = (checked: boolean) => {
    if (checked) setSelectedProductIds([...selectedProductIds, p.id]);
    else setSelectedProductIds(selectedProductIds.filter((id: string) => id !== p.id));
  }
  
  const toggleAllVariants = (checked: boolean) => {
    if (checked) {
      setFullVariantProductIds([...fullVariantProductIds, p.id]);
      if (variantsData?.data) {
        const vIds = variantsData.data.map((v: any) => v.id);
        setSelectedVariantIds(selectedVariantIds.filter((id: string) => !vIds.includes(id)));
      }
    } else {
      setFullVariantProductIds(fullVariantProductIds.filter((id: string) => id !== p.id));
    }
  }

  const toggleVariant = (vid: string, checked: boolean) => {
    if (checked) {
      setSelectedVariantIds([...selectedVariantIds, vid]);
    } else {
      setSelectedVariantIds(selectedVariantIds.filter((id: string) => id !== vid));
      if (isAllVariantsSelected) {
        setFullVariantProductIds(fullVariantProductIds.filter((id: string) => id !== p.id));
        if (variantsData?.data) {
          const otherVids = variantsData.data.map((v: any) => v.id).filter((id: string) => id !== vid);
          setSelectedVariantIds([...selectedVariantIds, ...otherVids]);
        }
      }
    }
  }

  return (
    <div className="border-b border-[#F0F0F0] last:border-0">
      <div className="flex items-center gap-3 p-3.5 hover:bg-[#F9F9F9] transition-colors">
         {hasVariants ? (
           <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-[#9A9A9A] hover:text-[#1A1A1A] hover:bg-[#EBEBEB] rounded transition-colors">
             {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
           </button>
         ) : (
           <div className="w-7" />
         )}
         <input 
           type="checkbox" 
           checked={isProductSelected}
           onChange={(e) => toggleProduct(e.target.checked)}
           className="w-4 h-4 rounded border-[#D1D1D1] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
         />
         <div className="flex flex-col flex-1 cursor-pointer" onClick={() => toggleProduct(!isProductSelected)}>
           <span className="font-semibold text-[14px] text-[#222]">{p.title}</span>
           <div className="flex items-center gap-2 mt-0.5">
             <span className="text-[12px] text-[#7A7A7A]">{p.sku || 'No SKU'}</span>
             {!hasVariants && (
               <>
                 <span className="text-[#D1D1D1]">•</span>
                 <span className={`text-[12px] font-medium ${isAssigned && warehouseStock > 0 ? "text-green-600" : "text-[#9A9A9A]"}`}>
                   {isAssigned ? warehouseStock : 0} in stock
                 </span>
               </>
             )}
           </div>
         </div>
         {isProductSelected && (
           <div className="w-24 shrink-0 mr-2">
             <input
               type="number"
               min="0"
               placeholder="Stock"
               value={productStockMap[p.id] ?? ""}
               onChange={(e) => setProductStockMap({ ...productStockMap, [p.id]: e.target.value ? parseInt(e.target.value) : undefined })}
               className="w-full h-8 rounded-md border border-[#D1D1D1] px-2.5 text-[13.5px] outline-none focus:border-[#E31E24] text-right bg-white shadow-sm transition-colors"
               title="Initial stock in this warehouse"
             />
           </div>
         )}
      </div>
      
      {expanded && (
        <div className="px-5 py-4 bg-[#FCFCFC] border-t border-[#F0F0F0]">
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-[300px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={variantSearch}
                onChange={(e) => setVariantSearch(e.target.value)}
                placeholder="Search variants..."
                className="w-full rounded-md border border-[#E6E6E6] bg-white py-1.5 pl-8 pr-3 text-[13px] outline-none focus:border-[#E31E24]"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center shadow-sm rounded-md">
                <input
                  type="number"
                  min="0"
                  placeholder="Bulk stock..."
                  value={bulkStock}
                  onChange={(e) => setBulkStock(e.target.value)}
                  className="w-28 rounded-l-md border border-[#E6E6E6] bg-white py-1.5 px-3 text-[12.5px] outline-none focus:border-[#E31E24] focus:z-10 relative"
                />
                <button 
                  onClick={() => {
                    if (!bulkStock) return;
                    const val = parseInt(bulkStock);
                    if (variantsData?.data) {
                      const newMap = { ...variantStockMap };
                      variantsData.data.forEach((v: any) => {
                         if (isAllVariantsSelected || selectedVariantIds.includes(v.id)) {
                           newMap[v.id] = val;
                         }
                      });
                      setVariantStockMap(newMap);
                      setBulkStock("");
                    }
                  }}
                  className="rounded-r-md border border-[#E6E6E6] border-l-0 bg-[#F9F9F9] hover:bg-[#F0F0F0] py-1.5 px-3 text-[12.5px] font-medium text-[#444] transition-colors relative"
                >
                  Apply
                </button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer group bg-white px-3 py-1.5 rounded-md border border-[#E6E6E6] hover:bg-[#F9F9F9] transition-colors shadow-sm">
                <input 
                  type="checkbox"
                  checked={isAllVariantsSelected}
                  onChange={(e) => toggleAllVariants(e.target.checked)}
                  className="w-4 h-4 rounded border-[#D1D1D1] text-[#E31E24] focus:ring-[#E31E24]"
                />
                <span className="text-[13px] font-medium text-[#444]">Select all variants</span>
              </label>
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-[13px] text-[#888] animate-pulse flex items-center justify-center py-6">Loading variants...</div>
          ) : variantsData?.data?.length === 0 ? (
             <div className="text-[13px] text-[#888] flex items-center justify-center py-6">No variants found.</div>
          ) : (
            <>
            <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9F9F9] border-b border-[#E6E6E6]">
                    <th className="py-2.5 px-4 font-semibold text-[13px] text-[#444] w-[40px]"></th>
                    <th className="py-2.5 px-4 font-semibold text-[13px] text-[#444]">Variant Name</th>
                    <th className="py-2.5 px-4 font-semibold text-[13px] text-[#444] w-[200px]">SKU</th>
                    <th className="py-2.5 px-4 font-semibold text-[13px] text-[#444] w-[140px]">Current Stock</th>
                    <th className="py-2.5 px-4 font-semibold text-[13px] text-[#444] w-[140px] text-right">Assign Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {variantsData?.data?.filter((v: any) => v.title.toLowerCase().includes(variantSearch.toLowerCase()) || v.sku?.toLowerCase().includes(variantSearch.toLowerCase())).map((v: any) => {
                    const isChecked = isAllVariantsSelected || selectedVariantIds.includes(v.id);
                    const totalVariantStock = v.inventories?.reduce((sum: number, inv: any) => sum + inv.stock, 0) || 0;
                    const vWarehouseInventory = v.inventories?.find((inv: any) => inv.warehouseId === warehouseId);
                    const isVAssigned = !!vWarehouseInventory;
                    const vWarehouseStock = vWarehouseInventory?.stock || 0;

                    // Note: We avoid auto-selecting variants in useEffect to prevent spamming state updates, 
                    // but we can show their assigned status in the UI if we wanted to. Actually, let's pre-fill their map value:
                    if (isVAssigned && variantStockMap[v.id] === undefined && !isChecked) {
                       // We'll let the user see it's assigned below
                    }

                    return (
                      <tr key={v.id} className={`hover:bg-[#FCFCFC] transition-colors group ${isVAssigned ? 'bg-[#F4FDF8]' : ''}`}>
                        <td className="py-2 px-4">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              toggleVariant(v.id, e.target.checked);
                            }}
                            className={`w-4 h-4 rounded border-[#D1D1D1] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer`}
                          />
                        </td>
                        <td className="py-2 px-4 flex flex-col">
                          <span className="text-[13px] font-medium text-[#1A1A1A]">
                            {v.title}
                            {isVAssigned && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Assigned</span>}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-[12px] text-[#7A7A7A]">{v.sku || '—'}</span>
                        </td>
                        <td className="py-2 px-4">
                          <span className={`text-[12px] font-medium ${isVAssigned && vWarehouseStock > 0 ? "text-green-600" : "text-[#9A9A9A]"}`}>
                            {isVAssigned ? `${vWarehouseStock} in stock` : "0 in stock"}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-right">
                          {isChecked || isVAssigned ? (
                            <input
                              type="number"
                              min="0"
                              placeholder={isVAssigned ? `${vWarehouseStock}` : "0"}
                              value={variantStockMap[v.id] ?? ""}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                setVariantStockMap((prev: any) => ({
                                  ...prev,
                                  [v.id]: isNaN(val) ? 0 : val
                                }));
                                if (!isChecked) toggleVariant(v.id, true);
                              }}
                              className="w-[80px] text-right px-2 py-1 text-[13px] border border-[#D1D1D1] rounded focus:outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
                            />
                          ) : (
                            <span className="text-[#9A9A9A]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function AssignProductsPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const warehouseId = params.id as string;
  const warehouseName = searchParams.get("name") || "Warehouse";

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("inventory.manage")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const { showToast, ToastComponent } = useToast();
  
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [fullVariantProductIds, setFullVariantProductIds] = useState<string[]>([]);
  const [productStockMap, setProductStockMap] = useState<Record<string, number>>({});
  const [variantStockMap, setVariantStockMap] = useState<Record<string, number>>({});

  const { data: productsData, isLoading: productsLoading } = useAdminProducts({ page: productPage, limit: 15, search: productSearch });
  const bulkUpdateProducts = useBulkUpdateProducts();

  const handleAssignSubmit = async () => {
    if (selectedProductIds.length === 0 && selectedVariantIds.length === 0 && fullVariantProductIds.length === 0) {
      showToast("Please select at least one product or variant", "error");
      return;
    }
    try {
      await bulkUpdateProducts.mutateAsync({
        ids: selectedProductIds,
        action: "assignWarehouse",
        warehouseId,
        variantIds: selectedVariantIds,
        fullVariantProductIds,
        productStock: productStockMap,
        variantStock: variantStockMap,
      });
      showToast("Products assigned successfully", "success");
      router.push("/admin/warehouses");
    } catch (e) {
      showToast(getAdminErrorMessage(e), "error");
    }
  };

  const handleUnassignSubmit = async () => {
    if (selectedProductIds.length === 0 && selectedVariantIds.length === 0 && fullVariantProductIds.length === 0) {
      showToast("Please select at least one product or variant to unassign", "error");
      return;
    }
    if (!window.confirm("Are you sure you want to unassign the selected items from this warehouse?")) return;
    try {
      await bulkUpdateProducts.mutateAsync({
        ids: selectedProductIds,
        action: "unassignWarehouse",
        warehouseId,
        variantIds: selectedVariantIds,
        fullVariantProductIds,
      });
      showToast("Products unassigned successfully", "success");
      router.push("/admin/warehouses");
    } catch (e) {
      showToast(getAdminErrorMessage(e), "error");
    }
  };

  if (!hasPermission("inventory.manage")) return null;

  return (
    <AdminLayout 
      title="Assign Products" 
      breadcrumb={[
        { label: "Commerce" },
        { label: "Warehouses", href: "/admin/warehouses" },
        { label: warehouseName }
      ]}
    >
      <div className="space-y-4 h-full flex flex-col pb-4">
        <Link href="/admin/warehouses" className="inline-flex items-center gap-1.5 text-[13px] text-[#6B6B6B] hover:text-[#1A1A1A] w-fit">
          <ArrowLeft size={14} /> Back to warehouses
        </Link>
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden flex flex-col flex-1 shadow-sm">
          <div className="p-4 border-b border-[#E6E6E6] bg-white flex items-center justify-between">
            <div className="relative w-full max-w-[320px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setProductPage(1);
                }}
                placeholder="Search products by name or SKU..."
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>
            <div className="text-[13.5px] text-[#7A7A7A]">
              Assigning to <strong className="text-[#1A1A1A] font-medium">{warehouseName}</strong>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#D1D1D1] hover:scrollbar-thumb-[#9A9A9A]">
            {productsLoading ? (
               <div className="h-full flex items-center justify-center text-[#888] text-[14px] animate-pulse">Loading products...</div>
             ) : productsData?.data?.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-[#888] text-[14px]">
                 <PackageOpen size={40} className="mb-4 text-[#D1D1D1]" />
                 <p>No products found matching your search.</p>
               </div>
             ) : (
               <div className="flex flex-col">
                 {productsData?.data?.map((p: any) => (
                   <ProductRow 
                     key={p.id} 
                     warehouseId={warehouseId}
                     p={p} 
                     selectedProductIds={selectedProductIds}
                     setSelectedProductIds={setSelectedProductIds}
                     selectedVariantIds={selectedVariantIds}
                     setSelectedVariantIds={setSelectedVariantIds}
                     fullVariantProductIds={fullVariantProductIds}
                     setFullVariantProductIds={setFullVariantProductIds}
                     productStockMap={productStockMap}
                     setProductStockMap={setProductStockMap}
                     variantStockMap={variantStockMap}
                     setVariantStockMap={setVariantStockMap}
                   />
                 ))}
               </div>
             )}
          </div>
          
          <div className="p-4 border-t border-[#E6E6E6] bg-white flex items-center justify-between">
            {productsData?.pagination && productsData.pagination.totalPages > 1 ? (
              <div className="flex items-center gap-4">
                <span className="text-[13.5px] font-medium text-[#777]">
                  Page {productPage} of {productsData.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={productPage === 1} 
                    onClick={() => setProductPage(productPage - 1)}
                    className="px-3 py-1.5 text-[13px] font-medium border border-[#E6E6E6] bg-white rounded-md hover:bg-[#F5F5F5] disabled:opacity-40 transition-colors text-[#555]"
                  >Prev</button>
                  <button 
                    disabled={productPage === productsData.pagination.totalPages} 
                    onClick={() => setProductPage(productPage + 1)}
                    className="px-3 py-1.5 text-[13px] font-medium border border-[#E6E6E6] bg-white rounded-md hover:bg-[#F5F5F5] disabled:opacity-40 transition-colors text-[#555]"
                  >Next</button>
                </div>
              </div>
            ) : (
              <div /> // Spacer
            )}

            <div className="flex items-center gap-4">
              <div className="text-[13px] font-medium text-[#555]">
                <span className="font-semibold text-[#1A1A1A]">{selectedProductIds.length}</span> Products,{" "}
                <span className="font-semibold text-[#1A1A1A]">
                  {fullVariantProductIds.length > 0 ? "All from " + fullVariantProductIds.length + " products + " + selectedVariantIds.length : selectedVariantIds.length}
                </span> Variants selected
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleUnassignSubmit} 
                  disabled={bulkUpdateProducts.isPending || (selectedProductIds.length === 0 && selectedVariantIds.length === 0 && fullVariantProductIds.length === 0)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#E6E6E6] bg-white px-4 text-[13px] font-semibold text-[#555] hover:bg-[#F5F5F5] hover:text-[#E31E24] disabled:opacity-50 transition-colors"
                >
                  Unassign Selected
                </button>
                <button 
                  onClick={handleAssignSubmit} 
                  disabled={bulkUpdateProducts.isPending || (selectedProductIds.length === 0 && selectedVariantIds.length === 0 && fullVariantProductIds.length === 0)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#E31E24] px-5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50 transition-colors"
                >
                  {bulkUpdateProducts.isPending ? "Processing..." : `Assign Selected Items`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
