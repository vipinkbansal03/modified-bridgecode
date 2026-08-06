const fs = require('fs');

const run = (file) => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // 1. Import
  content = content.replace(/import \{ useFormik \} from "formik";/g, 'import { useAdminForm } from "@/hooks/admin/useAdminForm";');

  // 2. Hook usage
  content = content.replace(/const formik = useFormik/g, 'const form = useAdminForm');

  // 3. formik. -> form.
  content = content.replace(/formik\./g, 'form.');

  // 4. form.touched.xyz || hasSubmitted ? (form.errors.xyz as string) : ""
  content = content.replace(/error=\{form\.touched\.([a-zA-Z0-9_]+) \|\| hasSubmitted \? \(form\.errors\.([a-zA-Z0-9_]+) as string\) : ""\}/g, 'error={form.errors.$2 as string}');
  
  // Also handle without "as string"
  content = content.replace(/error=\{form\.touched\.([a-zA-Z0-9_]+) \|\| hasSubmitted \? form\.errors\.([a-zA-Z0-9_]+) : ""\}/g, 'error={form.errors.$2}');

  // 5. form.touched.xyz ? (form.errors.xyz as string) : ""
  content = content.replace(/error=\{form\.touched\.([a-zA-Z0-9_]+) \? \(form\.errors\.([a-zA-Z0-9_]+) as string\) : ""\}/g, 'error={form.errors.$2 as string}');

  content = content.replace(/error=\{form\.touched\.([a-zA-Z0-9_]+) \? form\.errors\.([a-zA-Z0-9_]+) : ""\}/g, 'error={form.errors.$2}');

  // 6. hasSubmitted ? (form.errors.xyz as string) : ""
  content = content.replace(/error=\{hasSubmitted \? \(form\.errors\.([a-zA-Z0-9_]+) as string\) : ""\}/g, 'error={form.errors.$1 as string}');

  // 7. Remove hasSubmitted definition
  content = content.replace(/const hasSubmitted = form\.submitCount > 0;\n?/g, '');

  // 8. Fix onSubmit signature
  content = content.replace(/onSubmit: async \(values, \{ setSubmitting \}\) => \{/g, 'onSubmit: async (values) => {');
  content = content.replace(/onSubmit: async \(values, \{ setSubmitting, resetForm \}\) => \{/g, 'onSubmit: async (values) => {');

  // 9. Fix setSubmitting calls
  content = content.replace(/setSubmitting\(false\);/g, '');

  // 10. Fix resetForm calls
  content = content.replace(/resetForm\(\);/g, 'form.reset();');

  // 11. Fix form.form.reset
  content = content.replace(/form\.form\.reset\(\);/g, 'form.reset();');

  fs.writeFileSync(file, content);
  console.log('Refactored', file);
};

run('src/app/admin/coupons/page.tsx');
run('src/app/admin/discounts/page.tsx');
run('src/app/admin/orders/create/page.tsx');
run('src/app/admin/orders/[id]/page.tsx');
run('src/app/admin/quotes/create/page.tsx');
run('src/app/admin/quotes/[id]/page.tsx');
run('src/app/admin/newsletter/page.tsx');
run('src/app/admin/ai-tools/page.tsx');
