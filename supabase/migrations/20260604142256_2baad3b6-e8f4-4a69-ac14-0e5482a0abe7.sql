
-- Client profiles (tariffs)
CREATE TABLE public.client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_rate numeric(10,2) NOT NULL DEFAULT 0,
  color text DEFAULT '#6b7f8f',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Patient visits / income
CREATE TABLE public.patient_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  patient_name text NOT NULL,
  profile_id uuid REFERENCES public.client_profiles(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Materials (consumables purchased)
CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_cost numeric(10,2) NOT NULL,
  supplier text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- General expenses (rent, utilities, taxes, etc)
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants for anon (no-auth internal app)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_visits TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO anon, authenticated;
GRANT ALL ON public.client_profiles TO service_role;
GRANT ALL ON public.patient_visits TO service_role;
GRANT ALL ON public.materials TO service_role;
GRANT ALL ON public.expenses TO service_role;

-- RLS: open access (single-tenant internal use, no auth)
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all" ON public.client_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.patient_visits FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.materials FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.expenses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed default client profiles
INSERT INTO public.client_profiles (name, default_rate, color) VALUES
  ('CASS 1', 25.00, '#2d6b7d'),
  ('CASS 2', 30.00, '#4a8fa3'),
  ('Privado', 50.00, '#1f4d5a'),
  ('Forfait', 40.00, '#7aa9b8');
