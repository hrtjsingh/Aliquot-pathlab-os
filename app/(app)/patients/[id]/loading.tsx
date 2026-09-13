import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPageHeader, SkeletonTable } from "@/components/page-skeleton";

export default function PatientHistoryLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <SkeletonPageHeader titleWidth="w-48" descriptionWidth="w-64" />

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent className="p-0">
          <SkeletonTable
            columns={[
              { header: "Accession", width: "w-28" },
              { header: "Date", width: "w-40" },
              { header: "Status", kind: "badge", width: "w-20" },
              { header: "Priority", kind: "badge", width: "w-20" },
              { header: "Total", width: "w-20", align: "right" },
              { header: "Due", width: "w-20", align: "right" },
              { header: "Actions", kind: "buttons", width: "w-32", align: "right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
