import { prisma } from "@/lib/prisma";
import { asMoney, dueAmount } from "@/lib/money";
import { readOrderBilling } from "@/lib/order-billing-db";
import { calcAge } from "@/lib/report-data";
import { getReportLayoutForBranch } from "@/app/actions/lab";
import type { ReportLayout } from "@/lib/report-layout";

export type ReceiptData = {
  labName: string;
  address: string | null;
  phone: string;
  accessionNo: string;
  date: string;
  patientName: string;
  age: string;
  gender: string;
  phoneNumber: string | null;
  doctor: string | null;
  lines: Array<{ name: string; amount: number }>;
  totalCharge: number;
  discount: number;
  amountPaid: number;
  due: number;
};

export type CashReceiptPayload = {
  data: ReceiptData;
  layout: ReportLayout;
};

export async function fetchCashReceipt(orderId: string, vendorId: string): Promise<CashReceiptPayload | null> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, vendorId },
    include: {
      patient: true,
      branch: true,
      orderPanels: { include: { panel: true } },
      orderTests: { include: { test: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  if (!order) return null;

  const billing = (await readOrderBilling([order.id])).get(order.id) ?? {
    totalCharge: asMoney(order.totalCharge),
    discount: asMoney(order.discount),
    amountPaid: asMoney(order.amountPaid),
  };
  const layout = await getReportLayoutForBranch(order.branchId, vendorId);
  const panelLines = order.orderPanels.map((row) => ({ name: row.panel.name, amount: asMoney(row.panel.price) }));

  const memberIds = await prisma.panelTest.findMany({
    where: { panelId: { in: order.orderPanels.map((row) => row.panelId) } },
    select: { testId: true },
  });
  const coveredTests = new Set(memberIds.map((row) => row.testId));
  const aLaCarte = order.orderTests
    .filter((row) => !coveredTests.has(row.testId))
    .map((row) => ({ name: row.test.name, amount: asMoney(row.test.price) }));

  return {
    layout,
    data: {
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
    },
  };
}
