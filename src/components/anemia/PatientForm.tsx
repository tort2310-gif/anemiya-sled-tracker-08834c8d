import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { addPatient } from "@/lib/anemia/storage";
import type { Gender } from "@/lib/anemia/types";

export function PatientForm({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<Gender>("female");

  const submit = () => {
    if (!name.trim() || !birthDate) return;
    addPatient({ name: name.trim(), birthDate, gender });
    setName(""); setBirthDate(""); setGender("female");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Новый пациент</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>ФИО</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванова А. И." />
          </div>
          <div className="grid gap-1.5">
            <Label>Дата рождения</Label>
            <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Пол</Label>
            <RadioGroup value={gender} onValueChange={(v) => setGender(v as Gender)} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem id="g-f" value="female" /><Label htmlFor="g-f">Женский</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem id="g-m" value="male" /><Label htmlFor="g-m">Мужской</Label></div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={submit}>Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
