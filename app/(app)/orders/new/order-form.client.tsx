"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, User, Phone, CheckCircle2, UserCheck, X, ChevronDown, ChevronRight, ChevronsUpDown, RotateCcw } from "lucide-react";
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
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (catKey: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catKey)) {
        next.delete(catKey);
      } else {
        next.add(catKey);
      }
      return next;
    });
  };

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

  const effectiveTests = useMemo(() => {
    const base = new Set([...coveredByPanels, ...selectedTests]);
    const expanded = expandDerivedInputs(Array.from(base), tests);
    return new Set(expanded);
  }, [coveredByPanels, selectedTests, tests]);

  const extraTestIds = useMemo(
    () => Array.from(selectedTests).filter((id) => !coveredByPanels.has(id)),
    [selectedTests, coveredByPanels]
  );

  const totalCharge = useMemo(
    () => computeOrderCharge(panels, tests, Array.from(selectedPanels), extraTestIds),
    [panels, tests, selectedPanels, extraTestIds]
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

  function togglePanel(id: string) {
    const next = new Set(selectedPanels);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPanels(next);
  }

  function toggleTest(id: string) {
    const next = new Set(selectedTests);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    const expanded = expandDerivedInputs(Array.from(next), tests);
    setSelectedTests(new Set(expanded));
  }

  async function submit() {
    if (!patientId) {
      const message = "Select a patient before creating the order.";
      setError(message);
      return { ok: false as const, error: message };
    }
    if (effectiveTests.size === 0 && selectedPanels.size === 0) {
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

  const allCategoryKeys = useMemo(
    () => (visiblePanels.length > 0 ? ["PACKAGES", ...testGroups] : testGroups),
    [visiblePanels.length, testGroups]
  );
  const allCollapsed = allCategoryKeys.length > 0 && allCategoryKeys.every((cat) => collapsedCategories.has(cat));

  const toggleAllCategories = () => {
    if (allCollapsed) {
      setCollapsedCategories(new Set());
    } else {
      setCollapsedCategories(new Set(allCategoryKeys));
    }
  };

  const clearAllSelections = () => {
    setSelectedPanels(new Set());
    setSelectedTests(new Set());
  };

  return (
    <div className="flex flex-col gap-6">
      {!onSubmitOrder ? (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/40">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
                <User className="size-4 text-primary" />
                Patient Selection
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Search by name, MRN, or phone to assign a patient, or register a new patient.
              </CardDescription>
            </div>
            <PatientRegisterDialog
              onRegistered={(patient) => {
                setAddedPatients((prev) => [patient, ...prev]);
                setPatientId(patient.id);
                setPatientQuery("");
              }}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            {/* Search & Selector Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8 text-sm"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Filter name, MRN, phone..."
                  aria-label="Search patients"
                />
                {patientQuery && (
                  <button
                    type="button"
                    onClick={() => setPatientQuery("")}
                    className="absolute top-2.5 right-2.5 text-xs text-muted-foreground hover:text-foreground p-0.5 rounded"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <NativeSelect
                id="patient"
                className="w-full text-sm"
                value={patientId}
                onChange={(e) => {
                  setPatientId(e.target.value);
                  setPatientQuery("");
                }}
              >
                <option value="" disabled>
                  {filteredPatients.length === 0 ? "No matching patients" : "Select patient from list..."}
                </option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName ?? ""} — {p.mrn} {p.phone ? `(${p.phone})` : ""}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* Quick Filter Result Pills (when search query is present) */}
            {patientQuery.trim() !== "" && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <span>Matching Patients ({filteredPatients.length})</span>
                  <span className="text-[10px] lowercase text-muted-foreground">Click card to select</span>
                </div>
                {filteredPatients.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No patients match "{patientQuery}". Click "+ Register patient" to create one.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-48 overflow-y-auto pr-1">
                    {filteredPatients.slice(0, 6).map((p) => {
                      const isSelected = p.id === patientId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPatientId(p.id);
                            setPatientQuery("");
                          }}
                          className={cn(
                            "flex flex-col gap-1 rounded-md border p-2.5 text-left text-xs transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 font-medium text-foreground ring-1 ring-primary"
                              : "border-border/60 bg-background hover:bg-muted/60 hover:border-border"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground truncate">
                              {p.firstName} {p.lastName ?? ""}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono shrink-0">
                              {p.mrn}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            {p.gender && <span className="capitalize">{p.gender.toLowerCase()}</span>}
                            {p.ageYears != null && <span>• {p.ageYears} yrs</span>}
                            {p.phone && <span>• {p.phone}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Selected Patient Banner */}
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3.5 sm:p-4 transition-all">
                <div className="flex items-center gap-3.5">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-sm shrink-0">
                    {selectedPatient.firstName[0]}
                    {selectedPatient.lastName ? selectedPatient.lastName[0] : ""}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {selectedPatient.firstName} {selectedPatient.lastName ?? ""}
                      </span>
                      <Badge variant="secondary" className="text-xs font-mono">
                        {selectedPatient.mrn}
                      </Badge>
                      <Badge variant="success" className="text-[10px] py-0 gap-1">
                        <CheckCircle2 className="size-3" />
                        Selected
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {selectedPatient.gender && (
                        <span className="capitalize">{selectedPatient.gender.toLowerCase()}</span>
                      )}
                      {selectedPatient.ageYears != null && <span>{selectedPatient.ageYears} yrs</span>}
                      {selectedPatient.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="size-3 text-muted-foreground" />
                          {selectedPatient.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPatientId("")}
                  className="text-xs text-muted-foreground hover:text-destructive shrink-0"
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border p-3.5 bg-muted/10 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 text-muted-foreground" />
                  <span>No patient selected. Choose a patient from above or register a new one.</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-[320px]">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder="Search tests and packages"
              aria-label="Search tests and packages"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              className="w-full sm:w-52 shrink-0"
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

            {allCategoryKeys.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAllCategories}
                className="h-9 text-xs gap-1.5 shrink-0"
                title={allCollapsed ? "Expand all categories" : "Collapse all categories"}
              >
                <ChevronsUpDown className="size-3.5" />
                {allCollapsed ? "Expand all" : "Collapse all"}
              </Button>
            )}

            {(selectedPanels.size > 0 || selectedTests.size > 0) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAllSelections}
                className="h-9 text-xs gap-1.5 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Deselect all packages and tests"
              >
                <RotateCcw className="size-3.5" />
                Deselect all
              </Button>
            )}
          </div>
        </div>

        {visiblePanels.length > 0 && (() => {
          const isPackagesCollapsed = collapsedCategories.has("PACKAGES") && !catalogQuery.trim();
          const selectedCount = panels.filter((p) => selectedPanels.has(p.id)).length;

          return (
            <Card className="overflow-hidden">
              <CardHeader
                className="flex flex-row items-center justify-between py-3 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                onClick={() => toggleCategory("PACKAGES")}
                role="button"
                tabIndex={0}
                aria-expanded={!isPackagesCollapsed}
                aria-label="Toggle Packages category"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCategory("PACKAGES");
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground transition-transform duration-200">
                    {isPackagesCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                  </span>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide">Packages</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground">
                    {visiblePanels.length} {visiblePanels.length === 1 ? "package" : "packages"}
                  </Badge>
                  {selectedCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      {selectedCount} selected
                    </Badge>
                  )}
                </div>
                {isPackagesCollapsed && (
                  <span className="text-xs text-muted-foreground italic pr-2">Click to expand</span>
                )}
              </CardHeader>
              {!isPackagesCollapsed && (
                <CardContent className="flex flex-col gap-4 pt-0 pb-4 border-t border-border/40 mt-1">
                  {panelGroups.map((cat) => (
                    <div key={cat} className="flex flex-col gap-2 pt-2">
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
                                  ? "border-primary bg-primary/10 font-medium text-foreground ring-1 ring-primary/50"
                                  : "border-border hover:bg-secondary"
                              )}
                            >
                              <span>{panel.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{formatInr(panel.price)}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })()}

        {testGroups.map((cat) => {
          const isCollapsed = collapsedCategories.has(cat) && !catalogQuery.trim();
          const catTests = visibleTests.filter((test) => test.category === cat);
          const catSelectedCount = catTests.filter((t) => effectiveTests.has(t.id)).length;

          return (
            <Card key={cat} className="overflow-hidden">
              <CardHeader
                className="flex flex-row items-center justify-between py-3 cursor-pointer select-none hover:bg-muted/40 transition-colors"
                onClick={() => toggleCategory(cat)}
                role="button"
                tabIndex={0}
                aria-expanded={!isCollapsed}
                aria-label={`Toggle ${cat.replaceAll("_", " ")} category`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCategory(cat);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground transition-transform duration-200">
                    {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                  </span>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide">
                    {cat.replaceAll("_", " ")}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground">
                    {catTests.length} {catTests.length === 1 ? "test" : "tests"}
                  </Badge>
                  {catSelectedCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      {catSelectedCount} selected
                    </Badge>
                  )}
                </div>
                {isCollapsed && (
                  <span className="text-xs text-muted-foreground italic pr-2">Click to expand</span>
                )}
              </CardHeader>
              {!isCollapsed && (
                <CardContent className="flex flex-wrap gap-2 pt-0 pb-4 border-t border-border/40 mt-1">
                  {catTests.map((test) => (
                    <button
                      type="button"
                      key={test.id}
                      onClick={() => toggleTest(test.id)}
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-left text-sm transition-colors",
                        effectiveTests.has(test.id)
                          ? "border-primary bg-primary/10 font-medium text-foreground ring-1 ring-primary/50"
                          : "border-border hover:bg-secondary"
                      )}
                    >
                      <span>{test.name}</span>
                      {test.isDerived ? <span className="ml-1 text-[10px] text-muted-foreground">(calc.)</span> : null}
                      <span className="ml-2 text-xs text-muted-foreground">{formatInr(test.price)}</span>
                    </button>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basket</p>
              {(selectedPanels.size > 0 || selectedTests.size > 0) && (
                <button
                  type="button"
                  onClick={clearAllSelections}
                  className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                  title="Clear all selected items"
                >
                  <RotateCcw className="size-3" />
                  Deselect all
                </button>
              )}
            </div>
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
