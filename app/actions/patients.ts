"use server";

import { prisma } from "@/lib/prisma";
import { requireTenant, requireWritableLab } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const PatientSchema = z.object({
  mrn: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  dob: z.string().optional(), // yyyy-mm-dd, optional if ageYears supplied
  ageYears: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(130).optional()
  ),
  ageMonths: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(11).optional()
  ),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  isPregnant: z.boolean().optional(),
  pregnancyWeeks: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(1).max(45).optional()
  ),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
});

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

  const patient = await prisma.patient.create({
    data: {
      vendorId: user.vendorId,
      mrn: data.mrn,
      firstName: data.firstName,
      lastName: data.lastName || null,
      dob: data.dob ? new Date(data.dob) : null,
      ageYears: data.ageYears ?? null,
      ageMonths: data.ageMonths ?? null,
      gender: data.gender,
      isPregnant: data.isPregnant ?? false,
      pregnancyWeeks: data.pregnancyWeeks ?? null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
    },
  });

  await logAudit({ vendorId: user.vendorId, userId: user.userId, action: "PATIENT_REGISTERED", entityType: "Patient", entityId: patient.id, after: patient });
  revalidatePath("/patients");
  return {
    ok: true as const,
    patientId: patient.id,
    mrn: patient.mrn,
    firstName: patient.firstName,
    lastName: patient.lastName,
    ageYears: patient.ageYears,
    gender: patient.gender,
  };
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
