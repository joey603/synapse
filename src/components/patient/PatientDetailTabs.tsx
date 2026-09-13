"use client";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function PatientDetailTabs({ locale, patientId }: { locale: Locale; patientId: string }) {
  const base = `/patients/${patientId}`;

  return (
    <SegmentedControl
      segments={[
        { id: "timeline", label: t(locale, "tabTimeline"), href: `${base}?tab=timeline` },
        { id: "profile", label: t(locale, "tabProfile"), href: `${base}?tab=profile` },
        { id: "treatment", label: t(locale, "tabTreatment"), href: `${base}?tab=treatment` },
      ]}
    />
  );
}
