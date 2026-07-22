import { getPublicProductFiltersConfig } from './modules/productFilters/productFilters.service';

async function main() {
  const config = await getPublicProductFiltersConfig();
  console.log('Public Product Filters Config:', JSON.stringify(config, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => process.exit(0));
