import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell
      user={{
        name: session.user.name,
        role: (session.user as { role?: string }).role ?? "",
      }}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
