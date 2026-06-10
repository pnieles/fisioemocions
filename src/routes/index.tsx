import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useExpenses, useMaterials, useProfiles, useVisits } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur, pct } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  Legend,
} from "recharts";
import { ChevronRight, ArrowLeft, TrendingUp, TrendingDown, Wallet, Stethoscope, Package, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Resultados Explotación · fisioemocions" }],
  }),
  component: Dashboard,
});

type Period = "month" | "quarter" | "year" | "all";
type ViewMode = "abs" | "pct";

function startOfPeriod(period: Period): Date | null {
  const now = new Date();
  if (period === "all") return null;
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3) * 3;
    return new Date(now.getFullYear(), q, 1);
  }
  return new Date(now.getFullYear(), 0, 1);
}

function Dashboard() {
  const { data: visits = [] } = useVisits();
  const { data: materials = [] } = useMaterials();
  const { data: expenses = [] } = useExpenses();
  const { data: profiles = [] } = useProfiles();

  const [period, setPeriod] = useState<Period>("month");
  const [view, setView] = useState<ViewMode>("abs");
  const [drill, setDrill] = useState<{ kind: "income" | "expense"; key: string } | null>(null);

  const since = startOfPeriod(period);

  const filt = useMemo(() => {
    const inRange = (d: string) => (since ? new Date(d) >= since : true);
    return {
      visits: visits.filter((v) => inRange(v.visit_date)),
      materials: materials.filter((m) => inRange(m.purchase_date)),
      expenses: expenses.filter((e) => inRange(e.expense_date)),
    };
  }, [visits, materials, expenses, since]);

  const profileMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);

  // Income by profile
  const incomeByProfile = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of filt.visits) {
      const key = v.profile_id ? profileMap[v.profile_id]?.name ?? "Sin perfil" : "Sin perfil";
      map.set(key, (map.get(key) ?? 0) + Number(v.amount));
    }
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [filt.visits, profileMap]);

  // Expense by category (materials + general expenses)
  const expenseByCategory = useMemo(() => {
    const map = new Map<string, number>();
    const matTotal = filt.materials.reduce((s, m) => s + Number(m.quantity) * Number(m.unit_cost), 0);
    if (matTotal > 0) map.set("Material", matTotal);
    for (const e of filt.expenses) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount));
    }
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [filt.materials, filt.expenses]);

  const totalIncome = incomeByProfile.reduce((s, x) => s + x.value, 0);
  const totalExpense = expenseByCategory.reduce((s, x) => s + x.value, 0);
  const net = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? net / totalIncome : 0;

  // Drilldown: when a bar/row is selected, show the underlying entries
  const drillRows = useMemo(() => {
    if (!drill) return [];
    if (drill.kind === "income") {
      return filt.visits
        .filter((v) => (profileMap[v.profile_id ?? ""]?.name ?? "Sin perfil") === drill.key)
        .map((v) => ({
          date: v.visit_date,
          label: v.patient_name,
          sub: v.notes ?? "",
          amount: Number(v.amount),
        }));
    }
    if (drill.key === "Material") {
      return filt.materials.map((m) => ({
        date: m.purchase_date,
        label: m.description,
        sub: m.supplier ?? "",
        amount: Number(m.quantity) * Number(m.unit_cost),
      }));
    }
    return filt.expenses
      .filter((e) => e.category === drill.key)
      .map((e) => ({ date: e.expense_date, label: e.description, sub: "", amount: Number(e.amount) }));
  }, [drill, filt, profileMap]);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Resultados Explotación"
        subtitle="Cuenta de explotación, ingresos por perfil y gastos del centro."
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[160px] bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Año en curso</SelectItem>
                <SelectItem value="all">Todo el histórico</SelectItem>
              </SelectContent>
            </Select>
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="abs">€ Absoluto</TabsTrigger>
                <TabsTrigger value="pct">% Porcentual</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <KPI label="Ingresos" value={eur(totalIncome)} icon={<Stethoscope className="h-4 w-4" />} accent="primary" />
        <KPI label="Gastos" value={eur(totalExpense)} icon={<Receipt className="h-4 w-4" />} accent="muted" />
        <KPI
          label="Resultado neto"
          value={eur(net)}
          icon={net >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          accent={net >= 0 ? "success" : "destructive"}
        />
        <KPI label="Margen" value={pct(margin)} icon={<Wallet className="h-4 w-4" />} accent="accent" />
      </div>

      {/* Chart + Table */}
      {!drill ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3 shadow-[var(--shadow-card)]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-medium">Ingresos vs Gastos por categoría</CardTitle>
              <span className="text-xs text-muted-foreground">Haz clic en una barra para ver el detalle</span>
            </CardHeader>
            <CardContent>
              <DrillChart
                income={incomeByProfile}
                expense={expenseByCategory}
                view={view}
                totalIncome={totalIncome}
                totalExpense={totalExpense}
                onSelect={(kind, key) => setDrill({ kind, key })}
              />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2 shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base font-medium">Cuenta de explotación</CardTitle>
            </CardHeader>
            <CardContent>
              <PLTable
                income={incomeByProfile}
                expense={expenseByCategory}
                totalIncome={totalIncome}
                totalExpense={totalExpense}
                view={view}
                onDrill={(kind, key) => setDrill({ kind, key })}
              />
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="shadow-[var(--shadow-card)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDrill(null)}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Volver
              </button>
              <CardTitle className="text-base font-medium">
                Detalle · <span className="text-primary">{drill.key}</span>
                <span className="text-muted-foreground font-normal text-sm ml-2">
                  ({drill.kind === "income" ? "ingresos" : "despeses"})
                </span>
              </CardTitle>
            </div>
            <span className="text-sm font-medium">
              {eur(drillRows.reduce((s, r) => s + r.amount, 0))}
            </span>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="pb-2.5 font-medium">Data</th>
                    <th className="pb-2.5 font-medium">Descripción</th>
                    <th className="pb-2.5 font-medium">Notas</th>
                    <th className="pb-2.5 font-medium text-right">Import</th>
                    <th className="pb-2.5 font-medium text-right">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Sin registros en este período.</td></tr>
                  )}
                  {drillRows.map((r, i) => {
                    const total = drillRows.reduce((s, x) => s + x.amount, 0);
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/40">
                        <td className="py-2.5 text-muted-foreground">{r.date}</td>
                        <td className="py-2.5 font-medium">{r.label}</td>
                        <td className="py-2.5 text-muted-foreground">{r.sub}</td>
                        <td className="py-2.5 text-right tabular-nums">{eur(r.amount)}</td>
                        <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                          {pct(total > 0 ? r.amount / total : 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}

function KPI({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: "primary" | "success" | "destructive" | "accent" | "muted";
}) {
  const accents = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
    accent: "text-accent bg-accent/10",
    muted: "text-muted-foreground bg-muted",
  } as const;
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
          <span className={cn("h-7 w-7 rounded-md inline-flex items-center justify-center", accents[accent])}>
            {icon}
          </span>
        </div>
        <div className="text-2xl font-display tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

function DrillChart({
  income,
  expense,
  view,
  totalIncome,
  totalExpense,
  onSelect,
}: {
  income: { name: string; value: number }[];
  expense: { name: string; value: number }[];
  view: ViewMode;
  totalIncome: number;
  totalExpense: number;
  onSelect: (kind: "income" | "expense", key: string) => void;
}) {
  const incomeData = income.map((d) => ({
    ...d,
    kind: "income" as const,
    display: view === "abs" ? d.value : totalIncome > 0 ? (d.value / totalIncome) * 100 : 0,
  }));
  const expenseData = expense.map((d) => ({
    ...d,
    kind: "expense" as const,
    display: view === "abs" ? d.value : totalExpense > 0 ? (d.value / totalExpense) * 100 : 0,
  }));
  const data = [
    ...incomeData.map((d) => ({ ...d, group: "Ingresos" })),
    ...expenseData.map((d) => ({ ...d, group: "Gastos" })),
  ];

  return (
    <div className="h-[360px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis
            stroke="var(--color-muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (view === "abs" ? `${v}€` : `${v.toFixed(0)}%`)}
          />
          <Tooltip
            cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _name, props) => {
              const d = props.payload;
              return [
                view === "abs" ? eur(d.value) : `${value.toFixed(1)}%`,
                d.group,
              ];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="display"
            name={view === "abs" ? "Import (€)" : "% del total"}
            radius={[6, 6, 0, 0]}
            onClick={(d: any) => onSelect(d.kind, d.name)}
            cursor="pointer"
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.kind === "income" ? "var(--color-chart-1)" : "var(--color-chart-3)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PLTable({
  income,
  expense,
  totalIncome,
  totalExpense,
  view,
  onDrill,
}: {
  income: { name: string; value: number }[];
  expense: { name: string; value: number }[];
  totalIncome: number;
  totalExpense: number;
  view: ViewMode;
  onDrill: (kind: "income" | "expense", key: string) => void;
}) {
  const fmt = (v: number, total: number) =>
    view === "abs" ? eur(v) : pct(total > 0 ? v / total : 0);

  return (
    <div className="text-sm">
      <Section title="Ingresos" total={totalIncome} view={view} positive>
        {income.length === 0 && <Empty />}
        {income
          .sort((a, b) => b.value - a.value)
          .map((r) => (
            <Row key={r.name} label={r.name} value={fmt(r.value, totalIncome)} onClick={() => onDrill("income", r.name)} />
          ))}
      </Section>
      <Section title="Gastos" total={totalExpense} view={view}>
        {expense.length === 0 && <Empty />}
        {expense
          .sort((a, b) => b.value - a.value)
          .map((r) => (
            <Row key={r.name} label={r.name} value={fmt(r.value, totalExpense)} onClick={() => onDrill("expense", r.name)} />
          ))}
      </Section>
      <div className="border-t-2 border-foreground/80 pt-3 mt-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-base">Resultado neto</span>
          <span
            className={cn(
              "font-display text-lg tabular-nums",
              totalIncome - totalExpense >= 0 ? "text-success" : "text-destructive",
            )}
          >
            {view === "abs"
              ? eur(totalIncome - totalExpense)
              : pct(totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Margen: {pct(totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0)}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  total,
  view,
  positive,
  children,
}: {
  title: string;
  total: number;
  view: ViewMode;
  positive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between border-b border-border pb-1.5 mb-1.5">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className={cn("text-sm tabular-nums font-medium", positive ? "text-primary" : "text-foreground")}>
          {view === "abs" ? eur(total) : "100%"}
        </span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-1.5 px-2 -mx-2 rounded hover:bg-muted/60 group text-left"
    >
      <span className="flex items-center gap-1.5 text-foreground/80 group-hover:text-foreground">
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-accent transition" />
        {label}
      </span>
      <span className="tabular-nums text-foreground/90">{value}</span>
    </button>
  );
}

function Empty() {
  return <div className="text-xs text-muted-foreground py-1 pl-5">Sin movimientos</div>;
}
