"use client";

import Link from "next/link";
import { ClipboardList, History, ShieldCheck } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

export function PracticeUtilityPanel() {
  const { currentCustomer, isLoading } = useCustomerAuth();

  return (
    <aside className="clinical-buy-box rounded-2xl border p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-primary)_10%,white)] p-2 text-[var(--color-primary)]"><History size={19} /></div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-[var(--color-text-secondary)]">Practice utility</p>
          <h2 className="mt-0.5 text-[17px] font-extrabold text-[var(--color-text-primary)]">Reorder past case materials</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--color-text-secondary)]">Rebuild a previous case with current stock, price, and prescription availability.</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={currentCustomer ? "/account?tab=orders" : "/login?returnTo=/account%3Ftab%3Dorders"} className="clinical-cta inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-bold transition">
          <ClipboardList size={16} /> {isLoading ? "Loading workspace…" : currentCustomer ? "View past cases" : "Sign in to reorder"}
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--color-text-secondary)]"><ShieldCheck size={15} className="text-[var(--color-primary)]" /> Latest specifications applied</span>
      </div>
    </aside>
  );
}
