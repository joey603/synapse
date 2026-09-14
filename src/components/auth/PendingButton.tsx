"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const PendingContext = createContext(false);

export function PendingForm({
  action,
  className,
  children,
}: {
  action: string;
  className?: string;
  children: ReactNode;
}) {
  const [pending, setPending] = useState(false);

  return (
    <PendingContext.Provider value={pending}>
      <form action={action} method="post" className={className} onSubmit={() => setPending(true)}>
        {children}
      </form>
    </PendingContext.Provider>
  );
}

export function PendingButton({
  idle,
  pending,
  className,
}: {
  idle: string;
  pending: string;
  className?: string;
}) {
  const isPending = useContext(PendingContext);

  return (
    <button type="submit" disabled={isPending} className={className}>
      {isPending ? pending : idle}
    </button>
  );
}
