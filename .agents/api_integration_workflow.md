# API INTEGRATION & DATA FETCHING WORKFLOW (MANDATORY)

## 1. API Call Principles & Page Visibility
- **Only call APIs when required:** Do NOT make API requests simply because a component renders.
- Check before requesting: Is page visible? Does data exist in cache? Is cached data valid? Is a request already in progress?
- **Page Visibility Rule:** Stop previous polling, timers, subscriptions, or listeners when user navigates away. Only active page APIs should run.

## 2. No Duplicate Requests
- Prevent multiple button clicks from triggering duplicate API calls.
- Prevent React re-renders or parent-child component trees from fetching identical endpoints repeatedly. Deduplicate requests.

## 3. Centralized API Layer
- UI components must **never** call `fetch` or `axios` directly.
- Flow: `UI` -> `Hook / React Query` -> `API Client` -> `Backend`.

## 4. Polling vs Server-Sent Events (SSE)
- **Never use interval polling** (e.g. `setInterval` every 5 seconds) unless explicitly approved.
- Use **Server-Sent Events (SSE)** for real-time updates (live notifications, order/payment status, job completion, dashboard metrics).
- Connect to SSE only when page is active; close connection immediately when leaving page.

## 5. Response Caching & Request Cancellation
- Prefer **React Query (TanStack Query)** for API management (caching, deduplication, background refetch, stale-while-revalidate).
- **Request Cancellation:** Abort pending HTTP requests when user changes page, component unmounts, or search/filter inputs change.

## 6. Debounce User Input & Pagination
- Debounce all search, filter, and autocomplete inputs by **300–500ms**.
- Never hit APIs on every keystroke.
- Never fetch complete datasets; always use pagination or lazy-loading.

## 7. Batch Requests & Background Refresh
- Combine related endpoints into optimized batch responses when possible (e.g. `GET /dashboard` instead of individual calls).
- Refresh data only on user actions, SSE events, manual refresh, cache expiration, or active page revisits. Do not refresh continuously.

## 8. Mandatory Golden Rules
1. Never fetch data that is not currently needed.
2. Never poll when SSE can solve the problem.
3. Never make duplicate API requests.
4. Always cancel obsolete requests.
5. Always cache reusable data.
6. Always close SSE connections when leaving a page.
7. Every API call must have a clear purpose.
8. Prefer React Query for API state management.
9. Optimize for minimal network usage and maximum responsiveness.
10. Performance is a feature—every API request has a cost.
