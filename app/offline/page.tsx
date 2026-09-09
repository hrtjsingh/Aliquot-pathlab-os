import type { Metadata } from "next";
import { BrandLockup } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Offline",
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background p-6">
      <BrandLockup />
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">You’re offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Aliquot will keep using pages you already opened. New work is queued and sent when the connection returns.
        </p>
      </div>
      <Button asChild>
        <a href="/dashboard">Try again</a>
      </Button>
    </div>
  );
}
