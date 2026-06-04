import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useExpenses, EXPENSE_CATEGORIES } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur, fmtDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/gastos")({
  head: () => ({ meta: [{ title: "Despeses · fisioemocions" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { data: expenses = [] } = useExpenses();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    expense_date: todayISO(),
    category: "Alquiler",
    description: "",
    amount: "",
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.description || !form.amount) throw new Error("Descripció i import requerits");
      const { error } = await supabase.from("expenses").insert({
        expense_date: form.expense_date,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Despesa registrada");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setForm({ ...form, description: "", amount: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eliminat");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Despeses" subtitle="Lloguer, impostos, útils, inversions i altres despeses operatives." />

      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <Field className="md:col-span-2" label="Data">
              <Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Categoria">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-5" label="Descripció *">
              <Input placeholder="Ex: Lloguer Gener" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Import (€) *">
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
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
            <h2 className="font-display text-lg">Despeses registrades</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{expenses.length} entrades · {eur(total)} totals</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Categoria</th>
                  <th className="px-6 py-3 font-medium">Descripció</th>
                  <th className="px-6 py-3 font-medium text-right">Import</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Cap despesa registrada.</td></tr>
                )}
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-3 text-muted-foreground">{fmtDate(e.expense_date)}</td>
                    <td className="px-6 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">{e.category}</span>
                    </td>
                    <td className="px-6 py-3 font-medium">{e.description}</td>
                    <td className="px-6 py-3 text-right tabular-nums font-medium">{eur(Number(e.amount))}</td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => del.mutate(e.id)} className="text-muted-foreground hover:text-destructive">
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
