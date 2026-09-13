import { getOrderDetail } from "@/app/actions/orders";
import { requireTenant } from "@/lib/rbac";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { HandoverActions } from "../handover-actions.client";
import { RemoveReportButton } from "../remove-report-button";
import { ensurePublicReportToken, publicReportPath } from "@/lib/public-report";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { isCustomerVisibleReport } from "@/lib/workflow";

function formatWhen(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default async function ReportPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireTenant();
  const order = await getOrderDetail(id);
  if (!order || !isCustomerVisibleReport(order.status)) notFound();
  const patientHref = publicReportPath(order.publicToken ?? (await ensurePublicReportToken(order.id)));
  const patientName = `${order.patient.firstName} ${order.patient.lastName ?? ""}`.trim();

  return (
    <div className="mx-auto flex h-full min-h-[calc(100dvh-4rem)] w-full min-w-0 max-w-7xl flex-col gap-4 p-6">
      <PageHeader
        title="Lab report preview"
        description={`${order.accessionNo} · ${patientName} · MRN ${order.patient.mrn}`}
        actions={
          <>
            <StatusBadge status={order.status} />
            <Link href={`/orders/${id}` as never}>
              <Button size="sm" variant="outline">
                <ArrowLeft />
                Back to order
              </Button>
            </Link>
            <HandoverActions
              orderId={id}
              accessionNo={order.accessionNo}
              phone={order.patient.phone}
              status={order.status}
              size="sm"
            />
            {user.role === "ADMIN" && order.status === "RELEASED" ? (
              <RemoveReportButton orderId={id} accessionNo={order.accessionNo} afterHref={`/orders/${id}`} />
            ) : null}
            <Button asChild size="sm" variant="outline">
              <a href={patientHref} target="_blank" rel="noreferrer">
                <ExternalLink />
                Open patient page
              </a>
            </Button>
            <Button asChild size="sm">
              <a href={`/api/orders/${id}/report.pdf`} target="_blank" rel="noreferrer">
                <Download />
                Download PDF
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Referring doctor</p>
          <p className="mt-0.5 font-medium">{order.referringDoctor || "—"}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Authorized by</p>
          <p className="mt-0.5 font-medium">{order.authorizedBy ? `Dr. ${order.authorizedBy.name}` : "—"}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reported</p>
          <p className="mt-0.5 font-medium tabular">{formatWhen(order.reportedAt)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Public patient page</p>
          <p className="mt-0.5 truncate font-mono text-xs">{patientHref}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-muted">
        <iframe src={`/api/orders/${id}/report.pdf`} className="h-full min-h-[70vh] w-full" title="Lab report preview" />
      </div>
    </div>
  );
}
