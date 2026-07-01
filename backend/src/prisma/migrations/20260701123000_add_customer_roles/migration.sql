CREATE TABLE "customer_roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_roles_key_key" ON "customer_roles"("key");
CREATE UNIQUE INDEX "customer_roles_name_key" ON "customer_roles"("name");

ALTER TABLE "customers" ADD COLUMN "customerRoleId" TEXT;

INSERT INTO "customer_roles" ("id", "key", "name", "description", "status", "isSystem", "sortOrder", "createdAt", "updatedAt")
VALUES
    ('customer-role-guest', 'GUEST', 'Guest', 'Anonymous storefront pricing role.', 'ACTIVE', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('customer-role-dealer', 'DEALER', 'Dealer', 'Approved dealer account pricing role.', 'ACTIVE', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('customer-role-doctor-retailer', 'DOCTOR_RETAILER', 'Doctor / Retailer', 'Doctor and retailer account pricing role.', 'ACTIVE', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "customers"
SET "customerRoleId" = CASE
    WHEN "customerType" IN ('DEALER', 'WHOLESALE') THEN (SELECT "id" FROM "customer_roles" WHERE "key" = 'DEALER' LIMIT 1)
    ELSE (SELECT "id" FROM "customer_roles" WHERE "key" = 'DOCTOR_RETAILER' LIMIT 1)
END
WHERE "customerRoleId" IS NULL;

ALTER TABLE "customers"
ADD CONSTRAINT "customers_customerRoleId_fkey"
FOREIGN KEY ("customerRoleId") REFERENCES "customer_roles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
