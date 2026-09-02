import "../config/env";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      role: true
    }
  });

  console.log(`=== USERS IN DB (${users.length}) ===`);
  for (const u of users) {
    const isMatch = u.password ? await bcrypt.compare("Admin@1234", u.password) : false;
    console.log(`Email: ${u.email} | Name: ${u.name} | Role: ${u.role?.name} | Status: ${u.status} | Match Admin@1234: ${isMatch}`);
  }

  // Ensure admin@modortho.com exists with Super Admin role and password Admin@1234
  let superAdminRole = await prisma.role.findFirst({
    where: { name: "Super Admin" }
  });

  if (!superAdminRole) {
    superAdminRole = await prisma.role.create({
      data: { name: "Super Admin", permissions: ["*"] }
    });
  }

  const newHash = await bcrypt.hash("Admin@1234", 12);

  const existingAdmin = await prisma.user.findFirst({
    where: { email: "admin@modortho.com" }
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        password: newHash,
        status: "ACTIVE",
        deletedAt: null,
        roleId: superAdminRole.id
      }
    });
    console.log("\n>>> SUCCESS: Reset password for admin@modortho.com to 'Admin@1234'");
  } else {
    await prisma.user.create({
      data: {
        email: "admin@modortho.com",
        name: "Super Admin",
        password: newHash,
        status: "ACTIVE",
        roleId: superAdminRole.id
      }
    });
    console.log("\n>>> SUCCESS: Created admin@modortho.com with password 'Admin@1234'");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
