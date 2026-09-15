"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, RefreshCw, Smartphone, AlertCircle, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface OtpVerificationModalProps {
  open: boolean;
  onClose: () => void;
  maskedPhone: string;
  debugOtp?: string;
  initialCooldown?: number;
  onVerify: (otp: string) => Promise<void>;
  onResend: () => Promise<{ cooldownSeconds?: number; debugOtp?: string } | void>;
  title?: string;
  subtitle?: string;
}

export default function OtpVerificationModal({
  open,
  onClose,
  maskedPhone,
  debugOtp: initialDebugOtp,
  initialCooldown = 60,
  onVerify,
  onResend,
  title = "Verify Your Mobile Number",
  subtitle,
}: OtpVerificationModalProps) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugOtp, setDebugOtp] = useState<string | undefined>(initialDebugOtp);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setDigits(["", "", "", "", "", ""]);
      setError(null);
      setCooldown(initialCooldown);
      setDebugOtp(initialDebugOtp);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    }
  }, [open, initialCooldown, initialDebugOtp]);

  // Countdown timer
  useEffect(() => {
    if (!open || cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [open, cooldown]);

  const handleDigitChange = (index: number, value: string) => {
    // Keep only numeric characters
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    // Single digit input
    const digit = clean.slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(null);

    // Auto-advance to next input
    if (index < 5 && digit) {
      inputRefs.current[index + 1]?.focus();
    }

    // If all digits are filled, automatically submit
    const fullOtp = next.join("");
    if (fullOtp.length === 6) {
      handleVerify(fullOtp);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || "";
    }
    setDigits(next);
    setError(null);

    const targetIndex = Math.min(5, pasted.length);
    inputRefs.current[targetIndex]?.focus();

    if (pasted.length === 6) {
      handleVerify(pasted);
    }
  };

  const handleVerify = async (otpToVerify?: string) => {
    const code = otpToVerify || digits.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifying(true);
    setError(null);
    try {
      await onVerify(code);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Invalid or expired OTP code.";
      setError(msg);
      // Highlight error on inputs
      inputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    try {
      const result = await onResend();
      setCooldown(result && typeof result === "object" && result.cooldownSeconds ? result.cooldownSeconds : 60);
      if (result && typeof result === "object" && result.debugOtp) {
        setDebugOtp(result.debugOtp);
      }
      setDigits(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to resend OTP. Please try again.";
      setError(msg);
    } finally {
      setIsResending(false);
    }
  };

  const isComplete = digits.every((d) => d.length === 1);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      hideFooter
      hideCloseButton
      panelClassName="rounded-2xl max-w-[440px] overflow-hidden"
      bodyClassName="p-5 sm:p-6"
    >
      <div className="relative flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-1 -right-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#E31E24] ring-4 ring-red-50/70 flex items-center justify-center mb-2.5 shadow-inner">
          <Smartphone className="w-6 h-6" />
        </div>

        {/* Header */}
        <h3 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h3>
        <p className="text-[13px] text-gray-500 mt-1.5 max-w-xs leading-relaxed">
          {subtitle || (
            <>
              Please enter the 6-digit verification code sent to{" "}
              <span className="inline-flex items-center gap-1 font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md font-mono text-[12.5px] mt-1">
                {maskedPhone}
              </span>
            </>
          )}
        </p>

        {/* Test Mode Helper Banner */}
        {debugOtp && (
          <div className="mt-4 w-full rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-left shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[11.5px] font-bold text-amber-900 uppercase tracking-wide">Test Mode OTP</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const otpDigits = debugOtp.split("").slice(0, 6);
                  setDigits(otpDigits);
                  setError(null);
                  handleVerify(debugOtp);
                }}
                className="cursor-pointer rounded-md bg-amber-600 hover:bg-amber-700 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors shadow-2xs active:scale-95"
              >
                Auto-fill & Verify
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-bold tracking-widest text-amber-950 bg-white border border-amber-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                {debugOtp}
              </span>
              <span className="text-[11.5px] text-amber-800">
                (Standard test code <code className="font-mono font-bold text-amber-950">123456</code> is also accepted)
              </span>
            </div>
          </div>
        )}

        {/* 6 Digit Input Group */}
        <div className="flex justify-center items-center gap-2 sm:gap-2.5 my-5" onPaste={handlePaste}>
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className={`w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-2xl font-bold rounded-xl border transition-all outline-none ${
                error
                  ? "border-red-400 bg-red-50/50 text-red-900 focus:border-red-600 focus:ring-4 focus:ring-red-100"
                  : digit
                    ? "border-gray-900 bg-white text-gray-900 shadow-xs"
                    : "border-gray-200 bg-gray-50/70 text-gray-900 hover:border-gray-300 focus:border-[#E31E24] focus:bg-white focus:ring-4 focus:ring-[#E31E24]/10"
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full flex items-center justify-center gap-2 text-xs text-red-700 bg-red-50 py-2.5 px-3 rounded-xl font-medium mb-4 border border-red-200 shadow-2xs animate-fadeIn">
            <AlertCircle size={15} className="shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            disabled={!isComplete || isVerifying}
            onClick={() => handleVerify()}
            className="w-full h-11 sm:h-12 flex items-center justify-center gap-2 rounded-pill bg-[#E31E24] hover:bg-[#B5151B] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold text-[14px] shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4.5 h-4.5" /> Verify & Continue
              </span>
            )}
          </button>

          {/* Resend OTP */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-3 px-1 border-t border-gray-100 w-full mt-1">
            <span>Didn't receive the code?</span>
            {cooldown > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                Resend in <span className="font-mono text-gray-700">{cooldown}s</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="font-semibold text-[#E31E24] hover:text-[#B5151B] hover:underline transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                {isResending && <RefreshCw className="w-3 h-3 animate-spin" />}
                Resend Code
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
