import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings, useReminderTemplates, useScheduleSettings, useProfiles, useIgiRates } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { eur } from "@/lib/format";
import { toast } from "sonner";
import { Upload, X, Plus, Trash2, Save } from "lucide-react";
import { useRoles, MENU_KEYS, permissionLabel, type Permission, type Role } from "@/lib/roles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function RolesCard() {
  const { roles, activeId, setActive, setRoles } = useRoles();
  const [newName, setNewName] = useState("");

  const updateRole = (id: string, patch: Partial<Role>) => {
    setRoles(roles.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };
  const updatePerm = (id: string, key: string, perm: Permission) => {
    const r = roles.find((x) => x.id === id);
    if (!r) return;
    updateRole(id, { permissions: { ...r.permissions, [key]: perm } });
  };
  const addRole = () => {
    if (!newName.trim()) return;
    const id = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36);
    const permissions = Object.fromEntries(MENU_KEYS.map((m) => [m.key, "view" as Permission]));
    setRoles([...roles, { id, name: newName.trim(), permissions }]);
    setNewName("");
    toast.success("Rol creado");
  };
  const delRole = (id: string) => {
    if (id === "admin") { toast.error("No se puede borrar Admin"); return; }
    setRoles(roles.filter((r) => r.id !== id));
    if (activeId === id) setActive("admin");
  };

  return (
    <Card className="mb-6 shadow-[var(--shadow-card)]">
      <CardContent className="p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg">Roles y permisos</h2>
          <p className="text-xs text-muted-foreground mt-1">Define qué opciones de la aplicación puede ver o editar cada rol.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Rol activo</Label>
            <Select value={activeId} onValueChange={setActive}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nuevo rol</Label>
              <Input placeholder="Ex: Recepción" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" onClick={addRole}><Plus className="h-4 w-4 mr-1" />Crear</Button>
          </div>
        </div>

        <div className="space-y-6">
          {roles.map((role) => (
            <div key={role.id} className="border border-border rounded-md p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <Input
                  value={role.name}
                  onChange={(e) => updateRole(role.id, { name: e.target.value })}
                  className="max-w-xs font-medium"
                  disabled={role.id === "admin"}
                />
                <button onClick={() => delRole(role.id)} className="text-muted-foreground hover:text-destructive" disabled={role.id === "admin"}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MENU_KEYS.map((m) => (
                  <div key={m.key} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-muted/30">
                    <span className="text-sm">{m.label}</span>
                    <Select
                      value={role.permissions[m.key] ?? "edit"}
                      onValueChange={(v) => updatePerm(role.id, m.key, v as Permission)}
                    >
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["edit", "view", "hidden"] as Permission[]).map((p) => (
                          <SelectItem key={p} value={p}>{permissionLabel(p)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export const Route = createFileRoute("/configuracion")({
  head: () => ({ meta: [{ title: "Configuración · fisioemocions" }] }),
  component: ConfigPage,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const WEEKDAY_LABELS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

function ConfigPage() {
  const { data: company } = useCompanySettings();
  const { data: templates } = useReminderTemplates();
  const { data: schedule } = useScheduleSettings();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [wa, setWa] = useState("");
  const [subj, setSubj] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("20:00");
  const [slot, setSlot] = useState("30");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState("");

  useEffect(() => {
    if (company) {
      setName(company.name || "");
      setLogo(company.logo_url ?? null);
    }
  }, [company]);
  useEffect(() => {
    if (templates) {
      setWa(templates.whatsapp || "");
      setSubj(templates.email_subject || "");
      setBody(templates.email_body || "");
    }
  }, [templates]);
  useEffect(() => {
    if (schedule) {
      setOpen(schedule.open);
      setClose(schedule.close);
      setSlot(String(schedule.slot_min));
      setWeekdays(schedule.weekdays);
      setHolidays(schedule.holidays);
    }
  }, [schedule]);

  const save = useMutation({
    mutationFn: async () => {
      const ts = new Date().toISOString();
      const { error: e1 } = await supabase.from("app_settings").upsert({
        key: "company", value: { name, logo_url: logo }, updated_at: ts,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("app_settings").upsert({
        key: "reminder_templates",
        value: { whatsapp: wa, email_subject: subj, email_body: body }, updated_at: ts,
      });
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("app_settings").upsert({
        key: "schedule",
        value: { open, close, slot_min: Number(slot) || 30, weekdays, holidays }, updated_at: ts,
      });
      if (e3) throw e3;
    },
    onSuccess: () => {
      toast.success("Configuración guardada");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500_000) { toast.error("Imagen demasiado grande (máx 500KB)"); return; }
    setLogo(await fileToDataUrl(f));
  };

  const toggleDay = (d: number) => {
    setWeekdays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    if (holidays.includes(newHoliday)) return;
    setHolidays([...holidays, newHoliday].sort());
    setNewHoliday("");
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1000px] mx-auto">
      <PageHeader title="Configuración" subtitle="Personaliza la marca, los mensajes y el calendario de explotación." />

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 space-y-5">
          <h2 className="font-display text-lg">Empresa</h2>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nombre de la empresa</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-md border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                {logo ? <img src={logo} alt="Logo" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
              <Button variant="secondary" type="button" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Subir imagen
              </Button>
              {logo && (
                <Button variant="ghost" type="button" onClick={() => setLogo(null)}>
                  <X className="h-4 w-4 mr-1" /> Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Recomendado: PNG/JPG cuadrado, &lt; 500KB.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 space-y-5">
          <h2 className="font-display text-lg">Horario de explotación</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Apertura</Label>
              <Input type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Cierre</Label>
              <Input type="time" value={close} onChange={(e) => setClose(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Duraciónn slot (min)</Label>
              <Input type="number" min="5" step="5" value={slot} onChange={(e) => setSlot(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Días laborables</Label>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAY_LABELS.map((lbl, d) => {
                const active = weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`h-9 w-12 rounded-md text-sm border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}
                  >{lbl}</button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Festivos y vacaciones</Label>
            <div className="flex gap-2 mb-3">
              <Input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} className="w-48" />
              <Button type="button" variant="secondary" onClick={addHoliday}><Plus className="h-4 w-4 mr-1" />Añadir</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {holidays.length === 0 && <span className="text-xs text-muted-foreground">Sin fechas añadidas.</span>}
              {holidays.map((h) => (
                <span key={h} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-sm">
                  {new Date(h + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  <button type="button" onClick={() => setHolidays(holidays.filter((x) => x !== h))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg">Mensajes de recordatorio</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Variables disponibles: <code className="bg-muted px-1 rounded">{"{name}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{date}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{time}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{company}"}</code>
            </p>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">WhatsApp</Label>
            <Textarea rows={4} value={wa} onChange={(e) => setWa(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Asunto del correo</Label>
            <Input value={subj} onChange={(e) => setSubj(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Cuerpo del correo</Label>
            <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <ProfilesCard />

      <IgiRatesCard />

      <RolesCard />

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Guardar cambios</Button>
      </div>
    </div>
  );
}

function ProfilesCard() {
  const { data: profiles = [] } = useProfiles();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", default_rate: "" });
  const [edits, setEdits] = useState<Record<string, string>>({});

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.default_rate) throw new Error("Nombre y tarifa requeridos");
      const { error } = await supabase.from("client_profiles").insert({
        name: form.name,
        default_rate: Number(form.default_rate),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil creado");
      qc.invalidateQueries({ queryKey: ["profiles"] });
      setForm({ name: "", default_rate: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: number }) => {
      const { error } = await supabase.from("client_profiles").update({ default_rate: rate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tarifa actualizada");
      qc.invalidateQueries({ queryKey: ["profiles"] });
      setEdits({});
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mb-6 shadow-[var(--shadow-card)]">
      <CardContent className="p-6 space-y-5">
        <div>
          <h2 className="font-display text-lg">Perfiles y tarifas de pacientes</h2>
          <p className="text-xs text-muted-foreground mt-1">Define los perfiles (CASS, Privado...) y la tarifa por defecto que se aplicará a las visitas.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nombre del perfil</Label>
            <Input placeholder="Ex: CASS 1, Privat..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Tarifa por defecto (€)</Label>
            <Input type="number" step="0.01" value={form.default_rate} onChange={(e) => setForm({ ...form, default_rate: e.target.value })} />
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending} className="md:col-span-2 h-10">
            <Plus className="h-4 w-4 mr-1" /> Crear
          </Button>
        </div>
        {profiles.length > 0 && (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Perfil</th>
                  <th className="px-4 py-2 font-medium text-right">Tarifa</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const editing = edits[p.id] !== undefined;
                  return (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-accent/10 text-accent">{p.name}</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {editing ? (
                          <Input type="number" step="0.01" value={edits[p.id]}
                            onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })}
                            className="w-28 ml-auto text-right h-8" />
                        ) : (
                          <span className="tabular-nums font-medium">{eur(Number(p.default_rate))}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                        {editing ? (
                          <Button size="sm" variant="default" onClick={() => update.mutate({ id: p.id, rate: Number(edits[p.id]) })}>
                            <Save className="h-3.5 w-3.5 mr-1" /> Guardar
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setEdits({ ...edits, [p.id]: String(p.default_rate) })}>
                            Editar
                          </Button>
                        )}
                        <button onClick={() => del.mutate(p.id)} className="text-muted-foreground hover:text-destructive align-middle">
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
