import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInvoices, usePatients, useCompanySettings } from "@/lib/data-hooks";
import { exportInvoicePdf } from "@/lib/invoices";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eur } from "@/lib/format";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";

export const Route = createFileRoute("/facturas")({
  head: () => ({ meta: [{ title: "Facturas · fisioemocions" }] }),
  component: FacturasPage,
});

const STATUS_LABEL: Record<string, string> = {
  en_proceso: "En proceso",
  incidencia: "Con incidencia",
  cobrado: "Cobrado",
};

function FacturasPage() {
  const { data: invoices = [] } = useInvoices();
  const { data: patients = [] } = usePatients();
  const { data: company } = useCompanySettings();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "cass" | "privado">("all");

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Factura eliminada");
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const list = useMemo(
    () => invoices.filter((i) => filter === "all" || i.patient_type === filter),
    [invoices, filter],
  );

  const summary = useMemo(() => {
    const s = { count: list.length, total: 0, cobrado: 0, pendiente: 0 };
    for (const i of list) {
      s.total += Number(i.total_amount);
      if (i.status === "cobrado") s.cobrado += Number(i.total_amount);
      else s.pendiente += Number(i.total_amount);
    }
    return s;
  }, [list]);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Facturas" subtitle="Facturas CASS (auto-numeradas) y Privado (exportables en PDF)." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Facturas" value={String(summary.count)} />
        <Stat label="Facturado" value={eur(summary.total)} />
        <Stat label="Cobrado" value={eur(summary.cobrado)} />
        <Stat label="Pendiente" value={eur(summary.pendiente)} />
      </div>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-display text-lg">Listado de facturas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Marca el estado para hacer seguimiento del cobro.</p>
            </div>
            <Select value={filter} onValueChange={(v: "all" | "cass" | "privado") => setFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="cass">CASS</SelectItem>
                <SelectItem value="privado">Privado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-3 font-medium">Nº</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium text-right">Base</th>
                  <th className="px-4 py-3 font-medium text-right">IGI</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">Aún no hay facturas.</td></tr>
                )}
                {list.map((i) => {
                  const p = i.patient_id ? patients.find((x) => x.id === i.patient_id) : null;
                  return (
                    <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium tabular-nums">{i.invoice_number ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {new Date(i.issue_date).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-2">{i.patient_name ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs">
                          {i.patient_type === "cass" ? "CASS" : "Privado"}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{eur(Number(i.base_amount))}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{eur(Number(i.igi_amount))}</td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">{eur(Number(i.total_amount))}</td>
                      <td className="px-4 py-2">
                        <Select value={i.status} onValueChange={(v) => updateStatus.mutate({ id: i.id, status: v })}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABEL).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap space-x-2">
                        {i.patient_type === "privado" && (
                          <Button size="sm" variant="outline" onClick={() => exportInvoicePdf(i, company ?? { name: "fisioemocions", logo_url: null }, p)}>
                            <Download className="h-3.5 w-3.5 mr-1" /> PDF
                          </Button>
                        )}
                        <button onClick={() => del.mutate(i.id)} className="text-muted-foreground hover:text-destructive align-middle">
                          <Trash2 className="h-4 w-4 inline" />
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
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="shadow-[var(--shadow-card)]">
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display text-2xl mt-1 tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
