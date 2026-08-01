-- CreateTable
CREATE TABLE "shipping_box_countries" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_box_countries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_box_countries_boxId_countryId_key" ON "shipping_box_countries"("boxId", "countryId");

-- AddForeignKey
ALTER TABLE "shipping_box_countries" ADD CONSTRAINT "shipping_box_countries_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "shipping_boxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_box_countries" ADD CONSTRAINT "shipping_box_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "order_shipping_boxes" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "boxId" TEXT,
    "boxName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weight" DECIMAL(12,3) NOT NULL,
    "volume" DECIMAL(12,2) NOT NULL,
    "items" JSONB,

    CONSTRAINT "order_shipping_boxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_shipping_boxes_orderId_idx" ON "order_shipping_boxes"("orderId");

-- CreateIndex
CREATE INDEX "order_shipping_boxes_boxId_idx" ON "order_shipping_boxes"("boxId");

-- AddForeignKey
ALTER TABLE "order_shipping_boxes" ADD CONSTRAINT "order_shipping_boxes_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_shipping_boxes" ADD CONSTRAINT "order_shipping_boxes_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "shipping_boxes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
