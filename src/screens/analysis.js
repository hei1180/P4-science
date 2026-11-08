import { icon, esc } from '../ui.js';
import { ANALYSIS_QUESTIONS } from '../../questions.js';
import { trueReading, clockFromMinutes, formatSigned } from '../../logic.js';

export function renderAnalysis(ctx) {
  if (!ctx.session) {
    queueMicrotask(() => ctx.startNew(ctx.player?.classCode || '4C'));
    return { html: '<div class="wrap"><div class="card card-pad">正在準備…</div></div>', topbar: 'analysis', stage: 'analysis' };
  }
  const s = ctx.session;
  if ((s.experiment?.readings?.length || 0) < 6) {
    queueMicrotask(() => ctx.go('experiment'));
    return { html: '', topbar: 'experiment', stage: 'experiment' };
  }
  if ((s.analysis?.answers?.length || 0) >= ANALYSIS_QUESTIONS.length) {
    queueMicrotask(() => ctx.go('quiz', { section: 'variables' }));
    return { html: '', topbar: 'variables', stage: 'analysis' };
  }

  const data = [
    { t: 0, control: trueReading(0, false), cotton: trueReading(0, true) },
    { t: 3, control: trueReading(3, false), cotton: trueReading(3, true) },
    { t: 6, control: trueReading(6, false), cotton: trueReading(6, true) },
  ];
  const answered = s.analysis.answers.length;
  const myRows = [0, 3, 6]
    .map((t) => {
      const c = s.experiment.readings.find((r) => r.targetMin === t && r.cup === 'control');
      const k = s.experiment.readings.find((r) => r.targetMin === t && r.cup === 'cotton');
      const m = s.experiment.measurements.find((x) => x.targetMin === t);
      const flag = (r) => (r ? `${r.correct ? '✓' : '✗'} ${r.aligned ? '水平' : '未水平'} · ${formatSigned(r.angleDeg)}°` : '—');
      return `<tr><td>${t} 分鐘</td><td>${c?.entered ?? '—'} °C<div class="tiny" style="color:${c?.aligned ? '#128354' : '#b43728'}">${flag(c)}</div></td><td>${k?.entered ?? '—'} °C<div class="tiny" style="color:${k?.aligned ? '#128354' : '#b43728'}">${flag(k)}</div></td><td>${m ? `${clockFromMinutes(m.capturedAtMin)}${m.timeOk ? ' ✓' : ' ⚠'}` : '—'}</td></tr>`;
    })
    .join('');

  const html = `
  <div class="wrap">
    <div class="row-between" style="margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div>
        <p class="kicker">ANALYSE · DATA TELLS US</p>
        <h1 style="font-size:clamp(28px,3.6vw,44px)">數據告訴我們甚麼？</h1>
        <p class="lead" style="margin:6px 0 0">比較兩杯水在 6 分鐘內的降溫，找出棉花怎樣影響熱的流失。</p>
      </div>
      <div class="pill pill-cyan" style="font-size:12px">${icon('table', 14)} 全班模擬數據</div>
    </div>

    <div class="analysis-layout">
      <div class="stack">
        <div class="paper chart-card">
          <div class="chart-head">
            <div><p class="tiny" style="color:#087d96;letter-spacing:.14em;margin:0 0 2px">CLASS DATA</p><h3 style="font-size:19px">水溫隨時間的變化</h3></div>
            <div class="chart-legend"><span><i style="background:#1f9bd1"></i>清水</span><span><i style="background:#e09a13"></i>棉花</span></div>
          </div>
          ${chartSvg(data)}
          <p class="chart-note">0 分鐘：兩杯都是 45 °C。6 分鐘：清水 38 °C、棉花 41 °C。</p>
        </div>

        <div class="paper chart-card">
          <div class="row-between" style="margin-bottom:8px"><h3 style="font-size:18px">數據表</h3><span class="pill pill-amber">單位：°C</span></div>
          <table class="data-table">
            <thead><tr><th>時間</th><th><b>清水（對照）</b></th><th><b>棉花（皮毛模型）</b></th></tr></thead>
            <tbody>
              ${data.map((d) => `<tr><td>${d.t} 分鐘</td><td><span class="val">${d.control}</span></td><td><span class="val">${d.cotton}</span></td></tr>`).join('')}
            </tbody>
          </table>
          <div class="observation-list">
            <div class="observation"><span class="n">1</span><div>清水杯：45 → 38 °C。棉花杯：45 → 41 °C。</div></div>
            <div class="observation"><span class="n">2</span><div>棉花杯降溫較少，表示棉花<b>減慢熱的流失</b>。</div></div>
            <div class="observation"><span class="n">3</span><div>兩杯水都<b>沒有高過 45 °C</b>，所以皮毛不是熱的來源。</div></div>
          </div>
        </div>

        <details class="paper chart-card" style="cursor:pointer">
          <summary style="font-weight:900;font-size:13px;color:var(--ink);list-style:none;display:flex;align-items:center;gap:8px">${icon('user', 16)} 我的實驗記錄 <span class="pill" style="margin-left:auto">${s.experiment.readings.length} / 6</span></summary>
          <table class="data-table" style="margin-top:10px">
            <thead><tr><th>時間</th><th>清水</th><th>棉花</th><th>記錄時間</th></tr></thead>
            <tbody>${myRows}</tbody>
          </table>
          <p class="chart-note">✓ 讀數正確 · 水平 = 眼睛與液面水平 · ⚠ 記錄時間不在 ±20 秒內。</p>
        </details>
      </div>

      <div class="card card-pad" style="position:sticky;top:0">
        <p class="kicker">NEXT · 10 QUESTIONS</p>
        <h2 style="font-size:clamp(23px,2.4vw,30px)">用數據回答關鍵問題</h2>
        <p class="lead" style="font-size:13px;margin:9px 0 16px">計算降溫、判斷皮毛是否產生熱，並完成結論—證據—解釋（CER）。每題都有即時解釋。</p>
        <div class="stack" style="gap:9px;margin-bottom:18px">
          <div class="row" style="gap:9px"><span class="pill pill-cyan">1</span><span class="small">比較兩杯降溫</span></div>
          <div class="row" style="gap:9px"><span class="pill pill-cyan">2</span><span class="small">計算 0 → 6 分鐘降溫</span></div>
          <div class="row" style="gap:9px"><span class="pill pill-cyan">3</span><span class="small">皮毛會產生熱嗎？</span></div>
          <div class="row" style="gap:9px"><span class="pill pill-cyan">4</span><span class="small">CER 與皮毛結構</span></div>
        </div>
        <div class="notice">完成後，你會進入「變項挑戰」：自變項、因變項、不變項。</div>
        <button class="btn btn-lg btn-block" id="start-analysis" style="margin-top:16px">${icon('play', 18)} ${answered ? `繼續分析（${answered}/${ANALYSIS_QUESTIONS.length}）` : '開始分析問題'}</button>
        <p class="tiny muted center" style="margin:9px 0 0">約 5 分鐘 · 可隨時返回</p>
      </div>
    </div>
  </div>`;

  return {
    html,
    topbar: 'analysis',
    stage: 'analysis',
    mount(el) {
      el.querySelector('#start-analysis')?.addEventListener('click', () => {
        ctx.sfx.click();
        ctx.go('quiz', { section: 'analysis' });
      });
    },
  };
}

function chartSvg(data) {
  const W = 560;
  const H = 310;
  const L = 46;
  const R = 18;
  const T = 16;
  const B = 38;
  const x = (m) => L + (m / 6) * (W - L - R);
  const y = (t) => T + ((50 - t) / 30) * (H - T - B);
  const gridY = [20, 25, 30, 35, 40, 45, 50];
  const gridX = [0, 1, 2, 3, 4, 5, 6];
  const line = (key) => data.map((d) => `${x(d.t)},${y(d[key])}`).join(' ');
  return `
  <div class="chart-wrap">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Line chart of water temperature for the control and cotton cups">
      <defs>
        <linearGradient id="fillControl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1f9bd1" stop-opacity=".18"/>
          <stop offset="1" stop-color="#1f9bd1" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="fillCotton" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#e09a13" stop-opacity=".16"/>
          <stop offset="1" stop-color="#e09a13" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridY.map((v) => `<line class="chart-grid" x1="${L}" y1="${y(v)}" x2="${W - R}" y2="${y(v)}"/><text class="chart-label" x="${L - 8}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('')}
      ${gridX.map((m) => `<line class="chart-grid" x1="${x(m)}" y1="${T}" x2="${x(m)}" y2="${H - B}"/>`).join('')}
      <line class="chart-axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>
      <line class="chart-axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>
      <text class="chart-label" x="${x(0)}" y="${H - 14}" text-anchor="middle">0</text>
      <text class="chart-label" x="${x(3)}" y="${H - 14}" text-anchor="middle">3</text>
      <text class="chart-label" x="${x(6)}" y="${H - 14}" text-anchor="middle">6</text>
      <text class="chart-label" x="${x(3)}" y="${H - 1}" text-anchor="middle" style="font-weight:800">時間（分鐘）</text>
      <text class="chart-label" x="10" y="${T + 8}" style="font-weight:800">°C</text>
      <path d="M ${x(0)},${y(data[0].control)} L ${x(3)},${y(data[1].control)} L ${x(6)},${y(data[2].control)} L ${x(6)},${H - B} L ${x(0)},${H - B} Z" fill="url(#fillControl)"/>
      <path d="M ${x(0)},${y(data[0].cotton)} L ${x(3)},${y(data[1].cotton)} L ${x(6)},${y(data[2].cotton)} L ${x(6)},${H - B} L ${x(0)},${H - B} Z" fill="url(#fillCotton)"/>
      <polyline class="chart-line control" points="${line('control')}"/>
      <polyline class="chart-line cotton" points="${line('cotton')}"/>
      ${data.map((d) => `<circle class="chart-dot control" cx="${x(d.t)}" cy="${y(d.control)}" r="5"/>`).join('')}
      ${data.map((d) => `<circle class="chart-dot cotton" cx="${x(d.t)}" cy="${y(d.cotton)}" r="5"/>`).join('')}
    </svg>
  </div>`;
}
