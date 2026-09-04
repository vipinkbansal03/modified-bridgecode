"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { toast, ToastContainer } from "react-toastify";
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/utils/cn";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastMessage = {
  title: string;
  message?: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (toastMessage: ToastMessage | string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const ToastContainerMountedContext = createContext<boolean>(false);

function ToastContent({
  title,
  message,
  type,
}: {
  title: string;
  message?: string;
  type: ToastType;
}) {
  const Icon =
    type === "error"
      ? AlertCircle
      : type === "warning"
      ? AlertTriangle
      : type === "info"
      ? Info
      : CheckCircle2;

  const iconColorClass =
    type === "error"
      ? "text-[#E31E24]"
      : type === "warning"
      ? "text-[#F08804]"
      : type === "info"
      ? "text-[#1A1A1A]"
      : "text-[#00A859]";

  return (
    <div className="flex items-start gap-3">
      <div className={cn("mt-0.5 shrink-0", iconColorClass)}>
        <Icon size={18} className="stroke-[2.2]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold leading-snug text-[#1A1A1A]">
          {title}
        </p>
        {message && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#6B6B6B]">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const isParentMounted = useContext(ToastContainerMountedContext);

  const showToast = useCallback<ToastContextValue["showToast"]>(
    (nextToast, fallbackType = "success") => {
      const toastData =
        typeof nextToast === "string"
          ? { title: nextToast, type: fallbackType }
          : nextToast;

      const content = (
        <ToastContent
          title={toastData.title}
          message={toastData.message}
          type={toastData.type}
        />
      );

      if (toastData.type === "error") {
        toast.error(content);
        return;
      }

      if (toastData.type === "warning") {
        toast.warning(content);
        return;
      }

      if (toastData.type === "info") {
        toast.info(content);
        return;
      }

      toast.success(content);
    },
    [],
  );

  return (
    <ToastContainerMountedContext.Provider value={true}>
      <ToastContext.Provider value={{ showToast }}>
        {children}
        {!isParentMounted && (
          <ToastContainer
            position="top-right"
            autoClose={4200}
            hideProgressBar={false}
            newestOnTop
            closeOnClick={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            icon={false}
            toastClassName="modortho-toast"
            style={{ zIndex: 100050 }}
          />
        )}
      </ToastContext.Provider>
    </ToastContainerMountedContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return { showToast: context.showToast, ToastComponent: null as ReactNode };
}
