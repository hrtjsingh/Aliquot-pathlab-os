"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { saveLabConfig } from "@/app/actions/lab";
import { DEFAULT_REPORT_LAYOUT, type ReportLayout } from "@/lib/report-layout";
import { cn } from "@/lib/utils";

type BranchFields = {
  id: string;
  name: string;
  code: string;
  address: string;
  nablNo: string;
  isoNo: string;
  letterheadUrl: string;
};

const TOGGLES: Array<{ key: keyof ReportLayout; label: string; hint: string }> = [
  { key: "showAddress", label: "Address", hint: "Print the laboratory address under the name." },
  { key: "showAccreditation", label: "Accreditation", hint: "Show NABL and ISO numbers in the header." },
  { key: "showContact", label: "Phone, email, website", hint: "Print contact details in the header." },
  { key: "showCollectionTimes", label: "Collection timestamps", hint: "Collected, received, and reported times." },
  { key: "showPatientMrn", label: "Patient MRN", hint: "Include the medical record number." },
  { key: "showReferringDoctor", label: "Referring doctor", hint: "Print the referring clinician." },
  { key: "showReferenceRange", label: "Reference range column", hint: "Show the range next to each result." },
  { key: "showFlags", label: "Result flags", hint: "Mark high, low, and critical values." },
  { key: "showSignature", label: "Pathologist signature", hint: "Print the authorizing pathologist." },
  { key: "showFooter", label: "Footer disclaimer", hint: "Print the legal note on every page." },
  { key: "showQrCode", label: "QR code", hint: "Print a scan-to-view QR with the accession ID." },
];

function flagLabel(flag: string) {
  return { NORMAL: "", LOW: "L", HIGH: "H", CRITICAL_LOW: "L*", CRITICAL_HIGH: "H*", ABNORMAL: "Abn" }[flag] ?? "";
}

export function LabConfigForm({
  branch: initialBranch,
  layout: initialLayout,
}: {
  branch: BranchFields;
  layout: ReportLayout;
}) {
  const [pending, startTransition] = useTransition();
  const [branch, setBranch] = useState(initialBranch);
  const [layout, setLayout] = useState<ReportLayout>(initialLayout);

  function setLayoutField<K extends keyof ReportLayout>(key: K, value: ReportLayout[K]) {
    setLayout((current) => ({ ...current, [key]: value }));
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
        layout,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Lab PDF configuration saved. New reports will use this layout.");
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

  const contact = [layout.phone, layout.email, layout.website].filter(Boolean).join("  ·  ");
  const headerCentered = layout.headerStyle === "centered";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
      <div className="flex flex-col gap-6">
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
            <CardDescription>Updates as you edit. Save to apply this layout to released reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border border-border bg-white text-[#14181c] shadow-sm">
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
                {layout.showReferringDoctor ? (
                  <div>
                    <p className="text-[9px] uppercase text-[#5b6670]">Referring Doctor</p>
                    <p className="font-semibold">Dr. Mehta</p>
                  </div>
                ) : null}
              </div>

              <div className="px-4 py-3">
                <p className="mb-2 bg-[#eef0f1] px-2 py-1 text-[11px] font-semibold" style={{ color: layout.primaryColor }}>
                  CLINICAL CHEMISTRY
                </p>
                <table className="w-full text-left text-[10px]">
                  <thead>
                    <tr className="border-b border-[#14181c]">
                      <th className="py-1 font-medium">Parameter</th>
                      <th className="py-1 font-medium">Result</th>
                      <th className="py-1 font-medium">Unit</th>
                      {layout.showReferenceRange ? <th className="py-1 font-medium">Range</th> : null}
                      {layout.showFlags ? <th className="py-1 font-medium">Flag</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: "Hemoglobin", value: "13.4", unit: "g/dL", range: "12.0 – 15.0", flag: "NORMAL" },
                      { name: "Glucose (Fasting)", value: "126", unit: "mg/dL", range: "70 – 100", flag: "HIGH" },
                    ].map((row) => (
                      <tr key={row.name} className="border-b border-[#eef0f1]">
                        <td className="py-1">{row.name}</td>
                        <td className={cn("py-1 font-semibold", row.flag === "HIGH" && "text-[#a15c00]")}>{row.value}</td>
                        <td className="py-1 text-[#5b6670]">{row.unit}</td>
                        {layout.showReferenceRange ? <td className="py-1 text-[#5b6670]">{row.range}</td> : null}
                        {layout.showFlags ? (
                          <td className={cn("py-1 font-semibold", row.flag === "HIGH" && "text-[#a15c00]")}>{flagLabel(row.flag)}</td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[10px] italic" style={{ color: layout.primaryColor }}>
                  Correlate with clinical findings.
                </p>
                {layout.showSignature ? (
                  <div className="mt-4 text-right text-[10px]">
                    <p className="font-semibold">Dr. Anita Rao</p>
                    <p className="text-[#5b6670]">Reg. No. MCI-12345</p>
                    <p className="text-[#5b6670]">Electronically authorized</p>
                  </div>
                ) : null}
              </div>
              {layout.showFooter ? (
                <p className="border-t border-[#dfe3e4] px-4 py-2 text-[9px] leading-relaxed text-[#5b6670]">{layout.footerText}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
