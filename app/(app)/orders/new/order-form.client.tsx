"use client";

import { useMemo, useState, useRef } from "react";
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
import { PatientEditDialog } from "@/app/(app)/patients/patient-edit-dialog";
import { useDataSync } from "@/components/data-sync";
import { createOrder } from "@/app/actions/orders";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { computeOrderCharge } from "@/lib/order-pricing";
import { expandDerivedInputs, expandPanelBundles } from "@/lib/test-deps";
import { asMoney, dueAmount, formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";
import { compareByPrintOrder, uniqueCategoriesInPrintOrder } from "@/lib/test-order";
import { openBillPopupPlaceholder, showBillInPopup } from "@/lib/open-bill-popup";

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
  sortOrder?: number;
  hideOnBooking?: boolean;
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

function getTestSearchScore(test: { name: string; code: string; category: string }, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 0;
  const nameLower = test.name.toLowerCase();
  const codeLower = test.code.toLowerCase();

  // 1. Code starts with query (e.g. CBC, TSH)
  if (codeLower.startsWith(q)) return 100;

  // 2. Test Name starts with query (e.g. Calcium, Cholesterol)
  if (nameLower.startsWith(q)) return 90;

  // 3. Any word in Test Name starts with query (e.g. Complete [B]lood Count)
  const words = nameLower.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 80;

  // 4. Code contains query
  if (codeLower.includes(q)) return 70;

  // 5. Test Name contains query substring
  if (nameLower.includes(q)) return 60;

  // 6. Category contains query
  if (test.category.toLowerCase().includes(q)) return 10;

  return 0;
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
  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const patients = useMemo(() => {
    const ids = new Set(initialPatients.map((patient) => patient.id));
    return [...initialPatients, ...addedPatients.filter((patient) => !ids.has(patient.id))];
  }, [initialPatients, addedPatients]);
  const patientSearchInputRef = useRef<HTMLInputElement>(null);
  const catalogSearchInputRef = useRef<HTMLInputElement>(null);
  const priorityInputRef = useRef<HTMLSelectElement>(null);
  const referringDoctorInputRef = useRef<HTMLInputElement>(null);

  const focusOrderDetails = () => {
    if (priorityInputRef.current) {
      priorityInputRef.current.focus();
    } else if (referringDoctorInputRef.current) {
      referringDoctorInputRef.current.focus();
    }
  };

  const selectPatient = (p: Patient) => {
    setPatientId(p.id);
    setPatientQuery("");
    setPatientHighlightedIndex(0);
    toast.success(`Selected patient: ${p.firstName} ${p.lastName ?? ""} (${p.mrn})`);
    setTimeout(() => {
      catalogSearchInputRef.current?.focus();
    }, 50);
  };
  const [patientQuery, setPatientQuery] = useState("");
  const [patientHighlightedIndex, setPatientHighlightedIndex] = useState(0);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [searchHighlightedIndex, setSearchHighlightedIndex] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedPanels, setSelectedPanels] = useState<Set<string>>(new Set(initialPanelIds ?? []));
  const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set(initialTestIds ?? []));
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "STAT">("ROUTINE");
  const [referringDoctor, setReferringDoctor] = useState(initialDoctor ?? "SELF");
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
    () => uniqueCategoriesInPrintOrder([...panels, ...tests]),
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
    const bundled = expandPanelBundles(Array.from(base), tests, panels);
    const expanded = expandDerivedInputs(bundled, tests);
    return new Set(expanded);
  }, [coveredByPanels, selectedTests, tests, panels]);

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

type SearchCatalogItem =
  | { kind: "PANEL"; id: string; code: string; name: string; category: string; price: number }
  | { kind: "TEST"; id: string; code: string; name: string; category: string; price: number; isDerived: boolean };

  const visiblePanels = panels.filter((panel) => {
    if (categoryFilter !== "ALL" && panel.category !== categoryFilter) return false;
    return true;
  });

  const visibleTests = tests
    .filter((test) => {
      if (test.hideOnBooking && !selectedTests.has(test.id)) return false;
      if (categoryFilter !== "ALL" && test.category !== categoryFilter) return false;
      return true;
    })
    .slice()
    .sort(compareByPrintOrder);

  const visibleCatalogItems = useMemo(() => {
    const q = catalogQuery.trim();
    if (!q) return [];

    const panelItems: SearchCatalogItem[] = panels
      .filter((p) => categoryFilter === "ALL" || p.category === categoryFilter)
      .map((p) => ({ kind: "PANEL", id: p.id, code: p.code, name: p.name, category: p.category, price: p.price }));

    const testItems: SearchCatalogItem[] = tests
      .filter((t) => !t.hideOnBooking && (categoryFilter === "ALL" || t.category === categoryFilter))
      .map((t) => ({ kind: "TEST", id: t.id, code: t.code, name: t.name, category: t.category, price: t.price, isDerived: t.isDerived }));

    return [...panelItems, ...testItems]
      .filter((item) => getTestSearchScore(item, q) > 0)
      .sort((a, b) => {
        const scoreA = getTestSearchScore(a, q);
        const scoreB = getTestSearchScore(b, q);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.name.localeCompare(b.name);
      });
  }, [panels, tests, categoryFilter, catalogQuery]);

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

    const billPopup = openBillPopupPlaceholder();
    try {
      const result = await createOrder(payload);
      if (!result.ok) {
        billPopup?.close();
        setError(result.error);
        return result;
      }
      toast.success(`Order created. Accession ${result.accessionNo}.`);
      await rememberOrder(result.orderId, result.accessionNo);
      showBillInPopup(billPopup, result.orderId);
      router.push(`/orders/${result.orderId}`);
      return result;
    } catch (error) {
      billPopup?.close();
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

  const panelGroups = uniqueCategoriesInPrintOrder(visiblePanels);
  const testGroups = uniqueCategoriesInPrintOrder(visibleTests);

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
              triggerTabIndex={-1}
              onRegistered={(patient) => {
                setAddedPatients((prev) => [patient, ...prev]);
                selectPatient(patient);
              }}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            {/* Search & Selector Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  ref={patientSearchInputRef}
                  className="pl-8 text-sm"
                  value={patientQuery}
                  onChange={(e) => {
                    setPatientQuery(e.target.value);
                    setPatientHighlightedIndex(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Tab" && !e.shiftKey) {
                      e.preventDefault();
                      catalogSearchInputRef.current?.focus();
                      return;
                    }
                    if (patientQuery.trim() === "" || filteredPatients.length === 0) return;

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setPatientHighlightedIndex((prev) => Math.min(prev + 1, filteredPatients.length - 1));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setPatientHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      const targetIndex = patientHighlightedIndex < filteredPatients.length ? patientHighlightedIndex : 0;
                      const p = filteredPatients[targetIndex];
                      if (p) {
                        selectPatient(p);
                      }
                    } else if (e.key === "Escape") {
                      setPatientQuery("");
                      setPatientHighlightedIndex(0);
                    }
                  }}
                  placeholder="Filter name, MRN, phone (↑ ↓ navigate, Enter select)..."
                  aria-label="Search patients"
                />
                {patientQuery && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => {
                      setPatientQuery("");
                      setPatientHighlightedIndex(0);
                    }}
                    className="absolute top-2.5 right-2.5 text-xs text-muted-foreground hover:text-foreground p-0.5 rounded"
                  >
                    <X className="size-3.5" />
                  </button>
                )}

                {/* Patient Live Autocomplete Overlay Dropdown */}
                {patientQuery.trim() !== "" && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 flex flex-col rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden">
                    <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Matching Patients ({filteredPatients.length})</span>
                      <span className="text-[10px] lowercase text-muted-foreground">↑ ↓ navigate · Enter select · Esc close</span>
                    </div>
                    {filteredPatients.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground italic text-center">
                        No patients match "{patientQuery}". Click "+ Register patient" to create one.
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                        {filteredPatients.map((p, index) => {
                          const isSelected = p.id === patientId;
                          const isHighlighted = patientHighlightedIndex === index;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              tabIndex={-1}
                              ref={(el) => {
                                if (isHighlighted && el) {
                                  el.scrollIntoView({ block: "nearest" });
                                }
                              }}
                              onMouseEnter={() => setPatientHighlightedIndex(index)}
                              onClick={() => {
                                selectPatient(p);
                              }}
                              className={cn(
                                "flex items-center justify-between w-full px-3 py-2 text-left text-xs transition-colors",
                                isHighlighted
                                  ? "bg-accent text-accent-foreground font-medium ring-1 ring-inset ring-primary/40"
                                  : "hover:bg-accent/40",
                                isSelected && !isHighlighted && "bg-primary/10 font-medium"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-foreground truncate">{p.firstName} {p.lastName ?? ""}</span>
                                <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono shrink-0">
                                  {p.mrn}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-muted-foreground text-[11px]">
                                {p.gender && <span className="capitalize">{p.gender.toLowerCase()}</span>}
                                {p.ageYears != null && <span>• {p.ageYears}y</span>}
                                {p.phone && <span>• {p.phone}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <NativeSelect
                id="patient"
                tabIndex={-1}
                className="w-full text-sm"
                value={patientId}
                onChange={(e) => {
                  const targetId = e.target.value;
                  const p = patients.find((pat) => pat.id === targetId);
                  if (p) selectPatient(p);
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
                <div className="flex items-center gap-1.5 shrink-0">
                  <PatientEditDialog
                    triggerTabIndex={-1}
                    patient={selectedPatient}
                    onUpdated={(updated) => {
                      const item: Patient = {
                        id: updated.id,
                        mrn: updated.mrn,
                        firstName: updated.firstName,
                        lastName: updated.lastName ?? null,
                        phone: updated.phone ?? null,
                        ageYears: updated.ageYears ?? null,
                        gender: updated.gender ?? "",
                      };
                      setAddedPatients((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
                    }}
                  />
                  <Button
                    type="button"
                    tabIndex={-1}
                    variant="ghost"
                    size="sm"
                    onClick={() => setPatientId("")}
                    className="h-8 text-xs text-muted-foreground hover:text-destructive shrink-0"
                  >
                    Change
                  </Button>
                </div>
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

        {/* Quick Add Shortcut Pills for Frequent Pathology Tests */}
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-secondary/30 p-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>⚡ Quick-Add Frequent Tests</span>
            <span className="text-[10px] text-muted-foreground lowercase">Click pill to add/remove</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "CBC", match: "CBC" },
              { label: "LFT", match: "LFT" },
              { label: "KFT", match: "KFT" },
              { label: "Lipid Profile", match: "LIPID" },
              { label: "TSH", match: "TSH" },
              { label: "HbA1c", match: "HBA1C" },
              { label: "Urine Routine", match: "URINE" },
              { label: "Fasting Blood Sugar", match: "GLUCOSE" },
            ].map((pill) => {
              const matchedPanel = panels.find((p) => p.code.includes(pill.match) || p.name.toUpperCase().includes(pill.match));
              const matchedTest = tests.find((t) => t.code.includes(pill.match) || t.name.toUpperCase().includes(pill.match));
              const targetItem = matchedPanel ?? matchedTest;
              if (!targetItem) return null;
              const isSelected = matchedPanel ? selectedPanels.has(targetItem.id) : selectedTests.has(targetItem.id);

              return (
                <button
                  type="button"
                  tabIndex={-1}
                  key={pill.label}
                  onClick={() => {
                    if (matchedPanel) {
                      togglePanel(targetItem.id);
                    } else {
                      toggleTest(targetItem.id);
                    }
                  }}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-150",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "border-border bg-background hover:bg-secondary text-foreground"
                  )}
                >
                  {isSelected ? "✓ " : "+ "}
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:min-w-[320px]">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              ref={catalogSearchInputRef}
              className="pl-8 text-sm"
              value={catalogQuery}
              onChange={(e) => {
                setCatalogQuery(e.target.value);
                setSearchHighlightedIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  if (e.shiftKey) {
                    patientSearchInputRef.current?.focus();
                  } else {
                    focusOrderDetails();
                  }
                  return;
                }
                if (catalogQuery.trim() === "" || visibleCatalogItems.length === 0) return;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSearchHighlightedIndex((prev) => Math.min(prev + 1, visibleCatalogItems.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchHighlightedIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const targetIndex = searchHighlightedIndex < visibleCatalogItems.length ? searchHighlightedIndex : 0;
                  const item = visibleCatalogItems[targetIndex];
                  if (item) {
                    if (item.kind === "PANEL") {
                      togglePanel(item.id);
                    } else {
                      toggleTest(item.id);
                    }
                    setCatalogQuery("");
                    setSearchHighlightedIndex(0);
                    toast.success(`Added ${item.name} to basket.`);
                  }
                } else if (e.key === "Escape") {
                  setCatalogQuery("");
                  setSearchHighlightedIndex(0);
                }
              }}
              placeholder="Search test or package name/code (↑ ↓ navigate, Enter add)..."
              aria-label="Search tests and packages"
            />
            {catalogQuery.trim() !== "" && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => {
                  setCatalogQuery("");
                  setSearchHighlightedIndex(0);
                }}
                className="absolute top-2.5 right-2.5 text-xs text-muted-foreground hover:text-foreground p-0.5 rounded"
              >
                <X className="size-3.5" />
              </button>
            )}

            {/* PRASKO-Style Live Autocomplete Search Dropdown with Arrow Key Navigation */}
            {catalogQuery.trim() !== "" && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 flex flex-col rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <span>Matching Tests & Packages ({visibleCatalogItems.length})</span>
                  <span className="text-[10px] lowercase text-muted-foreground">↑ ↓ navigate · Enter to add · Esc close</span>
                </div>
                {visibleCatalogItems.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground italic text-center">
                    No tests or packages match "{catalogQuery}". Check spelling or short code.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                    {visibleCatalogItems.map((item, index) => {
                      const isSelected = item.kind === "PANEL" ? selectedPanels.has(item.id) : effectiveTests.has(item.id);
                      const isHighlighted = searchHighlightedIndex === index;
                      return (
                        <button
                          key={`${item.kind}-${item.id}`}
                          type="button"
                          tabIndex={-1}
                          ref={(el) => {
                            if (isHighlighted && el) {
                              el.scrollIntoView({ block: "nearest" });
                            }
                          }}
                          onMouseEnter={() => setSearchHighlightedIndex(index)}
                          onClick={() => {
                            if (item.kind === "PANEL") {
                              togglePanel(item.id);
                            } else {
                              toggleTest(item.id);
                            }
                            setCatalogQuery("");
                            setSearchHighlightedIndex(0);
                          }}
                          className={cn(
                            "flex items-center justify-between w-full px-3 py-2 text-left text-xs transition-colors",
                            isHighlighted
                              ? "bg-accent text-accent-foreground font-medium ring-1 ring-inset ring-primary/40"
                              : "hover:bg-accent/40",
                            isSelected && !isHighlighted && "bg-primary/10 font-medium"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-foreground truncate text-xs">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="font-medium text-foreground">{formatInr(item.price)}</span>
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", isSelected ? "bg-emerald-600 text-white" : isHighlighted ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground")}>
                              {isSelected ? "✓ Added" : "+ Add"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              tabIndex={-1}
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
                tabIndex={-1}
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
                tabIndex={-1}
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
                tabIndex={-1}
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
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((panel) => (
                            <button
                              type="button"
                              tabIndex={-1}
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
                tabIndex={-1}
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
                      tabIndex={-1}
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
              <NativeSelect
                id="priority"
                ref={priorityInputRef}
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
                onKeyDown={(e) => {
                  if (e.key === "Tab" && e.shiftKey) {
                    e.preventDefault();
                    catalogSearchInputRef.current?.focus();
                  }
                }}
              >
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
              ref={referringDoctorInputRef}
              value={referringDoctor}
              onChange={(e) => setReferringDoctor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab" && e.shiftKey && !priorityInputRef.current) {
                  e.preventDefault();
                  catalogSearchInputRef.current?.focus();
                }
              }}
              placeholder="SELF"
            />
          </div>

          <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Basket</p>
              {(selectedPanels.size > 0 || selectedTests.size > 0) && (
                <button
                  type="button"
                  tabIndex={-1}
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
                <div key={id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border/40 last:border-b-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => togglePanel(id)}
                      className="text-muted-foreground hover:text-destructive p-0.5 rounded shrink-0"
                      title="Remove package"
                    >
                      <X className="size-3.5" />
                    </button>
                    <span className="truncate">{panel.name}</span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0 font-mono">PKG</Badge>
                  </div>
                  <span className="tabular font-medium text-xs">{formatInr(panel.price)}</span>
                </div>
              );
            })}
            {extraTestIds.map((id) => {
              const test = tests.find((row) => row.id === id);
              if (!test) return null;
              return (
                <div key={id} className="flex items-center justify-between gap-2 text-sm py-1 border-b border-border/40 last:border-b-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => toggleTest(id)}
                      className="text-muted-foreground hover:text-destructive p-0.5 rounded shrink-0"
                      title="Remove test"
                    >
                      <X className="size-3.5" />
                    </button>
                    <span className="truncate">{test.name}</span>
                    {test.isDerived ? <Badge className="ml-1 text-[9px] py-0 px-1" variant="outline">auto</Badge> : null}
                  </div>
                  <span className="tabular font-medium text-xs">{formatInr(test.price)}</span>
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
