import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings, useReminderTemplates } from "@/lib/data-hooks";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

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

function ConfigPage() {
  const { data: company } = useCompanySettings();
  const { data: templates } = useReminderTemplates();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [wa, setWa] = useState("");
  const [subj, setSubj] = useState("");
  const [body, setBody] = useState("");

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

  const save = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase
        .from("app_settings")
        .upsert({ key: "company", value: { name, logo_url: logo }, updated_at: new Date().toISOString() });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("app_settings").upsert({
        key: "reminder_templates",
        value: { whatsapp: wa, email_subject: subj, email_body: body },
        updated_at: new Date().toISOString(),
      });
      if (e2) throw e2;
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
    if (f.size > 500_000) {
      toast.error("Imatge massa gran (màx 500KB)");
      return;
    }
    const url = await fileToDataUrl(f);
    setLogo(url);
  };

  return (
    <div className="px-10 py-8 max-w-[1000px] mx-auto">
      <PageHeader title="Configuració" subtitle="Personalitza la marca i els missatges de recordatori." />

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
