import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const featured = await prisma.product.findMany({
    where: { isFeatured: true },
    select: { 
      id: true, 
      title: true, 
      slug: true, 
      status: true, 
      hasVariants: true, 
      isFeatured: true, 
      deletedAt: true,
      countries: true,
      category: {
        select: {
          id: true,
          name: true,
          status: true,
          countries: true,
        }
      },
      variants: {
        select: {
          id: true,
          status: true,
          countries: true,
        }
      }
    }
  });
  console.log('FEATURED_PRODUCTS_COUNT:', featured.length);
  console.log('FEATURED_PRODUCTS:', JSON.stringify(featured, null, 2));

  const allProducts = await prisma.product.findMany({
    select: { id: true, title: true, slug: true, isFeatured: true, status: true, deletedAt: true }
  });
  console.log('ALL_PRODUCTS:', JSON.stringify(allProducts, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
