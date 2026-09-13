"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { createPanel, deletePanel, updatePanel } from "@/app/actions/packages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatInr } from "@/lib/money";
import { Package } from "lucide-react";

type PanelRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
  testIds: string[];
  tests: Array<{ id: string; code: string; name: string }>;
};

type CatalogTest = { id: string; code: string; name: string; category: string };

const CATEGORIES = [
  "HEMATOLOGY",
  "CLINICAL_CHEMISTRY",
  "MICROBIOLOGY",
  "SEROLOGY_IMMUNOLOGY",
  "COAGULATION",
  "URINALYSIS",
  "HISTOPATHOLOGY",
  "CYTOLOGY",
  "MOLECULAR",
  "ENDOCRINE",
  "OTHER",
];

function PanelForm({
  tests,
  initial,
  onClose,
}: {
  tests: CatalogTest[];
  initial?: PanelRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.testIds ?? []));

  const visible = tests.filter((test) =>
    `${test.code} ${test.name} ${test.category}`.toLowerCase().includes(query.trim().toLowerCase())
  );

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function submit(formData: FormData) {
    const payload = {
      code: String(formData.get("code") ?? ""),
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? "OTHER"),
      price: Number(formData.get("price") ?? 0),
      testIds: Array.from(selected),
    };
    startTransition(async () => {
      const result = initial
        ? await updatePanel({
            panelId: initial.id,
            name: payload.name,
            category: payload.category,
            price: payload.price,
            testIds: payload.testIds,
            active: formData.get("active") === "on",
          })
        : await createPanel(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(initial ? "Package saved." : "Package created.");
      onClose();
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pkg-code">Code</Label>
          <Input id="pkg-code" name="code" required defaultValue={initial?.code ?? ""} disabled={Boolean(initial)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pkg-price">Charge (₹)</Label>
          <Input id="pkg-price" name="price" numeric="decimal" defaultValue={initial?.price ?? 0} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pkg-name">Name</Label>
        <Input id="pkg-name" name="name" required defaultValue={initial?.name ?? ""} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pkg-category">Category</Label>
        <NativeSelect id="pkg-category" name="category" defaultValue={initial?.category ?? "CLINICAL_CHEMISTRY"}>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
      </div>
      {initial ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="size-4" />
          Active
        </label>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label>Tests in this package ({selected.size})</Label>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tests" />
        <div className="max-h-56 overflow-y-auto rounded-md border border-border p-2">
          {visible.map((test) => (
            <label key={test.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-secondary/60">
              <input type="checkbox" className="size-4" checked={selected.has(test.id)} onChange={() => toggle(test.id)} />
              <span>{test.name}</span>
              <span className="text-xs text-muted-foreground">{test.code}</span>
            </label>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial ? "Save package" : "Create package"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PackagesAdmin({ panels, tests }: { panels: PanelRow[]; tests: CatalogTest[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const filtered = useMemo(
    () =>
      panels.filter((panel) =>
        `${panel.code} ${panel.name} ${panel.category}`.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [panels, query]
  );
  const editing = panels.find((panel) => panel.id === editId);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search packages" />
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus />
              Add package
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New package</DialogTitle>
              <DialogDescription>Set a package rate and choose the member tests that print on the report.</DialogDescription>
            </DialogHeader>
            <PanelForm tests={tests} onClose={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {panels.length === 0 ? (
            <EmptyState
              icon={<Package className="size-5" />}
              title="No packages yet"
              description="Create CBC, LFT, or any billed panel with a package price."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Add package
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Charge</TableHead>
                  <TableHead>Tests</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((panel) => (
                  <TableRow key={panel.id}>
                    <TableCell className="tabular text-xs">{panel.code}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{panel.name}</span>
                        <span className="text-xs text-muted-foreground">{panel.category.replaceAll("_", " ")}</span>
                      </div>
                    </TableCell>
                    <TableCell className="tabular text-xs">{formatInr(panel.price)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {panel.tests.length === 0 ? "—" : panel.tests.map((test) => test.code).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={panel.active ? "success" : "outline"}>{panel.active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" type="button" onClick={() => setEditId(panel.id)}>
                          Edit
                        </Button>
                        <ConfirmDialog
                          title={`Remove ${panel.name}?`}
                          description="Unused packages are deleted. Packages already billed on an order are deactivated."
                          confirmLabel="Remove"
                          variant="destructive"
                          successMessage="Package removed or deactivated."
                          trigger={
                            <Button size="sm" variant="ghost" type="button">
                              Delete
                            </Button>
                          }
                          onConfirm={async () => {
                            const result = await deletePanel(panel.id);
                            if (!result.ok) return result;
                            router.refresh();
                            return { ok: true as const };
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit package</DialogTitle>
            <DialogDescription>Change the billed rate or member tests. Code stays the same.</DialogDescription>
          </DialogHeader>
          {editing ? <PanelForm key={editing.id} tests={tests} initial={editing} onClose={() => setEditId(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
