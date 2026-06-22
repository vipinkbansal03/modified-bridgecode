-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "isEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'string',
ALTER COLUMN "value" SET DEFAULT '';

-- CreateTable
CREATE TABLE "cms_pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "pageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "seoKeywords" TEXT,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_sections" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "layoutType" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "settingsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_blocks" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "blockType" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "description" TEXT,
    "image" TEXT,
    "icon" TEXT,
    "linkLabel" TEXT,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_media" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'IMAGE',
    "altText" TEXT,
    "storageProvider" TEXT,
    "size" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_menus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_menu_items" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "parentId" TEXT,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_footer" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "logo" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "socialLinksJson" JSONB,
    "newsletterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_footer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_pageKey_key" ON "cms_pages"("pageKey");

-- CreateIndex
CREATE UNIQUE INDEX "cms_menus_location_key" ON "cms_menus"("location");

-- CreateIndex
CREATE INDEX "settings_group_idx" ON "settings"("group");

-- AddForeignKey
ALTER TABLE "cms_sections" ADD CONSTRAINT "cms_sections_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_blocks" ADD CONSTRAINT "cms_blocks_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "cms_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "cms_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
