export const PATIENT_TITLES = [
  { value: "Mr", gender: "MALE" as const },
  { value: "Mrs", gender: "FEMALE" as const },
  { value: "Miss", gender: "FEMALE" as const },
  { value: "Master", gender: "MALE" as const },
  { value: "Baby", gender: "MALE" as const },
  { value: "Baby Of", gender: "OTHER" as const },
  { value: "Smt", gender: "FEMALE" as const },
  { value: "Chi", gender: "MALE" as const },
  { value: "Kumar", gender: "MALE" as const },
  { value: "Kumari", gender: "FEMALE" as const },
  { value: "Sau", gender: "FEMALE" as const },
  { value: "M/S", gender: "OTHER" as const },
  { value: "Shri", gender: "MALE" as const },
  { value: "Shrimaan", gender: "MALE" as const },
  { value: "Shrimati", gender: "FEMALE" as const },
  { value: "Ms", gender: "FEMALE" as const },
  { value: "MOHAMMED", gender: "MALE" as const },
  { value: "Animal Owner", gender: "OTHER" as const },
  { value: "Dr", gender: "MALE" as const },
] as const;

export type PatientTitle = (typeof PATIENT_TITLES)[number]["value"];

export function genderFromTitle(title: string | null | undefined): "MALE" | "FEMALE" | "OTHER" | null {
  const match = PATIENT_TITLES.find((row) => row.value.toLowerCase() === String(title ?? "").trim().toLowerCase());
  return match?.gender ?? null;
}

export function titledGivenName(title: string | null | undefined, firstName: string): string {
  const given = firstName.trim();
  const cleanTitle = (title ?? "").trim();
  if (!cleanTitle) return given;
  if (given.toLowerCase().startsWith(cleanTitle.toLowerCase())) return given;
  const noDotTitles = ["Miss", "Master", "Baby", "Baby Of", "M/S", "MOHAMMED", "Animal Owner"];
  const needDot = !noDotTitles.some((t) => t.toLowerCase() === cleanTitle.toLowerCase()) && !cleanTitle.endsWith(".");
  return needDot ? `${cleanTitle}. ${given}`.replace(/\s+/g, " ").trim() : `${cleanTitle} ${given}`.replace(/\s+/g, " ").trim();
}

export function patientDisplayName(patient: { title?: string | null; firstName: string; lastName?: string | null }) {
  return [patient.title, patient.firstName, patient.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function extractTitleFromName(name: string): PatientTitle | "" {
  const trimmed = name.trim();
  const sortedTitles = [...PATIENT_TITLES].sort((a, b) => b.value.length - a.value.length);
  for (const t of sortedTitles) {
    const escaped = t.value.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    const regex = new RegExp(`^${escaped}(\\.|\\s+|\\.\\s+)`, "i");
    if (regex.test(trimmed)) return t.value;
  }
  return "";
}

export function stripTitlePrefix(name: string): string {
  const trimmed = name.trim();
  const sortedTitles = [...PATIENT_TITLES].sort((a, b) => b.value.length - a.value.length);
  for (const t of sortedTitles) {
    const escaped = t.value.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
    const regex = new RegExp(`^${escaped}(\\.|\\s+|\\.\\s+)`, "i");
    if (regex.test(trimmed)) {
      return trimmed.replace(regex, "").trim();
    }
  }
  return trimmed;
}
