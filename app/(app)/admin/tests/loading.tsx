import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SkeletonTable } from "@/components/page-skeleton";

export default function TestMasterLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Test master"
        description="Search the catalog, set charges and formulas, and remove unused tests."
        actions={<Skeleton className="h-9 w-28 rounded-md" />}
      />

      {/* Catalog Search & Filters Toolbar Skeleton */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Skeleton className="h-9 w-full lg:w-1/2 lg:max-w-md rounded-md" />
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <Skeleton className="h-9 w-52 rounded-md" />
          <Skeleton className="h-9 w-40 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <SkeletonTable
            rows={10}
            columns={[
              { header: "Code", width: "w-16" },
              { header: "Name", kind: "twoLine", width: "w-44", secondaryWidth: "w-28" },
              { header: "Charge", width: "w-20" },
              { header: "Specimen", width: "w-28" },
              { header: "Status", kind: "badge", width: "w-16" },
              { header: "Actions", kind: "buttons", buttonWidths: ["w-20", "w-20"], align: "right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
