import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import bcrypt from "bcryptjs";
import { addDays } from "date-fns";
import { Hono } from "hono";
import { cors } from "hono/cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { Role, SubscriptionStatus } from "@prisma/client";
import { formatPlanTerm, planExpiresAt, planIsTrial } from "../../lib/billing-plans.ts";
import { buildLeasePayload, signLease } from "../../lib/license-crypto.ts";
import { clearSessionCookie, requireHq, setSessionCookie, type Env } from "./auth.ts";
import { hqPrisma, getHqDbInfo, switchHqDbTarget } from "./db.ts";
import { HQ_ORIGIN, HQ_PORT, HQ_ROOT, type HqDbTarget } from "./env.ts";
import { loadOrCreateHqKeys } from "./license-keys.ts";
import { ensureHqSeed, HQ_EMAIL, HQ_PASSWORD } from "./seed.ts";

const app = new Hono<Env>();

app.use(
  "/api/*",
  cors({
    origin: [HQ_ORIGIN, "http://localhost:5174", "http://127.0.0.1:5174"],
    credentials: true,
  })
);


async function signVendorLease(input: {
  vendorId: string;
  vendorSlug: string;
  status: SubscriptionStatus;
  seats: number;
  planCode: string;
  expiresAt: Date;
}) {
  const keys = loadOrCreateHqKeys();
  return signLease(buildLeasePayload(input), keys.privateKeyPem);
}

function labDto(vendor: {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  createdAt: Date;
  users: Array<{ id: string }>;
  _count: { patients: number; orders: number };
  subscription: {
    id: string;
    status: SubscriptionStatus;
    seats: number;
    startsAt: Date;
    expiresAt: Date;
    notes: string | null;
    plan: { code: string; name: string; priceInr: unknown };
  } | null;
}) {
  return {
    id: vendor.id,
    slug: vendor.slug,
    name: vendor.name,
    active: vendor.active,
    createdAt: vendor.createdAt.toISOString(),
    users: vendor.users.length,
    patients: vendor._count.patients,
    orders: vendor._count.orders,
    subscription: vendor.subscription
      ? {
          id: vendor.subscription.id,
          status: vendor.subscription.status,
          seats: vendor.subscription.seats,
          startsAt: vendor.subscription.startsAt.toISOString(),
          expiresAt: vendor.subscription.expiresAt.toISOString(),
          notes: vendor.subscription.notes,
          plan: {
            code: vendor.subscription.plan.code,
            name: vendor.subscription.plan.name,
            priceInr: Number(vendor.subscription.plan.priceInr ?? 0),
          },
        }
      : null,
  };
}

app.post("/api/auth/login", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!email || !password) return c.json({ error: "Email and password are required." }, 400);
  const admin = await hqPrisma.superAdmin.findUnique({ where: { email } });
  if (!admin || !admin.active) return c.json({ error: "Those HQ credentials are not recognised." }, 401);
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return c.json({ error: "Those HQ credentials are not recognised." }, 401);
  setSessionCookie(c, { id: admin.id, email: admin.email, name: admin.name });
  return c.json({ id: admin.id, email: admin.email, name: admin.name });
});

app.get("/api/env", (c) =>
  c.json({
    ...getHqDbInfo(),
    prefill: { email: HQ_EMAIL, password: HQ_PASSWORD, name: "Aliquot HQ" },
  })
);

app.post("/api/env", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { target?: string } | null;
  const target = body?.target?.trim().toLowerCase();
  if (target !== "cloud" && target !== "local") {
    return c.json({ error: "Choose cloud or local." }, 400);
  }
  try {
    const info = await switchHqDbTarget(target as HqDbTarget);
    await ensureHqSeed();
    return c.json({
      ...info,
      prefill: { email: HQ_EMAIL, password: HQ_PASSWORD, name: "Aliquot HQ" },
    });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Could not switch database." }, 400);
  }
});

app.post("/api/auth/logout", (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});

app.use("/api/me", requireHq);
app.get("/api/me", (c) => c.json(c.get("hq")));

app.use("/api/plans", requireHq);
app.get("/api/plans", async (c) => {
  const plans = await hqPrisma.plan.findMany({ where: { active: true }, orderBy: { priceInr: "asc" } });
  return c.json(
    plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      seats: plan.seats,
      intervalMonths: plan.intervalMonths,
      intervalDays: plan.intervalDays,
      priceInr: Number(plan.priceInr ?? 0),
    }))
  );
});

app.use("/api/overview", requireHq);
app.get("/api/overview", async (c) => {
  const now = new Date();
  const in14 = addDays(now, 14);
  const since30 = addDays(now, -30);
  const since14 = addDays(now, -14);
  const dayKeys: string[] = [];
  for (let i = 13; i >= 0; i--) {
    dayKeys.push(addDays(now, -i).toISOString().slice(0, 10));
  }

  const [vendors, billedAll, billed30, recentBilling, recentOrders] = await Promise.all([
    hqPrisma.vendor.findMany({
      orderBy: { name: "asc" },
      include: {
        subscription: { include: { plan: true } },
        users: { where: { active: true }, select: { id: true } },
        _count: { select: { patients: true, orders: true } },
      },
    }),
    hqPrisma.billingEvent.aggregate({ _sum: { amountInr: true } }),
    hqPrisma.billingEvent.aggregate({
      _sum: { amountInr: true },
      where: { createdAt: { gte: since30 } },
    }),
    hqPrisma.billingEvent.findMany({
      take: 14,
      orderBy: { createdAt: "desc" },
      include: {
        subscription: {
          include: { vendor: { select: { name: true, slug: true } } },
        },
      },
    }),
    hqPrisma.order.findMany({
      where: { createdAt: { gte: since14 } },
      select: { createdAt: true },
    }),
  ]);

  const labs = vendors.map(labDto);
  const lease = { active: 0, trial: 0, expiring: 0, expired: 0, suspended: 0, missing: 0 };
  const planCounts = new Map<string, { code: string; name: string; count: number; priceInr: number }>();
  const attention: typeof labs = [];
  let patients = 0;
  let orders = 0;

  for (const lab of labs) {
    patients += lab.patients;
    orders += lab.orders;
    const tone = leaseBucket(lab.subscription, now, in14);
    lease[tone] += 1;
    if (tone === "expiring" || tone === "expired" || tone === "suspended" || tone === "missing") {
      attention.push(lab);
    }
    const plan = lab.subscription?.plan;
    if (plan) {
      const row = planCounts.get(plan.code) ?? {
        code: plan.code,
        name: plan.name,
        count: 0,
        priceInr: plan.priceInr,
      };
      row.count += 1;
      planCounts.set(plan.code, row);
    }
  }

  const orderMap = new Map(dayKeys.map((day) => [day, 0]));
  for (const order of recentOrders) {
    const day = order.createdAt.toISOString().slice(0, 10);
    if (orderMap.has(day)) orderMap.set(day, (orderMap.get(day) ?? 0) + 1);
  }

  return c.json({
    labs: labs.length,
    patients,
    orders,
    billedInr: Number(billedAll._sum.amountInr ?? 0),
    billed30dInr: Number(billed30._sum.amountInr ?? 0),
    lease,
    plans: [...planCounts.values()].sort((a, b) => b.count - a.count),
    attention: attention.slice(0, 8),
    orders14d: dayKeys.map((date) => ({ date, count: orderMap.get(date) ?? 0 })),
    billing: recentBilling.map((event) => ({
      id: event.id,
      kind: event.kind,
      note: event.note,
      amountInr: event.amountInr == null ? null : Number(event.amountInr),
      actorEmail: event.actorEmail,
      createdAt: event.createdAt.toISOString(),
      labName: event.subscription.vendor.name,
      labSlug: event.subscription.vendor.slug,
    })),
  });
});

function leaseBucket(
  sub: { status: string; expiresAt: string } | null,
  now: Date,
  in14: Date
): "active" | "trial" | "expiring" | "expired" | "suspended" | "missing" {
  if (!sub) return "missing";
  if (sub.status === "SUSPENDED" || sub.status === "CANCELLED") return "suspended";
  const expires = new Date(sub.expiresAt);
  if (expires.getTime() <= now.getTime()) return "expired";
  if (sub.status === "TRIAL") return "trial";
  if (expires.getTime() <= in14.getTime()) return "expiring";
  return "active";
}

app.use("/api/labs", requireHq);
app.use("/api/labs/*", requireHq);

app.get("/api/labs", async (c) => {
  const vendors = await hqPrisma.vendor.findMany({
    orderBy: { name: "asc" },
    include: {
      subscription: { include: { plan: true } },
      users: { where: { active: true }, select: { id: true } },
      _count: { select: { patients: true, orders: true } },
    },
  });
  return c.json(vendors.map(labDto));
});

app.post("/api/labs", async (c) => {
  const actor = c.get("hq");
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    adminName?: string;
    adminEmail?: string;
    adminPassword?: string;
    planCode?: string;
  } | null;
  const name = body?.name?.trim();
  const slug = body?.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const adminName = body?.adminName?.trim();
  const adminEmail = body?.adminEmail?.trim().toLowerCase();
  const adminPassword = body?.adminPassword ?? "";
  const planCode = body?.planCode?.trim().toUpperCase() || "TRIAL";
  if (!name || !slug) return c.json({ error: "Lab name and ID are required." }, 400);
  if (!adminName || !adminEmail || adminPassword.length < 8) {
    return c.json({ error: "Admin name, email, and a password of at least 8 characters are required." }, 400);
  }
  const taken = await hqPrisma.vendor.findUnique({ where: { slug } });
  if (taken) return c.json({ error: "That lab ID is already in use." }, 409);
  const plan = await hqPrisma.plan.findUnique({ where: { code: planCode } });
  if (!plan || !plan.active) return c.json({ error: "Unknown plan." }, 400);

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const expiresAt = planExpiresAt(plan);
  const status = planIsTrial(plan.code) ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE;
  const vendor = await hqPrisma.$transaction(async (tx) => {
    const created = await tx.vendor.create({ data: { slug, name, active: true } });
    const branch = await tx.branch.create({
      data: { vendorId: created.id, name: "Main Lab", code: "MAIN" },
    });
    await tx.user.create({
      data: {
        vendorId: created.id,
        branchId: branch.id,
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: Role.ADMIN,
      },
    });
    const signedLease = await signVendorLease({
      vendorId: created.id,
      vendorSlug: created.slug,
      status,
      seats: plan.seats,
      planCode: plan.code,
      expiresAt,
    });
    await tx.subscription.create({
      data: {
        vendorId: created.id,
        planId: plan.id,
        status,
        seats: plan.seats,
        expiresAt,
        signedLease,
        billingEvents: {
          create: {
            kind: "CREATED",
            amountInr: plan.priceInr,
            note: `${plan.name} · ${formatPlanTerm(plan)}`,
            actorEmail: actor.email,
          },
        },
      },
    });
    return tx.vendor.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        subscription: { include: { plan: true } },
        users: { where: { active: true }, select: { id: true } },
        _count: { select: { patients: true, orders: true } },
      },
    });
  });
  return c.json(labDto(vendor), 201);
});

app.get("/api/labs/:id", async (c) => {
  const vendor = await hqPrisma.vendor.findUnique({
    where: { id: c.req.param("id") },
    include: {
      subscription: { include: { plan: true, billingEvents: { orderBy: { createdAt: "desc" }, take: 50 } } },
      users: {
        where: { active: true },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      },
      branches: { select: { id: true, name: true, code: true } },
      _count: { select: { patients: true, orders: true } },
    },
  });
  if (!vendor) return c.json({ error: "Lab was not found." }, 404);
  return c.json({
    ...labDto(vendor),
    users: vendor.users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
    branches: vendor.branches,
    billing: (vendor.subscription?.billingEvents ?? []).map((event) => ({
      id: event.id,
      kind: event.kind,
      note: event.note,
      actorEmail: event.actorEmail,
      amountInr: event.amountInr == null ? null : Number(event.amountInr),
      createdAt: event.createdAt.toISOString(),
    })),
  });
});

app.post("/api/labs/:id/users", async (c) => {
  const vendorId = c.req.param("id");
  const existingCount = await hqPrisma.user.count({ where: { vendorId } });
  if (existingCount > 0) {
    return c.json({ error: "Each lab has one login. Update that user instead." }, 409);
  }
  const vendor = await hqPrisma.vendor.findUnique({
    where: { id: vendorId },
    include: { branches: true },
  });
  if (!vendor) return c.json({ error: "Lab was not found." }, 404);
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
  } | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!name || !email || password.length < 8) {
    return c.json({ error: "Name, email, and a password of at least 8 characters are required." }, 400);
  }
  const branchId = vendor.branches[0]?.id || null;
  const user = await hqPrisma.user.create({
    data: {
      vendorId,
      branchId,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: Role.ADMIN,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return c.json({ ...user, createdAt: user.createdAt.toISOString() }, 201);
});

app.patch("/api/labs/:id/user", async (c) => {
  const vendorId = c.req.param("id");
  const user = await hqPrisma.user.findFirst({
    where: { vendorId },
    orderBy: { createdAt: "asc" },
  });
  if (!user) return c.json({ error: "This lab has no login yet." }, 404);
  const body = (await c.req.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
  } | null;
  const name = body?.name?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password ?? "";
  if (!name || !email) return c.json({ error: "Name and email are required." }, 400);
  const clash = await hqPrisma.user.findFirst({
    where: { vendorId, email, id: { not: user.id } },
  });
  if (clash) return c.json({ error: "That email is already used in this lab." }, 409);
  const data: { name: string; email: string; passwordHash?: string; role: typeof Role.ADMIN } = {
    name,
    email,
    role: Role.ADMIN,
  };
  if (password) {
    if (password.length < 8) return c.json({ error: "Password must be at least 8 characters." }, 400);
    data.passwordHash = await bcrypt.hash(password, 10);
  }
  const updated = await hqPrisma.user.update({
    where: { id: user.id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  await hqPrisma.user.updateMany({
    where: { vendorId, id: { not: user.id } },
    data: { active: false },
  });
  return c.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

app.patch("/api/labs/:id/subscription", async (c) => {
  const actor = c.get("hq");
  const vendor = await hqPrisma.vendor.findUnique({
    where: { id: c.req.param("id") },
    include: { subscription: { include: { plan: true } } },
  });
  if (!vendor) return c.json({ error: "Lab was not found." }, 404);
  if (!vendor.subscription) return c.json({ error: "This lab has no subscription yet." }, 400);

  const body = (await c.req.json().catch(() => null)) as {
    planCode?: string;
    seats?: number;
    applyTerm?: boolean;
    status?: SubscriptionStatus;
    note?: string;
  } | null;

  let plan = vendor.subscription.plan;
  if (body?.planCode) {
    const next = await hqPrisma.plan.findUnique({ where: { code: body.planCode.trim().toUpperCase() } });
    if (!next || !next.active) return c.json({ error: "Unknown plan." }, 400);
    plan = next;
  }

  const seats = body?.seats != null ? Math.max(1, Number(body.seats)) : plan.seats;
  const applyTerm = Boolean(body?.applyTerm) || plan.id !== vendor.subscription.planId;
  let status = body?.status ?? vendor.subscription.status;
  if (applyTerm && body?.status == null) {
    status = planIsTrial(plan.code) ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE;
  }
  if (!Object.values(SubscriptionStatus).includes(status)) return c.json({ error: "Unknown status." }, 400);

  let expiresAt = vendor.subscription.expiresAt;
  let startsAt = vendor.subscription.startsAt;
  if (applyTerm) {
    const samePlan = plan.id === vendor.subscription.planId;
    const start = samePlan && expiresAt.getTime() > Date.now() ? expiresAt : new Date();
    if (!samePlan) startsAt = start;
    expiresAt = planExpiresAt(plan, start);
  }

  const signedLease = await signVendorLease({
    vendorId: vendor.id,
    vendorSlug: vendor.slug,
    status,
    seats,
    planCode: plan.code,
    expiresAt,
  });

  const kinds: string[] = [];
  if (plan.id !== vendor.subscription.planId) kinds.push("PLAN_CHANGED");
  if (applyTerm) kinds.push("EXTENDED");
  if (status !== vendor.subscription.status) kinds.push("STATUS");
  if (seats !== vendor.subscription.seats) kinds.push("SEATS");
  if (!kinds.length) kinds.push("UPDATED");
  const amountInr = applyTerm ? plan.priceInr : null;

  const vendorActive = status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIAL;
  const updated = await hqPrisma.$transaction(async (tx) => {
    const next = await tx.subscription.update({
      where: { id: vendor.subscription.id },
      data: {
        planId: plan.id,
        seats,
        status,
        startsAt,
        expiresAt,
        signedLease,
        notes: body?.note?.trim() || vendor.subscription.notes,
        billingEvents: {
          create: kinds.map((kind, index) => ({
            kind,
            note:
              body?.note?.trim() ||
              [
                applyTerm ? `${plan.name} · ${formatPlanTerm(plan)}` : null,
                status !== vendor.subscription.status ? `Status ${status}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Updated",
            amountInr: index === 0 ? amountInr : null,
            actorEmail: actor.email,
          })),
        },
      },
      include: { plan: true },
    });
    await tx.vendor.update({
      where: { id: vendor.id },
      data: { active: vendorActive },
    });
    return next;
  });

  return c.json({
    id: updated.id,
    status: updated.status,
    seats: updated.seats,
    startsAt: updated.startsAt.toISOString(),
    expiresAt: updated.expiresAt.toISOString(),
    notes: updated.notes,
    plan: { code: updated.plan.code, name: updated.plan.name, priceInr: Number(updated.plan.priceInr ?? 0) },
  });
});

const distDir = path.join(HQ_ROOT, "dist");
if (existsSync(distDir)) {
  app.use("/*", serveStatic({ root: distDir }));
  app.get("*", serveStatic({ path: path.join(distDir, "index.html") }));
}

async function main() {
  const info = getHqDbInfo();
  await ensureHqSeed();
  serve({ fetch: app.fetch, port: HQ_PORT, hostname: "127.0.0.1" }, (infoPort) => {
    console.log(`Aliquot HQ API http://127.0.0.1:${infoPort.port}`);
    console.log(`Database: ${info.label} · ${info.host}`);
    console.log(`HQ login: ${HQ_EMAIL} / ${HQ_PASSWORD}`);
    console.log("UI: npm run dev:ui  →  http://127.0.0.1:5174");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
