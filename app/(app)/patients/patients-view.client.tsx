"use client";

import { useState } from "react";
import Link from "next/link";
import { FlaskConical, History, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { CacheMiss, useDataSync } from "@/components/data-sync";
import { PatientRegisterDialog } from "./patient-register-dialog";
import PatientsLoading from "./loading";

export function PatientsView() {
  const { snapshot } = useDataSync();
  const [query, setQuery] = useState("");
  if (!snapshot) return <CacheMiss loading={<PatientsLoading />} />;

  const patients = snapshot.patients;
  const needle = query.trim().toLowerCase();
  const filtered = !needle
    ? patients
    : patients.filter((patient) =>
        `${patient.mrn} ${patient.firstName} ${patient.lastName ?? ""} ${patient.phone ?? ""}`
          .toLowerCase()
          .includes(needle)
      );

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 p-6">
      <PageHeader
        title="Patients"
        description="Master patient registry. Register a new patient, then create an accession from their row."
        actions={<PatientRegisterDialog />}
      />

      {patients.length > 0 ? (
        <div className="relative w-full lg:w-1/2 lg:max-w-md">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="w-full pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, MRN, or phone"
            aria-label="Search patients"
          />
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {patients.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No patients yet"
              description="Register the first patient to start ordering tests."
              action={<PatientRegisterDialog />}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="No matching patients"
              description="Clear the search or register a new patient."
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
                {filtered.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="tabular text-xs">{patient.mrn}</TableCell>
                    <TableCell className="font-medium">
                      {patient.firstName} {patient.lastName}
                    </TableCell>
                    <TableCell>{patient.gender}</TableCell>
                    <TableCell className="tabular">{patient.ageYears ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/orders/new?patientId=${patient.id}` as never}>
                            <FlaskConical />
                            New order
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/patients/${patient.id}` as never}>
                            <History />
                            History
                          </Link>
                        </Button>
                      </div>
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
