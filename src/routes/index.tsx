import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PatientForm } from "@/components/anemia/PatientForm";
import { useStore, useInvalidateStore } from "@/hooks/use-store";
import { ageFrom, exportJson, importJson, errorMessage } from "@/lib/anemia/storage";
import { diagnose, branchColor, branchLabel, getBranch } from "@/lib/anemia/diagnose";
import { Activity, Download, LogIn, LogOut, Plus, Shield, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState as useReactState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  head: () => ({
    meta: [
      { title: "Трекер анемии — анализы и динамика" },
      { name: "description", content: "Многопациентный трекер анализов крови с авто-диагностикой анемии по MCV." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const store = useStore();
  const invalidateStore = useInvalidateStore();
  const [addOpen, setAddOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [userEmail, setUserEmail] = useReactState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserEmail(data.session?.user.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserEmail(s?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Вы вышли");
  };

  const patients = useMemo(
    () => [...store.patients].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [store.patients],
  );

  const handleExport = async () => {
    try {
      const json = await exportJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `anemia_data_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Экспорт завершён", { description: a.download });
    } catch (err) {
      toast.error("Не удалось экспортировать данные", { description: errorMessage(err) });
    }
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await importJson(String(reader.result));
      if (ok) {
        invalidateStore();
        toast.success("Импорт выполнен", { description: file.name });
      } else {
        toast.error("Не удалось импортировать файл");
      }
    };
    reader.readAsText(file);
  };


  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Трекер анемии</h1>
              <p className="text-xs text-muted-foreground">Анализы крови и авто-диагностика по MCV</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" /> Импорт
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1.5" /> Экспорт
            </Button>
            <Link to="/admin">
              <Button variant="outline" size="sm">
                <Shield className="h-4 w-4 mr-1.5" /> Админ
              </Button>
            </Link>
            {userEmail ? (
              <Button variant="ghost" size="sm" onClick={handleSignOut} title={userEmail}>
                <LogOut className="h-4 w-4 mr-1.5" /> Выйти
              </Button>
            ) : (
              <Link to="/auth">
                <Button size="sm">
                  <LogIn className="h-4 w-4 mr-1.5" /> Войти
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Статистика использования алгоритма */}
        {(() => {
          const totalPatients = patients.length;
          const allTests = patients.flatMap((p) => store.tests[p.id] || []);
          const totalTests = allTests.length;
          const branchCounts = { micro: 0, normo: 0, macro: 0, unknown: 0 } as Record<string, number>;
          for (const t of allTests) branchCounts[getBranch(t.mcv)]++;
          const lastDate = allTests.map((t) => t.date).sort().slice(-1)[0];
          const topUsers = [...patients]
            .map((p) => ({ p, n: (store.tests[p.id] || []).length }))
            .filter((x) => x.n > 0)
            .sort((a, b) => b.n - a.n)
            .slice(0, 5);
          return (
            <section className="mb-6 rounded-lg border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Статистика использования алгоритма</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Пациентов</div>
                  <div className="text-2xl font-bold">{totalPatients}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Анализов проведено</div>
                  <div className="text-2xl font-bold">{totalTests}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Запусков алгоритма</div>
                  <div className="text-2xl font-bold">{totalTests}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Последняя активность</div>
                  <div className="text-sm font-semibold">{lastDate || "—"}</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Распределение по ветвям MCV</div>
                  <div className="space-y-1.5">
                    {(["micro", "normo", "macro"] as const).map((b) => {
                      const n = branchCounts[b] || 0;
                      const pct = totalTests ? Math.round((n / totalTests) * 100) : 0;
                      return (
                        <div key={b} className="flex items-center gap-2 text-xs">
                          <Badge style={{ background: branchColor(b), color: "white" }}>{branchLabel(b)}</Badge>
                          <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                            <div className="h-full" style={{ width: `${pct}%`, background: branchColor(b) }} />
                          </div>
                          <span className="tabular-nums w-16 text-right text-muted-foreground">{n} ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Кто пользовался чаще всего</div>
                  {topUsers.length === 0 ? (
                    <div className="text-xs text-muted-foreground">Пока нет данных</div>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {topUsers.map(({ p, n }, i) => (
                        <li key={p.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            <span className="text-muted-foreground mr-1">{i + 1}.</span>
                            {p.name}
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums">{n} анализов</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Пациенты ({patients.length})</h2>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Добавить пациента
          </Button>
        </div>

        {store.isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">Загрузка…</CardContent>
          </Card>
        ) : patients.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Пока нет пациентов. Нажмите «Добавить пациента», чтобы начать.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {patients.map((p) => {
              const tests = store.tests[p.id] || [];
              const sorted = [...tests].sort((a, b) => a.date.localeCompare(b.date));
              const last = sorted[sorted.length - 1];
              const branch = last ? getBranch(last.mcv) : "unknown";
              const dx = last ? diagnose(last, p) : null;
              return (
                <Link key={p.id} to="/patients/$patientId" params={{ patientId: p.id }} className="block">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-secondary grid place-items-center text-secondary-foreground">
                          <UserRound className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {ageFrom(p.birthDate)} лет · {p.gender === "female" ? "женский" : "мужской"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {last ? `Последний анализ: ${last.date}` : "Нет анализов"}
                          </div>
                          {dx && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Badge style={{ background: branchColor(branch), color: "white" }}>
                                {branchLabel(branch)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">№{dx.number} {dx.name}</Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <PatientForm open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
