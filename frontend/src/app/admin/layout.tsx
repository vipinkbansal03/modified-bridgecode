import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { AdminToastProvider } from "@/components/admin/AdminComponents";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminToastProvider>
        <div className="admin-scope min-h-screen">
          {children}
        </div>
      </AdminToastProvider>
    </AdminAuthProvider>
  );
}
