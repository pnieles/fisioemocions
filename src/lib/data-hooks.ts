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
  patient_id: string | null;
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
  default_treatment: string | null;
  passport_id: string | null;
  default_profile_id: string | null;
  patient_type: string | null;
  wants_invoice: boolean;
  igi_rate_id: string | null;
  cass_coverage: number | null;
};

export type IgiRate = { id: string; name: string; rate: number };

export type Invoice = {
  id: string;
  visit_id: string | null;
  patient_id: string | null;
  patient_type: string;
  invoice_number: string | null;
  issue_date: string;
  patient_name: string | null;
  patient_passport: string | null;
  base_amount: number;
  igi_rate: number;
  igi_amount: number;
  total_amount: number;
  service_description: string | null;
  status: string;
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

export type CompanySettings = { name: string; logo_url: string | null };
export type ReminderTemplates = {
  whatsapp: string;
  email_subject: string;
  email_body: string;
};
export type ScheduleSettings = {
  open: string;
  close: string;
  slot_min: number;
  weekdays: number[];
  holidays: string[];
};

export function useScheduleSettings() {
  return useQuery({
    queryKey: ["settings", "schedule"],
    queryFn: async (): Promise<ScheduleSettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "schedule")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as ScheduleSettings) ?? {
        open: "09:00",
        close: "20:00",
        slot_min: 30,
        weekdays: [1, 2, 3, 4, 5, 6],
        holidays: [],
      };
    },
  });
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ["settings", "company"],
    queryFn: async (): Promise<CompanySettings> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "company")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as CompanySettings) ?? { name: "fisioemocions", logo_url: null };
    },
  });
}

export function useReminderTemplates() {
  return useQuery({
    queryKey: ["settings", "reminder_templates"],
    queryFn: async (): Promise<ReminderTemplates> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "reminder_templates")
        .maybeSingle();
      if (error) throw error;
      return (
        (data?.value as ReminderTemplates) ?? {
          whatsapp: "",
          email_subject: "",
          email_body: "",
        }
      );
    },
  });
}


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

export function usePatients() {
  return useQuery({
    queryKey: ["patients"],
    queryFn: async (): Promise<Patient[]> => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("last_name")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Patient[];
    },
  });
}

export function useAppointments() {
  return useQuery({
    queryKey: ["appointments"],
    queryFn: async (): Promise<Appointment[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .order("appointment_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });
}

export function useTreatments() {
  return useQuery({
    queryKey: ["treatments"],
    queryFn: async (): Promise<Treatment[]> => {
      const { data, error } = await supabase
        .from("treatments")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Treatment[];
    },
  });
}

export function useIgiRates() {
  return useQuery({
    queryKey: ["igi_rates"],
    queryFn: async (): Promise<IgiRate[]> => {
      const { data, error } = await supabase.from("igi_rates").select("*").order("rate");
      if (error) throw error;
      return (data ?? []) as IgiRate[];
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: ["invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("issue_date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });
}

