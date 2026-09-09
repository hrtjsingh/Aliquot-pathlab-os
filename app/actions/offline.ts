"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/rbac";
import { WORKLIST_STATUSES } from "@/lib/workflow";
import { syncVendorToCloud, type CloudSyncResult } from "@/lib/sync/cloud";

export type LabSnapshot = {
  syncedAt: string;
  patients: Array<{
    id: string;
    mrn: string;
    firstName: string;
    lastName: string | null;
    gender: string;
    ageYears: number | null;
  }>;
  panels: Array<{ id: string; code: string; name: string; category: string }>;
  tests: Array<{ id: string; code: string; name: string; category: string; isDerived: boolean }>;
  worklist: Array<{
    id: string;
    accessionNo: string;
    status: string;
    priority: string;
    patient: { firstName: string; lastName: string | null; phone: string | null };
    testCount: number;
  }>;
  dashboard: {
    sampleReceived: number;
    resultEntry: number;
    techVerified: number;
    authorized: number;
    awaitingHandover: number;
    criticalOpen: number;
    releasedToday: number;
    recent: Array<{
      id: string;
      accessionNo: string;
      status: string;
      priority: string;
      patientName: string;
    }>;
  };
  cloudSync?: CloudSyncResult;
};

export async function getLabSnapshot(): Promise<LabSnapshot> {
  const user = await requireTenant();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const statuses = ["SAMPLE_RECEIVED", "RESULT_ENTRY", "TECH_VERIFIED", "AUTHORIZED"] as const;
  const vendorId = user.vendorId;

  const [patients, panels, tests, worklist, counts, awaitingHandover, criticalOpen, releasedToday, recentOrders] = await Promise.all([
    prisma.patient.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, ageYears: true },
    }),
    prisma.panel.findMany({
      where: { vendorId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, category: true },
    }),
    prisma.test.findMany({
      where: { vendorId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, category: true, isDerived: true },
    }),
    prisma.order.findMany({
      where: {
        vendorId,
        status: { in: WORKLIST_STATUSES },
      },
      include: {
        patient: { select: { firstName: true, lastName: true, phone: true } },
        orderTests: { select: { id: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    }),
    Promise.all(statuses.map((status) => prisma.order.count({ where: { vendorId, status } }))),
    prisma.order.count({ where: { vendorId, status: "RELEASED" } }),
    prisma.result.count({
      where: {
        flag: { in: ["CRITICAL_LOW", "CRITICAL_HIGH"] },
        status: { not: "RELEASED" },
        order: { vendorId },
      },
    }),
    prisma.order.count({
      where: { vendorId, reportedAt: { gte: startOfToday }, status: { in: ["RELEASED", "SENT_TO_CUSTOMER"] } },
    }),
    prisma.order.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        accessionNo: true,
        status: true,
        priority: true,
        patient: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  return {
    syncedAt: new Date().toISOString(),
    patients,
    panels,
    tests,
    worklist: worklist.map((order) => ({
      id: order.id,
      accessionNo: order.accessionNo,
      status: order.status,
      priority: order.priority,
      patient: order.patient,
      testCount: order.orderTests.length,
    })),
    dashboard: {
      sampleReceived: counts[0],
      resultEntry: counts[1],
      techVerified: counts[2],
      authorized: counts[3],
      awaitingHandover,
      criticalOpen,
      releasedToday,
      recent: recentOrders.map((order) => ({
        id: order.id,
        accessionNo: order.accessionNo,
        status: order.status,
        priority: order.priority,
        patientName: `${order.patient.firstName} ${order.patient.lastName ?? ""}`.trim(),
      })),
    },
  };
}

export async function syncLabData(): Promise<LabSnapshot> {
  const user = await requireTenant();
  const snapshot = await getLabSnapshot();
  const cloudSync = await syncVendorToCloud(user.vendorId, { maxWaitMs: 500, pull: false });
  revalidatePath("/dashboard");
  revalidatePath("/worklist");
  revalidatePath("/patients");
  revalidatePath("/admin/tests");
  return { ...snapshot, cloudSync };
}
