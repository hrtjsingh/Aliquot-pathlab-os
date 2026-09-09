"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { createPatient } from "@/app/actions/patients";
import { useDataSync } from "@/components/data-sync";
import { enqueueOp, formEntries, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function PatientRegisterDialog({
  onRegistered,
}: {
  onRegistered?: (patient: { id: string; mrn: string; firstName: string; lastName: string | null }) => void;
}) {
  const router = useRouter();
  const { patchSnapshot } = useDataSync();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const firstName = String(formData.get("firstName") ?? "");
      const lastName = String(formData.get("lastName") ?? "") || null;
      const mrn = String(formData.get("mrn") ?? "");
      const gender = String(formData.get("gender") ?? "");
      const ageRaw = String(formData.get("ageYears") ?? "");
      const ageYears = ageRaw ? Number(ageRaw) : null;

      async function rememberPatient(id: string) {
        await patchSnapshot((snapshot) => {
          if (snapshot.patients.some((patient) => patient.id === id)) return snapshot;
          return {
            ...snapshot,
            patients: [{ id, mrn, firstName, lastName, gender, ageYears }, ...snapshot.patients],
          };
        });
      }

      async function queuedLocally() {
        const localId = `offline-${crypto.randomUUID()}`;
        await enqueueOp({ type: "createPatient", entries: formEntries(formData), localId });
        await rememberPatient(localId);
        toast.success("Patient queued. Tap Sync when you’re back online to register it.");
        setOpen(false);
        if (onRegistered) {
          onRegistered({ id: localId, mrn, firstName, lastName });
        }
      }

      if (isBrowserOffline()) {
        await queuedLocally();
        return;
      }

      try {
        const result = await createPatient(formData);
        if (!result.ok) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
        toast.success("Patient registered. Continue by creating an order.");
        setOpen(false);
        await rememberPatient(result.patientId);
        if (onRegistered) {
          onRegistered({ id: result.patientId, mrn: result.mrn, firstName: result.firstName, lastName: result.lastName });
        } else {
          router.push(`/orders/new?patientId=${result.patientId}`);
        }
      } catch (error) {
        if (isNetworkError(error)) {
          await queuedLocally();
          return;
        }
        const message = error instanceof Error ? error.message : "Could not register this patient.";
        setError(message);
        toast.error(message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={onRegistered ? "outline" : "default"} size={onRegistered ? "sm" : "default"}>
          <UserPlus />
          {onRegistered ? "New patient" : "Register patient"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{onRegistered ? "New patient" : "Register patient"}</DialogTitle>
          <DialogDescription>
            MRN must be unique. After saving, {onRegistered ? "this patient is selected for the order." : "you will be taken to New Order with this patient selected."}
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mrn">MRN</Label>
              <Input id="mrn" name="mrn" required placeholder="MRN-00123" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gender">Gender</Label>
              <NativeSelect id="gender" name="gender" required defaultValue="">
                <option value="" disabled>
                  Select
                </option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" name="dob" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ageYears">Age in years</Label>
              <Input id="ageYears" name="ageYears" type="number" min={0} max={130} placeholder="If DOB unknown" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : onRegistered ? "Register and select" : "Register and create order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
