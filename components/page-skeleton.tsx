import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function SkeletonPageHeader({
  titleWidth = "w-36",
  descriptionWidth = "w-96",
  actions,
  hint = true,
}: {
  titleWidth?: string;
  descriptionWidth?: string;
  actions?: ReactNode;
  hint?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Skeleton className={cn("h-7", titleWidth)} />
          <Skeleton className={cn("mt-2 h-4 max-w-2xl", descriptionWidth)} />
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {hint ? <SkeletonHint /> : null}
    </div>
  );
}

export function SkeletonHint() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <Skeleton className="size-4 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-3 w-full max-w-xl" />
      </div>
    </div>
  );
}

export function SkeletonKpiCard({ label }: { label: string }) {
  return (
    <Card className="h-full border-t-2 border-t-muted">
      <CardHeader className="pb-1 pt-3 px-3.5">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 px-3.5 pb-3">
        <Skeleton className="h-8 w-12" />
      </CardContent>
    </Card>
  );
}

export type SkeletonColumn = {
  header: string;
  kind?: "text" | "badge" | "button" | "buttons" | "twoLine" | "input" | "nameWithIcon";
  width?: string;
  secondaryWidth?: string;
  buttonWidths?: string[];
  align?: "left" | "right";
};

function SkeletonCell({ column }: { column: SkeletonColumn }) {
  const kind = column.kind ?? "text";
  const width = column.width ?? "w-24";

  if (kind === "badge") {
    return <Skeleton className={cn("h-5 rounded-full", width)} />;
  }
  if (kind === "button") {
    return <Skeleton className={cn("h-8 rounded-md", width)} />;
  }
  if (kind === "buttons") {
    const widths = column.buttonWidths ?? ["w-24", "w-14"];
    return (
      <div className="flex justify-end gap-2">
        {widths.map((w, i) => (
          <Skeleton key={i} className={cn("h-8 rounded-md", w)} />
        ))}
      </div>
    );
  }
  if (kind === "twoLine") {
    return (
      <div className="flex flex-col gap-1">
        <Skeleton className={cn("h-4", width)} />
        <Skeleton className={cn("h-3", column.secondaryWidth ?? "w-24")} />
      </div>
    );
  }
  if (kind === "input") {
    return <Skeleton className={cn("h-8 rounded-md", width)} />;
  }
  if (kind === "nameWithIcon") {
    return (
      <div className="flex items-center gap-1">
        <Skeleton className={cn("h-4", width)} />
        <Skeleton className="size-7 shrink-0 rounded-md" />
      </div>
    );
  }
  return <Skeleton className={cn("h-4", width)} />;
}

export function SkeletonTable({ columns, rows = 8 }: { columns: SkeletonColumn[]; rows?: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.header} className={column.align === "right" ? "text-right" : undefined}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, row) => (
          <TableRow key={row}>
            {columns.map((column) => (
              <TableCell key={column.header} className={column.align === "right" ? "text-right" : undefined}>
                <SkeletonCell column={column} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function SkeletonChipRow({ widths, count = 6 }: { widths?: string[]; count?: number }) {
  const fallback = ["w-24", "w-20", "w-28", "w-16", "w-32", "w-[5.5rem]", "w-[4.5rem]", "w-26"];
  const list = widths ?? fallback.slice(0, count);
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((width, i) => (
        <Skeleton key={`${width}-${i}`} className={cn("h-8 rounded-md", width)} />
      ))}
    </div>
  );
}

export function SkeletonField({
  label,
  className,
  controlClassName,
}: {
  label: string;
  className?: string;
  controlClassName?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm leading-none font-medium">{label}</span>
      <Skeleton className={cn("h-9 w-full rounded-md", controlClassName)} />
    </div>
  );
}
