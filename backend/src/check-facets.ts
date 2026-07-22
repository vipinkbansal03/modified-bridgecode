import { publicListProductFacets } from "./modules/public/public.service";

async function main() {
  const facets = await publicListProductFacets("IN");
  console.log("=== Facets returned for IN ===");
  console.log(facets);
}

main().catch(console.error);
