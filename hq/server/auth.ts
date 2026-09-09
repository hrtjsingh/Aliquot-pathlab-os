import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { hqPrisma } from "./db.ts";
import { HQ_ORIGIN, hqSessionSecret } from "./env.ts";

export type HqActor = { id: string; email: string; name: string };
export type Env = { Variables: { hq: HqActor } };

const COOKIE = "hq_session";
const MAX_AGE_SEC = 60 * 60 * 12;

function signToken(payload: string) {
  const sig = createHmac("sha256", hqSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function readToken(token: string): { id: string; exp: number } | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = createHmac("sha256", hqSessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id: string; exp: number };
    if (!parsed.id || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSessionCookie(c: Context, actor: HqActor) {
  const payload = Buffer.from(JSON.stringify({ id: actor.id, exp: Date.now() + MAX_AGE_SEC * 1000 }), "utf8").toString(
    "base64url"
  );
  setCookie(c, COOKIE, signToken(payload), {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
    secure: HQ_ORIGIN.startsWith("https"),
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

export const requireHq: MiddlewareHandler<Env> = async (c, next) => {
  const token = getCookie(c, COOKIE);
  if (!token) return c.json({ error: "Sign in as super admin." }, 401);
  const parsed = readToken(token);
  if (!parsed) return c.json({ error: "Session expired. Sign in again." }, 401);
  const admin = await hqPrisma.superAdmin.findUnique({ where: { id: parsed.id } });
  if (!admin || !admin.active) return c.json({ error: "Super admin is not active." }, 401);
  c.set("hq", { id: admin.id, email: admin.email, name: admin.name });
  await next();
};
