import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SkeletonField } from "@/components/page-skeleton";

const PDF_TOGGLES = [
  { label: "Address", hint: "Print the laboratory address under the name." },
  { label: "Accreditation", hint: "Show NABL and ISO numbers in the header." },
  { label: "Phone, email, website", hint: "Print contact details in the header." },
  { label: "Collection timestamps", hint: "Collected, received, and reported times." },
  { label: "Patient MRN", hint: "Include the medical record number." },
  { label: "Referring doctor", hint: "Print the referring clinician." },
  { label: "Reference range column", hint: "Show the range next to each result." },
  { label: "Result flags", hint: "Mark high, low, and critical values." },
  { label: "Pathologist signature", hint: "Print the authorizing pathologist." },
  { label: "Footer disclaimer", hint: "Print the legal note on every page." },
  { label: "QR code", hint: "Print a scan-to-view QR with the accession ID." },
];

export default function LabConfigLoading() {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Lab configuration"
        description="Set letterhead, accreditation, and the printed PDF layout used when a report is released."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Laboratory letterhead</CardTitle>
              <CardDescription>Branch code, name, and address appear at the top of every report PDF.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SkeletonField label="Laboratory name" className="sm:col-span-2" />
              <SkeletonField label="Address" className="sm:col-span-2" controlClassName="h-16" />
              <SkeletonField label="NABL number" />
              <SkeletonField label="ISO number" />
              <SkeletonField label="Phone" />
              <SkeletonField label="Email" />
              <SkeletonField label="Website" className="sm:col-span-2" />
              <SkeletonField label="Logo URL" className="sm:col-span-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PDF layout</CardTitle>
              <CardDescription>Choose header style, ink color, and which result columns print.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SkeletonField label="Report title" />
                <SkeletonField label="Header style" />
                <SkeletonField label="Header color" />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PDF_TOGGLES.map((item) => (
                  <div key={item.label} className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                    <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                  </div>
                ))}
              </div>
              <SkeletonField label="Footer disclaimer" controlClassName="h-24" />
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-9 w-44 rounded-md" />
            <Skeleton className="h-9 w-48 rounded-md" />
          </div>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>Updates as you edit. Save to apply this layout to released reports.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
                <div className="flex justify-between gap-3 border-b-2 border-muted px-4 py-3">
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-2.5 w-48" />
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Skeleton className="h-2.5 w-28" />
                    <Skeleton className="h-2.5 w-32" />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
                <div className="flex justify-between gap-2 border-b border-muted px-4 py-2">
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-2 w-12" />
                    <Skeleton className="h-3.5 w-24" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-2 w-16" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Skeleton className="h-2 w-8" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                </div>
                <div className="px-4 py-3">
                  <Skeleton className="mb-2 h-6 w-full" />
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-4 gap-2">
                      <Skeleton className="h-2.5 w-16" />
                      <Skeleton className="h-2.5 w-10" />
                      <Skeleton className="h-2.5 w-8" />
                      <Skeleton className="h-2.5 w-12" />
                    </div>
                    <Skeleton className="h-px w-full" />
                    <div className="grid grid-cols-4 gap-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-8" />
                      <Skeleton className="h-3 w-10" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-8" />
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
