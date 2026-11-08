import { icon, esc, toast, openModal, confetti, closeModal } from '../ui.js';
import {
  SIM,
  CUP_LABELS,
  clamp,
  snapAngle,
  eyeLevelOk,
  temperatureAt,
  buildReading,
  buildMeasurement,
  clockFromMinutes,
  formatSigned,
  timeErrorSec,
} from '../../logic.js';
import { ThermometerScope } from '../three/scope.js';

const TARGETS = [0, 3, 6];
const REAL_SEC_PER_MIN = SIM.realSecondsPerMinute;
const WINDOW_BEFORE = 0.25; // 15 simulated seconds
const WINDOW_AFTER = 40 / 60; // 40 simulated seconds before an auto (late) reading

let runtime = null;

const START_ANGLES = {
  0: { control: 16, cotton: -13 },
  3: { control: 20, cotton: -17 },
  6: { control: -14, cotton: 16 },
};

export function renderExperiment(ctx, opts = {}) {
  if (!ctx.session) {
    queueMicrotask(() => ctx.startNew(ctx.player?.classCode || '4C'));
    return { html: '<div class="wrap"><div class="card card-pad">正在準備…</div></div>', topbar: 'experiment', stage: 'experiment' };
  }
  const session = ctx.session;
  if (session.completed) {
    queueMicrotask(() => ctx.go('results'));
    return { html: '', topbar: 'experiment', stage: 'home' };
  }
  if ((session.training?.rounds?.length || 0) < 4) {
    queueMicrotask(() => ctx.go('training'));
    return { html: '', topbar: 'training', stage: 'training' };
  }
  const readings = session.experiment.readings || [];
  if (readings.length >= 6) {
    queueMicrotask(() => ctx.go('analysis'));
    return { html: '', topbar: 'analysis', stage: 'analysis' };
  }
  let resetNote = '';
  if (readings.length > 0 && readings.length < 6) {
    session.experiment.measurements = [];
    session.experiment.readings = [];
    ctx.save();
    resetNote = '上一次實驗未完成，已為你重新開始。';
  }

  if (opts.run || (runtime && runtime.active && runtime.started)) {
    return renderLive(ctx);
  }
  return renderBriefing(ctx, resetNote);
}

function renderBriefing(ctx, resetNote) {
  const session = ctx.session;
  const html = `
  <div class="wrap">
    <div class="exp-layout">
      <div class="exp-stage">
        <div class="hud-card hud-top">
          <div class="row-between"><span class="pill pill-cyan">${icon('flask', 14)} 公平測試</span><span class="pill">2 杯 · 6 分鐘</span></div>
          <p>兩杯都有 80 ml、45 °C 的溫水，都沒有蓋。只有「有沒有棉花」不同。</p>
        </div>
      </div>
      <div class="exp-panel">
        <div class="card card-pad">
          <p class="kicker">EXPERIMENT · FAIR TEST</p>
          <h2>棉花能保住熱嗎？</h2>
          <p class="lead" style="font-size:13.5px;margin:8px 0 14px">一杯清水是對照組；另一杯包一層棉花，模擬北極熊的皮毛。比較兩杯水的降溫幅度。</p>
          ${resetNote ? `<div class="notice">${esc(resetNote)}</div>` : ''}
          <div class="exp-vars">
            <div><span class="tag" style="background:rgba(255,122,89,.14);color:#ff9a7f">自變項</span><b>有沒有棉花</b></div>
            <div><span class="tag" style="background:rgba(34,184,214,.14);color:#8de8ff">因變項</span><b>水溫下降</b></div>
            <div><span class="tag" style="background:rgba(95,227,161,.14);color:#9fffcf">不變項</span><b>杯、水量、起始水溫、室溫、時間、溫度計位置</b></div>
          </div>
          <div class="procedure">
            <div><span>1</span>倒入 80 ml、45 °C 溫水</div>
            <div><span>2</span>一杯包棉花，一杯不包</div>
            <div><span>3</span>兩杯都不加蓋，插入溫度計</div>
            <div><span>4</span>在 0、3、6 分鐘記錄兩杯水溫</div>
          </div>
          <button class="btn btn-lg btn-block" id="start-exp" style="margin-top:18px">${icon('play', 18)} 開始實驗</button>
          <p class="tiny muted center" style="margin:10px 0 0">量度時計時會暫停。先讓眼睛水平，再讀數。離開會重新開始這次實驗。</p>
        </div>
      </div>
    </div>
  </div>`;

  return {
    html,
    topbar: 'experiment',
    stage: 'experiment',
    mount(el) {
      if (ctx.world) {
        ctx.world.setCupTemps(SIM.startTempC, SIM.startTempC);
        ctx.world.setClock(0, '');
        ctx.world.setCue('idle');
      }
      el.querySelector('#start-exp')?.addEventListener('click', () => {
        ctx.sfx.click();
        startRun(ctx);
      });
    },
  };
}

function renderLive(ctx) {
  const session = ctx.session;
  const html = `
  <div class="wrap">
    <div class="exp-layout">
      <div class="exp-stage" id="exp-stage">
        <div class="hud-card exp-hud">
          <div class="timer-wrap">
            <div class="timer-ring" id="timer-ring">
              <svg viewBox="0 0 80 80" width="66" height="66" aria-hidden="true">
                <circle class="tick" cx="40" cy="40" r="32"></circle>
                <circle class="prog" id="timer-prog" cx="40" cy="40" r="32" stroke-dasharray="201.06" stroke-dashoffset="201.06"></circle>
              </svg>
              <div class="time" id="timer-text">0:00</div>
            </div>
            <div class="timer-meta"><b>EXPERIMENT TIME</b><span id="next-label">第 1 次量度：0:00</span></div>
          </div>
          <div class="measure-cue">
            <div class="timeline" id="timeline">${timelineHtml(session)}</div>
            <div class="row" style="gap:6px"><button class="btn btn-sm" id="measure-btn" disabled>${icon('timer', 14)} 等待 3:00</button>${ctx.dev ? '<button class="btn btn-ghost btn-sm" id="dev-skip" title="Dev only">⏭</button>' : ''}</div>
          </div>
        </div>
      </div>
      <div class="exp-panel">
        <div class="paper card card-pad" id="data-card">
          <div class="row-between" style="margin-bottom:8px">
            <div><p class="tiny" style="color:#087d96;letter-spacing:.14em;margin:0 0 3px">DATA TABLE</p><h3 style="font-size:18px">記錄水溫（°C）</h3></div>
            <span class="pill pill-green" id="recorded-pill">0 / 6 讀數</span>
          </div>
          <div id="table-wrap">${tableHtml(session)}</div>
          <div class="legend" style="margin-top:10px">
            <span><i class="l-control"></i>清水（對照）</span>
            <span><i class="l-cotton"></i>棉花（皮毛模型）</span>
            <span>${icon('clock', 11)} 記錄時間</span>
          </div>
        </div>
        <div class="card card-pad">
          <div class="row" style="gap:8px">${icon('target', 16)}<b style="font-size:12px">準時記錄</b></div>
          <p class="small muted" style="margin:7px 0 0">在 0、3、6 分鐘記錄。太早或太晚會在表中標示，老師會看到你的記錄時間。</p>
        </div>
      </div>
    </div>
  </div>`;

  return {
    html,
    topbar: 'experiment',
    stage: 'experiment',
    async mount(el) {
      if (!runtime || !runtime.active) runtime = createRuntime();
      runtime.el = el;
      const world = ctx.world;
      if (world) {
        world.setCupTemps(SIM.startTempC, SIM.startTempC);
        world.setClock(0, '');
        world.setCue('idle');
      }
      el.querySelector('#measure-btn')?.addEventListener('click', () => {
        if (!runtime || runtime.measurementOpen) return;
        const sim = simMinutes(runtime);
        const target = TARGETS[runtime.nextTargetIndex];
        if (target == null) return;
        openMeasurement(ctx, target, sim);
      });
      el.querySelector('#dev-skip')?.addEventListener('click', () => {
        if (!runtime || runtime.measurementOpen) return;
        const target = TARGETS[runtime.nextTargetIndex];
        if (target == null) return;
        openMeasurement(ctx, target, target);
      });

      if (!runtime.started) {
        await countdown(ctx, el, () => {
          if (!runtime || !runtime.active) return;
          runtime.started = true;
          runtime.startedAt = performance.now();
          runtime.pausedTotal = 0;
          runtime.paused = false;
          startLoop(ctx);
          openMeasurement(ctx, 0, 0);
        });
      } else {
        startLoop(ctx);
        updateHud(ctx);
      }

      ctx.onCleanup(() => {
        if (runtime) {
          runtime.active = false;
          if (runtime.raf) cancelAnimationFrame(runtime.raf);
          runtime.cleanupMeasure?.();
          runtime.cleanupMeasure = null;
          if (runtime.overlay) {
            runtime.overlay.remove();
            runtime.overlay = null;
          }
          document.body.classList.remove('measuring');
          if (!runtime.done) runtime = null;
        }
      });
    },
  };
}

function createRuntime() {
  return {
    active: true,
    started: false,
    done: false,
    startedAt: 0,
    pausedTotal: 0,
    paused: false,
    pauseStarted: 0,
    nextTargetIndex: 1,
    measurementOpen: false,
    current: null,
    lastUI: 0,
    chimed: {},
    overlay: null,
    el: null,
    raf: 0,
  };
}

function simMinutes(rt) {
  if (!rt?.started) return 0;
  const now = rt.paused ? rt.pauseStarted : performance.now();
  return Math.max(0, (now - rt.startedAt - rt.pausedTotal) / (REAL_SEC_PER_MIN * 1000));
}

function pause(rt) {
  if (!rt || rt.paused) return;
  rt.paused = true;
  rt.pauseStarted = performance.now();
}

function resume(rt) {
  if (!rt || !rt.paused) return;
  rt.pausedTotal += performance.now() - rt.pauseStarted;
  rt.paused = false;
}

function measurementFor(session, target) {
  return (session.experiment.measurements || []).find((m) => m.targetMin === target);
}

function readingFor(session, target, cup) {
  return (session.experiment.readings || []).find((r) => r.targetMin === target && r.cup === cup);
}

function timelineHtml(session) {
  return [0, 1, 2]
    .map((i) => {
      const t = TARGETS[i];
      const done = !!measurementFor(session, t);
      const active = !done && (i === 0 || !!measurementFor(session, TARGETS[i - 1]));
      const label = i === 0 ? '0' : i === 1 ? '3' : '6';
      return `${i > 0 ? `<span class="seg ${done ? 'done' : ''}"></span>` : ''}<span class="node ${done ? 'done' : active ? 'active' : ''}"><i></i>${label} 分</span>`;
    })
    .join('');
}

function tableHtml(session) {
  const nextTarget = runtime && runtime.nextTargetIndex < TARGETS.length ? TARGETS[runtime.nextTargetIndex] : null;
  const rows = TARGETS.map((t) => {
    const m = measurementFor(session, t);
    const c = readingFor(session, t, 'control');
    const k = readingFor(session, t, 'cotton');
    const next = !m && t === nextTarget;
    const cls = m ? 'row-done' : next ? 'row-active' : '';
    const late = m && !m.timeOk;
    const cell = (r) => (r ? `<span class="val">${r.entered}<small style="font-size:10px;color:#527387"> °C</small></span>` : `<span class="val ${next ? 'pending' : 'empty'}">${next ? '待記錄' : '—'}</span>`);
    return `<tr class="${cls}">
      <td>${t} 分鐘</td>
      <td>${cell(c)}</td>
      <td>${cell(k)}</td>
      <td>${m ? `<span class="subtime ${late ? 'late' : ''}">${clockFromMinutes(m.capturedAtMin)}</span>` : `<span class="subtime">—</span>`}</td>
    </tr>`;
  }).join('');
  return `<table class="data-table">
    <thead><tr><th>時間</th><th><b>清水</b><small>控制</small></th><th><b>棉花</b><small>皮毛模型</small></th><th>記錄時間</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function updateTable(ctx) {
  const wrap = runtime?.el?.querySelector('#table-wrap');
  if (wrap) wrap.innerHTML = tableHtml(ctx.session);
  const pill = runtime?.el?.querySelector('#recorded-pill');
  if (pill) pill.textContent = `${(ctx.session.experiment.readings || []).length} / 6 讀數`;
}

function startLoop(ctx) {
  if (!runtime || runtime.raf) return;
  const loop = (now) => {
    if (!runtime || !runtime.active) return;
    if (now - runtime.lastUI > 90) {
      runtime.lastUI = now;
      updateHud(ctx);
    }
    runtime.raf = requestAnimationFrame(loop);
  };
  runtime.raf = requestAnimationFrame(loop);
}

function updateHud(ctx) {
  if (!runtime || !runtime.el) return;
  const session = ctx.session;
  const sim = simMinutes(runtime);
  runtime.simMin = sim;
  const timeEl = runtime.el.querySelector('#timer-text');
  const labelEl = runtime.el.querySelector('#next-label');
  const btn = runtime.el.querySelector('#measure-btn');
  const ring = runtime.el.querySelector('#timer-ring');
  const prog = runtime.el.querySelector('#timer-prog');
  const tip = runtime.el.querySelector('#stage-tip');
  const next = TARGETS[runtime.nextTargetIndex];
  const nextTarget = next == null ? null : next;

  if (timeEl) timeEl.textContent = clockFromMinutes(sim);
  if (prog) {
    const p = clamp(sim / 6, 0, 1);
    prog.style.strokeDashoffset = String(201.06 * (1 - p));
  }
  const near = nextTarget != null && sim >= nextTarget - WINDOW_BEFORE && sim < nextTarget;
  const ready = nextTarget != null && sim >= nextTarget && sim <= nextTarget + WINDOW_AFTER;
  const canMeasure = nextTarget != null && sim >= nextTarget - WINDOW_BEFORE && sim <= nextTarget + WINDOW_AFTER;
  const cue = ready ? 'ready' : near ? 'near' : 'idle';
  ring?.classList.toggle('near', near);
  ring?.classList.toggle('ready', ready);
  if (btn) {
    btn.disabled = !canMeasure || runtime.measurementOpen;
    btn.innerHTML = ready
      ? `${icon('timer', 14)} 現在量度（${nextTarget} 分鐘）`
      : near
        ? `${icon('timer', 14)} 準備… ${clockFromMinutes(nextTarget)}`
        : nextTarget != null
          ? `${icon('timer', 14)} 等待 ${clockFromMinutes(nextTarget)}`
          : `${icon('check', 14)} 量度完成`;
  }
  if (labelEl) {
    labelEl.textContent = nextTarget != null
      ? `${runtime.nextTargetIndex + 1} / 3 次量度 · 下一個 ${clockFromMinutes(nextTarget)}`
      : '3 / 3 次量度完成';
  }
  if (tip) {
    tip.textContent = runtime.measurementOpen ? '量度中…' : nextTarget != null ? `下一次量度：${clockFromMinutes(nextTarget)}` : '量度完成';
  }
  if (runtime.simMin != null) {
    ctx.world?.setClock(sim, nextTarget != null ? `NEXT ${clockFromMinutes(nextTarget)}` : 'DONE');
    ctx.world?.setCue(cue);
  }
  if (ready && !runtime.chimed[runtime.nextTargetIndex]) {
    runtime.chimed[runtime.nextTargetIndex] = true;
    ctx.sfx.chime();
    ctx.world?.pulseMeasure();
  }
  if (nextTarget != null && !runtime.measurementOpen && sim >= nextTarget + WINDOW_AFTER) {
    // The pupil missed the window: stop the clock and take a late reading.
    openMeasurement(ctx, nextTarget, sim);
  }
}

async function countdown(ctx, el, onDone) {
  const layer = document.createElement('div');
  layer.className = 'countdown-layer';
  layer.innerHTML = `<div class="countdown-card"><p class="kicker">GET READY</p><div class="countdown-num">3</div><p>量度 0 分鐘 · 兩杯都是 45 °C</p></div>`;
  document.body.appendChild(layer);
  const num = layer.querySelector('.countdown-num');
  ctx.sfx.tick();
  for (const n of [2, 1]) {
    await wait(760);
    if (!runtime?.active) {
      layer.remove();
      return;
    }
    num.textContent = String(n);
    num.classList.remove('pop');
    void num.offsetWidth;
    num.classList.add('pop');
    ctx.sfx.tick();
  }
  await wait(760);
  num.textContent = '開始!';
  num.classList.add('go');
  ctx.sfx.chime();
  await wait(650);
  layer.remove();
  if (runtime?.active) onDone();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startRun(ctx) {
  runtime = createRuntime();
  ctx.go('experiment', { run: true });
}

function openMeasurement(ctx, targetMin, capturedAtMin) {
  if (!runtime || runtime.measurementOpen) return;
  runtime.measurementOpen = true;
  pause(runtime);
  const session = ctx.session;
  const trueControl = temperatureAt(capturedAtMin, false);
  const trueCotton = temperatureAt(capturedAtMin, true);
  const angles = { ...(START_ANGLES[targetMin] || START_ANGLES[0]) };
  const current = {
    targetMin,
    capturedAtMin,
    trueTemps: { control: trueControl, cotton: trueCotton },
    angles,
    drafts: { control: null, cotton: null },
    activeCup: 'control',
    cupStarted: { control: performance.now(), cotton: null },
    cupMs: { control: 0, cotton: 0 },
  };
  runtime.current = current;
  const world = ctx.world;
  if (world) {
    world.setCupTemps(trueControl, trueCotton);
    world.setClock(capturedAtMin, `MEASURE ${targetMin}:00`);
    world.setCue('ready');
    world.focusCup('control', angles.control, 0.9);
    world.setActiveCup('control');
  }

  const timeErr = targetMin > 0 ? timeErrorSec(capturedAtMin, targetMin) : 0;
  const lateNote = targetMin > 0 && Math.abs(timeErr) > SIM.timeToleranceSec
    ? `<span class="pill pill-red">記錄時間 ${clockFromMinutes(capturedAtMin)} · ${timeErr > 0 ? '遲了' : '早了'} ${Math.abs(Math.round(timeErr))} 秒</span>`
    : `<span class="pill pill-green">記錄時間 ${clockFromMinutes(capturedAtMin)}</span>`;

  const overlay = document.createElement('div');
  overlay.className = 'read-overlay';
  overlay.id = 'read-overlay';
  overlay.innerHTML = `
    <div class="read-stage" id="read-stage" tabindex="0" aria-label="Thermometer view. Drag to adjust eye height.">
      <div class="hud-card" style="left:24px;top:24px;max-width:240px">
        <div class="row" style="gap:8px">${icon('eye', 15)}<b style="font-size:11px">拖動畫面調節眼睛高度</b></div>
        <p style="margin-top:3px">或使用滑桿。眼睛與液面水平時，讀數才準確。</p>
      </div>
      <div class="hud-card" style="left:24px;bottom:24px;max-width:250px">
        <b style="font-size:11px">眼睛偏高 → 讀數偏低</b>
        <p style="margin-top:3px">眼睛偏低 → 讀數偏高。</p>
      </div>
    </div>
    <aside class="read-panel-wrap">
      <div class="panel-head">
        <div>
          <p class="tiny" style="margin:0 0 2px;letter-spacing:.14em">MEASUREMENT ${TARGETS.indexOf(targetMin) + 1} / 3</p>
          <h3>記錄 ${targetMin} 分鐘</h3>
        </div>
        <div class="row" style="gap:6px">${lateNote}<button class="icon-btn" id="abort-exp" title="離開實驗" aria-label="Leave experiment">${icon('x', 16)}</button></div>
      </div>
      <div class="cup-tabs" id="cup-tabs">
        ${cupTabHtml('control', current)}
        ${cupTabHtml('cotton', current)}
      </div>
      <div class="read-body" style="margin-top:14px">
        <div class="scope-col">
          <div class="scope-frame"><canvas id="read-scope" aria-label="Magnified thermometer"></canvas></div>
          <div class="scope-cap"><span>READING SCOPE</span><span class="live">LIVE</span></div>
        </div>
        <div class="entry-col">
          <div class="read-question" id="read-question">清水杯的溫度是多少？<span>Read at eye level, then enter the whole number.</span></div>
          <div class="eye-meter" id="read-eye-meter">
            <div class="bar"><i></i><b id="read-eye-dot"></b></div>
            <div class="labels"><span>偏高</span><span>水平</span><span>偏低</span></div>
          </div>
          <input type="range" class="eye-slider" id="eye-slider" min="-30" max="30" step="0.5" value="${angles.control}" aria-label="Eye height" />
          <div class="temp-entry">
            <div class="field">
              <input id="read-temp" type="number" inputmode="numeric" min="20" max="50" step="1" placeholder="–" aria-label="Temperature reading" />
              <span class="unit">°C</span>
            </div>
            <div class="stepper">
              <button type="button" data-rstep="1" aria-label="Increase">${icon('chevron-up', 15)}</button>
              <button type="button" data-rstep="-1" aria-label="Decrease">${icon('chevron-down', 15)}</button>
            </div>
          </div>
          <div class="entry-hint"><span>20–50 整數</span><span id="read-eye-hint">眼睛水平 ✓</span></div>
          <button class="btn btn-block" id="record-cup">${icon('check', 16)} 記錄這杯</button>
        </div>
      </div>
      <div class="instruction" style="margin-top:auto;margin-bottom:10px">${icon('eye', 16)}<span><b>眼睛水平時，紅色液面會對準真正的刻度。</b> 眼睛偏高或偏低，紅線在刻度上的位置會改變。</span></div>
      <div class="read-foot">
        <div class="read-meta">
          <span>眼睛：<b id="read-angle">+0°</b></span>
          <span>已記錄：<b id="read-count">0 / 2</b></span>
        </div>
        <button class="btn btn-green btn-block" id="continue-measure" disabled>確認兩杯讀數 →</button>
      </div>
    </aside>`;
  document.body.appendChild(overlay);
  document.body.classList.add('measuring');
  runtime.overlay = overlay;

  const scope = new ThermometerScope(overlay.querySelector('#read-scope'));
  const stage = overlay.querySelector('#read-stage');
  const slider = overlay.querySelector('#eye-slider');
  const badge = overlay.querySelector('#read-eye-hint');
  const question = overlay.querySelector('#read-question');
  const input = overlay.querySelector('#read-temp');
  const recordBtn = overlay.querySelector('#record-cup');
  const continueBtn = overlay.querySelector('#continue-measure');
  const countEl = overlay.querySelector('#read-count');
  const angleEl = overlay.querySelector('#read-angle');
  const dot = overlay.querySelector('#read-eye-dot');
  const meter = overlay.querySelector('#read-eye-meter');

  const cupName = (cup) => (cup === 'control' ? '清水杯' : '棉花杯');

  const redraw = () => {
    const cup = current.activeCup;
    const angle = current.angles[cup];
    const level = eyeLevelOk(angle);
    scope.draw({ trueTemp: current.trueTemps[cup], elevation: angle, tint: cup === 'control' ? '#52a8ff' : '#ffc95c' });
    if (dot) dot.style.left = `${50 + (angle / 60) * 50}%`;
    meter?.classList.toggle('level', level);
    if (angleEl) angleEl.textContent = snapAngle(angle) === 0 ? '0°' : `${formatSigned(angle)}°`;
    if (badge) {
      badge.className = level ? 'ok' : 'warn';
      badge.textContent = level ? '眼睛水平 ✓' : `偏離水平 ${formatSigned(angle)}°`;
    }
    if (slider && Number(slider.value) !== angle) slider.value = String(angle);
  };

  const updateTabs = () => {
    overlay.querySelector('#cup-tabs').innerHTML = cupTabHtml('control', current) + cupTabHtml('cotton', current);
    overlay.querySelectorAll('[data-cup]').forEach((b) => {
      b.addEventListener('click', () => switchCup(b.dataset.cup));
    });
    if (question) {
      question.innerHTML = `${cupName(current.activeCup)}的溫度是多少？<span>Read at eye level, then enter the whole number.</span>`;
    }
    const draft = current.drafts[current.activeCup];
    if (input) input.value = draft == null ? '' : String(draft.entered);
    if (recordBtn) recordBtn.innerHTML = draft == null ? `${icon('check', 16)} 記錄這杯` : `${icon('refresh', 16)} 更新這杯讀數`;
    const count = Object.values(current.drafts).filter((d) => d != null).length;
    if (countEl) countEl.textContent = `${count} / 2`;
    if (continueBtn) continueBtn.disabled = count < 2;
    redraw();
  };

  const switchCup = (cup) => {
    if (cup === current.activeCup) return;
    current.activeCup = cup;
    if (current.cupStarted[cup] == null) current.cupStarted[cup] = performance.now();
    ctx.world?.focusCup(cup, current.angles[cup], 0.55);
    updateTabs();
    requestAnimationFrame(() => input?.focus());
  };

  const setAngle = (deg) => {
    const cup = current.activeCup;
    current.angles[cup] = snapAngle(deg);
    ctx.world?.setElevation(current.angles[cup]);
    redraw();
  };

  let dragging = null;
  const start = (e) => {
    e.preventDefault();
    dragging = { y: e.clientY, angle: current.angles[current.activeCup] };
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add('dragging');
  };
  const move = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const dy = dragging.y - e.clientY;
    setAngle(dragging.angle + (dy / 180) * 60);
  };
  const end = () => {
    dragging = null;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerdown', start);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  const cleanupPointer = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
  };
  runtime.cleanupMeasure = cleanupPointer;

  slider?.addEventListener('input', () => setAngle(Number(slider.value)));
  slider?.addEventListener('change', () => setAngle(Number(slider.value)));
  overlay.querySelectorAll('[data-rstep]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cur = Number(input.value) || 0;
      input.value = String(clamp(cur + Number(btn.dataset.rstep), 20, 50));
      ctx.sfx.tap();
    });
  });
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') recordCup();
  });
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAngle(current.angles[current.activeCup] + (e.shiftKey ? 1 : 3));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAngle(current.angles[current.activeCup] - (e.shiftKey ? 1 : 3));
    }
  });

  const recordCup = () => {
    const entered = Number(input.value);
    if (!Number.isInteger(entered) || entered < 20 || entered > 50) {
      toast('請輸入 20 至 50 的整數。', 'error', 2400);
      input.focus();
      input.classList.add('animate-shake');
      setTimeout(() => input.classList.remove('animate-shake'), 400);
      return;
    }
    const cup = current.activeCup;
    const angle = current.angles[cup];
    current.drafts[cup] = {
      entered,
      angleDeg: Math.round(angle * 10) / 10,
      aligned: eyeLevelOk(angle),
      ms: Math.round(performance.now() - (current.cupStarted[cup] || performance.now())),
    };
    ctx.sfx.record();
    if (!current.drafts.control || !current.drafts.cotton) {
      const other = cup === 'control' ? 'cotton' : 'control';
      if (!current.drafts[other]) switchCup(other);
      else updateTabs();
    } else {
      updateTabs();
    }
  };
  recordBtn.addEventListener('click', recordCup);

  continueBtn.addEventListener('click', () => {
    if (!current.drafts.control || !current.drafts.cotton) return;
    finishMeasurement(ctx, current);
  });

  overlay.querySelector('#abort-exp')?.addEventListener('click', async () => {
    const ok = await ctx.confirm({
      title: '離開實驗？',
      body: '這次實驗的讀數會清除，需要由 0 分鐘重新開始。訓練和之前的答案會保留。',
      confirm: '離開實驗',
      danger: true,
    });
    if (!ok) return;
    const session = ctx.session;
    session.experiment.measurements = [];
    session.experiment.readings = [];
    ctx.save();
    runtime.cleanupMeasure?.();
    runtime = null;
    document.body.classList.remove('measuring');
    ctx.go('home');
  });

  updateTabs();
  setTimeout(() => input?.focus(), 450);
}

function cupTabHtml(cup, current) {
  const label = CUP_LABELS[cup];
  const draft = current.drafts[cup];
  const active = current.activeCup === cup;
  const value = draft == null ? '' : `<span class="done-val">${draft.entered}<span> °C</span></span>`;
  return `<button class="cup-tab ${active ? 'active' : ''} ${draft ? 'done' : ''}" data-cup="${cup}">
    <span class="swatch ${cup}"></span>
    <span style="min-width:0">${esc(label.zh)}<small style="display:block;font-size:9px;color:var(--muted);font-weight:700">${draft ? `眼睛 ${formatSigned(draft.angleDeg)}°` : label.en}</small></span>
    ${draft ? `<span class="tick">${icon('check-circle', 16)}</span>` : ''}
  </button>`;
}

function finishMeasurement(ctx, current) {
  const session = ctx.session;
  const { targetMin, capturedAtMin, drafts, trueTemps, angles } = current;
  // Keep the angle the pupil actually used at the moment of recording.
  const measurement = buildMeasurement({ targetMin, capturedAtMin });
  const readings = ['control', 'cotton'].map((cup) =>
    buildReading({
      targetMin,
      cup,
      capturedAtMin,
      entered: drafts[cup].entered,
      trueTemp: trueTemps[cup],
      angleDeg: drafts[cup].angleDeg,
      ms: drafts[cup].ms,
    }),
  );
  session.experiment.measurements.push(measurement);
  session.experiment.readings.push(...readings);
  ctx.save();
  ctx.sfx.chime();
  runtime.measurementOpen = false;
  document.body.classList.remove('measuring');
  runtime.cleanupMeasure?.();
  runtime.cleanupMeasure = null;
  if (runtime.overlay) {
    runtime.overlay.remove();
    runtime.overlay = null;
  }
  runtime.current = null;
  ctx.world?.leaveEye();
  updateTable(ctx);
  const nextIndex = TARGETS.indexOf(targetMin) + 1;
  runtime.nextTargetIndex = nextIndex;
  if (nextIndex >= TARGETS.length) {
    finishExperiment(ctx);
    return;
  }
  resume(runtime);
  updateHud(ctx);
  toast(`已記錄 ${targetMin} 分鐘：清水 ${readings[0].entered} °C，棉花 ${readings[1].entered} °C`, 'success', 2800);
}

function finishExperiment(ctx) {
  if (!runtime) return;
  runtime.done = true;
  runtime.active = false;
  if (runtime.raf) cancelAnimationFrame(runtime.raf);
  runtime.raf = 0;
  ctx.world?.setCue('idle');
  ctx.world?.setStage('experiment', { instant: false });
  ctx.sfx.star();
  confetti(70);
  const session = ctx.session;
  const rows = [0, 3, 6].map((t) => {
    const m = measurementFor(session, t);
    const c = readingFor(session, t, 'control');
    const k = readingFor(session, t, 'cotton');
    return `<tr><td>${t} 分鐘</td><td>${c?.entered ?? '—'} °C</td><td>${k?.entered ?? '—'} °C</td><td>${m ? clockFromMinutes(m.capturedAtMin) : '—'}</td></tr>`;
  }).join('');
  const { el: modal } = openModal(`
    <div class="center"><div class="big-emoji">🧪</div><h2 style="margin-top:8px">實驗完成！</h2>
    <p>六個讀數已記錄。下一步：用數據回答「棉花怎樣保暖？」</p></div>
    <table class="detail-table" style="margin-top:14px">
      <thead><tr><th>時間</th><th>清水</th><th>棉花</th><th>記錄時間</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="notice paper" style="margin-top:12px">你的記錄時間和眼睛位置會交給老師，用來評估「正確方法」和「正確時間」。</div>
    <div class="btn-row"><button class="btn btn-lg" id="to-analysis">${icon('chart', 18)} 分析數據</button></div>
  `, { closeable: false });
  modal.querySelector('#to-analysis').addEventListener('click', () => {
    closeModal();
    runtime = null;
    ctx.go('analysis');
  });
}
