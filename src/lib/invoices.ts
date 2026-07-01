import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import type { CompanySettings, IgiRate, Invoice, Patient } from "./data-hooks";

export type CreateInvoiceInput = {
  visit_id: string | null;
  patient: Patient | null;
  patient_name: string;
  patient_type: "cass" | "privado";
  wants_invoice: boolean;
  service_description: string;
  gross_amount: number; // amount charged (tarifa)
  igi_rate: number; // 0..100 (percentage)
  issue_date?: string; // ISO
};

export async function createInvoiceFromVisit(input: CreateInvoiceInput): Promise<Invoice | null> {
  // Only create invoices for CASS (always) or Privado when wants_invoice
  if (input.patient_type !== "cass" && !input.wants_invoice) return null;

  const rate = Number(input.igi_rate) || 0;
  const gross = Number(input.gross_amount) || 0;
  // gross = base * (1 + rate/100)  =>  base = gross / (1 + rate/100)
  const base = rate > 0 ? gross / (1 + rate / 100) : gross;
  const igi_amount = gross - base;

  const payload = {
    visit_id: input.visit_id,
    patient_id: input.patient?.id ?? null,
    patient_type: input.patient_type,
    issue_date: input.issue_date ?? new Date().toISOString(),
    patient_name: input.patient_name,
    patient_passport: input.patient?.passport_id ?? null,
    base_amount: round2(base),
    igi_rate: rate,
    igi_amount: round2(igi_amount),
    total_amount: round2(gross),
    service_description: input.service_description,
    status: "en_proceso",
  };

  const { data, error } = await supabase.from("invoices").insert(payload).select("*").single();
  if (error) throw error;
  return data as Invoice;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n || 0);

export function exportInvoicePdf(inv: Invoice, company: CompanySettings, patient?: Patient | null) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 15;

  // Header: logo left
  if (company.logo_url) {
    try {
      doc.addImage(company.logo_url, "PNG", M, M, 28, 28);
    } catch {
      /* ignore invalid image */
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(company.name || "fisioemocions", M + 34, M + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Centre de fisioteràpia", M + 34, M + 16);

  // Patient box right
  doc.setTextColor(30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", W - M, M + 6, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const rightLines = [
    inv.patient_name || "—",
    patient?.passport_id ? `Doc: ${patient.passport_id}` : inv.patient_passport ? `Doc: ${inv.patient_passport}` : "",
    patient?.phone ? `Tel: ${patient.phone}` : "",
    patient?.email ? patient.email : "",
  ].filter(Boolean);
  rightLines.forEach((l, i) => doc.text(l, W - M, M + 12 + i * 5, { align: "right" }));

  // Divider
  doc.setDrawColor(200);
  doc.line(M, M + 36, W - M, M + 36);

  // Invoice meta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("FACTURA", M, M + 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta = [
    ["Nº factura", inv.invoice_number || "—"],
    ["Fecha", new Date(inv.issue_date).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })],
    ["Tipo", inv.patient_type === "cass" ? "CASS" : "Privado"],
  ];
  meta.forEach(([k, v], i) => {
    doc.setTextColor(120);
    doc.text(k, M, M + 54 + i * 6);
    doc.setTextColor(30);
    doc.text(v, M + 30, M + 54 + i * 6);
  });

  // Service table
  const tableY = M + 80;
  doc.setFillColor(240, 240, 240);
  doc.rect(M, tableY, W - M * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Descripción", M + 3, tableY + 5.5);
  doc.text("Base", W - M - 55, tableY + 5.5, { align: "right" });
  doc.text(`IGI ${inv.igi_rate}%`, W - M - 28, tableY + 5.5, { align: "right" });
  doc.text("Total", W - M - 3, tableY + 5.5, { align: "right" });

  doc.setFont("helvetica", "normal");
  const rowY = tableY + 14;
  doc.text(inv.service_description || "Servicio de fisioterapia", M + 3, rowY);
  doc.text(eur(inv.base_amount), W - M - 55, rowY, { align: "right" });
  doc.text(eur(inv.igi_amount), W - M - 28, rowY, { align: "right" });
  doc.text(eur(inv.total_amount), W - M - 3, rowY, { align: "right" });

  // Totals
  const totalsY = rowY + 18;
  doc.setDrawColor(200);
  doc.line(W - M - 70, totalsY - 4, W - M, totalsY - 4);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text("Base imponible", W - M - 45, totalsY, { align: "right" });
  doc.setTextColor(30);
  doc.text(eur(inv.base_amount), W - M, totalsY, { align: "right" });

  doc.setTextColor(90);
  doc.text(`IGI (${inv.igi_rate}%)`, W - M - 45, totalsY + 6, { align: "right" });
  doc.setTextColor(30);
  doc.text(eur(inv.igi_amount), W - M, totalsY + 6, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30);
  doc.text("Total", W - M - 45, totalsY + 15, { align: "right" });
  doc.text(eur(inv.total_amount), W - M, totalsY + 15, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text(company.name || "fisioemocions", M, 285);
  doc.text("Gracias por su confianza.", W - M, 285, { align: "right" });

  const fname = `factura-${inv.invoice_number || inv.id.slice(0, 8)}.pdf`;
  doc.save(fname);
}

export function computeIgiSplit(gross: number, ratePct: number) {
  const r = Number(ratePct) || 0;
  const base = r > 0 ? gross / (1 + r / 100) : gross;
  return { base: round2(base), igi: round2(gross - base), total: round2(gross) };
}
