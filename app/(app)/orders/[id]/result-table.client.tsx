"use client";

import { Fragment, useMemo, useState, useTransition, useEffect, useRef, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { OrderStatus } from "@prisma/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { saveManualResult, releaseReport } from "@/app/actions/results";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { TestProfileDialog } from "@/app/(app)/admin/tests/test-profile-dialog";
import type { TestProfile } from "@/lib/test-profile";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { previewFlag } from "@/lib/flagging";
import { HandoverActions } from "./handover-actions.client";
import { isCustomerVisibleReport } from "@/lib/workflow";
import { formatNumericValue } from "@/lib/format-result";
import { groupsInPrintOrder } from "@/lib/result-groups";

type OrganismPanelValue = {
  organism?: string;
  colonyCount?: string;
  antibiotics?: Array<{ drug: string; result: string }>;
};

type ResultRow = {
  testId: string;
  code: string;
  name: string;
  category: string;
  groupKey?: string;
  groupLabel?: string;
  groupDescription?: string | null;
  method?: string | null;
  comment?: string | null;
  unit: string | null;
  dataType: string;
  isDerived: boolean;
  decimalPrecision?: number | null;
  numericValue: number | null;
  textValue: string | null;
  organismPanel?: OrganismPanelValue | null;
  grossDescription?: string | null;
  microscopicDescription?: string | null;
  diagnosis?: string | null;
  referenceRangeText: string | null;
  flag: string;
  deltaFlag: boolean;
  status: string | null;
  profile: TestProfile;
};

const FLAG_BADGE: Record<string, { variant: "destructive" | "warning" | "outline" | "secondary"; label: string }> = {
  NORMAL: { variant: "outline", label: "Normal" },
  LOW: { variant: "warning", label: "L" },
  HIGH: { variant: "warning", label: "H" },
  CRITICAL_LOW: { variant: "destructive", label: "CRITICAL L" },
  CRITICAL_HIGH: { variant: "destructive", label: "CRITICAL H" },
  ABNORMAL: { variant: "warning", label: "Abnormal" },
};

const DEFAULT_DRUGS = ["Ampicillin", "Ciprofloxacin", "Gentamicin", "Ceftriaxone"];

function CultureFields({
  row,
  editable,
  pending,
  onSave,
}: {
  row: ResultRow;
  editable: boolean;
  pending: boolean;
  onSave: (panel: OrganismPanelValue) => Promise<void>;
}) {
  const initial = row.organismPanel ?? {};
  const [organism, setOrganism] = useState(initial.organism ?? row.textValue ?? "");
  const [colonyCount, setColonyCount] = useState(initial.colonyCount ?? "");
  const [antibiotics, setAntibiotics] = useState<Array<{ drug: string; result: string }>>(
    initial.antibiotics && initial.antibiotics.length
      ? initial.antibiotics
      : DEFAULT_DRUGS.map((drug) => ({ drug, result: "" }))
  );

  function persist(next: OrganismPanelValue) {
    if (!editable || pending) return;
    void onSave(next);
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <Input
          className="h-8 w-48"
          placeholder="Organism isolated"
          value={organism}
          disabled={!editable || pending}
          onChange={(e) => setOrganism(e.target.value)}
          onBlur={() => persist({ organism, colonyCount, antibiotics })}
        />
        <Input
          className="h-8 w-36"
          placeholder="Colony count"
          value={colonyCount}
          disabled={!editable || pending}
          onChange={(e) => setColonyCount(e.target.value)}
          onBlur={() => persist({ organism, colonyCount, antibiotics })}
        />
      </div>
      <div className="grid gap-1 sm:grid-cols-2">
        {antibiotics.map((rowDrug, index) => (
          <div key={`${rowDrug.drug}-${index}`} className="flex items-center gap-2">
            <Input
              className="h-8 flex-1"
              value={rowDrug.drug}
              disabled={!editable || pending}
              onChange={(e) => {
                const next = antibiotics.map((item, i) => (i === index ? { ...item, drug: e.target.value } : item));
                setAntibiotics(next);
              }}
              onBlur={() => persist({ organism, colonyCount, antibiotics })}
            />
            <select
              className="h-8 rounded-md border bg-background px-2 text-xs"
              value={rowDrug.result}
              disabled={!editable || pending}
              onChange={(e) => {
                const next = antibiotics.map((item, i) => (i === index ? { ...item, result: e.target.value } : item));
                setAntibiotics(next);
                persist({ organism, colonyCount, antibiotics: next });
              }}
            >
              <option value="">—</option>
              <option value="S">S</option>
              <option value="I">I</option>
              <option value="R">R</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ResultTable({
  orderId,
  rows,
  editable,
  status,
  accessionNo,
  phone,
}: {
  orderId: string;
  rows: ResultRow[];
  editable: boolean;
  status?: OrderStatus;
  accessionNo?: string;
  phone?: string | null;
}) {
  const router = useRouter();
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.testId, r.numericValue != null ? String(r.numericValue) : (r.textValue ?? "")]))
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const hasAutoFocusedRef = useRef(false);

  useEffect(() => {
    if (editable && !hasAutoFocusedRef.current && tableRef.current) {
      hasAutoFocusedRef.current = true;
      const timer = setTimeout(() => {
        const firstInput = tableRef.current?.querySelector<HTMLInputElement>('input[data-result-input="true"]:not(:disabled)');
        if (firstInput) {
          firstInput.focus();
          firstInput.select();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [editable]);

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const groups = useMemo(() => {
    const assigned = rows.map((row) => ({
      ...row,
      groupKey: row.groupKey ?? `cat:${row.category}`,
      groupLabel: row.groupLabel ?? row.category.replaceAll("_", " "),
      groupDescription: row.groupDescription ?? null,
    }));
    return groupsInPrintOrder(assigned);
  }, [rows]);

  const [isReleasing, startReleaseTransition] = useTransition();

  function handleReleaseReport() {
    startReleaseTransition(async () => {
      try {
        if (isBrowserOffline()) {
          await enqueueOp({ type: "releaseReport", orderId });
          toast.success("Queued. Will release report when online.");
          router.push(`/orders/${orderId}/report` as never);
          return;
        }
        await releaseReport(orderId);
        toast.success("Report released.");
        router.push(`/orders/${orderId}/report` as never);
      } catch (error) {
        if (isNetworkError(error)) {
          await enqueueOp({ type: "releaseReport", orderId });
          toast.success("Queued. Will release report when online.");
          router.push(`/orders/${orderId}/report` as never);
          return;
        }
        toast.error(error instanceof Error ? error.message : "Could not release report.");
      }
    });
  }

  function focusAdjacentResult(current: HTMLInputElement, direction: 1 | -1) {
    const root = tableRef.current ?? current.closest("table");
    if (!root) return;
    const inputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[data-result-input="true"]:not(:disabled)'));
    const index = inputs.indexOf(current);
    const next = inputs[index + direction];
    if (next) {
      next.focus();
      next.select();
      return;
    }
    if (direction === 1) {
      const releaseBtn = document.querySelector<HTMLButtonElement>('button[data-release-btn="true"]:not(:disabled)');
      if (releaseBtn) {
        releaseBtn.focus();
        return;
      }
    }
    current.blur();
  }

  function onResultKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      focusAdjacentResult(event.currentTarget, event.shiftKey ? -1 : 1);
    }
  }

  function commit(row: ResultRow, raw: string) {
    if (row.isDerived) return;
    const previous = row.numericValue != null ? String(row.numericValue) : (row.textValue ?? "");
    if (raw === previous) return;

    setPendingId(row.testId);
    startTransition(async () => {
      const isNumeric = row.dataType === "NUMERIC";
      const params = {
        orderId,
        testId: row.testId,
        numericValue: isNumeric ? (raw.trim() === "" ? null : Number(raw)) : null,
        textValue: !isNumeric ? raw : null,
        referenceRangeText: row.referenceRangeText,
        organismPanel: row.dataType === "ORGANISM_PANEL" ? row.organismPanel : undefined,
        grossDescription: row.grossDescription ?? undefined,
        microscopicDescription: row.microscopicDescription ?? undefined,
        diagnosis: row.diagnosis ?? undefined,
      };
      try {
        if (isBrowserOffline()) {
          await enqueueOp({ type: "saveManualResult", params });
          toast.success(`${row.name} queued. Will sync when you’re back online.`);
          return;
        }
        await saveManualResult(params);
        toast.success(`${row.name} saved.`);
        router.refresh();
      } catch (error) {
        if (isNetworkError(error)) {
          await enqueueOp({ type: "saveManualResult", params });
          toast.success(`${row.name} queued. Will sync when you’re back online.`);
          return;
        }
        toast.error(error instanceof Error ? error.message : `Could not save ${row.name}.`);
      } finally {
        setPendingId(null);
      }
    });
  }

  const canRelease = editable || status === "SAMPLE_RECEIVED" || status === "RESULT_ENTRY" || status === "AUTHORIZED";
  const canHandover = status ? isCustomerVisibleReport(status) : false;

  return (
    <div className="flex flex-col">
      <Table ref={tableRef}>
      <TableHeader>
        <TableRow>
          <TableHead>Parameter</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Unit</TableHead>
          <TableHead>Reference range</TableHead>
          <TableHead>Flag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const isCollapsed = collapsedCategories.has(group.key);
          return (
            <Fragment key={group.key}>
              <TableRow
                className="bg-secondary/60 hover:bg-secondary/90 cursor-pointer select-none transition-colors border-b border-border/50"
                onClick={() => toggleCategory(group.key)}
                role="button"
                tabIndex={-1}
                aria-expanded={!isCollapsed}
                aria-label={`Toggle ${group.label} group`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCategory(group.key);
                  }
                }}
              >
                <TableCell colSpan={5} className="py-2.5 px-4 font-medium text-xs text-foreground">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground transition-transform duration-200">
                          {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                        </span>
                        <span className="font-semibold tracking-wide text-xs uppercase text-foreground">
                          {group.label}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground">
                          {group.rows.length} {group.rows.length === 1 ? "test" : "tests"}
                        </Badge>
                      </div>
                      {group.description ? (
                        <p className="pl-6 text-[11px] font-normal italic text-muted-foreground">{group.description}</p>
                      ) : null}
                    </div>
                    {isCollapsed && (
                      <span className="text-[11px] text-muted-foreground font-normal italic pr-2">
                        Click to expand
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {!isCollapsed &&
                group.rows.map((row) => {
                  const raw = values[row.testId] ?? "";
                  const rangeText = row.referenceRangeText ?? "";
                  const numeric = row.dataType === "NUMERIC" && raw.trim() !== "" ? Number(raw) : row.numericValue;
                  const liveFlag =
                    editable && row.dataType === "NUMERIC"
                      ? previewFlag(numeric, rangeText)
                      : editable
                        ? previewFlag(null, rangeText, raw)
                        : row.flag;
                  const flag = FLAG_BADGE[liveFlag] ?? FLAG_BADGE.NORMAL;
                  return (
                    <Fragment key={row.testId}>
                    <TableRow className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-sm">
                        <div className="flex items-start gap-1">
                          <div className="min-w-0">
                            <span>
                              {row.name}
                              {row.isDerived ? <span className="ml-1.5 text-xs text-muted-foreground">(calc.)</span> : null}
                            </span>
                            {row.method ? (
                              <p className="text-[11px] italic text-muted-foreground">{row.method}</p>
                            ) : null}
                          </div>
                          <TestProfileDialog
                            test={row.profile}
                            trigger={
                              <Button type="button" tabIndex={-1} size="icon" variant="ghost" className="size-7" aria-label={`${row.name} profile`}>
                                <BookOpen />
                              </Button>
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="w-40">
                        {row.isDerived ? (
                          <span className="tabular text-sm font-medium">
                            {formatNumericValue(row.numericValue, row.decimalPrecision)}
                          </span>
                        ) : row.dataType === "ORGANISM_PANEL" ? (
                          <span className="text-xs text-muted-foreground">
                            {(row.organismPanel as { organism?: string } | null)?.organism ?? row.textValue ?? (editable ? "Enter below" : "—")}
                          </span>
                        ) : editable ? (
                          <Input
                            className="tabular h-8 w-32"
                            aria-label={`${row.name} result`}
                            data-result-input="true"
                            value={raw}
                            disabled={pendingId === row.testId}
                            onChange={(e) => setValues((v) => ({ ...v, [row.testId]: e.target.value }))}
                            onKeyDown={onResultKeyDown}
                            onBlur={(e) => commit(row, e.target.value)}
                          />
                        ) : (
                          <span className="tabular text-sm">
                            {row.numericValue != null ? formatNumericValue(row.numericValue, row.decimalPrecision) : (row.textValue ?? "—")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.unit}</TableCell>
                      <TableCell className="w-44">
                        <span className="tabular text-xs text-muted-foreground">{rangeText || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {liveFlag !== "NORMAL" ? <Badge variant={flag.variant}>{flag.label}</Badge> : null}
                          {row.deltaFlag ? <Badge variant="secondary">Δ</Badge> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    {row.dataType === "ORGANISM_PANEL" ? (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={5} className="py-2">
                          <CultureFields
                            row={row}
                            editable={editable}
                            pending={pendingId === row.testId}
                            onSave={async (organismPanel) => {
                              setPendingId(row.testId);
                              try {
                                await saveManualResult({
                                  orderId,
                                  testId: row.testId,
                                  textValue: organismPanel.organism ?? row.textValue,
                                  organismPanel,
                                  referenceRangeText: row.referenceRangeText,
                                });
                              } finally {
                                setPendingId(null);
                              }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {(row.category === "HISTOPATHOLOGY" || row.category === "CYTOLOGY") && editable ? (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={5} className="py-2">
                          <div className="grid gap-2 sm:grid-cols-3">
                            {(["grossDescription", "microscopicDescription", "diagnosis"] as const).map((field) => (
                              <Input
                                key={field}
                                defaultValue={row[field] ?? ""}
                                placeholder={field.replace("Description", "").replace(/([A-Z])/g, " $1").trim()}
                                className="h-8 text-xs"
                                onBlur={(e) => {
                                  const value = e.target.value;
                                  void saveManualResult({
                                    orderId,
                                    testId: row.testId,
                                    textValue: row.textValue,
                                    [field]: value,
                                    referenceRangeText: row.referenceRangeText,
                                  });
                                }}
                              />
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {editable ? (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={5} className="py-1.5">
                          <Input
                            className="h-8 text-xs"
                            defaultValue={row.comment ?? ""}
                            placeholder="Comments / description (prints under this test)"
                            disabled={pendingId === row.testId}
                            onBlur={(e) => {
                              const value = e.target.value;
                              if (value === (row.comment ?? "")) return;
                              void saveManualResult({
                                orderId,
                                testId: row.testId,
                                numericValue: row.numericValue,
                                textValue: row.textValue,
                                interpretiveComment: value,
                                referenceRangeText: row.referenceRangeText,
                              });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ) : row.comment ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-1 text-xs italic text-muted-foreground">
                          {row.comment}
                        </TableCell>
                      </TableRow>
                    ) : null}
                    </Fragment>
                  );
                })}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
    {(canRelease || canHandover) && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4 bg-muted/20">
        {canRelease ? (
          <>
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">Enter</kbd> to save &amp; move to next field. After the last field, press <kbd className="px-1 py-0.5 rounded border bg-muted font-mono text-[10px]">Enter</kbd> to release report.
            </p>
            <Button
              type="button"
              data-release-btn="true"
              disabled={isReleasing}
              onClick={handleReleaseReport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-2xs ml-auto"
            >
              {isReleasing ? "Releasing report..." : "Release report"}
            </Button>
          </>
        ) : canHandover && status && accessionNo ? (
          <>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="size-4" />
              Report released
            </div>
            <HandoverActions
              orderId={orderId}
              accessionNo={accessionNo}
              phone={phone ?? null}
              status={status}
              onSent={() => router.refresh()}
              onCollected={() => router.refresh()}
            />
          </>
        ) : null}
      </div>
    )}
  </div>
  );
}
