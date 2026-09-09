"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { toggleTestActive } from "@/app/actions/admin";

export function ToggleTestButton({ testId, active, name }: { testId: string; active: boolean; name: string }) {
  const router = useRouter();

  return (
    <ConfirmDialog
      title={active ? `Deactivate ${name}?` : `Activate ${name}?`}
      description={
        active
          ? "Inactive tests cannot be ordered on new accessions. Existing orders are unchanged."
          : "This test will appear on New Order for future accessions."
      }
      confirmLabel={active ? "Deactivate" : "Activate"}
      variant={active ? "destructive" : "default"}
      successMessage={active ? `${name} is now inactive.` : `${name} is now active.`}
      trigger={
        <Button size="sm" variant="outline" type="button">
          {active ? "Deactivate" : "Activate"}
        </Button>
      }
      onConfirm={async () => {
        await toggleTestActive(testId, !active);
        router.refresh();
      }}
    />
  );
}
