import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIM,
  temperatureAt,
  trueReading,
  apparentReading,
  apparentTick,
  snapAngle,
  eyeLevelOk,
  readingOk,
  timeErrorSec,
  timeOk,
  clockFromMinutes,
  computeScores,
  starsFor,
  createSession,
  newTrainingRound,
  buildReading,
  buildMeasurement,
  buildSessionRecord,
  scoreAnswer,
  answerRecord,
} from '../logic.js';
import { ANALYSIS_QUESTIONS, VARIABLE_QUESTIONS, validateBank } from '../questions.js';

test('cooling curves reproduce the lesson data', () => {
  assert.equal(trueReading(0, false), 45);
  assert.equal(trueReading(3, false), 41);
  assert.equal(trueReading(6, false), 38);
  assert.equal(trueReading(0, true), 45);
  assert.equal(trueReading(3, true), 43);
  assert.equal(trueReading(6, true), 41);
  assert.ok(Math.abs(temperatureAt(6, false) - 38) < 0.06);
  assert.ok(Math.abs(temperatureAt(6, true) - 41) < 0.06);
});

test('temperature curves are monotonic and bounded by room temperature', () => {
  for (const insulated of [false, true]) {
    let prev = temperatureAt(0, insulated);
    for (let m = 0.25; m <= 10; m += 0.25) {
      const t = temperatureAt(m, insulated);
      assert.ok(t < prev, 'must cool down');
      assert.ok(t >= SIM.roomTempC - 1e-9, 'must not go below room');
      prev = t;
    }
  }
});

test('parallax is zero at eye level and grows with angle', () => {
  assert.ok(Math.abs(apparentReading(41, 0) - 41) < 1e-9);
  const above = apparentReading(41, 20);
  const below = apparentReading(41, -20);
  assert.ok(above < 41, 'looking down should appear lower');
  assert.ok(below > 41, 'looking up should appear higher');
  assert.ok(apparentReading(41, 30) < apparentReading(41, 20));
  assert.equal(apparentTick(41, 0), 41);
});

test('eye level snaps and grades', () => {
  assert.equal(snapAngle(0.8), 0);
  assert.equal(snapAngle(-1.1), 0);
  assert.equal(snapAngle(1.8), 1.8);
  assert.equal(snapAngle(50), 30);
  assert.equal(eyeLevelOk(2.4), true);
  assert.equal(eyeLevelOk(2.6), false);
  assert.equal(readingOk(41, 41.19), true);
  assert.equal(readingOk(41.5, 41.19), false);
  assert.equal(readingOk(40, 41.19), false);
});

test('time grading and clock formatting', () => {
  assert.equal(timeErrorSec(3.1, 3), 6);
  assert.equal(timeOk(timeErrorSec(3.1, 3)), true);
  assert.equal(timeOk(timeErrorSec(3.3, 3)), true);
  assert.equal(timeOk(timeErrorSec(3.4, 3)), false);
  assert.equal(clockFromMinutes(0), '0:00');
  assert.equal(clockFromMinutes(3.25), '3:15');
  assert.equal(clockFromMinutes(6), '6:00');
  assert.equal(clockFromMinutes(6.999), '6:59');
});

test('stars thresholds', () => {
  assert.equal(starsFor(90), 3);
  assert.equal(starsFor(89.9), 2);
  assert.equal(starsFor(70), 2);
  assert.equal(starsFor(69.9), 1);
  assert.equal(starsFor(50), 1);
  assert.equal(starsFor(49.9), 0);
});

test('scores combine reading, method and time', () => {
  const state = createSession({ uid: 'u1', name: 'A', email: 'a@b.c', classCode: '4C' }, 1000);
  state.training.rounds = [1, 2, 3, 4].map((round) =>
    newTrainingRound({ target: 45, startAngle: 0, round }),
  );
  state.training.rounds[0].correct = true;
  state.training.rounds[0].aligned = true;
  state.training.rounds[1].correct = true;
  state.training.rounds[1].aligned = true;
  state.training.rounds[2].correct = false;
  state.training.rounds[2].aligned = false;
  state.training.rounds[3].correct = true;
  state.training.rounds[3].aligned = false;

  state.experiment.measurements = [0, 3, 6].map((targetMin) =>
    buildMeasurement({ targetMin, capturedAtMin: targetMin }),
  );
  state.experiment.readings = [0, 3, 6].flatMap((targetMin) => [
    buildReading({ targetMin, cup: 'control', capturedAtMin: targetMin, entered: 45, trueTemp: 45, angleDeg: 0 }),
    // Every cotton reading is one degree out, as if read from an angle.
    buildReading({ targetMin, cup: 'cotton', capturedAtMin: targetMin, entered: 44, trueTemp: 45, angleDeg: 12 }),
  ]);
  state.analysis.answers = [{ correct: true }, { correct: true }, { correct: false }, { correct: true }];
  state.variables.answers = [true, true, true, false].map((correct) => ({ correct }));

  const s = computeScores(state);
  assert.equal(s.trainingReading, 75);
  assert.equal(s.trainingMethod, 50);
  assert.equal(s.training, 67.5);
  assert.equal(s.expReading, 50);
  assert.equal(s.expMethod, 50);
  assert.equal(s.expTime, 100);
  assert.equal(s.experiment, 62.5);
  assert.equal(s.analysis, 75);
  assert.equal(s.variables, 75);
  assert.equal(s.overall, 68.5);
  assert.equal(s.stars, 1);
});

test('session record is Firestore-safe and complete', () => {
  const state = createSession({ uid: 'u1', name: 'A', email: 'a@b.c', classCode: '4C' }, 1000);
  state.training.rounds.push(
    newTrainingRound({ target: 38, startAngle: 24, round: 1 }),
  );
  state.experiment.measurements.push(buildMeasurement({ targetMin: 0, capturedAtMin: 0 }));
  state.experiment.readings.push(
    buildReading({ targetMin: 0, cup: 'control', capturedAtMin: 0, entered: 45, trueTemp: 45, angleDeg: 0 }),
  );
  state.analysis.answers.push({ qid: 'a1', type: 'single', chosen: 0, correct: true, ms: 1200, correctAnswer: 0 });
  const rec = buildSessionRecord(state, 5000);
  assert.equal(rec.app, 'polar-fur-lab');
  assert.equal(rec.uid, 'u1');
  assert.equal(rec.durationSec, 4);
  assert.equal(rec.readings.length, 1);
  assert.equal(rec.answers.length, 1);
  assert.equal(JSON.stringify(rec).includes('undefined'), false);
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(rec)));
});

test('answer scoring supports every question type', () => {
  const single = ANALYSIS_QUESTIONS.find((q) => q.type === 'single');
  assert.equal(scoreAnswer(single, single.answer), true);
  assert.equal(scoreAnswer(single, (single.answer + 1) % single.options.length), false);

  const multi = ANALYSIS_QUESTIONS.find((q) => q.type === 'multi');
  assert.equal(scoreAnswer(multi, multi.answer), true);
  assert.equal(scoreAnswer(multi, [...multi.answer].reverse()), true);
  assert.equal(scoreAnswer(multi, [...multi.answer, 3]), false);

  const number = ANALYSIS_QUESTIONS.find((q) => q.type === 'number');
  assert.equal(scoreAnswer(number, number.answer), true);
  assert.equal(scoreAnswer(number, String(number.answer)), true);
  assert.equal(scoreAnswer(number, number.answer + 1), false);

  const match = VARIABLE_QUESTIONS.find((q) => q.type === 'match');
  assert.equal(scoreAnswer(match, match.pairs.map((p) => p.defIndex)), true);
  assert.equal(scoreAnswer(match, [0, 1, 2]), false);
});

test('answer records keep the first choice and timing', () => {
  const q = VARIABLE_QUESTIONS[1];
  const rec = answerRecord(q, 0, 3210.6);
  assert.deepEqual(rec, {
    qid: q.id,
    type: 'single',
    chosen: 0,
    correct: true,
    ms: 3211,
    correctAnswer: 0,
  });
});

test('question banks are valid', () => {
  assert.deepEqual(validateBank(ANALYSIS_QUESTIONS), []);
  assert.deepEqual(validateBank(VARIABLE_QUESTIONS), []);
  assert.ok(ANALYSIS_QUESTIONS.length >= 8);
  assert.ok(VARIABLE_QUESTIONS.length >= 8);
});
