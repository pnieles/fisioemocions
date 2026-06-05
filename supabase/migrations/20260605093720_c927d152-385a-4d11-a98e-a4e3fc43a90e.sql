
-- Patients
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  nationality text,
  birth_date date,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO anon, authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all ON public.patients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Appointments / agenda
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.client_profiles(id),
  appointment_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 45,
  diagnosis text,
  treatment text,
  status text NOT NULL DEFAULT 'scheduled',
  reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO anon, authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all ON public.appointments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE INDEX appointments_at_idx ON public.appointments(appointment_at);

-- Treatments catalog
CREATE TABLE public.treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatments TO anon, authenticated;
GRANT ALL ON public.treatments TO service_role;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
CREATE POLICY open_all ON public.treatments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.treatments (name) VALUES
  ('Electrodos'), ('Fisiocrem'), ('Masaje manual'), ('Otros');
