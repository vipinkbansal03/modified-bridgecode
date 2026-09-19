"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { customerApi, syncWishlist } from "@/services/customerApi";

export interface CustomerSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  companyName?: string | null;
  website?: string | null;
  preferredPrescription?: string | null;
  preferredPrescriptionOther?: string | null;
  preferredSlot?: string | null;
  currentPractice?: string | null;
  currentPracticeOther?: string | null;
  usingModernProducts?: boolean;
  status?: string;
  customerType?: string;
  approvalStatus?: string;
  customerRoleId?: string | null;
  customerRole?: { id: string; key: string; name: string } | null;
  tierId?: string | null;
  defaultCountryId?: string | null;
  taxId?: string | null;
  taxIdType?: string | null;
  taxIdStatus?: string | null;
}

type RegisterPayload = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  customerType?: "RETAIL" | "DEALER" | "DOCTOR" | "WHOLESALE" | "STUDENT";
  companyName?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  preferredPrescription?: "MBT" | "ROTH" | "OTHER";
  preferredPrescriptionOther?: string;
  preferredSlot?: "022" | "018";
  currentPractice?: "STUDENT" | "ORTHODONTIST" | "OTHER";
  currentPracticeOther?: string;
  usingModernProducts?: boolean;
  taxId?: string;
  taxIdType?: string;
};

export interface OtpInitiateResponse {
  requiresOtp: true;
  verificationId: string;
  maskedPhone: string;
  cooldownSeconds: number;
  debugOtp?: string;
}

export type LoginResult = { requiresOtp: false } | OtpInitiateResponse;

interface CustomerAuthContextType {
  currentCustomer: CustomerSession | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, redirectTo?: string) => Promise<LoginResult>;
  sendLoginOtp: (phone: string) => Promise<OtpInitiateResponse>;
  verifyLoginOtp: (verificationId: string, otp: string, redirectTo?: string) => Promise<void>;
  initiateRegister: (payload: RegisterPayload) => Promise<OtpInitiateResponse>;
  verifyRegisterOtp: (verificationId: string, otp: string, redirectTo?: string) => Promise<void>;
  resendOtp: (verificationId: string) => Promise<{ verificationId: string; maskedPhone: string; cooldownSeconds: number; debugOtp?: string }>;
  register: (payload: RegisterPayload, redirectTo?: string) => Promise<void>;
  logout: () => void;
  setCustomer: (customer: CustomerSession) => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

function isUsableCustomerToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? "")) as { scope?: string; exp?: number };
    if (payload.scope !== "customer") return false;
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function storeCustomerSession(token: string, customer: CustomerSession) {
  localStorage.setItem("customer_token", token);
  localStorage.setItem("customer_profile", JSON.stringify(customer));
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [currentCustomer, setCurrentCustomer] = useState<CustomerSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const storedToken = localStorage.getItem("customer_token");
    const storedProfile = localStorage.getItem("customer_profile");

    if (storedToken && storedProfile && isUsableCustomerToken(storedToken)) {
      try {
        setToken(storedToken);
        setCurrentCustomer(JSON.parse(storedProfile) as CustomerSession);

        customerApi
          .get("/auth/me")
          .then((res) => {
            if (res.data?.data) {
              setCurrentCustomer(res.data.data);
              localStorage.setItem("customer_profile", JSON.stringify(res.data.data));
            }
          })
          .catch((err) => {
            if (err.response?.status === 401 || err.response?.status === 404) {
              localStorage.removeItem("customer_token");
              localStorage.removeItem("customer_profile");
              setToken(null);
              setCurrentCustomer(null);
            }
          });
      } catch {
        localStorage.removeItem("customer_token");
        localStorage.removeItem("customer_profile");
        setToken(null);
        setCurrentCustomer(null);
      }
    } else {
      localStorage.removeItem("customer_token");
      localStorage.removeItem("customer_profile");
      setToken(null);
      setCurrentCustomer(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem("customer_token");
      localStorage.removeItem("customer_profile");
      setToken(null);
      setCurrentCustomer(null);
      router.push("/login");
    };

    window.addEventListener("customer:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("customer:unauthorized", handleUnauthorized);
    };
  }, [router]);

  const handleWishlistSync = async () => {
    try {
      const raw = localStorage.getItem("guest_wishlist");
      const ids = raw ? JSON.parse(raw) : [];
      if (Array.isArray(ids) && ids.length > 0) {
        await syncWishlist(ids);
        localStorage.removeItem("guest_wishlist");
      }
    } catch (e) {
      console.error("Failed to sync guest wishlist:", e);
    } finally {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    }
  };

  const login = async (email: string, password: string, redirectTo = "/"): Promise<LoginResult> => {
    const res = await customerApi.post("/auth/login", { email, password });
    const data = res.data.data;
    if (data?.requiresOtp) {
      return data as OtpInitiateResponse;
    }
    const { token: jwt, customer } = data as { token: string; customer: CustomerSession };
    storeCustomerSession(jwt, customer);
    setToken(jwt);
    setCurrentCustomer(customer);
    await handleWishlistSync();
    router.push(redirectTo);
    return { requiresOtp: false };
  };

  const verifyLoginOtp = async (verificationId: string, otp: string, redirectTo = "/") => {
    const res = await customerApi.post("/auth/login/verify-otp", { verificationId, otp });
    const { token: jwt, customer } = res.data.data as { token: string; customer: CustomerSession };
    storeCustomerSession(jwt, customer);
    setToken(jwt);
    setCurrentCustomer(customer);
    await handleWishlistSync();
    router.push(redirectTo);
  };

  const initiateRegister = async (payload: RegisterPayload): Promise<OtpInitiateResponse> => {
    const res = await customerApi.post("/auth/register/initiate", payload);
    return res.data.data as OtpInitiateResponse;
  };

  const verifyRegisterOtp = async (verificationId: string, otp: string, redirectTo = "/") => {
    const res = await customerApi.post("/auth/register/verify-otp", { verificationId, otp });
    const { token: jwt, customer } = res.data.data as { token: string; customer: CustomerSession };
    storeCustomerSession(jwt, customer);
    setToken(jwt);
    setCurrentCustomer(customer);
    await handleWishlistSync();
    router.push(redirectTo);
  };

  const resendOtp = async (verificationId: string) => {
    const res = await customerApi.post("/auth/otp/resend", { verificationId });
    return res.data.data as { verificationId: string; maskedPhone: string; cooldownSeconds: number; debugOtp?: string };
  };

  const register = async (payload: RegisterPayload, redirectTo = "/") => {
    const res = await customerApi.post("/auth/register", payload);
    const { token: jwt, customer } = res.data.data as { token: string; customer: CustomerSession };
    storeCustomerSession(jwt, customer);
    setToken(jwt);
    setCurrentCustomer(customer);
    await handleWishlistSync();
    router.push(redirectTo);
  };

  const logout = () => {
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_profile");
    setToken(null);
    setCurrentCustomer(null);
    router.push("/login");
  };

  const sendLoginOtp = async (phone: string): Promise<OtpInitiateResponse> => {
    const res = await customerApi.post("/auth/login/send-otp", { phone });
    return res.data.data as OtpInitiateResponse;
  };

  const setCustomer = (updatedCustomer: CustomerSession) => {
    setCurrentCustomer(updatedCustomer);
    localStorage.setItem("customer_profile", JSON.stringify(updatedCustomer));
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        currentCustomer,
        token,
        isLoading,
        login,
        sendLoginOtp,
        verifyLoginOtp,
        initiateRegister,
        verifyRegisterOtp,
        resendOtp,
        register,
        logout,
        setCustomer,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return ctx;
}
