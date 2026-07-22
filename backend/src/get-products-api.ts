import axios from "axios";

async function main() {
  try {
    const res = await axios.get("http://127.0.0.1:4000/api/products?lang=en&countryCode=IN");
    console.log("Response products count:", res.data.data.length);
    res.data.data.forEach((p: any) => {
      console.log(`Product: ${p.title} (variants count: ${p.variantCount})`);
    });
  } catch (err: any) {
    console.error("API error:", err.message);
  }
}

main();
