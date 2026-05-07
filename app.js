const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  balance: Number(localStorage.getItem('sv_balance') || 1250),
  selectedColor: 'white',
  selectedAmount: 250,
  lastSpinDeg: 0,
  wallet: null,
  gifts: [
    { name: 'Crystal Star', type: 'gift' },
    { name: 'Neon Pass', type: 'nft' },
    { name: 'Vault Ticket', type: 'gift' }
  ]
};

const colorOptions = [
  { id: 'white', label: 'White', x: 2, chance: 38, color: '#f8fafc' },
  { id: 'green', label: 'Green', x: 5, chance: 22, color: '#22c55e' },
  { id: 'cyan', label: 'Cyan', x: 8, chance: 14, color: '#22d3ee' },
  { id: 'violet', label: 'Violet', x: 10, chance: 10, color: '#8b5cf6' },
  { id: 'gold', label: 'Gold', x: 15, chance: 6, color: '#f59e0b' },
  { id: 'ruby', label: 'Ruby', x: 20, chance: 3, color: '#e11d48' },
  { id: 'void', label: 'Void', x: 0, chance: 7, color: '#111827' }
];

const spinOptions = [
  { x: 0, chance: 26 },
  { x: 1.2, chance: 25 },
  { x: 1.5, chance: 18 },
  { x: 2, chance: 13 },
  { x: 3, chance: 8 },
  { x: 5, chance: 5 },
  { x: 10, chance: 3 },
  { x: 20, chance: 2 }
];

const icons = {
  gift: '<svg viewBox="0 0 24 24"><path d="M20.4 7.2h-2.1c.2-.5.3-1 .3-1.5A3.7 3.7 0 0 0 12 3.4 3.7 3.7 0 0 0 5.4 5.7c0 .5.1 1 .3 1.5H3.6A1.6 1.6 0 0 0 2 8.8V12h20V8.8a1.6 1.6 0 0 0-1.6-1.6ZM9.1 7.2A1.5 1.5 0 1 1 10.6 5.7v1.5H9.1Zm4.3 0V5.7a1.5 1.5 0 1 1 1.5 1.5h-1.5ZM3.6 13.6v5.8A2.6 2.6 0 0 0 6.2 22h4.6v-8.4H3.6Zm9.6 0V22h4.6a2.6 2.6 0 0 0 2.6-2.6v-5.8h-7.2Z"/></svg>',
  nft: '<svg viewBox="0 0 24 24"><path d="m12 2 8.7 5v10L12 22l-8.7-5V7L12 2Zm0 2.8L5.7 8.4v7.2l6.3 3.6 6.3-3.6V8.4L12 4.8Zm0 3.4 3.3 1.9v3.8L12 15.8l-3.3-1.9v-3.8L12 8.2Z"/></svg>',
  task: '<svg viewBox="0 0 24 24"><path d="M9.1 16.2 5.8 13l-1.6 1.6 4.9 4.8L20 8.5 18.4 7 9.1 16.2ZM4 5.2h11V3H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-2.2v5H4V5.2Z"/></svg>',
  case: '<svg viewBox="0 0 24 24"><path d="M8 5.2A3.2 3.2 0 0 1 11.2 2h1.6A3.2 3.2 0 0 1 16 5.2V6h3.4A2.6 2.6 0 0 1 22 8.6v9.8a2.6 2.6 0 0 1-2.6 2.6H4.6A2.6 2.6 0 0 1 2 18.4V8.6A2.6 2.6 0 0 1 4.6 6H8v-.8Zm2.2.8h3.6v-.8a1 1 0 0 0-1-1h-1.6a1 1 0 0 0-1 1V6Zm-6 5.2v2.1h15.6v-2.1H4.2Z"/></svg>'
};

function saveBalance() {
  localStorage.setItem('sv_balance', String(state.balance));
  $('#balanceValue').textContent = state.balance.toLocaleString('ru-RU');
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  setTimeout(() => node.classList.remove('show'), 2500);
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.chance, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.chance;
    if (roll <= 0) return item;
  }
  return items[0];
}

function settleBet(bet, multiplier) {
  if (!Number.isFinite(bet) || bet <= 0) return { ok: false, message: 'Некорректная ставка.' };
  if (bet > state.balance) return { ok: false, message: 'Не хватает демо-SV.' };
  state.balance -= bet;
  const win = Math.floor(bet * multiplier);
  state.balance += win;
  saveBalance();
  return { ok: true, win, profit: win - bet };
}

function initTelegram() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return;
  tg.ready();
  tg.expand();
  document.documentElement.style.setProperty('--tg-bg-color', tg.themeParams?.bg_color || '#080b18');
  const user = tg.initDataUnsafe?.user;
  if (user) $('#userName').textContent = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Игрок Telegram';
}

function initDevice() {
  const isDesktop = matchMedia('(min-width: 861px)').matches;
  $('#appShell').classList.toggle('desktop', isDesktop);
  $('#appShell').classList.toggle('mobile', !isDesktop);
  $('#deviceLabel').textContent = isDesktop ? 'Desktop layout' : 'Mobile layout';
}

function initTabs() {
  const mobile = $('.mobile-tabs');
  mobile.innerHTML = $('.desktop-tabs').innerHTML;
  const allTabs = $$('.tab');
  allTabs.forEach(tab => tab.addEventListener('click', () => {
    const id = tab.dataset.tab;
    $$('.tab').forEach(x => x.classList.toggle('active', x.dataset.tab === id));
    $$('.page').forEach(x => x.classList.toggle('active', x.id === id));
    $('#pageTitle').textContent = tab.textContent.trim();
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  }));
}

function initGifts() {
  $('#giftRow').innerHTML = state.gifts.map(gift => `
    <div class="gift-pill">${icons[gift.type]}<span>${gift.name}</span></div>
  `).join('');
}

function initColorBoard() {
  $('#colorBoard').innerHTML = colorOptions.map(item => `
    <button class="color-choice ${item.id === state.selectedColor ? 'active' : ''}" data-color="${item.id}">
      <span class="color-chip" style="background:${item.color}"></span>
      <span><strong>${item.label} x${item.x}</strong><small>chance ${item.chance}%</small></span>
    </button>
  `).join('');
  $$('.color-choice').forEach(btn => btn.addEventListener('click', () => {
    state.selectedColor = btn.dataset.color;
    $$('.color-choice').forEach(x => x.classList.toggle('active', x.dataset.color === state.selectedColor));
  }));
}

function initCases() {
  const cases = [
    { title: 'Neon Case', text: 'Демо-пул: фреймы, бейджи, пропуски.' },
    { title: 'Crystal Case', text: 'Визуальный пример выпадения редких предметов.' },
    { title: 'Creator Case', text: 'Может стать витриной легальных цифровых товаров.' }
  ];
  $('#caseGrid').innerHTML = cases.map(item => `
    <article class="case-card">
      <div class="case-icon">${icons.case}</div>
      <h3>${item.title}</h3>
      <p>${item.text}</p>
      <button class="ghost open-case">Открыть</button>
    </article>
  `).join('');
  $$('.open-case').forEach(btn => btn.addEventListener('click', openDemoCase));
  $('#openCaseBtn').addEventListener('click', openDemoCase);
}

function openDemoCase() {
  const drops = ['Crystal Star', 'Neon Profile Frame', 'Vault Pass', 'Silver Ticket', 'Creator Badge'];
  const drop = drops[Math.floor(Math.random() * drops.length)];
  state.gifts.unshift({ name: drop, type: Math.random() > 0.5 ? 'nft' : 'gift' });
  state.gifts = state.gifts.slice(0, 6);
  initGifts();
  toast(`Демо-кейс открыт: ${drop}`);
}

function initTasks() {
  const tasks = [
    { title: 'Подключить TON Wallet', text: 'Только подключение, без списания средств.', reward: 80 },
    { title: 'Открыть демо-кейс', text: 'Получить тестовый предмет в коллекцию.', reward: 40 },
    { title: 'Сыграть в Color Roulette', text: 'Запустить одну демо-сессию.', reward: 25 },
    { title: 'Проверить Fair Play', text: 'Раздел для лицензии, RNG-аудита и правил.', reward: 100 }
  ];
  $('#tasksList').innerHTML = tasks.map(task => `
    <article class="task">
      <div class="task-icon">${icons.task}</div>
      <div><h3>${task.title}</h3><p>${task.text}</p></div>
      <button class="primary task-claim" data-reward="${task.reward}">+${task.reward} SV</button>
    </article>
  `).join('');
  $$('.task-claim').forEach(btn => btn.addEventListener('click', () => {
    const reward = Number(btn.dataset.reward);
    state.balance += reward;
    saveBalance();
    btn.disabled = true;
    btn.textContent = 'Забрано';
    toast(`Начислено ${reward} демо-SV`);
  }));
}

function initGames() {
  $('#spinBtn').addEventListener('click', () => {
    const bet = Number($('#spinBet').value);
    const picked = weightedPick(spinOptions);
    const result = settleBet(bet, picked.x);
    if (!result.ok) return toast(result.message);
    const index = spinOptions.findIndex(x => x.x === picked.x);
    state.lastSpinDeg += 1440 + (360 - (index * 45 + 22));
    $('#spinWheel').style.transform = `rotate(${state.lastSpinDeg}deg)`;
    $('#spinResult').textContent = picked.x === 0
      ? `Выпал x0. Демо-проигрыш: ${bet} SV.`
      : `Выпал x${picked.x}. Начислено ${result.win} SV, результат ${result.profit >= 0 ? '+' : ''}${result.profit} SV.`;
  });

  $('#colorBtn').addEventListener('click', () => {
    const bet = Number($('#colorBet').value);
    const target = colorOptions.find(x => x.id === state.selectedColor);
    const picked = weightedPick(colorOptions);
    const multiplier = picked.id === target.id ? target.x : 0;
    const result = settleBet(bet, multiplier);
    if (!result.ok) return toast(result.message);
    $('#colorResult').textContent = picked.id === target.id
      ? `Попал ${picked.label}: x${target.x}. Начислено ${result.win} SV.`
      : `Выпал ${picked.label}. Ставка была на ${target.label}, демо-проигрыш ${bet} SV.`;
    $$('.color-choice').forEach(x => x.animate([
      { transform: 'scale(1)' },
      { transform: x.dataset.color === picked.id ? 'scale(1.04)' : 'scale(.98)' },
      { transform: 'scale(1)' }
    ], { duration: 420, easing: 'ease' }));
  });
}

function initBonuses() {
  $$('[data-bonus]').forEach(btn => btn.addEventListener('click', () => {
    const type = btn.dataset.bonus;
    if (type === 'fair') return toast('В проде сюда добавляют лицензию, правила, RNG-аудит, KYC/AML и responsible gaming.');
    if (type === 'wallet' && !state.wallet) return toast('Сначала подключи TON Wallet.');
    const amount = type === 'wallet' ? 120 : 60;
    state.balance += amount;
    saveBalance();
    btn.disabled = true;
    btn.textContent = 'Забрано';
    toast(`Бонус ${amount} демо-SV начислен`);
  }));
}

function initDeposit() {
  const modal = $('#depositModal');
  $('#depositBtn').addEventListener('click', () => modal.showModal());
  $('#closeDeposit').addEventListener('click', () => modal.close());
  $('#amounts').innerHTML = [250, 500, 1000].map(amount => `<button class="amount ${amount === state.selectedAmount ? 'active' : ''}" data-amount="${amount}">${amount} SV</button>`).join('');
  $$('.amount').forEach(btn => btn.addEventListener('click', () => {
    state.selectedAmount = Number(btn.dataset.amount);
    $$('.amount').forEach(x => x.classList.toggle('active', x.dataset.amount === String(state.selectedAmount)));
  }));
  $('#demoTopup').addEventListener('click', () => {
    state.balance += state.selectedAmount;
    saveBalance();
    modal.close();
    toast(`Начислено ${state.selectedAmount} демо-SV`);
  });
  $('#claimGiftBtn').addEventListener('click', openDemoCase);
}

function initTonConnect() {
  if (!window.TON_CONNECT_UI) {
    $('#walletState').textContent = 'TON Connect SDK не загрузился. Открой через HTTPS-домен.';
    return;
  }
  try {
    const tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
      manifestUrl: `${location.origin}${location.pathname.replace(/\/[^/]*$/, '/') }tonconnect-manifest.json`,
      buttonRootId: 'ton-connect'
    });
    tonConnectUI.onStatusChange(wallet => {
      state.wallet = wallet;
      $('#walletState').textContent = wallet?.account?.address
        ? `Подключён: ${wallet.account.address.slice(0, 6)}...${wallet.account.address.slice(-6)}`
        : 'Кошелёк не подключён';
    });
  } catch (error) {
    $('#walletState').textContent = 'TON Connect требует HTTPS и корректный manifestUrl.';
    console.warn(error);
  }
}

function boot() {
  initTelegram();
  initDevice();
  initTabs();
  initGifts();
  initColorBoard();
  initCases();
  initTasks();
  initGames();
  initBonuses();
  initDeposit();
  initTonConnect();
  saveBalance();
  addEventListener('resize', initDevice);
}

boot();
