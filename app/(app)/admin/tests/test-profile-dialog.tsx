"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { addCriticalThreshold, addReferenceRange, updateTestProfile } from "@/app/actions/admin";
import { formatAgeBand, formatNumericRange, resolveProfileText, type TestProfile } from "@/lib/test-profile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { FormulaTester } from "./formula-tester.client";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

export function TestProfileDialog({
  test,
  canEdit,
  trigger,
}: {
  test: TestProfile;
  canEdit?: boolean;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formulaValue, setFormulaValue] = useState(test.formula ?? "");
  const resolved = resolveProfileText(test.code, test);

  function saveProfile(formData: FormData) {
    startTransition(async () => {
      const result = await updateTestProfile(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${test.name} profile saved.`);
      router.refresh();
    });
  }

  function saveRange(formData: FormData) {
    startTransition(async () => {
      const result = await addReferenceRange(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Reference range added.");
      router.refresh();
    });
  }

  function saveCritical(formData: FormData) {
    startTransition(async () => {
      const result = await addCriticalThreshold(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Critical threshold added.");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" type="button">
            <BookOpen />
            Profile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {test.name}{" "}
            <span className="font-normal text-muted-foreground">({test.code})</span>
          </DialogTitle>
          <DialogDescription>
            Laboratory profile: specimen, method, ranges, and panic values used for this test.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{test.category.replaceAll("_", " ")}</Badge>
          <Badge variant="secondary">{test.dataType}</Badge>
          {test.isDerived ? <Badge variant="outline">Calculated</Badge> : null}
          {test.panels.map((panel) => (
            <Badge key={panel.code} variant="outline">
              {panel.name}
            </Badge>
          ))}
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ranges">Reference ranges</TabsTrigger>
            <TabsTrigger value="critical">Critical values</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-4">
            {canEdit ? (
              <form action={saveProfile} className="flex flex-col gap-3">
                <input type="hidden" name="testId" value={test.id} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`name-${test.id}`}>Name</Label>
                    <Input id={`name-${test.id}`} name="name" defaultValue={test.name} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`category-${test.id}`}>Category</Label>
                    <NativeSelect id={`category-${test.id}`} name="category" defaultValue={test.category}>
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
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`price-${test.id}`}>Charge (₹)</Label>
                    <Input id={`price-${test.id}`} name="price" numeric="decimal" defaultValue={test.price} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`formula-${test.id}`}>Formula</Label>
                    <Input
                      id={`formula-${test.id}`}
                      name="formula"
                      value={formulaValue}
                      onChange={(e) => setFormulaValue(e.target.value)}
                      placeholder="[Creatinine] or EGFR"
                    />
                  </div>
                </div>
                <FormulaTester formula={formulaValue} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`shortName-${test.id}`}>Short name</Label>
                    <Input id={`shortName-${test.id}`} name="shortName" defaultValue={test.shortName ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`loinc-${test.id}`}>LOINC</Label>
                    <Input id={`loinc-${test.id}`} name="loincCode" defaultValue={test.loincCode ?? ""} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`specimen-${test.id}`}>Specimen</Label>
                    <Input id={`specimen-${test.id}`} name="specimenType" required defaultValue={test.specimenType} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`unit-${test.id}`}>Unit</Label>
                    <Input id={`unit-${test.id}`} name="unit" defaultValue={test.unit ?? ""} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`method-${test.id}`}>Method</Label>
                    <Input id={`method-${test.id}`} name="method" defaultValue={resolved.method ?? ""} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`tat-${test.id}`}>Turnaround (hours)</Label>
                    <Input
                      id={`tat-${test.id}`}
                      name="turnaroundHours"
                      numeric="int"
                      defaultValue={test.turnaroundHours ?? ""}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`desc-${test.id}`}>Clinical profile</Label>
                  <Textarea
                    id={`desc-${test.id}`}
                    name="description"
                    rows={3}
                    defaultValue={resolved.description ?? ""}
                    placeholder="What this test measures and when it is ordered."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`collect-${test.id}`}>Collection notes</Label>
                  <Textarea
                    id={`collect-${test.id}`}
                    name="collectionNotes"
                    rows={2}
                    defaultValue={resolved.collectionNotes ?? ""}
                    placeholder="Fasting, tube type, handling."
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="autoVerifyEligible" defaultChecked={test.autoVerifyEligible} className="size-4" />
                  Eligible for auto-verify when in range
                </label>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Saving…" : "Save profile"}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name" value={test.name} />
                <Field label="Category" value={test.category.replaceAll("_", " ")} />
                <Field label="Charge" value={`₹${test.price}`} />
                <Field label="Formula" value={test.formula} />
                <Field label="Specimen" value={test.specimenType} />
                <Field label="Unit" value={test.unit} />
                <Field label="Method" value={resolved.method} />
                <Field label="Turnaround" value={test.turnaroundHours != null ? `${test.turnaroundHours} hours` : null} />
                <Field label="LOINC" value={test.loincCode} />
                <Field label="Short name" value={test.shortName} />
                <div className="col-span-2">
                  <Field label="Clinical profile" value={resolved.description} />
                </div>
                <div className="col-span-2">
                  <Field label="Collection notes" value={resolved.collectionNotes} />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ranges" className="flex flex-col gap-4">
            {test.referenceRanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reference ranges on file yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {test.referenceRanges.map((range) => (
                  <li key={range.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>
                      {range.gender ?? "All"} · {formatAgeBand(range.ageMinDays, range.ageMaxDays)}
                      {range.isDefault ? <span className="ml-1.5 text-xs text-muted-foreground">default</span> : null}
                    </span>
                    <span className="tabular">{formatNumericRange(range.low, range.high)}</span>
                  </li>
                ))}
              </ul>
            )}
            {canEdit ? (
              <form action={saveRange} className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
                <input type="hidden" name="testId" value={test.id} />
                <div className="col-span-2 text-xs font-medium">Add adult range</div>
                <div className="flex flex-col gap-1.5">
                  <Label>Gender</Label>
                  <NativeSelect name="gender" defaultValue="">
                    <option value="">All</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </NativeSelect>
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="isDefault" defaultChecked className="size-4" />
                    Default
                  </label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Low</Label>
                  <Input name="low" numeric="decimal" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>High</Label>
                  <Input name="high" numeric="decimal" />
                </div>
                <div className="col-span-2">
                  <Button type="submit" size="sm" disabled={pending}>
                    Add range
                  </Button>
                </div>
              </form>
            ) : null}
          </TabsContent>

          <TabsContent value="critical" className="flex flex-col gap-4">
            {test.criticalThresholds.length === 0 ? (
              <p className="text-sm text-muted-foreground">No panic thresholds. Critical call-back will not fire for this test.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                {test.criticalThresholds.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span>{row.gender ?? "All"}</span>
                    <span className="tabular text-destructive">{formatNumericRange(row.low, row.high)}</span>
                  </li>
                ))}
              </ul>
            )}
            {canEdit ? (
              <form action={saveCritical} className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
                <input type="hidden" name="testId" value={test.id} />
                <div className="col-span-2 text-xs font-medium">Add panic threshold</div>
                <div className="flex flex-col gap-1.5">
                  <Label>Panic low</Label>
                  <Input name="low" numeric="decimal" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Panic high</Label>
                  <Input name="high" numeric="decimal" />
                </div>
                <div className="col-span-2">
                  <Button type="submit" size="sm" variant="destructive" disabled={pending}>
                    Add critical value
                  </Button>
                </div>
              </form>
            ) : null}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
