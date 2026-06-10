import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Stethoscope, Package, Receipt, Activity, ClipboardList, CalendarDays, UserPlus, BarChart3, BellRing, Settings as SettingsIcon, Boxes, FileBarChart, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useCompanySettings } from "@/lib/data-hooks";
import { useRoles, type MenuKey } from "@/lib/roles";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; key: MenuKey };
type NavGroup = { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

const nav: NavEntry[] = [
  { to: "/", label: "Resultados Explotación", icon: LayoutDashboard, key: "inicio" },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, key: "agenda" },
  { to: "/recordatorios", label: "Recordatorios", icon: BellRing, key: "recordatorios" },
  { to: "/pacientes", label: "Pacientes", icon: UserPlus, key: "pacientes" },
  { to: "/visitas", label: "Visitas", icon: Stethoscope, key: "visitas" },
  { to: "/informes", label: "Informes visitas", icon: FileBarChart, key: "informes" },
  {
    label: "Consumibles",
    icon: Boxes,
    children: [
      { to: "/material", label: "Material", icon: Package, key: "material" },
      { to: "/inventario", label: "Inventario", icon: ClipboardList, key: "inventario" },
      { to: "/consumo", label: "Consumo mensual", icon: BarChart3, key: "consumo" },
    ],
  },
  { to: "/gastos", label: "Gastos", icon: Receipt, key: "gastos" },
  { to: "/configuracion", label: "Configuración", icon: SettingsIcon, key: "configuracion" },
];

export function AppShell() {
  const { location } = useRouterState();
  const { data: company } = useCompanySettings();
  const { can, active } = useRoles();
  const companyName = company?.name || "fisioemocions";
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const filteredNav = nav.flatMap<NavEntry>((entry) => {
    if ("children" in entry) {
      const kids = entry.children.filter((c) => can(c.key) !== "hidden");
      return kids.length ? [{ ...entry, children: kids }] : [];
    }
    return can(entry.key) === "hidden" ? [] : [entry];
  });

  const SidebarContent = (
    <>
      <div className="px-6 py-6 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {company?.logo_url ? (
            <img src={company.logo_url} alt={companyName} className="h-9 w-9 shrink-0 rounded-md object-cover bg-sidebar-primary/10" />
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-md bg-sidebar-primary/15 flex items-center justify-center">
              <Activity className="h-5 w-5 text-sidebar-primary" strokeWidth={2.2} />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-display text-xl leading-none truncate">{companyName}</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/55 mt-1 truncate">
              {active?.name ? `Rol: ${active.name}` : "Centro de fisioterapia"}
            </div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-sidebar-foreground/70 hover:text-sidebar-foreground p-1">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {filteredNav.map((entry, idx) => {
          if ("children" in entry) {
            const Icon = entry.icon;
            const anyActive = entry.children.some((c) => location.pathname === c.to);
            return (
              <div key={`g-${idx}`} className="pt-2">
                <div className={cn(
                  "flex items-center gap-3 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]",
                  anyActive ? "text-sidebar-primary" : "text-sidebar-foreground/50",
                )}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {entry.label}
                </div>
                <div className="space-y-0.5 mt-1">
                  {entry.children.map((c) => {
                    const active = location.pathname === c.to;
                    const CI = c.icon;
                    return (
                      <Link key={c.to} to={c.to} className={cn(
                        "flex items-center gap-3 pl-8 pr-3 py-2 rounded-md text-sm transition-colors",
                        active ? "bg-sidebar-accent text-sidebar-primary font-medium" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                      )}>
                        <CI className="h-4 w-4" strokeWidth={2} />
                        {c.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }
          const active = location.pathname === entry.to;
          const Icon = entry.icon;
          return (
            <Link
              key={entry.to}
              to={entry.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {entry.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 text-[11px] text-sidebar-foreground/45 border-t border-sidebar-border">
        v1.0 · Gestión interna
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-sidebar text-sidebar-foreground flex flex-col shadow-xl">
            {SidebarContent}
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-x-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
          <button onClick={() => setOpen(true)} className="p-2 -ml-2 text-foreground" aria-label="Menú">
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-display text-base truncate">{companyName}</div>
          <div className="w-9" />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
