# ENGINEERING STANDARDS & DEVELOPMENT GUIDELINES

## 1. General Principles
- **Keep It Simple:** Clean, readable code over clever solutions. Small, single-responsibility functions.
- **Don't Repeat Yourself (DRY):** Never duplicate code. Create reusable components, hooks, utilities, shared services, and validators. Reuse existing components instead of creating similar ones.
- **Reusability First:** Before writing new code, extend existing components via props and configuration rather than duplicating JSX.

## 2. Project Structure
Organize files properly into `components/`, `pages/`, `layouts/`, `hooks/`, `services/`, `controllers/`, `api/`, `utils/`, `helpers/`, `constants/`, `types/`, `schemas/`, `validators/`, `assets/`, `styles/`. Never place unrelated files together. Avoid huge files; split code into logical modules.

## 3. Component Guidelines
- Components must be small, reusable, configurable, and stateless whenever possible.
- Use props instead of copy-pasting JSX or creating variant components (e.g. `<Button variant="..." />` instead of `PrimaryButton`/`SecondaryButton`).

## 4. API Architecture & Data Flow
- UI should **never** call APIs directly.
- Pattern: `Page` -> `Hook` -> `Service/API` -> `Backend`.
- Components must never directly invoke raw `fetch` or `axios`.

## 5. Backend & Data Operations Rules
- Server-side data processing: Search, filtering, pagination, and sorting for large datasets must happen on the server.
- Always use standard query parameters (`?page=1&limit=20&search=...&sort=...`).

## 6. Search Rules
- Implement fuzzy search, case-insensitivity, partial matching, and debouncing (300–500ms delay).
- Never hit the backend API on every single keystroke.

## 7. Pagination, Dropdowns & Data Loading
- Use server-side pagination / infinite scroll for mobile.
- Never fetch complete datasets at once.
- Large dropdowns must use backend search, infinite scroll / virtualization.

## 8. Forms & Inputs
- Validate on the frontend first using Formik + Yup. If validation fails, block API submission.
- Disable submit buttons until required fields are valid and during active loading/submission to prevent duplicate requests.
- **Number Inputs:** Avoid `<input type="number">` due to browser inconsistencies and invalid inputs (`e`, `+`, `-`). Use `type="text"` or `type="tel"` and validate numbers manually.

## 9. Tables, Loading, Empty & Error States
- All tables must support backend search, filtering, sorting, and pagination.
- Never show blank pages. Always implement Skeleton Loading (instead of spinners), Empty States (with helpful messages and actions), and Error States (handled gracefully without exposing raw backend errors).

## 10. Responsive Design & Images
- Breakpoints: Desktop `>=1024px`, Mobile `<1024px`.
- Images must reserve layout space (aspect ratio) to prevent cumulative layout shift (CLS). Use responsive sizes and lazy loading below the fold.

## 11. UI, Animations & Performance
- Subtle animations (150–300ms). Avoid flickering, UI jumps, or layout shifts.
- Optimize performance: code splitting, lazy loading, memoization, request caching. Keep local state minimal.

## 12. Code Quality & Definition of Done
Every task/PR must:
- Pass TypeScript checks with zero errors (`tsc --noEmit`).
- Pass ESLint checks with zero warnings.
- Comply with the Validation Rule:
  * Do not run `npm run build` after every small change.
  * Use the lightest appropriate validation for the change:
    - CSS/style-only changes → manually verify the affected UI.
    - Small UI/component changes → manually verify + `npx tsc --noEmit` when TypeScript/JSX is affected.
    - Shared component, API, routing, or architectural changes → run `npx tsc --noEmit` and relevant functional checks.
    - Major refactors or changes affecting build-time/server-side behavior → run `npm run build`.
    - Run the full production build before completing a major feature/module migration or before deployment/merge validation.
  * Avoid running a full production build unnecessarily after minor CSS, layout, text, or isolated UI changes.
- Remove console logs, unused imports, and dead code.
- Handle loading, empty, success, and error states.

