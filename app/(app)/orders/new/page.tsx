import { prisma } from "@/lib/prisma";
import { OrderForm } from "./order-form.client";
import { PageHeader } from "@/components/page-header";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  const [patients, panels, tests] = await Promise.all([
    prisma.patient.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.panel.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.test.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="New order"
        description="Select a patient, add panels or tests, and set priority. An accession number is generated when you confirm."
      />
      <OrderForm patients={patients} panels={panels} tests={tests} initialPatientId={patientId} />
    </div>
  );
}
