import { prisma } from "../config/database";

async function main() {
  await prisma.order.update({
    where: { orderNumber: "ORD-1787558022332-YG8ZG9" },
    data: {
      status: "DELIVERED",
      paymentStatus: "PAID",
    },
  });
  console.log("Order reset successfully.");
}

main().catch(console.error);
