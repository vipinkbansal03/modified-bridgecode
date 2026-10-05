import { prisma } from "../config/database";

async function main() {
  console.log("\n--- Testing findMany with include and limit = 1000 ---");
  try {
    const data = await prisma.productVariant.findMany({
      where: { deletedAt: null },
      take: 1000,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        product: {
          select: {
            id: true,
            title: true,
            sku: true,
            category: { select: { id: true, name: true, slug: true } },
            media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
          },
        },
        package: { select: { id: true, title: true } },
        countries: { where: { enabled: true }, select: { countryId: true } },
        inventories: { include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
        prices: {
          where: { status: "ACTIVE", deletedAt: null },
          orderBy: [{ currency: { isBase: "desc" } }, { sellingPrice: "asc" }],
          include: { currency: true, country: true },
        },
        attributeValues: {
          include: {
            attribute: { select: { id: true, name: true } },
            attributeValue: { select: { id: true, value: true } },
          },
        },
        _count: { select: { attributeValues: true, countries: true, prices: true } },
      },
    });
    console.log("findMany with limit 1000 SUCCEEDED with count:", data.length);
  } catch (err: any) {
    console.error("findMany with limit 1000 FAILED:", err);
  }
}

main().finally(() => prisma.$disconnect());
