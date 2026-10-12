import { z } from "zod";

export const customerOrderItemSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  variantId: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  warehouseId: z.string().optional(),
});

export const customerOrderAddressSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  phone: z.string().trim().min(1, "Phone is required"),
  addressLine1: z.string().trim().min(1, "Address line 1 is required"),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  postalCode: z.string().trim().min(1, "Postal code is required"),
  countryCode: z.string().trim().length(2, "Use a 2-letter country code").optional(),
});

export const createCustomerOrderSchema = z.object({
  items: z.array(customerOrderItemSchema).min(1, "Cart must contain at least one item"),
  shippingAddress: customerOrderAddressSchema,
  billingAddress: customerOrderAddressSchema.optional(),
  sameAsShipping: z.boolean().optional(),
  couponCode: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  shippingZoneId: z.string().optional(),
  paymentMethod: z.string().trim().optional(),
});

export type CreateCustomerOrderInput = z.infer<typeof createCustomerOrderSchema>;
