"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReportLinkPending } from "@/components/page-loader";

interface NavigationLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
}

function NavStatus({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  useReportLinkPending(pending);

  return (
    <>
      {children}
      <Loader2
        aria-hidden
        className={cn(
          "ml-auto size-3.5 shrink-0 text-accent transition-opacity",
          pending ? "animate-spin opacity-100" : "opacity-0"
        )}
      />
    </>
  );
}

export function NavigationLink({ href, children, className, active, onClick }: NavigationLinkProps) {
  return (
    <Link
      href={href as never}
      prefetch
      onClick={onClick}
      className={className}
      aria-current={active ? "page" : undefined}
    >
      <NavStatus>{children}</NavStatus>
    </Link>
  );
}
