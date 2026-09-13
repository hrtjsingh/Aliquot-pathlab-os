"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IndianRupee, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateOrderPayment } from "@/app/actions/orders";
import { asMoney, dueAmount, formatInr } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PaymentUpdateDialog({
  orderId,
  accessionNo,
  patientName,
  totalCharge,
  discount = 0,
  amountPaid = 0,
  trigger,
  onUpdated,
}: {
  orderId: string;
  accessionNo: string;
  patientName?: string;
  totalCharge: number;
  discount?: number;
  amountPaid?: number;
  trigger?: React.ReactNode;
  onUpdated?: (billing: { discount: number; amountPaid: number; due: number }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [discountVal, setDiscountVal] = useState(String(discount));
  const [paidVal, setPaidVal] = useState(String(amountPaid));
  const router = useRouter();

  const initialDue = dueAmount(totalCharge, discount, amountPaid);
  const isDueZero = initialDue <= 0;

  const numDiscount = asMoney(discountVal);
  const numPaid = asMoney(paidVal);
  const due = dueAmount(totalCharge, numDiscount, numPaid);
  const isPaid = due <= 0;
  const isPartial = due > 0 && numPaid > 0;

  function markFullPaid() {
    const fullPaid = Math.max(0, totalCharge - numDiscount);
    setPaidVal(String(fullPaid));
    save(fullPaid, numDiscount);
  }

  function save(paid = numPaid, disc = numDiscount) {
    startTransition(async () => {
      const res = await updateOrderPayment({
        orderId,
        discount: disc,
        amountPaid: paid,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Payment updated for ${accessionNo}`);
      onUpdated?.({ discount: disc, amountPaid: paid, due: dueAmount(totalCharge, disc, paid) });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !isDueZero && setOpen(v)}>
      <DialogTrigger asChild disabled={isDueZero}>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={isDueZero}>
            <IndianRupee className="size-3.5" />
            {isDueZero ? "Paid" : "Payment"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Update Payment — {accessionNo}</span>
            {isPaid ? (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                PAID
              </span>
            ) : isPartial ? (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                PARTIAL
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive border border-destructive/20">
                UNPAID
              </span>
            )}
          </DialogTitle>
          {patientName ? (
            <DialogDescription>Patient: {patientName}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 text-sm">
            <span className="text-muted-foreground">Total Bill</span>
            <span className="font-bold text-foreground text-base">{formatInr(totalCharge)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dlg-discount">Discount (₹)</Label>
              <Input
                id="dlg-discount"
                numeric="decimal"
                value={discountVal}
                onChange={(e) => setDiscountVal(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dlg-paid">Amount Paid (₹)</Label>
              <Input
                id="dlg-paid"
                numeric="decimal"
                value={paidVal}
                onChange={(e) => setPaidVal(e.target.value)}
              />
            </div>
          </div>

          <div className={cn("flex items-center justify-between rounded-lg p-3 text-sm font-semibold", due > 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}>
            <span>Balance Due</span>
            <span className="text-base">{formatInr(due)}</span>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:space-x-0">
          {due > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={markFullPaid}
              disabled={pending}
              className="gap-1 text-xs"
            >
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              Mark Full Paid
            </Button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => save()} disabled={pending}>
              {pending ? "Saving…" : "Save Payment"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
