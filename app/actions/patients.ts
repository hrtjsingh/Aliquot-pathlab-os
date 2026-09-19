"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant, requireWritableLab } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { genderFromTitle, titledGivenName, stripTitlePrefix } from "@/lib/patient-name";
import { asMoney } from "@/lib/money";
import { isCustomerVisibleReport } from "@/lib/workflow";

const PatientSchema = z.object({
  title: z.string().optional(),
  mrn: z.string().optional(),
  firstName: z.string().min(1, "Name is required."),
  lastName: z.string().optional(),
  ageYears: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(130, "Enter a valid age.")
  ),
  ageMonths: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(11).optional()
  ),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  isPregnant: z.boolean().optional(),
  pregnancyWeeks: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(1).max(45).optional()
  ),
  phone: z.string().optional(),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : typeof value === "string" ? value.trim() : value),
    z.string().email("Enter a valid email.").optional()
  ),
  address: z.string().optional(),
});

async function nextMrn(vendorId: string): Promise<string> {
  const today = new Date();
  const prefix = `P${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const countToday = await prisma.patient.count({
    where: {
      vendorId,
      createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
    },
  });
  return `${prefix}-${String(countToday + 1).padStart(4, "0")}`;
}

export async function createPatient(formData: FormData) {
  const user = await requireWritableLab();

  const raw = Object.fromEntries(formData.entries());
  const parsed = PatientSchema.safeParse({
    ...raw,
    isPregnant: raw.isPregnant === "on" || raw.isPregnant === "true",
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const data = parsed.data;
  const gender = data.gender ?? genderFromTitle(data.title);
  if (!gender) return { ok: false as const, error: "Select gender." };

  const mrn = data.mrn?.trim() || (await nextMrn(user.vendorId));
  const firstName = titledGivenName(data.title, data.firstName);

  try {
    const patient = await prisma.patient.create({
      data: {
        vendorId: user.vendorId,
        mrn,
        firstName,
        lastName: data.lastName || null,
        dob: null,
        ageYears: data.ageYears,
        ageMonths: data.ageMonths ?? null,
        gender,
        isPregnant: data.isPregnant ?? false,
        pregnancyWeeks: data.pregnancyWeeks ?? null,
        phone: data.phone || null,
        email: data.email || null,
        address: data.address || null,
      },
    });

    await logAudit({ vendorId: user.vendorId, userId: user.userId, action: "PATIENT_REGISTERED", entityType: "Patient", entityId: patient.id, after: patient });
    revalidatePath("/patients");
    revalidatePath("/orders/new");
    return {
      ok: true as const,
      patientId: patient.id,
      mrn: patient.mrn,
      firstName: patient.firstName,
      lastName: patient.lastName,
      ageYears: patient.ageYears,
      gender: patient.gender,
    };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return { ok: false as const, error: "Could not assign a unique MRN. Try again." };
    }
    throw error;
  }
}

export async function searchPatients(query: string) {
  const user = await requireTenant();
  if (!query.trim()) {
    return prisma.patient.findMany({ where: { vendorId: user.vendorId }, orderBy: { createdAt: "desc" }, take: 25 });
  }
  return prisma.patient.findMany({
    where: {
      vendorId: user.vendorId,
      OR: [
        { mrn: { contains: query, mode: "insensitive" } },
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
}

export async function getPatientOrders(patientId: string) {
  const user = await requireTenant();
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, vendorId: user.vendorId },
  });
  if (!patient) return null;

  const orders = await prisma.order.findMany({
    where: { patientId, vendorId: user.vendorId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      accessionNo: true,
      createdAt: true,
      status: true,
      priority: true,
      totalCharge: true,
      discount: true,
      amountPaid: true,
      publicToken: true,
    },
  });

  return {
    patient,
    orders: orders.map((order) => {
      const totalCharge = asMoney(order.totalCharge);
      const discount = asMoney(order.discount);
      const amountPaid = asMoney(order.amountPaid);
      const due = asMoney(totalCharge - discount - amountPaid);
      return {
        id: order.id,
        accessionNo: order.accessionNo,
        createdAt: order.createdAt,
        status: order.status,
        priority: order.priority,
        totalCharge,
        discount,
        amountPaid,
        due,
        reportVisible: isCustomerVisibleReport(order.status),
        publicToken: order.publicToken,
      };
    }),
  };
}

const UpdatePatientSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  firstName: z.string().min(1, "Name is required."),
  lastName: z.string().optional(),
  ageYears: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(130, "Enter a valid age.")
  ),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().optional(),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : typeof value === "string" ? value.trim() : value),
    z.string().email("Enter a valid email.").optional()
  ),
  address: z.string().optional(),
});

export async function updatePatient(formData: FormData) {
  const user = await requireWritableLab();

  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdatePatientSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }
  const data = parsed.data;

  const patient = await prisma.patient.findFirst({
    where: { id: data.id, vendorId: user.vendorId },
  });
  if (!patient) return { ok: false as const, error: "Patient not found." };

  const cleanFirstName = stripTitlePrefix(data.firstName);
  const firstName = data.title ? titledGivenName(data.title, cleanFirstName) : data.firstName;

  const updated = await prisma.patient.update({
    where: { id: data.id },
    data: {
      firstName,
      lastName: data.lastName || null,
      ageYears: data.ageYears ?? null,
      gender: data.gender,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await logAudit({
    vendorId: user.vendorId,
    userId: user.userId,
    action: "PATIENT_UPDATED",
    entityType: "Patient",
    entityId: updated.id,
    after: updated,
  });

  revalidatePath("/patients");
  revalidatePath("/orders/new");
  revalidatePath(`/patients/${updated.id}`);

  return {
    ok: true as const,
    patient: {
      id: updated.id,
      mrn: updated.mrn,
      firstName: updated.firstName,
      lastName: updated.lastName,
      ageYears: updated.ageYears,
      gender: updated.gender,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
    },
  };
}
