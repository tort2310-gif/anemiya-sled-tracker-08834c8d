import { supabase } from "@/integrations/supabase/client";
import type { Patient, StoreShape, TestEntry } from "./types";

// Data lives in Supabase (tables `patients` / `test_entries`, RLS scoped to
// the current user) — see migrations:
//   supabase/migrations/20260903120000_add_patients_and_test_entries.sql
//   supabase/migrations/20260905000000_add_diagnostic_detail_fields.sql

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
  electrophoresis: string | null;
  sideroblasts: boolean | null;
  lead_blood: number | null;
  lead_urine: number | null;
  tsh: number | null;
  creatinine: number | null;
  urea: number | null;
  uric_acid: number | null;
  total_protein: number | null;
  epo: number | null;
  gfr: number | null;
  ft3: number | null;
  ft4: number | null;
  uzi_finding: string | null;
  aldosterone: number | null;
  renin: number | null;
  acth: number | null;
  prolactin: number | null;
  cortisol: number | null;
  c_peptide: number | null;
  glucose: number | null;
  hba1c: number | null;
  alt: number | null;
  ast: number | null;
  bilirubin_direct: number | null;
  reticulocytes: number | null;
  retic_index: number | null;
  bilirubin_indirect: number | null;
  b12: number | null;
  folate: number | null;
  hemolysis_trigger: string | null;
  platelets: number | null;
  ldh: number | null;
  organomegaly: string | null;
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
    electrophoresis: (row.electrophoresis as TestEntry["electrophoresis"]) ?? undefined,
    sideroblasts: row.sideroblasts ?? undefined,
    leadBlood: row.lead_blood ?? undefined,
    leadUrine: row.lead_urine ?? undefined,
    tsh: row.tsh ?? undefined,
    creatinine: row.creatinine ?? undefined,
    urea: row.urea ?? undefined,
    uricAcid: row.uric_acid ?? undefined,
    totalProtein: row.total_protein ?? undefined,
    epo: row.epo ?? undefined,
    gfr: row.gfr ?? undefined,
    ft3: row.ft3 ?? undefined,
    ft4: row.ft4 ?? undefined,
    uziFinding: (row.uzi_finding as TestEntry["uziFinding"]) ?? undefined,
    aldosterone: row.aldosterone ?? undefined,
    renin: row.renin ?? undefined,
    acth: row.acth ?? undefined,
    prolactin: row.prolactin ?? undefined,
    cortisol: row.cortisol ?? undefined,
    cPeptide: row.c_peptide ?? undefined,
    glucose: row.glucose ?? undefined,
    hba1c: row.hba1c ?? undefined,
    alt: row.alt ?? undefined,
    ast: row.ast ?? undefined,
    bilirubinDirect: row.bilirubin_direct ?? undefined,
    reticulocytes: row.reticulocytes ?? undefined,
    reticIndex: row.retic_index ?? undefined,
    bilirubinIndirect: row.bilirubin_indirect ?? undefined,
    b12: row.b12 ?? undefined,
    folate: row.folate ?? undefined,
    hemolysisTrigger: (row.hemolysis_trigger as TestEntry["hemolysisTrigger"]) ?? undefined,
    platelets: row.platelets ?? undefined,
    ldh: row.ldh ?? undefined,
    organomegaly: (row.organomegaly as TestEntry["organomegaly"]) ?? undefined,
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

// camelCase TestEntry key -> snake_case DB column, for every optional lab field.
const TEST_ENTRY_COLUMNS: Record<string, string> = {
  date: "date",
  mcv: "mcv",
  hb: "hb",
  iron: "iron",
  tibc: "tibc",
  ferritin: "ferritin",
  electrophoresis: "electrophoresis",
  sideroblasts: "sideroblasts",
  leadBlood: "lead_blood",
  leadUrine: "lead_urine",
  tsh: "tsh",
  creatinine: "creatinine",
  urea: "urea",
  uricAcid: "uric_acid",
  totalProtein: "total_protein",
  epo: "epo",
  gfr: "gfr",
  ft3: "ft3",
  ft4: "ft4",
  uziFinding: "uzi_finding",
  aldosterone: "aldosterone",
  renin: "renin",
  acth: "acth",
  prolactin: "prolactin",
  cortisol: "cortisol",
  cPeptide: "c_peptide",
  glucose: "glucose",
  hba1c: "hba1c",
  alt: "alt",
  ast: "ast",
  bilirubinDirect: "bilirubin_direct",
  reticulocytes: "reticulocytes",
  reticIndex: "retic_index",
  bilirubinIndirect: "bilirubin_indirect",
  b12: "b12",
  folate: "folate",
  hemolysisTrigger: "hemolysis_trigger",
  platelets: "platelets",
  ldh: "ldh",
  organomegaly: "organomegaly",
  morphology: "morphology",
  notes: "notes",
};

function toRow(t: Partial<TestEntry>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(TEST_ENTRY_COLUMNS)) {
    const value = (t as Record<string, unknown>)[key];
    if (value !== undefined) row[column] = value;
  }
  return row;
}

export async function addTest(t: Omit<TestEntry, "id">): Promise<TestEntry> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("test_entries")
    .insert({ user_id: userId, patient_id: t.patientId, ...toRow(t) })
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
  const { error } = await supabase
    .from("test_entries")
    .update(toRow(patch))
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
