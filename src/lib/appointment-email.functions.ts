import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type EmailAccount = {
  email: string;
  password: string;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  sync_enabled?: boolean;
};

type CompanySettings = { name: string; logo_url: string | null };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toICSDate(d: Date) {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeICS(s: string) {
  return String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function buildICS(opts: {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  organizerName: string;
  organizerEmail: string;
  attendeeEmail?: string;
  attendeeName?: string;
  location?: string;
  sequence?: number;
}) {
  const now = new Date();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//fisioemocions//Agenda//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${opts.uid}`,
    `DTSTAMP:${toICSDate(now)}`,
    `DTSTART:${toICSDate(opts.start)}`,
    `DTEND:${toICSDate(opts.end)}`,
    `SUMMARY:${escapeICS(opts.summary)}`,
    `DESCRIPTION:${escapeICS(opts.description)}`,
    opts.location ? `LOCATION:${escapeICS(opts.location)}` : "",
    `ORGANIZER;CN=${escapeICS(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    opts.attendeeEmail
      ? `ATTENDEE;CN=${escapeICS(opts.attendeeName || opts.attendeeEmail)};RSVP=TRUE:mailto:${opts.attendeeEmail}`
      : "",
    `SEQUENCE:${opts.sequence ?? 0}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export const sendAppointmentConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { appointmentId: string }) => {
    if (!data?.appointmentId || typeof data.appointmentId !== "string") {
      throw new Error("appointmentId requerido");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", data.appointmentId)
      .maybeSingle();
    if (apptErr) throw new Error(apptErr.message);
    if (!appt) throw new Error("Cita no encontrada");

    let patient: {
      first_name: string;
      last_name: string;
      email: string | null;
    } | null = null;
    if (appt.patient_id) {
      const { data: p } = await supabase
        .from("patients")
        .select("first_name,last_name,email")
        .eq("id", appt.patient_id)
        .maybeSingle();
      patient = p as typeof patient;
    }

    const { data: emailRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "email_account")
      .maybeSingle();
    const account = (emailRow?.value as EmailAccount | null) ?? null;

    if (!account || !account.email || !account.password || !account.smtp_host) {
      return {
        ok: false,
        skipped: true,
        reason:
          "Cuenta de correo no configurada. Añádela en Configuración → Correo saliente.",
      };
    }

    const { data: companyRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "company")
      .maybeSingle();
    const company =
      (companyRow?.value as CompanySettings | null) ?? { name: "fisioemocions", logo_url: null };

    const start = new Date(appt.appointment_at);
    const end = new Date(start.getTime() + (appt.duration_min || 30) * 60000);
    const patientName = patient
      ? `${patient.first_name} ${patient.last_name}`.trim()
      : "paciente";
    const summary = `Cita ${company.name} — ${patientName}`;
    const descriptionParts = [
      `Cita con ${company.name}`,
      appt.treatment ? `Tratamiento: ${appt.treatment}` : "",
      appt.diagnosis ? `Motivo: ${appt.diagnosis}` : "",
      appt.notes ? `Notas: ${appt.notes}` : "",
    ].filter(Boolean);
    const description = descriptionParts.join("\n");

    const ics = buildICS({
      uid: `${appt.id}@fisioemocions`,
      start,
      end,
      summary,
      description,
      organizerName: company.name,
      organizerEmail: account.email,
      attendeeEmail: patient?.email || undefined,
      attendeeName: patient ? patientName : undefined,
      sequence: 0,
    });

    const whenStr = start.toLocaleString("es-ES", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = `
      <div style="font-family:Arial,sans-serif;color:#222;line-height:1.5">
        <h2 style="margin:0 0 12px">Confirmación de cita</h2>
        <p>Hola ${patient?.first_name || ""},</p>
        <p>Te confirmamos tu cita en <strong>${company.name}</strong>:</p>
        <ul>
          <li><strong>Fecha:</strong> ${whenStr}</li>
          <li><strong>Duración:</strong> ${appt.duration_min || 30} min</li>
          ${appt.treatment ? `<li><strong>Tratamiento:</strong> ${appt.treatment}</li>` : ""}
        </ul>
        <p>Adjuntamos un archivo <em>.ics</em> para que puedas añadirla a tu calendario con un clic.</p>
        <p>Si necesitas cambiar la cita, responde a este correo.</p>
        <p style="margin-top:24px;color:#666;font-size:12px">— ${company.name}</p>
      </div>`;

    const text = `Confirmación de cita\n\nHola ${patient?.first_name || ""},\n\nTe confirmamos tu cita en ${company.name}:\nFecha: ${whenStr}\nDuración: ${appt.duration_min || 30} min\n${appt.treatment ? `Tratamiento: ${appt.treatment}\n` : ""}\nAdjuntamos un .ics para añadirla a tu calendario.\n\n— ${company.name}`;

    const recipients: string[] = [];
    if (patient?.email) recipients.push(patient.email);
    // Copy to own inbox so the appointment lands in the synced calendar
    if (account.sync_enabled !== false) recipients.push(account.email);

    if (recipients.length === 0) {
      return {
        ok: false,
        skipped: true,
        reason: "El paciente no tiene correo y la sincronización está desactivada.",
      };
    }

    let nodemailer: typeof import("nodemailer");
    try {
      nodemailer = await import("nodemailer");
    } catch (e) {
      throw new Error(
        "No se pudo cargar el cliente SMTP en este entorno: " + (e as Error).message,
      );
    }

    const transporter = nodemailer.createTransport({
      host: account.smtp_host,
      port: Number(account.smtp_port) || 465,
      secure: account.smtp_secure !== false,
      auth: { user: account.email, pass: account.password },
    });

    try {
      const info = await transporter.sendMail({
        from: `"${company.name}" <${account.email}>`,
        to: recipients,
        subject: `Confirmación de cita — ${whenStr}`,
        text,
        html,
        icalEvent: {
          method: "REQUEST",
          filename: "cita.ics",
          content: ics,
        },
        attachments: [
          {
            filename: "cita.ics",
            content: ics,
            contentType: 'text/calendar; method=REQUEST; charset="utf-8"',
          },
        ],
      });
      return { ok: true, messageId: info.messageId, recipients };
    } catch (e) {
      const msg = (e as Error).message || String(e);
      throw new Error(`SMTP falló: ${msg}`);
    }
  });
