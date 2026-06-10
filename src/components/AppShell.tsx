import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Stethoscope, Package, Receipt, Activity, ClipboardList, CalendarDays, UserPlus, BarChart3, BellRing, Settings as SettingsIcon, Boxes, FileBarChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCompanySettings } from "@/lib/data-hooks";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> };
type NavGroup = { label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

const nav: NavEntry[] = [
  { to: "/", label: "Resultados Explotación", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/recordatorios", label: "Recordatorios", icon: BellRing },
  { to: "/pacientes", label: "Pacientees", icon: UserPlus },
  { to: "/visitas", label: "Visitas", icon: Stethoscope },
  { to: "/informes", label: "Informes visitas", icon: FileBarChart },
  {
    label: "Consumibles",
    icon: Boxes,
    children: [
      { to: "/material", label: "Material", icon: Package },
      { to: "/inventario", label: "Inventario", icon: ClipboardList },
      { to: "/consumo", label: "Consumo mensual", icon: BarChart3 },
    ],
  },
  { to: "/gastos", label: "Gastos", icon: Receipt },
  { to: "/configuracion", label: "Configuración", icon: SettingsIcon },
];

export function AppShell() {
  const { location } = useRouterState();
  const { data: company } = useCompanySettings();
  const companyName = company?.name || "fisioemocions";
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            {company?.logo_url ? (
              <img src={company.logo_url} alt={companyName} className="h-9 w-9 rounded-md object-cover bg-sidebar-primary/10" />
            ) : (
              <div className="h-9 w-9 rounded-md bg-sidebar-primary/15 flex items-center justify-center">
                <Activity className="h-5 w-5 text-sidebar-primary" strokeWidth={2.2} />
              </div>
            )}
            <div>
              <div className="font-display text-xl leading-none">{companyName}</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/55 mt-1">
                Centro de fisioterapia
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1">
          {nav.map((entry, idx) => {
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
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
