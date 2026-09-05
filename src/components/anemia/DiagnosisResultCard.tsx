import { Badge } from "@/components/ui/badge";
import { branchColor, branchLabel, type Branch } from "@/lib/anemia/diagnose";
import type { DiagnosisDetails } from "@/lib/anemia/explain";
import { ArrowRight, CheckCircle2 } from "lucide-react";

interface Props {
  details: DiagnosisDetails;
}

function statusBadge(s: "low" | "high" | "ok" | "critical" | "info") {
  if (s === "ok") return <Badge style={{ background: "var(--success, #16a34a)", color: "white" }}>✓ Норма</Badge>;
  if (s === "low") return <Badge variant="destructive">↓ Нижче</Badge>;
  if (s === "high") return <Badge variant="destructive">↑ Вище</Badge>;
  if (s === "critical") return <Badge variant="destructive">⚠ Критично</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export function DiagnosisResultCard({ details }: Props) {
  const color = branchColor(details.branch);
  const noAnemia = details.number === 0 && /не виявлено/i.test(details.name);

  return (
    <div className="grid gap-4">
      {/* 2.1 Діагноз */}
      <div className="rounded-lg border-2 p-4" style={{ borderColor: noAnemia ? "var(--success, #16a34a)" : color }}>
        <div className="flex items-center gap-3 flex-wrap">
          {noAnemia ? (
            <div className="h-12 w-12 rounded-full grid place-items-center text-white" style={{ background: "var(--success, #16a34a)" }}>
              <CheckCircle2 className="h-6 w-6" />
            </div>
          ) : (
            <div
              className="h-12 w-12 rounded-full grid place-items-center text-white font-bold text-lg"
              style={{ background: color }}
            >
              {details.number}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide" style={{ color }}>
              {branchLabel(details.branch as Branch)} анемія
            </div>
            <div className="text-lg font-bold leading-tight uppercase">{details.name}</div>
          </div>
        </div>
      </div>

      {/* 2.2 Пояснення */}
      <section className="rounded-lg border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">Чому цей діагноз</h3>
        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">{details.explanation}</p>
      </section>

      {/* 2.3 Decisive values */}
      {details.decisive.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Показники, що вплинули на діагноз</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-2 font-medium">Показник</th>
                  <th className="py-2 pr-2 font-medium">Значення</th>
                  <th className="py-2 pr-2 font-medium">Норма</th>
                  <th className="py-2 pr-2 font-medium">Статус</th>
                  <th className="py-2 pr-2 font-medium">Роль</th>
                </tr>
              </thead>
              <tbody>
                {details.decisive.map((r, i) => {
                  const bg =
                    r.status === "critical"
                      ? "rgba(220, 38, 38, 0.08)"
                      : r.status === "low" || r.status === "high"
                        ? "rgba(220, 38, 38, 0.04)"
                        : r.status === "ok"
                          ? "rgba(22, 163, 74, 0.05)"
                          : undefined;
                  const isBad = r.status === "low" || r.status === "high" || r.status === "critical";
                  return (
                    <tr key={i} className="border-b last:border-b-0" style={{ background: bg }}>
                      <td className="py-2 pr-2 font-medium">{r.label}</td>
                      <td className="py-2 pr-2" style={{ color: isBad ? "var(--destructive)" : undefined }}>{r.value}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.norm}</td>
                      <td className="py-2 pr-2">{statusBadge(r.status)}</td>
                      <td className="py-2 pr-2 text-muted-foreground">{r.role}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 2.4 Шлях діагностики */}
      {details.path.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">Шлях діагностики</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {details.path.map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="rounded-md border bg-background px-2 py-1">{step}</span>
                {i < details.path.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2.5 Рекомендації */}
      {details.recommendations.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold mb-2">Рекомендації</h3>
          <ul className="text-sm list-disc list-inside space-y-1 text-foreground/90">
            {details.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-muted-foreground">
        Автоматичне припущення за алгоритмом MCV — не замінює очної консультації лікаря.
      </p>
    </div>
  );
}
