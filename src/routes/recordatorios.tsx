import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAppointments, usePatients, useCompanySettings, useReminderTemplates } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Mail, Check, BellRing } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/recordatorios")({
  head: () => ({ meta: [{ title: "Recordatoris · fisioemocions" }] }),
  component: ReminderPage,
});

function applyVars(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function digitsOnly(phone: string) {
  return phone.replace(/[^\d]/g, "");
}


function ReminderPage() {
  const { data: appts = [] } = useAppointments();
  const { data: patients = [] } = usePatients();
  const { data: company } = useCompanySettings();
  const { data: tpl } = useReminderTemplates();
  const qc = useQueryClient();
  const [windowHours, setWindowHours] = useState("36");

  const markSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recordatori marcat com a enviat");
      qc.invalidateQueries({ queryKey: ["appointments"] });
    },
  });

  const upcoming = useMemo(() => {
    const now = Date.now();
    const max = now + Number(windowHours) * 3600 * 1000;
    return appts
      .filter((a) => a.status === "scheduled")
      .filter((a) => {
        const t = new Date(a.appointment_at).getTime();
        return t >= now && t <= max;
      })
      .sort((a, b) => new Date(a.appointment_at).getTime() - new Date(b.appointment_at).getTime());
  }, [appts, windowHours]);

  const patientOf = (id: string | null) => patients.find((p) => p.id === id);

  return (
    <div className="px-10 py-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Recordatoris de cita"
        subtitle="Cites pendents dins la finestra escollida. Prepara missatges via WhatsApp (wa.me) o correu i marca'ls com a enviats."
        actions={
          <Select value={windowHours} onValueChange={setWindowHours}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24">Pròximes 24h</SelectItem>
              <SelectItem value="36">Pròximes 36h</SelectItem>
              <SelectItem value="48">Pròximes 48h</SelectItem>
              <SelectItem value="168">Pròxima setmana</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <Card className="shadow-[var(--shadow-card)]">
        <CardContent className="p-0">
          {upcoming.length === 0 && (
            <div className="px-6 py-16 text-center text-muted-foreground">
              <BellRing className="h-8 w-8 mx-auto mb-3 opacity-40" />
              No hi ha cites pendents dins d'aquesta finestra.
            </div>
          )}
          {upcoming.map((a) => {
            const p = patientOf(a.patient_id);
            const when = new Date(a.appointment_at);
            const name = p ? p.first_name : "pacient";
            const fullName = p ? `${p.last_name}, ${p.first_name}` : "—";
            const vars = {
              name,
              company: company?.name || "fisioemocions",
              date: when.toLocaleDateString("ca-ES", { weekday: "long", day: "numeric", month: "long" }),
              time: when.toLocaleTimeString("ca-ES", { hour: "2-digit", minute: "2-digit" }),
            };
            const waMsg = applyVars(tpl?.whatsapp || "", vars);
            const emailSubject = applyVars(tpl?.email_subject || "", vars);
            const emailBody = applyVars(tpl?.email_body || "", vars);
            const wa = p?.phone
              ? `https://wa.me/${digitsOnly(p.phone)}?text=${encodeURIComponent(waMsg)}`
              : null;
            const mailto = p?.email
              ? `mailto:${p.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
              : null;

            return (
              <div key={a.id} className="px-6 py-5 border-t border-border first:border-t-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-3">
                  <div className="font-medium">{fullName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {when.toLocaleString("ca-ES", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="md:col-span-5 text-sm text-muted-foreground bg-muted/40 rounded-md p-3 leading-relaxed whitespace-pre-wrap">
                  {waMsg}
                </div>
                <div className="md:col-span-3 flex flex-wrap gap-2">
                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="secondary"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</Button>
                    </a>
                  ) : (
                    <Button size="sm" variant="secondary" disabled title="Sense telèfon"><MessageCircle className="h-4 w-4 mr-1" /> WhatsApp</Button>
                  )}
                  {mailto ? (
                    <a href={mailto}>
                      <Button size="sm" variant="secondary"><Mail className="h-4 w-4 mr-1" /> Correu</Button>
                    </a>
                  ) : (
                    <Button size="sm" variant="secondary" disabled title="Sense correu"><Mail className="h-4 w-4 mr-1" /> Correu</Button>
                  )}
                </div>
                <div className="md:col-span-1 text-right">
                  {a.reminder_sent_at ? (
                    <span className="inline-flex items-center gap-1 text-xs text-success">
                      <Check className="h-3 w-3" /> Enviat
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => markSent.mutate(a.id)}>Marcar</Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
