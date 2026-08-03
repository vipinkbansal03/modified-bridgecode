import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting footer menus data migration/backfill...");

  try {
    // 1. Repair footer-legal menu
    const legalMenu = await prisma.cMSMenu.findFirst({ where: { location: "footer-legal" } });
    if (legalMenu) {
      const deletedLegal = await prisma.cMSMenuItem.deleteMany({
        where: {
          menuId: legalMenu.id,
          label: { equals: "Legal", mode: "insensitive" }
        }
      });
      if (deletedLegal.count > 0) {
        console.log(`Deleted ${deletedLegal.count} 'Legal' link(s) from footer-legal.`);
      }

      // Update Privacy Policy URL to /privacy-policy
      const privacyItem = await prisma.cMSMenuItem.findFirst({
        where: {
          menuId: legalMenu.id,
          label: { equals: "Privacy Policy", mode: "insensitive" }
        }
      });
      if (privacyItem && privacyItem.url !== "/privacy-policy") {
        await prisma.cMSMenuItem.update({
          where: { id: privacyItem.id },
          data: { url: "/privacy-policy" }
        });
        console.log("Updated Privacy Policy link to '/privacy-policy'.");
      }

      // Update Sitemap URL to /sitemap
      const sitemapItem = await prisma.cMSMenuItem.findFirst({
        where: {
          menuId: legalMenu.id,
          label: { equals: "Sitemap", mode: "insensitive" }
        }
      });
      if (sitemapItem && sitemapItem.url !== "/sitemap") {
        await prisma.cMSMenuItem.update({
          where: { id: sitemapItem.id },
          data: { url: "/sitemap" }
        });
        console.log("Updated Sitemap link to '/sitemap'.");
      }
    }

    // 2. Repair footer-resources menu
    const resourcesMenu = await prisma.cMSMenu.findFirst({ where: { location: "footer-resources" } });
    if (resourcesMenu) {
      const items = await prisma.cMSMenuItem.findMany({ where: { menuId: resourcesMenu.id } });
      
      // Cleanup absolute urls and target windows on existing seeded records
      for (const item of items) {
        const lowerLabel = item.label.toLowerCase();
        let targetUrl = "";
        
        if (lowerLabel === "blog") {
          targetUrl = "/blog";
        } else if (lowerLabel === "terms & conditions" || lowerLabel === "terms and conditions") {
          targetUrl = "/terms-and-conditions";
        } else if (lowerLabel === "privacy policy") {
          targetUrl = "/privacy-policy";
        }

        if (targetUrl && (item.url !== targetUrl || item.openInNewTab)) {
          await prisma.cMSMenuItem.update({
            where: { id: item.id },
            data: { url: targetUrl, openInNewTab: false }
          });
          console.log(`Updated resources menu item '${item.label}' to relative URL '${targetUrl}'.`);
        }
      }

      const hasReturnPolicy = items.some(
        (item) => item.label.toLowerCase().includes("return") || item.label.toLowerCase().includes("refund")
      );
      if (!hasReturnPolicy) {
        const maxSortOrder = items.reduce((max, item) => (item.sortOrder > max ? item.sortOrder : max), 0);
        await prisma.cMSMenuItem.create({
          data: {
            menuId: resourcesMenu.id,
            label: "Return & Refund Policy",
            url: "/return-policy",
            sortOrder: maxSortOrder + 10,
            openInNewTab: false
          }
        });
        console.log("Added 'Return & Refund Policy' to existing footer-resources menu.");
      }
    }

    console.log("Footer menus migration completed successfully!");
  } catch (err) {
    console.error("Error during menus migration:", err);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
