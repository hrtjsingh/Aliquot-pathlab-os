import { NextResponse } from "next/server";
import { getLabSnapshot, syncLabData } from "@/app/actions/offline";
import { ForbiddenError, UnauthenticatedError } from "@/lib/rbac";
import { Prisma } from "@prisma/client";

function fail(error: unknown) {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "";
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    /can't reach database|timed out fetching a new connection/i.test(message)
  ) {
    return NextResponse.json(
      { error: "Lab database is not running. On the lab server, start it with npm run db:up." },
      { status: 503 }
    );
  }
  console.error("[lab/sync]", error);
  return NextResponse.json({ error: "Could not load lab data." }, { status: 500 });
}

/** Cached snapshot only. Does not push to Neon. */
export async function GET() {
  try {
    const snapshot = await getLabSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return fail(error);
  }
}

/** Flush-ready snapshot plus vendor-scoped cloud backup. */
export async function POST() {
  try {
    const snapshot = await syncLabData();
    return NextResponse.json(snapshot);
  } catch (error) {
    return fail(error);
  }
}
