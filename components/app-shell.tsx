"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileOutput,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLockup, BrandMark } from "@/components/brand-mark";
import { ROLE_LABELS } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const NAV: Array<{ href: string; label: string; icon: typeof LayoutDashboard; roles?: string[] }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/worklist", label: "Worklist", icon: ClipboardList },
  { href: "/orders/new", label: "New Order", icon: FlaskConical },
  { href: "/admin/tests", label: "Test Master", icon: Settings },
  { href: "/admin/lab", label: "Lab config", icon: FileOutput, roles: ["ADMIN"] },
];

function navActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/orders/new") return pathname === "/orders/new";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  user,
  signOutAction,
  children,
}: {
  user: { name: string | null | undefined; role: string };
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = NAV.filter((item) => !item.roles || item.roles.includes(user.role));

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 p-2">
      {navItems.map((item) => {
        const active = navActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href as never}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
            aria-current={active ? "page" : undefined}
          >
            <item.icon className={cn("size-4", active ? "text-accent" : "text-sidebar-muted")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="flex flex-col gap-2 border-t border-sidebar-border p-3">
      <div className="px-1">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</p>
        <p className="text-xs text-sidebar-muted">{ROLE_LABELS[user.role] ?? user.role}</p>
      </div>
      <ThemeToggle />
      <form action={signOutAction}>
        <Button variant="ghost" size="sm" className="w-full justify-start" type="submit">
          <LogOut />
          Sign out
        </Button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-3">
          <BrandLockup compact />
        </div>
        {nav}
        {footer}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <span className="text-sm font-semibold">Aliquot</span>
          </div>
          <ThemeToggle compact />
        </header>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative flex h-full w-64 flex-col bg-sidebar shadow-lg">
              <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
                <div className="flex items-center gap-2">
                  <BrandMark className="size-7" />
                  <span className="text-sm font-semibold">Aliquot</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X />
                </Button>
              </div>
              {nav}
              {footer}
            </aside>
          </div>
        ) : null}

        <main className="min-h-0 flex-1 bg-background">{children}</main>
      </div>
    </div>
  );
}
