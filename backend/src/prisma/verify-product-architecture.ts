import { prisma } from "../config/database";
import { publicGetProduct } from "../modules/public/public.service";
import {
  createVariant,
  updateVariant,
  cloneVariant,
  deleteVariant,
  generateVariants,
  getProduct,
} from "../modules/products/products.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const elfin = await publicGetProduct("elfin-bondable-molar-tube");
  assert(elfin.packages.length === 2, "Elfin should expose 2 packages.");
  assert(elfin.attributes.length === 4, "Elfin should expose 4 assigned attributes.");
  assert(elfin.attributes.every((attribute) => attribute.values.length === 2), "Elfin attributes should return only selected allowed values.");
  assert(elfin.variants.length === 32, "Elfin should expose 32 package-aware variants.");
  assert(elfin.variants.every((variant) => variant.package), "Elfin variants should include package metadata.");

  const niti = await publicGetProduct("niti-wire-product");
  assert(niti.packages.length === 0, "NiTi Wire should not expose packages.");
  assert(niti.attributes.length === 3, "NiTi Wire should expose 3 assigned attributes.");
  assert(niti.attributes.find((attribute) => attribute.name === "Size")?.values.length === 3, "NiTi size values should be scoped to selected values.");
  assert(niti.variants.length === 12, "NiTi Wire should expose 12 generated variants.");

  const elfinAdmin = await getProduct(elfin.id);
  const generatedElfin = await generateVariants(elfin.id);
  assert(generatedElfin.length === elfinAdmin.packages.length * 16, "Elfin generation should use selected values across packages only.");

  const nitiAdmin = await getProduct(niti.id);
  const generatedNiti = await generateVariants(niti.id);
  assert(generatedNiti.length === 12, "NiTi generation should use selected values only.");

  const tempPackage = await prisma.productPackage.create({
    data: {
      productId: niti.id,
      title: "Verification Package",
      slug: `verification-package-${Date.now()}`,
      description: "Temporary package for verification script.",
      status: "ACTIVE",
      sortOrder: 99,
    },
  });

  try {
    const sizeAttribute = nitiAdmin.attributes.find((attribute) => attribute.attribute.name === "Size");
    const archAttribute = nitiAdmin.attributes.find((attribute) => attribute.attribute.name === "Arch");
    const packSizeAttribute = nitiAdmin.attributes.find((attribute) => attribute.attribute.name === "Pack Size");
    assert(sizeAttribute && archAttribute && packSizeAttribute, "NiTi assigned attributes are incomplete.");

    const manualVariant = await createVariant(niti.id, {
      packageId: tempPackage.id,
      sku: `VERIFY-${Date.now()}`,
      moq: 4,
      attributeValueIds: [
        sizeAttribute.allowedValues[0].attributeValueId,
        archAttribute.allowedValues[0].attributeValueId,
        packSizeAttribute.allowedValues[0].attributeValueId,
      ],
    });

    assert(manualVariant.package?.id === tempPackage.id, "Manual variant should persist package metadata.");

    const updatedVariant = await updateVariant(niti.id, manualVariant.id, {
      title: `${manualVariant.title} Updated`,
      moq: 8,
    });
    assert(updatedVariant.title.endsWith("Updated"), "Variant update should persist title changes.");
    assert(updatedVariant.moq === 8, "Variant update should persist MOQ changes.");

    const clonedVariant = await cloneVariant(niti.id, manualVariant.id);
    assert(clonedVariant.id !== manualVariant.id, "Variant clone should create a new row.");

    await deleteVariant(niti.id, manualVariant.id);
    const deletedVariant = await prisma.productVariant.findUniqueOrThrow({ where: { id: manualVariant.id } });
    assert(deletedVariant.status === "INACTIVE", "Variant delete should soft delete.");

    await deleteVariant(niti.id, clonedVariant.id);
  } finally {
    await prisma.productPackage.delete({ where: { id: tempPackage.id } });
  }

  console.log("Product architecture verification passed.");
}

main()
  .catch((error) => {
    console.error("Product architecture verification failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
