"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { DeliveryChannel, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWritableLab } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { canMarkCollected, canSendReportWhatsApp, canTransition, TRANSITION_ROLE } from "@/lib/workflow";
import { absolutePublicReportUrl, ensurePublicReportToken, reportOriginFromHeaderList } from "@/lib/public-report";
import { toWhatsAppDigits, whatsappClickToChatUrl } from "@/lib/phone";
import { transitionOrderStatus } from "@/app/actions/orders";

async function loadHandoverOrder(orderId: string) {
  const user = await requireWritableLab();
  const order = await prisma.order.findFirst({
    where: { id: orderId, vendorId: user.vendorId },
    include: { patient: true, branch: { select: { name: true } } },
  });
  if (!order) throw new Error("Order was not found in this lab.");
  return { user, order };
}

function assertHandoverRole(role: string, to: "SENT_TO_CUSTOMER" | "COLLECTED_BY_CUSTOMER") {
  const allowed = TRANSITION_ROLE[to] ?? [];
  if (!allowed.includes(role) && role !== "ADMIN") {
    throw new Error("Your role cannot send or collect this report.");
  }
}

export async function sendReportOnWhatsApp(orderId: string) {
  const { user, order } = await loadHandoverOrder(orderId);
  assertHandoverRole(user.role, "SENT_TO_CUSTOMER");
  if (!canSendReportWhatsApp(order.status)) {
    return { ok: false as const, error: "Release the report before sending it on WhatsApp." };
  }

  const digits = toWhatsAppDigits(order.patient.phone);
  if (!digits) {
    return {
      ok: false as const,
      error: "This patient has no registered mobile number. Add a phone on the patient record, or mark the report collected at the counter.",
    };
  }

  const headerList = await headers();
  const origin = reportOriginFromHeaderList((name) => headerList.get(name));
  const token = await ensurePublicReportToken(order.id);
  const reportUrl = absolutePublicReportUrl(origin, token);
  const text = `${order.branch.name}\nYour report ${order.accessionNo} is ready.\nView or download: ${reportUrl}`;

  const delivery = await prisma.reportDelivery.create({
    data: {
      orderId: order.id,
      channel: DeliveryChannel.WHATSAPP,
      target: digits,
      status: "SENT",
      sentAt: new Date(),
    },
  });

  await logAudit({
    vendorId: user.vendorId,
    userId: user.userId,
    orderId: order.id,
    action: "REPORT_WHATSAPP_SENT",
    entityType: "ReportDelivery",
    entityId: delivery.id,
    after: { target: digits, accessionNo: order.accessionNo },
  });

  if (canTransition(order.status, OrderStatus.SENT_TO_CUSTOMER)) {
    await transitionOrderStatus(order.id, OrderStatus.SENT_TO_CUSTOMER);
  }

  revalidatePath("/worklist");
  revalidatePath("/dashboard");
  revalidatePath(`/orders/${order.id}`);
  return { ok: true as const, whatsappUrl: whatsappClickToChatUrl(digits, text), phone: digits };
}

export async function markReportCollected(orderId: string) {
  const { user, order } = await loadHandoverOrder(orderId);
  assertHandoverRole(user.role, "COLLECTED_BY_CUSTOMER");
  if (!canMarkCollected(order.status)) {
    return { ok: false as const, error: "This report is already marked collected, or it is not released yet." };
  }

  const delivery = await prisma.reportDelivery.create({
    data: {
      orderId: order.id,
      channel: DeliveryChannel.PRINT,
      target: "collected-in-person",
      status: "SENT",
      sentAt: new Date(),
    },
  });

  await logAudit({
    vendorId: user.vendorId,
    userId: user.userId,
    orderId: order.id,
    action: "REPORT_COLLECTED",
    entityType: "ReportDelivery",
    entityId: delivery.id,
    after: { accessionNo: order.accessionNo },
  });

  await transitionOrderStatus(order.id, OrderStatus.COLLECTED_BY_CUSTOMER);
  revalidatePath("/worklist");
  revalidatePath("/dashboard");
  revalidatePath(`/orders/${order.id}`);
  return { ok: true as const };
}
