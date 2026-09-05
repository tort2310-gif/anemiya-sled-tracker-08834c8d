import { describe, it, expect } from "vitest";
import { getBranch, diagnose, branchColor, branchLabel } from "./diagnose";
import type { Patient, TestEntry } from "./types";

const patient = (gender: Patient["gender"] = "female"): Patient => ({
  id: "p1",
  name: "Тест Пациент",
  birthDate: "1990-01-01",
  gender,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const entry = (overrides: Partial<TestEntry>): TestEntry => ({
  id: "t1",
  patientId: "p1",
  date: "2026-01-01",
  ...overrides,
});

describe("getBranch", () => {
  it("classifies by MCV thresholds", () => {
    expect(getBranch(undefined)).toBe("unknown");
    expect(getBranch(79)).toBe("micro");
    expect(getBranch(80)).toBe("normo"); // 80–83 borderline gap, falls through to normo
    expect(getBranch(82)).toBe("normo");
    expect(getBranch(83)).toBe("normo");
    expect(getBranch(93)).toBe("normo");
    expect(getBranch(94)).toBe("macro");
    expect(getBranch(120)).toBe("macro");
  });
});

describe("diagnose — micro branch (MCV < 80)", () => {
  it("#1 Железодефицитная анемия: Fe↓, ОЖСС↑, Ферритин↓", () => {
    const dx = diagnose(entry({ mcv: 70, iron: 5, tibc: 80, ferritin: 5 }), patient());
    expect(dx.number).toBe(1);
    expect(dx.branch).toBe("micro");
  });

  it("#3 Сидеробластная анемия: Ферритин↑ + структурное поле sideroblasts=true (проверяется раньше остальных)", () => {
    const dx = diagnose(entry({ mcv: 70, ferritin: 300, sideroblasts: true }), patient());
    expect(dx.number).toBe(3);
  });

  it("#2 Талассемия (β): структурное поле electrophoresis='beta_high'", () => {
    const dx = diagnose(entry({ mcv: 70, electrophoresis: "beta_high" }), patient());
    expect(dx.number).toBe(2);
  });

  it("#4 Микроцитарная анемия (нестабильные Hb): морфология", () => {
    const dx = diagnose(entry({ mcv: 70, morphology: "Нестабильные гемоглобины" }), patient());
    expect(dx.number).toBe(4);
  });

  it("#5 HS наследственный сфероцитоз: сфероциты в мазке", () => {
    const dx = diagnose(entry({ mcv: 70, morphology: "Сфероциты" }), patient());
    expect(dx.number).toBe(5);
  });

  it("#6 Серповидно-клеточная анемия: серповидные клетки в мазке", () => {
    const dx = diagnose(entry({ mcv: 70, morphology: "Серповидные клетки" }), patient());
    expect(dx.number).toBe(6);
  });

  it("#7 Отравление свинцом: свинец в крови ↑ (хроническая экспозиция)", () => {
    const dx = diagnose(entry({ mcv: 70, leadBlood: 10 }), patient());
    expect(dx.number).toBe(7);
  });

  it("#7 Отравление свинцом: свинец в моче ↑ (недавняя экспозиция)", () => {
    const dx = diagnose(entry({ mcv: 70, leadUrine: 100 }), patient());
    expect(dx.number).toBe(7);
  });

  it("#7 Отравление свинцом: срабатывает и по упоминанию в примечаниях (когда лаб. данных нет)", () => {
    const dx = diagnose(entry({ mcv: 70, notes: "контакт со свинцом на работе" }), patient());
    expect(dx.number).toBe(7);
  });

  it("возвращает №0 (недостаточно данных) и намекает на альфа-талассемию, если электрофорез в норме, а железо/ферритин тоже в норме", () => {
    const dx = diagnose(entry({ mcv: 70, electrophoresis: "alpha_norm", iron: 15, ferritin: 50 }), patient());
    expect(dx.number).toBe(0);
    expect(dx.reasons.join(" ")).toMatch(/альфа-талассемия/i);
  });

  it("возвращает №0 (недостаточно данных), если ни один специфический паттерн не подтверждён", () => {
    const dx = diagnose(entry({ mcv: 70 }), patient());
    expect(dx.number).toBe(0);
    expect(dx.branch).toBe("micro");
  });
});

describe("diagnose — normo branch (83 ≤ MCV ≤ 93)", () => {
  it("#8 Анемия при гипотиреозе: ТТГ↑", () => {
    const dx = diagnose(entry({ mcv: 88, tsh: 6 }), patient());
    expect(dx.number).toBe(8);
  });

  it("#9 Анемия хр. заболеваний: Креатинин↑, ЭПО не проверяется/в норме", () => {
    const dx = diagnose(entry({ mcv: 88, creatinine: 120 }), patient("female"));
    expect(dx.number).toBe(9);
  });

  it("#9 срабатывает и по одной лишь мочевине (без креатинина)", () => {
    const dx = diagnose(entry({ mcv: 88, urea: 10 }), patient());
    expect(dx.number).toBe(9);
  });

  it("#10 Дизэритропоэтическая (почечная) анемия: Креатинин↑ И ЭПО↓", () => {
    const dx = diagnose(entry({ mcv: 88, creatinine: 120, epo: 2 }), patient());
    expect(dx.number).toBe(10);
  });

  it("#11 Смешанная анемия хр. заболеваний: УЗИ — патология вне печени", () => {
    const dx = diagnose(entry({ mcv: 88, uziFinding: "abdominal" }), patient());
    expect(dx.number).toBe(11);
  });

  it("#12 Гемосидероз: УЗИ — патология печени", () => {
    const dx = diagnose(entry({ mcv: 88, uziFinding: "liver" }), patient());
    expect(dx.number).toBe(12);
  });

  it("перекрёстный переход: дисплазия в мазке при нормальном MCV уходит в №19 (МДС)", () => {
    const dx = diagnose(entry({ mcv: 88, morphology: "Признаки дисплазии" }), patient());
    expect(dx.number).toBe(19);
  });

  it("перекрёстный переход: шизоциты в мазке при нормальном MCV уходят в №20 (микроангиопатическая ГА)", () => {
    const dx = diagnose(entry({ mcv: 88, morphology: "Шизоциты" }), patient());
    expect(dx.number).toBe(20);
  });

  it("возвращает №0 (недостаточно данных), если ТТГ/почки/УЗИ ничего не выявили", () => {
    const dx = diagnose(entry({ mcv: 88 }), patient());
    expect(dx.number).toBe(0);
  });

  it("применяет пол-специфичный диапазон креатинина (100 — норма для мужчин, повышено для женщин)", () => {
    const male = diagnose(entry({ mcv: 88, creatinine: 100 }), patient("male"));
    const female = diagnose(entry({ mcv: 88, creatinine: 100 }), patient("female"));
    expect(male.number).toBe(0); // 100 в пределах мужской нормы (62–115) → ничего не выявлено
    expect(female.number).toBe(9); // 100 выше женской нормы (44–97) → анемия хр. заболеваний
  });
});

describe("diagnose — macro branch (MCV > 93)", () => {
  it("#18 ГУС/ТТП: тромбоциты↓ + ЛДГ↑ + шизоциты — теперь ДОСТИЖИМ (проверяется раньше остальных)", () => {
    const dx = diagnose(entry({ mcv: 96, platelets: 100, ldh: 300, morphology: "Шизоциты" }), patient());
    expect(dx.number).toBe(18);
  });

  it("#13 Гемолитическая анемия: Ретикулоциты↑ + Билирубин непрямой↑, триггер не уточнён", () => {
    const dx = diagnose(entry({ mcv: 96, reticulocytes: 5, bilirubinIndirect: 25 }), patient());
    expect(dx.number).toBe(13);
  });

  it("#13/#14 предпочитают ретикулоцитарный индекс сырому % ретикулоцитов", () => {
    // Сырые ретикулоциты выглядят "высокими", но скорректированный индекс говорит об
    // неадекватном ответе костного мозга — функция должна использовать именно индекс.
    const dx = diagnose(entry({ mcv: 96, reticulocytes: 5, reticIndex: 1, bilirubinIndirect: 25 }), patient());
    expect(dx.number).not.toBe(13);
    expect(dx.number).not.toBe(15);
  });

  it("#14 RBC-повреждение (вирус): Ретикулоциты↑ + Билирубин↑ + триггер вирусный", () => {
    const dx = diagnose(entry({ mcv: 96, reticulocytes: 5, bilirubinIndirect: 25, hemolysisTrigger: "viral" }), patient());
    expect(dx.number).toBe(14);
  });

  it("#14 RBC-повреждение (аутоиммунное): Ретикулоциты↑ + Билирубин↑ + триггер аутоиммунный", () => {
    const dx = diagnose(entry({ mcv: 96, reticulocytes: 5, bilirubinIndirect: 25, hemolysisTrigger: "autoimmune" }), patient());
    expect(dx.number).toBe(14);
  });

  it("#15 Острая кровопотеря: Ретикулоциты↑, билирубин в норме", () => {
    const dx = diagnose(entry({ mcv: 96, reticulocytes: 5, bilirubinIndirect: 10 }), patient());
    expect(dx.number).toBe(15);
  });

  it("#16 Пернициозная (B12-дефицитная) анемия: B12↓", () => {
    const dx = diagnose(entry({ mcv: 96, b12: 100 }), patient());
    expect(dx.number).toBe(16);
  });

  it("#17 Фолат/кобаламин-зависимая анемия: Фолат↓ (B12 в норме)", () => {
    const dx = diagnose(entry({ mcv: 96, b12: 300, folate: 5 }), patient());
    expect(dx.number).toBe(17);
  });

  it("#20 Микроангиопатическая ГА: шизоциты в мазке (без тромбоцитопении/ЛДГ↑ — не №18)", () => {
    const dx = diagnose(entry({ mcv: 96, b12: 300, folate: 20, morphology: "Шизоциты" }), patient());
    expect(dx.number).toBe(20);
  });

  it("#19 Миелодиспластический синдром: признаки дисплазии", () => {
    const dx = diagnose(entry({ mcv: 96, b12: 300, folate: 20, morphology: "Признаки дисплазии" }), patient());
    expect(dx.number).toBe(19);
  });

  it("возвращает №0 (недостаточно данных), если ретикулоцитарный индекс/билирубин/B12/фолат/морфология не дали чёткого паттерна", () => {
    const dx = diagnose(entry({ mcv: 96, b12: 300, folate: 20 }), patient());
    expect(dx.number).toBe(0);
  });
});

describe("diagnose — unknown branch (MCV не указан)", () => {
  it("возвращает заглушку №0, если MCV отсутствует", () => {
    const dx = diagnose(entry({}), patient());
    expect(dx.number).toBe(0);
    expect(dx.branch).toBe("unknown");
  });
});

describe("branchColor / branchLabel", () => {
  it("возвращают подписи для всех веток", () => {
    expect(branchLabel("micro")).toBe("Микроцитарная");
    expect(branchLabel("normo")).toBe("Нормоцитарная");
    expect(branchLabel("macro")).toBe("Макроцитарная");
    expect(branchLabel("unknown")).toBe("—");
  });

  it("возвращают CSS custom property для каждой ветки", () => {
    expect(branchColor("micro")).toContain("--branch-micro");
    expect(branchColor("normo")).toContain("--branch-normo");
    expect(branchColor("macro")).toContain("--branch-macro");
  });
});
