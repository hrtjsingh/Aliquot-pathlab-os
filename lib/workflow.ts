import { OrderStatus } from "@prisma/client";

/**
 * Order workflow state machine, exactly per spec:
 * Order Created -> Sample Collected -> Sample Received -> Result Entry
 *   -> Technologist Verification -> Pathologist Authorization -> Released
 *   -> Sent (WhatsApp) and/or Collected at the counter
 *   -> Reprint / Amend (audit-preserving branch)
 *
 * ALLOWED_TRANSITIONS is the single source of truth — every status change in
 * the app must go through canTransition() so an out-of-order transition
 * (e.g. releasing a report that was never authorized) is rejected at the
 * data layer, not just hidden in the UI.
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ORDER_CREATED: [OrderStatus.SAMPLE_COLLECTED, OrderStatus.CANCELLED],
  SAMPLE_COLLECTED: [OrderStatus.SAMPLE_RECEIVED, OrderStatus.CANCELLED],
  SAMPLE_RECEIVED: [OrderStatus.RESULT_ENTRY, OrderStatus.RELEASED, OrderStatus.CANCELLED],
  RESULT_ENTRY: [
    OrderStatus.RELEASED,
    OrderStatus.TECH_VERIFIED,
    OrderStatus.AUTHORIZED,
    OrderStatus.SENT_TO_CUSTOMER,
    OrderStatus.COLLECTED_BY_CUSTOMER,
    OrderStatus.CANCELLED,
  ],
  TECH_VERIFIED: [OrderStatus.RELEASED, OrderStatus.AUTHORIZED, OrderStatus.RESULT_ENTRY], // pathologist can bounce back for re-entry
  AUTHORIZED: [OrderStatus.RELEASED],
  RELEASED: [OrderStatus.SENT_TO_CUSTOMER, OrderStatus.COLLECTED_BY_CUSTOMER, OrderStatus.AMENDED],
  SENT_TO_CUSTOMER: [OrderStatus.COLLECTED_BY_CUSTOMER, OrderStatus.AMENDED],
  COLLECTED_BY_CUSTOMER: [OrderStatus.AMENDED],
  AMENDED: [], // amendments create a NEW linked Order (see schema: amendsOrderId) — original stays immutable
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  ORDER_CREATED: "Order Created",
  SAMPLE_COLLECTED: "Sample Collected",
  SAMPLE_RECEIVED: "Sample Received",
  RESULT_ENTRY: "Result Entry",
  TECH_VERIFIED: "Technologist Verified",
  AUTHORIZED: "Pathologist Authorized",
  RELEASED: "Released",
  SENT_TO_CUSTOMER: "Sent",
  COLLECTED_BY_CUSTOMER: "Collected",
  AMENDED: "Amended",
  CANCELLED: "Cancelled",
};

export const WORKLIST_STATUSES: OrderStatus[] = [
  OrderStatus.ORDER_CREATED,
  OrderStatus.SAMPLE_COLLECTED,
  OrderStatus.SAMPLE_RECEIVED,
  OrderStatus.RESULT_ENTRY,
  OrderStatus.TECH_VERIFIED,
  OrderStatus.AUTHORIZED,
  OrderStatus.RELEASED,
];

export const CUSTOMER_REPORT_STATUSES: OrderStatus[] = [
  OrderStatus.RELEASED,
  OrderStatus.SENT_TO_CUSTOMER,
  OrderStatus.COLLECTED_BY_CUSTOMER,
];

export function isCustomerVisibleReport(status: OrderStatus) {
  return CUSTOMER_REPORT_STATUSES.includes(status);
}

export function canSendReportWhatsApp(status: OrderStatus) {
  return isCustomerVisibleReport(status);
}

export function canMarkCollected(status: OrderStatus) {
  return isCustomerVisibleReport(status);
}

export function isHandoverDone(status: OrderStatus) {
  return status === OrderStatus.SENT_TO_CUSTOMER || status === OrderStatus.COLLECTED_BY_CUSTOMER;
}

// Which role is permitted to *perform* each transition.
export const TRANSITION_ROLE: Record<string, string[]> = {
  SAMPLE_COLLECTED: ["PHLEBOTOMIST", "FRONTDESK", "ADMIN"],
  SAMPLE_RECEIVED: ["TECHNOLOGIST", "ADMIN", "FRONTDESK"],
  RESULT_ENTRY: ["TECHNOLOGIST", "ADMIN", "FRONTDESK"],
  TECH_VERIFIED: ["TECHNOLOGIST", "ADMIN"],
  AUTHORIZED: ["PATHOLOGIST", "ADMIN"],
  RELEASED: ["PATHOLOGIST", "ADMIN", "FRONTDESK", "TECHNOLOGIST"],
  SENT_TO_CUSTOMER: ["FRONTDESK", "ADMIN", "PATHOLOGIST", "TECHNOLOGIST"],
  COLLECTED_BY_CUSTOMER: ["FRONTDESK", "ADMIN", "PATHOLOGIST", "TECHNOLOGIST"],
  CANCELLED: ["ADMIN", "FRONTDESK"],
};
