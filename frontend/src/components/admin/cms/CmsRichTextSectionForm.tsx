"use client";

import { AdminInput, AdminTextarea } from "@/components/admin/AdminComponents";
import type { RichTextConfig } from "@/config/detailPageConfigs";

export interface CmsRichTextSectionValues {
  heading: string;
  paragraph1: string;
  paragraph2?: string;
  linkLabel?: string;
  linkUrl?: string;
  image?: string;
}

interface CmsRichTextSectionFormProps {
  values: CmsRichTextSectionValues;
  onChange: (next: CmsRichTextSectionValues) => void;
  headingLabel?: string;
  paragraph1Label?: string;
  paragraph2Label?: string;
  config?: RichTextConfig;
}

export function CmsRichTextSectionForm({
  values,
  onChange,
  headingLabel,
  paragraph1Label,
  paragraph2Label,
  config,
}: CmsRichTextSectionFormProps) {
  const hLabel = config?.headingLabel || headingLabel || "Section Heading";
  const p1Label = config?.paragraph1Label || paragraph1Label || "First Paragraph (Overview & Standards)";
  const p2Label = config?.paragraph2Label ?? paragraph2Label ?? "Second Paragraph (Accreditations & Details)";
  const allowCta = config?.allowCtaButton ?? Boolean(values.linkLabel || values.linkUrl);
  const allowImage = config?.allowImage ?? Boolean(values.image);

  return (
    <div className="space-y-4">
      <AdminInput
        label={hLabel}
        placeholder="e.g. Quality management system"
        value={values.heading || ""}
        onChange={(e) => onChange({ ...values, heading: e.target.value })}
        required
      />

      <AdminTextarea
        label={p1Label}
        placeholder="Enter main narrative text..."
        rows={4}
        value={values.paragraph1 || ""}
        onChange={(e) => onChange({ ...values, paragraph1: e.target.value })}
        required
      />

      {p2Label !== "" && (
        <AdminTextarea
          label={p2Label}
          placeholder="Enter supplementary narrative text..."
          rows={4}
          value={values.paragraph2 || ""}
          onChange={(e) => onChange({ ...values, paragraph2: e.target.value })}
        />
      )}

      {allowCta && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#EDEDED]">
          <AdminInput
            label="CTA Button Label"
            placeholder={config?.ctaLabelDefault || "e.g. Know more"}
            value={values.linkLabel || ""}
            onChange={(e) => onChange({ ...values, linkLabel: e.target.value })}
          />
          <AdminInput
            label="CTA Destination URL"
            placeholder={config?.ctaHrefDefault || "e.g. /about"}
            value={values.linkUrl || ""}
            onChange={(e) => onChange({ ...values, linkUrl: e.target.value })}
          />
        </div>
      )}

      {allowImage && (
        <div className="pt-2 border-t border-[#EDEDED]">
          <AdminInput
            label="Section Image URL"
            placeholder="https://images.unsplash.com/..."
            value={values.image || ""}
            onChange={(e) => onChange({ ...values, image: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
