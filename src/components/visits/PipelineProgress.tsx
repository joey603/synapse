"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ACTIVE = new Set(["TRANSCRIBING", "EXTRACTING", "GENERATING"]);

export function PipelineProgress({
  visitId,
  status,
  labels,
  polling,
}: {
  visitId: string;
  status: string;
  labels: [string, string, string, string];
  polling: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);

  useEffect(() => {
    setCurrent(status);
  }, [status]);

  useEffect(() => {
    if (current === "READY" || current === "FAILED") return;
    if (!polling && !ACTIVE.has(current)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/visits/${visitId}/pipeline`);
      if (!response.ok) return;
      const data = (await response.json()) as { pipelineStatus?: string };
      if (data.pipelineStatus && data.pipelineStatus !== current) {
        setCurrent(data.pipelineStatus);
        router.refresh();
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [current, polling, router, visitId]);

  const steps = [
    { id: "upload", label: labels[0], done: current !== "IDLE" },
    { id: "transcribe", label: labels[1], done: past(current, "TRANSCRIBED") },
    { id: "extract", label: labels[2], done: past(current, "EXTRACTED") },
    { id: "report", label: labels[3], done: current === "READY" },
  ];

  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step) => (
        <li key={step.id} className="flex items-center gap-3 text-sm">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              step.done ? "bg-accent" : current.includes(step.id.slice(0, 4)) ? "bg-accent/40" : "bg-line"
            }`}
          />
          <span className={step.done ? "text-ink" : "text-muted"}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function past(status: string, marker: string) {
  const order = ["IDLE", "UPLOADED", "TRANSCRIBING", "TRANSCRIBED", "EXTRACTING", "EXTRACTED", "GENERATING", "READY"];
  if (status === "FAILED") return false;
  return order.indexOf(status) >= order.indexOf(marker);
}
