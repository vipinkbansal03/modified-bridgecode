# API Integration & Data Fetching Workflow (Mandatory)

## Purpose
This document defines the standard API integration workflow for the project. Every developer must follow these guidelines to ensure optimal performance, reduce unnecessary API calls, improve scalability, and provide a consistent user experience.

Failure to follow these guidelines may result in performance issues, increased server costs, duplicate requests, stale data, and poor user experience.

---

## 1. API Call Principles
### Only call APIs when required
Do NOT call an API simply because a component renders.
Before making any API request, verify:
* Is this page currently visible?
* Does the data already exist?
* Is the cached data still valid?
* Has the request already been made?
* Is another request already in progress?

Never make duplicate API requests.

---

## 2. Page Visibility Rule
APIs should only run when the corresponding page is active.

### Incorrect
User is on Dashboard. Background pages continue requesting:
* Orders
* Customers
* Notifications
* Reports

This is unacceptable.

### Correct
When user navigates: Dashboard → Orders, only Orders APIs should remain active.
All previous requests, polling, timers, subscriptions, and listeners must be stopped.

---

## 3. No Duplicate Requests
Never allow:
* Multiple clicks triggering multiple requests
* Multiple components requesting the same endpoint
* Parent and child requesting identical data
* React re-renders causing repeated fetches

Always deduplicate requests.

---

## 4. Centralized API Layer
Every API must go through a centralized service:
`UI` → `Hooks / Services` → `API Client` → `Backend`

Components must never directly call `fetch` or `axios`.

---

## 5. Never Use Polling
Polling should not be used unless explicitly approved.
### Bad Example
Polling every 5 seconds:
* `GET /notifications`
* `GET /orders`
* `GET /dashboard`
* `GET /users`

This wastes CPU, database resources, network bandwidth, mobile battery, and hosting costs.

---

## 6. Use Server-Sent Events (SSE)
Whenever the server needs to push updates, use SSE instead of polling.

### Suitable for:
* Live notifications
* Dashboard metrics
* Order status
* Payment status
* Lead updates
* Chat indicators
* Job progress
* Background task completion

### Advantages
* Single persistent connection
* Real-time updates
* Lower server load
* Reduced bandwidth
* Better scalability
* Simpler than WebSockets for one-way updates

### Connection Lifecycle
`Page Open` → `Connect to SSE` → `Receive Events` → `Update UI` → `Page Closed` → `Disconnect SSE`

### Important
* Open the SSE connection only when the page is active.
* Close the connection immediately when leaving the page.
* Reconnect only when required.

---

## 7. Cache Responses
Avoid fetching the same data repeatedly.

### Recommended caching options:
* React Query (TanStack Query) ✅ **Preferred**
* SWR
* Redux Cache (if applicable)
* In-memory cache (when appropriate)

### Use caching to:
* Avoid duplicate API requests.
* Share data across components.
* Automatically refetch when necessary.
* Keep UI responsive.
* Reduce backend load.
* Use stale-while-revalidate where appropriate.

*Note: Developers are encouraged to use **React Query (TanStack Query)** for API management as it provides built-in caching, request deduplication, background refetching, loading/error handling, retries, and cache invalidation.*

---

## 8. Request Cancellation
Every request must support cancellation.
Cancel the previous request before starting another. Trigger cancellation when:
* User changes page
* Component unmounts
* Search term changes
* Filters change
* Request becomes obsolete

---

## 9. Debounce User Input
Never call APIs on every keystroke.
Use debounce for:
* Search
* Filters
* Autocomplete

Recommended delay: **300–500 ms**

---

## 10. Pagination
Never load all records.
Always use:
* Pagination
* Infinite Scroll
* Lazy Loading

Only fetch what is needed.

---

## 11. Batch Requests
Combine related API requests whenever possible.
Instead of sending separate requests like `GET /user`, `GET /subscription`, `GET /profile`, and `GET /notifications`, prefer a unified endpoint like `GET /dashboard`.
One optimized endpoint is better than multiple small requests.

---

## 12. Background Refresh
Refresh data only when necessary.
### Allowed triggers:
* User performs an action
* SSE event received
* Manual refresh
* Cache expiration
* User revisits the page

Do not refresh continuously.

---

## 13. Loading States
Every request must include:
* Loading state
* Success state
* Empty state
* Error state
* Retry option

Never leave the UI in an unknown state.

---

## 14. Error Handling
Handle all API failures gracefully.
Include handling for:
* Network timeout
* Unauthorized
* Forbidden
* Validation errors
* Server errors
* Retry logic for transient failures

Never silently ignore errors.

---

## 15. Logging & Monitoring
Track:
* API execution time
* Failed requests
* Duplicate requests
* SSE connection status
* Client-side errors

This helps identify bottlenecks early.

---

## 16. Performance Checklist (Before Merging)
Every Pull Request must answer:
* Are there duplicate API calls?
* Does the page stop fetching after navigation?
* Are obsolete requests cancelled?
* Is polling avoided?
* Can SSE be used instead?
* Is caching implemented?
* Are requests debounced where needed?
* Are loading and error states handled?
* Has unnecessary network traffic been eliminated?

If any answer is **No**, the PR should not be merged.

---

## 17. Golden Rules
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

---

## Compliance
These guidelines are mandatory for all developers. Any implementation that violates this workflow should be refactored before code review approval.

Following these standards will result in a faster, more scalable, and easier-to-maintain application while minimizing unnecessary API traffic and backend load.
