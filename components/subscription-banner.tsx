export type LicenseBannerData = {
  writable: boolean;
  source: string;
  message: string;
};

export function SubscriptionBanner({ license }: { license: LicenseBannerData | null }) {
  if (!license) return null;
  if (license.source === "unsigned-dev") {
    return (
      <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
        Subscription is not enforced yet. Start Aliquot HQ once so this lab can verify a signed lease.
      </div>
    );
  }
  if (license.writable) return null;
  return (
    <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      {license.message}
    </div>
  );
}
