"use client";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { useAdminSettings } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";

const GROUPS = [{ key: "general", label: "General" }, { key: "storage", label: "Storage" }, { key: "payment", label: "Payments" }, { key: "shipping", label: "Shipping" }, { key: "ai", label: "AI / LangChain" }];

export default function SettingsPage() {
  const [group, setGroup] = useState("general");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const { showToast, ToastComponent } = useToast();
  const { data: settings = [], isLoading, refetch } = useAdminSettings(group);

  const handleSave = async () => {
    const updates = Object.entries(edits).map(([key, value]) => ({ key, value }));
    if (!updates.length) { showToast("No changes to save."); return; }
    try { await adminApi.put("/settings", { settings: updates }); showToast("Settings saved."); refetch(); setEdits({}); }
    catch { showToast("Failed.", "error"); }
  };

  return (
    <AdminLayout title="Settings" breadcrumb={[{ label: "Settings" }]}>
      <div className="flex gap-5">
        <aside className="w-44 flex-none">
          <nav className="space-y-1">
            {GROUPS.map((g) => (
              <button key={g.key} onClick={() => setGroup(g.key)} className={cn("w-full text-left rounded-lg px-3.5 py-2.5 text-[13.5px] font-medium transition-colors", group === g.key ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:bg-[#F2F2F2]")}>{g.label}</button>
            ))}
          </nav>
        </aside>
        <div className="flex-1 rounded-xl border border-[#E6E6E6] bg-white p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{GROUPS.find((g) => g.key === group)?.label} Settings</h3>
            <button onClick={handleSave} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">Save Changes</button>
          </div>
          {isLoading ? <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded bg-[#E6E6E6]" />)}</div> : (
            <div className="space-y-4">
              {settings.map((s: { key: string; value: string; isSecret: boolean }) => (
                <AdminInput
                  key={s.key}
                  label={s.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  type={s.isSecret ? "password" : "text"}
                  value={edits[s.key] ?? (s.value === "***" ? "" : s.value)}
                  onChange={(e) => setEdits((prev) => ({ ...prev, [s.key]: e.target.value }))}
                  placeholder={s.isSecret ? "Enter value to update…" : ""}
                />
              ))}
              {settings.length === 0 && <p className="text-[13.5px] text-[#9A9A9A]">No settings in this group yet. Settings are created automatically by backend modules.</p>}
            </div>
          )}
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
