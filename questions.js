// Question banks. Keep the wording short enough for P4 CMI learners:
// Chinese first, key English term in brackets, one idea per option.

export const ANALYSIS_QUESTIONS = [
  {
    id: 'a-cool-more',
    type: 'single',
    tag: '觀察數據',
    prompt: '根據全班數據，哪一杯水降溫較多？',
    sub: 'Look at the 0 → 6 minute change.',
    options: ['清水（對照）', '棉花（皮毛模型）', '兩杯一樣', '無法比較'],
    answer: 0,
    explain: '清水杯由 45 °C 降到 38 °C，降了 7 °C；棉花杯只降到 41 °C，降了 4 °C。',
  },
  {
    id: 'a-cool-less',
    type: 'single',
    tag: '觀察數據',
    prompt: '哪一杯水降溫較少？',
    sub: 'Which cup kept its heat better?',
    options: ['清水（對照）', '棉花（皮毛模型）', '兩杯一樣', '無法比較'],
    answer: 1,
    explain: '棉花杯降溫較少，表示棉花減慢了熱的流失。',
  },
  {
    id: 'a-drop-control',
    type: 'number',
    tag: '計算',
    prompt: '清水杯由 0 分鐘到 6 分鐘，降溫多少 °C？',
    sub: '降溫 = 起始溫度 − 最後溫度',
    unit: '°C',
    answer: 7,
    explain: '45 − 38 = 7 °C。',
  },
  {
    id: 'a-drop-cotton',
    type: 'number',
    tag: '計算',
    prompt: '棉花杯由 0 分鐘到 6 分鐘，降溫多少 °C？',
    sub: '降溫 = 起始溫度 − 最後溫度',
    unit: '°C',
    answer: 4,
    explain: '45 − 41 = 4 °C。',
  },
  {
    id: 'a-no-rise',
    type: 'single',
    tag: '推論',
    prompt: '兩杯水的溫度有沒有高過 45 °C？這告訴我們甚麼？',
    sub: 'Check every reading in the table.',
    options: [
      '有；皮毛會產生熱',
      '沒有；皮毛不會產生熱，只會減慢散熱',
      '沒有；水本身不會變冷',
      '有；溫度計壞了',
    ],
    answer: 1,
    explain: '如果皮毛會產生熱，水溫應該上升。但兩杯水都只下降，所以皮毛是減慢散熱的物料，不是熱的來源。',
  },
  {
    id: 'a-claim',
    type: 'single',
    tag: '結論 CER',
    prompt: '結論（Claim）：這個實驗告訴我們甚麼？',
    sub: 'Choose the best claim.',
    options: [
      '棉花會產生熱，令水變暖。',
      '棉花會減慢熱的流失。',
      '棉花會吸收所有熱。',
      '清水比棉花更保暖。',
    ],
    answer: 1,
    explain: '實驗結果支持「棉花減慢熱的流失」，不是「棉花產生熱」。',
  },
  {
    id: 'a-evidence',
    type: 'single',
    tag: '證據 CER',
    prompt: '證據（Evidence）：哪一項最能支持你的結論？',
    sub: 'Use the numbers from the class data.',
    options: [
      '兩杯都用了 80 ml 水。',
      '棉花杯降 4 °C，清水杯降 7 °C。',
      '兩杯都放在同一間房間。',
      '我們在 0、3、6 分鐘量度。',
    ],
    answer: 1,
    explain: '比較兩杯的降溫幅度，才能看出棉花的影響：4 °C 比 7 °C 少。',
  },
  {
    id: 'a-reasoning',
    type: 'single',
    tag: '解釋 CER',
    prompt: '解釋（Reasoning）：為甚麼棉花杯降溫較少？',
    sub: 'Use the idea of trapped air.',
    options: [
      '棉花之間有空氣；空氣是差的導熱體，所以熱散失較慢。',
      '棉花是金屬，所以能反射熱。',
      '棉花會發熱，補回失去的熱。',
      '棉花令水無法蒸發，所以水沒有冷卻。',
    ],
    answer: 0,
    explain: '棉花纖維之間困住空氣。空氣是差的導熱體，減慢熱的傳遞，所以水降溫較慢。',
  },
  {
    id: 'a-air-place',
    type: 'multi',
    tag: '皮毛結構',
    prompt: '北極熊的毛在哪裏困住空氣？（可選多項）',
    sub: 'There is more than one place.',
    options: ['毛的中空部分', '毛與毛之間', '毛的表面油脂', '皮膚下面', '棉花纖維之間'],
    answer: [0, 1],
    explain: '北極熊的毛中間有中空部分，毛與毛之間也有很多小空隙，兩處都能困住空氣。棉花纖維之間雖然也有空氣，但這是棉花模型，不是北極熊的毛。',
  },
  {
    id: 'a-real-fur',
    type: 'single',
    tag: '比較模型',
    prompt: '為甚麼真實的北極熊皮毛比棉花模型更能保暖？',
    sub: 'Compare the structure, not just the colour.',
    options: [
      '因為毛是白色的，白色會產生熱。',
      '因為毛中空、防水，能困住更多空氣，形成更厚的空氣層。',
      '因為棉花完全沒有空氣。',
      '因為北極熊的毛比棉花重。',
    ],
    answer: 1,
    explain: '真實皮毛有中空毛管、油脂防水，還有長護毛和濃密底毛，能困住更多靜止空氣。白色主要是保護色，不是保暖的原因。',
  },
];

export const VARIABLE_QUESTIONS = [
  {
    id: 'v-match',
    type: 'match',
    tag: '變項定義',
    prompt: '把三個變項和正確的意思配對。',
    sub: 'Tap a definition, then tap the matching term.',
    terms: ['自變項', '因變項', '不變項'],
    termSub: ['Independent variable', 'Dependent variable', 'Controlled variables'],
    defs: [
      '我們量度或觀察的結果',
      '其他要保持一樣的條件',
      '我們故意改變的條件',
    ],
    pairs: [
      { term: 0, defIndex: 2 },
      { term: 1, defIndex: 0 },
      { term: 2, defIndex: 1 },
    ],
    explain: '自變項是我們故意改變的條件；因變項是我們量度或觀察的結果；不變項是其他要保持一樣的條件。',
  },
  {
    id: 'v-iv',
    type: 'single',
    tag: '自變項',
    prompt: '在棉花保溫實驗中，哪一個是自變項？',
    sub: 'What did we deliberately change?',
    options: ['有沒有用棉花包住杯', '6 分鐘後的水溫', '水量 80 ml', '量度時間'],
    answer: 0,
    explain: '我們只改變「有沒有棉花」：一杯包棉花，一杯不包。這就是自變項。',
  },
  {
    id: 'v-dv',
    type: 'single',
    tag: '因變項',
    prompt: '在棉花保溫實驗中，哪一個是因變項？',
    sub: 'What did we measure?',
    options: ['杯的顏色', '6 分鐘內水溫的下降', '房間的溫度', '棉花的厚度'],
    answer: 1,
    explain: '我們量度水溫的變化（降溫幅度），這是因變項。',
  },
  {
    id: 'v-controls',
    type: 'multi',
    tag: '不變項',
    prompt: '哪些條件要保持一樣，才是公平測試？（可選多項）',
    sub: 'Choose every controlled variable.',
    options: ['兩組實驗同一款杯', '水量 80 ml', '起始水溫 45 °C', '同一間房間', '量度 6 分鐘', '溫度計位置', '有沒有棉花', '我們的預測'],
    answer: [0, 1, 2, 3, 4, 5],
    explain: '除了「有沒有棉花」，其他條件都要保持一樣：兩組實驗同一款杯、80 ml 水、45 °C 起始水溫、同一房間、6 分鐘、溫度計位置。預測不是要控制的條件。',
  },
  {
    id: 'v-unfair',
    type: 'single',
    tag: '公平測試',
    prompt: '甲組：80 ml、45 °C、包棉花。乙組：100 ml、45 °C、不包棉花。這個測試有甚麼問題？',
    sub: 'Two things are different.',
    options: [
      '沒有問題，兩組都有加水。',
      '改變了兩個條件：棉花和水量，所以不是公平測試。',
      '因變項選錯了。',
      '應該兩組都包棉花。',
    ],
    answer: 1,
    explain: '公平測試只改變一個變項。甲、乙兩組除了棉花不同，水量也不同（80 ml 對 100 ml），所以不能確定降溫差異是棉花造成。',
  },
  {
    id: 'v-why',
    type: 'single',
    tag: '公平測試',
    prompt: '為甚麼要保持不變項一樣？',
    sub: 'Why do scientists control variables?',
    options: [
      '令實驗看起來更整齊。',
      '令實驗更快完成。',
      '確保結果的差異只是由自變項造成，比較才公平。',
      '因為老師要求。',
    ],
    answer: 2,
    explain: '如果其他條件不同，我們就不知道結果是由哪一個條件造成。保持不變項一樣，才能公平比較。',
  },
  {
    id: 'v-transfer-dv',
    type: 'single',
    tag: '轉移應用',
    prompt: '新實驗：比較哪一種杯令冰塊融化得最慢。哪一個是因變項？',
    sub: 'A new fair test. What do we measure?',
    options: ['杯的材料', '冰塊完全融化所需的時間', '同一間房間', '冰塊的質量'],
    answer: 1,
    explain: '自變項是杯的材料；因變項是我們量度的結果——冰塊完全融化所需的時間。',
  },
  {
    id: 'v-not-control',
    type: 'single',
    tag: '辨識變項',
    prompt: '在我們的棉花實驗中，哪一項「不是」不變項？',
    sub: 'Which one is not a condition we keep the same?',
    options: ['水量', '起始水溫', '我們的預測', '杯的大小'],
    answer: 2,
    explain: '預測是我們的想法，不是實驗中要控制的條件。水量、起始水溫、杯的大小都要保持一樣。',
  },
];

export const ALL_QUESTIONS = [...ANALYSIS_QUESTIONS, ...VARIABLE_QUESTIONS];

export function findQuestion(id) {
  return ALL_QUESTIONS.find((q) => q.id === id);
}

export function validateBank(bank) {
  const ids = new Set();
  const errors = [];
  for (const q of bank) {
    if (!q.id || ids.has(q.id)) errors.push(`bad or duplicate id: ${q.id}`);
    ids.add(q.id);
    if (!['single', 'multi', 'number', 'match'].includes(q.type)) errors.push(`${q.id}: bad type`);
    if (q.type === 'single' && (!Array.isArray(q.options) || !(Number(q.answer) >= 0 && Number(q.answer) < q.options.length))) {
      errors.push(`${q.id}: answer out of range`);
    }
    if (q.type === 'multi') {
      if (!Array.isArray(q.answer) || !q.answer.length) errors.push(`${q.id}: empty multi answer`);
      if (q.answer?.some((i) => i < 0 || i >= q.options.length)) errors.push(`${q.id}: multi answer out of range`);
    }
    if (q.type === 'number' && !Number.isFinite(Number(q.answer))) errors.push(`${q.id}: bad number answer`);
    if (q.type === 'match') {
      if (!Array.isArray(q.terms) || !Array.isArray(q.defs) || !Array.isArray(q.pairs)) errors.push(`${q.id}: match shape`);
      if (q.pairs?.length !== q.terms?.length) errors.push(`${q.id}: pairs/terms length`);
      const seen = new Set();
      for (const p of q.pairs || []) {
        if (p.defIndex < 0 || p.defIndex >= q.defs.length) errors.push(`${q.id}: defIndex out of range`);
        if (seen.has(p.defIndex)) errors.push(`${q.id}: duplicate defIndex`);
        seen.add(p.defIndex);
      }
    }
  }
  return errors;
}
