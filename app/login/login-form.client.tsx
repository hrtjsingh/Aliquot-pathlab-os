"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BrandLockup } from "@/components/brand-mark";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/theme-toggle";

const DEMO_PASSWORD = "Password123!";

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@lab.test" },
  { role: "Front desk", email: "frontdesk@lab.test" },
  { role: "Technologist", email: "tech@lab.test" },
  { role: "Pathologist", email: "pathologist@lab.test" },
];

export function LoginForm({
  error,
  action,
}: {
  error?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    if (error) toast.error("Sign-in failed. Check the email and password, then try again.");
  }, [error]);

  function fillDemoAccount(account: (typeof DEMO_ACCOUNTS)[number]) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setDemoOpen(false);
    toast.success(`${account.role} details filled. Click Sign in.`);
  }

  return (
    <div className="relative flex min-h-dvh">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle compact />
      </div>

      <aside className="relative hidden w-[42%] flex-col justify-between bg-brand px-10 py-12 text-brand-foreground lg:flex">
        <div className="w-fit">
          <BrandLockup invert />
        </div>
        <div className="flex flex-col gap-5">
          <h1 className="max-w-sm text-4xl font-semibold leading-[1.15] tracking-tight text-balance">
            Generate, authorize, and release lab reports.
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-brand-foreground/75">
            Enter results, take a pathologist signature, and send a signed diagnostic PDF from one workspace.
          </p>
          <ul className="flex flex-col gap-2 text-sm text-brand-foreground/80">
            <li>Enter results on the worklist</li>
            <li>Pathologist authorizes</li>
            <li>Release a signed diagnostic PDF</li>
          </ul>
        </div>
        <p className="text-xs text-brand-foreground/60">
          Chemistry, hematology, and pathology — one report, one signature.
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-background p-6">
        <Card className="w-full max-w-sm border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Sign in to Aliquot</CardTitle>
            <CardDescription>Use your lab account to generate and release reports. Demo logins are listed if you are evaluating.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={action}
              onSubmit={() => {
                setPending(true);
                toast.message("Signing in…");
              }}
              className="flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="tech@lab.test"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              {error ? <p className="text-xs text-destructive">Invalid email or password.</p> : null}
              <Button type="submit" className="mt-1" disabled={pending}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" className="mt-3 w-full" type="button">
                  View demo accounts
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Demo accounts</DialogTitle>
                  <DialogDescription>
                    Click a role to fill email and password. Each role sees the same lab data with different permissions.
                  </DialogDescription>
                </DialogHeader>
                <ul className="flex flex-col gap-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <li key={account.email}>
                      <button
                        type="button"
                        onClick={() => fillDemoAccount(account)}
                        className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
                      >
                        <span className="flex flex-col">
                          <span className="font-medium">{account.role}</span>
                          <span className="tabular text-xs text-muted-foreground">{account.email}</span>
                        </span>
                        <span className="text-xs font-medium text-primary">Use this</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
