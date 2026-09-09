import { getOrderDetail } from "@/app/actions/orders";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

export default async function ReportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  return (
    <div className="flex h-full min-h-[70vh] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {order.patient.firstName} {order.patient.lastName}
          </p>
          <p className="tabular text-xs text-muted-foreground">{order.accessionNo} · Released report preview</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/orders/${id}` as never}>
            <Button size="sm" variant="outline">
              <ArrowLeft />
              Back to order
            </Button>
          </Link>
          <a href={`/api/orders/${id}/report.pdf`} target="_blank" rel="noreferrer">
            <Button size="sm">
              <Download />
              Download PDF
            </Button>
          </a>
        </div>
      </div>
      <iframe src={`/api/orders/${id}/report.pdf`} className="w-full flex-1 bg-muted" title="Report preview" />
    </div>
  );
}
