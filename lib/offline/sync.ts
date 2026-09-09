"use client";

import { createPatient } from "@/app/actions/patients";
import { createOrder, markSampleCollectedAndReceived, transitionOrderStatus } from "@/app/actions/orders";
import {
  pathologistAuthorize,
  recordCriticalValueCall,
  releaseReport,
  saveManualResult,
  technologistVerify,
} from "@/app/actions/results";
import { markReportCollected, sendReportOnWhatsApp } from "@/app/actions/delivery";
import { listOutbox, rememberId, removeOutbox, resolveId, type OutboxItem } from "@/lib/offline/outbox";
import type { OrderStatus } from "@prisma/client";

let flushing = false;

export async function flushOutbox() {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return { flushed: 0, remaining: 0 };
  flushing = true;
  try {
    const items = await listOutbox();
    let flushed = 0;
    for (const item of items) {
      try {
        await replay(item);
        await removeOutbox(item.id);
        flushed += 1;
      } catch {
        break;
      }
    }
    return { flushed, remaining: items.length - flushed };
  } finally {
    flushing = false;
  }
}

async function replay(item: OutboxItem) {
  const { op } = item;
  switch (op.type) {
    case "createPatient": {
      const formData = new FormData();
      for (const [key, value] of op.entries) formData.append(key, value);
      const result = await createPatient(formData);
      if (!result.ok) throw new Error(result.error);
      await rememberId(op.localId, result.patientId);
      return;
    }
    case "createOrder": {
      const patientId = await resolveId(op.params.patientId);
      if (patientId.startsWith("offline-")) throw new Error("Patient is still queued.");
      const result = await createOrder({ ...op.params, patientId });
      if (!result.ok) throw new Error(result.error);
      return;
    }
    case "saveManualResult": {
      const orderId = await resolveId(op.params.orderId);
      await saveManualResult({ ...op.params, orderId });
      return;
    }
    case "transitionOrderStatus": {
      const orderId = await resolveId(op.orderId);
      await transitionOrderStatus(orderId, op.to as OrderStatus);
      return;
    }
    case "markSampleCollectedAndReceived": {
      const orderId = await resolveId(op.orderId);
      await markSampleCollectedAndReceived(orderId);
      return;
    }
    case "technologistVerify": {
      const orderId = await resolveId(op.orderId);
      const result = await technologistVerify(orderId);
      if (result && "ok" in result && result.ok === false) throw new Error(result.error);
      return;
    }
    case "pathologistAuthorize": {
      const orderId = await resolveId(op.orderId);
      await pathologistAuthorize(orderId, {});
      return;
    }
    case "releaseReport": {
      const orderId = await resolveId(op.orderId);
      await releaseReport(orderId);
      return;
    }
    case "sendReportOnWhatsApp": {
      const orderId = await resolveId(op.orderId);
      const result = await sendReportOnWhatsApp(orderId);
      if (!result.ok) throw new Error(result.error);
      return;
    }
    case "markReportCollected": {
      const orderId = await resolveId(op.orderId);
      const result = await markReportCollected(orderId);
      if (!result.ok) throw new Error(result.error);
      return;
    }
    case "recordCriticalValueCall": {
      const orderId = await resolveId(op.params.orderId);
      await recordCriticalValueCall({ ...op.params, orderId });
    }
  }
}
