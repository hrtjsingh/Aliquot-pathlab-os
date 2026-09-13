"use server";

import { prisma } from "@/lib/prisma";
import { assertWritableLab, requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { Role, TestCategory } from "@prisma/client";
import { asMoney } from "@/lib/money";

const CATEGORIES = new Set<string>(Object.values(TestCategory));

function asCategory(value: string): TestCategory {
  return CATEGORIES.has(value) ? (value as TestCategory) : TestCategory.OTHER;
}

export async function createPanel(params: {
  code: string;
  name: string;
  category: string;
  price?: number;
  testIds: string[];
}) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const code = params.code.trim().toUpperCase().replace(/\s+/g, "_");
  const name = params.name.trim();
  if (!code || !name) return { ok: false as const, error: "Package code and name are required." };
  if (params.testIds.length === 0) return { ok: false as const, error: "Select at least one test." };

  const tests = await prisma.test.findMany({ where: { id: { in: params.testIds }, vendorId }, select: { id: true } });
  if (tests.length !== params.testIds.length) return { ok: false as const, error: "One or more tests were not found." };

  const existing = await prisma.panel.findUnique({ where: { vendorId_code: { vendorId, code } } });
  if (existing) return { ok: false as const, error: `Package code ${code} already exists.` };

  const panel = await prisma.panel.create({
    data: {
      vendorId,
      code,
      name,
      category: asCategory(params.category),
      price: asMoney(params.price),
      panelTests: { create: params.testIds.map((testId, sortOrder) => ({ testId, sortOrder })) },
    },
  });
  await logAudit({ vendorId, userId, action: "PANEL_CREATED", entityType: "Panel", entityId: panel.id, after: panel });
  revalidatePath("/admin/packages");
  revalidatePath("/orders/new");
  return { ok: true as const };
}

export async function updatePanel(params: {
  panelId: string;
  name: string;
  category: string;
  price?: number;
  testIds: string[];
  active?: boolean;
}) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const panel = await prisma.panel.findFirst({ where: { id: params.panelId, vendorId } });
  if (!panel) return { ok: false as const, error: "Package was not found." };
  const name = params.name.trim();
  if (!name) return { ok: false as const, error: "Package name is required." };
  if (params.testIds.length === 0) return { ok: false as const, error: "Select at least one test." };

  const tests = await prisma.test.findMany({ where: { id: { in: params.testIds }, vendorId }, select: { id: true } });
  if (tests.length !== params.testIds.length) return { ok: false as const, error: "One or more tests were not found." };

  await prisma.$transaction([
    prisma.panelTest.deleteMany({ where: { panelId: panel.id } }),
    prisma.panel.update({
      where: { id: panel.id },
      data: {
        name,
        category: asCategory(params.category),
        price: asMoney(params.price),
        active: params.active ?? panel.active,
        panelTests: { create: params.testIds.map((testId, sortOrder) => ({ testId, sortOrder })) },
      },
    }),
  ]);
  await logAudit({ vendorId, userId, action: "PANEL_UPDATED", entityType: "Panel", entityId: panel.id });
  revalidatePath("/admin/packages");
  revalidatePath("/orders/new");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function deletePanel(panelId: string) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const panel = await prisma.panel.findFirst({
    where: { id: panelId, vendorId },
    include: { _count: { select: { orderPanels: true } } },
  });
  if (!panel) return { ok: false as const, error: "Package was not found." };
  if (panel._count.orderPanels > 0) {
    await prisma.panel.update({ where: { id: panel.id }, data: { active: false } });
    await logAudit({ vendorId, userId, action: "PANEL_DEACTIVATED", entityType: "Panel", entityId: panel.id });
    revalidatePath("/admin/packages");
    return { ok: true as const, deactivated: true };
  }
  await prisma.panelTest.deleteMany({ where: { panelId: panel.id } });
  await prisma.panel.delete({ where: { id: panel.id } });
  await logAudit({ vendorId, userId, action: "PANEL_DELETED", entityType: "Panel", entityId: panel.id });
  revalidatePath("/admin/packages");
  return { ok: true as const, deactivated: false };
}

export async function listPanelsForAdmin() {
  const { vendorId } = await requireRole(Role.ADMIN);
  return prisma.panel.findMany({
    where: { vendorId },
    include: { panelTests: { include: { test: { select: { id: true, name: true, code: true } } }, orderBy: { sortOrder: "asc" } } },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}
