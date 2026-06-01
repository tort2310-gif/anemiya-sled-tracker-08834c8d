import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { addTest, updateTest } from "@/lib/anemia/storage";
import { getRange, statusOf } from "@/lib/anemia/ranges";
import { branchColor, branchLabel, diagnose, getBranch } from "@/lib/anemia/diagnose";
import type { Patient, TestEntry } from "@/lib/anemia/types";

interface Props {
  patient: Patient;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: TestEntry | null;
}

const today = () => new Date().toISOString().slice(0, 10);

type NumKey =
  | "hb" | "mcv" | "iron" | "tibc" | "ferritin" | "tsh" | "creatinine"
  | "uricAcid" | "totalProtein" | "reticulocytes" | "reticIndex"
  | "b12" | "folate" | "bilirubinIndirect" | "epo" | "gfr" | "ft3" | "ft4";

interface Draft {
  date: string;
  nums: Partial<Record<NumKey, string>>;
  electrophoresis?: string; // alpha-norm | beta-high | none
  sideroblasts?: string; // yes | no
  microMorph?: string; // norma | unstable | spherocytes | sickle
  uzi?: string;
  morphology?: string; // for macro
  notes: string;
}

const num = (s?: string) => {
  if (s === undefined || s === null || s.trim() === "") return undefined;
  const n = Number(s.replace(",", "."));
  return Number.isNaN(n) ? undefined : n;
};

function FieldNum({
  label, unit, value, onChange, hint,
}: { label: string; unit?: string; value?: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">
        {label} {unit && <span className="opacity-60">({unit})</span>}
      </Label>
      <Input inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="—" />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TestWizard({ patient, open, onOpenChange, initial }: Props) {
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>({ date: today(), nums: {}, notes: "" });

  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (initial) {
      const nums: Draft["nums"] = {};
      const copy = (k: NumKey, src: keyof TestEntry) => {
        const v = initial[src];
        if (typeof v === "number") nums[k] = String(v);
      };
      copy("hb", "hb"); copy("mcv", "mcv"); copy("iron", "iron"); copy("tibc", "tibc");
      copy("ferritin", "ferritin"); copy("tsh", "tsh"); copy("creatinine", "creatinine");
      copy("reticulocytes", "reticulocytes"); copy("reticIndex", "reticIndex");
      copy("b12", "b12"); copy("folate", "folate");
      copy("bilirubinIndirect", "bilirubinIndirect"); copy("epo", "epo");
      setD({ date: initial.date, nums, notes: initial.notes || "", morphology: initial.morphology || "" });
    } else {
      setD({ date: today(), nums: {}, notes: "" });
    }
  }, [open, initial]);

  const setNum = (k: NumKey, v: string) => setD((p) => ({ ...p, nums: { ...p.nums, [k]: v } }));

  const hb = num(d.nums.hb);
  const mcv = num(d.nums.mcv);
  const hbRange = getRange("hb", patient.gender);
  const hbStatus = statusOf(hb, hbRange);
  const branch = getBranch(mcv);
  const anemia = hb !== undefined && hb < hbRange.min;

  const step1Ready = !!d.date && hb !== undefined && mcv !== undefined;

  // Build a TestEntry-like preview for the final diagnosis
  const entryPreview = useMemo<TestEntry>(() => ({
    id: initial?.id || "preview",
    patientId: patient.id,
    date: d.date,
    hb: num(d.nums.hb),
    mcv: num(d.nums.mcv),
    iron: num(d.nums.iron),
    tibc: num(d.nums.tibc),
    ferritin: num(d.nums.ferritin),
    tsh: num(d.nums.tsh),
    creatinine: num(d.nums.creatinine),
    reticulocytes: num(d.nums.reticulocytes),
    reticIndex: num(d.nums.reticIndex),
    bilirubinIndirect: num(d.nums.bilirubinIndirect),
    b12: num(d.nums.b12),
    folate: num(d.nums.folate),
    epo: num(d.nums.epo),
    morphology: d.morphology || undefined,
    notes: d.notes || undefined,
  }), [d, initial, patient.id]);

  const customDx = useMemo(() => deriveDiagnosis(entryPreview, patient, d), [entryPreview, patient, d]);
  const dx = customDx || diagnose(entryPreview, patient);

  const save = () => {
    const payload: Omit<TestEntry, "id"> = {
      patientId: patient.id,
      date: d.date,
      hb: num(d.nums.hb),
      mcv: num(d.nums.mcv),
      iron: num(d.nums.iron),
      tibc: num(d.nums.tibc),
      ferritin: num(d.nums.ferritin),
      tsh: num(d.nums.tsh),
      creatinine: num(d.nums.creatinine),
      reticulocytes: num(d.nums.reticulocytes),
      reticIndex: num(d.nums.reticIndex),
      bilirubinIndirect: num(d.nums.bilirubinIndirect),
      b12: num(d.nums.b12),
      folate: num(d.nums.folate),
      epo: num(d.nums.epo),
      morphology: d.morphology || undefined,
      notes: buildNotes(d),
    };
    if (initial) updateTest(initial.id, patient.id, payload);
    else addTest(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Редактировать анализ" : "Новый анализ"} · Шаг {step} из 3
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Базовые показатели"}
            {step === 2 && (anemia
              ? <>Подозрение: <span style={{ color: branchColor(branch) }}>{branchLabel(branch)} анемия</span></>
              : "Дополнительные показатели")}
            {step === 3 && "Заключение"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="date">Дата анализа</Label>
              <Input id="date" type="date" value={d.date} onChange={(e) => setD((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldNum label="Гемоглобин Hb" unit="г/л" value={d.nums.hb}
                onChange={(v) => setNum("hb", v)}
                hint={`Норма: ${hbRange.min}–${hbRange.max}`} />
              <FieldNum label="MCV" unit="фл" value={d.nums.mcv}
                onChange={(v) => setNum("mcv", v)}
                hint="<80 — микро · 83–93 — нормо · >93 — макро" />
            </div>
            {step1Ready && (
              <div className="rounded-md border p-3 text-sm flex items-start gap-2">
                {!anemia ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />
                    <div>
                      <div className="font-medium">Анемия не выявлена</div>
                      <div className="text-muted-foreground text-xs">
                        Hb в пределах нормы ({hbRange.min}–{hbRange.max} {hbRange.unit}). Можно сохранить запись для истории.
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600" />
                    <div>
                      <div className="font-medium">
                        Подозрение: <span style={{ color: branchColor(branch) }}>{branchLabel(branch)} анемия</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Hb {hb} {hbRange.unit} {hbStatus === "low" ? "↓" : ""} · MCV {mcv} фл — переходим к уточняющим анализам.
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3">
            {!anemia && (
              <p className="text-sm text-muted-foreground">
                Анемия не выявлена. Дополнительные показатели не обязательны, но вы можете заполнить их для истории.
              </p>
            )}

            {branch === "micro" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldNum label="Железо сыворотки" unit="мкмоль/л" value={d.nums.iron} onChange={(v) => setNum("iron", v)} />
                <FieldNum label="ОЖСС" unit="мкмоль/л" value={d.nums.tibc} onChange={(v) => setNum("tibc", v)} />
                <FieldNum label="Ферритин" unit="мкг/л" value={d.nums.ferritin} onChange={(v) => setNum("ferritin", v)} />
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Электрофорез гемоглобина</Label>
                  <Select value={d.electrophoresis || "none"} onValueChange={(v) => setD((p) => ({ ...p, electrophoresis: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не проводился</SelectItem>
                      <SelectItem value="alpha-norm">Норм HbA2 (α)</SelectItem>
                      <SelectItem value="beta-high">Повышен HbA2 (β)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Кольца сидеробластов в мазке</Label>
                  <Select value={d.sideroblasts || "unknown"} onValueChange={(v) => setD((p) => ({ ...p, sideroblasts: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unknown">Неизвестно</SelectItem>
                      <SelectItem value="yes">Да</SelectItem>
                      <SelectItem value="no">Нет</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Морфология эритроцитов</Label>
                  <Select value={d.microMorph || "none"} onValueChange={(v) => setD((p) => ({ ...p, microMorph: v, morphology: morphLabel(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не указано</SelectItem>
                      <SelectItem value="norma">Норма</SelectItem>
                      <SelectItem value="unstable">Нестабильные Hb</SelectItem>
                      <SelectItem value="spherocytes">Сфероциты</SelectItem>
                      <SelectItem value="sickle">Серповидные клетки</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {branch === "normo" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldNum label="Железо сыворотки" unit="мкмоль/л" value={d.nums.iron} onChange={(v) => setNum("iron", v)} />
                <FieldNum label="ОЖСС" unit="мкмоль/л" value={d.nums.tibc} onChange={(v) => setNum("tibc", v)} />
                <FieldNum label="ТТГ" unit="мМЕ/л" value={d.nums.tsh} onChange={(v) => setNum("tsh", v)} />
                <FieldNum label="Креатинин" unit="мкмоль/л" value={d.nums.creatinine} onChange={(v) => setNum("creatinine", v)} />
                <FieldNum label="Мочевая кислота" unit="мкмоль/л" value={d.nums.uricAcid} onChange={(v) => setNum("uricAcid", v)} />
                <FieldNum label="Общий белок" unit="г/л" value={d.nums.totalProtein} onChange={(v) => setNum("totalProtein", v)} />
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">УЗИ</Label>
                  <Select value={d.uzi || "none"} onValueChange={(v) => setD((p) => ({ ...p, uzi: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не указано</SelectItem>
                      <SelectItem value="norma">Норма</SelectItem>
                      <SelectItem value="abdominal">Патология брюшной полости</SelectItem>
                      <SelectItem value="renal">Патология почек</SelectItem>
                      <SelectItem value="adrenal">Патология надпочечников</SelectItem>
                      <SelectItem value="liver">Патология печени / НЖБП</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {num(d.nums.tsh) !== undefined && num(d.nums.tsh)! > getRange("tsh", patient.gender).max && (
                  <>
                    <FieldNum label="Т3 свободный" unit="пмоль/л" value={d.nums.ft3} onChange={(v) => setNum("ft3", v)} />
                    <FieldNum label="Т4 свободный" unit="пмоль/л" value={d.nums.ft4} onChange={(v) => setNum("ft4", v)} />
                  </>
                )}
                {num(d.nums.creatinine) !== undefined && num(d.nums.creatinine)! > getRange("creatinine", patient.gender).max && (
                  <>
                    <FieldNum label="Эритропоэтин" unit="МЕ/л" value={d.nums.epo} onChange={(v) => setNum("epo", v)} />
                    <FieldNum label="СКФ" unit="мл/мин" value={d.nums.gfr} onChange={(v) => setNum("gfr", v)} />
                  </>
                )}
              </div>
            )}

            {branch === "macro" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldNum label="Ретикулоциты" unit="%" value={d.nums.reticulocytes} onChange={(v) => setNum("reticulocytes", v)} />
                <FieldNum label="Ретикулоцитарный индекс" value={d.nums.reticIndex} onChange={(v) => setNum("reticIndex", v)} />
                <FieldNum label="B12" unit="пмоль/л" value={d.nums.b12} onChange={(v) => setNum("b12", v)} />
                <FieldNum label="Фолат" unit="нмоль/л" value={d.nums.folate} onChange={(v) => setNum("folate", v)} />
                <FieldNum label="Билирубин непрямой" unit="мкмоль/л" value={d.nums.bilirubinIndirect} onChange={(v) => setNum("bilirubinIndirect", v)} />
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Морфология в мазке</Label>
                  <Select value={d.morphology || "none"} onValueChange={(v) => setD((p) => ({ ...p, morphology: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не указано</SelectItem>
                      <SelectItem value="Норма">Норма</SelectItem>
                      <SelectItem value="Мегалобласты">Мегалобласты</SelectItem>
                      <SelectItem value="Пойкилоциты">Пойкилоциты</SelectItem>
                      <SelectItem value="Шизоциты">Шизоциты (фрагменты)</SelectItem>
                      <SelectItem value="Признаки дисплазии">Признаки дисплазии</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Примечания</Label>
              <Textarea rows={2} value={d.notes} onChange={(e) => setD((p) => ({ ...p, notes: e.target.value }))}
                placeholder="например: контакт со свинцом, хр. заболевания…" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="grid gap-3">
            {!anemia ? (
              <div className="rounded-md border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span className="font-semibold">Анемия не выявлена</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Гемоглобин в пределах референса. Запись будет сохранена в истории.
                </p>
              </div>
            ) : (
              <div className="rounded-md border p-4" style={{ borderColor: branchColor(branch) }}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge style={{ background: branchColor(branch), color: "white" }}>{branchLabel(branch)}</Badge>
                  <span className="text-xs text-muted-foreground">Диагноз №{dx.number}</span>
                </div>
                <div className="text-lg font-semibold leading-tight">{dx.name}</div>
                {dx.reasons.length > 0 && (
                  <ul className="mt-2 list-disc list-inside text-sm text-muted-foreground">
                    {dx.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Это автоматическое предположение по алгоритму MCV — не заменяет очной консультации врача.
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1.5" /> Назад
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 1 && !step1Ready}>
                Далее <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button onClick={save}>Сохранить</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function morphLabel(v: string): string {
  switch (v) {
    case "norma": return "Норма";
    case "unstable": return "Нестабильные Hb";
    case "spherocytes": return "Сфероциты";
    case "sickle": return "Серповидные клетки";
    default: return "";
  }
}

function buildNotes(d: Draft): string | undefined {
  const parts: string[] = [];
  if (d.notes) parts.push(d.notes);
  if (d.electrophoresis && d.electrophoresis !== "none") {
    parts.push(`Электрофорез: ${d.electrophoresis === "alpha-norm" ? "норм HbA2 (α)" : "повышен HbA2 (β)"}`);
  }
  if (d.sideroblasts === "yes") parts.push("Кольца сидеробластов: да");
  if (d.uzi && d.uzi !== "none") parts.push(`УЗИ: ${d.uzi}`);
  return parts.length ? parts.join(" · ") : undefined;
}

// Override / refine the default diagnosis using wizard-only inputs (electrophoresis, sideroblasts, micro morphology, uzi)
function deriveDiagnosis(
  e: TestEntry,
  patient: Patient,
  d: Draft,
) {
  if (e.hb === undefined || e.mcv === undefined) return null;
  const hbR = getRange("hb", patient.gender);
  if (e.hb >= hbR.min) return null; // no anemia → fall through (caller handles)
  const branch = getBranch(e.mcv);
  const ironR = getRange("iron", patient.gender);
  const tibcR = getRange("tibc", patient.gender);
  const ferR = getRange("ferritin", patient.gender);
  const tshR = getRange("tsh", patient.gender);
  const creatR = getRange("creatinine", patient.gender);
  const reticR = getRange("reticulocytes", patient.gender);
  const biliR = getRange("bilirubinIndirect", patient.gender);
  const b12R = getRange("b12", patient.gender);
  const folR = getRange("folate", patient.gender);

  const reasons: string[] = [];
  const note = (d.notes || "").toLowerCase();

  if (branch === "micro") {
    const ironLow = statusOf(e.iron, ironR) === "low";
    const ferLow = statusOf(e.ferritin, ferR) === "low";
    const ferHigh = statusOf(e.ferritin, ferR) === "high";
    const tibcHigh = statusOf(e.tibc, tibcR) === "high";

    if (/свин|lead/.test(note)) {
      return { number: 7, name: "Отравление свинцом", branch, reasons: ["Указание на контакт со свинцом"] };
    }
    if (ironLow && ferLow && tibcHigh) {
      if (d.electrophoresis === "alpha-norm") {
        return { number: 1, name: "Железодефицитная анемия", branch, reasons: ["Fe↓, Ферритин↓, ОЖСС↑", "Электрофорез: норм HbA2"] };
      }
      if (d.electrophoresis === "beta-high") {
        return { number: 2, name: "Талассемия (β)", branch, reasons: ["Fe↓, Ферритин↓, ОЖСС↑", "Электрофорез: повышен HbA2 (β)"] };
      }
      return { number: 1, name: "Железодефицитная анемия — требуется электрофорез Hb", branch, reasons: ["Fe↓, Ферритин↓, ОЖСС↑"] };
    }
    if (ferHigh && d.sideroblasts === "yes") {
      return { number: 3, name: "Сидеробластная анемия", branch, reasons: ["Ферритин↑", "Кольца сидеробластов в мазке"] };
    }
    if (d.microMorph === "unstable") return { number: 4, name: "Микроцитарная анемия (нестабильные Hb)", branch, reasons: ["Нестабильные гемоглобины"] };
    if (d.microMorph === "spherocytes") return { number: 5, name: "Наследственный сфероцитоз (HS)", branch, reasons: ["Сфероциты в мазке"] };
    if (d.microMorph === "sickle") return { number: 6, name: "Серповидно-клеточная анемия", branch, reasons: ["Серповидные клетки"] };
    return null;
  }

  if (branch === "normo") {
    if (statusOf(e.tsh, tshR) === "high") {
      reasons.push("ТТГ↑");
      return { number: 8, name: "Гипотиреоз-ассоциированная анемия", branch, reasons };
    }
    if (statusOf(e.creatinine, creatR) === "high") {
      reasons.push("Креатинин↑");
      if (e.epo !== undefined && e.epo < 3.7) {
        reasons.push("Эритропоэтин↓");
        return { number: 10, name: "Дизэритропоэтическая анемия (почечная)", branch, reasons };
      }
      return { number: 9, name: "Анемия хр. заболеваний (почечная недостаточность)", branch, reasons };
    }
    if (d.uzi === "liver") {
      return { number: 12, name: "Гемосидероз (НЖБП / АИ-гепатит)", branch, reasons: ["УЗИ: патология печени"] };
    }
    if (d.uzi && d.uzi !== "none" && d.uzi !== "norma") {
      return { number: 11, name: "Смешанная анемия хр. заболеваний", branch, reasons: [`УЗИ: ${d.uzi}`] };
    }
    return null;
  }

  if (branch === "macro") {
    const reticHigh = statusOf(e.reticulocytes, reticR) === "high";
    const biliHigh = statusOf(e.bilirubinIndirect, biliR) === "high";
    if (reticHigh && biliHigh) return { number: 13, name: "Гемолитическая анемия", branch, reasons: ["Ретикулоциты↑", "Билирубин непрямой↑"] };
    if (reticHigh && !biliHigh) return { number: 15, name: "Острая кровопотеря", branch, reasons: ["Ретикулоциты↑", "Билирубин в норме"] };
    if (statusOf(e.b12, b12R) === "low") return { number: 16, name: "B12-дефицитная (пернициозная) анемия", branch, reasons: ["B12↓"] };
    if (statusOf(e.folate, folR) === "low") return { number: 17, name: "Фолат-дефицитная анемия", branch, reasons: ["Фолат↓"] };
    if (e.morphology === "Шизоциты") return { number: 20, name: "Микроангиопатическая гемолитическая анемия", branch, reasons: ["Шизоциты в мазке"] };
    if (e.morphology === "Признаки дисплазии") return { number: 19, name: "Миелодиспластический синдром (МДС)", branch, reasons: ["Дисплазия"] };
    return null;
  }

  return null;
}
