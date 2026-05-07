import express from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'db.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
}));

const defaultDb = () => ({
  users: {},
  drops: [
    { title: 'Gold Blade', amount: 1200, icon: 'blade', rarity: 'legendary' },
    { title: 'Dark Orchid', amount: 950, icon: 'gem', rarity: 'epic' },
    { title: 'Neo Rifle', amount: 700, icon: 'rifle', rarity: 'rare' },
    { title: 'Star Core', amount: 500, icon: 'star', rarity: 'legendary' },
    { title: 'Gold Case', amount: 300, icon: 'case', rarity: 'rare' },
    { title: 'Lucky Cat', amount: 250, icon: 'cat', rarity: 'common' },
    { title: 'Shadow Bot', amount: 400, icon: 'bot', rarity: 'epic' },
    { title: 'Gravity Hammer', amount: 350, icon: 'hammer', rarity: 'rare' }
  ],
  leaderboard: [
    { name: 'Алексей', avatar: 'A', prize: 1500, when: 'Сегодня' },
    { name: 'Максим', avatar: 'M', prize: 980, when: 'Вчера' },
    { name: 'marooow', avatar: 'M', prize: 720, when: 'Сегодня' }
  ],
  pendingTon: {}
});

async function ensureDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(defaultDb(), null, 2));
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const fresh = defaultDb();
    await writeDb(fresh);
    return fresh;
  }
}

async function writeDb(db) {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function now() { return Date.now(); }

function publicConfig() {
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
  return {
    appName: process.env.PUBLIC_APP_NAME || 'StarLucky',
    mode: process.env.PUBLIC_MODE || 'production',
    baseUrl,
    telegramBotUsername: process.env.PUBLIC_TG_BOT_USERNAME || 'starlucky_bot',
    channelUrl: process.env.PUBLIC_CHANNEL_URL || 'https://t.me/starlucky_channel',
    supportUrl: process.env.PUBLIC_SUPPORT_URL || 'https://t.me/starlucky_support',
    tonManifestUrl: process.env.PUBLIC_TON_MANIFEST_URL || `${baseUrl}/tonconnect-manifest.json`,
    tonReceiverWallet: process.env.PUBLIC_TON_RECEIVER_WALLET || '',
    internalCurrency: 'stars',
    safeEconomyNotice: 'Внутренний баланс без вывода и обмена на деньги.'
  };
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signJwt(payload) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const body = { ...payload, exp };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const sig = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${sig}`;
}

function verifyJwt(token) {
  const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
  if (!token || !token.includes('.')) return null;
  const [h, p, s] = token.split('.');
  const unsigned = `${h}.${p}`;
  const expected = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function parseTelegramInitData(initData) {
  const params = new URLSearchParams(initData || '');
  const userRaw = params.get('user');
  if (!userRaw) return null;
  try { return JSON.parse(userRaw); } catch { return null; }
}

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash));
  } catch {
    return false;
  }
}

function normalizeUser(tgUser) {
  if (!tgUser) {
    return {
      id: 'guest-local',
      tgId: null,
      username: 'guest',
      firstName: 'Star',
      lastName: 'Lucky',
      avatarUrl: '',
      isGuest: true
    };
  }
  return {
    id: `tg_${tgUser.id}`,
    tgId: tgUser.id,
    username: tgUser.username || `${tgUser.first_name || 'user'}${tgUser.id}`,
    firstName: tgUser.first_name || 'Player',
    lastName: tgUser.last_name || '',
    avatarUrl: tgUser.photo_url || '',
    isGuest: false
  };
}

function defaultUser(user) {
  return {
    id: user.id,
    tgId: user.tgId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    balance: Number(process.env.START_BALANCE || 2450),
    level: 0,
    xp: 733,
    xpMax: 10000,
    invited: 0,
    referralEarned: 0,
    cashback: 0.5,
    gamesPlayed: 0,
    totalWon: 0,
    inventory: [
      { id: crypto.randomUUID(), title: 'Starter Star', icon: 'star', rarity: 'common', amount: 50 }
    ],
    claimedTasks: [],
    lastDailyClaim: 0,
    createdAt: now(),
    updatedAt: now()
  };
}

async function getOrCreateUser(db, user) {
  const id = user.id;
  if (!db.users[id]) db.users[id] = defaultUser(user);
  db.users[id] = { ...db.users[id], ...user, updatedAt: now() };
  return db.users[id];
}

function requireAuth(req, res, next) {
  const auth = req.header('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const payload = verifyJwt(token);
  if (!payload?.uid) return res.status(401).json({ ok: false, error: 'unauthorized' });
  req.userId = payload.uid;
  next();
}

function clampBet(value, balance) {
  const bet = Math.floor(Number(value || 0));
  if (!Number.isFinite(bet) || bet <= 0) return 0;
  return Math.max(10, Math.min(bet, Math.max(0, balance), 5000));
}

function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = Math.random() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    balance: user.balance,
    level: user.level,
    xp: user.xp,
    xpMax: user.xpMax,
    invited: user.invited,
    referralEarned: user.referralEarned,
    cashback: user.cashback,
    gamesPlayed: user.gamesPlayed,
    totalWon: user.totalWon,
    inventory: user.inventory,
    claimedTasks: user.claimedTasks,
    canClaimDaily: now() - (user.lastDailyClaim || 0) > 1000 * 60 * 60 * 20
  };
}

const tasks = [
  { id: 'join-channel', title: 'Подпишись на канал', description: '+150 ⭐ за вступление в канал', reward: 150, type: 'link' },
  { id: 'open-first-case', title: 'Открой первый кейс', description: '+120 ⭐ за первый кейс', reward: 120, type: 'action' },
  { id: 'play-spin', title: 'Сыграй в Star Spin', description: '+100 ⭐ после первой игры', reward: 100, type: 'action' },
  { id: 'invite-friend', title: 'Пригласи друга', description: '+250 ⭐ за приглашение', reward: 250, type: 'action' }
];

const cases = [
  {
    id: 'gold-case',
    title: 'Gold Case',
    cost: 300,
    accent: 'gold',
    rewards: [
      { title: 'Star Dust', amount: 80, icon: 'star', rarity: 'common', weight: 45 },
      { title: 'Lucky Cat', amount: 250, icon: 'cat', rarity: 'rare', weight: 25 },
      { title: 'Dark Orchid', amount: 950, icon: 'gem', rarity: 'epic', weight: 8 },
      { title: 'Golden Blade', amount: 1200, icon: 'blade', rarity: 'legendary', weight: 2 }
    ]
  },
  {
    id: 'neon-case',
    title: 'Neon Case',
    cost: 600,
    accent: 'neon',
    rewards: [
      { title: 'Pulse Token', amount: 180, icon: 'star', rarity: 'common', weight: 42 },
      { title: 'Neo Rifle', amount: 700, icon: 'rifle', rarity: 'rare', weight: 22 },
      { title: 'Shadow Bot', amount: 400, icon: 'bot', rarity: 'epic', weight: 12 },
      { title: 'Star Core', amount: 1500, icon: 'star', rarity: 'legendary', weight: 2 }
    ]
  }
];

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/config', (req, res) => res.json(publicConfig()));
app.get('/tonconnect-manifest.json', (req, res) => {
  const cfg = publicConfig();
  res.json({
    url: cfg.baseUrl,
    name: cfg.appName,
    iconUrl: `${cfg.baseUrl}/icon.png`
  });
});

app.post('/api/auth/telegram', async (req, res) => {
  const { initData } = req.body || {};
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const strict = String(process.env.REQUIRE_TELEGRAM_AUTH || 'false') === 'true';
  const isValid = initData && botToken ? verifyTelegramInitData(initData, botToken) : false;
  if (strict && !isValid) return res.status(401).json({ ok: false, error: 'invalid_telegram_init_data' });

  const tgUser = isValid ? parseTelegramInitData(initData) : parseTelegramInitData(initData) || null;
  const user = normalizeUser(tgUser);
  const db = await readDb();
  const record = await getOrCreateUser(db, user);
  await writeDb(db);

  const token = signJwt({ uid: record.id, username: record.username });
  res.json({ ok: true, token, user: publicUser(record), verified: Boolean(isValid) });
});

app.get('/api/me', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users[req.userId];
  if (!user) return res.status(404).json({ ok: false, error: 'user_not_found' });
  res.json({ ok: true, user: publicUser(user), drops: db.drops, leaderboard: db.leaderboard, tasks, cases: cases.map(c => ({ id: c.id, title: c.title, cost: c.cost, accent: c.accent })) });
});

app.post('/api/topup/mock', requireAuth, async (req, res) => {
  const amount = Math.max(1, Math.min(100000, Math.floor(Number(req.body.amount || 0))));
  const db = await readDb();
  const user = db.users[req.userId];
  user.balance += amount;
  user.updatedAt = now();
  await writeDb(db);
  res.json({ ok: true, credited: amount, user: publicUser(user) });
});

app.post('/api/topup/ton-intent', requireAuth, async (req, res) => {
  const amountTon = Math.max(0.01, Math.min(1000, Number(req.body.amountTon || 0.1)));
  const db = await readDb();
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = `SL:${req.userId}:${nonce}`;
  db.pendingTon[nonce] = { userId: req.userId, amountTon, payload, status: 'created', createdAt: now() };
  await writeDb(db);
  res.json({ ok: true, nonce, payload, amountNano: String(Math.floor(amountTon * 1e9)), receiver: publicConfig().tonReceiverWallet });
});

app.post('/api/games/spin', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users[req.userId];
  const bet = clampBet(req.body.bet, user.balance);
  if (!bet) return res.status(400).json({ ok: false, error: 'bad_bet' });

  const segments = [
    { label: 'x0', multiplier: 0, weight: 22 },
    { label: 'x0.5', multiplier: 0.5, weight: 20 },
    { label: 'x1', multiplier: 1, weight: 18 },
    { label: 'x2', multiplier: 2, weight: 16 },
    { label: 'x2.5', multiplier: 2.5, weight: 10 },
    { label: 'x3', multiplier: 3, weight: 8 },
    { label: 'x5', multiplier: 5, weight: 4 },
    { label: 'x8', multiplier: 8, weight: 1.5 },
    { label: 'x10', multiplier: 10, weight: 0.5 }
  ];
  const result = weightedPick(segments);
  const payout = Math.floor(bet * result.multiplier);
  user.balance = user.balance - bet + payout;
  user.gamesPlayed += 1;
  user.totalWon += Math.max(0, payout - bet);
  user.xp = Math.min(user.xpMax, user.xp + Math.ceil(bet / 10));
  user.updatedAt = now();

  if (payout >= 500) {
    db.leaderboard.unshift({ name: user.firstName || user.username, avatar: (user.firstName || user.username || 'S')[0], prize: payout, when: 'Только что' });
    db.leaderboard = db.leaderboard.slice(0, 12);
  }
  await writeDb(db);
  res.json({ ok: true, game: 'spin', bet, result: { label: result.label, multiplier: result.multiplier, payout }, user: publicUser(user), leaderboard: db.leaderboard });
});

app.post('/api/games/color', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users[req.userId];
  const bet = clampBet(req.body.bet, user.balance);
  const selected = String(req.body.color || 'white');
  if (!bet) return res.status(400).json({ ok: false, error: 'bad_bet' });
  const colors = [
    { color: 'white', label: 'Белый', multiplier: 2, weight: 45 },
    { color: 'green', label: 'Зелёный', multiplier: 5, weight: 20 },
    { color: 'blue', label: 'Синий', multiplier: 8, weight: 14 },
    { color: 'purple', label: 'Фиолетовый', multiplier: 12, weight: 8 },
    { color: 'gold', label: 'Золотой', multiplier: 20, weight: 3 },
    { color: 'black', label: 'Чёрный', multiplier: 0, weight: 10 }
  ];
  const landed = weightedPick(colors);
  const isWin = selected === landed.color;
  const payout = isWin ? Math.floor(bet * landed.multiplier) : 0;
  user.balance = user.balance - bet + payout;
  user.gamesPlayed += 1;
  user.totalWon += Math.max(0, payout - bet);
  user.xp = Math.min(user.xpMax, user.xp + Math.ceil(bet / 8));
  user.updatedAt = now();
  if (payout >= 500) {
    db.leaderboard.unshift({ name: user.firstName || user.username, avatar: (user.firstName || user.username || 'S')[0], prize: payout, when: 'Только что' });
    db.leaderboard = db.leaderboard.slice(0, 12);
  }
  await writeDb(db);
  res.json({ ok: true, game: 'color', bet, selected, landed, payout, isWin, user: publicUser(user), leaderboard: db.leaderboard });
});

app.post('/api/cases/open', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users[req.userId];
  const pack = cases.find(c => c.id === req.body.caseId) || cases[0];
  if (user.balance < pack.cost) return res.status(400).json({ ok: false, error: 'not_enough_balance' });
  user.balance -= pack.cost;
  const reward = weightedPick(pack.rewards);
  const item = { id: crypto.randomUUID(), title: reward.title, amount: reward.amount, icon: reward.icon, rarity: reward.rarity, openedAt: now() };
  user.inventory.unshift(item);
  user.balance += Math.floor(reward.amount * 0.1);
  user.xp = Math.min(user.xpMax, user.xp + 80);
  user.updatedAt = now();
  db.drops.unshift({ title: item.title, amount: item.amount, icon: item.icon, rarity: item.rarity });
  db.drops = db.drops.slice(0, 16);
  await writeDb(db);
  res.json({ ok: true, case: { id: pack.id, title: pack.title }, reward: item, user: publicUser(user), drops: db.drops });
});

app.post('/api/bonus/daily', requireAuth, async (req, res) => {
  const db = await readDb();
  const user = db.users[req.userId];
  const cooldown = 1000 * 60 * 60 * 20;
  if (now() - (user.lastDailyClaim || 0) < cooldown) {
    return res.status(429).json({ ok: false, error: 'daily_already_claimed', nextAt: user.lastDailyClaim + cooldown });
  }
  const reward = 125 + Math.floor(Math.random() * 175);
  user.balance += reward;
  user.lastDailyClaim = now();
  user.updatedAt = now();
  await writeDb(db);
  res.json({ ok: true, reward, user: publicUser(user) });
});

app.post('/api/tasks/claim', requireAuth, async (req, res) => {
  const task = tasks.find(t => t.id === req.body.taskId);
  if (!task) return res.status(404).json({ ok: false, error: 'task_not_found' });
  const db = await readDb();
  const user = db.users[req.userId];
  if (user.claimedTasks.includes(task.id)) return res.status(409).json({ ok: false, error: 'task_already_claimed' });
  user.claimedTasks.push(task.id);
  user.balance += task.reward;
  user.updatedAt = now();
  await writeDb(db);
  res.json({ ok: true, task, user: publicUser(user) });
});

async function telegramSendMessage(chatId, text, replyMarkup) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: 'missing_bot_token' };
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: replyMarkup
    })
  });
  return response.json();
}

app.post('/api/telegram/webhook', async (req, res) => {
  const expected = process.env.WEBHOOK_SECRET;
  if (expected) {
    const incoming = req.header('x-telegram-bot-api-secret-token');
    if (incoming !== expected) return res.status(403).json({ ok: false });
  }

  const update = req.body || {};
  const message = update.message || update.edited_message;
  const text = message?.text || '';
  const chatId = message?.chat?.id;
  if (chatId && text.startsWith('/start')) {
    const cfg = publicConfig();
    const welcome = [
      `⭐ <b>Добро пожаловать в ${cfg.appName}</b>`,
      '',
      'Здесь у тебя профиль, кейсы, бонусы, задания и игровые режимы во внутренней валюте.',
      '',
      'Жми <b>Играть</b>, чтобы открыть mini app.'
    ].join('\n');
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Канал', url: cfg.channelUrl }, { text: 'Играть', web_app: { url: cfg.baseUrl } }],
        [{ text: 'Поддержка', url: cfg.supportUrl }]
      ]
    };
    await telegramSendMessage(chatId, welcome, keyboard);
  }
  res.json({ ok: true });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

ensureDb().then(() => {
  app.listen(PORT, () => {
    console.log(`StarLucky running on port ${PORT}`);
  });
});
