CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES
  ('company', '{"name":"fisioemocions","logo_url":null}'::jsonb),
  ('reminder_templates', '{"whatsapp":"Hola {name}, et recordem la teva cita a {company} el {date} a les {time}. Si no pots assistir, si us plau avisa''ns. Gràcies!","email_subject":"Recordatori de cita · {company}","email_body":"Hola {name},\n\nEt recordem la teva cita a {company} el {date} a les {time}.\n\nSi no pots assistir, si us plau avisa''ns.\n\nGràcies!"}'::jsonb)
ON CONFLICT (key) DO NOTHING;