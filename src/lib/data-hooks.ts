import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClientProfile = {
  id: string;
  name: string;
  default_rate: number;
  color: string | null;
};

export type Visit = {
  id: string;
  visit_date: string;
  patient_name: string;
  profile_id: string | null;
  amount: number;
  notes: string | null;
};

export type Material = {
  id: string;
  purchase_date: string;
  description: string;
  quantity: number;
  unit_cost: number;
  supplier: string | null;
};

export type Expense = {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
};

export type InventoryCount = {
  id: string;
  period_month: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  notes: string | null;
};

export type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  nationality: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export type Appointment = {
  id: string;
  patient_id: string | null;
  profile_id: string | null;
  appointment_at: string;
  duration_min: number;
  diagnosis: string | null;
  treatment: string | null;
  status: string;
  reminder_sent_at: string | null;
  notes: string | null;
};

export type Treatment = { id: string; name: string };


export const EXPENSE_CATEGORIES = [
  "Alquiler",
  "Útiles",
  "Impuestos",
  "Inversiones",
  "Suministros",
  "Otros",
] as const;

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async (): Promise<ClientProfile[]> => {
      const { data, error } = await supabase
        .from("client_profiles")
        .select("*")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVisits() {
  return useQuery({
    queryKey: ["visits"],
    queryFn: async (): Promise<Visit[]> => {
      const { data, error } = await supabase
        .from("patient_visits")
        .select("*")
        .order("visit_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMaterials() {
  return useQuery({
    queryKey: ["materials"],
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("purchase_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ["expenses"],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInventoryCounts() {
  return useQuery({
    queryKey: ["inventory_counts"],
    queryFn: async (): Promise<InventoryCount[]> => {
      const { data, error } = await supabase
        .from("inventory_counts")
        .select("*")
        .order("period_month", { ascending: false })
        .order("item_name")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as InventoryCount[];
    },
  });
}
