-- 1. Orders Indexes
CREATE INDEX IF NOT EXISTS "orders_deletedAt_createdAt_idx" ON "orders"("deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "orders_status_deletedAt_idx" ON "orders"("status", "deletedAt");
CREATE INDEX IF NOT EXISTS "orders_paymentStatus_deletedAt_idx" ON "orders"("paymentStatus", "deletedAt");
CREATE INDEX IF NOT EXISTS "orders_customerId_deletedAt_idx" ON "orders"("customerId", "deletedAt");
CREATE INDEX IF NOT EXISTS "orders_countryId_idx" ON "orders"("countryId");
CREATE INDEX IF NOT EXISTS "orders_currencyId_idx" ON "orders"("currencyId");
CREATE INDEX IF NOT EXISTS "orders_shippingZoneId_idx" ON "orders"("shippingZoneId");
CREATE INDEX IF NOT EXISTS "orders_warehouseId_idx" ON "orders"("warehouseId");

-- 2. Order Items Indexes
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX IF NOT EXISTS "order_items_productId_idx" ON "order_items"("productId");
CREATE INDEX IF NOT EXISTS "order_items_variantId_idx" ON "order_items"("variantId");
CREATE INDEX IF NOT EXISTS "order_items_warehouseId_idx" ON "order_items"("warehouseId");

-- 3. Product Variants Indexes
CREATE INDEX IF NOT EXISTS "product_variants_deletedAt_createdAt_idx" ON "product_variants"("deletedAt", "createdAt");

-- 4. Customers Indexes
CREATE INDEX IF NOT EXISTS "customers_deletedAt_createdAt_idx" ON "customers"("deletedAt", "createdAt");
CREATE INDEX IF NOT EXISTS "customers_status_deletedAt_idx" ON "customers"("status", "deletedAt");
CREATE INDEX IF NOT EXISTS "customers_approvalStatus_deletedAt_idx" ON "customers"("approvalStatus", "deletedAt");
CREATE INDEX IF NOT EXISTS "customers_customerRoleId_idx" ON "customers"("customerRoleId");
CREATE INDEX IF NOT EXISTS "customers_tierId_idx" ON "customers"("tierId");
CREATE INDEX IF NOT EXISTS "customers_defaultCountryId_idx" ON "customers"("defaultCountryId");
CREATE INDEX IF NOT EXISTS "customers_email_idx" ON "customers"("email");

-- 5. Customer Addresses Indexes
CREATE INDEX IF NOT EXISTS "customer_addresses_customerId_idx" ON "customer_addresses"("customerId");
CREATE INDEX IF NOT EXISTS "customer_addresses_countryId_idx" ON "customer_addresses"("countryId");

-- 6. Activity Logs Indexes
CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "activity_logs_userId_idx" ON "activity_logs"("userId");
CREATE INDEX IF NOT EXISTS "activity_logs_entityType_createdAt_idx" ON "activity_logs"("entityType", "createdAt");
CREATE INDEX IF NOT EXISTS "activity_logs_action_idx" ON "activity_logs"("action");
