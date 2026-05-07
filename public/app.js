const icons = {
  'star-fill': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.7l2.85 5.78 6.38.93-4.62 4.5 1.1 6.35L12 17.26 6.29 20.26l1.1-6.35-4.62-4.5 6.38-.93L12 2.7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.5 13.5l3-3"/><path d="M8.5 16.5l-1 1a4 4 0 1 1-5.7-5.6l3-3a4 4 0 0 1 5.7 0" transform="translate(3 1)"/><path d="M14.5 7.5l1-1a4 4 0 0 1 5.7 5.6l-3 3a4 4 0 0 1-5.7 0" transform="translate(-3 -1)"/></svg>',
  sword: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6-2-2 6L7 19l-3 1 1-3L16 6"/><path d="M9 15l-3-3M6 18l-3-3M13 9l2 2"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-8"/><path d="M14 7h6v6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 10-13h-7l0-7z"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0" stroke-linecap="round"/></svg>',
  gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10h10a4 4 0 0 1 3.8 2.7l1 3A3 3 0 0 1 17 19l-2-2H9l-2 2a3 3 0 0 1-4.8-3.3l1-3A4 4 0 0 1 7 10z"/><path d="M8 13v3M6.5 14.5h3M16 14h.01M18.5 14h.01"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v8H4v-8M2 8h20v4H2zM12 8v12"/><path d="M12 8H7.5a2.5 2.5 0 1 1 2.1-3.8L12 8zm0 0h4.5a2.5 2.5 0 1 0-2.1-3.8L12 8z"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 11a3 3 0 1 0 0-6M17 15a5 5 0 0 1 4 5" stroke-linecap="round"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M18 9l4 4M22 9l-4 4"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1h.1a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.6 1z"/></svg>',
  'arrow-down': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17L17 7M9 7h8v8"/></svg>',
  gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9l4-6z"/><path d="M2 9h20M8 9l4 12 4-12M8 9l4-6 4 6"/></svg>',
  blade: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 12-12 1-4-4 1L5 16l-1 4z"/><path d="M14 6l4 4M5 16l3 3"/></svg>',
  rifle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h11l2-2h5v3h-4l-2 2H8l-2 3H3l2-4H3z"/><path d="M9 12v4M14 12v3"/></svg>',
  cat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 10V5l4 3a8 8 0 0 1 6 0l4-3v5a7 7 0 1 1-14 0z"/><path d="M9 13h.01M15 13h.01M10 17c1.3.8 2.7.8 4 0"/></svg>',
  hammer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 5l6 6M14 4l2-2 6 6-2 2M2 22l9-9 3 3-9 9H2v-3z"/></svg>'
};

const iconFor = (name) => icons[name] || icons['star-fill'];
function injectIcons(scope = document) {
  scope.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = iconFor(el.dataset.icon);
  });
}

const state = {
  config: null,
  token: localStorage.getItem('sl_token') || '',
  user: null,
  drops: [],
  leaderboard: [],
  tasks: [],
  cases: [],
  activeGame: 'spin',
  activeColor: 'white',
  tonConnectUI: null
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function format(n) {
  return Math.floor(Number(n || 0)).toLocaleString('ru-RU');
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

async function api(path, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `request_failed_${res.status}`);
  }
  return data;
}

function getTelegram() {
  return window.Telegram?.WebApp || null;
}

function setupTelegram() {
  const tg = getTelegram();
  if (!tg) return;
  tg.ready?.();
  tg.expand?.();
  tg.setHeaderColor?.('#050506');
  tg.setBackgroundColor?.('#050506');
}

async function loadConfig() {
  state.config = await fetch('/api/config').then(r => r.json());
  document.title = state.config.appName || 'StarLucky';
  $('#botUsername').textContent = `@${state.config.telegramBotUsername || 'starlucky_bot'}`;
}

async function auth() {
  const tg = getTelegram();
  const initData = tg?.initData || '';
  const data = await api('/api/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) });
  state.token = data.token;
  localStorage.setItem('sl_token', data.token);
  state.user = data.user;
}

async function refresh() {
  const data = await api('/api/me');
  state.user = data.user;
  state.drops = data.drops || [];
  state.leaderboard = data.leaderboard || [];
  state.tasks = data.tasks || [];
  state.cases = data.cases || [];
  renderAll();
}

function itemIcon(item) {
  return `<span class="item-svg">${iconFor(item.icon || 'star-fill')}</span>`;
}

function renderUser() {
  if (!state.user) return;
  const u = state.user;
  $('#balanceValue').textContent = format(u.balance);
  $('#profileBalance').textContent = format(u.balance);
  $('#profileName').textContent = u.firstName || u.username || 'StarLucky';
  $('#invitedCount').textContent = format(u.invited);
  $('#refEarned').textContent = `${format(u.referralEarned)} ⭐`;
  $('#levelValue').textContent = u.level;
  $('#passLevel').textContent = u.level;
  $('#cashbackValue').textContent = `${u.cashback}%`;
  $('#inventoryCount').textContent = `${u.inventory?.length || 0} предметов`;
  $('#xpText').textContent = `${format(u.xp)} / ${format(u.xpMax)} EXP`;
  $('#passXp').textContent = `${format(u.xp)} / ${format(u.xpMax)} EXP`;
  const pct = Math.max(0, Math.min(100, (u.xp / u.xpMax) * 100));
  $('#xpProgress').style.width = `${pct}%`;
  const avatar = $('#profileAvatar');
  if (u.avatarUrl) avatar.innerHTML = `<img src="${u.avatarUrl}" alt="">`;
  else avatar.textContent = (u.firstName || u.username || 'S').slice(0, 1).toUpperCase();
  $('#dailyButton').textContent = u.canClaimDaily ? 'Получить ежедневный бонус' : 'Бонус уже забран';
  $('#dailyButton').disabled = !u.canClaimDaily;
}

function renderDrops() {
  const row = $('#dropRow');
  row.innerHTML = state.drops.map((d) => `
    <div class="drop-card ${d.rarity || ''}" title="${d.title}">
      ${itemIcon(d)}
      <small>${format(d.amount)} ${iconFor('star-fill')}</small>
    </div>
  `).join('');
  injectIcons(row);
}

function renderLeaderboard() {
  const lead = state.leaderboard?.[0];
  if (!lead) return;
  $('#leaderAvatar').textContent = (lead.avatar || lead.name || 'A').slice(0, 1).toUpperCase();
  $('#leaderName').textContent = lead.name;
  $('#leaderWhen').textContent = lead.when;
  $('#leaderPrize').textContent = `+${format(lead.prize)} ⭐`;
}

function renderCases() {
  const grid = $('#caseGrid');
  grid.innerHTML = state.cases.map((c) => `
    <article class="case-card">
      <h3>${c.title}</h3>
      <p>Внутренние предметы и бонусные звёзды</p>
      <div class="case-visual">${iconFor('box')}</div>
      <button type="button" data-open-case="${c.id}">Открыть за ${format(c.cost)} ⭐</button>
    </article>
  `).join('');
  const inv = $('#inventoryRow');
  const items = state.user?.inventory || [];
  inv.innerHTML = items.slice(0, 9).map((item) => `
    <div class="inv-item ${item.rarity || ''}">
      ${itemIcon(item)}
      <small>${item.title}<br>${format(item.amount)} ⭐</small>
    </div>
  `).join('') || '<p class="muted">Пока пусто.</p>';
  injectIcons(grid);
  injectIcons(inv);
}

function renderTasks() {
  const list = $('#tasksList');
  const claimed = new Set(state.user?.claimedTasks || []);
  list.innerHTML = state.tasks.map((t) => `
    <article class="task-card">
      <div class="task-icon">${iconFor(t.id === 'join-channel' ? 'link' : t.id === 'invite-friend' ? 'users' : 'star-fill')}</div>
      <div><h3>${t.title}</h3><p>${t.description}</p></div>
      <button type="button" class="${claimed.has(t.id) ? 'claimed' : ''}" data-claim-task="${t.id}">${claimed.has(t.id) ? 'Забрано' : `+${t.reward} ⭐`}</button>
    </article>
  `).join('');
  injectIcons(list);
}

function renderAll() {
  renderUser();
  renderDrops();
  renderLeaderboard();
  renderCases();
  renderTasks();
}

function switchView(view) {
  $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
  $$('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.nav === view));
  const shell = $('.app-shell');
  shell.scrollTo?.({ top: 0, behavior: 'smooth' });
}

function openModal(id) {
  const modal = $(id);
  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');
}
function closeModals() {
  $$('.modal').forEach((m) => {
    m.classList.remove('show');
    m.setAttribute('aria-hidden', 'true');
  });
}

function openGame(game) {
  state.activeGame = game;
  $('#resultBox').textContent = '';
  if (game === 'spin') {
    $('#gameTitle').textContent = 'Star Spin';
    $('#gameSubtitle').textContent = 'Крути колесо множителей внутренними звёздами.';
    $('#gameDynamic').innerHTML = `<div class="spin-preview" id="spinPreview"><b>${iconFor('star-fill')}</b></div>`;
  } else {
    $('#gameTitle').textContent = 'Color Roulette';
    $('#gameSubtitle').textContent = 'Выбери цвет: чем выше x, тем ниже шанс выпадения.';
    const colors = [
      ['white', 'Белый x2', '#f8fafc'],
      ['green', 'Зелёный x5', '#22c55e'],
      ['blue', 'Синий x8', '#2563eb'],
      ['purple', 'Фиолет x12', '#a855f7'],
      ['gold', 'Золото x20', '#ffc55f'],
      ['black', 'Чёрный x0', '#111827']
    ];
    $('#gameDynamic').innerHTML = `<div class="color-picker">${colors.map(([id, label, color]) => `
      <button type="button" class="color-choice ${id === state.activeColor ? 'active' : ''}" data-color="${id}"><span class="color-dot" style="background:${color}"></span>${label}</button>
    `).join('')}</div>`;
  }
  injectIcons($('#gameDynamic'));
  openModal('#gameModal');
}

async function runGame() {
  const bet = Number($('#betInput').value || 0);
  $('#runGameButton').disabled = true;
  $('#resultBox').textContent = 'Считаем результат...';
  try {
    if (state.activeGame === 'spin') {
      const wheel = $('#spinPreview');
      if (wheel) wheel.style.transform = `rotate(${720 + Math.random() * 720}deg)`;
      const data = await api('/api/games/spin', { method: 'POST', body: JSON.stringify({ bet }) });
      state.user = data.user;
      state.leaderboard = data.leaderboard || state.leaderboard;
      setTimeout(() => {
        $('#resultBox').innerHTML = `<b>${data.result.label}</b> · выплата ${format(data.result.payout)} ⭐`;
        renderAll();
      }, 850);
    } else {
      const data = await api('/api/games/color', { method: 'POST', body: JSON.stringify({ bet, color: state.activeColor }) });
      state.user = data.user;
      state.leaderboard = data.leaderboard || state.leaderboard;
      $('#resultBox').innerHTML = `${data.isWin ? 'Поймал!' : 'Не попал'} Выпал <b>${data.landed.label} x${data.landed.multiplier}</b>. Выплата ${format(data.payout)} ⭐`;
      renderAll();
    }
  } catch (e) {
    $('#resultBox').textContent = e.message === 'bad_bet' ? 'Проверь ставку и баланс.' : `Ошибка: ${e.message}`;
  } finally {
    setTimeout(() => { $('#runGameButton').disabled = false; }, 900);
  }
}

async function openCase(caseId) {
  try {
    const data = await api('/api/cases/open', { method: 'POST', body: JSON.stringify({ caseId }) });
    state.user = data.user;
    state.drops = data.drops || state.drops;
    toast(`Выпало: ${data.reward.title} · ${format(data.reward.amount)} ⭐`);
    renderAll();
  } catch (e) {
    toast(e.message === 'not_enough_balance' ? 'Не хватает звёзд на кейс.' : `Ошибка: ${e.message}`);
  }
}

async function claimTask(taskId) {
  try {
    const data = await api('/api/tasks/claim', { method: 'POST', body: JSON.stringify({ taskId }) });
    state.user = data.user;
    toast(`Задание выполнено: +${data.task.reward} ⭐`);
    renderAll();
  } catch (e) {
    toast(e.message === 'task_already_claimed' ? 'Уже забрано.' : `Ошибка: ${e.message}`);
  }
}

async function claimDaily() {
  try {
    const data = await api('/api/bonus/daily', { method: 'POST' });
    state.user = data.user;
    toast(`Ежедневный бонус: +${data.reward} ⭐`);
    renderAll();
  } catch (e) {
    toast('Ежедневный бонус пока на кулдауне.');
  }
}

async function mockTopup() {
  try {
    const data = await api('/api/topup/mock', { method: 'POST', body: JSON.stringify({ amount: 500 }) });
    state.user = data.user;
    toast('+500 ⭐ начислено для теста');
    renderAll();
  } catch (e) { toast(`Ошибка: ${e.message}`); }
}

async function tonTopup(amountTon) {
  if (!state.config?.tonReceiverWallet) {
    toast('Сначала укажи PUBLIC_TON_RECEIVER_WALLET в Railway.');
    return;
  }
  try {
    const intent = await api('/api/topup/ton-intent', { method: 'POST', body: JSON.stringify({ amountTon }) });
    if (!state.tonConnectUI) {
      toast('TON Connect UI не загрузился.');
      return;
    }
    await state.tonConnectUI.sendTransaction({
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [{
        address: intent.receiver,
        amount: intent.amountNano,
        payload: undefined
      }]
    });
    toast(`Транзакция отправлена. Комментарий для сверки: ${intent.payload}`);
  } catch (e) {
    toast(`TON: ${e.message || 'отменено'}`);
  }
}

function setupTonConnect() {
  if (!window.TON_CONNECT_UI || !state.config?.tonManifestUrl) return;
  try {
    state.tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
      manifestUrl: state.config.tonManifestUrl,
      buttonRootId: 'ton-connect'
    });
  } catch (e) {
    console.warn('TON Connect init failed', e);
  }
}

function bindEvents() {
  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) switchView(nav.dataset.nav);

    const viewLink = e.target.closest('[data-view-link]');
    if (viewLink) { e.preventDefault(); switchView(viewLink.dataset.viewLink); }

    const openGameBtn = e.target.closest('[data-open-game]');
    if (openGameBtn) openGame(openGameBtn.dataset.openGame);

    if (e.target.closest('[data-open-topup]')) openModal('#topupModal');
    if (e.target.closest('[data-close-modal]') || e.target.classList.contains('modal')) closeModals();

    const quickBet = e.target.closest('[data-bet]');
    if (quickBet) $('#betInput').value = quickBet.dataset.bet;

    const colorBtn = e.target.closest('[data-color]');
    if (colorBtn) {
      state.activeColor = colorBtn.dataset.color;
      $$('.color-choice').forEach(b => b.classList.toggle('active', b === colorBtn));
    }

    const caseBtn = e.target.closest('[data-open-case]');
    if (caseBtn) openCase(caseBtn.dataset.openCase);

    const taskBtn = e.target.closest('[data-claim-task]');
    if (taskBtn) claimTask(taskBtn.dataset.claimTask);

    const mode = e.target.closest('[data-mode]');
    if (mode) {
      $$('.mode-tabs button').forEach(b => b.classList.toggle('active', b === mode));
      toast(mode.dataset.mode === 'arcade' ? 'Arcade открыт' : 'Раздел скоро будет расширен');
    }

    const hint = e.target.closest('[data-toast]');
    if (hint) toast(hint.dataset.toast);

    const tonBtn = e.target.closest('[data-ton]');
    if (tonBtn) tonTopup(Number(tonBtn.dataset.ton));
  });

  $('#runGameButton').addEventListener('click', runGame);
  $('#dailyButton').addEventListener('click', claimDaily);
  $('#mockTopupButton').addEventListener('click', mockTopup);
  $('#refButton').addEventListener('click', async () => {
    const username = state.config?.telegramBotUsername || 'starlucky_bot';
    const link = `https://t.me/${username}?start=ref_${state.user?.id || 'guest'}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Реферальная ссылка скопирована');
    } catch {
      toast(link);
    }
  });
}

function deviceClass() {
  const tg = getTelegram();
  const platform = tg?.platform || '';
  const wide = window.matchMedia('(min-width: 760px)').matches;
  document.body.classList.toggle('is-desktop', wide || platform === 'tdesktop' || platform === 'web');
}

async function boot() {
  injectIcons();
  deviceClass();
  window.addEventListener('resize', deviceClass);
  setupTelegram();
  bindEvents();
  try {
    await loadConfig();
    await auth();
    await refresh();
    setupTonConnect();
  } catch (e) {
    console.error(e);
    toast(`Ошибка запуска: ${e.message}`);
  }
}

boot();
