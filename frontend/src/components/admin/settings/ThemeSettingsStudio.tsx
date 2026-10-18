"use client";

import { useEffect, useState } from "react";
import { Form, Formik } from "formik";
import * as Yup from "yup";
import { Check, Palette, Type } from "lucide-react";
import { useAdminThemeSettings, useSaveAdminThemeSettings } from "@/hooks/admin/useAdminThemeSettings";
import { defaultThemeTokens, type ThemeTokens } from "@/services/themeSettingsService";
import { LoadingButton, useToast } from "@/components/admin/AdminComponents";

const colorFields: Array<{ key: keyof Pick<ThemeTokens, "primary" | "accent" | "surface" | "textPrimary" | "textSecondary" | "border">; label: string; help: string }> = [
  { key: "primary", label: "Primary brand", help: "Primary actions, selected clinical controls, and links." },
  { key: "accent", label: "Secondary accent", help: "Secondary emphasis and hover states." },
  { key: "surface", label: "Surface background", help: "Storefront canvas and clinical utility panels." },
  { key: "textPrimary", label: "Text primary", help: "Headings, SKU details, and technical readouts." },
  { key: "textSecondary", label: "Text secondary", help: "Supporting labels and operational metadata." },
  { key: "border", label: "Border / divider", help: "Tables, cards, and matrix dividers." },
];

const fonts = ["Inter", "Manrope", "DM Sans", "Source Sans 3", "Roboto"];
const schema = Yup.object(Object.fromEntries(colorFields.map(({ key }) => [key, Yup.string().matches(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "Use a valid HEX colour").required("Required")])));

function ThemePreview({ theme }: { theme: ThemeTokens }) {
  const style = {
    "--preview-primary": theme.primary,
    "--preview-accent": theme.accent,
    "--preview-surface": theme.surface,
    "--preview-text": theme.textPrimary,
    "--preview-muted": theme.textSecondary,
    "--preview-border": theme.border,
    fontFamily: `"${theme.bodyFont}", sans-serif`,
  } as React.CSSProperties;

  return (
    <section aria-label="Live storefront preview" style={style} className="overflow-hidden rounded-2xl border border-[var(--preview-border)] bg-[var(--preview-surface)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--preview-border)] bg-white px-5 py-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--preview-muted)]">Live storefront preview</p>
          <p style={{ fontFamily: `"${theme.headingFont}", sans-serif` }} className="text-[17px] font-extrabold text-[var(--preview-text)]">Clinical ordering workspace</p>
        </div>
        <span className="rounded-full px-3 py-1 text-[11px] font-bold text-white" style={{ backgroundColor: theme.primary }}>Verified stock</span>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="rounded-xl border border-[var(--preview-border)] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--preview-muted)]">SKU MO-022-MBT-UR3</p>
          <p style={{ fontFamily: `"${theme.headingFont}", sans-serif` }} className="mt-1 font-extrabold text-[var(--preview-text)]">Ceramic bracket · .022 slot</p>
          <p className="mt-1 text-[12px] text-[var(--preview-muted)]">MBT prescription · Hook 3 · In stock</p>
        </div>
        <button type="button" className="rounded-lg px-4 py-3 text-[13px] font-bold text-white" style={{ backgroundColor: theme.primary }}>Add matrix lines</button>
      </div>
    </section>
  );
}

function DebouncedThemePreview({ values, onChange }: { values: ThemeTokens; onChange: (theme: ThemeTokens) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onChange(values), 350);
    return () => window.clearTimeout(timer);
  }, [onChange, values]);
  return null;
}

export function ThemeSettingsStudio() {
  const { data, isLoading, isError } = useAdminThemeSettings();
  const saveTheme = useSaveAdminThemeSettings();
  const { showToast } = useToast();
  const [preview, setPreview] = useState<ThemeTokens>(defaultThemeTokens);

  if (isLoading) return <div className="animate-pulse rounded-2xl border border-[#E5E7EB] bg-white p-8 text-sm text-[#52656D]">Loading theme tokens…</div>;
  if (isError) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">Theme settings could not be loaded. Refresh and try again.</div>;

  return (
    <Formik<ThemeTokens>
      enableReinitialize
      initialValues={data ?? defaultThemeTokens}
      validationSchema={schema}
      onSubmit={async (values) => {
        try {
          await saveTheme.mutateAsync(values);
          showToast("Storefront theme saved. Refresh a storefront page to apply it without a rebuild.", "success");
        } catch {
          showToast("Theme settings could not be saved.", "error");
        }
      }}
    >
      {({ values, errors, touched, handleChange, isValid, setFieldValue }) => {
        return (
          <Form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <DebouncedThemePreview values={values} onChange={setPreview} />
            <div className="space-y-6">
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3"><div className="rounded-lg bg-[#EAF4F5] p-2 text-[#0F6B78]"><Palette size={18} /></div><div><h2 className="text-base font-bold text-[#102A33]">Clinical colour system</h2><p className="text-[12.5px] text-[#52656D]">WCAG-aware tokens applied to the storefront at runtime.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {colorFields.map(({ key, label, help }) => (
                    <label key={key} className="rounded-xl border border-[#E5E7EB] p-3.5">
                      <span className="block text-[13px] font-bold text-[#102A33]">{label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-[#52656D]">{help}</span>
                      <span className="mt-3 flex items-center gap-2"><input aria-label={`${label} colour`} type="color" value={values[key]} onChange={(event) => setFieldValue(key, event.target.value)} className="h-9 w-10 cursor-pointer rounded border border-[#D8E2E5] bg-white p-1" /><input name={key} type="text" value={values[key]} onChange={handleChange} className="min-w-0 flex-1 rounded-lg border border-[#D8E2E5] px-3 py-2 text-[13px] font-semibold text-[#102A33] outline-none focus:border-[#0F6B78] focus:ring-2 focus:ring-[#0F6B78]/15" /></span>
                      {touched[key] && errors[key] ? <span className="mt-1 block text-[11px] text-red-600">{errors[key]}</span> : null}
                    </label>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3"><div className="rounded-lg bg-[#EAF4F5] p-2 text-[#0F6B78]"><Type size={18} /></div><div><h2 className="text-base font-bold text-[#102A33]">Typography</h2><p className="text-[12.5px] text-[#52656D]">Fonts are loaded on demand and bound to CSS variables.</p></div></div>
                <div className="grid gap-4 sm:grid-cols-2">{(["headingFont", "bodyFont"] as const).map((field) => <label key={field}><span className="mb-1.5 block text-[13px] font-bold text-[#102A33]">{field === "headingFont" ? "Primary heading font" : "Body font"}</span><select name={field} value={values[field]} onChange={handleChange} className="w-full rounded-lg border border-[#D8E2E5] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#102A33] outline-none focus:border-[#0F6B78]">{fonts.map((font) => <option key={font} value={font}>{font}</option>)}</select></label>)}</div>
              </section>
              <LoadingButton type="submit" loading={saveTheme.isPending} disabled={!isValid} loadingText="Publishing…" className="h-11 rounded-lg bg-[#0F6B78] px-5 text-[13px] font-bold text-white hover:bg-[#0A5560]"><Check size={16} /> Save and publish theme</LoadingButton>
            </div>
            <div className="xl:sticky xl:top-5 xl:self-start"><ThemePreview theme={preview} /><p className="mt-3 text-[12px] leading-relaxed text-[#52656D]">Preview updates 350ms after you change a token. Saving persists the values in PostgreSQL; active storefront pages receive them through the public settings API.</p></div>
          </Form>
        );
      }}
    </Formik>
  );
}
