"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  HelpCircle,
  Lock,
  Minus,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useDeliveryAddress } from "@/contexts/DeliveryAddressContext";
import {
  createCustomerOrder,
  calculateShipping,
  estimateCustomerOrder,
  getCustomerErrorMessage,
  listCustomerAddresses,
  validateCoupon,
  fetchPublicPaymentMethods,
  fetchAvailableProviders,
  initiateCustomerPayment,
  verifyCustomerPayment,
  validateCustomerAddress,
  type AvailablePaymentMethod,
  type AvailableShippingOption,
  type CouponValidationResult,
  type CustomerAddress,
  type CustomerOrderEstimate,
  type CustomerOrderSummary,
  type ShippingEstimate,
} from "@/services/customerApi";
import { RazorpayPaymentButton } from "@/components/checkout/RazorpayPaymentButton";
import { AddressValidationDialog } from "@/components/ui/delivery/AddressValidationDialog";

const DEMO_PAYMENT_LABEL = "Pay on Delivery";
const SHIPPING_UNAVAILABLE_MESSAGE =
  "Shipping is not available to your country yet. Please contact support.";
const SHIPPING_ZONE_STORAGE_KEY = "checkout_shipping_zone";
const APPROVAL_MESSAGES: Record<string, string> = {
  PENDING_APPROVAL:
    "Your account is pending approval. You will be notified once approved.",
  SUSPENDED: "Your account has been suspended. Please contact support.",
};

const STATE_MAPPINGS: Record<string, string[]> = {
  IN: [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
    "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala", 
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", 
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
    "Uttarakhand", "West Bengal", "Delhi", "Andaman & Nicobar", "Chandigarh", "Dadra & Nagar Haveli", 
    "Daman & Diu", "Lakshadweep", "Puducherry"
  ],
  US: [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", 
    "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", 
    "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", 
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", 
    "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", 
    "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", 
    "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia"
  ],
  DE: [
    "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse", 
    "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate", 
    "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"
  ],
  GB: [
    "England", "Scotland", "Wales", "Northern Ireland"
  ],
  AU: [
    "New South Wales", "Victoria", "Queensland", "Western Australia", "South Australia", "Tasmania", 
    "Australian Capital Territory", "Northern Territory"
  ],
  CA: [
    "Ontario", "Quebec", "British Columbia", "Alberta", "Manitoba", "Saskatchewan", 
    "Nova Scotia", "New Brunswick", "Newfoundland and Labrador", "Prince Edward Island", 
    "Northwest Territories", "Nunavut", "Yukon"
  ]
};

function formatMoney(symbol: string, amount: number) {
  if (amount === null || amount === undefined || !Number.isFinite(amount))
    return "";
  const val = Number(amount);
  const hasDecimals = Math.abs(val % 1) > 0.001;
  const formatted = val.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

function CustomSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  required?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5 relative">
      {label && (
        <label className="text-[13px] font-semibold text-[#1A1A1A]">
          {label}
          {required && (
            <span className="ml-0.5 text-[#E31E24]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-[46px] rounded-md border bg-white/80 px-4 py-2 text-[14px] text-[#1A1A1A] text-left outline-none transition-all flex items-center justify-between ${
          isOpen ? "border-[#1A1A1A] ring-1 ring-[#1A1A1A]" : "border-[#E0E0E0] hover:border-[#B0B0B0]"
        }`}
      >
        <span className={selectedOption ? "text-[#1A1A1A]" : "text-[#9A9A9A]"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4.5 h-4.5 text-[#9A9A9A] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full max-h-[300px] overflow-y-auto rounded-md border border-[#E0E0E0] bg-white py-1 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)] z-50">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2.5 text-[14px] text-[#9A9A9A] hover:bg-[#F5F5F5] transition-colors"
          >
            {placeholder}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-[14px] hover:bg-[#F5F5F5] transition-colors flex items-center justify-between ${
                opt.value === value ? "font-semibold text-[#E31E24] bg-[#E31E24]/5" : "text-[#1A1A1A]"
              }`}
            >
              <span>{opt.label}</span>
              {opt.value === value && (
                <svg className="w-4 h-4 text-[#E31E24]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totals, updateQuantity, removeItem, clearCart } = useCart();
  const { currentCustomer, isLoading } = useCustomerAuth();
  const { selectedCountryCode, setSelectedCountryCode } = useCurrencyContext();
  const { selectedAddress: sessionAddress, setSelectedAddress } = useDeliveryAddress();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomerOrderSummary | null>(null);
  const [pendingOrder, setPendingOrder] = useState<CustomerOrderSummary | null>(
    null,
  );
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState<
    AvailablePaymentMethod[]
  >([]);
  const [selectedPaymentCode, setSelectedPaymentCode] = useState<string>("COD");
  const [estimate, setEstimate] = useState<CustomerOrderEstimate | null>(null);
  const [shippingEstimate, setShippingEstimate] =
    useState<ShippingEstimate | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<
    AvailableShippingOption[]
  >([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return window.localStorage.getItem(SHIPPING_ZONE_STORAGE_KEY);
    }
    return null;
  });
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("applied_coupon");
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  const [couponInput, setCouponInput] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("applied_coupon");
      if (stored) {
        try {
          return JSON.parse(stored).code;
        } catch {
          return "";
        }
      }
    }
    return "";
  });
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [validationState, setValidationState] = useState<{
    isOpen: boolean;
    originalAddress: any;
    recommendedAddress: any;
    isValid: boolean;
  } | null>(null);
  const [taxIdInput, setTaxIdInput] = useState("");
  const [isVerifyingVat, setIsVerifyingVat] = useState(false);
  const [vatStatus, setVatStatus] = useState<"VALID" | "INVALID" | "PENDING" | null>(null);
  const [vatMessage, setVatMessage] = useState("");
  const [countriesList, setCountriesList] = useState<Array<{ id: string; name: string; code: string }>>([]);

  useEffect(() => {
    fetch("/api/countries")
      .then((res) => res.json())
      .then((payload) => {
        if (payload?.success && Array.isArray(payload.data)) {
          setCountriesList(payload.data);
        }
      })
      .catch((err) => console.error("Failed to fetch public countries:", err));
  }, []);

  const initialCountryRef = useRef<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    countryCode: selectedCountryCode ? selectedCountryCode.toUpperCase() : "IN",
    notes: "",
  });

  useEffect(() => {
    if (form.countryCode) {
      if (initialCountryRef.current === null) {
        initialCountryRef.current = form.countryCode;
      } else if (initialCountryRef.current !== form.countryCode) {
        setVatStatus(null);
        setVatMessage("");
        initialCountryRef.current = form.countryCode;
      }
    }
  }, [form.countryCode]);

  const taxIdConfig = useMemo(() => {
    const countryUpper = form.countryCode.trim().toUpperCase();
    const euCountries = new Set([
      "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR",
      "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
    ]);

    let label = "Tax ID / Business Registration (Optional B2B)";
    let placeholder = "Enter Business Tax ID";
    let type = "VAT";

    if (countryUpper === "IN") {
      label = "GSTIN (Optional B2B)";
      placeholder = "GSTIN (e.g. 03AAAAA1111A1Z1)";
      type = "GSTIN";
    } else if (countryUpper === "US") {
      label = "EIN / Resale Certificate (Optional B2B)";
      placeholder = "EIN (e.g. 12-3456789) or Resale Certificate";
      type = "EIN";
    } else if (euCountries.has(countryUpper)) {
      label = "EU VAT ID (Optional B2B)";
      placeholder = "VAT ID (e.g. DE123456789)";
      type = "VAT";
    }

    return { label, placeholder, type };
  }, [form.countryCode]);

  useEffect(() => {
    let active = true;
    fetchPublicPaymentMethods(form.countryCode)
      .then((methods) => {
        if (!active) return;
        setAvailablePaymentMethods(methods);
        const defaultMethod = methods.find((m) => m.isDefault) || methods[0];
        if (defaultMethod) {
          setSelectedPaymentCode(defaultMethod.code);
        } else {
          setSelectedPaymentCode("COD");
        }
      })
      .catch(() => {
        if (active) setAvailablePaymentMethods([]);
      });
    return () => {
      active = false;
    };
  }, [form.countryCode]);

  useEffect(() => {
    if (!isLoading && !currentCustomer) {
      router.replace("/login?returnTo=/checkout");
    }
  }, [currentCustomer, isLoading, router]);

  useEffect(() => {
    if (currentCustomer) {
      const defaultName = `${currentCustomer.firstName} ${currentCustomer.lastName}`.trim();
      const defaultPhone = currentCustomer.phone || "";
      
      Promise.resolve().then(() => {
        setForm((current) => {
          if (current.fullName && current.phone) return current;
          return {
            ...current,
            fullName: current.fullName || defaultName,
            phone: current.phone || defaultPhone,
          };
        });
      });
      listCustomerAddresses()
        .then((saved) => {
          setAddresses(saved);

          const activeCountryCode = selectedCountryCode
            ? selectedCountryCode.toUpperCase()
            : "IN";
          const matchingCountryAddress = saved.find(
            (addr) => addr.country?.code?.toUpperCase() === activeCountryCode,
          );
          const preselected =
            sessionAddress ||
            matchingCountryAddress ||
            (saved.find((address) => address.isDefault) ?? saved[0]);
          if (preselected) {
            applySavedAddress(preselected, true);
          }
        })
        .catch(() => {
          setAddresses([]);
          if (sessionAddress) applySavedAddress(sessionAddress, true);
        });
    } else if (sessionAddress) {
      applySavedAddress(sessionAddress, true);
    }
  }, [currentCustomer, sessionAddress]);

  useEffect(() => {
    if (selectedCountryCode) {
      setForm((current) => ({ ...current, countryCode: selectedCountryCode }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryCode]);

  useEffect(() => {
    if (currentCustomer) {
      const customerTaxId = (currentCustomer as any).taxId;
      if (customerTaxId) {
        setTaxIdInput(customerTaxId);
        const status = (currentCustomer as any).taxIdStatus;
        if (status === "VALID") {
          setVatStatus("VALID");
        } else if (status === "PENDING") {
          setVatStatus("PENDING");
        } else {
          setVatStatus("INVALID");
        }
      } else {
        setTaxIdInput("");
        setVatStatus(null);
      }
    }
  }, [currentCustomer]);

  const canSubmit = useMemo(() => {
    return Boolean(
      items.length &&
      form.fullName.trim() &&
      form.phone.trim() &&
      form.addressLine1.trim() &&
      form.city.trim() &&
      form.state.trim() &&
      form.postalCode.trim() &&
      form.countryCode.trim(),
    );
  }, [form, items.length]);

  const hasSpecificTaxes = useMemo(() => {
    if (!estimate?.items) return false;
    return (estimate.items as any[]).some((item) =>
      (item.appliedTaxes as any[])?.some((tax) => tax.isSpecific),
    );
  }, [estimate]);

  const taxEstimateLabel = useMemo(() => {
    if ((estimate?.taxAmount ?? 0) > 0) {
      return null;
    }
    if (vatStatus === "VALID") {
      return estimate?.taxBreakdown?.[0]?.label || "Tax Exempt";
    }
    return formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, 0);
  }, [estimate, vatStatus, totals.currencySymbol]);

  const aggregatedDiscounts = useMemo(() => {
    if (!estimate?.automaticDiscounts) return [];
    const map = new Map<
      string,
      {
        amount: number;
        label: string;
        originalUnitPrice: number;
        discountedUnitPrice: number;
        quantity: number;
      }
    >();

    for (const discount of estimate.automaticDiscounts as any[]) {
      if (!discount.label) continue;
      const key = discount.label;
      const existing = map.get(key) || {
        amount: 0,
        label: discount.label,
        originalUnitPrice: discount.amountBefore ?? 0,
        discountedUnitPrice: discount.amountAfter ?? 0,
        quantity: 0,
      };

      existing.amount += discount.discountAmount;
      existing.quantity += discount.quantity ?? 0;
      if (discount.amountBefore)
        existing.originalUnitPrice = discount.amountBefore;
      if (discount.amountAfter)
        existing.discountedUnitPrice = discount.amountAfter;

      map.set(key, existing);
    }
    return Array.from(map.values());
  }, [
    estimate?.automaticDiscounts,
    estimate?.currency?.symbol,
    totals.currencySymbol,
  ]);

  const selectedShippingOption = useMemo(() => {
    return availableProviders.find((p) => p.zoneId === selectedZoneId) ?? null;
  }, [availableProviders, selectedZoneId]);

  const totalPayable = useMemo(() => {
    if (estimate?.total != null) return estimate.total;
    const shippingCharge = selectedShippingOption
      ? selectedShippingOption.isFree
        ? 0
        : selectedShippingOption.charge
      : shippingEstimate?.available && !shippingEstimate.isFree
        ? shippingEstimate.charge
        : 0;
    return totals.subtotal + shippingCharge;
  }, [
    estimate?.total,
    selectedShippingOption,
    shippingEstimate,
    totals.subtotal,
  ]);

  const approvalBlockMessage = currentCustomer?.approvalStatus
    ? APPROVAL_MESSAGES[currentCustomer.approvalStatus]
    : null;
  const canPlaceOrder =
    canSubmit && Boolean(shippingEstimate?.available) && Boolean(selectedZoneId) && !approvalBlockMessage;

  const orderPayload = useMemo(
    () => ({
      items: items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
      shippingAddress: {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        countryCode: form.countryCode.trim().toUpperCase() || undefined,
      },
      couponCode: appliedCoupon?.code,
      notes: form.notes.trim() || undefined,
      shippingZoneId: selectedZoneId ?? undefined,
    }),
    [appliedCoupon?.code, form, items, selectedZoneId],
  );

  useEffect(() => {
    if (!currentCustomer || !canSubmit) {
      if (estimate !== null) setEstimate(null);
      if (shippingEstimate !== null) setShippingEstimate(null);
      if (shippingError !== null) setShippingError(null);
      setAvailableProviders([]);
      setSelectedZoneId(null);
      return;
    }

    let cancelled = false;
    setShippingError(null);
    const countryCode = form.countryCode.trim().toUpperCase();
    const orderValue = totals.subtotal;
    calculateShipping({
      countryCode,
      orderValue,
    })
      .then((nextShipping) => {
        if (cancelled) return;
        setShippingEstimate(nextShipping);
        setShippingError(
          nextShipping.available
            ? null
            : (nextShipping.message ?? SHIPPING_UNAVAILABLE_MESSAGE),
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setShippingEstimate(null);
          setShippingError(
            getCustomerErrorMessage(err, SHIPPING_UNAVAILABLE_MESSAGE),
          );
        }
      });
    fetchAvailableProviders({ countryCode, orderValue })
      .then((providers) => {
        if (cancelled) return;
        setAvailableProviders(providers);
        const storedZoneId =
          typeof window !== "undefined"
            ? window.localStorage.getItem(SHIPPING_ZONE_STORAGE_KEY)
            : null;
        const preferredZoneId =
          storedZoneId && providers.some((p) => p.zoneId === storedZoneId)
            ? storedZoneId
            : providers.length > 0
              ? providers[0].zoneId
              : null;
        setSelectedZoneId(preferredZoneId);
      })
      .catch(() => {
        if (!cancelled) setAvailableProviders([]);
      });
    estimateCustomerOrder(orderPayload)
      .then((nextEstimate) => {
        if (!cancelled) setEstimate(nextEstimate);
      })
      .catch((err) => {
        if (!cancelled) {
          setEstimate(null);
          if (appliedCoupon) {
            setCouponError(
              getCustomerErrorMessage(
                err,
                "Coupon could not be applied to this order.",
              ),
            );
          } else {
            setShippingError(
              getCustomerErrorMessage(err, SHIPPING_UNAVAILABLE_MESSAGE),
            );
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    appliedCoupon,
    canSubmit,
    currentCustomer,
    form.countryCode,
    orderPayload,
    totals.subtotal,
  ]);

  async function handleVerifyVat() {
    if (!taxIdInput.trim()) return;
    setIsVerifyingVat(true);
    setVatStatus(null);
    setVatMessage("");
    try {
      const { customerApi } = await import("@/services/customerApi");
      const res = await customerApi.post("/tax-rules/identifiers/validate", {
        taxId: taxIdInput.trim(),
        taxIdType: taxIdConfig.type,
        countryCode: form.countryCode.trim().toUpperCase(),
      });
      const data = res.data?.data || res.data;
      if (data && data.isValid) {
        if (data.validationStatus === "PENDING") {
          setVatStatus("PENDING");
        } else {
          setVatStatus("VALID");
        }
        setVatMessage(data.message || data.legalName || "Tax ID verified successfully");
        const nextEstimate = await estimateCustomerOrder(orderPayload);
        setEstimate(nextEstimate);
      } else {
        setVatStatus("INVALID");
        setVatMessage(data?.message || "Invalid format");
      }
    } catch (err: any) {
      setVatStatus("INVALID");
      const errMsg = err.response?.data?.message || err.message || "Failed to verify Tax ID.";
      setVatMessage(errMsg);
    } finally {
      setIsVerifyingVat(false);
    }
  }

  async function handleClearVat() {
    setTaxIdInput("");
    setVatStatus(null);
    setVatMessage("");
    try {
      const { customerApi } = await import("@/services/customerApi");
      await customerApi.post("/tax-rules/identifiers/validate", {
        taxId: "",
        taxIdType: taxIdConfig.type,
        countryCode: form.countryCode.trim().toUpperCase(),
      });
      const nextEstimate = await estimateCustomerOrder(orderPayload);
      setEstimate(nextEstimate);
    } catch (err) {
      console.error("Error clearing VAT ID:", err);
    }
  }

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Enter a coupon code.");
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon({
        code,
        orderValue: estimate?.subtotal ?? totals.subtotal,
        countryCode: form.countryCode.trim().toUpperCase() || undefined,
      });
      setAppliedCoupon(result);
      setCouponInput(result.code);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("applied_coupon", JSON.stringify(result));
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(
        getCustomerErrorMessage(err, "Coupon could not be applied."),
      );
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput("");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("applied_coupon");
    }
  }

  async function executeSubmit(overrideAddress?: any) {
    setIsSubmitting(true);
    setError(null);
    try {
      const finalPayload = {
        ...orderPayload,
        shippingZoneId: selectedZoneId ?? undefined,
      };
      if (overrideAddress) {
        finalPayload.shippingAddress = {
          ...finalPayload.shippingAddress,
          addressLine1: overrideAddress.addressLine1,
          addressLine2: overrideAddress.addressLine2 || undefined,
          city: overrideAddress.city,
          state: overrideAddress.state,
          postalCode: overrideAddress.postalCode,
          countryCode: overrideAddress.countryCode,
        };
      }

      const created = await createCustomerOrder(finalPayload);
      const selectedMethod = availablePaymentMethods.find(
        (m) => m.code === selectedPaymentCode,
      );

      if (
        selectedMethod?.type === "HOSTED_REDIRECT" ||
        selectedPaymentCode === "STRIPE"
      ) {
        const paymentRes = await initiateCustomerPayment(created.id, selectedPaymentCode);
        if (paymentRes.redirectUrl) {
          clearCart();
          window.location.href = paymentRes.redirectUrl;
          return;
        }
      } else if (
        selectedMethod?.type === "SDK_MODAL" ||
        selectedPaymentCode === "RAZORPAY"
      ) {
        await initiateCustomerPayment(created.id, selectedPaymentCode);
        setPendingOrder(created);
      } else {
        setOrder(created);
        clearCart();
      }
    } catch (err) {
      setError(getCustomerErrorMessage(err, "Could not place order."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSelectOriginal = async () => {
    setValidationState(null);
    await executeSubmit();
  };

  const handleSelectRecommended = async () => {
    if (!validationState || !validationState.recommendedAddress) return;
    const recommended = validationState.recommendedAddress;
    setValidationState(null);
    setForm((current) => ({
      ...current,
      addressLine1: recommended.addressLine1,
      addressLine2: recommended.addressLine2 || "",
      city: recommended.city,
      state: recommended.state,
      postalCode: recommended.postalCode,
    }));
    await executeSubmit(recommended);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Complete the shipping address before placing the order.");
      return;
    }
    if (!shippingEstimate?.available) {
      setError(shippingError ?? SHIPPING_UNAVAILABLE_MESSAGE);
      return;
    }
    if (approvalBlockMessage) {
      setError(approvalBlockMessage);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const addressPayload = {
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        countryCode: form.countryCode.trim().toUpperCase(),
      };

      const valResult = await validateCustomerAddress(addressPayload);

      if (valResult.isCorrected) {
        setValidationState({
          isOpen: true,
          originalAddress: {
            ...addressPayload,
            fullName: form.fullName.trim(),
            phone: form.phone.trim(),
          },
          recommendedAddress: valResult.normalizedAddress,
          isValid: valResult.isValid,
        });
        setIsSubmitting(false);
      } else {
        await executeSubmit();
      }
    } catch (err) {
      setError(getCustomerErrorMessage(err, "Could not validate shipping address."));
      setIsSubmitting(false);
    }
  }

  function applySavedAddress(
    address: CustomerAddress,
    preserveCurrentCountry = false,
  ) {
    const activeCountry = selectedCountryCode
      ? selectedCountryCode.toUpperCase()
      : "IN";
    const targetCountryCode = preserveCurrentCountry
      ? activeCountry
      : address.country?.code
        ? address.country.code.toUpperCase()
        : activeCountry;

    setForm((current) => ({
      ...current,
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? "",
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      countryCode: targetCountryCode,
    }));

    if (!preserveCurrentCountry && address.country?.code) {
      setSelectedCountryCode(address.country.code.toUpperCase());
    }
    if (sessionAddress?.id !== address.id) {
      setSelectedAddress(address as any);
    }
  }

  if (isLoading || (!currentCustomer && !order)) {
    return (
      <Container>
        <div className="py-20 text-center text-steel">
          Preparing checkout...
        </div>
      </Container>
    );
  }

  if (order) {
    const symbol = order.currency?.symbol ?? totals.currencySymbol;
    const shippingCharge = Number(order.shippingCharge ?? 0);
    const taxAmount = Number(order.taxAmount ?? 0);
    const couponDiscount = Number(order.couponDiscount ?? order.discount ?? 0);
    const shippingLabel = order.shippingProvider || "Shipping";
    const isPaid = order.paymentStatus === "PAID";

    return (
      <Container>
        <section className="py-16">
          <div className="mx-auto max-w-2xl rounded-xl border border-line bg-white p-8 text-center shadow-[0_16px_50px_rgba(31,24,18,0.08)]">
            <CheckCircle2
              size={42}
              className={`mx-auto mb-4 ${isPaid ? "text-[#2A6A40]" : "text-brand"}`}
            />
            <h1 className="text-[30px] font-semibold tracking-tight text-ink">
              {isPaid
                ? "Payment Successful & Order Confirmed!"
                : "Order Received"}
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-steel">
              {isPaid
                ? "Your payment has been securely processed via Razorpay and your order is now in processing."
                : "Your order has been recorded. Payment will be collected on delivery."}
            </p>
            <div className="mt-6 rounded-xl bg-grey p-5 text-left space-y-2">
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Order number</span>
                <strong className="text-ink font-mono">
                  {order.orderNumber}
                </strong>
              </div>
              {order.paymentId && (
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Razorpay Payment ID</span>
                  <strong className="text-ink font-mono text-xs">
                    {order.paymentId}
                  </strong>
                </div>
              )}
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Shipping</span>
                <strong className="text-ink">
                  {shippingLabel} ({formatMoney(symbol, shippingCharge)})
                </strong>
              </div>
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Tax</span>
                <strong className="text-ink">
                  {formatMoney(symbol, taxAmount)}
                </strong>
              </div>
              {order.couponCode && couponDiscount > 0 && (
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">
                    Coupon ({order.couponCode})
                  </span>
                  <strong className="text-[#2A6A40]">
                    -{formatMoney(symbol, couponDiscount)}
                  </strong>
                </div>
              )}
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Payment method</span>
                <strong className="text-ink">
                  {order.paymentMethod === "RAZORPAY"
                    ? "Razorpay Online Payment"
                    : DEMO_PAYMENT_LABEL}
                </strong>
              </div>
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Payment status</span>
                <span
                  className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${isPaid ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                >
                  {order.paymentStatus}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3 text-[15px]">
                <span className="font-semibold text-ink">
                  {isPaid ? "Total Paid" : "Total Due on Delivery"}
                </span>
                <strong className="text-[17px] font-extrabold text-ink">
                  {formatMoney(symbol, Number(order.total))}
                </strong>
              </div>
            </div>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/products" variant="outline">
                Continue shopping
              </Button>
              <Button href="/account" variant="primary">
                View my account
              </Button>
            </div>
          </div>
        </section>
      </Container>
    );
  }

  return (
    <Container>
      <section className="py-12">
        <div className="mb-8 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-steel-2">
              <Lock size={14} />
              Secure checkout
            </p>
            <h1 className="text-[34px] font-normal tracking-tight text-ink">
              Checkout
            </h1>
          </div>
          <Link
            href="/products"
            className="text-[14px] font-medium text-ink hover:text-brand"
          >
            Continue shopping
          </Link>
        </div>

        {items.length ? (
          <form
            onSubmit={handleSubmit}
            className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px]"
            noValidate
          >
            <div className="space-y-6">
              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-5 text-[18px] font-semibold text-ink">
                  Shipping address
                </h2>
                {addresses.length > 0 && (
                  <div className="mb-5">
                    <label
                      htmlFor="savedAddress"
                      className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-steel-2"
                    >
                      Saved address
                    </label>
                    <select
                      id="savedAddress"
                      onChange={(event) => {
                        const address = addresses.find(
                          (entry) => entry.id === event.target.value,
                        );
                        if (address) applySavedAddress(address, false);
                      }}
                      className="w-full rounded-md border border-line bg-white px-4 py-3 text-[14.5px] text-ink outline-none transition-colors focus:border-steel-2"
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label ??
                            (address.isDefault
                              ? "Default address"
                              : address.fullName)}{" "}
                          - {address.city}, {address.country.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input
                    required
                    label="Full name"
                    value={form.fullName}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                  />
                  <Input
                    required
                    label="Phone"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                  <Input
                    required
                    className="sm:col-span-2"
                    label="Address line 1"
                    value={form.addressLine1}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressLine1: event.target.value,
                      }))
                    }
                  />
                  <Input
                    className="sm:col-span-2"
                    label="Address line 2 (optional)"
                    value={form.addressLine2}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        addressLine2: event.target.value,
                      }))
                    }
                  />
                  <CustomSelect
                    required
                    label="Country"
                    placeholder="Select Country"
                    value={form.countryCode}
                    options={
                      countriesList.length > 0
                        ? countriesList.map((c) => ({ value: c.code, label: c.name }))
                        : [
                            { value: "IN", label: "India" },
                            { value: "US", label: "United States" },
                          ]
                    }
                    onChange={(nextCode) => {
                      setForm((current) => ({
                        ...current,
                        countryCode: nextCode,
                        state: "", // Reset state when country changes
                      }));
                      setSelectedCountryCode(nextCode);
                    }}
                  />

                  {STATE_MAPPINGS[form.countryCode] ? (
                    <CustomSelect
                      required
                      label="State"
                      placeholder="Select State"
                      value={form.state}
                      options={STATE_MAPPINGS[form.countryCode].map((state) => ({
                        value: state,
                        label: state,
                      }))}
                      onChange={(nextState) =>
                        setForm((current) => ({
                          ...current,
                          state: nextState,
                        }))
                      }
                    />
                  ) : (
                    <Input
                      required
                      label="State"
                      placeholder="Enter state"
                      value={form.state}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          state: event.target.value,
                        }))
                      }
                    />
                  )}

                  <Input
                    required
                    label="City"
                    value={form.city}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                  />
                  <Input
                    required
                    label="Postal code"
                    value={form.postalCode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        postalCode: event.target.value,
                      }))
                    }
                  />
                  <div className="sm:col-span-2 border-t border-line pt-4 mt-2">
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-steel-2">
                      {taxIdConfig.label}
                    </label>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        placeholder={taxIdConfig.placeholder}
                        value={taxIdInput}
                        onChange={(e) => {
                          setTaxIdInput(e.target.value);
                          setVatStatus(null);
                          setVatMessage("");
                        }}
                        onBlur={handleVerifyVat}
                        className="flex-1 rounded-md border border-line bg-white px-4 py-2.5 text-[14.5px] text-ink outline-none transition-colors focus:border-steel-2"
                      />
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleVerifyVat();
                        }}
                        disabled={isVerifyingVat || !taxIdInput.trim()}
                        className="rounded-md bg-brand px-5 py-2.5 text-[13.5px] font-bold text-white shadow-sm hover:bg-brand/90 disabled:opacity-50"
                      >
                        {isVerifyingVat ? "Verifying..." : "Verify/Validate"}
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); // Prevent input from losing focus immediately
                          handleClearVat();
                        }}
                        disabled={isVerifyingVat}
                        className="rounded-md border border-line px-4 py-2.5 text-[13.5px] font-medium text-steel hover:bg-grey disabled:opacity-50"
                      >
                        Clear
                      </button>
                    </div>
                    {vatStatus === "VALID" && (
                      <p className="mt-2 text-xs font-semibold text-green-600 flex items-center gap-1">
                        ✓ Status: VALID {vatMessage ? `(${vatMessage})` : ""}
                      </p>
                    )}
                    {vatStatus === "PENDING" && (
                      <p className="mt-2 text-xs font-semibold text-amber-600 flex items-center gap-1">
                        ⚠ Status: PENDING {vatMessage ? `(${vatMessage})` : ""}
                      </p>
                    )}
                    {vatStatus === "INVALID" && (
                      <p className="mt-2 text-xs font-semibold text-brand flex items-center gap-1">
                        ✗ Status: INVALID {vatMessage ? `(${vatMessage})` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-4 text-[18px] font-semibold text-ink">
                  Shipping method
                </h2>
                {availableProviders.length > 0 ? (
                  <div className="space-y-2">
                    {availableProviders.map((option) => {
                      const isSelected = selectedZoneId === option.zoneId;
                      return (
                        <label
                          key={option.zoneId}
                          className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? "border-brand bg-brand/5"
                              : "border-line bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="radio"
                              name="shippingMethod"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedZoneId(option.zoneId);
                                if (typeof window !== "undefined") {
                                  window.localStorage.setItem(
                                    SHIPPING_ZONE_STORAGE_KEY,
                                    option.zoneId,
                                  );
                                }
                              }}
                              className="text-brand focus:ring-brand"
                            />
                            <div>
                              <p className="text-[14px] font-semibold text-ink">
                                {option.provider}
                              </p>
                              {option.estimatedDays && (
                                <p className="text-[12px] text-steel mt-0.5">
                                  Estimated delivery: {option.estimatedDays}
                                </p>
                              )}
                            </div>
                          </div>
                          <strong className="text-[14px] text-ink">
                            {option.isFree
                              ? "Free"
                              : formatMoney(
                                  estimate?.currency?.symbol ??
                                    totals.currencySymbol,
                                  option.charge,
                                )}
                          </strong>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-md border border-line bg-grey px-4 py-3">
                    <p className="text-[14px] font-semibold text-ink">
                      {shippingError || "Shipping unavailable"}
                    </p>
                    <p className="mt-1 text-[12.5px] text-steel">
                      {shippingError
                        ? ""
                        : "Complete the address to check shipping availability."}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-4 text-[18px] font-semibold text-ink">
                  Order notes
                </h2>
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-[110px] w-full rounded-md border border-line bg-white px-4 py-3 text-[14.5px] text-ink outline-none transition-colors placeholder:text-steel-2 focus:border-steel-2"
                  placeholder="Delivery instructions or internal purchase reference"
                />
              </div>

              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-4 text-[18px] font-semibold text-ink">
                  Payment method
                </h2>
                <div className="rounded-md border border-line bg-grey px-4 py-3">
                  <p className="text-[14px] font-semibold text-ink">
                    {DEMO_PAYMENT_LABEL}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-steel">
                    No online payment is captured in this demo flow. The order
                    is saved with pending payment and the amount is due on
                    delivery.
                  </p>
                </div>
              </div>
            </div>

            <aside className="h-fit rounded-md border border-line bg-white p-5 shadow-[0_16px_50px_rgba(31,24,18,0.08)]">
              <div className="mb-5 flex items-center gap-2">
                <ShoppingCart size={17} className="text-brand" />
                <h2 className="text-[18px] font-semibold text-ink">
                  Order summary
                </h2>
              </div>

              <div className="space-y-4">
                {items.map((item) => {
                  const estimatedItem = estimate?.items?.find(
                    (ei) => ei.variantId === item.variantId,
                  );
                  const displayUnitPrice = estimatedItem
                    ? estimatedItem.unitPrice
                    : item.unitPrice;
                  const displayCurrencySymbol =
                    estimate?.currency?.symbol ?? item.currencySymbol;
                  return (
                    <div
                      key={item.variantId}
                      className="border-b border-line pb-4 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[14px] font-semibold text-ink">
                            {item.productTitle}
                          </p>
                          <p className="mt-1 text-[12.5px] text-steel">
                            {item.variantTitle}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.variantId)}
                          className="text-[12px] font-medium text-brand"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center rounded-pill border border-line bg-offwhite p-1">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() =>
                              updateQuantity(
                                item.variantId,
                                Math.max(1, item.quantity - 1),
                              )
                            }
                            disabled={item.quantity <= 1}
                            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-steel-2 disabled:opacity-40"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-10 text-center text-[13px] font-semibold text-ink">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity + 1)
                            }
                            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-steel-2"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <div className="text-right">
                          {estimatedItem?.basePrice &&
                            estimatedItem.basePrice > displayUnitPrice && (
                              <p className="text-[11.5px] text-steel line-through">
                                {formatMoney(
                                  displayCurrencySymbol,
                                  estimatedItem.basePrice * item.quantity,
                                )}
                              </p>
                            )}
                          <p className="text-[14px] font-semibold text-ink">
                            {formatMoney(
                              displayCurrencySymbol,
                              displayUnitPrice * item.quantity,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-3 border-t border-line pt-4">
                {estimate && Number(estimate.automaticDiscount ?? 0) > 0 && (
                  <>
                    <div className="flex items-center justify-between text-[13.5px]">
                      <span className="text-steel">Items Subtotal</span>
                      <span className="text-steel line-through">
                        {formatMoney(
                          estimate.currency?.symbol ?? totals.currencySymbol,
                          estimate.originalBaseSubtotal ??
                            Number(estimate.subtotal ?? 0) +
                              Number(estimate.automaticDiscount ?? 0),
                        )}
                      </span>
                    </div>
                    {aggregatedDiscounts.length > 0 ? (
                      <details className="group">
                        <summary className="flex items-center justify-between text-[13.5px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[#2A6A40]">
                              Applied Discounts
                            </span>
                            <svg
                              className="w-3.5 h-3.5 text-[#2A6A40] transition-transform group-open:rotate-180"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                          <strong className="text-[#2A6A40]">
                            -
                            {formatMoney(
                              estimate.currency?.symbol ??
                                totals.currencySymbol,
                              Number(estimate.automaticDiscount ?? 0),
                            )}
                          </strong>
                        </summary>
                        <div className="flex flex-col gap-1.5 pl-2 mt-2 border-l-2 border-[#2A6A40]/20">
                          {aggregatedDiscounts.map((discount, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-[12.5px]"
                            >
                              <span className="text-[#2A6A40]/90 font-medium">
                                {discount.label}
                              </span>
                              <span className="text-[#2A6A40]/90 font-semibold">
                                -
                                {formatMoney(
                                  estimate.currency?.symbol ??
                                    totals.currencySymbol,
                                  discount.amount,
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <div className="flex items-center justify-between text-[13.5px]">
                        <span className="font-semibold text-[#2A6A40]">
                          Applied Discounts
                        </span>
                        <strong className="text-[#2A6A40]">
                          -
                          {formatMoney(
                            estimate.currency?.symbol ?? totals.currencySymbol,
                            Number(estimate.automaticDiscount ?? 0),
                          )}
                        </strong>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Subtotal</span>
                  <strong className="text-ink">
                    {formatMoney(
                      estimate?.currency?.symbol ?? totals.currencySymbol,
                      estimate?.subtotal ?? totals.subtotal,
                    )}
                  </strong>
                </div>
                <div className="rounded-md border border-line bg-grey/60 p-3">
                  <label
                    htmlFor="couponCode"
                    className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-steel-2"
                  >
                    Coupon code
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13.5px] font-semibold text-[#2A6A40]">
                          {appliedCoupon.code} applied
                        </p>
                        <p className="mt-0.5 text-[12px] text-steel">
                          Discount:{" "}
                          {formatMoney(
                            estimate?.currency?.symbol ?? totals.currencySymbol,
                            estimate?.couponDiscount ??
                              appliedCoupon.discountAmount,
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveCoupon}
                        className="text-[18px] leading-none text-steel hover:text-brand"
                        aria-label="Remove coupon"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        id="couponCode"
                        value={couponInput}
                        onChange={(event) => {
                          setCouponInput(event.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-steel-2"
                        placeholder="Enter code"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        className="rounded-md bg-ink px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                      >
                        {isApplyingCoupon ? "Applying..." : "Apply"}
                      </button>
                    </div>
                  )}
                  {couponError && (
                    <p className="mt-2 text-[12.5px] text-brand">
                      {couponError}
                    </p>
                  )}
                </div>
                {(estimate?.couponCode || appliedCoupon) &&
                  Number(
                    estimate?.couponDiscount ??
                      appliedCoupon?.discountAmount ??
                      0,
                  ) > 0 && (
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="text-steel">
                        Coupon ({estimate?.couponCode ?? appliedCoupon?.code})
                      </span>
                      <strong className="text-[#2A6A40]">
                        -
                        {formatMoney(
                          estimate?.currency?.symbol ?? totals.currencySymbol,
                          Number(
                            estimate?.couponDiscount ??
                              appliedCoupon?.discountAmount ??
                              0,
                          ),
                        )}
                      </strong>
                    </div>
                  )}

                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Shipping</span>
                  <strong className="text-ink">
                    {selectedShippingOption
                      ? selectedShippingOption.isFree
                        ? "Free"
                        : formatMoney(
                            estimate?.currency?.symbol ?? totals.currencySymbol,
                            selectedShippingOption.charge,
                          )
                      : shippingEstimate?.available
                        ? shippingEstimate.isFree
                          ? "Free"
                          : formatMoney(
                              estimate?.currency?.symbol ?? totals.currencySymbol,
                              estimate?.shippingCharge ?? shippingEstimate.charge,
                            )
                        : "Unavailable"}
                  </strong>
                </div>
                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  <span className="block text-xs uppercase tracking-wide text-steel-2 font-semibold">
                    Payment Options ({availablePaymentMethods.length})
                  </span>
                  {availablePaymentMethods.length > 0 ? (
                    availablePaymentMethods.map((method) => {
                      const isSelected = selectedPaymentCode === method.code;
                      return (
                        <label
                          key={method.id}
                          className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? "border-brand bg-brand/5"
                              : "border-line bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="paymentMethod"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedPaymentCode(method.code)
                              }
                              className="text-brand focus:ring-brand"
                            />
                            <div>
                              <span className="text-[13.5px] font-semibold text-ink">
                                {method.name}
                              </span>
                              {method.description && (
                                <p className="text-[11.5px] text-steel">
                                  {method.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="rounded bg-[#EFEFEF] px-1.5 py-0.5 text-[10px] font-bold text-ink uppercase">
                            {method.type === "OFFLINE" ? "COD" : "Online"}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-line bg-grey p-3 text-xs text-steel">
                      Pay on Delivery is enabled for your country.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-line pt-3 text-[16px]">
                  <span className="font-semibold text-ink">Total Payable</span>
                  <div className="text-right">
                    <strong className="text-[18px] font-extrabold text-brand block">
                      {formatMoney(
                        estimate?.currency?.symbol ?? totals.currencySymbol,
                        totalPayable,
                      )}
                    </strong>
                    <span className="text-[11px] text-steel">
                      {(estimate as any)?.isTaxInclusive ? "Inclusive of all taxes" : "Tax calculated at checkout"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowBreakdownModal(true)}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-[#2A6A40] hover:underline"
                >
                  <HelpCircle size={13} />
                  Price Breakdown
                </button>
              </div>

              {(error || approvalBlockMessage || shippingError) && (
                <p className="mt-4 rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-[13px] text-brand">
                  {error || approvalBlockMessage || shippingError}
                </p>
              )}

              {pendingOrder ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800 text-center">
                    Order #{pendingOrder.orderNumber} created! Click below to
                    complete your payment.
                  </div>
                  <RazorpayPaymentButton
                    orderId={pendingOrder.id}
                    customerName={form.fullName}
                    customerEmail={currentCustomer?.email ?? ""}
                    customerPhone={form.phone}
                    onSuccess={(updated) => {
                      setOrder(updated);
                      setPendingOrder(null);
                      clearCart();
                    }}
                    onError={(errMsg) => setError(errMsg)}
                  />
                </div>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  className="mt-5"
                  disabled={isSubmitting || !canPlaceOrder}
                >
                  {isSubmitting
                    ? "Processing..."
                    : selectedPaymentCode === "RAZORPAY"
                      ? "Proceed to Pay with Razorpay"
                      : "Place Order"}
                </Button>
              )}
            </aside>
          </form>
        ) : (
          <div className="rounded-md border border-line bg-white p-10 text-center">
            <ShoppingCart size={30} className="mx-auto mb-3 text-steel-2" />
            <h2 className="text-[20px] font-semibold text-ink">
              Your cart is empty
            </h2>
            <p className="mt-2 text-[14px] text-steel">
              Add a product variant before checkout.
            </p>
            <Button href="/products" variant="primary" className="mt-6">
              Browse products
            </Button>
          </div>
        )}
      </section>

      <Modal
        open={showBreakdownModal}
        onClose={() => setShowBreakdownModal(false)}
        title="Price Breakdown"
        panelClassName="max-w-lg max-h-[85vh] flex flex-col overflow-hidden z-[9999]"
      >
        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 text-[13.5px] text-[#1A1A1A] space-y-4">
          <div className="flex justify-between items-center text-steel pb-2 border-b border-[#E6E6E6]">
            <span>Items Subtotal</span>
            <span className="font-semibold text-ink font-mono">
              {formatMoney(
                estimate?.currency?.symbol ?? totals.currencySymbol,
                estimate
                  ? estimate.originalBaseSubtotal ??
                      Number(estimate.subtotal ?? 0) +
                        Number(estimate.automaticDiscount ?? 0)
                  : totals.subtotal,
              )}
            </span>
          </div>
          {aggregatedDiscounts.length > 0 && (
            <div className="space-y-4 py-1 border-b border-[#E6E6E6]">
              <div className="flex justify-between items-center font-semibold text-[#2A6A40]">
                <span>Applied Discounts</span>
                <span>
                  -
                  {formatMoney(
                    estimate?.currency?.symbol ?? totals.currencySymbol,
                    Number(estimate?.automaticDiscount ?? 0) +
                      Number(
                        appliedCoupon
                          ? (estimate?.couponDiscount ??
                              appliedCoupon.discountAmount)
                          : 0,
                      ),
                  )}
                </span>
              </div>

              {aggregatedDiscounts.map((discount, i) => {
                const savingsPerUnit = Math.max(
                  0,
                  discount.originalUnitPrice - discount.discountedUnitPrice,
                );
                return (
                  <div
                    key={i}
                    className="pl-3 border-l-2 border-[#2A6A40]/30 space-y-1.5"
                  >
                    <div className="font-semibold text-[#2A6A40] text-[13px]">
                      {discount.label}
                    </div>

                    <div className="flex justify-between text-[12.5px] text-steel">
                      <span>Price</span>
                      <span className="font-mono">
                        {formatMoney(
                          estimate?.currency?.symbol ?? totals.currencySymbol,
                          discount.originalUnitPrice,
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-[12.5px] text-steel">
                      <span>Your Price</span>
                      <span className="font-mono">
                        {formatMoney(
                          estimate?.currency?.symbol ?? totals.currencySymbol,
                          discount.discountedUnitPrice,
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between text-[12.5px] text-steel">
                      <span>Quantity</span>
                      <span className="font-mono">{discount.quantity}</span>
                    </div>

                    <div className="flex justify-between items-center text-[12.5px] font-semibold text-[#2A6A40] pt-1">
                      <span>You saved</span>
                      <span>
                        {formatMoney(
                          estimate?.currency?.symbol ?? totals.currencySymbol,
                          discount.amount,
                        )} ({discount.originalUnitPrice > 0 ? Math.round((savingsPerUnit / discount.originalUnitPrice) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                );
              })}

              {appliedCoupon && (
                <div className="pl-3 border-l-2 border-[#2A6A40]/30 space-y-1">
                  <div className="font-semibold text-[#2A6A40] text-[13px]">
                    {appliedCoupon.code} (Promo Coupon)
                  </div>
                  {appliedCoupon.description && (
                    <div className="text-[12.5px] text-steel">
                      {appliedCoupon.description}
                    </div>
                  )}
                  <div className="flex justify-between items-center text-[12.5px] font-semibold text-[#2A6A40] pt-1">
                    <span>You Saved</span>
                    <span>
                      -
                      {formatMoney(
                        estimate?.currency?.symbol ?? totals.currencySymbol,
                        estimate?.couponDiscount ??
                          appliedCoupon.discountAmount,
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center text-ink font-semibold py-1 border-b border-[#E6E6E6]">
            <span>Subtotal</span>
            <span className="font-mono">
              {formatMoney(
                estimate?.currency?.symbol ?? totals.currencySymbol,
                estimate?.subtotal ?? totals.subtotal,
              )}
            </span>
          </div>

          <div className="flex justify-between items-center text-steel">
            <span>{estimate?.taxMode === "EXCLUSIVE" ? "GST (added at checkout)" : "GST (included in price)"}</span>
            <span className="font-mono">
              {formatMoney(
                estimate?.currency?.symbol ?? totals.currencySymbol,
                estimate?.taxAmount ?? 0,
              )}
            </span>
          </div>

          {estimate?.taxBreakdown && estimate.taxBreakdown.length > 0 && (
            <div className="pl-3 border-l-2 border-[#E31E24]/20 text-[12px] text-steel space-y-0.5 my-1">
              {estimate.taxBreakdown.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span>{item.label}</span>
                  <span className="font-mono">
                    {formatMoney(
                      estimate?.currency?.symbol ?? totals.currencySymbol,
                      item.taxAmount,
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pb-1">
            <div className="flex justify-between text-steel">
              <span>Shipping</span>

              <span className="font-mono">
                {selectedShippingOption
                  ? selectedShippingOption.isFree
                    ? "FREE"
                    : formatMoney(
                        estimate?.currency?.symbol ?? totals.currencySymbol,
                        selectedShippingOption.charge,
                      )
                  : estimate?.shippingIsFree
                    ? "FREE"
                    : formatMoney(
                        estimate?.currency?.symbol ?? totals.currencySymbol,
                        estimate?.shippingCharge ?? 0,
                      )}
              </span>
            </div>

            <div className="mt-1 text-[12px] text-steel-2">
              {selectedShippingOption?.provider ??
                estimate?.shippingProvider ??
                "Standard Shipping"}
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="border-t bg-white px-6 py-4 shrink-0">
          <div className="flex justify-between items-center text-[16px] font-bold text-brand pb-3">
            <span>Total Payable</span>
            <span className="text-[18px]">
              {formatMoney(
                estimate?.currency?.symbol ?? totals.currencySymbol,
                totalPayable,
              )}
            </span>
          </div>

          <p className="rounded-md bg-[#F8F9FA] px-3 py-2 text-[11px] leading-relaxed text-steel border border-[#E5E7EB]">
            Prices are calculated sequentially based on applicable pricing
            rules, promotions, and coupons.
          </p>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowBreakdownModal(false)}
              className="rounded-md bg-brand px-5 py-2 text-[13px] font-semibold text-white hover:bg-brand/90 transition-colors shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {validationState && (
        <AddressValidationDialog
          isOpen={validationState.isOpen}
          onClose={() => setValidationState(null)}
          originalAddress={validationState.originalAddress}
          recommendedAddress={validationState.recommendedAddress}
          isValid={validationState.isValid}
          onSelectOriginal={handleSelectOriginal}
          onSelectRecommended={handleSelectRecommended}
        />
      )}
    </Container>
  );
}
