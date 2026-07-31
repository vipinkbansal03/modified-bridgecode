"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { customerApi } from "@/services/customerApi";

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
  customerType?: "RETAIL" | "DEALER" | "DOCTOR" | "WHOLESALE";
  companyName?: string;
  website?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
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

interface CustomerAuthContextType {
  currentCustomer: CustomerSession | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string, redirectTo?: string) => Promise<void>;
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

  useEffect(() => {
    const storedToken = localStorage.getItem("customer_token");
    const storedProfile = localStorage.getItem("customer_profile");

    if (storedToken && storedProfile && isUsableCustomerToken(storedToken)) {
      try {
        setToken(storedToken);
        setCurrentCustomer(JSON.parse(storedProfile) as CustomerSession);
      } catch {
        localStorage.removeItem("customer_token");
        localStorage.removeItem("customer_profile");
      }
    } else {
      localStorage.removeItem("customer_token");
      localStorage.removeItem("customer_profile");
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string, redirectTo = "/") => {
    const res = await customerApi.post("/auth/login", { email, password });
    const { token: jwt, customer } = res.data.data as { token: string; customer: CustomerSession };
    storeCustomerSession(jwt, customer);
    setToken(jwt);
    setCurrentCustomer(customer);
    router.push(redirectTo);
  };

  const register = async (payload: RegisterPayload, redirectTo = "/") => {
    const res = await customerApi.post("/auth/register", payload);
    const { token: jwt, customer } = res.data.data as { token: string; customer: CustomerSession };
    storeCustomerSession(jwt, customer);
    setToken(jwt);
    setCurrentCustomer(customer);
    router.push(redirectTo);
  };

  const logout = () => {
    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_profile");
    setToken(null);
    setCurrentCustomer(null);
    router.push("/login");
  };

  const setCustomer = (updatedCustomer: CustomerSession) => {
    setCurrentCustomer(updatedCustomer);
    localStorage.setItem("customer_profile", JSON.stringify(updatedCustomer));
  };

  return (
    <CustomerAuthContext.Provider value={{ currentCustomer, token, isLoading, login, register, logout, setCustomer }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used inside CustomerAuthProvider");
  return ctx;
}
