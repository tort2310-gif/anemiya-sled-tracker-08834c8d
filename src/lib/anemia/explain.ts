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
  const hbR = getRange("hb", patient.gender);
  const ferR = getRange("ferritin", patient.gender);
  const decisive: DecisiveRow[] = [];
  const path = pathHead(ctx);
  const recs: string[] = [];
  let explanation = "";

  // Always include Hb + MCV
  pushLab(decisive, entry, patient, "hb", "Подтверждает анемию", true);
  pushLab(decisive, entry, patient, "mcv", branch === "micro" ? "Микроцитарная ветка" : branch === "macro" ? "Макроцитарная ветка" : "Нормоцитарная ветка");

  switch (number) {
    case 1: // ЖДА
      pushLab(decisive, entry, patient, "iron", "Дефицит железа", true);
      pushLab(decisive, entry, patient, "ferritin", "Истощение запасов железа", true);
      pushLab(decisive, entry, patient, "tibc", "Компенсаторное ↑ ОЖСС");
      path.push("Fe↓, Ферритин↓, ОЖСС↑", "Электрофорез: норма", "→ Диагноз 1");
      explanation =
        `У пациента выявлена железодефицитная анемия. Об этом свидетельствует снижение гемоглобина до ${fmt(hb, "г/л")} ` +
        `при низком MCV ${fmt(mcv, "фл")}, что указывает на нарушение синтеза гемоглобина. ` +
        `Дефицит железа подтверждается: сывороточное железо ${fmt(entry.iron, "мкмоль/л")} (норма 9–30), ` +
        `ферритин ${fmt(entry.ferritin, "мкг/л")} (норма ${ferR.min}–${ferR.max}), ` +
        `ОЖСС ${fmt(entry.tibc, "мкмоль/л")} — организм пытается захватить больше железа из крови. ` +
        `Электрофорез гемоглобина не выявил патологических форм, что исключает талассемию.`;
      recs.push("Препараты железа (per os или в/в при непереносимости)", "Поиск источника кровопотери (ЖКТ, гинекология)", "Контроль Hb и ферритина через 4–6 недель");
      break;

    case 2: // Талассемия
      pushLab(decisive, entry, patient, "iron", "Параллельный дефицит");
      pushLab(decisive, entry, patient, "ferritin", "Истощение запасов железа");
      decisive.push({ key: "elph", label: "Электрофорез Hb", value: "Повышен HbA2 (β)", norm: "Норм HbA2", status: "critical", role: "Патогномоничный признак β-талассемии" });
      path.push("Fe↓, Ферритин↓, ОЖСС↑", "Электрофорез: HbA2 ↑ (β)", "→ Диагноз 2");
      explanation =
        `Показатели указывают на талассемию (β-форма). Несмотря на сниженный гемоглобин ${fmt(hb, "г/л")} ` +
        `и низкий MCV ${fmt(mcv, "фл")}, характерный для дефицита железа, электрофорез гемоглобина показал ` +
        `повышение фракции HbA2 — это патогномоничный признак β-талассемии. Железо и ферритин при этом ` +
        `могут быть снижены параллельно, но основная причина анемии — генетический дефект цепей гемоглобина.`;
      recs.push("Консультация гематолога", "Генетическое тестирование (HBB)", "Осторожно с препаратами железа — риск перегрузки");
      break;

    case 3: // Сидеробластная
      pushLab(decisive, entry, patient, "ferritin", "Перегрузка железом");
      decisive.push({ key: "side", label: "Кольца сидеробластов", value: "Обнаружены", norm: "Отсутствуют", status: "critical", role: "Подтверждение сидеробластной анемии" });
      path.push("Ферритин↑", "Кольца сидеробластов в мазке", "→ Диагноз 3");
      explanation =
        `Микроцитарная анемия (MCV ${fmt(mcv, "фл")}, Hb ${fmt(hb, "г/л")}) при повышенном ферритине ` +
        `${fmt(entry.ferritin, "мкг/л")} и наличии кольцевых сидеробластов в мазке указывает на сидеробластную ` +
        `анемию. Железо не включается в гем, а откладывается митохондриально вокруг ядра эритробласта.`;
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
      explanation = `Микроцитарная анемия (Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}) с сфероцитами в мазке указывает на наследственный сфероцитоз — мембранопатию эритроцитов.`;
      recs.push("Осмотическая резистентность эритроцитов", "Консультация гематолога", "УЗИ селезёнки");
      break;

    case 6:
      decisive.push({ key: "morph", label: "Морфология", value: "Серповидные клетки", norm: "Дискоциты", status: "critical", role: "Признак HbS" });
      path.push("Серповидные клетки в мазке", "→ Диагноз 6");
      explanation = `Микроцитарная анемия (Hb ${fmt(hb, "г/л")}) с серповидными формами эритроцитов указывает на серповидно-клеточную анемию (HbS).`;
      recs.push("Электрофорез Hb, ПЦР на HBB", "Консультация гематолога");
      break;

    case 7:
      path.push("Указание в анамнезе на контакт со свинцом", "→ Диагноз 7");
      explanation = `Микроцитарная анемия при подозрении на отравление свинцом. Свинец блокирует синтез гема, что приводит к нарушению эритропоэза.`;
      recs.push("Уровень свинца в крови", "Удаление от источника воздействия", "Хелатная терапия по показаниям");
      break;

    case 8: // Гипотиреоз
      pushLab(decisive, entry, patient, "tsh", "Маркёр гипотиреоза", true);
      path.push("ТТГ ↑", "→ Диагноз 8");
      explanation =
        `Анемия нормоцитарного типа (MCV ${fmt(mcv, "фл")}) в сочетании с повышенным ТТГ ${fmt(entry.tsh, "мМЕ/л")} ` +
        `указывает на анемию вследствие гипотиреоза. При дефиците тиреоидных гормонов снижается стимуляция эритропоэза, ` +
        `что приводит к умеренному снижению гемоглобина до ${fmt(hb, "г/л")}.`;
      recs.push("Расширенное обследование ЩЖ: Т3св, Т4св, антитела к ТПО, ТГ, рТТГ", "Консультация эндокринолога");
      break;

    case 9:
      pushLab(decisive, entry, patient, "creatinine", "Маркёр почечной дисфункции", true);
      path.push("Креатинин ↑", "→ Диагноз 9");
      explanation = `Нормоцитарная анемия (Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}) при повышенном креатинине ${fmt(entry.creatinine, "мкмоль/л")} указывает на анемию хронических заболеваний, ассоциированную с почечной недостаточностью.`;
      recs.push("СКФ, альбумин/креатинин мочи", "Направить к нефрологу/урологу", "Контроль ферритина и сатурации трансферрина");
      break;

    case 10:
      pushLab(decisive, entry, patient, "creatinine", "Почечная недостаточность", true);
      pushLab(decisive, entry, patient, "epo", "Дефицит ЭПО — главный механизм", true);
      path.push("Креатинин ↑", "ЭПО ↓", "→ Диагноз 10");
      explanation = `Дизэритропоэтическая (почечная) анемия. Повышение креатинина (${fmt(entry.creatinine, "мкмоль/л")}) и низкий эритропоэтин (${fmt(entry.epo, "МЕ/л")}) указывают на снижение продукции ЭПО почками — ключевой механизм анемии при ХБП.`;
      recs.push("Эритропоэз-стимулирующие препараты", "Коррекция дефицита железа", "Наблюдение нефролога");
      break;

    case 11:
      path.push("УЗИ: патология вне печени", "→ Диагноз 11");
      explanation = `Нормоцитарная анемия (Hb ${fmt(hb, "г/л")}) на фоне хронического заболевания, выявленного по данным УЗИ. Механизм — перераспределение железа и подавление эритропоэза цитокинами воспаления.`;
      recs.push("Поиск и лечение основного заболевания", "Контроль маркёров воспаления (СРБ, ферритин)");
      break;

    case 12:
      path.push("УЗИ: патология печени", "→ Диагноз 12");
      explanation = `Нормоцитарная анемия при патологии печени. Возможен гемосидероз или анемия на фоне НЖБП/аутоиммунного гепатита. Hb ${fmt(hb, "г/л")} при MCV ${fmt(mcv, "фл")}.`;
      recs.push("Печёночные пробы, эластография", "Консультация гепатолога");
      break;

    case 13: // Гемолиз
      pushLab(decisive, entry, patient, "reticulocytes", "Усиленный эритропоэз");
      pushLab(decisive, entry, patient, "bilirubinIndirect", "Распад эритроцитов", true);
      path.push("Ретикулоциты ↑", "Билирубин непрямой ↑", "→ Диагноз 13");
      explanation = `Макроцитарная гемолитическая анемия. Повышенные ретикулоциты (${fmt(entry.reticulocytes, "%")}) показывают усиленную регенерацию, а повышенный непрямой билирубин (${fmt(entry.bilirubinIndirect, "мкмоль/л")}) — массивный распад эритроцитов. Hb ${fmt(hb, "г/л")}.`;
      recs.push("ЛДГ, гаптоглобин, прямой тест Кумбса", "Поиск причины: Г6ФДГ, АИГА, лекарственная");
      break;

    case 14:
      pushLab(decisive, entry, patient, "reticulocytes", "Усиленный эритропоэз");
      path.push("Ретикулоциты ↑", "Билирубин ↑", "Триггер: фарм/АИЗ/вирус", "→ Диагноз 14");
      explanation = `Гемолитическая анемия, индуцированная лекарственными препаратами, аутоиммунным процессом или вирусной инфекцией. Hb ${fmt(hb, "г/л")}, ретикулоциты ${fmt(entry.reticulocytes, "%")}.`;
      recs.push("Отмена подозреваемого препарата", "Прямой тест Кумбса", "Серология (ЦМВ, ВЭБ, парвовирус)");
      break;

    case 15:
      pushLab(decisive, entry, patient, "reticulocytes", "Регенерация после кровопотери");
      pushLab(decisive, entry, patient, "bilirubinIndirect", "Не повышен — нет гемолиза");
      path.push("Ретикулоциты ↑", "Билирубин в норме", "→ Диагноз 15");
      explanation = `Постгеморрагическая анемия. Повышение ретикулоцитов при нормальном билирубине указывает на регенераторный ответ без гемолиза — характерно для острой кровопотери. Hb ${fmt(hb, "г/л")}.`;
      recs.push("Поиск источника кровотечения (ЖКТ, гинекология)", "Контроль гемодинамики", "Заместительная терапия по показаниям");
      break;

    case 16: // B12
      pushLab(decisive, entry, patient, "b12", "Нарушение синтеза ДНК", true);
      path.push("Ретикулоциты норма/↓", "B12 ↓", "→ Диагноз 16");
      explanation =
        `Макроцитарная анемия (MCV ${fmt(mcv, "фл")}) с нормальным/низким ретикулоцитарным индексом при дефиците B12 ` +
        `${fmt(entry.b12, "пмоль/л")} (норма 148–740) указывает на пернициозную анемию. Дефицит витамина B12 нарушает ` +
        `синтез ДНК в эритроцитах, из-за чего они вырастают аномально крупными, но функционально неполноценными. ` +
        `Гемоглобин снижен до ${fmt(hb, "г/л")}.`;
      recs.push("Цианокобаламин в/м", "Антитела к внутреннему фактору и париетальным клеткам", "ЭГДС (атрофический гастрит)");
      break;

    case 17:
      pushLab(decisive, entry, patient, "folate", "Нарушение синтеза ДНК", true);
      path.push("Ретикулоциты норма/↓", "Фолат ↓", "→ Диагноз 17");
      explanation = `Фолат-дефицитная анемия. Низкий фолат (${fmt(entry.folate, "нмоль/л")}, норма 7–45) при макроцитозе (MCV ${fmt(mcv, "фл")}) и Hb ${fmt(hb, "г/л")} — следствие нарушения синтеза ДНК.`;
      recs.push("Фолиевая кислота 1–5 мг/сут", "Контроль B12 (нельзя назначать только фолат при дефиците B12)", "Диета: зелёные овощи, бобовые");
      break;

    case 18:
      path.push("Морфология аномальная", "Фармпрепараты", "→ Диагноз 18");
      explanation = `Макроцитарная анемия, индуцированная лекарственными препаратами (фенитоин, АРВ, сульфонамиды). Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}.`;
      recs.push("Ревизия лекарственной терапии", "Замена/отмена подозреваемого препарата");
      break;

    case 19:
      decisive.push({ key: "morph", label: "Морфология", value: "Признаки дисплазии", norm: "Норма", status: "critical", role: "Подозрение на МДС" });
      path.push("Морфология: дисплазия", "→ Диагноз 19");
      explanation = `Макроцитарная анемия с признаками дисплазии в мазке — подозрение на миелодиспластический синдром. Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}.`;
      recs.push("Стернальная пункция / трепанобиопсия", "Цитогенетика", "Консультация гематолога-онколога");
      break;

    case 20:
      decisive.push({ key: "morph", label: "Морфология", value: "Шизоциты", norm: "Отсутствуют", status: "critical", role: "Микроангиопатия" });
      path.push("Шизоциты в мазке", "→ Диагноз 20");
      explanation = `Микроангиопатическая гемолитическая анемия. Шизоциты (фрагменты эритроцитов) указывают на механическое разрушение в микрососудах. Hb ${fmt(hb, "г/л")}.`;
      recs.push("Тромбоциты, ЛДГ, креатинин — исключить ТТП/ГУС/ДВС", "Срочная консультация гематолога");
      break;

    default:
      explanation = name === "Анемия не выявлена"
        ? `Показатели в пределах нормы. Hb ${fmt(hb, "г/л")} и MCV ${fmt(mcv, "фл")} соответствуют референсным значениям. Запись сохранена для динамического наблюдения.`
        : `Недостаточно данных для уточнения диагноза. Hb ${fmt(hb, "г/л")}, MCV ${fmt(mcv, "фл")}. Заполните дополнительные показатели на следующем шаге.`;
  }

  // Mark out-of-range Hb as critical when severely low
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
