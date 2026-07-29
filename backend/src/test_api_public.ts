async function main() {
  try {
    const catsRes = await fetch("http://localhost:4000/api/categories");
    console.log("Categories API Status:", catsRes.status);
    const catsData = await catsRes.json() as any;
    console.log("Categories API Data count:", catsData?.data?.length);
    console.log("Categories:", catsData?.data);
  } catch (err: any) {
    console.error("Categories API failed:", err.message);
  }

  try {
    const prodsRes = await fetch("http://localhost:4000/api/products?limit=100");
    console.log("\nProducts API Status:", prodsRes.status);
    const prodsData = await prodsRes.json() as any;
    console.log("Products API Data count:", prodsData?.data?.length);
    console.log("Products:", prodsData?.data?.map((p: any) => ({ title: p.title, category: p.category })));
  } catch (err: any) {
    console.error("Products API failed:", err.message);
  }
}

main();
