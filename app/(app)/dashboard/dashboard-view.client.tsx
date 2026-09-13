"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, ClipboardList, FileText, FlaskConical, Pencil, Receipt, Search } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaymentUpdateDialog } from "@/components/payment-update-dialog";
import { CacheMiss, useDataSync } from "@/components/data-sync";
import { useIsInstalledPwa } from "@/lib/client-pwa";
import { STATUS_LABELS, isCustomerVisibleReport } from "@/lib/workflow";
import { formatInr } from "@/lib/money";
import { cancelOrder } from "@/app/actions/orders";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";
import DashboardLoading from "./loading";

const STATUSES = ["SAMPLE_RECEIVED", "RESULT_ENTRY", "TECH_VERIFIED", "AUTHORIZED", "RELEASED"] as const;
const BOOKING_STATUSES = [
  "ALL",
  "ORDER_CREATED",
  "SAMPLE_COLLECTED",
  "SAMPLE_RECEIVED",
  "RESULT_ENTRY",
  "TECH_VERIFIED",
  "AUTHORIZED",
  "RELEASED",
  "SENT_TO_CUSTOMER",
  "COLLECTED_BY_CUSTOMER",
  "CANCELLED",
] as const;

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function canCancel(status: string) {
  return ["ORDER_CREATED", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "RESULT_ENTRY"].includes(status);
}

export function DashboardView() {
  const router = useRouter();
  const { snapshot, patchSnapshot, syncNow } = useDataSync();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof BOOKING_STATUSES)[number]>("ALL");
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);

  useEffect(() => {
    void syncNow({ auto: true });
  }, [syncNow]);

  if (!snapshot) return <CacheMiss loading={<DashboardLoading />} />;

  const { dashboard } = snapshot;
  const counts = [
    dashboard.sampleReceived,
    dashboard.resultEntry,
    dashboard.techVerified,
    dashboard.authorized,
    dashboard.awaitingHandover ?? 0,
  ];
  const criticalOpen = dashboard.criticalOpen;
  const bookings = dashboard.bookings ?? [];

  const filtered = bookings.filter((order) => {
    const day = order.createdAt.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const haystack = `${order.patientName} ${order.accessionNo} ${order.phone ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const collection = filtered.reduce(
    (acc, row) => {
      if (row.status === "CANCELLED" || row.status === "AMENDED") return acc;
      acc.count += 1;
      acc.total += row.totalCharge;
      acc.discount += row.discount;
      acc.paid += row.amountPaid;
      acc.due += row.due;
      return acc;
    },
    { count: 0, total: 0, discount: 0, paid: 0, due: 0 }
  );

  const collectionCards = [
    { label: "Patients", value: String(collection.count) },
    { label: "Total", value: formatInr(collection.total) },
    { label: "Discount", value: formatInr(collection.discount) },
    { label: "Collected", value: formatInr(collection.paid) },
    { label: "Due", value: formatInr(collection.due), warn: collection.due > 0 },
  ];

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Dashboard"
        description="Bookings, collection, and lab-wide status. Open an accession to enter results or print a bill."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={"/worklist" as never}>
                <ClipboardList />
                Open worklist
              </Link>
            </Button>
            <Button asChild>
              <Link href={"/orders/new" as never}>
                <FlaskConical />
                New order
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
        {STATUSES.map((status, i) => (
          <Link key={status} href={"/worklist" as never} className="block min-w-0">
            <Card className="h-full border-t-2 border-t-accent/40 transition-all hover:border-t-accent hover:shadow-sm">
              <CardHeader className="pb-1 pt-3 px-3.5">
                <CardTitle className="text-[11px] font-semibold leading-snug text-muted-foreground uppercase tracking-wider">
                  {status === "RELEASED"
                    ? "Ready to send"
                    : status === "TECH_VERIFIED"
                      ? "Verified"
                      : status === "AUTHORIZED"
                        ? "Authorized"
                        : status === "RESULT_ENTRY"
                          ? "Results"
                          : status === "SAMPLE_RECEIVED"
                            ? "Received"
                            : STATUS_LABELS[status]}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3.5 pb-3">
                <p className="text-2xl font-bold tabular text-foreground">{counts[i]}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
        <Card className={cn("border-t-2", criticalOpen > 0 ? "border-t-destructive bg-destructive/5" : "border-t-muted")}>
          <CardHeader className="pb-1 pt-3 px-3.5">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Open critical</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3.5 pb-3">
            <p className={cn("text-2xl font-bold tabular", criticalOpen > 0 ? "text-destructive" : "text-foreground")}>{criticalOpen}</p>
          </CardContent>
        </Card>
        <Card className="border-t-2 border-t-success/50">
          <CardHeader className="pb-1 pt-3 px-3.5">
            <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Released today</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3.5 pb-3">
            <p className="text-2xl font-bold tabular text-foreground">{dashboard.releasedToday}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {collectionCards.map((card) => (
          <Card key={card.label} className={cn("min-w-0 border-t-2", card.warn ? "border-t-destructive bg-destructive/5" : "border-t-primary/30")}>
            <CardHeader className="pb-1 pt-3 px-3.5">
              <CardTitle className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-3.5 pb-3">
              <p className={cn("text-xl font-bold tabular", card.warn ? "text-destructive" : "text-foreground")}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bookings</CardTitle>
          <CardDescription>Filter by date, status, or patient. Print a bill, open the report, or cancel before verification.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:w-1/2 lg:max-w-md">
              <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
              <Input
                className="w-full pl-8"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, accession, or phone"
                aria-label="Search bookings"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <NativeSelect
                className="w-full sm:w-36 shrink-0"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                aria-label="Filter by status"
              >
                {BOOKING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === "ALL" ? "All statuses" : STATUS_LABELS[status as OrderStatus] ?? status}
                  </option>
                ))}
              </NativeSelect>

              <Input
                className="w-full sm:w-36 shrink-0"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="From date"
              />

              <Input
                className="w-full sm:w-36 shrink-0"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To date"
              />

              <div className="inline-flex h-9 items-center rounded-lg border border-border/80 bg-secondary/60 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setFrom(todayIso());
                    setTo(todayIso());
                  }}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-md px-3 text-xs font-medium transition-all duration-150",
                    from === todayIso() && to === todayIso()
                      ? "bg-card text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                    setStatusFilter("ALL");
                    setQuery("");
                  }}
                  className={cn(
                    "inline-flex h-7 items-center justify-center rounded-md px-3 text-xs font-medium transition-all duration-150",
                    !from && !to
                      ? "bg-card text-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-5" />}
              title="No bookings in this view"
              description="Create an accession from New Order, or widen the date filter."
              action={
                <Link href={"/orders/new" as never}>
                  <Button>
                    <FlaskConical />
                    New order
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-auto rounded-lg border border-border bg-card max-sm:max-h-[60vh]">
              <table className="w-full min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-secondary text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                  <tr>
                    <th className="px-3.5 py-2.5">Accession</th>
                    <th className="px-3.5 py-2.5">Patient</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Total</th>
                    <th className="px-3.5 py-2.5 text-right">Due</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((order) => (
                    <tr key={order.id} className="hover:bg-secondary/40">
                      <td className="px-3 py-2">
                        <p className="tabular font-medium">{order.accessionNo}</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium">{order.patientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {[order.ageYears != null ? `${order.ageYears}y` : null, order.gender, order.phone].filter(Boolean).join(" · ")}
                        </p>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <PriorityBadge priority={order.priority} />
                          <StatusBadge status={order.status as OrderStatus} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular">{formatInr(order.totalCharge)}</td>
                      <td className={cn("px-3 py-2 text-right tabular", order.due > 0 && "font-medium text-destructive")}>
                        {formatInr(order.due)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          <PaymentUpdateDialog
                            orderId={order.id}
                            accessionNo={order.accessionNo}
                            patientName={order.patientName}
                            totalCharge={order.totalCharge}
                            discount={order.discount}
                            amountPaid={order.amountPaid}
                            onUpdated={(b) => {
                              patchSnapshot((current) => ({
                                ...current,
                                dashboard: {
                                  ...current.dashboard,
                                  bookings: (current.dashboard.bookings ?? []).map((row) =>
                                    row.id === order.id ? { ...row, discount: b.discount, amountPaid: b.amountPaid, due: b.due } : row
                                  ),
                                },
                              }));
                            }}
                          />
                          {isCustomerVisibleReport(order.status as OrderStatus) ? (
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/orders/${order.id}/report` as never}>
                                <FileText />
                                Report
                              </Link>
                            </Button>
                          ) : null}
                          <Button asChild size="sm" variant="ghost">
                            <a href={`/api/orders/${order.id}/receipt.pdf`} target="_blank" rel="noreferrer">
                              <Receipt />
                              Bill
                            </a>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/orders/${order.id}` as never}>
                              <Pencil />
                              Edit
                            </Link>
                          </Button>
                          {canCancel(order.status) ? (
                            <ConfirmDialog
                              title={`Cancel ${order.accessionNo}?`}
                              description="Cancelled accessions stay on the books with a cancelled status. Results cannot be entered after this."
                              confirmLabel="Cancel order"
                              variant="destructive"
                              successMessage="Order cancelled."
                              trigger={
                                <Button size="sm" variant="ghost" type="button">
                                  <Ban />
                                  Cancel
                                </Button>
                              }
                              onConfirm={async () => {
                                await cancelOrder(order.id);
                                await patchSnapshot((current) => ({
                                  ...current,
                                  worklist: current.worklist.filter((row) => row.id !== order.id),
                                  dashboard: {
                                    ...current.dashboard,
                                    bookings: (current.dashboard.bookings ?? []).map((row) =>
                                      row.id === order.id ? { ...row, status: "CANCELLED", due: 0 } : row
                                    ),
                                    recent: current.dashboard.recent.map((row) =>
                                      row.id === order.id ? { ...row, status: "CANCELLED" } : row
                                    ),
                                  },
                                }));
                                router.refresh();
                              }}
                            />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
