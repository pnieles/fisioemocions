import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRoles, MENU_KEYS, permissionLabel, type Permission, type Role } from "@/lib/roles";

export function RolesCard() {
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
