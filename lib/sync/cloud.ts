import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCloudPrisma } from "@/lib/prisma-cloud";
import { cacheSignedLease } from "@/lib/license";

export type CloudConflict = {
  entityType: string;
  entityId: string;
  reason: string;
};

export type CloudSyncResult = {
  ok: boolean;
  skipped: boolean;
  pending?: boolean;
  pushed: number;
  pulled: number;
  conflicts: CloudConflict[];
  message: string;
};

export type CloudBackupStatus = {
  running: boolean;
  result: CloudSyncResult | null;
  lastPushedAt: string | null;
  lastError: string | null;
  updatedAt: string | null;
};

type CloudClient = NonNullable<ReturnType<typeof getCloudPrisma>>;

const JSON_KEYS = new Set(["organismPanel", "layoutJson", "beforeJson", "afterJson"]);

function payload(value: object) {
  const parsed = JSON.parse(
    JSON.stringify(value, (_key, current) => {
      if (current && typeof current === "object" && typeof (current as { toNumber?: unknown }).toNumber === "function") {
        return (current as { toNumber: () => number }).toNumber();
      }
      return current;
    })
  ) as Record<string, unknown>;
  for (const key of JSON_KEYS) {
    if (parsed[key] === null) parsed[key] = Prisma.DbNull;
  }
  return parsed;
}

function dataWithoutId(value: object) {
  const data = payload(value);
  delete data.id;
  return data;
}

function mappedFk(
  id: string | null | undefined,
  map: Map<string, string>,
  fallback: string | null = null
): string | null {
  if (!id) return fallback;
  if (map.has(id)) return map.get(id) ?? fallback;
  for (const cloudId of map.values()) {
    if (cloudId === id) return id;
  }
  return fallback;
}

function remap(data: Record<string, unknown>, key: string, map: Map<string, string>, fallback: string | null = null) {
  const current = data[key];
  data[key] = mappedFk(typeof current === "string" ? current : null, map, fallback);
}

function sinceWhere(since: Date | null) {
  return since ? { updatedAt: { gt: since } } : {};
}

function isUniqueConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === "P2002";
  return error instanceof Error && error.message.includes("Unique constraint failed");
}

function uniqueEqualsWhere(uniqueWhere: object) {
  if (!uniqueWhere || typeof uniqueWhere !== "object") return {};
  const inner = Object.values(uniqueWhere)[0];
  if (inner && typeof inner === "object" && !Array.isArray(inner) && !(inner instanceof Date)) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inner as Record<string, unknown>)) {
      if (v !== undefined) clean[k] = v;
    }
    return clean;
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(uniqueWhere as Record<string, unknown>)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

function withoutUniqueFields(data: Record<string, unknown>, uniqueWhere: object) {
  const next = { ...data };
  for (const key of Object.keys(uniqueEqualsWhere(uniqueWhere))) delete next[key];
  return next;
}

async function findByBusinessKey(model: any, uniqueWhere: object) {
  try {
    const found = await model.findUnique({ where: uniqueWhere as never });
    if (found) return found;
  } catch {
    /* Compound unique name can disagree after schema changes; equals-where still works. */
  }
  try {
    const where = uniqueEqualsWhere(uniqueWhere);
    if (where && Object.keys(where).length > 0) {
      return await model.findFirst({ where: where as never });
    }
  } catch {
    /* Safely ignore findFirst fallback failure if equals-where is not supported */
  }
  return null;
}

async function updateIgnoringUnique(
  model: any,
  id: string,
  data: Record<string, unknown>,
  uniqueWhere: object
) {
  try {
    await model.update({ where: { id }, data: data as never });
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    await model.update({ where: { id }, data: withoutUniqueFields(data, uniqueWhere) as never });
  }
  return id;
}

async function mergeByUnique<T extends { id: string }>(
  model: any,
  item: T,
  uniqueWhere: object,
  adjust?: (data: Record<string, unknown>) => void
): Promise<string> {
  const createData = payload(item);
  const updateData = dataWithoutId(item);
  adjust?.(createData);
  adjust?.(updateData);

  // Prefer the row that already owns vendorId+code/email/mrn so a leftover
  // local-id row from a partial backup cannot steal that unique key.
  const byKey = await findByBusinessKey(model, uniqueWhere);
  if (byKey) return updateIgnoringUnique(model, byKey.id, updateData, uniqueWhere);

  const byId = await model.findUnique({ where: { id: item.id } as never });
  if (byId) {
    try {
      await model.update({ where: { id: byId.id }, data: updateData as never });
      return byId.id as string;
    } catch (error) {
      if (!isUniqueConflict(error)) throw error;
      const owner = await findByBusinessKey(model, uniqueWhere);
      if (owner) return updateIgnoringUnique(model, owner.id, updateData, uniqueWhere);
      return updateIgnoringUnique(model, byId.id, updateData, uniqueWhere);
    }
  }

  try {
    await model.create({ data: createData as never });
    return String(createData.id ?? item.id);
  } catch (error) {
    if (!isUniqueConflict(error)) throw error;
    const owner =
      (await findByBusinessKey(model, uniqueWhere)) ??
      (await model.findUnique({ where: { id: item.id } as never }));
    if (!owner) throw error;
    return updateIgnoringUnique(model, owner.id, updateData, uniqueWhere);
  }
}

function syncErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Can't reach the cloud database. Check the lab server's cloud backup URL.";
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "unique fields";
      return `Cloud already has a row with the same ${target}.`;
    }
    if (error.code === "P2003") {
      const constraint = typeof error.meta?.constraint === "string" ? error.meta.constraint : "related record";
      return `Cloud backup could not link a ${constraint}.`;
    }
    if (error.code === "P1001" || error.code === "P1017") {
      return "Can't reach the cloud database.";
    }
    if (error.code === "P2024") return "Cloud database is busy. Tap Sync again.";
  }
  if (error instanceof Error) {
    const unique = error.message.match(/Unique constraint failed on the fields: \([^)]+\)/);
    if (unique) return `Cloud already has this record ${unique[0].replace("Unique constraint failed on the fields: ", "")}.`;
    const fk = error.message.match(/Foreign key constraint violated on the constraint: `([^`]+)`/);
    if (fk) return `Cloud backup could not link related records (${fk[1]}).`;
    if (/can't reach database|timed out fetching a new connection/i.test(error.message)) {
      return "Can't reach the cloud database.";
    }
    const compact = error.message.replace(/\s+/g, " ").trim();
    return compact.slice(0, 280) || "Cloud sync failed.";
  }
  return "Cloud sync failed.";
}

const lastByVendor = new Map<string, CloudSyncResult>();
const generation = new Map<string, number>();
const inflight = new Map<
  string,
  { gen: number; startedAt: number; promise: Promise<CloudSyncResult> }
>();
const API_WAIT_MS = 500;
const BACKUP_TIMEOUT_MS = 60_000;
const STALE_MS = 70_000;

export type CloudSyncOptions = {
  /** Null waits until backup finishes. 0 returns immediately if a backup is already running. */
  maxWaitMs?: number | null;
  pull?: boolean;
};

function backupInProgress(): CloudSyncResult {
  return {
    ok: false,
    skipped: false,
    pending: true,
    pushed: 0,
    pulled: 0,
    conflicts: [],
    message: "Cloud backup is already running.",
  };
}

function backupStillRunning(): CloudSyncResult {
  return {
    ok: false,
    skipped: false,
    pending: true,
    pushed: 0,
    pulled: 0,
    conflicts: [],
    message: "Cloud backup is still running.",
  };
}

function backupTimedOut(): CloudSyncResult {
  return {
    ok: false,
    skipped: false,
    pushed: 0,
    pulled: 0,
    conflicts: [],
    message: "Cloud backup timed out. Tap Sync again.",
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jobIsLive(job: { startedAt: number } | undefined) {
  if (!job) return false;
  return Date.now() - job.startedAt < STALE_MS;
}

export async function getCloudSyncStatus(vendorId: string): Promise<CloudBackupStatus> {
  const state = await prisma.syncState.findUnique({ where: { vendorId } });
  const job = inflight.get(vendorId);
  return {
    running: jobIsLive(job),
    result: lastByVendor.get(vendorId) ?? null,
    lastPushedAt: state?.lastPushedAt?.toISOString() ?? null,
    lastError: state?.lastError ?? null,
    updatedAt: state?.updatedAt?.toISOString() ?? null,
  };
}

async function waitForSync(work: Promise<CloudSyncResult>, maxWaitMs: number | null) {
  if (maxWaitMs === null) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = await Promise.race([
    work.then(() => false),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(true), maxWaitMs);
    }),
  ]);
  if (timer) clearTimeout(timer);
  if (timedOut) return backupStillRunning();
  return work;
}

export async function syncVendorToCloud(vendorId: string, options: CloudSyncOptions = {}): Promise<CloudSyncResult> {
  const maxWaitMs = options.maxWaitMs === undefined ? API_WAIT_MS : options.maxWaitMs;
  const pull = options.pull ?? true;
  const existing = inflight.get(vendorId);
  if (existing && jobIsLive(existing)) {
    if (maxWaitMs === null) return existing.promise;
    return backupInProgress();
  }

  const gen = (generation.get(vendorId) ?? 0) + 1;
  generation.set(vendorId, gen);
  lastByVendor.delete(vendorId);

  const work = Promise.race([
    runVendorSync(vendorId, pull, gen),
    sleep(BACKUP_TIMEOUT_MS).then(() => backupTimedOut()),
  ])
    .then((result) => {
      lastByVendor.set(vendorId, result);
      if (!result.ok && result.message.startsWith("Cloud backup timed out")) {
        generation.set(vendorId, gen + 1);
      }
      return result;
    })
    .finally(() => {
      const current = inflight.get(vendorId);
      if (current?.gen === gen) inflight.delete(vendorId);
    });

  inflight.set(vendorId, { gen, startedAt: Date.now(), promise: work });
  return waitForSync(work, maxWaitMs);
}

async function runVendorSync(vendorId: string, pull: boolean, gen: number): Promise<CloudSyncResult> {
  const cloud = getCloudPrisma();
  if (!cloud) {
    return {
      ok: true,
      skipped: true,
      pushed: 0,
      pulled: 0,
      conflicts: [],
      message: "Cloud backup is not configured on this lab server.",
    };
  }

  try {
    const conflicts: CloudConflict[] = [];
    const startedAt = new Date();
    const pushed = await pushVendor(vendorId, cloud, conflicts);
    const pulled = pull ? await pullCatalog(vendorId, cloud, conflicts) : 0;
    await applyTombstones(vendorId, cloud);
    if (generation.get(vendorId) !== gen) {
      return { ok: false, skipped: true, pushed: 0, pulled: 0, conflicts: [], message: "Cloud backup was superseded." };
    }
    await prisma.syncState.upsert({
      where: { vendorId },
      create: { vendorId, lastPushedAt: startedAt, lastPulledAt: pull ? startedAt : undefined, lastError: null },
      update: { lastPushedAt: startedAt, lastPulledAt: pull ? startedAt : undefined, lastError: null },
    });
    const conflictNote = conflicts.length ? ` ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"} need review.` : "";
    const pullNote = pull ? `, pulled ${pulled} catalog rows` : "";
    const backupNote =
      pushed === 0 ? "Lab data is already backed up." : `Backed up ${pushed} new or changed lab row${pushed === 1 ? "" : "s"}${pullNote}.`;
    return {
      ok: true,
      skipped: false,
      pushed,
      pulled,
      conflicts,
      message: `${backupNote}${conflictNote}`,
    };
  } catch (error) {
    console.error("[cloud-sync]", error);
    const message = syncErrorMessage(error);
    if (generation.get(vendorId) !== gen) {
      return { ok: false, skipped: true, pushed: 0, pulled: 0, conflicts: [], message };
    }
    await prisma.syncState.upsert({
      where: { vendorId },
      create: { vendorId, lastError: message },
      update: { lastError: message },
    });
    return { ok: false, skipped: false, pushed: 0, pulled: 0, conflicts: [], message };
  }
}

export async function syncAllVendorsToCloud() {
  if (!process.env.CLOUD_DATABASE_URL) {
    return { skipped: true as const, vendors: 0 };
  }
  const vendors = await prisma.vendor.findMany({ where: { active: true }, select: { id: true } });
  for (const vendor of vendors) {
    await syncVendorToCloud(vendor.id, { maxWaitMs: null, pull: true });
  }
  return { skipped: false as const, vendors: vendors.length };
}

function needsWrite(item: { updatedAt?: Date; createdAt?: Date }, since: Date | null) {
  if (!since) return true;
  const at = item.updatedAt ?? item.createdAt;
  return !at || at > since;
}

function mapLocalToCloud<L extends { id: string }, C extends { id: string }>(
  locals: L[],
  clouds: C[],
  localKey: (item: L) => string,
  cloudKey: (item: C) => string
) {
  const byId = new Map(clouds.map((item) => [item.id, item.id]));
  const byKey = new Map(clouds.map((item) => [cloudKey(item), item.id]));
  const map = new Map<string, string>();
  for (const item of locals) {
    map.set(item.id, byId.get(item.id) ?? byKey.get(localKey(item)) ?? item.id);
  }
  return map;
}

async function countLocalChanges(vendorId: string, since: Date) {
  const updated = { updatedAt: { gt: since } };
  const created = { createdAt: { gt: since } };
  const [
    vendor,
    branches,
    users,
    patients,
    tests,
    panels,
    orders,
    results,
    templates,
    ranges,
    calls,
    deliveries,
  ] = await Promise.all([
    prisma.vendor.count({ where: { id: vendorId, ...updated } }),
    prisma.branch.count({ where: { vendorId, ...updated } }),
    prisma.user.count({ where: { vendorId, ...updated } }),
    prisma.patient.count({ where: { vendorId, ...updated } }),
    prisma.test.count({ where: { vendorId, ...updated } }),
    prisma.panel.count({ where: { vendorId, ...updated } }),
    prisma.order.count({ where: { vendorId, ...updated } }),
    prisma.result.count({ where: { order: { vendorId }, ...updated } }),
    prisma.reportTemplate.count({ where: { vendorId, ...updated } }),
    prisma.referenceRange.count({ where: { test: { vendorId }, ...created } }),
    prisma.criticalValueCall.count({ where: { order: { vendorId }, calledAt: { gt: since } } }),
    prisma.reportDelivery.count({ where: { order: { vendorId }, ...created } }),
  ]);
  return (
    vendor +
    branches +
    users +
    patients +
    tests +
    panels +
    orders +
    results +
    templates +
    ranges +
    calls +
    deliveries
  );
}

async function pushVendor(vendorId: string, cloud: CloudClient, conflicts: CloudConflict[]) {
  const state = await prisma.syncState.findUnique({ where: { vendorId } });
  const since = state?.lastPushedAt ?? null;
  if (since && (await countLocalChanges(vendorId, since)) === 0) return 0;

  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
  const cloudVendor =
    (await cloud.vendor.findUnique({ where: { slug: vendor.slug } })) ??
    (await cloud.vendor.findUnique({ where: { id: vendorId } }));
  const cloudVendorId =
    !cloudVendor || needsWrite(vendor, since)
      ? await mergeByUnique(cloud.vendor, vendor, { slug: vendor.slug })
      : cloudVendor.id;

  let pushed = !cloudVendor || needsWrite(vendor, since) ? 1 : 0;

  const [branches, users, patients, tests, panels] = await Promise.all([
    prisma.branch.findMany({ where: { vendorId } }),
    prisma.user.findMany({ where: { vendorId } }),
    prisma.patient.findMany({ where: { vendorId } }),
    prisma.test.findMany({ where: { vendorId } }),
    prisma.panel.findMany({ where: { vendorId } }),
  ]);

  const [cloudBranches, cloudUsers, cloudPatients, cloudTests, cloudPanels] = await Promise.all([
    cloud.branch.findMany({ where: { vendorId: cloudVendorId }, select: { id: true, code: true } }),
    cloud.user.findMany({ where: { vendorId: cloudVendorId }, select: { id: true, email: true } }),
    cloud.patient.findMany({ where: { vendorId: cloudVendorId }, select: { id: true, mrn: true } }),
    cloud.test.findMany({ where: { vendorId: cloudVendorId }, select: { id: true, code: true } }),
    cloud.panel.findMany({ where: { vendorId: cloudVendorId }, select: { id: true, code: true } }),
  ]);

  const branchMap = mapLocalToCloud(branches, cloudBranches, (item) => item.code, (item) => item.code);
  const userMap = mapLocalToCloud(users, cloudUsers, (item) => item.email, (item) => item.email);
  const patientMap = mapLocalToCloud(patients, cloudPatients, (item) => item.mrn, (item) => item.mrn);
  const testMap = mapLocalToCloud(tests, cloudTests, (item) => item.code, (item) => item.code);
  const panelMap = mapLocalToCloud(panels, cloudPanels, (item) => item.code, (item) => item.code);

  for (const item of branches) {
    if (!needsWrite(item, since)) continue;
    branchMap.set(
      item.id,
      await mergeByUnique(cloud.branch, item, { vendorId_code: { vendorId: cloudVendorId, code: item.code } }, (data) => {
        data.vendorId = cloudVendorId;
      })
    );
    pushed += 1;
  }

  const defaultBranchId = [...branchMap.values()][0] ?? null;
  for (const item of users) {
    if (!needsWrite(item, since)) continue;
    userMap.set(
      item.id,
      await mergeByUnique(cloud.user, item, { vendorId_email: { vendorId: cloudVendorId, email: item.email } }, (data) => {
        data.vendorId = cloudVendorId;
        data.branchId = mappedFk(item.branchId, branchMap, defaultBranchId);
      })
    );
    pushed += 1;
  }

  for (const item of patients) {
    if (!needsWrite(item, since)) continue;
    patientMap.set(
      item.id,
      await mergeByUnique(cloud.patient, item, { vendorId_mrn: { vendorId: cloudVendorId, mrn: item.mrn } }, (data) => {
        data.vendorId = cloudVendorId;
      })
    );
    pushed += 1;
  }

  const changedTestIds = new Set<string>();
  for (const item of tests) {
    if (!needsWrite(item, since)) continue;
    changedTestIds.add(item.id);
    testMap.set(
      item.id,
      await mergeByUnique(cloud.test, item, { vendorId_code: { vendorId: cloudVendorId, code: item.code } }, (data) => {
        data.vendorId = cloudVendorId;
      })
    );
    pushed += 1;
  }

  const ranges = await prisma.referenceRange.findMany({ where: { test: { vendorId } } });
  if (!since) {
    pushed += await replaceChildren(cloud.referenceRange, ranges, (item) => testMap.get(item.testId) ?? item.testId);
  } else {
    const dirtyTestIds = new Set(
      ranges.filter((item) => item.createdAt > since || changedTestIds.has(item.testId)).map((item) => item.testId)
    );
    const rangesToWrite = ranges.filter((item) => dirtyTestIds.has(item.testId));
    if (rangesToWrite.length) {
      pushed += await replaceChildren(
        cloud.referenceRange,
        rangesToWrite,
        (item) => testMap.get(item.testId) ?? item.testId
      );
    }
  }

  const thresholds = await prisma.criticalThreshold.findMany({ where: { test: { vendorId } } });
  if (!since) {
    pushed += await replaceChildren(
      cloud.criticalThreshold,
      thresholds,
      (item) => testMap.get(item.testId) ?? item.testId
    );
  } else if (changedTestIds.size) {
    const dirtyThresholds = thresholds.filter((item) => changedTestIds.has(item.testId));
    if (dirtyThresholds.length) {
      pushed += await replaceChildren(
        cloud.criticalThreshold,
        dirtyThresholds,
        (item) => testMap.get(item.testId) ?? item.testId
      );
    }
  }

  const changedPanelIds = new Set<string>();
  for (const item of panels) {
    if (!needsWrite(item, since)) continue;
    changedPanelIds.add(item.id);
    panelMap.set(
      item.id,
      await mergeByUnique(cloud.panel, item, { vendorId_code: { vendorId: cloudVendorId, code: item.code } }, (data) => {
        data.vendorId = cloudVendorId;
      })
    );
    pushed += 1;
  }

  const panelTests =
    !since
      ? await prisma.panelTest.findMany({ where: { panel: { vendorId } } })
      : changedPanelIds.size || changedTestIds.size
        ? await prisma.panelTest.findMany({
            where: {
              panel: { vendorId },
              OR: [{ panelId: { in: [...changedPanelIds] } }, { testId: { in: [...changedTestIds] } }],
            },
          })
        : [];
  for (const item of panelTests) {
    const panelId = panelMap.get(item.panelId) ?? item.panelId;
    const testId = testMap.get(item.testId) ?? item.testId;
    await mergeByUnique(cloud.panelTest, { ...item, panelId, testId }, { panelId_testId: { panelId, testId } });
    pushed += 1;
  }

  const changedOrders = await prisma.order.findMany({ where: { vendorId, ...sinceWhere(since) } });
  const changedResults = await prisma.result.findMany({
    where: { order: { vendorId }, ...sinceWhere(since) },
  });
  const neededOrderIds = new Set(changedOrders.map((item) => item.id));
  for (const item of changedResults) neededOrderIds.add(item.orderId);

  const extraOrderIds = [...neededOrderIds].filter((id) => !changedOrders.some((order) => order.id === id));
  const extraOrders = extraOrderIds.length ? await prisma.order.findMany({ where: { id: { in: extraOrderIds } } }) : [];
  const ordersToTouch = [...changedOrders, ...extraOrders];

  const orderMap = new Map<string, string>();
  if (ordersToTouch.length) {
    const cloudOrders = await cloud.order.findMany({
      where: { vendorId: cloudVendorId },
      select: { id: true, accessionNo: true, updatedAt: true, status: true },
    });
    for (const [localId, cloudId] of mapLocalToCloud(
      ordersToTouch,
      cloudOrders,
      (item) => item.accessionNo,
      (item) => item.accessionNo
    )) {
      orderMap.set(localId, cloudId);
    }

    for (const item of ordersToTouch) {
      const existing = cloudOrders.find((row) => row.id === orderMap.get(item.id) || row.accessionNo === item.accessionNo) ?? null;
      if (!needsWrite(item, since) && existing) continue;
      const skipped = await pushLabRow(
        item,
        existing,
        async () => {
          const cloudId = await mergeByUnique(
            cloud.order,
            item,
            { vendorId_accessionNo: { vendorId: cloudVendorId, accessionNo: item.accessionNo } },
            (data) => {
              data.vendorId = cloudVendorId;
              remap(data, "patientId", patientMap);
              remap(data, "branchId", branchMap, defaultBranchId);
              if (item.authorizedById) remap(data, "authorizedById", userMap);
            }
          );
          orderMap.set(item.id, cloudId);
        },
        "Order",
        conflicts
      );
      pushed += skipped;
    }
  }

  const orderIds = [...neededOrderIds];
  if (orderIds.length) {
    const orderPanels = await prisma.orderPanel.findMany({ where: { orderId: { in: orderIds } } });
    for (const item of orderPanels) {
      const data = payload(item);
      remap(data, "orderId", orderMap);
      remap(data, "panelId", panelMap);
      await cloud.orderPanel.upsert({
        where: { id: item.id },
        create: data as never,
        update: dataWithoutId({ ...item, orderId: String(data.orderId), panelId: String(data.panelId) }) as never,
      });
      pushed += 1;
    }

    const orderTests = await prisma.orderTest.findMany({ where: { orderId: { in: orderIds } } });
    for (const item of orderTests) {
      const orderId = orderMap.get(item.orderId) ?? item.orderId;
      const testId = testMap.get(item.testId) ?? item.testId;
      await mergeByUnique(cloud.orderTest, { ...item, orderId, testId }, { orderId_testId: { orderId, testId } });
      pushed += 1;
    }

    for (const item of changedResults) {
      const existing = await cloud.result.findUnique({ where: { id: item.id } });
      pushed += await pushLabRow(
        item,
        existing,
        async () => {
          const data = payload(item);
          remap(data, "orderId", orderMap);
          remap(data, "testId", testMap);
          if (item.enteredById) remap(data, "enteredById", userMap);
          if (item.verifiedById) remap(data, "verifiedById", userMap);
          const update = { ...data };
          delete update.id;
          await cloud.result.upsert({
            where: { id: item.id },
            create: data as never,
            update: update as never,
          });
        },
        "Result",
        conflicts
      );
    }

    const calls = await prisma.criticalValueCall.findMany({
      where: { orderId: { in: orderIds }, ...(!since ? {} : { calledAt: { gt: since } }) },
    });
    for (const item of calls) {
      const data = payload(item);
      remap(data, "orderId", orderMap);
      remap(data, "calledById", userMap);
      await cloud.criticalValueCall.upsert({
        where: { id: item.id },
        create: data as never,
        update: dataWithoutId({ ...item, orderId: String(data.orderId), calledById: String(data.calledById) }) as never,
      });
      pushed += 1;
    }
    const deliveries = await prisma.reportDelivery.findMany({
      where: { orderId: { in: orderIds }, ...(!since ? {} : { createdAt: { gt: since } }) },
    });
    for (const item of deliveries) {
      const data = payload(item);
      remap(data, "orderId", orderMap);
      await cloud.reportDelivery.upsert({
        where: { id: item.id },
        create: data as never,
        update: dataWithoutId({ ...item, orderId: String(data.orderId) }) as never,
      });
      pushed += 1;
    }
  }

  for (const item of await prisma.reportTemplate.findMany({ where: { vendorId, ...sinceWhere(since) } })) {
    const data = payload(item);
    data.vendorId = cloudVendorId;
    data.branchId = mappedFk(item.branchId, branchMap, defaultBranchId);
    const update = dataWithoutId(item);
    update.vendorId = cloudVendorId;
    update.branchId = mappedFk(item.branchId, branchMap, defaultBranchId);
    await cloud.reportTemplate.upsert({
      where: { id: item.id },
      create: data as never,
      update: update as never,
    });
    pushed += 1;
  }

  return pushed;
}

async function replaceChildren<T extends { id: string; testId: string }>(
  model: { deleteMany: (args: never) => Promise<unknown>; createMany: (args: never) => Promise<unknown> },
  items: T[],
  cloudTestId: (item: T) => string
) {
  if (!items.length) return 0;
  const rows = items.map((item) => ({ ...payload(item), testId: cloudTestId(item) }));
  const testIds = Array.from(new Set(rows.map((row) => String(row.testId))));
  await model.deleteMany({
    where: { OR: [{ testId: { in: testIds } }, { id: { in: items.map((item) => item.id) } }] },
  } as never);
  await model.createMany({ data: rows } as never);
  return items.length;
}

async function pushLabRow<T extends { id: string; updatedAt: Date }>(
  item: T,
  existing: { updatedAt: Date; status?: string } | null,
  write: () => Promise<unknown>,
  entityType: string,
  conflicts: CloudConflict[]
) {
  if (existing && existing.updatedAt > item.updatedAt) {
    const protectedStatus =
      existing.status === "AUTHORIZED" ||
      existing.status === "RELEASED" ||
      existing.status === "SENT_TO_CUSTOMER" ||
      existing.status === "COLLECTED_BY_CUSTOMER";
    if (protectedStatus) {
      conflicts.push({
        entityType,
        entityId: item.id,
        reason: `Cloud ${entityType.toLowerCase()} is newer and already ${String(existing.status).toLowerCase()}. Lab copy was kept locally and not overwritten on the backup.`,
      });
      return 0;
    }
    conflicts.push({
      entityType,
      entityId: item.id,
      reason: `Both lab and cloud changed this ${entityType.toLowerCase()}. The lab copy was kept.`,
    });
  }
  await write();
  return 1;
}

async function pullCatalog(vendorId: string, cloud: CloudClient, conflicts: CloudConflict[]) {
  const vendor = await cloud.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    const bySlug = await cloud.vendor.findFirst({ where: { slug: "aliquot" } });
    if (!bySlug) return 0;
    return pullCatalog(bySlug.id, cloud, conflicts);
  }
  const localVendorId = await mergeByUnique(prisma.vendor, vendor, { slug: vendor.slug });

  let pulled = 1;
  const branchMap = new Map<string, string>();
  for (const item of await cloud.branch.findMany({ where: { vendorId: vendor.id } })) {
    const localId = await mergeByUnique(
      prisma.branch,
      item,
      { vendorId_code: { vendorId: localVendorId, code: item.code } },
      (data) => {
        data.vendorId = localVendorId;
      }
    );
    branchMap.set(item.id, localId);
    pulled += 1;
  }
  const defaultBranchId = [...branchMap.values()][0] ?? null;

  pulled += await pullIfCloudNewer(
    await cloud.user.findMany({ where: { vendorId: vendor.id } }),
    async (item) =>
      (await prisma.user.findUnique({ where: { id: item.id } })) ??
      (await prisma.user.findUnique({ where: { vendorId_email: { vendorId: localVendorId, email: item.email } } })),
    (item) =>
      mergeByUnique(prisma.user, item, { vendorId_email: { vendorId: localVendorId, email: item.email } }, (data) => {
        data.vendorId = localVendorId;
        data.branchId = mappedFk(item.branchId, branchMap, defaultBranchId);
      }),
    "User",
    conflicts
  );
  const testMap = new Map<string, string>();
  const cloudTests = await cloud.test.findMany({ where: { vendorId: vendor.id } });
  pulled += await pullIfCloudNewer(
    cloudTests,
    async (item) =>
      (await prisma.test.findUnique({ where: { id: item.id } })) ??
      (await prisma.test.findUnique({ where: { vendorId_code: { vendorId: localVendorId, code: item.code } } })),
    (item) =>
      mergeByUnique(prisma.test, item, { vendorId_code: { vendorId: localVendorId, code: item.code } }, (data) => {
        data.vendorId = localVendorId;
      }),
    "Test",
    conflicts
  );
  for (const item of cloudTests) {
    const local =
      (await prisma.test.findUnique({ where: { id: item.id } })) ??
      (await prisma.test.findUnique({ where: { vendorId_code: { vendorId: localVendorId, code: item.code } } }));
    if (local) testMap.set(item.id, local.id);
  }

  for (const item of await cloud.referenceRange.findMany({ where: { test: { vendorId: vendor.id } } })) {
    const testId = mappedFk(item.testId, testMap);
    if (!testId) continue;
    const data = { ...payload(item), testId };
    await prisma.referenceRange.upsert({
      where: { id: item.id },
      create: data as never,
      update: dataWithoutId({ ...item, testId }) as never,
    });
    pulled += 1;
  }
  for (const item of await cloud.criticalThreshold.findMany({ where: { test: { vendorId: vendor.id } } })) {
    const testId = mappedFk(item.testId, testMap);
    if (!testId) continue;
    const data = { ...payload(item), testId };
    await prisma.criticalThreshold.upsert({
      where: { id: item.id },
      create: data as never,
      update: dataWithoutId({ ...item, testId }) as never,
    });
    pulled += 1;
  }

  const panelMap = new Map<string, string>();
  const cloudPanels = await cloud.panel.findMany({ where: { vendorId: vendor.id } });
  pulled += await pullIfCloudNewer(
    cloudPanels,
    async (item) =>
      (await prisma.panel.findUnique({ where: { id: item.id } })) ??
      (await prisma.panel.findUnique({ where: { vendorId_code: { vendorId: localVendorId, code: item.code } } })),
    (item) =>
      mergeByUnique(prisma.panel, item, { vendorId_code: { vendorId: localVendorId, code: item.code } }, (data) => {
        data.vendorId = localVendorId;
      }),
    "Panel",
    conflicts
  );
  for (const item of cloudPanels) {
    const local =
      (await prisma.panel.findUnique({ where: { id: item.id } })) ??
      (await prisma.panel.findUnique({ where: { vendorId_code: { vendorId: localVendorId, code: item.code } } }));
    if (local) panelMap.set(item.id, local.id);
  }
  for (const item of await cloud.panelTest.findMany({ where: { panel: { vendorId: vendor.id } } })) {
    const panelId = mappedFk(item.panelId, panelMap);
    const testId = mappedFk(item.testId, testMap);
    if (!panelId || !testId) continue;
    await mergeByUnique(prisma.panelTest, { ...item, panelId, testId }, { panelId_testId: { panelId, testId } });
    pulled += 1;
  }

  const cloudSub = await cloud.subscription.findFirst({
    where: { OR: [{ vendorId: vendor.id }, { vendor: { slug: vendor.slug } }] },
    select: { signedLease: true },
  });
  if (cloudSub?.signedLease) {
    if (await cacheSignedLease(localVendorId, cloudSub.signedLease)) pulled += 1;
  }

  return pulled;
}

async function pullIfCloudNewer<T extends { id: string; updatedAt: Date }>(
  cloudRows: T[],
  findLocal: (item: T) => Promise<{ updatedAt: Date } | null>,
  write: (item: T) => Promise<unknown>,
  entityType: string,
  conflicts: CloudConflict[]
) {
  let pulled = 0;
  for (const item of cloudRows) {
    const local = await findLocal(item);
    if (local && local.updatedAt > item.updatedAt) continue;
    if (local && local.updatedAt.getTime() !== item.updatedAt.getTime()) {
      conflicts.push({
        entityType,
        entityId: item.id,
        reason: `HQ ${entityType.toLowerCase()} is newer and was applied on this lab.`,
      });
    }
    await write(item);
    pulled += 1;
  }
  return pulled;
}

async function applyTombstones(vendorId: string, cloud: CloudClient) {
  const stones = await prisma.tombstone.findMany({ where: { vendorId } });
  for (const stone of stones) {
    if (stone.entityType === "Test") await cloud.test.deleteMany({ where: { id: stone.entityId, vendorId } });
    if (stone.entityType === "Patient") await cloud.patient.deleteMany({ where: { id: stone.entityId, vendorId } });
    if (stone.entityType === "Panel") await cloud.panel.deleteMany({ where: { id: stone.entityId, vendorId } });
  }
}
