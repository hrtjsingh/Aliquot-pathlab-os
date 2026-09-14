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

      {/* Patient Selection Card Skeleton */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-80" />
          </div>
          <Skeleton className="h-9 w-32 rounded-md" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
          <Skeleton className="h-16 w-full rounded-lg" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Catalog Toolbar Skeleton */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Skeleton className="h-9 flex-1 sm:min-w-[320px] rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-52 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>

          {/* Packages Card Skeleton */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <SkeletonChipRow widths={["w-36", "w-40", "w-28", "w-44"]} />
            </CardContent>
          </Card>

          {/* Test Category Skeletons */}
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <SkeletonChipRow widths={["w-24", "w-28", "w-36", "w-44", "w-24", "w-32"]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-14 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <SkeletonChipRow widths={["w-24", "w-32", "w-20", "w-28", "w-40", "w-24", "w-36"]} />
            </CardContent>
          </Card>
        </div>

        {/* Basket & Order Summary Card Skeleton */}
        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Order details</CardTitle>
            <CardDescription>Review the basket, discount, and paid amount before confirming.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <SkeletonField label="Priority" />
            <SkeletonField label="Referring doctor" />
            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <div className="mt-1 flex justify-between border-t border-border pt-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SkeletonField label="Discount" />
              <SkeletonField label="Paid" />
            </div>
            <Skeleton className="mt-1 h-9 w-full rounded-md" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
