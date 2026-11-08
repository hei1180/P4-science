import { icon, esc, confetti } from '../ui.js';
import { answerRecord } from '../../logic.js';
import { ANALYSIS_QUESTIONS, VARIABLE_QUESTIONS } from '../../questions.js';

const TAGS = {
  觀察數據: 'pill-cyan',
  計算: 'pill-amber',
  推論: 'pill-cyan',
  '結論 CER': 'pill-green',
  '證據 CER': 'pill-green',
  '解釋 CER': 'pill-green',
  皮毛結構: 'pill-amber',
  比較模型: 'pill-amber',
  變項定義: 'pill-cyan',
  自變項: 'pill-red',
  因變項: 'pill-cyan',
  不變項: 'pill-green',
  公平測試: 'pill-amber',
  轉移應用: 'pill-cyan',
  辨識變項: 'pill-amber',
};

export function renderQuiz(ctx, opts = {}) {
  const section = opts.section || (opts.name === 'variables' ? 'variables' : 'analysis');
  const bank = section === 'variables' ? VARIABLE_QUESTIONS : ANALYSIS_QUESTIONS;
  const title = section === 'variables' ? '變項挑戰' : '數據分析';
  const sub = section === 'variables' ? '自變項 · 因變項 · 不變項' : '用數據回答關鍵問題';
  const topbar = section === 'variables' ? 'variables' : 'analysis';

  if (!ctx.session) {
    queueMicrotask(() => ctx.startNew(ctx.player?.classCode || '4C'));
    return { html: '<div class="wrap"><div class="card card-pad">正在準備…</div></div>', topbar, stage: 'analysis' };
  }
  const s = ctx.session;
  if (section === 'analysis' && (s.experiment?.readings?.length || 0) < 6) {
    queueMicrotask(() => ctx.go('experiment'));
    return { html: '', topbar: 'experiment', stage: 'experiment' };
  }
  if (section === 'variables' && (s.analysis?.answers?.length || 0) < ANALYSIS_QUESTIONS.length) {
    queueMicrotask(() => ctx.go('quiz', { section: 'analysis' }));
    return { html: '', topbar: 'analysis', stage: 'analysis' };
  }

  const answers = s[section].answers;
  if (answers.length >= bank.length) {
    return { html: completeHtml(ctx, section, bank, answers, topbar), topbar, stage: 'analysis', mount: (el) => bindComplete(ctx, el, section) };
  }

  if (section === 'variables' && answers.length === 0 && !opts.started) {
    return variablesIntro(ctx, topbar);
  }

  return {
    html: `<div class="wrap quiz-wrap" id="quiz-root"></div>`,
    topbar,
    stage: 'analysis',
    mount(el) {
      const root = el.querySelector('#quiz-root');
      let index = answers.length;
      let checked = false;
      let selected = null;
      let multi = new Set();
      let numberValue = '';
      let matchState = [null, null, null];
      let selectedDef = null;
      let result = false;
      let questionStarted = performance.now();
      let correctCount = answers.filter((a) => a.correct).length;

      const q = () => bank[index];
      const updateCorrect = () => {
        correctCount = s[section].answers.filter((a) => a.correct).length;
      };

      const chosenNow = () => {
        const question = q();
        if (question.type === 'single') return selected;
        if (question.type === 'multi') return [...multi];
        if (question.type === 'number') return Number(numberValue);
        if (question.type === 'match') return matchState;
        return null;
      };

      const canCheck = () => {
        const question = q();
        if (checked) return false;
        if (question.type === 'single') return selected != null;
        if (question.type === 'multi') return multi.size > 0;
        if (question.type === 'number') return numberValue !== '' && Number.isFinite(Number(numberValue));
        if (question.type === 'match') return matchState.every((v) => v != null);
        return false;
      };

      const render = () => {
        const question = q();
        if (!question) return renderComplete();
        const pct = ((index + (checked ? 1 : 0)) / bank.length) * 100;
        const head = `
          <div class="quiz-head">
            <div class="quiz-progress">
              <div class="bar"><i style="width:${pct}%"></i></div>
              <div class="meta"><span>${title} · 第 ${index + 1} / ${bank.length} 題</span><span>已答對 ${correctCount}</span></div>
            </div>
            <span class="pill pill-cyan">${icon('check-circle', 13)} ${correctCount} / ${bank.length}</span>
          </div>`;
        let body = '';
        if (question.type === 'single') body = singleHtml(question, selected, checked);
        else if (question.type === 'multi') body = multiHtml(question, multi, checked);
        else if (question.type === 'number') body = numberHtml(question, numberValue, checked);
        else if (question.type === 'match') body = matchHtml(question, matchState, selectedDef, checked);
        const tagClass = TAGS[question.tag] || 'pill-cyan';
        const explain = checked
          ? `<div class="explanation"><div class="verdict ${result ? 'good' : 'bad'}">${icon(result ? 'check-circle' : 'info', 17)} ${result ? '答對了！' : '再想一想'}</div><p>${esc(question.explain)}</p></div>`
          : '';
        const foot = checked
          ? `<div class="quiz-foot"><span class="quiz-score">${result ? '已記錄：正確 ✓' : '已記錄：不正確 ✗'}</span><button class="btn" id="q-next">${index + 1 >= bank.length ? '完成' : '下一題'} ${icon('arrow-right', 16)}</button></div>`
          : `<div class="quiz-foot"><span class="quiz-score">${question.type === 'multi' ? '可選多項' : question.type === 'match' ? '配對全部三項' : '選一個答案'}</span><button class="btn" id="q-check" ${canCheck() ? '' : 'disabled'}>${icon('check', 16)} 核對答案</button></div>`;
        root.innerHTML = `
          ${head}
          <div class="paper quiz-card">
            <div class="row-between" style="align-items:flex-start;gap:10px">
              <span class="pill ${tagClass} q-tag">${esc(question.tag)}</span>
              <span class="q-number small muted">Q${index + 1}</span>
            </div>
            <div class="q-prompt">${esc(question.prompt)}</div>
            <p class="q-sub">${esc(question.sub || '')}</p>
            ${body}
            ${explain}
            ${foot}
          </div>`;
        bind(question);
      };

      const bind = (question) => {
        root.querySelectorAll('[data-opt]').forEach((btn) => {
          btn.addEventListener('click', () => {
            if (checked) return;
            const i = Number(btn.dataset.opt);
            if (question.type === 'single') selected = selected === i ? null : i;
            else if (question.type === 'multi') {
              if (multi.has(i)) multi.delete(i);
              else multi.add(i);
            }
            ctx.sfx.tap();
            render();
          });
        });
        root.querySelectorAll('[data-term]').forEach((btn) => {
          btn.addEventListener('click', () => {
            if (checked) return;
            const i = Number(btn.dataset.term);
            if (selectedDef == null) {
              if (matchState[i] != null) {
                matchState[i] = null;
                ctx.sfx.tap();
                render();
              }
              return;
            }
            matchState = matchState.map((v) => (v === selectedDef ? null : v));
            matchState[i] = selectedDef;
            selectedDef = null;
            ctx.sfx.click();
            render();
          });
        });
        root.querySelectorAll('[data-def]').forEach((btn) => {
          btn.addEventListener('click', () => {
            if (checked) return;
            const i = Number(btn.dataset.def);
            if (matchState.includes(i)) return;
            selectedDef = selectedDef === i ? null : i;
            ctx.sfx.tap();
            render();
          });
        });
        const num = root.querySelector('#q-number');
        if (num) {
          num.addEventListener('input', () => {
            numberValue = num.value;
            const c = root.querySelector('#q-check');
            if (c) c.disabled = !canCheck();
          });
          num.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && canCheck()) check();
          });
        }
        root.querySelector('#q-check')?.addEventListener('click', check);
        root.querySelector('#q-next')?.addEventListener('click', next);
      };

      const check = () => {
        if (!canCheck()) return;
        const question = q();
        const chosen = chosenNow();
        const rec = answerRecord(question, chosen, performance.now() - questionStarted);
        s[section].answers.push(rec);
        ctx.save();
        checked = true;
        result = rec.correct;
        updateCorrect();
        if (result) ctx.sfx.correct();
        else ctx.sfx.wrong();
        render();
      };

      const next = () => {
        if (index + 1 >= bank.length) {
          renderComplete();
          return;
        }
        index += 1;
        checked = false;
        selected = null;
        multi = new Set();
        numberValue = '';
        matchState = [null, null, null];
        selectedDef = null;
        questionStarted = performance.now();
        render();
      };

      const renderComplete = () => {
        ctx.sfx.star();
        if (section === 'variables') confetti(70);
        const got = s[section].answers.filter((a) => a.correct).length;
        const total = bank.length;
        const pct = Math.round((got / total) * 100);
        const nextHref = section === 'analysis' ? 'variables' : 'results';
        root.innerHTML = `
          <div class="paper quiz-card center" style="padding:34px">
            <div class="big-emoji">${section === 'variables' ? '🧠' : '📊'}</div>
            <p class="kicker" style="justify-content:center;margin-top:10px">${section === 'variables' ? 'VARIABLES COMPLETE' : 'ANALYSIS COMPLETE'}</p>
            <h2>${section === 'variables' ? '變項挑戰完成！' : '數據分析完成！'}</h2>
            <p class="lead" style="margin:8px auto 18px">你答對了 <b>${got} / ${total}</b> 題（${pct}%）。${section === 'analysis' ? '下一步：辨認自變項、因變項和不變項。' : '你的答案和分數已記錄。'}</p>
            <div class="score-ring" style="width:150px;height:150px;margin:0 auto 18px">
              <svg viewBox="0 0 220 220" width="150" height="150">
                <circle class="bg" cx="110" cy="110" r="92"></circle>
                <circle class="fg" cx="110" cy="110" r="92" stroke-dasharray="578" stroke-dashoffset="${578 * (1 - got / total)}" style="stroke:#22b8d6"></circle>
              </svg>
              <div class="inner"><b style="font-size:38px">${pct}%</b><span>accuracy</span></div>
            </div>
            <button class="btn btn-lg" id="q-finish">${section === 'variables' ? '查看我的報告' : '進入變項挑戰'} ${icon('arrow-right', 17)}</button>
          </div>`;
        root.querySelector('#q-finish').addEventListener('click', () => {
          if (nextHref === 'variables') ctx.go('quiz', { section: 'variables' });
          else ctx.go('results');
        });
      };

      // Keyboard shortcuts for options and Enter.
      const onKey = (e) => {
        if (e.target && e.target.matches('input, textarea')) return;
        const question = q();
        if (!question) return;
        if (checked && e.key === 'Enter') {
          e.preventDefault();
          next();
          return;
        }
        if (!checked && (e.key === 'Enter') && canCheck()) {
          e.preventDefault();
          check();
          return;
        }
        if (!checked && /^[1-9]$/.test(e.key)) {
          const i = Number(e.key) - 1;
          if (question.type === 'single' && i < question.options.length) {
            selected = i;
            render();
          } else if (question.type === 'multi' && i < question.options.length) {
            if (multi.has(i)) multi.delete(i);
            else multi.add(i);
            render();
          }
        }
      };
      document.addEventListener('keydown', onKey);
      ctx.onCleanup(() => document.removeEventListener('keydown', onKey));

      render();
    },
  };
}

function singleHtml(q, selected, checked) {
  return `<div class="q-options">${q.options
    .map((opt, i) => {
      const correct = checked && i === q.answer;
      const wrong = checked && selected === i && i !== q.answer;
      return `<button class="opt ${selected === i ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}" data-opt="${i}" ${checked ? 'disabled' : ''}>
        <span class="key">${correct ? icon('check', 14) : wrong ? icon('x', 14) : String.fromCharCode(65 + i)}</span>
        <span>${esc(opt)}</span>
      </button>`;
    })
    .join('')}</div>`;
}

function multiHtml(q, multi, checked) {
  return `<div class="q-options">${q.options
    .map((opt, i) => {
      const selected = multi.has(i);
      const correct = checked && q.answer.includes(i);
      const wrong = checked && selected && !q.answer.includes(i);
      return `<button class="opt ${selected ? 'selected' : ''} ${correct ? 'correct' : ''} ${wrong ? 'wrong' : ''}" data-opt="${i}" ${checked ? 'disabled' : ''}>
        <span class="key">${correct ? icon('check', 14) : wrong ? icon('x', 14) : selected ? icon('check', 14) : ''}</span>
        <span>${esc(opt)}</span>
      </button>`;
    })
    .join('')}</div>`;
}

function numberHtml(q, value, checked) {
  const correct = checked && Number(value) === Number(q.answer);
  const wrong = checked && !correct;
  return `<div class="q-number" style="margin-top:22px">
    <input class="num-input" id="q-number" type="number" inputmode="numeric" min="0" max="100" step="1" value="${esc(value)}" ${checked ? 'disabled' : ''} aria-label="Answer" />
    <span class="unit">${esc(q.unit || '')}</span>
    ${checked ? `<span class="pill ${correct ? 'pill-green' : 'pill-red'}" style="margin-left:10px">${correct ? '正確' : `正確答案：${q.answer}${esc(q.unit || '')}`}</span>` : ''}
  </div>`;
}

function matchHtml(q, state, selectedDef, checked) {
  const defUsed = new Set(state.filter((v) => v != null));
  return `<div class="match-board">
    <div class="match-col">
      <div class="match-title">變項 / TERM</div>
      ${q.terms
        .map((term, i) => {
          const val = state[i];
          const isCorrect = checked && val === q.pairs[i].defIndex;
          const isWrong = checked && val != null && !isCorrect;
          return `<button class="match-term ${val != null ? 'filled' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}" data-term="${i}" ${checked ? 'disabled' : ''}>
            <span>${esc(term)}<small style="display:block;font-size:8.5px;color:#7b98a8;font-weight:800">${esc(q.termSub?.[i] || '')}</small></span>
            <span class="slot">${val == null ? '點按配對' : esc(q.defs[val])}</span>
          </button>`;
        })
        .join('')}
    </div>
    <div class="match-col">
      <div class="match-title">意思 / DEFINITION</div>
      ${q.defs
        .map((def, i) => {
          const used = defUsed.has(i) || checked;
          return `<button class="match-def ${used ? 'used' : ''} ${selectedDef === i ? 'selected' : ''}" data-def="${i}" ${used ? 'disabled' : ''}>
            ${esc(def)}
          </button>`;
        })
        .join('')}
    </div>
  </div>
  <p class="match-hint">先點一個意思，再點左邊的變項。點已配對的變項可以清除。</p>`;
}

function variablesIntro(ctx, topbar) {
  return {
    html: `
    <div class="wrap" style="max-width:980px">
      <div class="row-between" style="margin-bottom:14px">
        <div><p class="kicker">VARIABLES · 公平測試</p><h1 style="font-size:clamp(28px,3.6vw,44px)">自變項、因變項、不變項</h1></div>
        <span class="pill pill-amber">${icon('flask', 14)} 8 題</span>
      </div>
      <div class="paper card card-pad">
        <p class="lead" style="font-size:14px;margin:0 0 18px">科學家做公平測試時，只改變一個條件，量度一個結果，其他條件保持一樣。這三個角色就是三種變項。</p>
        <div class="vars-intro">
          <div class="var-card"><div class="tag">${icon('target', 20)}</div><b>自變項</b><span class="en">Independent variable</span><p>我們<b>故意改變</b>的條件。在我們的實驗中：有沒有用棉花包住杯。</p></div>
          <div class="var-card"><div class="tag">${icon('chart', 20)}</div><b>因變項</b><span class="en">Dependent variable</span><p>我們<b>量度或觀察</b>的結果。在我們的實驗中：6 分鐘內水溫的下降。</p></div>
          <div class="var-card"><div class="tag">${icon('lock', 20)}</div><b>不變項</b><span class="en">Controlled variables</span><p>其他<b>要保持一樣</b>的條件：同一個杯、80 ml、45 °C、同一房間、6 分鐘、溫度計位置。</p></div>
        </div>
        <div class="vars-example"><b>為甚麼要這樣做？</b> 如果兩杯水的水量不同，我們就不知道降溫差異是棉花造成，還是水量造成。保持不變項一樣，才能公平比較，把結果歸因於自變項。</div>
        <div class="row-between" style="margin-top:22px;flex-wrap:wrap;gap:10px">
          <span class="small muted">完成後，你的答案和準確度會記錄給老師。</span>
          <button class="btn btn-lg" id="start-vars">${icon('play', 18)} 開始變項挑戰</button>
        </div>
      </div>
    </div>`,
    topbar,
    stage: 'analysis',
    mount(el) {
      el.querySelector('#start-vars')?.addEventListener('click', () => {
        ctx.sfx.click();
        ctx.go('quiz', { section: 'variables', started: true });
      });
    },
  };
}

function completeHtml(ctx, section, bank, answers, topbar) {
  const got = answers.filter((a) => a.correct).length;
  const pct = Math.round((got / bank.length) * 100);
  return `<div class="wrap quiz-wrap">
    <div class="paper quiz-card center" style="padding:36px">
      <div class="big-emoji">${section === 'variables' ? '🏅' : '📊'}</div>
      <p class="kicker" style="justify-content:center;margin-top:10px">COMPLETE</p>
      <h2>${section === 'variables' ? '你已完成變項挑戰' : '你已完成數據分析'}</h2>
      <p class="lead" style="margin:8px auto 18px">答對 <b>${got} / ${bank.length}</b> 題（${pct}%）。</p>
      <button class="btn btn-lg" id="complete-next">${section === 'variables' ? '查看我的報告' : '進入變項挑戰'} ${icon('arrow-right', 17)}</button>
    </div>
  </div>`;
}

function bindComplete(ctx, el, section) {
  el.querySelector('#complete-next')?.addEventListener('click', () => {
    if (section === 'variables') ctx.go('results');
    else ctx.go('quiz', { section: 'variables' });
  });
}
