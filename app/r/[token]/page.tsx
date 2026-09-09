import type { Metadata } from "next";
import { Download } from "lucide-react";
import { findReleasedOrderByToken } from "@/lib/public-report";
import { calcAge } from "@/lib/report-data";

export const dynamic = "force-dynamic";

function prettyGender(value: string) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function formatWhen(value: Date | null) {
  if (!value) return "—";
  return value.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const order = await findReleasedOrderByToken(token);
  if (!order) return { title: "Report unavailable", robots: { index: false, follow: false } };
  return {
    title: `${order.accessionNo} · ${order.branch.name}`,
    description: `Released laboratory report ${order.accessionNo}`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await findReleasedOrderByToken(token);

  if (!order) {
    return (
      <div className="flex min-h-dvh flex-col bg-[#d8e0dc] text-[#1a2428]">
        <div className="h-1.5 bg-[#1c3f52]" />
        <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5b6b70]">Laboratory report</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">This report is not available</h1>
          <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-[#4f5c66]">
            The link is invalid, or the laboratory has not released the report. Confirm the accession number with the lab
            that collected your sample.
          </p>
        </main>
      </div>
    );
  }

  const patientName = `${order.patient.firstName} ${order.patient.lastName ?? ""}`.trim();
  const pdfHref = `/api/public/reports/${token}/pdf`;
  const age = calcAge(order.patient.dob, order.patient.ageYears, order.patient.ageMonths);

  return (
    <div className="min-h-dvh bg-[#d8e0dc] text-[#1a2428]">
      <header className="bg-[#1c3f52] px-4 py-5 text-[#f4f6f7] sm:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Released laboratory report</p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{order.branch.name}</h1>
          {order.branch.address ? <p className="text-sm text-white/75">{order.branch.address}</p> : null}
          {order.branch.nablNo || order.branch.isoNo ? (
            <p className="text-xs text-white/60">
              {[order.branch.nablNo ? `NABL ${order.branch.nablNo}` : null, order.branch.isoNo ? `ISO ${order.branch.isoNo}` : null]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
        <section className="rounded-lg border border-[#c5d0cb] bg-[#f7f9f8] px-5 py-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b6b70]">Patient</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">{patientName}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[#5b6b70]">Accession</dt>
              <dd className="mt-0.5 font-semibold tabular">{order.accessionNo}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[#5b6b70]">Age / gender</dt>
              <dd className="mt-0.5 font-medium">
                {age} / {prettyGender(order.patient.gender)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[#5b6b70]">Reported</dt>
              <dd className="mt-0.5 font-medium">{formatWhen(order.reportedAt)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-[#5b6b70]">Referring doctor</dt>
              <dd className="mt-0.5 font-medium">{order.referringDoctor || "—"}</dd>
            </div>
          </dl>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <a
              href={`${pdfHref}?download=1`}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#0f766e] px-4 text-sm font-semibold text-white"
            >
              <Download className="size-4" />
              Download PDF
            </a>
            <a href={pdfHref} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#1c3f52] underline-offset-4 hover:underline">
              Open PDF in a new tab
            </a>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#c5d0cb] bg-white shadow-[0_18px_40px_-24px_rgba(28,63,82,0.45)]">
          <iframe src={pdfHref} className="h-[min(78vh,920px)] w-full bg-white" title={`Report ${order.accessionNo}`} />
        </section>

        <p className="pb-6 text-center text-[12px] leading-relaxed text-[#5b6b70]">
          Digital copy of a released report. Discuss results with the requesting clinician.
        </p>
      </main>
    </div>
  );
}
