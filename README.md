# 北極熊保暖實驗室 · Polar Bear Fur Lab

A polished 3D science simulation for **P4 Science · 4LD2 動物的適應特徵**:
*How does the fur of a polar bear keep it warm?*

Students use a large demonstration thermometer at eye level, run the cotton-vs-bare-cup experiment over simulated 0 / 3 / 6 minutes, record both cups in a data table, analyse the class data, and complete a quiz on **自變項 / 因變項 / 不變項**. Google sign-in and Firestore store every reading, method check and answer for the teacher.

**Live site:** https://hei1180.github.io/P4-science/

Built with **three.js 0.186.1**, plain ES modules and the existing **p1-maths** Firebase project (same Google OAuth as the P1 maths games).

---

## Quick start

```bash
cd P4-science
python3 -m http.server 8000
# open http://localhost:8000/
```

Do **not** open `index.html` with `file://` — the GLB model and Firebase sign-in both need a server.

### Preview routes

| URL | What it does |
| --- | --- |
| `http://localhost:8000/?dev` | Skip Google login, enter as “Dev Bear”, save only in this browser |
| `/?dev&demo=training` | Jump to the thermometer training |
| `/?dev&demo=experiment` | Training already complete, start the experiment |
| `/?dev&demo=analysis` | Training + experiment complete, open the data briefing |
| `/?dev&demo=variables` | Analysis complete, open the variables challenge |
| `/?dev&demo=results` | Complete report with sample data |
| `/?guest` | Guest mode (no Firebase save) |
| `http://localhost:8000/teacher.html?demo` | Teacher dashboard with 8 sample students |

Dev-only helpers are on `window.__polar` (`go()`, `seed()`, `session`, `world`). The experiment has a small `⏭` button in dev mode to jump to the next measurement.

---

## Learning flow

1. **測量 · Eye-level practice** — four rounds. Drag the scene or the eye-height rail until the sight line is level with the meniscus, then read the scale. Rounds 2–4 start above/below level so the parallax shift is visible. Every round records the entered value, submitted angle, aligned/misaligned and time.
2. **實驗 · Cotton vs bare cup** — 80 ml, 45 °C, no lid. The clock runs at 8 s = 1 min. At 0, 3 and 6 minutes students measure both cups; the clock pauses while they read. The app records the **capture time** (on-time vs late), the **eye angle** and the **reading**. A missed 3/6-minute window auto-opens a late reading so the activity always completes.
3. **分析 · Data tells us** — class data table and chart, then 10 questions: compare cooling, calculate drops, check that no cup rose above 45 °C, build a CER explanation, and identify where air is trapped in fur.
4. **變項 · Variables challenge** — a short concept refresher, then 8 questions on independent, dependent and controlled variables, including a definition match, multi-select controls, a spot-the-unfair-test and a transfer scenario.

The final report shows overall %, component bars, earned badges, every measurement’s method flags and a full answer review. It is written to Firestore `polarSessions/{sessionId}`.

---

## Teacher dashboard

`teacher.html` signs in with the teacher Google account and reads every `polarSessions` record.

* KPIs: students, sessions, average overall, eye-level %, on-time %, variables %.
* Table: date, name, class, overall, thermometer reading, eye level, on-time, analysis, variables, stars, duration.
* Row detail: per-reading table (entered vs actual, angle, aligned, correct, on-time), training rounds and every quiz answer.
* **Sessions CSV** and **Readings CSV** include a UTF-8 BOM so Excel opens Chinese correctly.
* `?demo` shows sample data without Firebase; useful for a quick look before the lesson.

Full lesson guidance and interpretation notes: [`docs/teacher-guide.md`](docs/teacher-guide.md).

**What “correct method” means in the data**

* **Eye level** — the pupil’s camera angle was within **±2.5°** of the meniscus when they recorded that cup.
* **On time** — the measurement was captured within **±20 simulated seconds** of 0 / 3 / 6 minutes. The 0-minute reading is automatic.
* **Correct reading** — the entered whole number equals the true temperature at that moment (to the nearest 1 °C).

---

## Firebase setup (one-time, teacher)

The app deliberately reuses the **p1-maths** project so there is one Google sign-in for the class.

1. **Authorized domains** — Firebase Console → project `p1-maths` → Authentication → Settings → Authorized domains. `localhost` is already there. When the site is on GitHub Pages, add `hei1180.github.io` (or the custom domain). Google sign-in will otherwise fail with `auth/unauthorized-domain`.
2. **Publish the merged rules** — open `firestore.rules` in this folder. It contains **all the P1 maths rules plus** the new `polarSessions` rule. In Firebase Console → Firestore Database → Rules, replace `TEACHER_EMAIL@example.com` with the teacher’s Google email (inside the console only), paste the whole file and Publish. Do not publish a polar-only rules file, or the P1 games will lose access.
3. **Teacher hash** — the dashboard checks `TEACHER_EMAIL_HASHES` in `src/firebase.js` so the repo does not contain the email. The existing hash is the same teacher account as the P1 games. If you use a different account, compute the SHA-256 of the lower-case address and update that array:
   ```bash
   printf '%s' 'teacher@example.com' | shasum -a 256
   ```
   Then update the email in the Firestore rule as well.
4. **Test** — sign in at `/?dev` first to check the lesson, then use the real Google account at `/`. Complete one short session and confirm a document appears in `polarSessions`. Open `teacher.html` with the teacher account.

Full walkthrough: [`docs/firebase-setup.md`](docs/firebase-setup.md).

### Data shape (one document)

```text
polarSessions/{sessionId}
  app: "polar-fur-lab"        schemaVersion: 1
  uid, name, email, classCode, sessionId
  startedAtMs, finishedAtMs, durationSec, createdAt
  scores: { trainingReading, trainingMethod, expReading, expMethod,
            expTime, analysis, variables, overall, stars }
  overallAccuracy, stars, badges[]
  training[]      — 4 eye-level rounds
  measurements[]  — 0 / 3 / 6 min capture times and time flags
  readings[]      — 6 cup readings with angle, aligned, correct
  analysis[]      — 10 answer records
  variables[]     — 8 answer records
  answers[]       — flat convenience list for the dashboard
  ua              — browser string (truncated)
```

Students can create/update only their own record; only the teacher can read all records or delete. The deterministic doc id makes a retry idempotent.

---

## Files

```text
index.html                 student app shell + import map
teacher.html               teacher dashboard shell
styles.css                 complete design system
logic.js                   cooling curves, parallax, scoring, session records
questions.js               analysis + variables question banks
src/app.js                 boot, OAuth, routing, dev hooks
src/firebase.js            shared p1-maths Firebase config + polarSessions I/O
src/state.js               local resume, profile, mute
src/audio.js               WebAudio sound effects (no audio files)
src/ui.js                  icons, toasts, modal, confetti
src/teacher.js             class dashboard, detail view, CSV
src/screens/*.js           home, login, training, experiment, analysis, quiz, results
src/three/world.js         renderer, camera rig, stage direction
src/three/environment.js   aurora, mountains, ice floe, snowfall
src/three/lab.js           table, cups, cotton model, thermometers, stopwatch
src/three/thermometer.js   physical demo thermometer
src/three/scope.js         canvas reading scope (parallax view)
assets/models/bear.glb     free low-poly bear, recoloured white
tests/logic.test.mjs       physics, scoring, record and question-bank tests
firestore.rules            merged P1 + P4 rules
docs/                      setup + teacher guide
```

## Tests

```bash
npm test
```

11 tests cover the cooling curves, parallax direction and scale, eye-level/time grading, weighted scoring, Firestore-safe record shape, every question type and the question banks.

---

## Credits and licences

* **Bear model** — “Bear” by [Poly by Google](https://poly.pizza/m/0PXWfxfb0Hu), [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), downloaded from Poly Pizza, recoloured and scaled for this project.
* **three.js** — MIT, loaded from jsDelivr.
* **Fonts** — Nunito and Noto Sans TC via Google Fonts (SIL Open Font License).
* **Firebase** — Google Firebase JS SDK 12.18.0.
* Everything else (terrain, lab table, cups, cotton puffs, thermometers, UI icons, sounds) is generated in code.

The parallax separation is deliberately exaggerated so a P4 class can see the effect; the reading method (eye level with the meniscus) is the real technique. Cotton is a model of fur: it traps air between fibres but does not show the hollow hair, waterproofing or the bear’s body heat — use the worksheet’s SQ2/SQ3 cross-sections for that comparison.
