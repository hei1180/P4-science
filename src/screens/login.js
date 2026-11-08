import { icon, esc } from '../ui.js';

export function renderLogin(ctx) {
  const html = `
  <div class="wrap">
    <div class="login-wrap">
      <div class="login-card card card-pad">
        <div class="login-bear">${icon('snowflake', 46)}</div>
        <p class="kicker" style="justify-content:center">P4 SCIENCE · 4LD2</p>
        <h2>歡迎來到北極實驗室</h2>
        <p class="lead">用 Google 登入，開始量度、記錄和分析。你的答案會記錄給老師，幫助你跟進學習。</p>
        <button class="btn btn-lg btn-block google-btn" id="google-signin">${icon('google', 22)} 使用 Google 登入</button>
        <div class="login-divider">或 OR</div>
        <button class="btn btn-ghost btn-block" id="guest-start">訪客試玩（不儲存）</button>
        <p class="login-fine">登入後，我們會儲存你的 Google 名稱、電郵、實驗讀數、答案和分數，只供你的老師查看。此活動使用與 P1 數學遊戲相同的 Firebase 專案。</p>
        <div class="login-error" id="login-error"></div>
        <div class="login-fine" style="margin-top:14px">載入有問題？請確認網址使用 <b>http://localhost:8000</b> 或 GitHub Pages，而不是直接開啟檔案。</div>
        <div class="login-fine">3D bear: “Bear” by Poly by Google, CC BY 3.0 · three.js MIT · fonts OFL</div>
      </div>
    </div>
  </div>`;

  return {
    html,
    topbar: 'login',
    stage: 'home',
    mount(el) {
      const btn = el.querySelector('#google-signin');
      const errBox = el.querySelector('#login-error');
      btn?.addEventListener('click', async () => {
        ctx.sfx.click();
        btn.disabled = true;
        const old = btn.innerHTML;
        btn.innerHTML = `<span class="spinner"></span> 正在登入…`;
        errBox.classList.remove('show');
        try {
          await ctx.signIn();
        } catch (err) {
          errBox.textContent = err?.message || '登入失敗，請再試一次。';
          errBox.classList.add('show');
        } finally {
          btn.disabled = false;
          btn.innerHTML = old;
        }
      });
      el.querySelector('#guest-start')?.addEventListener('click', () => {
        ctx.sfx.click();
        ctx.guestStart();
      });
    },
  };
}
