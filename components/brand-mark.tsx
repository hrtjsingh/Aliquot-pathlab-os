import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="7" fill="#1C3F52" />
      <rect x="9" y="8" width="14" height="17" rx="2" fill="#F4F6F7" />
      <rect x="12" y="13" width="8" height="1.5" rx="0.75" fill="#1C3F52" opacity="0.32" />
      <rect x="12" y="16.5" width="5.5" height="1.5" rx="0.75" fill="#1C3F52" opacity="0.32" />
      <path
        d="M11 7.2c0 0-2.85 3.85-2.85 5.85a2.85 2.85 0 1 0 5.7 0C13.85 11.05 11 7.2 11 7.2Z"
        fill="#0F766E"
      />
    </svg>
  );
}

export function BrandLockup({
  invert = false,
  compact = false,
  surface = "sidebar",
}: {
  invert?: boolean;
  compact?: boolean;
  surface?: "sidebar" | "page";
}) {
  const onPage = surface === "page";
  return (
    <div className="flex items-center gap-2">
      <BrandMark
        className={cn(
          compact ? "size-8" : "size-9",
          invert && "rounded-[7px] ring-1 ring-brand-foreground/20"
        )}
      />
      <div className="leading-tight">
        <p
          className={cn(
            "text-sm font-semibold tracking-tight",
            invert ? "text-brand-foreground" : onPage ? "text-foreground" : "text-sidebar-foreground"
          )}
        >
          Aliquot
        </p>
        <p
          className={cn(
            "text-[11px]",
            invert ? "text-brand-foreground/65" : onPage ? "text-muted-foreground" : "text-sidebar-muted"
          )}
        >
          Lab reports
        </p>
      </div>
    </div>
  );
}
