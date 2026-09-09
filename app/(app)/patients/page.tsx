import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { InstructionAlert } from "@/components/instruction-alert";
import { PatientRegisterDialog } from "./patient-register-dialog";
import Link from "next/link";
import { FlaskConical, Users } from "lucide-react";

export default async function PatientsPage() {
  const patients = await prisma.patient.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <PageHeader
        title="Patients"
        description="Master patient registry. Register a new patient, then create an accession from their row."
        actions={<PatientRegisterDialog />}
        hint={
          <InstructionAlert title="How registration works">
            Enter MRN and demographics first. Age or date of birth is used later for reference ranges. After you save, Aliquot opens New Order with this patient already selected.
          </InstructionAlert>
        }
      />

      <Card>
        <CardContent className="p-0">
          {patients.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No patients yet"
              description="Register the first patient to start ordering tests."
              action={<PatientRegisterDialog />}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular text-xs">{p.mrn}</TableCell>
                    <TableCell className="font-medium">
                      {p.firstName} {p.lastName}
                    </TableCell>
                    <TableCell>{p.gender}</TableCell>
                    <TableCell className="tabular">{p.ageYears ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/orders/new?patientId=${p.id}` as never}>
                          <FlaskConical />
                          New order
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
