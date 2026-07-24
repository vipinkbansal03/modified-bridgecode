"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, MapPin, PackageSearch, Save, XCircle, Edit2, X } from "lucide-react";
import { AdminInput, AdminSelect, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminCountries,
  useAdminCustomer,
  useAdminCustomerRoles,
  useAdminCustomerAddresses,
  useAdminCustomerOrders,
  useAdminTiers,
  useApproveCustomer,
  useRejectCustomer,
  useUpdateAdminCustomer,
  useUpdateCustomerRole,
  useUpdateCustomerTier,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type Customer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: string;
  customerType: string;
  approvalStatus: string;
  customerRoleId?: string | null;
  customerRole?: { id: string; key: string; name: string } | null;
  tierId?: string | null;
  tier?: { id: string; name: string } | null;
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  total: string | number;
  currency?: { code: string; symbol?: string | null } | null;
  items?: { id: string; title: string; sku?: string | null; quantity: number; total: string | number }[];
};

type CustomerAddress = {
  id: string;
  label?: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  isDefault: boolean;
  country?: { name: string; code: string } | null;
};

function formatMoney(value: string | number, currency?: CustomerOrder["currency"]) {
  const amount = Number(value ?? 0);
  const prefix = currency?.symbol || currency?.code || "";
  return `${prefix}${amount.toFixed(2)}`;
}

export default function AdminCustomerDetailPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("customers.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("customers.update");

  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const { showToast } = useToast();
  const { data: customer, isLoading } = useAdminCustomer(customerId) as { data?: Customer; isLoading: boolean };
  const { data: customerRoles = [] } = useAdminCustomerRoles();
  const { data: tiers = [] } = useAdminTiers();
  const { data: orders = [], isLoading: ordersLoading } = useAdminCustomerOrders(customerId) as { data?: CustomerOrder[]; isLoading: boolean };
  const { data: addresses = [], isLoading: addressesLoading, refetch: refetchAddresses } = useAdminCustomerAddresses(customerId) as { data?: CustomerAddress[]; isLoading: boolean; refetch: () => void };
  const { data: countries = [] } = useAdminCountries() as { data?: any[] };
  const activeCountries = useMemo(() => countries.filter((c: any) => c.status === "ACTIVE"), [countries]);

  const updateTier = useUpdateCustomerTier();
  const updateCustomerRole = useUpdateCustomerRole();
  const updateCustomer = useUpdateAdminCustomer();
  const approveCustomer = useApproveCustomer();
  const rejectCustomer = useRejectCustomer();

  const mode = searchParams.get("mode") ?? "view";
  const isReadOnly = mode === "view" || !canUpdate;

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [addressForm, setAddressForm] = useState({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    countryId: "",
  });

  useEffect(() => {
    if (!selectedAddress) return;
    setAddressForm({
      fullName: selectedAddress.fullName ?? "",
      phone: selectedAddress.phone ?? "",
      addressLine1: selectedAddress.addressLine1 ?? "",
      addressLine2: selectedAddress.addressLine2 ?? "",
      city: selectedAddress.city ?? "",
      state: selectedAddress.state ?? "",
      postalCode: selectedAddress.postalCode ?? "",
      countryId: selectedAddress.countryId ?? "",
    });
  }, [selectedAddress]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddress) return;
    try {
      await adminApi.put(`/customers/${customerId}/addresses/${selectedAddress.id}`, addressForm);
      showToast("Customer address updated successfully.", "success");
      setShowAddressModal(false);
      setSelectedAddress(null);
      refetchAddresses();
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to update address."), "error");
    }
  };

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", status: "ACTIVE", customerType: "RETAIL", approvalStatus: "ACTIVE" });

  useEffect(() => {
    if (!customer) return;
    setForm({
      firstName: customer.firstName ?? "",
      lastName: customer.lastName ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      status: customer.status ?? "ACTIVE",
      customerType: customer.customerType ?? "RETAIL",
      approvalStatus: customer.approvalStatus ?? "ACTIVE",
    });
  }, [customer]);

  async function handleProfileSave() {
    try {
      await updateCustomer.mutateAsync({
        id: customerId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        status: form.status,
        customerType: form.customerType,
        approvalStatus: form.approvalStatus,
      });
      showToast("Customer profile updated.", "success");
      router.push(`/admin/customers/${customerId}?mode=view`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not update customer profile."), "error");
    }
  }

  async function handleTierChange(tierId: string) {
    try {
      await updateTier.mutateAsync({ id: customerId, tierId: tierId || null });
      showToast("Customer tier updated.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not update customer tier."), "error");
    }
  }

  async function handleCustomerRoleChange(customerRoleId: string) {
    try {
      await updateCustomerRole.mutateAsync({ id: customerId, customerRoleId });
      showToast("Customer role updated.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not update customer role."), "error");
    }
  }

  async function handleApprovalAction(action: "approve" | "reject") {
    try {
      if (action === "approve") {
        await approveCustomer.mutateAsync(customerId);
        showToast("Customer approved.", "success");
      } else {
        await rejectCustomer.mutateAsync(customerId);
        showToast("Customer suspended.", "success");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not update customer approval."), "error");
    }
  }

  if (authLoading || !hasPermission("customers.view")) {
    return null;
  }

  return (
    <AdminLayout title="Customer">
      <div className="mb-5">
        <Link href="/admin/customers" className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#E31E24]">
          <ArrowLeft size={14} />
          Back to customers
        </Link>
      </div>

      {isLoading || !customer ? (
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 text-[13.5px] text-[#9A9A9A]">Loading customer...</div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="rounded-lg border border-[#E6E6E6] bg-white p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-semibold text-[#1A1A1A]">
                    {customer.firstName} {customer.lastName}
                  </h2>
                  <p className="mt-1 text-[13px] text-[#6B6B6B]">{customer.email}</p>
                </div>
                {isReadOnly && (
                  <Link
                    href={`/admin/customers/${customerId}?mode=edit`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors"
                  >
                    <Edit2 size={13} />
                    Edit Profile
                  </Link>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <AdminInput label="First Name" value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} disabled={isReadOnly} />
                <AdminInput label="Last Name" value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} disabled={isReadOnly} />
                <AdminInput label="Email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} disabled={isReadOnly} />
                <AdminInput label="Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} disabled={isReadOnly} />
                <AdminSelect
                  label="Status"
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  disabled={isReadOnly}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
                <AdminSelect
                  label="Customer Type"
                  value={form.customerType}
                  onChange={(event) => setForm((prev) => ({ ...prev, customerType: event.target.value }))}
                  disabled={isReadOnly}
                  options={[
                    { value: "RETAIL", label: "Retail" },
                    { value: "DEALER", label: "Dealer" },
                    { value: "DOCTOR", label: "Doctor" },
                    { value: "WHOLESALE", label: "Wholesale" },
                  ]}
                />
                <AdminSelect
                  label="Approval Status"
                  value={form.approvalStatus}
                  onChange={(event) => setForm((prev) => ({ ...prev, approvalStatus: event.target.value }))}
                  disabled={isReadOnly}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "PENDING_APPROVAL", label: "Pending Approval" },
                    { value: "SUSPENDED", label: "Suspended" },
                  ]}
                />
              </div>

              {!isReadOnly && (
                <div className="mt-5 flex justify-end gap-2">
                  <Link
                    href={`/admin/customers/${customerId}?mode=view`}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E6E6E6] bg-white px-4 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F7F7F7]"
                  >
                    Cancel
                  </Link>
                  <button
                    type="button"
                    onClick={handleProfileSave}
                    disabled={updateCustomer.isPending}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#C91920] disabled:opacity-60"
                  >
                    <Save size={15} />
                    Save Profile
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-[#E6E6E6] bg-white p-5">
              {customer.approvalStatus === "PENDING_APPROVAL" ? (
                <div className="mb-5 rounded-md border border-[#F6D7D9] bg-[#FFF7F7] p-3">
                  <div className="text-[13px] font-semibold text-[#1A1A1A]">Wholesale approval required</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B6B6B]">Pending customers cannot place checkout orders until approved.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleApprovalAction("approve")}
                      disabled={isReadOnly || approveCustomer.isPending || rejectCustomer.isPending}
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-[#1F8F4A] px-3 text-[12.5px] font-semibold text-white disabled:opacity-60"
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprovalAction("reject")}
                      disabled={isReadOnly || approveCustomer.isPending || rejectCustomer.isPending}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#E31E24] bg-white px-3 text-[12.5px] font-semibold text-[#E31E24] disabled:opacity-60"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="mb-3 flex items-center gap-2">
                <Save size={16} className="text-[#E31E24]" />
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Tier Assignment</h3>
              </div>
              <AdminSelect
                label="Customer Role"
                value={customer.customerRoleId ?? ""}
                onChange={(event) => handleCustomerRoleChange(event.target.value)}
                disabled={isReadOnly || updateCustomerRole.isPending}
                options={customerRoles.map((role: { id: string; name: string; status: string }) => ({
                  value: role.id,
                  label: role.status === "ACTIVE" ? role.name : `${role.name} (Inactive)`,
                }))}
              />
              <AdminSelect
                label="Tier"
                value={customer.tierId ?? ""}
                onChange={(event) => handleTierChange(event.target.value)}
                disabled={isReadOnly || updateTier.isPending}
                options={[
                  { value: "", label: "None" },
                  ...tiers.map((tier: { id: string; name: string }) => ({ value: tier.id, label: tier.name })),
                ]}
              />
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#6B6B6B]">
                Tier controls customer-specific pricing rules. Profile status controls whether the customer can continue using their account.
              </p>
            </section>
          </div>

          <section className="rounded-lg border border-[#E6E6E6] bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <PackageSearch size={17} className="text-[#E31E24]" />
              <h3 className="text-[15px] font-semibold text-[#1A1A1A]">Order History</h3>
            </div>
            {ordersLoading ? (
              <div className="text-[13px] text-[#9A9A9A]">Loading orders...</div>
            ) : orders.length === 0 ? (
              <div className="text-[13px] text-[#9A9A9A]">No orders found for this customer.</div>
            ) : (
              <div className="divide-y divide-[#EFEFEF]">
                {orders.map((order) => (
                  <div key={order.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link href={`/admin/orders/${order.id}`} className="text-[14px] font-semibold text-[#1A1A1A] hover:text-[#E31E24]">
                          {order.orderNumber}
                        </Link>
                        <div className="mt-1 text-[12px] text-[#9A9A9A]">{new Date(order.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <StatusBadge status={order.status} />
                        <div className="text-[14px] font-semibold text-[#1A1A1A]">{formatMoney(order.total, order.currency)}</div>
                      </div>
                    </div>
                    {order.items?.length ? (
                      <div className="mt-2 text-[12.5px] text-[#6B6B6B]">
                        {order.items.map((item) => `${item.quantity} x ${item.title}`).join(", ")}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[#E6E6E6] bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <MapPin size={17} className="text-[#E31E24]" />
              <h3 className="text-[15px] font-semibold text-[#1A1A1A]">Saved Addresses</h3>
            </div>
            {addressesLoading ? (
              <div className="text-[13px] text-[#9A9A9A]">Loading addresses...</div>
            ) : addresses.length === 0 ? (
              <div className="text-[13px] text-[#9A9A9A]">No saved addresses found.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {addresses.map((address) => (
                  <div key={address.id} className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] p-4 text-[13px] text-[#6B6B6B]">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-semibold text-[#1A1A1A]">{address.label || address.fullName}</div>
                      <div className="flex items-center gap-1.5">
                        {address.isDefault && <span className="rounded-full bg-[#E31E24]/10 px-2 py-0.5 text-[11px] font-semibold text-[#E31E24]">Default</span>}
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAddress(address);
                              setShowAddressModal(true);
                            }}
                            className="text-[#6B6B6B] hover:text-[#E31E24] p-0.5 rounded transition-colors"
                            title="Edit address"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>{address.fullName}</div>
                    <div>{address.phone}</div>
                    <div className="mt-2">
                      {address.addressLine1}
                      {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                      <br />
                      {address.country?.name ?? ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <Modal open={showAddressModal} onClose={() => { setShowAddressModal(false); setSelectedAddress(null); }}>
        <form onSubmit={handleSaveAddress} className="flex flex-col max-h-[90vh] w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="border-b border-[#E6E6E6] px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[#1A1A1A]">
                Edit Customer Address
              </h3>
              <p className="mt-0.5 text-xs text-[#6B6B6B]">
                Modify the customer's billing or shipping address details.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowAddressModal(false); setSelectedAddress(null); }}
              className="text-[#9A9A9A] hover:text-[#1A1A1A]"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInput
                label="Full Name *"
                value={addressForm.fullName}
                onChange={(e) => setAddressForm(prev => ({ ...prev, fullName: e.target.value }))}
                required
              />
              <AdminInput
                label="Phone Number"
                value={addressForm.phone}
                onChange={(e) => setAddressForm(prev => ({ ...prev, phone: e.target.value }))}
              />
              <div className="md:col-span-2">
                <AdminInput
                  label="Address Line 1 *"
                  value={addressForm.addressLine1}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, addressLine1: e.target.value }))}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <AdminInput
                  label="Address Line 2"
                  value={addressForm.addressLine2}
                  onChange={(e) => setAddressForm(prev => ({ ...prev, addressLine2: e.target.value }))}
                />
              </div>
              <AdminInput
                label="City *"
                value={addressForm.city}
                onChange={(e) => setAddressForm(prev => ({ ...prev, city: e.target.value }))}
                required
              />
              <AdminInput
                label="State / Province"
                value={addressForm.state}
                onChange={(e) => setAddressForm(prev => ({ ...prev, state: e.target.value }))}
              />
              <AdminInput
                label="Postal / ZIP Code *"
                value={addressForm.postalCode}
                onChange={(e) => setAddressForm(prev => ({ ...prev, postalCode: e.target.value }))}
                required
              />
              <AdminSelect
                label="Country *"
                value={addressForm.countryId}
                onChange={(e) => setAddressForm(prev => ({ ...prev, countryId: e.target.value }))}
                required
                options={[
                  { value: "", label: "Select Country" },
                  ...activeCountries.map((c: any) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>
          </div>

          <div className="border-t border-[#E6E6E6] bg-slate-50 px-5 py-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowAddressModal(false); setSelectedAddress(null); }}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
