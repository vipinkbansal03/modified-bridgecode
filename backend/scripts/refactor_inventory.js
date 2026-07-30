const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/modules/inventory/inventory.service.ts');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/countryId/g, 'warehouseId');
content = content.replace(/countryCode/g, 'warehouseId'); // For imports, though warehouse name might be better. Let's just do countryId.
content = content.replace(/countryIdOrMeta/g, 'warehouseIdOrMeta');

// Fix includes
content = content.replace(/country: \{[\s\S]*?\},/g, (match) => {
  if (match.includes("code: true") && !match.includes("enabled: true")) {
    return `warehouse: {
      select: {
        id: true,
        name: true,
        countryId: true,
        state: true,
        gstin: true
      },
    },`;
  }
  return match;
});

content = content.replace(/\{ country: \{ name: \{ contains: search, mode: "insensitive" \} \} \},/g, 
  `{ warehouse: { name: { contains: search, mode: "insensitive" } } },`);
content = content.replace(/\{ country: \{ code: \{ contains: search, mode: "insensitive" \} \} \},/g, 
  `{ warehouse: { state: { contains: search, mode: "insensitive" } } },`);

content = content.replace(/case "country":\s*return \[\{ country: \{ name: dir \} \}, \{ updatedAt: "desc" \}\];/g, 
  `case "warehouse":\n      return [{ warehouse: { name: dir } }, { updatedAt: "desc" }];`);

// Fix findVariantInventoryRecord
// from: const existing = await resolvedClient.inventory.findFirst({ where: { variantId, warehouseId: warehouseId ?? null } });
// to: const existing = await resolvedClient.inventory.findFirst({ where: { variantId, warehouseId: warehouseId ?? null } });

fs.writeFileSync(file, content);
console.log("Refactored inventory.service.ts");
