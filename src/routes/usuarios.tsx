import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, KeyRound, UserPlus2 } from "lucide-react";
import { toast } from "sonner";
import { RolesCard } from "@/components/RolesCard";
import { useRoles } from "@/lib/roles";
import {
  listAppUsers,
  createAppUser,
  updateAppUserRole,
  updateAppUserPassword,
  deleteAppUser,
} from "@/lib/users.functions";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [{ title: "Usuarios · fisioemocions" }] }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const { roles } = useRoles();
  const qc = useQueryClient();
  const listFn = useServerFn(listAppUsers);
  const createFn = useServerFn(createAppUser);
  const updRole = useServerFn(updateAppUserRole);
  const updPass = useServerFn(updateAppUserPassword);
  const delFn = useServerFn(deleteAppUser);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["app_users"],
    queryFn: () => listFn(),
  });

  const [form, setForm] = useState({ email: "", password: "", role_id: roles[0]?.id ?? "admin" });
  const [passInputs, setPassInputs] = useState<Record<string, string>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["app_users"] });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.email || form.password.length < 6) throw new Error("Correo válido y contraseña de mínimo 6 caracteres");
      await createFn({ data: form });
    },
    onSuccess: () => {
      toast.success("Usuario creado");
      setForm({ email: "", password: "", role_id: roles[0]?.id ?? "admin" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeRole = useMutation({
    mutationFn: async (v: { user_id: string; role_id: string }) => { await updRole({ data: v }); },
    onSuccess: () => { toast.success("Rol actualizado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePass = useMutation({
    mutationFn: async (v: { user_id: string; password: string }) => {
      if (v.password.length < 6) throw new Error("Mínimo 6 caracteres");
      await updPass({ data: v });
    },
    onSuccess: (_d, v) => {
      toast.success("Contraseña actualizada");
      setPassInputs((s) => ({ ...s, [v.user_id]: "" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (user_id: string) => { await delFn({ data: { user_id } }); },
    onSuccess: () => { toast.success("Usuario eliminado"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-[1100px] mx-auto">
      <PageHeader title="Usuarios" subtitle="Alta de cuentas, contraseñas y asignación de roles." />

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg">Nuevo usuario</h2>
            <p className="text-xs text-muted-foreground mt-1">Crea una cuenta con correo, contraseña y rol.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Correo</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="md:col-span-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Contraseña</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Rol</Label>
              <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="md:col-span-2 h-10">
              <UserPlus2 className="h-4 w-4 mr-1" /> Crear
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 space-y-4">
          <h2 className="font-display text-lg">Usuarios existentes</h2>
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!isLoading && users.length === 0 && <p className="text-sm text-muted-foreground">No hay usuarios registrados.</p>}
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.user_id} className="border border-border rounded-md p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-4">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Correo</Label>
                  <div className="text-sm font-medium truncate">{u.email}</div>
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Rol</Label>
                  <Select
                    value={u.role_id}
                    onValueChange={(v) => changeRole.mutate({ user_id: u.user_id, role_id: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nueva contraseña</Label>
                  <Input
                    type="password"
                    value={passInputs[u.user_id] ?? ""}
                    onChange={(e) => setPassInputs((s) => ({ ...s, [u.user_id]: e.target.value }))}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => changePass.mutate({ user_id: u.user_id, password: passInputs[u.user_id] ?? "" })}
                    disabled={changePass.isPending}
                    className="flex-1"
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { if (confirm(`¿Eliminar ${u.email}?`)) remove.mutate(u.user_id); }}
                    disabled={remove.isPending}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <RolesCard />
    </div>
  );
}
