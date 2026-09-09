import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/workflow";
import type { OrderStatus } from "@prisma/client";

const STEPS: OrderStatus[] = [
  "ORDER_CREATED",
  "SAMPLE_COLLECTED",
  "SAMPLE_RECEIVED",
  "RESULT_ENTRY",
  "TECH_VERIFIED",
  "AUTHORIZED",
  "RELEASED",
];

const SHORT: Record<OrderStatus, string> = {
  ORDER_CREATED: "Created",
  SAMPLE_COLLECTED: "Collected",
  SAMPLE_RECEIVED: "Received",
  RESULT_ENTRY: "Results",
  TECH_VERIFIED: "Verified",
  AUTHORIZED: "Authorized",
  RELEASED: "Released",
  AMENDED: "Amended",
  CANCELLED: "Cancelled",
};

export function WorkflowStepper({ status }: { status: OrderStatus }) {
  if (status === "CANCELLED" || status === "AMENDED") {
    return (
      <p className="text-sm text-muted-foreground">
        Current status: <span className="font-medium text-foreground">{STATUS_LABELS[status]}</span>
      </p>
    );
  }

  const currentIndex = STEPS.indexOf(status);

  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        return (
          <li key={step} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-border">/</span> : null}
            <span
              className={cn(
                "rounded-md px-2 py-1",
                done && "text-muted-foreground",
                current && "bg-accent/15 font-medium text-accent",
                !done && !current && "text-muted-foreground/70"
              )}
            >
              {SHORT[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
