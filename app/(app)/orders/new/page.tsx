import { NewOrderView } from "./new-order-view.client";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  return <NewOrderView initialPatientId={patientId} />;
}
