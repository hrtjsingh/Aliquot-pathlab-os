import { PrismaClient } from "@prisma/client";
import { hqDatabaseUrl } from "./env.ts";

const globalForHq = globalThis as unknown as { hqPrisma?: PrismaClient };

export const hqPrisma =
  globalForHq.hqPrisma ??
  new PrismaClient({
    datasources: { db: { url: hqDatabaseUrl() } },
  });

if (process.env.NODE_ENV !== "production") globalForHq.hqPrisma = hqPrisma;
