const { PrismaClient } = require("@prisma/client");
const { createWarehouse, updateWarehouse } = require("../src/modules/warehouse/warehouse.service");
const { calculateCustomerOrder } = require("../src/modules/customerOrders/customerOrders.service");

const prisma = new PrismaClient();

async function runTest() {
  try {
    // 1. Get India
    const india = await prisma.country.findFirst({ where: { code: "IN" } });
    if (!india) throw new Error("India not found");

    // 2. Try creating India warehouse without GSTIN
    let caughtError = null;
    try {
      await createWarehouse({
        name: "India No GSTIN",
        countryId: india.id,
        status: "ACTIVE",
      });
    } catch (e) {
      caughtError = e;
      console.log("SUCCESS: Blocked creating ACTIVE India warehouse without GSTIN:", e.message);
    }
    if (!caughtError) throw new Error("Failed to block invalid warehouse creation!");

    // 3. Create India warehouse with valid GSTIN
    const whWithGstin = await createWarehouse({
      name: "India Valid GSTIN",
      countryId: india.id,
      status: "ACTIVE",
      gstin: "27AAPFU0939F1Z5", // valid format
      state: "Maharashtra"
    });
    console.log("SUCCESS: Created ACTIVE India warehouse with valid GSTIN.");

    // 4. Create India warehouse bypassing service (to test routing)
    const whWithoutGstin = await prisma.warehouse.create({
      data: {
        name: "India Bypassed No GSTIN",
        countryId: india.id,
        status: "ACTIVE",
        gstin: "",
        state: "Delhi"
      }
    });
    console.log("SUCCESS: Created ACTIVE India warehouse without GSTIN via Prisma directly.");

    // 5. Setup product/variant for test
    const product = await prisma.product.findFirst({ include: { variants: true }});
    const variant = product.variants[0];
    const customer = await prisma.customer.findFirst();

    // 6. Give stock only to the warehouse WITHOUT GSTIN
    await prisma.inventory.create({
      data: {
        variantId: variant.id,
        productId: product.id,
        warehouseId: whWithoutGstin.id,
        stock: 100,
        status: "IN_STOCK"
      }
    });

    // 7. Attempt checkout (should fail because the only warehouse with stock has no GSTIN)
    caughtError = null;
    try {
      await calculateCustomerOrder(customer.id, {
        items: [{ variantId: variant.id, quantity: 1 }],
        countryId: india.id,
        shippingAddress: { state: "Delhi" },
        currencyId: (await prisma.currency.findFirst()).id,
      });
    } catch (e) {
      caughtError = e;
      console.log("SUCCESS: Checkout blocked because eligible warehouse lacks GSTIN:", e.message);
    }
    if (!caughtError) throw new Error("Failed to block checkout for warehouse without GSTIN!");

    // 8. Give stock to the warehouse WITH GSTIN
    await prisma.inventory.create({
      data: {
        variantId: variant.id,
        productId: product.id,
        warehouseId: whWithGstin.id,
        stock: 100,
        status: "IN_STOCK"
      }
    });

    // 9. Attempt checkout again (should succeed and route to whWithGstin)
    const orderDetails = await calculateCustomerOrder(customer.id, {
      items: [{ variantId: variant.id, quantity: 1 }],
      countryId: india.id,
      shippingAddress: { state: "Maharashtra" },
      currencyId: (await prisma.currency.findFirst()).id,
    });
    console.log("SUCCESS: Checkout succeeded. Routed to warehouse:", orderDetails.allocatedWarehouse.name);

    // Cleanup
    await prisma.inventory.deleteMany({ where: { warehouseId: { in: [whWithGstin.id, whWithoutGstin.id] } } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [whWithGstin.id, whWithoutGstin.id] } } });
    
  } catch (e) {
    console.error("TEST FAILED:", e);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
