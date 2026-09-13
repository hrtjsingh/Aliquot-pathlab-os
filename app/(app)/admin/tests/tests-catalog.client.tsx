"use client";

import { Fragment, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/empty-state";
import { AddTestDialog } from "./add-test-dialog";
import { ToggleTestButton } from "./toggle-test-button";
import { TestProfileDialog } from "./test-profile-dialog";
import { DeleteTestButton } from "./delete-test-button";
import type { TestProfile } from "@/lib/test-profile";
import { formatInr } from "@/lib/money";
import { FlaskConical } from "lucide-react";

export type CatalogTest = TestProfile & { active: boolean };

export function TestsCatalog({ tests }: { tests: CatalogTest[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const categories = useMemo(
    () => Array.from(new Set(tests.map((test) => test.category))).sort(),
    [tests]
  );

  const filtered = tests.filter((test) => {
    if (category !== "ALL" && test.category !== category) return false;
    if (status === "ACTIVE" && !test.active) return false;
    if (status === "INACTIVE" && test.active) return false;
    if (!query.trim()) return true;
    return `${test.code} ${test.name} ${test.category}`.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="relative w-full min-w-[16rem]">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or name"
            aria-label="Search tests"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <NativeSelect
          className="w-full sm:w-52 sm:shrink-0"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="ALL">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="w-full sm:w-40 sm:shrink-0"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </NativeSelect>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {tests.length === 0 ? (
            <EmptyState
              icon={<FlaskConical className="size-5" />}
              title="No tests in the catalog"
              description="Add the first orderable test to start building packages and accessions."
              action={<AddTestDialog />}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="No matching tests"
              description="Clear the search or choose another category."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Specimen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((test, index) => {
                  const showCategory = index === 0 || filtered[index - 1].category !== test.category;
                  return (
                    <Fragment key={test.id}>
                      {showCategory ? (
                        <TableRow className="bg-secondary/60 hover:bg-secondary/60">
                          <TableCell colSpan={6} className="text-xs font-medium tracking-wide text-muted-foreground">
                            {test.category.replaceAll("_", " ")}
                          </TableCell>
                        </TableRow>
                      ) : null}
                      <TableRow>
                        <TableCell className="tabular text-xs">{test.code}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span>
                              {test.name}{" "}
                              {test.isDerived ? <span className="text-xs text-muted-foreground">(calc.)</span> : null}
                            </span>
                            <span className="text-xs text-muted-foreground">{test.unit ?? "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="tabular text-xs">{formatInr(test.price)}</TableCell>
                        <TableCell className="text-xs">{test.specimenType}</TableCell>
                        <TableCell>
                          <Badge variant={test.active ? "success" : "outline"}>{test.active ? "Active" : "Inactive"}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <TestProfileDialog test={test} canEdit />
                            <ToggleTestButton testId={test.id} active={test.active} name={test.name} />
                            <DeleteTestButton testId={test.id} name={test.name} />
                          </div>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
