import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInventoryCounts, useMaterials, type InventoryCount } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/inventario")({
  head: () => ({ meta: [{ title: "Inventario · fisioemocions" }] }),
  component: InventarioPage,
});

function currentPeriodISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function fmtPeriod(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
}

function InventarioPage() {
  const { data: counts = [] } = useInventoryCounts();
  const { data: materials = [] } = useMaterials();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    period_month: currentPeriodISO(),
    item_name: "",
    quantity: "",
    unit_cost: "",
    notes: "",
  });

  // Suggested item names from materials (unique)
  const suggestedItems = useMemo(() => {
    const set = new Set(materials.map((m) => m.description));
    return Array.from(set).sort();
  }, [materials]);

  // Suggest default unit cost from latest material purchase of same name
  function fillFromMaterial(name: string) {
    const m = materials.find((x) => x.description === name);
    setForm((f) => ({
      ...f,
      item_name: name,
      unit_cost: m ? String(m.unit_cost) : f.unit_cost,
    }));
  }

  const add = useMutation({
    mutationFn: async () => {
      if (!form.item_name || !form.quantity || !form.unit_cost)
        throw new Error("Artículo, cantidad y coste unitario son obligatorios");
      const { error } = await supabase.from("inventory_counts").insert({
        period_month: form.period_month,
        item_name: form.item_name,
        quantity: Number(form.quantity),
        unit_cost: Number(form.unit_cost),
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recuento añadido");
      qc.invalidateQueries({ queryKey: ["inventory_counts"] });
      setForm({ ...form, item_name: "", quantity: "", unit_cost: "", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_counts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["inventory_counts"] });
    },
  });

  // Group by period
  const periods = useMemo(() => {
    const map = new Map<string, InventoryCount[]>();
    counts.forEach((c) => {
      const key = c.period_month;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries())
      .map(([period, items]) => {
        const total = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost), 0);
        const units = items.reduce((s, i) => s + Number(i.quantity), 0);
        return { period, items, total, units };
      })
      .sort((a, b) => b.period.localeCompare(a.period));
  }, [counts]);

  const [selectedPeriod, setSelectedPeriod] = useState<string | "all">("all");
  const visiblePeriods = selectedPeriod === "all" ? periods : periods.filter((p) => p.period === selectedPeriod);

  // Chart data (chronological)
  const chartData = useMemo(
    () =>
      [...periods]
        .sort((a, b) => a.period.localeCompare(b.period))
        .map((p) => ({ period: fmtPeriod(p.period), valor: Number(p.total.toFixed(2)) })),
    [periods],
  );

  // Variation vs previous period for current view
  function variation(idx: number) {
    const sorted = [...periods].sort((a, b) => a.period.localeCompare(b.period));
    const i = sorted.findIndex((p) => p.period === periods[idx].period);
    if (i <= 0) return null;
    const prev = sorted[i - 1].total;
    const cur = sorted[i].total;
    const diff = cur - prev;
    const pct = prev === 0 ? null : diff / prev;
    return { diff, pct };
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Inventario de consumibles"
        subtitle="Recuentos físicos mensuales y valoración del stock final."
      />

      {/* Form */}
      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <Field className="md:col-span-2" label="Período (mes)">
              <Input
                type="month"
                value={form.period_month.slice(0, 7)}
                onChange={(e) => setForm({ ...form, period_month: `${e.target.value}-01` })}
              />
            </Field>
            <Field className="md:col-span-4" label="Artículo *">
              <Input
                list="material-suggestions"
                placeholder="Ej: Crema massatge 500ml"
                value={form.item_name}
                onChange={(e) => fillFromMaterial(e.target.value)}
              />
              <datalist id="material-suggestions">
                {suggestedItems.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field className="md:col-span-2" label="Cantidad *">
              <Input
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
            <Field className="md:col-span-2" label="Coste unit. (€) *">
              <Input
                type="number"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              />
            </Field>
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="md:col-span-2 h-10">
              <Plus className="h-4 w-4 mr-1" /> Añadir recuento
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Chart of valuation over time */}
      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg">Valoración del stock por período</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suma de cantidad × coste unitario para cada mes con recuentos.
              </p>
            </div>
          </div>
          {chartData.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aún no hay recuentos registrados.
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => eur(v)} width={90} />
                  <Tooltip
                    formatter={(v: number) => eur(v)}
                    contentStyle={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Period filter + summary cards */}
      <div className="flex items-center gap-3 mb-4">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Período</Label>
        <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as string)}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los períodos</SelectItem>
            {periods.map((p) => (
              <SelectItem key={p.period} value={p.period}>
                {fmtPeriod(p.period)} — {eur(p.total)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Per-period sections */}
      {visiblePeriods.length === 0 && (
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="py-12 text-center text-muted-foreground">
            No hay recuentos para mostrar.
          </CardContent>
        </Card>
      )}

      {visiblePeriods.map((p) => {
        const v = variation(periods.indexOf(p));
        const trend = v?.diff ?? 0;
        const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
        const trendClass = trend > 0 ? "text-emerald-600" : trend < 0 ? "text-destructive" : "text-muted-foreground";
        return (
          <Card key={p.period} className="mb-6 shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-display text-lg capitalize">{fmtPeriod(p.period)}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.items.length} artículos · {Number(p.units).toFixed(2)} unidades
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  {v && (
                    <div className={`flex items-center gap-1.5 text-sm ${trendClass}`}>
                      <TrendIcon className="h-4 w-4" />
                      <span className="tabular-nums">
                        {trend >= 0 ? "+" : ""}
                        {eur(trend)}
                      </span>
                      {v.pct !== null && (
                        <span className="text-xs">
                          ({trend >= 0 ? "+" : ""}
                          {(v.pct * 100).toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor stock</div>
                    <div className="font-display text-2xl tabular-nums">{eur(p.total)}</div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Artículo</th>
                      <th className="px-6 py-3 font-medium text-right">Cantidad</th>
                      <th className="px-6 py-3 font-medium text-right">Coste unit.</th>
                      <th className="px-6 py-3 font-medium text-right">Valor</th>
                      <th className="px-6 py-3 font-medium text-right">% del total</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.items.map((it) => {
                      const val = Number(it.quantity) * Number(it.unit_cost);
                      const share = p.total > 0 ? val / p.total : 0;
                      return (
                        <tr key={it.id} className="border-t border-border hover:bg-muted/30">
                          <td className="px-6 py-3 font-medium">{it.item_name}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{Number(it.quantity)}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{eur(Number(it.unit_cost))}</td>
                          <td className="px-6 py-3 text-right tabular-nums font-medium">{eur(val)}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                            {(share * 100).toFixed(1)}%
                          </td>
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => del.mutate(it.id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
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
