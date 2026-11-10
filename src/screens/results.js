import { icon, esc, stars, confetti, toast, openModal } from '../ui.js';
import { buildSessionRecord, computeScores, badgesFor, formatSigned } from '../../logic.js';
import { findQuestion, ANALYSIS_QUESTIONS, VARIABLE_QUESTIONS } from '../../questions.js';
import { savePolarSession } from '../firebase.js';

const CUP_NAMES = { control: '清水', cotton: '棉花' };
let saving = false;

export function renderResults(ctx) {
  const s = ctx.session;
  if (!s) {
    queueMicrotask(() => ctx.startNew(ctx.player?.classCode || '4C'));
    return { html: '<div class="wrap"><div class="card card-pad">正在準備…</div></div>', topbar: 'results', stage: 'analysis' };
  }
  if ((s.analysis?.answers?.length || 0) < ANALYSIS_QUESTIONS.length) {
    queueMicrotask(() => ctx.go('quiz', { section: 'analysis' }));
    return { html: '', topbar: 'analysis', stage: 'analysis' };
  }
  if ((s.variables?.answers?.length || 0) < VARIABLE_QUESTIONS.length) {
    queueMicrotask(() => ctx.go('quiz', { section: 'variables' }));
    return { html: '', topbar: 'variables', stage: 'analysis' };
  }

  const scores = computeScores(s);
  const badges = badgesFor(s, scores);
  const overall = scores.overall ?? 0;
  const starCount = scores.stars;
  const eyeCombined = Math.round((((scores.trainingMethod ?? 0) + (scores.expMethod ?? 0)) / 2) * 10) / 10;
  const breakdown = [
    ['溫度計讀數', scores.trainingReading ?? 0],
    ['眼睛水平', eyeCombined],
    ['實驗讀數', scores.expReading ?? 0],
    ['準時記錄', scores.expTime ?? 0],
    ['數據分析', scores.analysis ?? 0],
    ['變項挑戰', scores.variables ?? 0],
  ];
  const answered = [...(s.analysis?.answers || []), ...(s.variables?.answers || [])];
  const correct = answered.filter((a) => a.correct).length;
  const readings = (s.experiment?.readings || []).slice().sort((a, b) => a.targetMin - b.targetMin || (a.cup === 'control' ? -1 : 1));
  const measurements = s.experiment?.measurements || [];
  const methodRows = readings
    .map((r) => {
      const m = measurements.find((x) => x.targetMin === r.targetMin);
      const timeOk = m ? m.timeOk : false;
      return `<div class="method-item">
        <span class="pill ${r.cup === 'control' ? 'pill-cyan' : 'pill-amber'}" style="padding:2px 7px;font-size:9px">${CUP_NAMES[r.cup]}</span>
        <span>${r.targetMin} 分鐘 · <b>${r.entered} °C</b></span>
        <span class="status ${r.aligned ? 'ok' : 'no'}">${r.aligned ? '眼睛水平 ✓' : `眼睛 ${formatSigned(r.angleDeg)}°`}</span>
        <span class="status ${r.correct ? 'ok' : 'no'}">${r.correct ? '讀數 ✓' : `正確 ${r.trueTemp} °C`}</span>
        <span class="status ${timeOk ? 'ok' : 'no'}">${timeOk ? '準時' : '時間 ⚠'}</span>
      </div>`;
    })
    .join('');

  const review = answered
    .map((a) => {
      const q = findQuestion(a.qid);
      if (!q) return '';
      const chosen = answerText(q, a.chosen);
      const right = answerText(q, a.correctAnswer ?? q.answer);
      return `<div class="review-q ${a.correct ? '' : 'wrong'}">
        <span class="mark">${a.correct ? icon('check-circle', 15) : icon('x', 15)}</span>
        <div><b>${esc(q.tag)} · ${esc(q.prompt)}</b><span>${a.correct ? '你的答案正確。' : `你的答案：${esc(chosen)}　正確答案：${esc(right)}`}</span></div>
      </div>`;
    })
    .join('');

  const status = saveStatusHtml(s);
  const html = `
  <div class="wrap">
    <div class="paper card card-pad" style="position:relative;overflow:hidden">
      <div class="result-hero">
        <div>
          <div class="score-ring">
            <svg viewBox="0 0 220 220" width="210" height="210" aria-hidden="true">
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#22b8d6"/>
                  <stop offset=".55" stop-color="#5fe3a1"/>
                  <stop offset="1" stop-color="#ffc95c"/>
                </linearGradient>
              </defs>
              <circle class="bg" cx="110" cy="110" r="92"></circle>
              <circle class="fg" cx="110" cy="110" r="92" stroke-dasharray="578" stroke-dashoffset="${578 * (1 - overall / 100)}"></circle>
            </svg>
            <div class="inner">
              <b>${overall}%</b>
              <span>overall</span>
              <div class="stars">${stars(starCount, 18)}</div>
            </div>
          </div>
        </div>
        <div class="result-copy">
          <p class="kicker">MISSION REPORT · 4LD2</p>
          <h2>${overall >= 90 ? '北極熊專家！' : overall >= 70 ? '做得好，科學家！' : overall >= 50 ? '繼續探究！' : '再試一次，你會更好！'}</h2>
          <p class="lead">你完成了 ${answered.length} 條問題，答對 <b>${correct}</b> 條。你的實驗讀數、眼睛位置和記錄時間已記錄給老師。</p>
          <div class="result-badges">
            ${badges.map((b) => `<span class="result-badge ${b.earned ? 'earned' : ''}" title="${esc(b.en)}">${icon(b.earned ? 'medal' : 'lock', 17)} <span>${esc(b.zh)}</span></span>`).join('')}
          </div>
        </div>
      </div>

      <div class="divider"></div>
      <div class="breakdown">
        ${breakdown.map(([label, v]) => `<div class="bd-row"><span>${label}</span><span class="track"><i style="width:${clampPct(v)}%"></i></span><span class="num">${v}%</span></div>`).join('')}
      </div>
    </div>

    <div class="result-grid">
      <div class="paper card result-card">
        <div class="row-between" style="margin-bottom:10px"><h3 style="margin:0">我的量度方法</h3><span class="pill ${eyeCombined >= 75 && (scores.expTime ?? 0) >= 100 ? 'pill-green' : 'pill-amber'}">${eyeCombined >= 75 && (scores.expTime ?? 0) >= 100 ? '方法正確' : '有待改善'}</span></div>
        <div class="method-list">${methodRows || '<p class="small">未找到讀數。</p>'}</div>
        <p class="tiny" style="color:var(--ink-soft);margin:9px 2px 0">眼睛水平 = 視線與液面水平（±2.5°）。準時 = 記錄時間在目標 ±20 秒內。</p>
      </div>

      <div class="paper card result-card">
        <div class="row-between" style="margin-bottom:10px"><h3 style="margin:0">答案回顧</h3><span class="pill pill-cyan">${correct} / ${answered.length}</span></div>
        <div class="review-list">${review}</div>
      </div>
    </div>

    <div class="paper card card-pad" style="margin-top:16px">
      <div class="row-between" style="flex-wrap:wrap;gap:12px">
        <div id="save-status">${status}</div>
        <div class="btn-row no-print">
          <button class="btn btn-ghost btn-sm" id="print-report">${icon('download', 15)} 列印 / 儲存 PDF</button>
          <button class="btn btn-ghost btn-sm" id="play-again">${icon('refresh', 15)} 再玩一次</button>
          <button class="btn btn-ghost btn-sm" id="to-home">${icon('home', 15)} 回到主頁</button>
          ${ctx.teacher ? `<a class="btn btn-ghost btn-sm" href="./teacher.html">${icon('teacher', 15)} 教師專區</a>` : ''}
        </div>
      </div>
      <p class="tiny" style="color:var(--ink-soft);margin:10px 0 0">儲存內容：姓名、班別、Google 電郵、六個實驗讀數、眼睛角度、記錄時間、每題答案與分數。</p>
    </div>
  </div>`;

  return {
    html,
    topbar: 'results',
    stage: 'analysis',
    async mount(el) {
      if (!s.completed) {
        s.completed = true;
        s.finishedAtMs = Date.now();
        s.stage = 'results';
        ctx.save();
      }
      if (!s.finalRecord) {
        s.finalRecord = buildSessionRecord(s, s.finishedAtMs || Date.now());
        ctx.save();
      }
      if (overall >= 70) {
        ctx.sfx.star();
        confetti(overall >= 90 ? 120 : 70);
      }
      const saveBox = el.querySelector('#save-status');
      const updateStatus = () => {
        if (saveBox) saveBox.innerHTML = saveStatusHtml(s);
        saveBox?.querySelector('#retry-save')?.addEventListener('click', () => attemptSave(ctx, updateStatus));
      };
      updateStatus();

      if (!ctx.dev && !s.savedRecordId) {
        if (!s.saveError) attemptSave(ctx, updateStatus);
        else updateStatus();
      }

      el.querySelector('#retry-save')?.addEventListener('click', () => attemptSave(ctx, updateStatus));
      el.querySelector('#print-report')?.addEventListener('click', () => window.print());
      el.querySelector('#play-again')?.addEventListener('click', () => {
        const { el: modal, close } = openModal(
          `<h2>再玩一次？</h2><p>這次報告會保留在班級資料庫（如果已儲存）。新的任務會由測量訓練開始。</p>
           <div class="btn-row"><button class="btn" id="again-yes">開始新任務</button><button class="btn btn-ghost" id="again-no" style="color:#08243a;border-color:rgba(8,36,58,.18)">取消</button></div>`,
        );
        modal.querySelector('#again-yes').addEventListener('click', () => {
          close();
          ctx.startNew(s.player.classCode || '4C');
        });
        modal.querySelector('#again-no').addEventListener('click', close);
      });
      el.querySelector('#to-home')?.addEventListener('click', () => ctx.go('home'));
    },
  };
}

async function attemptSave(ctx, updateStatus) {
  const s = ctx?.session;
  if (!s || saving || s.savedRecordId) return;
  await ctx.flushAutoSave?.();
  saving = true;
  s.saveError = '';
  updateStatus?.();
  try {
    const record = s.finalRecord || buildSessionRecord(s, s.finishedAtMs || Date.now());
    const id = await savePolarSession(record);
    s.savedRecordId = id;
    s.saveError = '';
    toast('報告已儲存到班級記錄', 'success', 2800);
  } catch (err) {
    console.error('session save failed', err);
    s.saveError = err?.message || 'unknown error';
    toast('報告儲存失敗，請檢查 Firebase 規則', 'error', 4200);
  } finally {
    saving = false;
    ctx.save();
    updateStatus?.();
  }
}

function saveStatusHtml(s) {
  if (s.player?.uid === 'dev-local') {
    return `<div class="save-status ok"><span class="dot"></span>DEV 模式：報告只儲存在此裝置。正式課堂會寫入 Firebase。</div>`;
  }
  if (s.savedRecordId) {
    return `<div class="save-status ok"><span class="dot"></span>已儲存到班級記錄 · ID ${esc(String(s.savedRecordId).slice(0, 8))}</div>`;
  }
  if (saving) {
    return `<div class="save-status"><span class="spinner"></span>正在儲存到班級記錄…</div>`;
  }
  if (s.saveError) {
    return `<div class="save-status err"><span class="dot"></span>儲存失敗：${esc(String(s.saveError).slice(0, 90))} <button class="btn btn-ghost btn-sm" id="retry-save" style="color:#08243a;border-color:rgba(8,36,58,.18);margin-left:6px">重試</button></div>`;
  }
  return `<div class="save-status"><span class="dot"></span>準備儲存…</div>`;
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

function clampPct(v) {
  return Math.max(0, Math.min(100, Number(v) || 0));
}
