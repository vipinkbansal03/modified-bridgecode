# BRIDGESTONE TECHNOLOGY - PROJECT RULES & INSTRUCTIONS

All development on this project must strictly comply with the following 4 authoritative documents:

1. **Technical Requirements Document (TRD):** [.agents/TRD.md](file:///c:/Users/dev/Desktop/bridgestone/Modern_Orthodontics/.agents/TRD.md)
   - Architecture, B2B workflows (RFQ, Draft Orders), User Roles, Product Attributes (Dropdown, X-Grid, Y-Grid), Country Mapping, and Pricing Priority.

2. **Engineering Standards & Development Guidelines:** [.agents/engineering_standards.md](file:///c:/Users/dev/Desktop/bridgestone/Modern_Orthodontics/.agents/engineering_standards.md)
   - DRY principle, reusability, modular structure, server-side data operations, Formik+Yup validation, Skeleton loading, Number input rules (`type="text"`/`tel"`), and Definition of Done.

3. **API Integration & Data Fetching Workflow:** [.agents/api_integration_workflow.md](file:///c:/Users/dev/Desktop/bridgestone/Modern_Orthodontics/.agents/api_integration_workflow.md)
   - Centralized API layer (`UI -> Hook -> Service -> API Client`), zero direct `fetch`/`axios` in components, no polling (use SSE or React Query), 300–500ms debouncing, request deduplication & cancellation.

4. **Code Modification Rules (STRICT COMPLIANCE):**
   - Make the smallest possible change to achieve functionality.
   - NEVER rewrite an entire function, component, class, or file if only a few lines need to change.
   - Preserve formatting, indentation, spacing, comments, line order, variable names, and coding style.
   - Do not refactor unrelated code or reorder imports unless necessary.
   - Only touch lines directly related to requested change; treat minimizing git diff as a hard requirement.

5. **Validation Rule (STRICT COMPLIANCE):**
   - Do not run `npm run build` after every small change.
   - Use the lightest appropriate validation for the change:
     * CSS/style-only changes → manually verify the affected UI.
     * Small UI/component changes → manually verify + `npx tsc --noEmit` when TypeScript/JSX is affected.
     * Shared component, API, routing, or architectural changes → run `npx tsc --noEmit` and relevant functional checks.
     * Major refactors or changes affecting build-time/server-side behavior → run `npm run build`.
     * Run the full production build before completing a major feature/module migration or before deployment/merge validation.
   - Avoid running a full production build unnecessarily after minor CSS, layout, text, or isolated UI changes.

