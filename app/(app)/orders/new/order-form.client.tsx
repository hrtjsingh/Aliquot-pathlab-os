"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PatientRegisterDialog } from "@/app/(app)/patients/patient-register-dialog";
import { useDataSync } from "@/components/data-sync";
import { createOrder } from "@/app/actions/orders";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { computeOrderCharge } from "@/lib/order-pricing";
import { expandDerivedInputs } from "@/lib/test-deps";
import { asMoney, dueAmount, formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";

type Panel = { id: string; code: string; name: string; category: string; price: number; testIds: string[] };
type Test = {
  id: string;
  code: string;
  name: string;
  category: string;
  isDerived: boolean;
  price: number;
  derivationRule: string | null;
  unit: string | null;
};
type Patient = {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string | null;
  phone?: string | null;
  ageYears?: number | null;
  gender?: string;
};

function matchesQuery(haystack: string, query: string) {
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

export function OrderForm({
  patients: initialPatients,
  panels,
  tests,
  initialPatientId,
  initialTestIds,
  initialPanelIds,
  initialDoctor,
  initialDiscount,
  initialPaid,
  submitLabel = "Create order and accession",
  onSubmitOrder,
}: {
  patients: Patient[];
  panels: Panel[];
  tests: Test[];
  initialPatientId?: string;
  initialTestIds?: string[];
  initialPanelIds?: string[];
  initialDoctor?: string;
  initialDiscount?: number;
  initialPaid?: number;
  submitLabel?: string;
  onSubmitOrder?: (payload: {
    patientId: string;
    referringDoctor: string;
    priority: "ROUTINE" | "URGENT" | "STAT";
    testIds: string[];
    panelIds: string[];
    discount: number;
    amountPaid: number;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const { patchSnapshot } = useDataSync();
  const [addedPatients, setAddedPatients] = useState<Patient[]>([]);
  const patients = useMemo(() => {
    const ids = new Set(initialPatients.map((patient) => patient.id));
    return [...initialPatients, ...addedPatients.filter((patient) => !ids.has(patient.id))];
  }, [initialPatients, addedPatients]);
  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const [patientQuery, setPatientQuery] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set(initialPanelIds ?? []));
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set(initialTestIds ?? []));
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "STAT">("ROUTINE");
  const [referringDoctor, setReferringDoctor] = useState(initialDoctor ?? "Dr. SELF");
  const [discount, setDiscount] = useState(String(initialDiscount ?? 0));
  const [amountPaid, setAmountPaid] = useState(String(initialPaid ?? 0));
  const [error, setError] = useState<string | null>(null);

  const selectedPatient = patients.find((p) => p.id === patientId);
  const categories = useMemo(
    () => Array.from(new Set([...panels.map((p) => p.category), ...tests.map((t) => t.category)])).sort(),
    [panels, tests]
  );

  const coveredByPanels = useMemo(() => {
    const ids = new Set<string>();
    for (const panel of panels) {
      if (selectedPanels.has(panel.id)) (panel.testIds ?? []).forEach((id) => ids.add(id));
    }
    return ids;
  }, [panels, selectedPanels]);

  const extraTestIds = useMemo(
    () => Array.from(selectedTests).filter((id) => !coveredByPanels.has(id)),
    [selectedTests, coveredByPanels]
  );

  const totalCharge = useMemo(
    () => computeOrderCharge(panels, tests, Array.from(selectedPanels), Array.from(selectedTests)),
    [panels, tests, selectedPanels, selectedTests]
  );
  const discountValue = asMoney(discount);
  const paidValue = asMoney(amountPaid);
  const due = dueAmount(totalCharge, discountValue, paidValue);

  const filteredPatients = patients.filter((patient) => {
    if (!patientQuery.trim()) return true;
    return matchesQuery(
      `${patient.firstName} ${patient.lastName ?? ""} ${patient.mrn} ${patient.phone ?? ""}`,
      patientQuery
    );
  });

  const visiblePanels = panels.filter((panel) => {
    if (categoryFilter !== "ALL" && panel.category !== categoryFilter) return false;
    if (!catalogQuery.trim()) return true;
    return matchesQuery(`${panel.name} ${panel.code} ${panel.category}`, catalogQuery);
  });

  const visibleTests = tests.filter((test) => {
    if (categoryFilter !== "ALL" && test.category !== categoryFilter) return false;
    if (!catalogQuery.trim()) return true;
    return matchesQuery(`${test.name} ${test.code} ${test.category}`, catalogQuery);
  });

  function applyExpanded(nextTests: Set<string>, extraIds: string[] = []) {
    const expanded = expandDerivedInputs([...nextTests, ...extraIds], tests);
    setSelectedTests(new Set(expanded));
  }

  function togglePanel(id: string) {
    const next = new Set(selectedPanels);
    const panel = panels.find((row) => row.id === id);
    if (next.has(id)) {
      next.delete(id);
      setSelectedPanels(next);
      return;
    }
    next.add(id);
    setSelectedPanels(next);
    applyExpanded(selectedTests, panel?.testIds ?? []);
  }

  function toggleTest(id: string) {
    const next = new Set(selectedTests);
    if (next.has(id)) {
      next.delete(id);
      setSelectedTests(next);
      return;
    }
    next.add(id);
    applyExpanded(next);
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
    const payload = {
      patientId,
      referringDoctor,
      priority,
      testIds: extraTestIds,
      panelIds: Array.from(selectedPanels),
      discount: discountValue,
      amountPaid: paidValue,
    };
    const patientName = selectedPatient
      ? `${selectedPatient.firstName} ${selectedPatient.lastName ?? ""}`.trim()
      : "Patient";

    if (onSubmitOrder) {
      const result = await onSubmitOrder(payload);
      if (!result.ok) setError(result.error);
      return result;
    }

    async function rememberOrder(orderId: string, accessionNo: string) {
      await patchSnapshot((snapshot) => ({
        ...snapshot,
        worklist: [
          {
            id: orderId,
            accessionNo,
            status: "ORDER_CREATED",
            priority,
            patient: {
              firstName: selectedPatient?.firstName ?? "Patient",
              lastName: selectedPatient?.lastName ?? null,
              phone: selectedPatient?.phone ?? null,
            },
            testCount: extraTestIds.length + selectedPanels.size,
          },
          ...snapshot.worklist.filter((order) => order.id !== orderId),
        ],
        dashboard: {
          ...snapshot.dashboard,
          collection: {
            count: (snapshot.dashboard.collection?.count ?? 0) + 1,
            total: (snapshot.dashboard.collection?.total ?? 0) + totalCharge,
            discount: (snapshot.dashboard.collection?.discount ?? 0) + discountValue,
            paid: (snapshot.dashboard.collection?.paid ?? 0) + paidValue,
            due: (snapshot.dashboard.collection?.due ?? 0) + due,
          },
          bookings: [
            {
              id: orderId,
              accessionNo,
              createdAt: new Date().toISOString(),
              status: "ORDER_CREATED",
              priority,
              patientName,
              phone: selectedPatient?.phone ?? null,
              ageYears: selectedPatient?.ageYears ?? null,
              gender: selectedPatient?.gender ?? "",
              totalCharge,
              discount: discountValue,
              amountPaid: paidValue,
              due,
            },
            ...(snapshot.dashboard.bookings ?? []).filter((order) => order.id !== orderId),
          ].slice(0, 250),
          recent: [
            { id: orderId, accessionNo, status: "ORDER_CREATED", priority, patientName },
            ...snapshot.dashboard.recent.filter((order) => order.id !== orderId),
          ].slice(0, 8),
        },
      }));
    }

    if (isBrowserOffline()) {
      await enqueueOp({ type: "createOrder", params: payload });
      toast.success("Order queued. Tap Sync when you’re back online to assign an accession.");
      return { ok: true as const, orderId: "", accessionNo: "queued" };
    }

    try {
      const result = await createOrder(payload);
      if (!result.ok) {
        setError(result.error);
        return result;
      }
      toast.success(`Order created. Accession ${result.accessionNo}.`);
      await rememberOrder(result.orderId, result.accessionNo);
      router.push(`/orders/${result.orderId}`);
      return result;
    } catch (error) {
      if (isNetworkError(error)) {
        await enqueueOp({ type: "createOrder", params: payload });
        toast.success("Order queued. Tap Sync when you’re back online to assign an accession.");
        return { ok: true as const, orderId: "", accessionNo: "queued" };
      }
      const message = error instanceof Error ? error.message : "Could not create this order.";
      setError(message);
      return { ok: false as const, error: message };
    }
  }

  const panelGroups = Array.from(new Set(visiblePanels.map((panel) => panel.category)));
  const testGroups = Array.from(new Set(visibleTests.map((test) => test.category)));

  return (
    <div className="flex flex-col gap-6">
      {!onSubmitOrder ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="patient">Patient</Label>
            <PatientRegisterDialog
              onRegistered={(patient) => {
                setAddedPatients((prev) => [patient, ...prev]);
                setPatientId(patient.id);
              }}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-[2] sm:min-w-[400px]">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="pl-8"
                value={patientQuery}
                onChange={(e) => setPatientQuery(e.target.value)}
                placeholder="Search name, MRN, or phone"
                aria-label="Search patients"
              />
            </div>
            <NativeSelect
              id="patient"
              className="w-full min-w-0 sm:min-w-[12rem] flex-1"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="" disabled>
                {filteredPatients.length === 0 ? "No matching patients" : "Select patient"}
              </option>
              {filteredPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} — {p.mrn}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-[400px]">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder="Search tests and packages"
              aria-label="Search tests and packages"
            />
          </div>
          <NativeSelect
            className="w-full sm:w-56 sm:shrink-0"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="ALL">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Packages</CardTitle>
            <CardDescription>Package charge is used instead of summing member tests.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {visiblePanels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No packages match this search.</p>
            ) : (
              panelGroups.map((cat) => (
                <div key={cat} className="flex flex-col gap-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground">{cat.replaceAll("_", " ")}</p>
                  <div className="flex flex-wrap gap-2">
                    {visiblePanels
                      .filter((panel) => panel.category === cat)
                      .map((panel) => (
                        <button
                          type="button"
                          key={panel.id}
                          onClick={() => togglePanel(panel.id)}
                          className={cn(
                            "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
                            selectedPanels.has(panel.id)
                              ? "border-accent bg-accent/10 font-medium text-foreground"
                              : "border-border hover:bg-secondary"
                          )}
                        >
                          <span>{panel.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{formatInr(panel.price)}</span>
                        </button>
                      ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {testGroups.map((cat) => (
          <Card key={cat}>
            <CardHeader>
              <CardTitle>{cat.replaceAll("_", " ")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {visibleTests
                .filter((test) => test.category === cat)
                .map((test) => (
                  <button
                    type="button"
                    key={test.id}
                    onClick={() => toggleTest(test.id)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
                      selectedTests.has(test.id) || coveredByPanels.has(test.id)
                        ? "border-accent bg-accent/10 font-medium text-foreground"
                        : "border-border hover:bg-secondary"
                    )}
                  >
                    <span>{test.name}</span>
                    {test.isDerived ? <span className="ml-1 text-[10px] text-muted-foreground">auto</span> : null}
                    <span className="ml-2 text-xs text-muted-foreground">{formatInr(test.price)}</span>
                  </button>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle>{onSubmitOrder ? "Update bill" : "Order details"}</CardTitle>
          <CardDescription>Review the basket, discount, and paid amount before confirming.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!onSubmitOrder ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="priority">Priority</Label>
              <NativeSelect id="priority" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
                <option value="STAT">STAT</option>
              </NativeSelect>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referringDoctor">Referring doctor</Label>
            <Input
              id="referringDoctor"
              value={referringDoctor}
              onChange={(e) => setReferringDoctor(e.target.value)}
              placeholder="Dr. SELF"
            />
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
            <p className="text-xs font-medium">Basket</p>
            {Array.from(selectedPanels).map((id) => {
              const panel = panels.find((row) => row.id === id);
              if (!panel) return null;
              return (
                <div key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{panel.name}</span>
                  <span className="tabular">{formatInr(panel.price)}</span>
                </div>
              );
            })}
            {extraTestIds.map((id) => {
              const test = tests.find((row) => row.id === id);
              if (!test) return null;
              return (
                <div key={id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {test.name}
                    {test.isDerived ? <Badge className="ml-1" variant="outline">auto</Badge> : null}
                  </span>
                  <span className="tabular">{formatInr(test.price)}</span>
                </div>
              );
            })}
            {selectedPanels.size === 0 && extraTestIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tests selected yet.</p>
            ) : null}
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-sm font-medium">
              <span>Total</span>
              <span className="tabular">{formatInr(totalCharge)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="discount">Discount</Label>
              <Input id="discount" numeric="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amountPaid">Paid</Label>
              <Input id="amountPaid" numeric="decimal" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
          </div>
          <div className={cn("flex justify-between text-sm font-semibold", due > 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
            <span>Due</span>
            <span className="tabular">{formatInr(due)}</span>
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <ConfirmDialog
            title={onSubmitOrder ? "Save these tests?" : "Create this order?"}
            description={
              onSubmitOrder
                ? `Charge ${formatInr(totalCharge)}. Due ${formatInr(due)}.`
                : selectedPatient
                  ? `Accession for ${selectedPatient.firstName} ${selectedPatient.lastName ?? ""} (${selectedPatient.mrn}). Charge ${formatInr(totalCharge)}, due ${formatInr(due)}.`
                  : "Select a patient, then confirm to generate an accession number."
            }
            confirmLabel={onSubmitOrder ? "Save tests" : "Create accession"}
            trigger={
              <Button className="mt-1 w-full" type="button">
                {submitLabel}
              </Button>
            }
            onConfirm={submit}
          />
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
