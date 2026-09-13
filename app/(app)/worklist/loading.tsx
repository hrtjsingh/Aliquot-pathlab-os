import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { SkeletonTable } from "@/components/page-skeleton";

export default function WorklistLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Worklist"
        description="All active orders, STAT first. Open an accession to enter results, verify, or release."
      />
      <Card>
        <CardContent className="p-0">
          <SkeletonTable
            rows={10}
            columns={[
              { header: "Accession", width: "w-28" },
              { header: "Patient", width: "w-36" },
              { header: "Tests", width: "w-16" },
              { header: "Priority", kind: "badge", width: "w-16" },
              { header: "Status", kind: "badge", width: "w-28" },
              { header: "Actions", kind: "buttons", buttonWidths: ["w-28", "w-14"], align: "right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
