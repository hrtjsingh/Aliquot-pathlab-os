import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { SkeletonTable } from "@/components/page-skeleton";

export default function PackagesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Packages"
        description="Create billed panels. The package charge is used on new orders, not the sum of member tests."
        actions={<Skeleton className="h-9 w-32 rounded-md" />}
        hint={
          <InstructionAlert title="Package rates">
            Add the tests that print on the report, then set the package price.
          </InstructionAlert>
        }
      />
      <Card>
        <CardContent className="p-0">
          <SkeletonTable
            rows={8}
            columns={[
              { header: "Code", width: "w-16" },
              { header: "Name", kind: "twoLine", width: "w-44", secondaryWidth: "w-28" },
              { header: "Charge", width: "w-16" },
              { header: "Tests", width: "w-40" },
              { header: "Status", kind: "badge", width: "w-16" },
              { header: "Actions", kind: "buttons", buttonWidths: ["w-16", "w-16"], align: "right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
