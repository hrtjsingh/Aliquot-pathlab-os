import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Svg, Path } from "@react-pdf/renderer";
import { DEFAULT_REPORT_LAYOUT, type ReportLayout, type ReportTemplateId } from "@/lib/report-layout";
import { encodeCode39 } from "@/lib/barcode";

type ReportResult = {
  testName: string;
  category: string;
  numericValue: number | null;
  textValue: string | null;
  unit: string | null;
  referenceRangeText: string | null;
  flag: string;
  isDerived: boolean;
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

function formatResultValue(r: ReportResult): string {
  if (r.numericValue == null) return r.textValue ?? "—";
  if (r.isDerived) return r.numericValue.toFixed(2);
  return String(r.numericValue);
}

function MicroscopeSvg({ color = "#c01515" }: { color?: string }) {
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24">
      <Path
        d="M6 18h12M10 21h4M10 14h4M9 14v4M15 14v4M12 4a3 3 0 0 1 3-3z"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RedCrossSvg({ color = "#c01515" }: { color?: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24">
      <Path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7V2z" fill={color} />
    </Svg>
  );
}

function AccessionBarcode({ text }: { text: string }) {
  const bars = encodeCode39(text);
  return (
    <View style={{ marginTop: 2, alignItems: "center" }}>
      <View style={{ flexDirection: "row", height: 22, alignItems: "flex-end" }}>
        {bars.map((bar, index) => (
          <View
            key={`${index}-${bar.width}`}
            style={{ width: bar.width, height: 22, backgroundColor: bar.black ? "#14181c" : "#ffffff" }}
          />
        ))}
      </View>
      <Text style={{ fontSize: 6.5, textAlign: "center", marginTop: 1 }}>{text}</Text>
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
  const templateId: ReportTemplateId = layout.templateId || "shiv_clinical";
  const primaryColor = layout.primaryColor || (templateId === "shiv_clinical" ? "#c01515" : templateId === "modern_teal" ? "#0f766e" : templateId === "classic_navy" ? "#1e3a8a" : templateId === "clean_minimal" ? "#334155" : "#047857");

  // Check By Name from Lab Config takes precedence over current user / authorizing pathologist
  const checkedByName = layout.signName ? layout.signName : (data.pathologistName ?? "Authorized Signatory");
  const checkedByTitle = layout.signTitle || "Checked By";
  const checkedByQual = layout.signQual || "B.A., D.M.L.T";

  const grouped = data.results.reduce<Record<string, ReportResult[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  const narrativeCategories = new Set(["HISTOPATHOLOGY", "CYTOLOGY"]);
  const microCategory = "MICROBIOLOGY";
  const nowStr = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const showQr = Boolean(layout.showQrCode && data.qrCodeDataUrl);

  const basePageStyle = {
    paddingTop: 24,
    paddingBottom: templateId === "shiv_clinical" ? 72 : 54,
    paddingHorizontal: 28,
    fontSize: 8.5 as const,
    fontFamily: "Helvetica",
    color: "#14181c",
  };

  return (
    <Document>
      <Page size="A4" style={basePageStyle}>
        {data.isAmended && (
          <Text style={{ backgroundColor: primaryColor, color: "white", padding: 3, textAlign: "center", fontSize: 8.5, fontWeight: 700, marginBottom: 6 }}>
            AMENDED REPORT — supersedes previously released report for this accession
          </Text>
        )}

        {/* ========================================================================= */}
        {/* HEADER SECTION BY TEMPLATE                                                */}
        {/* ========================================================================= */}
        {templateId === "shiv_clinical" && (
          <View style={{ alignItems: "center", marginBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 2 }}>
              <MicroscopeSvg color={primaryColor} />
              <View style={{ borderWidth: 1.5, borderColor: "#14181c", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 1, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: "#14181c", letterSpacing: 1 }}>SCL</Text>
              </View>
              <RedCrossSvg color={primaryColor} />
            </View>
            <Text style={{ fontSize: 19, fontWeight: 700, color: primaryColor, textAlign: "center", letterSpacing: 0.5, marginTop: 1, marginBottom: 2 }}>
              {data.branch.name || "SHIV CLINICAL LABORATORY"}
            </Text>
            <Text style={{ fontSize: 8, fontWeight: 700, color: "#14181c", textAlign: "center", marginBottom: 2 }}>
              {data.branch.address || "Naraingarh Road, Sethi Market, Baldev Nagar,Ambala."}
            </Text>
            <Text style={{ fontSize: 8, fontWeight: 700, color: "#14181c", textAlign: "center" }}>
              Mob.: {layout.phone || "98966-86055, 87081-52193, 90347-94146"}
            </Text>
            <View style={{ borderBottomWidth: 1, borderColor: "#14181c", width: "100%", marginTop: 5, marginBottom: 6 }} />
          </View>
        )}

        {templateId === "modern_teal" && (
          <View style={{ marginBottom: 8, borderLeftWidth: 4, borderColor: primaryColor, paddingLeft: 10, paddingVertical: 2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ width: "70%" }}>
                <Text style={{ fontSize: 18, fontWeight: 700, color: primaryColor, letterSpacing: 0.3 }}>{data.branch.name}</Text>
                {layout.subtitle ? <Text style={{ fontSize: 8, color: "#475569", marginTop: 1 }}>{layout.subtitle}</Text> : null}
                <Text style={{ fontSize: 8, color: "#334155", marginTop: 2 }}>{data.branch.address}</Text>
                {layout.phone ? <Text style={{ fontSize: 7.5, color: "#64748b" }}>Tel: {layout.phone}</Text> : null}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: primaryColor, letterSpacing: 0.5 }}>{layout.reportTitle || "LABORATORY REPORT"}</Text>
                <Text style={{ fontSize: 7.5, color: "#64748b", marginTop: 2 }}>ACC: {data.accessionNo}</Text>
              </View>
            </View>
            <View style={{ borderBottomWidth: 1, borderColor: "#cbd5e1", marginTop: 6 }} />
          </View>
        )}

        {templateId === "classic_navy" && (
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: primaryColor, textAlign: "center", letterSpacing: 0.8 }}>{data.branch.name}</Text>
            {layout.subtitle ? <Text style={{ fontSize: 8.5, color: "#475569", textAlign: "center", marginTop: 1 }}>{layout.subtitle}</Text> : null}
            <Text style={{ fontSize: 8, color: "#334155", textAlign: "center", marginTop: 2 }}>{data.branch.address}</Text>
            <Text style={{ fontSize: 8, color: "#64748b", textAlign: "center", marginTop: 1 }}>
              {[layout.phone ? `Phone: ${layout.phone}` : null, layout.email ? `Email: ${layout.email}` : null].filter(Boolean).join("  |  ")}
            </Text>
            <View style={{ borderBottomWidth: 2, borderColor: primaryColor, width: "100%", marginTop: 5, marginBottom: 2 }} />
            <View style={{ borderBottomWidth: 0.5, borderColor: primaryColor, width: "100%", marginBottom: 6 }} />
          </View>
        )}

        {templateId === "clean_minimal" && (
          <View style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderColor: "#e2e8f0", paddingBottom: 6 }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{data.branch.name}</Text>
                <Text style={{ fontSize: 8, color: "#64748b", marginTop: 1 }}>{data.branch.address}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: "#334155" }}>DIAGNOSTIC REPORT</Text>
                <Text style={{ fontSize: 7.5, color: "#64748b" }}>ID: {data.accessionNo}</Text>
              </View>
            </View>
          </View>
        )}

        {templateId === "bold_emerald" && (
          <View style={{ marginBottom: 8, borderBottomWidth: 2, borderColor: "#d97706", paddingBottom: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: 700, color: primaryColor, letterSpacing: 0.5 }}>{data.branch.name}</Text>
                <Text style={{ fontSize: 8, color: "#334155", marginTop: 1 }}>{data.branch.address}</Text>
                {layout.phone ? <Text style={{ fontSize: 7.5, color: "#047857" }}>Contact: {layout.phone}</Text> : null}
              </View>
              <View style={{ backgroundColor: primaryColor, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 3 }}>
                <Text style={{ color: "#ffffff", fontSize: 9, fontWeight: 700, letterSpacing: 0.8 }}>PATHOLOGY REPORT</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* PATIENT INFORMATION BLOCK BY TEMPLATE                                     */}
        {/* ========================================================================= */}
        {templateId === "shiv_clinical" ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#14181c", paddingVertical: 4, marginBottom: 6 }}>
            <View style={{ width: "45%", flexDirection: "column", gap: 2 }}>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Patient Name :</Text><Text style={{ fontSize: 8.5, fontWeight: 700, color: "#14181c" }}>{data.patient.name}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Age/Sex      :</Text><Text style={{ fontSize: 8, color: "#14181c" }}>{data.patient.age} / {data.patient.gender}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Reffered by  :</Text><Text style={{ fontSize: 8, color: "#14181c" }}>{data.referringDoctor ?? "SELF"}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Address      :</Text><Text style={{ fontSize: 8, color: "#14181c" }}>{data.patient.address || ""}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Mobile No    :</Text><Text style={{ fontSize: 8, color: "#14181c" }}>{data.patient.phone || ""}</Text></View>
            </View>

            <View style={{ width: "35%", flexDirection: "column", gap: 2 }}>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Patient ID   :</Text><Text style={{ fontSize: 8, color: "#14181c" }}>{data.accessionNo}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Registered on:</Text><Text style={{ fontSize: 8, color: "#14181c" }}>{data.receivedAt ?? data.collectedAt ?? "—"}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Reported on  :</Text><Text style={{ fontSize: 8, color: "#14181c" }}>{data.reportedAt ?? "—"}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ fontSize: 8, color: "#14181c", width: 72 }}>Printed on   :</Text><Text style={{ fontSize: 8, color: "#14181c" }}>{nowStr}</Text></View>
            </View>

            <View style={{ width: "20%", alignItems: "flex-end" }}>
              {showQr ? <Image src={data.qrCodeDataUrl as string} style={{ width: 48, height: 48, marginBottom: 2 }} /> : null}
              {layout.showBarcode ? <AccessionBarcode text={data.accessionNo} /> : null}
            </View>
          </View>
        ) : templateId === "modern_teal" || templateId === "bold_emerald" ? (
          <View style={{ backgroundColor: templateId === "modern_teal" ? "#f0fdf4" : "#ecfdf5", borderWidth: 1, borderColor: templateId === "modern_teal" ? "#ccfbf1" : "#a7f3d0", borderRadius: 4, padding: 6, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ width: "42%", gap: 2 }}>
                <Text style={{ fontSize: 7.5, color: "#475569" }}>PATIENT NAME</Text>
                <Text style={{ fontSize: 9.5, fontWeight: 700, color: "#0f172a" }}>{data.patient.name}</Text>
                <Text style={{ fontSize: 8, color: "#334155", marginTop: 2 }}>Age / Sex: <Text style={{ fontWeight: 700 }}>{data.patient.age} / {data.patient.gender}</Text></Text>
                <Text style={{ fontSize: 8, color: "#334155" }}>Ref. Doctor: {data.referringDoctor ?? "SELF"}</Text>
              </View>

              <View style={{ width: "38%", gap: 2 }}>
                <Text style={{ fontSize: 8, color: "#334155" }}>Accession No : <Text style={{ fontWeight: 700 }}>{data.accessionNo}</Text></Text>
                <Text style={{ fontSize: 8, color: "#334155" }}>Registered   : {data.receivedAt ?? data.collectedAt ?? "—"}</Text>
                <Text style={{ fontSize: 8, color: "#334155" }}>Reported     : {data.reportedAt ?? "—"}</Text>
                {data.patient.phone ? <Text style={{ fontSize: 8, color: "#334155" }}>Mobile       : {data.patient.phone}</Text> : null}
              </View>

              <View style={{ width: "20%", alignItems: "flex-end", justifyContent: "center" }}>
                {showQr ? <Image src={data.qrCodeDataUrl as string} style={{ width: 44, height: 44 }} /> : null}
              </View>
            </View>
          </View>
        ) : (
          <View style={{ borderWidth: 1, borderColor: templateId === "classic_navy" ? "#cbd5e1" : "#e2e8f0", padding: 6, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ width: "45%", gap: 2 }}>
              <View style={{ flexDirection: "row" }}><Text style={{ width: 70, color: "#64748b", fontSize: 8 }}>Patient Name:</Text><Text style={{ fontWeight: 700, fontSize: 8.5 }}>{data.patient.name}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ width: 70, color: "#64748b", fontSize: 8 }}>Age / Gender:</Text><Text style={{ fontSize: 8 }}>{data.patient.age} / {data.patient.gender}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ width: 70, color: "#64748b", fontSize: 8 }}>Referred By :</Text><Text style={{ fontSize: 8 }}>{data.referringDoctor ?? "SELF"}</Text></View>
            </View>
            <View style={{ width: "35%", gap: 2 }}>
              <View style={{ flexDirection: "row" }}><Text style={{ width: 70, color: "#64748b", fontSize: 8 }}>Accession No:</Text><Text style={{ fontWeight: 700, fontSize: 8 }}>{data.accessionNo}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ width: 70, color: "#64748b", fontSize: 8 }}>Received    :</Text><Text style={{ fontSize: 8 }}>{data.receivedAt ?? data.collectedAt ?? "—"}</Text></View>
              <View style={{ flexDirection: "row" }}><Text style={{ width: 70, color: "#64748b", fontSize: 8 }}>Reported    :</Text><Text style={{ fontSize: 8 }}>{data.reportedAt ?? "—"}</Text></View>
            </View>
            <View style={{ width: "20%", alignItems: "flex-end" }}>
              {showQr ? <Image src={data.qrCodeDataUrl as string} style={{ width: 42, height: 42 }} /> : null}
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* DIAGNOSTIC CATEGORIES AND RESULTS TABLE                                  */}
        {/* ========================================================================= */}
        {Object.entries(grouped).map(([category, results]) => (
          <View key={category} wrap={false} style={{ marginBottom: 6 }}>
            {/* Category Banner */}
            {templateId === "shiv_clinical" ? (
              <View style={{ backgroundColor: "#d5e2eb", borderWidth: 0.5, borderColor: "#b0c4de", paddingVertical: 3, marginTop: 4, marginBottom: 6, alignItems: "center" }}>
                <Text style={{ fontSize: 9.5, fontWeight: 700, color: "#14181c", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  {category.replaceAll("_", " ")}
                </Text>
              </View>
            ) : templateId === "classic_navy" ? (
              <View style={{ backgroundColor: primaryColor, paddingVertical: 3, paddingHorizontal: 8, marginTop: 4, marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: "#ffffff", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  {category.replaceAll("_", " ")}
                </Text>
              </View>
            ) : templateId === "modern_teal" ? (
              <View style={{ backgroundColor: "#ccfbf1", borderLeftWidth: 3, borderColor: primaryColor, paddingVertical: 3, paddingHorizontal: 6, marginTop: 4, marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: primaryColor, textTransform: "uppercase" }}>
                  {category.replaceAll("_", " ")}
                </Text>
              </View>
            ) : templateId === "bold_emerald" ? (
              <View style={{ backgroundColor: "#ecfdf5", borderRightWidth: 3, borderColor: "#d97706", paddingVertical: 3, paddingHorizontal: 6, marginTop: 4, marginBottom: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: 700, color: primaryColor, textTransform: "uppercase" }}>
                  {category.replaceAll("_", " ")}
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: "#f1f5f9", paddingVertical: 3, paddingHorizontal: 6, marginTop: 4, marginBottom: 4 }}>
                <Text style={{ fontSize: 8.5, fontWeight: 700, color: "#334155", textTransform: "uppercase" }}>
                  {category.replaceAll("_", " ")}
                </Text>
              </View>
            )}

            {/* Narrative / Micro / Numeric test rendering */}
            {narrativeCategories.has(category) ? (
              results.map((r, idx) => (
                <View key={idx} style={{ marginBottom: 6, paddingHorizontal: 4 }}>
                  <Text style={{ fontWeight: 700, marginBottom: 2 }}>{r.testName}</Text>
                  {r.grossDescription && <Text style={{ marginBottom: 2 }}>Gross: {r.grossDescription}</Text>}
                  {r.microscopicDescription && <Text style={{ marginBottom: 2 }}>Microscopic: {r.microscopicDescription}</Text>}
                  {r.diagnosis && <Text style={{ fontWeight: 700 }}>Diagnosis: {r.diagnosis}</Text>}
                </View>
              ))
            ) : category === microCategory ? (
              results.map((r, idx) => (
                <View key={idx} style={{ marginBottom: 6, paddingHorizontal: 4 }}>
                  <Text style={{ fontWeight: 700 }}>
                    {r.testName}: {r.organismPanel?.organism ?? r.textValue ?? "Pending"}
                  </Text>
                  {r.organismPanel?.colonyCount && <Text>Colony count: {r.organismPanel.colonyCount}</Text>}
                </View>
              ))
            ) : (
              <View>
                <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: templateId === "classic_navy" ? primaryColor : "#14181c", paddingBottom: 3, marginBottom: 3 }}>
                  <Text style={{ width: "42%", fontSize: 8.5, fontWeight: 700, color: "#14181c" }}>Test Name</Text>
                  <Text style={{ width: "22%", fontSize: 8.5, fontWeight: 700, color: "#14181c" }}>Patient Value</Text>
                  <Text style={{ width: "16%", fontSize: 8.5, fontWeight: 700, color: "#14181c" }}>Unit</Text>
                  <Text style={{ width: "20%", fontSize: 8.5, fontWeight: 700, color: "#14181c" }}>Reference Range</Text>
                </View>
                {results.map((r, idx) => {
                  const isAbnormal = r.flag !== "NORMAL";
                  return (
                    <View key={idx} style={{ flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: templateId === "classic_navy" ? 0.5 : 0, borderColor: "#e2e8f0" }}>
                      <Text style={{ width: "42%", fontSize: 8.5, color: "#14181c" }}>{r.testName}</Text>
                      <Text style={{ width: "22%", fontSize: 8.5, fontWeight: isAbnormal ? 700 : 400, textDecoration: isAbnormal ? "underline" : "none", color: isAbnormal ? (templateId === "shiv_clinical" ? "#000000" : primaryColor) : "#14181c" }}>
                        {formatResultValue(r)}
                      </Text>
                      <Text style={{ width: "16%", fontSize: 8.5, color: "#475569" }}>{r.unit ?? ""}</Text>
                      <Text style={{ width: "20%", fontSize: 8.5, color: "#475569" }}>{r.referenceRangeText ?? "—"}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        {/* End of Report Divider */}
        <Text style={{ textAlign: "center", fontSize: 8, fontWeight: 700, fontStyle: "italic", marginTop: 14, marginBottom: 8, color: "#14181c" }}>
          *********End Of Report*********
        </Text>

        {/* ========================================================================= */}
        {/* SIGNATURE AND NOTES SECTION                                              */}
        {/* ========================================================================= */}
        <View style={{ marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View style={{ flexDirection: "column", gap: 2 }}>
            <Text style={{ fontSize: 8, fontWeight: 700, color: "#14181c" }}>{layout.footerLine2 || "Kindly Correlate Clinically !"}</Text>
            <Text style={{ fontSize: 8, fontWeight: 700, color: "#14181c" }}>Thanks for referral !</Text>
          </View>

          {/* Checked By Signature Block derived from Lab Config */}
          <View style={{ flexDirection: "column", alignItems: "center", minWidth: 130 }}>
            <Text style={{ fontSize: 8, color: "#5b6670", marginBottom: 2 }}>{checkedByTitle}</Text>
            <Text style={{ fontSize: 9.5, fontWeight: 700, color: "#0f172a" }}>{checkedByName}</Text>
            <Text style={{ fontSize: 8, color: "#5b6670" }}>{checkedByQual}</Text>
          </View>
        </View>

        {/* ========================================================================= */}
        {/* FOOTER BANNER / LEGAL DISCLAIMER                                         */}
        {/* ========================================================================= */}
        {templateId === "shiv_clinical" ? (
          <View style={{ position: "absolute", bottom: 12, left: 28, right: 28 }} fixed>
            <View style={{ borderTopWidth: 1, borderColor: "#dfe3e4", marginBottom: 3 }} />
            <View style={{ alignItems: "center", marginBottom: 3 }}>
              <View style={{ backgroundColor: primaryColor, paddingHorizontal: 12, paddingVertical: 1, borderRadius: 1 }}>
                <Text style={{ color: "#ffffff", fontSize: 7, fontWeight: 700, letterSpacing: 0.8 }}>TEST UNDERTAKEN</Text>
              </View>
            </View>
            <Text style={{ fontSize: 6.5, textAlign: "center", color: "#14181c", fontWeight: 700, lineHeight: 1.2 }}>
              {layout.testsUndertaken || "Blood, Urine, Stool, Semen, Sputum, Renel Function Test (RFT), Liver Function Test (LFT)"}
            </Text>
            <Text style={{ fontSize: 6.5, textAlign: "center", color: "#14181c", lineHeight: 1.2 }}>
              Lipid Profile, Trop-T, HBsAg · Testing from Dr. Lal Pathlabs : THYROID FUNCTION TEST ( T , T & T.S.H.) · TORCH Test, LH+FSH+PROLACTIN, S. Testoteron
            </Text>
            <Text style={{ fontSize: 7.5, textAlign: "center", color: primaryColor, fontWeight: 700, marginTop: 3 }}>
              NOT VALID FOR MEDICO LEGAL PURPOSE
            </Text>
            <View style={{ borderBottomWidth: 2, borderColor: primaryColor, marginTop: 2 }} />
          </View>
        ) : layout.showFooter ? (
          <View style={{ position: "absolute", bottom: 16, left: 28, right: 28, borderTopWidth: 1, borderColor: "#e2e8f0", paddingTop: 4 }} fixed>
            <Text style={{ fontSize: 7, textAlign: "center", color: "#64748b" }}>{layout.footerText}</Text>
            <Text style={{ fontSize: 7, textAlign: "center", color: primaryColor, fontWeight: 700, marginTop: 1 }}>NOT VALID FOR MEDICO LEGAL PURPOSE</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
