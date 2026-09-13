"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Receipt } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cancelOrder, updateOrderPayment } from "@/app/actions/orders";
import { asMoney, dueAmount, formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";

const CANCELABLE = ["ORDER_CREATED", "SAMPLE_COLLECTED", "SAMPLE_RECEIVED", "RESULT_ENTRY"];

export function BillingCard({
  orderId,
  accessionNo,
  status,
  role,
  totalCharge,
  discount,
  amountPaid,
}: {
  orderId: string;
  accessionNo: string;
  status: string;
  role: string;
  totalCharge: number;
  discount: number;
  amountPaid: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [discountValue, setDiscountValue] = useState(String(discount));
  const [paidValue, setPaidValue] = useState(String(amountPaid));
  const canPay = role === "ADMIN" || role === "FRONTDESK";
  const due = dueAmount(totalCharge, asMoney(discountValue), asMoney(paidValue));

  function savePayment() {
    startTransition(async () => {
      const result = await updateOrderPayment({
        orderId,
        discount: asMoney(discountValue),
        amountPaid: asMoney(paidValue),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Payment updated.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Package and a la carte charges, discount, and cash collected.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex justify-between text-sm">
          <span>Total</span>
          <span className="tabular font-medium">{formatInr(totalCharge)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-discount">Discount</Label>
            <Input
              id="order-discount"
              numeric="decimal"
              value={discountValue}
              disabled={!canPay}
              onChange={(e) => setDiscountValue(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="order-paid">Paid</Label>
            <Input
              id="order-paid"
              numeric="decimal"
              value={paidValue}
              disabled={!canPay}
              onChange={(e) => setPaidValue(e.target.value)}
            />
          </div>
        </div>
        <div className={cn("flex justify-between text-sm font-semibold", due > 0 ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}>
          <span>Due</span>
          <span className="tabular">{formatInr(due)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPay ? (
            <Button type="button" size="sm" onClick={savePayment} disabled={pending}>
              {pending ? "Saving…" : "Save payment"}
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <a href={`/api/orders/${orderId}/receipt.pdf`} target="_blank" rel="noreferrer">
              <Receipt />
              Print receipt
            </a>
          </Button>
          {CANCELABLE.includes(status) && canPay ? (
            <ConfirmDialog
              title={`Cancel ${accessionNo}?`}
              description="This accession will be marked cancelled and cannot move forward."
              confirmLabel="Cancel order"
              variant="destructive"
              successMessage="Order cancelled."
              trigger={
                <Button size="sm" variant="ghost" type="button">
                  <Ban />
                  Cancel order
                </Button>
              }
              onConfirm={async () => {
                await cancelOrder(orderId);
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
