import bcrypt from "bcryptjs";
import { SubscriptionStatus } from "@prisma/client";
import { BILLING_PLANS, LEGACY_PLAN_CODES, planExpiresAt } from "../../lib/billing-plans.ts";
import { buildLeasePayload, signLease } from "../../lib/license-crypto.ts";
import { hqPrisma } from "./db.ts";
import { loadOrCreateHqKeys } from "./license-keys.ts";

const HQ_EMAIL = "hq@aliquot.test";
const HQ_PASSWORD = "Password123!";

export async function ensureHqSeed() {
  const keys = loadOrCreateHqKeys();

  for (const plan of BILLING_PLANS) {
    await hqPrisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        seats: plan.seats,
        intervalMonths: plan.intervalMonths,
        intervalDays: plan.intervalDays,
        priceInr: plan.priceInr,
        active: true,
      },
      create: plan,
    });
  }
  await hqPrisma.plan.updateMany({
    where: { code: { in: [...LEGACY_PLAN_CODES] } },
    data: { active: false },
  });

  const passwordHash = await bcrypt.hash(HQ_PASSWORD, 10);
  await hqPrisma.superAdmin.upsert({
    where: { email: HQ_EMAIL },
    update: { name: "Aliquot HQ", active: true },
    create: { email: HQ_EMAIL, name: "Aliquot HQ", passwordHash },
  });

  const trial = await hqPrisma.plan.findUniqueOrThrow({ where: { code: "TRIAL" } });
  const year = await hqPrisma.plan.findUniqueOrThrow({ where: { code: "Y1" } });
  const legacySubs = await hqPrisma.subscription.findMany({
    where: { plan: { code: { in: [...LEGACY_PLAN_CODES] } } },
    include: { vendor: true },
  });
  for (const sub of legacySubs) {
    await hqPrisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId: year.id,
        seats: year.seats,
        signedLease: signLease(
          buildLeasePayload({
            vendorId: sub.vendorId,
            vendorSlug: sub.vendor.slug,
            status: sub.status,
            seats: year.seats,
            planCode: year.code,
            expiresAt: sub.expiresAt,
          }),
          keys.privateKeyPem
        ),
      },
    });
  }

  const vendor = await hqPrisma.vendor.findUnique({ where: { slug: "aliquot" } });
  if (vendor) {
    const existing = await hqPrisma.subscription.findUnique({
      where: { vendorId: vendor.id },
      include: { plan: true },
    });
    if (existing) {
      await hqPrisma.subscription.update({
        where: { id: existing.id },
        data: {
          signedLease: signLease(
            buildLeasePayload({
              vendorId: vendor.id,
              vendorSlug: vendor.slug,
              status: existing.status,
              seats: existing.seats,
              planCode: existing.plan.code,
              expiresAt: existing.expiresAt,
            }),
            keys.privateKeyPem
          ),
        },
      });
    } else {
      const expiresAt = planExpiresAt(trial);
      await hqPrisma.subscription.create({
        data: {
          vendorId: vendor.id,
          planId: trial.id,
          status: SubscriptionStatus.TRIAL,
          seats: trial.seats,
          expiresAt,
          signedLease: signLease(
            buildLeasePayload({
              vendorId: vendor.id,
              vendorSlug: vendor.slug,
              status: SubscriptionStatus.TRIAL,
              seats: trial.seats,
              planCode: trial.code,
              expiresAt,
            }),
            keys.privateKeyPem
          ),
          billingEvents: {
            create: { kind: "CREATED", note: "Trial · 10 days", actorEmail: HQ_EMAIL },
          },
        },
      });
    }
  }

  return keys;
}

export { HQ_EMAIL, HQ_PASSWORD };
