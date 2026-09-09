"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createTest } from "@/app/actions/admin";
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

export function AddTestDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        await createTest(formData);
        toast.success("Test added to the catalog.");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not add this test. Check that the code is unique.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add test
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add test</DialogTitle>
          <DialogDescription>
            Code must be unique (for example TSH). You can complete the laboratory profile after saving.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" name="code" required placeholder="TSH" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="Thyroid Stimulating Hormone" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <NativeSelect id="category" name="category" defaultValue="CLINICAL_CHEMISTRY">
              <option value="HEMATOLOGY">Hematology</option>
              <option value="CLINICAL_CHEMISTRY">Clinical Chemistry</option>
              <option value="MICROBIOLOGY">Microbiology</option>
              <option value="SEROLOGY_IMMUNOLOGY">Serology/Immunology</option>
              <option value="COAGULATION">Coagulation</option>
              <option value="URINALYSIS">Urinalysis</option>
              <option value="HISTOPATHOLOGY">Histopathology</option>
              <option value="CYTOLOGY">Cytology</option>
              <option value="MOLECULAR">Molecular</option>
              <option value="ENDOCRINE">Endocrine</option>
              <option value="OTHER">Other</option>
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dataType">Result type</Label>
            <NativeSelect id="dataType" name="dataType" defaultValue="NUMERIC">
              <option value="NUMERIC">Numeric</option>
              <option value="TEXT">Free text</option>
              <option value="QUALITATIVE">Qualitative</option>
              <option value="SEMI_QUANTITATIVE">Semi-quantitative</option>
              <option value="ORGANISM_PANEL">Organism panel (microbiology)</option>
            </NativeSelect>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="specimenType">Specimen</Label>
              <Input id="specimenType" name="specimenType" defaultValue="Serum" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="method">Method</Label>
              <Input id="method" name="method" placeholder="IFCC kinetic" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="turnaroundHours">Turnaround (hours)</Label>
              <Input id="turnaroundHours" name="turnaroundHours" type="number" min={0} placeholder="6" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Clinical profile</Label>
            <Input id="description" name="description" placeholder="What this test measures" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collectionNotes">Collection notes</Label>
            <Input id="collectionNotes" name="collectionNotes" placeholder="Fasting, tube type" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="low">Default range low</Label>
              <Input id="low" name="low" type="number" step="any" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="high">Default range high</Label>
              <Input id="high" name="high" type="number" step="any" />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add test"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
