import { auth } from "@/auth";
import { getLabConfig } from "@/app/actions/lab";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { LabConfigForm } from "./lab-config-form.client";

export default async function LabConfigPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;

  if (role !== "ADMIN") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
        <PageHeader title="Lab configuration" description="Only administrators can change laboratory letterhead and PDF output." />
      </div>
    );
  }

  const config = await getLabConfig();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Lab configuration"
        description="Set letterhead, accreditation, and the printed PDF layout used when a report is released."
        hint={
          <InstructionAlert title="How PDF output is built">
            Letterhead and contact details print on every released report. Toggle columns and footer copy, then save. Download a sample PDF to check the printed page against the live preview.
          </InstructionAlert>
        }
      />
      <LabConfigForm branch={config.branch} layout={config.layout} />
    </div>
  );
}
