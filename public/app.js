const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();
tg?.setHeaderColor?.('#121d27');
tg?.setBackgroundColor?.('#050505');

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('ru-RU');
const todayKey = () => new Date().toISOString().slice(0, 10);

const defaultState = {
  balance: 2950,
  exp: 733,
  level: 1,
  refs: 0,
  refsReward: 0,
  cashback: 0.5,
  inventory: [],
  history: [],
  completedTasks: {},
  lastDaily: '',
  config: { botUsername: 'StarLucky_bot' }
};

const state = JSON.parse(localStorage.getItem('starlucky:v4') || 'null') || defaultState;

const save = () => localStorage.setItem('starlucky:v4', JSON.stringify(state));

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 1800);
}

function addHistory(title, amount = 0) {
  state.history.unshift({ title, amount, time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) });
  state.history = state.history.slice(0, 12);
}

function gain(amount, reason) {
  state.balance += amount;
  state.exp += Math.max(8, Math.floor(Math.abs(amount) / 4));
  state.level = Math.max(1, Math.floor(state.exp / 1000) + 1);
  state.cashback = Number((0.5 + state.level * 0.1).toFixed(1));
  addHistory(reason, amount);
  save();
  render();
}

function spend(amount) {
  if (state.balance < amount) {
    toast('Недостаточно звезд');
    return false;
  }
  state.balance -= amount;
  addHistory('Списание', -amount);
  save();
  render();
  return true;
}

function weighted(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
}

function showGameResult(title, text) {
  $('gameModalTitle').textContent = title;
  $('gameModalText').textContent = text;
  $('gameModal').classList.add('active');
}

const drops = [
  ['🗡️', '1.2K'], ['💎', '950'], ['🔫', '700'], ['🌟', '500'], ['🧰', '300'], ['🧸', '250'], ['🥷', '400'], ['🔨', '350']
];

const cases = [
  { name: 'Bronze Box', price: 250, min: 60, max: 700, icon: 'B' },
  { name: 'Gold Case', price: 550, min: 120, max: 1500, icon: 'G' },
  { name: 'Lucky Chest', price: 1000, min: 250, max: 3200, icon: 'L' },
  { name: 'Royal Drop', price: 2500, min: 800, max: 9000, icon: 'R' }
];

const tasks = [
  { id: 'visit_profile', title: 'Открыть профиль', reward: 100, hint: 'Зайди во вкладку профиля' },
  { id: 'play_spin', title: 'Сыграть Star Spin', reward: 150, hint: 'Сделай один спин' },
  { id: 'play_color', title: 'Сыграть Color Roulette', reward: 150, hint: 'Сыграй в рулетку цветов' },
  { id: 'open_case', title: 'Открыть любой кейс', reward: 250, hint: 'Открой кейс во вкладке кейсов' },
  { id: 'daily_bonus', title: 'Забрать ежедневный бонус', reward: 120, hint: 'Зайди в бонусы и забери награду' }
];

function setScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === `screen-${name}`));
  document.querySelectorAll('.bottom-nav button').forEach((btn) => btn.classList.toggle('active', btn.dataset.screen === name));
  $('viewport').scrollTo({ top: 0, behavior: 'instant' });
  if (name === 'profile') state.completedTasks.visit_profile = true;
  save();
  render();
}

function claimTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task || state.completedTasks[`claimed_${id}`]) return;
  if (!state.completedTasks[id] && id !== 'visit_profile') {
    toast('Сначала выполни задание');
    return;
  }
  state.completedTasks[`claimed_${id}`] = true;
  gain(task.reward, `Задание: ${task.title}`);
  toast(`+${task.reward} звезд`);
}

function openCase(index) {
  const item = cases[index];
  if (!spend(item.price)) return;
  state.completedTasks.open_case = true;
  const prize = Math.floor(item.min + Math.random() * (item.max - item.min));
  state.inventory.unshift({ name: item.name, value: prize, date: new Date().toLocaleDateString('ru-RU') });
  state.inventory = state.inventory.slice(0, 24);
  gain(prize, item.name);
  showGameResult(item.name, `Ты получил ${fmt(prize)} звезд`);
}

function playSpin() {
  const bet = 100;
  if (!spend(bet)) return;
  state.completedTasks.play_spin = true;
  const result = weighted([
    { x: 0.5, weight: 35 }, { x: 2, weight: 29 }, { x: 2.5, weight: 19 },
    { x: 3, weight: 10 }, { x: 5, weight: 4.5 }, { x: 8, weight: 1.8 }, { x: 10, weight: .7 }
  ]);
  const degrees = 720 + Math.floor(Math.random() * 720);
  $('spinWheel').style.transform = `rotate(${degrees}deg)`;
  $('spinBadge').textContent = `x${result.x}`;
  const win = Math.floor(bet * result.x);
  setTimeout(() => {
    gain(win, `Star Spin x${result.x}`);
    showGameResult('Star Spin', `Множитель x${result.x}. Награда: ${fmt(win)} звезд`);
  }, 500);
}

function playColor() {
  const bet = 100;
  if (!spend(bet)) return;
  state.completedTasks.play_color = true;
  const result = weighted([
    { name: 'Белый', x: 2, weight: 49 }, { name: 'Зеленый', x: 5, weight: 24 },
    { name: 'Синий', x: 8, weight: 14 }, { name: 'Фиолетовый', x: 12, weight: 8 },
    { name: 'Золотой', x: 20, weight: 5 }
  ]);
  const win = Math.floor(bet * result.x);
  gain(win, `Color Roulette ${result.name}`);
  showGameResult('Color Roulette', `${result.name}: x${result.x}. Награда: ${fmt(win)} звезд`);
}

function claimDaily() {
  const today = todayKey();
  if (state.lastDaily === today) {
    toast('Бонус уже забран сегодня');
    return;
  }
  state.lastDaily = today;
  state.completedTasks.daily_bonus = true;
  gain(150, 'Ежедневный бонус');
  toast('+150 звезд');
}

async function copyRef() {
  const username = state.config.botUsername || 'StarLucky_bot';
  const userId = tg?.initDataUnsafe?.user?.id || 'guest';
  const link = `https://t.me/${username.replace('@', '')}?start=ref_${userId}`;
  try {
    await navigator.clipboard.writeText(link);
    toast('Реферальная ссылка скопирована');
  } catch {
    toast(link);
  }
}

function renderDrops() {
  $('dropTape').innerHTML = drops.map(([icon, price]) => `
    <div class="drop"><span class="drop-icon">${icon}</span><b>${price} ★</b></div>
  `).join('');
}

function renderCases() {
  $('casesGrid').innerHTML = cases.map((item, index) => `
    <article class="case-card">
      <div>
        <div class="case-art">${item.icon}</div>
        <h2>${item.name}</h2>
        <p>Цена: ${fmt(item.price)} ★<br>Награда: ${fmt(item.min)}–${fmt(item.max)} ★</p>
      </div>
      <button class="gold-button" data-case="${index}" type="button">Открыть</button>
    </article>
  `).join('');
  document.querySelectorAll('[data-case]').forEach((btn) => btn.onclick = () => openCase(Number(btn.dataset.case)));
}

function renderInventory() {
  if (!state.inventory.length) {
    $('inventoryList').innerHTML = 'Инвентарь пока пустой';
    return;
  }
  $('inventoryList').innerHTML = state.inventory.map((item) => `
    <div class="inv-row"><span>${item.name}<br><small>${item.date}</small></span><b>${fmt(item.value)} ★</b></div>
  `).join('');
}

function renderTasks() {
  $('tasksList').innerHTML = tasks.map((task) => {
    const done = Boolean(state.completedTasks[task.id]);
    const claimed = Boolean(state.completedTasks[`claimed_${task.id}`]);
    return `
      <article class="task-card">
        <div><h2>${task.title}</h2><p>${task.hint}<br>Награда: ${task.reward} ★</p></div>
        <button class="${claimed ? 'dark-button' : 'gold-button'}" data-task="${task.id}" type="button" ${claimed ? 'disabled' : ''}>${claimed ? 'Готово' : done ? 'Забрать' : 'Ждет'}</button>
      </article>
    `;
  }).join('');
  document.querySelectorAll('[data-task]').forEach((btn) => btn.onclick = () => claimTask(btn.dataset.task));
}

function renderHistory() {
  if (!state.history.length) {
    $('historyList').innerHTML = '<span style="color:var(--muted)">Событий пока нет</span>';
    return;
  }
  $('historyList').innerHTML = state.history.map((item) => `
    <div class="history-row"><div>${item.title}<br><span>${item.time}</span></div><strong>${item.amount > 0 ? '+' : ''}${fmt(item.amount)} ★</strong></div>
  `).join('');
}

function render() {
  const user = tg?.initDataUnsafe?.user;
  const name = user?.username || user?.first_name || 'marooowofficial';
  const letter = (name[0] || 'S').toUpperCase();

  $('balanceText').textContent = fmt(state.balance);
  $('profileBalance').textContent = fmt(state.balance);
  $('profileName').textContent = name;
  $('profileAvatar').textContent = letter;
  $('winnerAvatar').textContent = 'A';
  $('winnerWin').textContent = '1500';
  $('refsCount').textContent = state.refs;
  $('refsReward').textContent = fmt(state.refsReward);
  $('cashbackText').textContent = `${state.cashback}%`;
  $('levelText').textContent = state.level;
  $('expText').textContent = fmt(state.exp);
  $('expFill').style.width = `${Math.min(100, (state.exp % 10000) / 100)}%`;

  renderDrops();
  renderCases();
  renderInventory();
  renderTasks();
  renderHistory();
}

async function loadConfig() {
  try {
    const config = await fetch('/api/config', { cache: 'no-store' }).then((r) => r.json());
    state.config = { ...state.config, ...config };
    save();
  } catch {}
}

function bind() {
  document.querySelectorAll('.bottom-nav button').forEach((btn) => btn.addEventListener('click', () => setScreen(btn.dataset.screen)));
  $('openDeposit').onclick = () => $('depositModal').classList.add('active');
  $('depositFromProfile').onclick = () => $('depositModal').classList.add('active');
  $('closeDeposit').onclick = () => $('depositModal').classList.remove('active');
  $('gameModalOk').onclick = () => $('gameModal').classList.remove('active');
  $('depositModal').addEventListener('click', (event) => { if (event.target.id === 'depositModal') $('depositModal').classList.remove('active'); });
  $('gameModal').addEventListener('click', (event) => { if (event.target.id === 'gameModal') $('gameModal').classList.remove('active'); });
  $('playSpin').onclick = playSpin;
  $('playColor').onclick = playColor;
  $('dailyBtn').onclick = claimDaily;
  $('copyRefBtn').onclick = copyRef;
  $('refBtn').onclick = copyRef;

  const amounts = [100, 500, 1000, 2500, 5000, 10000];
  let selected = 1000;
  $('amountGrid').innerHTML = amounts.map((amount) => `<button type="button" class="${amount === selected ? 'active' : ''}" data-amount="${amount}">${fmt(amount)} ★</button>`).join('');
  document.querySelectorAll('[data-amount]').forEach((btn) => {
    btn.onclick = () => {
      selected = Number(btn.dataset.amount);
      document.querySelectorAll('[data-amount]').forEach((item) => item.classList.toggle('active', item === btn));
    };
  });
  $('confirmDeposit').onclick = () => {
    gain(selected, 'Пополнение');
    $('depositModal').classList.remove('active');
    toast(`+${fmt(selected)} звезд`);
  };
}

bind();
loadConfig().then(render);
render();
