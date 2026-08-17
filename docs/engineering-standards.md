# Engineering Standards & Development Guidelines

This document defines the coding standards, architecture principles, UI/UX guidelines, and Git workflow that every team member and AI coding assistant (Codex, Cursor, Claude Code, etc.) must follow.

The objective is to build a scalable, maintainable, high-performance application with consistent coding practices.

---

## 1. General Principles
### Keep It Simple
* Write clean and readable code.
* Prefer simple solutions over clever ones.
* Keep functions small and focused.
* Every function should have a single responsibility.

### Don't Repeat Yourself (DRY)
Never duplicate code. If the same logic is used more than once:
* Create a reusable component.
* Create a reusable hook.
* Create a utility/helper.
* Create a shared service.
* Create reusable validation logic.

*If a component already exists, **reuse it** instead of creating another similar component.*

### Reusability First
Before writing any new code, ask:
* Does this component already exist?
* Can I extend an existing component?
* Can I pass props instead?
* Can this be configured rather than duplicated?

#### Example
* **Don't**: Create separate `UserCard`, `AdminCard`, `ManagerCard`
* **Do**:
  ```tsx
  <Card
    title="..."
    subtitle="..."
    image="..."
    actions={...}
    variant="..."
  />
  ```
*Components should be configurable through props instead of duplication.*

---

## 2. Project Structure
Organize files properly:
```
src/
  components/
  pages/
  layouts/
  hooks/
  services/
  controllers/
  api/
  utils/
  helpers/
  constants/
  types/
  schemas/
  validators/
  assets/
  styles/
```
* Never place unrelated files together.
* Avoid huge files.
* Split code into logical modules.

---

## 3. Component Guidelines
Components should be:
* Small
* Reusable
* Configurable
* Stateless whenever possible

Never create a new component if an existing one can be reused. Use props instead of copy-pasting JSX.

#### Example
```tsx
<Button
  loading
  disabled
  size="..."
  variant="..."
  icon={...}
/>
```
*Instead of separate `PrimaryButton`, `SecondaryButton`, `LoadingButton`, `RoundedButton`, etc.*

---

## 4. API Architecture
UI should never call APIs directly. Always use:
`Page` → `Hook` → `Service/API` → `Backend`

### Benefits
* Easier testing
* Better maintainability
* Cleaner UI
* Easier caching

---

## 5. Backend Rules
All data operations must happen on the server. Including:
* Search
* Filtering
* Pagination
* Sorting

Never perform these on the frontend for large datasets.

### Query Parameters
Always use query params.
#### Example
`?page=1&limit=20&search=john&status=active&sort=name&order=desc`

---

## 6. Search Rules
Every search should use:
* Fuzzy Search
* Debouncing

Search should support:
* Partial matches
* Misspellings
* Case insensitive
* Multiple words

*Example*: searching `iphon` should still match `iPhone`.
*Debounce API requests by **300–500ms**. Never hit API on every keystroke.*

---

## 7. Pagination App
Prefer **Infinite Scroll** for the app -> mobile.
### Rules
* Load first page only.
* Load next page on scroll.
* Keep previously loaded data.
* Prevent duplicate requests.
* Preserve scroll position.
* Show loading skeleton while fetching.

Never load entire datasets.

---

## 8. Large Dropdowns
If a dropdown has many records (e.g. 30,000 users):
* **Don't**: Load all 30,000 records.
* **Do**: Use backend search, infinite loading, load next batch on scroll, and virtualized rendering if needed.

---

## 9. Forms
Validate on frontend first.
* Use **Formik** and **Yup** (or standard validation schemas) for validation.
* If validation fails, do not send the API request.
* Backend validation is still mandatory.

### Buttons
Disable buttons:
* Until required fields are completed
* During submission
* During loading

Prevent duplicate submissions.

---

## 10. Number Inputs
Never use `<input type="number">`.
Instead use `type="text"` or `type="tel"`, and validate numbers manually.
### Reason
* Better mobile UX
* Avoid browser inconsistencies
* Prevent invalid values like `e`, `+`, `-`

---

## 11. Tables
All tables must support:
* Backend search
* Backend filtering
* Backend sorting
* Backend pagination

Never fetch complete datasets.

---

## 12. Loading States
Never show blank pages. Every screen must support:
* Skeleton Loading
* Empty State
* Error State
* Success State

### Skeleton Loading
Use skeletons instead of spinners. Every block should have independent loading (e.g. Cards, Lists, Dashboard, Images, Tables, Comments).

### Empty States
Render proper empty states (e.g. No Data, No Users, No Orders, No Results). Should include a helpful message and an optional action button.

---

## 13. Error States
Handle errors gracefully:
* Network failure
* API failure
* Unauthorized
* Validation errors

Never expose raw backend errors to the user.

---

## 14. Responsive Design
Primary breakpoints:
* **Desktop**: `>=1024px`
* **Mobile**: `<1024px`
* Tablet layouts should only be added when the design requires them (blogs, dashboards, content-heavy pages, etc.).

Always verify on Mobile, Tablet, and Desktop.

---

## 15. Images
Always reserve image space. Every image should:
* Have a set aspect ratio
* Prevent layout shifts
* Lazy load below the fold
* Use responsive sizes

Never allow Cumulative Layout Shift (CLS).

---

## 16. UI & Animations
The application should feel premium.
* **Use**: Smooth transitions, smooth loading, smooth modals, smooth accordions, smooth dropdowns, smooth image fade, smooth infinite loading.
* **Avoid**: Flickering, UI jumps, flashing, abrupt animations, layout shifting.
* Animations should be subtle (**150–300ms**).

---

## 17. Performance
Optimize everything. Use:
* Lazy loading
* Code splitting
* Memoization
* Virtualized lists
* Image optimization
* Request caching
* Prefetching when beneficial

Avoid unnecessary re-renders.

---

## 18. State Management
Keep state minimal. Don't store unnecessary global state. Prefer local state whenever possible.

---

## 19. Code Quality
Every PR must:
* Pass TypeScript
* Pass ESLint
* Pass Build
* Remove console logs
* Remove unused imports
* Remove dead code

*No warnings should remain.*

---

## 20. Accessibility
Support:
* Keyboard navigation
* Labels
* Focus states
* Alt text
* Screen readers

---

## 21. Git Workflow
### Branch Strategy
Every feature must have its own branch.
* *Feature*: `feature/login`, `feature/profile`, `feature/payment`, `feature/dashboard`, `feature/user-management`, `feature/infinite-scroll`
* *Bug fixes*: `fix/login-validation`, `fix/payment-crash`
* *Refactoring*: `refactor/dashboard`, `refactor/user-service`

### Development Flow
1. Create a feature branch from `main`.
2. Implement only the scoped feature.
3. Ensure linting, tests, and build pass.
4. Open a Pull Request or merge it with terminal.
5. Get code review and approval.
6. Merge into `main`.
7. Delete the feature branch after the merge.

*Never commit directly to `main`.*

---

## 22. AI Coding Assistant Rules
When generating or modifying code:
* Make only the requested changes.
* Do not refactor unrelated code.
* Follow the existing architecture and coding style.
* Reuse existing components before creating new ones.
* Prefer extending components via props instead of duplicating them.
* Do not introduce new dependencies without approval.
* Keep changes backward compatible.
* Do not change business logic unless explicitly requested.
* Preserve public APIs.
* Keep commits focused on a single feature or fix.
* Ensure TypeScript, ESLint, and build pass before considering the task complete.
* If an existing utility, hook, service, or component solves the problem, use it instead of writing new code.

---

## 23. Definition of Done
A task is complete only when all of the following are satisfied:
* [x] Feature is fully implemented.
* [x] Existing components/utilities were reused wherever possible.
* [x] No duplicate code introduced.
* [x] TypeScript passes with zero errors.
* [x] ESLint passes with zero errors.
* [x] Production build succeeds.
* [x] No console errors or warnings.
* [x] Frontend validation implemented.
* [x] Backend validation implemented.
* [x] Loading, empty, success, and error states handled.
* [x] Responsive on desktop, tablet (where applicable), and mobile.
* [x] Images use fixed aspect ratios to prevent layout shifts.
* [x] Infinite scrolling or server-side pagination implemented where appropriate.
* [x] Search uses fuzzy matching with debounce.
* [x] Performance impact considered.
* [x] Code reviewed and merged through a feature branch.
* [x] Feature branch deleted after merge.
