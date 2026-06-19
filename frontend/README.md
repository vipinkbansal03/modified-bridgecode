# Modern Orthodontics — Next.js Website

Production-ready Next.js 14 (App Router) + TypeScript + Tailwind conversion of modortho.com, with all content refreshed from the live site.

## Getting started

```bash
npm install
cp .env.local.example .env.local
npm run dev   # http://localhost:3000
npm run build
npm run lint
```

## What's in this build

**59 statically generated routes** — home, about, contact, quality-certifications, 4 capability pages, products listing, and 47 individual product detail pages.

**Real content from modortho.com:**
- Full product catalogue: 47 real products across 11 categories (Aesthetic Brackets, Metal Brackets, Molar Bands, NiTi Wires, SS Wires, Special Wires, Molar Tubes, Elastomerics, Tooth Color Wire, Begg Appliances, Miscellaneous Items)
- Real product names, images, and technical descriptions — no invented data
- Real India HQ: 2024 Gobind Nagar, Circuit House Road, Ludhiana 141001 | 1800 890 8022 | orders@modortho.com / info@modortho.com
- Real USA office: 1303 Colony Dr, Marietta GA 30068 | +1 470-866-2724 | sanjaygoyalmo@gmail.com
- Real testimonials (paraphrased — never verbatim)
- Real blog post titles and links to the actual articles on modortho.com
- Real catalogue: https://www.modortho.com/public/catalog/Modern-Catalog.zip
- Real cert PDFs: iso-13485-latest.pdf, ce-certificate-latest.pdf, FDA registration linked

**Capability pages (new):** `/design-and-engineering`, `/oem-services`, `/custom-packaging` — all use the shared `DetailPageTemplate` component, same as `/about` and `/manufacturing-services`.

**Navigation:** Products mega-menu with all 11 categories and sub-products. Capabilities dropdown (Design & Engineering / Manufacturing Services / OEM Services / Custom Packaging) rendered separately from the Products mega-menu, matching the real site's IA.

## B2B ordering

The full bulk-order configurator (prescription, slot size, packaging, quantity, live price calculation, discount tiers, Place Order / Request a Quote mailto CTAs) is rendered only for the **7 products with verified real specs**: Sapphire True Twin, Sapphire Plus Low-Profile, At-Ease Self Ligating, Curio Mono-Crystalline Ceramic, NiTi Super Elastic, and 2 others. All remaining 40+ products show a simpler "Request Pricing" panel that emails the team with the product code and a blank quantity field — no fabricated unit prices.

## Architecture notes

- `src/data/` — bundled JSON fallback used only when `NEXT_PUBLIC_USE_STATIC_DATA=true`
- `src/hooks/api/` — React Query hooks; by default they call the Express backend through Next.js rewrites
- `src/lib/apiClient.ts` — axios instance; public calls default to `/api`, admin calls default to `/api/admin`
- `.env.local` — set `BACKEND_URL` for the Next.js rewrite target; optionally set `NEXT_PUBLIC_API_URL` if the browser should call the backend directly
- Blog cards link externally to the real articles on modortho.com (open in new tab) rather than to a non-existent internal blog route
- `next/font/google` requires network access to `fonts.googleapis.com` at build time — if your build machine is air-gapped, the fallback approach (inline CSS variable) used during development is in the README commit history
