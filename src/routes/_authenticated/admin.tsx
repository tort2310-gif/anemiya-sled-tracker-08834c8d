import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAdminStats, claimAdminIfFirst } from "@/lib/auth.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Shield, Users, Globe, LogIn } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Админ — статистика пользователей" }] }),
  component: AdminPage,
});

function AdminPage() {
  const fetchStats = useServerFn(getAdminStats);
  const claim = useServerFn(claimAdminIfFirst);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
    retry: false,
  });

  const handleClaim = async () => {
    const res = await claim();
    if (res.granted) {
      toast.success("Вы стали администратором");
      refetch();
    } else {
      toast.info("Администратор уже назначен");
    }
  };

  const profiles = data?.profiles ?? [];
  const events = data?.events ?? [];

  const stats = useMemo(() => {
    const uniqueUsers = new Set(events.map((e) => e.user_id).filter(Boolean));
    const byCountry: Record<string, number> = {};
    for (const e of events) {
      const key = e.country || e.country_code || "Неизвестно";
      byCountry[key] = (byCountry[key] || 0) + 1;
    }
    const topCountries = Object.entries(byCountry)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    return {
      totalUsers: profiles.length,
      activeUsers: uniqueUsers.size,
      totalLogins: events.length,
      topCountries,
    };
  }, [profiles, events]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> На главную
              </Button>
            </Link>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Админ-панель
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {isLoading && <p className="text-muted-foreground">Загрузка…</p>}

        {error && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-destructive">{(error as Error).message}</p>
              <p className="text-sm text-muted-foreground">
                Если это ваш (владельца проекта) аккаунт — назначьте себя администратором:
              </p>
              <Button onClick={handleClaim} size="sm">
                Стать администратором
              </Button>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                icon={<Users className="h-4 w-4" />}
                label="Всего пользователей"
                value={stats.totalUsers}
              />
              <StatCard
                icon={<LogIn className="h-4 w-4" />}
                label="Всего входов"
                value={stats.totalLogins}
              />
              <StatCard
                icon={<Globe className="h-4 w-4" />}
                label="Активных пользователей"
                value={stats.activeUsers}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Страны
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.topCountries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Данных пока нет.</p>
                ) : (
                  <ul className="space-y-2">
                    {stats.topCountries.map(([country, n]) => (
                      <li key={country} className="flex items-center justify-between text-sm">
                        <span>{country}</span>
                        <Badge variant="secondary">{n}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Пользователи</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Имя</th>
                      <th className="py-2 pr-3">Регистрация</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{p.email || "—"}</td>
                        <td className="py-2 pr-3">{p.display_name || "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">
                          {new Date(p.created_at).toLocaleString("ru-RU")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Журнал входов (последние 500)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-3">Дата</th>
                      <th className="py-2 pr-3">Email</th>
                      <th className="py-2 pr-3">Страна</th>
                      <th className="py-2 pr-3">Город</th>
                      <th className="py-2 pr-3">IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 text-muted-foreground">
                          {new Date(e.created_at).toLocaleString("ru-RU")}
                        </td>
                        <td className="py-2 pr-3">{e.email || "—"}</td>
                        <td className="py-2 pr-3">
                          {e.country || e.country_code || "—"}
                        </td>
                        <td className="py-2 pr-3">{e.city || "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{e.ip || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-muted-foreground text-xs">
          {icon} {label}
        </div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
