// Pure rules, physics and scoring for the Polar Bear Fur Lab.
// No DOM, no three.js, no Firebase: everything here is unit-tested in tests/.

export const APP_ID = 'polar-fur-lab';
export const SCHEMA_VERSION = 1;

export const SIM = Object.freeze({
  startTempC: 45,
  roomTempC: 22,
  // Chosen so the model reproduces the lesson's class data:
  // bare 45 -> 41 -> 38 °C, cotton 45 -> 43 -> 41 °C.
  bareK: 0.06054,
  cottonK: 0.03189,
  measureMinutes: [0, 3, 6],
  realSecondsPerMinute: 8, // a 6-minute experiment runs for about 48 s
  timeToleranceSec: 20,
  eyeLevelToleranceDeg: 2.5,
  // Exaggerated a little so P4 pupils can see the effect on a demo thermometer.
  parallaxDepthM: 0.04,
  scaleMetersPerDegree: 0.0117,
  thermometerMin: 20,
  thermometerMax: 50,
});

export const CUP_LABELS = Object.freeze({
  control: { zh: '清水（對照）', en: 'Bare cup (control)', color: '#53c8ff' },
  cotton: { zh: '棉花（皮毛模型）', en: 'Cotton (fur model)', color: '#ffb45e' },
});

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const roundTo = (n, step = 1) => Math.round(n / step) * step;
export const pct = (n) => Math.round(clamp(n, 0, 1) * 1000) / 10;

/** Newton cooling curve used by the two cups. */
export function temperatureAt(minutes, insulated = false) {
  const k = insulated ? SIM.cottonK : SIM.bareK;
  const t = SIM.roomTempC + (SIM.startTempC - SIM.roomTempC) * Math.exp(-k * minutes);
  return clamp(t, SIM.roomTempC, SIM.startTempC);
}

/** The value a pupil should read from a correctly used thermometer (nearest 1 °C). */
export function trueReading(minutes, insulated = false) {
  return Math.round(temperatureAt(minutes, insulated));
}

/**
 * Apparent reading when the eye is not level with the meniscus.
 * The scale sits behind the column, so looking down from above makes the
 * column line up with a lower mark. Positive elevation = eye above.
 */
export function apparentReading(trueTemp, elevationDeg) {
  const rad = (clamp(elevationDeg, -35, 35) * Math.PI) / 180;
  const offset = (Math.tan(rad) * SIM.parallaxDepthM) / SIM.scaleMetersPerDegree;
  return trueTemp - offset;
}

export function apparentTick(trueTemp, elevationDeg) {
  return Math.round(apparentReading(trueTemp, elevationDeg));
}

export function snapAngle(deg) {
  const d = clamp(deg, -30, 30);
  return Math.abs(d) < 1.25 ? 0 : d;
}

export function eyeLevelOk(elevationDeg) {
  return Math.abs(elevationDeg) <= SIM.eyeLevelToleranceDeg;
}

export function readingOk(entered, trueTemp) {
  return Number.isFinite(Number(entered)) && Number(entered) === Math.round(trueTemp);
}

export function timeErrorSec(capturedAtMin, targetMin) {
  return Math.round((capturedAtMin - targetMin) * 60 * 10) / 10;
}

export function timeOk(errorSec) {
  return Math.abs(errorSec) <= SIM.timeToleranceSec;
}

export function clockFromMinutes(minutes) {
  const safe = Math.max(0, Number(minutes) || 0);
  const m = Math.floor(safe);
  const s = Math.floor((safe - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function clockFromSeconds(seconds) {
  return clockFromMinutes((Number(seconds) || 0) / 60);
}

export function formatSigned(n, digits = 0) {
  const v = Number(n) || 0;
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
}

export function starsFor(overallPct) {
  if (overallPct >= 90) return 3;
  if (overallPct >= 70) return 2;
  if (overallPct >= 50) return 1;
  return 0;
}

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Component scores, each a 0..1 fraction (or null when no evidence yet). */
export function computeScores(state) {
  const rounds = state?.training?.rounds || [];
  const readings = state?.experiment?.readings || [];
  const measurements = state?.experiment?.measurements || [];
  const analysis = state?.analysis?.answers || [];
  const variables = state?.variables?.answers || [];

  const trainingReading = rounds.length ? mean(rounds.map((r) => (r.correct ? 1 : 0))) : null;
  const trainingMethod = rounds.length ? mean(rounds.map((r) => (r.aligned ? 1 : 0))) : null;

  const expReading = readings.length ? mean(readings.map((r) => (r.correct ? 1 : 0))) : null;
  const expMethod = readings.length ? mean(readings.map((r) => (r.aligned ? 1 : 0))) : null;
  const timed = measurements.filter((m) => m.targetMin > 0);
  const expTime = timed.length ? mean(timed.map((m) => (m.timeOk ? 1 : 0))) : null;

  const analysisAcc = analysis.length ? mean(analysis.map((a) => (a.correct ? 1 : 0))) : null;
  const variablesAcc = variables.length ? mean(variables.map((a) => (a.correct ? 1 : 0))) : null;

  const training = trainingReading == null ? null : 0.7 * trainingReading + 0.3 * trainingMethod;
  const experiment = expReading == null ? null : 0.45 * expReading + 0.3 * expMethod + 0.25 * (expTime ?? 0);
  const overallParts = [
    [training, 0.2],
    [experiment, 0.4],
    [analysisAcc, 0.2],
    [variablesAcc, 0.2],
  ];
  const ready = overallParts.every(([v]) => v != null);
  const overall = ready ? overallParts.reduce((sum, [v, w]) => sum + v * w, 0) : null;

  return {
    trainingReading: trainingReading == null ? null : pct(trainingReading),
    trainingMethod: trainingMethod == null ? null : pct(trainingMethod),
    training: training == null ? null : pct(training),
    expReading: expReading == null ? null : pct(expReading),
    expMethod: expMethod == null ? null : pct(expMethod),
    expTime: expTime == null ? null : pct(expTime),
    experiment: experiment == null ? null : pct(experiment),
    analysis: analysisAcc == null ? null : pct(analysisAcc),
    variables: variablesAcc == null ? null : pct(variablesAcc),
    overall: overall == null ? null : pct(overall),
    stars: overall == null ? 0 : starsFor(overall * 100),
  };
}

export function badgesFor(state, scores = computeScores(state)) {
  const s = scores;
  return [
    {
      id: 'eye',
      icon: 'eye',
      zh: '水平讀數達人',
      en: 'Eye-level reader',
      earned: (s.trainingMethod ?? 0) >= 75 && (s.expMethod ?? 0) >= 75,
    },
    {
      id: 'reader',
      icon: 'thermometer',
      zh: '溫度計小專家',
      en: 'Thermometer expert',
      earned: (s.trainingReading ?? 0) >= 75 && (s.expReading ?? 0) >= 75,
    },
    {
      id: 'time',
      icon: 'clock',
      zh: '準時記錄員',
      en: 'On-time recorder',
      earned: (s.expTime ?? 0) >= 100,
    },
    {
      id: 'analyst',
      icon: 'chart',
      zh: '數據分析師',
      en: 'Data analyst',
      earned: (s.analysis ?? 0) >= 80,
    },
    {
      id: 'variables',
      icon: 'flask',
      zh: '變項專家',
      en: 'Variable master',
      earned: (s.variables ?? 0) >= 80,
    },
  ];
}

export function createSession(player, now = Date.now()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    app: APP_ID,
    sessionId: `${player.uid}-${now.toString(36)}`,
    startedAtMs: now,
    stage: 'home',
    player: {
      uid: String(player.uid || 'guest'),
      name: String(player.name || 'Guest').slice(0, 80),
      email: String(player.email || '').slice(0, 200),
      classCode: String(player.classCode || '').slice(0, 20),
    },
    training: { rounds: [] },
    experiment: { measurements: [], readings: [] },
    analysis: { answers: [] },
    variables: { answers: [] },
    completed: false,
  };
}

export function newTrainingRound({ target, startAngle, round, tutorial = false }) {
  return {
    round,
    targetTemp: Math.round(target),
    startAngle: Number(startAngle) || 0,
    entered: null,
    submittedAngle: null,
    aligned: false,
    correct: false,
    ms: 0,
    tutorial,
  };
}

/** Build one reading record for a cup at a measurement event. */
export function buildReading({ targetMin, cup, capturedAtMin, entered, trueTemp, angleDeg, ms }) {
  const aligned = eyeLevelOk(angleDeg);
  const error = Number(entered) - Math.round(trueTemp);
  return {
    targetMin,
    cup,
    capturedAtMin: Math.round(capturedAtMin * 1000) / 1000,
    entered: Number(entered),
    trueTemp: Math.round(trueTemp),
    apparent: Math.round(apparentReading(trueTemp, angleDeg) * 10) / 10,
    angleDeg: Math.round(angleDeg * 10) / 10,
    aligned,
    correct: readingOk(entered, trueTemp),
    error,
    ms: Math.max(0, Math.round(ms || 0)),
  };
}

export function buildMeasurement({ targetMin, capturedAtMin }) {
  const error = timeErrorSec(capturedAtMin, targetMin);
  return {
    targetMin,
    capturedAtMin: Math.round(capturedAtMin * 1000) / 1000,
    timeErrorSec: error,
    timeOk: targetMin === 0 ? true : timeOk(error),
  };
}

/** Firestore-safe record: JSON round-trip removes undefined/NaN, then pick known fields. */
export function buildSessionRecord(state, now = Date.now()) {
  const scores = computeScores(state);
  const badges = badgesFor(state, scores);
  const durationSec = Math.max(0, Math.round((now - state.startedAtMs) / 1000));
  const analysis = (state.analysis?.answers || []).map(cleanAnswer);
  const variables = (state.variables?.answers || []).map(cleanAnswer);
  const record = {
    schemaVersion: SCHEMA_VERSION,
    app: APP_ID,
    sessionId: String(state.sessionId || ''),
    uid: String(state.player.uid),
    name: String(state.player.name).slice(0, 80),
    email: String(state.player.email || '').slice(0, 200),
    classCode: String(state.player.classCode || '').slice(0, 20),
    startedAtMs: Number(state.startedAtMs) || now,
    finishedAtMs: now,
    durationSec,
    scores,
    overallAccuracy: scores.overall ?? 0,
    stars: scores.stars,
    badges: badges.map((b) => ({ id: b.id, earned: !!b.earned })),
    training: (state.training?.rounds || []).map((r) => ({
      round: r.round,
      targetTemp: r.targetTemp,
      startAngle: r.startAngle,
      entered: r.entered,
      submittedAngle: r.submittedAngle,
      aligned: !!r.aligned,
      correct: !!r.correct,
      ms: r.ms || 0,
    })),
    measurements: (state.experiment?.measurements || []).map((m) => ({
      targetMin: m.targetMin,
      capturedAtMin: m.capturedAtMin,
      timeErrorSec: m.timeErrorSec,
      timeOk: !!m.timeOk,
    })),
    readings: (state.experiment?.readings || []).map((r) => ({
      targetMin: r.targetMin,
      cup: r.cup,
      capturedAtMin: r.capturedAtMin,
      entered: r.entered,
      trueTemp: r.trueTemp,
      apparent: r.apparent,
      angleDeg: r.angleDeg,
      aligned: !!r.aligned,
      correct: !!r.correct,
      error: r.error,
      ms: r.ms || 0,
    })),
    analysis,
    variables,
    // Flat list is convenient for a teacher scanning one answer at a time.
    answers: [...analysis, ...variables],
    ua: typeof navigator !== 'undefined' ? String(navigator.userAgent).slice(0, 180) : '',
  };
  // JSON round-trip guarantees there are no undefined values (Firestore rejects them).
  return JSON.parse(JSON.stringify(record));
}

function cleanAnswer(a) {
  return {
    qid: String(a.qid || ''),
    type: String(a.type || ''),
    chosen: a.chosen ?? null,
    correct: !!a.correct,
    ms: Math.max(0, Math.round(a.ms || 0)),
    correctAnswer: a.correctAnswer ?? null,
  };
}

export function scoreAnswer(question, chosen) {
  if (!question) return false;
  switch (question.type) {
    case 'single':
      return Number(chosen) === Number(question.answer);
    case 'multi': {
      const picked = Array.isArray(chosen) ? [...new Set(chosen.map(Number))].sort((a, b) => a - b) : [];
      const answer = [...question.answer].map(Number).sort((a, b) => a - b);
      return picked.length === answer.length && picked.every((v, i) => v === answer[i]);
    }
    case 'number':
      return Number.isFinite(Number(chosen)) && Number(chosen) === Number(question.answer);
    case 'match': {
      const picked = Array.isArray(chosen) ? chosen.map(Number) : [];
      const answer = question.pairs.map((p) => Number(p.defIndex));
      return picked.length === answer.length && picked.every((v, i) => v === answer[i]);
    }
    default:
      return false;
  }
}

export function answerRecord(question, chosen, ms) {
  return {
    qid: question.id,
    type: question.type,
    chosen,
    correct: scoreAnswer(question, chosen),
    ms: Math.max(0, Math.round(ms || 0)),
    correctAnswer: question.type === 'match' ? question.pairs.map((p) => p.defIndex) : question.answer,
  };
}

export function overallFromState(state) {
  return computeScores(state).overall;
}
