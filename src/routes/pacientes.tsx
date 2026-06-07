import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePatients, useTreatments, type Patient } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus, Phone, Mail } from "lucide-react";

export const Route = createFileRoute("/pacientes")({
  head: () => ({ meta: [{ title: "Pacients · fisioemocions" }] }),
  component: PatientsPage,
});

type FormState = {
  first_name: string;
  last_name: string;
  nationality: string;
  birth_date: string;
  phone: string;
  email: string;
  notes: string;
  default_treatment: string;
};

const empty: FormState = {
  first_name: "", last_name: "", nationality: "", birth_date: "",
  phone: "", email: "", notes: "", default_treatment: "",
};

function ageOf(birth: string | null) {
  if (!birth) return "—";
  const d = new Date(birth);
  const diff = Date.now() - d.getTime();
  return String(Math.floor(diff / (365.25 * 24 * 3600 * 1000)));
}

function PatientsPage() {
  const { data: patients = [] } = usePatients();
  const { data: treatments = [] } = useTreatments();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const [editing, setEditing] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.first_name || !form.last_name) throw new Error("Nom i cognoms obligatoris");
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        nationality: form.nationality || null,
        birth_date: form.birth_date || null,
        phone: form.phone || null,
        email: form.email || null,
        notes: form.notes || null,
        default_treatment: form.default_treatment || null,
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
      toast.success(editing ? "Pacient actualitzat" : "Pacient afegit");
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
      toast.success("Pacient eliminat");
      qc.invalidateQueries({ queryKey: ["patients"] });
    },
  });

  const startEdit = (p: Patient) => {
    setEditing(p.id);
    setForm({
      first_name: p.first_name, last_name: p.last_name,
      nationality: p.nationality ?? "", birth_date: p.birth_date ?? "",
      phone: p.phone ?? "", email: p.email ?? "", notes: p.notes ?? "",
      default_treatment: p.default_treatment ?? "",
    });
  };


  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      <PageHeader title="Pacients" subtitle="Fitxa de contacte amb dades per a avisos via WhatsApp i correu." />

      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <Field className="md:col-span-3" label="Nom *">
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </Field>
            <Field className="md:col-span-3" label="Cognoms *">
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Nacionalitat">
              <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Data naixement">
              <Input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </Field>
            <Field className="md:col-span-2" label="Telèfon (WhatsApp)">
              <Input placeholder="+34 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field className="md:col-span-4" label="Correu electrònic">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field className="md:col-span-3" label="Tractament per defecte">
              <Select value={form.default_treatment || "__none"} onValueChange={(v) => setForm({ ...form, default_treatment: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Cap" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Cap —</SelectItem>
                  {treatments.map((t) => (
                    <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field className="md:col-span-3" label="Notes">
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="md:col-span-2 flex gap-2">
              <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1 h-10">
                <Plus className="h-4 w-4 mr-1" /> {editing ? "Desar" : "Afegir"}
              </Button>
              {editing && (
                <Button variant="ghost" onClick={() => { setEditing(null); setForm(empty); }}>Cancel·la</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg">Fitxes de pacients</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{patients.length} pacients registrats</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="text-left">
                  <th className="px-6 py-3 font-medium">Pacient</th>
                  <th className="px-6 py-3 font-medium">Nacionalitat</th>
                  <th className="px-6 py-3 font-medium">Edat</th>
                  <th className="px-6 py-3 font-medium">Contacte</th>
                  <th className="px-6 py-3 font-medium">Notes</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {patients.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">Encara no hi ha pacients.</td></tr>
                )}
                {patients.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">{p.last_name}, {p.first_name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{p.nationality ?? "—"}</td>
                    <td className="px-6 py-3 tabular-nums">{ageOf(p.birth_date)}</td>
                    <td className="px-6 py-3 text-xs space-y-1">
                      {p.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{p.phone}</div>}
                      {p.email && <div className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{p.email}</div>}
                    </td>
                    <td className="px-6 py-3 text-muted-foreground text-xs max-w-xs truncate">{p.notes ?? ""}</td>
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
