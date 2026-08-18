"use client";

import { DetailPageEditor } from "./DetailPageEditor";
import { DETAIL_PAGE_CONFIGS } from "@/config/detailPageConfigs";

type Page = any;

interface QualityPageEditorProps {
  page: Page;
  onSaved: () => void;
}

export function QualityPageEditor({ page, onSaved }: QualityPageEditorProps) {
  return (
    <DetailPageEditor
      page={page}
      onSaved={onSaved}
      config={DETAIL_PAGE_CONFIGS["quality-certifications"]}
    />
  );
}
