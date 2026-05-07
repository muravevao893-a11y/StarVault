import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const APP_NAME = process.env.PUBLIC_APP_NAME || 'StarLucky';
const APP_BASE_URL = process.env.APP_BASE_URL || '';
const BOT_USERNAME = process.env.PUBLIC_TG_BOT_USERNAME || 'StarLucky_bot';
const CHANNEL_URL = process.env.PUBLIC_CHANNEL_URL || 'https://t.me/';
const SUPPORT_URL = process.env.PUBLIC_SUPPORT_URL || 'https://t.me/';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TON_API_KEY = process.env.TON_API_KEY || '';
const TON_API_BASE = process.env.TON_API_BASE || 'https://tonapi.io';
const NFT_SYNC_ENABLED = process.env.NFT_SYNC_ENABLED !== 'false';

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }) : null;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

function requireDb() {
  if (!pool) {
    const err = new Error('DATABASE_URL is not configured');
    err.statusCode = 500;
    throw err;
  }
}

async function initDb() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      telegram_id BIGINT UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      photo_url TEXT,
      wallet_address TEXT,
      balance_stars BIGINT NOT NULL DEFAULT 0 CHECK (balance_stars >= 0),
      xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_stars BIGINT NOT NULL,
      type TEXT NOT NULL,
      external_id TEXT,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(type, external_id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      reward_stars BIGINT NOT NULL DEFAULT 0 CHECK (reward_stars >= 0),
      image_url TEXT NOT NULL DEFAULT '',
      button_text TEXT NOT NULL DEFAULT 'Открыть',
      button_url TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      requires_manual_review BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS task_claims (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      evidence TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at TIMESTAMPTZ,
      UNIQUE(user_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS gifts (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      price_stars BIGINT NOT NULL CHECK (price_stars >= 0),
      stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS gift_orders (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gift_id BIGINT NOT NULL REFERENCES gifts(id) ON DELETE RESTRICT,
      price_stars BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','issued','cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source TEXT NOT NULL CHECK (source IN ('gift_order','ton_nft','ton_gift','admin')),
      title TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT '',
      external_id TEXT,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, source, external_id)
    );
  `);
}

function getTelegramUserFromInitData(initData) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !BOT_TOKEN) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash))) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400 * 7) return null;
  const userRaw = params.get('user');
  if (!userRaw) return null;
  return JSON.parse(userRaw);
}

async function upsertUser(tgUser) {
  requireDb();
  const result = await pool.query(`
    INSERT INTO users (telegram_id, first_name, last_name, username, photo_url, updated_at)
    VALUES ($1,$2,$3,$4,$5,now())
    ON CONFLICT (telegram_id) DO UPDATE SET
      first_name=EXCLUDED.first_name,
      last_name=EXCLUDED.last_name,
      username=EXCLUDED.username,
      photo_url=EXCLUDED.photo_url,
      updated_at=now()
    RETURNING *
  `, [tgUser.id, tgUser.first_name || '', tgUser.last_name || '', tgUser.username || '', tgUser.photo_url || '']);
  return result.rows[0];
}

function publicUser(row) {
  const displayName = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.username || 'Игрок';
  const level = Math.floor(Number(row.xp || 0) / 1000) + 1;
  return { id: row.id, telegramId: row.telegram_id, displayName, username: row.username, photoUrl: row.photo_url, walletAddress: row.wallet_address, balanceStars: Number(row.balance_stars), xp: Number(row.xp), level };
}

async function auth(req, res, next) {
  try {
    const initData = req.header('x-telegram-init-data') || req.body?.initData || '';
    const tgUser = getTelegramUserFromInitData(initData);
    if (!tgUser) return res.status(401).json({ ok: false, error: 'Open this mini app through Telegram' });
    req.user = await upsertUser(tgUser);
    next();
  } catch (e) { next(e); }
}

function admin(req, res, next) {
  const token = req.header('x-admin-token') || req.query.token || '';
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(403).json({ ok: false, error: 'Admin token required' });
  next();
}

async function addLedger(client, userId, amount, type, externalId, meta = {}) {
  const id = externalId || crypto.randomUUID();
  const ins = await client.query(`INSERT INTO ledger_entries (user_id, amount_stars, type, external_id, meta) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(type, external_id) DO NOTHING RETURNING id`, [userId, amount, type, id, meta]);
  if (!ins.rowCount) return false;
  await client.query('UPDATE users SET balance_stars = balance_stars + $1, xp = xp + $2, updated_at=now() WHERE id=$3', [amount, Math.max(0, Math.floor(Math.abs(amount) / 10)), userId]);
  return true;
}

app.get('/health', async (req, res) => {
  let db = false;
  try { if (pool) { await pool.query('SELECT 1'); db = true; } } catch {}
  res.json({ ok: true, app: APP_NAME, db });
});

app.get('/api/version', (req, res) => res.json({ ok: true, app: 'StarLucky', version: '7.1.0-balance-panel-fixed', db: Boolean(pool), time: new Date().toISOString() }));
app.get('/api/config', (req, res) => res.json({ appName: APP_NAME, botUsername: BOT_USERNAME, channelUrl: CHANNEL_URL, supportUrl: SUPPORT_URL, baseUrl: APP_BASE_URL }));

app.post('/api/session', auth, async (req, res) => res.json({ ok: true, user: publicUser(req.user) }));
app.get('/api/me', auth, async (req, res) => res.json({ ok: true, user: publicUser(req.user) }));

app.get('/api/tasks', auth, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT t.*, c.status AS claim_status
    FROM tasks t
    LEFT JOIN task_claims c ON c.task_id=t.id AND c.user_id=$1
    WHERE t.is_active=true
    ORDER BY t.created_at DESC
  `, [req.user.id]);
  res.json({ ok: true, tasks: rows });
});

app.post('/api/tasks/:id/claim', auth, async (req, res) => {
  const taskId = Number(req.params.id);
  const evidence = String(req.body?.evidence || '').slice(0, 2000);
  const task = await pool.query('SELECT * FROM tasks WHERE id=$1 AND is_active=true', [taskId]);
  if (!task.rowCount) return res.status(404).json({ ok: false, error: 'Task not found' });
  const claim = await pool.query(`INSERT INTO task_claims (user_id, task_id, evidence, status) VALUES ($1,$2,$3,'pending') ON CONFLICT(user_id, task_id) DO UPDATE SET evidence=EXCLUDED.evidence RETURNING *`, [req.user.id, taskId, evidence]);
  res.json({ ok: true, claim: claim.rows[0], message: 'Заявка отправлена на проверку' });
});

app.get('/api/gifts', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM gifts WHERE is_active=true ORDER BY created_at DESC');
  res.json({ ok: true, gifts: rows });
});

app.post('/api/gifts/:id/buy', auth, async (req, res) => {
  const giftId = Number(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
    const gift = await client.query('SELECT * FROM gifts WHERE id=$1 AND is_active=true FOR UPDATE', [giftId]);
    if (!gift.rowCount) throw Object.assign(new Error('Gift not found'), { statusCode: 404 });
    const g = gift.rows[0];
    if (g.stock <= 0) throw Object.assign(new Error('Out of stock'), { statusCode: 409 });
    if (Number(user.rows[0].balance_stars) < Number(g.price_stars)) throw Object.assign(new Error('Not enough stars'), { statusCode: 402 });
    const order = await client.query('INSERT INTO gift_orders (user_id, gift_id, price_stars) VALUES ($1,$2,$3) RETURNING *', [req.user.id, giftId, g.price_stars]);
    await client.query('UPDATE gifts SET stock=stock-1, updated_at=now() WHERE id=$1', [giftId]);
    await addLedger(client, req.user.id, -Number(g.price_stars), 'gift_purchase', `order:${order.rows[0].id}`, { giftId });
    await client.query('INSERT INTO inventory_items (user_id, source, title, image_url, external_id, meta) VALUES ($1,$2,$3,$4,$5,$6)', [req.user.id, 'gift_order', g.title, g.image_url, `order:${order.rows[0].id}`, { orderId: order.rows[0].id, giftId }]);
    await client.query('COMMIT');
    res.json({ ok: true, order: order.rows[0] });
  } catch (e) { await client.query('ROLLBACK'); res.status(e.statusCode || 500).json({ ok: false, error: e.message }); }
  finally { client.release(); }
});

app.get('/api/inventory', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM inventory_items WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ ok: true, items: rows });
});

app.post('/api/wallet', auth, async (req, res) => {
  const address = String(req.body?.address || '').trim();
  if (!/^(EQ|UQ)[A-Za-z0-9_-]{46,}$/.test(address)) return res.status(400).json({ ok: false, error: 'Invalid TON address' });
  const { rows } = await pool.query('UPDATE users SET wallet_address=$1, updated_at=now() WHERE id=$2 RETURNING *', [address, req.user.id]);
  res.json({ ok: true, user: publicUser(rows[0]) });
});

app.post('/api/ton/sync-nfts', auth, async (req, res) => {
  if (!NFT_SYNC_ENABLED) return res.status(403).json({ ok: false, error: 'NFT sync disabled' });
  const address = req.user.wallet_address || String(req.body?.address || '').trim();
  if (!address) return res.status(400).json({ ok: false, error: 'Connect wallet first' });
  const url = `${TON_API_BASE.replace(/\/$/, '')}/v2/accounts/${encodeURIComponent(address)}/nfts?limit=1000&offset=0`;
  const headers = TON_API_KEY ? { Authorization: `Bearer ${TON_API_KEY}` } : {};
  const response = await fetch(url, { headers });
  if (!response.ok) return res.status(502).json({ ok: false, error: `TON API error ${response.status}` });
  const data = await response.json();
  const nftItems = data.nft_items || data.items || [];
  let saved = 0;
  for (const nft of nftItems) {
    const title = nft.metadata?.name || nft.dns || nft.address || 'TON NFT';
    const collection = nft.collection?.name || '';
    const isGift = /gift|telegram|present|collectible/i.test(`${title} ${collection}`);
    const image = nft.previews?.find?.(p => p.resolution === '500x500')?.url || nft.metadata?.image || nft.metadata?.image_url || '';
    const externalId = nft.address || nft.index || crypto.createHash('sha256').update(JSON.stringify(nft)).digest('hex');
    const source = isGift ? 'ton_gift' : 'ton_nft';
    const ins = await pool.query(`INSERT INTO inventory_items (user_id, source, title, image_url, external_id, meta) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id, source, external_id) DO NOTHING`, [req.user.id, source, title, image, externalId, { collection, raw: nft }]);
    saved += ins.rowCount;
  }
  res.json({ ok: true, total: nftItems.length, saved });
});

app.get('/api/admin/tasks', admin, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  res.json({ ok: true, tasks: rows });
});
app.post('/api/admin/tasks', admin, async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query(`INSERT INTO tasks (title, description, reward_stars, image_url, button_text, button_url, is_active, requires_manual_review) VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING *`, [b.title, b.description || '', Number(b.rewardStars || 0), b.imageUrl || '', b.buttonText || 'Открыть', b.buttonUrl || '', b.isActive !== false]);
  res.json({ ok: true, task: rows[0] });
});
app.patch('/api/admin/tasks/:id', admin, async (req, res) => {
  const b = req.body || {}; const id = Number(req.params.id);
  const { rows } = await pool.query(`UPDATE tasks SET title=COALESCE($1,title), description=COALESCE($2,description), reward_stars=COALESCE($3,reward_stars), image_url=COALESCE($4,image_url), button_text=COALESCE($5,button_text), button_url=COALESCE($6,button_url), is_active=COALESCE($7,is_active), updated_at=now() WHERE id=$8 RETURNING *`, [b.title ?? null, b.description ?? null, b.rewardStars == null ? null : Number(b.rewardStars), b.imageUrl ?? null, b.buttonText ?? null, b.buttonUrl ?? null, b.isActive ?? null, id]);
  res.json({ ok: true, task: rows[0] });
});
app.get('/api/admin/claims', admin, async (req, res) => {
  const { rows } = await pool.query(`SELECT c.*, t.title, t.reward_stars, u.telegram_id, u.first_name, u.last_name, u.username FROM task_claims c JOIN tasks t ON t.id=c.task_id JOIN users u ON u.id=c.user_id ORDER BY c.created_at DESC LIMIT 200`);
  res.json({ ok: true, claims: rows });
});
app.post('/api/admin/claims/:id/approve', admin, async (req, res) => {
  const claimId = Number(req.params.id); const client = await pool.connect();
  try { await client.query('BEGIN');
    const q = await client.query(`SELECT c.*, t.reward_stars FROM task_claims c JOIN tasks t ON t.id=c.task_id WHERE c.id=$1 FOR UPDATE`, [claimId]);
    if (!q.rowCount) throw Object.assign(new Error('Claim not found'), { statusCode: 404 });
    const c = q.rows[0]; if (c.status === 'approved') throw Object.assign(new Error('Already approved'), { statusCode: 409 });
    await addLedger(client, c.user_id, Number(c.reward_stars), 'task_reward', `claim:${claimId}`, { taskId: c.task_id });
    await client.query(`UPDATE task_claims SET status='approved', reviewed_at=now() WHERE id=$1`, [claimId]);
    await client.query('COMMIT'); res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(e.statusCode || 500).json({ ok: false, error: e.message }); } finally { client.release(); }
});
app.post('/api/admin/claims/:id/reject', admin, async (req, res) => { const { rows } = await pool.query(`UPDATE task_claims SET status='rejected', reviewed_at=now() WHERE id=$1 RETURNING *`, [Number(req.params.id)]); res.json({ ok: true, claim: rows[0] }); });

app.get('/api/admin/gifts', admin, async (req, res) => { const { rows } = await pool.query('SELECT * FROM gifts ORDER BY created_at DESC'); res.json({ ok: true, gifts: rows }); });
app.post('/api/admin/gifts', admin, async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query(`INSERT INTO gifts (title, description, image_url, price_stars, stock, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [b.title, b.description || '', b.imageUrl || '', Number(b.priceStars || 0), Number(b.stock || 0), b.isActive !== false]);
  res.json({ ok: true, gift: rows[0] });
});
app.post('/api/admin/credit', admin, async (req, res) => {
  const telegramId = Number(req.body?.telegramId); const amount = Number(req.body?.amountStars); const reason = String(req.body?.reason || 'admin_credit');
  const client = await pool.connect();
  try { await client.query('BEGIN');
    const u = await client.query('SELECT * FROM users WHERE telegram_id=$1 FOR UPDATE', [telegramId]);
    if (!u.rowCount) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    await addLedger(client, u.rows[0].id, amount, 'admin_credit', crypto.randomUUID(), { reason });
    await client.query('COMMIT'); res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(e.statusCode || 500).json({ ok: false, error: e.message }); } finally { client.release(); }
});

async function sendTelegramMessage(chatId) {
  if (!BOT_TOKEN) return;
  const reply_markup = { inline_keyboard: [[{ text: 'Канал', url: CHANNEL_URL }, { text: 'Поддержка', url: SUPPORT_URL }], [{ text: 'Играть', web_app: { url: APP_BASE_URL } }]] };
  const text = `Добро пожаловать в ${APP_NAME}\n\nОткрывай mini app, выполняй задания и забирай награды.`;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text, reply_markup }) });
}
app.post('/api/telegram/webhook', async (req, res) => {
  try {
    if (WEBHOOK_SECRET && req.header('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) return res.status(403).json({ ok: false });
    const msg = req.body?.message;
    if (msg?.chat?.id && String(msg.text || '').startsWith('/start')) await sendTelegramMessage(msg.chat.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ ok: false }); }
});

app.use((err, req, res, next) => { console.error(err); res.status(err.statusCode || 500).json({ ok: false, error: err.message || 'Server error' }); });
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

initDb().then(() => app.listen(PORT, () => console.log(`${APP_NAME} v7 running on ${PORT}`))).catch(err => { console.error('DB init failed', err); process.exit(1); });
