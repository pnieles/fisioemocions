import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMaterials, useVisits } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/consumo")({
  head: () => ({ meta: [{ title: "Consumo mensual · fisioemocions" }] }),
  component: ConsumoPage,
});

function monthKey(iso: string) { return iso.slice(0, 7); }
function fmtMonth(key: string) {
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(new Date(Number(y), Number(m) - 1, 1));
}

type MonthData = {
  units: number;
  amount: number;
  patients: Map<string, number>;
  products: Map<string, { units: number; amount: number }>;
};

function ConsumoPage() {
  const { data: materials = [] } = useMaterials();
  const { data: visits = [] } = useVisits();

  const byMonth = useMemo(() => {
    const m = new Map<string, MonthData>();
    const ensure = (k: string): MonthData => {
      const row = m.get(k) ?? { units: 0, amount: 0, patients: new Map(), products: new Map() };
      m.set(k, row);
      return row;
    };
    for (const mat of materials) {
      const k = monthKey(mat.purchase_date);
      const row = ensure(k);
      const q = Number(mat.quantity);
      const a = q * Number(mat.unit_cost);
      row.units += q;
      row.amount += a;
      const p = row.products.get(mat.description) ?? { units: 0, amount: 0 };
      p.units += q;
      p.amount += a;
      row.products.set(mat.description, p);
    }
    for (const v of visits) {
      const k = monthKey(v.visit_date);
      const row = ensure(k);
      row.patients.set(v.patient_name, (row.patients.get(v.patient_name) ?? 0) + 1);
    }
    return m;
  }, [materials, visits]);

  const months = useMemo(
    () => Array.from(byMonth.keys()).sort((a, b) => (a < b ? 1 : -1)),
    [byMonth],
  );

  const [period, setPeriod] = useState<string>("");
  const activeKey = period || months[0] || "";

  const chartData = useMemo(
    () =>
      months.slice().reverse().map((k) => {
        const r = byMonth.get(k)!;
        return { month: fmtMonth(k), Unidades: r.units, Import: Number(r.amount.toFixed(2)) };
      }),
    [months, byMonth],
  );

  const active = activeKey ? byMonth.get(activeKey) : null;
  const totalVisits = active ? Array.from(active.patients.values()).reduce((s, n) => s + n, 0) : 0;
  const perPatient = active && totalVisits > 0
    ? Array.from(active.patients.entries()).map(([name, vc]) => {
        const share = vc / totalVisits;
        return { name, visits: vc, units: active.units * share, amount: active.amount * share };
      }).sort((a, b) => b.amount - a.amount)
    : [];

  const perProduct = active
    ? Array.from(active.products.entries())
        .map(([name, x]) => ({ name, units: x.units, amount: x.amount }))
        .sort((a, b) => b.amount - a.amount)
    : [];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Consumo de consumibles por período"
        subtitle="Detallee por producto (cantidad e importe) y prorrateo por paciente según las visitas del mes."
        actions={
          <Select value={activeKey} onValueChange={setPeriod}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Període" /></SelectTrigger>
            <SelectContent>
              {months.map((k) => (
                <SelectItem key={k} value={k}>{fmtMonth(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Kpi label="Unidades totales" value={active ? active.units.toLocaleString("es-ES") : "—"} />
        <Kpi label="Importe total" value={active ? eur(active.amount) : "—"} />
        <Kpi label="Pacientees atendidos" value={active ? String(active.patients.size) : "—"} sub={active ? `${totalVisits} visites` : ""} />
      </div>

      <Card className="shadow-[var(--shadow-card)] mb-6">
        <CardContent className="p-6">
          <h3 className="font-display text-lg mb-4">Evolución mensual</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar yAxisId="l" dataKey="Unidades" fill="oklch(0.55 0.08 200)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="r" dataKey="Import" fill="oklch(0.65 0.12 35)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)] mb-6">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg">Detallee por producto · {activeKey ? fmtMonth(activeKey) : "—"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Cantidades compradas e importe por artículo del mes.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-6 py-3 font-medium">Producto</th>
                  <th className="px-6 py-3 font-medium text-right">Unidades</th>
                  <th className="px-6 py-3 font-medium text-right">Import</th>
                  <th className="px-6 py-3 font-medium text-right">% import</th>
                </tr>
              </thead>
              <tbody>
                {perProduct.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">Sin compras en este período.</td></tr>
                )}
                {perProduct.map((p) => (
                  <tr key={p.name} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">{p.name}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{p.units.toLocaleString("es-ES")}</td>
                    <td className="px-6 py-3 text-right tabular-nums font-medium">{eur(p.amount)}</td>
                    <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                      {active && active.amount > 0 ? ((p.amount / active.amount) * 100).toFixed(1) + "%" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {perProduct.length > 0 && active && (
                <tfoot>
                  <tr className="border-t border-border bg-muted/20 font-medium">
                    <td className="px-6 py-3">Total</td>
                    <td className="px-6 py-3 text-right tabular-nums">{active.units.toLocaleString("es-ES")}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{eur(active.amount)}</td>
                    <td className="px-6 py-3 text-right tabular-nums">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg">Consumo por paciente · {activeKey ? fmtMonth(activeKey) : "—"}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Prorrateo según número de visitas del mes.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-6 py-3 font-medium">Paciente</th>
                  <th className="px-6 py-3 font-medium text-right">Visitas</th>
                  <th className="px-6 py-3 font-medium text-right">Unidades (estim.)</th>
                  <th className="px-6 py-3 font-medium text-right">Importe (estim.)</th>
                </tr>
              </thead>
              <tbody>
                {perPatient.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">Sin datos para el período seleccionado.</td></tr>
                )}
                {perPatient.map((r) => (
                  <tr key={r.name} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">{r.name}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{r.visits}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{r.units.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{eur(r.amount)}</td>
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

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-3xl mt-2">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}
