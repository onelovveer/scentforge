const { perfumes } = require('./products');

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash-lite'
];

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const CATALOG_TEXT = perfumes.map(p => `
• ${p.brand} ${p.name} — ${p.price.toLocaleString('ru-RU')} ₽ (${p.volume})
  Ноты: ${p.notes}
  Описание: ${p.description}
  Поводы: ${p.profile.occasions.join(', ')}
  Характер: ${p.profile.vibes.join(', ')}
  Сезон: ${p.profile.seasons.join(', ')}
`).join('\n');

const PAYMENT_HINT = 'Оплата на ScentForge: войдите через Google → Профиль → пополните баланс → добавьте товар в корзину → «Оплатить с баланса». Подтверждение придёт на вашу Google-почту.';

// --- Smart matching (подсказки для ИИ и fallback) ---

const DIMENSION_KEYWORDS = {
  occasions: {
    office: ['офис', 'работ', 'делов', 'костюм', 'начальник', 'бизнес', 'совещан', 'коллег'],
    date: ['на свидан', 'свидан', 'романт', 'девуш', 'девушк', 'парн', 'любим', 'встреч с', 'обним', 'поцелу'],
    evening: ['для вечера', 'вечер', 'клуб', 'бар', 'тус', 'потус', 'вечерин', 'ноч', 'выход', 'выхож'],
    daily: ['каждый день', 'повседнев', 'на каждый', 'обычн', 'на работу', 'на учеб', 'универ', 'ежеднев'],
    party: ['вечерин', 'тусовк', 'тус', 'клуб', 'потус'],
    gift: ['подар', 'подарить', 'пап', 'брат', 'друг', 'муж', 'парень', 'юбил', 'день рожд', 'именин'],
    sport: ['спорт', 'зал', 'трениров', 'бег', 'фитнес']
  },
  vibes: {
    fresh: ['самый свеж', 'свеж', 'легк', 'лёгк', 'прохлад', 'морск', 'водн', 'цитрус', 'летн', 'летом', 'жар', 'жарк'],
    sweet: ['слад', 'ванил', 'гурм', 'тепл', 'тёпл', 'уют', 'обволак'],
    leather: ['кож', 'кожан', 'брутал', 'жестк', 'жёстк', 'дерз', 'мужик', 'агресс', 'байк', 'мото'],
    woody: ['древес', 'лес', 'кедр', 'сандал', 'ветiver', 'ветив'],
    luxury: ['дорог', 'люкс', 'премиум', 'статус', 'богат', 'элит', 'ниш', 'крут', 'топ', 'лучш', 'богато'],
    subtle: ['не навязч', 'незаметн', 'деликат', 'тонк', 'едва', 'легк пах', 'сдержан', 'скромн'],
    bold: ['ярк', 'смел', 'заметн', 'чтобы чувств', 'чтобы слыш', 'пахнуть', 'выделя'],
    romantic: ['романт', 'нежн', 'чувств', 'сексуаль', 'соблазн']
  },
  seasons: {
    summer: ['лет', 'летом', 'жар', 'жарк', 'тепл', 'весн'],
    winter: ['зим', 'зимой', 'холод', 'осен', 'осенью']
  },
  budget: {
    low: ['дешев', 'дёшев', 'дешев', 'бюджет', 'недорог', 'эконом', 'подешев', 'копей', 'не дорог', 'дешман', 'до 7', 'до 8', 'до 9000', 'до 8000', 'до 7000'],
    high: ['дорог', 'люкс', 'премиум', 'статус', 'элит', 'богат', 'без огранич', 'не жалко', 'топов']
  },
  brands: {
    dior: ['dior', 'диор', 'sauvage', 'саваж'],
    chanel: ['chanel', 'шанель', 'шanel', 'bleu'],
    tomford: ['tom ford', 'том форд', 'ombre', 'ombré', 'leather'],
    armani: ['armani', 'армани', 'acqua', 'аква', 'stronger'],
    versace: ['versace', 'версаче'],
    ysl: ['ysl', 'saint laurent', 'ив сен', 'парфюм y'],
    creed: ['creed', 'крид', 'криед', 'imperial', 'импер']
  }
};

const PRICE_TIER = { budget: 8500, mid: 12000, premium: 18000, luxury: 99999 };

function normalize(text) {
  return text.toLowerCase().replace(/ё/g, 'е').trim();
}

function matchesKeyword(msg, keyword) {
  const idx = msg.indexOf(keyword);
  if (idx === -1) return false;
  if (keyword === 'дорог') {
    const before = msg.slice(Math.max(0, idx - 3), idx);
    if (/не\s?$/.test(before) || before.endsWith('н')) return false;
  }
  return true;
}

function detectDimensions(msg) {
  const dims = { occasions: [], vibes: [], seasons: [], budget: null, brands: [] };
  for (const [dim, groups] of Object.entries(DIMENSION_KEYWORDS)) {
    if (dim === 'budget') {
      const lowHit = groups.low.some(w => matchesKeyword(msg, w));
      const highHit = groups.high.some(w => matchesKeyword(msg, w));
      if (lowHit) dims.budget = 'low';
      else if (highHit) dims.budget = 'high';
      continue;
    }
    for (const [key, words] of Object.entries(groups)) {
      if (words.some(w => matchesKeyword(msg, w))) {
        if (dim === 'brands') dims.brands.push(key);
        else dims[dim].push(key);
      }
    }
  }
  return dims;
}

function scorePerfume(perfume, dims, msg) {
  let score = 0;
  const reasons = [];
  const p = perfume.profile;

  for (const b of dims.brands) {
    if (p.brands.includes(b)) { score += 80; reasons.push(`запрос про ${perfume.brand}`); }
  }
  if (msg.includes(perfume.name.toLowerCase()) && perfume.name.length > 3) {
    score += 100; reasons.push('назван этот аромат');
  }
  for (const occ of dims.occasions) {
    if (p.occasions.includes(occ)) {
      score += 25;
      const labels = { office: 'офис', date: 'свидание', evening: 'вечер', daily: 'каждый день', party: 'вечеринка', gift: 'подарок', sport: 'спорт' };
      reasons.push(labels[occ] || occ);
    }
  }
  for (const vibe of dims.vibes) {
    if (p.vibes.includes(vibe)) {
      score += 20;
      const labels = { fresh: 'свежий', sweet: 'сладкий', leather: 'кожаный', woody: 'древесный', luxury: 'премиум', subtle: 'ненавязчивый', bold: 'яркий', romantic: 'романтичный' };
      reasons.push(labels[vibe] || vibe);
    }
  }
  if (dims.occasions.includes('date') && p.vibes.includes('romantic')) score += 12;
  if (dims.occasions.includes('date') && p.occasions[0] === 'date') score += 8;
  if (dims.occasions.includes('date')) {
    const dateHits = { Eros: 10, 'Stronger With You': 8, Sauvage: 4 };
    if (dateHits[perfume.name]) score += dateHits[perfume.name];
  }
  for (const s of dims.seasons) {
    if (p.seasons.includes(s) || (s === 'summer' && p.seasons.includes('all') && p.vibes.includes('fresh'))) score += 18;
  }
  if (dims.seasons.includes('summer') && dims.vibes.includes('fresh') && p.vibes.includes('subtle')) score += 10;
  if (dims.seasons.includes('summer') && p.seasons.includes('summer')) score += 8;
  if (dims.budget === 'low') {
    if (perfume.price <= PRICE_TIER.budget) score += 45;
    else if (perfume.price <= 10000) score -= 15;
    else score -= 80;
  }
  if (dims.budget === 'high') {
    if (p.tier === 'premium' || p.tier === 'luxury') score += 35;
    if (p.tier === 'budget') score -= 40;
  }
  if (dims.occasions.includes('office') && dims.occasions.includes('daily')) {
    if (p.occasions.includes('office') && p.vibes.includes('subtle')) score += 15;
    if (p.vibes.includes('bold') && !p.occasions.includes('office')) score -= 10;
  }
  if (!dims.occasions.length && !dims.vibes.length && !dims.budget && !dims.brands.length && p.versatile) score += 5;

  return { score, reasons: [...new Set(reasons)] };
}

function rankPerfumes(message) {
  const msg = normalize(message);
  const dims = detectDimensions(msg);
  return perfumes
    .map(p => {
      const { score, reasons } = scorePerfume(p, dims, msg);
      return { perfume: p, score, reasons, dims };
    })
    .sort((a, b) => b.score - a.score || a.perfume.price - b.perfume.price);
}

function buildCatalogHints(message) {
  const ranked = rankPerfumes(message);
  const top = ranked.filter(r => r.score > 0).slice(0, 3);
  const picks = top.length ? top : ranked.slice(0, 3);
  const lines = picks.map(({ perfume, reasons }, i) => {
    const why = reasons.slice(0, 2).join(', ') || perfume.description.split('.')[0];
    return `${i + 1}. ${perfume.brand} ${perfume.name} — ${perfume.price.toLocaleString('ru-RU')} ₽ (${why})`;
  });
  return lines.join('\n');
}

function buildSystemPrompt(hints, history) {
  const context = history.length
    ? 'Учитывай предыдущие сообщения в диалоге — не повторяйся, отвечай по существу нового вопроса.'
    : '';

  return `Ты — живой парфюмерный консультант магазина ScentForge. Общаешься по-русски, дружелюбно и экспертно, как человек в бутике — не как робот и не как шаблонный автоответчик.

${context}

ТВОИ ВОЗМОЖНОСТИ:
• Подбирать ароматы из каталога ScentForge под повод, настроение, сезон, бюджет.
• Объяснять ноты, шлейф, стойкость, как наносить, чем отличаются ароматы.
• Отвечать на общие вопросы о мужской парфюмерии.
• Поддерживать диалог: уточнять, если запрос расплывчатый, помнить контекст беседы.

ЖЁСТКИЕ ПРАВИЛА:
1. Рекомендуя товар — ТОЛЬКО ароматы из каталога ниже. Никаких Chanel/Dior вне списка, никаких выдуманных названий.
2. Если клиент просит подбор — назови 1–3 конкретных аромата: бренд, название, цена, почему именно под его ситуацию.
3. Не перечисляй весь каталог и не давай ответ «для вечера X, для офиса Y» — отвечай именно на ТЕКУЩИЙ вопрос.
4. Если вопрос не о покупке (теория парфюмерии) — отвечай свободно, без навязчивых продаж.
5. Про оплату/корзину/баланс: ${PAYMENT_HINT}
6. Без markdown-заголовков и звёздочек. Короткие абзацы, можно нумерованный список для подборки.
7. 3–8 предложений обычно достаточно. Не пиши простыни.

КАТАЛОГ SCENTFORGE (единственный источник товаров):
${CATALOG_TEXT}

${hints ? `ПОДСКАЗКА АНАЛИТИКИ (используй как ориентир, переформулируй своими словами):\n${hints}` : ''}`;
}

function isPaymentQuestion(msg) {
  return /оплат|баланс|корзин|доставк|как купить|как заказ|оформить заказ/i.test(msg);
}

function isEducationalQuestion(msg) {
  return /чем отлича|что такое|как нанос|как правильно|зачем|почему|стойк|шлейф|сколько длит|edt|edp|eau de|концентрац|ветивер|амброксан|силонг|базовые нот/i.test(msg);
}

function isRecommendationQuestion(msg) {
  if (isEducationalQuestion(msg)) return false;
  return /подбери|выбра|подскаж|посовет|рекоменд|что взять|что купить|какой аромат|какую аромат|какой парфюм|какую парфюм|что лучше|иду на|нужен аромат|нужен парфюм|ищу аромат|на свидан|для вечера|для офиса|на работу|на подарок|недорог|бюджет|до \d+.*руб/i.test(msg);
}

function cleanReply(text) {
  if (!text) return '';
  return text
    .replace(/\*\*/g, '')
    .replace(/^#+\s*/gm, '')
    .trim();
}

function mentionsForeignProducts(reply) {
  const lower = reply.toLowerCase();
  const foreign = ['tom ford lost cherry', 'bleu de chanel eau de parfum intense', 'azzaro', 'hugo boss', 'calvin klein', 'paco rabanne', 'lacoste', 'montblanc', 'givenchy', 'hermes', 'burberry'];
  const mentionsCatalog = perfumes.some(p =>
    lower.includes(p.name.toLowerCase()) || lower.includes(p.brand.toLowerCase())
  );
  if (!mentionsCatalog && isRecommendationQuestion(lower)) return true;
  return foreign.some(f => lower.includes(f));
}

async function callGemini(message, history, systemPrompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const contents = [
    ...history.slice(-12).map(h => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }]
    })),
    { role: 'user', parts: [{ text: message }] }
  ];

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.75, maxOutputTokens: 900, topP: 0.9 }
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        console.error(`[AI] Gemini ${model}:`, data.error?.message || res.status);
        continue;
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return { text: cleanReply(text), model };
    } catch (err) {
      console.error(`[AI] Gemini ${model} network:`, err.message);
    }
  }
  return null;
}

async function callGroq(message, history, systemPrompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-12),
          { role: 'user', content: message }
        ],
        max_tokens: 900,
        temperature: 0.75
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[AI] Groq:', data.error?.message || res.status);
      return null;
    }
    const text = data.choices?.[0]?.message?.content;
    if (text) return { text: cleanReply(text), model: GROQ_MODEL };
  } catch (err) {
    console.error('[AI] Groq network:', err.message);
  }
  return null;
}

async function callOpenAI(message, history, systemPrompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-12),
          { role: 'user', content: message }
        ],
        max_tokens: 900,
        temperature: 0.75
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[AI] OpenAI:', data.error?.message || res.status);
      return null;
    }
    const text = data.choices?.[0]?.message?.content;
    if (text) return { text: cleanReply(text), model: 'gpt-4o-mini' };
  } catch (err) {
    console.error('[AI] OpenAI network:', err.message);
  }
  return null;
}

function conversationalFallback(message, history) {
  const msg = normalize(message);

  if (isPaymentQuestion(msg)) {
    return PAYMENT_HINT;
  }

  const hints = buildCatalogHints(message);
  const ranked = rankPerfumes(message);
  const top = ranked.filter(r => r.score > 0).slice(0, 3);
  const picks = top.length ? top : ranked.slice(0, 2);

  if (isRecommendationQuestion(msg) || picks[0]?.score >= 15) {
    const dims = detectDimensions(msg);
    const intro = dims.occasions.length || dims.vibes.length || dims.budget || picks[0]?.score >= 25
      ? 'Исходя из вашего запроса, вот что советую из нашего каталога:'
      : 'Вот несколько вариантов из ScentForge:';

    const body = picks.map(({ perfume, reasons }, i) => {
      const why = reasons[0] || perfume.description.split('.')[0];
      return `${i + 1}. ${perfume.brand} ${perfume.name} — ${perfume.price.toLocaleString('ru-RU')} ₽. ${why}.`;
    }).join('\n');

    const followUp = history.length > 2
      ? 'Могу сравнить эти варианты или подобрать дешевле/дороже — уточните.'
      : 'Расскажите подробнее о случае или бюджете — сузим выбор.';

    return `${intro}\n\n${body}\n\n${followUp}`;
  }

  if (/привет|здравств|добрый|хай|hello/i.test(msg)) {
    return 'Привет! Я консультант ScentForge. Расскажите, для какого случая ищете аромат — свидание, работа, вечер, подарок — или спросите что угодно о парфюмерии. Подберу из нашего каталога.';
  }

  if (/что такое|зачем|как нанос|стойк|шлейф|ноты|ветивер|амброксан|концентрац|edt|edp|чем отлича|туалетн/i.test(msg)) {
    if (/туалетн|edt|edp|концентрац|чем отлича/i.test(msg)) {
      return 'Туалетная вода (EDT) — 5–8% масла, легче и держится 4–6 часов. Парфюм/Parfum — 20%+ масла, гуще и стойче (8+ часов). Eau de Parfum (EDP) — золотая середина: 8–12%, 6–8 часов. Для жары и офиса часто берут EDT/лёгкий EDP, для вечера — EDP или парфюм. Хотите — подберу конкретный аромат из ScentForge под ваш случай.';
    }
    return 'Хороший вопрос! В мужской парфюмерии важны верхние ноты (первое впечатление), сердце (характер) и база (шлейф). Наносите на чистую кожу — запястья, шея, грудь; не трите. Назовите повод или настроение — предложу конкретные ароматы из нашего магазина.';
  }

  return `Могу подобрать аромат из ScentForge под ваш случай. Например:\n${hints}\n\nОпишите подробнее — куда идёте, какой бюджет, какой характер запаха хотите (свежий, сладкий, кожаный)?`;
}

async function generateProductDescription(name, brand) {
  const systemPrompt = `Ты — профессиональный копирайтер элитного парфюмерного магазина ScentForge.
Твоя задача: написать одно лаконичное, привлекательное и экспертное предложение-описание для мужского парфюма.
Описание должно подчеркивать статус, характер и уникальность аромата.
Язык: Русский.
Формат: Только одно предложение. Без кавычек.

Пример:
Dior Sauvage — это манифест свободы, воплощенный в мощном и благородном звучании свежих цитрусов и древесных нот.`;

  const userPrompt = `Напиши описание для парфюма: ${brand} ${name}`;

  try {
    // Try Gemini
    let result = await callGemini(userPrompt, [], systemPrompt);
    if (result) return result.text;

    // Try Groq
    result = await callGroq(userPrompt, [], systemPrompt);
    if (result) return result.text;

    // Try OpenAI
    result = await callOpenAI(userPrompt, [], systemPrompt);
    if (result) return result.text;

    // Static fallback
    return `${brand} ${name} — это утонченный выбор для современного мужчины, подчеркивающий его индивидуальность и стиль.`;
  } catch (err) {
    console.error('[AI] Description generation error:', err.message);
    return `${brand} ${name} — это утонченный выбор для современного мужчины, подчеркивающий его индивидуальность и стиль.`;
  }
}

async function getAIResponse(message, history = []) {
  const msg = normalize(message);

  if (isPaymentQuestion(msg)) {
    return { reply: PAYMENT_HINT, provider: 'smart' };
  }

  const hints = buildCatalogHints(message);
  const systemPrompt = buildSystemPrompt(hints, history);

  let result = await callGemini(message, history, systemPrompt);
  if (result && !mentionsForeignProducts(result.text)) {
    return { reply: result.text, provider: 'gemini', model: result.model };
  }

  result = await callGroq(message, history, systemPrompt);
  if (result && !mentionsForeignProducts(result.text)) {
    return { reply: result.text, provider: 'groq', model: result.model };
  }

  result = await callOpenAI(message, history, systemPrompt);
  if (result && !mentionsForeignProducts(result.text)) {
    return { reply: result.text, provider: 'openai', model: result.model };
  }

  return { reply: conversationalFallback(message, history), provider: 'smart' };
}

function getAIStatus() {
  if (process.env.GEMINI_API_KEY) {
    return { ready: true, provider: 'gemini', label: 'ИИ-консультант', version: 4 };
  }
  if (process.env.GROQ_API_KEY) {
    return { ready: true, provider: 'groq', label: 'ИИ-консультант', version: 4 };
  }
  if (process.env.OPENAI_API_KEY) {
    return { ready: true, provider: 'openai', label: 'ИИ-консультант', version: 4 };
  }
  return {
    ready: true,
    provider: 'smart',
    label: 'Консультант (добавьте GEMINI_API_KEY)',
    version: 4,
    needsKey: true
  };
}

module.exports = { getAIResponse, getAIStatus, generateProductDescription, smartRecommend: conversationalFallback };
