import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  hint,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {hint}
    </div>
  );
}
