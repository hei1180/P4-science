import { createWorld } from './three/world.js';
import {
  signIn,
  signOutUser,
  onUser,
  completeRedirectSignIn,
  isTeacherEmail,
  savePolarSession,
  loadPolarSessionsForUser,
} from './firebase.js';
import { loadSession, saveSession, saveProfile, loadProfile } from './state.js';
import { isMuted, setMuted, initAudio, sfx } from './audio.js';
import { toast, icon, openModal, closeModal, esc } from './ui.js';
import {
  SIM,
  createSession,
  newTrainingRound,
  buildMeasurement,
  buildReading,
  buildSessionRecord,
  sessionProgressPercent,
  trueReading,
} from '../logic.js';
import { ANALYSIS_QUESTIONS, VARIABLE_QUESTIONS } from '../questions.js';
import { renderHome } from './screens/home.js';
import { renderLogin } from './screens/login.js';
import { renderTraining } from './screens/training.js';
import { renderExperiment } from './screens/experiment.js';
import { renderAnalysis } from './screens/analysis.js';
import { renderQuiz } from './screens/quiz.js';
import { renderResults } from './screens/results.js';

const params = new URLSearchParams(location.search);
// Developer bypass is local-only; the public site always requires Google login.
const DEV = params.has('dev') && ['localhost', '127.0.0.1', '::1'].includes(location.hostname);

const screenEl = document.getElementById('screen');
const appEl = document.getElementById('app');
const bootEl = document.getElementById('boot');
const bootFill = document.getElementById('boot-fill');
const bootStatus = document.getElementById('boot-status');

const state = {
  world: null,
  player: null,
  session: null,
  screen: 'boot',
  teacher: false,
  entered: false,
  cleanups: [],
  booted: false,
  topbarKey: 'home',
};

const screens = {
  home: renderHome,
  login: renderLogin,
  training: renderTraining,
  experiment: renderExperiment,
  analysis: renderAnalysis,
  quiz: renderQuiz,
  variables: renderQuiz,
  results: renderResults,
};

function setBoot(progress, message) {
  if (bootFill) bootFill.style.width = `${Math.max(4, Math.min(100, progress))}%`;
  if (bootStatus && message) bootStatus.textContent = message;
}

function onCleanup(fn) {
  state.cleanups.push(fn);
}

function runCleanups() {
  for (const fn of state.cleanups.splice(0)) {
    try {
      fn();
    } catch (err) {
      console.warn('cleanup', err);
    }
  }
  closeModal();
  document.querySelectorAll('.read-overlay, .countdown-layer').forEach((el) => el.remove());
  document.body.classList.remove('measuring');
}

const ctx = {
  get world() {
    return state.world;
  },
  get player() {
    return state.player;
  },
  get session() {
    return state.session;
  },
  set session(v) {
    state.session = v;
  },
  get dev() {
    return DEV;
  },
  get teacher() {
    return state.teacher;
  },
  params,
  onCleanup,
  save() {
    if (state.session) saveSession(state.session);
    scheduleAutoSave();
  },
  async flushAutoSave() {
    await flushProgressQueue();
  },
  toast,
  sfx,
  icon,
  esc,
  async go(name, opts = {}) {
    return go(name, opts);
  },
  startNew(classCode) {
    startNew(classCode);
  },
  getSaved() {
    return state.player ? loadSession(state.player.uid) : null;
  },
  resume(saved) {
    state.session = saved;
    saveSession(saved);
    go(stageForSession(saved));
  },
  stageForSession,
  viewReport(saved) {
    state.session = saved;
    saveSession(saved);
    go('results');
  },
  toggleSound() {
    const next = setMuted(!isMuted());
    toast(next ? '已靜音 Sound off' : '已開啟聲音 Sound on', 'info', 1600);
    renderTopbar(state.topbarKey);
    return next;
  },
  async leaveHome() {
    if (state.screen === 'experiment' && state.session && !state.session.completed) {
      const ok = await confirmDialog({
        title: '離開實驗？',
        body: '已完成的讀數會自動保存，下次可以由此繼續，不會由 0 分鐘重新開始。',
        confirm: '離開並保存',
        danger: false,
      });
      if (!ok) return;
    }
    go('home');
  },
  async signOut() {
    const ok = await confirmDialog({
      title: '登出？',
      body: '你的進度已儲存在此裝置和班級資料庫。下次登入可繼續。',
      confirm: '登出',
      danger: false,
    });
    if (!ok) return;
    await signOutUser();
  },
  async signIn() {
    await signIn();
  },
  openTeacher() {
    window.location.href = './teacher.html';
  },
};

// ---------- Auth and boot ----------
function mockPlayer() {
  return {
    uid: 'dev-local',
    name: 'Dev Bear',
    email: 'dev@localhost',
    photoURL: '',
    classCode: '4C',
    dev: true,
  };
}

async function enterApp() {
  if (state.entered) return;
  state.entered = true;
  if (!state.player) return;
  const profile = { ...loadProfile(), ...(state.player.classCode ? { classCode: state.player.classCode } : {}) };
  state.player.classCode = profile.classCode || '4C';
  isTeacherEmail(state.player.email).then((v) => {
    state.teacher = (v || !!state.player.dev);
    if (state.screen !== 'boot') renderTopbar(state.topbarKey);
  });

  appEl.classList.remove('hidden');
  bootEl.classList.add('done');
  setTimeout(() => bootEl.remove(), 700);

  const saved = loadSession(state.player.uid);
  if (saved) {
    state.session = saved;
  } else if (!DEV) {
    screenEl.innerHTML = `<div class="wrap"><div class="card card-pad center"><div class="spinner" style="margin:0 auto 10px"></div><b>正在恢復你的進度…</b><div class="small muted" style="margin-top:5px">Checking for an unfinished session</div></div></div>`;
    renderTopbar('home');
    await restoreCloudProgress(state.player);
  }

  if (DEV && params.get('demo')) {
    document.body.dataset.ready = '1';
    seedDemo(params.get('demo'));
    return;
  }
  const initial = DEV && params.get('screen') ? params.get('screen') : 'home';
  go(initial);
  document.body.dataset.ready = '1';
}

function showLogin() {
  if (state.entered) return;
  appEl.classList.remove('hidden');
  bootEl.classList.add('done');
  setTimeout(() => bootEl.remove(), 700);
  go('login');
  document.body.dataset.ready = '1';
}

async function boot() {
  document.addEventListener('pointerdown', initAudio, { once: true, passive: true });
  setBoot(4, '正在載入字體…');
  await Promise.race([
    document.fonts?.ready || Promise.resolve(),
    new Promise((resolve) => setTimeout(resolve, 2200)),
  ]);
  setBoot(8, '正在準備北極實驗室…');
  try {
    state.world = await createWorld({
      canvas: document.getElementById('scene'),
      onProgress: (p, msg) => setBoot(p, msg),
    });
  } catch (err) {
    console.error('3D world failed', err);
    setBoot(100, '3D 場景未能載入，繼續使用 2D 模式…');
    toast('3D 場景未能載入，已切換到 2D 模式。', 'error', 5000);
  }

  setBoot(92, '正在連接班級記錄…');
  await completeRedirectSignIn();

  if (DEV) {
    state.player = mockPlayer();
    enterApp();
    return;
  }

  onUser(
    (user) => {
      state.player = { ...user, classCode: loadProfile().classCode || '4C' };
      enterApp();
    },
    () => {
      if (!state.entered) showLogin();
    },
  );
}

// ---------- Session ----------
function stageForSession(s) {
  if (!s) return 'home';
  if (s.completed) return 'results';
  if ((s.training?.rounds?.length || 0) < 4) return 'training';
  if ((s.experiment?.readings?.length || 0) < 6) return 'experiment';
  if ((s.analysis?.answers?.length || 0) < ANALYSIS_QUESTIONS.length) return 'analysis';
  if ((s.variables?.answers?.length || 0) < VARIABLE_QUESTIONS.length) return 'variables';
  return 'results';
}

// ---------- Auto-save / cloud resume ----------
let autoSaveTimer = null;
let autoSaveChain = Promise.resolve();

/** Write a compact in-progress record (plus the full session snapshot) to Firestore. */
async function writeCloudProgress() {
  const s = state.session;
  if (!s || s.completed || DEV || !state.player?.uid) return;
  try {
    const record = buildSessionRecord(s, Date.now());
    record.status = 'in-progress';
    record.finishedAtMs = 0;
    record.progressPercent = sessionProgressPercent(s);
    record.updatedAtMs = Date.now();
    record.stage = stageForSession(s);
    record.resumeState = JSON.parse(JSON.stringify(s));
    await savePolarSession(record);
  } catch (err) {
    console.warn('auto-save failed', err);
  }
}

function scheduleAutoSave() {
  if (DEV || !state.player?.uid || !state.session || state.session.completed) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveChain = autoSaveChain.then(writeCloudProgress).catch((err) => console.warn('auto-save chain', err));
  }, 1200);
}

async function flushProgressQueue() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  await autoSaveChain;
}

/** Restore the latest unfinished session from Firestore when this browser has no local copy. */
async function restoreCloudProgress(player) {
  if (!player?.uid || DEV) return false;
  try {
    const rows = await loadPolarSessionsForUser(player.uid);
    const candidates = rows
      .filter((r) => r.status === 'in-progress' && r.resumeState?.sessionId)
      .sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
    if (!candidates.length) return false;
    const s = candidates[0].resumeState;
    s.completed = false;
    state.session = s;
    saveSession(s);
    toast('已恢復上次未完成的進度', 'success', 3200);
    return true;
  } catch (err) {
    console.warn('cloud progress restore failed', err);
    return false;
  }
}

function startNew(classCode) {
  const code = String(classCode || state.player.classCode || '4C').trim().slice(0, 20) || '4C';
  const previous = state.session;
  state.player.classCode = code;
  saveProfile({ classCode: code });
  state.session = createSession({
    uid: state.player.uid,
    name: state.player.name,
    email: state.player.email,
    classCode: code,
  });
  // Starting again from an unfinished local session reuses its document id,
  // so the teacher sees one progress row rather than an orphaned duplicate.
  if (previous && !previous.completed && previous.player?.uid === state.player.uid && previous.sessionId) {
    state.session.sessionId = previous.sessionId;
  }
  state.session.dev = DEV;
  ctx.save();
  go('training');
}

// ---------- Routing ----------
async function go(name, opts = {}) {
  let target = name;
  if (target === 'variables') target = 'quiz';
  if (!screens[target]) target = 'home';
  runCleanups();
  state.screen = name;
  const view = screens[target](ctx, { ...opts, name });
  screenEl.innerHTML = view.html;
  screenEl.scrollTop = 0;
  screenEl.classList.toggle('screen-home', name === 'home');
  screenEl.classList.toggle('screen-analysis', name === 'analysis');
  screenEl.classList.toggle('screen-quiz', name === 'quiz' || name === 'variables');
  screenEl.classList.toggle('screen-results', name === 'results');
  screenEl.classList.remove('screen-enter');
  void screenEl.offsetWidth;
  screenEl.classList.add('screen-enter');
  state.topbarKey = view.topbar || name;
  renderTopbar(state.topbarKey);
  const stage = view.stage || (name === 'home' || name === 'login' ? 'home' : name === 'quiz' ? 'analysis' : name);
  if (state.world) {
    state.world.setStage(stage, { instant: !!opts.instant });
  }
  if (typeof view.mount === 'function') {
    try {
      await view.mount(screenEl, ctx, { ...opts, name });
    } catch (err) {
      console.error('screen mount failed', err);
      toast('畫面載入有問題，請重新整理。', 'error', 5000);
    }
  }
}

function renderTopbar(screen) {
  const top = document.getElementById('topbar');
  if (!top) return;
  if (screen === 'login' || !state.player) {
    top.classList.add('hidden');
    return;
  }
  top.classList.remove('hidden');
  const stages = [
    { key: 'training', label: '測量', icon: 'thermometer' },
    { key: 'experiment', label: '實驗', icon: 'timer' },
    { key: 'analysis', label: '分析', icon: 'chart' },
    { key: 'variables', label: '變項', icon: 'flask' },
  ];
  const activeMap = { training: 0, experiment: 1, analysis: 2, variables: 3, results: 4 };
  const active = activeMap[screen] ?? -1;
  const rail = stages
    .map((s, i) => {
      const cls = i < active ? 'done' : i === active ? 'active' : '';
      return `<div class="stage-step ${cls}"><span class="num">${i < active ? icon('check', 12) : i + 1}</span><span>${s.label}</span></div>`;
    })
    .join('');
  const name = state.player.name || 'Student';
  const initial = name.trim().slice(0, 1).toUpperCase();
  const avatar = state.player.photoURL
    ? `<img src="${esc(state.player.photoURL)}" alt="" referrerpolicy="no-referrer" />`
    : esc(initial);
  const teacherLink = state.teacher
    ? `<a class="icon-btn" href="./teacher.html" title="教師專區 Teacher" aria-label="Teacher">${icon('teacher', 19)}</a>`
    : '';
  const devBadge = DEV ? '<span class="dev-badge">DEV</span>' : '';
  top.innerHTML = `
    <div class="brand">
      <div class="brand-mark">${icon('snowflake', 24)}</div>
      <div class="brand-text"><b>北極熊保暖實驗室</b><span>P4 Science · 4LD2</span></div>
    </div>
    <div class="topbar-center"><div class="stage-rail">${rail}</div></div>
    <div class="top-actions">
      ${teacherLink}
      <button class="icon-btn" data-top="sound" title="${isMuted() ? '開啟聲音' : '靜音'}" aria-label="Sound">${icon(isMuted() ? 'mute' : 'volume', 19)}</button>
      <button class="icon-btn" data-top="home" title="主頁 Home" aria-label="Home">${icon('home', 19)}</button>
      <div class="user-chip" title="${esc(state.player.email || name)}">
        <span class="avatar">${avatar}</span>
        <span>${esc(name.split(' ')[0])}</span>${devBadge}
      </div>
      ${DEV ? '' : `<button class="icon-btn" data-top="signout" title="登出 Sign out" aria-label="Sign out">${icon('logout', 18)}</button>`}
    </div>`;
  top.querySelector('[data-top="sound"]').addEventListener('click', () => ctx.toggleSound());
  top.querySelector('[data-top="home"]').addEventListener('click', () => ctx.leaveHome());
  top.querySelector('[data-top="signout"]')?.addEventListener('click', () => ctx.signOut());
}

// ---------- Dialog ----------
function confirmDialog({ title, body, confirm = '確定', cancel = '取消', danger = false }) {
  return new Promise((resolve) => {
    const { el, close } = openModal(
      `<h2>${esc(title)}</h2><p>${esc(body)}</p>
       <div class="btn-row">
         <button class="btn ${danger ? 'btn-coral' : ''}" id="dlg-ok">${esc(confirm)}</button>
         <button class="btn btn-ghost" id="dlg-cancel" style="color:#08243a;border-color:rgba(8,36,58,.18)">${esc(cancel)}</button>
       </div>`,
      { onClose: () => resolve(false) },
    );
    el.querySelector('#dlg-ok').addEventListener('click', () => {
      resolve(true);
      close();
    });
    el.querySelector('#dlg-cancel').addEventListener('click', () => {
      resolve(false);
      close();
    });
  });
}
ctx.confirm = confirmDialog;

// ---------- Dev demo data ----------
function seedDemo(kind = 'results') {
  if (!state.player) state.player = mockPlayer('dev');
  const s = createSession({ uid: state.player.uid, name: '陳小北', email: 'demo@school.hk', classCode: '4C' });
  s.dev = true;
  state.session = s;
  saveSession(s);
  if (kind === 'training') {
    go('training');
    return;
  }
  const rounds = [
    { target: 45, angle: 0 },
    { target: 38, angle: 24 },
    { target: 41, angle: -22 },
    { target: 43, angle: 19 },
  ];
  s.training.rounds = rounds.map((r, i) => {
    const rec = newTrainingRound({ target: r.target, startAngle: r.angle, round: i + 1, tutorial: i === 0 });
    rec.submittedAngle = i === 1 ? 11 : i === 2 ? -8 : 0;
    rec.entered = r.target;
    rec.aligned = Math.abs(rec.submittedAngle) <= SIM.eyeLevelToleranceDeg;
    rec.correct = true;
    rec.ms = 9000 + i * 1700;
    return rec;
  });
  saveSession(s);
  if (kind === 'experiment' || kind === 'experiment-start') {
    go('experiment');
    return;
  }
  const capture = [0, 3, 6];
  const wrongAt = { 3: { control: false, cotton: true }, 6: { control: false, cotton: false } };
  s.experiment.measurements = capture.map((t) => buildMeasurement({ targetMin: t, capturedAtMin: t === 3 ? 3.08 : t }));
  s.experiment.readings = [];
  for (const t of capture) {
    for (const cup of ['control', 'cotton']) {
      const trueT = trueReading(t, cup === 'cotton');
      const bad = wrongAt[t]?.[cup];
      const angle = cup === 'control' ? 14 : -13;
      const entered = bad ? trueT - 1 : trueT;
      const rec = buildReading({
        targetMin: t,
        cup,
        capturedAtMin: t === 3 ? 3.08 : t,
        entered,
        trueTemp: trueT,
        angleDeg: bad ? angle : 0,
        ms: 12000,
      });
      s.experiment.readings.push(rec);
    }
  }
  saveSession(s);
  if (kind === 'analysis' || kind === 'analysis-start') {
    go('analysis');
    return;
  }
  s.analysis.answers = ANALYSIS_QUESTIONS.map((q, i) => {
    const chosen = q.type === 'multi' ? q.answer : q.type === 'match' ? q.pairs.map((p) => p.defIndex) : q.answer;
    return { qid: q.id, type: q.type, chosen, correct: i < 8, ms: 7000 + i * 500, correctAnswer: q.answer };
  });
  saveSession(s);
  if (kind === 'variables' || kind === 'variables-start') {
    go('quiz', { section: 'variables' });
    return;
  }
  s.variables.answers = VARIABLE_QUESTIONS.map((q, i) => {
    const chosen = q.type === 'multi' ? q.answer : q.type === 'match' ? q.pairs.map((p) => p.defIndex) : q.answer;
    return { qid: q.id, type: q.type, chosen, correct: i < 7, ms: 8000 + i * 400, correctAnswer: q.answer };
  });
  s.completed = true;
  s.stage = 'results';
  saveSession(s);
  go('results');
}

if (DEV) {
  window.__polar = {
    get state() {
      return state;
    },
    get session() {
      return state.session;
    },
    get world() {
      return state.world;
    },
    go,
    startNew,
    seed: seedDemo,
    ctx,
  };
} else {
  window.__polar = { get session() { return state.session; }, get world() { return state.world; } };
}

boot().catch((err) => {
  console.error(err);
  setBoot(100, '載入失敗，請重新整理。');
  bootStatus?.classList.add('boot-error');
  if (bootStatus) bootStatus.textContent = '載入失敗：' + (err?.message || err);
});
