import { publicListProducts } from "../modules/public/public.service";

async function main() {
  console.log("--- Testing publicListProducts with countryCode IN ---");
  const inRes = await publicListProducts({ featured: "true", countryCode: "IN" });
  console.log("IN count:", inRes.total);
  console.log("IN data:", inRes.data.map(p => ({ id: p.id, title: p.title, isFeatured: p.isFeatured })));

  console.log("--- Testing publicListProducts without countryCode ---");
  const noCountryRes = await publicListProducts({ featured: "true" });
  console.log("No country count:", noCountryRes.total);
  console.log("No country data:", noCountryRes.data.map(p => ({ id: p.id, title: p.title, isFeatured: p.isFeatured })));

  console.log("--- Testing publicListProducts with countryCode US ---");
  const usRes = await publicListProducts({ featured: "true", countryCode: "US" });
  console.log("US count:", usRes.total);
  console.log("US data:", usRes.data.map(p => ({ id: p.id, title: p.title, isFeatured: p.isFeatured })));
}

main().catch(console.error);
