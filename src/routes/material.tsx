import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMaterials } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eur, fmtDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/material")({
  head: () => ({ meta: [{ title: "Material · fisioemocions" }] }),
  component: MaterialsPage,
});

function MaterialsPage() {
  const { data: materials = [] } = useMaterials();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    purchase_date: todayISO(),
    description: "",
    quantity: "1",
    unit_cost: "",
    supplier: "",
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.description || !form.unit_cost) throw new Error("Descripció i cost requerits");
      const { error } = await supabase.from("materials").insert({
        purchase_date: form.purchase_date,
        description: form.description,
        quantity: Number(form.quantity),
        unit_cost: Number(form.unit_cost),
        supplier: form.supplier || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material registrat");
      qc.invalidateQueries({ queryKey: ["materials"] });
      setForm({ ...form, description: "", quantity: "1", unit_cost: "", supplier: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eliminat");
      qc.invalidateQueries({ queryKey: ["materials"] });
    },
  });

  const total = materials.reduce((s, m) => s + Number(m.quantity) * Number(m.unit_cost), 0);

  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Material consumible" subtitle="Compres de material i consumibles per al centre." />

      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <Field className="md:col-span-2" label="Data">
              <Input type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
            </Field>
            <Field className="md:col-span-4" label="Descripció *">
              <Input placeholder="Ex: Crema massatge 500ml" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field className="md:col-span-1" label="Qtat">
              <Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Cost unit. (€) *">
              <Input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Proveïdor">
              <Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </Field>
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="md:col-span-1 h-10">
              <Plus className="h-4 w-4 mr-1" /> Afegir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg">Compres</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{materials.length} entrades · {eur(total)} en material</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Descripció</th>
                  <th className="px-6 py-3 font-medium">Proveïdor</th>
                  <th className="px-6 py-3 font-medium text-right">Qtat</th>
                  <th className="px-6 py-3 font-medium text-right">Cost unit.</th>
                  <th className="px-6 py-3 font-medium text-right">Total</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {materials.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">Cap entrada de material.</td></tr>
                )}
                {materials.map((m) => (
                  <tr key={m.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-3 text-muted-foreground">{fmtDate(m.purchase_date)}</td>
                    <td className="px-6 py-3 font-medium">{m.description}</td>
                    <td className="px-6 py-3 text-muted-foreground">{m.supplier ?? ""}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{Number(m.quantity)}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{eur(Number(m.unit_cost))}</td>
                    <td className="px-6 py-3 text-right tabular-nums font-medium">{eur(Number(m.quantity) * Number(m.unit_cost))}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => del.mutate(m.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
