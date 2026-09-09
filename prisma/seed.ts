import { PrismaClient, TestCategory, ResultDataType, Gender, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_REPORT_LAYOUT } from "../lib/report-layout";
import { BILLING_PLANS, LEGACY_PLAN_CODES } from "../lib/billing-plans";

const prisma = new PrismaClient();

async function main() {
  const vendor = await prisma.vendor.upsert({
    where: { slug: "aliquot" },
    update: {},
    create: { id: "clvendor_aliquot_default", slug: "aliquot", name: "Aliquot Lab" },
  });

  const branch = await prisma.branch.upsert({
    where: { vendorId_code: { vendorId: vendor.id, code: "MAIN" } },
    update: {},
    create: { vendorId: vendor.id, name: "Main Lab", code: "MAIN", nablNo: "NABL-0000-EXAMPLE", address: "12 Clinical Avenue, Sample City" },
  });

  const existingTemplate = await prisma.reportTemplate.findFirst({ where: { branchId: branch.id, isDefault: true } });
  if (!existingTemplate) {
    await prisma.reportTemplate.create({
      data: {
        vendorId: vendor.id,
        branchId: branch.id,
        name: "Default laboratory report",
        isDefault: true,
        layoutJson: DEFAULT_REPORT_LAYOUT,
      },
    });
  }

  const pw = await bcrypt.hash("Password123!", 10);
  await prisma.user.upsert({
    where: { vendorId_email: { vendorId: vendor.id, email: "admin@lab.test" } },
    update: { name: "Admin User", role: Role.ADMIN, active: true, branchId: branch.id },
    create: {
      email: "admin@lab.test",
      name: "Admin User",
      role: Role.ADMIN,
      vendorId: vendor.id,
      passwordHash: pw,
      branchId: branch.id,
    },
  });
  await prisma.user.updateMany({
    where: {
      vendorId: vendor.id,
      email: { in: ["frontdesk@lab.test", "tech@lab.test", "pathologist@lab.test"] },
    },
    data: { active: false },
  });

  // ---------------------------------------------------------------- Hematology
  const cbcTests = [
    { code: "HB", name: "Hemoglobin", unit: "g/dL", precision: 1 },
    { code: "RBC", name: "RBC Count", unit: "mill/uL", precision: 2 },
    { code: "HCT", name: "Hematocrit (PCV)", unit: "%", precision: 1 },
    { code: "TLC", name: "Total Leukocyte Count", unit: "/uL", precision: 0 },
    { code: "NEUT_PCT", name: "Neutrophils", unit: "%", precision: 0 },
    { code: "LYMPH_PCT", name: "Lymphocytes", unit: "%", precision: 0 },
    { code: "PLATELET", name: "Platelet Count", unit: "/uL", precision: 0 },
  ];
  for (const [idx, t] of cbcTests.entries()) {
    await prisma.test.upsert({
      where: { vendorId_code: { vendorId: vendor.id, code: t.code } },
      update: {},
      create: {
        vendorId: vendor.id, code: t.code, name: t.name, category: TestCategory.HEMATOLOGY, specimenType: "Whole Blood EDTA",
        unit: t.unit, decimalPrecision: t.precision, dataType: ResultDataType.NUMERIC,
        autoVerifyEligible: true, turnaroundHours: 4,
      },
    });
  }
  const derivedHema = [
    { code: "MCV", name: "MCV", unit: "fL", rule: "MCV", precision: 1 },
    { code: "MCH", name: "MCH", unit: "pg", rule: "MCH", precision: 1 },
    { code: "MCHC", name: "MCHC", unit: "g/dL", rule: "MCHC", precision: 1 },
    { code: "ANC", name: "Absolute Neutrophil Count", unit: "/uL", rule: "ANC", precision: 0 },
    { code: "ALC", name: "Absolute Lymphocyte Count", unit: "/uL", rule: "ALC", precision: 0 },
  ];
  for (const t of derivedHema) {
    await prisma.test.upsert({
      where: { vendorId_code: { vendorId: vendor.id, code: t.code } },
      update: {},
      create: {
        vendorId: vendor.id, code: t.code, name: t.name, category: TestCategory.HEMATOLOGY, specimenType: "Whole Blood EDTA",
        unit: t.unit, decimalPrecision: t.precision, dataType: ResultDataType.NUMERIC,
        isDerived: true, derivationRule: t.rule, turnaroundHours: 4,
      },
    });
  }

  // ------------------------------------------------------------ Clinical Chemistry
  const chemTests = [
    { code: "AST", name: "AST (SGOT)", unit: "U/L" },
    { code: "ALT", name: "ALT (SGPT)", unit: "U/L" },
    { code: "ALBUMIN", name: "Albumin", unit: "g/dL", precision: 1 },
    { code: "TOTAL_PROTEIN", name: "Total Protein", unit: "g/dL", precision: 1 },
    { code: "CREATININE", name: "Creatinine", unit: "mg/dL", precision: 2 },
    { code: "BUN", name: "Blood Urea Nitrogen", unit: "mg/dL" },
    { code: "CALCIUM", name: "Calcium", unit: "mg/dL", precision: 1 },
    { code: "SODIUM", name: "Sodium", unit: "mEq/L" },
    { code: "CHLORIDE", name: "Chloride", unit: "mEq/L" },
    { code: "BICARBONATE", name: "Bicarbonate (HCO3)", unit: "mEq/L" },
    { code: "GLUCOSE", name: "Glucose (Fasting)", unit: "mg/dL" },
    { code: "TOTAL_CHOLESTEROL", name: "Total Cholesterol", unit: "mg/dL" },
    { code: "HDL", name: "HDL Cholesterol", unit: "mg/dL" },
    { code: "TRIGLYCERIDES", name: "Triglycerides", unit: "mg/dL" },
  ];
  for (const t of chemTests) {
    await prisma.test.upsert({
      where: { vendorId_code: { vendorId: vendor.id, code: t.code } },
      update: {},
      create: {
        vendorId: vendor.id, code: t.code, name: t.name, category: TestCategory.CLINICAL_CHEMISTRY, specimenType: "Serum",
        unit: t.unit, decimalPrecision: t.precision ?? 0, dataType: ResultDataType.NUMERIC,
        autoVerifyEligible: true, turnaroundHours: 6,
      },
    });
  }
  const derivedChem = [
    { code: "EGFR", name: "eGFR (CKD-EPI 2021)", unit: "mL/min/1.73m2", rule: "EGFR_CKD_EPI_2021", precision: 1 },
    { code: "BUN_CR_RATIO", name: "BUN/Creatinine Ratio", unit: "", rule: "BUN_CREATININE_RATIO", precision: 1 },
    { code: "CORR_CALCIUM", name: "Corrected Calcium", unit: "mg/dL", rule: "CORRECTED_CALCIUM", precision: 1 },
    { code: "LDL", name: "LDL Cholesterol (Friedewald)", unit: "mg/dL", rule: "LDL_FRIEDEWALD", precision: 0 },
    { code: "NON_HDL", name: "Non-HDL Cholesterol", unit: "mg/dL", rule: "NON_HDL_CHOLESTEROL", precision: 0 },
    { code: "TC_HDL_RATIO", name: "TC/HDL Ratio", unit: "", rule: "TC_HDL_RATIO", precision: 1 },
    { code: "DE_RITIS", name: "AST/ALT Ratio", unit: "", rule: "DE_RITIS_RATIO", precision: 2 },
    { code: "AG_RATIO", name: "Albumin/Globulin Ratio", unit: "", rule: "AG_RATIO", precision: 2 },
    { code: "ANION_GAP", name: "Anion Gap", unit: "mEq/L", rule: "ANION_GAP", precision: 0 },
    { code: "CORR_SODIUM", name: "Corrected Sodium", unit: "mEq/L", rule: "CORRECTED_SODIUM", precision: 0 },
  ];
  for (const t of derivedChem) {
    await prisma.test.upsert({
      where: { vendorId_code: { vendorId: vendor.id, code: t.code } },
      update: {},
      create: {
        vendorId: vendor.id, code: t.code, name: t.name, category: TestCategory.CLINICAL_CHEMISTRY, specimenType: "Serum",
        unit: t.unit, decimalPrecision: t.precision, dataType: ResultDataType.NUMERIC,
        isDerived: true, derivationRule: t.rule, turnaroundHours: 6,
      },
    });
  }

  // Panels
  async function makePanel(code: string, name: string, category: TestCategory, testCodes: string[]) {
    const panel = await prisma.panel.upsert({
      where: { vendorId_code: { vendorId: vendor.id, code } },
      update: {},
      create: { vendorId: vendor.id, code, name, category },
    });
    for (const [i, tc] of testCodes.entries()) {
      const test = await prisma.test.findUniqueOrThrow({ where: { vendorId_code: { vendorId: vendor.id, code: tc } } });
      await prisma.panelTest.upsert({
        where: { panelId_testId: { panelId: panel.id, testId: test.id } },
        update: { sortOrder: i },
        create: { panelId: panel.id, testId: test.id, sortOrder: i },
      });
    }
    return panel;
  }

  await makePanel("CBC", "Complete Blood Count", TestCategory.HEMATOLOGY, [
    "HB", "RBC", "HCT", "MCV", "MCH", "MCHC", "TLC", "NEUT_PCT", "LYMPH_PCT", "ANC", "ALC", "PLATELET",
  ]);
  await makePanel("LFT", "Liver Function Test", TestCategory.CLINICAL_CHEMISTRY, [
    "AST", "ALT", "DE_RITIS", "ALBUMIN", "TOTAL_PROTEIN", "AG_RATIO",
  ]);
  await makePanel("KFT", "Kidney Function Test", TestCategory.CLINICAL_CHEMISTRY, [
    "CREATININE", "BUN", "BUN_CR_RATIO", "EGFR", "CALCIUM", "CORR_CALCIUM", "SODIUM", "CHLORIDE", "BICARBONATE", "ANION_GAP",
  ]);
  await makePanel("LIPID", "Lipid Profile", TestCategory.CLINICAL_CHEMISTRY, [
    "TOTAL_CHOLESTEROL", "HDL", "LDL", "NON_HDL", "TRIGLYCERIDES", "TC_HDL_RATIO",
  ]);

  // ---------------------------------------------------------- Reference ranges
  // A representative slice, not exhaustive — extend via admin UI / migrations.
  const ranges: { code: string; gender?: Gender; ageMinDays?: number; ageMaxDays?: number; low?: number; high?: number; isDefault?: boolean }[] = [
    { code: "HB", gender: "MALE", low: 13.5, high: 17.5, isDefault: true },
    { code: "HB", gender: "FEMALE", low: 12.0, high: 15.5, isDefault: true },
    { code: "RBC", gender: "MALE", low: 4.5, high: 5.9, isDefault: true },
    { code: "RBC", gender: "FEMALE", low: 4.0, high: 5.2, isDefault: true },
    { code: "HCT", gender: "MALE", low: 41, high: 53, isDefault: true },
    { code: "HCT", gender: "FEMALE", low: 36, high: 46, isDefault: true },
    { code: "MCV", low: 80, high: 100, isDefault: true },
    { code: "MCH", low: 27, high: 33, isDefault: true },
    { code: "MCHC", low: 32, high: 36, isDefault: true },
    { code: "TLC", low: 4000, high: 11000, isDefault: true },
    { code: "ANC", low: 1500, high: 8000, isDefault: true },
    { code: "ALC", low: 1000, high: 4800, isDefault: true },
    { code: "PLATELET", low: 150000, high: 450000, isDefault: true },
    { code: "AST", high: 40, low: 5, isDefault: true },
    { code: "ALT", high: 41, low: 7, isDefault: true },
    { code: "ALBUMIN", low: 3.5, high: 5.2, isDefault: true },
    { code: "TOTAL_PROTEIN", low: 6.4, high: 8.3, isDefault: true },
    { code: "AG_RATIO", low: 1.1, high: 2.5, isDefault: true },
    { code: "CREATININE", gender: "MALE", low: 0.74, high: 1.35, isDefault: true },
    { code: "CREATININE", gender: "FEMALE", low: 0.59, high: 1.04, isDefault: true },
    { code: "BUN", low: 7, high: 20, isDefault: true },
    { code: "BUN_CR_RATIO", low: 10, high: 20, isDefault: true },
    { code: "EGFR", low: 90, isDefault: true },
    { code: "CALCIUM", low: 8.6, high: 10.3, isDefault: true },
    { code: "CORR_CALCIUM", low: 8.6, high: 10.3, isDefault: true },
    { code: "SODIUM", low: 136, high: 145, isDefault: true },
    { code: "CHLORIDE", low: 98, high: 107, isDefault: true },
    { code: "BICARBONATE", low: 22, high: 29, isDefault: true },
    { code: "ANION_GAP", low: 8, high: 16, isDefault: true },
    { code: "GLUCOSE", low: 70, high: 99, isDefault: true },
    { code: "TOTAL_CHOLESTEROL", high: 200, isDefault: true },
    { code: "HDL", low: 40, isDefault: true },
    { code: "LDL", high: 100, isDefault: true },
    { code: "NON_HDL", high: 130, isDefault: true },
    { code: "TRIGLYCERIDES", high: 150, isDefault: true },
    { code: "TC_HDL_RATIO", high: 5, isDefault: true },
    { code: "DE_RITIS", low: 0.5, high: 2.0, isDefault: true },
  ];
  for (const r of ranges) {
    const test = await prisma.test.findUniqueOrThrow({ where: { vendorId_code: { vendorId: vendor.id, code: r.code } } });
    const existingRange = await prisma.referenceRange.findFirst({ where: { testId: test.id, isDefault: r.isDefault ?? false, gender: r.gender ?? null } });
    if (existingRange) continue;
    await prisma.referenceRange.create({
      data: {
        testId: test.id,
        gender: r.gender ?? null,
        ageMinDays: r.ageMinDays ?? 6570, // default bands are adult (18y+); pediatric ranges to be added per-test
        ageMaxDays: r.ageMaxDays ?? 43800,
        low: r.low ?? null,
        high: r.high ?? null,
        isDefault: r.isDefault ?? false,
      },
    });
  }

  // Critical/panic thresholds — a representative few, per spec's call-back workflow
  const criticalThresholds: { code: string; low?: number; high?: number }[] = [
    { code: "HB", low: 6 },
    { code: "PLATELET", low: 20000 },
    { code: "TLC", low: 1000, high: 30000 },
    { code: "GLUCOSE", low: 40, high: 500 },
    { code: "SODIUM", low: 120, high: 160 },
    { code: "CREATININE", high: 6 },
  ];
  for (const c of criticalThresholds) {
    const test = await prisma.test.findUniqueOrThrow({ where: { vendorId_code: { vendorId: vendor.id, code: c.code } } });
    const existingCritical = await prisma.criticalThreshold.findFirst({ where: { testId: test.id } });
    if (existingCritical) continue;
    await prisma.criticalThreshold.create({ data: { testId: test.id, low: c.low ?? null, high: c.high ?? null } });
  }

  console.log("Seed complete.");
  console.log("Lab ID: aliquot. Login as admin@lab.test — password: Password123!");

  const hqHash = await bcrypt.hash("Password123!", 10);
  await prisma.superAdmin.upsert({
    where: { email: "hq@aliquot.test" },
    update: { name: "Aliquot HQ", active: true },
    create: { email: "hq@aliquot.test", name: "Aliquot HQ", passwordHash: hqHash },
  });
  const plans = BILLING_PLANS;
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        seats: plan.seats,
        intervalMonths: plan.intervalMonths,
        intervalDays: plan.intervalDays,
        priceInr: plan.priceInr,
        active: true,
      },
      create: { ...plan },
    });
  }
  await prisma.plan.updateMany({
    where: { code: { in: [...LEGACY_PLAN_CODES] } },
    data: { active: false },
  });
  console.log("HQ login: hq@aliquot.test — password: Password123! (start with npm run hq)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
