const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.media.count();
  console.log('Count:', count);
  const data = await prisma.media.findMany();
  console.log('Data:', data);
}
main().finally(() => prisma.$disconnect());
