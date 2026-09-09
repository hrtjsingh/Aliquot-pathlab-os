/**
 * Report delivery channels — email is realistic to wire generically (SMTP or
 * a provider API); SMS/WhatsApp require a paid provider account (Twilio,
 * Meta WhatsApp Business API, MSG91, etc.) — this file gives each a stable
 * interface and records every attempt to ReportDelivery regardless of which
 * provider you plug in, so delivery status/audit works the same for all
 * channels.
 */
import { prisma } from "@/lib/prisma";
import { DeliveryChannel } from "@prisma/client";

export interface DeliveryProvider {
  send(target: string, subject: string, pdfBuffer: Buffer, portalLink?: string): Promise<{ ok: boolean; error?: string }>;
}

export class EmailProvider implements DeliveryProvider {
  async send(_target: string, _subject: string, _pdfBuffer: Buffer, _portalLink?: string): Promise<{ ok: boolean; error?: string }> {
    // Wire an SMTP client (nodemailer) or transactional email API (SES/Postmark/Resend) here.
    // Kept unimplemented deliberately — needs real SMTP/API credentials via env vars.
    throw new Error("EmailProvider.send not configured — add SMTP/API credentials and a mail client.");
  }
}

export class SmsProvider implements DeliveryProvider {
  async send(_target: string, _subject: string, _pdfBuffer: Buffer, _portalLink?: string): Promise<{ ok: boolean; error?: string }> {
    throw new Error("SmsProvider.send not configured — requires an SMS gateway account (Twilio/MSG91/etc).");
  }
}

export class WhatsappProvider implements DeliveryProvider {
  async send(_target: string, _subject: string, _pdfBuffer: Buffer, _portalLink?: string): Promise<{ ok: boolean; error?: string }> {
    throw new Error("WhatsappProvider.send not configured — requires WhatsApp Business API / BSP account.");
  }
}

const PROVIDERS: Partial<Record<DeliveryChannel, DeliveryProvider>> = {
  EMAIL: new EmailProvider(),
  SMS: new SmsProvider(),
  WHATSAPP: new WhatsappProvider(),
};

export async function queueDelivery(orderId: string, channel: DeliveryChannel, target: string) {
  return prisma.reportDelivery.create({
    data: { orderId, channel, target, status: "QUEUED" },
  });
}

export async function attemptDelivery(deliveryId: string, pdfBuffer: Buffer, subject: string) {
  const delivery = await prisma.reportDelivery.findUniqueOrThrow({ where: { id: deliveryId } });
  const provider = PROVIDERS[delivery.channel];
  if (!provider) {
    await prisma.reportDelivery.update({ where: { id: deliveryId }, data: { status: "FAILED", errorMessage: "No provider configured for channel" } });
    return;
  }
  try {
    const result = await provider.send(delivery.target, subject, pdfBuffer);
    await prisma.reportDelivery.update({
      where: { id: deliveryId },
      data: result.ok ? { status: "SENT", sentAt: new Date() } : { status: "FAILED", errorMessage: result.error },
    });
  } catch (err) {
    await prisma.reportDelivery.update({ where: { id: deliveryId }, data: { status: "FAILED", errorMessage: String(err) } });
  }
}
