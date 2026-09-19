import { NextRequest, NextResponse } from "next/server";
import { requireTenant } from "@/lib/rbac";
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
  const due = dueAmount(billing.totalCharge, billing.discount, billing.amountPaid);

  const panelLines = order.orderPanels.map((row) => ({ name: row.panel.name, amount: asMoney(row.panel.price) }));
  const memberIds = await prisma.panelTest.findMany({
    where: { panelId: { in: order.orderPanels.map((row) => row.panelId) } },
    select: { testId: true },
  });
  const coveredTests = new Set(memberIds.map((row) => row.testId));
  const aLaCarte = order.orderTests
    .filter((row) => !coveredTests.has(row.testId))
    .map((row) => ({ name: row.test.name, amount: asMoney(row.test.price) }));

  const items = [...panelLines, ...aLaCarte];
  const patientName = `${order.patient.firstName} ${order.patient.lastName ?? ""}`.trim();
  const age = calcAge(order.patient.dob, order.patient.ageYears, order.patient.ageMonths);

  await logAudit({
    userId: user.userId,
    vendorId: user.vendorId,
    orderId: order.id,
    action: "THERMAL_RECEIPT_PRINTED",
    entityType: "Order",
    entityId: order.id,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt ${order.accessionNo}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      width: 72mm;
      margin: 0 auto;
      padding: 4mm 2mm;
      font-size: 11px;
      line-height: 1.25;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
    .double-divider { border-bottom: 2px double #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; }
    .item-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .item-table th, .item-table td { text-align: left; padding: 2px 0; font-size: 10px; }
    .item-table td.amt { text-align: right; }
    @media print {
      .no-print { display: none !important; }
    }
    .btn-print {
      display: block; width: 100%; padding: 8px; background: #0284c7; color: white;
      text-align: center; font-family: sans-serif; font-weight: bold;
      border: none; border-radius: 4px; cursor: pointer; margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <button onclick="window.print()" class="btn-print no-print">🖨️ Print POS Thermal Receipt</button>
  <div class="text-center font-bold" style="font-size: 13px;">${order.branch.name}</div>
  ${order.branch.address ? `<div class="text-center">${order.branch.address}</div>` : ""}
  <div class="divider"></div>
  <div class="text-center font-bold">CASH RECEIPT</div>
  <div class="divider"></div>
  <div class="row"><span>Acc #: ${order.accessionNo}</span></div>
  <div class="row"><span>Date: ${order.createdAt.toLocaleDateString("en-IN")}</span></div>
  <div class="row"><span>Patient: ${patientName}</span></div>
  <div class="row"><span>Age/Sex: ${age} / ${order.patient.gender}</span></div>
  ${order.patient.phone ? `<div class="row"><span>Mobile: ${order.patient.phone}</span></div>` : ""}
  ${order.referringDoctor ? `<div class="row"><span>Doctor: ${order.referringDoctor}</span></div>` : ""}
  <div class="divider"></div>
  <table class="item-table">
    <thead>
      <tr>
        <th>Test / Package</th>
        <th class="amt">Amt (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it) => `<tr><td>${it.name}</td><td class="amt">${it.amount.toFixed(2)}</td></tr>`).join("")}
    </tbody>
  </table>
  <div class="divider"></div>
  <div class="row"><span>Total Charge:</span><span class="font-bold">₹${billing.totalCharge.toFixed(2)}</span></div>
  ${billing.discount > 0 ? `<div class="row"><span>Discount:</span><span>- ₹${billing.discount.toFixed(2)}</span></div>` : ""}
  <div class="row"><span>Amount Paid:</span><span class="font-bold">₹${billing.amountPaid.toFixed(2)}</span></div>
  <div class="double-divider"></div>
  <div class="row font-bold" style="font-size: 12px;"><span>Balance Due:</span><span>₹${due.toFixed(2)}</span></div>
  <div class="divider"></div>
  <div class="text-center" style="margin-top: 8px;">Thank you! Get well soon.</div>
  <script>
    // Auto trigger print dialog when opened
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

