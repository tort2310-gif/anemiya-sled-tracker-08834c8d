import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ALL_LAB_KEYS, getRange, statusOf } from "@/lib/anemia/ranges";
import { branchColor, branchLabel, diagnose, getBranch } from "@/lib/anemia/diagnose";
import type { LabKey, Patient, TestEntry } from "@/lib/anemia/types";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { DynamicsCharts } from "./DynamicsCharts";

interface Props {
  patient: Patient;
  tests: TestEntry[];
}

function trendOf(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  const recent = values.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const diff = last - first;
  const threshold = Math.abs(first) * 0.03;
  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "flat";
}

const TREND_KEYS: { key: LabKey; betterDirection: "up" | "down" | "either" }[] = [
  { key: "hb", betterDirection: "up" },
  { key: "mcv", betterDirection: "either" },
  { key: "ferritin", betterDirection: "up" },
  { key: "reticulocytes", betterDirection: "either" },
];

export function StatsDashboard({ patient, tests }: Props) {
  if (tests.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
        Нет данных. Добавьте первый анализ, чтобы увидеть статистику.
      </div>
    );
  }

  const latest = tests[tests.length - 1];
  const branch = getBranch(latest.mcv);
  const dx = diagnose(latest, patient);

  // Diagnosis history timeline
  const history = tests.map((t) => {
    const br = getBranch(t.mcv);
    const hbR = getRange("hb", patient.gender);
    const anemia = typeof t.hb === "number" && t.hb < hbR.min;
    const dxx = anemia ? diagnose(t, patient) : null;
    return { date: t.date, branch: br, dx: dxx };
  });

  return (
    <div className="grid gap-4">
      {/* Auto-diagnosis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Автодиагностика по тренду</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge style={{ background: branchColor(branch), color: "white" }}>
              {branchLabel(branch)} {latest.mcv ? `(MCV ${latest.mcv})` : ""}
            </Badge>
            <Badge variant="outline" className="text-sm">
              №{dx.number} · {dx.name}
            </Badge>
          </div>
          {dx.reasons.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Основание: {dx.reasons.join("; ")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnosis history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Диагностическая история</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="rounded-md border px-2 py-1.5">
                  <div className="text-muted-foreground">{h.date}</div>
                  {h.dx ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block h-2 w-2 rounded-full" style={{ background: branchColor(h.branch) }} />
                      <span className="font-medium">№{h.dx.number}</span>
                      <span className="truncate max-w-[140px]">{h.dx.name}</span>
                    </div>
                  ) : (
                    <div className="text-emerald-600 font-medium mt-0.5">✓ Норма</div>
                  )}
                </div>
                {i < history.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>


      {/* Trend arrows */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Тренд (последние 2–3 анализа)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TREND_KEYS.map(({ key, betterDirection }) => {
              const r = getRange(key, patient.gender);
              const vals = tests
                .map((t) => t[key as keyof TestEntry])
                .filter((v): v is number => typeof v === "number");
              const tr = trendOf(vals);
              let color = "var(--muted-foreground)";
              let Icon = ArrowRight;
              if (tr === "up") {
                Icon = ArrowUp;
                color = betterDirection === "up" ? "var(--success)" : betterDirection === "down" ? "var(--destructive)" : "var(--primary)";
              } else if (tr === "down") {
                Icon = ArrowDown;
                color = betterDirection === "down" ? "var(--success)" : betterDirection === "up" ? "var(--destructive)" : "var(--primary)";
              }
              return (
                <div key={key} className="rounded-md border p-3 bg-card">
                  <div className="text-xs text-muted-foreground">{r.label}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Icon className="h-5 w-5" style={{ color }} />
                    <span className="font-medium">
                      {vals.length ? `${vals[vals.length - 1]} ${r.unit}` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Comparison table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Сравнение с нормами (последний анализ)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-2">Показатель</th>
                  <th className="py-2 pr-2">Значение</th>
                  <th className="py-2 pr-2">Норма</th>
                  <th className="py-2 pr-2">Статус</th>
                </tr>
              </thead>
              <tbody>
                {ALL_LAB_KEYS.map((k) => {
                  const r = getRange(k, patient.gender);
                  const v = latest[k as keyof TestEntry] as number | undefined;
                  const s = statusOf(v, r);
                  let badge: React.ReactNode = <span className="text-muted-foreground">—</span>;
                  if (s === "ok") badge = <Badge style={{ background: "var(--success)", color: "white" }}>=</Badge>;
                  if (s === "low") badge = <Badge variant="destructive">↓</Badge>;
                  if (s === "high") badge = <Badge variant="destructive">↑</Badge>;
                  return (
                    <tr key={k} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">{r.label}</td>
                      <td className="py-2 pr-2" style={{ color: s === "ok" || s === "na" ? undefined : "var(--destructive)" }}>
                        {typeof v === "number" ? `${v} ${r.unit}` : "—"}
                      </td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.min}–{r.max} {r.unit}</td>
                      <td className="py-2 pr-2">{badge}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-base font-semibold mb-3">Динамика показателей</h3>
        <DynamicsCharts patient={patient} tests={tests} />
      </div>
    </div>
  );
}
