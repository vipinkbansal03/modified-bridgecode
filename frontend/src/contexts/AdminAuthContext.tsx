"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { adminApi } from "@/services/adminApi";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

interface AuthContextType {
  user: AdminUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isReady: boolean;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("admin_token");

      if (!storedToken) {
        if (!active) return;
        setIsLoading(false);
        setIsReady(true);
        return;
      }

      try {
        const res = await adminApi.get("/auth/me", {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (!active) return;
        setToken(storedToken);
        setUser(res.data.data);
      } catch {
        localStorage.removeItem("admin_token");
        if (!active) return;
        setToken(null);
        setUser(null);
      } finally {
        if (!active) return;
        setIsLoading(false);
        setIsReady(true);
      }
    };

    void initializeAuth();

    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const res = await adminApi.post("/auth/login", { email, password });
    const { token: jwt, user: me } = res.data.data;
    localStorage.setItem("admin_token", jwt);
    setToken(jwt);
    setUser(me);
    setIsReady(true);
    router.push("/admin/dashboard");
  };

  const logout = async () => {
    await adminApi.post("/auth/logout").catch(() => {});
    localStorage.removeItem("admin_token");
    setToken(null);
    setUser(null);
    setIsReady(true);
    router.push("/admin/login");
  };

  const hasPermission = (perm: string) => {
    if (!user) return false;
    return user.permissions.includes("*") || user.permissions.includes(perm);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, isReady, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
}
