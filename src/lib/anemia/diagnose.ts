import { getRange, statusOf, reticIndexStatus } from "./ranges";
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

function insufficientData(branch: Branch, reason: string): Diagnosis {
  return { number: 0, name: "Недостаточно данных для уточнения диагноза", branch, reasons: [reason] };
}

// This engine follows the reference algorithm (АНЕМИЯ_Алгоритм.pdf, О. Терехова,
// 2024) directly — every branch below matches a specific leaf on that flowchart.
// Where a leaf can't be confidently reached (data missing), it deliberately
// returns "недостаточно данных" (#0) rather than guessing — the source diagram
// has no generic "other/unclear" catch-all, and neither should this function.
export function diagnose(entry: TestEntry, patient: Patient): Diagnosis {
  const branch = getBranch(entry.mcv);
  const morph = (entry.morphology || "").toLowerCase();
  const note = (entry.notes || "").toLowerCase();

  const ironR = getRange("iron", patient.gender);
  const tibcR = getRange("tibc", patient.gender);
  const ferR = getRange("ferritin", patient.gender);
  const leadBloodR = getRange("leadBlood", patient.gender);
  const leadUrineR = getRange("leadUrine", patient.gender);
  const tshR = getRange("tsh", patient.gender);
  const creatR = getRange("creatinine", patient.gender);
  const ureaR = getRange("urea", patient.gender);
  const epoR = getRange("epo", patient.gender);
  const reticR = getRange("reticulocytes", patient.gender);
  const biliR = getRange("bilirubinIndirect", patient.gender);
  const b12R = getRange("b12", patient.gender);
  const folR = getRange("folate", patient.gender);
  const pltR = getRange("platelets", patient.gender);
  const ldhR = getRange("ldh", patient.gender);

  // ---------------------------------------------------------------
  if (branch === "micro") {
    const ironLow = statusOf(entry.iron, ironR) === "low";
    const tibcHigh = statusOf(entry.tibc, tibcR) === "high";
    const ferLow = statusOf(entry.ferritin, ferR) === "low";
    const ferHigh = statusOf(entry.ferritin, ferR) === "high";
    const ringSideroblasts = entry.sideroblasts === true || /кольц|ringed|sideroblast/.test(morph);

    // #3 Сидеробластная анемия — ferritin↑ + ring sideroblasts
    if (ferHigh && ringSideroblasts) {
      return { number: 3, name: "Сидеробластная анемия", branch, reasons: ["Ферритин ↑", "Кольца сидеробластов в мазке"] };
    }

    // #2 Талассемия (β) — electrophoresis shows HbA2 elevated
    if (entry.electrophoresis === "beta_high" || /таласс|thalass|hba2/.test(morph)) {
      return { number: 2, name: "Талассемия (β)", branch, reasons: ["Электрофорез: HbA2 повышен"] };
    }

    // #1 Железодефицитная анемия — classic iron-deficiency pattern
    if (ironLow && tibcHigh && ferLow) {
      const reasons = ["Железо ↓, ОЖСС ↑, Ферритин ↓"];
      if (entry.electrophoresis === "alpha_norm") reasons.push("Электрофорез: норма");
      return { number: 1, name: "Железодефицитная анемия", branch, reasons };
    }

    // #4 Микроцитарная анемия (нестабильные Hb)
    if (/нестабильн|unstable/.test(morph)) {
      return { number: 4, name: "Микроцитарная анемия (нестабильные гемоглобины)", branch, reasons: ["Морфология: нестабильные Hb"] };
    }

    // #5 HS наследственный сфероцитоз
    if (/сфероцит|spherocyt/.test(morph)) {
      return { number: 5, name: "Наследственный сфероцитоз (HS)", branch, reasons: ["Сфероциты в мазке"] };
    }

    // #6 Серповидно-клеточная анемия
    if (/серповид|sickle/.test(morph)) {
      return { number: 6, name: "Серповидно-клеточная анемия", branch, reasons: ["Серповидные клетки в мазке"] };
    }

    // #7 Отравление свинцом — blood lead = chronic exposure, urine lead = recent exposure
    const leadBloodHigh = statusOf(entry.leadBlood, leadBloodR) === "high";
    const leadUrineHigh = statusOf(entry.leadUrine, leadUrineR) === "high";
    if (leadBloodHigh || leadUrineHigh || /свин|lead/.test(note)) {
      const reasons: string[] = [];
      if (leadBloodHigh) reasons.push("Свинец в крови ↑ (хроническая экспозиция)");
      if (leadUrineHigh) reasons.push("Свинец в моче ↑ (недавняя экспозиция)");
      if (!reasons.length) reasons.push("Указание на контакт со свинцом в анамнезе");
      return { number: 7, name: "Отравление свинцом", branch, reasons };
    }

    // Electrophoresis normal but iron studies don't fit classic IDA — the
    // source flowchart pairs this with "Норм HbA2 → alpha-thalassemia" as an
    // alternative to work up (not a separately numbered diagnosis).
    if (entry.electrophoresis === "alpha_norm" && !ironLow && !ferLow) {
      return insufficientData(branch, "Электрофорез в норме, железо/ферритин в норме — возможна альфа-талассемия, требуется генетическое тестирование (HBA1/HBA2)");
    }

    return insufficientData(branch, "Ни один из специфических микроцитарных паттернов не подтверждён — досдать электрофорез Hb, ферритин, морфологию эритроцитов");
  }

  // ---------------------------------------------------------------
  if (branch === "normo") {
    // #8 Анемия при гипотиреозе
    if (statusOf(entry.tsh, tshR) === "high") {
      return { number: 8, name: "Анемия при гипотиреозе", branch, reasons: ["ТТГ ↑"] };
    }

    // #10 / #9 — creatinine or urea change routes toward chronic-disease/renal anemia
    const creatHigh = statusOf(entry.creatinine, creatR) === "high";
    const ureaHigh = statusOf(entry.urea, ureaR) === "high";
    if (creatHigh || ureaHigh) {
      if (statusOf(entry.epo, epoR) === "low") {
        return {
          number: 10,
          name: "Дизэритропоэтическая (почечная) анемия",
          branch,
          reasons: ["Креатинин/мочевина ↑", "Эритропоэтин ↓ — снижена продукция ЭПО почками"],
        };
      }
      return {
        number: 9,
        name: "Анемия хронических заболеваний (почечная недостаточность)",
        branch,
        reasons: ["Креатинин/мочевина ↑ — направление к урологу"],
      };
    }

    // #12 Гемосидероз — UZI points at the liver
    if (entry.uziFinding === "liver") {
      return { number: 12, name: "Гемосидероз (НЖБП / АИ-гепатит)", branch, reasons: ["УЗИ: патология печени"] };
    }

    // #11 Смешанная макро-микроцитарная анемия — UZI finds chronic disease elsewhere
    if (entry.uziFinding && entry.uziFinding !== "normal") {
      return {
        number: 11,
        name: "Смешанная анемия хронических заболеваний",
        branch,
        reasons: [`УЗИ: патология вне печени (${entry.uziFinding})`],
      };
    }

    // Cross-branch fallthrough: abnormal smear morphology at normal MCV still
    // routes to the macrocytic-branch leaves that actually depend on morphology,
    // not MCV — matches the source's explicit "см. раздел МАКРОЦИТОВ ниже" note.
    if (/бласт|dysplas|дисплаз/.test(morph)) {
      return { number: 19, name: "Миелодиспластический синдром (МДС)", branch, reasons: ["Дисплазия в мазке (при нормальном MCV)"] };
    }
    if (/шизоцит|schistocyt|фрагмент/.test(morph)) {
      return { number: 20, name: "Микроангиопатическая гемолитическая анемия", branch, reasons: ["Шизоциты в мазке (при нормальном MCV)"] };
    }

    return insufficientData(branch, "ТТГ, креатинин/мочевина и УЗИ не выявили причины — при нормальном ТТГ рассмотрите вторичное эндокринное обследование (АКТГ, пролактин, кортизол, С-пептид, углеводный обмен)");
  }

  // ---------------------------------------------------------------
  if (branch === "macro") {
    // Prefer the corrected reticulocyte production index over raw % when available.
    const reticHigh =
      entry.reticIndex !== undefined
        ? reticIndexStatus(entry.reticIndex) === "adequate"
        : statusOf(entry.reticulocytes, reticR) === "high";
    const biliHigh = statusOf(entry.bilirubinIndirect, biliR) === "high";

    // #18 ГУС/ТТП and other RBC-damaging conditions — thrombocytopenia + LDH↑ +
    // schistocytes is the actual reference criterion (checked before the
    // reticulocyte-driven leaves so it stays reachable).
    const thrombocytopenia = statusOf(entry.platelets, pltR) === "low";
    const ldhHigh = statusOf(entry.ldh, ldhR) === "high";
    const schistocytes = /шизоцит|schistocyt|фрагмент/.test(morph);
    if (thrombocytopenia && ldhHigh && schistocytes) {
      return {
        number: 18,
        name: "ГУС / ТТП и другие болезни, повреждающие эритроциты",
        branch,
        reasons: ["Тромбоциты ↓", "ЛДГ ↑", "Шизоциты в мазке"],
      };
    }

    if (reticHigh && biliHigh) {
      if (entry.hemolysisTrigger === "viral" || entry.hemolysisTrigger === "autoimmune") {
        return {
          number: 14,
          name: "Гемолитическая анемия от повреждения эритроцитов (вирус/аутоиммунное заболевание)",
          branch,
          reasons: ["Ретикулоциты ↑", "Билирубин непрямой ↑", `Триггер: ${entry.hemolysisTrigger === "viral" ? "вирусная инфекция" : "аутоиммунное заболевание"}`],
        };
      }
      const reasons = ["Ретикулоциты ↑", "Билирубин непрямой ↑"];
      if (entry.hemolysisTrigger === "g6pd") reasons.push("Триггер: дефицит Г6ФДГ");
      if (entry.hemolysisTrigger === "drug") reasons.push("Триггер: лекарственный препарат");
      return { number: 13, name: "Гемолитическая анемия", branch, reasons };
    }

    if (reticHigh && !biliHigh) {
      return { number: 15, name: "Острая кровопотеря", branch, reasons: ["Ретикулоциты ↑", "Билирубин непрямой в норме"] };
    }

    if (statusOf(entry.b12, b12R) === "low") {
      return { number: 16, name: "Пернициозная (B12-дефицитная) анемия", branch, reasons: ["B12 ↓"] };
    }

    if (statusOf(entry.folate, folR) === "low") {
      return { number: 17, name: "Фолат/кобаламин-зависимая анемия", branch, reasons: ["Фолат ↓"] };
    }

    if (schistocytes) {
      return { number: 20, name: "Микроангиопатическая гемолитическая анемия", branch, reasons: ["Шизоциты в мазке"] };
    }
    if (/бласт|dysplas|дисплаз/.test(morph)) {
      return { number: 19, name: "Миелодиспластический синдром (МДС)", branch, reasons: ["Признаки дисплазии в мазке"] };
    }

    return insufficientData(branch, "Ретикулоцитарный индекс, билирубин, B12/фолат и морфология не выявили чёткого паттерна");
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
