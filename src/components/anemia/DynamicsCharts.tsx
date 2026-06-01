import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, Dot } from "recharts";
import type { Patient, TestEntry, LabKey } from "@/lib/anemia/types";
import { ALL_LAB_KEYS, getRange, statusOf } from "@/lib/anemia/ranges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  patient: Patient;
  tests: TestEntry[];
}

function ChartFor({ patient, tests, k }: { patient: Patient; tests: TestEntry[]; k: LabKey }) {
  const r = getRange(k, patient.gender);
  const data = tests
    .filter((t) => typeof t[k as keyof TestEntry] === "number")
    .map((t) => ({ date: t.date, value: t[k as keyof TestEntry] as number }));

  if (data.length === 0) return null;
  const values = data.map((d) => d.value);
  const dataMin = Math.min(...values, r.min);
  const dataMax = Math.max(...values, r.max);
  const pad = (dataMax - dataMin) * 0.15 || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-baseline justify-between gap-2">
          <span>{r.label}</span>
          <span className="text-xs text-muted-foreground font-normal">норма {r.min}–{r.max} {r.unit}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[dataMin - pad, dataMax + pad]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={40} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`${v} ${r.unit}`, r.label]}
              />
              <ReferenceArea y1={r.min} y2={r.max} fill="var(--norm-band)" />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={(props) => {
                  const { cx, cy, payload, index } = props as { cx: number; cy: number; payload: { value: number }; index: number };
                  const s = statusOf(payload.value, r);
                  const fill = s === "ok" ? "var(--success)" : "var(--destructive)";
                  return <Dot key={`d-${index}`} cx={cx} cy={cy} r={4} fill={fill} stroke={fill} />;
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function DynamicsCharts({ patient, tests }: Props) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {ALL_LAB_KEYS.map((k) => (
        <ChartFor key={k} patient={patient} tests={tests} k={k} />
      ))}
    </div>
  );
}
