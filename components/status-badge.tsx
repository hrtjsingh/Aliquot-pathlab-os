import { Badge, type BadgeProps } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/workflow";
import type { OrderStatus } from "@prisma/client";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  ORDER_CREATED: "outline",
  SAMPLE_COLLECTED: "soft-accent",
  SAMPLE_RECEIVED: "soft-primary",
  RESULT_ENTRY: "soft-warning",
  TECH_VERIFIED: "soft-accent",
  AUTHORIZED: "soft-success",
  RELEASED: "soft-success",
  SENT_TO_CUSTOMER: "soft-success",
  COLLECTED_BY_CUSTOMER: "soft-success",
  AMENDED: "soft-warning",
  CANCELLED: "outline",
};

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  STAT: "panic",
  URGENT: "soft-warning",
  ROUTINE: "outline",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{STATUS_LABELS[status] ?? status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const variant = PRIORITY_VARIANT[priority] ?? "outline";
  return (
    <Badge variant={variant}>
      {priority === "STAT" ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-red-600" />
        </span>
      ) : priority === "URGENT" ? (
        <span className="size-1.5 rounded-full bg-amber-500" />
      ) : null}
      {priority}
    </Badge>
  );
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  FRONTDESK: "Front desk",
  PHLEBOTOMIST: "Phlebotomist",
  TECHNOLOGIST: "Technologist",
  PATHOLOGIST: "Pathologist",
  BRANCH_MANAGER: "Branch manager",
};
