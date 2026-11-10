# Teacher guide · 北極熊保暖實驗室

**P4 Science · 4LD2 動物的適應特徵 · Lesson 2 (Data tell us) · 30 minutes**

Google login is required; there is no guest mode. Progress is auto-saved to Firestore, and the teacher dashboard shows both in-progress and completed sessions.

The simulation is designed to be used **alongside** the existing 8-page worksheet, not to replace it. It supplies the hands-on reading practice that the lesson plan says was a bottleneck, the 0/3/6-minute data table, and a clean record of each pupil’s method and answers.

---

## Lesson at a glance

| Time | Stage | What pupils do | What the app records |
| --- | --- | --- | --- |
| 0–4 min | Login + mission brief | Sign in with Google, choose class, read the key question | Name, email, class |
| 4–10 min | **測量 · Eye-level practice** | Four thermometer rounds: drag to eye level, read the meniscus, enter the value | Entered value, submitted angle, aligned, correct, time |
| 10–20 min | **實驗 · Cotton vs bare cup** | Start the fair test; measure both cups at 0 / 3 / 6 minutes; record the table | Capture time, time error, cup values, angle, aligned, correct |
| 20–27 min | **分析 + 變項** | Interpret the class data (CER), then 8 variable questions | Every answer, correct/incorrect, response time |
| 27–30 min | Report + discussion | Read the report, compare methods, connect to SQ2/SQ3 worksheet | Overall %, component %, badges, full review |

The simulation runs at **8 seconds = 1 minute** (a 6-minute experiment takes about 48 seconds of real time). The clock pauses during each measurement so reading is not a race.

---

## Before the lesson

1. Have pupils sign in with their school Google accounts. Do a 30-second check that the login screen appears and the Google popup is allowed.
2. Decide whether pupils work **individually** (recommended for method data) or in pairs with the four worksheet roles: 材料員 / 溫度計讀數員 / 計時記錄員 / 報告員. If pairs share one device, enter both names in the class code? No — use one login per device and note the pair on paper.
3. Open `teacher.html` on your own device and keep it in a tab. It updates when you refresh.
4. If you have not published the Firestore rules, do the one-time setup in [`firebase-setup.md`](firebase-setup.md). Without it, pupils can still do the simulation but their records will not save.
5. Optional: project the 3D scene and do the first eye-level round together.

---

## How the method is scored

The app is deliberately explicit about **method**, not just the final number.

### Eye level

At the moment a pupil records a cup, the app stores the camera’s vertical angle relative to the meniscus.

* **Aligned** = within **±2.5°**. At this angle the apparent shift is under 0.15 °C, so the nearest whole number is reliable.
* **Not aligned** = the pupil read from above or below. The 2D reading scope shows the shift. The training rounds use a 3D close-up for the effect; during the experiment, the view zooms sharply into the active cup, while the two cup tabs keep both recorded values visible so pupils can compare them. Switching tabs zooms to the other cup.
* The angle is exaggerated for visibility. The real technique is identical: **eye level with the top of the liquid column, look straight across**.

### On time

* The 0-minute reading is automatic when the experiment starts.
* For 3 and 6 minutes, the app records the actual capture time to the second (simulated). A reading is **on time** if it is within **±20 simulated seconds**.
* The “Measure now” button opens 15 s early and stays open for 40 s; if a pupil misses the window, the app auto-opens a **late** reading so the lesson can finish. The teacher dashboard marks it late.

### Correct reading

The true temperature at the captured moment is calculated from the same cooling curves that drive the 3D thermometers:

| Minute | Bare cup | Cotton cup |
| --- | --- | --- |
| 0 | 45 °C | 45 °C |
| 3 | 41 °C | 43 °C |
| 6 | 38 °C | 41 °C |

A reading is correct if the entered whole number equals the true value at that moment. A pupil who reads the apparent value from an angle will often be 1–2 °C out — that is the teaching point, not a technical failure.

### Overall score

| Component | Weight |
| --- | --- |
| Thermometer training | 20% (70% reading, 30% eye level) |
| Experiment | 40% (45% reading, 30% eye level, 25% on time) |
| Data analysis | 20% |
| Variables quiz | 20% |

Badges are awarded at 75–80% on the relevant components; the report shows each component separately so a low overall score can still reveal a strong method or strong analysis.

---

## Reading the dashboard

Open `teacher.html` and sign in with the teacher account.

* **Eye level %** — proportion of the six cup readings recorded within ±2.5°. 100% means the pupil consistently used the correct viewing position.
* **On time %** — proportion of the 3/6-minute readings captured within ±20 s.
* **Reading %** — proportion of the six values that match the true temperature.
* **Analysis / Variables %** — quiz accuracy.
* **Training %** — the four practice rounds.
* **Status / progress** — in-progress rows show `進行中 X%` and the last activity time; completed rows show `已完成`. Pupils can continue on another signed-in device.
* **Row detail** — every training round and every cup reading with the entered value, actual value, angle, aligned flag, correct flag and capture time; then every answer with the correct answer.

### Suggested follow-up

* **Low eye-level %, high reading %** — the pupil guessed or already knew the pattern; ask them to demonstrate the eye-level position and redo one round.
* **High eye-level %, low reading %** — the viewing position is right but scale-reading is insecure; use the printed thermometer or the worksheet’s 0/3/6 table.
* **Low on-time %** — the pupil was not watching the clock; in the real experiment, assign the 計時記錄員 role and practise the 3-minute cue.
* **High reading %, low analysis** — the pupil can collect data but needs the CER sentence frames; use the worksheet’s 8. 分析數據 and the claim-evidence-reasoning frame.
* **Low variables** — revisit the three definitions with the actual apparatus: point to the cotton (IV), the thermometer (DV) and the 80 ml / 45 °C / same type of cup for both groups / same time (controls).

---

## Connecting to the worksheet and SQ2/SQ3

The simulation covers the **fair test, data table, eye-level reading and CER**. It does **not** replace the cross-section work:

* **SQ2 (how fur traps air)** — use the worksheet’s two cross-sections: polar bear hair has a large hollow core, cotton has a narrow lumen; fur also traps air between hairs.
* **SQ3 (why real fur is better)** — compare hollow vs narrow, waterproof vs absorbent, long guard hair + dense underfur vs one cotton layer.
* **Model limitations** — cotton cannot show the hollow hair, the oily waterproofing or the bear’s body heat. The worksheet’s comparison table and “model limitation” question should still be completed.

The app’s analysis questions include the two key ideas (air is trapped in the hollow core and between hairs; real fur is better because it is hollow and waterproof), so the digital and paper tasks reinforce each other.

---

## Classroom management notes

* **One device per pupil** gives the cleanest method data. Pairs can share, but the eye-angle record then belongs to whoever held the device.
* Use **headphones** or mute the device; the app has a sound toggle.
* If the 3D scene is slow, close other tabs. The 2D reading scope and all questions still work if WebGL is unavailable.
* Pupils can leave and resume: progress is saved locally and auto-saved to Firestore for the same Google account. If the experiment was interrupted after the 0- or 3-minute reading, the briefing resumes from the next time point; completed readings are kept. The teacher dashboard shows an in-progress row with a progress percentage.
* The teacher dashboard is read-only. To clean up a test record, delete it in the Firestore console (teacher only).
* `teacher.html?demo` is safe to show on the projector; it does not read or write Firebase.

---

## Quick answers for the teacher

**“Why is the thermometer so big?”** It is a demonstration thermometer. A real thermometer has the same scale/column arrangement; the enlarged scale makes the 1 °C marks readable on a classroom screen.

**“Why does the reading change when I move my head?”** The scale is printed behind the liquid column. Looking from above or below means the line of sight crosses the scale at a different place — parallax error. The app shows the same effect in 3D and in the reading scope.

**“Did the fur make heat?”** No. The data show both cups only cooled; neither rose above 45 °C. The bear’s body makes heat; the fur traps air and slows heat loss.

**“Is the cotton the same as fur?”** It is a model. Cotton traps air between fibres, so it slows cooling, but it is not hollow, not waterproof and not living. Real fur is better at keeping the bear warm.
