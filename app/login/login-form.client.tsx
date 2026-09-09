"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { LoginHero } from "@/components/login-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { markSyncAfterLogin } from "@/components/data-sync";
import { FlaskConical, ClipboardCheck, FileCheck, Mail } from "lucide-react";

const DEMO_EMAIL = "admin@lab.test";
const DEMO_PASSWORD = "Password123!";

const CREDENTIAL_BULLETS = [
  { icon: FlaskConical, label: "Patient + accession", desc: "Register once, order from the same record." },
  { icon: ClipboardCheck, label: "Worklist-driven entry", desc: "Techs see only what needs results today." },
  { icon: FileCheck, label: "Authorize & release", desc: "Pathologist signs; patient gets the PDF." },
];

export function LoginForm({
  error,
  action,
}: {
  error?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [vendorSlug, setVendorSlug] = useState("aliquot");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (error === "subscription") {
      toast.error("This lab’s subscription is suspended or expired. Contact Aliquot HQ.");
    } else if (error) {
      toast.error("Sign-in failed. Check the email and password, then try again.");
    }
  }, [error]);

  return (
    <div className="relative flex min-h-dvh">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle compact />
      </div>

      <LoginHero />

      <main className="flex flex-1 flex-col items-center justify-center bg-background p-6">
        <div className="flex w-full max-w-sm flex-col gap-5">
          <div className="flex flex-col items-center gap-3 lg:hidden">
            <BrandMark className="size-11" />
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">Aliquot</p>
              <p className="text-xs text-muted-foreground">Lab reports</p>
            </div>
          </div>

          <Card className="w-full border-border/80 shadow-sm">
            <CardHeader className="gap-2 pb-4">
              <CardTitle className="text-lg">Sign in</CardTitle>
              <CardDescription>
                Enter your lab ID and account. Demo lab ID is <span className="font-medium text-foreground">aliquot</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pb-6">
              <form
                action={action}
                onSubmit={() => {
                  setPending(true);
                  markSyncAfterLogin();
                  toast.message("Signing in…");
                }}
                className="flex flex-col gap-3"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="vendorSlug">Lab ID</Label>
                  <Input
                    id="vendorSlug"
                    name="vendorSlug"
                    required
                    autoComplete="organization"
                    placeholder="aliquot"
                    value={vendorSlug}
                    onChange={(event) => setVendorSlug(event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="admin@lab.test"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <span className="text-[11px] text-muted-foreground">Demo: Password123!</span>
                  </div>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-10"
                  />
                </div>
                {error === "subscription" ? (
                  <p className="text-xs text-destructive">
                    This lab’s subscription is suspended or expired. Contact Aliquot HQ.
                  </p>
                ) : error ? (
                  <p className="text-xs text-destructive">Invalid email or password.</p>
                ) : null}
                <Button type="submit" className="mt-1 h-10" disabled={pending}>
                  <Mail className="size-4" />
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <Button
                variant="ghost"
                className="w-full"
                type="button"
                onClick={() => {
                  setVendorSlug("aliquot");
                  setEmail(DEMO_EMAIL);
                  setPassword(DEMO_PASSWORD);
                  toast.success("Demo login filled. Click Sign in.");
                }}
              >
                Use demo login
              </Button>
            </CardContent>
          </Card>

          <div className="hidden grid-cols-3 gap-2 lg:grid">
            {CREDENTIAL_BULLETS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-lg border border-border/60 bg-card p-3">
                <Icon className="size-5 text-accent" />
                <p className="mt-2 text-xs font-semibold text-foreground">{label}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
