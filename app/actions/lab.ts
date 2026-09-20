"use server";

import { prisma } from "@/lib/prisma";
import { assertWritableLab, requireRole, requireTenant } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { Prisma, Role } from "@prisma/client";
import {
  DEFAULT_REPORT_LAYOUT,
  ALIQUOT_REPORT_PRESETS,
  layoutFromPreset,
  parseReportLayout,
  type ReportLayout,
} from "@/lib/report-layout";

export type SavedReportTemplate = {
  id: string;
  name: string;
  isDefault: boolean;
  layout: ReportLayout;
};

function mapTemplate(row: { id: string; name: string; isDefault: boolean; layoutJson: Prisma.JsonValue }): SavedReportTemplate {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    layout: parseReportLayout(row.layoutJson),
  };
}

export async function getOrCreateDefaultTemplate(branchId: string, vendorId: string) {
  const existing = await prisma.reportTemplate.findFirst({
    where: { branchId, isDefault: true, vendorId },
  });
  if (existing) return existing;
  return prisma.reportTemplate.create({
    data: {
      vendorId,
      branchId,
      name: "Standard (Aliquot)",
      isDefault: true,
      layoutJson: layoutFromPreset("standard") as unknown as Prisma.InputJsonValue,
    },
  });
}

async function ensureAliquotReportTemplates(branchId: string, vendorId: string) {
  await getOrCreateDefaultTemplate(branchId, vendorId);
  const existing = await prisma.reportTemplate.findMany({ where: { branchId, vendorId } });
  const legacyBrand = ["Patho", "Manager"].join(" ");
  for (const row of existing) {
    if (!row.name.includes(legacyBrand)) continue;
    const nextName = row.name.replaceAll(legacyBrand, "Aliquot");
    await prisma.reportTemplate.update({
      where: { id: row.id },
      data: { name: nextName },
    });
    row.name = nextName;
  }
  for (const preset of ALIQUOT_REPORT_PRESETS) {
    if (existing.some((item) => item.name === preset.name)) continue;
    await prisma.reportTemplate.create({
      data: {
        vendorId,
        branchId,
        name: preset.name,
        isDefault: false,
        layoutJson: layoutFromPreset(preset.key) as unknown as Prisma.InputJsonValue,
      },
    });
  }
}

async function listTemplatesForBranch(branchId: string, vendorId: string): Promise<SavedReportTemplate[]> {
  await ensureAliquotReportTemplates(branchId, vendorId);
  const rows = await prisma.reportTemplate.findMany({
    where: { branchId, vendorId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return rows.map(mapTemplate);
}

export async function getLabConfig() {
  const user = await requireTenant();
  const branch = user.branchId
    ? await prisma.branch.findFirst({ where: { id: user.branchId, vendorId: user.vendorId } })
    : await prisma.branch.findFirst({ where: { vendorId: user.vendorId }, orderBy: { createdAt: "asc" } });
  if (!branch) throw new Error("No laboratory branch is configured.");

  const templates = await listTemplatesForBranch(branch.id, user.vendorId);
  const active = templates.find((row) => row.isDefault) ?? templates[0];
  return {
    canEdit: user.role === Role.ADMIN,
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address ?? "",
      nablNo: branch.nablNo ?? "",
      isoNo: branch.isoNo ?? "",
      letterheadUrl: branch.letterheadUrl ?? "",
      inrIsi: branch.inrIsi,
    },
    layout: active?.layout ?? DEFAULT_REPORT_LAYOUT,
    templateId: active?.id ?? "",
    templates,
  };
}

export async function saveLabConfig(input: {
  branchId: string;
  name: string;
  address: string;
  nablNo: string;
  isoNo: string;
  letterheadUrl: string;
  inrIsi?: number;
  layout: ReportLayout;
  templateId?: string;
  templateName?: string;
}) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Laboratory name is required." };

  const layout = parseReportLayout(input.layout);

  const owned = await prisma.branch.findFirst({ where: { id: input.branchId, vendorId } });
  if (!owned) return { ok: false as const, error: "Branch was not found in this lab." };

  const branch = await prisma.branch.update({
    where: { id: input.branchId },
    data: {
      name,
      address: input.address.trim() || null,
      nablNo: input.nablNo.trim() || null,
      isoNo: input.isoNo.trim() || null,
      letterheadUrl: input.letterheadUrl.trim() || null,
      inrIsi: Number.isFinite(input.inrIsi) && (input.inrIsi as number) > 0 ? Number(input.inrIsi) : 1,
    },
  });

  const template =
    (input.templateId
      ? await prisma.reportTemplate.findFirst({ where: { id: input.templateId, branchId: branch.id, vendorId } })
      : null) ?? (await getOrCreateDefaultTemplate(branch.id, vendorId));

  const templateName = input.templateName?.trim();
  await prisma.$transaction([
    prisma.reportTemplate.updateMany({
      where: { branchId: branch.id, vendorId },
      data: { isDefault: false },
    }),
    prisma.reportTemplate.update({
      where: { id: template.id },
      data: {
        layoutJson: layout as unknown as Prisma.InputJsonValue,
        isDefault: true,
        ...(templateName ? { name: templateName } : {}),
      },
    }),
  ]);

  await logAudit({
    vendorId,
    userId,
    action: "LAB_CONFIG_UPDATED",
    entityType: "Branch",
    entityId: branch.id,
    after: { branch, layout, templateId: template.id },
  });

  revalidatePath("/admin/lab");
  return { ok: true as const, templateId: template.id };
}

export async function createReportTemplate(input: {
  branchId: string;
  name: string;
  presetKey?: string;
  copyFromId?: string;
}) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Template name is required." };

  const branch = await prisma.branch.findFirst({ where: { id: input.branchId, vendorId } });
  if (!branch) return { ok: false as const, error: "Branch was not found in this lab." };

  const clash = await prisma.reportTemplate.findFirst({ where: { branchId: branch.id, vendorId, name } });
  if (clash) return { ok: false as const, error: "A template with that name already exists." };

  let layout = layoutFromPreset(input.presetKey || "standard");
  if (input.copyFromId) {
    const source = await prisma.reportTemplate.findFirst({
      where: { id: input.copyFromId, branchId: branch.id, vendorId },
    });
    if (source) layout = parseReportLayout(source.layoutJson);
  }

  const created = await prisma.reportTemplate.create({
    data: {
      vendorId,
      branchId: branch.id,
      name,
      isDefault: false,
      layoutJson: layout as unknown as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    vendorId,
    userId,
    action: "REPORT_TEMPLATE_CREATED",
    entityType: "ReportTemplate",
    entityId: created.id,
    after: { name: created.name },
  });
  revalidatePath("/admin/lab");
  return { ok: true as const, template: mapTemplate(created) };
}

export async function duplicateReportTemplate(templateId: string) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const source = await prisma.reportTemplate.findFirst({ where: { id: templateId, vendorId } });
  if (!source) return { ok: false as const, error: "Template was not found." };

  const created = await prisma.reportTemplate.create({
    data: {
      vendorId,
      branchId: source.branchId,
      name: `${source.name} copy`,
      isDefault: false,
      layoutJson: source.layoutJson as Prisma.InputJsonValue,
    },
  });
  await logAudit({
    vendorId,
    userId,
    action: "REPORT_TEMPLATE_DUPLICATED",
    entityType: "ReportTemplate",
    entityId: created.id,
    after: { from: source.id, name: created.name },
  });
  revalidatePath("/admin/lab");
  return { ok: true as const, template: mapTemplate(created) };
}

export async function setDefaultReportTemplate(templateId: string) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, vendorId } });
  if (!template || !template.branchId) return { ok: false as const, error: "Template was not found." };

  await prisma.$transaction([
    prisma.reportTemplate.updateMany({
      where: { branchId: template.branchId, vendorId },
      data: { isDefault: false },
    }),
    prisma.reportTemplate.update({ where: { id: template.id }, data: { isDefault: true } }),
  ]);

  await logAudit({
    vendorId,
    userId,
    action: "REPORT_TEMPLATE_DEFAULT",
    entityType: "ReportTemplate",
    entityId: template.id,
    after: { name: template.name },
  });
  revalidatePath("/admin/lab");
  return { ok: true as const };
}

export async function deleteReportTemplate(templateId: string) {
  const { userId, vendorId } = await requireRole(Role.ADMIN);
  await assertWritableLab(vendorId);
  const template = await prisma.reportTemplate.findFirst({ where: { id: templateId, vendorId } });
  if (!template) return { ok: false as const, error: "Template was not found." };

  const count = await prisma.reportTemplate.count({ where: { branchId: template.branchId, vendorId } });
  if (count <= 1) return { ok: false as const, error: "Keep at least one report template." };
  if (template.isDefault) return { ok: false as const, error: "Set another template as default before deleting this one." };

  await prisma.reportTemplate.delete({ where: { id: template.id } });
  await logAudit({
    vendorId,
    userId,
    action: "REPORT_TEMPLATE_DELETED",
    entityType: "ReportTemplate",
    entityId: template.id,
    before: { name: template.name },
  });
  revalidatePath("/admin/lab");
  return { ok: true as const };
}

export async function getReportLayoutForBranch(branchId: string, vendorId: string): Promise<ReportLayout> {
  const template =
    (await prisma.reportTemplate.findFirst({
      where: { branchId, vendorId, isDefault: true },
    })) ??
    (await prisma.reportTemplate.findFirst({
      where: { branchId, vendorId },
      orderBy: { createdAt: "asc" },
    }));
  return parseReportLayout(template?.layoutJson);
}
