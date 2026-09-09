"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { Prisma, Role } from "@prisma/client";
import { DEFAULT_REPORT_LAYOUT, parseReportLayout, type ReportLayout } from "@/lib/report-layout";

export async function getOrCreateDefaultTemplate(branchId: string) {
  const existing = await prisma.reportTemplate.findFirst({
    where: { branchId, isDefault: true },
  });
  if (existing) return existing;
  return prisma.reportTemplate.create({
    data: {
      branchId,
      name: "Default laboratory report",
      isDefault: true,
      layoutJson: DEFAULT_REPORT_LAYOUT as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getLabConfig() {
  const user = await requireUser();
  const branch = user.branchId
    ? await prisma.branch.findUnique({ where: { id: user.branchId } })
    : await prisma.branch.findFirst({ orderBy: { createdAt: "asc" } });
  if (!branch) throw new Error("No laboratory branch is configured.");

  const template = await getOrCreateDefaultTemplate(branch.id);
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
    },
    layout: parseReportLayout(template.layoutJson),
    templateId: template.id,
  };
}

export async function saveLabConfig(input: {
  branchId: string;
  name: string;
  address: string;
  nablNo: string;
  isoNo: string;
  letterheadUrl: string;
  layout: ReportLayout;
}) {
  const { userId } = await requireRole(Role.ADMIN);
  const name = input.name.trim();
  if (!name) return { ok: false as const, error: "Laboratory name is required." };

  const layout = parseReportLayout(input.layout);

  const branch = await prisma.branch.update({
    where: { id: input.branchId },
    data: {
      name,
      address: input.address.trim() || null,
      nablNo: input.nablNo.trim() || null,
      isoNo: input.isoNo.trim() || null,
      letterheadUrl: input.letterheadUrl.trim() || null,
    },
  });

  const template = await getOrCreateDefaultTemplate(branch.id);
  await prisma.reportTemplate.update({
    where: { id: template.id },
    data: { layoutJson: layout as unknown as Prisma.InputJsonValue },
  });

  await logAudit({
    userId,
    action: "LAB_CONFIG_UPDATED",
    entityType: "Branch",
    entityId: branch.id,
    after: { branch, layout },
  });

  revalidatePath("/admin/lab");
  return { ok: true as const };
}

export async function getReportLayoutForBranch(branchId: string): Promise<ReportLayout> {
  const template = await prisma.reportTemplate.findFirst({
    where: { branchId, isDefault: true },
  });
  return parseReportLayout(template?.layoutJson);
}
