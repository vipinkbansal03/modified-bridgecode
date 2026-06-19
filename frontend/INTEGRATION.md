# Modern Orthodontics — Frontend ↔ Backend Integration

## Quick start (local development)

### 1. Start the backend

```bash
cd modortho-backend
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET (min 32 chars)
npm install
npx prisma migrate dev --name init
npx prisma db seed          # creates admin user, currencies, countries, attributes
npm run dev                 # → http://localhost:4000
```

Verify: `curl http://localhost:4000/health` should return `{"success":true}`.

### 2. Start the frontend

```bash
cd modortho-nextjs
npm install
cp .env.local.example .env.local
npm run dev                 # → http://localhost:3000
```

The `rewrites` in `next.config.js` forward every `/api/*` request to `BACKEND_URL/api/*`. By default the example file points this at `http://localhost:4000`, so the public hooks and admin panel both connect to the backend automatically.

---

## How the integration works

```
Browser → Next.js (port 3000)
              │
              ├── /api/products     → proxy → Express (port 4000) → Prisma → PostgreSQL
              ├── /api/categories   → proxy → Express
              ├── /api/search       → proxy → Express
              ├── /api/quotes       → proxy → Express
              └── /api/contact      → proxy → Express

Browser → Next.js (port 3000)
              └── /admin/*          → Next.js admin panel (client-side) → /api/admin/* → Express (auth required)
```

---

## Environment variables

### Backend (`modortho-backend/.env`)

| Variable | Required | Example |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@localhost:5432/modortho` |
| `JWT_SECRET` | ✅ | random 32+ char string |
| `PORT` | optional | `4000` |
| `STORAGE_PROVIDER` | optional | `local` or `cloudinary` |
| `CLOUDINARY_*` | if Cloudinary | see .env.example |
| `OPENAI_API_KEY` | for AI tools | sk-... |
| `RAZORPAY_KEY_ID` + `_SECRET` | for payments | from Razorpay dashboard |
| `STRIPE_SECRET_KEY` | for payments | sk_live_... |

### Frontend (`modortho-nextjs/.env.local`)

| Variable | When to set |
|---|---|
| `BACKEND_URL` | Recommended in dev and server-side deployments. Example: `http://localhost:4000` |
| `NEXT_PUBLIC_API_URL` | Optional. Set when the browser should call the backend directly, e.g. `https://api.yourdomain.com` |
| `NEXT_PUBLIC_USE_STATIC_DATA` | Optional. Set to `true` to force bundled JSON instead of live API calls |

---

## API endpoints used by the public website

All public routes live at `/api/*` on the Express backend (no auth):

| Endpoint | Hook | Used by |
|---|---|---|
| `GET /api/products` | `useProducts()` | Products listing page |
| `GET /api/products/:slug` | `useProduct(slug)` | Product detail page |
| `GET /api/categories` | `useCategories()` | Navigation mega-menu, category page |
| `GET /api/search?q=...` | `useSearch(q)` | Search UI |
| `GET /api/currencies` | `useCurrencies()` | Currency switcher |
| `GET /api/countries` | `useCountries()` | Contact form country dropdown |
| `GET /api/inventory?variantIds=...` | `useInventoryCheck()` | BulkOrderPanel stock badge |
| `POST /api/quotes` | `useQuoteSubmit()` | BulkOrderPanel → Request a Quote |
| `POST /api/contact` | `useContactSubmit()` | Contact form |
| `POST /api/dealer-inquiry` | `useDealerInquiry()` | Dealer inquiry form |

Admin panel uses `/api/admin/*` (JWT required) — see `src/services/adminApi.ts`.

---

## Hook usage examples

```tsx
// Products listing with pagination + search
const { data, isLoading } = useProducts({ page: 1, limit: 20, search: "bracket" });
// data.data → ApiProductSummary[]
// data.pagination → { page, limit, total, totalPages }

// Single product
const { data: product } = useProduct("sapphire-true-twin");
// product.variants → ApiVariant[]
// product.attributes → ApiAttribute[]
// product.prices → ApiProductPrice[]

// Submit quote
const { mutate, isPending } = useQuoteSubmit();
mutate({ customerName, customerEmail, items: [...] });

// Currency conversion
const convert = useConvertPrice();
const inr = convert(99.99, "USD", "INR"); // → 8349.17
```

---

## Static fallback

Static fallback is now opt-in. Set `NEXT_PUBLIC_USE_STATIC_DATA=true` when you want the storefront to use the bundled JSON in `src/data/` instead of the backend.

---

## Production deployment

1. Deploy the Express backend to a VM / Railway / Render. Set all env vars.
2. Run `npx prisma migrate deploy` on the server.
3. Deploy the Next.js frontend to Vercel / Netlify.
4. Set `BACKEND_URL=https://api.modortho.com` in the frontend environment.
5. If the browser should call the backend directly, also set `NEXT_PUBLIC_API_URL=https://api.modortho.com`.
6. Set `FRONTEND_URL=https://modortho.com` in the backend environment.
