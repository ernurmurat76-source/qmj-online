'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const ROOT = path.join(__dirname, 'public');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const sessions = new Map();
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({ users: [], materials: [] }, null, 2));
}

function loadStore() {
  ensureStore();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { users: [], materials: [] }; }
}

function saveStore(store) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 200000) reject(new Error('Сұраныс көлемі тым үлкен'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('JSON форматы қате')); }
    });
    req.on('error', reject);
  });
}

function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(item => {
    const [key, ...value] = item.trim().split('=');
    return [key, decodeURIComponent(value.join('='))];
  }));
}

function currentUser(req) {
  const id = sessions.get(cookies(req).qmj_session);
  if (!id) return null;
  const user = loadStore().users.find(item => item.id === id);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

function createPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, saved) {
  const [salt, stored] = String(saved || '').split(':');
  if (!salt || !stored) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function newSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, userId);
  return token;
}

function authCookie(token, clear = false) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `qmj_session=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : 604800}${secure}`;
}

const toolNames = {
  qmj: 'Қысқа мерзімді жоспар (ҚМЖ)',
  assessment: 'БЖБ/ТЖБ бағалау материалы',
  tasks: 'Сабақ тапсырмалары',
  presentation: 'Презентация жоспары',
  quiz: 'Тест және викторина',
  games: 'Интерактивті оқу ойыны',
  visual: 'Көрнекі материал',
  article: 'Педагогикалық мақала немесе эссе'
};

function localTemplate(body) {
  const title = toolNames[body.type] || toolNames.qmj;
  return `# ${title}\n\n**Пән:** ${body.subject}\n**Сынып:** ${body.grade}\n**Тақырып:** ${body.topic}\n**Оқу мақсаты:** ${body.objective || 'Оқу бағдарламасына сәйкес анықталады'}\n\n## Сабақ мақсаты\n- Тақырыптың негізгі мазмұнын түсіну.\n- Білімді тәжірибелік тапсырмада қолдану.\n- Нәтижесін түсіндіріп, өзін-өзі бағалау.\n\n## Сабақтың басы (5–7 минут)\nҰйымдастыру, жағымды ахуал қалыптастыру және алдыңғы білімді анықтайтын қысқа сұрақтар.\n\n## Сабақтың ортасы (25–30 минут)\n1. Мұғалім тақырыпты қысқаша түсіндіреді.\n2. Оқушылар жеке тапсырма орындайды.\n3. Жұпта жауаптарын салыстырады.\n4. Топтық жұмыста нақты мәселенің шешімін ұсынады.\n\n**Дескрипторлар:**\n- негізгі ұғымдарды дұрыс атайды;\n- тапсырманы берілген шартпен орындайды;\n- жауабын дәлелдейді.\n\n## Сабақтың соңы (5–8 минут)\n«3–2–1» рефлексиясы: 3 жаңа ақпарат, 2 маңызды ой, 1 сұрақ.\n\n## Бағалау\nАуызша кері байланыс, өзін-өзі бағалау және дескриптор бойынша қалыптастырушы бағалау.\n\n## Саралау және қолдау\nҚолдауды қажет ететін оқушыға үлгі мен тірек сөздер беріледі. Қабілеті жоғары оқушыға күрделендірілген тапсырма ұсынылады.\n\n## Қауіпсіздік\nСыныптағы қауіпсіздік ережелері және құрылғымен жұмыс нормалары сақталады.\n\n> Бұл — API кілті қосылмаған кезде жасалған жергілікті үлгі. OpenRouter кілтін қосқанда ЖИ тақырыпқа сай толық материал құрастырады.`;
}

async function generateWithAI(body) {
  if (!OPENROUTER_API_KEY) return { content: localTemplate(body), model: 'local-template' };
  const system = `Сен Қазақстан мектебінің тәжірибелі әдіскерісің. ${toolNames[body.type] || toolNames.qmj} құрастыр. Материал бірден қолдануға дайын, жас ерекшелігіне сай, нақты және құрылымды болсын. Қалыптастырушы бағалау, дескриптор, саралау, инклюзивті қолдау және қауіпсіздікті орынды енгіз. Жалған нормативтік дерек қоспа. Markdown форматында жаз.`;
  const prompt = `Тілі: ${body.language || 'Қазақ тілі'}\nПән: ${body.subject}\nСынып: ${body.grade}\nТақырып: ${body.topic}\nОқу мақсаты: ${body.objective || 'көрсетілмеген'}\nҚосымша талап: ${body.extra || 'жоқ'}`;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.PUBLIC_URL || `http://localhost:${PORT}`,
      'X-Title': 'QMJ Online'
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.35,
      max_tokens: 4000
    })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'ЖИ сервисі уақытша жауап бермеді');
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error('ЖИ бос жауап қайтарды');
  return { content, model: result.model || 'openrouter/free' };
}

async function api(req, res, pathname) {
  try {
    if (req.method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true, ai: Boolean(OPENROUTER_API_KEY) });
    if (req.method === 'GET' && pathname === '/api/me') return sendJson(res, 200, { user: currentUser(req) });

    if (req.method === 'POST' && pathname === '/api/register') {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (name.length < 2 || !email.includes('@') || password.length < 6) return sendJson(res, 400, { error: 'Аты-жөніңізді, дұрыс email және кемінде 6 таңбалы құпиясөз енгізіңіз' });
      const store = loadStore();
      if (store.users.some(user => user.email === email)) return sendJson(res, 409, { error: 'Бұл email бұрын тіркелген' });
      const user = { id: crypto.randomUUID(), name, email, password: createPassword(password), createdAt: new Date().toISOString() };
      store.users.push(user);
      saveStore(store);
      const token = newSession(user.id);
      return sendJson(res, 201, { user: { id: user.id, name, email } }, { 'Set-Cookie': authCookie(token) });
    }

    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await readBody(req);
      const store = loadStore();
      const user = store.users.find(item => item.email === String(body.email || '').trim().toLowerCase());
      if (!user || !verifyPassword(String(body.password || ''), user.password)) return sendJson(res, 401, { error: 'Email немесе құпиясөз қате' });
      const token = newSession(user.id);
      return sendJson(res, 200, { user: { id: user.id, name: user.name, email: user.email } }, { 'Set-Cookie': authCookie(token) });
    }

    if (req.method === 'POST' && pathname === '/api/logout') {
      sessions.delete(cookies(req).qmj_session);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': authCookie('', true) });
    }

    const user = currentUser(req);
    if (!user) return sendJson(res, 401, { error: 'Алдымен аккаунтқа кіріңіз' });

    if (req.method === 'POST' && pathname === '/api/generate') {
      const body = await readBody(req);
      if (!body.type || !String(body.subject || '').trim() || !String(body.grade || '').trim() || !String(body.topic || '').trim()) return sendJson(res, 400, { error: 'Міндетті өрістерді толтырыңыз' });
      return sendJson(res, 200, await generateWithAI(body));
    }

    if (req.method === 'GET' && pathname === '/api/materials') {
      const items = loadStore().materials.filter(item => item.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return sendJson(res, 200, { items });
    }

    if (req.method === 'POST' && pathname === '/api/materials') {
      const body = await readBody(req);
      if (!String(body.title || '').trim() || !String(body.content || '').trim()) return sendJson(res, 400, { error: 'Материал бос болмауы керек' });
      const store = loadStore();
      const item = { id: crypto.randomUUID(), userId: user.id, title: String(body.title).slice(0, 180), type: body.type || 'qmj', content: String(body.content), createdAt: new Date().toISOString() };
      store.materials.push(item);
      saveStore(store);
      return sendJson(res, 201, { item });
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/materials/')) {
      const id = pathname.split('/').pop();
      const store = loadStore();
      const before = store.materials.length;
      store.materials = store.materials.filter(item => !(item.id === id && item.userId === user.id));
      if (store.materials.length === before) return sendJson(res, 404, { error: 'Материал табылмады' });
      saveStore(store);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: 'API жолы табылмады' });
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message || 'Сервер қатесі' });
  }
}

function staticFile(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(ROOT, relative);
  if (!target.startsWith(ROOT + path.sep) && target !== path.join(ROOT, 'index.html')) return sendJson(res, 403, { error: 'Рұқсат жоқ' });
  fs.readFile(target, (error, data) => {
    if (error) return sendJson(res, 404, { error: 'Файл табылмады' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream' });
    res.end(data);
  });
}

ensureStore();
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (pathname.startsWith('/api/')) return api(req, res, pathname);
  return staticFile(req, res, pathname);
});

server.listen(PORT, HOST, () => console.log(`QMJ Online started on http://${HOST}:${PORT}`));
