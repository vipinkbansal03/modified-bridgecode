"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { CheckCircle, MailWarning } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailParam);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [alreadyUnsubscribed, setAlreadyUnsubscribed] = useState(false);

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [emailParam]);

  const handleUnsubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setStatus("error");
      setMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    try {
      const response = await apiClient.post("/newsletter/unsubscribe", { email });
      const isAlready = !!response.data?.data?.alreadyUnsubscribed;
      setAlreadyUnsubscribed(isAlready);
      setStatus("success");
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Failed to unsubscribe. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div className="mx-auto max-w-[480px] rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-6">
          <CheckCircle size={28} />
        </span>
        <h2 className="text-[24px] font-semibold text-ink mb-3">
          {alreadyUnsubscribed ? "Already Unsubscribed" : "Unsubscribed Successfully"}
        </h2>
        <p className="text-[15px] leading-relaxed text-steel mb-6">
          {alreadyUnsubscribed ? (
            <span>You have already unsubscribed from the newsletter.</span>
          ) : (
            <span>
              The email <strong className="text-ink">{email}</strong> has been removed from our newsletter subscription list. You will no longer receive marketing communications from us.
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => window.location.href = "/"}
          className="inline-flex items-center justify-center rounded-full bg-ink px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-ink/80"
        >
          Return to Home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[480px] rounded-3xl border border-line bg-white p-8 shadow-sm">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#E31E24] mb-6">
        <MailWarning size={28} />
      </span>
      <h2 className="text-[24px] font-semibold text-ink text-center mb-2">Unsubscribe</h2>
      <p className="text-[14.5px] leading-relaxed text-steel text-center mb-6">
        Are you sure you want to unsubscribe from the Modern Orthodontics newsletter? Confirm your email address below.
      </p>

      <form onSubmit={handleUnsubscribe} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-[12.5px] font-semibold text-ink mb-1.5 uppercase tracking-wide">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@company.com"
            disabled={status === "loading"}
            className="h-11 w-full rounded-md border border-[#E6E6E6] bg-white px-3.5 text-[14px] text-ink outline-none focus:border-[#E31E24] disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>

        {status === "error" && (
          <p className="text-[13px] font-medium text-[#E31E24]">{message}</p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full flex h-11 items-center justify-center rounded-md bg-[#E31E24] text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:opacity-60"
        >
          {status === "loading" ? "Processing..." : "Confirm Unsubscribe"}
        </button>
      </form>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <main className="bg-gray-50/50 py-6 lg:py-[34px] min-h-[60vh] flex items-center">
      <Container className="w-full">
        <Suspense fallback={
          <div className="text-center text-steel py-8 text-[15px] font-medium">
            Loading...
          </div>
        }>
          <UnsubscribeContent />
        </Suspense>
      </Container>
    </main>
  );
}
