import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PatientForm } from "@/components/anemia/PatientForm";
import { useStore } from "@/hooks/use-store";
import { ageFrom, exportJson, importJson } from "@/lib/anemia/storage";
import { diagnose, branchColor, branchLabel, getBranch } from "@/lib/anemia/diagnose";
import { Activity, Download, Plus, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
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
  const [addOpen, setAddOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const patients = useMemo(
    () => [...store.patients].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [store.patients],
  );

  const handleExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `anemia_data_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Экспорт завершён", { description: a.download });
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importJson(String(reader.result));
      if (ok) toast.success("Импорт выполнен", { description: file.name });
      else toast.error("Не удалось импортировать файл");
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Пациенты ({patients.length})</h2>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Добавить пациента
          </Button>
        </div>

        {patients.length === 0 ? (
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
