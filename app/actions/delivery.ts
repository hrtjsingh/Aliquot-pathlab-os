"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { DeliveryChannel, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireWritableLab } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { canTransition, TRANSITION_ROLE } from "@/lib/workflow";
import { absolutePublicReportUrl, ensurePublicReportToken, reportOriginFromHeaderList } from "@/lib/public-report";
import { toWhatsAppDigits, whatsappClickToChatUrl } from "@/lib/phone";
import { transitionOrderStatus } from "@/app/actions/orders";

async function requireHandover(orderId: string) {
  const user = await requireWritableLab();
  const allowed = TRANSITION_ROLE.SENT_TO_CUSTOMER ?? [];
  if (!allowed.includes(user.role) && user.role !== "ADMIN") {
    throw new Error("Your role cannot send or collect this report.");
  }
  const order = await prisma.order.findFirst({
    where: { id: orderId, vendorId: user.vendorId },
    include: { patient: true, branch: { select: { name: true } } },
  });
  if (!order) throw new Error("Order was not found in this lab.");
  if (order.status !== OrderStatus.RELEASED) {
    return { ok: false as const, error: "Only a released report can be sent or collected." };
  }
  if (!canTransition(order.status, OrderStatus.SENT_TO_CUSTOMER)) {
    return { ok: false as const, error: "This accession cannot move to sent / collected." };
  }
  return { ok: true as const, user, order };
}

async function finishHandover(orderId: string) {
  await transitionOrderStatus(orderId, OrderStatus.SENT_TO_CUSTOMER);
  revalidatePath("/worklist");
  revalidatePath("/dashboard");
  revalidatePath(`/orders/${orderId}`);
}

export async function sendReportOnWhatsApp(orderId: string) {
  const ready = await requireHandover(orderId);
  if (!ready.ok) return ready;
  const { user, order } = ready;

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

  await finishHandover(order.id);
  return { ok: true as const, whatsappUrl: whatsappClickToChatUrl(digits, text), phone: digits };
}

export async function markReportCollected(orderId: string) {
  const ready = await requireHandover(orderId);
  if (!ready.ok) return ready;
  const { user, order } = ready;

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

  await finishHandover(order.id);
  return { ok: true as const };
}
