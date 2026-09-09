import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { AddTestDialog } from "./add-test-dialog";
import { ToggleTestButton } from "./toggle-test-button";
import { TestProfileDialog } from "./test-profile-dialog";
import type { TestProfile } from "@/lib/test-profile";
import { FlaskConical } from "lucide-react";

function toProfile(t: {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  category: string;
  specimenType: string;
  method: string | null;
  loincCode: string | null;
  unit: string | null;
  turnaroundHours: number | null;
  description: string | null;
  collectionNotes: string | null;
  dataType: string;
  isDerived: boolean;
  autoVerifyEligible: boolean;
  referenceRanges: TestProfile["referenceRanges"];
  criticalThresholds: TestProfile["criticalThresholds"];
  panelTests: Array<{ panel: { code: string; name: string } }>;
}): TestProfile {
  return {
    id: t.id,
    code: t.code,
    name: t.name,
    shortName: t.shortName,
    category: t.category,
    specimenType: t.specimenType,
    method: t.method,
    loincCode: t.loincCode,
    unit: t.unit,
    turnaroundHours: t.turnaroundHours,
    description: t.description,
    collectionNotes: t.collectionNotes,
    dataType: t.dataType,
    isDerived: t.isDerived,
    autoVerifyEligible: t.autoVerifyEligible,
    referenceRanges: t.referenceRanges,
    criticalThresholds: t.criticalThresholds,
    panels: t.panelTests.map((pt) => ({ code: pt.panel.code, name: pt.panel.name })),
  };
}

export default async function TestMasterPage() {
  const session = await auth();
  const canEdit = (session?.user as { role?: string })?.role === "ADMIN";
  const tests = await prisma.test.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    include: {
      referenceRanges: { orderBy: [{ gender: "asc" }, { ageMinDays: "asc" }] },
      criticalThresholds: true,
      panelTests: { include: { panel: true } },
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Test master"
        description="Each test has a laboratory profile: specimen, method, reference ranges, and panic values."
        actions={canEdit ? <AddTestDialog /> : null}
        hint={
          <InstructionAlert title="Test profiles">
            Open Profile on a row to see how the test is collected, which panels include it, and which ranges apply. Admins can edit the profile without changing historical results.
          </InstructionAlert>
        }
      />

      <Card>
        <CardContent className="p-0">
          {tests.length === 0 ? (
            <EmptyState
              icon={<FlaskConical className="size-5" />}
              title="No tests in the catalog"
              description="Add the first orderable test to start building panels and accessions."
              action={canEdit ? <AddTestDialog /> : null}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Specimen</TableHead>
                  <TableHead>Panels</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.map((t) => {
                  const profile = toProfile(t);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="tabular text-xs">{t.code}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {t.name} {t.isDerived ? <span className="text-xs text-muted-foreground">(calc.)</span> : null}
                          </span>
                          <span className="text-xs text-muted-foreground">{t.category.replaceAll("_", " ")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{t.specimenType}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {profile.panels.length > 0 ? profile.panels.map((p) => p.code).join(", ") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.active ? "success" : "outline"}>{t.active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <TestProfileDialog test={profile} canEdit={canEdit} />
                          {canEdit ? <ToggleTestButton testId={t.id} active={t.active} name={t.name} /> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
