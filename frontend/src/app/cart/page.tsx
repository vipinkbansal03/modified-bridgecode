import type { Metadata } from "next";
import { CartClient } from "./CartClient";

export const metadata: Metadata = {
  title: "Shopping Cart | Modern Orthodontics",
  description: "Review and manage your selected orthodontic products, quantities, and fulfillment preferences before checkout.",
};

export default function CartPage() {
  return <CartClient />;
}
