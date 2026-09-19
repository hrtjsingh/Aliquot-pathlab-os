"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant, requireWritableLab } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { canTransition, TRANSITION_ROLE } from "@/lib/workflow";
import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { newPublicReportToken } from "@/lib/public-report";
import { computeOrderCharge } from "@/lib/order-pricing";
import { expandDerivedInputs } from "@/lib/test-deps";
import { asMoney, dueAmount } from "@/lib/money";
import { writeOrderBilling, readOrderBilling } from "@/lib/order-billing-db";

async function nextAccessionNo(vendorId: string): Promise<string> {
  const today = new Date();
  const prefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const countToday = await prisma.order.count({
    where: {
      vendorId,
      createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
    },
  });
  return `${prefix}-${String(countToday + 1).padStart(4, "0")}`;
}

async function catalogForVendor(vendorId: string) {
  const [panels, tests] = await Promise.all([
    prisma.panel.findMany({
      where: { vendorId, active: true },
      include: { panelTests: { select: { testId: true } } },
    }),
    prisma.test.findMany({
      where: { vendorId, active: true },
      select: { id: true, code: true, name: true, price: true, derivationRule: true },
    }),
  ]);
  return {
    panels: panels.map((panel) => ({
      id: panel.id,
      price: asMoney(panel.price),
      testIds: panel.panelTests.map((member) => member.testId),
    })),
    tests: tests.map((test) => ({
      id: test.id,
      code: test.code,
      name: test.name,
      price: asMoney(test.price),
      derivationRule: test.derivationRule,
    })),
  };
}

async function resolveSelection(vendorId: string, testIds: string[], panelIds: string[]) {
  const catalog = await catalogForVendor(vendorId);
  if (panelIds.length) {
    const known = new Set(catalog.panels.map((panel) => panel.id));
    if (panelIds.some((id) => !known.has(id))) {
      return { ok: false as const, error: "One or more panels were not found in this lab." };
    }
  }
  const panelTests = catalog.panels.filter((panel) => panelIds.includes(panel.id)).flatMap((panel) => panel.testIds);
  const expanded = expandDerivedInputs([...testIds, ...panelTests], catalog.tests);
  const knownTests = new Set(catalog.tests.map((test) => test.id));
  if (expanded.some((id) => !knownTests.has(id))) {
    return { ok: false as const, error: "One or more tests were not found in this lab." };
  }
  const totalCharge = computeOrderCharge(catalog.panels, catalog.tests, panelIds, expanded);
  return { ok: true as const, allTestIds: expanded, totalCharge };
}

export async function createOrder(params: {
  patientId: string;
  referringDoctor?: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  testIds: string[];
  panelIds: string[];
  discount?: number;
  amountPaid?: number;
}) {
  const user = await requireWritableLab();
  if (!user.branchId) throw new Error("Your account is not assigned to a branch. Ask an admin to fix this before registering orders.");
  if (params.testIds.length === 0 && params.panelIds.length === 0) {
    return { ok: false as const, error: "Select at least one test or panel." };
  }

  const patient = await prisma.patient.findFirst({ where: { id: params.patientId, vendorId: user.vendorId } });
  if (!patient) return { ok: false as const, error: "Patient was not found in this lab." };

  const accessionNo = await nextAccessionNo(user.vendorId);
  const resolved = await resolveSelection(user.vendorId, params.testIds, params.panelIds);
  if (!resolved.ok) return resolved;

  const discount = asMoney(params.discount);
  const amountPaid = asMoney(params.amountPaid);
  if (discount < 0 || amountPaid < 0) return { ok: false as const, error: "Discount and paid amounts cannot be negative." };

  const order = await prisma.order.create({
    data: {
      vendorId: user.vendorId,
      accessionNo,
      patientId: params.patientId,
      branchId: user.branchId,
      referringDoctor: params.referringDoctor?.trim() || "SELF",
      priority: params.priority,
      status: OrderStatus.ORDER_CREATED,
      orderPanels: { create: params.panelIds.map((panelId) => ({ panelId })) },
      orderTests: { create: resolved.allTestIds.map((testId) => ({ testId })) },
    },
  });
  await writeOrderBilling(order.id, { totalCharge: resolved.totalCharge, discount, amountPaid });

  await logAudit({ vendorId: user.vendorId, userId: user.userId, orderId: order.id, action: "ORDER_CREATED", entityType: "Order", entityId: order.id, after: order });
  revalidatePath("/worklist");
  revalidatePath("/dashboard");
  return { ok: true as const, orderId: order.id, accessionNo };
}

export async function transitionOrderStatus(orderId: string, to: OrderStatus) {
  const user = await requireWritableLab();
  const allowedRoles = TRANSITION_ROLE[to];
  if (allowedRoles && !allowedRoles.includes(user.role) && user.role !== "ADMIN") {
    throw new Error(`Your role (${user.role}) cannot perform this transition.`);
  }

  const order = await prisma.order.findFirst({ where: { id: orderId, vendorId: user.vendorId } });
  if (!order) throw new Error("Order was not found in this lab.");
  if (!canTransition(order.status, to)) {
    throw new Error(`Cannot move order from ${order.status} to ${to}.`);
  }

  const timestampField: Record<string, string> = {
    SAMPLE_COLLECTED: "collectedAt",
    SAMPLE_RECEIVED: "receivedAt",
    RELEASED: "reportedAt",
  };
  const extra: Record<string, unknown> = {};
  if (timestampField[to]) extra[timestampField[to]] = new Date();
  if (to === OrderStatus.AUTHORIZED) extra.authorizedById = user.userId;
  if (to === OrderStatus.RELEASED && !order.publicToken) extra.publicToken = newPublicReportToken();

  const updated = await prisma.order.update({ where: { id: orderId }, data: { status: to, ...extra } });

  await logAudit({
    vendorId: user.vendorId,
    userId: user.userId,
    orderId,
    action: `ORDER_STATUS_${to}`,
    entityType: "Order",
    entityId: orderId,
    before: { status: order.status },
    after: { status: to },
  });

  revalidatePath("/worklist");
  revalidatePath(`/orders/${orderId}`);
  return updated;
}

const EDITABLE_ITEM_STATUSES: OrderStatus[] = [
  OrderStatus.ORDER_CREATED,
  OrderStatus.SAMPLE_COLLECTED,
  OrderStatus.SAMPLE_RECEIVED,
  OrderStatus.RESULT_ENTRY,
];

export async function updateOrderItems(params: {
  orderId: string;
  testIds: string[];
  panelIds: string[];
  referringDoctor?: string;
  discount?: number;
  amountPaid?: number;
}) {
  const user = await requireWritableLab();
  const order = await prisma.order.findFirst({
    where: { id: params.orderId, vendorId: user.vendorId },
    include: { results: { select: { testId: true, status: true } } },
  });
  if (!order) return { ok: false as const, error: "Order was not found in this lab." };
  if (!EDITABLE_ITEM_STATUSES.includes(order.status)) {
    return { ok: false as const, error: "Tests can only be changed before verification." };
  }
  if (order.results.some((result) => result.status === "TECH_VERIFIED" || result.status === "AUTHORIZED" || result.status === "RELEASED")) {
    return { ok: false as const, error: "Verified results are locked. Amend the report instead." };
  }

  const resolved = await resolveSelection(user.vendorId, params.testIds, params.panelIds);
  if (!resolved.ok) return resolved;

  const keep = new Set(resolved.allTestIds);
  const removedWithResults = order.results.filter((result) => !keep.has(result.testId));
  await prisma.$transaction([
    prisma.result.deleteMany({ where: { orderId: order.id, testId: { in: removedWithResults.map((result) => result.testId) } } }),
    prisma.orderTest.deleteMany({ where: { orderId: order.id } }),
    prisma.orderPanel.deleteMany({ where: { orderId: order.id } }),
    prisma.order.update({
      where: { id: order.id },
      data: {
        referringDoctor: params.referringDoctor?.trim() || order.referringDoctor,
        orderPanels: { create: params.panelIds.map((panelId) => ({ panelId })) },
        orderTests: { create: resolved.allTestIds.map((testId) => ({ testId })) },
      },
    }),
  ]);
  await writeOrderBilling(order.id, {
    totalCharge: resolved.totalCharge,
    discount: params.discount == null ? ((await readOrderBilling([order.id])).get(order.id)?.discount ?? 0) : asMoney(params.discount),
    amountPaid: params.amountPaid == null ? ((await readOrderBilling([order.id])).get(order.id)?.amountPaid ?? 0) : asMoney(params.amountPaid),
  });

  await logAudit({ vendorId: user.vendorId, userId: user.userId, orderId: order.id, action: "ORDER_ITEMS_UPDATED", entityType: "Order", entityId: order.id });
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function updateOrderPayment(params: { orderId: string; discount: number; amountPaid: number }) {
  const user = await requireWritableLab();
  if (!["ADMIN", "FRONTDESK"].includes(user.role)) {
    return { ok: false as const, error: "Only front desk or an admin can record payment." };
  }
  const order = await prisma.order.findFirst({ where: { id: params.orderId, vendorId: user.vendorId } });
  if (!order) return { ok: false as const, error: "Order was not found in this lab." };
  if (order.status === "CANCELLED" || order.status === "AMENDED") {
    return { ok: false as const, error: "This accession cannot take a payment." };
  }
  const discount = asMoney(params.discount);
  const amountPaid = asMoney(params.amountPaid);
  if (discount < 0 || amountPaid < 0) return { ok: false as const, error: "Discount and paid amounts cannot be negative." };

  const currentBilling = (await readOrderBilling([order.id])).get(order.id) ?? { totalCharge: 0, discount: 0, amountPaid: 0 };
  await writeOrderBilling(order.id, { totalCharge: currentBilling.totalCharge, discount, amountPaid });
  await logAudit({
    vendorId: user.vendorId,
    userId: user.userId,
    orderId: order.id,
    action: "ORDER_PAYMENT_UPDATED",
    entityType: "Order",
    entityId: order.id,
    after: { discount, amountPaid, due: dueAmount(currentBilling.totalCharge, discount, amountPaid) },
  });
  revalidatePath(`/orders/${order.id}`);
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function cancelOrder(orderId: string) {
  await requireWritableLab();
  return transitionOrderStatus(orderId, OrderStatus.CANCELLED);
}

/** Front-desk / accession shortcut: walk Created → Collected → Received in order. */
export async function markSampleCollectedAndReceived(orderId: string) {
  const user = await requireWritableLab();
  const order = await prisma.order.findFirst({ where: { id: orderId, vendorId: user.vendorId } });
  if (!order) throw new Error("Order was not found in this lab.");
  if (order.status === OrderStatus.ORDER_CREATED) {
    await transitionOrderStatus(orderId, OrderStatus.SAMPLE_COLLECTED);
  }
  const current = await prisma.order.findFirst({ where: { id: orderId, vendorId: user.vendorId } });
  if (!current || current.status !== OrderStatus.SAMPLE_COLLECTED) return;
  const receiveRoles = TRANSITION_ROLE.SAMPLE_RECEIVED ?? [];
  if (!receiveRoles.includes(user.role) && user.role !== "ADMIN") return;
  await transitionOrderStatus(orderId, OrderStatus.SAMPLE_RECEIVED);
}

export async function listOrdersByStatus(statuses: OrderStatus[]) {
  const user = await requireTenant();
  return prisma.order.findMany({
    where: { vendorId: user.vendorId, status: { in: statuses } },
    include: { patient: true, orderTests: { include: { test: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function getOrderDetail(orderId: string) {
  const user = await requireTenant();
  const order = await prisma.order.findFirst({
    where: { id: orderId, vendorId: user.vendorId },
    include: {
      patient: true,
      branch: true,
      orderTests: { include: { test: { include: { referenceRanges: true, criticalThresholds: true, panelTests: { include: { panel: true } } } } } },
      orderPanels: { include: { panel: { include: { panelTests: true } } } },
      results: { include: { test: true, enteredBy: true, verifiedBy: true } },
      authorizedBy: true,
      criticalCalls: true,
    },
  });
  if (!order) return null;
  const billing = (await readOrderBilling([order.id])).get(order.id) ?? { totalCharge: 0, discount: 0, amountPaid: 0 };
  return { ...order, ...billing };
}
