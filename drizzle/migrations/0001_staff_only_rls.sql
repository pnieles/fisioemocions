CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_users WHERE user_id = auth.uid());
$$;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

DROP POLICY IF EXISTS patients_authenticated ON public.patients;
CREATE POLICY patients_staff ON public.patients FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS appointments_authenticated ON public.appointments;
CREATE POLICY appointments_staff ON public.appointments FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS patient_visits_authenticated ON public.patient_visits;
CREATE POLICY patient_visits_staff ON public.patient_visits FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS treatments_authenticated ON public.treatments;
CREATE POLICY treatments_staff ON public.treatments FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS client_profiles_authenticated ON public.client_profiles;
CREATE POLICY client_profiles_staff ON public.client_profiles FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS igi_rates_authenticated ON public.igi_rates;
CREATE POLICY igi_rates_staff ON public.igi_rates FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS invoices_authenticated ON public.invoices;
CREATE POLICY invoices_staff ON public.invoices FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS app_settings_read_nonsensitive ON public.app_settings;
CREATE POLICY app_settings_read_nonsensitive ON public.app_settings FOR SELECT TO authenticated USING (public.is_staff() AND key <> 'email_account');