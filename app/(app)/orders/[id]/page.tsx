import { getOrderDetail } from "@/app/actions/orders";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { ResultTable } from "./result-table.client";
import { OrderActions } from "./order-actions.client";
import { CriticalCallDialog } from "./critical-call-dialog";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";

const NEXT_STEP: Record<string, string> = {
  ORDER_CREATED: "Collect the sample, then mark it collected and received when it is on the bench.",
  SAMPLE_COLLECTED: "Receive the specimen in the lab to unlock result entry.",
  SAMPLE_RECEIVED: "Enter numeric or text results. Each value saves when you leave the field.",
  RESULT_ENTRY: "Review flags, log any critical call-back, then submit for technologist verification.",
  TECH_VERIFIED: "A pathologist reviews and authorizes the report.",
  AUTHORIZED: "Release the report so clinicians can view and print it.",
  RELEASED: "The report is available. Open it to print or download the PDF.",
  AMENDED: "This accession was amended. Open the linked new order for the current results.",
  CANCELLED: "This order is cancelled and cannot move forward.",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "";

  const rows = order.orderTests.map((ot) => {
    const r = order.results.find((res) => res.testId === ot.testId);
    return {
      testId: ot.testId,
      code: ot.test.code,
      name: ot.test.name,
      category: ot.test.category,
      unit: ot.test.unit,
      dataType: ot.test.dataType,
      isDerived: ot.test.isDerived,
      numericValue: r?.numericValue ?? null,
      textValue: r?.textValue ?? null,
      referenceRangeText: r?.referenceRangeText ?? null,
      flag: r?.flag ?? "NORMAL",
      deltaFlag: r?.deltaFlag ?? false,
      status: r?.status ?? null,
      profile: {
        id: ot.test.id,
        code: ot.test.code,
        name: ot.test.name,
        shortName: ot.test.shortName,
        category: ot.test.category,
        specimenType: ot.test.specimenType,
        method: ot.test.method,
        loincCode: ot.test.loincCode,
        unit: ot.test.unit,
        turnaroundHours: ot.test.turnaroundHours,
        description: ot.test.description,
        collectionNotes: ot.test.collectionNotes,
        dataType: ot.test.dataType,
        isDerived: ot.test.isDerived,
        autoVerifyEligible: ot.test.autoVerifyEligible,
        referenceRanges: ot.test.referenceRanges,
        criticalThresholds: ot.test.criticalThresholds,
        panels: ot.test.panelTests.map((pt) => ({ code: pt.panel.code, name: pt.panel.name })),
      },
    };
  });

  const hasOpenCritical = rows.some((r) => r.flag === "CRITICAL_LOW" || r.flag === "CRITICAL_HIGH");
  const criticalLogged = order.criticalCalls.length > 0;
  const editable = order.status === "RESULT_ENTRY" || order.status === "SAMPLE_RECEIVED";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <PageHeader
        title={`${order.patient.firstName} ${order.patient.lastName ?? ""}`}
        description={`${order.accessionNo} · ${order.patient.gender} · MRN ${order.patient.mrn}`}
        actions={
          <>
            <PriorityBadge priority={order.priority} />
            <StatusBadge status={order.status} />
            {order.status === "RELEASED" ? (
              <Link href={`/orders/${id}/report` as never}>
                <Button size="sm">
                  <FileText />
                  View report
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <WorkflowStepper status={order.status} />

      <InstructionAlert title="Next step">{NEXT_STEP[order.status]}</InstructionAlert>

      {hasOpenCritical && !criticalLogged ? <CriticalCallDialog orderId={id} accessionNo={order.accessionNo} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <OrderActions orderId={id} status={order.status} accessionNo={order.accessionNo} role={role} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {editable
              ? "Type a value and click outside the field to save. Open the book icon for that test's laboratory profile."
              : "Results are locked at this stage. Open the book icon for specimen, method, and ranges."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ResultTable orderId={id} rows={rows} editable={editable} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit</CardTitle>
          <CardDescription>Timestamps and authorization trail for this accession.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>Created: {order.createdAt.toLocaleString()}</p>
          {order.collectedAt ? <p>Collected: {order.collectedAt.toLocaleString()}</p> : null}
          {order.receivedAt ? <p>Received: {order.receivedAt.toLocaleString()}</p> : null}
          {order.authorizedBy ? <p>Authorized by: Dr. {order.authorizedBy.name}</p> : null}
          {order.reportedAt ? <p>Released: {order.reportedAt.toLocaleString()}</p> : null}
          {order.criticalCalls.length > 0 ? (
            <p>
              Critical call-back: {order.criticalCalls[0].notifiedName}
              {order.criticalCalls[0].notifiedRole ? ` (${order.criticalCalls[0].notifiedRole})` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
