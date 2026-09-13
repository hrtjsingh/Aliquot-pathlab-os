import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaBillingGen?: number;
};

const BILLING_CLIENT_GEN = 6;

function datasourceUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=10&pool_timeout=10`;
}

function createPrismaClient() {
  const datasource = datasourceUrl();
  return new PrismaClient(datasource ? { datasources: { db: { url: datasource } } } : undefined);
}

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && globalForPrisma.prismaBillingGen === BILLING_CLIENT_GEN) return cached;
  if (cached) void cached.$disconnect().catch(() => undefined);
  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaBillingGen = BILLING_CLIENT_GEN;
  return client;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
