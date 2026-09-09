import { PrismaClient } from "@prisma/client";

const globalForCloud = globalThis as unknown as { cloudPrisma?: PrismaClient | null };

function cloudDatasourceUrl(url: string) {
  if (/[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=2&connect_timeout=8&pool_timeout=8`;
}

function hasBillingModels(client: PrismaClient) {
  const asModels = client as unknown as {
    licenseCache?: { findUnique?: unknown };
    subscription?: { findUnique?: unknown };
  };
  return (
    typeof asModels.licenseCache?.findUnique === "function" &&
    typeof asModels.subscription?.findUnique === "function"
  );
}

export function getCloudPrisma(): PrismaClient | null {
  const url = process.env.CLOUD_DATABASE_URL?.trim();
  if (!url) return null;
  const cached = globalForCloud.cloudPrisma;
  if (cached && hasBillingModels(cached)) return cached;
  if (cached) {
    void cached.$disconnect().catch(() => undefined);
    globalForCloud.cloudPrisma = null;
  }
  const client = new PrismaClient({ datasources: { db: { url: cloudDatasourceUrl(url) } } });
  globalForCloud.cloudPrisma = client;
  return client;
}
