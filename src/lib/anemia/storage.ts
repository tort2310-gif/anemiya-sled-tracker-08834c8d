import { supabase } from "@/integrations/supabase/client";
import type { Patient, StoreShape, TestEntry } from "./types";

// Data now lives in Supabase (tables `patients` / `test_entries`, RLS scoped to
// the current user), instead of localStorage — see migration
// supabase/migrations/20260903120000_add_patients_and_test_entries.sql

// Supabase/Postgrest errors are plain objects, not Error instances —
// String(err) on them yields "[object Object]". Use this wherever an error
// from storage.ts is shown to the user (e.g. in a toast).
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "Неизвестная ошибка";
}

type PatientRow = {
  id: string;
  name: string;
  birth_date: string;
  gender: string;
  created_at: string;
};

type TestEntryRow = {
  id: string;
  patient_id: string;
  date: string;
  mcv: number | null;
  hb: number | null;
  iron: number | null;
  tibc: number | null;
  ferritin: number | null;
  tsh: number | null;
  reticulocytes: number | null;
  retic_index: number | null;
  bilirubin_indirect: number | null;
  creatinine: number | null;
  b12: number | null;
  folate: number | null;
  epo: number | null;
  morphology: string | null;
  notes: string | null;
};

function mapPatientRow(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    gender: row.gender as Patient["gender"],
    createdAt: row.created_at,
  };
}

function mapTestRow(row: TestEntryRow): TestEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    date: row.date,
    mcv: row.mcv ?? undefined,
    hb: row.hb ?? undefined,
    iron: row.iron ?? undefined,
    tibc: row.tibc ?? undefined,
    ferritin: row.ferritin ?? undefined,
    tsh: row.tsh ?? undefined,
    reticulocytes: row.reticulocytes ?? undefined,
    reticIndex: row.retic_index ?? undefined,
    bilirubinIndirect: row.bilirubin_indirect ?? undefined,
    creatinine: row.creatinine ?? undefined,
    b12: row.b12 ?? undefined,
    folate: row.folate ?? undefined,
    epo: row.epo ?? undefined,
    morphology: row.morphology ?? undefined,
    notes: row.notes ?? undefined,
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Не авторизован");
  return data.user.id;
}

export async function getStore(): Promise<StoreShape> {
  const [{ data: patientRows, error: pErr }, { data: testRows, error: tErr }] = await Promise.all([
    supabase.from("patients").select("*").order("name"),
    supabase.from("test_entries").select("*").order("date"),
  ]);
  if (pErr) throw pErr;
  if (tErr) throw tErr;

  const patients = (patientRows || []).map((r) => mapPatientRow(r as PatientRow));
  const tests: Record<string, TestEntry[]> = {};
  for (const p of patients) tests[p.id] = [];
  for (const row of (testRows || []) as TestEntryRow[]) {
    const t = mapTestRow(row);
    (tests[t.patientId] ??= []).push(t);
  }
  return { patients, tests };
}

export async function getPatient(id: string): Promise<Patient | undefined> {
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapPatientRow(data as PatientRow) : undefined;
}

export async function getTests(patientId: string): Promise<TestEntry[]> {
  const { data, error } = await supabase
    .from("test_entries")
    .select("*")
    .eq("patient_id", patientId)
    .order("date");
  if (error) throw error;
  return ((data || []) as TestEntryRow[]).map(mapTestRow);
}

export async function addPatient(p: Omit<Patient, "id" | "createdAt">): Promise<Patient> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("patients")
    .insert({ user_id: userId, name: p.name, birth_date: p.birthDate, gender: p.gender })
    .select()
    .single();
  if (error) throw error;
  return mapPatientRow(data as PatientRow);
}

export async function updatePatient(id: string, patch: Partial<Patient>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.birthDate !== undefined) update.birth_date = patch.birthDate;
  if (patch.gender !== undefined) update.gender = patch.gender;
  const { error } = await supabase.from("patients").update(update).eq("id", id);
  if (error) throw error;
}

export async function deletePatient(id: string): Promise<void> {
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) throw error;
}

export async function addTest(t: Omit<TestEntry, "id">): Promise<TestEntry> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("test_entries")
    .insert({
      user_id: userId,
      patient_id: t.patientId,
      date: t.date,
      mcv: t.mcv ?? null,
      hb: t.hb ?? null,
      iron: t.iron ?? null,
      tibc: t.tibc ?? null,
      ferritin: t.ferritin ?? null,
      tsh: t.tsh ?? null,
      reticulocytes: t.reticulocytes ?? null,
      retic_index: t.reticIndex ?? null,
      bilirubin_indirect: t.bilirubinIndirect ?? null,
      creatinine: t.creatinine ?? null,
      b12: t.b12 ?? null,
      folate: t.folate ?? null,
      epo: t.epo ?? null,
      morphology: t.morphology ?? null,
      notes: t.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapTestRow(data as TestEntryRow);
}

export async function updateTest(
  id: string,
  patientId: string,
  patch: Partial<TestEntry>,
): Promise<void> {
  const columnByKey: Record<string, string> = {
    date: "date",
    mcv: "mcv",
    hb: "hb",
    iron: "iron",
    tibc: "tibc",
    ferritin: "ferritin",
    tsh: "tsh",
    reticulocytes: "reticulocytes",
    reticIndex: "retic_index",
    bilirubinIndirect: "bilirubin_indirect",
    creatinine: "creatinine",
    b12: "b12",
    folate: "folate",
    epo: "epo",
    morphology: "morphology",
    notes: "notes",
  };
  const update: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(columnByKey)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) update[column] = value;
  }
  const { error } = await supabase
    .from("test_entries")
    .update(update)
    .eq("id", id)
    .eq("patient_id", patientId);
  if (error) throw error;
}

export async function deleteTest(id: string, patientId: string): Promise<void> {
  const { error } = await supabase
    .from("test_entries")
    .delete()
    .eq("id", id)
    .eq("patient_id", patientId);
  if (error) throw error;
}

export async function exportJson(): Promise<string> {
  const store = await getStore();
  return JSON.stringify(store, null, 2);
}

export async function importJson(text: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(text) as StoreShape;
    if (!parsed.patients || !parsed.tests) return false;

    const idMap: Record<string, string> = {};
    for (const p of parsed.patients) {
      const created = await addPatient({ name: p.name, birthDate: p.birthDate, gender: p.gender });
      idMap[p.id] = created.id;
    }
    for (const [oldPatientId, entries] of Object.entries(parsed.tests)) {
      const newPatientId = idMap[oldPatientId];
      if (!newPatientId) continue;
      for (const t of entries) {
        const { id: _oldId, patientId: _oldPatientId, ...rest } = t;
        await addTest({ ...rest, patientId: newPatientId });
      }
    }
    return true;
  } catch {
    return false;
  }
}

export function ageFrom(birth: string): number {
  const b = new Date(birth);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}
