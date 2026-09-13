import { getOrderDetail } from "@/app/actions/orders";
import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { ResultTable } from "./result-table.client";
import { OrderActions } from "./order-actions.client";
import { OrderItemsEditor } from "./order-items-editor.client";
import { OrderWorkspace } from "./order-workspace.client";
import { CriticalCallDialog } from "./critical-call-dialog";
import { ageInDays, formatRangeText, resolveReferenceRange } from "@/lib/reference-range";
import { asMoney } from "@/lib/money";
import { derivationRuleToFormula } from "@/lib/test-deps";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, QrCode } from "lucide-react";
import { RemoveReportButton } from "./remove-report-button";
import { ensurePublicReportToken, publicReportPath } from "@/lib/public-report";
import { isCustomerVisibleReport } from "@/lib/workflow";

const NEXT_STEP: Record<string, string> = {
  ORDER_CREATED: "Select packages and tests, collect payment, then mark the sample collected and received.",
  SAMPLE_COLLECTED: "Receive the specimen in the lab. After that, this page switches to result entry.",
  SAMPLE_RECEIVED: "Enter test results below. Each value saves automatically when you leave the field or press Enter.",
  RESULT_ENTRY: "Review flags, log any critical call-back, then submit for technologist verification.",
  TECH_VERIFIED: "A pathologist reviews and authorizes the report.",
  AUTHORIZED: "Release the report so it can be printed, sent on WhatsApp, or collected.",
  RELEASED: "The report stays on the worklist until it is sent or collected. Send it on WhatsApp to the patient’s registered number, or mark it collected at the counter. You can send on WhatsApp again after that.",
  SENT_TO_CUSTOMER: "This report was sent on WhatsApp. You can send it again. Mark it collected if the customer picked up a print.",
  COLLECTED_BY_CUSTOMER: "This report was collected at the counter. You can still send it on WhatsApp to the patient’s registered number.",
  AMENDED: "This accession was amended. Open the linked new order for the current results.",
  CANCELLED: "This order is cancelled and cannot move forward.",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderDetail(id);
  if (!order) notFound();

  const session = await auth();
  const role = (session?.user as { role?: string })?.role ?? "";
  const ageDays = ageInDays(order.patient.dob, order.patient.ageYears, order.patient.ageMonths);
  const rangeCtx = {
    gender: order.patient.gender,
    ageDays,
    isPregnant: order.patient.isPregnant,
    pregnancyTrimester: order.patient.pregnancyWeeks ? Math.ceil(order.patient.pregnancyWeeks / 13) : null,
  };

  const rows = order.orderTests.map((ot) => {
    const r = order.results.find((res) => res.testId === ot.testId);
    const catalogRange = formatRangeText(resolveReferenceRange(ot.test.referenceRanges, rangeCtx));
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
      referenceRangeText: r?.referenceRangeText || catalogRange,
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
        price: asMoney(ot.test.price),
        formula: derivationRuleToFormula(ot.test.derivationRule, order.orderTests.map((row) => ({ name: row.test.name, code: row.test.code }))),
        referenceRanges: ot.test.referenceRanges.map((range) => ({
          id: range.id,
          gender: range.gender,
          ageMinDays: range.ageMinDays,
          ageMaxDays: range.ageMaxDays,
          low: range.low,
          high: range.high,
          isDefault: range.isDefault,
        })),
        criticalThresholds: ot.test.criticalThresholds.map((row) => ({
          id: row.id,
          low: row.low,
          high: row.high,
          gender: row.gender,
        })),
        panels: ot.test.panelTests.map((pt) => ({ code: pt.panel.code, name: pt.panel.name })),
      },
    };
  });

  const hasOpenCritical = rows.some((r) => r.flag === "CRITICAL_LOW" || r.flag === "CRITICAL_HIGH");
  const criticalLogged = order.criticalCalls.length > 0;
  const editable = order.status === "RESULT_ENTRY" || order.status === "SAMPLE_RECEIVED";
  const allowTests = ["ORDER_CREATED", "SAMPLE_COLLECTED"].includes(order.status);
  const allowResults = !["ORDER_CREATED", "SAMPLE_COLLECTED"].includes(order.status);
  const initialStage = allowResults ? "results" : "tests";
  const totalCharge = asMoney(order.totalCharge);
  const discount = asMoney(order.discount);
  const amountPaid = asMoney(order.amountPaid);
  const patientReportHref = isCustomerVisibleReport(order.status)
    ? publicReportPath(order.publicToken ?? (await ensurePublicReportToken(order.id)))
    : null;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title={`${order.patient.firstName} ${order.patient.lastName ?? ""}`}
        description={`${order.accessionNo} · ${order.patient.gender} · MRN ${order.patient.mrn}`}
        actions={
          <>
            <PriorityBadge priority={order.priority} />
            <StatusBadge status={order.status} />
            {isCustomerVisibleReport(order.status) ? (
              <Link href={`/orders/${id}/report` as never}>
                <Button size="sm">
                  <FileText />
                  Lab preview
                </Button>
              </Link>
            ) : null}
            {patientReportHref ? (
              <Button asChild size="sm" variant="outline">
                <a href={patientReportHref} target="_blank" rel="noreferrer">
                  <QrCode />
                  Open patient page
                </a>
              </Button>
            ) : null}
            {order.status === "RELEASED" && role === "ADMIN" ? (
              <RemoveReportButton orderId={id} accessionNo={order.accessionNo} />
            ) : null}
          </>
        }
      />

      <WorkflowStepper status={order.status} />

      {hasOpenCritical && !criticalLogged ? <CriticalCallDialog orderId={id} accessionNo={order.accessionNo} /> : null}

      <div className="flex flex-wrap items-center gap-3">
        <OrderActions
          orderId={id}
          status={order.status}
          accessionNo={order.accessionNo}
          role={role}
          phone={order.patient.phone}
        />
      </div>

      <OrderWorkspace
        initialStage={initialStage}
        allowTests={allowTests}
        allowResults={allowResults}
        tests={
          <OrderItemsEditor
            orderId={id}
            patientId={order.patientId}
            referringDoctor={order.referringDoctor ?? "Dr. SELF"}
            discount={discount}
            amountPaid={amountPaid}
            testIds={order.orderTests.map((row) => row.testId)}
            panelIds={order.orderPanels.map((row) => row.panelId)}
          />
        }
        results={
          <>
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  {editable
                    ? "Type a value and press Enter to move to the next test. Values also save when you leave the field. Open the book icon for that test's laboratory profile."
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
          </>
        }
      />
    </div>
  );
}
