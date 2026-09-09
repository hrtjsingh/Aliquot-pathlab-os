import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { LoginForm } from "./login-form.client";

async function authenticate(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
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
