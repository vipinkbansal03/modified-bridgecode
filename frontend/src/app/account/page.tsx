"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User } from "lucide-react";
import { useCustomerLogout, useCustomerMe } from "@/hooks/api/useCustomerLogin";

export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: customer, isLoading, isError } = useCustomerMe();
  const logoutMutation = useCustomerLogout();

  useEffect(() => {
    if (!isLoading && isError) {
      router.replace("/login");
    }
  }, [isError, isLoading, router]);

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        queryClient.removeQueries({ queryKey: ["customer", "me"] });
        router.replace("/login");
      },
    });
  }

  if (isLoading || !customer) {
    return (
      <main className="flex min-h-[calc(100svh-130px)] items-center justify-center bg-[#F7F7F7] px-5 py-12">
        <p className="text-[14px] text-[#6B6B6B]">Loading account...</p>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-130px)] bg-[#F7F7F7] px-5 py-12">
      <div className="mx-auto max-w-[760px] rounded-2xl border border-[#E8E8E8] bg-white p-6 shadow-[0_12px_35px_rgba(0,0,0,0.06)] sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E31E24] text-white">
              <User size={21} />
            </div>
            <div>
              <h1 className="text-[24px] font-semibold text-[#1A1A1A]">
                My account
              </h1>
              <p className="text-[14px] text-[#6B6B6B]">
                Welcome back, {customer.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-[#D8D8D8] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#333] transition-colors hover:border-[#999] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={16} />
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#EEEEEE] bg-[#FAFAFA] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#888]">
              Name
            </p>
            <p className="mt-1 text-[15px] font-medium text-[#1A1A1A]">
              {customer.name}
            </p>
          </div>
          <div className="rounded-xl border border-[#EEEEEE] bg-[#FAFAFA] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#888]">
              Email
            </p>
            <p className="mt-1 text-[15px] font-medium text-[#1A1A1A]">
              {customer.email}
            </p>
          </div>
          <div className="rounded-xl border border-[#EEEEEE] bg-[#FAFAFA] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#888]">
              Account type
            </p>
            <p className="mt-1 text-[15px] font-medium text-[#1A1A1A]">
              {customer.role.name}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
