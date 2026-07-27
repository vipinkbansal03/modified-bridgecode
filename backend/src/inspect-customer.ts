import { prisma } from "./config/database";

async function main() {
  const customer = await prisma.customer.findFirst({
    where: { email: { contains: "naveen", mode: "insensitive" } },
    include: {
      addresses: {
        include: { country: true }
      },
    }
  });

  if (!customer) {
    console.log("Customer Naveen not found.");
    return;
  }

  console.log(`=== CUSTOMER INFO FOR ${customer.email} ===`);
  console.log(`ID: ${customer.id}`);
  console.log(`Type: ${customer.customerType}`); 
  console.log(`Tax ID/GSTIN: ${customer.taxId}`);
  console.log(`Tax ID Type: ${customer.taxIdType}`);
  console.log(`Tax ID Status: ${customer.taxIdStatus}`);
  console.log(`Tax Exempt Certificate URL: ${customer.taxExemptCertificateUrl}`);
  
  console.log(`\nAddresses:`);
  customer.addresses.forEach((addr) => {
    console.log(`- ${addr.fullName}: ${addr.addressLine1}, ${addr.city}, ${addr.state}, ${addr.postalCode}, ${addr.country.code}`);
  });

  // Also inspect settings to find warehouse state
  const settings = await prisma.setting.findFirst();
  console.log(`\n=== SYSTEM SETTINGS ===`);
  if (settings) {
    console.log(`Settings:`, JSON.stringify(settings, null, 2));
  } else {
    console.log(`No settings found.`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
