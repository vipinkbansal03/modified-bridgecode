import Link from "next/link";
import { Home, Package } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center bg-gray-50 px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-2xl border border-gray-200 shadow-sm">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-[#E31E24] mx-auto">
          <span className="text-2xl font-black font-mono">404</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[#1A1A1A] tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            The page you are looking for is currently unpublished or does not exist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#E31E24] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs"
          >
            <Home size={15} />
            <span>Go to Homepage</span>
          </Link>
          <Link
            href="/products"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-[#1A1A1A] hover:bg-gray-50 transition-colors shadow-2xs"
          >
            <Package size={15} />
            <span>Browse Products</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
