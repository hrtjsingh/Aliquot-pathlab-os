"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useReportLinkPending } from "@/components/page-loader";

interface NavigationLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  active?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
  title?: string;
}

function NavStatus({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  useReportLinkPending(pending);

  return (
    <>
      {children}
      {pending ? (
        <Loader2
          aria-hidden
          className="ml-auto size-3.5 shrink-0 animate-spin text-accent"
        />
      ) : null}
    </>
  );
}

export function NavigationLink({ href, children, className, active, onClick, "aria-label": ariaLabel, title }: NavigationLinkProps) {
  return (
    <Link
      href={href as never}
      prefetch
      onClick={onClick}
      className={className}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
      title={title}
    >
      <NavStatus>{children}</NavStatus>
    </Link>
  );
}
