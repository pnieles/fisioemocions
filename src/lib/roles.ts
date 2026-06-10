import { useSyncExternalStore } from "react";

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
  { key: "material", label: "Material" },
  { key: "inventario", label: "Inventario" },
  { key: "consumo", label: "Consumo mensual" },
  { key: "gastos", label: "Gastos" },
  { key: "configuracion", label: "Configuración" },
] as const;

export type MenuKey = (typeof MENU_KEYS)[number]["key"];

const STORAGE_ROLES = "fe.roles.v1";
const STORAGE_ACTIVE = "fe.activeRole.v1";

function allPerms(p: Permission): Record<string, Permission> {
  return Object.fromEntries(MENU_KEYS.map((m) => [m.key, p]));
}

const DEFAULT_ROLES: Role[] = [
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
      configuracion: "hidden",
      gastos: "hidden",
      inicio: "hidden",
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
    },
  },
];

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

function readRoles(): Role[] {
  if (typeof window === "undefined") return DEFAULT_ROLES;
  try {
    const raw = localStorage.getItem(STORAGE_ROLES);
    if (!raw) return DEFAULT_ROLES;
    const parsed = JSON.parse(raw) as Role[];
    return parsed.map((r) => ({
      ...r,
      permissions: { ...allPerms("edit"), ...r.permissions },
    }));
  } catch {
    return DEFAULT_ROLES;
  }
}
function writeRoles(r: Role[]) {
  localStorage.setItem(STORAGE_ROLES, JSON.stringify(r));
  emit();
}
function readActive(): string {
  if (typeof window === "undefined") return "admin";
  return localStorage.getItem(STORAGE_ACTIVE) || "admin";
}
function writeActive(id: string) {
  localStorage.setItem(STORAGE_ACTIVE, id);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = () => l();
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

export function useRoles() {
  const roles = useSyncExternalStore(subscribe, readRoles, () => DEFAULT_ROLES);
  const activeId = useSyncExternalStore(subscribe, readActive, () => "admin");
  const active = roles.find((r) => r.id === activeId) ?? roles[0] ?? DEFAULT_ROLES[0];
  return {
    roles,
    activeId,
    active,
    setActive: writeActive,
    setRoles: writeRoles,
    can: (key: MenuKey): Permission => active?.permissions[key] ?? "edit",
  };
}

export function permissionLabel(p: Permission) {
  return p === "edit" ? "Editar" : p === "view" ? "Ver" : "Oculto";
}
