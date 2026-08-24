require("./scripts/load-env.cjs");
const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.customerAddress.findMany().then(res => { console.log(JSON.stringify(res, null, 2)); prisma.$disconnect(); })
