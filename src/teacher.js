import {
  signIn,
  signOutUser,
  onUser,
  completeRedirectSignIn,
  isTeacherEmail,
  loadPolarSessions,
  firestoreHelp,
} from './firebase.js';
import { $, esc, icon, stars, toast, openModal, formatDate, formatDuration } from './ui.js';
import { ANALYSIS_QUESTIONS, VARIABLE_QUESTIONS, findQuestion } from '../questions.js';
import { trueReading, starsFor } from '../logic.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const app = $('#teacher-app');
let searchTimer = null;
let composing = false;

const state = {
  view: 'loading',
  user: null,
  sessions: [],
  error: '',
  query: '',
  klass: 'all',
  sort: 'date',
  demo: DEMO,
};

function render() {
  if (state.view === 'login') return renderLogin();
  if (state.view === 'denied') return renderDenied();
  if (state.view === 'loading') return renderLoading();
  return renderDashboard();
}

function shell(inner, { head = true } = {}) {
  return `<div class="teacher-page">
    ${head ? `<div class="teacher-head">
      <div class="brand-mark">${icon('snowflake', 24)}</div>
      <div><h1>北極熊保暖實驗室 · 教師專區</h1><p>P4 Science · 4LD2 · 班級實驗記錄</p></div>
      <div class="spacer"></div>
      ${state.user ? `<span class="pill" style="background:#fff;border-color:rgba(8,36,58,.12);color:#33566d">${icon('user', 13)} ${esc(state.user.name)}</span>` : ''}
      <a class="teacher-tab" href="./index.html" style="text-decoration:none">${icon('arrow-left', 13)} 返回實驗室</a>
      ${state.user ? `<button class="teacher-tab" id="t-signout">${icon('logout', 13)} 登出</button>` : ''}
    </div>` : ''}
    ${inner}
  </div>`;
}

function renderLoading() {
  app.innerHTML = shell(`<div class="teacher-empty"><div class="spinner" style="margin:0 auto 10px;border-color:rgba(8,36,58,.15);border-top-color:#22b8d6"></div><b>正在載入班級記錄…</b><span>Connecting to Firestore</span></div>`);
  bindShell();
}

function renderLogin(error = '') {
  app.innerHTML = shell(`
    <div class="teacher-login">
      <div class="login-bear" style="color:#22b8d6">${icon('snowflake', 44)}</div>
      <h1>教師登入</h1>
      <p>請用班級教師的 Google 帳戶登入，查看學生的實驗讀數、方法、答案和準確度。<br/>This dashboard reads <b>polarSessions</b> in the Firestore project <b>p1-maths</b>.</p>
      <button class="btn btn-lg btn-block google-btn" id="t-google" style="margin-top:20px">${icon('google', 22)} 使用 Google 登入</button>
      ${error ? `<div class="login-error show" style="margin-top:14px">${esc(error)}</div>` : ''}
      <div class="login-fine">未設定？請先依照 <a href="./docs/firebase-setup.md" target="_blank">docs/firebase-setup.md</a> 發佈 Firestore 規則，並在 Firebase Authentication 加入網域。</div>
      <div class="login-divider">或 OR</div>
      <a class="btn btn-ghost btn-block" href="./teacher.html?demo" style="color:#08243a;border-color:rgba(8,36,58,.16)">${icon('chart', 16)} 查看示範數據</a>
    </div>
  `);
  bindShell();
  $('#t-google')?.addEventListener('click', async () => {
    const btn = $('#t-google');
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> 正在登入…`;
    try {
      await signIn();
    } catch (err) {
      renderLogin(err?.message || '登入失敗。');
    } finally {
      if (document.body.contains(btn)) {
        btn.disabled = false;
        btn.innerHTML = old;
      }
    }
  });
}

function renderDenied() {
  app.innerHTML = shell(`
    <div class="teacher-login">
      <div class="big-emoji">🔒</div>
      <h1>此帳戶沒有教師權限</h1>
      <p>你已登入為 <b>${esc(state.user?.email || '')}</b>。只有教師帳戶可以讀取全班記錄。</p>
      <p class="small">If this is your teacher account, add its SHA-256 hash to <b>TEACHER_EMAIL_HASHES</b> in <b>src/firebase.js</b>, and add the email to <b>firestore.rules</b>.</p>
      <div class="btn-row" style="justify-content:center;margin-top:18px">
        <button class="btn" id="t-back">返回實驗室</button>
        <button class="btn btn-ghost" id="t-switch" style="color:#08243a;border-color:rgba(8,36,58,.16)">切換帳戶</button>
      </div>
    </div>
  `);
  bindShell();
  $('#t-back')?.addEventListener('click', () => (location.href = './index.html'));
  $('#t-switch')?.addEventListener('click', async () => {
    await signOutUser();
    location.reload();
  });
}

function bindShell() {
  $('#t-signout')?.addEventListener('click', async () => {
    await signOutUser();
    location.reload();
  });
}

function renderDashboard() {
  const all = state.sessions;
  const filtered = filterSessions(all);
  const kpis = computeKpis(all);
  const classes = [...new Set(all.map((s) => s.classCode).filter(Boolean))].sort();
  const options = ['all', ...classes].map((c) => `<option value="${esc(c)}" ${state.klass === c ? 'selected' : ''}>${c === 'all' ? '全部班別 All classes' : esc(c)}</option>`).join('');
  const rows = filtered.length
    ? filtered.map((s) => rowHtml(s)).join('')
    : '';
  const errorBlock = state.error
    ? `<div class="notice" style="margin-bottom:12px;border-color:#f2d285;background:#fff8e6;color:#7a5500">
        <b>讀取失敗：</b>${esc(state.error)}<br/>${esc(firestoreHelp())}
        <button class="btn btn-sm" id="t-retry" style="margin-left:8px">重試</button>
      </div>`
    : '';
  const demoBlock = state.demo
    ? `<div class="demo-banner">${icon('info', 15)} 示範數據 · 這不是真實學生記錄。正式使用請用教師 Google 帳戶登入。</div>`
    : '';

  app.innerHTML = shell(`
    ${demoBlock}
    ${errorBlock}
    <div class="teacher-kpis">
      <div class="kpi"><b>${kpis.students}</b><span>Students</span><small>不同學生帳戶</small></div>
      <div class="kpi"><b>${kpis.sessions}</b><span>Sessions</span><small>所有記錄</small></div>
      <div class="kpi"><b>${kpis.inProgress}</b><span>In progress</span><small>進行中</small></div>
      <div class="kpi"><b>${kpis.overall}%</b><span>Overall</span><small>完成實驗平均</small></div>
      <div class="kpi"><b>${kpis.eye}%</b><span>Eye level</span><small>眼睛水平讀數</small></div>
      <div class="kpi"><b>${kpis.onTime}%</b><span>On time</span><small>3 / 6 分鐘準時</small></div>
      <div class="kpi"><b>${kpis.variables}%</b><span>Variables</span><small>變項挑戰平均</small></div>
    </div>

    <div class="teacher-toolbar">
      <input class="input" id="t-search" placeholder="搜尋姓名 / 電郵…" value="${esc(state.query)}" />
      <select class="input" id="t-class">${options}</select>
      <select class="input" id="t-sort">
        <option value="date" ${state.sort === 'date' ? 'selected' : ''}>最新優先 Newest</option>
        <option value="score" ${state.sort === 'score' ? 'selected' : ''}>分數高至低 Score</option>
        <option value="name" ${state.sort === 'name' ? 'selected' : ''}>姓名 Name</option>
      </select>
      <div class="spacer" style="flex:1"></div>
      <button class="teacher-tab" id="t-refresh">${icon('refresh', 13)} 重新整理</button>
      <button class="teacher-tab" id="t-csv">${icon('download', 13)} Sessions CSV</button>
      <button class="teacher-tab" id="t-csv-readings">${icon('download', 13)} Readings CSV</button>
    </div>

    <div class="teacher-table-wrap">
      ${rows ? `<table class="teacher-table">
        <thead><tr><th>日期</th><th>狀態</th><th>姓名</th><th>班別</th><th>總分</th><th>溫度計</th><th>眼睛水平</th><th>準時</th><th>分析</th><th>變項</th><th>星</th><th>時長</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : `<div class="teacher-empty"><b>${all.length ? '沒有符合篩選的記錄' : '未有學生記錄'}</b><span>${all.length ? '試試清除搜尋或選擇其他班別。' : '學生完成實驗後，記錄會自動出現在這裡。'}</span></div>`}
    </div>
    <p class="tiny" style="color:#6f8b9c;text-align:center;margin-top:14px">Firestore project <b>p1-maths</b> · collection <b>polarSessions</b> · ${all.length} records loaded. 點按任何一列查看每位學生的詳細答案。</p>
  `);
  bindShell();
  bindDashboard();
}

function filterSessions(list) {
  const q = state.query.trim().toLowerCase();
  let out = list.filter((s) => {
    if (state.klass !== 'all' && s.classCode !== state.klass) return false;
    if (!q) return true;
    return `${s.name || ''} ${s.email || ''} ${s.classCode || ''}`.toLowerCase().includes(q);
  });
  if (state.sort === 'score') out = out.slice().sort((a, b) => (b.overallAccuracy || 0) - (a.overallAccuracy || 0));
  else if (state.sort === 'name') out = out.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-HK'));
  else out = out.slice().sort((a, b) => (b.updatedAtMs || b.finishedAtMs || 0) - (a.updatedAtMs || a.finishedAtMs || 0));
  return out;
}

function bindDashboard() {
  const applySearch = () => {
    clearTimeout(searchTimer);
    renderDashboard();
    const input = $('#t-search');
    if (input) {
      input.focus();
      input.setSelectionRange(state.query.length, state.query.length);
    }
  };
  const search = $('#t-search');
  search?.addEventListener('compositionstart', () => {
    composing = true;
  });
  search?.addEventListener('compositionend', () => {
    composing = false;
    applySearch();
  });
  search?.addEventListener('input', (e) => {
    state.query = e.target.value;
    if (composing) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applySearch, 220);
  });
  $('#t-class')?.addEventListener('change', (e) => {
    state.klass = e.target.value;
    renderDashboard();
  });
  $('#t-sort')?.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderDashboard();
  });
  $('#t-refresh')?.addEventListener('click', () => loadSessions());
  $('#t-retry')?.addEventListener('click', () => loadSessions());
  $('#t-csv')?.addEventListener('click', exportSessionsCsv);
  $('#t-csv-readings')?.addEventListener('click', exportReadingsCsv);
  app.querySelectorAll('[data-session]').forEach((tr) => {
    tr.addEventListener('click', () => {
      const s = state.sessions.find((x) => x.id === tr.dataset.session || x.sessionId === tr.dataset.session);
      if (s) showDetail(s);
    });
  });
}

function rowHtml(s) {
  const sc = s.scores || {};
  const eye = Math.round((((sc.trainingMethod ?? 0) + (sc.expMethod ?? 0)) / 2) * 10) / 10;
  const overall = s.overallAccuracy ?? sc.overall ?? 0;
  const inProgress = s.status === 'in-progress';
  const progress = Math.round(s.progressPercent ?? 0);
  const when = s.updatedAtMs || s.finishedAtMs;
  return `<tr data-session="${esc(s.id || s.sessionId)}">
    <td>${formatDate(when)}</td>
    <td>${inProgress ? `<span class="status-pill status-progress">進行中 ${progress}%</span>` : `<span class="status-pill status-done">已完成</span>`}</td>
    <td class="name-cell">${esc(s.name || '—')}<div class="tiny" style="color:#8aa6b5">${esc(s.email || '')}</div></td>
    <td>${esc(s.classCode || '—')}</td>
    <td class="score-cell">${inProgress ? '—' : `<span class="mini-bar"><i style="width:${Math.max(0, Math.min(100, overall))}%"></i></span>${overall}%`}</td>
    <td>${sc.trainingReading ?? '—'}%</td>
    <td>${eye}%</td>
    <td>${sc.expTime ?? '—'}%</td>
    <td>${sc.analysis ?? '—'}%</td>
    <td>${sc.variables ?? '—'}%</td>
    <td style="color:#c08a12">${inProgress ? '—' : stars(s.stars ?? starsFor(overall), 13)}</td>
    <td>${formatDuration(s.durationSec)}</td>
  </tr>`;
}

function showDetail(s) {
  const sc = s.scores || {};
  const inProgress = s.status === 'in-progress';
  const progress = Math.round(s.progressPercent ?? 0);
  const when = s.updatedAtMs || s.finishedAtMs;
  const readings = s.readings || [];
  const measurements = s.measurements || [];
  const training = s.training || [];
  const answers = s.answers || [...(s.analysis || []), ...(s.variables || [])];
  const eyePct = readings.length ? Math.round((readings.filter((r) => r.aligned).length / readings.length) * 100) : 0;
  const timed = measurements.filter((m) => m.targetMin > 0);
  const timePct = timed.length ? Math.round((timed.filter((m) => m.timeOk).length / timed.length) * 100) : 0;
  const angleAvg = readings.length ? Math.round(readings.reduce((a, r) => a + Math.abs(r.angleDeg || 0), 0) / readings.length) : 0;

  const readingRows = readings
    .slice()
    .sort((a, b) => a.targetMin - b.targetMin || (a.cup === 'control' ? -1 : 1))
    .map((r) => {
      const m = measurements.find((x) => x.targetMin === r.targetMin);
      return `<tr><td>${r.targetMin} 分鐘</td><td>${r.cup === 'control' ? '清水' : '棉花'}</td><td>${clock(r.capturedAtMin)}</td><td>${r.entered}</td><td>${r.trueTemp}</td><td>${formatSigned(r.angleDeg)}</td><td class="${r.aligned ? 'ok' : 'no'}">${r.aligned ? '✓' : '✗'}</td><td class="${r.correct ? 'ok' : 'no'}">${r.correct ? '✓' : '✗'}</td><td class="${m?.timeOk ? 'ok' : 'no'}">${m?.timeOk ? '✓' : '✗'}</td></tr>`;
    })
    .join('');

  const trainingRows = training
    .map((r) => `<tr><td>${r.round}</td><td>${r.targetTemp} °C</td><td>${r.entered ?? '—'}</td><td>${formatSigned(r.submittedAngle ?? 0)}</td><td class="${r.aligned ? 'ok' : 'no'}">${r.aligned ? '✓' : '✗'}</td><td class="${r.correct ? 'ok' : 'no'}">${r.correct ? '✓' : '✗'}</td></tr>`)
    .join('');

  const answerRows = answers
    .map((a) => {
      const q = findQuestion(a.qid);
      if (!q) return '';
      const chosen = answerText(q, a.chosen);
      return `<div class="detail-answer"><span class="mark ${a.correct ? 'ok' : 'no'}">${a.correct ? '✓' : '✗'}</span><div><b>${esc(q.tag)}</b> ${esc(q.prompt)}<div style="color:#6f8b9c">${a.correct ? '正確' : `作答：${esc(chosen)}`}</div></div></div>`;
    })
    .join('');

  const { el: modal, close } = openModal(`
    <div class="row-between" style="gap:12px;flex-wrap:wrap">
      <div><p class="kicker" style="margin-bottom:6px">STUDENT REPORT</p><h2 style="margin:0">${esc(s.name || '—')} <span class="muted" style="font-size:14px">${esc(s.classCode || '')}</span></h2>
      <div style="margin-top:6px">${inProgress ? `<span class="status-pill status-progress">進行中 ${progress}%</span>` : `<span class="status-pill status-done">已完成</span>`}</div>
      <p class="small muted" style="margin:6px 0 0">${formatDate(when)} · 時長 ${formatDuration(s.durationSec)} · ${esc(s.email || '')}</p></div>
      <div style="text-align:right"><div style="font-size:38px;font-weight:900;color:#08243a;line-height:1">${inProgress ? progress : (s.overallAccuracy ?? sc.overall ?? 0)}%</div><div class="tiny" style="color:#7b98a8">${inProgress ? 'PROGRESS' : 'OVERALL'}</div></div>
    </div>
    <div class="detail-grid" style="margin-top:16px">
      <div class="detail-box"><span>Eye level</span><b>${eyePct}%</b><small>平均角度 ${angleAvg}°</small></div>
      <div class="detail-box"><span>On time</span><b>${timePct}%</b><small>3 / 6 分鐘</small></div>
      <div class="detail-box"><span>Reading</span><b>${sc.expReading ?? '—'}%</b><small>${readings.length} / 6 讀數</small></div>
      <div class="detail-box"><span>Analysis</span><b>${sc.analysis ?? '—'}%</b><small>${(s.analysis || []).length} / 10 題</small></div>
      <div class="detail-box"><span>Variables</span><b>${sc.variables ?? '—'}%</b><small>${(s.variables || []).length} / 8 題</small></div>
      <div class="detail-box"><span>Training</span><b>${sc.training ?? '—'}%</b><small>${training.length} / 4 回合</small></div>
    </div>
    <h3 style="font-size:15px;margin:18px 0 4px">實驗讀數 / Experimental readings</h3>
    <div style="overflow-x:auto"><table class="detail-table"><thead><tr><th>時間</th><th>杯</th><th>記錄</th><th>輸入</th><th>實際</th><th>眼睛</th><th>水平</th><th>正確</th><th>準時</th></tr></thead><tbody>${readingRows || '<tr><td colspan="9">沒有讀數</td></tr>'}</tbody></table></div>
    <h3 style="font-size:15px;margin:18px 0 4px">眼睛水平練習 / Training</h3>
    <div style="overflow-x:auto"><table class="detail-table"><thead><tr><th>回合</th><th>目標</th><th>輸入</th><th>角度</th><th>水平</th><th>正確</th></tr></thead><tbody>${trainingRows || '<tr><td colspan="6">沒有記錄</td></tr>'}</tbody></table></div>
    <h3 style="font-size:15px;margin:18px 0 4px">答案 / Answers</h3>
    <div class="detail-answers">${answerRows || '<p class="small">沒有答案</p>'}</div>
    <div class="btn-row" style="margin-top:18px"><button class="btn" id="detail-csv">${icon('download', 15)} 這位學生 CSV</button><button class="btn btn-ghost" id="detail-close" style="color:#08243a;border-color:rgba(8,36,58,.16)">關閉</button></div>
  `);
  modal.querySelector('#detail-close').addEventListener('click', close);
  modal.querySelector('#detail-csv').addEventListener('click', () => {
    downloadCsv(`${safeName(s.name)}-polar-lab.csv`, [sessionCsvRow(s)]);
  });
}

async function loadSessions() {
  state.view = 'loading';
  state.error = '';
  render();
  try {
    state.sessions = await loadPolarSessions();
    state.view = 'dashboard';
    render();
  } catch (err) {
    console.error(err);
    state.error = err?.message || String(err);
    state.view = 'dashboard';
    state.sessions = [];
    render();
  }
}

function computeKpis(list) {
  const students = new Set(list.map((s) => s.uid).filter(Boolean)).size;
  const completed = list.filter((s) => s.status !== 'in-progress');
  const inProgress = list.length - completed.length;
  const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
  const overall = avg(completed.map((s) => s.overallAccuracy ?? s.scores?.overall ?? 0).filter(Number.isFinite));
  const readings = list.flatMap((s) => s.readings || []);
  const eye = readings.length ? Math.round((readings.filter((r) => r.aligned).length / readings.length) * 100) : 0;
  const timed = list.flatMap((s) => (s.measurements || []).filter((m) => m.targetMin > 0));
  const onTime = timed.length ? Math.round((timed.filter((m) => m.timeOk).length / timed.length) * 100) : 0;
  const variables = avg(completed.map((s) => s.scores?.variables ?? 0).filter(Number.isFinite));
  return { students, sessions: list.length, inProgress, overall, eye, onTime, variables };
}

function exportSessionsCsv() {
  const list = filterSessions(state.sessions);
  const headers = ['date', 'status', 'progressPercent', 'name', 'class', 'email', 'overall', 'trainingReading', 'trainingMethod', 'expReading', 'expMethod', 'expTime', 'analysis', 'variables', 'stars', 'durationSec', 'uid', 'sessionId'];
  const rows = list.map((s) => {
    const sc = s.scores || {};
    return [
      new Date(s.updatedAtMs || s.finishedAtMs || 0).toISOString(),
      s.status || 'complete', s.progressPercent ?? 100,
      s.name, s.classCode, s.email, s.overallAccuracy ?? sc.overall ?? 0,
      sc.trainingReading, sc.trainingMethod, sc.expReading, sc.expMethod, sc.expTime, sc.analysis, sc.variables,
      s.stars, s.durationSec, s.uid, s.sessionId,
    ];
  });
  downloadCsv('polar-lab-sessions.csv', [headers, ...rows]);
}

function exportReadingsCsv() {
  const list = filterSessions(state.sessions);
  const headers = ['date', 'status', 'name', 'class', 'targetMin', 'cup', 'capturedAtMin', 'entered', 'trueTemp', 'angleDeg', 'aligned', 'correct', 'timeOk'];
  const rows = [];
  for (const s of list) {
    for (const r of s.readings || []) {
      const m = (s.measurements || []).find((x) => x.targetMin === r.targetMin);
      rows.push([
        new Date(s.updatedAtMs || s.finishedAtMs || 0).toISOString(), s.status || 'complete', s.name, s.classCode, r.targetMin, r.cup,
        r.capturedAtMin, r.entered, r.trueTemp, r.angleDeg, r.aligned ? 1 : 0, r.correct ? 1 : 0, m?.timeOk ? 1 : 0,
      ]);
    }
  }
  downloadCsv('polar-lab-readings.csv', [headers, ...rows]);
}

function sessionCsvRow(s) {
  const sc = s.scores || {};
  return [new Date(s.updatedAtMs || s.finishedAtMs || 0).toISOString(), s.status || 'complete', s.progressPercent ?? 100, s.name, s.classCode, s.email, s.overallAccuracy ?? sc.overall ?? 0, sc.trainingReading, sc.trainingMethod, sc.expReading, sc.expMethod, sc.expTime, sc.analysis, sc.variables, s.stars, s.durationSec, s.uid, s.sessionId];
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((v) => {
    const str = v == null ? '' : String(v);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(a.href);
  }, 500);
}

function answerText(q, chosen) {
  if (chosen == null) return '—';
  if (q.type === 'single') return q.options?.[Number(chosen)] ?? '—';
  if (q.type === 'multi') {
    const arr = Array.isArray(chosen) ? chosen : [chosen];
    return arr.map((i) => q.options?.[Number(i)] ?? '').filter(Boolean).join('、') || '—';
  }
  if (q.type === 'number') return `${chosen}${q.unit || ''}`;
  if (q.type === 'match') return '配對題';
  return String(chosen);
}

function formatSigned(n) {
  const v = Number(n) || 0;
  return `${v > 0 ? '+' : ''}${v.toFixed(v % 1 ? 1 : 0)}°`;
}

function clock(min) {
  const m = Math.floor(min || 0);
  const s = Math.floor(((min || 0) - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function safeName(str) {
  return String(str || 'student').replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 40);
}

// ---------- Demo data ----------
function demoRecords() {
  const specs = [
    { name: '陳小北', overall: 92, eye: 100, time: 100, reading: 92, analysis: 90, variables: 88 },
    { name: '李心怡', overall: 84, eye: 83, time: 100, reading: 83, analysis: 80, variables: 88 },
    { name: '黃子軒', overall: 76, eye: 67, time: 50, reading: 83, analysis: 80, variables: 75 },
    { name: '周雨澄', overall: 71, eye: 67, time: 50, reading: 67, analysis: 90, variables: 63 },
    { name: '何俊宇', overall: 65, eye: 50, time: 50, reading: 67, analysis: 70, variables: 75 },
    { name: '林可兒', overall: 58, eye: 33, time: 0, reading: 50, analysis: 60, variables: 75 },
    { name: '張家朗', overall: 88, eye: 100, time: 100, reading: 83, analysis: 90, variables: 88 },
    { name: '吳卓穎', overall: 47, eye: 33, time: 0, reading: 50, analysis: 50, variables: 50 },
    { name: '梁思穎', overall: 0, eye: 50, time: 50, reading: 50, analysis: 0, variables: 0, inProgress: true, progress: 45 },
  ];
  const now = Date.now();
  return specs.map((spec, idx) => {
    const finishedAtMs = now - idx * 86400000 - 3600000;
    const scores = {
      trainingReading: spec.reading,
      trainingMethod: spec.eye,
      training: Math.round(spec.reading * 0.7 + spec.eye * 0.3),
      expReading: spec.reading,
      expMethod: spec.eye,
      expTime: spec.time,
      experiment: Math.round(spec.reading * 0.45 + spec.eye * 0.3 + spec.time * 0.25),
      analysis: spec.analysis,
      variables: spec.variables,
      overall: spec.overall,
      stars: starsFor(spec.overall),
    };
    const training = [45, 38, 41, 43].map((target, i) => {
      const aligned = i < Math.round((spec.eye / 100) * 4);
      return {
        round: i + 1,
        targetTemp: target,
        startAngle: [0, 24, -22, 19][i],
        entered: i < Math.round((spec.reading / 100) * 4) ? target : target + 1,
        submittedAngle: aligned ? 0 : [0, 11, -8, 16][i],
        aligned,
        correct: i < Math.round((spec.reading / 100) * 4),
        ms: 8000 + i * 1500,
      };
    });
    const measurements = [0, 3, 6].map((t) => {
      const late = t > 0 && spec.time < 100;
      return {
        targetMin: t,
        capturedAtMin: late ? t + 0.3 : t,
        timeErrorSec: late ? 18 : 0,
        timeOk: t === 0 || !late,
      };
    });
    const readings = [];
    let n = 0;
    for (const t of [0, 3, 6]) {
      for (const cup of ['control', 'cotton']) {
        const trueTemp = trueReading(t, cup === 'cotton');
        const aligned = n < Math.round((spec.eye / 100) * 6);
        const correct = n < Math.round((spec.reading / 100) * 6);
        readings.push({
          targetMin: t,
          cup,
          capturedAtMin: t === 3 && spec.time < 100 ? 3.3 : t,
          entered: correct ? trueTemp : trueTemp + 1,
          trueTemp,
          apparent: trueTemp + (aligned ? 0 : 1.4),
          angleDeg: aligned ? 0 : n % 2 ? -18 : 16,
          aligned,
          correct,
          error: correct ? 0 : 1,
          ms: 12000,
        });
        n++;
      }
    }
    const answers = [];
    const analysisCount = Math.round((spec.analysis / 100) * ANALYSIS_QUESTIONS.length);
    ANALYSIS_QUESTIONS.forEach((q, i) => {
      const correct = i < analysisCount;
      answers.push({
        qid: q.id, type: q.type, chosen: correct ? canonical(q) : wrongChoice(q), correct,
        ms: 6000 + i * 300, correctAnswer: canonical(q),
      });
    });
    const varCount = Math.round((spec.variables / 100) * VARIABLE_QUESTIONS.length);
    VARIABLE_QUESTIONS.forEach((q, i) => {
      const correct = i < varCount;
      answers.push({
        qid: q.id, type: q.type, chosen: correct ? canonical(q) : wrongChoice(q), correct,
        ms: 7000 + i * 250, correctAnswer: canonical(q),
      });
    });
    const inProgress = !!spec.inProgress;
    return {
      id: `demo-${idx}`,
      sessionId: `demo-${idx}`,
      uid: `demo-${idx}`,
      name: spec.name,
      email: `${spec.name}@demo.hk`,
      classCode: '4C',
      status: inProgress ? 'in-progress' : 'complete',
      progressPercent: inProgress ? spec.progress : 100,
      updatedAtMs: finishedAtMs,
      finishedAtMs: inProgress ? 0 : finishedAtMs,
      durationSec: 1100 + idx * 27,
      overallAccuracy: inProgress ? 0 : spec.overall,
      stars: inProgress ? 0 : scores.stars,
      scores,
      training: inProgress ? training.slice(0, 2) : training,
      measurements: inProgress ? measurements.slice(0, 1) : measurements,
      readings: inProgress ? readings.slice(0, 2) : readings,
      analysis: inProgress ? [] : answers.slice(0, ANALYSIS_QUESTIONS.length),
      variables: inProgress ? [] : answers.slice(ANALYSIS_QUESTIONS.length),
      answers: inProgress ? [] : answers,
    };
  });
}

function canonical(q) {
  if (q.type === 'multi') return q.answer;
  if (q.type === 'match') return q.pairs.map((p) => p.defIndex);
  return q.answer;
}

function wrongChoice(q) {
  if (q.type === 'single') return (q.answer + 1) % q.options.length;
  if (q.type === 'multi') return [q.answer[0]];
  if (q.type === 'number') return q.answer + 1;
  if (q.type === 'match') return [0, 1, 2];
  return 0;
}

// ---------- Boot ----------
async function boot() {
  if (DEMO) {
    state.user = { name: '示範教師', email: 'demo@school.hk' };
    state.sessions = demoRecords();
    state.view = 'dashboard';
    render();
    return;
  }
  state.view = 'loading';
  render();
  try {
    await completeRedirectSignIn();
  } catch (e) {
    /* ignore */
  }
  onUser(
    async (user) => {
      state.user = user;
      const ok = await isTeacherEmail(user.email);
      if (!ok) {
        state.view = 'denied';
        render();
        return;
      }
      loadSessions();
    },
    () => {
      state.view = 'login';
      render();
    },
  );
}

boot().catch((err) => {
  console.error(err);
  app.innerHTML = `<div class="teacher-page"><div class="teacher-empty"><b>載入失敗</b><span>${esc(err?.message || err)}</span></div></div>`;
});

// Re-bind shell on every render.
setTimeout(() => {
  const orig = render;
  window.__teacherRefresh = () => orig();
}, 0);
