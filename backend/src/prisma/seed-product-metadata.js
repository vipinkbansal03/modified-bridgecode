require("../../scripts/load-env.cjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { slug: "elfin-bondable-molar-tube" }
  });

  if (!product) {
    console.error("Product not found");
    return;
  }

  const updated = await prisma.product.update({
    where: { id: product.id },
    data: {
      highlights: [
        {
          title: "Ultra-Low Profile",
          description: "Minimizes occlusal interference and maximizes patient comfort during treatment."
        },
        {
          title: "80-Mesh Contoured Base",
          description: "Anatomically matches the molar convexity for superior adhesion and clinical bond strength."
        },
        {
          title: "Laser-Etched Marks",
          description: "High visibility positioning markers on the face assist in precise placement and orientation."
        }
      ],
      technicalSpecs: [
        { label: "Material", value: "Medical-grade 316 Stainless Steel (nickel-lite biocompatible)" },
        { label: "Mesh Base", value: "80-gauge mesh pattern woven foil pad" },
        { label: "Slot Sizes Available", value: "0.018 in / 0.022 in" },
        { label: "Prescriptions", value: "Roth, MBT, and Edgewise configurations" }
      ],
      warranty: [
        "12 Months Manufacturer Warranty",
        "Covers structural integrity, material defects, and bond failures under standard clinical protocols."
      ],
      primaryFeatures: [
        {
          title: "Trumpeted Entrance",
          description: "Enables extremely easy, friction-free archwire insertion from any angle."
        },
        {
          title: "Flush-Fit Hooks",
          description: "Hook sits flush against the tooth crown to prevent irritation to the soft buccal tissue."
        },
        {
          title: "Notched Base Design",
          description: "Allows alignment with the buccal groove for highly accurate and repeatable placement."
        }
      ]
    }
  });

  console.log("Successfully seeded correctly-shaped metadata for product:", updated.title);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
