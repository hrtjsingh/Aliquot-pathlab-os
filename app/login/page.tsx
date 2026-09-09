import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_VENDOR_SLUG } from "@/lib/rbac";
import { getLicenseStatus } from "@/lib/license";
import { LoginForm } from "./login-form.client";

async function authenticate(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const vendorSlug =
    String(formData.get("vendorSlug") ?? DEFAULT_VENDOR_SLUG)
      .trim()
      .toLowerCase() || DEFAULT_VENDOR_SLUG;

  if (email && password) {
    const vendor = await prisma.vendor.findFirst({ where: { slug: vendorSlug } });
    if (vendor) {
      const user = await prisma.user.findUnique({
        where: { vendorId_email: { vendorId: vendor.id, email } },
      });
      if (user?.active && (await bcrypt.compare(password, user.passwordHash))) {
        const license = await getLicenseStatus(vendor.id, { refreshMs: 1200 });
        if (!license.writable) redirect("/login?error=subscription");
      }
    }
  }

  try {
    await signIn("credentials", {
      vendorSlug,
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (err: unknown) {
    const typed = err as { type?: string };
    if (typed?.type === "CredentialsSignin") redirect("/login?error=1");
    throw err;
  }
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <LoginForm error={error} action={authenticate} />;
}
