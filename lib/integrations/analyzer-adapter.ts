/**
 * Analyzer interfacing (HL7 v2.x / ASTM E1394) — INTERFACE ONLY.
 *
 * This is deliberately not a full implementation: real analyzer interfacing
 * needs a middleware box or driver certified against the specific instrument
 * model (Sysmex, Roche Cobas, Mindray, etc.), a serial/TCP listener running
 * next to the analyzer, and per-instrument message mapping — none of which
 * can be built generically or tested without the physical hardware.
 *
 * What's real here: the shape your app needs on the receiving end, so that
 * whoever wires up the actual instrument driver (or a vendor middleware
 * product like Data Innovations Instrument Manager) has a stable contract to
 * call into. Point their driver's output at `ingestAnalyzerMessage`.
 */

import { prisma } from "@/lib/prisma";
import { resolveReferenceRange, ageInDays, formatRangeText } from "@/lib/reference-range";
import { computeFlag, computeQualitativeFlag } from "@/lib/flagging";
import { cascadeDerivedResults } from "@/app/actions/results";
import { roundNumeric } from "@/lib/format-result";

export type AnalyzerResultMessage = {
  instrumentId: string;
  accessionNo: string; // must match Order.accessionNo — this is how the result gets matched to the order
  testCode: string;
  numericValue?: number;
  textValue?: string;
  unit?: string;
  qcPassed: boolean;
  observedAt: string; // ISO datetime from the instrument
};

/**
 * Parse a raw HL7 ORU^R01 message into AnalyzerResultMessage[].
 * STUB: real parsing needs a proper HL7 library (e.g. `simple-hl7` or
 * `node-hl7-client`) and per-instrument OBX segment mapping. Wire that here.
 */
export function parseHL7ORU(_rawMessage: string): AnalyzerResultMessage[] {
  throw new Error(
    "parseHL7ORU is a stub. Install an HL7 parser (e.g. simple-hl7) and map this " +
      "instrument's OBX segments to AnalyzerResultMessage — segment layout is " +
      "instrument-model-specific and must be confirmed against real sample messages."
  );
}

/** Same idea for ASTM E1394 (common on older/simpler analyzers, esp. hematology/chemistry). */
export function parseASTM(_rawFrames: string): AnalyzerResultMessage[] {
  throw new Error("parseASTM is a stub — same caveat as parseHL7ORU, different wire format.");
}

/**
 * This part IS real and wired to the schema: once you have a parsed message,
 * this resolves it against the order, runs it through the same reference
 * range + flagging pipeline manual entry uses, and stores it with
 * instrumentId set (so the UI can distinguish instrument vs manual results).
 */
export async function ingestAnalyzerMessage(msg: AnalyzerResultMessage) {
  const matches = await prisma.order.findMany({
    where: { accessionNo: msg.accessionNo },
    include: { patient: true },
    take: 2,
  });
  if (matches.length === 0) throw new Error(`No order found for accession ${msg.accessionNo}`);
  if (matches.length > 1) throw new Error(`Accession ${msg.accessionNo} is not unique across labs on this server.`);
  const order = matches[0];

  const test = await prisma.test.findFirst({
    where: { vendorId: order.vendorId, code: msg.testCode },
    include: { referenceRanges: true, criticalThresholds: true },
  });
  if (!test) throw new Error(`Unknown test code from analyzer: ${msg.testCode}`);

  const days = ageInDays(order.patient.dob, order.patient.ageYears, order.patient.ageMonths);
  const range = resolveReferenceRange(test.referenceRanges, {
    gender: order.patient.gender,
    ageDays: days,
    isPregnant: order.patient.isPregnant,
    pregnancyTrimester: order.patient.pregnancyWeeks ? Math.ceil(order.patient.pregnancyWeeks / 13) : null,
  });
  const critical = test.criticalThresholds.find((c) => (!c.gender || c.gender === order.patient.gender) && days >= c.ageMinDays && days <= c.ageMaxDays) ?? null;

  const numericValue = msg.numericValue != null ? roundNumeric(msg.numericValue, test.decimalPrecision) : null;
  const flag =
    numericValue != null
      ? computeFlag({ numericValue, range, criticalThreshold: critical })
      : computeQualitativeFlag(msg.textValue, formatRangeText(range));

  const saved = await prisma.result.upsert({
    where: { id: `analyzer:${order.id}:${test.id}` },
    create: {
      id: `analyzer:${order.id}:${test.id}`,
      orderId: order.id,
      testId: test.id,
      numericValue,
      textValue: msg.textValue ?? null,
      unit: msg.unit ?? test.unit,
      referenceRangeText: formatRangeText(range),
      flag,
      status: "ENTERED",
      instrumentId: msg.instrumentId,
      enteredAt: new Date(msg.observedAt),
    },
    update: {
      numericValue,
      textValue: msg.textValue ?? null,
      referenceRangeText: formatRangeText(range),
      flag,
      instrumentId: msg.instrumentId,
      enteredAt: new Date(msg.observedAt),
    },
  });
  await cascadeDerivedResults(order.id, order.vendorId);
  return saved;
}
