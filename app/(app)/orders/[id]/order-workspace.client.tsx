"use client";

import { useState, type ReactNode } from "react";
import { FlaskConical, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrderWorkspaceStage = "tests" | "results";

export function OrderWorkspace({
  initialStage,
  allowTests,
  allowResults,
  tests,
  results,
}: {
  initialStage: OrderWorkspaceStage;
  allowTests: boolean;
  allowResults: boolean;
  tests: ReactNode;
  results: ReactNode;
}) {
  const [stage, setStage] = useState<OrderWorkspaceStage>(initialStage);
  const current = stage === "tests" && allowTests ? "tests" : "results";
  const showSwitcher = allowTests && allowResults;

  return (
    <div className="flex flex-col gap-4">
      {showSwitcher ? (
        <div className="inline-flex w-fit rounded-md border border-border bg-secondary/70 p-1">
          <button
            type="button"
            onClick={() => setStage("tests")}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              current === "tests" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FlaskConical className="size-4" />
            Select tests
          </button>
          <button
            type="button"
            onClick={() => setStage("results")}
            className={cn(
              "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              current === "results" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardList className="size-4" />
            Enter results
          </button>
        </div>
      ) : null}
      {current === "tests" ? tests : <div className="flex flex-col gap-6">{results}</div>}
    </div>
  );
}
