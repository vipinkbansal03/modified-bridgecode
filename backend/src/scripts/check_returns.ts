import { listAllReturns } from "../modules/orderReturns/orderReturns.service";
import { prisma } from "../config/database";

async function main() {
  console.log("Calling listAllReturns with empty query...");
  const result = await listAllReturns({});
  console.log("RESULT:", JSON.stringify(result, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
