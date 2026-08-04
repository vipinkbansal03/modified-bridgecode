const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findFirst().then(u => { console.log(u.id); prisma.$disconnect(); });
