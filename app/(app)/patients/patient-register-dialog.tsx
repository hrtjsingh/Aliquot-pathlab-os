"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { createPatient } from "@/app/actions/patients";
import { useDataSync } from "@/components/data-sync";
import { enqueueOp, formEntries, isBrowserOffline, isNetworkError } from "@/lib/offline/outbox";
import { genderFromTitle, PATIENT_TITLES, titledGivenName } from "@/lib/patient-name";
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
  onRegistered?: (patient: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string | null;
    phone?: string | null;
    ageYears?: number | null;
    gender?: string;
  }) => void;
}) {
  const router = useRouter();
  const { patchSnapshot } = useDataSync();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<(typeof PATIENT_TITLES)[number]["value"] | "">("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER" | "">("");

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const phone = String(formData.get("phone") ?? "") || null;
      const firstName = String(formData.get("firstName") ?? "");
      const lastName = String(formData.get("lastName") ?? "") || null;
      const ageRaw = String(formData.get("ageYears") ?? "");
      const ageYears = ageRaw ? Number(ageRaw) : null;
      const selectedTitle = String(formData.get("title") ?? "");
      const selectedGender =
        (String(formData.get("gender") ?? "") as "MALE" | "FEMALE" | "OTHER" | "") ||
        genderFromTitle(selectedTitle) ||
        "";
      const storedFirstName = selectedTitle ? titledGivenName(selectedTitle, firstName) : firstName;

      async function rememberPatient(id: string, mrn: string, storedFirstName: string) {
        await patchSnapshot((snapshot) => {
          if (snapshot.patients.some((patient) => patient.id === id)) return snapshot;
          return {
            ...snapshot,
            patients: [
              { id, mrn, firstName: storedFirstName, lastName, gender: selectedGender, ageYears, phone },
              ...snapshot.patients,
            ],
          };
        });
      }

      async function queuedLocally() {
        const localId = `offline-${crypto.randomUUID()}`;
        await enqueueOp({ type: "createPatient", entries: formEntries(formData), localId });
        await rememberPatient(localId, "pending", storedFirstName);
        toast.success("Patient queued. Tap Sync when you’re back online to register it.");
        setOpen(false);
        if (onRegistered) {
          onRegistered({
            id: localId,
            mrn: "pending",
            firstName: storedFirstName,
            lastName,
            phone,
            ageYears,
            gender: selectedGender,
          });
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
        toast.success(`Patient registered as ${result.mrn}.`);
        setOpen(false);
        setTitle("");
        setGender("");
        await rememberPatient(result.patientId, result.mrn, result.firstName);
        if (onRegistered) {
          onRegistered({
            id: result.patientId,
            mrn: result.mrn,
            firstName: result.firstName,
            lastName: result.lastName,
            phone,
            ageYears: result.ageYears,
            gender: result.gender,
          });
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTitle("");
          setGender("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={onRegistered ? "outline" : "default"} size={onRegistered ? "sm" : "default"}>
          <UserPlus />
          {onRegistered ? "New patient" : "Register patient"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{onRegistered ? "New patient" : "Register patient"}</DialogTitle>
          <DialogDescription>
            Title fills gender. You can still change gender. Age is used for reference ranges. An MRN is assigned automatically when you save.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5 w-full sm:w-[80px] shrink-0">
              <Label htmlFor="title">Title</Label>
              <NativeSelect
                id="title"
                name="title"
                required
                className="w-full"
                value={title}
                onChange={(event) => {
                  const next = event.target.value as typeof title;
                  setTitle(next);
                  const fromTitle = genderFromTitle(next);
                  if (fromTitle) setGender(fromTitle);
                }}
              >
                <option value="" disabled>
                  Title
                </option>
                {PATIENT_TITLES.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.value}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ageYears">Age in years</Label>
              <Input id="ageYears" name="ageYears" numeric="int" required placeholder="Years" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gender">Gender</Label>
              <NativeSelect
                id="gender"
                name="gender"
                required
                value={gender}
                onChange={(event) => setGender(event.target.value as typeof gender)}
              >
                <option value="" disabled>
                  Select
                </option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" name="email" inputMode="email" autoComplete="email" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" placeholder="House / street / city" />
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
