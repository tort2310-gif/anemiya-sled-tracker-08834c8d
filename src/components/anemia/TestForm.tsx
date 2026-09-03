import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addTest, updateTest, errorMessage } from "@/lib/anemia/storage";
import { useInvalidateStore } from "@/hooks/use-store";
import type { TestEntry } from "@/lib/anemia/types";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);

interface Props {
  patientId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: TestEntry | null;
}

type FieldDef = { key: keyof TestEntry; label: string; unit?: string };

const NUMERIC_FIELDS: FieldDef[] = [
  { key: "mcv", label: "MCV", unit: "фл" },
  { key: "hb", label: "Гемоглобин Hb", unit: "г/л" },
  { key: "iron", label: "Железо сыворотки", unit: "мкмоль/л" },
  { key: "tibc", label: "ОЖСС", unit: "мкмоль/л" },
  { key: "ferritin", label: "Ферритин", unit: "мкг/л" },
  { key: "tsh", label: "ТТГ", unit: "мМЕ/л" },
  { key: "reticulocytes", label: "Ретикулоциты", unit: "%" },
  { key: "reticIndex", label: "Ретикулоцитарный индекс" },
  { key: "bilirubinIndirect", label: "Билирубин непрямой", unit: "мкмоль/л" },
  { key: "creatinine", label: "Креатинин", unit: "мкмоль/л" },
  { key: "b12", label: "B12", unit: "пмоль/л" },
  { key: "folate", label: "Фолат", unit: "нмоль/л" },
  { key: "epo", label: "Эритропоэтин", unit: "МЕ/л" },
];

export function TestForm({ patientId, open, onOpenChange, initial }: Props) {
  const [date, setDate] = useState(today());
  const [values, setValues] = useState<Record<string, string>>({});
  const [morphology, setMorphology] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const invalidateStore = useInvalidateStore();

  useEffect(() => {
    if (open) {
      if (initial) {
        setDate(initial.date);
        const v: Record<string, string> = {};
        for (const f of NUMERIC_FIELDS) {
          const val = initial[f.key as keyof TestEntry];
          if (typeof val === "number") v[f.key as string] = String(val);
        }
        setValues(v);
        setMorphology(initial.morphology || "");
        setNotes(initial.notes || "");
      } else {
        setDate(today());
        setValues({});
        setMorphology("");
        setNotes("");
      }
    }
  }, [open, initial]);

  const submit = async () => {
    const numeric: Partial<TestEntry> = {};
    for (const f of NUMERIC_FIELDS) {
      const raw = values[f.key as string];
      if (raw && raw.trim() !== "") {
        const n = Number(raw.replace(",", "."));
        if (!Number.isNaN(n)) (numeric as Record<string, number>)[f.key as string] = n;
      }
    }
    const data = {
      patientId,
      date,
      ...numeric,
      morphology: morphology || undefined,
      notes: notes || undefined,
    } as Omit<TestEntry, "id">;
    setSaving(true);
    try {
      if (initial) await updateTest(initial.id, patientId, data);
      else await addTest(data);
      invalidateStore();
      onOpenChange(false);
    } catch (err) {
      toast.error("Не удалось сохранить анализ", { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Редактировать анализ" : "Добавить анализ"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="date">Дата анализа</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NUMERIC_FIELDS.map((f) => (
              <div key={f.key as string} className="grid gap-1.5">
                <Label htmlFor={f.key as string} className="text-xs text-muted-foreground">
                  {f.label} {f.unit ? <span className="opacity-60">({f.unit})</span> : null}
                </Label>
                <Input
                  id={f.key as string}
                  inputMode="decimal"
                  value={values[f.key as string] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key as string]: e.target.value }))
                  }
                  placeholder="—"
                />
              </div>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label>Морфология эритроцитов</Label>
            <Select value={morphology || "none"} onValueChange={(v) => setMorphology(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не указано</SelectItem>
                <SelectItem value="Норма">Норма</SelectItem>
                <SelectItem value="Кольца сидеробластов">Кольца сидеробластов</SelectItem>
                <SelectItem value="Мишеневидные клетки">Мишеневидные клетки</SelectItem>
                <SelectItem value="Серповидные клетки">Серповидные клетки</SelectItem>
                <SelectItem value="Шизоциты">Шизоциты (фрагменты)</SelectItem>
                <SelectItem value="Электрофорез: HbF/HbA2 повышен">Электрофорез: HbF/HbA2 ↑</SelectItem>
                <SelectItem value="Признаки дисплазии">Признаки дисплазии</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Примечания</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
