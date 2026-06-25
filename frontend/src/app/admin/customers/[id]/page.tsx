"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminSelect, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { useAdminCustomer, useAdminTiers, useUpdateCustomerTier } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

export default function AdminCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const { showToast } = useToast();
  const { data: customer, isLoading } = useAdminCustomer(customerId);
  const { data: tiers = [] } = useAdminTiers();
  const updateTier = useUpdateCustomerTier();

  async function handleTierChange(tierId: string) {
    try {
      await updateTier.mutateAsync({ id: customerId, tierId: tierId || null });
      showToast("Customer tier updated.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not update customer tier."), "error");
    }
  }

  return (
    <AdminLayout title="Customer">
      <p className="mb-5 text-[13.5px] text-[#6B6B6B]">Minimal tier assignment view.</p>
      <div className="mb-5">
        <Link href="/admin/customers" className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#E31E24]">
          <ArrowLeft size={14} />
          Back to customers
        </Link>
      </div>

      <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
        {isLoading || !customer ? (
          <div className="text-[13.5px] text-[#9A9A9A]">Loading customer...</div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1A1A1A]">{customer.firstName} {customer.lastName}</h2>
              <div className="mt-4 grid gap-3 text-[13.5px] text-[#6B6B6B] sm:grid-cols-2">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Email</div>
                  <div className="mt-1 text-[#1A1A1A]">{customer.email}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Phone</div>
                  <div className="mt-1 text-[#1A1A1A]">{customer.phone || "—"}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Status</div>
                  <div className="mt-1"><StatusBadge status={customer.status} /></div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Current Tier</div>
                  <div className="mt-1 text-[#1A1A1A]">{customer.tier?.name ?? "None"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Save size={16} className="text-[#E31E24]" />
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Tier Assignment</h3>
              </div>
              <AdminSelect
                label="Tier"
                value={customer.tierId ?? ""}
                onChange={(event) => handleTierChange(event.target.value)}
                disabled={updateTier.isPending}
                options={[
                  { value: "", label: "None" },
                  ...tiers.map((tier: { id: string; name: string }) => ({ value: tier.id, label: tier.name })),
                ]}
              />
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#6B6B6B]">
                This only assigns the customer tier. Profile editing, addresses, and order history are intentionally out of scope for this step.
              </p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
