import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatInr } from "@/lib/money";
import { encodeCode39 } from "@/lib/barcode";
import type { ReportLayout } from "@/lib/report-layout";

export type ReceiptData = {
  labName: string;
  address: string | null;
  phone: string;
  accessionNo: string;
  date: string;
  patientName: string;
  age: string;
  gender: string;
  phoneNumber: string | null;
  doctor: string | null;
  lines: Array<{ name: string; amount: number }>;
  totalCharge: number;
  discount: number;
  amountPaid: number;
  due: number;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica", color: "#14181c" },
  title: { fontSize: 16, fontWeight: 700, textAlign: "center" },
  meta: { fontSize: 8, color: "#5b6670", textAlign: "center", marginTop: 2 },
  heading: { fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 10, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  tableHeader: { flexDirection: "row", borderBottom: 1, borderColor: "#14181c", paddingBottom: 4, marginTop: 8 },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottom: 0.5, borderColor: "#eef0f1" },
  totals: { marginTop: 10, alignItems: "flex-end" },
  due: { fontSize: 12, fontWeight: 700, marginTop: 4 },
  sign: { marginTop: 36, textAlign: "right", fontSize: 9 },
});

export function CashReceiptDocument({ data, layout }: { data: ReceiptData; layout: ReportLayout }) {
  const bars = encodeCode39(data.accessionNo);
  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <Text style={[styles.title, { color: layout.primaryColor }]}>{data.labName}</Text>
        {layout.subtitle ? <Text style={styles.meta}>{layout.subtitle}</Text> : null}
        {data.address ? <Text style={styles.meta}>{data.address}</Text> : null}
        {data.phone ? <Text style={styles.meta}>Mob.: {data.phone}</Text> : null}
        <Text style={styles.heading}>CASH RECEIPT / BILL</Text>
        <View style={{ flexDirection: "row", height: 22, justifyContent: "center", marginBottom: 6 }}>
          {bars.map((bar, index) => (
            <View
              key={`${index}-${bar.width}`}
              style={{ width: bar.width, height: 22, backgroundColor: bar.black ? "#14181c" : "#ffffff" }}
            />
          ))}
        </View>
        <View style={styles.row}>
          <View>
            <Text>Name: {data.patientName}</Text>
            <Text>
              {data.age} / {data.gender}
            </Text>
            {data.phoneNumber ? <Text>Phone: {data.phoneNumber}</Text> : null}
          </View>
          <View>
            <Text>Bill No: {data.accessionNo}</Text>
            <Text>Date: {data.date}</Text>
            {data.doctor ? <Text>Doctor: {data.doctor}</Text> : null}
          </View>
        </View>
        <View style={styles.tableHeader}>
          <Text style={{ width: "75%" }}>Test / Panel</Text>
          <Text style={{ width: "25%", textAlign: "right" }}>Charge</Text>
        </View>
        {data.lines.map((line) => (
          <View key={line.name} style={styles.tableRow}>
            <Text style={{ width: "75%" }}>{line.name}</Text>
            <Text style={{ width: "25%", textAlign: "right" }}>{formatInr(line.amount)}</Text>
          </View>
        ))}
        <View style={styles.totals}>
          <Text>Total: {formatInr(data.totalCharge)}</Text>
          <Text>Discount: {formatInr(data.discount)}</Text>
          <Text>Paid: {formatInr(data.amountPaid)}</Text>
          <Text style={[styles.due, { color: data.due > 0 ? "#b3261e" : "#1c6b48" }]}>Due: {formatInr(data.due)}</Text>
        </View>
        <Text style={styles.sign}>Authorised Signatory</Text>
      </Page>
    </Document>
  );
}
