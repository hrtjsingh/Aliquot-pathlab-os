import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical, FileText } from "lucide-react";
import { getPatientOrders } from "@/app/actions/patients";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge, StatusBadge } from "@/components/status-badge";
import { formatInr } from "@/lib/money";
import { publicReportPath } from "@/lib/public-report";
import { format } from "date-fns";
import type { OrderStatus } from "@prisma/client";

export default async function PatientHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPatientOrders(id);
  if (!data) notFound();

  const { patient, orders } = data;
  const name = `${patient.firstName} ${patient.lastName ?? ""}`.trim();
  const subtitle = [patient.mrn, patient.gender, patient.ageYears != null ? `${patient.ageYears}y` : null, patient.phone]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title={name}
        description={subtitle}
        actions={
          <Button asChild variant="outline">
            <Link href={"/patients" as never}>Back to patients</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Order history</CardTitle>
          <CardDescription>All accessions and reports for this patient.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <EmptyState
              icon={<FlaskConical className="size-5" />}
              title="No orders yet"
              description="Create the first accession for this patient."
              action={
                <Button asChild>
                  <Link href={`/orders/new?patientId=${patient.id}` as never}>
                    <FlaskConical />
                    New order
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Accession</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="tabular text-xs">{order.accessionNo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(order.createdAt, "PPp")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.status as OrderStatus} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={order.priority} />
                    </TableCell>
                    <TableCell className="text-right tabular text-xs">{formatInr(order.totalCharge)}</TableCell>
                    <TableCell
                      className={
                        order.due > 0
                          ? "text-right tabular text-xs font-medium text-destructive"
                          : "text-right tabular text-xs"
                      }
                    >
                      {formatInr(order.due)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/orders/${order.id}` as never}>Open</Link>
                        </Button>
                        {order.reportVisible ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/orders/${order.id}/report` as never}>
                              <FileText />
                              Report
                            </Link>
                          </Button>
                        ) : null}
                        {order.reportVisible && order.publicToken ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={publicReportPath(order.publicToken)} target="_blank" rel="noreferrer">
                              Public
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
