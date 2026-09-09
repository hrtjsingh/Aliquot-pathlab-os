"use client";

import { BrandLockup } from "@/components/brand-mark";

const TRACKS = [
  { top: 24, width: 38, delay: 0, duration: 13 },
  { top: 38, width: 34, delay: 2.2, duration: 15 },
  { top: 52, width: 42, delay: 4.5, duration: 14 },
  { top: 66, width: 30, delay: 6.8, duration: 16 },
  { top: 80, width: 36, delay: 9.1, duration: 14 },
];

export function LoginHero() {
  return (
    <aside className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-brand px-12 py-14 text-brand-foreground lg:flex">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {TRACKS.map((t, i) => (
          <span
            key={i}
            className="sample-track absolute left-0 h-px -translate-x-full bg-gradient-to-r from-transparent via-brand-foreground/35 to-transparent"
            style={{
              top: `${t.top}%`,
              width: `${t.width}%`,
              animation: `trackSlide ${t.duration}s linear ${t.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes trackSlide {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          92% {
            opacity: 1;
          }
          100% {
            transform: translateX(280%);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sample-track {
            animation: none !important;
            opacity: 0.2 !important;
          }
        }
      `}</style>

      <div className="relative z-10 flex items-start justify-between">
        <BrandLockup invert compact />
        <span className="rounded-full border border-brand-foreground/20 bg-brand-foreground/10 px-2.5 py-1 text-[11px] font-medium tracking-wide text-brand-foreground/90">
          Lab report SaaS
        </span>
      </div>

      <div className="relative z-10 flex max-w-md flex-col gap-6">
        <h1 className="text-balance text-4xl font-semibold leading-[1.12] tracking-tight text-brand-foreground">
          Generate, authorize, and release diagnostic reports.
        </h1>
        <p className="max-w-sm text-[15px] leading-relaxed text-brand-foreground/75">
          One workspace for chemistry, hematology, and pathology results. Enter
          on the worklist, sign with a pathologist authorization, and send the
          PDF.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {[
            ["Accession", "Register patient + sample"],
            ["Result entry", "Tech enters verified values"],
            ["Authorization", "Pathologist signs off"],
            ["Release", "Signed report delivered"],
          ].map(([label, desc]) => (
            <div
              key={label}
              className="rounded-lg border border-brand-foreground/10 bg-brand-foreground/[0.06] p-3"
            >
              <p className="text-xs font-semibold text-brand-foreground">
                {label}
              </p>
              <p className="mt-0.5 text-[11px] leading-tight text-brand-foreground/65">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between text-xs text-brand-foreground/55">
        <p>One report. One signature. No separate LIS bolt-on.</p>
        <p className="tabular">ISO 15189-ready audit trail</p>
      </div>
    </aside>
  );
}
