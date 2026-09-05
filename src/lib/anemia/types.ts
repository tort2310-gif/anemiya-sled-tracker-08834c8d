export type Gender = "female" | "male";

export interface Patient {
  id: string;
  name: string;
  birthDate: string; // YYYY-MM-DD
  gender: Gender;
  createdAt: string;
}

// Hb electrophoresis result — distinguishes iron-deficiency anemia from
// alpha/beta-thalassemia when initial iron-panel pattern looks similar.
export type Electrophoresis = "alpha_norm" | "beta_high";

// Ultrasound finding used in the normocytic branch (thyroid/renal/adrenal/
// abdominal workup) to route toward chronic-disease anemia (#11) vs
// hemosiderosis/liver disease (#12).
export type UziFinding = "normal" | "abdominal" | "renal" | "adrenal" | "liver";

// What triggered hemolysis — distinguishes #13 (G6PD/drug) from #14
// (viral/autoimmune RBC damage).
export type HemolysisTrigger = "drug" | "g6pd" | "viral" | "autoimmune" | "unknown";

// Spleen/liver enlargement on ultrasound/CT — supporting evidence for
// microangiopathic hemolytic anemia (#20) and general macrocytic workup.
export type Organomegaly = "none" | "spleen" | "liver" | "both";

export interface TestEntry {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  mcv?: number;
  hb?: number;

  // --- Microcytic-branch labs ---
  iron?: number;
  tibc?: number;
  ferritin?: number;
  electrophoresis?: Electrophoresis;
  sideroblasts?: boolean; // ring sideroblasts seen on smear
  leadBlood?: number;
  leadUrine?: number;

  // --- Normocytic-branch labs ---
  tsh?: number;
  creatinine?: number;
  urea?: number;
  uricAcid?: number;
  totalProtein?: number;
  epo?: number;
  gfr?: number;
  ft3?: number;
  ft4?: number;
  uziFinding?: UziFinding;
  aldosterone?: number;
  renin?: number;
  // Secondary endocrine workup (only relevant once TSH comes back normal)
  acth?: number;
  prolactin?: number;
  cortisol?: number;
  cPeptide?: number;
  glucose?: number;
  hba1c?: number;
  // Liver panel (only relevant once UZI points at the liver)
  alt?: number;
  ast?: number;
  bilirubinDirect?: number;

  // --- Macrocytic-branch labs ---
  reticulocytes?: number;
  reticIndex?: number;
  bilirubinIndirect?: number;
  b12?: number;
  folate?: number;
  hemolysisTrigger?: HemolysisTrigger;
  platelets?: number;
  ldh?: number;
  organomegaly?: Organomegaly;

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
  | "leadBlood"
  | "leadUrine"
  | "tsh"
  | "creatinine"
  | "urea"
  | "uricAcid"
  | "totalProtein"
  | "epo"
  | "gfr"
  | "ft3"
  | "ft4"
  | "aldosterone"
  | "renin"
  | "acth"
  | "prolactin"
  | "cortisol"
  | "cPeptide"
  | "glucose"
  | "hba1c"
  | "alt"
  | "ast"
  | "bilirubinDirect"
  | "reticulocytes"
  | "bilirubinIndirect"
  | "b12"
  | "folate"
  | "platelets"
  | "ldh";
