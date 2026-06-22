-- AlterTable
ALTER TABLE "attribute_values" ADD COLUMN     "image" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "priceAdjustment" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "attributes" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "height" DECIMAL(10,2),
ADD COLUMN     "length" DECIMAL(10,2),
ADD COLUMN     "moq" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "packageId" TEXT,
ADD COLUMN     "weight" DECIMAL(10,3),
ADD COLUMN     "width" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "product_packages" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_value_selections" (
    "id" TEXT NOT NULL,
    "productAttributeId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_attribute_value_selections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_packages_productId_slug_key" ON "product_packages"("productId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_value_selections_productAttributeId_attri_key" ON "product_attribute_value_selections"("productAttributeId", "attributeValueId");

-- AddForeignKey
ALTER TABLE "product_packages" ADD CONSTRAINT "product_packages_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_value_selections" ADD CONSTRAINT "product_attribute_value_selections_productAttributeId_fkey" FOREIGN KEY ("productAttributeId") REFERENCES "product_attributes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_value_selections" ADD CONSTRAINT "product_attribute_value_selections_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "attribute_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "product_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
