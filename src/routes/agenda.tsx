import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppointments, usePatients, useProfiles, useTreatments } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda · fisioemocions" }] }),
  component: AgendaPage,
});

function localISOForInput(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const empty = {
  patient_id: "",
  profile_id: "",
  appointment_at: localISOForInput(),
  duration_min: "30",
  diagnosis: "",
  treatment: "",
  status: "scheduled",
  notes: "",
};

function AgendaPage() {
  const { data: appts = [] } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: profiles = [] } = useProfiles();
  const { data: treatments = [] } = useTreatments();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");

  const add = useMutation({
    mutationFn: async () => {
      if (!form.patient_id || !form.appointment_at) throw new Error("Pacient i data obligatoris");
      const { error } = await supabase.from("appointments").insert({
        patient_id: form.patient_id,
        profile_id: form.profile_id || null,
        appointment_at: new Date(form.appointment_at).toISOString(),
        duration_min: Number(form.duration_min) || 30,
        diagnosis: form.diagnosis || null,
        treatment: form.treatment || null,
        status: form.status,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cita programada");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setForm({ ...empty, appointment_at: localISOForInput() });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cita eliminada");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const list = useMemo(() => {
    const now = Date.now();
    return appts
      .filter((a) => {
        const t = new Date(a.appointment_at).getTime();
        if (filter === "upcoming") return t >= now - 3600 * 1000;
        if (filter === "past") return t < now - 3600 * 1000;
        return true;
      })
      .sort((a, b) =>
        filter === "past"
          ? new Date(b.appointment_at).getTime() - new Date(a.appointment_at).getTime()
          : new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime(),
      );
  }, [appts, filter]);

  const patName = (id: string | null) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.last_name}, ${p.first_name}` : "—";
  };

  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Agenda de cites" subtitle="Programa cites amb diagnòstic i tractament aplicat." />

      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <Field className="md:col-span-3" label="Pacient *">
              <Select
                value={form.patient_id}
                onValueChange={(v) => {
                  const p = patients.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    patient_id: v,
                    treatment: p?.default_treatment || f.treatment,
                  }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.last_name}, {p.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-3" label="Data i hora *">
              <Input type="datetime-local" value={form.appointment_at} onChange={(e) => setForm({ ...form, appointment_at: e.target.value })} />
            </Field>
            <Field className="md:col-span-1" label="Min.">
              <Input type="number" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Perfil">
              <Select value={form.profile_id} onValueChange={(v) => setForm({ ...form, profile_id: v })}>
                <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-3" label="Tractament">
              <Select value={form.treatment} onValueChange={(v) => setForm({ ...form, treatment: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {treatments.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-6" label="Diagnòstic">
              <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            </Field>
            <Field className="md:col-span-5" label="Notes">
              <Textarea rows={1} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="md:col-span-1 h-10">
              <Plus className="h-4 w-4 mr-1" /> Afegir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg">Cites</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{list.length} cites</p>
            </div>
            <Select value={filter} onValueChange={(v: "upcoming" | "past" | "all") => setFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Pròximes</SelectItem>
                <SelectItem value="past">Passades</SelectItem>
                <SelectItem value="all">Totes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Pacient</th>
                  <th className="px-6 py-3 font-medium">Tractament</th>
                  <th className="px-6 py-3 font-medium">Diagnòstic</th>
                  <th className="px-6 py-3 font-medium">Estat</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Sense cites.</td></tr>
                )}
                {list.map((a) => (
                  <tr key={a.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-3 text-muted-foreground tabular-nums">
                      {new Date(a.appointment_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-6 py-3 font-medium">{patName(a.patient_id)}</td>
                    <td className="px-6 py-3">
                      {a.treatment && (
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium">{a.treatment}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground text-xs max-w-xs truncate">{a.diagnosis ?? ""}</td>
                    <td className="px-6 py-3">
                      <Select value={a.status} onValueChange={(v) => updateStatus.mutate({ id: a.id, status: v })}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Programada</SelectItem>
                          <SelectItem value="completed">Realitzada</SelectItem>
                          <SelectItem value="cancelled">Cancel·lada</SelectItem>
                          <SelectItem value="no_show">No s'ha presentat</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <button onClick={() => del.mutate(a.id)} className="text-muted-foreground hover:text-destructive">
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
