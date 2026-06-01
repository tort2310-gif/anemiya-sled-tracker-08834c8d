import { getRange, statusOf } from "./ranges";
import type { Patient, TestEntry } from "./types";

export type Branch = "micro" | "normo" | "macro" | "unknown";

export interface Diagnosis {
  number: number;
  name: string;
  branch: Branch;
  reasons: string[];
}

export function getBranch(mcv: number | undefined): Branch {
  if (mcv === undefined) return "unknown";
  if (mcv < 80) return "micro";
  if (mcv >= 83 && mcv <= 93) return "normo";
  if (mcv > 93) return "macro";
  return "normo"; // 80–83 borderline
}

export function diagnose(entry: TestEntry, patient: Patient): Diagnosis {
  const branch = getBranch(entry.mcv);
  const reasons: string[] = [];

  const iron = entry.iron;
  const tibc = entry.tibc;
  const ferritin = entry.ferritin;
  const tsh = entry.tsh;
  const creat = entry.creatinine;
  const retic = entry.reticulocytes;
  const bili = entry.bilirubinIndirect;
  const b12 = entry.b12;
  const folate = entry.folate;
  const morph = (entry.morphology || "").toLowerCase();

  const ironR = getRange("iron", patient.gender);
  const tibcR = getRange("tibc", patient.gender);
  const ferR = getRange("ferritin", patient.gender);
  const tshR = getRange("tsh", patient.gender);
  const creatR = getRange("creatinine", patient.gender);
  const reticR = getRange("reticulocytes", patient.gender);
  const biliR = getRange("bilirubinIndirect", patient.gender);
  const b12R = getRange("b12", patient.gender);
  const folR = getRange("folate", patient.gender);

  if (branch === "micro") {
    if (
      statusOf(iron, ironR) === "low" &&
      statusOf(tibc, tibcR) === "high" &&
      statusOf(ferritin, ferR) === "low"
    ) {
      reasons.push("Железо ↓, ОЖСС ↑, Ферритин ↓");
      return { number: 1, name: "Железодефицитная анемия", branch, reasons };
    }
    if (statusOf(ferritin, ferR) === "high" && /кольц|ringed|sideroblast/.test(morph)) {
      reasons.push("Ферритин ↑, кольца сидеробластов в мазке");
      return { number: 3, name: "Сидеробластная анемия", branch, reasons };
    }
    if (/электрофор|thalass|таласс|hbf|hba2/.test(morph)) {
      reasons.push("Паттерн электрофореза Hb");
      return { number: 2, name: "Талассемия", branch, reasons };
    }
    if (/мишен|target|серп|sickle/.test(morph)) {
      reasons.push("Аномальная морфология эритроцитов");
      return { number: 5, name: "Гемоглобинопатия (HbS/HbC)", branch, reasons };
    }
    if (statusOf(ferritin, ferR) === "high") {
      reasons.push("Ферритин ↑ при микроцитозе");
      return { number: 6, name: "Анемия хронических заболеваний (микроцитарный вариант)", branch, reasons };
    }
    reasons.push("MCV ↓ без чёткого паттерна");
    return { number: 7, name: "Прочая микроцитарная анемия", branch, reasons };
  }

  if (branch === "normo") {
    if (statusOf(tsh, tshR) === "high") {
      reasons.push("ТТГ ↑");
      return { number: 8, name: "Анемия при гипотиреозе", branch, reasons };
    }
    if (statusOf(creat, creatR) === "high") {
      reasons.push("Креатинин ↑");
      return { number: 10, name: "Анемия при ХБП (почечная)", branch, reasons };
    }
    if (statusOf(ferritin, ferR) === "high" || statusOf(iron, ironR) === "low") {
      reasons.push("Признаки воспаления / перераспределения железа");
      return { number: 9, name: "Анемия хронических заболеваний", branch, reasons };
    }
    if (statusOf(retic, reticR) === "low") {
      reasons.push("Ретикулоциты ↓");
      return { number: 11, name: "Апластическая / гипопластическая анемия", branch, reasons };
    }
    reasons.push("Нормоцитарный паттерн, смешанный");
    return { number: 12, name: "Нормоцитарная анемия смешанного генеза", branch, reasons };
  }

  if (branch === "macro") {
    const reticHigh = statusOf(retic, reticR) === "high";
    const biliHigh = statusOf(bili, biliR) === "high";
    if (reticHigh && biliHigh) {
      reasons.push("Ретикулоциты ↑, билирубин непрямой ↑");
      return { number: 13, name: "Гемолитическая анемия", branch, reasons };
    }
    if (reticHigh && !biliHigh) {
      reasons.push("Ретикулоциты ↑, билирубин в норме");
      return { number: 15, name: "Острая кровопотеря", branch, reasons };
    }
    if (statusOf(b12, b12R) === "low") {
      reasons.push("B12 ↓");
      return { number: 16, name: "Пернициозная (B12-дефицитная) анемия", branch, reasons };
    }
    if (statusOf(folate, folR) === "low") {
      reasons.push("Фолат ↓");
      return { number: 17, name: "Фолат-дефицитная анемия", branch, reasons };
    }
    if (/шизоцит|schistocyt|фрагмент/.test(morph)) {
      reasons.push("Шизоциты в мазке");
      return { number: 20, name: "Микроангиопатическая гемолитическая анемия", branch, reasons };
    }
    if (/бласт|dysplas|дисплаз/.test(morph)) {
      reasons.push("Признаки дисплазии");
      return { number: 19, name: "Миелодиспластический синдром (МДС)", branch, reasons };
    }
    if (reticHigh) {
      reasons.push("Тромбоцитопения + шизоциты (подозрение)");
      return { number: 18, name: "ГУС / ТТП", branch, reasons };
    }
    reasons.push("Макроцитоз без чёткого паттерна");
    return { number: 14, name: "Прочая макроцитарная анемия", branch, reasons };
  }

  return { number: 0, name: "Недостаточно данных (укажите MCV)", branch: "unknown", reasons: [] };
}

export function branchColor(b: Branch): string {
  switch (b) {
    case "micro":
      return "var(--branch-micro)";
    case "normo":
      return "var(--branch-normo)";
    case "macro":
      return "var(--branch-macro)";
    default:
      return "var(--muted-foreground)";
  }
}

export function branchLabel(b: Branch): string {
  switch (b) {
    case "micro":
      return "Микроцитарная";
    case "normo":
      return "Нормоцитарная";
    case "macro":
      return "Макроцитарная";
    default:
      return "—";
  }
}
