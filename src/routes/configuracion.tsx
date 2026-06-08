import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings, useReminderTemplates, useScheduleSettings } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/configuracion")({
  head: () => ({ meta: [{ title: "Configuració · fisioemocions" }] }),
  component: ConfigPage,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

const WEEKDAY_LABELS = ["Dg", "Dl", "Dt", "Dc", "Dj", "Dv", "Ds"];

function ConfigPage() {
  const { data: company } = useCompanySettings();
  const { data: templates } = useReminderTemplates();
  const { data: schedule } = useScheduleSettings();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [wa, setWa] = useState("");
  const [subj, setSubj] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState("09:00");
  const [close, setClose] = useState("20:00");
  const [slot, setSlot] = useState("30");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState("");

  useEffect(() => {
    if (company) {
      setName(company.name || "");
      setLogo(company.logo_url ?? null);
    }
  }, [company]);
  useEffect(() => {
    if (templates) {
      setWa(templates.whatsapp || "");
      setSubj(templates.email_subject || "");
      setBody(templates.email_body || "");
    }
  }, [templates]);
  useEffect(() => {
    if (schedule) {
      setOpen(schedule.open);
      setClose(schedule.close);
      setSlot(String(schedule.slot_min));
      setWeekdays(schedule.weekdays);
      setHolidays(schedule.holidays);
    }
  }, [schedule]);

  const save = useMutation({
    mutationFn: async () => {
      const ts = new Date().toISOString();
      const { error: e1 } = await supabase.from("app_settings").upsert({
        key: "company", value: { name, logo_url: logo }, updated_at: ts,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("app_settings").upsert({
        key: "reminder_templates",
        value: { whatsapp: wa, email_subject: subj, email_body: body }, updated_at: ts,
      });
      if (e2) throw e2;
      const { error: e3 } = await supabase.from("app_settings").upsert({
        key: "schedule",
        value: { open, close, slot_min: Number(slot) || 30, weekdays, holidays }, updated_at: ts,
      });
      if (e3) throw e3;
    },
    onSuccess: () => {
      toast.success("Configuració desada");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 500_000) { toast.error("Imatge massa gran (màx 500KB)"); return; }
    setLogo(await fileToDataUrl(f));
  };

  const toggleDay = (d: number) => {
    setWeekdays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort());
  };

  const addHoliday = () => {
    if (!newHoliday) return;
    if (holidays.includes(newHoliday)) return;
    setHolidays([...holidays, newHoliday].sort());
    setNewHoliday("");
  };

  return (
    <div className="px-10 py-8 max-w-[1000px] mx-auto">
      <PageHeader title="Configuració" subtitle="Personalitza la marca, els missatges i el calendari d'explotació." />

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 space-y-5">
          <h2 className="font-display text-lg">Empresa</h2>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Nom de l'empresa</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Logo</Label>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-md border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                {logo ? <img src={logo} alt="Logo" className="h-full w-full object-cover" /> : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
              <Button variant="secondary" type="button" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Pujar imatge
              </Button>
              {logo && (
                <Button variant="ghost" type="button" onClick={() => setLogo(null)}>
                  <X className="h-4 w-4 mr-1" /> Treure
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Recomanat: PNG/JPG quadrat, &lt; 500KB.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 space-y-5">
          <h2 className="font-display text-lg">Horari d'explotació</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Obertura</Label>
              <Input type="time" value={open} onChange={(e) => setOpen(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Tancament</Label>
              <Input type="time" value={close} onChange={(e) => setClose(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Duració slot (min)</Label>
              <Input type="number" min="5" step="5" value={slot} onChange={(e) => setSlot(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Dies laborables</Label>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAY_LABELS.map((lbl, d) => {
                const active = weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`h-9 w-12 rounded-md text-sm border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"}`}
                  >{lbl}</button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Festius i vacances</Label>
            <div className="flex gap-2 mb-3">
              <Input type="date" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} className="w-48" />
              <Button type="button" variant="secondary" onClick={addHoliday}><Plus className="h-4 w-4 mr-1" />Afegir</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {holidays.length === 0 && <span className="text-xs text-muted-foreground">Cap data afegida.</span>}
              {holidays.map((h) => (
                <span key={h} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-sm">
                  {new Date(h + "T00:00:00").toLocaleDateString("ca-ES", { day: "2-digit", month: "short", year: "numeric" })}
                  <button type="button" onClick={() => setHolidays(holidays.filter((x) => x !== h))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 shadow-[var(--shadow-card)]">
        <CardContent className="p-6 space-y-5">
          <div>
            <h2 className="font-display text-lg">Missatges de recordatori</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Variables disponibles: <code className="bg-muted px-1 rounded">{"{name}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{date}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{time}"}</code>,{" "}
              <code className="bg-muted px-1 rounded">{"{company}"}</code>
            </p>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">WhatsApp</Label>
            <Textarea rows={4} value={wa} onChange={(e) => setWa(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Assumpte del correu</Label>
            <Input value={subj} onChange={(e) => setSubj(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Cos del correu</Label>
            <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>Desar canvis</Button>
      </div>
    </div>
  );
}
