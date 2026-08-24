import "./config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    include: {
      variants: {
        include: {
          countries: {
            include: { country: true }
          },
          attributeValues: {
            include: {
              attribute: true,
              attributeValue: true
            }
          }
        }
      },
      countries: {
        include: { country: true }
      }
    }
  });

  console.log("=== Products in DB ===");
  products.forEach(p => {
    console.log(`\nProduct: ${p.title} (slug: ${p.slug})`);
    console.log(`Enabled in countries: ${p.countries.map(c => `${c.country.code} (enabled: ${c.enabled})`).join(", ") || "None (so visible everywhere)"}`);
    console.log(`Variants (${p.variants.length}):`);
    p.variants.forEach(v => {
      console.log(`  - Variant: ${v.title} (status: ${v.status})`);
      console.log(`    Enabled in countries: ${v.countries.map(c => `${c.country.code} (enabled: ${c.enabled})`).join(", ")}`);
      console.log(`    Attributes:`);
      v.attributeValues.forEach(av => {
        console.log(`      * ${av.attribute.name}: ${av.attributeValue.value}`);
      });
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
