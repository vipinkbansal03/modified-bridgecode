"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { toast, ToastContainer } from "react-toastify";

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

function ToastContent({ title, message }: { title: string; message?: string }) {
  return (
    <div>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {message && <p className="mt-1 text-[12.5px] leading-relaxed text-steel">{message}</p>}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const isParentMounted = useContext(ToastContainerMountedContext);

  const showToast = useCallback<ToastContextValue["showToast"]>((nextToast, fallbackType = "success") => {
    const toastData =
      typeof nextToast === "string" ? { title: nextToast, type: fallbackType } : nextToast;
    const content = <ToastContent title={toastData.title} message={toastData.message} />;

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
  }, []);

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
            toastClassName="modortho-toast"
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
