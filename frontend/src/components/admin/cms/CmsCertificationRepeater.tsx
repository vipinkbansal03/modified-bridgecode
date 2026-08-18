"use client";

import { CmsCardRepeater, type CardItem, type CmsCardsValues } from "./CmsCardRepeater";

export type CertificationCardItem = CardItem;
export type CmsCertificationsValues = CmsCardsValues;

interface CmsCertificationRepeaterProps {
  values: CmsCertificationsValues;
  onChange: (next: CmsCertificationsValues) => void;
  headingLabel?: string;
}

export function CmsCertificationRepeater({
  values,
  onChange,
  headingLabel = "Section Heading",
}: CmsCertificationRepeaterProps) {
  return (
    <CmsCardRepeater
      values={values}
      onChange={onChange}
      headingLabel={headingLabel}
      config={{
        itemLabel: "Certification",
        defaultIcon: "BadgeCheck",
        allowLinks: true,
        allowFileUpload: true,
        linkLabelDefault: "View certificate",
      }}
    />
  );
}
