import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPageHeader, SkeletonTable } from "@/components/page-skeleton";

const STEPS = ["Created", "Collected", "Received", "Results", "Verified", "Authorized", "Released", "Sent"];

export default function OrderDetailLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <SkeletonPageHeader
        titleWidth="w-48"
        descriptionWidth="w-72"
        hint={false}
        actions={
          <>
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-28 rounded-full" />
          </>
        }
      />

      <ol className="flex flex-wrap items-center gap-1.5 text-xs">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-border">/</span> : null}
            <span className="rounded-md px-2 py-1 text-muted-foreground/70">{label}</span>
          </li>
        ))}
      </ol>

      <Skeleton className="h-9 w-40 rounded-md" />

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>Type a value and click outside the field to save. Open the book icon for that test&apos;s laboratory profile.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <SkeletonTable
            rows={8}
            columns={[
              { header: "Parameter", kind: "nameWithIcon", width: "w-36" },
              { header: "Result", kind: "input", width: "w-32" },
              { header: "Unit", width: "w-12" },
              { header: "Reference range", width: "w-24" },
              { header: "Flag", kind: "badge", width: "w-16" },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit</CardTitle>
          <CardDescription>Timestamps and authorization trail for this accession.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
        </CardContent>
      </Card>
    </div>
  );
}
