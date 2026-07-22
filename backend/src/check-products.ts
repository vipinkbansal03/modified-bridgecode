import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: {
      variants: {
        where: { status: "ACTIVE" },
        include: {
          attributeValues: {
            include: { attribute: true }
          }
        }
      }
    }
  });

  console.log("=== Active Products and Attributes ===");
  products.forEach(p => {
    console.log(`Product: ${p.title} (${p.slug})`);
    const attrs = new Set<string>();
    p.variants.forEach(v => {
      v.attributeValues.forEach(av => attrs.add(av.attribute.name));
    });
    console.log(`Active Attributes: ${Array.from(attrs).join(", ") || "None"}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
