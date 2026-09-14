"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ClipboardList,
  FileOutput,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLockup, BrandMark } from "@/components/brand-mark";
import { NavPendingProvider } from "@/components/page-loader";
import { NavigationLink } from "@/components/navigation-link";
import { DataSyncProvider, SyncControl } from "@/components/data-sync";
import { useIsInstalledPwa } from "@/lib/client-pwa";
import { SubscriptionBanner, type LicenseBannerData } from "@/components/subscription-banner";
import type { LabSnapshot } from "@/app/actions/offline";
import { ROLE_LABELS } from "@/components/status-badge";
import { cn } from "@/lib/utils";

const NAV: Array<{ href: string; label: string; icon: typeof LayoutDashboard; roles?: string[] }> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/worklist", label: "Worklist", icon: ClipboardList },
  { href: "/orders/new", label: "New Order", icon: FlaskConical },
  { href: "/admin/tests", label: "Test Master", icon: Settings, roles: ["ADMIN"] },
  { href: "/admin/packages", label: "Packages", icon: Package, roles: ["ADMIN"] },
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
  initialSnapshot = null,
  license = null,
  children,
}: {
  user: { name: string | null | undefined; role: string; vendorSlug?: string | null };
  signOutAction: () => Promise<void>;
  initialSnapshot?: LabSnapshot | null;
  license?: LicenseBannerData | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isPwa = useIsInstalledPwa();

  const navItems = NAV.filter((item) => !item.roles || item.roles.includes(user.role));

  const desktopNavTabs = (
    <nav className="flex min-w-0 items-center gap-1 overflow-x-auto py-1">
      {navItems.map((item) => {
        const active = navActive(item.href, pathname);
        return (
          <NavigationLink
            key={item.href}
            href={item.href}
            active={active}
            aria-label={item.label}
            title={item.label}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-bold transition-all duration-150 whitespace-nowrap lg:px-3 lg:py-1.5",
              active
                ? "bg-accent/12 text-accent shadow-2xs"
                : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
            )}
          >
            <item.icon className={cn("size-4 shrink-0", active ? "text-accent" : "text-muted-foreground")} />
            <span className="sr-only lg:not-sr-only">{item.label}</span>
            {active ? (
              <span className="absolute bottom-0 left-1.5 right-1.5 h-0.5 rounded-full bg-accent lg:left-2 lg:right-2" />
            ) : null}
          </NavigationLink>
        );
      })}
    </nav>
  );

  const mobileNav = (
    <nav className="flex flex-col gap-1 p-2.5">
      {navItems.map((item) => {
        const active = navActive(item.href, pathname);
        return (
          <NavigationLink
            key={item.href}
            href={item.href}
            active={active}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-base font-bold transition-all duration-150",
              active
                ? "bg-sidebar-accent text-sidebar-foreground shadow-2xs"
                : "text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            {active ? (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-accent" />
            ) : null}
            <item.icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-accent" : "text-sidebar-muted group-hover:text-sidebar-foreground"
              )}
            />
            <span>{item.label}</span>
          </NavigationLink>
        );
      })}
    </nav>
  );

  const initials = user.name ? user.name.slice(0, 2).toUpperCase() : "U";

  const mobileFooter = (
    <div className="flex flex-col gap-2.5 border-t border-sidebar-border/80 p-3 bg-sidebar/50">
      <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border/60 bg-background/40 p-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-sidebar-foreground">{user.name}</p>
          <div className="flex items-center gap-1">
            <span className="truncate text-[11px] font-medium text-sidebar-muted">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            {user.vendorSlug ? (
              <span className="text-[10px] rounded bg-secondary px-1 text-sidebar-muted">
                {user.vendorSlug}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {isPwa ? <SyncControl /> : null}
        <div className="flex items-center justify-between gap-1">
          <ThemeToggle />
          <form action={signOutAction} className="flex-1">
            <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground hover:text-destructive" type="submit">
              <LogOut className="size-3.5" />
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <DataSyncProvider initialSnapshot={initialSnapshot}>
    <NavPendingProvider>
    <div className="flex min-h-full flex-col bg-background">
      {/* Top Navbar Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        {/* Desktop Top Header Bar with Top Tabs */}
        <div className="hidden md:flex h-14 items-center justify-between px-4 lg:px-6 max-w-7xl mx-auto w-full gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-4 lg:gap-6">
            <NavigationLink
              href="/dashboard"
              showPendingSpinner={false}
              className="cursor-pointer hover:opacity-90 transition-opacity shrink-0"
            >
              <BrandLockup compact />
            </NavigationLink>
            {desktopNavTabs}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-border/80 bg-secondary/40 py-1 pl-1 pr-2.5 transition-all duration-150 hover:bg-secondary hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <div className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold shadow-2xs">
                    {initials}
                  </div>
                  <div className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-semibold text-foreground leading-tight truncate max-w-[120px]">{user.name}</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">{ROLE_LABELS[user.role] ?? user.role}</span>
                  </div>
                  <ChevronDown className="size-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-64 p-2 shadow-xl rounded-xl border-border bg-popover">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-secondary/60">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold shadow-2xs">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{user.name}</p>
                    <p className="truncate text-[11px] font-medium text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
                    {user.vendorSlug ? (
                      <span className="inline-block text-[10px] font-mono text-accent bg-accent/10 rounded px-1.5 py-0.5 mt-0.5">
                        Lab {user.vendorSlug}
                      </span>
                    ) : null}
                  </div>
                </div>

                <DropdownMenuSeparator className="my-2" />

                {isPwa ? (
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-secondary/50">
                    <span className="text-xs font-semibold text-foreground">Data Sync</span>
                    <SyncControl compact={false} />
                  </div>
                ) : null}

                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-secondary/50">
                  <span className="text-xs font-semibold text-foreground">Appearance</span>
                  <ThemeToggle />
                </div>

                <DropdownMenuSeparator className="my-2" />

                <form action={signOutAction} className="w-full">
                  <button
                    type="submit"
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="size-3.5" />
                    <span>Sign out</span>
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile Header Bar */}
        <div className="flex h-14 items-center justify-between px-4 md:hidden">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <NavigationLink
              href="/dashboard"
              showPendingSpinner={false}
              className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <BrandMark className="size-7" />
              <span className="text-sm font-semibold">Aliquot</span>
            </NavigationLink>
          </div>
          <div className="flex items-center gap-1">
            {isPwa ? <SyncControl compact /> : null}
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col overflow-hidden bg-sidebar shadow-lg">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
              <NavigationLink
                href="/dashboard"
                showPendingSpinner={false}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
              >
                <BrandMark className="size-7" />
                <span className="text-sm font-semibold">Aliquot</span>
              </NavigationLink>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{mobileNav}</div>
            <div className="shrink-0">{mobileFooter}</div>
          </aside>
        </div>
      ) : null}

      {/* Main Content Area */}
      <main className="min-h-0 min-w-0 flex-1 bg-background">
        <SubscriptionBanner license={license} />
        {children}
      </main>
    </div>
    </NavPendingProvider>
    </DataSyncProvider>
  );
}
