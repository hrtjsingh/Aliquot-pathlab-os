import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { DEFAULT_REPORT_LAYOUT, type ReportLayout } from "@/lib/report-layout";
import { encodeCode39 } from "@/lib/barcode";

type ReportResult = {
  testName: string;
  category: string;
  numericValue: number | null;
  textValue: string | null;
  unit: string | null;
  referenceRangeText: string | null;
  flag: string;
  pathologistNote: string | null;
  grossDescription: string | null;
  microscopicDescription: string | null;
  diagnosis: string | null;
  organismPanel: any;
};

export type ReportData = {
  branch: {
    name: string;
    address: string | null;
    nablNo: string | null;
    isoNo: string | null;
    letterheadUrl: string | null;
  };
  patient: { name: string; age: string; gender: string; mrn: string; phone?: string | null; address?: string | null };
  accessionNo: string;
  referringDoctor: string | null;
  collectedAt: string | null;
  receivedAt: string | null;
  reportedAt: string | null;
  results: ReportResult[];
  pathologistName: string | null;
  pathologistRegNo: string | null;
  isAmended: boolean;
  qrCodeDataUrl?: string | null;
};

function createStyles(layout: ReportLayout) {
  const color = layout.primaryColor;
  const compact = layout.headerStyle === "compact";
  return StyleSheet.create({
    page: { padding: compact ? 24 : 32, fontSize: compact ? 8 : 9, fontFamily: "Helvetica", color: "#14181c" },
    headerRow: {
      flexDirection: layout.headerStyle === "centered" && !layout.showQrCode ? "column" : "row",
      justifyContent: layout.headerStyle === "centered" && !layout.showQrCode ? "center" : "space-between",
      alignItems: layout.headerStyle === "centered" && !layout.showQrCode ? "center" : "flex-start",
      borderBottom: 2,
      borderColor: color,
      paddingBottom: 8,
      marginBottom: 10,
      gap: 6,
    },
    labName: { fontSize: compact ? 12 : 16, fontWeight: 700, color, textAlign: layout.headerStyle === "centered" ? "center" : "left" },
    reportTitle: { fontSize: compact ? 8 : 9, color, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 },
    labMeta: { fontSize: 8, color: "#5b6670", marginTop: 2, textAlign: layout.headerStyle === "centered" ? "center" : "left" },
    accessionMeta: { fontSize: 8, color: "#5b6670", marginTop: 2, textAlign: layout.headerStyle === "centered" ? "center" : "right" },
    logo: { height: compact ? 28 : 36, marginBottom: 4, objectFit: "contain" },
    patientBlock: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, borderBottom: 1, borderColor: "#dfe3e4", paddingBottom: 8 },
    patientCol: { flexDirection: "column", gap: 2 },
    label: { fontSize: 7, color: "#5b6670", textTransform: "uppercase" },
    value: { fontSize: 9, fontWeight: 700 },
    sectionTitle: { fontSize: 10, fontWeight: 700, backgroundColor: "#eef0f1", color, padding: 4, marginTop: 10, marginBottom: 4 },
    tableHeader: { flexDirection: "row", borderBottom: 1, borderColor: "#14181c", paddingBottom: 3, marginBottom: 2 },
    tableRow: { flexDirection: "row", paddingVertical: 2, borderBottom: 0.5, borderColor: "#eef0f1" },
    colParam: { width: layout.showFlags && layout.showReferenceRange ? "34%" : layout.showReferenceRange || layout.showFlags ? "42%" : "52%" },
    colResult: { width: "16%", fontWeight: 700 },
    colUnit: { width: "16%", color: "#5b6670" },
    colRange: { width: "24%", color: "#5b6670" },
    colFlag: { width: "10%", fontWeight: 700 },
    flagHigh: { color: "#a15c00" },
    flagCritical: { color: "#b3261e" },
    comment: { marginTop: 6, fontSize: 8.5, fontStyle: "italic", color },
    footer: { position: "absolute", bottom: 18, left: 32, right: 32, borderTop: 1, borderColor: "#dfe3e4", paddingTop: 6, fontSize: 7.5, color: "#5b6670" },
    signatureBlock: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
    qrBlock: { alignItems: "center", width: 72 },
    qrImage: { width: 64, height: 64 },
    qrCaption: { fontSize: 6.5, color: "#5b6670", marginTop: 3, textAlign: "center" },
    qrId: { fontSize: 7, fontWeight: 700, color, marginTop: 1, textAlign: "center" },
    barcodeRow: { flexDirection: "row", height: 28, marginTop: 4, alignItems: "flex-end" },
    amendedBanner: { backgroundColor: "#b3261e", color: "white", padding: 4, textAlign: "center", fontSize: 9, fontWeight: 700, marginBottom: 8 },
  });
}

function flagStyle(flag: string, styles: ReturnType<typeof createStyles>) {
  if (flag === "CRITICAL_LOW" || flag === "CRITICAL_HIGH") return styles.flagCritical;
  if (flag === "LOW" || flag === "HIGH" || flag === "ABNORMAL") return styles.flagHigh;
  return {};
}
function flagLabel(flag: string) {
  return { NORMAL: "", LOW: "L", HIGH: "H", CRITICAL_LOW: "L*", CRITICAL_HIGH: "H*", ABNORMAL: "Abn" }[flag] ?? "";
}

function contactLine(layout: ReportLayout) {
  return [layout.phone, layout.email, layout.website].filter(Boolean).join("  ·  ");
}

function AccessionBarcode({ text }: { text: string }) {
  const bars = encodeCode39(text);
  return (
    <View style={{ marginTop: 4 }}>
      <View style={{ flexDirection: "row", height: 26, alignItems: "flex-end" }}>
        {bars.map((bar, index) => (
          <View
            key={`${index}-${bar.width}`}
            style={{ width: bar.width, height: 26, backgroundColor: bar.black ? "#14181c" : "#ffffff" }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 7, textAlign: "center", marginTop: 2 }}>{text}</Text>
    </View>
  );
}

export function LabReportDocument({
  data,
  layout = DEFAULT_REPORT_LAYOUT,
}: {
  data: ReportData;
  layout?: ReportLayout;
}) {
  const styles = createStyles(layout);
  const grouped = data.results.reduce<Record<string, ReportResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  const narrativeCategories = new Set(["HISTOPATHOLOGY", "CYTOLOGY"]);
  const microCategory = "MICROBIOLOGY";
  const contact = contactLine(layout);
  const letterhead = data.branch.letterheadUrl;
  const showLogo = Boolean(letterhead && /^https?:\/\//i.test(letterhead));

  const resultWidth = layout.showFlags && layout.showReferenceRange ? "16%" : "20%";
  const unitWidth = layout.showFlags && layout.showReferenceRange ? "16%" : "18%";
  const paramWidth = !layout.showFlags && !layout.showReferenceRange ? "52%" : layout.showFlags && layout.showReferenceRange ? "34%" : "42%";

  const showQr = Boolean(layout.showQrCode && data.qrCodeDataUrl);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.isAmended && <Text style={styles.amendedBanner}>AMENDED REPORT — supersedes previously released report for this accession</Text>}

        <View style={styles.headerRow}>
          <View style={{ alignItems: layout.headerStyle === "centered" ? "center" : "flex-start", flexGrow: 1 }}>
            {showLogo ? <Image src={letterhead as string} style={styles.logo} /> : null}
            <Text style={styles.labName}>{data.branch.name}</Text>
            {layout.subtitle ? <Text style={styles.labMeta}>{layout.subtitle}</Text> : null}
            <Text style={styles.reportTitle}>{layout.reportTitle}</Text>
            {layout.showAddress && data.branch.address ? <Text style={styles.labMeta}>{data.branch.address}</Text> : null}
            {layout.showContact && contact ? <Text style={styles.labMeta}>{contact}</Text> : null}
            {layout.showAccreditation && (data.branch.nablNo || data.branch.isoNo) ? (
              <Text style={styles.labMeta}>
                {[data.branch.nablNo ? `NABL ${data.branch.nablNo}` : null, data.branch.isoNo ? `ISO ${data.branch.isoNo}` : null]
                  .filter(Boolean)
                  .join("  ·  ")}
              </Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.accessionMeta}>Accession: {data.accessionNo}</Text>
            {layout.showCollectionTimes ? (
              <>
                <Text style={styles.accessionMeta}>Collected: {data.collectedAt ?? "—"}</Text>
                <Text style={styles.accessionMeta}>Received: {data.receivedAt ?? "—"}</Text>
                <Text style={styles.accessionMeta}>Reported: {data.reportedAt ?? "—"}</Text>
              </>
            ) : (
              <Text style={styles.accessionMeta}>Reported: {data.reportedAt ?? "—"}</Text>
            )}
            {layout.showBarcode ? <AccessionBarcode text={data.accessionNo} /> : null}
          </View>
          {showQr ? (
            <View style={styles.qrBlock}>
              <Image src={data.qrCodeDataUrl as string} style={styles.qrImage} />
              <Text style={styles.qrCaption}>Scan to view / download</Text>
              <Text style={styles.qrId}>{data.accessionNo}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.patientBlock}>
          <View style={styles.patientCol}>
            <Text style={styles.label}>Patient</Text>
            <Text style={styles.value}>{data.patient.name}</Text>
          </View>
          <View style={styles.patientCol}>
            <Text style={styles.label}>Age / Gender</Text>
            <Text style={styles.value}>
              {data.patient.age} / {data.patient.gender}
            </Text>
          </View>
          {layout.showPatientMrn ? (
            <View style={styles.patientCol}>
              <Text style={styles.label}>MRN</Text>
              <Text style={styles.value}>{data.patient.mrn}</Text>
            </View>
          ) : null}
          {layout.showPatientPhone && data.patient.phone ? (
            <View style={styles.patientCol}>
              <Text style={styles.label}>Mobile</Text>
              <Text style={styles.value}>{data.patient.phone}</Text>
            </View>
          ) : null}
          {layout.showPatientAddress && data.patient.address ? (
            <View style={styles.patientCol}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{data.patient.address}</Text>
            </View>
          ) : null}
          {layout.showReferringDoctor ? (
            <View style={styles.patientCol}>
              <Text style={styles.label}>Referring Doctor</Text>
              <Text style={styles.value}>{data.referringDoctor ?? "—"}</Text>
            </View>
          ) : null}
        </View>

        {Object.entries(grouped).map(([category, results]) => (
          <View key={category} wrap={false}>
            <Text style={styles.sectionTitle}>{category.replaceAll("_", " ")}</Text>

            {narrativeCategories.has(category) ? (
              results.map((r, idx) => (
                <View key={idx} style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: 700, marginBottom: 2 }}>{r.testName}</Text>
                  {r.grossDescription && <Text style={{ marginBottom: 2 }}>Gross: {r.grossDescription}</Text>}
                  {r.microscopicDescription && <Text style={{ marginBottom: 2 }}>Microscopic: {r.microscopicDescription}</Text>}
                  {r.diagnosis && <Text style={{ fontWeight: 700 }}>Diagnosis: {r.diagnosis}</Text>}
                </View>
              ))
            ) : category === microCategory ? (
              results.map((r, idx) => (
                <View key={idx} style={{ marginBottom: 8 }}>
                  <Text style={{ fontWeight: 700 }}>
                    {r.testName}: {r.organismPanel?.organism ?? r.textValue ?? "Pending"}
                  </Text>
                  {r.organismPanel?.colonyCount && <Text>Colony count: {r.organismPanel.colonyCount}</Text>}
                  {Array.isArray(r.organismPanel?.antibiotics) && r.organismPanel.antibiotics.length > 0 && (
                    <View style={{ marginTop: 3 }}>
                      <View style={styles.tableHeader}>
                        <Text style={{ width: "60%" }}>Antibiotic</Text>
                        <Text style={{ width: "40%" }}>Result</Text>
                      </View>
                      {r.organismPanel.antibiotics.map((a: any, i: number) => (
                        <View key={i} style={styles.tableRow}>
                          <Text style={{ width: "60%" }}>{a.drug}</Text>
                          <Text style={{ width: "40%" }}>{a.result}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))
            ) : (
              <View>
                <View style={styles.tableHeader}>
                  <Text style={{ width: paramWidth }}>Parameter</Text>
                  <Text style={{ width: resultWidth, fontWeight: 700 }}>Result</Text>
                  <Text style={{ width: unitWidth, color: "#5b6670" }}>Unit</Text>
                  {layout.showReferenceRange ? <Text style={styles.colRange}>Reference Range</Text> : null}
                  {layout.showFlags ? <Text style={styles.colFlag}>Flag</Text> : null}
                </View>
                {results.map((r, idx) => (
                  <View key={idx} style={styles.tableRow}>
                    <Text style={{ width: paramWidth }}>{r.testName}</Text>
                    <Text style={[{ width: resultWidth, fontWeight: 700 }, flagStyle(r.flag, styles)]}>{r.numericValue ?? r.textValue ?? "—"}</Text>
                    <Text style={{ width: unitWidth, color: "#5b6670" }}>{r.unit ?? ""}</Text>
                    {layout.showReferenceRange ? <Text style={styles.colRange}>{r.referenceRangeText ?? "—"}</Text> : null}
                    {layout.showFlags ? <Text style={[styles.colFlag, flagStyle(r.flag, styles)]}>{flagLabel(r.flag)}</Text> : null}
                  </View>
                ))}
              </View>
            )}
            {results.some((r) => r.pathologistNote) && (
              <Text style={styles.comment}>{results.find((r) => r.pathologistNote)?.pathologistNote}</Text>
            )}
          </View>
        ))}

        {layout.showSignature || layout.signName ? (
          <View style={styles.signatureBlock}>
            {layout.signName ? (
              <View>
                <Text style={styles.labMeta}>{layout.signTitle}</Text>
                <Text style={{ fontWeight: 700 }}>{layout.signName}</Text>
                {layout.signQual ? <Text style={styles.labMeta}>{layout.signQual}</Text> : null}
              </View>
            ) : (
              <View />
            )}
            {layout.showSignature && data.pathologistName ? (
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontWeight: 700 }}>{data.pathologistName}</Text>
                {data.pathologistRegNo && <Text style={styles.labMeta}>Reg. No. {data.pathologistRegNo}</Text>}
                <Text style={styles.labMeta}>Electronically authorized</Text>
              </View>
            ) : (
              <View />
            )}
          </View>
        ) : null}

        {layout.showFooter ? (
          <View style={styles.footer} fixed>
            {layout.footerLine2 ? <Text>{layout.footerLine2}</Text> : null}
            <Text>{layout.footerText}</Text>
            {layout.testsUndertaken ? (
              <Text style={{ marginTop: 4 }}>
                Tests undertaken: {layout.testsUndertaken}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
