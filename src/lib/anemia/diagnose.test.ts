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

  it("#3 Сидеробластная анемия: Ферритин↑ + кольца сидеробластов в мазке", () => {
    const dx = diagnose(
      entry({ mcv: 70, ferritin: 300, morphology: "Кольца сидеробластов" }),
      patient(),
    );
    expect(dx.number).toBe(3);
  });

  it("#2 Талассемия: паттерн электрофореза (Ферритин в норме)", () => {
    const dx = diagnose(
      entry({ mcv: 70, ferritin: 50, morphology: "Электрофорез: HbA2 повышен" }),
      patient(),
    );
    expect(dx.number).toBe(2);
  });

  it("#5 Гемоглобинопатия (HbS/HbC): мишеневидные/серповидные клетки", () => {
    const dx = diagnose(
      entry({ mcv: 70, ferritin: 50, morphology: "Мишеневидные клетки" }),
      patient(),
    );
    expect(dx.number).toBe(5);
  });

  it("#6 АХЗ (микроцитарный вариант): Ферритин↑ без других находок", () => {
    const dx = diagnose(entry({ mcv: 70, ferritin: 300 }), patient());
    expect(dx.number).toBe(6);
  });

  it("#7 Прочая микроцитарная: без чёткого паттерна", () => {
    const dx = diagnose(entry({ mcv: 70 }), patient());
    expect(dx.number).toBe(7);
  });
});

describe("diagnose — normo branch (83 ≤ MCV ≤ 93)", () => {
  it("#8 Анемия при гипотиреозе: ТТГ↑", () => {
    const dx = diagnose(entry({ mcv: 88, tsh: 6 }), patient());
    expect(dx.number).toBe(8);
  });

  it("#10 Почечная анемия: Креатинин↑", () => {
    const dx = diagnose(entry({ mcv: 88, creatinine: 120 }), patient("female"));
    expect(dx.number).toBe(10);
  });

  it("#9 АХЗ: Ферритин↑ (ТТГ и креатинин в норме)", () => {
    const dx = diagnose(entry({ mcv: 88, ferritin: 300 }), patient());
    expect(dx.number).toBe(9);
  });

  it("#11 Апластическая/гипопластическая анемия: Ретикулоциты↓", () => {
    const dx = diagnose(entry({ mcv: 88, reticulocytes: 0.2 }), patient());
    expect(dx.number).toBe(11);
  });

  it("#12 Нормоцитарная анемия смешанного генеза: без чёткого паттерна", () => {
    const dx = diagnose(entry({ mcv: 88 }), patient());
    expect(dx.number).toBe(12);
  });

  it("применяет пол-специфичный диапазон креатинина (100 — норма для мужчин, повышено для женщин)", () => {
    const male = diagnose(entry({ mcv: 88, creatinine: 100 }), patient("male"));
    const female = diagnose(entry({ mcv: 88, creatinine: 100 }), patient("female"));
    expect(male.number).toBe(12); // 100 в пределах мужской нормы (62–115) → нет чёткого паттерна
    expect(female.number).toBe(10); // 100 выше женской нормы (44–97) → почечная анемия
  });
});

describe("diagnose — macro branch (MCV > 93)", () => {
  it("#13 Гемолитическая анемия: Ретикулоциты↑ + Билирубин непрямой↑", () => {
    const dx = diagnose(
      entry({ mcv: 96, reticulocytes: 5, bilirubinIndirect: 25 }),
      patient(),
    );
    expect(dx.number).toBe(13);
  });

  it("#15 Острая кровопотеря: Ретикулоциты↑, билирубин в норме", () => {
    const dx = diagnose(
      entry({ mcv: 96, reticulocytes: 5, bilirubinIndirect: 10 }),
      patient(),
    );
    expect(dx.number).toBe(15);
  });

  it("#16 B12-дефицитная (пернициозная) анемия: B12↓", () => {
    const dx = diagnose(entry({ mcv: 96, b12: 100 }), patient());
    expect(dx.number).toBe(16);
  });

  it("#17 Фолат-дефицитная анемия: Фолат↓ (B12 в норме)", () => {
    const dx = diagnose(entry({ mcv: 96, b12: 300, folate: 5 }), patient());
    expect(dx.number).toBe(17);
  });

  it("#20 Микроангиопатическая гемолитическая анемия: шизоциты в мазке", () => {
    const dx = diagnose(
      entry({ mcv: 96, b12: 300, folate: 20, morphology: "Шизоциты" }),
      patient(),
    );
    expect(dx.number).toBe(20);
  });

  it("#19 Миелодиспластический синдром: признаки дисплазии", () => {
    const dx = diagnose(
      entry({ mcv: 96, b12: 300, folate: 20, morphology: "Признаки дисплазии" }),
      patient(),
    );
    expect(dx.number).toBe(19);
  });

  it("#14 Прочая макроцитарная: без чёткого паттерна", () => {
    const dx = diagnose(entry({ mcv: 96, b12: 300, folate: 20 }), patient());
    expect(dx.number).toBe(14);
  });

  it("документирует существующий баг: диагноз №18 (ГУС/ТТП) в diagnose() недостижим", () => {
    // В diagnose.ts проверка `if (reticHigh) return №18` стоит ПОСЛЕ
    // `if (reticHigh && !biliHigh) return №15` — а эти два условия вместе
    // покрывают уже все случаи reticHigh===true (билирубин либо высокий,
    // либо нет). Поэтому код до строки с №18 никогда не доходит с
    // reticHigh===true. Тест фиксирует текущее поведение "как есть" —
    // если понадобится действительно чинить diagnose.ts, начните отсюда.
    const dx = diagnose(
      entry({ mcv: 96, reticulocytes: 5, bilirubinIndirect: 10 }),
      patient(),
    );
    expect(dx.number).not.toBe(18);
    expect(dx.number).toBe(15);
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
