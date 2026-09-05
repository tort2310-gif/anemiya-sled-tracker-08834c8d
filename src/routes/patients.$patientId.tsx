import { createFileRoute, Link, redirect, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore, useInvalidateStore } from "@/hooks/use-store";
import { ageFrom, deletePatient, deleteTest, errorMessage } from "@/lib/anemia/storage";
import { supabase } from "@/integrations/supabase/client";
import { TestWizard } from "@/components/anemia/TestWizard";
import { StatsDashboard } from "@/components/anemia/StatsDashboard";
import { DiagnosisResultCard } from "@/components/anemia/DiagnosisResultCard";
import { diagnose, branchColor, branchLabel, getBranch } from "@/lib/anemia/diagnose";
import { explain } from "@/lib/anemia/explain";
import type { TestEntry } from "@/lib/anemia/types";
import { ALL_LAB_KEYS, getRange, statusOf } from "@/lib/anemia/ranges";

export const Route = createFileRoute("/patients/$patientId")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  head: () => ({ meta: [{ title: "Пацієнт — Трекер анемії" }] }),
  component: PatientPage,
});

function PatientPage() {
  const { patientId } = useParams({ from: "/patients/$patientId" });
  const store = useStore();
  const invalidateStore = useInvalidateStore();
  const patient = store.patients.find((p) => p.id === patientId);
  const tests = useMemo(
    () => [...(store.tests[patientId] || [])].sort((a, b) => a.date.localeCompare(b.date)),
    [store.tests, patientId],
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TestEntry | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);


  if (!patient) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground mb-3">
            {store.isLoading ? "Завантаження…" : "Пацієнта не знайдено."}
          </p>
          <Link to="/"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1.5" />На головну</Button></Link>
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
              {patient.birthDate} · {ageFrom(patient.birthDate)} років · {patient.gender === "female" ? "жіноча" : "чоловіча"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              if (confirm(`Видалити пацієнта «${patient.name}» і всі його аналізи?`)) {
                try {
                  await deletePatient(patient.id);
                  invalidateStore();
                  window.history.back();
                } catch (err) {
                  toast.error("Не вдалося видалити пацієнта", { description: errorMessage(err) });
                }
              }
            }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Видалити
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">
        <Tabs defaultValue="tests">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="tests">Аналізи ({tests.length})</TabsTrigger>
              <TabsTrigger value="stats">Статистика</TabsTrigger>
            </TabsList>
            <Button onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" />Додати аналіз</Button>
          </div>

          <TabsContent value="tests" className="grid gap-3">
            {tests.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Немає аналізів. Додайте перший.</CardContent></Card>
            ) : (
              [...tests].reverse().map((t) => {
                const br = getBranch(t.mcv);
                const hbR = getRange("hb", patient.gender);
                const hasAnemia = typeof t.hb === "number" && t.hb < hbR.min;
                const dx = hasAnemia ? diagnose(t, patient) : null;
                const isOpen = expanded === t.id;
                return (
                <Card key={t.id} style={{ borderLeft: `4px solid ${dx ? branchColor(br) : "var(--success, #16a34a)"}` }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <button
                        type="button"
                        className="flex-1 text-left flex items-center gap-2"
                        onClick={() => setExpanded(isOpen ? null : t.id)}
                      >
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            {t.date}
                            {dx ? (
                              <>
                                <Badge style={{ background: branchColor(br), color: "white" }}>{branchLabel(br)}</Badge>
                                <Badge variant="outline">№{dx.number} · {dx.name}</Badge>
                              </>
                            ) : (
                              <Badge style={{ background: "var(--success, #16a34a)", color: "white" }}>Норма</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                            {typeof t.hb === "number" && <span>Hb: {t.hb}</span>}
                            {typeof t.mcv === "number" && <span>MCV: {t.mcv}</span>}
                            {typeof t.ferritin === "number" && <span>Феритин: {t.ferritin}</span>}
                          </div>
                        </div>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (confirm("Видалити запис?")) {
                              try {
                                await deleteTest(t.id, patient.id);
                                invalidateStore();
                                toast.success("Запис видалено");
                              } catch (err) {
                                toast.error("Не вдалося видалити запис", { description: errorMessage(err) });
                              }
                            }
                          }}
                        ><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-4 pt-4 border-t">
                        <DiagnosisResultCard
                          details={explain({
                            number: dx?.number ?? 0,
                            name: dx?.name ?? "Анемію не виявлено",
                            branch: br,
                            entry: t,
                            patient,
                          })}
                        />
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
                                  <span style={{ color: s === "ok" || s === "na" ? undefined : "var(--destructive)" }} className="font-medium">{v}</span>
                                  <span className="text-[11px] text-muted-foreground">{r.unit}</span>
                                  {s === "low" && <Badge variant="destructive" className="ml-auto text-[10px] py-0 px-1.5">↓</Badge>}
                                  {s === "high" && <Badge variant="destructive" className="ml-auto text-[10px] py-0 px-1.5">↑</Badge>}
                                </div>
                              </div>
                            );
                          })}
                          {t.morphology && (
                            <div className="rounded-md border px-2 py-1.5 text-sm col-span-2">
                              <div className="text-[11px] text-muted-foreground">Морфологія</div>
                              <div>{t.morphology}</div>
                            </div>
                          )}
                          {t.notes && (
                            <div className="rounded-md border px-2 py-1.5 text-sm col-span-full">
                              <div className="text-[11px] text-muted-foreground">Примітки</div>
                              <div>{t.notes}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                );
              })
            )}
          </TabsContent>


          <TabsContent value="stats">
            <StatsDashboard patient={patient} tests={tests} />
          </TabsContent>
        </Tabs>
      </main>

      <TestWizard patient={patient} open={formOpen} onOpenChange={setFormOpen} initial={editing} />
    </div>
  );
}
