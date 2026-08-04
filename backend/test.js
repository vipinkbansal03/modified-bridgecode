const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const result = await prisma.$queryRawUnsafe('SELECT indexname, indexdef FROM pg_indexes WHERE tablename = \'inventory\'');
  console.log(result);
}
run();
