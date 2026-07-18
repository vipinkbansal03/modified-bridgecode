import React from "react";

interface SpinnerProps {
  size?: number;
  className?: string;
}

export default function Spinner({
  size = 18,
  className = "",
}: SpinnerProps) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-hidden="true"
    />
  );
}