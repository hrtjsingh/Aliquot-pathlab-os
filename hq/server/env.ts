import { config as loadEnv } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HQ_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = path.join(HQ_ROOT, "..");

loadEnv({ path: path.join(REPO_ROOT, ".env") });
loadEnv({ path: path.join(HQ_ROOT, ".env"), override: true });

export { HQ_ROOT };

export type HqDbTarget = "cloud" | "local";

const DATA_DIR = path.join(HQ_ROOT, ".data");
const TARGET_FILE = path.join(DATA_DIR, "db-target");

export function availableDbTargets() {
  return {
    cloud: Boolean(process.env.CLOUD_DATABASE_URL?.trim()),
    local: Boolean(process.env.HQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim()),
  };
}

export function readPersistedDbTarget(): HqDbTarget | null {
  try {
    if (!existsSync(TARGET_FILE)) return null;
    const value = readFileSync(TARGET_FILE, "utf8").trim().toLowerCase();
    return value === "cloud" || value === "local" ? value : null;
  } catch {
    return null;
  }
}

export function persistDbTarget(target: HqDbTarget) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TARGET_FILE, `${target}\n`, "utf8");
}

export function resolveHqDbTarget(preferred?: string | null): HqDbTarget {
  const available = availableDbTargets();
  const fromEnv = process.env.HQ_DB_TARGET?.trim().toLowerCase();
  const choice = (preferred || fromEnv || readPersistedDbTarget() || "").toLowerCase();

  if (choice === "cloud") {
    if (!available.cloud) throw new Error("CLOUD_DATABASE_URL is not set.");
    return "cloud";
  }
  if (choice === "local") {
    if (!available.local) throw new Error("DATABASE_URL / HQ_DATABASE_URL is not set.");
    return "local";
  }

  // Default: cloud master when available, else local.
  if (available.cloud) return "cloud";
  if (available.local) return "local";
  throw new Error("Set CLOUD_DATABASE_URL (Neon master) or DATABASE_URL / HQ_DATABASE_URL for Aliquot HQ.");
}

export function hqDatabaseUrl(target: HqDbTarget = resolveHqDbTarget()) {
  if (target === "cloud") {
    const url = process.env.CLOUD_DATABASE_URL?.trim();
    if (!url) throw new Error("CLOUD_DATABASE_URL is not set.");
    return url;
  }
  const url = process.env.HQ_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("Set HQ_DATABASE_URL or DATABASE_URL for local HQ.");
  return url;
}

export function describeDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    const db = parsed.pathname.replace(/^\//, "") || "db";
    return `${parsed.hostname}/${db.split("?")[0]}`;
  } catch {
    return "configured database";
  }
}

export function hqSessionSecret() {
  return process.env.HQ_SESSION_SECRET || process.env.AUTH_SECRET || "dev-hq-session-secret";
}

export const HQ_PORT = Number(process.env.HQ_API_PORT || 8787);
export const HQ_ORIGIN = process.env.HQ_ORIGIN || "http://127.0.0.1:5174";
