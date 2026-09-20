"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, Plus, Save, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createReportTemplate,
  deleteReportTemplate,
  duplicateReportTemplate,
  saveLabConfig,
  setDefaultReportTemplate,
  type SavedReportTemplate,
} from "@/app/actions/lab";
import { DEFAULT_REPORT_LAYOUT, ALIQUOT_REPORT_PRESETS, REPORT_TEMPLATES, type ReportLayout } from "@/lib/report-layout";
import { cn } from "@/lib/utils";

type BranchFields = {
  id: string;
  name: string;
  code: string;
  address: string;
  nablNo: string;
  isoNo: string;
  letterheadUrl: string;
  inrIsi: number;
};

const TOGGLES: Array<{ key: keyof ReportLayout; label: string; hint: string }> = [
  { key: "showAddress", label: "Address", hint: "Print the laboratory address under the name." },
  { key: "showAccreditation", label: "Accreditation", hint: "Show NABL and ISO numbers in the header." },
  { key: "showContact", label: "Phone, email, website", hint: "Print contact details in the header." },
  { key: "showCollectionTimes", label: "Collection timestamps", hint: "Collected, received, and reported times." },
  { key: "showPatientMrn", label: "Patient MRN", hint: "Include the medical record number." },
  { key: "showReferringDoctor", label: "Referring doctor", hint: "Print the referring clinician." },
  { key: "showPatientPhone", label: "Patient phone", hint: "Print the registered phone number." },
  { key: "showPatientAddress", label: "Patient address", hint: "Print the registered address." },
  { key: "showReferenceRange", label: "Reference range column", hint: "Show the range next to each result." },
  { key: "showFlags", label: "Result flags", hint: "Mark high, low, and critical values." },
  { key: "showSignature", label: "Pathologist signature", hint: "Print the authorizing pathologist." },
  { key: "showFooter", label: "Footer disclaimer", hint: "Print the legal note on every page." },
  { key: "showQrCode", label: "QR code", hint: "Print a scan-to-view QR with the accession ID." },
  { key: "showBarcode", label: "Accession barcode", hint: "Print a Code 39 barcode for the accession number." },
  { key: "startNewPageForGroup", label: "New page per group", hint: "Print each booked package on its own page, with header repeated." },
  { key: "showLetterhead", label: "Letterhead", hint: "Print lab name and header. Off = pre-printed stationery." },
  { key: "showMethod", label: "Method under test", hint: "Italic method line under each parameter, like Colour Report with Method." },
  { key: "showGroupDescription", label: "Group description", hint: "Print the package / profile description under the group banner." },
];

export function LabConfigForm({
  branch: initialBranch,
  layout: initialLayout,
  templates: initialTemplates,
}: {
  branch: BranchFields;
  layout: ReportLayout;
  templates: SavedReportTemplate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [branch, setBranch] = useState(initialBranch);
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState(
    initialTemplates.find((row) => row.isDefault)?.id ?? initialTemplates[0]?.id ?? ""
  );
  const [templateName, setTemplateName] = useState(
    initialTemplates.find((row) => row.isDefault)?.name ?? initialTemplates[0]?.name ?? "Standard (Aliquot)"
  );
  const [layout, setLayout] = useState<ReportLayout>(initialLayout);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPreset, setNewPreset] = useState(ALIQUOT_REPORT_PRESETS[0]?.key ?? "standard");

  const selected = templates.find((row) => row.id === selectedId);

  function setLayoutField<K extends keyof ReportLayout>(key: K, value: ReportLayout[K]) {
    setLayout((current) => ({ ...current, [key]: value }));
  }

  function selectTemplate(row: SavedReportTemplate) {
    setSelectedId(row.id);
    setTemplateName(row.name);
    setLayout(row.layout);
  }

  function save() {
    startTransition(async () => {
      const result = await saveLabConfig({
        branchId: branch.id,
        name: branch.name,
        address: branch.address,
        nablNo: branch.nablNo,
        isoNo: branch.isoNo,
        letterheadUrl: branch.letterheadUrl,
        inrIsi: Number(branch.inrIsi) || 1,
        layout,
        templateId: selectedId,
        templateName,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTemplates((current) =>
        current.map((row) => ({
          ...row,
          isDefault: row.id === selectedId,
          name: row.id === selectedId ? templateName.trim() || row.name : row.name,
          layout: row.id === selectedId ? layout : row.layout,
        }))
      );
      toast.success("Saved. Released reports now use this template.");
      router.refresh();
    });
  }

  async function downloadSample() {
    try {
      const response = await fetch("/api/admin/report-preview.pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch, layout }),
      });
      if (!response.ok) throw new Error("Could not build the sample PDF.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not build the sample PDF.");
    }
  }

  function createFromPreset() {
    startTransition(async () => {
      const result = await createReportTemplate({
        branchId: branch.id,
        name: newName.trim() || ALIQUOT_REPORT_PRESETS.find((row) => row.key === newPreset)?.name || "New template",
        presetKey: newPreset,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setTemplates((current) => [...current, result.template].sort((a, b) => a.name.localeCompare(b.name)));
      selectTemplate(result.template);
      setNewName("");
      setNewOpen(false);
      toast.success(`${result.template.name} created.`);
      router.refresh();
    });
  }

  const contact = [layout.phone, layout.email, layout.website].filter(Boolean).join("  ·  ");
  const headerCentered = layout.headerStyle === "centered";
  const formatKey = layout.formatKey || "patho_standard";
  const pathoPreview = formatKey.startsWith("patho_");
  const colourAbnormal = formatKey === "patho_colour" || formatKey === "patho_colour_method";
  const formatLabel =
    ALIQUOT_REPORT_PRESETS.find((row) => row.layout.formatKey === formatKey)?.name ??
    REPORT_TEMPLATES.find((row) => row.id === layout.templateId)?.name ??
    "Custom";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Report templates</CardTitle>
              <CardDescription>
                Aliquot formats: Standard, Colour, Colour with Method, Different Profiles, Pre-printed letterhead.
                Save configuration prints the selected template on released reports.
              </CardDescription>
            </div>
            <Dialog open={newOpen} onOpenChange={setNewOpen}>
              <DialogTrigger asChild>
                <Button type="button" size="sm">
                  <Plus />
                  New template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create report template</DialogTitle>
                  <DialogDescription>Start from an Aliquot format, then edit colours and fields.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="newTemplateName">Name</Label>
                    <Input
                      id="newTemplateName"
                      value={newName}
                      placeholder="Evening OPD colour"
                      onChange={(event) => setNewName(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="newPreset">Based on</Label>
                    <NativeSelect id="newPreset" value={newPreset} onChange={(event) => setNewPreset(event.target.value)}>
                      {ALIQUOT_REPORT_PRESETS.map((preset) => (
                        <option key={preset.key} value={preset.key}>
                          {preset.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <p className="text-xs text-muted-foreground">
                      {ALIQUOT_REPORT_PRESETS.find((row) => row.key === newPreset)?.description}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" onClick={createFromPreset} disabled={pending}>
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {templates.map((row) => {
                const isSelected = row.id === selectedId;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selectTemplate(row)}
                    className={cn(
                      "flex flex-col text-left rounded-lg border px-3 py-2.5 transition-all",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:bg-secondary/50"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{row.name}</span>
                      {row.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                    </span>
                    <span className="mt-1 text-[11px] text-muted-foreground">
                      {ALIQUOT_REPORT_PRESETS.find((preset) => preset.layout.formatKey === row.layout.formatKey)?.name ??
                        REPORT_TEMPLATES.find((tmpl) => tmpl.id === row.layout.templateId)?.name ??
                        row.layout.templateId}
                      {row.layout.showLetterhead === false ? " · no header" : ""}
                      {row.layout.showMethod ? " · method" : " · no method"}
                      {row.layout.formatKey === "patho_colour" || row.layout.formatKey === "patho_colour_method"
                        ? " · red H/L"
                        : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="templateName">Selected template name</Label>
                <Input id="templateName" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || !selected || selected.isDefault}
                  onClick={() => {
                    if (!selected) return;
                    startTransition(async () => {
                      const result = await setDefaultReportTemplate(selected.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setTemplates((current) => current.map((row) => ({ ...row, isDefault: row.id === selected.id })));
                      toast.success(`${selected.name} is now the default print template.`);
                      router.refresh();
                    });
                  }}
                >
                  <Star />
                  Set default
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || !selected}
                  onClick={() => {
                    if (!selected) return;
                    startTransition(async () => {
                      const result = await duplicateReportTemplate(selected.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      setTemplates((current) => [...current, result.template]);
                      selectTemplate(result.template);
                      toast.success(`Duplicated as ${result.template.name}.`);
                      router.refresh();
                    });
                  }}
                >
                  <Copy />
                  Duplicate
                </Button>
                {selected && !selected.isDefault ? (
                  <ConfirmDialog
                    title="Delete this template?"
                    description={`${selected.name} will be removed. Released reports already printed are not changed.`}
                    confirmLabel="Delete template"
                    variant="destructive"
                    successMessage="Template deleted."
                    trigger={
                      <Button type="button" size="sm" variant="outline" disabled={pending}>
                        <Trash2 />
                        Delete
                      </Button>
                    }
                    onConfirm={async () => {
                      const result = await deleteReportTemplate(selected.id);
                      if (!result.ok) return result;
                      const remaining = templates.filter((row) => row.id !== selected.id);
                      setTemplates(remaining);
                      const next = remaining.find((row) => row.isDefault) ?? remaining[0];
                      if (next) selectTemplate(next);
                      router.refresh();
                      return result;
                    }}
                  />
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Laboratory letterhead</CardTitle>
            <CardDescription>
              Branch {branch.code}. This name and address appear at the top of every report PDF.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="labName">Laboratory name</Label>
              <Input id="labName" value={branch.name} onChange={(event) => setBranch({ ...branch, name: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="labAddress">Address</Label>
              <Textarea id="labAddress" rows={2} value={branch.address} onChange={(event) => setBranch({ ...branch, address: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nablNo">NABL number</Label>
              <Input id="nablNo" value={branch.nablNo} onChange={(event) => setBranch({ ...branch, nablNo: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="isoNo">ISO number</Label>
              <Input id="isoNo" value={branch.isoNo} onChange={(event) => setBranch({ ...branch, isoNo: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inrIsi">INR reagent ISI</Label>
              <Input
                id="inrIsi"
                type="number"
                step="0.01"
                min="0.5"
                value={branch.inrIsi}
                onChange={(event) => setBranch({ ...branch, inrIsi: Number(event.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">Used as INR = (Patient PT / Control PT) ^ ISI. Typical lots are 0.9–1.4.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={layout.phone} onChange={(event) => setLayoutField("phone", event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={layout.email} onChange={(event) => setLayoutField("email", event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={layout.website} onChange={(event) => setLayoutField("website", event.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="subtitle">Letterhead subtitle</Label>
              <Input
                id="subtitle"
                value={layout.subtitle}
                placeholder="Pathology & Clinical Laboratory"
                onChange={(event) => setLayoutField("subtitle", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="letterheadUrl">Logo URL</Label>
              <Input
                id="letterheadUrl"
                value={branch.letterheadUrl}
                placeholder="https://…"
                onChange={(event) => setBranch({ ...branch, letterheadUrl: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">Optional. Use a public HTTPS image. Leave blank to print the lab name only.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skin (visual style)</CardTitle>
            <CardDescription>Colour and header chrome for the selected template.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {REPORT_TEMPLATES.map((tmpl) => {
                const isSelected = (layout.templateId || "shiv_clinical") === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => {
                      setLayout((curr) => ({
                        ...curr,
                        templateId: tmpl.id,
                        primaryColor: tmpl.defaultColor,
                        formatKey: "custom",
                      }));
                    }}
                    className={cn(
                      "flex flex-col text-left p-3 rounded-lg border transition-all cursor-pointer",
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                        : "border-border hover:border-muted-foreground/30 hover:bg-secondary/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm text-foreground">{tmpl.name}</span>
                      <span
                        className="size-3.5 rounded-full border border-black/10 shrink-0"
                        style={{ backgroundColor: tmpl.defaultColor }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{tmpl.description}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>PDF layout</CardTitle>
            <CardDescription>Choose header style, ink color, and which result columns print.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reportTitle">Report title</Label>
                <Input id="reportTitle" value={layout.reportTitle} onChange={(event) => setLayoutField("reportTitle", event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="headerStyle">Header style</Label>
                <NativeSelect
                  id="headerStyle"
                  value={layout.headerStyle}
                  onChange={(event) => setLayoutField("headerStyle", event.target.value as ReportLayout["headerStyle"])}
                >
                  <option value="classic">Classic — name left, accession right</option>
                  <option value="centered">Centered letterhead</option>
                  <option value="compact">Compact</option>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="primaryColor">Header color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={layout.primaryColor}
                    onChange={(event) => setLayoutField("primaryColor", event.target.value)}
                    className="h-9 w-12 cursor-pointer p-1"
                  />
                  <Input
                    value={layout.primaryColor}
                    onChange={(event) => setLayoutField("primaryColor", event.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TOGGLES.map((item) => (
                <label key={item.key} className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary/60">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-accent"
                    checked={Boolean(layout[item.key])}
                    onChange={(event) => setLayoutField(item.key, event.target.checked as ReportLayout[typeof item.key])}
                  />
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="footerLine2">Footer line 2</Label>
              <Input
                id="footerLine2"
                value={layout.footerLine2}
                placeholder="Kindly correlate clinically."
                onChange={(event) => setLayoutField("footerLine2", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signTitle">Checked-by title</Label>
                <Input id="signTitle" value={layout.signTitle} onChange={(event) => setLayoutField("signTitle", event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signName">Checked-by name</Label>
                <Input id="signName" value={layout.signName} onChange={(event) => setLayoutField("signName", event.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signQual">Checked-by qualification</Label>
                <Input id="signQual" value={layout.signQual} onChange={(event) => setLayoutField("signQual", event.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="testsUndertaken">Tests undertaken</Label>
              <Input
                id="testsUndertaken"
                value={layout.testsUndertaken}
                placeholder="Biochemistry, Hematology, Immunoassay"
                onChange={(event) => setLayoutField("testsUndertaken", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="footerText">Footer disclaimer</Label>
              <Textarea id="footerText" rows={4} value={layout.footerText} onChange={(event) => setLayoutField("footerText", event.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending}>
            <Save />
            {pending ? "Saving…" : "Save configuration"}
          </Button>
          <Button type="button" variant="outline" onClick={downloadSample} disabled={pending}>
            <Download />
            Download sample PDF
          </Button>
        </div>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>
              {formatLabel}. Click a template on the left, then download sample PDF — each Aliquot format prints differently.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className={cn("overflow-hidden rounded-md border border-border bg-white text-[#14181c] shadow-sm", pathoPreview && "font-serif")}>
              <p className="bg-[#0f172a] px-3 py-1 text-center text-[10px] font-sans font-semibold tracking-wide text-white">
                {formatLabel}
              </p>
              {layout.showLetterhead !== false ? (
              <div
                className={cn(
                  "border-b-2 px-4 py-3",
                  headerCentered && !layout.showQrCode ? "text-center" : "flex justify-between gap-3"
                )}
                style={{ borderColor: layout.primaryColor }}
              >
                <div className={headerCentered && !layout.showQrCode ? "flex flex-col items-center" : ""}>
                  {branch.letterheadUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branch.letterheadUrl} alt="" className="mb-1 h-8 object-contain" />
                  ) : null}
                  <p className="text-base font-semibold" style={{ color: layout.primaryColor }}>
                    {branch.name || "Laboratory"}
                  </p>
                  {layout.subtitle ? <p className="text-[10px] text-[#5b6670]">{layout.subtitle}</p> : null}
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: layout.primaryColor }}>
                    {layout.reportTitle || DEFAULT_REPORT_LAYOUT.reportTitle}
                  </p>
                  {layout.showAddress && branch.address ? <p className="mt-1 text-[10px] text-[#5b6670]">{branch.address}</p> : null}
                  {layout.showContact && contact ? <p className="text-[10px] text-[#5b6670]">{contact}</p> : null}
                  {layout.showAccreditation && (branch.nablNo || branch.isoNo) ? (
                    <p className="text-[10px] text-[#5b6670]">
                      {[branch.nablNo ? `NABL ${branch.nablNo}` : null, branch.isoNo ? `ISO ${branch.isoNo}` : null].filter(Boolean).join("  ·  ")}
                    </p>
                  ) : null}
                </div>
                <div className={cn("text-[10px] text-[#5b6670]", headerCentered && !layout.showQrCode ? "mt-2" : "text-right")}>
                  <p>Accession: MAIN-SAMPLE</p>
                  {layout.showCollectionTimes ? (
                    <>
                      <p>Collected: 09 Sep 2026, 08:10</p>
                      <p>Received: 09 Sep 2026, 08:25</p>
                    </>
                  ) : null}
                  <p>Reported: 09 Sep 2026, 11:40</p>
                  {layout.showBarcode ? (
                    <div className="mt-1 flex h-4 items-end justify-end gap-px" aria-hidden>
                      {Array.from({ length: 18 }).map((_, i) => (
                        <span key={i} className="bg-[#14181c]" style={{ width: i % 3 === 0 ? 2 : 1, height: "100%" }} />
                      ))}
                    </div>
                  ) : null}
                </div>
                {layout.showQrCode ? (
                  <div className="flex w-16 shrink-0 flex-col items-center">
                    <div
                      className="grid size-14 grid-cols-5 gap-px bg-[#14181c] p-0.5"
                      aria-hidden
                    >
                      {Array.from({ length: 25 }).map((_, i) => (
                        <span key={i} className={i % 3 === 0 ? "bg-white" : "bg-[#14181c]"} />
                      ))}
                    </div>
                    <p className="mt-1 text-center text-[8px] leading-tight text-[#5b6670]">Scan to view</p>
                    <p className="text-center text-[8px] font-semibold">MAIN-SAMPLE</p>
                  </div>
                ) : null}
              </div>
              ) : (
                <p className="px-4 py-2 text-center text-[10px] italic text-[#64748b]">Letterhead omitted — pre-printed stationery</p>
              )}

              <div className="flex justify-between gap-2 border-b border-[#dfe3e4] px-4 py-2 text-[11px]">
                <div>
                  <p className="text-[9px] uppercase text-[#5b6670]">Patient</p>
                  <p className="font-semibold">Anita Kapoor</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase text-[#5b6670]">Age / Gender</p>
                  <p className="font-semibold">42y / FEMALE</p>
                </div>
                {layout.showPatientMrn ? (
                  <div>
                    <p className="text-[9px] uppercase text-[#5b6670]">MRN</p>
                    <p className="font-semibold">MRN-1001</p>
                  </div>
                ) : null}
                {layout.showPatientPhone ? (
                  <div>
                    <p className="text-[9px] uppercase text-[#5b6670]">Phone</p>
                    <p className="font-semibold">98765 43210</p>
                  </div>
                ) : null}
                {layout.showPatientAddress ? (
                  <div>
                    <p className="text-[9px] uppercase text-[#5b6670]">Address</p>
                    <p className="font-semibold">12 Clinical Avenue</p>
                  </div>
                ) : null}
                {layout.showReferringDoctor ? (
                  <div>
                    <p className="text-[9px] uppercase text-[#5b6670]">Referring Doctor</p>
                    <p className="font-semibold">Dr. Mehta</p>
                  </div>
                ) : null}
              </div>

              <div className="px-4 py-3">
                {formatKey === "patho_standard" ? (
                  <p className="mb-1 text-[12px] font-bold">CBC</p>
                ) : formatKey === "patho_profiles" ? (
                  <p className="mb-2 border border-black/40 bg-[#CED8E0] py-1 text-center text-[12px] font-bold">CBC</p>
                ) : formatKey === "patho_colour" || formatKey === "patho_colour_method" ? (
                  <p className="mb-2 py-1 text-center text-[11px] font-bold uppercase text-white" style={{ backgroundColor: layout.primaryColor }}>
                    CBC
                  </p>
                ) : formatKey === "patho_preprint" ? (
                  <p className="mb-2 border-b border-black pb-1 text-[12px] font-bold">CBC</p>
                ) : (
                  <p className="mb-1 bg-[#eef0f1] px-2 py-1 text-[11px] font-semibold uppercase" style={{ color: layout.primaryColor }}>
                    CBC
                  </p>
                )}
                {layout.showGroupDescription !== false ? (
                  <p className="mb-2 px-0 text-[9px] italic text-[#5b6670]">Complete Blood Count. Specimen: EDTA whole blood.</p>
                ) : null}
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-[#14181c]">
                      <th className="py-1 font-medium">{formatKey === "patho_profiles" ? "Test Name" : "Parameter"}</th>
                      <th className="py-1 font-medium">{formatKey === "patho_profiles" ? "Patient Value" : "Result"}</th>
                      <th className="py-1 font-medium">Unit</th>
                      {layout.showReferenceRange ? (
                        <th className="py-1 font-medium">{formatKey === "patho_profiles" ? "Reference Range" : "Range"}</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#eef0f1]">
                      <td className="py-1">
                        Hemoglobin
                        {layout.showMethod !== false ? (
                          <span className="block text-[8px] italic text-[#5b6670]">Automated CBC, colorimetric</span>
                        ) : null}
                      </td>
                      <td className="py-1 font-semibold">13.4</td>
                      <td className="py-1 text-[#5b6670]">g/dL</td>
                      {layout.showReferenceRange ? <td className="py-1 text-[#5b6670]">12.0 – 15.0</td> : null}
                    </tr>
                  </tbody>
                </table>
                {layout.startNewPageForGroup ? (
                  <p className="my-2 border-t border-dashed border-[#cbd5e1] pt-2 text-center text-[8px] italic text-[#64748b]">
                    Page break · next profile
                  </p>
                ) : null}
                {formatKey === "patho_standard" ? (
                  <p className="mb-1 mt-2 text-[12px] font-bold">Glucose (Fasting)</p>
                ) : formatKey === "patho_profiles" ? (
                  <p className="mb-2 mt-2 border border-black/40 bg-[#CED8E0] py-1 text-center text-[12px] font-bold">Glucose (Fasting)</p>
                ) : formatKey === "patho_colour" || formatKey === "patho_colour_method" ? (
                  <p className="mb-2 mt-2 py-1 text-center text-[11px] font-bold uppercase text-white" style={{ backgroundColor: layout.primaryColor }}>
                    Glucose (Fasting)
                  </p>
                ) : formatKey === "patho_preprint" ? (
                  <p className="mb-2 mt-2 border-b border-black pb-1 text-[12px] font-bold">Glucose (Fasting)</p>
                ) : (
                  <p className="mb-1 mt-2 bg-[#eef0f1] px-2 py-1 text-[11px] font-semibold uppercase" style={{ color: layout.primaryColor }}>
                    Glucose (Fasting)
                  </p>
                )}
                {layout.showGroupDescription !== false ? (
                  <p className="mb-2 text-[9px] italic text-[#5b6670]">Fasting blood glucose. Specimen: Serum / fluoride plasma.</p>
                ) : null}
                <table className="w-full text-left text-[10px]">
                  <tbody>
                    <tr className="border-b border-[#eef0f1]">
                      <td className="py-1">
                        Glucose (Fasting)
                        {layout.showMethod !== false ? (
                          <span className="block text-[8px] italic text-[#5b6670]">Hexokinase</span>
                        ) : null}
                      </td>
                      <td
                        className={cn("py-1 font-semibold underline", colourAbnormal ? "text-[#cc0000]" : "text-[#14181c]")}
                      >
                        126
                      </td>
                      <td className="py-1 text-[#5b6670]">mg/dL</td>
                      {layout.showReferenceRange ? <td className="py-1 text-[#5b6670]">70 – 100</td> : null}
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-[10px] italic" style={{ color: colourAbnormal ? "#cc0000" : layout.primaryColor }}>
                  Correlate with clinical findings.
                </p>
                {layout.showSignature || layout.signName ? (
                  <div className="mt-4 flex justify-between text-[10px]">
                    {layout.signName ? (
                      <div>
                        <p className="text-[#5b6670]">{layout.signTitle || "Checked By"}</p>
                        <p className="font-semibold">{layout.signName}</p>
                        {layout.signQual ? <p className="text-[#5b6670]">{layout.signQual}</p> : null}
                      </div>
                    ) : (
                      <span />
                    )}
                    {layout.showSignature ? (
                      <div className="text-right">
                        <p className="font-semibold">Dr. Anita Rao</p>
                        <p className="text-[#5b6670]">Reg. No. MCI-12345</p>
                        <p className="text-[#5b6670]">Electronically authorized</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {layout.showFooter ? (
                <div className="border-t border-[#dfe3e4] px-4 py-2 text-[9px] leading-relaxed text-[#5b6670]">
                  {layout.footerLine2 ? <p>{layout.footerLine2}</p> : null}
                  <p>{layout.footerText}</p>
                  {layout.testsUndertaken ? <p className="mt-1">Tests undertaken: {layout.testsUndertaken}</p> : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
