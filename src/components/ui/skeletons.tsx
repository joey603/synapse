import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { resolveLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/messages";

const card = "overflow-hidden rounded-synapse-md bg-card ring-1 ring-line/70";

function Shell({ label, children, className = "gap-5" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col ${className}`} aria-busy="true" aria-live="polite">
      <div dir="ltr" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-accent-soft">
        <div className="h-full w-1/3 animate-[synapse-loading_1s_ease-in-out_infinite] bg-accent" />
      </div>
      <p className="sr-only">{label}</p>
      {children}
    </div>
  );
}

function Bone({ className, tone = "line" }: { className: string; tone?: "line" | "accent" | "field" }) {
  const fill = tone === "accent" ? "bg-accent/30" : tone === "field" ? "bg-field" : "bg-line";
  return <div className={`animate-pulse ${fill} ${className}`} />;
}

function BackBone() {
  return (
    <div className="flex min-h-10 items-center gap-1">
      <Bone className="h-4 w-4 rounded-full" />
      <Bone className="h-3.5 w-16 rounded-full" />
    </div>
  );
}

function TitleBone({ withHint = false }: { withHint?: boolean }) {
  return (
    <div>
      <Bone className="h-8 w-48 rounded-2xl" />
      {withHint ? <Bone className="mt-2 h-4 w-32 rounded-full" /> : null}
    </div>
  );
}

function Rows({
  count,
  icon = "circle",
  trailing = "chevron",
}: {
  count: number;
  icon?: "circle" | "square" | "none" | "radio";
  trailing?: "chevron" | "badge" | "none";
}) {
  return (
    <div className={card}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          {index > 0 ? <div className="border-t border-line/70" /> : null}
          <div className="flex min-h-[4.5rem] items-center gap-3 px-4 py-3">
            {icon === "circle" ? <Bone className="h-11 w-11 shrink-0 rounded-full" /> : null}
            {icon === "square" ? <Bone className="h-11 w-11 shrink-0 rounded-2xl" /> : null}
            {icon === "radio" ? <Bone className="h-4 w-4 shrink-0 rounded-full" /> : null}
            <div className="min-w-0 flex-1">
              <Bone className="h-4 w-36 rounded-full" />
              {icon !== "radio" ? <Bone className="mt-2 h-3.5 w-24 rounded-full" /> : null}
            </div>
            {trailing === "chevron" ? <Bone className="h-4 w-4 shrink-0 rounded-full" /> : null}
            {trailing === "badge" ? <Bone className="h-6 w-16 shrink-0 rounded-full" /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldBones({ count, tall = false }: { count: number; tall?: boolean }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-1.5">
          <Bone className="h-3.5 w-24 rounded-full" />
          <Bone tone="field" className={tall ? "h-24 rounded-2xl" : "h-12 rounded-2xl"} />
        </div>
      ))}
    </>
  );
}

async function label() {
  const store = await cookies();
  return t(resolveLocale(store.get("synapse_locale")?.value), "loading");
}

export async function HomeLoading() {
  return (
    <Shell label={await label()} className="-mx-1 flex-1 justify-between gap-6">
      <div>
        <Bone className="h-4 w-28 rounded-full" />
        <Bone className="mt-2 h-8 w-44 rounded-2xl" />
      </div>
      <div className={`${card} flex items-center gap-4 p-4`}>
        <Bone className="h-14 w-14 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Bone className="h-3 w-20 rounded-full" />
          <Bone className="mt-2 h-4 w-36 rounded-full" />
          <Bone className="mt-2 h-3.5 w-28 rounded-full" />
        </div>
        <Bone className="h-4 w-4 shrink-0 rounded-full" />
      </div>
      <div className={`${card} flex items-center gap-4 p-4`}>
        <Bone className="h-14 w-14 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <Bone className="h-4 w-32 rounded-full" />
          <Bone className="mt-2 h-3.5 w-40 rounded-full" />
        </div>
        <Bone className="h-4 w-4 shrink-0 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className={`${card} flex min-h-[7.5rem] flex-col gap-3 p-4`}>
            <Bone className="h-11 w-11 rounded-2xl" />
            <div>
              <Bone className="h-4 w-20 rounded-full" />
              <Bone className="mt-2 h-3 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <section className="flex flex-col gap-3">
        <Bone className="h-4 w-40 rounded-full" />
        <Rows count={2} />
      </section>
    </Shell>
  );
}

export async function PatientsLoading() {
  return (
    <Shell label={await label()}>
      <TitleBone />
      <Bone tone="accent" className="h-12 rounded-2xl" />
      <Bone className="h-12 rounded-2xl" />
      <div className="flex rounded-2xl bg-surface p-1">
        <Bone className="h-10 flex-1 rounded-xl bg-card" />
        <Bone className="h-10 flex-1 rounded-xl bg-transparent" />
      </div>
      <Rows count={5} trailing="badge" />
    </Shell>
  );
}

export async function PatientLoading() {
  return (
    <Shell label={await label()}>
      <BackBone />
      <div className={`${card} flex items-start gap-4 p-5`}>
        <Bone className="h-16 w-16 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <Bone className="h-6 w-40 rounded-2xl" />
          <Bone className="mt-2 h-3.5 w-28 rounded-full" />
          <Bone className="mt-3 h-6 w-16 rounded-full" />
        </div>
        <Bone className="h-9 w-16 shrink-0 rounded-full" />
      </div>
      <Bone tone="accent" className="h-12 rounded-2xl" />
      <div className={`${card} p-5`}>
        <Bone className="h-3.5 w-28 rounded-full" />
        <Bone className="mt-3 h-4 w-full rounded-full" />
        <Bone className="mt-2 h-4 w-4/5 rounded-full" />
      </div>
      <div className="flex rounded-2xl bg-surface p-1">
        {Array.from({ length: 3 }, (_, index) => (
          <Bone key={index} className={`h-10 flex-1 rounded-xl ${index === 0 ? "bg-card" : "bg-transparent"}`} />
        ))}
      </div>
      <Rows count={3} icon="none" trailing="badge" />
    </Shell>
  );
}

export async function NearbyLoading() {
  return (
    <Shell label={await label()}>
      <BackBone />
      <TitleBone withHint />
      <Bone className="h-72 rounded-3xl" />
      <Rows count={4} trailing="badge" />
    </Shell>
  );
}

export async function AgendaLoading() {
  return (
    <Shell label={await label()}>
      <BackBone />
      <TitleBone withHint />
      <div className={`${card} p-3`}>
        <div className="flex items-center justify-between gap-2 px-1 pb-3">
          <Bone className="h-11 w-11 rounded-full" />
          <Bone className="h-4 w-28 rounded-full" />
          <Bone className="h-11 w-11 rounded-full" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, index) => (
            <Bone key={`h-${index}`} className="mx-auto h-3 w-6 rounded-full" />
          ))}
          {Array.from({ length: 35 }, (_, index) => (
            <Bone key={index} className="min-h-11 rounded-2xl" />
          ))}
        </div>
      </div>
    </Shell>
  );
}

export async function ListPageLoading({ back = true, hint = true }: { back?: boolean; hint?: boolean }) {
  return (
    <Shell label={await label()}>
      {back ? <BackBone /> : null}
      <TitleBone withHint={hint} />
      <Rows count={4} icon="none" trailing="badge" />
    </Shell>
  );
}

export async function TodayLoading() {
  return <ListPageLoading back={false} hint />;
}

export async function VisitsLoading() {
  return <ListPageLoading />;
}

export async function TransmissionsLoading() {
  return (
    <Shell label={await label()}>
      <BackBone />
      <TitleBone withHint />
      <div className={card}>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index}>
            {index > 0 ? <div className="border-t border-line/70" /> : null}
            <div className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Bone className="h-4 w-36 rounded-full" />
                  <Bone className="mt-2 h-3.5 w-28 rounded-full" />
                </div>
                <Bone className="h-6 w-16 shrink-0 rounded-full" />
              </div>
              <Bone className="h-4 w-full rounded-full" />
              <Bone className="h-4 w-4/5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export async function VisitLoading() {
  return (
    <Shell label={await label()}>
      <BackBone />
      <div className="flex items-start justify-between gap-3">
        <div>
          <Bone className="h-8 w-36 rounded-2xl" />
          <Bone className="mt-2 h-4 w-48 rounded-full" />
        </div>
        <Bone className="h-6 w-16 shrink-0 rounded-full" />
      </div>
      <div className={`${card} flex flex-col gap-3 p-4`}>
        <Bone className="h-4 w-32 rounded-full" />
        <Bone className="h-3.5 w-48 rounded-full" />
        <Bone className="h-12 rounded-2xl" />
      </div>
      <div className="flex rounded-2xl bg-surface p-1">
        {Array.from({ length: 3 }, (_, index) => (
          <Bone key={index} className={`h-10 flex-1 rounded-xl ${index === 0 ? "bg-card" : "bg-transparent"}`} />
        ))}
      </div>
      <div className={`${card} p-4`}>
        <Bone className="h-4 w-full rounded-full" />
        <Bone className="mt-2 h-4 w-11/12 rounded-full" />
        <Bone className="mt-2 h-4 w-4/5 rounded-full" />
      </div>
    </Shell>
  );
}

export async function NewVisitLoading() {
  return (
    <Shell label={await label()}>
      <BackBone />
      <TitleBone withHint />
      <Rows count={7} icon="radio" trailing="none" />
      <div className={`${card} flex flex-col gap-4 p-4`}>
        <FieldBones count={1} />
        <FieldBones count={1} tall />
      </div>
      <Bone tone="accent" className="h-12 rounded-2xl" />
    </Shell>
  );
}

export async function PatientFormLoading() {
  return (
    <Shell label={await label()}>
      <BackBone />
      <TitleBone withHint />
      <div className={`${card} flex flex-col gap-4 p-4`}>
        <Bone className="h-3.5 w-24 rounded-full" />
        <FieldBones count={14} />
      </div>
      <div className={`${card} flex flex-col gap-4 p-4`}>
        <Bone className="h-3.5 w-28 rounded-full" />
        <FieldBones count={1} />
        <FieldBones count={9} tall />
      </div>
      <div className="flex gap-3">
        <Bone className="h-12 flex-1 rounded-2xl" />
        <Bone tone="accent" className="h-12 flex-[1.4] rounded-2xl" />
      </div>
    </Shell>
  );
}
