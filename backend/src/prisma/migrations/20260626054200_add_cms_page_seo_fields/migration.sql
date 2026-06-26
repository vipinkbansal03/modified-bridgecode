-- AlterTable
ALTER TABLE "cms_pages" ADD COLUMN     "canonicalUrl" TEXT,
ADD COLUMN     "faqSchemaJson" JSONB,
ADD COLUMN     "favicon" TEXT,
ADD COLUMN     "robotsTag" TEXT,
ADD COLUMN     "twitterDescription" TEXT,
ADD COLUMN     "twitterImage" TEXT,
ADD COLUMN     "twitterTitle" TEXT;
