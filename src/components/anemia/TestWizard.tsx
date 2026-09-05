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
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { addTest, updateTest, errorMessage } from "@/lib/anemia/storage";
import { useInvalidateStore } from "@/hooks/use-store";
import { getRange, statusOf } from "@/lib/anemia/ranges";
import { branchColor, branchLabel, diagnose, getBranch } from "@/lib/anemia/diagnose";
import { explain } from "@/lib/anemia/explain";
import { DiagnosisResultCard } from "./DiagnosisResultCard";
import type {
  Electrophoresis,
  HemolysisTrigger,
  Organomegaly,
  Patient,
  TestEntry,
  UziFinding,
} from "@/lib/anemia/types";

interface Props {
  patient: Patient;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: TestEntry | null;
}

const today = () => new Date().toISOString().slice(0, 10);

type NumKey =
  | "hb" | "mcv" | "iron" | "tibc" | "ferritin" | "leadBlood" | "leadUrine"
  | "tsh" | "creatinine" | "urea" | "uricAcid" | "totalProtein" | "epo" | "gfr" | "ft3" | "ft4"
  | "aldosterone" | "renin" | "acth" | "prolactin" | "cortisol" | "cPeptide" | "glucose" | "hba1c"
  | "alt" | "ast" | "bilirubinDirect"
  | "reticulocytes" | "reticIndex" | "bilirubinIndirect" | "b12" | "folate" | "platelets" | "ldh";

const NUM_TO_ENTRY_KEY: Record<NumKey, keyof TestEntry> = {
  hb: "hb", mcv: "mcv", iron: "iron", tibc: "tibc", ferritin: "ferritin",
  leadBlood: "leadBlood", leadUrine: "leadUrine",
  tsh: "tsh", creatinine: "creatinine", urea: "urea", uricAcid: "uricAcid",
  totalProtein: "totalProtein", epo: "epo", gfr: "gfr", ft3: "ft3", ft4: "ft4",
  aldosterone: "aldosterone", renin: "renin", acth: "acth", prolactin: "prolactin",
  cortisol: "cortisol", cPeptide: "cPeptide", glucose: "glucose", hba1c: "hba1c",
  alt: "alt", ast: "ast", bilirubinDirect: "bilirubinDirect",
  reticulocytes: "reticulocytes", reticIndex: "reticIndex", bilirubinIndirect: "bilirubinIndirect",
  b12: "b12", folate: "folate", platelets: "platelets", ldh: "ldh",
};

interface Draft {
  date: string;
  nums: Partial<Record<NumKey, string>>;
  electrophoresis?: Electrophoresis;
  sideroblasts?: boolean;
  microMorph?: string; // drives `morphology` text for micro branch
  uziFinding?: UziFinding;
  hemolysisTrigger?: HemolysisTrigger;
  organomegaly?: Organomegaly;
  morphology?: string; // free morphology text for macro branch
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

function morphLabel(v: string): string {
  switch (v) {
    case "norma": return "Норма";
    case "unstable": return "Нестабильные Hb";
    case "spherocytes": return "Сфероциты";
    case "sickle": return "Серповидные клетки";
    default: return "";
  }
}

export function TestWizard({ patient, open, onOpenChange, initial }: Props) {
  const [step, setStep] = useState(1);
  const [d, setD] = useState<Draft>({ date: today(), nums: {}, notes: "" });
  const [saving, setSaving] = useState(false);
  const invalidateStore = useInvalidateStore();

  useEffect(() => {
    if (!open) return;
    setStep(1);
    if (initial) {
      const nums: Draft["nums"] = {};
      for (const [numKey, entryKey] of Object.entries(NUM_TO_ENTRY_KEY) as [NumKey, keyof TestEntry][]) {
        const v = initial[entryKey];
        if (typeof v === "number") nums[numKey] = String(v);
      }
      setD({
        date: initial.date,
        nums,
        notes: initial.notes || "",
        morphology: initial.morphology || "",
        electrophoresis: initial.electrophoresis,
        sideroblasts: initial.sideroblasts,
        uziFinding: initial.uziFinding,
        hemolysisTrigger: initial.hemolysisTrigger,
        organomegaly: initial.organomegaly,
      });
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

  const tshHigh = num(d.nums.tsh) !== undefined && num(d.nums.tsh)! > getRange("tsh", patient.gender).max;
  const creatHigh = num(d.nums.creatinine) !== undefined && num(d.nums.creatinine)! > getRange("creatinine", patient.gender).max;
  const ureaHigh = num(d.nums.urea) !== undefined && num(d.nums.urea)! > getRange("urea", patient.gender).max;
  const showEndocrinePanel = branch === "normo" && anemia && !tshHigh && !creatHigh && !ureaHigh;
  const reticHigh =
    num(d.nums.reticIndex) !== undefined
      ? num(d.nums.reticIndex)! >= 2
      : num(d.nums.reticulocytes) !== undefined && num(d.nums.reticulocytes)! > getRange("reticulocytes", patient.gender).max;

  // Build a TestEntry-like preview so the SAME diagnose()/explain() used
  // everywhere else in the app also drives this wizard's live preview — no
  // separate wizard-only diagnostic logic anymore.
  const entryPreview = useMemo<TestEntry>(() => {
    const numeric: Partial<TestEntry> = {};
    for (const [numKey, entryKey] of Object.entries(NUM_TO_ENTRY_KEY) as [NumKey, keyof TestEntry][]) {
      const v = num(d.nums[numKey]);
      if (v !== undefined) (numeric as Record<string, number>)[entryKey as string] = v;
    }
    return {
      id: initial?.id || "preview",
      patientId: patient.id,
      date: d.date,
      ...numeric,
      electrophoresis: d.electrophoresis,
      sideroblasts: d.sideroblasts,
      uziFinding: d.uziFinding,
      hemolysisTrigger: d.hemolysisTrigger,
      organomegaly: d.organomegaly,
      morphology: d.morphology || undefined,
      notes: d.notes || undefined,
    };
  }, [d, initial, patient.id]);

  const dx = diagnose(entryPreview, patient);

  const save = async () => {
    const { id: _id, patientId: _pid, ...payload } = entryPreview;
    setSaving(true);
    try {
      if (initial) await updateTest(initial.id, patient.id, payload);
      else await addTest({ ...payload, patientId: patient.id } as Omit<TestEntry, "id">);
      invalidateStore();
      toast.success("Сохранено ✓", { description: `Анализ от ${d.date} сохранён в профиль` });
      onOpenChange(false);
    } catch (err) {
      toast.error("Данные не сохранены", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
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
                  <Select
                    value={d.electrophoresis || "none"}
                    onValueChange={(v) => setD((p) => ({ ...p, electrophoresis: v === "none" ? undefined : (v as Electrophoresis) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не проводился</SelectItem>
                      <SelectItem value="alpha_norm">Норм HbA2 (α)</SelectItem>
                      <SelectItem value="beta_high">Повышен HbA2 (β)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Кольца сидеробластов в мазке</Label>
                  <Select
                    value={d.sideroblasts === undefined ? "unknown" : d.sideroblasts ? "yes" : "no"}
                    onValueChange={(v) => setD((p) => ({ ...p, sideroblasts: v === "unknown" ? undefined : v === "yes" }))}
                  >
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
                <FieldNum label="Свинец в крови" unit="мкг/дл" value={d.nums.leadBlood} onChange={(v) => setNum("leadBlood", v)} hint="Хроническая экспозиция" />
                <FieldNum label="Свинец в моче" unit="мкг/л" value={d.nums.leadUrine} onChange={(v) => setNum("leadUrine", v)} hint="Недавняя экспозиция" />
              </div>
            )}

            {branch === "normo" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldNum label="Железо сыворотки" unit="мкмоль/л" value={d.nums.iron} onChange={(v) => setNum("iron", v)} />
                <FieldNum label="ОЖСС" unit="мкмоль/л" value={d.nums.tibc} onChange={(v) => setNum("tibc", v)} />
                <FieldNum label="ТТГ" unit="мМЕ/л" value={d.nums.tsh} onChange={(v) => setNum("tsh", v)} />
                <FieldNum label="Креатинин" unit="мкмоль/л" value={d.nums.creatinine} onChange={(v) => setNum("creatinine", v)} />
                <FieldNum label="Мочевина" unit="ммоль/л" value={d.nums.urea} onChange={(v) => setNum("urea", v)} />
                <FieldNum label="Мочевая кислота" unit="мкмоль/л" value={d.nums.uricAcid} onChange={(v) => setNum("uricAcid", v)} />
                <FieldNum label="Общий белок" unit="г/л" value={d.nums.totalProtein} onChange={(v) => setNum("totalProtein", v)} />
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">УЗИ (брюшная полость / ЩЖ / почки и надпочечники)</Label>
                  <Select
                    value={d.uziFinding || "none"}
                    onValueChange={(v) => setD((p) => ({ ...p, uziFinding: v === "none" ? undefined : (v as UziFinding) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не указано</SelectItem>
                      <SelectItem value="normal">Норма</SelectItem>
                      <SelectItem value="abdominal">Патология брюшной полости</SelectItem>
                      <SelectItem value="renal">Патология почек</SelectItem>
                      <SelectItem value="adrenal">Патология надпочечников</SelectItem>
                      <SelectItem value="liver">Патология печени / НЖБП</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tshHigh && (
                  <>
                    <FieldNum label="Т3 свободный" unit="пмоль/л" value={d.nums.ft3} onChange={(v) => setNum("ft3", v)} />
                    <FieldNum label="Т4 свободный" unit="пмоль/л" value={d.nums.ft4} onChange={(v) => setNum("ft4", v)} />
                  </>
                )}

                {(creatHigh || ureaHigh) && (
                  <>
                    <FieldNum label="Эритропоэтин" unit="МЕ/л" value={d.nums.epo} onChange={(v) => setNum("epo", v)} />
                    <FieldNum label="СКФ" unit="мл/мин/1.73м²" value={d.nums.gfr} onChange={(v) => setNum("gfr", v)} />
                    <FieldNum label="Альдостерон" unit="пмоль/л" value={d.nums.aldosterone} onChange={(v) => setNum("aldosterone", v)} />
                    <FieldNum label="Ренин" unit="нг/(мл·ч)" value={d.nums.renin} onChange={(v) => setNum("renin", v)} />
                  </>
                )}

                {d.uziFinding === "liver" && (
                  <>
                    <FieldNum label="АЛТ" unit="Ед/л" value={d.nums.alt} onChange={(v) => setNum("alt", v)} />
                    <FieldNum label="АСТ" unit="Ед/л" value={d.nums.ast} onChange={(v) => setNum("ast", v)} />
                    <FieldNum label="Билирубин прямой" unit="мкмоль/л" value={d.nums.bilirubinDirect} onChange={(v) => setNum("bilirubinDirect", v)} />
                  </>
                )}

                {showEndocrinePanel && (
                  <div className="sm:col-span-2 rounded-md border p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      ТТГ и почечные пробы в норме — по алгоритму имеет смысл проверить эндокринную/углеводную причину:
                    </p>
                    <FieldNum label="АКТГ" unit="пг/мл" value={d.nums.acth} onChange={(v) => setNum("acth", v)} />
                    <FieldNum label="Пролактин" unit="мЕд/л" value={d.nums.prolactin} onChange={(v) => setNum("prolactin", v)} />
                    <FieldNum label="Кортизол (утро)" unit="нмоль/л" value={d.nums.cortisol} onChange={(v) => setNum("cortisol", v)} />
                    <FieldNum label="С-пептид" unit="нмоль/л" value={d.nums.cPeptide} onChange={(v) => setNum("cPeptide", v)} />
                    <FieldNum label="Глюкоза (натощак)" unit="ммоль/л" value={d.nums.glucose} onChange={(v) => setNum("glucose", v)} />
                    <FieldNum label="HbA1c" unit="%" value={d.nums.hba1c} onChange={(v) => setNum("hba1c", v)} />
                  </div>
                )}
              </div>
            )}

            {branch === "macro" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FieldNum label="Ретикулоциты" unit="%" value={d.nums.reticulocytes} onChange={(v) => setNum("reticulocytes", v)} />
                <FieldNum label="Ретикулоцитарный индекс" value={d.nums.reticIndex} onChange={(v) => setNum("reticIndex", v)}
                  hint="≥2 — адекватный ответ костного мозга, <2 — неадекватный" />
                <FieldNum label="B12" unit="пмоль/л" value={d.nums.b12} onChange={(v) => setNum("b12", v)} />
                <FieldNum label="Фолат" unit="нмоль/л" value={d.nums.folate} onChange={(v) => setNum("folate", v)} />
                <FieldNum label="Билирубин непрямой" unit="мкмоль/л" value={d.nums.bilirubinIndirect} onChange={(v) => setNum("bilirubinIndirect", v)} />
                <FieldNum label="Тромбоциты" unit="×10⁹/л" value={d.nums.platelets} onChange={(v) => setNum("platelets", v)} />
                <FieldNum label="ЛДГ" unit="Ед/л" value={d.nums.ldh} onChange={(v) => setNum("ldh", v)} />
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
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">УЗИ/КТ брюшной полости</Label>
                  <Select
                    value={d.organomegaly || "none"}
                    onValueChange={(v) => setD((p) => ({ ...p, organomegaly: v === "none" ? undefined : (v as Organomegaly) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не указано</SelectItem>
                      <SelectItem value="spleen">Спленомегалия</SelectItem>
                      <SelectItem value="liver">Гепатомегалия</SelectItem>
                      <SelectItem value="both">Спленомегалия + гепатомегалия</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {reticHigh && (
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-xs text-muted-foreground">Предполагаемый триггер гемолиза</Label>
                    <Select
                      value={d.hemolysisTrigger || "unknown"}
                      onValueChange={(v) => setD((p) => ({ ...p, hemolysisTrigger: v as HemolysisTrigger }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Не уточнён</SelectItem>
                        <SelectItem value="g6pd">Дефицит Г6ФДГ</SelectItem>
                        <SelectItem value="drug">Лекарственный препарат</SelectItem>
                        <SelectItem value="viral">Вирусная инфекция (парвовирус B19 и др.)</SelectItem>
                        <SelectItem value="autoimmune">Аутоиммунное заболевание (СКВ и др.)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
            <DiagnosisResultCard
              details={explain({
                number: !anemia ? 0 : dx.number,
                name: !anemia ? "Анемия не выявлена" : dx.name,
                branch,
                entry: entryPreview,
                patient,
              })}
            />
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
              <Button onClick={save} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
