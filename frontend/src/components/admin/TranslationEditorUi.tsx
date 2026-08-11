import { useState, useEffect } from "react";
import { Languages } from "lucide-react";
import { AdminInput, AdminSelect, AdminTextarea, AdminRichTextEditor, useToast, toastMessages } from "@/components/admin/AdminComponents";
import { cn } from "@/utils/cn";

export type AdminLanguage = { id: string; name: string; code: string; isDefault?: boolean };

export function filterTranslationLanguages(languages: AdminLanguage[]) {
  return languages.filter((lang) => !lang.isDefault);
}

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
}

type EditorTab = "content" | "translations";

export function TranslationModeBar({
  editorTab,
  onTabChange,
  translationLanguages,
  selectedLanguageId,
  onLanguageChange,
}: {
  editorTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  translationLanguages: AdminLanguage[];
  selectedLanguageId: string;
  onLanguageChange: (languageId: string) => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-[#E6E6E6] bg-white p-1">
        <button
          type="button"
          onClick={() => onTabChange("content")}
          className={cn(
            "rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors",
            editorTab === "content" ? "bg-[#1A1A1A] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]",
          )}
        >
          Content
        </button>
        <button
          type="button"
          onClick={() => onTabChange("translations")}
          className={cn(
            "rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors",
            editorTab === "translations" ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]",
          )}
        >
          Translations
        </button>
      </div>

      {editorTab === "translations" && translationLanguages.length > 0 && (
        <div className="w-[220px]">
          <AdminSelect
            label=""
            value={selectedLanguageId}
            onChange={(e) => onLanguageChange(e.target.value)}
            options={translationLanguages.map((lang) => ({
              value: lang.id,
              label: `${lang.name} (${lang.code.toUpperCase()})`,
            }))}
          />
        </div>
      )}
    </div>
  );
}

export function TranslationEditorBanner({ language }: { language: AdminLanguage }) {
  return (
    <div className="mb-5 rounded-xl border border-[#E6E6E6] bg-[#FFFBFB] px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
        <Languages size={15} className="text-[#E31E24]" />
        Editing <span className="font-semibold text-[#1A1A1A]">{language.name} ({language.code.toUpperCase()})</span> — click outside a field or save button to save.
      </div>
    </div>
  );
}

export function TranslationBlurInput({
  label,
  defaultValue,
  englishReference,
  onSave,
  disabled = false,
}: {
  label: string;
  defaultValue: string;
  englishReference?: string | null;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { showToast } = useToast();
  const cleanEnglish = stripHtml(englishReference);

  return (
    <div className="space-y-1">
      <AdminInput
        label={label}
        defaultValue={defaultValue}
        placeholder={cleanEnglish}
        disabled={disabled}
        onBlur={async (e) => {
          const value = e.currentTarget.value.trim();
          const saved = defaultValue.trim();
          if (value === saved) {
            showToast(toastMessages.noChanges, "info");
            return;
          }
          await onSave(value);
        }}
      />
      {cleanEnglish && (
        <p className="text-[11.5px] text-[#9A9A9A]">
          English: <span className="text-[#6B6B6B]">{cleanEnglish}</span>
        </p>
      )}
    </div>
  );
}

export function TranslationBlurField({
  label,
  rows = 1,
  defaultValue,
  englishReference,
  onSave,
  disabled = false,
}: {
  label: string;
  rows?: number;
  defaultValue: string;
  englishReference?: string | null;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { showToast } = useToast();
  const cleanEnglish = stripHtml(englishReference);

  return (
    <div className="space-y-1">
      <AdminTextarea
        label={label}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={cleanEnglish}
        disabled={disabled}
        onBlur={async (e) => {
          const value = e.currentTarget.value.trim();
          const saved = defaultValue.trim();
          if (value === saved) {
            showToast(toastMessages.noChanges, "info");
            return;
          }
          await onSave(value);
        }}
      />
      {cleanEnglish && (
        <p className="text-[11.5px] text-[#9A9A9A] line-clamp-2">
          English: <span className="text-[#6B6B6B]">{cleanEnglish}</span>
        </p>
      )}
    </div>
  );
}

export function TranslationRichTextField({
  label,
  defaultValue,
  englishReference,
  onSave,
  disabled = false,
}: {
  label: string;
  defaultValue: string;
  englishReference?: string | null;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
}) {
  const { showToast } = useToast();
  const [value, setValue] = useState(defaultValue || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(defaultValue || "");
  }, [defaultValue]);

  const cleanEnglish = stripHtml(englishReference);

  const handleSave = async () => {
    const trimmed = value.trim();
    if (trimmed === (defaultValue || "").trim()) {
      showToast(toastMessages.noChanges, "info");
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-[#E6E6E6] bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <label className="text-[13.5px] font-semibold text-[#1A1A1A]">{label}</label>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || saving}
          className="rounded-md bg-[#E31E24] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Translation"}
        </button>
      </div>
      <AdminRichTextEditor
        label=""
        value={value}
        onChange={setValue}
        placeholder="Enter translated description..."
        className="min-h-[220px]"
      />
      {cleanEnglish && (
        <p className="text-[11.5px] text-[#9A9A9A] line-clamp-3">
          English Reference: <span className="text-[#4B5563]">{cleanEnglish}</span>
        </p>
      )}
    </div>
  );
}

export function NoTranslationLanguagesMessage() {
  return (
    <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center">
      <p className="text-[14px] font-medium text-[#1A1A1A]">No translation languages yet</p>
      <p className="mt-1 text-[13px] text-[#9A9A9A]">Add a non-default language in Admin → Translations first.</p>
    </div>
  );
}
