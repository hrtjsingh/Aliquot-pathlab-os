"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InstructionAlert } from "@/components/instruction-alert";
import { PatientRegisterDialog } from "@/app/(app)/patients/patient-register-dialog";
import { createOrder } from "@/app/actions/orders";
import { cn } from "@/lib/utils";

type Panel = { id: string; code: string; name: string; category: string };
type Test = { id: string; code: string; name: string; category: string; isDerived: boolean };
type Patient = { id: string; mrn: string; firstName: string; lastName: string | null };

export function OrderForm({
  patients: initialPatients,
  panels,
  tests,
  initialPatientId,
}: {
  patients: Patient[];
  panels: Panel[];
  tests: Test[];
  initialPatientId?: string;
}) {
  const router = useRouter();
  const [patients, setPatients] = useState(initialPatients);
  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set());
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set());
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "STAT">("ROUTINE");
  const [referringDoctor, setReferringDoctor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const orderableTests = tests.filter((t) => !t.isDerived);
  const selectedPatient = patients.find((p) => p.id === patientId);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    next.has(id) ? next.delete(id) : next.add(id);
    setter(next);
  }

  async function submit() {
    if (!patientId) {
      const message = "Select a patient before creating the order.";
      setError(message);
      return { ok: false as const, error: message };
    }
    if (selectedTests.size === 0 && selectedPanels.size === 0) {
      const message = "Select at least one panel or test.";
      setError(message);
      return { ok: false as const, error: message };
    }

    setError(null);
    const result = await createOrder({
      patientId,
      referringDoctor,
      priority,
      testIds: Array.from(selectedTests),
      panelIds: Array.from(selectedPanels),
    });
    if (!result.ok) {
      setError(result.error);
      return result;
    }
    toast.success(`Order created. Accession ${result.accessionNo}.`);
    router.push(`/orders/${result.orderId}`);
    return result;
  }

  const categories = Array.from(new Set(orderableTests.map((t) => t.category)));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <InstructionAlert title="Build the accession">
          Choose a panel for a standard group of tests, or pick individual tests. Calculated values such as eGFR are added automatically later. Confirm the order on the right.
        </InstructionAlert>

        <Card>
          <CardHeader>
            <CardTitle>Panels</CardTitle>
            <CardDescription>Select a panel to include every test in that group.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {panels.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => toggle(selectedPanels, setSelectedPanels, p.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  selectedPanels.has(p.id)
                    ? "border-accent bg-accent/10 font-medium text-foreground"
                    : "border-border hover:bg-secondary"
                )}
              >
                {p.name} <span className="text-xs text-muted-foreground">({p.code})</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {categories.map((cat) => (
          <Card key={cat}>
            <CardHeader>
              <CardTitle>{cat.replaceAll("_", " ")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {orderableTests
                .filter((t) => t.category === cat)
                .map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => toggle(selectedTests, setSelectedTests, t.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      selectedTests.has(t.id)
                        ? "border-accent bg-accent/10 font-medium text-foreground"
                        : "border-border hover:bg-secondary"
                    )}
                  >
                    {t.name}
                  </button>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>

        <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle>Order details</CardTitle>
          <CardDescription>Review the patient, priority, and selected tests, then confirm.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="patient">Patient</Label>
              <PatientRegisterDialog
                onRegistered={(patient) => {
                  setPatients((prev) => [patient, ...prev]);
                  setPatientId(patient.id);
                }}
              />
            </div>
            <NativeSelect id="patient" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="" disabled>
                {patients.length === 0 ? "No patients yet — add one above" : "Select patient"}
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} — {p.mrn}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referringDoctor">Referring doctor</Label>
            <Input
              id="referringDoctor"
              value={referringDoctor}
              onChange={(e) => setReferringDoctor(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Priority</Label>
            <NativeSelect id="priority" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="STAT">STAT</option>
            </NativeSelect>
          </div>

          <div className="flex flex-wrap gap-1 pt-1">
            {Array.from(selectedPanels).map((id) => (
              <Badge key={id} variant="secondary">
                {panels.find((p) => p.id === id)?.code}
              </Badge>
            ))}
            {Array.from(selectedTests).map((id) => (
              <Badge key={id} variant="outline">
                {tests.find((t) => t.id === id)?.code}
              </Badge>
            ))}
            {selectedPanels.size === 0 && selectedTests.size === 0 ? (
              <p className="text-xs text-muted-foreground">No tests selected yet.</p>
            ) : null}
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <ConfirmDialog
            title="Create this order?"
            description={
              selectedPatient
                ? `An accession will be generated for ${selectedPatient.firstName} ${selectedPatient.lastName ?? ""} (${selectedPatient.mrn}) at ${priority} priority.`
                : "Select a patient, then confirm to generate an accession number."
            }
            confirmLabel="Create accession"
            trigger={
              <Button className="mt-1 w-full" type="button">
                Create order and accession
              </Button>
            }
            onConfirm={submit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
