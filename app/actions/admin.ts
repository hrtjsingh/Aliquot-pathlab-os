"use server";

import { prisma } from "@/lib/prisma";
import { assertWritableLab, requireRole, requireTenant } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { Role, TestCategory, ResultDataType, Gender } from "@prisma/client";

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
  const low = formData.get("low") ? Number(formData.get("low")) : null;
  const high = formData.get("high") ? Number(formData.get("high")) : null;

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

  if (!specimenType) return { ok: false as const, error: "Specimen type is required." };

  const existing = await prisma.test.findFirst({ where: { id: testId, vendorId } });
  if (!existing) return { ok: false as const, error: "Test was not found in this lab." };

  const test = await prisma.test.update({
    where: { id: testId },
    data: {
      shortName,
      specimenType,
      method,
      loincCode,
      unit,
      turnaroundHours: turnaroundHours != null && Number.isFinite(turnaroundHours) ? turnaroundHours : null,
      description,
      collectionNotes,
      autoVerifyEligible,
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
      ageMinDays: 6570,
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
