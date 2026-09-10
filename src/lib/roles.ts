import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export type Permission = "hidden" | "view" | "edit";

export type Role = {
  id: string;
  name: string;
  permissions: Record<string, Permission>;
};

export const MENU_KEYS = [
  { key: "inicio", label: "Resultados Explotación" },
  { key: "agenda", label: "Agenda" },
  { key: "recordatorios", label: "Recordatorios" },
  { key: "pacientes", label: "Pacientes" },
  { key: "visitas", label: "Visitas" },
  { key: "informes", label: "Informes visitas" },
  { key: "facturas", label: "Facturas" },
  { key: "material", label: "Material" },
  { key: "inventario", label: "Inventario" },
  { key: "consumo", label: "Consumo mensual" },
  { key: "gastos", label: "Gastos" },
  { key: "usuarios", label: "Usuarios" },
  { key: "configuracion", label: "Configuración" },
] as const;

export type MenuKey = (typeof MENU_KEYS)[number]["key"];

function allPerms(p: Permission): Record<string, Permission> {
  return Object.fromEntries(MENU_KEYS.map((m) => [m.key, p]));
}

// Fallback used only before the "roles" row in app_settings has loaded (or
// for a brand-new project where the seed migration hasn't run yet).
export const DEFAULT_ROLES: Role[] = [
  { id: "admin", name: "Admin", permissions: allPerms("edit") },
  {
    id: "secretaria",
    name: "Secretaría",
    permissions: {
      ...allPerms("view"),
      agenda: "edit",
      recordatorios: "edit",
      pacientes: "edit",
      visitas: "edit",
      facturas: "edit",
      configuracion: "hidden",
      gastos: "hidden",
      inicio: "hidden",
      material: "hidden",
      inventario: "hidden",
      consumo: "hidden",
      usuarios: "hidden",
    },
  },
  {
    id: "fisio",
    name: "Fisio",
    permissions: {
      ...allPerms("view"),
      agenda: "edit",
      pacientes: "edit",
      visitas: "edit",
      informes: "view",
      gastos: "hidden",
      configuracion: "hidden",
      material: "hidden",
      inventario: "hidden",
      consumo: "hidden",
      usuarios: "hidden",
    },
  },
];

// Role/permission definitions live in app_settings so every device and user
// sees the same menu — a localStorage-only version meant each browser could
// define its own roles independently, which made the setting meaningless.
export function useRoleDefinitions() {
  return useQuery({
    queryKey: ["settings", "roles"],
    queryFn: async (): Promise<Role[]> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "roles")
        .maybeSingle();
      if (error) throw error;
      const parsed = data?.value as Role[] | undefined;
      if (!parsed || parsed.length === 0) return DEFAULT_ROLES;
      return parsed.map((r) => ({ ...r, permissions: { ...allPerms("edit"), ...r.permissions } }));
    },
  });
}

// The active role is no longer a manual local switch: it is whatever
// role_id is assigned to the signed-in account in app_users, so access
// actually follows who is logged in rather than a per-browser toggle.
export function useMyAppUser() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ["my_app_user", userId],
    enabled: !!userId,
    queryFn: async (): Promise<{ role_id: string; email: string } | null> => {
      const { data, error } = await supabase
        .from("app_users")
        .select("role_id,email")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRoles() {
  const { data: roles = DEFAULT_ROLES } = useRoleDefinitions();
  const { data: me } = useMyAppUser();
  const qc = useQueryClient();

  const activeId = me?.role_id ?? "admin";
  const active = roles.find((r) => r.id === activeId) ?? roles[0] ?? DEFAULT_ROLES[0];

  const saveRoles = useMutation({
    mutationFn: async (next: Role[]) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "roles", value: next, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "roles"] }),
  });

  return {
    roles,
    activeId,
    active,
    myEmail: me?.email ?? null,
    setRoles: (next: Role[]) => saveRoles.mutate(next),
    can: (key: MenuKey): Permission => active?.permissions[key] ?? "edit",
  };
}

export function permissionLabel(p: Permission) {
  return p === "edit" ? "Editar" : p === "view" ? "Ver" : "Oculto";
}
