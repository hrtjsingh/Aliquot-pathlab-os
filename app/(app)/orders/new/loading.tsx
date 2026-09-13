import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SkeletonChipRow, SkeletonField } from "@/components/page-skeleton";

export default function NewOrderLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="New order"
        description="Select a patient, add panels or tests, and set priority. An accession number is generated when you confirm."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">

          <Card>
            <CardHeader>
              <CardTitle>Panels</CardTitle>
              <CardDescription>Select a panel to include every test in that group.</CardDescription>
            </CardHeader>
            <CardContent>
              <SkeletonChipRow widths={["w-44", "w-36", "w-40", "w-28"]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>HEMATOLOGY</CardTitle>
            </CardHeader>
            <CardContent>
              <SkeletonChipRow widths={["w-24", "w-24", "w-36", "w-44", "w-24", "w-24", "w-28"]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CLINICAL CHEMISTRY</CardTitle>
            </CardHeader>
            <CardContent>
              <SkeletonChipRow
                widths={[
                  "w-24",
                  "w-24",
                  "w-20",
                  "w-28",
                  "w-24",
                  "w-40",
                  "w-20",
                  "w-16",
                  "w-20",
                  "w-36",
                  "w-32",
                  "w-32",
                  "w-32",
                  "w-28",
                ]}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Order details</CardTitle>
            <CardDescription>Review the patient, priority, and selected tests, then confirm.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm leading-none font-medium">Patient</span>
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <SkeletonField label="Referring doctor" />
            <SkeletonField label="Priority" />
            <p className="pt-1 text-xs text-muted-foreground">No tests selected yet.</p>
            <Skeleton className="mt-1 h-9 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
