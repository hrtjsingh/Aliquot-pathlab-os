import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/workflow";
import type { OrderStatus } from "@prisma/client";

const STATUS_VARIANT: Record<OrderStatus, "outline" | "secondary" | "warning" | "success" | "destructive" | "default"> = {
  ORDER_CREATED: "outline",
  SAMPLE_COLLECTED: "secondary",
  SAMPLE_RECEIVED: "secondary",
  RESULT_ENTRY: "warning",
  TECH_VERIFIED: "default",
  AUTHORIZED: "success",
  RELEASED: "warning",
  SENT_TO_CUSTOMER: "success",
  COLLECTED_BY_CUSTOMER: "success",
  AMENDED: "warning",
  CANCELLED: "outline",
};

const PRIORITY_VARIANT: Record<string, "destructive" | "warning" | "outline"> = {
  STAT: "destructive",
  URGENT: "warning",
  ROUTINE: "outline",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge variant={PRIORITY_VARIANT[priority] ?? "outline"}>{priority}</Badge>;
}

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  FRONTDESK: "Front desk",
  PHLEBOTOMIST: "Phlebotomist",
  TECHNOLOGIST: "Technologist",
  PATHOLOGIST: "Pathologist",
  BRANCH_MANAGER: "Branch manager",
};
