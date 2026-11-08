import { icon, toast, openModal } from '../ui.js';
import { eyeLevelOk, readingOk, snapAngle, clamp, formatSigned } from '../../logic.js';
import { ThermometerScope } from '../three/scope.js';

const ROUNDS = [
  { target: 45, startAngle: 0, tutorial: true },
  { target: 38, startAngle: 24 },
  { target: 41, startAngle: -22 },
  { target: 43, startAngle: 19 },
];

export function renderTraining(ctx) {
  if (!ctx.session) {
    // A direct dev link to #training: create a real session, then re-render.
    queueMicrotask(() => ctx.startNew(ctx.player?.classCode || '4C'));
    return { html: '<div class="wrap"><div class="card card-pad">正在準備…</div></div>', topbar: 'training', stage: 'training' };
  }
  const session = ctx.session;
  if (session.completed) {
    queueMicrotask(() => ctx.go('results'));
    return { html: '', topbar: 'training', stage: 'home' };
  }
  const done = session.training.rounds.length;
  if (done >= ROUNDS.length) {
    queueMicrotask(() => ctx.go('experiment'));
    return { html: '', topbar: 'training', stage: 'experiment' };
  }
  const index = done;
  const round = ROUNDS[index];
  const target = round.target;
  const dots = ROUNDS.map((_, i) => `<i class="${i < index ? 'done' : i === index ? 'active' : ''}"></i>`).join('');
  const ring = '';

  const html = `
  <div class="wrap">
    <div class="train-layout">
      <div class="train-stage" id="train-stage" tabindex="0" aria-label="Thermometer view. Drag up or down to change eye height.">
        <div class="hud-card hud-top">
          <div class="row-between">
            <span class="hud-badge" id="eye-badge">${icon('eye', 14)} 眼睛水平 ✓</span>
            <span class="pill">第 ${index + 1} / 4 回合</span>
          </div>
          <p>拖動畫面，或使用畫面旁的「眼睛高度」滑桿。眼睛要與紅色液面頂部水平。</p>
        </div>
        <div class="angle-rail" id="angle-rail" role="slider" tabindex="0" aria-label="Eye height" aria-valuemin="-30" aria-valuemax="30" aria-valuenow="0">
          <span class="rail-label">HIGH</span>
          <div class="track" id="rail-track">
            <span class="handle" id="angle-handle">${icon('eye', 16)}</span>
          </div>
          <span class="angle-value" id="angle-value">0°</span>
          <span class="rail-label">LOW</span>
        </div>
        <div class="hud-card train-tip" style="left:0;bottom:0;max-width:260px">
          <div class="row" style="gap:8px">${icon('info', 15)}<b style="font-size:11px">眼睛偏高 → 讀數偏低</b></div>
          <p style="margin-top:3px">眼睛偏低 → 讀數偏高。只有水平時，讀數才準確。</p>
        </div>
      </div>

      <div class="train-panel card card-pad">
        <div class="round-dots">${dots}</div>
        <p class="tiny muted" style="letter-spacing:.14em">ROUND ${index + 1} · ${round.tutorial ? 'GUIDED' : 'EYE LEVEL'}</p>
        <h2 class="train-q">眼睛水平時，<span style="white-space:nowrap">溫度計顯示</span> <span style="white-space:nowrap">多少 °C？</span></h2>
        <p class="train-sub">Read the top of the red liquid, with your eye level with the meniscus.</p>

        <div class="train-input-grid">
          <div class="scope-col">
            <div class="scope-frame">
              <canvas id="train-scope" aria-label="Magnified thermometer scale"></canvas>
            </div>
            <div class="scope-cap"><span>READING SCOPE</span><span class="live">LIVE</span></div>
          </div>
          <div class="stack" style="gap:11px">
            <div class="instruction">${icon('eye', 16)}<span><b>先對準，再讀數。</b> 拖動直到眼睛水平，然後讀出紅色液面頂部的刻度。</span></div>
            <div class="eye-meter" id="eye-meter">
              <div class="bar"><i></i><b id="eye-dot"></b></div>
              <div class="labels"><span>眼睛偏高</span><span>水平</span><span>眼睛偏低</span></div>
            </div>
            <div class="temp-entry">
              <div class="field">
                <input id="temp-input" type="number" inputmode="numeric" min="20" max="50" step="1" placeholder="–" aria-label="Temperature reading in degrees Celsius" />
                <span class="unit">°C</span>
              </div>
              <div class="stepper">
                <button type="button" data-step="1" aria-label="Increase">${icon('chevron-up', 15)}</button>
                <button type="button" data-step="-1" aria-label="Decrease">${icon('chevron-down', 15)}</button>
              </div>
            </div>
            <div class="entry-hint"><span>輸入 20–50 的整數</span><span id="eye-hint" class="ok">眼睛水平 ✓</span></div>
            <button class="btn btn-block" id="train-submit">${icon('check', 17)} 提交讀數</button>
          </div>
        </div>

        <div id="train-feedback" style="margin-top:12px"></div>
        <div class="row" style="margin-top:10px;justify-content:space-between">
          <button class="btn btn-ghost btn-sm" data-train="why">${icon('info', 14)} 為甚麼要水平？</button>
          <span class="tiny muted">關鍵字：parallax 視差</span>
        </div>
      </div>
    </div>
  </div>`;

  return {
    html,
    topbar: 'training',
    stage: 'training',
    async mount(el) {
      const world = ctx.world;
      if (world) {
        world.setTrainingTemp(target);
        world.focusTraining(round.startAngle, 1.1);
        world.setActiveCup(null);
      }
      const scope = new ThermometerScope(el.querySelector('#train-scope'));
      let angle = round.startAngle;
      let submitted = false;
      const startedAt = performance.now();
      const stageEl = el.querySelector('#train-stage');
      const railEl = el.querySelector('#angle-rail');
      const trackEl = el.querySelector('#rail-track');
      const handleEl = el.querySelector('#angle-handle');
      const valEl = el.querySelector('#angle-value');
      const badgeEl = el.querySelector('#eye-badge');
      const dotEl = el.querySelector('#eye-dot');
      const meterEl = el.querySelector('#eye-meter');
      const hintEl = el.querySelector('#eye-hint');
      const inputEl = el.querySelector('#temp-input');
      const submitEl = el.querySelector('#train-submit');
      const feedbackEl = el.querySelector('#train-feedback');

      const updateUI = () => {
        const level = eyeLevelOk(angle);
        const top = ((30 - angle) / 60) * 100;
        if (handleEl) handleEl.style.top = `${top}%`;
        if (valEl) valEl.textContent = Math.abs(angle) < 0.5 ? '0°' : `${formatSigned(angle)}°`;
        railEl?.classList.toggle('level', level);
        railEl?.setAttribute('aria-valuenow', String(Math.round(angle)));
        if (dotEl) dotEl.style.left = `${50 + (angle / 60) * 50}%`;
        meterEl?.classList.toggle('level', level);
        if (badgeEl) {
          if (level) {
            badgeEl.className = 'hud-badge ok';
            badgeEl.innerHTML = `${icon('eye', 14)} 眼睛水平 ✓`;
          } else if (angle > 0) {
            badgeEl.className = 'hud-badge warn';
            badgeEl.innerHTML = `${icon('eye', 14)} 眼睛偏高 ${formatSigned(angle)}°`;
          } else {
            badgeEl.className = 'hud-badge warn';
            badgeEl.innerHTML = `${icon('eye', 14)} 眼睛偏低 ${formatSigned(angle)}°`;
          }
        }
        if (hintEl) {
          hintEl.className = level ? 'ok' : 'warn';
          hintEl.textContent = level ? '眼睛水平 ✓' : `偏離水平 ${formatSigned(angle)}°`;
        }
        scope.draw({ trueTemp: target, elevation: angle, tint: level ? '#5fe3a1' : '#ffc95c' });
      };

      const setAngle = (next, { silent = false } = {}) => {
        if (submitted) return;
        angle = snapAngle(next);
        world?.setElevation(angle);
        updateUI();
        if (!silent) ctx.sfx.tap();
      };

      let dragging = null;
      const startDrag = (e, mode) => {
        if (submitted) return;
        e.preventDefault();
        if (mode === 'rail') e.stopPropagation();
        const startY = e.clientY;
        const startAngle = angle;
        dragging = { mode, startY, startAngle, pointerId: e.pointerId };
        (mode === 'rail' ? trackEl : stageEl).setPointerCapture?.(e.pointerId);
        stageEl.classList.add('dragging');
        if (mode === 'rail') {
          const rect = trackEl.getBoundingClientRect();
          const ratio = clamp((e.clientY - rect.top) / rect.height, 0, 1);
          setAngle(30 - ratio * 60, { silent: true });
        }
      };
      const moveDrag = (e) => {
        if (!dragging) return;
        e.preventDefault();
        if (dragging.mode === 'rail') {
          const rect = trackEl.getBoundingClientRect();
          const ratio = clamp((e.clientY - rect.top) / rect.height, 0, 1);
          setAngle(30 - ratio * 60, { silent: true });
        } else {
          const dy = dragging.startY - e.clientY;
          setAngle(dragging.startAngle + (dy / 180) * 60, { silent: true });
        }
      };
      const endDrag = () => {
        dragging = null;
        stageEl.classList.remove('dragging');
      };
      stageEl.addEventListener('pointerdown', (e) => startDrag(e, 'stage'));
      trackEl.addEventListener('pointerdown', (e) => startDrag(e, 'rail'));
      window.addEventListener('pointermove', moveDrag);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
      ctx.onCleanup(() => {
        window.removeEventListener('pointermove', moveDrag);
        window.removeEventListener('pointerup', endDrag);
        window.removeEventListener('pointercancel', endDrag);
      });

      const keyMove = (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setAngle(angle + (e.shiftKey ? 1 : 3));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setAngle(angle - (e.shiftKey ? 1 : 3));
        } else if (e.key === 'Enter' && document.activeElement !== inputEl) {
          submit();
        }
      };
      stageEl.addEventListener('keydown', keyMove);
      railEl.addEventListener('keydown', keyMove);

      el.querySelectorAll('[data-step]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cur = Number(inputEl.value) || 0;
          inputEl.value = String(clamp(cur + Number(btn.dataset.step), 20, 50));
          ctx.sfx.tap();
        });
      });

      inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });

      const submit = () => {
        if (submitted) return;
        const entered = Number(inputEl.value);
        if (!Number.isInteger(entered) || entered < 20 || entered > 50) {
          toast('請輸入 20 至 50 的整數。', 'error', 2600);
          inputEl.focus();
          inputEl.classList.add('animate-shake');
          setTimeout(() => inputEl.classList.remove('animate-shake'), 400);
          return;
        }
        submitted = true;
        const aligned = eyeLevelOk(angle);
        const correct = readingOk(entered, target);
        const submittedAngle = angle;
        const ms = performance.now() - startedAt;
        session.training.rounds.push({
          round: index + 1,
          targetTemp: target,
          startAngle: round.startAngle,
          entered,
          submittedAngle: Math.round(submittedAngle * 10) / 10,
          aligned,
          correct,
          ms: Math.round(ms),
          tutorial: !!round.tutorial,
        });
        ctx.save();
        inputEl.disabled = true;
        el.querySelectorAll('[data-step]').forEach((b) => (b.disabled = true));
        submitEl.disabled = false;

        if (!aligned) {
          angle = 0;
          world?.focusTraining(0, 0.7);
          updateUI();
        }

        let kind = 'bad';
        let title = '';
        let body = '';
        if (correct && aligned) {
          kind = 'good';
          title = '讀得正確！眼睛水平 ✓';
          body = `液面剛好對準 <b>${target} °C</b>。視線與液面水平，讀數最準確。`;
          ctx.sfx.correct();
        } else if (correct && !aligned) {
          kind = 'good';
          title = '讀數正確，但眼睛未水平';
          body = `你輸入了 <b>${entered} °C</b>，數值正確；但眼睛偏離水平 <b>${formatSigned(submittedAngle)}°</b>。水平時液面在 <b>${target} °C</b>。下次先對準再讀，避免「猜中」。`;
          ctx.sfx.chime();
        } else {
          title = '再看一次：水平時是多少？';
          body = `你輸入了 <b>${entered} °C</b>，但眼睛偏離水平 <b>${formatSigned(submittedAngle)}°</b>，讀數會偏高或偏低。眼睛水平時，液面在 <b>${target} °C</b>。`;
          ctx.sfx.wrong();
        }
        feedbackEl.innerHTML = `<div class="feedback-box ${kind}"><b>${title}</b>${body}</div>`;
        submitEl.innerHTML = index + 1 >= ROUNDS.length
          ? `${icon('arrow-right', 17)} 完成訓練，進入實驗`
          : `${icon('arrow-right', 17)} 下一回合`;
        submitEl.onclick = () => {
          ctx.sfx.click();
          if (index + 1 >= ROUNDS.length) ctx.go('experiment');
          else ctx.go('training');
        };
        submitEl.focus();
      };

      submitEl.addEventListener('click', submit);
      updateUI();

      el.querySelector('[data-train="why"]')?.addEventListener('click', () => {
        const { el: modal } = openModal(`
          <h2>為甚麼眼睛要水平？</h2>
          <p>溫度計的刻度印在玻璃背面，紅色液柱在刻度前面。兩者有一點距離，所以眼睛的位置會改變你看見的讀數。</p>
          <div style="margin:16px 0;padding:14px;border-radius:16px;background:#e7f7ff;border:1px solid rgba(34,184,214,.2)">
            <svg viewBox="0 0 420 190" width="100%" role="img" aria-label="Side view of a thermometer showing parallax">
              <rect x="210" y="24" width="34" height="140" rx="8" fill="#eaf9ff" stroke="#2a6c86" stroke-width="2"/>
              <rect x="218" y="50" width="18" height="112" rx="6" fill="#ff6b73"/>
              <line x1="244" y1="50" x2="300" y2="50" stroke="#d92c3d" stroke-width="2" stroke-dasharray="4 4"/>
              <text x="308" y="55" font-size="12" fill="#0a2d43" font-weight="700">液面</text>
              <circle cx="52" cy="82" r="12" fill="#0a2d43"/><circle cx="52" cy="82" r="5" fill="#fff"/>
              <line x1="66" y1="82" x2="210" y2="58" stroke="#f3a712" stroke-width="2" stroke-dasharray="5 4"/>
              <text x="24" y="118" font-size="11" fill="#8a5b00" font-weight="700">眼睛偏高</text>
              <circle cx="52" cy="140" r="12" fill="#0a2d43"/><circle cx="52" cy="140" r="5" fill="#fff"/>
              <line x1="66" y1="140" x2="210" y2="152" stroke="#22b8d6" stroke-width="2" stroke-dasharray="5 4"/>
              <text x="24" y="168" font-size="11" fill="#087d96" font-weight="700">眼睛偏低</text>
              <line x1="66" y1="111" x2="210" y2="111" stroke="#25a66f" stroke-width="2"/>
              <text x="84" y="106" font-size="11" fill="#128354" font-weight="700">眼睛水平 ✓</text>
            </svg>
          </div>
          <p><b>眼睛偏高</b>：紅色液柱看起來偏低，讀數偏小。<br/><b>眼睛偏低</b>：紅色液柱看起來偏高，讀數偏大。<br/><b>眼睛水平</b>：視線垂直穿過刻度，讀數最準確。</p>
          <div class="notice paper"><b>記住：</b>先讓眼睛與液面水平，再讀紅色液面頂部的刻度。</div>
          <div class="btn-row"><button class="btn" id="why-ok">明白</button></div>
        `);
        modal.querySelector('#why-ok').addEventListener('click', () => modal.remove());
      });
    },
  };
}
