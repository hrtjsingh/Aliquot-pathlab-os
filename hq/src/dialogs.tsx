import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { hqApi, type LabDetail, type Plan } from "./api.ts";
import { formatDate, formatPlanPrice, leaseColor, leaseLabel, leaseTone } from "./format.ts";
import { formatPlanTerm } from "../../lib/billing-plans.ts";

export function Modal({
  open,
  title,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`hq-modal ${wide ? "wide" : ""}`}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[#1c3f52]/12 px-5 py-4">
        <h2 className="text-2xl leading-none">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="border border-[#1c3f52]/20 px-2.5 py-1 text-sm"
        >
          Close
        </button>
      </div>
      <div className="max-h-[calc(100dvh-7rem)] overflow-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

export function Field({
  name,
  label,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-sm border border-[#d7dddf] bg-[#f4f6f7] px-3 py-2"
      />
    </label>
  );
}

export function CreateLabDialog({
  open,
  plans,
  onClose,
  onCreated,
}: {
  open: boolean;
  plans: Plan[];
  onClose: () => void;
  onCreated: (id: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const lab = await hqApi.createLab({
        name: String(form.get("name")),
        slug: String(form.get("slug")),
        adminName: String(form.get("adminName")),
        adminEmail: String(form.get("adminEmail")),
        adminPassword: String(form.get("adminPassword")),
        planCode: String(form.get("planCode") || "TRIAL"),
      });
      event.currentTarget.reset();
      await onCreated(lab.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lab.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open={open} title="New lab" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field name="name" label="Lab name" required />
        <Field name="slug" label="Lab ID (login slug)" required placeholder="city-lab" />
        <Field name="adminName" label="Login name" required />
        <Field name="adminEmail" label="Login email" type="email" required />
        <Field name="adminPassword" label="Login password" type="password" required />
        <label className="text-sm font-medium sm:col-span-2">
          Plan
          <select
            name="planCode"
            defaultValue="TRIAL"
            className="mt-1 w-full rounded-sm border border-[#d7dddf] bg-[#f4f6f7] px-3 py-2"
          >
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.intervalDays > 0
                  ? `${plan.name} · ${formatPlanTerm(plan)} · ${formatPlanPrice(plan.priceInr)}`
                  : `${plan.name} · ${formatPlanPrice(plan.priceInr)}`}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="sm:col-span-2 text-sm text-[#b3261e]">{error}</p> : null}
        <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="border border-[#1c3f52]/20 px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            disabled={pending}
            className="bg-[#1c3f52] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create lab and sign lease"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function LabActionDialog({
  labId,
  plans,
  onClose,
  onChanged,
}: {
  labId: string | null;
  plans: Plan[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<LabDetail | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState(false);

  useEffect(() => {
    if (!labId) {
      setDetail(null);
      setConfirmPlan(null);
      setConfirmSuspend(false);
      return;
    }
    setError("");
    hqApi
      .lab(labId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load lab."));
  }, [labId]);

  async function refresh() {
    if (!labId) return;
    setDetail(await hqApi.lab(labId));
    await onChanged();
  }

  async function applyPlan(plan: Plan) {
    if (!detail) return;
    setPending(plan.code);
    setError("");
    try {
      await hqApi.patchSubscription(detail.id, {
        planCode: plan.code,
        applyTerm: true,
        note: `${plan.name} · ${formatPlanTerm(plan)} · ${formatPlanPrice(plan.priceInr)}`,
      });
      setConfirmPlan(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update subscription.");
    } finally {
      setPending(null);
    }
  }

  async function toggleSuspend() {
    if (!detail?.subscription) return;
    setPending("status");
    setError("");
    try {
      await hqApi.patchSubscription(detail.id, {
        status: detail.subscription.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
        note: "Manual status change",
      });
      setConfirmSuspend(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update subscription.");
    } finally {
      setPending(null);
    }
  }

  const sub = detail?.subscription ?? null;
  const tone = detail ? leaseTone(detail) : "missing";
  const color = leaseColor(tone);

  return (
    <Modal open={Boolean(labId)} title={detail?.name ?? "Lab"} onClose={onClose} wide>
      {error ? <p className="mb-3 text-sm text-[#b3261e]">{error}</p> : null}
      {!detail ? (
        <p className="text-sm text-[#3d4f59]">Loading lab…</p>
      ) : (
        <div className="space-y-6">
          <section>
            <p className="mono text-xs text-[#3d4f59]">{detail.slug}</p>
            <p className="mt-2 text-sm" style={{ color }}>
              {leaseLabel(detail)}
              {sub ? ` · ${sub.plan.name} · ${formatPlanPrice(sub.plan.priceInr)}` : ""}
            </p>
            <p className="mt-1 text-sm text-[#3d4f59]">
              {detail.users.length === 1 ? "1 login" : `${detail.users.length} logins`} · {detail.patients}{" "}
              patients · {detail.orders} orders
            </p>
          </section>

          {sub ? (
            <section>
              <h3 className="text-sm font-semibold">Apply a term</h3>
              <p className="mt-1 text-sm text-[#3d4f59]">
                Switching plans starts a new term today. Applying the same plan adds another term onto the
                current expiry.
              </p>
              {confirmPlan ? (
                <div className="mt-3 border border-[#0f766e]/30 bg-[#0f766e]/6 p-3">
                  <p className="text-sm">
                    Sign <span className="font-semibold">{confirmPlan.name}</span> for{" "}
                    {formatPlanPrice(confirmPlan.priceInr)}?
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => applyPlan(confirmPlan)}
                      className="bg-[#0f766e] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {pending === confirmPlan.code ? "Signing…" : "Sign lease"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmPlan(null)}
                      className="border border-[#1c3f52]/20 px-3 py-1.5 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {plans.map((plan) => (
                    <button
                      key={plan.code}
                      type="button"
                      disabled={Boolean(pending)}
                      onClick={() => {
                        setConfirmSuspend(false);
                        setConfirmPlan(plan);
                      }}
                      className={`border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                        sub.plan.code === plan.code
                          ? "border-[#0f766e] bg-[#0f766e] text-white"
                          : "border-[#0f766e] text-[#0f766e]"
                      }`}
                    >
                      {plan.name} · {formatPlanPrice(plan.priceInr)}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4">
                {confirmSuspend ? (
                  <div className="border border-[#b3261e]/30 bg-[#b3261e]/6 p-3">
                    <p className="text-sm">
                      {sub.status === "SUSPENDED"
                        ? "Reactivate this lab so it can sign in again?"
                        : "Suspend this lab? It will not be able to sign in until you reactivate it."}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={Boolean(pending)}
                        onClick={toggleSuspend}
                        className="bg-[#b3261e] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {pending === "status"
                          ? "Updating…"
                          : sub.status === "SUSPENDED"
                            ? "Reactivate"
                            : "Suspend lab"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmSuspend(false)}
                        className="border border-[#1c3f52]/20 px-3 py-1.5 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => {
                      setConfirmPlan(null);
                      setConfirmSuspend(true);
                    }}
                    className="border border-[#b3261e]/40 px-2.5 py-1.5 text-xs font-semibold text-[#b3261e]"
                  >
                    {sub.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                  </button>
                )}
              </div>
            </section>
          ) : (
            <p className="text-sm text-[#b3261e]">No master subscription.</p>
          )}

          <LoginForm lab={detail} onChanged={refresh} />

          <section>
            <h3 className="text-sm font-semibold">Billing ledger</h3>
            <ol className="mt-2 max-h-48 space-y-2 overflow-auto border-t border-[#1c3f52]/10 pt-3">
              {detail.billing.map((event) => (
                <li key={event.id} className="text-xs leading-5">
                  <span className="mono text-[#0f766e]">{event.kind}</span> · {event.note || "Updated"}
                  <div className="text-[#3d4f59]">
                    {formatDate(event.createdAt)}
                    {event.amountInr ? ` · ${formatPlanPrice(event.amountInr)}` : ""}
                    {event.actorEmail ? ` · ${event.actorEmail}` : ""}
                  </div>
                </li>
              ))}
              {!detail.billing.length ? <li className="text-xs text-[#3d4f59]">No billing events yet.</li> : null}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  );
}

function LoginForm({ lab, onChanged }: { lab: LabDetail; onChanged: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const login = lab.users.find((user) => user.active) ?? lab.users[0] ?? null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setSaved(false);
    const password = String(form.get("password") || "");
    try {
      const body = {
        name: String(form.get("name")),
        email: String(form.get("email")),
        ...(password ? { password } : {}),
      };
      if (login) await hqApi.updateUser(lab.id, body);
      else await hqApi.createUser(lab.id, { ...body, password: password || "" });
      await onChanged();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save login.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold">Lab login</h3>
      <p className="mt-1 text-sm text-[#3d4f59]">One account per lab. That person signs in with the lab ID.</p>
      <form key={login?.id ?? "new"} onSubmit={submit} className="mt-3 grid gap-2">
        <Field name="name" label="Name" required defaultValue={login?.name} />
        <Field name="email" label="Email" type="email" required defaultValue={login?.email} />
        <Field
          name="password"
          label={login ? "New password (leave blank to keep)" : "Password"}
          type="password"
          required={!login}
        />
        {error ? <p className="text-sm text-[#b3261e]">{error}</p> : null}
        {saved ? <p className="text-sm text-[#0f766e]">Login saved.</p> : null}
        <button
          disabled={pending}
          className="justify-self-start bg-[#1c3f52] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : login ? "Update login" : "Create login"}
        </button>
      </form>
    </section>
  );
}
