"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, RefreshCw, Smartphone } from "lucide-react";
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
      panelClassName="p-6 md:p-8 rounded-2xl"
    >
      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4 shadow-inner">
          <Smartphone className="w-7 h-7" />
        </div>

        {/* Header */}
        <h3 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h3>
        <p className="text-sm text-gray-500 mt-2 max-w-sm">
          {subtitle || (
            <>
              We have sent a 6-digit verification code to{" "}
              <span className="font-semibold text-gray-800">{maskedPhone}</span>
            </>
          )}
        </p>

        {/* Development Helper Badge */}
        {debugOtp && (
          <div className="mt-3 px-3 py-1 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 font-mono">
            Dev Mode Code: <span className="font-bold text-amber-900">{debugOtp}</span>
          </div>
        )}

        {/* 6 Digit Input Group */}
        <div className="flex justify-center items-center gap-2 sm:gap-3 my-6" onPaste={handlePaste}>
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
              className={`w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold rounded-xl border transition-all outline-none ${
                error
                  ? "border-red-400 bg-red-50/50 text-red-900 focus:border-red-600 focus:ring-2 focus:ring-red-200"
                  : digit
                    ? "border-gray-900 bg-white text-gray-900 shadow-xs"
                    : "border-gray-200 bg-gray-50/70 text-gray-900 focus:border-red-600 focus:bg-white focus:ring-2 focus:ring-red-100"
              }`}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="w-full text-xs text-red-600 bg-red-50 py-2 px-3 rounded-lg font-medium mb-4 text-center border border-red-100 animate-fadeIn">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <Button
            type="button"
            variant="primary"
            className="w-full h-11 text-base font-semibold shadow-sm justify-center"
            disabled={!isComplete || isVerifying}
            onClick={() => handleVerify()}
          >
            {isVerifying ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Verifying...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" /> Verify & Continue
              </span>
            )}
          </Button>

          {/* Resend OTP */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 px-1">
            <span>Didn't receive the code?</span>
            {cooldown > 0 ? (
              <span className="font-semibold text-gray-400">
                Resend in <span className="font-mono text-gray-700">{cooldown}s</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="font-semibold text-red-600 hover:text-red-700 hover:underline transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
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
