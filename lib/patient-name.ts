export const PATIENT_TITLES = [
  { value: "Mr", gender: "MALE" as const },
  { value: "Mrs", gender: "FEMALE" as const },
  { value: "Miss", gender: "FEMALE" as const },
] as const;

export type PatientTitle = (typeof PATIENT_TITLES)[number]["value"];

export function genderFromTitle(title: string | null | undefined): "MALE" | "FEMALE" | null {
  const match = PATIENT_TITLES.find((row) => row.value.toLowerCase() === String(title ?? "").trim().toLowerCase());
  return match?.gender ?? null;
}

export function titledGivenName(title: string, firstName: string): string {
  const given = firstName.trim();
  if (title === "Miss") return `Miss ${given}`.trim();
  return `${title}. ${given}`.replace(/\s+/g, " ").trim();
}

export function patientDisplayName(patient: { title?: string | null; firstName: string; lastName?: string | null }) {
  return [patient.title, patient.firstName, patient.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
