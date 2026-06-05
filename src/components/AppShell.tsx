import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, Stethoscope, Package, Receipt, Activity, ClipboardList, CalendarDays, UserPlus, BarChart3, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Panel", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/recordatorios", label: "Recordatoris", icon: BellRing },
  { to: "/pacientes", label: "Pacients", icon: UserPlus },
  { to: "/visitas", label: "Visites", icon: Stethoscope },
  { to: "/material", label: "Material", icon: Package },
  { to: "/inventario", label: "Inventari", icon: ClipboardList },
  { to: "/consumo", label: "Consum mensual", icon: BarChart3 },
  { to: "/gastos", label: "Despeses", icon: Receipt },
  { to: "/perfiles", label: "Perfils & Tarifes", icon: Users },
] as const;

export function AppShell() {
  const { location } = useRouterState();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="px-6 py-7 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-md bg-sidebar-primary/15 flex items-center justify-center">
              <Activity className="h-5 w-5 text-sidebar-primary" strokeWidth={2.2} />
            </div>
            <div>
              <div className="font-display text-xl leading-none">fisioemocions</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-sidebar-foreground/55 mt-1">
                Centre de fisioteràpia
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-5 space-y-1">
          {nav.map((n) => {
            const active = location.pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary font-medium"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-6 py-4 text-[11px] text-sidebar-foreground/45 border-t border-sidebar-border">
          v1.0 · Gestió interna
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
