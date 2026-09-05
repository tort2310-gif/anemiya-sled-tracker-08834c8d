import type { Gender, LabKey } from "./types";

export interface Range {
  min: number;
  max: number;
  unit: string;
  label: string;
}

// Reference ranges below are commonly-cited adult values. Several (aldosterone,
// renin, ACTH, prolactin, cortisol, LDH) vary meaningfully by lab/assay/method
// and by time of day/posture — treat these as a rough guide, not a substitute
// for the reporting lab's own reference range.
export function getRange(key: LabKey, gender: Gender): Range {
  switch (key) {
    case "hb":
      return gender === "female"
        ? { min: 120, max: 160, unit: "г/л", label: "Гемоглобин" }
        : { min: 130, max: 170, unit: "г/л", label: "Гемоглобин" };
    case "mcv":
      return { min: 80, max: 100, unit: "фл", label: "MCV" };
    case "iron":
      return { min: 9, max: 30, unit: "мкмоль/л", label: "Железо сыворотки" };
    case "ferritin":
      return gender === "female"
        ? { min: 12, max: 150, unit: "мкг/л", label: "Ферритин" }
        : { min: 15, max: 200, unit: "мкг/л", label: "Ферритин" };
    case "tibc":
      return { min: 45, max: 72, unit: "мкмоль/л", label: "ОЖСС" };
    case "leadBlood":
      return { min: 0, max: 5, unit: "мкг/дл", label: "Свинец в крови" };
    case "leadUrine":
      return { min: 0, max: 50, unit: "мкг/л", label: "Свинец в моче" };
    case "tsh":
      return { min: 0.4, max: 4.0, unit: "мМЕ/л", label: "ТТГ" };
    case "creatinine":
      return gender === "female"
        ? { min: 44, max: 97, unit: "мкмоль/л", label: "Креатинин" }
        : { min: 62, max: 115, unit: "мкмоль/л", label: "Креатинин" };
    case "urea":
      return { min: 2.5, max: 7.1, unit: "ммоль/л", label: "Мочевина" };
    case "uricAcid":
      return gender === "female"
        ? { min: 143, max: 339, unit: "мкмоль/л", label: "Мочевая кислота" }
        : { min: 202, max: 416, unit: "мкмоль/л", label: "Мочевая кислота" };
    case "totalProtein":
      return { min: 64, max: 83, unit: "г/л", label: "Общий белок" };
    case "epo":
      return { min: 3.7, max: 29.5, unit: "МЕ/л", label: "Эритропоэтин" };
    case "gfr":
      return { min: 90, max: 200, unit: "мл/мин/1.73м²", label: "СКФ" };
    case "ft3":
      return { min: 3.1, max: 6.8, unit: "пмоль/л", label: "Т3 свободный" };
    case "ft4":
      return { min: 9.0, max: 22.0, unit: "пмоль/л", label: "Т4 свободный" };
    case "aldosterone":
      return { min: 100, max: 444, unit: "пмоль/л", label: "Альдостерон" };
    case "renin":
      return { min: 0.2, max: 1.9, unit: "нг/(мл·ч)", label: "Ренин" };
    case "acth":
      return { min: 7.2, max: 63.3, unit: "пг/мл", label: "АКТГ" };
    case "prolactin":
      return gender === "female"
        ? { min: 102, max: 496, unit: "мЕд/л", label: "Пролактин" }
        : { min: 86, max: 324, unit: "мЕд/л", label: "Пролактин" };
    case "cortisol":
      return { min: 138, max: 635, unit: "нмоль/л", label: "Кортизол (утро)" };
    case "cPeptide":
      return { min: 0.3, max: 2.35, unit: "нмоль/л", label: "С-пептид" };
    case "glucose":
      return { min: 3.9, max: 5.5, unit: "ммоль/л", label: "Глюкоза (натощак)" };
    case "hba1c":
      return { min: 4.0, max: 6.0, unit: "%", label: "Гликированный Hb (HbA1c)" };
    case "alt":
      return gender === "female"
        ? { min: 0, max: 31, unit: "Ед/л", label: "АЛТ" }
        : { min: 0, max: 41, unit: "Ед/л", label: "АЛТ" };
    case "ast":
      return gender === "female"
        ? { min: 0, max: 31, unit: "Ед/л", label: "АСТ" }
        : { min: 0, max: 35, unit: "Ед/л", label: "АСТ" };
    case "bilirubinDirect":
      return { min: 0, max: 5.1, unit: "мкмоль/л", label: "Билирубин прямой" };
    case "reticulocytes":
      return { min: 0.5, max: 2.5, unit: "%", label: "Ретикулоциты" };
    case "bilirubinIndirect":
      return { min: 3.4, max: 17, unit: "мкмоль/л", label: "Билирубин непрямой" };
    case "b12":
      return { min: 148, max: 740, unit: "пмоль/л", label: "B12" };
    case "folate":
      return { min: 7, max: 45, unit: "нмоль/л", label: "Фолат" };
    case "platelets":
      return { min: 150, max: 400, unit: "×10⁹/л", label: "Тромбоциты" };
    case "ldh":
      return { min: 125, max: 220, unit: "Ед/л", label: "ЛДГ" };
  }
}

export const ALL_LAB_KEYS: LabKey[] = [
  "hb",
  "mcv",
  "iron",
  "ferritin",
  "tibc",
  "leadBlood",
  "leadUrine",
  "tsh",
  "creatinine",
  "urea",
  "uricAcid",
  "totalProtein",
  "epo",
  "gfr",
  "ft3",
  "ft4",
  "aldosterone",
  "renin",
  "acth",
  "prolactin",
  "cortisol",
  "cPeptide",
  "glucose",
  "hba1c",
  "alt",
  "ast",
  "bilirubinDirect",
  "reticulocytes",
  "bilirubinIndirect",
  "b12",
  "folate",
  "platelets",
  "ldh",
];

export function statusOf(value: number | undefined, r: Range): "low" | "high" | "ok" | "na" {
  if (value === undefined || value === null || Number.isNaN(value)) return "na";
  if (value < r.min) return "low";
  if (value > r.max) return "high";
  return "ok";
}

// Reticulocyte production index is already corrected for the degree of anemia,
// so a fixed min/max like the other labs doesn't really apply — instead it's
// read as "adequate" (marrow is responding — hemolysis/blood loss) vs
// "inadequate" (production failure) using the standard clinical cutoff of 2.
export function reticIndexStatus(value: number | undefined): "adequate" | "inadequate" | "na" {
  if (value === undefined || value === null || Number.isNaN(value)) return "na";
  return value >= 2 ? "adequate" : "inadequate";
}
