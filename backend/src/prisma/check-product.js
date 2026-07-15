const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { slug: "elfin-bondable-molar-tube" }
  });
  console.log("=== Product details ===");
  console.log("ID:", product?.id);
  console.log("Title:", product?.title);
  console.log("Highlights:", product?.highlights);
  console.log("Technical Specs:", product?.technicalSpecs);
  console.log("Warranty:", product?.warranty);
  console.log("Primary Features:", product?.primaryFeatures);
}

main().catch(console.error).finally(() => prisma.$disconnect());
