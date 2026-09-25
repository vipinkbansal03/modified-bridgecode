"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import {
  AdminInput,
  AdminRichTextEditor,
  AdminSelect,
  StatusBadge,
  useToast,
  toastMessages,
} from "@/components/admin/AdminComponents";
import {
  filterTranslationLanguages,
  TranslationBlurField,
  TranslationBlurInput,
  TranslationRichTextField,
  TranslationEditorBanner,
  NoTranslationLanguagesMessage,
} from "@/components/admin/TranslationEditorUi";
import { useAdminLanguages } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

export type ProductTranslationField =
  | "title"
  | "shortDescription"
  | "description"
  | "seoTitle"
  | "seoDescription"
  | "seoKeywords"
  | "highlights"
  | "technicalSpecs"
  | "warranty"
  | "primaryFeatures";

export type ProductTranslationDraft = {
  highlights: Array<{ title: string; description: string; image?: string }>;
  technicalSpecs: Array<{ label: string; value: string; image?: string }>;
  warranty: string[];
  primaryFeatures: Array<{ title: string; description: string; image?: string }>;
};

export interface TabTranslationsProps {
  productId: string;
  product: any;
  refetch: () => Promise<any>;
}

export function TabTranslations({ productId, product, refetch }: TabTranslationsProps) {
  const { showToast } = useToast();
  const { data: languages = [] } = useAdminLanguages();
  const [translationLanguageId, setTranslationLanguageId] = useState("");
  const [translationDrafts, setTranslationDrafts] = useState<Record<string, ProductTranslationDraft>>({});

  const translationLanguages = useMemo(() => filterTranslationLanguages(languages), [languages]);
  const activeTranslationLang = translationLanguages.find((lang) => lang.id === translationLanguageId) ?? translationLanguages[0];

  useEffect(() => {
    if (!activeTranslationLang?.id || !product) return;
    setTranslationDrafts((current) => {
      if (current[activeTranslationLang.id]) return current;
      const translation = product.translations?.find((tr: { languageId: string }) => tr.languageId === activeTranslationLang.id) as {
        highlights?: Array<{ title: string; description: string; image?: string }> | string | null;
        technicalSpecs?: Array<{ label: string; value: string; image?: string }> | string | null;
        warranty?: string[] | string | null;
        primaryFeatures?: Array<{ title: string; description: string; image?: string }> | string | null;
      } | undefined;

      return {
        ...current,
        [activeTranslationLang.id]: {
          highlights: Array.isArray(translation?.highlights) ? translation.highlights : Array.isArray(product.highlights) ? product.highlights : [],
          technicalSpecs: Array.isArray(translation?.technicalSpecs) ? translation.technicalSpecs : Array.isArray(product.technicalSpecs) ? product.technicalSpecs : [],
          warranty: Array.isArray(translation?.warranty) ? translation.warranty : Array.isArray(product.warranty) ? product.warranty : [],
          primaryFeatures: Array.isArray(translation?.primaryFeatures) ? translation.primaryFeatures : Array.isArray(product.primaryFeatures) ? product.primaryFeatures : [],
        },
      };
    });
  }, [activeTranslationLang?.id, product]);

  const saveProductTranslation = async (languageId: string, field: ProductTranslationField, value: string) => {
    const trimmed = value.trim();
    try {
      await adminApi.put(`/translations/products/${productId}/${languageId}`, { [field]: trimmed });
      showToast(toastMessages.translationSaved);
      refetch();
    } catch {
      showToast(toastMessages.translationFailed, "error");
    }
  };

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Translations</h3>
        <div className="flex flex-wrap items-center gap-2">
          {translationLanguages.length > 0 && (
            <div className="w-[220px]">
              <AdminSelect
                label=""
                value={translationLanguageId || activeTranslationLang?.id || ""}
                onChange={(e) => setTranslationLanguageId(e.target.value)}
                options={translationLanguages.map((lang) => ({
                  value: lang.id,
                  label: `${lang.name} (${lang.code.toUpperCase()})`,
                }))}
              />
            </div>
          )}
          <button
            onClick={async () => {
              try {
                const result = await adminApi.post("/translations/generate", { productId });
                showToast(`Generated ${result.data.data.generated} translation${result.data.data.generated === 1 ? "" : "s"}.`);
                refetch();
              } catch (error) {
                showToast(getAdminErrorMessage(error, "Failed to generate translations."), "error");
              }
            }}
            className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333]"
          >
            <Zap size={14} /> AI Generate All
          </button>
        </div>
      </div>

      {translationLanguages.length === 0 ? (
        <NoTranslationLanguagesMessage />
      ) : activeTranslationLang && product ? (
        <div className="space-y-4">
          <TranslationEditorBanner language={activeTranslationLang} />
          {(() => {
            const t = product.translations?.find((tr: { languageId: string }) => tr.languageId === activeTranslationLang.id) as {
              id?: string;
              languageId: string;
              title?: string | null;
              shortDescription?: string | null;
              description?: string | null;
              seoTitle?: string | null;
              seoDescription?: string | null;
              seoKeywords?: string | null;
              highlights?: Array<{ title: string; description: string; image?: string }> | string | null;
              technicalSpecs?: Array<{ label: string; value: string; image?: string }> | string | null;
              warranty?: string[] | string | null;
              primaryFeatures?: Array<{ title: string; description: string }> | string | null;
              isAiGenerated?: boolean;
              status?: string;
            } | undefined;
            const draft = translationDrafts[activeTranslationLang.id] ?? {
              highlights: Array.isArray(t?.highlights)
                ? t.highlights
                : Array.isArray(product.highlights)
                  ? (product.highlights as Array<{ title: string; description: string; image?: string }>)
                  : [],
              technicalSpecs: Array.isArray(t?.technicalSpecs)
                ? t.technicalSpecs
                : Array.isArray(product.technicalSpecs)
                  ? (product.technicalSpecs as Array<{ label: string; value: string; image?: string }>)
                  : [],
              warranty: Array.isArray(t?.warranty)
                ? t.warranty
                : Array.isArray(product.warranty)
                  ? (product.warranty as string[])
                  : [],
              primaryFeatures: Array.isArray(t?.primaryFeatures)
                ? t.primaryFeatures
                : Array.isArray(product.primaryFeatures)
                  ? (product.primaryFeatures as Array<{ title: string; description: string }>)
                  : [],
            };

            const setDraft = <K extends keyof ProductTranslationDraft>(field: K, value: ProductTranslationDraft[K]) => {
              setTranslationDrafts((current) => ({
                ...current,
                [activeTranslationLang.id]: {
                  ...(current[activeTranslationLang.id] ?? draft),
                  [field]: value,
                },
              }));
            };

            const saveDraft = async (field: keyof ProductTranslationDraft) => {
              await saveProductTranslation(activeTranslationLang.id, field, JSON.stringify(draft[field]));
            };

            return (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {t?.status && <StatusBadge status={t.status} />}
                  {t?.isAiGenerated && (
                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">AI Generated</span>
                  )}
                </div>

                {t?.status === "PENDING_REVIEW" && t.id && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <span className="text-[12.5px] text-amber-800">This translation is pending review and is not live on the storefront yet.</span>
                    <button
                      onClick={async () => {
                        try {
                          await adminApi.put(`/translations/products/translations/${t.id}/approve`);
                          showToast("Translation approved.");
                          refetch();
                        } catch {
                          showToast("Failed to approve translation.", "error");
                        }
                      }}
                      className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-[12px] font-medium text-green-700 hover:bg-green-100"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await adminApi.put(`/translations/products/translations/${t.id}/reject`);
                          showToast("Translation rejected.");
                          refetch();
                        } catch {
                          showToast("Failed to reject translation.", "error");
                        }
                      }}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-[12px] font-medium text-red-700 hover:bg-red-100"
                    >
                      Reject
                    </button>
                  </div>
                )}

                <TranslationBlurInput
                  key={`title-${activeTranslationLang.id}-${t?.title ?? ""}`}
                  label="Title"
                  defaultValue={t?.title || ""}
                  englishReference={product.title}
                  onSave={(value) => saveProductTranslation(activeTranslationLang.id, "title", value)}
                />
                <TranslationBlurField
                  key={`shortDescription-${activeTranslationLang.id}-${t?.shortDescription ?? ""}`}
                  label="Short Description"
                  rows={2}
                  defaultValue={t?.shortDescription || ""}
                  englishReference={product.shortDescription || ""}
                  onSave={(value) => saveProductTranslation(activeTranslationLang.id, "shortDescription", value)}
                />
                <TranslationRichTextField
                  key={`description-${activeTranslationLang.id}-${t?.description ?? ""}`}
                  label="Full Description"
                  defaultValue={t?.description || ""}
                  englishReference={product.description || ""}
                  onSave={(value) => saveProductTranslation(activeTranslationLang.id, "description", value)}
                />
                <TranslationBlurInput
                  key={`seoTitle-${activeTranslationLang.id}-${t?.seoTitle ?? ""}`}
                  label="SEO Title (max 60 chars)"
                  defaultValue={t?.seoTitle || ""}
                  englishReference={product.seoTitle || product.title}
                  onSave={(value) => saveProductTranslation(activeTranslationLang.id, "seoTitle", value)}
                />
                <TranslationBlurField
                  key={`seoDescription-${activeTranslationLang.id}-${t?.seoDescription ?? ""}`}
                  label="SEO Description (max 160 chars)"
                  rows={3}
                  defaultValue={t?.seoDescription || ""}
                  englishReference={product.seoDescription || product.shortDescription || ""}
                  onSave={(value) => saveProductTranslation(activeTranslationLang.id, "seoDescription", value)}
                />
                <TranslationBlurInput
                  key={`seoKeywords-${activeTranslationLang.id}-${t?.seoKeywords ?? ""}`}
                  label="SEO Keywords"
                  defaultValue={t?.seoKeywords || ""}
                  englishReference={product.seoKeywords || ""}
                  onSave={(value) => saveProductTranslation(activeTranslationLang.id, "seoKeywords", value)}
                />
                <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Features</h4>
                      <p className="text-[12.5px] text-[#6B6B6B]">Add title and description for each feature.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setDraft("highlights", [...draft.highlights, { title: "", description: "" }])} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                        Add highlight
                      </button>
                      <button type="button" onClick={() => void saveDraft("highlights")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]">
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {draft.highlights.map((item, index) => (
                      <div key={index} className="grid gap-3 lg:grid-cols-[1fr_1.5fr_auto] items-stretch">
                        <AdminInput label="Title" value={item.title} onChange={(event) => {
                          const next = [...draft.highlights];
                          next[index] = { ...next[index], title: event.target.value };
                          setDraft("highlights", next);
                        }} />
                        <AdminRichTextEditor label="Description" value={item.description} placeholder="Enter translated highlight description" onChange={(value) => {
                          const next = [...draft.highlights];
                          next[index] = { ...next[index], description: value };
                          setDraft("highlights", next);
                        }} className="min-h-[120px]" />
                        <div className="flex items-end">
                          <button type="button" onClick={() => setDraft("highlights", draft.highlights.filter((_, i) => i !== index))} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {!draft.highlights.length && <p className="text-[13px] text-[#6B6B6B]">No highlights added yet.</p>}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Key Specifications</h4>
                      <p className="text-[12.5px] text-[#6B6B6B]">Add label and value rows for the translated Key Specifications table.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setDraft("technicalSpecs", [...draft.technicalSpecs, { label: "", value: "" }])} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                        Add spec
                      </button>
                      <button type="button" onClick={() => void saveDraft("technicalSpecs")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]">
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {draft.technicalSpecs.map((item, index) => (
                      <div key={index} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
                        <AdminInput label="Label" value={item.label} onChange={(event) => {
                          const next = [...draft.technicalSpecs];
                          next[index] = { ...next[index], label: event.target.value };
                          setDraft("technicalSpecs", next);
                        }} />
                        <AdminInput label="Value" value={item.value} onChange={(event) => {
                          const next = [...draft.technicalSpecs];
                          next[index] = { ...next[index], value: event.target.value };
                          setDraft("technicalSpecs", next);
                        }} />
                        <button type="button" onClick={() => setDraft("technicalSpecs", draft.technicalSpecs.filter((_, i) => i !== index))} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]">
                          Remove
                        </button>
                      </div>
                    ))}
                    {!draft.technicalSpecs.length && <p className="text-[13px] text-[#6B6B6B]">No technical specifications added yet.</p>}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Warranty</h4>
                      <p className="text-[12.5px] text-[#6B6B6B]">Add translated warranty lines.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setDraft("warranty", [...draft.warranty, ""])} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                        Add line
                      </button>
                      <button type="button" onClick={() => void saveDraft("warranty")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]">
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {draft.warranty.map((line, index) => (
                      <div key={index} className="grid gap-3 sm:grid-cols-[1fr_auto] items-stretch">
                        <AdminRichTextEditor label={`Warranty line ${index + 1}`} value={line} placeholder="Enter translated warranty text" onChange={(value) => {
                          const next = [...draft.warranty];
                          next[index] = value;
                          setDraft("warranty", next);
                        }} className="min-h-[80px]" />
                        <div className="flex items-end">
                          <button type="button" onClick={() => setDraft("warranty", draft.warranty.filter((_, i) => i !== index))} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {!draft.warranty.length && <p className="text-[13px] text-[#6B6B6B]">No warranty lines added yet.</p>}
                  </div>
                </div>

                <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[14px] font-semibold text-[#1A1A1A]">Direction To Use</h4>
                      <p className="text-[12.5px] text-[#6B6B6B]">Add translated Direction To Use instructions and guidelines.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setDraft("primaryFeatures", [...draft.primaryFeatures, { title: "", description: "" }])} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]">
                        Add feature
                      </button>
                      <button type="button" onClick={() => void saveDraft("primaryFeatures")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]">
                        Save
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {draft.primaryFeatures.map((item, index) => (
                      <div key={index} className="grid gap-3 lg:grid-cols-[1fr_1.5fr_auto] items-stretch">
                        <AdminInput label="Title" value={item.title} onChange={(event) => {
                          const next = [...draft.primaryFeatures];
                          next[index] = { ...next[index], title: event.target.value };
                          setDraft("primaryFeatures", next);
                        }} />
                        <AdminRichTextEditor label="Description" value={item.description} placeholder="Enter translated feature description" onChange={(value) => {
                          const next = [...draft.primaryFeatures];
                          next[index] = { ...next[index], description: value };
                          setDraft("primaryFeatures", next);
                        }} className="min-h-[120px]" />
                        <div className="flex items-end">
                          <button type="button" onClick={() => setDraft("primaryFeatures", draft.primaryFeatures.filter((_, i) => i !== index))} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    {!draft.primaryFeatures.length && <p className="text-[13px] text-[#6B6B6B]">No primary features added yet.</p>}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

export default TabTranslations;
