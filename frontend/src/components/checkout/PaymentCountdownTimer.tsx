"use client";

import { useEffect, useState, useRef } from "react";
import { Clock, AlertTriangle } from "lucide-react";

interface PaymentCountdownTimerProps {
  expiresAt?: string | Date | null;
  initialSecondsRemaining?: number | null;
  onExpire?: () => void;
}

export function PaymentCountdownTimer({
  expiresAt,
  initialSecondsRemaining,
  onExpire,
}: PaymentCountdownTimerProps) {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Calculate authoritative target timestamp (epoch ms)
  const targetEpochRef = useRef<number | null>(null);

  const calculateTarget = () => {
    if (initialSecondsRemaining != null && initialSecondsRemaining > 0) {
      return Date.now() + initialSecondsRemaining * 1000;
    }
    if (expiresAt) {
      const parsed = new Date(expiresAt).getTime();
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return null;
  };

  if (targetEpochRef.current === null) {
    targetEpochRef.current = calculateTarget();
  }

  const computeSecondsRemaining = (): number => {
    if (!targetEpochRef.current) return 0;
    const diffMs = targetEpochRef.current - Date.now();
    return Math.max(0, Math.ceil(diffMs / 1000));
  };

  const [secondsLeft, setSecondsLeft] = useState<number>(() => computeSecondsRemaining());
  const hasExpiredRef = useRef(false);

  // Sync if props update dynamically
  useEffect(() => {
    const nextTarget = calculateTarget();
    if (nextTarget !== null) {
      targetEpochRef.current = nextTarget;
      const updated = computeSecondsRemaining();
      setSecondsLeft(updated);
      if (updated <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
    }
  }, [expiresAt, initialSecondsRemaining]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      if (!hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpireRef.current?.();
      }
      return;
    }

    const interval = setInterval(() => {
      const remaining = computeSecondsRemaining();
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          onExpireRef.current?.();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const isExpiringSoon = secondsLeft > 0 && secondsLeft <= 60;
  const isExpired = secondsLeft === 0;

  if (isExpired) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] font-medium text-red-700">
        <AlertTriangle size={16} className="text-red-600" />
        <span>Payment reservation window has expired. Reserved inventory was returned.</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-[13px] transition-colors ${
        isExpiringSoon
          ? "border-amber-300 bg-amber-50 text-amber-900 animate-pulse"
          : "border-blue-200 bg-blue-50 text-blue-900"
      }`}
    >
      <div className="flex items-center gap-2">
        <Clock size={15} className={isExpiringSoon ? "text-amber-600" : "text-blue-600"} />
        <span className="font-medium">Payment Reservation Window:</span>
      </div>
      <span className="font-mono text-[14px] font-bold tracking-wide">
        {formattedTime}
      </span>
    </div>
  );
}
