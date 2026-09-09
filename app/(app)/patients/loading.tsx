import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { SkeletonTable } from "@/components/page-skeleton";

export default function PatientsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Patients"
        description="Master patient registry. Register a new patient, then create an accession from their row."
        actions={<Skeleton className="h-9 w-40 rounded-md" />}
        hint={
          <InstructionAlert title="How registration works">
            Enter MRN and demographics first. Age or date of birth is used later for reference ranges. After you save, Aliquot opens New Order with this patient already selected.
          </InstructionAlert>
        }
      />
      <Card>
        <CardContent className="p-0">
          <SkeletonTable
            rows={10}
            columns={[
              { header: "MRN", width: "w-24" },
              { header: "Name", width: "w-36" },
              { header: "Gender", width: "w-16" },
              { header: "Age", width: "w-10" },
              { header: "Actions", kind: "button", width: "w-28", align: "right" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
