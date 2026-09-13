"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { saveManualResult } from "@/app/actions/results";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { TestProfileDialog } from "@/app/(app)/admin/tests/test-profile-dialog";
import type { TestProfile } from "@/lib/test-profile";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";
import { previewFlag } from "@/lib/flagging";

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

export function ResultTable({ orderId, rows, editable }: { orderId: string; rows: ResultRow[]; editable: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.testId, r.numericValue != null ? String(r.numericValue) : (r.textValue ?? "")]))
  );
  const [ranges, setRanges] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.testId, r.referenceRangeText ?? ""]))
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const groups = useMemo(() => {
    const map = new Map<string, ResultRow[]>();
    for (const row of rows) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  function commit(row: ResultRow, raw: string, rangeText: string) {
    if (row.isDerived) return;
    const previous = row.numericValue != null ? String(row.numericValue) : (row.textValue ?? "");
    const previousRange = row.referenceRangeText ?? "";
    if (raw === previous && rangeText.trim() === previousRange.trim()) return;

    setPendingId(row.testId);
    startTransition(async () => {
      const isNumeric = row.dataType === "NUMERIC";
      const params = {
        orderId,
        testId: row.testId,
        numericValue: isNumeric ? (raw.trim() === "" ? null : Number(raw)) : null,
        textValue: !isNumeric ? raw : null,
        referenceRangeText: rangeText.trim() || null,
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

  return (
    <Table>
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
        {groups.map(([category, group]) => (
          <Fragment key={category}>
            <TableRow className="bg-secondary/60 hover:bg-secondary/60">
              <TableCell colSpan={5} className="text-xs font-medium tracking-wide text-muted-foreground">
                {category.replaceAll("_", " ")}
              </TableCell>
            </TableRow>
            {group.map((row) => {
              const raw = values[row.testId] ?? "";
              const rangeText = ranges[row.testId] ?? "";
              const numeric = row.dataType === "NUMERIC" && raw.trim() !== "" ? Number(raw) : row.numericValue;
              const liveFlag = editable && row.dataType === "NUMERIC" ? previewFlag(numeric, rangeText) : row.flag;
              const flag = FLAG_BADGE[liveFlag] ?? FLAG_BADGE.NORMAL;
              return (
                <TableRow key={row.testId}>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      <span>
                        {row.name}
                        {row.isDerived ? <span className="ml-1.5 text-xs text-muted-foreground">(calc.)</span> : null}
                      </span>
                      <TestProfileDialog
                        test={row.profile}
                        trigger={
                          <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={`${row.name} profile`}>
                            <BookOpen />
                          </Button>
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="w-40">
                    {row.isDerived ? (
                      <span className="tabular text-sm font-medium">{row.numericValue ?? "—"}</span>
                    ) : editable ? (
                      <Input
                        className="tabular h-8 w-32"
                        aria-label={`${row.name} result`}
                        value={raw}
                        disabled={pendingId === row.testId}
                        onChange={(e) => setValues((v) => ({ ...v, [row.testId]: e.target.value }))}
                        onBlur={(e) => commit(row, e.target.value, rangeText)}
                      />
                    ) : (
                      <span className="tabular text-sm">{row.numericValue ?? row.textValue ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{row.unit}</TableCell>
                  <TableCell className="w-44">
                    {editable ? (
                      <Input
                        className="tabular h-8"
                        aria-label={`${row.name} reference range`}
                        value={rangeText}
                        disabled={pendingId === row.testId}
                        onChange={(e) => setRanges((v) => ({ ...v, [row.testId]: e.target.value }))}
                        onBlur={(e) => commit(row, raw, e.target.value)}
                      />
                    ) : (
                      <span className="tabular text-xs text-muted-foreground">{row.referenceRangeText ?? "—"}</span>
                    )}
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
        ))}
      </TableBody>
    </Table>
  );
}
