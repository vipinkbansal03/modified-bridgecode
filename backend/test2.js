const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const res = await prisma.inventory.upsert({
      where: {
        variantId_warehouseId: {
          variantId: "test_var_123",
          warehouseId: null
        }
      },
      create: {
        productId: "test_prod_123",
        variantId: "test_var_123",
        warehouseId: null,
        stock: 0
      },
      update: {}
    });
    console.log("Success with null");
  } catch(e) {
    console.log("Error with null:", e.message);
  }
}
run().then(() => prisma.$disconnect());
