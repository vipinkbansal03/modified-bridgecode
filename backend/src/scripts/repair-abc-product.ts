/**
 * One-off repair for product ABC:
 * - Archive mismatched variants (e.g. Prescription-only)
 * - Generate Size (.012/.014) × package variants from mapped attributes
 * - Enable product countries on all variants
 * - Copy product-level country prices onto variants
 * - Ensure base inventory exists
 *
 * Run: npx tsx src/scripts/repair-abc-product.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateVariants } from "../modules/products/products.service";

const prisma = new PrismaClient();
const PRODUCT_SLUG = process.env.REPAIR_PRODUCT_SLUG || "abc";

async function main() {
  const product = await prisma.product.findFirst({
    where: { slug: PRODUCT_SLUG, deletedAt: null },
    include: {
      packages: { where: { status: "ACTIVE" } },
      attributes: {
        include: {
          attribute: true,
          allowedValues: { include: { attributeValue: true } },
        },
      },
      variants: {
        include: {
          attributeValues: { include: { attribute: true, attributeValue: true } },
          prices: true,
        },
      },
      countries: { where: { enabled: true } },
      prices: { where: { status: "ACTIVE", variantId: null } },
    },
  });

  if (!product) {
    throw new Error(`Product slug "${PRODUCT_SLUG}" not found.`);
  }

  console.log(`Repairing product ${product.title} (${product.id})`);

  const mappedAttributeNames = product.attributes.map((row) => row.attribute.name);
  console.log("Mapped attributes:", mappedAttributeNames.join(", ") || "(none)");

  // Archive variants whose attribute set does not match current product mappings.
  const mappedAttributeIds = new Set(product.attributes.map((row) => row.attributeId));
  let archived = 0;
  for (const variant of product.variants) {
    const variantAttrIds = new Set(variant.attributeValues.map((row) => row.attributeId));
    const mismatched =
      mappedAttributeIds.size > 0 &&
      (variantAttrIds.size !== mappedAttributeIds.size ||
        [...mappedAttributeIds].some((id) => !variantAttrIds.has(id)));

    if (mismatched && variant.status === "ACTIVE") {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { status: "INACTIVE" },
      });
      archived += 1;
      console.log(`Archived mismatched variant: ${variant.title} (${variant.sku})`);
    }
  }

  const packageIds = product.packages.map((pkg) => pkg.id);
  const attributes = product.attributes
    .map((mapping) => ({
      attributeId: mapping.attributeId,
      attributeValueIds: mapping.allowedValues.map((allowed) => allowed.attributeValueId),
    }))
    .filter((group) => group.attributeValueIds.length > 0);

  if (!attributes.length) {
    throw new Error("Product has no mapped attribute values. Map Product Attributes first.");
  }

  const generated = await generateVariants(product.id, {
    packageIds,
    attributes,
  });
  console.log(`Generated/ensured ${generated.length} variants`);

  const activeVariants = await prisma.productVariant.findMany({
    where: { productId: product.id, status: "ACTIVE" },
    select: { id: true, title: true, sku: true },
  });

  // Sync country availability from product → variants
  const enabledCountryIds = product.countries.map((row) => row.countryId);
  for (const variant of activeVariants) {
    for (const countryId of enabledCountryIds) {
      await prisma.variantCountry.upsert({
        where: { variantId_countryId: { variantId: variant.id, countryId } },
        update: { enabled: true },
        create: { variantId: variant.id, countryId, enabled: true },
      });
    }
  }
  console.log(`Enabled ${enabledCountryIds.length} countries on ${activeVariants.length} variants`);

  // Copy product-level prices onto variants missing country prices
  let pricesCopied = 0;
  for (const productPrice of product.prices) {
    for (const variant of activeVariants) {
      const existing = await prisma.productPrice.findFirst({
        where: {
          productId: product.id,
          variantId: variant.id,
          countryId: productPrice.countryId,
        },
      });
      if (existing) continue;

      await prisma.productPrice.create({
        data: {
          productId: product.id,
          variantId: variant.id,
          countryId: productPrice.countryId,
          currencyId: productPrice.currencyId,
          mrp: productPrice.mrp,
          sellingPrice: productPrice.sellingPrice,
          dealerPrice: productPrice.dealerPrice,
          distributorPrice: productPrice.distributorPrice,
          taxPercentage: productPrice.taxPercentage,
          status: "ACTIVE",
        },
      });
      pricesCopied += 1;
    }
  }
  console.log(`Copied ${pricesCopied} variant country prices`);

  // Ensure base inventory rows exist with usable stock for testing
  for (const variant of activeVariants) {
    const base = await prisma.inventory.findFirst({
      where: { variantId: variant.id, countryId: null },
    });
    if (!base) {
      await prisma.inventory.create({
        data: { productId: product.id, variantId: variant.id, stock: 50, status: "IN_STOCK" },
      });
    } else if (base.stock <= 0) {
      await prisma.inventory.update({
        where: { id: base.id },
        data: { stock: 50, status: "IN_STOCK" },
      });
    }
  }

  console.log("Repair complete:");
  console.log({
    archived,
    activeVariants: activeVariants.map((v) => ({ title: v.title, sku: v.sku })),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
