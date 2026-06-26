import { z } from "zod";

const attributeRole = z.enum(["DROPDOWN", "X_GRID", "Y_GRID"]);
const attributeStatus = z.enum(["ACTIVE", "INACTIVE"]);
const gridRole = z.enum(["ROW", "COLUMN"]);

export const createAttributeSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  role: attributeRole,
  status: attributeStatus.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateAttributeSchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: attributeRole.optional(),
  status: attributeStatus.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1, "At least one item is required."),
});

const valueBaseSchema = z.object({
  value: z.string().trim().min(1, "Value is required.").optional(),
  slug: z.string().trim().min(1).optional(),
  image: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  priceAdjustment: z.number().optional(),
  gridRole: gridRole.nullable().optional(),
  countryId: z.string().nullable().optional(),
  moq: z.number().int().min(0).nullable().optional(),
  tierPrice: z.number().min(0).nullable().optional(),
  dealerPrice: z.number().min(0).nullable().optional(),
  status: attributeStatus.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const createValueSchema = valueBaseSchema.extend({
  value: z.string().trim().min(1, "Value is required."),
});

export const updateValueSchema = valueBaseSchema;
