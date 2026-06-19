"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";

export interface CategoryCardProps {
  title: string;
  image: string;
  slug: string;
  description?: string;
  productCount?: number;
  /** Text shown for the active "doctor" / "dealer" view toggle on the Categories section. */
  meta?: string;
}

export function CategoryCard({ title, image, slug, productCount, meta }: CategoryCardProps) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2, ease: "easeOut" }}>
      <Link href={`/products?category=${slug}`} className="block">
        <Card>
          <div className="relative h-[190px] w-full bg-grey">
            <Image src={image} alt={title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 25vw" />
          </div>
          <div className="px-5 py-4.5">
            {typeof productCount === "number" && (
              <span className="mb-1.5 block text-[11.5px] uppercase tracking-wide text-steel-2">
                {productCount} SKUs
              </span>
            )}
            <h4 className="text-[16.5px] font-medium text-ink">{title}</h4>
            {meta && <span className="mt-1 block text-[13px] text-steel">{meta}</span>}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
