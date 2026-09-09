import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HQ_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = path.join(HQ_ROOT, "..");

loadEnv({ path: path.join(REPO_ROOT, ".env") });
loadEnv({ path: path.join(HQ_ROOT, ".env"), override: true });

export { HQ_ROOT };

export function hqDatabaseUrl() {
  const url =
    process.env.HQ_DATABASE_URL?.trim() ||
    process.env.CLOUD_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Set HQ_DATABASE_URL, CLOUD_DATABASE_URL (Neon master), or DATABASE_URL for Aliquot HQ.");
  }
  return url;
}

export function hqSessionSecret() {
  return process.env.HQ_SESSION_SECRET || process.env.AUTH_SECRET || "dev-hq-session-secret";
}

export const HQ_PORT = Number(process.env.HQ_API_PORT || 8787);
export const HQ_ORIGIN = process.env.HQ_ORIGIN || "http://127.0.0.1:5174";
