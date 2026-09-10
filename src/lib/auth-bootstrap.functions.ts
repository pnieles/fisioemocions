import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public (pre-login) check used by the /login page to decide whether to show
// the "create the first admin account" setup form or a normal sign-in form.
export const getAuthBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("app_users")
    .select("user_id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return { hasAdmin: (count ?? 0) > 0 };
});

const emailSchema = z.string().trim().email().max(255);
const passwordSchema = z.string().min(6).max(128);

// Only usable while no app_users exist yet — creates the very first account
// (always as admin) so someone can log in and manage the rest from Usuarios.
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ email: emailSchema, password: passwordSchema }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countError } = await supabaseAdmin
      .from("app_users")
      .select("user_id", { count: "exact", head: true });
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error("Ya existe una cuenta de administrador. Inicia sesión normalmente.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message || "No se pudo crear el usuario");

    const { error: e2 } = await supabaseAdmin.from("app_users").insert({
      user_id: created.user.id,
      email: data.email,
      role_id: "admin",
    });
    if (e2) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(e2.message);
    }
    return { user_id: created.user.id };
  });
