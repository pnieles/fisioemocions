-- Require real Supabase Auth sessions instead of open anon access.
-- Every table below was previously "open_all" for anon+authenticated, which
-- meant anyone with the publishable key (no login) could read/write patient
-- records, invoices and clinic finances. From now on:
--   * anon has no access at all;
--   * any authenticated (logged-in) staff member can use the clinical /
--     billing tables (patients, appointments, visits, invoices, treatments,
--     client_profiles, igi_rates);
--   * purchase costs, margins and user management stay admin-only
--     (materials, expenses, inventory_counts, app_users);
--   * app_settings is readable by any authenticated user except the
--     email_account row (holds an SMTP password) and is writable by admins
--     only.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
     WHERE user_id = auth.uid() AND role_id = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- app_users: manage your own row read access; only admins can list/modify others.
DROP POLICY IF EXISTS "app_users open access" ON public.app_users;
REVOKE ALL ON public.app_users FROM anon;
CREATE POLICY app_users_self_or_admin_select ON public.app_users
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY app_users_admin_write ON public.app_users
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Admin-only: purchase costs, general expenses, stock valuation.
DROP POLICY IF EXISTS "open_all" ON public.materials;
REVOKE ALL ON public.materials FROM anon;
CREATE POLICY materials_admin_only ON public.materials
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "open_all" ON public.expenses;
REVOKE ALL ON public.expenses FROM anon;
CREATE POLICY expenses_admin_only ON public.expenses
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "open_all" ON public.inventory_counts;
REVOKE ALL ON public.inventory_counts FROM anon;
CREATE POLICY inventory_counts_admin_only ON public.inventory_counts
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Shared clinical/billing tables: any logged-in staff member.
DROP POLICY IF EXISTS open_all ON public.patients;
REVOKE ALL ON public.patients FROM anon;
CREATE POLICY patients_authenticated ON public.patients
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS open_all ON public.appointments;
REVOKE ALL ON public.appointments FROM anon;
CREATE POLICY appointments_authenticated ON public.appointments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_all" ON public.patient_visits;
REVOKE ALL ON public.patient_visits FROM anon;
CREATE POLICY patient_visits_authenticated ON public.patient_visits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS open_all ON public.treatments;
REVOKE ALL ON public.treatments FROM anon;
CREATE POLICY treatments_authenticated ON public.treatments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "open_all" ON public.client_profiles;
REVOKE ALL ON public.client_profiles FROM anon;
CREATE POLICY client_profiles_authenticated ON public.client_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS open_all ON public.igi_rates;
REVOKE ALL ON public.igi_rates FROM anon;
CREATE POLICY igi_rates_authenticated ON public.igi_rates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS open_all ON public.invoices;
REVOKE ALL ON public.invoices FROM anon;
CREATE POLICY invoices_authenticated ON public.invoices
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- app_settings: readable by staff (except the SMTP credentials row), writable by admins only.
DROP POLICY IF EXISTS open_all ON public.app_settings;
REVOKE ALL ON public.app_settings FROM anon;
CREATE POLICY app_settings_admin_write ON public.app_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY app_settings_read_nonsensitive ON public.app_settings
  FOR SELECT TO authenticated USING (key <> 'email_account');

-- Seed shared role/permission definitions (previously stored per-browser in
-- localStorage, which meant every device could show a different menu).
-- material / inventario / consumo / usuarios are now hidden by default for
-- non-admin roles since their data (purchase costs, margins, accounts) is
-- admin-only at the RLS level above.
INSERT INTO public.app_settings (key, value) VALUES (
  'roles',
  '[
    {"id":"admin","name":"Admin","permissions":{
      "inicio":"edit","agenda":"edit","recordatorios":"edit","pacientes":"edit","visitas":"edit",
      "informes":"edit","facturas":"edit","material":"edit","inventario":"edit","consumo":"edit",
      "gastos":"edit","usuarios":"edit","configuracion":"edit"
    }},
    {"id":"secretaria","name":"Secretaría","permissions":{
      "inicio":"hidden","agenda":"edit","recordatorios":"edit","pacientes":"edit","visitas":"edit",
      "informes":"view","facturas":"edit","material":"hidden","inventario":"hidden","consumo":"hidden",
      "gastos":"hidden","usuarios":"hidden","configuracion":"hidden"
    }},
    {"id":"fisio","name":"Fisio","permissions":{
      "inicio":"hidden","agenda":"edit","recordatorios":"view","pacientes":"edit","visitas":"edit",
      "informes":"view","facturas":"view","material":"hidden","inventario":"hidden","consumo":"hidden",
      "gastos":"hidden","usuarios":"hidden","configuracion":"hidden"
    }}
  ]'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Global correlative invoice numbering (F-YYYY-NNNN) for every invoice, not
-- just CASS ones — Andorra tax rules require a sequential number on any
-- issued invoice, including the exportable Privado ones.
DROP TRIGGER IF EXISTS trg_assign_cass_invoice_number ON public.invoices;
DROP FUNCTION IF EXISTS public.assign_cass_invoice_number();

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  yr text;
  next_n int;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    yr := to_char(COALESCE(NEW.issue_date, now()), 'YYYY');
    SELECT COALESCE(MAX((split_part(invoice_number, '-', 3))::int), 0) + 1
      INTO next_n
      FROM public.invoices
     WHERE invoice_number LIKE 'F-' || yr || '-%';
    NEW.invoice_number := 'F-' || yr || '-' || lpad(next_n::text, 4, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_invoice_number
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();
