import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Вхід — Трекер анемії" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: name || email },
          },
        });
        if (error) throw error;
        toast.success("Реєстрацію виконано", {
          description: "Перевірте пошту для підтвердження адреси.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Вхід виконано");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error("Помилка", { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Не вдалося увійти через Google", { description: String(result.error) });
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-lg bg-primary/10 text-primary grid place-items-center">
            <Activity className="h-6 w-6" />
          </div>
          <CardTitle>{mode === "signin" ? "Вхід" : "Реєстрація"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {mode === "signin" ? "Увійдіть у трекер анемії" : "Створіть обліковий запис"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={loading}
          >
            Увійти через Google
          </Button>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-card px-2 relative z-10">або email</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Ім'я</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "signin" ? "Увійти" : "Зареєструватися"}
            </Button>
          </form>
          <div className="text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                Немає акаунта?{" "}
                <button className="text-primary underline" onClick={() => setMode("signup")}>
                  Створити
                </button>
              </>
            ) : (
              <>
                Вже є акаунт?{" "}
                <button className="text-primary underline" onClick={() => setMode("signin")}>
                  Увійти
                </button>
              </>
            )}
          </div>
          <div className="text-center">
            <Link to="/" className="text-xs text-muted-foreground underline">
              Повернутися на головну
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
