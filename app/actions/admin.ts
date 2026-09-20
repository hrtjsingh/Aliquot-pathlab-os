"use server";

import { prisma } from "@/lib/prisma";
import { assertWritableLab, requireRole, requireTenant } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { Role, TestCategory, ResultDataType, Gender } from "@prisma/client";
import { asMoney } from "@/lib/money";
import { formulaToDerivationRule } from "@/lib/test-deps";

export async function createTest(formData: FormData) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);

  const code = String(formData.get("code")).toUpperCase().trim();
  const name = String(formData.get("name")).trim();
  const category = String(formData.get("category")) as TestCategory;
  const specimenType = String(formData.get("specimenType"));
  const unit = String(formData.get("unit") || "");
  const dataType = String(formData.get("dataType")) as ResultDataType;
  const method = String(formData.get("method") || "").trim() || null;
  const turnaroundHours = formData.get("turnaroundHours") ? Number(formData.get("turnaroundHours")) : null;
  const description = String(formData.get("description") || "").trim() || null;
  const collectionNotes = String(formData.get("collectionNotes") || "").trim() || null;
  const priceRaw = String(formData.get("price") || "").trim();
  const price = priceRaw ? Number(priceRaw) : 0;
  const formula = String(formData.get("formula") || "").trim();
  const low = formData.get("low") ? Number(formData.get("low")) : null;
  const high = formData.get("high") ? Number(formData.get("high")) : null;

  if (!code || !name) return { ok: false as const, error: "Code and name are required." };

  const siblings = await prisma.test.findMany({ where: { vendorId }, select: { name: true, code: true } });
  const parsedFormula = formulaToDerivationRule(formula, siblings);
  if (!parsedFormula.ok) return { ok: false as const, error: parsedFormula.error };

  const last = await prisma.test.findFirst({ where: { vendorId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  const test = await prisma.test.create({
    data: {
      vendorId,
      code,
      name,
      category,
      specimenType,
      unit,
      dataType,
      method,
      turnaroundHours: Number.isFinite(turnaroundHours) ? turnaroundHours : null,
      description,
      collectionNotes,
      decimalPrecision: 2,
      price: asMoney(price),
      isDerived: Boolean(parsedFormula.rule),
      derivationRule: parsedFormula.rule,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  if (low != null || high != null) {
    await prisma.referenceRange.create({ data: { testId: test.id, low, high, isDefault: true } });
  }

  await logAudit({ vendorId, userId, action: "TEST_CREATED", entityType: "Test", entityId: test.id, after: test });
  revalidatePath("/admin/tests");
  return { ok: true as const };
}

export async function toggleTestActive(testId: string, active: boolean) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const existing = await prisma.test.findFirst({ where: { id: testId, vendorId } });
  if (!existing) throw new Error("Test was not found in this lab.");
  const test = await prisma.test.update({ where: { id: testId }, data: { active } });
  await logAudit({ vendorId, userId, action: active ? "TEST_ACTIVATED" : "TEST_DEACTIVATED", entityType: "Test", entityId: testId });
  revalidatePath("/admin/tests");
  return test;
}

export async function updateTestProfile(formData: FormData) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const testId = String(formData.get("testId"));
  const shortName = String(formData.get("shortName") || "").trim() || null;
  const specimenType = String(formData.get("specimenType") || "").trim();
  const method = String(formData.get("method") || "").trim() || null;
  const loincCode = String(formData.get("loincCode") || "").trim() || null;
  const unit = String(formData.get("unit") || "").trim() || null;
  const turnaroundHoursRaw = String(formData.get("turnaroundHours") || "").trim();
  const turnaroundHours = turnaroundHoursRaw ? Number(turnaroundHoursRaw) : null;
  const description = String(formData.get("description") || "").trim() || null;
  const collectionNotes = String(formData.get("collectionNotes") || "").trim() || null;
  const autoVerifyEligible = formData.get("autoVerifyEligible") === "on";
  const priceRaw = String(formData.get("price") || "").trim();
  const formula = String(formData.get("formula") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const categoryRaw = String(formData.get("category") || "").trim();

  if (!specimenType) return { ok: false as const, error: "Specimen type is required." };

  const existing = await prisma.test.findFirst({ where: { id: testId, vendorId } });
  if (!existing) return { ok: false as const, error: "Test was not found in this lab." };

  const siblings = await prisma.test.findMany({ where: { vendorId }, select: { name: true, code: true } });
  const named = siblings.map((row) => (row.code === existing.code && name ? { ...row, name } : row));
  const parsedFormula = formulaToDerivationRule(formula, named);
  if (!parsedFormula.ok) return { ok: false as const, error: parsedFormula.error };

  const test = await prisma.test.update({
    where: { id: testId },
    data: {
      name: name || existing.name,
      category: categoryRaw ? (categoryRaw as TestCategory) : existing.category,
      shortName,
      specimenType,
      method,
      loincCode,
      unit,
      turnaroundHours: turnaroundHours != null && Number.isFinite(turnaroundHours) ? turnaroundHours : null,
      description,
      collectionNotes,
      autoVerifyEligible,
      price: priceRaw === "" ? existing.price : asMoney(priceRaw),
      isDerived: Boolean(parsedFormula.rule),
      derivationRule: parsedFormula.rule,
    },
  });

  await logAudit({ vendorId, userId, action: "TEST_PROFILE_UPDATED", entityType: "Test", entityId: testId, after: test });
  revalidatePath("/admin/tests");
  return { ok: true as const };
}

export async function addReferenceRange(formData: FormData) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const testId = String(formData.get("testId"));
  const genderRaw = String(formData.get("gender") || "");
  const gender = genderRaw === "MALE" || genderRaw === "FEMALE" || genderRaw === "OTHER" ? (genderRaw as Gender) : null;
  const low = formData.get("low") ? Number(formData.get("low")) : null;
  const high = formData.get("high") ? Number(formData.get("high")) : null;
  const isDefault = formData.get("isDefault") === "on";

  if (low == null && high == null) {
    return { ok: false as const, error: "Enter a low value, a high value, or both." };
  }

  const existing = await prisma.test.findFirst({ where: { id: testId, vendorId } });
  if (!existing) return { ok: false as const, error: "Test was not found in this lab." };

  const range = await prisma.referenceRange.create({
    data: {
      testId,
      gender,
      low,
      high,
      isDefault,
      ageMinDays: 0,
      ageMaxDays: 43800,
    },
  });

  await logAudit({ vendorId, userId, action: "REFERENCE_RANGE_ADDED", entityType: "ReferenceRange", entityId: range.id, after: range });
  revalidatePath("/admin/tests");
  return { ok: true as const };
}

export async function addCriticalThreshold(formData: FormData) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const testId = String(formData.get("testId"));
  const low = formData.get("low") ? Number(formData.get("low")) : null;
  const high = formData.get("high") ? Number(formData.get("high")) : null;

  if (low == null && high == null) {
    return { ok: false as const, error: "Enter a panic low, a panic high, or both." };
  }

  const existing = await prisma.test.findFirst({ where: { id: testId, vendorId } });
  if (!existing) return { ok: false as const, error: "Test was not found in this lab." };

  const threshold = await prisma.criticalThreshold.create({
    data: { testId, low, high },
  });

  await logAudit({ vendorId, userId, action: "CRITICAL_THRESHOLD_ADDED", entityType: "CriticalThreshold", entityId: threshold.id, after: threshold });
  revalidatePath("/admin/tests");
  return { ok: true as const };
}

export async function getCanEditTests() {
  const user = await requireTenant();
  return user.role === Role.ADMIN;
}

export async function deleteUnusedTest(testId: string) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const test = await prisma.test.findFirst({
    where: { id: testId, vendorId },
    include: { _count: { select: { orderTests: true, results: true, panelTests: true } } },
  });
  if (!test) return { ok: false as const, error: "Test was not found in this lab." };
  if (test._count.orderTests > 0 || test._count.results > 0) {
    await prisma.test.update({ where: { id: test.id }, data: { active: false } });
    await logAudit({ vendorId, userId, action: "TEST_DEACTIVATED", entityType: "Test", entityId: test.id });
    revalidatePath("/admin/tests");
    return { ok: true as const, deactivated: true };
  }
  await prisma.referenceRange.deleteMany({ where: { testId: test.id } });
  await prisma.criticalThreshold.deleteMany({ where: { testId: test.id } });
  await prisma.panelTest.deleteMany({ where: { testId: test.id } });
  await prisma.test.delete({ where: { id: test.id } });
  await logAudit({ vendorId, userId, action: "TEST_DELETED", entityType: "Test", entityId: test.id });
  revalidatePath("/admin/tests");
  return { ok: true as const, deactivated: false };
}
