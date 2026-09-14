"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { updatePatient } from "@/app/actions/patients";
import { useDataSync } from "@/components/data-sync";
import { PATIENT_TITLES, extractTitleFromName, genderFromTitle, stripTitlePrefix, type PatientTitle } from "@/lib/patient-name";
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

export type EditablePatient = {
  id: string;
  mrn: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  ageYears?: number | null;
  gender?: string;
  email?: string | null;
  address?: string | null;
};

export function PatientEditDialog({
  patient,
  trigger,
  onUpdated,
}: {
  patient: EditablePatient;
  trigger?: ReactNode;
  onUpdated?: (updated: EditablePatient) => void;
}) {
  const router = useRouter();
  const { patchSnapshot } = useDataSync();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState<PatientTitle | "">(() => extractTitleFromName(patient.firstName));
  const [firstName, setFirstName] = useState(() => stripTitlePrefix(patient.firstName));
  const [lastName, setLastName] = useState(patient.lastName ?? "");
  const [ageYears, setAgeYears] = useState(patient.ageYears != null ? String(patient.ageYears) : "");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER">(
    (patient.gender as "MALE" | "FEMALE" | "OTHER") || "MALE"
  );
  const [phone, setPhone] = useState(patient.phone ?? "");
  const [email, setEmail] = useState(patient.email ?? "");
  const [address, setAddress] = useState(patient.address ?? "");

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        formData.set("id", patient.id);
        const result = await updatePatient(formData);
        if (!result.ok) {
          setError(result.error);
          toast.error(result.error);
          return;
        }

        const updatedData: EditablePatient = {
          id: result.patient.id,
          mrn: result.patient.mrn,
          firstName: result.patient.firstName,
          lastName: result.patient.lastName,
          phone: result.patient.phone,
          ageYears: result.patient.ageYears,
          gender: result.patient.gender,
          email: result.patient.email,
          address: result.patient.address,
        };

        await patchSnapshot((snapshot) => ({
          ...snapshot,
          patients: snapshot.patients.map((p) =>
            p.id === patient.id
              ? {
                  ...p,
                  firstName: updatedData.firstName,
                  lastName: updatedData.lastName ?? null,
                  phone: updatedData.phone ?? null,
                  ageYears: updatedData.ageYears ?? null,
                  gender: updatedData.gender ?? "",
                }
              : p
          ),
        }));

        toast.success(`Updated patient details for ${updatedData.firstName}.`);
        setOpen(false);
        if (onUpdated) {
          onUpdated(updatedData);
        }
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not update patient details.";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          const parsedTitle = extractTitleFromName(patient.firstName);
          setTitle(parsedTitle);
          setFirstName(stripTitlePrefix(patient.firstName));
          setLastName(patient.lastName ?? "");
          setAgeYears(patient.ageYears != null ? String(patient.ageYears) : "");
          setGender((patient.gender as "MALE" | "FEMALE" | "OTHER") || "MALE");
          setPhone(patient.phone ?? "");
          setEmail(patient.email ?? "");
          setAddress(patient.address ?? "");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
            <Pencil className="size-3.5" />
            Edit details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit patient details</DialogTitle>
          <DialogDescription>
            Update demographic and contact information for MRN <span className="font-mono font-medium">{patient.mrn}</span>.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={patient.id} />
          
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-col gap-1.5 w-full sm:w-[80px] shrink-0">
              <Label htmlFor="edit-title">Title</Label>
              <NativeSelect
                id="edit-title"
                name="title"
                className="w-full"
                value={title}
                onChange={(e) => {
                  const next = e.target.value as typeof title;
                  setTitle(next);
                  const autoGender = genderFromTitle(next);
                  if (autoGender) setGender(autoGender);
                }}
              >
                <option value="">Title</option>
                {PATIENT_TITLES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Label htmlFor="edit-firstName">First name</Label>
              <Input
                id="edit-firstName"
                name="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Label htmlFor="edit-lastName">Last name</Label>
              <Input
                id="edit-lastName"
                name="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-ageYears">Age in years</Label>
              <Input
                id="edit-ageYears"
                name="ageYears"
                numeric="int"
                required
                placeholder="Years"
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-gender">Gender</Label>
              <NativeSelect
                id="edit-gender"
                name="gender"
                required
                value={gender}
                onChange={(e) => setGender(e.target.value as typeof gender)}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                name="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-email">Email (optional)</Label>
              <Input
                id="edit-email"
                name="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-address">Address</Label>
            <Input
              id="edit-address"
              name="address"
              placeholder="House / street / city"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <DialogFooter className="mt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
