"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { Locale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

export function PatientDetailTabs({ locale, patientId }: { locale: Locale; patientId: string }) {
  const base = `/patients/${patientId}`;
  const params = useSearchParams();
  const tab = params.get("filter") === "tasks" ? "tasks" : (params.get("tab") ?? "timeline");
  const bar = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const pin = () => bar.current?.scrollIntoView({ block: "start", inline: "nearest" });
    pin();
    const frame = window.requestAnimationFrame(pin);
    return () => window.cancelAnimationFrame(frame);
  }, [tab]);

  return (
    <div ref={bar} className="scroll-mt-3">
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
    </div>
  );
}
