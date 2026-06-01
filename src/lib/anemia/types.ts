export type Gender = "female" | "male";

export interface Patient {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  gender: Gender;
  createdAt: string;
}

export interface TestEntry {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  mcv?: number;
  hb?: number;
  iron?: number;
  tibc?: number;
  ferritin?: number;
  tsh?: number;
  reticulocytes?: number;
  reticIndex?: number;
  bilirubinIndirect?: number;
  creatinine?: number;
  b12?: number;
  folate?: number;
  epo?: number;
  morphology?: string;
  notes?: string;
}

export interface StoreShape {
  patients: Patient[];
  tests: Record<string, TestEntry[]>;
}

export type LabKey =
  | "hb"
  | "mcv"
  | "iron"
  | "tibc"
  | "ferritin"
  | "tsh"
  | "reticulocytes"
  | "bilirubinIndirect"
  | "creatinine"
  | "b12"
  | "folate"
  | "epo";
