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
