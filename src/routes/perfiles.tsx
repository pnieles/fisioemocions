import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfiles } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eur } from "@/lib/format";
import { toast } from "sonner";
import { Trash2, Plus, Save } from "lucide-react";

export const Route = createFileRoute("/perfiles")({
  head: () => ({ meta: [{ title: "Perfils · fisioemocions" }] }),
  component: ProfilesPage,
});

function ProfilesPage() {
  const { data: profiles = [] } = useProfiles();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", default_rate: "" });
  const [edits, setEdits] = useState<Record<string, string>>({});

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.default_rate) throw new Error("Nom i tarifa requerits");
      const { error } = await supabase.from("client_profiles").insert({
        name: form.name,
        default_rate: Number(form.default_rate),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil creat");
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
      toast.success("Tarifa actualitzada");
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
      toast.success("Eliminat");
      qc.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-10 py-8 max-w-[1100px] mx-auto">
      <PageHeader title="Perfils i tarifes" subtitle="Defineix els perfils de client i les tarifes per defecte que s'aplicaran a les visites." />

      <Card className="mb-8 shadow-[var(--shadow-card)]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-6">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nom del perfil *</Label>
              <Input placeholder="Ex: CASS 1, Privado..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="md:col-span-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Tarifa per defecte (€) *</Label>
              <Input type="number" step="0.01" value={form.default_rate} onChange={(e) => setForm({ ...form, default_rate: e.target.value })} />
            </div>
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="md:col-span-2 h-10">
              <Plus className="h-4 w-4 mr-1" /> Crear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-display text-lg">Perfils existents</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Perfil</th>
                <th className="px-6 py-3 font-medium text-right">Tarifa per defecte</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const editing = edits[p.id] !== undefined;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-3 font-medium">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-accent/10 text-accent">{p.name}</span>
                    </td>
                    <td className="px-6 py-3 text-right">
                      {editing ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={edits[p.id]}
                          onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })}
                          className="w-32 ml-auto text-right"
                        />
                      ) : (
                        <span className="tabular-nums font-medium">{eur(Number(p.default_rate))}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right space-x-2">
                      {editing ? (
                        <Button size="sm" variant="default" onClick={() => update.mutate({ id: p.id, rate: Number(edits[p.id]) })}>
                          <Save className="h-3.5 w-3.5 mr-1" /> Desar
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
        </CardContent>
      </Card>
    </div>
  );
}
