export type HqUser = { id: string; email: string; name: string };

export type Plan = {
  id: string;
  code: string;
  name: string;
  seats: number;
  intervalMonths: number;
  intervalDays: number;
  priceInr: number;
};

export type LabSummary = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  createdAt: string;
  users: number;
  patients: number;
  orders: number;
  subscription: {
    id: string;
    status: string;
    seats: number;
    startsAt: string;
    expiresAt: string;
    notes: string | null;
    plan: { code: string; name: string; priceInr: number };
  } | null;
};

export type LabDetail = LabSummary & {
  users: Array<{ id: string; name: string; email: string; role: string; active: boolean; createdAt: string }>;
  branches: Array<{ id: string; name: string; code: string }>;
  billing: Array<{
    id: string;
    kind: string;
    note: string | null;
    actorEmail: string | null;
    amountInr: number | null;
    createdAt: string;
  }>;
};

export type Overview = {
  labs: number;
  patients: number;
  orders: number;
  billedInr: number;
  billed30dInr: number;
  lease: {
    active: number;
    trial: number;
    expiring: number;
    expired: number;
    suspended: number;
    missing: number;
  };
  plans: Array<{ code: string; name: string; count: number; priceInr: number }>;
  attention: LabSummary[];
  orders14d: Array<{ date: string; count: number }>;
  billing: Array<{
    id: string;
    kind: string;
    note: string | null;
    amountInr: number | null;
    actorEmail: string | null;
    createdAt: string;
    labName: string;
    labSlug: string;
  }>;
};

export type HqEnvInfo = {
  target: "cloud" | "local";
  label: string;
  host: string;
  available: { cloud: boolean; local: boolean };
  prefill: { email: string; password: string; name: string };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(path, { credentials: "include", ...init, headers });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error || "Request failed.");
  return data as T;
}

export const hqApi = {
  env: () => api<HqEnvInfo>("/api/env"),
  setEnv: (target: "cloud" | "local") =>
    api<HqEnvInfo>("/api/env", { method: "POST", body: JSON.stringify({ target }) }),
  me: () => api<HqUser>("/api/me"),
  login: (email: string, password: string) =>
    api<HqUser>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => api<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  plans: () => api<Plan[]>("/api/plans"),
  overview: () => api<Overview>("/api/overview"),
  labs: () => api<LabSummary[]>("/api/labs"),
  lab: (id: string) => api<LabDetail>(`/api/labs/${id}`),
  createLab: (body: {
    name: string;
    slug: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
    planCode: string;
  }) => api<LabSummary>("/api/labs", { method: "POST", body: JSON.stringify(body) }),
  createUser: (labId: string, body: { name: string; email: string; password: string }) =>
    api(`/api/labs/${labId}/users`, { method: "POST", body: JSON.stringify(body) }),
  updateUser: (labId: string, body: { name: string; email: string; password?: string }) =>
    api(`/api/labs/${labId}/user`, { method: "PATCH", body: JSON.stringify(body) }),
  patchSubscription: (
    labId: string,
    body: { planCode?: string; seats?: number; applyTerm?: boolean; status?: string; note?: string }
  ) => api(`/api/labs/${labId}/subscription`, { method: "PATCH", body: JSON.stringify(body) }),
};
