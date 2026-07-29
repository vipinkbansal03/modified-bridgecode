import { PrismaClient, PaymentMethodType } from "@prisma/client";

const prisma = new PrismaClient();

async function seedPaymentMethods() {
  console.log("Seeding payment methods...");

  // 1. Create or update COD
  const cod = await prisma.paymentMethod.upsert({
    where: { code: "COD" },
    update: {
      name: "Pay on Delivery",
      description: "Pay with cash or card upon delivery",
      type: PaymentMethodType.OFFLINE,
      isEnabled: true,
      sortOrder: 1,
    },
    create: {
      code: "COD",
      name: "Pay on Delivery",
      description: "Pay with cash or card upon delivery",
      type: PaymentMethodType.OFFLINE,
      isEnabled: true,
      sortOrder: 1,
    },
  });
  console.log("Seeded COD:", cod.id);

  // 2. Create or update Razorpay
  const razorpay = await prisma.paymentMethod.upsert({
    where: { code: "RAZORPAY" },
    update: {
      name: "Razorpay (UPI / Cards / NetBanking)",
      description: "Fast & secure online payments for Indian accounts",
      type: PaymentMethodType.SDK_MODAL,
      clientScriptUrl: "https://checkout.razorpay.com/v1/checkout.js",
      isEnabled: true,
      sortOrder: 2,
    },
    create: {
      code: "RAZORPAY",
      name: "Razorpay (UPI / Cards / NetBanking)",
      description: "Fast & secure online payments for Indian accounts",
      type: PaymentMethodType.SDK_MODAL,
      clientScriptUrl: "https://checkout.razorpay.com/v1/checkout.js",
      isEnabled: true,
      sortOrder: 2,
    },
  });
  // 3. Create or update Stripe
  const stripe = await prisma.paymentMethod.upsert({
    where: { code: "STRIPE" },
    update: {
      name: "Credit Card / Debit Card (Stripe)",
      description: "Fast & secure international card payment via Stripe",
      type: PaymentMethodType.HOSTED_REDIRECT,
      isEnabled: true,
      sortOrder: 3,
    },
    create: {
      code: "STRIPE",
      name: "Credit Card / Debit Card (Stripe)",
      description: "Fast & secure international card payment via Stripe",
      type: PaymentMethodType.HOSTED_REDIRECT,
      isEnabled: true,
      sortOrder: 3,
    },
  });
  console.log("Seeded Stripe:", stripe.id);

  // Fetch all active countries
  const countries = await prisma.country.findMany();

  // 4. Map countries
  for (const country of countries) {
    const isIndia = country.code.toUpperCase() === "IN";

    // Enable COD for all countries
    await prisma.paymentMethodCountry.upsert({
      where: {
        paymentMethodId_countryId: {
          paymentMethodId: cod.id,
          countryId: country.id,
        },
      },
      update: { isEnabled: true, isDefault: false },
      create: {
        paymentMethodId: cod.id,
        countryId: country.id,
        isEnabled: true,
        isDefault: false,
      },
    });

    // Enable Razorpay for India (IN)
    await prisma.paymentMethodCountry.upsert({
      where: {
        paymentMethodId_countryId: {
          paymentMethodId: razorpay.id,
          countryId: country.id,
        },
      },
      update: { isEnabled: isIndia, isDefault: isIndia },
      create: {
        paymentMethodId: razorpay.id,
        countryId: country.id,
        isEnabled: isIndia,
        isDefault: isIndia,
      },
    });

    // Enable Stripe for international countries (US, DE, AU, etc.)
    await prisma.paymentMethodCountry.upsert({
      where: {
        paymentMethodId_countryId: {
          paymentMethodId: stripe.id,
          countryId: country.id,
        },
      },
      update: { isEnabled: !isIndia, isDefault: !isIndia },
      create: {
        paymentMethodId: stripe.id,
        countryId: country.id,
        isEnabled: !isIndia,
        isDefault: !isIndia,
      },
    });
  }

  console.log("Payment methods mapped successfully for", countries.length, "countries!");
}

seedPaymentMethods()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
