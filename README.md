# Анемия Трекер

Build a Russian-language anemia lab tracker app with multi-patient profiles, longitudinal data entry, and full statistics dashboard.

## Core Concept

Each patient logs their blood test results over time. The app uses the anemia diagnostic algorithm (based on MCV) to track diagnosis trends and show statistics.

---

## Screens & Navigation

### 1. Home — Patient List

- List of patient cards (name, age, last test date, current diagnosis badge)

- Button "Добавить пациента"

- Tap a patient → go to their profile

### 2. Patient Profile

- Header: name, date of birth, gender

- Tab 1: "Анализы" — chronological list of test entries

- Tab 2: "Статистика" — charts and auto-diagnosis

- Button "Добавить анализ" (opens input form)

### 3. Add/Edit Test Entry Form

Fields (all optional except date):

- Дата анализа (date picker)

- MCV (fL) — numeric

- Гемоглобин Hb (g/L)

- Железо сыворотки (мкмоль/L)

- ОЖСС (мкмоль/L)

- Ферритин (мкг/L)

- ТТГ (мМЕ/L)

- Ретикулоциты (%)

- Ретикулоцитарный индекс

- Билирубин непрямой (мкмоль/L)

- Креатинин (мкмоль/L)

- B12 (пмоль/L)

- Фолат (нмоль/L)

- Эритропоэтин (МЕ/L)

- Морфология эритроцитов (text/select)

- Примечания (free text)

### 4. Statistics Dashboard (per patient)

**A. Динамика показателей (line charts)**

- Each lab value over time on its own chart

- Reference range band shown as a shaded area (норма)

- Color: green if in range, red if out of range

**B. Автодиагностика по тренду**

Based on the latest entry's MCV + available labs, auto-classify into one of the diagnostic branches:

- MCV < 80 → "Микроцитарная анемия" branch

- MCV 83–93 → "Нормоцитарная анемия" branch  

- MCV > 93 → "Макроцитарная анемия" branch

Show the most likely diagnosis name + number (1–20) as a badge

Show which values triggered the diagnosis path

**C. Сравнение с нормами**

Table of all latest values vs. reference ranges, with ↑ ↓ = indicators

**D. Тренд (улучшение/ухудшение)**

For Hb, MCV, Ферритин, Ретикулоциты:

- Arrow indicator: ↑ improving / ↓ worsening / → stable

- Based on last 2–3 entries

---

## Diagnostic Reference Ranges (for норма bands)

- Hb: women 120–160 g/L, men 130–170 g/L

- MCV: 80–100 fL

- Железо: 9–30 мкмоль/L

- Ферритин: women 12–150, men 15–200 мкг/L

- ОЖСС: 45–72 мкмоль/L

- ТТГ: 0.4–4.0 мМЕ/L

- Ретикулоциты: 0.5–2.5%

- Билирубин непрямой: 3.4–17 мкмоль/L

- Креатинин: women 44–97, men 62–115 мкмоль/L

- B12: 148–740 пмоль/L

- Фолат: 7–45 нмоль/L

- Эритропоэтин: 3.7–29.5 МЕ/L

---

## Data Storage

- All data stored in localStorage

- Data structure: { patients: [...], tests: { patientId: [...] } }

- Export button: download all data as JSON file

- Import button: restore from JSON file

---

## Diagnostic Algorithm (auto-diagnosis logic)

MCV < 80:

  Железо низкое + ОЖСС высокое + Ферритин низкое → Diagnosis 1: ЖЕЛЕЗОДЕФИЦИТНАЯ Анемия

  Ферритин высокое + кольца в мазке → Diagnosis 3: СИДЕРОБЛАСТНАЯ Анемия

  Hb electrophoresis pattern → Diagnosis 2: Талассемия

  Else → Diagnosis 4–7 (other hemoglobinopathies)

MCV 83–93:

  ТТГ высокий → Diagnosis 8: Гипотиреоз-ассоциированная анемия

  Креатинин высокий → Diagnosis 9–10: Анемия хронических заболеваний / почечная

  Mixed pattern → Diagnosis 11–12

MCV > 93:

  Ретикулоциты высокие + Билирубин высокий → Diagnosis 13–14: Гемолитическая анемия

  Ретикулоциты высокие + Билирубин норма → Diagnosis 15: Острая кровопотеря

  B12/Фолат низкие → Diagnosis 16–17: Пернициозная / Фолат-дефицитная

  Аномальная морфология → Diagnosis 18–20: ГУС, МДС, Микроангиопатическая

---

## Tech Stack

- React + TypeScript

- Tailwind CSS

- Recharts for line charts

- localStorage for persistence

- All UI and labels in Russian

## Design

- Clean medical aesthetic: white background, subtle gray surfaces

- Color coding: 

  - Orange for MCV low branch

  - Blue for MCV normal branch  

  - Purple for MCV high branch

- Out-of-range values highlighted in red

- Improving trend in green, worsening in red

- Mobile-friendly, responsive layout

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://anemiya-sled-tracker.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bc779447-355d-4822-83cf-49a1d56755c9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
