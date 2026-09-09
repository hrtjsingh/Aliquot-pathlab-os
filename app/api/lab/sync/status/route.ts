import { NextResponse } from "next/server";
import { requireTenant, ForbiddenError, UnauthenticatedError } from "@/lib/rbac";
import { getCloudSyncStatus } from "@/lib/sync/cloud";

function fail(error: unknown) {
  if (error instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return NextResponse.json({ error: "Could not check backup status." }, { status: 500 });
}

/** In-progress / completed cloud backup for this lab. Does not start a new sync. */
export async function GET() {
  try {
    const user = await requireTenant();
    const status = await getCloudSyncStatus(user.vendorId);
    return NextResponse.json(status);
  } catch (error) {
    return fail(error);
  }
}
