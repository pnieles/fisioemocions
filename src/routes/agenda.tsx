import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppointments, usePatients, useProfiles, useTreatments, useScheduleSettings, type Appointment } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Plus, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda · fisioemocions" }] }),
  component: AgendaPage,
});

function localISOForInput(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Mon as start
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtHM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseHM(s: string) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

function dateToISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const { data: schedule } = useScheduleSettings();
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState(empty);

  const openEdit = (a: Appointment) => {
    if (a.status !== "scheduled") {
      toast.info("Solo se pueden editar citas en estado Programada");
      return;
    }
    setEditing(a);
    setEditForm({
      patient_id: a.patient_id ?? "",
      profile_id: a.profile_id ?? "",
      appointment_at: localISOForInput(new Date(a.appointment_at)),
      duration_min: String(a.duration_min ?? 30),
      diagnosis: a.diagnosis ?? "",
      treatment: a.treatment ?? "",
      status: a.status,
      notes: a.notes ?? "",
    });
  };

  const updateAppt = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (!editForm.patient_id || !editForm.appointment_at) throw new Error("Paciente y fecha obligatorios");
      const { error } = await supabase.from("appointments").update({
        patient_id: editForm.patient_id,
        profile_id: editForm.profile_id || null,
        appointment_at: new Date(editForm.appointment_at).toISOString(),
        duration_min: Number(editForm.duration_min) || 30,
        diagnosis: editForm.diagnosis || null,
        treatment: editForm.treatment || null,
        notes: editForm.notes || null,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cita actualizada");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.patient_id || !form.appointment_at) throw new Error("Paciente y fecha obligatorios");
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

  // Weekly view
  const sch = schedule ?? { open: "09:00", close: "20:00", slot_min: 30, weekdays: [1,2,3,4,5,6], holidays: [] };
  const openMin = parseHM(sch.open);
  const closeMin = parseHM(sch.close);
  const slotMin = sch.slot_min || 30;
  const slotsPerDay = Math.max(0, Math.ceil((closeMin - openMin) / slotMin));
  const days = useMemo(() => {
    return Array.from({ length: 7 })
      .map((_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      })
      .filter((d) => {
        const iso = dateToISODate(d);
        return sch.weekdays.includes(d.getDay()) && !sch.holidays.includes(iso);
      });
  }, [weekStart, sch.weekdays, sch.holidays]);

  type Busy = { startMin: number; endMin: number; appt: typeof appts[number] };
  const busyByDay = useMemo(() => {
    const m = new Map<string, Busy[]>();
    for (const a of appts) {
      const d = new Date(a.appointment_at);
      const key = dateToISODate(d);
      const sMin = d.getHours() * 60 + d.getMinutes();
      const eMin = sMin + (a.duration_min || 30);
      const arr = m.get(key) ?? [];
      arr.push({ startMin: sMin, endMin: eMin, appt: a });
      m.set(key, arr);
    }
    return m;
  }, [appts]);

  const pickSlot = (day: Date, mins: number) => {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(mins);
    setForm((f) => ({ ...f, appointment_at: localISOForInput(d) }));
    toast.success(`Slot seleccionado: ${d.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}`);
    const el = document.getElementById("agenda-form");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shiftWeek = (n: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + n * 7);
    setWeekStart(d);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Agenda de citas" subtitle="Vista semanal con horas libres y ocupadas. Haz clic en una hora libre para crear cita." />

      {/* Weekly view */}
      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => shiftWeek(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <div className="font-display text-lg">
                Semana del {weekStart.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
              <Button variant="ghost" size="icon" onClick={() => shiftWeek(1)}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Hoy</Button>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted border border-border" /> Libre</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/80" /> Ocupado</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-destructive/30 border border-destructive/50" /> Cerrado</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[800px] grid" style={{ gridTemplateColumns: `64px repeat(7, minmax(0, 1fr))` }}>
              {/* header row */}
              <div></div>
              {days.map((d) => {
                const iso = dateToISODate(d);
                const isHoliday = sch.holidays.includes(iso);
                const isWeekend = !sch.weekdays.includes(d.getDay());
                const closed = isHoliday || isWeekend;
                const isToday = iso === dateToISODate(new Date());
                return (
                  <div key={iso} className={cn(
                    "px-2 py-2 text-center border-l border-b border-border",
                    isToday && "bg-accent/5",
                  )}>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {d.toLocaleDateString("es-ES", { weekday: "short" })}
                    </div>
                    <div className={cn("font-display text-base", isToday && "text-primary")}>
                      {d.getDate()}
                    </div>
                    {closed && <div className="text-[10px] text-destructive mt-0.5">{isHoliday ? "Festivo" : "Cerrado"}</div>}
                  </div>
                );
              })}
              {/* time rows */}
              {Array.from({ length: slotsPerDay }).map((_, sIdx) => {
                const mins = openMin + sIdx * slotMin;
                return (
                  <Fragment key={`row-${sIdx}`}>
                    <div className="px-2 py-1 text-[11px] text-muted-foreground text-right border-t border-border">
                      {fmtHM(mins)}
                    </div>
                    {days.map((d) => {
                      const iso = dateToISODate(d);
                      const isHoliday = sch.holidays.includes(iso);
                      const isWeekend = !sch.weekdays.includes(d.getDay());
                      const closed = isHoliday || isWeekend;
                      const slotEnd = mins + slotMin;
                      const busy = (busyByDay.get(iso) ?? []).find((b) => b.startMin < slotEnd && b.endMin > mins);
                      if (closed) {
                        return <div key={`${iso}-${sIdx}`} className="border-t border-l border-border bg-destructive/10" style={{ minHeight: 28 }} />;
                      }
                      if (busy) {
                        const p = patients.find((x) => x.id === busy.appt.patient_id);
                        const isStart = busy.startMin === mins;
                        const editable = busy.appt.status === "scheduled";
                        return (
                          <button
                            key={`${iso}-${sIdx}`}
                            type="button"
                            onClick={() => openEdit(busy.appt)}
                            disabled={!editable}
                            title={`${p ? p.last_name + ", " + p.first_name : "Cita"} · ${fmtHM(busy.startMin)}-${fmtHM(busy.endMin)}${editable ? " · Clic para editar" : ""}`}
                            className={cn(
                              "border-t border-l border-border text-primary-foreground text-[10px] px-1 overflow-hidden text-left",
                              editable ? "bg-primary/80 hover:bg-primary cursor-pointer" : "bg-muted-foreground/50 cursor-default",
                            )}
                            style={{ minHeight: 28 }}
                          >
                            {isStart && (
                              <div className="truncate font-medium">{p ? `${p.last_name}, ${p.first_name}` : "Cita"}</div>
                            )}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={`${iso}-${sIdx}`}
                          onClick={() => pickSlot(d, mins)}
                          className="border-t border-l border-border bg-card hover:bg-accent/15 transition text-[10px] text-transparent hover:text-foreground"
                          style={{ minHeight: 28 }}
                        >+ {fmtHM(mins)}</button>
                      );
                    })}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="agenda-form" className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <Field className="md:col-span-3" label="Paciente *">
              <Select
                value={form.patient_id}
                onValueChange={(v) => {
                  const p = patients.find((x) => x.id === v);
                  setForm((f) => ({
                    ...f,
                    patient_id: v,
                    treatment: p?.default_treatment || f.treatment,
                    profile_id: p?.default_profile_id || f.profile_id,
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
            <Field className="md:col-span-3" label="Tratamiento">
              <Select value={form.treatment} onValueChange={(v) => setForm({ ...form, treatment: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {treatments.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-6" label="Diagnóstico">
              <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            </Field>
            <Field className="md:col-span-5" label="Notas">
              <Textarea rows={1} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
              <h2 className="font-display text-lg">Citas</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{list.length} citas</p>
            </div>
            <Select value={filter} onValueChange={(v: "upcoming" | "past" | "all") => setFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Próximas</SelectItem>
                <SelectItem value="past">Pasadas</SelectItem>
                <SelectItem value="all">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-6 py-3 font-medium">Fecha</th>
                  <th className="px-6 py-3 font-medium">Paciente</th>
                  <th className="px-6 py-3 font-medium">Tratamiento</th>
                  <th className="px-6 py-3 font-medium">Diagnóstico</th>
                  <th className="px-6 py-3 font-medium">Estado</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Sin citas.</td></tr>
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
                          <SelectItem value="completed">Realizada</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                          <SelectItem value="no_show">No se presentó</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      {a.status === "scheduled" && (
                        <button onClick={() => openEdit(a)} className="text-muted-foreground hover:text-primary mr-2 inline-block align-middle" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => del.mutate(a.id)} className="text-muted-foreground hover:text-destructive align-middle">
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
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Editar cita</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Paciente *">
              <Select value={editForm.patient_id} onValueChange={(v) => setEditForm({ ...editForm, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.last_name}, {p.first_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fecha y hora *">
              <Input type="datetime-local" value={editForm.appointment_at} onChange={(e) => setEditForm({ ...editForm, appointment_at: e.target.value })} />
            </Field>
            <Field label="Duración (min)">
              <Input type="number" value={editForm.duration_min} onChange={(e) => setEditForm({ ...editForm, duration_min: e.target.value })} />
            </Field>
            <Field label="Perfil">
              <Select value={editForm.profile_id} onValueChange={(v) => setEditForm({ ...editForm, profile_id: v })}>
                <SelectTrigger><SelectValue placeholder="Perfil" /></SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tratamiento" className="sm:col-span-2">
              <Select value={editForm.treatment} onValueChange={(v) => setEditForm({ ...editForm, treatment: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {treatments.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Diagnóstico" className="sm:col-span-2">
              <Input value={editForm.diagnosis} onChange={(e) => setEditForm({ ...editForm, diagnosis: e.target.value })} />
            </Field>
            <Field label="Notas" className="sm:col-span-2">
              <Textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => updateAppt.mutate()} disabled={updateAppt.isPending}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
