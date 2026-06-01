import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/hooks/use-store";
import { ageFrom, deletePatient, deleteTest } from "@/lib/anemia/storage";
import { TestForm } from "@/components/anemia/TestForm";
import { StatsDashboard } from "@/components/anemia/StatsDashboard";
import type { TestEntry } from "@/lib/anemia/types";
import { ALL_LAB_KEYS, getRange, statusOf } from "@/lib/anemia/ranges";

export const Route = createFileRoute("/patients/$patientId")({
  head: () => ({ meta: [{ title: "Пациент — Трекер анемии" }] }),
  component: PatientPage,
});

function PatientPage() {
  const { patientId } = useParams({ from: "/patients/$patientId" });
  const store = useStore();
  const patient = store.patients.find((p) => p.id === patientId);
  const tests = useMemo(
    () => [...(store.tests[patientId] || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [store.tests, patientId],
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TestEntry | null>(null);

  if (!patient) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Пациент не найден.</p>
          <Link to="/"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1.5" />На главную</Button></Link>
        </div>
      </div>
    );
  }

  const openAdd = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t: TestEntry) => { setEditing(t); setFormOpen(true); };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center gap-3 flex-wrap">
          <Link to="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" />Назад</Button></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold leading-tight truncate">{patient.name}</h1>
            <p className="text-xs text-muted-foreground">
              {patient.birthDate} · {ageFrom(patient.birthDate)} лет · {patient.gender === "female" ? "женский" : "мужской"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm(`Удалить пациента «${patient.name}» и все его анализы?`)) {
                deletePatient(patient.id);
                window.history.back();
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Удалить
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <Tabs defaultValue="tests">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="tests">Анализы ({tests.length})</TabsTrigger>
              <TabsTrigger value="stats">Статистика</TabsTrigger>
            </TabsList>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" />Добавить анализ</Button>
          </div>

          <TabsContent value="tests" className="grid gap-3">
            {tests.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Нет анализов. Добавьте первый.</CardContent></Card>
            ) : (
              [...tests].reverse().map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-medium">{t.date}</div>
                        {t.notes && <div className="text-xs text-muted-foreground mt-0.5">{t.notes}</div>}
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { if (confirm("Удалить запись?")) deleteTest(t.id, patient.id); }}
                        ><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {ALL_LAB_KEYS.map((k) => {
                        const v = t[k as keyof TestEntry] as number | undefined;
                        if (typeof v !== "number") return null;
                        const r = getRange(k, patient.gender);
                        const s = statusOf(v, r);
                        return (
                          <div key={k} className="rounded-md border px-2 py-1.5 text-sm">
                            <div className="text-[11px] text-muted-foreground">{r.label}</div>
                            <div className="flex items-baseline gap-1">
                              <span style={{ color: s === "ok" || s === "na" ? undefined : "var(--destructive)" }} className="font-medium">
                                {v}
                              </span>
                              <span className="text-[11px] text-muted-foreground">{r.unit}</span>
                              {s === "low" && <Badge variant="destructive" className="ml-auto text-[10px] py-0 px-1.5">↓</Badge>}
                              {s === "high" && <Badge variant="destructive" className="ml-auto text-[10px] py-0 px-1.5">↑</Badge>}
                            </div>
                          </div>
                        );
                      })}
                      {t.morphology && (
                        <div className="rounded-md border px-2 py-1.5 text-sm col-span-2">
                          <div className="text-[11px] text-muted-foreground">Морфология</div>
                          <div>{t.morphology}</div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="stats">
            <StatsDashboard patient={patient} tests={tests} />
          </TabsContent>
        </Tabs>
      </main>

      <TestForm patientId={patient.id} open={formOpen} onOpenChange={setFormOpen} initial={editing} />
    </div>
  );
}
