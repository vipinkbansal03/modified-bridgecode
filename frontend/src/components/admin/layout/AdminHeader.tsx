"use client";

import { Menu, Bell, LogOut, ChevronRight } from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface AdminHeaderProps {
  title: string;
  breadcrumb?: { label: string; href?: string }[];
  onMenuOpen: () => void;
}

export function AdminHeader({ title, breadcrumb, onMenuOpen }: AdminHeaderProps) {
  const { user, logout } = useAdminAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-[#E6E6E6] bg-white px-5">
      <div className="flex items-center gap-4">
        <button onClick={onMenuOpen} className="lg:hidden text-[#6B6B6B] hover:text-[#1A1A1A]">
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-[15px] font-semibold text-[#1A1A1A]">{title}</h1>
          {breadcrumb && breadcrumb.length > 0 && (
            <div className="flex items-center gap-1 text-[11.5px] text-[#9A9A9A]">
              <span>Admin</span>
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight size={10} />
                  {crumb.href ? (
                    <a href={crumb.href} className="hover:text-[#1A1A1A]">{crumb.label}</a>
                  ) : (
                    <span className="text-[#1A1A1A]">{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-[#F2F2F2] text-[#6B6B6B]">
          <Bell size={16} />
        </button>
        <div className="flex items-center gap-2.5 border-l border-[#E6E6E6] pl-3">
          <div className="text-right hidden sm:block">
            <div className="text-[13px] font-medium text-[#1A1A1A]">{user?.name}</div>
            <div className="text-[11px] text-[#9A9A9A]">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-1.5 text-[12.5px] font-medium text-[#6B6B6B] hover:bg-[#F2F2F2]"
          >
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>
    </header>
  );
}
