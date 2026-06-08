import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useVisits, usePatients } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/informes")({
  head: () => ({ meta: [{ title: "Informes de visites · fisioemocions" }] }),
  component: InformesPage,
});

type Period = "month" | "quarter" | "year" | "all";

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

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+date - +yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-S${String(weekNo).padStart(2, "0")}`;
}

function InformesPage() {
  const { data: visits = [] } = useVisits();
  const { data: patients = [] } = usePatients();
  const [period, setPeriod] = useState<Period>("month");

  const since = startOfPeriod(period);
  const filtered = useMemo(
    () => visits.filter((v) => (since ? new Date(v.visit_date) >= since : true)),
    [visits, since],
  );

  // Per patient
  const perPatient = useMemo(() => {
    const m = new Map<string, { name: string; count: number; amount: number; last: string }>();
    for (const v of filtered) {
      const pat = v.patient_id ? patients.find((x) => x.id === v.patient_id) : null;
      const name = pat ? `${pat.last_name}, ${pat.first_name}` : v.patient_name;
      const key = v.patient_id ?? v.patient_name;
      const cur = m.get(key) ?? { name, count: 0, amount: 0, last: v.visit_date };
      cur.count += 1;
      cur.amount += Number(v.amount);
      if (v.visit_date > cur.last) cur.last = v.visit_date;
      m.set(key, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.count - a.count);
  }, [filtered, patients]);

  // Totals by day
  const byDay = useMemo(() => {
    const m = new Map<string, { count: number; amount: number }>();
    for (const v of filtered) {
      const cur = m.get(v.visit_date) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(v.amount);
      m.set(v.visit_date, cur);
    }
    return Array.from(m.entries())
      .map(([day, x]) => ({ day, ...x }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [filtered]);

  // Totals by week
  const byWeek = useMemo(() => {
    const m = new Map<string, { count: number; amount: number; days: Set<string> }>();
    for (const v of filtered) {
      const k = isoWeek(new Date(v.visit_date));
      const cur = m.get(k) ?? { count: 0, amount: 0, days: new Set() };
      cur.count += 1;
      cur.amount += Number(v.amount);
      cur.days.add(v.visit_date);
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([week, x]) => ({
        week,
        count: x.count,
        amount: x.amount,
        days: x.days.size,
        avgPerDay: x.days.size > 0 ? x.count / x.days.size : 0,
      }))
      .sort((a, b) => (a.week < b.week ? 1 : -1));
  }, [filtered]);

  // Totals by month
  const byMonth = useMemo(() => {
    const m = new Map<string, { count: number; amount: number; days: Set<string> }>();
    for (const v of filtered) {
      const k = v.visit_date.slice(0, 7);
      const cur = m.get(k) ?? { count: 0, amount: 0, days: new Set() };
      cur.count += 1;
      cur.amount += Number(v.amount);
      cur.days.add(v.visit_date);
      m.set(k, cur);
    }
    return Array.from(m.entries())
      .map(([month, x]) => ({
        month,
        count: x.count,
        amount: x.amount,
        days: x.days.size,
        avgPerDay: x.days.size > 0 ? x.count / x.days.size : 0,
      }))
      .sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [filtered]);

  const totalCount = filtered.length;
  const totalAmount = filtered.reduce((s, v) => s + Number(v.amount), 0);

  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Informes de visites"
        subtitle="Visites per pacient i totals per dia, setmana i mes amb promitjos."
        actions={
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Aquest mes</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="year">Any en curs</SelectItem>
              <SelectItem value="all">Tot l'històric</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Kpi label="Visites totals" value={String(totalCount)} />
        <Kpi label="Import total" value={eur(totalAmount)} />
        <Kpi label="Pacients diferents" value={String(perPatient.length)} />
      </div>

      <Tabs defaultValue="patient" className="space-y-4">
        <TabsList>
          <TabsTrigger value="patient">Per pacient</TabsTrigger>
          <TabsTrigger value="day">Per dia</TabsTrigger>
          <TabsTrigger value="week">Per setmana</TabsTrigger>
          <TabsTrigger value="month">Per mes</TabsTrigger>
        </TabsList>

        <TabsContent value="patient">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <Table headers={["Pacient", "Visites", "Import", "Última visita"]}>
                {perPatient.length === 0 ? (
                  <EmptyRow span={4} />
                ) : (
                  perPatient.map((r) => (
                    <tr key={r.name} className="border-t border-border hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium">{r.name}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{r.count}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{eur(r.amount)}</td>
                      <td className="px-6 py-3 text-right text-muted-foreground">{fmtDate(r.last)}</td>
                    </tr>
                  ))
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <Table headers={["Dia", "Visites", "Import"]}>
                {byDay.length === 0 ? (
                  <EmptyRow span={3} />
                ) : (
                  <>
                    {byDay.map((r) => (
                      <tr key={r.day} className="border-t border-border hover:bg-muted/30">
                        <td className="px-6 py-3">{fmtDate(r.day)}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{r.count}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{eur(r.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-muted/20 font-medium">
                      <td className="px-6 py-3">Total ({byDay.length} dies amb activitat)</td>
                      <td className="px-6 py-3 text-right tabular-nums">{totalCount}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{eur(totalAmount)}</td>
                    </tr>
                    <tr className="border-t border-border text-muted-foreground">
                      <td className="px-6 py-3">Promig per dia amb activitat</td>
                      <td className="px-6 py-3 text-right tabular-nums">{(totalCount / byDay.length).toFixed(2)}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{eur(totalAmount / byDay.length)}</td>
                    </tr>
                  </>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <Table headers={["Setmana", "Dies amb dades", "Visites", "Import", "Promig visites/dia"]}>
                {byWeek.length === 0 ? (
                  <EmptyRow span={5} />
                ) : (
                  <>
                    {byWeek.map((r) => (
                      <tr key={r.week} className="border-t border-border hover:bg-muted/30">
                        <td className="px-6 py-3 font-medium">{r.week}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{r.days}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{r.count}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{eur(r.amount)}</td>
                        <td className="px-6 py-3 text-right tabular-nums">{r.avgPerDay.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-muted/20 font-medium">
                      <td className="px-6 py-3">Total ({byWeek.length} setmanes)</td>
                      <td className="px-6 py-3 text-right tabular-nums">—</td>
                      <td className="px-6 py-3 text-right tabular-nums">{totalCount}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{eur(totalAmount)}</td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {(totalCount / byWeek.length).toFixed(2)} /set.
                      </td>
                    </tr>
                  </>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month">
          <Card className="shadow-[var(--shadow-card)]">
            <CardContent className="p-0">
              <Table headers={["Mes", "Dies amb dades", "Visites", "Import", "Promig visites/dia amb dades"]}>
                {byMonth.length === 0 ? (
                  <EmptyRow span={5} />
                ) : (
                  <>
                    {byMonth.map((r) => {
                      const [y, m] = r.month.split("-");
                      const label = new Intl.DateTimeFormat("ca-ES", { month: "long", year: "numeric" }).format(new Date(Number(y), Number(m) - 1, 1));
                      return (
                        <tr key={r.month} className="border-t border-border hover:bg-muted/30">
                          <td className="px-6 py-3 font-medium capitalize">{label}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{r.days}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{r.count}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{eur(r.amount)}</td>
                          <td className="px-6 py-3 text-right tabular-nums">{r.avgPerDay.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-border bg-muted/20 font-medium">
                      <td className="px-6 py-3">Total ({byMonth.length} mesos)</td>
                      <td className="px-6 py-3 text-right tabular-nums">—</td>
                      <td className="px-6 py-3 text-right tabular-nums">{totalCount}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{eur(totalAmount)}</td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {(totalCount / byMonth.length).toFixed(2)} /mes
                      </td>
                    </tr>
                  </>
                )}
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr className="text-left">
            {headers.map((h, i) => (
              <th key={i} className={`px-6 py-3 font-medium ${i === 0 ? "" : "text-right"}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ span }: { span: number }) {
  return <tr><td colSpan={span} className="px-6 py-10 text-center text-muted-foreground">Sense dades en aquest període.</td></tr>;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-3xl mt-2">{value}</div>
      </CardContent>
    </Card>
  );
}
