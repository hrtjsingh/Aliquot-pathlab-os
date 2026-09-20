import { auth } from "@/auth";
import { getLabConfig } from "@/app/actions/lab";
import { PageHeader } from "@/components/page-header";
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
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Lab configuration"
        description="Letterhead plus Aliquot report templates. Save the selected template to print it on released reports."
      />
      <LabConfigForm branch={config.branch} layout={config.layout} templates={config.templates} />
    </div>
  );
}
