import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SkeletonTable } from "@/components/page-skeleton";

export default function TestMasterLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Test master"
        description="Each test has a laboratory profile: specimen, method, reference ranges, and panic values."
        actions={<Skeleton className="h-9 w-28 rounded-md" />}
      />
      <Card>
        <CardContent className="p-0">
          <SkeletonTable
            rows={10}
            columns={[
              { header: "Code", width: "w-16" },
              { header: "Name", kind: "twoLine", width: "w-44", secondaryWidth: "w-28" },
              { header: "Specimen", width: "w-32" },
              { header: "Panels", width: "w-20" },
              { header: "Status", kind: "badge", width: "w-16" },
              { header: "Actions", kind: "buttons", buttonWidths: ["w-20", "w-20"], align: "right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
