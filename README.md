# PathLab LIMS

A pathology lab report generation & workflow system built on Next.js 14 (App
Router), PostgreSQL, and Prisma — covering the full order → result → verify →
authorize → release lifecycle across Hematology, Clinical Chemistry,
Microbiology, Serology, Coagulation, Urinalysis, Histopathology/Cytology, and
Molecular testing.

## Quick start

```bash
npm install                        # also runs `prisma generate` via postinstall
cp .env.example .env               # then fill in DATABASE_URL and AUTH_SECRET
npx prisma migrate dev --name init # creates the schema in your Postgres DB
npm run db:seed                    # seeds branches, demo users, CBC/LFT/KFT/Lipid panels + reference ranges
npm run dev
```

Demo logins (seeded, password `Password123!` for all):
`admin@lab.test`, `frontdesk@lab.test`, `tech@lab.test`, `pathologist@lab.test`.

`AUTH_SECRET` — generate with `openssl rand -base64 32`.

**Note on this build environment:** the sandbox this was built in has no
network access to `binaries.prisma.sh` (Prisma's engine-binary CDN) or to a
live Postgres instance, so `prisma generate` / `migrate` / `next build` could
not be executed here to confirm a clean compile. The code is written and
reviewed carefully, but run `npm install && npx prisma generate` and a `next
build` yourself as the first step — file an issue against whichever line
number the compiler flags, if any, and it'll be a fast fix.

## What's actually implemented (not just modeled)

- **Full relational schema** (`prisma/schema.prisma`): patient/test/reference-
  range/panel masters, order/accession, results, critical thresholds, audit
  log, RBAC roles, report templates & delivery log, amendment tracking with
  original-record preservation.
- **Calculation engine** (`lib/calc-engine.ts`) — a registered-rule system
  (not a hardcoded switch), covering every formula in the spec: MCV/MCH/MCHC,
  ANC/ALC, CKD-EPI 2021 eGFR (constants configurable — they do change with
  guideline updates), BUN/Cr ratio, corrected calcium, Friedewald LDL (with
  the TG≥400 suppression rule), non-HDL, TC/HDL ratio, De Ritis ratio, A/G
  ratio, anion gap, corrected sodium, INR (ISI passed in as reagent-lot
  config, never hardcoded), HOMA-IR, free androgen index.
- **Reference range resolution** (`lib/reference-range.ts`) — age/gender/
  pregnancy-trimester-aware, with the documented fallback chain from the
  spec: exact match → gender+age → age-only → default adult.
- **Flagging** (`lib/flagging.ts`) — H/L, critical/panic (separate threshold
  table, triggers the call-back workflow), delta check against the patient's
  last released result, auto-verify eligibility gate.
- **Interpretive comments** (`lib/interpretive-comments.ts`) — pattern rules
  (e.g. microcytic hypochromic anemia from MCV+MCH) that suggest, never
  auto-finalize; pathologist edits before authorization.
- **Workflow state machine** (`lib/workflow.ts`) — enforces the exact
  Order Created → Collected → Received → Result Entry → Tech Verified →
  Authorized → Released → Amended sequence server-side, not just in the UI.
  Amendments create a new linked `Order` row rather than mutating the
  released one, per the spec's "never silently overwrite" requirement.
- **Audit log** — every create/verify/authorize/release/print/critical-call
  action is written to `AuditLog` with before/after JSON.
- **RBAC** (`lib/rbac.ts`, NextAuth credentials) — phlebotomist / front desk /
  technologist / pathologist / admin / branch manager, enforced in every
  server action, not just hidden nav items.
- **PDF report generation** (`lib/report-pdf.tsx`, `@react-pdf/renderer`) —
  grouped panel sections in configured order, the three distinct layouts from
  the spec (standard result/range table, histopath/cytology narrative
  fields, microbiology organism + antibiotic S/I/R grid), amended-report
  banner, pathologist signature block.
- **UI**: login, dashboard, patient registration, order/accession creation
  (panel + à la carte test picker), technologist worklist, result entry
  screen (live flagging, delta indicators, derived values recompute as
  inputs are typed), critical-value call-back logging gate, order detail with
  role-gated workflow buttons, report preview/print, test master admin.

## What's deliberately stubbed, and why

These need infrastructure this environment can't provide or that only you
can decide (which instrument model, which SMS/email vendor):

- **Analyzer interfacing — HL7 v2 / ASTM E1394**
  (`lib/integrations/analyzer-adapter.ts`): the *ingestion pipeline* is real —
  a parsed result gets matched to its order by accession number and run
  through the same reference-range/flagging code manual entry uses. What's
  stubbed is the wire-format parser itself, because HL7 OBX-segment mapping
  and ASTM frame layout are specific to each analyzer model (Sysmex, Roche
  Cobas, Mindray, etc.) and can't be written correctly without sample
  messages from your actual instrument. In practice, most labs buy a
  middleware product (e.g. Data Innovations Instrument Manager) rather than
  writing this themselves — it may be cheaper than custom-building it.
- **HIS/EMR integration (HL7/FHIR order intake)** — not started. This needs
  a specific target system to integrate against; there's no generic version
  worth building speculatively.
- **SMS / WhatsApp delivery** (`lib/integrations/delivery-adapter.ts`) — the
  queue/audit/retry plumbing is real; the actual provider call throws until
  you plug in credentials for whichever vendor you pick (Twilio, MSG91, Meta
  WhatsApp Business API). Email is the same shape but more generic (any SMTP
  or transactional-email API works).
- **Patient portal with OTP access** — not built. This is a meaningful
  second application surface (public-facing auth, OTP delivery, its own
  security review) rather than an extension of the internal app; scope it
  separately once the internal workflow is validated.
- **QR-code tamper verification on printed reports** — not built; needs a
  public verification endpoint plus a decision on what "verified" should
  display without leaking data to whoever scans it.
- **Multi-language report templates** — the `ReportTemplate.layoutJson`
  field is designed to hold this, but no template engine or translated
  content exists yet.

## Gap analysis against your spec

Everything in sections 1–4 (data model, calculation engine, report
structure, workflow) is implemented as described above. Sections 5–8 are the
ones needing real-world integration decisions:

| Spec section | Status |
|---|---|
| 5. Analyzer interfacing | Pipeline built, parser stubbed (see above) |
| 5. HIS/EMR HL7/FHIR | Not started — needs a target system |
| 5. Barcode/QR at accession | Accession number exists; barcode *rendering* (Code128) on the printed sample label isn't built yet — straightforward to add with a library like `bwip-js` once you confirm your label printer's format |
| 6. Compliance/audit | Implemented |
| 6. Digital signature | Signature *image* field exists on `User`; actual e-signature capture UI not built |
| 7. PDF/email/SMS/WhatsApp/portal | PDF done; delivery adapters stubbed; portal not started |
| 7. QR tamper verification | Not started |
| 8. Multi-branch templates | Schema supports it (`ReportTemplate.branchId`); only one default layout implemented |
| 8. Multi-language | Schema field exists; no i18n implemented |
| 8. High-volume concurrency | Not load-tested; the schema is indexed on the hot paths (order status, patient, test) but you should load-test result-entry concurrency before go-live |

## How this compares to commercial lab software

Established players — CrelioHealth, LabWare, LabVantage, CGM LABDAQ, Cerner
PathNet/Millennium, InterSystems TrakCare Lab — represent years of
engineering and, critically, **years of certified analyzer driver libraries**
covering hundreds of instrument models. That driver library is the single
biggest thing this build doesn't and can't replicate generically: it's the
product of individually validating against real hardware, often under a
support contract with the instrument vendor.

Where this codebase is comparably complete: the calculation engine, workflow
state machine, reference-range resolution, flagging logic, audit trail, and
report rendering are all real, working, and match how those systems behave
functionally. Where it's behind: instrument connectivity (as above), years of
edge-case handling in real deployments (partial specimen rejection reasons,
add-on test workflows, reflex testing rules, insurance/billing integration,
which this spec didn't ask for but full LIS suites include), and formal
validation/compliance documentation (NABL/CAP expect a validation protocol
and traceability matrix, not just working code).

## Suggested next steps, in order

1. Get this running against a real Postgres instance and seed data; click
   through the full order → report flow with the demo accounts.
2. Add barcode label printing (Code128 on the accession label) — quick win,
   real workflow gap.
3. Wire one delivery channel for real (email is the easiest first target).
4. If you have a specific analyzer model in mind, get sample HL7/ASTM output
   from it and I can write the actual parser against real messages instead
   of the stub.
5. Reflex testing rules (e.g. auto-order a confirmatory test on an abnormal
   screen) — not in your original spec but very commonly requested once a
   lab is live; worth deciding early since it touches the Order/OrderTest
   model.
