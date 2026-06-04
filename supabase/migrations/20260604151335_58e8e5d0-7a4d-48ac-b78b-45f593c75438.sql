CREATE TABLE public.inventory_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month date NOT NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_counts TO anon, authenticated;
GRANT ALL ON public.inventory_counts TO service_role;

ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all" ON public.inventory_counts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_inventory_counts_period ON public.inventory_counts(period_month);