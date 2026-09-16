'use strict';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const state = {
  user: null,
  authMode: 'register',
  type: 'qmj',
  result: '',
  materials: []
};

const toolLabels = {
  qmj: 'ҚМЖ конструкторы', assessment: 'БЖБ/ТЖБ конструкторы', tasks: 'Сабақ тапсырмалары',
  presentation: 'Презентация жоспары', quiz: 'Тест және викторина', games: 'Интерактивті ойын',
  visual: 'Көрнекі материал', article: 'Мақала және эссе'
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Сұраныс орындалмады');
  return data;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.add('hidden'), 2500);
}

function openAuth(mode = 'register') {
  state.authMode = mode;
  const register = mode === 'register';
  $('#authTitle').textContent = register ? 'Тегін аккаунт ашу' : 'Аккаунтқа кіру';
  $('#authSubtitle').textContent = register ? 'Барлық құралға қол жеткізіңіз.' : 'Жеке кабинетіңізге кіріңіз.';
  $('#nameLabel').classList.toggle('hidden', !register);
  $('#authName').required = register;
  $('#authSubmit').textContent = register ? 'Тіркелу' : 'Кіру';
  $('#switchText').firstChild.textContent = register ? 'Аккаунтыңыз бар ма? ' : 'Аккаунтыңыз жоқ па? ';
  $('#switchAuth').textContent = register ? 'Кіру' : 'Тіркелу';
  $('#authError').textContent = '';
  $('#authModal').classList.remove('hidden');
}

function closeAuth() { $('#authModal').classList.add('hidden'); }

async function loadUser() {
  try {
    const { user } = await request('/api/me');
    if (user) enterDashboard(user);
  } catch { /* landing stays visible */ }
}

function enterDashboard(user) {
  state.user = user;
  closeAuth();
  $('#landing').classList.add('hidden');
  $('#footer').classList.add('hidden');
  $('.topbar').classList.add('hidden');
  $('#dashboard').classList.remove('hidden');
  $('#profileName').textContent = user.name;
  $('#profileEmail').textContent = user.email;
  $('#profileLetter').textContent = user.name.trim().charAt(0).toUpperCase();
  $('#welcomeTitle').textContent = `Қош келдіңіз, ${user.name.split(' ')[0]}!`;
  loadMaterials();
}

function enterLanding() {
  state.user = null;
  $('#dashboard').classList.add('hidden');
  $('#landing').classList.remove('hidden');
  $('#footer').classList.remove('hidden');
  $('.topbar').classList.remove('hidden');
  window.scrollTo({ top: 0 });
}

async function submitAuth(event) {
  event.preventDefault();
  const button = $('#authSubmit');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Күтіңіз...';
  $('#authError').textContent = '';
  try {
    const payload = { email: $('#authEmail').value, password: $('#authPassword').value };
    if (state.authMode === 'register') payload.name = $('#authName').value;
    const { user } = await request(`/api/${state.authMode}`, { method: 'POST', body: JSON.stringify(payload) });
    $('#authForm').reset();
    enterDashboard(user);
    toast(state.authMode === 'register' ? 'Аккаунт сәтті ашылды' : 'Қош келдіңіз!');
  } catch (error) {
    $('#authError').textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

async function logout() {
  try { await request('/api/logout', { method: 'POST', body: '{}' }); } catch { /* local exit */ }
  enterLanding();
}

function selectTool(type) {
  state.type = type;
  $$('#toolTabs button').forEach(button => button.classList.toggle('active', button.dataset.type === type));
  $('#formTitle').textContent = toolLabels[type];
  $('#emptyResult').classList.remove('hidden');
  $('#resultContent').classList.add('hidden');
  state.result = '';
}

async function generate(event) {
  event.preventDefault();
  const button = $('#generateBtn');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '⏳ Құрастырылып жатыр...';
  const payload = {
    type: state.type,
    subject: $('#subject').value.trim(),
    grade: $('#grade').value,
    topic: $('#topic').value.trim(),
    objective: $('#objective').value.trim(),
    language: $('#language').value,
    extra: $('#extra').value.trim()
  };
  try {
    const data = await request('/api/generate', { method: 'POST', body: JSON.stringify(payload) });
    state.result = data.content;
    $('#resultText').textContent = data.content;
    $('#modelLabel').textContent = data.model === 'local-template' ? 'Демо үлгі' : 'ЖИ арқылы';
    $('#emptyResult').classList.add('hidden');
    $('#resultContent').classList.remove('hidden');
    if (window.innerWidth < 760) $('#resultCard').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function materialTitle() {
  return `${toolLabels[state.type]} — ${$('#topic').value.trim() || 'Жаңа материал'}`;
}

async function saveMaterial() {
  if (!state.result) return toast('Алдымен материал құрастырыңыз');
  try {
    const { item } = await request('/api/materials', { method: 'POST', body: JSON.stringify({ title: materialTitle(), type: state.type, content: state.result }) });
    state.materials.unshift(item);
    renderArchive();
    toast('Материал мұрағатқа сақталды');
  } catch (error) { toast(error.message); }
}

function downloadMaterial(content = state.result, title = materialTitle()) {
  if (!content) return toast('Жүктейтін материал жоқ');
  const safe = text => text.replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  const html = `<html><head><meta charset="utf-8"><title>${safe(title)}</title></head><body><h1>${safe(title)}</h1><div style="white-space:pre-wrap;font-family:Arial;line-height:1.55">${safe(content)}</div></body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 90)}.doc`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function copyMaterial(content = state.result) {
  if (!content) return toast('Көшіретін материал жоқ');
  await navigator.clipboard.writeText(content);
  toast('Мәтін көшірілді');
}

async function loadMaterials() {
  try {
    const { items } = await request('/api/materials');
    state.materials = items;
    renderArchive();
  } catch (error) { toast(error.message); }
}

function renderArchive() {
  const query = ($('#archiveSearch')?.value || '').toLowerCase();
  const items = state.materials.filter(item => item.title.toLowerCase().includes(query));
  $('#archiveCount').textContent = state.materials.length;
  const list = $('#archiveList');
  if (!items.length) {
    list.innerHTML = '<div class="empty-archive">📁<h3>Мұрағат әзірге бос</h3><p>Құрастырған материалыңызды сақтаңыз.</p></div>';
    return;
  }
  list.innerHTML = items.map(item => `<article class="archive-item"><small>${toolLabels[item.type] || 'Материал'}</small><h4></h4><time>${new Date(item.createdAt).toLocaleString('kk-KZ')}</time><div class="archive-actions"><button data-action="open" data-id="${item.id}">Ашу</button><button data-action="download" data-id="${item.id}">Word</button><button class="delete" data-action="delete" data-id="${item.id}">Өшіру</button></div></article>`).join('');
  [...list.children].forEach((card, index) => { card.querySelector('h4').textContent = items[index].title; });
}

async function archiveAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = state.materials.find(entry => entry.id === button.dataset.id);
  if (!item) return;
  if (button.dataset.action === 'download') return downloadMaterial(item.content, item.title);
  if (button.dataset.action === 'open') {
    state.result = item.content;
    $('#resultText').textContent = item.content;
    $('#modelLabel').textContent = 'Мұрағаттан';
    $('#emptyResult').classList.add('hidden');
    $('#resultContent').classList.remove('hidden');
    showScreen('create');
    return;
  }
  if (button.dataset.action === 'delete' && confirm('Материалды өшіруге сенімдісіз бе?')) {
    try {
      await request(`/api/materials/${item.id}`, { method: 'DELETE' });
      state.materials = state.materials.filter(entry => entry.id !== item.id);
      renderArchive();
      toast('Материал өшірілді');
    } catch (error) { toast(error.message); }
  }
}

function showScreen(screen) {
  $('#createScreen').classList.toggle('hidden', screen !== 'create');
  $('#archiveScreen').classList.toggle('hidden', screen !== 'archive');
  $$('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.screen === screen));
  if (screen === 'archive') loadMaterials();
}

function bind() {
  $('#loginBtn').addEventListener('click', () => openAuth('login'));
  $('#registerBtn').addEventListener('click', () => openAuth('register'));
  $('#heroStart').addEventListener('click', () => openAuth('register'));
  $('#ctaStart').addEventListener('click', () => openAuth('register'));
  $('#closeModal').addEventListener('click', closeAuth);
  $('#authModal').addEventListener('click', event => { if (event.target.id === 'authModal') closeAuth(); });
  $('#switchAuth').addEventListener('click', () => openAuth(state.authMode === 'register' ? 'login' : 'register'));
  $('#authForm').addEventListener('submit', submitAuth);
  $('#logoutBtn').addEventListener('click', logout);
  $('#mobileLogout').addEventListener('click', logout);
  $('#builderForm').addEventListener('submit', generate);
  $('#toolTabs').addEventListener('click', event => { const button = event.target.closest('[data-type]'); if (button) selectTool(button.dataset.type); });
  $$('.nav-item').forEach(item => item.addEventListener('click', () => showScreen(item.dataset.screen)));
  $('#copyBtn').addEventListener('click', () => copyMaterial());
  $('#downloadBtn').addEventListener('click', () => downloadMaterial());
  $('#saveBtn').addEventListener('click', saveMaterial);
  $('#archiveSearch').addEventListener('input', renderArchive);
  $('#archiveList').addEventListener('click', archiveAction);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAuth(); });
}

for (let grade = 1; grade <= 11; grade += 1) $('#grade').insertAdjacentHTML('beforeend', `<option value="${grade}-сынып">${grade}-сынып</option>`);
bind();
loadUser();
