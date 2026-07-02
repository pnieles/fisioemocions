import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(6).max(128);
const roleSchema = z.string().trim().min(1).max(64);

export const listAppUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("app_users")
    .select("user_id,email,role_id,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return rows ?? [];
});

export const createAppUser = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ email: emailSchema, password: passwordSchema, role_id: roleSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message || "No se pudo crear el usuario");
    const { error: e2 } = await supabaseAdmin.from("app_users").insert({
      user_id: created.user.id,
      email: data.email,
      role_id: data.role_id,
    });
    if (e2) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(e2.message);
    }
    return { user_id: created.user.id };
  });

export const updateAppUserRole = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ user_id: z.string().uuid(), role_id: roleSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_users")
      .update({ role_id: data.role_id })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAppUserPassword = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ user_id: z.string().uuid(), password: passwordSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ user_id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("app_users").delete().eq("user_id", data.user_id);
    return { ok: true };
  });
