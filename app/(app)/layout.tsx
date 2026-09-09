import { signOut } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ForbiddenError, SubscriptionBlockedError, requireUser } from "@/lib/rbac";
import { getLabSnapshot } from "@/app/actions/offline";
import { getLicenseStatus } from "@/lib/license";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await requireUser();
    if (!user.vendorId) redirect("/login");
  } catch (error) {
    if (error instanceof ForbiddenError) redirect("/login");
    throw error;
  }

  const license = await getLicenseStatus(user.vendorId, { refreshMs: 800 }).catch(() => null);
  if (license && !license.writable) {
    redirect("/api/lab/subscription-blocked");
  }

  let initialSnapshot = null;
  try {
    initialSnapshot = await getLabSnapshot();
  } catch (error) {
    if (error instanceof SubscriptionBlockedError) {
      redirect("/api/lab/subscription-blocked");
    }
  }

  return (
    <AppShell
      user={{
        name: user.name,
        role: user.role,
        vendorSlug: user.vendorSlug,
      }}
      signOutAction={signOutAction}
      initialSnapshot={initialSnapshot}
      license={license}
    >
      {children}
    </AppShell>
  );
}
