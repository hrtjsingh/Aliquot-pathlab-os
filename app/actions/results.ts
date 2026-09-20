"use server";

import { prisma } from "@/lib/prisma";
import { assertWritableLab, requireRole, requireTenant, requireWritableLab } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { resolveReferenceRange, formatRangeText, ageInDays } from "@/lib/reference-range";
import { computeFlag, computeDelta, requiresCriticalCallback, parseRangeBounds, computeQualitativeFlag } from "@/lib/flagging";
import { runCalcRule } from "@/lib/calc-engine";
import { generateInterpretiveComments } from "@/lib/interpretive-comments";
import { roundNumeric, numericValuesEqual } from "@/lib/format-result";
import { OrderStatus, Prisma, ResultStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { newPublicReportToken } from "@/lib/public-report";

const DELTA_CONFIG = { pctThreshold: 30 }; // lab-configurable; flat 30% default per common LIS practice

function effectiveAgeYears(ageYears: number | null, ageDays: number) {
  if (ageYears != null && ageYears > 0) return ageYears;
  return Math.max(1, Math.floor(ageDays / 365.25));
}

async function patientRangeCtx(orderId: string, vendorId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, vendorId },
    include: { patient: true },
  });
  if (!order) throw new Error("Order was not found in this lab.");
  const days = ageInDays(order.patient.dob, order.patient.ageYears, order.patient.ageMonths);
  return {
    order,
    days,
    rangeCtx: {
      gender: order.patient.gender,
      ageDays: days,
      isPregnant: order.patient.isPregnant,
      pregnancyTrimester: order.patient.pregnancyWeeks ? Math.ceil(order.patient.pregnancyWeeks / 13) : null,
    },
    calcCtx: {
      gender: order.patient.gender,
      ageYears: effectiveAgeYears(order.patient.ageYears, days),
    },
  };
}

/** Save/overwrite one manually-entered (non-derived) result, then re-cascade any derived tests on the order. */
export async function saveManualResult(params: {
  orderId: string;
  testId: string;
  numericValue?: number | null;
  textValue?: string | null;
  grossDescription?: string;
  microscopicDescription?: string;
  diagnosis?: string;
  organismPanel?: unknown;
  qualitativeResult?: string;
  ctValue?: number;
  interpretiveComment?: string | null;
  referenceRangeText?: string | null;
}) {
  const user = await requireWritableLab();
  const test = await prisma.test.findFirst({
    where: { id: params.testId, vendorId: user.vendorId },
    include: { referenceRanges: true, criticalThresholds: true },
  });
  if (!test) throw new Error("Test was not found in this lab.");
  const { order, rangeCtx } = await patientRangeCtx(params.orderId, user.vendorId);

  const range = resolveReferenceRange(test.referenceRanges, rangeCtx);
  const overrideText = params.referenceRangeText?.trim();
  const effectiveRange = overrideText
    ? {
        ...(range ?? {
          id: "override",
          testId: test.id,
          gender: null,
          ageMinDays: 0,
          ageMaxDays: 43800,
          pregnancyOnly: false,
          trimester: null,
          unit: test.unit,
          isDefault: true,
          createdAt: new Date(),
        }),
        ...parseRangeBounds(overrideText),
        textRange: overrideText,
      }
    : range;
  const critical = test.criticalThresholds.find(
    (c) => (!c.gender || c.gender === order.patient.gender) && rangeCtx.ageDays >= c.ageMinDays && rangeCtx.ageDays <= c.ageMaxDays
  ) ?? null;

  const flag =
    params.numericValue != null
      ? computeFlag({ numericValue: params.numericValue, range: effectiveRange as typeof range, criticalThreshold: critical })
      : computeQualitativeFlag(params.textValue, overrideText || formatRangeText(effectiveRange as typeof range));

  // Delta check against this patient's most recent prior RELEASED result for the same test.
  let deltaFlagged = false;
  let deltaPrevValue: number | null = null;
  let deltaPctChange: number | null = null;
  if (params.numericValue != null) {
    const prior = await prisma.result.findFirst({
      where: { testId: test.id, order: { patientId: order.patientId }, status: "RELEASED", numericValue: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    if (prior?.numericValue != null) {
      const delta = computeDelta(params.numericValue, prior.numericValue, DELTA_CONFIG);
      deltaFlagged = delta.flagged;
      deltaPctChange = delta.pctChange;
      deltaPrevValue = prior.numericValue;
    }
  }

  const existing = await prisma.result.findFirst({ where: { orderId: params.orderId, testId: params.testId } });
  const data = {
    orderId: params.orderId,
    testId: params.testId,
    numericValue: params.numericValue != null ? roundNumeric(params.numericValue, test.decimalPrecision) : null,
    textValue: params.textValue ?? null,
    unit: test.unit,
    referenceRangeText: overrideText || formatRangeText(range),
    flag,
    deltaFlag: deltaFlagged,
    deltaPrevValue,
    deltaPctChange,
    isDerived: false,
    status: "ENTERED" as ResultStatus,
    enteredById: user.userId,
    enteredAt: new Date(),
    grossDescription: params.grossDescription ?? null,
    microscopicDescription: params.microscopicDescription ?? null,
    diagnosis: params.diagnosis ?? null,
    organismPanel: params.organismPanel as Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined,
    qualitativeResult: params.qualitativeResult ?? null,
    ctValue: params.ctValue ?? null,
    interpretiveComment:
      params.interpretiveComment !== undefined ? params.interpretiveComment : existing?.interpretiveComment ?? null,
  };

  const result = existing
    ? await prisma.result.update({ where: { id: existing.id }, data })
    : await prisma.result.create({ data });

  await logAudit({ vendorId: user.vendorId, userId: user.userId, orderId: params.orderId, action: "RESULT_ENTERED", entityType: "Result", entityId: result.id, after: result });

  if (order.status === OrderStatus.SAMPLE_RECEIVED) {
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.RESULT_ENTRY } });
  }

  await cascadeDerivedResults(params.orderId, user.vendorId);
  revalidatePath(`/orders/${params.orderId}`);
  return result;
}

/**
 * Recompute every derived test on the order whose required inputs are now
 * present. Runs after every manual entry — cheap at typical panel sizes and
 * guarantees derived values never go stale relative to their inputs.
 */
export async function cascadeDerivedResults(orderId: string, vendorId: string) {
  const orderRow = await prisma.order.findFirst({ where: { id: orderId, vendorId } });
  if (!orderRow) throw new Error("Order was not found in this lab.");
  const { order, rangeCtx, calcCtx } = await patientRangeCtx(orderId, orderRow.vendorId);
  const orderTests = await prisma.orderTest.findMany({
    where: { orderId },
    include: { test: { include: { referenceRanges: true, criticalThresholds: true } } },
    orderBy: { sortOrder: "asc" },
  });
  const existingResults = await prisma.result.findMany({ where: { orderId } });
  const valueByCode = new Map<string, number | null | undefined>();
  for (const ot of orderTests) {
    const r = existingResults.find((res) => res.testId === ot.testId);
    valueByCode.set(ot.test.code, r?.numericValue ?? null);
  }
  const branch = await prisma.branch.findFirst({ where: { id: order.branchId }, select: { inrIsi: true } });
  const calcConfig = { isi: branch?.inrIsi ?? 1 };

  for (let pass = 0; pass < 6; pass += 1) {
    let changed = false;
    for (const ot of orderTests) {
      const test = ot.test;
      if (!test.isDerived || !test.derivationRule) continue;

      const inputs: Record<string, number | null | undefined> = {};
      for (const [code, value] of valueByCode) inputs[code] = value;

      const calcResult = runCalcRule(test.derivationRule, inputs, calcCtx, calcConfig);
      if (calcResult.value == null) continue;

      const range = resolveReferenceRange(test.referenceRanges, rangeCtx);
      const critical =
        test.criticalThresholds.find(
          (c) =>
            (!c.gender || c.gender === order.patient.gender) &&
            rangeCtx.ageDays >= c.ageMinDays &&
            rangeCtx.ageDays <= c.ageMaxDays
        ) ?? null;
      const derivedValue = roundNumeric(calcResult.value, test.decimalPrecision);
      const flag = computeFlag({ numericValue: derivedValue, range, criticalThreshold: critical });

      const existing = existingResults.find((r) => r.testId === test.id);
      if (existing && numericValuesEqual(existing.numericValue, derivedValue, test.decimalPrecision)) continue;

      const data = {
        orderId,
        testId: test.id,
        numericValue: derivedValue,
        unit: test.unit,
        referenceRangeText: formatRangeText(range),
        flag,
        isDerived: true,
        status: "ENTERED" as ResultStatus,
        enteredAt: new Date(),
      };
      if (existing) {
        await prisma.result.update({ where: { id: existing.id }, data });
        existing.numericValue = derivedValue;
      } else {
        const created = await prisma.result.create({ data });
        existingResults.push(created);
      }
      valueByCode.set(test.code, derivedValue);
      changed = true;
    }
    if (!changed) break;
  }
}

export async function technologistVerify(orderId: string) {
  const user = await requireWritableLab();
  if (!["TECHNOLOGIST", "ADMIN"].includes(user.role)) throw new Error("Only a technologist can verify results.");
  await prisma.order.findFirstOrThrow({ where: { id: orderId, vendorId: user.vendorId } });

  const results = await prisma.result.findMany({ where: { orderId } });
  const anyCritical = results.some((r) => requiresCriticalCallback(r.flag));
  if (anyCritical) {
    const called = await prisma.criticalValueCall.findFirst({ where: { orderId } });
    if (!called) {
      return { ok: false as const, error: "Critical value(s) present — log the clinician call-back before verifying." };
    }
  }

  await prisma.result.updateMany({
    where: { orderId },
    data: { status: "TECH_VERIFIED", verifiedById: user.userId, verifiedAt: new Date() },
  });
  await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.TECH_VERIFIED } });
  await logAudit({ vendorId: user.vendorId, userId: user.userId, orderId, action: "TECH_VERIFIED", entityType: "Order", entityId: orderId });
  revalidatePath(`/orders/${orderId}`);
  return { ok: true as const };
}

export async function pathologistAuthorize(orderId: string, pathologistNotesByResultId: Record<string, string>) {
  const user = await requireWritableLab();
  if (!["PATHOLOGIST", "ADMIN"].includes(user.role)) throw new Error("Only a pathologist can authorize a report.");
  await prisma.order.findFirstOrThrow({ where: { id: orderId, vendorId: user.vendorId } });

  for (const [resultId, note] of Object.entries(pathologistNotesByResultId)) {
    if (note) await prisma.result.update({ where: { id: resultId }, data: { pathologistNote: note } });
  }

  await prisma.result.updateMany({ where: { orderId }, data: { status: "AUTHORIZED" } });
  await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.AUTHORIZED, authorizedById: user.userId } });
  await logAudit({ vendorId: user.vendorId, userId: user.userId, orderId, action: "AUTHORIZED", entityType: "Order", entityId: orderId });
  revalidatePath(`/orders/${orderId}`);
  return { ok: true as const };
}

export async function releaseReport(orderId: string) {
  const user = await requireWritableLab();
  const order = await prisma.order.findFirstOrThrow({ where: { id: orderId, vendorId: user.vendorId } });
  await prisma.result.updateMany({ where: { orderId }, data: { status: "RELEASED" } });
  await prisma.order.update({
    where: { id: orderId },
    data: {
      status: OrderStatus.RELEASED,
      reportedAt: new Date(),
      publicToken: order.publicToken ?? newPublicReportToken(),
    },
  });
  await logAudit({ vendorId: user.vendorId, userId: user.userId, orderId, action: "REPORT_RELEASED", entityType: "Order", entityId: orderId });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/worklist");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** Admin-only: take a released report down. The accession returns to authorized so it can be corrected and released again. */
export async function removeReleasedReport(orderId: string) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const order = await prisma.order.findFirst({ where: { id: orderId, vendorId } });
  if (!order) throw new Error("Order was not found in this lab.");
  if (order.status !== OrderStatus.RELEASED) {
    return { ok: false as const, error: "Only a released report can be removed." };
  }

  await prisma.result.updateMany({ where: { orderId }, data: { status: ResultStatus.AUTHORIZED } });
  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.AUTHORIZED, reportedAt: null },
  });

  await logAudit({
    vendorId,
    userId,
    orderId,
    action: "REPORT_REMOVED",
    entityType: "Order",
    entityId: orderId,
    before: { status: order.status, reportedAt: order.reportedAt },
    after: { status: OrderStatus.AUTHORIZED, reportedAt: null },
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/report`);
  revalidatePath("/worklist");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function recordCriticalValueCall(params: {
  orderId: string;
  notifiedName: string;
  notifiedRole?: string;
  contactMethod: string;
  confirmationNote?: string;
}) {
  const user = await requireWritableLab();
  await prisma.order.findFirstOrThrow({ where: { id: params.orderId, vendorId: user.vendorId } });
  const call = await prisma.criticalValueCall.create({
    data: {
      orderId: params.orderId,
      calledById: user.userId,
      notifiedName: params.notifiedName,
      notifiedRole: params.notifiedRole,
      contactMethod: params.contactMethod,
      confirmationNote: params.confirmationNote,
    },
  });
  await logAudit({ vendorId: user.vendorId, userId: user.userId, orderId: params.orderId, action: "CRITICAL_VALUE_CALLED", entityType: "CriticalValueCall", entityId: call.id, after: call });
  revalidatePath(`/orders/${params.orderId}`);
  return call;
}

/** Suggested interpretive comments for the whole order — pathologist reviews/edits before authorization. */
export async function suggestInterpretiveComments(orderId: string) {
  const user = await requireTenant();
  await prisma.order.findFirstOrThrow({ where: { id: orderId, vendorId: user.vendorId } });
  const results = await prisma.result.findMany({ where: { orderId }, include: { test: true } });
  const values: Record<string, number | null> = {};
  const ranges: Record<string, { low?: number | null; high?: number | null }> = {};
  for (const r of results) {
    values[r.test.code] = r.numericValue;
    const rr = await prisma.referenceRange.findFirst({ where: { testId: r.testId, isDefault: true } });
    ranges[r.test.code] = { low: rr?.low, high: rr?.high };
  }
  return generateInterpretiveComments(values, ranges);
}
