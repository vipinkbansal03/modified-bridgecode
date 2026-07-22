import axios from "axios";

async function main() {
  try {
    const res = await axios.get("http://127.0.0.1:4000/api/product-filters");
    console.log("Response data:", JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error("API error:", err.message);
  }
}

main();
