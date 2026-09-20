"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/rbac";
import { WORKLIST_STATUSES } from "@/lib/workflow";
import { syncVendorToCloud, type CloudSyncResult } from "@/lib/sync/cloud";
import { asMoney, dueAmount } from "@/lib/money";
import { readOrderBilling } from "@/lib/order-billing-db";

export type LabSnapshot = {
  syncedAt: string;
  patients: Array<{
    id: string;
    mrn: string;
    firstName: string;
    lastName: string | null;
    gender: string;
    ageYears: number | null;
    phone: string | null;
  }>;
  panels: Array<{ id: string; code: string; name: string; category: string; price: number; testIds: string[] }>;
  tests: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    isDerived: boolean;
    price: number;
    derivationRule: string | null;
    unit: string | null;
    sortOrder: number;
    hideOnBooking: boolean;
  }>;
  worklist: Array<{
    id: string;
    accessionNo: string;
    status: string;
    priority: string;
    patient: { firstName: string; lastName: string | null; phone: string | null };
    testCount: number;
    totalCharge?: number;
    discount?: number;
    amountPaid?: number;
    due?: number;
  }>;
  dashboard: {
    sampleReceived: number;
    resultEntry: number;
    techVerified: number;
    authorized: number;
    awaitingHandover: number;
    criticalOpen: number;
    releasedToday: number;
    collection: { count: number; total: number; discount: number; paid: number; due: number };
    bookings: Array<{
      id: string;
      accessionNo: string;
      createdAt: string;
      status: string;
      priority: string;
      patientName: string;
      phone: string | null;
      ageYears: number | null;
      gender: string;
      totalCharge: number;
      discount: number;
      amountPaid: number;
      due: number;
    }>;
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

  const [patients, panels, tests, worklist, counts, awaitingHandover, criticalOpen, releasedToday, recentOrders, bookingOrders] = await Promise.all([
    prisma.patient.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, ageYears: true, phone: true },
    }),
    prisma.panel.findMany({
      where: { vendorId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, category: true, price: true, panelTests: { select: { testId: true, sortOrder: true }, orderBy: { sortOrder: "asc" } } },
    }),
    prisma.test.findMany({
      where: { vendorId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, code: true, name: true, category: true, isDerived: true, price: true, derivationRule: true, unit: true, sortOrder: true, hideOnBooking: true },
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
      where: { vendorId, reportedAt: { gte: startOfToday }, status: { in: ["RELEASED", "SENT_TO_CUSTOMER", "COLLECTED_BY_CUSTOMER"] } },
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
    prisma.order.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: 250,
      select: {
        id: true,
        accessionNo: true,
        createdAt: true,
        status: true,
        priority: true,
        patient: { select: { firstName: true, lastName: true, phone: true, ageYears: true, gender: true } },
      },
    }),
  ]);

  const billing = await readOrderBilling(bookingOrders.map((order) => order.id));
  const bookings = bookingOrders.map((order) => {
    const money = billing.get(order.id) ?? { totalCharge: 0, discount: 0, amountPaid: 0 };
    const totalCharge = money.totalCharge;
    const discount = money.discount;
    const amountPaid = money.amountPaid;
    return {
      id: order.id,
      accessionNo: order.accessionNo,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      priority: order.priority,
      patientName: `${order.patient.firstName} ${order.patient.lastName ?? ""}`.trim(),
      phone: order.patient.phone,
      ageYears: order.patient.ageYears,
      gender: order.patient.gender,
      totalCharge,
      discount,
      amountPaid,
      due: dueAmount(totalCharge, discount, amountPaid),
    };
  });
  const collection = bookings.reduce(
    (acc, row) => {
      if (row.status === "CANCELLED" || row.status === "AMENDED") return acc;
      acc.count += 1;
      acc.total += row.totalCharge;
      acc.discount += row.discount;
      acc.paid += row.amountPaid;
      acc.due += row.due;
      return acc;
    },
    { count: 0, total: 0, discount: 0, paid: 0, due: 0 }
  );

  return {
    syncedAt: new Date().toISOString(),
    patients,
    panels: panels.map((panel) => ({
      id: panel.id,
      code: panel.code,
      name: panel.name,
      category: panel.category,
      price: asMoney(panel.price),
      testIds: panel.panelTests.map((member) => member.testId),
    })),
    tests: tests.map((test) => ({
      ...test,
      price: asMoney(test.price),
    })),
    worklist: worklist.map((order) => {
      const money = billing.get(order.id) ?? { totalCharge: 0, discount: 0, amountPaid: 0 };
      const totalCharge = money.totalCharge;
      const discount = money.discount;
      const amountPaid = money.amountPaid;
      return {
        id: order.id,
        accessionNo: order.accessionNo,
        status: order.status,
        priority: order.priority,
        patient: order.patient,
        testCount: order.orderTests.length,
        totalCharge,
        discount,
        amountPaid,
        due: dueAmount(totalCharge, discount, amountPaid),
      };
    }),
    dashboard: {
      sampleReceived: counts[0],
      resultEntry: counts[1],
      techVerified: counts[2],
      authorized: counts[3],
      awaitingHandover,
      criticalOpen,
      releasedToday,
      collection,
      bookings,
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
