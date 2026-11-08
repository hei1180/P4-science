import { icon, esc, openModal } from '../ui.js';
import { sessionProgress } from '../state.js';

export function renderHome(ctx) {
  const p = ctx.player;
  const saved = ctx.getSaved();
  const classes = p.classCode || saved?.player?.classCode || '4C';
  const completed = !!saved?.completed;
  const resume = saved && !completed;
  const stepsDone = saved ? sessionProgress(saved) : 0;
  const firstName = (p.name || '同學').split(' ')[0];

  const savedBlock = saved
    ? `<div class="card resume-card card-pad" style="margin-top:16px;padding:16px 18px">
         <div class="row-between" style="gap:12px;flex-wrap:wrap">
           <div>
             <div class="pill ${completed ? 'pill-green' : 'pill-amber'}">${completed ? '已完成 · 可查看報告' : `進行中 · ${stepsDone}/4 步`}</div>
             <div style="font-weight:900;margin-top:7px">${completed ? '你的實驗報告已準備好' : '繼續上次的北極任務'}</div>
             <div class="small muted">${esc(saved.player.classCode || '4C')} · 開始於 ${new Date(saved.startedAtMs).toLocaleDateString('zh-HK')}</div>
           </div>
           <div class="btn-row">
             <button class="btn ${completed ? 'btn-green' : 'btn-amber'} btn-sm" data-home="${completed ? 'report' : 'resume'}">${completed ? '查看報告' : '繼續任務'}</button>
             <button class="btn btn-ghost btn-sm" data-home="fresh">重新開始</button>
           </div>
         </div>
       </div>`
    : '';

  const html = `
  <div class="wrap">
    <div class="home">
      <div class="home-copy">
        <p class="kicker">P4 SCIENCE · 4LD2 · 結構化探究</p>
        <h1>北極熊的毛，<span class="line2">怎樣保暖？</span></h1>
        <p class="lead">走進北極實驗室：量度兩杯水的降溫，找出棉花（皮毛模型）怎樣困住空氣、<span style="white-space:nowrap">減慢散熱</span>。你要學會用正確方法讀溫度計，並在<span style="white-space:nowrap">正確時間</span>記錄數據。</p>
        <div class="home-facts">
          <span class="pill pill-cyan">${icon('clock', 14)} 30 分鐘</span>
          <span class="pill">${icon('target', 14)} 4 個任務</span>
          <span class="pill">${icon('google', 14)} Google 記錄</span>
          <span class="pill">${icon('teacher', 14)} 4C 科學</span>
        </div>
        <div class="home-actions">
          <button class="btn btn-lg" data-home="start">${icon('play', 18)} 開始任務</button>
          <button class="btn btn-ghost btn-lg" data-home="how">${icon('info', 18)} 玩法說明</button>
        </div>
        <p class="home-note">${icon('lock', 13)} 登入後，你的答案、方法和分數會記錄給老師。${ctx.dev ? ' · DEV 模式' : ''}</p>
        ${savedBlock}
      </div>

      <aside class="mission-card card card-pad">
        <div class="mission-q">
          <div class="tiny">KEY QUESTION</div>
          <h2>北極熊沒有暖爐，牠的毛怎樣保暖？</h2>
          <div class="en">How does the fur of a polar bear keep it warm?</div>
        </div>
        <div class="mission-list">
          <div class="mission-item">
            <div class="dot">${icon('eye', 17)}</div>
            <div><b>1 · 眼睛水平讀溫度計</b><span>拖動視角，對準液面，讀出正確溫度。</span></div>
          </div>
          <div class="mission-item">
            <div class="dot">${icon('timer', 17)}</div>
            <div><b>2 · 0、3、6 分鐘記錄</b><span>兩杯水，三個時間點，準時記入數據表。</span></div>
          </div>
          <div class="mission-item">
            <div class="dot">${icon('chart', 17)}</div>
            <div><b>3 · 用數據解釋</b><span>比較降溫，完成結論—證據—解釋。</span></div>
          </div>
          <div class="mission-item">
            <div class="dot">${icon('flask', 17)}</div>
            <div><b>4 · 變項挑戰</b><span>辨認自變項、因變項和不變項。</span></div>
          </div>
        </div>
        <div class="mission-foot">
          <label class="stack" style="gap:4px">
            <span class="tiny muted">班別 CLASS</span>
            <input id="class-code" class="teacher-toolbar input" style="min-width:92px;width:100px;background:rgba(255,255,255,.06);color:var(--text);border-color:var(--line)" maxlength="12" value="${esc(classes)}" />
          </label>
          <div style="text-align:right">
            <div class="tiny muted">登入為</div>
            <div style="font-size:12px;font-weight:900;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(firstName)}</div>
          </div>
        </div>
      </aside>
    </div>
    <div class="home-teacher"><a href="./teacher.html">教師專區 · Teacher dashboard</a><span class="dot-sep">·</span><button class="linklike" data-home="credits">圖片與版權 Credits</button></div>
  </div>`;

  return {
    html,
    topbar: 'home',
    stage: 'home',
    mount(el) {
      const start = (fresh = false) => {
        const code = el.querySelector('#class-code')?.value || classes;
        if (saved && !fresh) {
          openModal(
            `<h2>開始新任務？</h2><p>你已有一份${completed ? '完成' : '進行中'}的記錄。開始新任務會清除此裝置上的進度，但已交到班級資料庫的記錄會保留。</p>
             <div class="btn-row"><button class="btn" id="new-yes">開始新任務</button><button class="btn btn-ghost" id="new-no" style="color:#08243a;border-color:rgba(8,36,58,.18)">取消</button></div>`,
          ).el;
          document.getElementById('new-yes').addEventListener('click', () => {
            ctx.startNew(code);
          });
          document.getElementById('new-no').addEventListener('click', () => ctx.go('home'));
        } else {
          ctx.startNew(code);
        }
      };

      el.querySelector('[data-home="start"]')?.addEventListener('click', () => start(false));
      el.querySelector('[data-home="resume"]')?.addEventListener('click', () => {
        if (saved) ctx.resume(saved);
      });
      el.querySelector('[data-home="report"]')?.addEventListener('click', () => {
        if (saved) ctx.viewReport(saved);
      });
      el.querySelectorAll('[data-home="fresh"]').forEach((b) => b.addEventListener('click', () => start(true)));

      el.querySelector('[data-home="credits"]')?.addEventListener('click', () => {
        const { el: modal } = openModal(`
          <h2>圖片與版權 · Credits</h2>
          <p class="small">這個活動使用了以下免費資源。所有 3D 實驗器材、棉花、溫度計、介面圖示和音效都是在程式碼中即時製作的。</p>
          <div class="demo-list">
            <div class="row"><span class="pill pill-cyan">Bear</span><div><b>“Bear” by Poly by Google</b><div class="small muted">Poly Pizza · CC BY 3.0 · recoloured white and scaled for this project.</div></div></div>
            <div class="row"><span class="pill pill-cyan">3D</span><div><b>three.js 0.186.1</b><div class="small muted">MIT licence · loaded from jsDelivr.</div></div></div>
            <div class="row"><span class="pill pill-cyan">Fonts</span><div><b>Nunito · Noto Sans TC</b><div class="small muted">Google Fonts · SIL Open Font License.</div></div></div>
            <div class="row"><span class="pill pill-cyan">Science</span><div><b>Lesson data</b><div class="small muted">Cooling curves reproduce the class data: bare 45 → 41 → 38 °C; cotton 45 → 43 → 41 °C.</div></div></div>
          </div>
          <div class="btn-row"><button class="btn" id="credits-ok">關閉</button></div>
        `);
        modal.querySelector('#credits-ok').addEventListener('click', () => modal.remove());
      });

      el.querySelector('[data-home="how"]')?.addEventListener('click', () => {
        const { el: modal } = openModal(`
          <h2>玩法說明</h2>
          <p>四個任務，約 30 分鐘。你可以用滑鼠、觸控或鍵盤。</p>
          <div class="demo-list">
            <div class="row"><span class="pill pill-cyan">1</span><div><b>眼睛水平</b><div class="small muted">拖動畫面，或使用畫面旁的滑桿，直到「眼睛水平 ✓」。眼睛偏高或偏低，讀數會出錯。</div></div></div>
            <div class="row"><span class="pill pill-cyan">2</span><div><b>準時記錄</b><div class="small muted">計時器到 0、3、6 分鐘時記錄兩杯水溫。太早或太晚都會標記。</div></div></div>
            <div class="row"><span class="pill pill-cyan">3</span><div><b>分析數據</b><div class="small muted">用全班數據計算降溫，完成 CER 解釋。</div></div></div>
            <div class="row"><span class="pill pill-cyan">4</span><div><b>變項挑戰</b><div class="small muted">配對定義，找出實驗中的自變項、因變項和不變項。</div></div></div>
          </div>
          <div class="notice paper">小提示：3D 場景需要較多圖形效能。如果畫面卡頓，請關閉其他分頁。</div>
          <div class="btn-row"><button class="btn" id="how-ok">明白</button></div>
        `);
        modal.querySelector('#how-ok').addEventListener('click', () => {
          ctx.sfx.click();
          modal.remove();
        });
      });
    },
  };
}
