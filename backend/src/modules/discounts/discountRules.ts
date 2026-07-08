import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

export type DiscountRuleKind = "TIER" | "MOQ" | "PROMOTIONAL";

export const DISCOUNT_RULE_KINDS = ["TIER", "MOQ", "PROMOTIONAL"] as const;

let promotionalSupportPromise: Promise<boolean> | null = null;

export function isDiscountRuleKind(value: string): value is DiscountRuleKind {
  return (DISCOUNT_RULE_KINDS as readonly string[]).includes(value);
}

export async function supportsPromotionalDiscountType() {
  if (!promotionalSupportPromise) {
    promotionalSupportPromise = prisma
      .$queryRaw<{ supported: boolean }[]>`
        SELECT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'DiscountRuleType'
            AND e.enumlabel = 'PROMOTIONAL'
        ) AS supported
      `
      .then((rows) => Boolean(rows[0]?.supported))
      .catch(() => false);
  }

  return promotionalSupportPromise;
}

export async function safeDiscountRuleTypeFilter(type: string | null | undefined): Promise<Prisma.DiscountWhereInput> {
  const normalized = type?.trim().toUpperCase() ?? "";
  if (!normalized) return {};
  if (!isDiscountRuleKind(normalized)) {
    throw new Error("Invalid discount type.");
  }

  if (normalized === "PROMOTIONAL" && !(await supportsPromotionalDiscountType())) {
    return { id: { in: [] } };
  }

  return { type: normalized as DiscountRuleKind };
}
