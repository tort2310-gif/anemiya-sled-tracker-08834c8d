import type { Patient, TestEntry, LabKey } from "./types";
import { getRange, statusOf } from "./ranges";
import { branchLabel, type Branch } from "./diagnose";

export interface DecisiveRow {
  key: string;
  label: string;
  value: string;
  norm: string;
  status: "low" | "high" | "ok" | "critical" | "info";
  role: string;
}

export interface DiagnosisDetails {
  number: number;
  name: string;
  branch: Branch;
  explanation: string;
  decisive: DecisiveRow[];
  path: string[];
  recommendations: string[];
}

const fmt = (v: number | undefined, unit?: string) =>
  v === undefined ? "—" : `${v}${unit ? " " + unit : ""}`;

function pushLab(
  rows: DecisiveRow[],
  entry: TestEntry,
  patient: Patient,
  key: LabKey,
  role: string,
  criticalIfFar = false,
) {
  const v = entry[key as keyof TestEntry] as number | undefined;
  if (typeof v !== "number") return;
  const r = getRange(key, patient.gender);
  const s = statusOf(v, r);
  let status: DecisiveRow["status"] = s === "na" ? "info" : s;
  if (criticalIfFar && s === "low" && v < r.min * 0.5) status = "critical";
  if (criticalIfFar && s === "high" && v > r.max * 1.5) status = "critical";
  rows.push({
    key,
    label: r.label,
    value: fmt(v, r.unit),
    norm: `${r.min}–${r.max} ${r.unit}`,
    status,
    role,
  });
}

interface Ctx {
  number: number;
  name: string;
  branch: Branch;
  entry: TestEntry;
  patient: Patient;
}

function pathHead(ctx: Ctx): string[] {
  const hb = ctx.entry.hb;
  const mcv = ctx.entry.mcv;
  const hbR = getRange("hb", ctx.patient.gender);
  const head: string[] = [];
  if (typeof hb === "number") {
    head.push(hb < hbR.min ? `Hb ${hb} ↓` : `Hb ${hb} норма`);
  }
  if (typeof mcv === "number") {
    if (mcv < 80) head.push(`MCV ${mcv} < 80 — микро`);
    else if (mcv > 93) head.push(`MCV ${mcv} > 93 — макро`);
    else head.push(`MCV ${mcv} — нормо`);
  }
  return head;
}

export function explain(ctx: Ctx): DiagnosisDetails {
  const { number, name, branch, entry, patient } = ctx;
  const hb = entry.hb;
  const mcv = entry.mcv;
  const decisive: DecisiveRow[] = [];
  const path = pathHead(ctx);
  const recs: string[] = [];
  let explanation = "";

  pushLab(decisive, entry, patient, "hb", "Подтверждает анемию", true);
  if (branch === "micro" || branch === "normo" || branch === "macro") {
    pushLab(decisive, entry, patient, "mcv", branch === "micro" ? "Микроцитарная ветка" : branch === "macro" ? "Макроцитарная ветка" : "Нормоцитарная ветка");
  }

  switch (number) {
    // ---------------- Микроцитарная ветка ----------------
    case 1: // ЖДА
      pushLab(decisive, entry, patient, "iron", "Дефицит железа", true);
      pushLab(decisive, entry, patient, "ferritin", "Истощение запасов железа", true);
      pushLab(decisive, entry, patient, "tibc", "Компенсаторное ↑ ОЖСС");
      path.push("Fe↓, Ферритин↓, ОЖСС↑", "Электрофорез: норма", "→ Диагноз 1");
      explanation =
        `У пациента выявлена железодефицитная анемия. Об этом свидетельствует снижение гемоглобина до ${fmt(hb, "г/л")} ` +
        `при низком MCV ${fmt(mcv, "фл")}. Дефицит железа подтверждается: сывороточное железо ${fmt(entry.iron, "мкмоль/л")}, ` +
        `ферритин ${fmt(entry.ferritin, "мкг/л")}, ОЖСС ${fmt(entry.tibc, "мкмоль/л")}. ` +
        `Электрофорез гемоглобина не выявил патологических форм, что исключает талассемию.`;
      recs.push("Препараты железа (per os или в/в при непереносимости)", "Поиск источника кровопотери (ЖКТ, гинекология)", "Контроль Hb и ферритина через 4–6 недель");
      break;

    case 2: // Талассемия (β)
      pushLab(decisive, entry, patient, "iron", "Параллельный дефицит (не всегда)");
      pushLab(decisive, entry, patient, "ferritin", "Истощение запасов железа (не всегда)");
      decisive.push({ key: "elph", label: "Электрофорез Hb", value: "Повышен HbA2 (β)", norm: "Норма HbA2", status: "critical", role: "Патогномоничный признак β-талассемии" });
      path.push("Электрофорез: HbA2 ↑ (β)", "→ Диагноз 2");
      explanation =
        `Показатели указывают на β-талассемию. Электрофорез гемоглобина показал повышение фракции HbA2 — ` +
        `патогномоничный признак этой формы, даже если картина Fe/ферритина внешне похожа на дефицит железа. ` +
        `Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}.`;
      recs.push("Консультация гематолога", "Генетическое тестирование (HBB)", "Осторожно с препаратами железа — риск перегрузки");
      break;

    case 3: // Сидеробластная
      pushLab(decisive, entry, patient, "ferritin", "Перегрузка железом", true);
      decisive.push({ key: "side", label: "Кольца сидеробластов", value: entry.sideroblasts ? "Обнаружены" : "Обнаружены (по мазку)", norm: "Отсутствуют", status: "critical", role: "Подтверждение сидеробластной анемии" });
      path.push("Ферритин↑", "Кольца сидеробластов в мазке", "→ Диагноз 3");
      explanation =
        `Микроцитарная анемия (MCV ${fmt(mcv, "фл")}, Hb ${fmt(hb, "г/л")}) при повышенном ферритине ` +
        `${fmt(entry.ferritin, "мкг/л")} и наличии кольцевых сидеробластов в мазке указывает на сидеробластную ` +
        `анемию — железо не включается в гем, а откладывается в митохондриях вокруг ядра эритробласта.`;
      recs.push("Консультация гематолога", "Витамин B6 (пиридоксин) пробно", "Исключить токсические причины (свинец, алкоголь)");
      break;

    case 4:
      explanation = `Микроцитарная анемия (Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}) с морфологически нестабильными формами гемоглобина. Требует электрофореза и генетического подтверждения.`;
      path.push("Морфология: нестабильные Hb", "→ Диагноз 4");
      recs.push("Электрофорез Hb, тест на нестабильные Hb", "Консультация гематолога");
      break;

    case 5:
      decisive.push({ key: "morph", label: "Морфология", value: "Сфероциты", norm: "Дискоциты", status: "critical", role: "Признак наследственного сфероцитоза" });
      path.push("Сфероциты в мазке", "→ Диагноз 5");
      explanation = `Микроцитарная анемия (Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}) со сфероцитами в мазке указывает на наследственный сфероцитоз (HS) — мембранопатию эритроцитов.`;
      recs.push("Осмотическая резистентность эритроцитов", "Консультация гематолога", "УЗИ селезёнки");
      break;

    case 6:
      decisive.push({ key: "morph", label: "Морфология", value: "Серповидные клетки", norm: "Дискоциты", status: "critical", role: "Признак HbS" });
      path.push("Серповидные клетки в мазке", "→ Диагноз 6");
      explanation = `Микроцитарная анемия (Hb ${fmt(hb, "г/л")}) с серповидными формами эритроцитов указывает на серповидно-клеточную анемию (HbS).`;
      recs.push("Электрофорез Hb, ПЦР на HBB", "Консультация гематолога");
      break;

    case 7: {
      pushLab(decisive, entry, patient, "leadBlood", "Хроническая экспозиция свинцом", true);
      pushLab(decisive, entry, patient, "leadUrine", "Недавняя экспозиция свинцом", true);
      path.push("Свинец в крови/моче ↑ или анамнез контакта", "→ Диагноз 7");
      explanation = `Микроцитарная анемия при подозрении на отравление свинцом. Свинец блокирует синтез гема, что приводит к нарушению эритропоэза. Повышенный свинец в моче указывает на свежую экспозицию, в крови — на хроническое состояние.`;
      recs.push("Уровень свинца в крови и моче", "Удаление от источника воздействия", "Хелатная терапия по показаниям", "Санация полости рта и зубных каналов");
      break;
    }

    // ---------------- Нормоцитарная ветка ----------------
    case 8: // Гипотиреоз
      pushLab(decisive, entry, patient, "tsh", "Маркёр гипотиреоза", true);
      path.push("ТТГ ↑", "→ Диагноз 8");
      explanation =
        `Анемия нормоцитарного типа (MCV ${fmt(mcv, "фл")}) в сочетании с повышенным ТТГ ${fmt(entry.tsh, "мМЕ/л")} ` +
        `указывает на анемию вследствие гипотиреоза. При дефиците тиреоидных гормонов снижается стимуляция эритропоэза.`;
      recs.push("Расширенное обследование ЩЖ: Т3св, Т4св, антитела к ТПО, ТГ, рТТГ", "Консультация эндокринолога");
      break;

    case 9:
      pushLab(decisive, entry, patient, "creatinine", "Маркёр почечной дисфункции", true);
      pushLab(decisive, entry, patient, "urea", "Маркёр почечной дисфункции");
      path.push("Креатинин/мочевина ↑", "→ Диагноз 9");
      explanation = `Нормоцитарная анемия (Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}) при изменении креатинина/мочевины указывает на анемию хронических заболеваний, ассоциированную с почечной недостаточностью.`;
      recs.push("ОАМ, мочевая кислота, общий белок, СКФ, альдостерон, ренин", "Направить к урологу", "Контроль ферритина и сатурации трансферрина");
      break;

    case 10:
      pushLab(decisive, entry, patient, "creatinine", "Почечная недостаточность", true);
      pushLab(decisive, entry, patient, "epo", "Дефицит ЭПО — главный механизм", true);
      path.push("Креатинин/мочевина ↑", "ЭПО ↓", "→ Диагноз 10");
      explanation = `Дизэритропоэтическая (почечная) анемия. Повышение креатинина/мочевины и низкий эритропоэтин (${fmt(entry.epo, "МЕ/л")}) указывают на снижение продукции ЭПО почками — ключевой механизм анемии при ХБП.`;
      recs.push("Эритропоэз-стимулирующие препараты", "Коррекция дефицита железа", "Наблюдение нефролога");
      break;

    case 11:
      path.push(`УЗИ: патология вне печени (${entry.uziFinding ?? "—"})`, "→ Диагноз 11");
      explanation = `Нормоцитарная анемия (Hb ${fmt(hb, "г/л")}) на фоне длительного вялотекущего хронического заболевания, выявленного по данным УЗИ. Механизм — перераспределение железа и подавление эритропоэза цитокинами воспаления.`;
      recs.push("Поиск и лечение основного заболевания", "Контроль маркёров воспаления (СРБ, ферритин)", "Кровь на морфологию эритроцитов — исключить пойкилоцитоз");
      break;

    case 12:
      path.push("УЗИ: патология печени", "→ Диагноз 12");
      explanation = `Нормоцитарная анемия при патологии печени. Возможен гемосидероз, НЖБП или аутоиммунный гепатит. Hb ${fmt(hb, "г/л")} при MCV ${fmt(mcv, "фл")}.`;
      recs.push("Печёночные пробы (АЛТ, АСТ, билирубин прямой), эластография", "Консультация гепатолога");
      break;

    // ---------------- Макроцитарная ветка (+ перекрёстные №19/№20) ----------------
    case 13: {
      pushLab(decisive, entry, patient, "reticulocytes", "Усиленный эритропоэз");
      pushLab(decisive, entry, patient, "bilirubinIndirect", "Распад эритроцитов", true);
      const trigger = entry.hemolysisTrigger === "g6pd" ? "дефицит Г6ФДГ" : entry.hemolysisTrigger === "drug" ? "лекарственный препарат" : "не уточнён";
      path.push("Ретикулоциты ↑", "Билирубин непрямой ↑", `Триггер: ${trigger}`, "→ Диагноз 13");
      explanation = `Макроцитарная гемолитическая анемия. Повышенные ретикулоциты (${fmt(entry.reticulocytes, "%")}) показывают усиленную регенерацию, повышенный непрямой билирубин (${fmt(entry.bilirubinIndirect, "мкмоль/л")}) — распад эритроцитов. Триггер: ${trigger}.`;
      recs.push("ЛДГ, гаптоглобин, прямой тест Кумбса", "Поиск причины: Г6ФДГ, АИГА, лекарственная");
      break;
    }

    case 14:
      pushLab(decisive, entry, patient, "reticulocytes", "Усиленный эритропоэз");
      path.push("Ретикулоциты ↑", "Билирубин непрямой ↑", "Триггер: вирус/АИЗ", "→ Диагноз 14");
      explanation = `Гемолитическая анемия из-за повреждения эритроцитов вирусной инфекцией (парвовирус B19) или системным аутоиммунным заболеванием (СКВ и др.). Hb ${fmt(hb, "г/л")}, ретикулоциты ${fmt(entry.reticulocytes, "%")}.`;
      recs.push("Прямой тест Кумбса, АНА", "Серология (парвовирус B19, ЦМВ, ВЭБ)");
      break;

    case 15:
      pushLab(decisive, entry, patient, "reticulocytes", "Регенерация после кровопотери");
      pushLab(decisive, entry, patient, "bilirubinIndirect", "Не повышен — нет гемолиза");
      path.push("Ретикулоциты ↑", "Билирубин в норме", "→ Диагноз 15");
      explanation = `Постгеморрагическая анемия. Повышение ретикулоцитов при нормальном билирубине указывает на регенераторный ответ без гемолиза — характерно для острой кровопотери (дивертикулёз, эпистаксис, меноррагия, гематомезис). Hb ${fmt(hb, "г/л")}.`;
      recs.push("Поиск источника кровотечения (ЖКТ, гинекология)", "Контроль гемодинамики", "Заместительная терапия по показаниям");
      break;

    case 16:
      pushLab(decisive, entry, patient, "b12", "Нарушение синтеза ДНК", true);
      path.push("Ретикулоцитарный индекс норма/↓", "B12 ↓", "→ Диагноз 16");
      explanation =
        `Макроцитарная анемия (MCV ${fmt(mcv, "фл")}) при дефиците B12 ${fmt(entry.b12, "пмоль/л")} указывает на пернициозную анемию. ` +
        `Дефицит витамина B12 нарушает синтез ДНК в эритроцитах, из-за чего они вырастают аномально крупными, но функционально неполноценными. Гемоглобин снижен до ${fmt(hb, "г/л")}.`;
      recs.push("Цианокобаламин в/м", "Антитела к внутреннему фактору и париетальным клеткам", "ЭГДС (атрофический гастрит)");
      break;

    case 17:
      pushLab(decisive, entry, patient, "folate", "Нарушение синтеза ДНК", true);
      path.push("Ретикулоцитарный индекс норма/↓", "Фолат ↓", "→ Диагноз 17");
      explanation = `Фолат/кобаламин-зависимая анемия (мегалобластный криз). Низкий фолат (${fmt(entry.folate, "нмоль/л")}) при макроцитозе (MCV ${fmt(mcv, "фл")}) и Hb ${fmt(hb, "г/л")} — следствие нарушения синтеза ДНК; при резком снижении Hb и ретикулоцитов возможен острый мегалобластный криз.`;
      recs.push("Фолиевая кислота 1–5 мг/сут", "Контроль B12 (нельзя назначать только фолат при дефиците B12)", "Диета: зелёные овощи, бобовые");
      break;

    case 18:
      pushLab(decisive, entry, patient, "platelets", "Тромбоцитопения", true);
      pushLab(decisive, entry, patient, "ldh", "Маркёр гемолиза/повреждения тканей", true);
      decisive.push({ key: "morph", label: "Морфология", value: "Шизоциты", norm: "Отсутствуют", status: "critical", role: "Механическое разрушение эритроцитов" });
      path.push("Тромбоциты ↓", "ЛДГ ↑", "Шизоциты в мазке", "→ Диагноз 18");
      explanation = `Признаки ГУС (гемолитико-уремического синдрома), ТТП или другого заболевания, повреждающего эритроциты: тромбоцитопения ${fmt(entry.platelets, "×10⁹/л")}, ЛДГ ${fmt(entry.ldh, "Ед/л")} и шизоциты в мазке. Требует срочной оценки.`;
      recs.push("Срочная консультация гематолога", "Мазок крови на шизоциты, гаптоглобин, прямой тест Кумбса (отрицателен при ТТП/ГУС)", "Функция почек, УЗИ почек");
      break;

    case 19:
      decisive.push({ key: "morph", label: "Морфология", value: "Признаки дисплазии", norm: "Норма", status: "critical", role: "Подозрение на МДС" });
      path.push("Морфология: дисплазия", "→ Диагноз 19");
      explanation = `Признаки дисплазии в мазке — подозрение на миелодиспластический синдром или онкозаболевание крови. Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}.`;
      recs.push("Стернальная пункция / трепанобиопсия", "Цитогенетика", "Консультация гематолога-онколога");
      break;

    case 20:
      decisive.push({ key: "morph", label: "Морфология", value: "Шизоциты", norm: "Отсутствуют", status: "critical", role: "Микроангиопатия" });
      path.push("Шизоциты в мазке", "→ Диагноз 20");
      explanation = `Микроангиопатическая гемолитическая анемия. Шизоциты (фрагменты эритроцитов) указывают на механическое разрушение в микрососудах.${entry.organomegaly && entry.organomegaly !== "none" ? " По УЗИ/КТ выявлена органомегалия — дополнительное подтверждение." : ""} Hb ${fmt(hb, "г/л")}.`;
      recs.push("Тромбоциты, ЛДГ, креатинин — исключить ТТП/ГУС/ДВС", "УЗИ/КТ брюшной полости — спленомегалия, гепатомегалия", "Срочная консультация гематолога");
      break;

    default:
      explanation = name === "Анемия не выявлена"
        ? `Показатели в пределах нормы. Hb ${fmt(hb, "г/л")} и MCV ${fmt(mcv, "фл")} соответствуют референсным значениям. Запись сохранена для динамического наблюдения.`
        : `Недостаточно данных для уточнения диагноза. Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}. Заполните дополнительные показатели на следующем шаге.`;
  }

  const hbR = getRange("hb", patient.gender);
  if (typeof hb === "number" && hb < hbR.min * 0.7) {
    const row = decisive.find((d) => d.key === "hb");
    if (row) row.status = "critical";
  }

  return {
    number,
    name,
    branch,
    explanation,
    decisive,
    path,
    recommendations: recs,
  };
}

export function branchLabelFull(b: Branch): string {
  return branchLabel(b);
}
