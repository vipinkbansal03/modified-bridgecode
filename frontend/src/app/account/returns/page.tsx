"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { listCustomerReturns, getCustomerErrorMessage, cancelCustomerReturnRequest } from "@/services/customerApi";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";

interface ReturnRequestItem {
  id: string;
  order: {
    orderNumber: string;
    status: string;
  };
  reason: string;
  refundAmount: number | string;
  status: string;
  createdAt: string;
  orderId: string;
}

export default function CustomerReturnsPage() {
  const { currentCustomer, isLoading: authLoading } = useCustomerAuth();
  const router = useRouter();
  const [returns, setReturns] = useState<ReturnRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [returnIdToCancel, setReturnIdToCancel] = useState<string | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState(false);

  useEffect(() => {
    if (!authLoading && !currentCustomer) {
      router.push("/auth/login?next=/account/returns");
      return;
    }

    if (currentCustomer) {
      listCustomerReturns()
        .then((data) => {
          setReturns(data || []);
        })
        .catch((err) => {
          setError(getCustomerErrorMessage(err, "Failed to load return requests."));
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [currentCustomer, authLoading, router]);

  if (loading || authLoading) {
    return (
      <Container>
        <div className="py-20 text-center text-steel">Loading your return history...</div>
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-8 sm:py-12">
      <Container className="max-w-4xl space-y-6">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-steel hover:text-ink transition-colors"
          >
            <ArrowLeft size={15} />
            <span>Back to Account</span>
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-5">
          <div>
            <h1 className="text-[28px] font-normal tracking-tight text-ink">Returns & Refunds</h1>
            <p className="mt-1.5 text-[14px] text-steel">View history of your submitted product return requests and refund statuses.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-[#F2D5C6] bg-[#FFF5F0] px-4 py-3 text-[13.5px] text-[#8A4D2A]">
            {error}
          </div>
        )}

        {returns.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-12 text-center space-y-3 shadow-sm">
            <p className="text-steel text-[14.5px]">You have not submitted any return requests yet.</p>
            <Button href="/account" variant="outline" className="text-[13px] font-semibold">
              View Order History
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-grey/30 border-b border-line text-[12px] font-bold uppercase tracking-wider text-steel-2">
                    <th className="px-6 py-4">Order #</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">Est. Refund</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Date Requested</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-[13.5px]">
                  {returns.map((ret) => (
                    <tr key={ret.id} className="hover:bg-grey/10 transition-colors">
                      <td className="px-6 py-4 font-semibold text-ink">
                        {ret.order?.orderNumber}
                      </td>
                      <td className="px-6 py-4 text-steel">
                        {ret.reason}
                      </td>
                      <td className="px-6 py-4 font-bold text-ink">
                        ₹{Number(ret.refundAmount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          ret.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : ret.status === "APPROVED"
                            ? "bg-blue-100 text-blue-800"
                            : ret.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : ret.status === "CANCELLED"
                            ? "bg-slate-150 text-slate-600 border border-slate-200"
                            : "bg-rose-100 text-rose-800"
                        }`}>
                          {ret.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-steel">
                        {new Date(ret.createdAt).toLocaleDateString("en-IN", {
                          dateStyle: "medium",
                        })}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {ret.status === "PENDING" && (
                          <button
                            type="button"
                            onClick={() => {
                              setReturnIdToCancel(ret.id);
                              setCancelModalOpen(true);
                            }}
                            className="inline-flex h-8 items-center justify-center rounded-md border border-rose-200 bg-rose-50 px-3 text-[12px] font-semibold text-rose-600 hover:bg-rose-100 transition shadow-sm"
                          >
                            Cancel Request
                          </button>
                        )}
                        <Link
                          href={`/account/orders/${ret.orderId}`}
                          className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-white px-3 text-[12px] font-semibold text-ink hover:bg-grey hover:text-brand transition shadow-sm"
                        >
                          View Order
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Container>

      <Modal
        open={cancelModalOpen}
        onClose={() => {
          if (!cancellingRequest) {
            setCancelModalOpen(false);
            setReturnIdToCancel(null);
          }
        }}
        title="Cancel Return Request"
        footer={
          <>
            <button
              type="button"
              disabled={cancellingRequest}
              onClick={() => {
                setCancelModalOpen(false);
                setReturnIdToCancel(null);
              }}
              className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-white px-4 text-[12.5px] font-semibold text-ink hover:bg-grey transition shadow-sm"
            >
              No, Keep Request
            </button>
            <button
              type="button"
              disabled={cancellingRequest}
              onClick={async () => {
                if (!returnIdToCancel) return;
                setCancellingRequest(true);
                try {
                  await cancelCustomerReturnRequest(returnIdToCancel);
                  setCancelModalOpen(false);
                  setReturnIdToCancel(null);
                  const updated = await listCustomerReturns();
                  setReturns(updated || []);
                } catch (err) {
                  alert("Failed to cancel return request: " + getCustomerErrorMessage(err));
                } finally {
                  setCancellingRequest(false);
                }
              }}
              className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-[12.5px] font-semibold text-white hover:bg-rose-700 transition shadow-sm disabled:opacity-60"
            >
              {cancellingRequest ? "Cancelling..." : "Yes, Cancel Return"}
            </button>
          </>
        }
      >
        <div className="p-6 text-[13.5px] text-steel leading-relaxed">
          Are you sure you want to cancel this return request? This will release the item quantities so you can submit a new return request with updated quantities.
        </div>
      </Modal>
    </div>
  );
}
