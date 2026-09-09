"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordCriticalValueCall } from "@/app/actions/results";
import { enqueueOp, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstructionAlert } from "@/components/instruction-alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CriticalCallDialog({ orderId, accessionNo }: { orderId: string; accessionNo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const params = {
        orderId,
        notifiedName: String(formData.get("notifiedName")),
        notifiedRole: String(formData.get("notifiedRole") || ""),
        contactMethod: String(formData.get("contactMethod") || "Phone"),
        confirmationNote: String(formData.get("confirmationNote") || ""),
      };
      try {
        if (isBrowserOffline()) {
          await enqueueOp({ type: "recordCriticalValueCall", params });
          toast.success("Call-back queued. It will log when you’re back online.");
          setOpen(false);
          return;
        }
        await recordCriticalValueCall(params);
        toast.success("Critical value call-back logged.");
        setOpen(false);
        router.refresh();
      } catch (error) {
        if (isNetworkError(error)) {
          await enqueueOp({ type: "recordCriticalValueCall", params });
          toast.success("Call-back queued. It will log when you’re back online.");
          setOpen(false);
          return;
        }
        toast.error(error instanceof Error ? error.message : "Could not log the call-back.");
      }
    });
  }

  return (
    <InstructionAlert variant="destructive" title="Critical value. Call-back required." className="items-start">
      <div className="flex flex-col gap-3">
        <p>
          Accession {accessionNo} has a critical result. Notify the clinician, then log who you spoke with before verification can continue.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-fit" type="button">
              Log call-back
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log critical value call-back</DialogTitle>
              <DialogDescription>
                Record the person notified, how you reached them, and that the result was read back.
              </DialogDescription>
            </DialogHeader>
            <form action={submit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notifiedName">Clinician or nurse notified</Label>
                <Input id="notifiedName" name="notifiedName" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notifiedRole">Role</Label>
                <Input id="notifiedRole" name="notifiedRole" placeholder="Attending physician" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="contactMethod">Contact method</Label>
                <Input id="contactMethod" name="contactMethod" defaultValue="Phone" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmationNote">Confirmation note</Label>
                <Input id="confirmationNote" name="confirmationNote" placeholder="Read back and confirmed" />
              </div>
              <DialogFooter>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending ? "Saving…" : "Save call-back"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </InstructionAlert>
  );
}
