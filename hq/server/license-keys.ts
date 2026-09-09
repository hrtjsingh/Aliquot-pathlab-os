import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { HQ_ROOT, REPO_ROOT } from "./env.ts";

const DATA_DIR = path.join(HQ_ROOT, ".data");
const PRIVATE_PATH = path.join(DATA_DIR, "private.pem");
const PUBLIC_PATH = path.join(DATA_DIR, "public.pem");
const LIMS_PUBLIC_PATH = path.join(REPO_ROOT, ".license-public.pem");

export type HqKeys = { publicKeyPem: string; privateKeyPem: string };

function writePublicCopies(publicKeyPem: string) {
  writeFileSync(PUBLIC_PATH, publicKeyPem);
  writeFileSync(LIMS_PUBLIC_PATH, publicKeyPem);
}

export function loadOrCreateHqKeys(): HqKeys {
  const fromEnvPrivate = process.env.LICENSE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  const fromEnvPublic = process.env.LICENSE_PUBLIC_KEY?.replace(/\\n/g, "\n").trim();
  if (fromEnvPrivate && fromEnvPublic) {
    writeFileSync(LIMS_PUBLIC_PATH, fromEnvPublic.endsWith("\n") ? fromEnvPublic : `${fromEnvPublic}\n`);
    return { privateKeyPem: fromEnvPrivate, publicKeyPem: fromEnvPublic };
  }

  mkdirSync(DATA_DIR, { mode: 0o700, recursive: true });
  if (existsSync(PRIVATE_PATH) && existsSync(PUBLIC_PATH)) {
    const privateKeyPem = readFileSync(PRIVATE_PATH, "utf8");
    const publicKeyPem = readFileSync(PUBLIC_PATH, "utf8");
    writePublicCopies(publicKeyPem);
    return { privateKeyPem, publicKeyPem };
  }

  const pair = generateKeyPairSync("ed25519");
  const privateKeyPem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  writeFileSync(PRIVATE_PATH, privateKeyPem, { mode: 0o600 });
  writePublicCopies(publicKeyPem);
  return { privateKeyPem, publicKeyPem };
}
