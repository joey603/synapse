"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import type { Locale } from "@/lib/i18n/locale";
import { t, type MessageKey } from "@/lib/i18n/messages";

type PatientNav = {
  id: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

type NavItem = {
  key: string;
  href?: string;
  back?: boolean;
  fallback?: string;
  label: MessageKey;
  icon: () => ReactNode;
  accent?: boolean;
  active?: boolean;
};

export function BottomNav({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const patientId = patientIdFromPath(pathname);
  const [patient, setPatient] = useState<PatientNav | null>(null);

  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      return;
    }
    let stop = false;
    void (async () => {
      try {
        const response = await fetch(`/api/patients/${patientId}/nav`);
        if (!response.ok || stop) return;
        const body = (await response.json()) as PatientNav;
        if (!stop) setPatient(body);
      } catch {
        if (!stop) setPatient(null);
      }
    })();
    return () => {
      stop = true;
    };
  }, [patientId]);

  if (patientId) {
    const callHref = telHref(patient?.phone ?? null);
    const routeHref = wazeHref(patient);
    return (
      <Shell>
        <BackButton label={t(locale, "navBack")} fallback="/patients" />
        <NavAction href={callHref} label={t(locale, "navCall")} icon={CallIcon} disabled={!callHref} external />
        <NavAction href={routeHref} label={t(locale, "navRoute")} icon={RouteIcon} disabled={!routeHref} external />
        <NavLink href={`/patients/${patientId}/visits/new`} label={t(locale, "navVisit")} icon={VisitIcon} accent />
      </Shell>
    );
  }

  const items = navItemsFor(pathname).map((item) => ({
    ...item,
    title: t(locale, item.label),
  }));

  return (
    <Shell>
      {items.map((item) =>
        item.back ? (
          <BackButton key={item.key} label={item.title} fallback={item.fallback ?? "/"} />
        ) : (
          <NavLink
            key={item.key}
            href={item.href ?? "/"}
            label={item.title}
            icon={item.icon}
            accent={item.accent}
            active={item.active}
          />
        ),
      )}
    </Shell>
  );
}

function navItemsFor(pathname: string): NavItem[] {
  if (pathname === "/") {
    return [
      { key: "home", href: "/", label: "home", icon: HomeIcon, active: true },
      { key: "patients", href: "/patients", label: "patients", icon: PeopleIcon },
    ];
  }

  if (pathname === "/patients") {
    return [
      { key: "home", href: "/", label: "home", icon: HomeIcon },
      { key: "patients", href: "/patients", label: "patients", icon: PeopleIcon, active: true },
    ];
  }

  if (pathname.startsWith("/patients/new")) {
    return [
      { key: "back", back: true, fallback: "/patients", label: "navBack", icon: BackIcon },
      { key: "search", href: "/search", label: "navSearch", icon: SearchIcon },
    ];
  }

  if (pathname.startsWith("/nearby")) {
    return [
      { key: "back", back: true, fallback: "/", label: "navBack", icon: BackIcon },
    ];
  }

  if (pathname.startsWith("/agenda")) {
    return [
      { key: "back", back: true, fallback: "/", label: "navBack", icon: BackIcon },
      { key: "today", href: "/today", label: "actionToday", icon: CalendarIcon },
      { key: "schedule", href: "/agenda#schedule", label: "navPlan", icon: PlusIcon, accent: true },
    ];
  }

  if (pathname.startsWith("/today")) {
    return [
      { key: "back", back: true, fallback: "/", label: "navBack", icon: BackIcon },
      { key: "agenda", href: "/agenda", label: "agendaTitle", icon: AgendaIcon },
      { key: "tasks", href: "/tasks", label: "tasksTitle", icon: TasksIcon },
    ];
  }

  if (pathname.startsWith("/tasks")) {
    return [
      { key: "back", back: true, fallback: "/", label: "navBack", icon: BackIcon },
      { key: "today", href: "/today", label: "actionToday", icon: CalendarIcon },
      { key: "validate", href: "/transmissions", label: "actionValidate", icon: CheckIcon },
    ];
  }

  if (pathname.startsWith("/transmissions")) {
    return [
      { key: "back", back: true, fallback: "/", label: "navBack", icon: BackIcon },
      { key: "today", href: "/today", label: "actionToday", icon: CalendarIcon },
      { key: "visits", href: "/visits", label: "rowRecent", icon: ClockIcon },
    ];
  }

  if (pathname.startsWith("/visits")) {
    return [
      { key: "back", back: true, fallback: "/", label: "navBack", icon: BackIcon },
      { key: "today", href: "/today", label: "actionToday", icon: CalendarIcon },
      { key: "validate", href: "/transmissions", label: "actionValidate", icon: CheckIcon },
    ];
  }

  if (pathname.startsWith("/search")) {
    return [
      { key: "back", back: true, fallback: "/patients", label: "navBack", icon: BackIcon },
      { key: "new", href: "/patients/new", label: "navNew", icon: PlusIcon, accent: true },
      { key: "nearby", href: "/nearby", label: "nearbyShort", icon: PinIcon },
    ];
  }

  return [
    { key: "back", back: true, fallback: "/", label: "navBack", icon: BackIcon },
    { key: "home", href: "/", label: "home", icon: HomeIcon },
  ];
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div
        dir="ltr"
        className="mx-auto flex max-w-lg overflow-hidden rounded-3xl border border-line/80 bg-card shadow-[0_8px_24px_rgba(27,36,48,0.08)]"
      >
        {children}
      </div>
    </nav>
  );
}

const NAV_ITEM =
  "flex min-h-[3.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium";

function BackButton({ label, fallback }: { label: string; fallback: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallback);
      }}
      className={`${NAV_ITEM} text-faint`}
    >
      <BackIcon />
      <span className="w-full truncate text-center leading-3">{label}</span>
    </button>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  accent = false,
  active = false,
}: {
  href: string;
  label: string;
  icon: () => ReactNode;
  accent?: boolean;
  active?: boolean;
}) {
  const tone = accent || active ? "text-accent" : "text-faint";
  return (
    <Link href={href} className={`${NAV_ITEM} ${tone}`}>
      <Icon />
      <span className="w-full truncate text-center leading-3">{label}</span>
    </Link>
  );
}

function NavAction({
  href,
  label,
  icon: Icon,
  disabled,
  external = false,
}: {
  href: string | null;
  label: string;
  icon: () => ReactNode;
  disabled: boolean;
  external?: boolean;
}) {
  if (disabled || !href) {
    return (
      <span className={`${NAV_ITEM} text-faint/40`}>
        <Icon />
        <span className="w-full truncate text-center leading-3">{label}</span>
      </span>
    );
  }

  return (
    <a
      href={href}
      rel={external ? "noreferrer" : undefined}
      className={`${NAV_ITEM} text-faint active:text-accent`}
    >
      <Icon />
      <span className="w-full truncate text-center leading-3">{label}</span>
    </a>
  );
}

function patientIdFromPath(pathname: string) {
  const match = pathname.match(/^\/patients\/([^/]+)/);
  if (!match) return null;
  if (match[1] === "new") return null;
  return match[1];
}

function telHref(phone: string | null) {
  if (!phone) return null;
  const first = phone.split("/")[0]?.trim() ?? "";
  const digits = first.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 8) return null;
  return `tel:${digits}`;
}

function wazeHref(patient: PatientNav | null) {
  if (!patient) return null;
  if (patient.latitude != null && patient.longitude != null) {
    return `https://waze.com/ul?ll=${patient.latitude},${patient.longitude}&navigate=yes`;
  }
  const place = [patient.address, patient.city].filter(Boolean).join(", ");
  if (!place) return null;
  return `https://waze.com/ul?q=${encodeURIComponent(place)}&navigate=yes`;
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M4.5 10.5 12 4.5l7.5 6V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.2H10.2V20.5H6A1.5 1.5 0 0 1 4.5 19v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.8 17.2c.5-2.2 2.2-3.4 4.2-3.4s3.7 1.2 4.2 3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="16.2" cy="8.4" r="1.9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M16 13.8c1.6.2 2.8 1.2 3.3 3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M15 6 9 12l6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CallIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M8.2 4.8c.5-.5 1.3-.6 1.9-.3l1.6.8c.6.3.9 1 .7 1.6l-.5 1.7c-.1.5 0 1 .4 1.3l1.9 1.5c.3.3.8.4 1.3.3l1.7-.4c.7-.2 1.4.1 1.7.7l.9 1.5c.4.6.3 1.4-.2 1.9l-1.1 1.1c-.5.5-1.2.7-1.9.6-2-.3-4.3-1.7-6.5-3.9S5.4 11.3 5.1 9.3c-.1-.7.1-1.4.6-1.9l1.1-1.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M12 21s6.5-6.1 6.5-11.2C18.5 6.2 15.6 3.5 12 3.5S5.5 6.2 5.5 9.8C5.5 14.9 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.8" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function VisitIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M8 5V3.8M16 5V3.8M4.8 9h14.4M6.2 5.8h11.6c.8 0 1.4.6 1.4 1.4v11c0 .8-.6 1.4-1.4 1.4H6.2c-.8 0-1.4-.6-1.4-1.4v-11c0-.8.6-1.4 1.4-1.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 12v4m-2-2h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="M12 7v10M7 12h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M12 21s5.5-5.4 5.5-10A5.5 5.5 0 0 0 12 5.5 5.5 5.5 0 0 0 6.5 11C6.5 15.6 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M8 5V3.8M16 5V3.8M4.8 9h14.4M6.2 5.8h11.6c.8 0 1.4.6 1.4 1.4v11c0 .8-.6 1.4-1.4 1.4H6.2c-.8 0-1.4-.6-1.4-1.4v-11c0-.8.6-1.4 1.4-1.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AgendaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M7 4.5h10c.8 0 1.5.7 1.5 1.5v12c0 .8-.7 1.5-1.5 1.5H7A1.5 1.5 0 0 1 5.5 18V6c0-.8.7-1.5 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M9.5 7.5 11 9l3.5-3.5M9.5 14.5 11 16l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 4.5h12c.8 0 1.5.7 1.5 1.5v12c0 .8-.7 1.5-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6c0-.8.7-1.5 1.5-1.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="m8.5 12 2.3 2.3L15.5 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v4.5L15 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
