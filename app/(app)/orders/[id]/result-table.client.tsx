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

type ResultRow = {
  testId: string;
  code: string;
  name: string;
  category: string;
  unit: string | null;
  dataType: string;
  isDerived: boolean;
  numericValue: number | null;
  textValue: string | null;
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
    const map = new Map<string, ResultRow[]>();
    for (const row of rows) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return Array.from(map.entries());
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
        {groups.map(([category, group]) => {
          const isCollapsed = collapsedCategories.has(category);
          return (
            <Fragment key={category}>
              <TableRow
                className="bg-secondary/60 hover:bg-secondary/90 cursor-pointer select-none transition-colors border-b border-border/50"
                onClick={() => toggleCategory(category)}
                role="button"
                tabIndex={-1}
                aria-expanded={!isCollapsed}
                aria-label={`Toggle ${category.replaceAll("_", " ")} category`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCategory(category);
                  }
                }}
              >
                <TableCell colSpan={5} className="py-2.5 px-4 font-medium text-xs text-foreground">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground transition-transform duration-200">
                        {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                      </span>
                      <span className="font-semibold tracking-wide text-xs uppercase text-foreground">
                        {category.replaceAll("_", " ")}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground">
                        {group.length} {group.length === 1 ? "test" : "tests"}
                      </Badge>
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
                group.map((row) => {
                  const raw = values[row.testId] ?? "";
                  const rangeText = row.referenceRangeText ?? "";
                  const numeric = row.dataType === "NUMERIC" && raw.trim() !== "" ? Number(raw) : row.numericValue;
                  const liveFlag = editable && row.dataType === "NUMERIC" ? previewFlag(numeric, rangeText) : row.flag;
                  const flag = FLAG_BADGE[liveFlag] ?? FLAG_BADGE.NORMAL;
                  return (
                    <TableRow key={row.testId} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <span>
                            {row.name}
                            {row.isDerived ? <span className="ml-1.5 text-xs text-muted-foreground">(calc.)</span> : null}
                          </span>
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
                            {row.numericValue != null ? row.numericValue.toFixed(2) : "—"}
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
                          <span className="tabular text-sm">{row.numericValue ?? row.textValue ?? "—"}</span>
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
