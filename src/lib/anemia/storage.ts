import type { Patient, StoreShape, TestEntry } from "./types";

const KEY = "anemia-tracker-v1";

function emptyStore(): StoreShape {
  return { patients: [], tests: {} };
}

export function loadStore(): StoreShape {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as StoreShape;
    return { patients: parsed.patients || [], tests: parsed.tests || {} };
  } catch {
    return emptyStore();
  }
}

export function saveStore(s: StoreShape) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("anemia-store-change"));
}

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function addPatient(p: Omit<Patient, "id" | "createdAt">): Patient {
  const s = loadStore();
  const patient: Patient = { ...p, id: uid(), createdAt: new Date().toISOString() };
  s.patients.push(patient);
  s.tests[patient.id] = [];
  saveStore(s);
  return patient;
}

export function updatePatient(id: string, patch: Partial<Patient>) {
  const s = loadStore();
  s.patients = s.patients.map((p) => (p.id === id ? { ...p, ...patch } : p));
  saveStore(s);
}

export function deletePatient(id: string) {
  const s = loadStore();
  s.patients = s.patients.filter((p) => p.id !== id);
  delete s.tests[id];
  saveStore(s);
}

export function getPatient(id: string): Patient | undefined {
  return loadStore().patients.find((p) => p.id === id);
}

export function getTests(patientId: string): TestEntry[] {
  const tests = loadStore().tests[patientId] || [];
  return [...tests].sort((a, b) => a.date.localeCompare(b.date));
}

export function addTest(t: Omit<TestEntry, "id">): TestEntry {
  const s = loadStore();
  const entry: TestEntry = { ...t, id: uid() };
  s.tests[t.patientId] = [...(s.tests[t.patientId] || []), entry];
  saveStore(s);
  return entry;
}

export function updateTest(id: string, patientId: string, patch: Partial<TestEntry>) {
  const s = loadStore();
  s.tests[patientId] = (s.tests[patientId] || []).map((t) => (t.id === id ? { ...t, ...patch } : t));
  saveStore(s);
}

export function deleteTest(id: string, patientId: string) {
  const s = loadStore();
  s.tests[patientId] = (s.tests[patientId] || []).filter((t) => t.id !== id);
  saveStore(s);
}

export function exportJson(): string {
  return JSON.stringify(loadStore(), null, 2);
}

export function importJson(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as StoreShape;
    if (!parsed.patients || !parsed.tests) return false;
    saveStore(parsed);
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
