"use client";

import { useSearchParams } from "next/navigation";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function PatientDetailTabs({ locale, patientId }: { locale: Locale; patientId: string }) {
  const base = `/patients/${patientId}`;
  const params = useSearchParams();
  const tab = params.get("filter") === "tasks" ? "tasks" : (params.get("tab") ?? "timeline");

  return (
    <SegmentedControl
        scroll={false}
        activeId={tab}
        segments={[
          { id: "timeline", label: t(locale, "tabTimeline"), href: `${base}?tab=timeline` },
          { id: "profile", label: t(locale, "tabProfile"), href: `${base}?tab=profile` },
          { id: "treatment", label: t(locale, "tabTreatment"), href: `${base}?tab=treatment` },
          { id: "tasks", label: t(locale, "filterTasks"), href: `${base}?tab=tasks` },
        ]}
    />
  );
}
