"use client";

import { Languages } from "lucide-react";
import { AdminInput, AdminSelect, AdminTextarea, useToast, toastMessages } from "@/components/admin/AdminComponents";
import { cn } from "@/utils/cn";

export type AdminLanguage = { id: string; name: string; code: string; isDefault?: boolean };

export function filterTranslationLanguages(languages: AdminLanguage[]) {
  return languages.filter((lang) => !lang.isDefault);
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
        Editing <span className="font-semibold text-[#1A1A1A]">{language.name} ({language.code.toUpperCase()})</span> — click outside a field to save.
      </div>
    </div>
  );
}

export function TranslationBlurInput({
  label,
  defaultValue,
  englishReference,
  onSave,
}: {
  label: string;
  defaultValue: string;
  englishReference?: string | null;
  onSave: (value: string) => Promise<void>;
}) {
  const { showToast } = useToast();

  return (
    <div className="space-y-1">
      <AdminInput
        label={label}
        defaultValue={defaultValue}
        placeholder={englishReference ?? ""}
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
      {englishReference && (
        <p className="text-[11.5px] text-[#9A9A9A]">
          English: <span className="text-[#6B6B6B]">{englishReference}</span>
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
}: {
  label: string;
  rows?: number;
  defaultValue: string;
  englishReference?: string | null;
  onSave: (value: string) => Promise<void>;
}) {
  const { showToast } = useToast();

  return (
    <div className="space-y-1">
      <AdminTextarea
        label={label}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={englishReference ?? ""}
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
      {englishReference && (
        <p className="text-[11.5px] text-[#9A9A9A]">
          English: <span className="text-[#6B6B6B]">{englishReference}</span>
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
