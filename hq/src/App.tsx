import { FormEvent, useEffect, useMemo, useState } from "react";
import { hqApi, type LabSummary, type Overview, type Plan } from "./api.ts";
import { CreateLabDialog, LabActionDialog } from "./dialogs.tsx";
import { formatDate, formatPlanPrice, leaseColor, leaseLabel, leaseTone } from "./format.ts";

export function App() {
  const [me, setMe] = useState<{ name: string; email: string } | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hqApi
      .me()
      .then((user) => setMe(user))
      .catch(() => setMe(null))
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-sm text-[#3d4f59]">Opening the HQ ledger…</div>;
  }
  if (!me) return <Login onSignedIn={setMe} />;
  return <Console me={me} onSignOut={() => setMe(null)} />;
}

function Login({ onSignedIn }: { onSignedIn: (user: { name: string; email: string }) => void }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const user = await hqApi.login(String(form.get("email")), String(form.get("password")));
      onSignedIn(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-dvh max-w-5xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="mono text-xs tracking-[0.22em] text-[#0f766e] uppercase">Aliquot · vendor control</p>
        <h1 className="mt-3 max-w-xl text-5xl leading-tight text-[#1c3f52]">The lab network ledger</h1>
        <p className="mt-4 max-w-md text-[17px] leading-7 text-[#3d4f59]">
          Create labs, issue users, and extend subscriptions against the online master. A lab PC cannot lengthen its
          lease by editing its local database.
        </p>
      </div>
      <form onSubmit={submit} className="rounded-sm border border-[#1c3f52]/15 bg-white p-6 shadow-[6px_6px_0_#1c3f52]">
        <p className="display text-2xl text-[#1c3f52]">Super admin</p>
        <label className="mt-5 block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue="hq@aliquot.test"
            className="mt-1 w-full rounded-sm border border-[#d7dddf] bg-[#f4f6f7] px-3 py-2"
          />
        </label>
        <label className="mt-3 block text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            required
            defaultValue="Password123!"
            className="mt-1 w-full rounded-sm border border-[#d7dddf] bg-[#f4f6f7] px-3 py-2"
          />
        </label>
        {error ? <p className="mt-3 text-sm text-[#b3261e]">{error}</p> : null}
        <button
          disabled={pending}
          className="mt-5 w-full bg-[#1c3f52] px-4 py-2.5 text-sm font-semibold text-[#f4f6f7] disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Open the ledger"}
        </button>
      </form>
    </div>
  );
}

type Filter = "all" | "trial" | "paid" | "attention";

function Console({ me, onSignOut }: { me: { name: string; email: string }; onSignOut: () => void }) {
  const [labs, setLabs] = useState<LabSummary[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [openLabId, setOpenLabId] = useState<string | null>(null);

  async function reload() {
    const [nextLabs, nextPlans, nextOverview] = await Promise.all([
      hqApi.labs(),
      hqApi.plans(),
      hqApi.overview(),
    ]);
    setLabs(nextLabs);
    setPlans(nextPlans);
    setOverview(nextOverview);
    return nextLabs;
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : "Could not load the dashboard."));
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return labs.filter((lab) => {
      const tone = leaseTone(lab);
      if (filter === "trial" && tone !== "trial") return false;
      if (filter === "paid" && tone !== "active" && tone !== "expiring") return false;
      if (filter === "attention" && (tone === "active" || tone === "trial")) return false;
      if (!needle) return true;
      return (
        lab.name.toLowerCase().includes(needle) ||
        lab.slug.toLowerCase().includes(needle) ||
        (lab.subscription?.plan.name.toLowerCase().includes(needle) ?? false)
      );
    });
  }, [labs, query, filter]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[#1c3f52]/15 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="mono text-[11px] tracking-[0.24em] text-[#0f766e] uppercase">Signed lease master</p>
            <h1 className="display text-3xl text-[#1c3f52]">Aliquot HQ</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="font-medium">{me.name}</p>
              <p className="mono text-xs text-[#3d4f59]">{me.email}</p>
            </div>
            <button
              className="border border-[#1c3f52]/20 px-3 py-1.5"
              onClick={async () => {
                await hqApi.logout();
                onSignOut();
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {error ? <p className="text-sm text-[#b3261e]">{error}</p> : null}
        <Analytics overview={overview} labs={labs} onOpenLab={setOpenLabId} />

        <section className="border border-[#1c3f52]/15 bg-white">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1c3f52]/10 px-4 py-3">
            <div>
              <h2 className="text-2xl">Labs</h2>
              <p className="text-sm text-[#3d4f59]">
                {visible.length} of {labs.length} shown
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name or lab ID"
                className="w-52 rounded-sm border border-[#d7dddf] bg-[#f4f6f7] px-3 py-2 text-sm"
              />
              <button
                className="bg-[#0f766e] px-3 py-2 text-sm font-semibold text-white"
                onClick={() => setCreating(true)}
              >
                New lab
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 px-4 py-3">
            {(
              [
                ["all", "All"],
                ["trial", "Trial"],
                ["paid", "Paid"],
                ["attention", "Needs action"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`px-2.5 py-1 text-xs font-semibold ${
                  filter === id ? "bg-[#1c3f52] text-white" : "border border-[#1c3f52]/20 text-[#1c3f52]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-y border-[#1c3f52]/10 bg-[#f4f6f7] text-xs uppercase tracking-wide text-[#3d4f59]">
                <tr>
                  <th className="px-4 py-2 font-medium">Lab</th>
                  <th className="px-4 py-2 font-medium">Lease</th>
                  <th className="px-4 py-2 font-medium">Plan</th>
                  <th className="px-4 py-2 font-medium">Volume</th>
                  <th className="px-4 py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lab) => {
                  const tone = leaseTone(lab);
                  const color = leaseColor(tone);
                  return (
                    <tr key={lab.id} className="border-b border-[#1c3f52]/8 last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{lab.name}</p>
                        <p className="mono text-xs text-[#3d4f59]">{lab.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color }}>
                          {leaseLabel(lab)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {lab.subscription ? (
                          <>
                            <p>{lab.subscription.plan.name}</p>
                            <p className="text-xs text-[#3d4f59]">{formatPlanPrice(lab.subscription.plan.priceInr)}</p>
                          </>
                        ) : (
                          <p className="text-[#b3261e]">None</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#3d4f59]">
                        {lab.patients} patients
                        <span className="block">{lab.orders} orders</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setOpenLabId(lab.id)}
                          className="border border-[#0f766e] px-2.5 py-1.5 text-xs font-semibold text-[#0f766e]"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!visible.length ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-sm text-[#3d4f59]">
                      {labs.length
                        ? "No labs match that filter. Clear search or switch to All."
                        : "No labs on the master table yet. Create the first lab to start the ledger."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <CreateLabDialog
        open={creating}
        plans={plans}
        onClose={() => setCreating(false)}
        onCreated={async (id) => {
          setCreating(false);
          await reload();
          setOpenLabId(id);
        }}
      />
      <LabActionDialog
        labId={openLabId}
        plans={plans}
        onClose={() => setOpenLabId(null)}
        onChanged={reload}
      />
    </div>
  );
}

function Analytics({
  overview,
  labs,
  onOpenLab,
}: {
  overview: Overview | null;
  labs: LabSummary[];
  onOpenLab: (id: string) => void;
}) {
  if (!overview) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 border border-[#1c3f52]/10 bg-white/70" />
        ))}
      </div>
    );
  }

  const kpis = [
    { label: "Labs", value: String(overview.labs), hint: `${overview.lease.active} paid active` },
    { label: "On trial", value: String(overview.lease.trial), hint: "10-day terms" },
    { label: "Needs action", value: String(overview.lease.expiring + overview.lease.expired + overview.lease.suspended + overview.lease.missing), hint: "Expiring, expired, or stopped" },
    { label: "Billed", value: formatRupees(overview.billedInr), hint: `${formatRupees(overview.billed30dInr)} last 30 days` },
    { label: "Network volume", value: String(overview.orders), hint: `${overview.patients} patients` },
  ];
  const maxOrders = Math.max(1, ...overview.orders14d.map((day) => day.count));
  const planTotal = overview.plans.reduce((sum, plan) => sum + plan.count, 0) || labs.length || 1;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="border border-[#1c3f52]/15 bg-white px-4 py-3">
            <p className="mono text-[10px] tracking-[0.18em] text-[#0f766e] uppercase">{kpi.label}</p>
            <p className="display mt-1 text-3xl leading-none">{kpi.value}</p>
            <p className="mt-2 text-xs text-[#3d4f59]">{kpi.hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="border border-[#1c3f52]/15 bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl">Orders · 14 days</h2>
            <p className="mono text-xs text-[#3d4f59]">
              {overview.orders14d.reduce((sum, day) => sum + day.count, 0)} accessions
            </p>
          </div>
          <div className="mt-4 flex h-28 items-end gap-1">
            {overview.orders14d.map((day) => (
              <div key={day.date} className="flex h-full flex-1 flex-col justify-end">
                <div
                  className="w-full bg-[#0f766e]"
                  style={{ height: `${Math.max(day.count ? 12 : 3, (day.count / maxOrders) * 100)}%` }}
                  title={`${day.date}: ${day.count}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-[#3d4f59]">
            <span>{formatShort(overview.orders14d[0]?.date)}</span>
            <span>{formatShort(overview.orders14d.at(-1)?.date)}</span>
          </div>
        </article>

        <article className="border border-[#1c3f52]/15 bg-white p-4">
          <h2 className="text-xl">Plan mix</h2>
          <div className="mt-4 flex h-4 overflow-hidden border border-[#1c3f52]/10">
            {overview.plans.length ? (
              overview.plans.map((plan) => (
                <div
                  key={plan.code}
                  style={{
                    width: `${(plan.count / planTotal) * 100}%`,
                    background: plan.code === "TRIAL" ? "#a15c00" : "#0f766e",
                    opacity: plan.code === "Y1" ? 1 : plan.code === "M6" ? 0.75 : 0.55,
                  }}
                  title={`${plan.name}: ${plan.count}`}
                />
              ))
            ) : (
              <div className="w-full bg-[#d7dddf]" />
            )}
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {overview.plans.map((plan) => (
              <li key={plan.code} className="flex justify-between gap-3">
                <span>
                  {plan.name} · {formatPlanPrice(plan.priceInr)}
                </span>
                <span className="mono text-[#3d4f59]">{plan.count}</span>
              </li>
            ))}
            {!overview.plans.length ? <li className="text-[#3d4f59]">No signed plans yet.</li> : null}
          </ul>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="border border-[#1c3f52]/15 bg-white p-4">
          <h2 className="text-xl">Needs action</h2>
          <ul className="mt-3 divide-y divide-[#1c3f52]/10">
            {overview.attention.map((lab) => {
              const color = leaseColor(leaseTone(lab));
              return (
                <li key={lab.id} className="first:pt-0">
                  <button
                    type="button"
                    onClick={() => onOpenLab(lab.id)}
                    className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-[#f4f6f7]"
                  >
                    <div>
                      <p className="font-medium">{lab.name}</p>
                      <p className="text-xs" style={{ color }}>
                        {leaseLabel(lab)}
                      </p>
                    </div>
                    <p className="mono text-xs text-[#3d4f59]">{lab.subscription?.plan.code ?? "—"}</p>
                  </button>
                </li>
              );
            })}
            {!overview.attention.length ? (
              <li className="py-6 text-sm text-[#3d4f59]">Every lab has a healthy signed lease.</li>
            ) : null}
          </ul>
        </article>

        <article className="border border-[#1c3f52]/15 bg-white p-4">
          <h2 className="text-xl">Recent billing</h2>
          <ol className="mt-3 space-y-2.5">
            {overview.billing.map((event) => (
              <li key={event.id} className="text-sm leading-5">
                <span className="font-medium">{event.labName}</span>
                <span className="text-[#3d4f59]">
                  {" "}
                  · {event.note || event.kind}
                  {event.amountInr ? ` · ${formatPlanPrice(event.amountInr)}` : ""}
                </span>
                <div className="mono text-[11px] text-[#3d4f59]">{formatDate(event.createdAt)}</div>
              </li>
            ))}
            {!overview.billing.length ? <li className="py-6 text-sm text-[#3d4f59]">No billing events yet.</li> : null}
          </ol>
        </article>
      </section>
    </>
  );
}

function formatRupees(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatShort(value?: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
