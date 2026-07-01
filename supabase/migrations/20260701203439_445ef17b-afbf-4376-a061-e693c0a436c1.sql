
-- Patients: new fields
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_type text,
  ADD COLUMN IF NOT EXISTS wants_invoice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS igi_rate_id uuid,
  ADD COLUMN IF NOT EXISTS cass_coverage numeric;

-- IGI rates
CREATE TABLE IF NOT EXISTS public.igi_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.igi_rates TO anon, authenticated;
GRANT ALL ON public.igi_rates TO service_role;
ALTER TABLE public.igi_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS open_all ON public.igi_rates;
CREATE POLICY open_all ON public.igi_rates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.igi_rates (name, rate)
SELECT * FROM (VALUES ('IGI 0%', 0), ('IGI 4,5%', 4.5), ('IGI 9,5%', 9.5)) v(name, rate)
WHERE NOT EXISTS (SELECT 1 FROM public.igi_rates);

-- Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid,
  patient_id uuid,
  patient_type text NOT NULL,
  invoice_number text,
  issue_date timestamptz NOT NULL DEFAULT now(),
  patient_name text,
  patient_passport text,
  base_amount numeric NOT NULL DEFAULT 0,
  igi_rate numeric NOT NULL DEFAULT 0,
  igi_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  service_description text,
  status text NOT NULL DEFAULT 'en_proceso',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO anon, authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS open_all ON public.invoices;
CREATE POLICY open_all ON public.invoices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Auto-numbering for CASS invoices (YYYY-N)
CREATE OR REPLACE FUNCTION public.assign_cass_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  yr text;
  next_n int;
BEGIN
  IF NEW.patient_type = 'cass' AND (NEW.invoice_number IS NULL OR NEW.invoice_number = '') THEN
    yr := to_char(COALESCE(NEW.issue_date, now()), 'YYYY');
    SELECT COALESCE(MAX((split_part(invoice_number, '-', 2))::int), 0) + 1
      INTO next_n
      FROM public.invoices
     WHERE patient_type = 'cass'
       AND invoice_number LIKE yr || '-%';
    NEW.invoice_number := yr || '-' || next_n::text;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_cass_invoice_number ON public.invoices;
CREATE TRIGGER trg_assign_cass_invoice_number
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_cass_invoice_number();
