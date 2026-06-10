import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles, useVisits, usePatients, useAppointments } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { eur, fmtDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Plus, Check, ChevronsUpDown, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/visitas")({
  head: () => ({ meta: [{ title: "Visitas · fisioemocions" }] }),
  component: VisitsPage,
});

function VisitsPage() {
  const { data: profiles = [] } = useProfiles();
  const { data: patients = [] } = usePatients();
  const { data: visits = [] } = useVisits();
  const { data: appts = [] } = useAppointments();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    visit_date: todayISO(),
    patient_id: "",
    patient_name: "",
    profile_id: "",
    amount: "",
    notes: "",
  });

  const [patientOpen, setPatientOpen] = useState(false);

  const add = useMutation({
    mutationFn: async () => {
      if (!form.patient_id || !form.profile_id || !form.amount) {
        throw new Error("Rellena todos los campos requeridos");
      }
      const { error } = await supabase.from("patient_visits").insert({
        visit_date: form.visit_date,
        patient_id: form.patient_id,
        patient_name: form.patient_name,
        profile_id: form.profile_id,
        amount: Number(form.amount),
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visita registrada");
      qc.invalidateQueries({ queryKey: ["visits"] });
      setForm({
        ...form,
        patient_id: "",
        patient_name: "",
        amount: "",
        notes: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patient_visits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visita eliminada");
      qc.invalidateQueries({ queryKey: ["visits"] });
    },
  });

  const markApptCompleted = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const todaysAppts = useMemo(() => {
    const today = todayISO();
    return appts
      .filter((a) => a.appointment_at.slice(0, 10) === today && a.status === "scheduled")
      .sort((a, b) => a.appointment_at.localeCompare(b.appointment_at));
  }, [appts]);

  const prefillFromAppt = (apptId: string) => {
    const a = appts.find((x) => x.id === apptId);
    if (!a) return;
    const p = patients.find((x) => x.id === a.patient_id);
    const prof = a.profile_id ? profiles.find((x) => x.id === a.profile_id) : null;
    setForm({
      visit_date: a.appointment_at.slice(0, 10),
      patient_id: a.patient_id ?? "",
      patient_name: p ? `${p.first_name} ${p.last_name}` : "",
      profile_id: prof?.id ?? "",
      amount: prof ? String(prof.default_rate) : "",
      notes: a.treatment ? `Cita: ${a.treatment}` : "",
    });
    toast.success("Cita cargada en el formulario. Revisa y guarda.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmAppt = async (apptId: string) => {
    const a = appts.find((x) => x.id === apptId);
    if (!a) return;
    const p = patients.find((x) => x.id === a.patient_id);
    const prof = a.profile_id ? profiles.find((x) => x.id === a.profile_id) : null;
    if (!a.patient_id || !prof) {
      prefillFromAppt(apptId);
      return;
    }
    const { error } = await supabase.from("patient_visits").insert({
      visit_date: a.appointment_at.slice(0, 10),
      patient_id: a.patient_id,
      patient_name: p ? `${p.first_name} ${p.last_name}` : "",
      profile_id: prof.id,
      amount: prof.default_rate,
      notes: a.treatment ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await markApptCompleted.mutateAsync(apptId);
    qc.invalidateQueries({ queryKey: ["visits"] });
    toast.success("Visita registrada desde la agenda");
  };

  const handleProfile = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    setForm({ ...form, profile_id: id, amount: p ? String(p.default_rate) : form.amount });
  };

  const handlePatient = (id: string) => {
    const p = patients.find((x) => x.id === id);
    setForm({
      ...form,
      patient_id: id,
      patient_name: p ? `${p.first_name} ${p.last_name}` : form.patient_name,
    });
    setPatientOpen(false);
  };

  const total = visits.reduce((s, v) => s + Number(v.amount), 0);

  const selectedPatient = patients.find((p) => p.id === form.patient_id);

  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Visitas de pacientes" subtitle="Registra cada visita con la tarifa según el perfil de cliente." />

      {todaysAppts.length > 0 && (
        <Card className="mb-6 shadow-[var(--shadow-card)]">
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg">Agenda de hoy</h2>
              <span className="text-xs text-muted-foreground ml-1">{todaysAppts.length} pendientes</span>
            </div>
            <div className="divide-y divide-border">
              {todaysAppts.map((a) => {
                const p = patients.find((x) => x.id === a.patient_id);
                const time = new Date(a.appointment_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={a.id} className="px-6 py-3 flex items-center gap-4 hover:bg-muted/30">
                    <div className="text-sm font-medium tabular-nums w-14">{time}</div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{p ? `${p.last_name}, ${p.first_name}` : "—"}</div>
                      {a.treatment && (
                        <div className="text-xs text-muted-foreground mt-0.5">{a.treatment}</div>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => prefillFromAppt(a.id)}>Editar</Button>
                    <Button size="sm" onClick={() => confirmAppt(a.id)}>Confirmar</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}


      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <Field className="md:col-span-2" label="Data">
              <Input type="date" value={form.visit_date} onChange={(e) => setForm({ ...form, visit_date: e.target.value })} />
            </Field>
            <Field className="md:col-span-3" label="Paciente *">
              <Popover open={patientOpen} onOpenChange={setPatientOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={patientOpen}
                    className="w-full justify-between h-10 font-normal"
                  >
                    {selectedPatient
                      ? `${selectedPatient.last_name}, ${selectedPatient.first_name}`
                      : "Selecciona un paciente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar paciente..." />
                    <CommandList>
                      <CommandEmpty>No se ha encontrado ningún paciente.</CommandEmpty>
                      <CommandGroup>
                        {patients.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.last_name} ${p.first_name} ${p.phone ?? ""}`}
                            onSelect={() => handlePatient(p.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.patient_id === p.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {p.last_name}, {p.first_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </Field>
            <Field className="md:col-span-2" label="Perfil *">
              <Select value={form.profile_id} onValueChange={handleProfile}>
                <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} · {eur(p.default_rate)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-2" label="Import (€) *">
              <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Notas">
              <Input placeholder="Opcional" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="md:col-span-1 h-10">
              <Plus className="h-4 w-4 mr-1" /> Añadir
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg">Historial de visitas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{visits.length} visitas · {eur(total)} acumulado</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Paciente</th>
                  <th className="px-6 py-3 font-medium">Perfil</th>
                  <th className="px-6 py-3 font-medium">Notas</th>
                  <th className="px-6 py-3 font-medium text-right">Import</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {visits.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Aún no hay visitas registradas.</td></tr>
                )}
                {visits.map((v) => {
                  const prof = profiles.find((x) => x.id === v.profile_id);
                  const pat = v.patient_id
                    ? patients.find((x) => x.id === v.patient_id)
                    : null;
                  const displayName = pat
                    ? `${pat.last_name}, ${pat.first_name}`
                    : v.patient_name;
                  return (
                    <tr key={v.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-6 py-3 text-muted-foreground">{fmtDate(v.visit_date)}</td>
                      <td className="px-6 py-3 font-medium">{displayName}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium">
                          {prof?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{v.notes ?? ""}</td>
                      <td className="px-6 py-3 text-right tabular-nums font-medium">{eur(Number(v.amount))}</td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => del.mutate(v.id)} className="text-muted-foreground hover:text-destructive">
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
