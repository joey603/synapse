export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("");

  const sizes = {
    sm: "h-10 w-10 text-sm",
    md: "h-12 w-12 text-base",
    lg: "h-16 w-16 text-lg",
  };

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent ${sizes[size]}`}
      aria-hidden="true"
    >
      {initials || "?"}
    </div>
  );
}
