import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SkeletonHint, SkeletonKpiCard } from "@/components/page-skeleton";
import { STATUS_LABELS } from "@/lib/workflow";

const KPI_LABELS = [
  STATUS_LABELS.SAMPLE_RECEIVED,
  STATUS_LABELS.RESULT_ENTRY,
  STATUS_LABELS.TECH_VERIFIED,
  STATUS_LABELS.AUTHORIZED,
  "Ready to send",
  "Open critical",
  "Released today",
];

export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Lab-wide status at a glance. Open the worklist for today's queue."
        actions={
          <>
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </>
        }
        hint={<SkeletonHint />}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {KPI_LABELS.map((label) => (
          <SkeletonKpiCard key={label} label={label} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent orders</CardTitle>
          <CardDescription>Newest accessions across the lab. Click a row to open results and workflow actions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex flex-col divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1.5 h-3 w-28" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
