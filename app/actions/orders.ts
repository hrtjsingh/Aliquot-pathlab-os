"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant, requireWritableLab } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { canTransition, TRANSITION_ROLE } from "@/lib/workflow";
import { OrderStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { newPublicReportToken } from "@/lib/public-report";

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

export async function createOrder(params: {
  patientId: string;
  referringDoctor?: string;
  priority: "ROUTINE" | "URGENT" | "STAT";
  testIds: string[];
  panelIds: string[];
}) {
  const user = await requireWritableLab();
  if (!user.branchId) throw new Error("Your account is not assigned to a branch. Ask an admin to fix this before registering orders.");
  if (params.testIds.length === 0 && params.panelIds.length === 0) {
    return { ok: false as const, error: "Select at least one test or panel." };
  }

  const patient = await prisma.patient.findFirst({ where: { id: params.patientId, vendorId: user.vendorId } });
  if (!patient) return { ok: false as const, error: "Patient was not found in this lab." };

  const accessionNo = await nextAccessionNo(user.vendorId);

  // Expand panels into their constituent tests (deduplicated against directly-selected tests).
  if (params.panelIds.length) {
    const panels = await prisma.panel.findMany({
      where: { id: { in: params.panelIds }, vendorId: user.vendorId },
      select: { id: true },
    });
    if (panels.length !== params.panelIds.length) {
      return { ok: false as const, error: "One or more panels were not found in this lab." };
    }
  }

  const panelTests = params.panelIds.length
    ? await prisma.panelTest.findMany({ where: { panelId: { in: params.panelIds } }, select: { testId: true } })
    : [];
  const allTestIds = Array.from(new Set([...params.testIds, ...panelTests.map((p) => p.testId)]));
  const ownedTests = await prisma.test.findMany({
    where: { id: { in: allTestIds }, vendorId: user.vendorId },
    select: { id: true },
  });
  if (ownedTests.length !== allTestIds.length) {
    return { ok: false as const, error: "One or more tests were not found in this lab." };
  }

  const order = await prisma.order.create({
    data: {
      vendorId: user.vendorId,
      accessionNo,
      patientId: params.patientId,
      branchId: user.branchId,
      referringDoctor: params.referringDoctor || null,
      priority: params.priority,
      status: OrderStatus.ORDER_CREATED,
      orderPanels: { create: params.panelIds.map((panelId) => ({ panelId })) },
      orderTests: { create: allTestIds.map((testId) => ({ testId })) },
    },
  });

  await logAudit({ vendorId: user.vendorId, userId: user.userId, orderId: order.id, action: "ORDER_CREATED", entityType: "Order", entityId: order.id, after: order });
  revalidatePath("/worklist");
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
  return prisma.order.findFirst({
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
}
