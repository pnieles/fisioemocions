import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePatients, useProfiles, useIgiRates, type Patient } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, Plus, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/pacientes")({
  head: () => ({ meta: [{ title: "Pacientes · fisioemocions" }] }),
  component: PatientsPage,
});

type FormState = {
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string;
  email: string;
  notes: string;
  passport_id: string;
  default_profile_id: string;
  patient_type: string;
  wants_invoice: boolean;
  igi_rate_id: string;
  cass_coverage: string;
};

const empty: FormState = {
  first_name: "", last_name: "", birth_date: "",
  phone: "+376 ", email: "", notes: "",
  passport_id: "", default_profile_id: "",
  patient_type: "", wants_invoice: false, igi_rate_id: "", cass_coverage: "",
};

function ageOf(birth: string | null) {
  if (!birth) return "—";
  const d = new Date(birth);
  const diff = Date.now() - d.getTime();
  return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function PatientsPage() {
  const { data: patients = [] } = usePatients();
  const { data: profiles = [] } = useProfiles();
  const { data: igiRates = [] } = useIgiRates();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name || !form.last_name) throw new Error("Nombre y apellidos obligatorios");
      const cleanPhone = form.phone.replace(/[\s+\-]/g, "");
      const hasPhone = cleanPhone.length > 0;
      const hasEmail = form.email.trim().length > 0;
      if (!hasPhone && !hasEmail) {
        throw new Error("Hay que rellenar teléfono o correo electrónico para poder enviar avisos");
      }
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        birth_date: form.birth_date || null,
        phone: hasPhone ? form.phone.trim() : null,
        email: hasEmail ? form.email.trim() : null,
        notes: form.notes || null,
        passport_id: form.passport_id || null,
        default_profile_id: form.default_profile_id || null,
        patient_type: form.patient_type || null,
        wants_invoice: form.wants_invoice,
        igi_rate_id: form.igi_rate_id || null,
        cass_coverage: form.cass_coverage === "" ? null : Number(form.cass_coverage),
      };
      if (editing) {
        const { error } = await supabase.from("patients").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("patients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Paciente actualizado" : "Paciente añadido");
      qc.invalidateQueries({ queryKey: ["patients"] });
      setForm(empty); setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paciente eliminado");
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });

  const startEdit = (p: Patient) => {
    setEditing(p.id);
    setForm({
      first_name: p.first_name, last_name: p.last_name,
      birth_date: p.birth_date ?? "",
      phone: p.phone ?? "+376 ", email: p.email ?? "", notes: p.notes ?? "",
      passport_id: p.passport_id ?? "",
      default_profile_id: p.default_profile_id ?? "",
      patient_type: p.patient_type ?? "",
      wants_invoice: !!p.wants_invoice,
      igi_rate_id: p.igi_rate_id ?? "",
      cass_coverage: p.cass_coverage == null ? "" : String(p.cass_coverage),
    });
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Pacientes" subtitle="Ficha de contacto y datos de facturación." />

      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <Field className="md:col-span-3" label="Nombre *">
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Field>
            <Field className="md:col-span-3" label="Apellidos *">
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Fecha nacimiento">
              <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Teléfono (WhatsApp)">
              <Input placeholder="+376 ..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Censo / Pasaporte">
              <Input value={form.passport_id} onChange={(e) => setForm({ ...form, passport_id: e.target.value })} />
            </Field>
            <Field className="md:col-span-4" label="Correo electrónico">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>

            <Field className="md:col-span-2" label="Tipo de paciente">
              <Select value={form.patient_type || "__none"} onValueChange={(v) => setForm({ ...form, patient_type: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Sin definir —</SelectItem>
                  <SelectItem value="cass">CASS</SelectItem>
                  <SelectItem value="privado">Privado</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-3" label="Perfil (tarifa)">
              <Select value={form.default_profile_id || "__none"} onValueChange={(v) => setForm({ ...form, default_profile_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Ninguno —</SelectItem>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-2" label="IGI aplicable">
              <Select value={form.igi_rate_id || "__none"} onValueChange={(v) => setForm({ ...form, igi_rate_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Ninguno —</SelectItem>
                  {igiRates.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {form.patient_type === "cass" && (
              <Field className="md:col-span-2" label="Cobertura CASS (%)">
                <Input type="number" step="0.01" value={form.cass_coverage} onChange={(e) => setForm({ ...form, cass_coverage: e.target.value })} />
              </Field>
            )}
            <div className="md:col-span-2 flex items-center gap-2 pb-1">
              <Checkbox
                id="wants_invoice"
                checked={form.wants_invoice}
                onCheckedChange={(v) => setForm({ ...form, wants_invoice: Boolean(v) })}
              />
              <Label htmlFor="wants_invoice" className="text-sm">¿Desea factura?</Label>
            </div>

            <Field className="md:col-span-9" label="Notas">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="md:col-span-3 flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1 h-10">
                <Plus className="h-4 w-4 mr-1" /> {editing ? "Guardar" : "Añadir"}
              </Button>
              {editing && (
                <Button variant="ghost" onClick={() => { setEditing(null); setForm(empty); }}>Cancelar</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg">Fichas de pacientes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{patients.length} pacientes registrados</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-6 py-3 font-medium">Paciente</th>
                  <th className="px-6 py-3 font-medium">Tipo</th>
                  <th className="px-6 py-3 font-medium">Edad</th>
                  <th className="px-6 py-3 font-medium">Contacto</th>
                  <th className="px-6 py-3 font-medium">Factura</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {patients.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Aún no hay pacientes.</td></tr>
                )}
                {patients.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">{p.last_name}, {p.first_name}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {p.patient_type === "cass" ? "CASS" : p.patient_type === "privado" ? "Privado" : "—"}
                    </td>
                    <td className="px-6 py-3 tabular-nums">{ageOf(p.birth_date)}</td>
                    <td className="px-6 py-3 text-xs space-y-1">
                      {p.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{p.phone}</div>}
                      {p.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{p.email}</div>}
                    </td>
                    <td className="px-6 py-3 text-xs">
                      {p.wants_invoice ? <span className="text-primary font-medium">Sí</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => startEdit(p)} className="text-xs text-accent hover:underline">Editar</button>
                      <button onClick={() => del.mutate(p.id)} className="text-muted-foreground hover:text-destructive inline-block align-middle">
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
