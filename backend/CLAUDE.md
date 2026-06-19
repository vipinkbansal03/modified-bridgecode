# CLAUDE.md — modortho-backend

> Read this fully before touching any file. This is the authoritative context for this codebase.

## What this is

Express.js + TypeScript + Prisma + PostgreSQL backend for the Modern Orthodontics B2B platform. It serves two surfaces:
- **Public API** at `/api/*` — unauthenticated, used by the Next.js website
- **Admin API** at `/api/admin/*` — JWT-protected, used by the admin panel inside the Next.js project

## Stack

- **Runtime:** Node.js, Express 4, TypeScript (strict mode)
- **ORM:** Prisma 5 with PostgreSQL
- **Auth:** JWT (jsonwebtoken) + bcryptjs
- **Storage:** Local disk OR Cloudinary — toggled by `STORAGE_PROVIDER` env var
- **Payments:** Razorpay (India / INR) + Stripe (global)
- **Logging:** Winston → `logs/app.log` and `logs/error.log`
- **File uploads:** Multer to `uploads/tmp/`, then moved by `src/config/storage.ts`

## Folder structure

```
src/
  app.ts                  # Express app, all routes mounted here
  server.ts               # Entry point, graceful shutdown
  config/
    database.ts           # Prisma singleton + connectDB()
    logger.ts             # Winston instance + httpLogStream
    storage.ts            # uploadFile() / deleteFile() — local or Cloudinary
  middleware/
    auth.middleware.ts    # protect() + requirePermission()
    error.middleware.ts   # Centralised error handler
    upload.middleware.ts  # Multer, 20MB limit, image/PDF/video
  modules/
    public/               # Unauthenticated public API (NEW — added in integration pass)
    auth/                 # login, logout, /me
    products/             # Full CRUD + media + variants + attributes
    categories/
    attributes/           # Attribute + AttributeValue CRUD
    inventory/
    pricing/              # Per-country pricing + auto-generate
    currencies/
    countries/
    coupons/
    quotes/               # Quote requests from the website
    orders/
    shipping/             # DHL + DTDC provider config + zones
    payments/             # Razorpay + Stripe gateway config
    media/                # General media library
    translations/         # Languages + product translation editor
    ai/                   # LangChain scaffold (needs OPENAI_API_KEY)
    settings/             # Key-value settings by group
    logs/                 # ActivityLog viewer
    users/
    roles/
  utils/
    apiResponse.ts        # ApiResponse class, AppError, asyncHandler, getPagination, slugify, convertPrice
  prisma/
    schema.prisma         # Full schema — 28 models, all enums
    seed.ts               # Default data: roles, admin user, currencies, countries, attributes
```

## Patterns — follow these exactly

### Every module has 3 files
```
modules/foo/
  foo.routes.ts       # Router, protect(), requirePermission()
  foo.controller.ts   # asyncHandler wrappers only, calls service
  foo.service.ts      # All business logic, Prisma queries
```

### Controller pattern
```typescript
export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await SomeService.create(req.body);
  return ApiResponse.created(res, "Created.", result);
});
```

### Service pattern
```typescript
export async function getOne(id: string) {
  const record = await prisma.model.findUnique({ where: { id } });
  if (!record) throw new AppError("Not found.", 404);
  return record;
}
```

### Response helpers (all in `src/utils/apiResponse.ts`)
- `ApiResponse.success(res, message, data)` — 200
- `ApiResponse.created(res, message, data)` — 201
- `ApiResponse.paginated(res, message, data[], { page, limit, total })` — 200 with pagination object
- `throw new AppError("message", statusCode)` — caught by error middleware

### Auth
- `protect` middleware verifies JWT, sets `req.user = { id, email, name, roleId, permissions[] }`
- `requirePermission("products.create")` checks `req.user.permissions`
- `"*"` in permissions = superadmin, bypasses all checks

## Known bugs — fix these before running

### Bug 1 — Category media include doesn't exist
**File:** `src/modules/public/public.service.ts`, function `publicListCategories`
**Problem:** `include: { media: ... }` is used on Category but the Prisma schema has no `media` relation on Category. Category has an `image: String` field directly.
**Fix:**
```typescript
// Remove the media include entirely:
const cats = await prisma.category.findMany({
  where: { status: "ACTIVE", deletedAt: null },
  orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  include: {
    _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } },
    // NO media include — image is a plain string field
  },
});
```

### Bug 2 — Hardcoded `"usd"` as currency ID
**File:** `src/modules/pricing/pricing.service.ts`, function `generateCountryPrices`
**Problem:** The function receives `baseCurrencyId` but the pricing controller at `/pricing/generate-country-prices` passes a hardcoded `"usd"` string. Prisma IDs are cuid()s, not `"usd"`.
**Fix in controller:** Look up the base currency by `isBase: true` first:
```typescript
export const generateForCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new AppError("No base currency configured.", 400);
  const count = await S.generateCountryPrices(req.body.productId, req.body.basePrice, baseCurrency.id);
  return ApiResponse.success(res, `${count} country prices generated.`);
});
```

### Bug 3 — Prisma `omit` option not enabled
**Files:** `src/modules/users/users.service.ts`, `src/modules/auth/auth.service.ts`
**Problem:** Several queries use `omit: { password: true }` which requires `omitApi` in Prisma preview features. Without it, Prisma throws.
**Fix option A (recommended):** Replace all `omit` with explicit `select`:
```typescript
// Instead of: prisma.user.findMany({ omit: { password: true } })
prisma.user.findMany({
  select: {
    id: true, name: true, email: true, roleId: true, role: true,
    status: true, lastLoginAt: true, createdAt: true, updatedAt: true,
    // password deliberately excluded
  }
})
```
**Fix option B:** Add to `schema.prisma` generator block:
```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["omitApi"]
}
```

### Bug 4 — Inventory create has wrong field
**File:** `src/modules/products/products.service.ts`, function `generateVariants`
**Problem:** `prisma.inventory.create({ data: { productId, variantId, stock: 0 } })` — the `Inventory` model has no `productId` field. Relationship to product goes through `variant → product`.
**Fix:**
```typescript
await prisma.inventory.create({
  data: { variantId: variant.id, stock: 0, status: "IN_STOCK" },
});
```

### Bug 5 — Stale module directory artifact
**Path:** `src/modules/{auth,users,roles,...}/`
**Problem:** A literal folder with that name was created by a failed brace expansion. It's harmless but should be deleted.
**Fix:** `rm -rf "src/modules/{auth,users,roles,categories,products,attributes,variants,inventory,pricing,currencies,countries,coupons,quotes,orders,shipping,payments,media,translations,ai,settings,logs}"`

## What's NOT implemented yet (pending features)

### High priority

**Email notifications**
When a quote or contact form is submitted, no email is sent. Install Resend or Nodemailer and call it inside `submitPublicQuote` and `submitContact` in `public.service.ts`. Add `RESEND_API_KEY` to `.env.example`.

**Payment webhooks**
`src/modules/payments/` only stores gateway credentials. The actual Razorpay and Stripe webhook handlers (that update `Order.paymentStatus` from PENDING → PAID) don't exist. Create:
- `POST /api/webhooks/razorpay` — verify `razorpay-signature`, update order
- `POST /api/webhooks/stripe` — verify `stripe-signature`, update order
Mount these in `app.ts` BEFORE `express.json()` (Stripe needs the raw body).

**Tax calculation**
`ProductPrice.taxPercentage` field exists in the schema but nothing applies it to order totals. Implement a `calculateTax(amount, countryCode)` utility and call it in the quote/order total calculation.

### Medium priority

**Bulk product CSV import**
Admin spec includes CSV import. Create `POST /api/admin/products/import` that:
1. Accepts a CSV upload (multer)
2. Parses with `papaparse` (install it)
3. Upserts products by `productCode`
4. Returns a summary: `{ created: N, updated: N, errors: [] }`

**Order fulfillment flow**
Currently order status is updated manually. Implement:
- `POST /api/admin/orders/:id/ship` — updates status to SHIPPED, stores tracking number, triggers email
- `POST /api/admin/orders/:id/deliver` — updates to DELIVERED, decrements inventory

**Shipping rate calculation**
`ShippingZone` records exist but are never used to calculate shipping charges on orders. Implement `calculateShipping(countryCode, orderTotal)` that finds the applicable zone and applies free shipping if order exceeds `freeAbove`.

### Lower priority

- Admin dashboard analytics: revenue by month, orders by country (use Prisma `groupBy`)
- Product translations AI: wire `src/modules/ai/ai.service.ts` to an actual LangChain chain
- Coupon auto-expiry: a cron job that sets `status: INACTIVE` on expired coupons
- Rate limiting per-user (not just per-IP) for the public write endpoints

## Environment variables quick reference

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/modortho
JWT_SECRET=<min 32 chars, random>
JWT_EXPIRES_IN=7d
PORT=4000
FRONTEND_URL=http://localhost:3000
STORAGE_PROVIDER=local          # or "cloudinary"
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
STRIPE_SECRET_KEY=
OPENAI_API_KEY=                 # for AI tools module
```

## Running locally

```bash
npm install
cp .env.example .env            # fill DATABASE_URL and JWT_SECRET
npx prisma migrate dev --name init
npx prisma db seed              # admin@modortho.com / Admin@1234
npm run dev                     # → http://localhost:4000
```

Verify: `curl http://localhost:4000/health`

## Public API endpoints (no auth)

```
GET  /api/products              ?page &limit &category &search &featured &sort
GET  /api/products/:slug
GET  /api/categories
GET  /api/search                ?q=
GET  /api/currencies
GET  /api/countries
GET  /api/inventory             ?variantIds=id1,id2
POST /api/quotes                { customerName, customerEmail, items[] }
POST /api/contact               { name, email, message, type }
POST /api/dealer-inquiry        same shape as /contact
```

## Admin API endpoints (JWT required)

All at `/api/admin/*`. Full list in `src/app.ts`.
Default admin: `admin@modortho.com` / `Admin@1234`
