import axios from "axios";

async function main() {
  try {
    const catsRes = await axios.get("http://localhost:4000/api/categories");
    console.log("Categories API Status:", catsRes.status);
    console.log("Categories API Data count:", catsRes.data?.data?.length);
    console.log("Categories:", catsRes.data?.data);
  } catch (err: any) {
    console.error("Categories API failed:", err.message);
  }

  try {
    const prodsRes = await axios.get("http://localhost:4000/api/products?limit=100");
    console.log("\nProducts API Status:", prodsRes.status);
    console.log("Products API Data count:", prodsRes.data?.data?.length);
    console.log("Products:", prodsRes.data?.data?.map((p: any) => ({ title: p.title, category: p.category })));
  } catch (err: any) {
    console.error("Products API failed:", err.message);
  }
}

main();
