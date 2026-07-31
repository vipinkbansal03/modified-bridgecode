import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting warehouse backfill migration...");

  // 1. Fetch global settings
  const shipFromStateSetting = await prisma.setting.findFirst({ where: { key: "tax.ship_from_state" } });
  const sellerGstinSetting = await prisma.setting.findFirst({ where: { key: "tax.seller_gstin" } });

  const defaultIndiaState = shipFromStateSetting?.value || "Punjab";
  const defaultIndiaGstin = sellerGstinSetting?.value || null;

  // 2. Find all unique country IDs currently in Inventory
  const inventoriesWithCountry = await prisma.inventory.findMany({
    where: { countryId: { not: null } },
    select: { countryId: true },
    distinct: ["countryId"],
  });

  const uniqueCountryIds = inventoriesWithCountry.map(i => i.countryId).filter(Boolean) as string[];
  console.log(`Found ${uniqueCountryIds.length} countries with inventory.`);

  for (const countryId of uniqueCountryIds) {
    const country = await prisma.country.findUnique({ where: { id: countryId } });
    if (!country) continue;

    console.log(`Processing country: ${country.name} (${country.code})`);

    const isIndia = country.code.toUpperCase() === "IN";

    // 3. Find or create the default warehouse for this country
    let defaultWarehouse = await prisma.warehouse.findFirst({
      where: { countryId, name: `Default Warehouse - ${country.name}` }
    });

    if (!defaultWarehouse) {
      defaultWarehouse = await prisma.warehouse.create({
        data: {
          name: `Default Warehouse - ${country.name}`,
          countryId,
          state: isIndia ? defaultIndiaState : 'Unknown',
          address: `System Generated Default for ${country.name}`,
          gstin: isIndia ? defaultIndiaGstin : null,
          status: "ACTIVE",
        }
      });
      console.log(`  -> Created new Default Warehouse with ID: ${defaultWarehouse.id}`);
    } else {
      console.log(`  -> Found existing Default Warehouse with ID: ${defaultWarehouse.id}`);
    }

    // 4. Update all inventory records for this country to use this warehouse
    const updateResult = await prisma.inventory.updateMany({
      where: { countryId, warehouseId: null },
      data: { warehouseId: defaultWarehouse.id }
    });
    
    console.log(`  -> Updated ${updateResult.count} inventory records for ${country.name}.`);
  }

  // Handle inventory with NO country (e.g. digital products if any)
  const nullCountryInventories = await prisma.inventory.count({
    where: { countryId: null, warehouseId: null }
  });

  if (nullCountryInventories > 0) {
    console.log(`Found ${nullCountryInventories} inventory records with NO countryId.`);
    // We shouldn't strictly require a warehouse for purely digital global items if they exist,
    // but if the unique constraint @@unique([variantId, warehouseId]) becomes required, we need a global warehouse.
    // For now, warehouseId is nullable, so we will just log it.
    console.warn("  -> Skipping mapping for country-less inventory.");
  }

  console.log("Warehouse backfill migration completed successfully.");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
