import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/rbac";
import { renderToBuffer } from "@react-pdf/renderer";
import { CashReceiptDocument } from "@/lib/receipt-pdf";
import { getReportLayoutForBranch } from "@/app/actions/lab";
import { prisma } from "@/lib/prisma";
import { asMoney, dueAmount } from "@/lib/money";
import { readOrderBilling } from "@/lib/order-billing-db";
import { calcAge } from "@/lib/report-data";
import { logAudit } from "@/lib/audit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireTenant();
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, vendorId: user.vendorId },
    include: {
      patient: true,
      branch: true,
      orderPanels: { include: { panel: true } },
      orderTests: { include: { test: true } },
    },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const billing = (await readOrderBilling([order.id])).get(order.id) ?? {
    totalCharge: asMoney(order.totalCharge),
    discount: asMoney(order.discount),
    amountPaid: asMoney(order.amountPaid),
  };
  const layout = await getReportLayoutForBranch(order.branchId, user.vendorId);
  const panelLines = order.orderPanels.map((row) => ({ name: row.panel.name, amount: asMoney(row.panel.price) }));

  const memberIds = await prisma.panelTest.findMany({
    where: { panelId: { in: order.orderPanels.map((row) => row.panelId) } },
    select: { testId: true },
  });
  const coveredTests = new Set(memberIds.map((row) => row.testId));
  const aLaCarte = order.orderTests
    .filter((row) => !coveredTests.has(row.testId))
    .map((row) => ({ name: row.test.name, amount: asMoney(row.test.price) }));

  const buffer = await renderToBuffer(
    <CashReceiptDocument
      layout={layout}
      data={{
        labName: order.branch.name,
        address: order.branch.address,
        phone: layout.phone,
        accessionNo: order.accessionNo,
        date: order.createdAt.toLocaleDateString("en-IN"),
        patientName: `${order.patient.firstName} ${order.patient.lastName ?? ""}`.trim(),
        age: calcAge(order.patient.dob, order.patient.ageYears, order.patient.ageMonths),
        gender: order.patient.gender,
        phoneNumber: order.patient.phone,
        doctor: order.referringDoctor,
        lines: [...panelLines, ...aLaCarte],
        totalCharge: billing.totalCharge,
        discount: billing.discount,
        amountPaid: billing.amountPaid,
        due: dueAmount(billing.totalCharge, billing.discount, billing.amountPaid),
      }}
    />
  );

  await logAudit({
    userId: user.userId,
    vendorId: user.vendorId,
    orderId: order.id,
    action: "RECEIPT_PRINTED",
    entityType: "Order",
    entityId: order.id,
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${order.accessionNo}.pdf"`,
    },
  });
}
