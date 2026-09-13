"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteUnusedTest } from "@/app/actions/admin";

export function DeleteTestButton({ testId, name }: { testId: string; name: string }) {
  const router = useRouter();

  return (
    <ConfirmDialog
      title={`Delete ${name}?`}
      description="If this test was never used, it is removed. If it appears on an order, it is deactivated instead so history stays intact."
      confirmLabel="Delete unused"
      variant="destructive"
      trigger={
        <Button size="sm" variant="ghost" type="button">
          Delete
        </Button>
      }
      onConfirm={async () => {
        const result = await deleteUnusedTest(testId);
        if (!result.ok) return result;
        router.refresh();
        return { ok: true as const };
      }}
      successMessage={`${name} removed from the catalog, or deactivated if it was already used.`}
    />
  );
}
