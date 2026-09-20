import { formatInr } from "@/lib/money";
import type { ReceiptData } from "@/lib/cash-receipt";
import type { ReportLayout } from "@/lib/report-layout";

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderCashBillHtml(data: ReceiptData, layout: ReportLayout): string {
  const color = esc(layout.primaryColor || "#14181c");
  const rows = data.lines
    .map(
      (line) =>
        `<tr><td>${esc(line.name)}</td><td class="amt">${esc(formatInr(line.amount))}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bill ${esc(data.accessionNo)}</title>
  <style>
    * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
    html, body {
      margin: 0;
      background: #e8eaed;
      color: #14181c;
      font-family: Arial, Helvetica, sans-serif;
    }
    @page { size: A5; margin: 12mm; }
    .toolbar {
      position: sticky;
      top: 0;
      display: flex;
      gap: 8px;
      justify-content: center;
      padding: 10px;
      background: #fff;
      border-bottom: 1px solid #dfe3e4;
    }
    .toolbar button {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      font-weight: 700;
      border: 0;
      border-radius: 6px;
      padding: 8px 14px;
      cursor: pointer;
    }
    .print { background: #14181c; color: #fff; }
    .close { background: #eef0f1; color: #14181c; }
    .sheet {
      width: 148mm;
      min-height: 210mm;
      margin: 16px auto;
      padding: 14mm 12mm;
      background: #fff;
      box-shadow: 0 8px 24px rgba(20, 24, 28, 0.12);
    }
    h1 {
      margin: 0;
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      color: ${color};
    }
    .meta, .sign { text-align: center; font-size: 11px; color: #5b6670; }
    .title {
      margin: 14px 0 12px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .grid { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 5px 0; text-align: left; }
    th { border-bottom: 1px solid #14181c; }
    td { border-bottom: 0.5px solid #eef0f1; }
    td.amt, th.amt { text-align: right; }
    .totals { margin-top: 12px; text-align: right; font-size: 12px; line-height: 1.6; }
    .due { font-size: 14px; font-weight: 700; color: ${data.due > 0 ? "#b3261e" : "#1c6b48"}; }
    .sign { margin-top: 36px; text-align: right; color: #14181c; }
    @media print {
      html, body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button type="button" class="print" onclick="window.print()">Print bill</button>
    <button type="button" class="close" onclick="window.close()">Close</button>
  </div>
  <div class="sheet">
    <h1>${esc(data.labName)}</h1>
    ${layout.subtitle ? `<p class="meta">${esc(layout.subtitle)}</p>` : ""}
    ${data.address ? `<p class="meta">${esc(data.address)}</p>` : ""}
    ${data.phone ? `<p class="meta">Mob.: ${esc(data.phone)}</p>` : ""}
    <p class="title">CASH RECEIPT / BILL</p>
    <div class="grid">
      <div>
        <div>Name: ${esc(data.patientName)}</div>
        <div>${esc(data.age)} / ${esc(data.gender)}</div>
        ${data.phoneNumber ? `<div>Phone: ${esc(data.phoneNumber)}</div>` : ""}
      </div>
      <div>
        <div>Bill No: ${esc(data.accessionNo)}</div>
        <div>Date: ${esc(data.date)}</div>
        ${data.doctor ? `<div>Doctor: ${esc(data.doctor)}</div>` : ""}
      </div>
    </div>
    <table>
      <thead>
        <tr><th>Test / Panel</th><th class="amt">Charge</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div>Total: ${esc(formatInr(data.totalCharge))}</div>
      <div>Discount: ${esc(formatInr(data.discount))}</div>
      <div>Paid: ${esc(formatInr(data.amountPaid))}</div>
      <div class="due">Due: ${esc(formatInr(data.due))}</div>
    </div>
    <p class="sign">Authorised Signatory</p>
  </div>
</body>
</html>`;
}
