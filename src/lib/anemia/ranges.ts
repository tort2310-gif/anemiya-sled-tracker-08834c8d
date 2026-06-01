import type { Gender, LabKey } from "./types";

export interface Range {
  min: number;
  max: number;
  unit: string;
  label: string;
}

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
    case "tsh":
      return { min: 0.4, max: 4.0, unit: "мМЕ/л", label: "ТТГ" };
    case "reticulocytes":
      return { min: 0.5, max: 2.5, unit: "%", label: "Ретикулоциты" };
    case "bilirubinIndirect":
      return { min: 3.4, max: 17, unit: "мкмоль/л", label: "Билирубин непрямой" };
    case "creatinine":
      return gender === "female"
        ? { min: 44, max: 97, unit: "мкмоль/л", label: "Креатинин" }
        : { min: 62, max: 115, unit: "мкмоль/л", label: "Креатинин" };
    case "b12":
      return { min: 148, max: 740, unit: "пмоль/л", label: "B12" };
    case "folate":
      return { min: 7, max: 45, unit: "нмоль/л", label: "Фолат" };
    case "epo":
      return { min: 3.7, max: 29.5, unit: "МЕ/л", label: "Эритропоэтин" };
  }
}

export const ALL_LAB_KEYS: LabKey[] = [
  "hb",
  "mcv",
  "iron",
  "ferritin",
  "tibc",
  "tsh",
  "reticulocytes",
  "bilirubinIndirect",
  "creatinine",
  "b12",
  "folate",
  "epo",
];

export function statusOf(value: number | undefined, r: Range): "low" | "high" | "ok" | "na" {
  if (value === undefined || value === null || Number.isNaN(value)) return "na";
  if (value < r.min) return "low";
  if (value > r.max) return "high";
  return "ok";
}
