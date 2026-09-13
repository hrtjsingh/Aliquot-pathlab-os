import { PrismaClient } from "@prisma/client";
import {
  availableDbTargets,
  describeDatabaseUrl,
  hqDatabaseUrl,
  persistDbTarget,
  resolveHqDbTarget,
  type HqDbTarget,
} from "./env.ts";

type Holder = {
  client: PrismaClient;
  target: HqDbTarget;
};

function createClient(target: HqDbTarget) {
  return new PrismaClient({
    datasources: { db: { url: hqDatabaseUrl(target) } },
  });
}

const globalForHq = globalThis as unknown as { hqDbHolder?: Holder };

function initHolder(): Holder {
  const target = resolveHqDbTarget();
  const holder = {
    client: createClient(target),
    target,
  };
  persistDbTarget(target);
  return holder;
}

const holder = globalForHq.hqDbHolder ?? initHolder();
if (process.env.NODE_ENV !== "production") globalForHq.hqDbHolder = holder;

/** Live Prisma client. Rebinds when the HQ env target switches. */
export const hqPrisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const value = Reflect.get(holder.client, prop, holder.client);
    return typeof value === "function" ? value.bind(holder.client) : value;
  },
});

export function getHqDbTarget() {
  return holder.target;
}

export function getHqDbInfo() {
  const available = availableDbTargets();
  const url = hqDatabaseUrl(holder.target);
  return {
    target: holder.target,
    label: holder.target === "cloud" ? "Cloud (Neon)" : "Local",
    host: describeDatabaseUrl(url),
    available,
  };
}

export async function switchHqDbTarget(next: HqDbTarget) {
  const available = availableDbTargets();
  if (next === "cloud" && !available.cloud) throw new Error("CLOUD_DATABASE_URL is not set.");
  if (next === "local" && !available.local) throw new Error("DATABASE_URL / HQ_DATABASE_URL is not set.");
  if (next === holder.target) return getHqDbInfo();

  const previous = holder.client;
  const nextClient = createClient(next);
  try {
    await nextClient.$connect();
  } catch (error) {
    await nextClient.$disconnect().catch(() => undefined);
    throw error instanceof Error ? error : new Error("Could not connect to that database.");
  }

  holder.client = nextClient;
  holder.target = next;
  persistDbTarget(next);
  await previous.$disconnect().catch(() => undefined);
  return getHqDbInfo();
}
