import React from "react";
import Spinner from "./Spinner";

interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export default function LoadingButton({
  loading = false,
  loadingText = "Loading...",
  children,
  disabled,
  className = "",
  ...props
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || disabled}
      className={className}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner size={16} />
          <span>{loadingText}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}