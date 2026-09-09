"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { saveManualResult } from "@/app/actions/results";
import { TestProfileDialog } from "@/app/(app)/admin/tests/test-profile-dialog";
import type { TestProfile } from "@/lib/test-profile";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function commit(row: ResultRow, raw: string) {
    if (row.isDerived) return;
    const previous = row.numericValue != null ? String(row.numericValue) : (row.textValue ?? "");
    if (raw === previous) return;

    setPendingId(row.testId);
    startTransition(async () => {
      try {
        const isNumeric = row.dataType === "NUMERIC";
        await saveManualResult({
          orderId,
          testId: row.testId,
          numericValue: isNumeric ? (raw.trim() === "" ? null : Number(raw)) : null,
          textValue: !isNumeric ? raw : null,
        });
        toast.success(`${row.name} saved.`);
        router.refresh();
      } catch (error) {
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
        {rows.map((row) => {
          const flag = FLAG_BADGE[row.flag] ?? FLAG_BADGE.NORMAL;
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
                    value={values[row.testId] ?? ""}
                    disabled={pendingId === row.testId}
                    onChange={(e) => setValues((v) => ({ ...v, [row.testId]: e.target.value }))}
                    onBlur={(e) => commit(row, e.target.value)}
                  />
                ) : (
                  <span className="tabular text-sm">{row.numericValue ?? row.textValue ?? "—"}</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{row.unit}</TableCell>
              <TableCell className="tabular text-xs text-muted-foreground">{row.referenceRangeText ?? "—"}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {row.flag !== "NORMAL" ? <Badge variant={flag.variant}>{flag.label}</Badge> : null}
                  {row.deltaFlag ? <Badge variant="secondary">Δ</Badge> : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
