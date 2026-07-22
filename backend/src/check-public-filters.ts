import { getPublicProductFiltersConfig } from "./modules/productFilters/productFilters.service";

async function main() {
  const config = await getPublicProductFiltersConfig();
  console.log("=== Public Product Filters Config ===");
  console.log(JSON.stringify(config, null, 2));
}

main().catch(console.error);
