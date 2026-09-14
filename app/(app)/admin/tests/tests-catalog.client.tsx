"use client";

import { Fragment, useMemo, useState } from "react";
import { Search, ChevronDown, ChevronRight, ChevronsUpDown, FlaskConical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AddTestDialog } from "./add-test-dialog";
import { ToggleTestButton } from "./toggle-test-button";
import { TestProfileDialog } from "./test-profile-dialog";
import { DeleteTestButton } from "./delete-test-button";
import type { TestProfile } from "@/lib/test-profile";
import { formatInr } from "@/lib/money";

export type CatalogTest = TestProfile & { active: boolean };

export function TestsCatalog({ tests }: { tests: CatalogTest[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

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

  const groupedFiltered = useMemo(() => {
    const map = new Map<string, CatalogTest[]>();
    for (const test of filtered) {
      const list = map.get(test.category) ?? [];
      list.push(test);
      map.set(test.category, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const allCategoryKeys = useMemo(() => groupedFiltered.map(([cat]) => cat), [groupedFiltered]);
  const allCollapsed = allCategoryKeys.length > 0 && allCategoryKeys.every((cat) => collapsedCategories.has(cat));

  const toggleCategory = (categoryKey: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryKey)) {
        next.delete(categoryKey);
      } else {
        next.add(categoryKey);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedCategories(new Set());
    } else {
      setCollapsedCategories(new Set(allCategoryKeys));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:w-1/2 lg:max-w-md">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="w-full pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search code or name"
            aria-label="Search tests"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <NativeSelect
            className="w-full sm:w-52 shrink-0"
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
            className="w-full sm:w-40 shrink-0"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </NativeSelect>

          {allCategoryKeys.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleAll}
              className="h-9 text-xs gap-1.5 shrink-0"
              title={allCollapsed ? "Expand all categories" : "Collapse all categories"}
            >
              <ChevronsUpDown className="size-3.5" />
              {allCollapsed ? "Expand all" : "Collapse all"}
            </Button>
          )}
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
                <TableRow className="bg-secondary/70 border-b border-border">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Code</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Charge</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Specimen</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedFiltered.map(([categoryKey, categoryTests]) => {
                  const isCollapsed = collapsedCategories.has(categoryKey) && !query.trim();

                  return (
                    <Fragment key={categoryKey}>
                      <TableRow
                        className="bg-secondary/60 hover:bg-secondary/90 cursor-pointer select-none transition-colors border-b border-border/50"
                        onClick={() => toggleCategory(categoryKey)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={!isCollapsed}
                        aria-label={`Toggle ${categoryKey.replaceAll("_", " ")} category`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleCategory(categoryKey);
                          }
                        }}
                      >
                        <TableCell colSpan={6} className="py-2.5 px-4 font-medium text-xs text-foreground">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground transition-transform duration-200">
                                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                              </span>
                              <span className="font-semibold tracking-wide text-xs uppercase text-foreground">
                                {categoryKey.replaceAll("_", " ")}
                              </span>
                              <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground">
                                {categoryTests.length} {categoryTests.length === 1 ? "test" : "tests"}
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
                        categoryTests.map((test) => (
                          <TableRow key={test.id} className="hover:bg-muted/30 transition-colors">
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
                              <Badge variant={test.active ? "success" : "outline"}>
                                {test.active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap justify-end gap-2">
                                <TestProfileDialog test={test} canEdit />
                                <ToggleTestButton testId={test.id} active={test.active} name={test.name} />
                                <DeleteTestButton testId={test.id} name={test.name} />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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
