# CLAUDE.md — modortho-nextjs

> Read this fully before touching any file. This is the authoritative context for this codebase.

## What this is

Next.js 14 (App Router) + TypeScript + Tailwind CSS website for Modern Orthodontics (modortho.com). It has two surfaces:
- **Public website** — static + SSG product pages, contact forms, catalogue
- **Admin panel** — `/admin/*` routes, client-side SPA protected by JWT, talks to the Express backend

## Stack

- **Framework:** Next.js 14, App Router, TypeScript strict mode
- **Styling:** Tailwind CSS — config in `tailwind.config.ts`, design tokens in `src/styles/globals.css`
- **Data fetching:** React Query v5 (`@tanstack/react-query`)
- **Forms:** Formik + Yup
- **Animations:** Framer Motion
- **HTTP:** axios via `src/lib/apiClient.ts`
- **Icons:** lucide-react

## Brand / design system

- **Red:** `#E31E24` (brand), deep `#B5151B`
- **Font:** Inter (loaded via Google Fonts `<link>` in `src/app/layout.tsx`)
- **Spacing scale:** Tailwind defaults + custom: `4.5`, `5.5`, `6.5`, `7.5`, `8.5`, `12.5`
- **Colours in Tailwind config:** `ink` (near-black), `steel`, `steel-2`, `brand`, `line`, `grey`, `offwhite`
- **Reference aesthetic:** Tata Chemicals / Godrej — editorial whitespace, red accents, structured grid

## Folder structure

```
src/
  app/
    layout.tsx              # Root layout — ReactQueryProvider + Header + Footer
    page.tsx                # Homepage
    products/
      page.tsx              # Products listing (Server Component shell)
      [slug]/page.tsx       # Product detail — SSG, reads src/data/products.json directly
    admin/
      layout.tsx            # AdminAuthProvider + ReactQueryProvider (separate from public)
      login/page.tsx
      dashboard/page.tsx
      products/
        page.tsx            # Products CRUD table
        create/page.tsx
        [id]/edit/page.tsx  # 8-tab editor (most complex admin page)
      categories/page.tsx
      attributes/page.tsx
      inventory/page.tsx
      pricing/page.tsx
      currencies/page.tsx
      countries/page.tsx
      coupons/page.tsx
      quotes/page.tsx
      orders/page.tsx
      shipping/page.tsx
      payments/page.tsx
      media/page.tsx
      translations/page.tsx
      ai-tools/page.tsx
      users/page.tsx
      roles/page.tsx
      settings/page.tsx
      logs/page.tsx
      variants/page.tsx     # Placeholder — redirects to product edit
  components/
    admin/
      layout/
        AdminLayout.tsx     # Auth guard + sidebar + header wrapper
        AdminSidebar.tsx    # 21 nav items, active state, mobile overlay
        AdminHeader.tsx     # Breadcrumb + user badge + logout
      AdminComponents.tsx   # DataTable, Pagination, StatusBadge, ConfirmModal,
                            # AdminInput, AdminSelect, AdminTextarea, StatCard, useToast
    sections/               # Page sections (FeaturedProducts, Categories, etc.)
    ui/                     # Primitive components (Button, Card, Input, etc.)
    forms/                  # ContactForm, DealerInquiryForm, NewsletterForm
    layout/                 # Header, Footer, MobileMenu
  contexts/
    AdminAuthContext.tsx    # login(), logout(), hasPermission(), user state
  hooks/
    api/                    # All data-fetching hooks (see below)
    admin/
      useAdminHooks.ts      # All admin panel React Query hooks
  lib/
    apiClient.ts            # Axios instance for public API + unwrap helpers
    queryConfig.ts          # Query key factory (qk.*), STALE constants, makeQueryClient()
    reactQueryProvider.tsx  # QueryClientProvider using makeQueryClient()
    seo.ts                  # buildMetadata() helper
  services/
    adminApi.ts             # Axios instance for /api/admin/* (attaches JWT)
  types/
    api.types.ts            # Canonical API types (ApiProductSummary, ApiProductDetail, etc.)
    product.types.ts        # Static ProductDetail type (used by SSG product pages)
    category.types.ts       # CategoryItem (used by static pages)
    common.types.ts         # SeoEntry, NavLink, StatItem, etc.
  data/                     # Bundled JSON — fallback when backend not running
    products.json           # 47 real products
    categories.json         # 11 categories
    navigation.json
    home.json, about-us.json, blogs.json, testimonials.json, seo.json
    + capability page JSONs
  utils/
    cn.ts                   # clsx + tailwind-merge
    constants.ts            # India + USA office details, PHONE_REGEX, GST_REGEX
  validations/
    contact.validation.ts
    dealer.validation.ts
```

## How the API integration works

### Public website
Hooks in `src/hooks/api/` call the Express backend via `src/lib/apiClient.ts`.

The base URL is auto-detected:
- In **development**: hooks hit `/api/*` which `next.config.js` rewrites to `http://localhost:4000/api/*`
- In **production**: set `NEXT_PUBLIC_API_URL=https://your-backend.com/api/admin` — the client strips `/api/admin` to get the base, then appends `/api/*`

When the backend is unreachable, every hook falls back to the bundled JSON in `src/data/`. This means the site renders correctly without a running backend.

### Admin panel
Uses `src/services/adminApi.ts` — separate axios instance that hits `/api/admin/*` and attaches the JWT from `localStorage.getItem("admin_token")`. 401 responses auto-redirect to `/admin/login`.

### Barrel export
All public hooks import from `@/hooks/api` (the `index.ts` barrel):
```typescript
import { useProducts, useProduct, useCategories, useQuoteSubmit } from "@/hooks/api";
```

## Available public hooks

| Hook | Backend endpoint | Fallback |
|---|---|---|
| `useProducts(params)` | `GET /api/products` | `products.json` |
| `useProductsByCategory(slug)` | `GET /api/products?category=` | filter JSON |
| `useProduct(slug)` | `GET /api/products/:slug` | find in JSON |
| `useFeaturedProducts()` | `GET /api/products?featured=true` | first 6 of JSON |
| `useCategories()` | `GET /api/categories` | `categories.json` |
| `useSearch(q)` | `GET /api/search?q=` | client-side JSON search |
| `useCurrencies()` | `GET /api/currencies` | hardcoded 4 currencies |
| `useCountries()` | `GET /api/countries` | empty array |
| `useConvertPrice()` | uses useCurrencies data | exchange rate math |
| `useInventoryCheck(ids[])` | `GET /api/inventory` | disabled |
| `useQuoteSubmit()` | `POST /api/quotes` | simulated |
| `useContactSubmit()` | `POST /api/contact` | simulated |
| `useDealerInquiry()` | `POST /api/dealer-inquiry` | simulated |
| `useNewsletterSubmit()` | `POST /api/contact` | simulated |

## Query key factory — always use this

```typescript
import { qk } from "@/lib/queryConfig";

qk.products.list({ category: "brackets" })
qk.products.detail("sapphire-true-twin")
qk.categories.all
qk.currencies.all
qk.search.query("bracket")
```

## Stale time constants

```typescript
import { STALE } from "@/lib/queryConfig";

STALE.long    // 30 min — categories, currencies (rarely change)
STALE.medium  // 5 min  — products (change on publish/unpublish)
STALE.short   // 1 min  — inventory, search
STALE.never   // Infinity — testimonials, static content
```

## Admin panel patterns

### Every admin page follows this structure
```tsx
"use client";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, ... } from "@/components/admin/AdminComponents";

export default function FooPage() {
  return (
    <AdminLayout title="Foo" breadcrumb={[{ label: "Foo" }]}>
      {/* content */}
    </AdminLayout>
  );
}
```

### AdminLayout handles auth automatically
- Checks `useAdminAuth()` — if no user, redirects to `/admin/login`
- Shows loading spinner while checking token

### Calling the admin API directly (for mutations not yet in hooks)
```typescript
import { adminApi } from "@/services/adminApi";
await adminApi.post("/products", data);
await adminApi.put(`/products/${id}`, data);
await adminApi.delete(`/products/${id}`);
```

### Admin auth permission check
```typescript
const { hasPermission } = useAdminAuth();
if (!hasPermission("products.create")) return <Forbidden />;
```

## Known issues — fix before adding new features

### Issue 1 — Product detail page ignores the backend (most important)
**File:** `src/app/products/[slug]/page.tsx`
**Problem:** This page reads from `src/data/products.json` directly. Products created/updated via the admin panel never appear on the website.
**Fix:** Convert to ISR fetching from the backend:

```typescript
// In generateStaticParams — fetch slugs from backend at build time
export async function generateStaticParams() {
  try {
    const res = await fetch(`${process.env.API_BASE_URL}/api/products?limit=200`);
    const { data } = await res.json();
    return data.data.map((p: { slug: string }) => ({ slug: p.slug }));
  } catch {
    // Fallback to JSON if backend not available at build time
    return productsData.map((p) => ({ slug: p.slug }));
  }
}

// In the page — fetch product from backend with ISR revalidation
export const revalidate = 300; // revalidate every 5 minutes

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  let product;
  try {
    const res = await fetch(`${process.env.API_BASE_URL}/api/products/${params.slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) notFound();
    const json = await res.json();
    product = json.data;
  } catch {
    product = productsData.find((p) => p.slug === params.slug);
    if (!product) notFound();
  }
  // ... rest of page
}
```
Add `API_BASE_URL=http://localhost:4000` to `.env.local` (server-side, not `NEXT_PUBLIC_`).

### Issue 2 — BulkOrderPanel uses mailto, not the quote API
**File:** `src/components/sections/BulkOrderPanel.tsx`
**Problem:** "Request a Quote" and "Place Order" buttons open `mailto:` links. `useQuoteSubmit` is built but not used.
**Fix:** Import and call `useQuoteSubmit` inside BulkOrderPanel. Map `{ prescription, slot, packaging, qty, product }` into the `ApiQuoteSubmit` shape and call `mutate(...)`. Show a success state instead of opening email.

### Issue 3 — No currency switcher UI
**Problem:** `useCurrencies` and `useConvertPrice` hooks exist. Nothing renders them.
**Fix:** Create `src/components/ui/CurrencySwitcher.tsx`, add it to the `Header`. Store selected currency in a Zustand store or React context. Pass currency code into `useProducts` params so the backend returns the right prices.

### Issue 4 — No search UI
**Problem:** `useSearch(q)` exists. No search bar in the site nav.
**Fix:** Create a search input + dropdown overlay in `src/components/layout/Header.tsx` that calls `useSearch` with debounce.

### Issue 5 — Admin permissions not reflected in UI
**Problem:** Backend enforces permissions but admin sidebar and buttons don't hide based on `hasPermission()`.
**Fix:** Wrap admin nav items and action buttons with `{hasPermission("X") && ...}`.

## What's NOT implemented yet

### Needs building from scratch

1. **`/admin/quotes/[id]/page.tsx`** — Quote detail view (status update, convert to order, internal notes). Backend service is complete.

2. **`/admin/orders/[id]/page.tsx`** — Order detail view (items, status update, shipping assignment, payment status). Backend service is complete.

3. **`<CurrencySwitcher />`** — Dropdown in header. Reads `useCurrencies()`, stores selection, passes to product price display.

4. **`<SearchBar />`** — Nav search overlay. Uses `useSearch(q)` with 300ms debounce.

5. **`<InventoryBadge />`** — Calls `useInventoryCheck([variantId])` and shows "In Stock / Out of Stock" on the BulkOrderPanel per-variant.

6. **Admin dashboard charts** — Revenue by month, orders by country. Use recharts (already in dependencies).

7. **Role-based UI hiding** — Use `hasPermission()` to conditionally render admin nav items and action buttons.

### Needs wiring (backend exists, frontend doesn't call it)

- BulkOrderPanel → `useQuoteSubmit` (replace mailto)
- Product detail page → backend API (replace static JSON)
- Inventory badge on product pages → `useInventoryCheck`

## ESLint config

`.eslintrc.json` downgrades `no-unescaped-entities` and `no-img-element` to warnings so the build passes while the admin panel uses `<img>` tags for uploaded product images.

## Running locally

```bash
npm install
# Start the Express backend first (see modortho-backend/CLAUDE.md)
npm run dev    # → http://localhost:3000
```

No `.env.local` needed in development — `next.config.js` proxies `/api/*` to `http://localhost:4000`.

For ISR product pages (once Issue 1 is fixed), add:
```env
# .env.local — server-side only, no NEXT_PUBLIC_ prefix
API_BASE_URL=http://localhost:4000
```

## Things to never do

- Never modify `src/data/*.json` files manually — they are the static fallback. Real data lives in PostgreSQL.
- Never import `src/data/products.json` in client components — those imports go in the hook fallback paths only.
- Never write raw Prisma queries in admin page components — all data goes through `adminApi` calls to the Express backend.
- Never store the JWT anywhere except `localStorage` under key `admin_token` — the `adminApi` interceptor reads from there.
- Never add `"use client"` to files in `src/app/admin/` unless needed — most admin pages are already client components.
