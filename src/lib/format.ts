export const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n || 0);

export const pct = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(n || 0);

export const fmtDate = (d: string | Date) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));

export const todayISO = () => new Date().toISOString().slice(0, 10);
