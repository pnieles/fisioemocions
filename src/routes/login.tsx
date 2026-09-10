import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getAuthBootstrapStatus, createFirstAdmin } from "@/lib/auth-bootstrap.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión · fisioemocions" }] }),
  component: LoginPage,
});

function LoginPage() {
  const statusFn = useServerFn(getAuthBootstrapStatus);
  const { data: status, isLoading } = useQuery({
    queryKey: ["auth_bootstrap_status"],
    queryFn: () => statusFn(),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-md bg-primary/15 flex items-center justify-center mb-3">
            <Activity className="h-6 w-6 text-primary" strokeWidth={2.2} />
          </div>
          <div className="font-display text-2xl">fisioemocions</div>
          <div className="text-xs text-muted-foreground mt-1">Gestión clínica</div>
        </div>
        <Card className="shadow-[var(--shadow-card)]">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : status?.hasAdmin ? (
              <SignInForm />
            ) : (
              <FirstAdminForm />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "Invalid login credentials" ? "Correo o contraseña incorrectos" : e.message,
      ),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        signIn.mutate();
      }}
    >
      <h1 className="font-display text-lg text-center mb-2">Iniciar sesión</h1>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Correo electrónico
        </Label>
        <Input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Contraseña
        </Label>
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={signIn.isPending}>
        {signIn.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}

function FirstAdminForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const createFn = useServerFn(createFirstAdmin);

  const create = useMutation({
    mutationFn: async () => {
      if (password !== confirm) throw new Error("Las contraseñas no coinciden");
      await createFn({ data: { email, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <h1 className="font-display text-lg text-center mb-1">Configuración inicial</h1>
      <p className="text-xs text-muted-foreground text-center mb-2">
        Aún no hay ninguna cuenta. Crea la cuenta de administrador para empezar.
      </p>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Correo electrónico
        </Label>
        <Input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Contraseña
        </Label>
        <Input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
          Confirmar contraseña
        </Label>
        <Input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={create.isPending}>
        {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        Crear cuenta de administrador
      </Button>
    </form>
  );
}
