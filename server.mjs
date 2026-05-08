import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const APP_BASE_URL = process.env.APP_BASE_URL || "";
const PUBLIC_APP_NAME = process.env.PUBLIC_APP_NAME || "StarLucky";
const PUBLIC_TG_BOT_USERNAME = process.env.PUBLIC_TG_BOT_USERNAME || "StarLucky_bot";
const PUBLIC_CHANNEL_URL = process.env.PUBLIC_CHANNEL_URL || "https://t.me/";
const PUBLIC_SUPPORT_URL = process.env.PUBLIC_SUPPORT_URL || "https://t.me/";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const TON_RECEIVER = process.env.PUBLIC_TON_RECEIVER_WALLET || "";
const TON_API_BASE = process.env.TON_API_BASE || "https://tonapi.io";
const TON_API_KEY = process.env.TON_API_KEY || "";

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
}) : null;

const memory = {
  users: new Map(), ledger: [], gameRounds: [], payments: [], gifts: [], inventory: [], orders: [], liveDrops: [], tasks: [], submissions: []
};

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

function jsonError(res, status, code, message) { return res.status(status).json({ ok: false, code, message }); }
function nowIso() { return new Date().toISOString(); }
function safeInt(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function publicUser(u, displayName) { return { telegram_id: String(u.telegram_id), first_name: u.first_name, last_name: u.last_name, username: u.username, photo_url: u.photo_url, balance_stars: u.balance_stars || 0, xp: u.xp || 0, level: u.level || 1, display_name: displayName || [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || "Игрок" }; }
function levelFromXp(xp) { return Math.max(1, Math.floor(Number(xp || 0) / 1000) + 1); }
function shortName(user) { return [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Игрок"; }
function pickWeighted(items) { const total = items.reduce((s, i) => s + Number(i.weight || 0), 0); let r = Math.random() * total; for (const it of items) { r -= Number(it.weight || 0); if (r <= 0) return it; } return items[items.length - 1]; }
function randomKey(prefix) { return `${prefix}_${crypto.randomBytes(16).toString("hex")}`; }

function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  try { if (!crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null; } catch { return null; }
  const userRaw = params.get("user");
  return userRaw ? JSON.parse(userRaw) : null;
}
function getTelegramUser(req) {
  const initData = req.header("x-telegram-init-data") || req.body?.initData || req.query?.initData;
  const valid = validateInitData(initData);
  if (valid) return valid;
  if (process.env.ALLOW_UNSAFE_DEV_AUTH === "true") return { id: Number(req.header("x-dev-user-id") || req.query.user_id || 1001), first_name: "Dev", last_name: "User", username: "dev" };
  return null;
}
function requireUser(req, res) { const u = getTelegramUser(req); if (!u) jsonError(res, 401, "AUTH_REQUIRED", "Открой mini app через Telegram"); return u; }
function requireAdmin(req, res) {
  const token = req.header("x-admin-token") || req.query.token || req.body?.adminToken;
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) { jsonError(res, 403, "ADMIN_REQUIRED", "Нужен ADMIN_TOKEN"); return false; }
  return true;
}

async function initDb() {
  if (!pool) return;
  await pool.query(`
    create table if not exists users (
      id bigserial primary key,
      telegram_id bigint unique not null,
      first_name text, last_name text, username text, photo_url text,
      balance_stars integer not null default 0,
      xp integer not null default 0,
      level integer not null default 1,
      wallet_address text,
      is_blocked boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists ledger (
      id bigserial primary key,
      telegram_id bigint not null,
      amount integer not null,
      reason text not null,
      ref_type text,
      ref_id text,
      idempotency_key text unique,
      created_at timestamptz not null default now()
    );
    create table if not exists payments (
      id text primary key,
      telegram_id bigint not null,
      provider text not null,
      amount_stars integer not null,
      amount_external numeric,
      currency text,
      status text not null default 'created',
      provider_charge_id text unique,
      tx_hash text unique,
      payload text,
      created_at timestamptz not null default now(),
      paid_at timestamptz
    );
    create table if not exists game_rounds (
      id bigserial primary key,
      telegram_id bigint not null,
      game text not null,
      bet integer not null,
      choice text,
      outcome text not null,
      multiplier numeric(8,2) not null,
      payout integer not null,
      balance_after integer not null,
      created_at timestamptz not null default now()
    );
    create table if not exists gifts (
      id bigserial primary key,
      title text not null,
      description text,
      price_stars integer not null default 0,
      stock integer not null default 0,
      image_url text,
      animation_url text,
      background_css text,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table if not exists inventory (
      id bigserial primary key,
      telegram_id bigint not null,
      item_type text not null default 'gift',
      title text not null,
      source text not null default 'system',
      gift_id bigint,
      image_url text,
      animation_url text,
      price_label text,
      metadata jsonb not null default '{}'::jsonb,
      status text not null default 'owned',
      created_at timestamptz not null default now()
    );
    create table if not exists delivery_orders (
      id bigserial primary key,
      telegram_id bigint not null,
      inventory_id bigint references inventory(id),
      status text not null default 'new',
      user_note text,
      admin_note text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists live_drops (
      id bigserial primary key,
      telegram_id bigint,
      title text not null,
      price_label text,
      image_url text,
      animation_url text,
      background_css text,
      source text not null default 'system',
      created_at timestamptz not null default now()
    );
    create table if not exists tasks (
      id bigserial primary key,
      title text not null,
      description text,
      reward_stars integer not null default 0,
      image_url text,
      button_text text,
      button_url text,
      verification_type text not null default 'manual',
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table if not exists task_submissions (
      id bigserial primary key,
      task_id bigint not null references tasks(id),
      telegram_id bigint not null,
      status text not null default 'pending',
      user_note text,
      admin_note text,
      created_at timestamptz not null default now(),
      reviewed_at timestamptz,
      unique(task_id, telegram_id)
    );
    create table if not exists admin_audit (
      id bigserial primary key,
      action text not null,
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_users_tg on users(telegram_id);
    create index if not exists idx_ledger_user_time on ledger(telegram_id, created_at desc);
    create index if not exists idx_payments_user_time on payments(telegram_id, created_at desc);
    create index if not exists idx_game_rounds_user_time on game_rounds(telegram_id, created_at desc);
    create index if not exists idx_game_rounds_game_time on game_rounds(game, created_at desc);
    create index if not exists idx_inventory_user_time on inventory(telegram_id, created_at desc);
    create index if not exists idx_orders_status_time on delivery_orders(status, created_at desc);
    create index if not exists idx_live_drops_time on live_drops(created_at desc);
  `);

  // Compatibility migration for older StarLucky builds.
  // Earlier builds used users.tg_id/balance; newer builds use users.telegram_id/balance_stars.
  await pool.query(`
    alter table users add column if not exists tg_id text;
    alter table users add column if not exists telegram_id bigint;
    alter table users add column if not exists balance integer not null default 0;
    alter table users add column if not exists balance_stars integer not null default 0;
    alter table users add column if not exists xp integer not null default 0;
    alter table users add column if not exists level integer not null default 1;
    alter table users add column if not exists first_name text;
    alter table users add column if not exists last_name text;
    alter table users add column if not exists username text;
    alter table users add column if not exists photo_url text;
    alter table users add column if not exists wallet_address text;
    alter table users add column if not exists is_blocked boolean not null default false;
    alter table users add column if not exists created_at timestamptz not null default now();
    alter table users add column if not exists updated_at timestamptz not null default now();

    alter table users alter column tg_id drop not null;
    alter table users alter column telegram_id drop not null;

    update users
      set tg_id = coalesce(tg_id, telegram_id::text)
      where tg_id is null and telegram_id is not null;

    update users
      set telegram_id = nullif(regexp_replace(tg_id, '[^0-9]', '', 'g'), '')::bigint
      where telegram_id is null and tg_id is not null and nullif(regexp_replace(tg_id, '[^0-9]', '', 'g'), '') is not null;

    update users
      set balance_stars = greatest(coalesce(balance_stars, 0), coalesce(balance, 0)),
          balance = greatest(coalesce(balance_stars, 0), coalesce(balance, 0))
      where coalesce(balance_stars, 0) <> coalesce(balance, 0);

    create unique index if not exists users_telegram_id_unique_idx on users(telegram_id) where telegram_id is not null;
    create unique index if not exists users_tg_id_unique_idx on users(tg_id) where tg_id is not null;

    create or replace function starlucky_users_compat_sync()
    returns trigger as $$
    begin
      if new.telegram_id is null and new.tg_id is not null then
        begin
          new.telegram_id := nullif(regexp_replace(new.tg_id, '[^0-9]', '', 'g'), '')::bigint;
        exception when others then
          new.telegram_id := null;
        end;
      end if;

      if new.tg_id is null and new.telegram_id is not null then
        new.tg_id := new.telegram_id::text;
      end if;

      if new.balance_stars is null and new.balance is not null then
        new.balance_stars := new.balance;
      end if;

      if new.balance is null and new.balance_stars is not null then
        new.balance := new.balance_stars;
      end if;

      if new.balance_stars is null then new.balance_stars := 0; end if;
      if new.balance is null then new.balance := new.balance_stars; end if;
      if new.xp is null then new.xp := 0; end if;
      if new.level is null then new.level := greatest(1, floor(coalesce(new.xp,0) / 1000) + 1); end if;
      new.updated_at := now();
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists starlucky_users_compat_sync_trigger on users;
    create trigger starlucky_users_compat_sync_trigger
      before insert or update on users
      for each row execute function starlucky_users_compat_sync();
  `);

}

async function audit(action, details = {}) { if (!pool) return; await pool.query("insert into admin_audit(action, details) values($1,$2)", [action, details]); }
async function upsertUser(tgUser) {
  const telegramId = String(tgUser.id);
  if (!pool) {
    let user = memory.users.get(telegramId);
    if (!user) { user = { telegram_id: telegramId, first_name: tgUser.first_name || "", last_name: tgUser.last_name || "", username: tgUser.username || "", photo_url: tgUser.photo_url || "", balance_stars: 0, xp: 0, level: 1 }; memory.users.set(telegramId, user); }
    Object.assign(user, { first_name: tgUser.first_name || user.first_name, last_name: tgUser.last_name || user.last_name, username: tgUser.username || user.username, photo_url: tgUser.photo_url || user.photo_url, level: levelFromXp(user.xp) });
    return user;
  }
  const { rows } = await pool.query(`
    insert into users (telegram_id, first_name, last_name, username, photo_url)
    values ($1,$2,$3,$4,$5)
    on conflict (telegram_id) do update set
      first_name=excluded.first_name, last_name=excluded.last_name, username=excluded.username,
      photo_url=coalesce(excluded.photo_url, users.photo_url), updated_at=now()
    returning *
  `, [telegramId, tgUser.first_name || "", tgUser.last_name || "", tgUser.username || "", tgUser.photo_url || null]);
  return rows[0];
}
async function withUserTx(telegramId, fn) {
  if (!pool) return fn(null, memory.users.get(String(telegramId)));
  const client = await pool.connect();
  try {
    await client.query("begin");
    const user = (await client.query("select * from users where telegram_id=$1 for update", [telegramId])).rows[0];
    if (!user) throw new Error("USER_NOT_FOUND");
    if (user.is_blocked) throw new Error("USER_BLOCKED");
    const result = await fn(client, user);
    await client.query("commit");
    return result;
  } catch (e) { await client.query("rollback"); throw e; } finally { client.release(); }
}
async function addLedger(client, telegramId, amount, reason, refType, refId, idempotencyKey) {
  if (!client) { memory.ledger.unshift({ telegram_id: telegramId, amount, reason, ref_type: refType, ref_id: refId, idempotency_key: idempotencyKey, created_at: nowIso() }); return; }
  await client.query("insert into ledger(telegram_id, amount, reason, ref_type, ref_id, idempotency_key) values($1,$2,$3,$4,$5,$6) on conflict(idempotency_key) do nothing", [telegramId, amount, reason, refType || null, refId || null, idempotencyKey || randomKey("ledger")]);
}
async function changeBalance(telegramId, amount, reason, refType, refId, idempotencyKey) {
  return withUserTx(telegramId, async (client, user) => {
    const next = Number(user.balance_stars || 0) + Number(amount);
    if (next < 0) throw new Error("INSUFFICIENT_BALANCE");
    const xpAdd = amount < 0 ? Math.max(0, Math.floor(Math.abs(amount) / 10)) : Math.max(0, Math.floor(amount / 25));
    const nextXp = Number(user.xp || 0) + xpAdd;
    const nextLevel = levelFromXp(nextXp);
    if (client) {
      await addLedger(client, telegramId, amount, reason, refType, refId, idempotencyKey);
      await client.query("update users set balance_stars=$1, xp=$2, level=$3, updated_at=now() where telegram_id=$4", [next, nextXp, nextLevel, telegramId]);
    } else { user.balance_stars = next; user.xp = nextXp; user.level = nextLevel; }
    return { ...user, balance_stars: next, xp: nextXp, level: nextLevel };
  });
}

function packages() {
  return [30, 100, 200, 500, 1000, 2500, 5000].map(amount => ({ amount, label: `${amount.toLocaleString("ru-RU")} Звезд`, tonApprox: Number((amount * 0.0058).toFixed(3)) }));
}

async function createStarsInvoice(payment) {
  if (!BOT_TOKEN) throw new Error("BOT_TOKEN_MISSING");
  const payload = payment.id;
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: `${payment.amount_stars} звезд`,
      description: `Пополнение баланса ${PUBLIC_APP_NAME}`,
      payload,
      currency: "XTR",
      prices: [{ label: `${payment.amount_stars} Stars`, amount: payment.amount_stars }]
    })
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.description || "INVOICE_FAILED");
  return data.result;
}
async function createPayment({ telegramId, provider, amountStars, amountExternal = null, currency = null }) {
  const id = randomKey(provider);
  if (!pool) {
    const p = { id, telegram_id: telegramId, provider, amount_stars: amountStars, amount_external: amountExternal, currency, status: "created", created_at: nowIso() };
    memory.payments.unshift(p); return p;
  }
  const { rows } = await pool.query("insert into payments(id, telegram_id, provider, amount_stars, amount_external, currency) values($1,$2,$3,$4,$5,$6) returning *", [id, telegramId, provider, amountStars, amountExternal, currency]);
  return rows[0];
}
async function settlePayment(paymentId, providerChargeId) {
  if (!pool) return null;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const p = (await client.query("select * from payments where id=$1 for update", [paymentId])).rows[0];
    if (!p) throw new Error("PAYMENT_NOT_FOUND");
    if (p.status === "paid") { await client.query("commit"); return p; }
    await client.query("select * from users where telegram_id=$1 for update", [p.telegram_id]);
    await client.query("update payments set status='paid', provider_charge_id=coalesce($2, provider_charge_id), paid_at=now() where id=$1", [paymentId, providerChargeId || null]);
    const updated = (await client.query("update users set balance_stars=balance_stars+$1, xp=xp+floor($1/25), level=floor((xp+floor($1/25))/1000)+1, updated_at=now() where telegram_id=$2 returning *", [p.amount_stars, p.telegram_id])).rows[0];
    await addLedger(client, p.telegram_id, p.amount_stars, `${p.provider} deposit`, "payment", p.id, `payment:${p.id}`);
    await client.query("insert into live_drops(telegram_id,title,price_label,source) values($1,$2,$3,$4)", [p.telegram_id, "Пополнение", `${p.amount_stars} ★`, p.provider]);
    await client.query("commit");
    return updated;
  } catch (e) { await client.query("rollback"); throw e; } finally { client.release(); }
}

async function applyGameRound({ telegramId, game, bet, choice, outcome, multiplier }) {
  bet = safeInt(bet);
  if (![30, 50, 100, 200, 500, 1000, 2500, 5000].includes(bet)) throw new Error("BAD_BET");
  const payout = Math.floor(bet * Number(multiplier));
  return withUserTx(telegramId, async (client, user) => {
    if (Number(user.balance_stars) < bet) throw new Error("INSUFFICIENT_BALANCE");
    const nextBalance = Number(user.balance_stars) - bet + payout;
    const nextXp = Number(user.xp || 0) + Math.max(1, Math.floor(bet / 10));
    const nextLevel = levelFromXp(nextXp);
    let round;
    if (client) {
      await addLedger(client, telegramId, -bet, `${game}: ставка`, "game", game, randomKey("bet"));
      if (payout > 0) await addLedger(client, telegramId, payout, `${game}: выигрыш`, "game", game, randomKey("win"));
      await client.query("update users set balance_stars=$1, xp=$2, level=$3, updated_at=now() where telegram_id=$4", [nextBalance, nextXp, nextLevel, telegramId]);
      round = (await client.query("insert into game_rounds(telegram_id,game,bet,choice,outcome,multiplier,payout,balance_after) values($1,$2,$3,$4,$5,$6,$7,$8) returning *", [telegramId, game, bet, choice || null, outcome, multiplier, payout, nextBalance])).rows[0];
    } else {
      user.balance_stars = nextBalance; user.xp = nextXp; user.level = nextLevel;
      round = { id: memory.gameRounds.length + 1, telegram_id: telegramId, game, bet, choice, outcome, multiplier, payout, balance_after: nextBalance, created_at: nowIso() };
      memory.gameRounds.unshift(round);
    }
    return { round, user: publicUser({ ...user, balance_stars: nextBalance, xp: nextXp, level: nextLevel }) };
  });
}
async function getGameHistory(telegramId, game) {
  if (!pool) return { global: memory.gameRounds.filter(r => !game || r.game === game).slice(0, 12), mine: memory.gameRounds.filter(r => r.telegram_id === telegramId && (!game || r.game === game)).slice(0, 20) };
  const global = (await pool.query("select game,outcome,multiplier,created_at from game_rounds where ($1::text is null or game=$1) order by created_at desc limit 12", [game || null])).rows;
  const mine = (await pool.query("select game,bet,choice,outcome,multiplier,payout,balance_after,created_at from game_rounds where telegram_id=$1 and ($2::text is null or game=$2) order by created_at desc limit 20", [telegramId, game || null])).rows;
  return { global, mine };
}

// public
app.get("/health", (req, res) => res.json({ ok: true, app: PUBLIC_APP_NAME, db: Boolean(pool) }));
app.get("/api/version", (req, res) => res.json({ ok: true, app: "StarLucky", version: "12.1.0-schema-compat-migration", db: Boolean(pool) }));
app.get("/api/config", (req, res) => res.json({ ok: true, appName: PUBLIC_APP_NAME, botUsername: PUBLIC_TG_BOT_USERNAME, channelUrl: PUBLIC_CHANNEL_URL, supportUrl: PUBLIC_SUPPORT_URL, baseUrl: APP_BASE_URL, tonReceiver: TON_RECEIVER }));
app.get("/tonconnect-manifest.json", (req, res) => res.json({ url: APP_BASE_URL || `${req.protocol}://${req.get("host")}`, name: PUBLIC_APP_NAME, iconUrl: `${APP_BASE_URL || `${req.protocol}://${req.get("host")}`}/icon.png` }));
app.get("/api/me", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; const user = await upsertUser(tg); res.json({ ok: true, user: publicUser(user, shortName(tg)) }); });
app.post("/api/wallet/connect", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; const user = await upsertUser(tg); const address = String(req.body.address || "").trim(); if (!address) return jsonError(res, 400, "BAD_ADDRESS", "Нет адреса кошелька"); if (pool) await pool.query("update users set wallet_address=$1, updated_at=now() where telegram_id=$2", [address, String(tg.id)]); else user.wallet_address = address; res.json({ ok: true, address }); });
app.get("/api/live-drops", async (req, res) => { if (!pool) return res.json({ ok: true, items: memory.liveDrops.slice(0, 20) }); const items = (await pool.query("select title,price_label,image_url,animation_url,background_css,source,created_at from live_drops order by created_at desc limit 30")).rows; res.json({ ok: true, items }); });

// payments
app.get("/api/payments/packages", (req, res) => res.json({ ok: true, packages: packages() }));
app.post("/api/payments/stars/invoice", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); const amount = safeInt(req.body.amount); if (!packages().some(p => p.amount === amount)) return jsonError(res, 400, "BAD_AMOUNT", "Неверная сумма"); try { const payment = await createPayment({ telegramId: String(tg.id), provider: "stars", amountStars: amount, currency: "XTR" }); const invoiceLink = await createStarsInvoice(payment); res.json({ ok: true, paymentId: payment.id, invoiceLink }); } catch (e) { jsonError(res, 500, "INVOICE_ERROR", e.message); } });
app.post("/api/payments/ton/intent", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); const amount = safeInt(req.body.amount); const pack = packages().find(p => p.amount === amount); if (!pack) return jsonError(res, 400, "BAD_AMOUNT", "Неверная сумма"); if (!TON_RECEIVER) return jsonError(res, 500, "TON_RECEIVER_MISSING", "Не задан кошелек получателя"); const p = await createPayment({ telegramId: String(tg.id), provider: "ton", amountStars: amount, amountExternal: pack.tonApprox, currency: "TON" }); res.json({ ok: true, paymentId: p.id, receiver: TON_RECEIVER, amountTon: pack.tonApprox, comment: p.id }); });

// games
app.get("/api/games/history", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); const history = await getGameHistory(String(tg.id), req.query.game || null); res.json({ ok: true, ...history }); });
app.post("/api/games/star-spin/play", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); const item = pickWeighted([{ outcome: "x0.5", multiplier: .5, weight: 38 }, { outcome: "x1", multiplier: 1, weight: 24 }, { outcome: "x1.5", multiplier: 1.5, weight: 18 }, { outcome: "x2", multiplier: 2, weight: 10 }, { outcome: "x3", multiplier: 3, weight: 6 }, { outcome: "x5", multiplier: 5, weight: 3 }, { outcome: "x20", multiplier: 20, weight: 1 }]); try { const result = await applyGameRound({ telegramId: String(tg.id), game: "star_spin", bet: req.body.bet, outcome: item.outcome, multiplier: item.multiplier }); res.json({ ok: true, result }); } catch (e) { jsonError(res, e.message === "INSUFFICIENT_BALANCE" ? 402 : 400, e.message, e.message); } });
app.post("/api/games/color-roulette/play", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); const choice = String(req.body.color || "").toLowerCase(); const colors = [{ color: "white", label: "Белый", multiplier: 2, weight: 48 }, { color: "green", label: "Зелёный", multiplier: 5, weight: 23 }, { color: "blue", label: "Синий", multiplier: 8, weight: 15 }, { color: "purple", label: "Фиолетовый", multiplier: 12, weight: 9 }, { color: "gold", label: "Золотой", multiplier: 20, weight: 5 }]; if (!colors.some(c => c.color === choice)) return jsonError(res, 400, "BAD_COLOR", "Выбери цвет"); const dropped = pickWeighted(colors); const mult = dropped.color === choice ? colors.find(c => c.color === choice).multiplier : 0; try { const result = await applyGameRound({ telegramId: String(tg.id), game: "color_roulette", bet: req.body.bet, choice, outcome: dropped.label, multiplier: mult }); res.json({ ok: true, result, dropped }); } catch (e) { jsonError(res, e.message === "INSUFFICIENT_BALANCE" ? 402 : 400, e.message, e.message); } });

// gifts / inventory / tasks
app.get("/api/gifts", async (req, res) => { if (!pool) return res.json({ ok: true, gifts: memory.gifts }); const gifts = (await pool.query("select * from gifts where is_active=true order by id desc limit 100")).rows; res.json({ ok: true, gifts }); });
app.post("/api/gifts/:id/buy", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); const id = Number(req.params.id); if (!pool) return jsonError(res, 501, "DB_REQUIRED", "Нужна PostgreSQL база"); try { const result = await withUserTx(String(tg.id), async (client, user) => { const gift = (await client.query("select * from gifts where id=$1 and is_active=true for update", [id])).rows[0]; if (!gift) throw new Error("GIFT_NOT_FOUND"); if (gift.stock <= 0) throw new Error("OUT_OF_STOCK"); if (user.balance_stars < gift.price_stars) throw new Error("INSUFFICIENT_BALANCE"); const next = user.balance_stars - gift.price_stars; await client.query("update users set balance_stars=$1, updated_at=now() where telegram_id=$2", [next, String(tg.id)]); await client.query("update gifts set stock=stock-1 where id=$1", [id]); await addLedger(client, String(tg.id), -gift.price_stars, `Покупка ${gift.title}`, "gift", String(id), randomKey("gift")); const inv = (await client.query("insert into inventory(telegram_id,item_type,title,source,gift_id,image_url,animation_url,price_label) values($1,'gift',$2,'gift',$3,$4,$5,$6) returning *", [String(tg.id), gift.title, gift.id, gift.image_url, gift.animation_url, `${gift.price_stars} ★`])).rows[0]; await client.query("insert into live_drops(telegram_id,title,price_label,image_url,animation_url,background_css,source) values($1,$2,$3,$4,$5,$6,'gift')", [String(tg.id), gift.title, `${gift.price_stars} ★`, gift.image_url, gift.animation_url, gift.background_css]); return { inventory: inv, user: publicUser({ ...user, balance_stars: next }) }; }); res.json({ ok: true, ...result }); } catch (e) { jsonError(res, e.message === "INSUFFICIENT_BALANCE" ? 402 : 400, e.message, e.message); } });
app.get("/api/inventory", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); if (!pool) return res.json({ ok: true, items: memory.inventory.filter(i => i.telegram_id === String(tg.id)) }); const items = (await pool.query("select * from inventory where telegram_id=$1 order by created_at desc limit 100", [String(tg.id)])).rows; res.json({ ok: true, items }); });
app.post("/api/inventory/:id/delivery", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); if (!pool) return jsonError(res, 501, "DB_REQUIRED", "Нужна PostgreSQL база"); const inv = (await pool.query("select * from inventory where id=$1 and telegram_id=$2", [req.params.id, String(tg.id)])).rows[0]; if (!inv) return jsonError(res, 404, "NOT_FOUND", "Предмет не найден"); const order = (await pool.query("insert into delivery_orders(telegram_id, inventory_id, user_note) values($1,$2,$3) returning *", [String(tg.id), inv.id, req.body.note || null])).rows[0]; res.json({ ok: true, order }); });
app.get("/api/tasks", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); if (!pool) return res.json({ ok: true, tasks: memory.tasks }); const rows = (await pool.query(`select t.*, s.status as submission_status from tasks t left join task_submissions s on s.task_id=t.id and s.telegram_id=$1 where t.is_active=true order by t.id desc limit 100`, [String(tg.id)])).rows; res.json({ ok: true, tasks: rows }); });
app.post("/api/tasks/:id/submit", async (req, res) => { const tg = requireUser(req, res); if (!tg) return; await upsertUser(tg); if (!pool) return jsonError(res, 501, "DB_REQUIRED", "Нужна PostgreSQL база"); try { const sub = (await pool.query("insert into task_submissions(task_id,telegram_id,user_note) values($1,$2,$3) on conflict(task_id,telegram_id) do update set user_note=excluded.user_note returning *", [req.params.id, String(tg.id), req.body.note || null])).rows[0]; res.json({ ok: true, submission: sub }); } catch (e) { jsonError(res, 400, "TASK_ERROR", e.message); } });

// admin
app.get("/api/admin/stats", async (req, res) => { if (!requireAdmin(req, res)) return; if (!pool) return res.json({ ok: true, db: false }); const [users, bal, orders, pending, paid] = await Promise.all([pool.query("select count(*)::int c from users"), pool.query("select coalesce(sum(balance_stars),0)::int c from users"), pool.query("select count(*)::int c from delivery_orders"), pool.query("select count(*)::int c from task_submissions where status='pending'"), pool.query("select count(*)::int c from payments where status='paid'")]); res.json({ ok: true, users: users.rows[0].c, totalBalance: bal.rows[0].c, deliveryOrders: orders.rows[0].c, pendingTasks: pending.rows[0].c, paidPayments: paid.rows[0].c }); });
app.get("/api/admin/users", async (req, res) => { if (!requireAdmin(req, res)) return; if (!pool) return res.json({ ok: true, users: [] }); const q = `%${String(req.query.q || "").trim()}%`; const users = (await pool.query("select telegram_id, first_name,last_name,username,balance_stars,xp,level,wallet_address,created_at from users where $1='%%' or username ilike $1 or first_name ilike $1 or last_name ilike $1 or telegram_id::text ilike $1 order by created_at desc limit 100", [q])).rows; res.json({ ok: true, users }); });
app.post("/api/admin/balance", async (req, res) => { if (!requireAdmin(req, res)) return; const telegramId = String(req.body.telegramId || ""); const amount = safeInt(req.body.amount); const reason = String(req.body.reason || "manual_adjustment"); if (!telegramId || !amount) return jsonError(res, 400, "BAD_INPUT", "Нужны telegramId и amount"); try { const user = await changeBalance(telegramId, amount, reason, "admin", null, randomKey("admin")); await audit("balance_adjust", { telegramId, amount, reason }); res.json({ ok: true, user }); } catch (e) { jsonError(res, 400, "BALANCE_ERROR", e.message); } });
app.post("/api/admin/gifts", async (req, res) => { if (!requireAdmin(req, res)) return; if (!pool) return jsonError(res, 501, "DB_REQUIRED", "Нужна PostgreSQL база"); const b = req.body; const gift = (await pool.query("insert into gifts(title,description,price_stars,stock,image_url,animation_url,background_css,is_active) values($1,$2,$3,$4,$5,$6,$7,$8) returning *", [b.title, b.description || null, safeInt(b.price_stars), safeInt(b.stock), b.image_url || null, b.animation_url || null, b.background_css || null, b.is_active !== false])).rows[0]; await audit("gift_create", gift); res.json({ ok: true, gift }); });
app.get("/api/admin/orders", async (req, res) => { if (!requireAdmin(req, res)) return; if (!pool) return res.json({ ok: true, orders: [] }); const rows = (await pool.query("select o.*, i.title, i.image_url, u.username, u.first_name, u.last_name from delivery_orders o left join inventory i on i.id=o.inventory_id left join users u on u.telegram_id=o.telegram_id order by o.created_at desc limit 200")).rows; res.json({ ok: true, orders: rows }); });
app.post("/api/admin/orders/:id", async (req, res) => { if (!requireAdmin(req, res)) return; if (!pool) return jsonError(res, 501, "DB_REQUIRED", "Нужна PostgreSQL база"); const status = String(req.body.status || "new"); const order = (await pool.query("update delivery_orders set status=$1, admin_note=$2, updated_at=now() where id=$3 returning *", [status, req.body.admin_note || null, req.params.id])).rows[0]; await audit("order_update", { id: req.params.id, status }); res.json({ ok: true, order }); });
app.post("/api/admin/tasks", async (req, res) => { if (!requireAdmin(req, res)) return; if (!pool) return jsonError(res, 501, "DB_REQUIRED", "Нужна PostgreSQL база"); const b = req.body; const task = (await pool.query("insert into tasks(title,description,reward_stars,image_url,button_text,button_url,verification_type,is_active) values($1,$2,$3,$4,$5,$6,$7,$8) returning *", [b.title, b.description || null, safeInt(b.reward_stars), b.image_url || null, b.button_text || null, b.button_url || null, b.verification_type || "manual", b.is_active !== false])).rows[0]; await audit("task_create", task); res.json({ ok: true, task }); });
app.get("/api/admin/task-submissions", async (req, res) => { if (!requireAdmin(req, res)) return; if (!pool) return res.json({ ok: true, submissions: [] }); const rows = (await pool.query("select s.*, t.title, t.reward_stars, u.username, u.first_name, u.last_name from task_submissions s join tasks t on t.id=s.task_id left join users u on u.telegram_id=s.telegram_id order by s.created_at desc limit 200")).rows; res.json({ ok: true, submissions: rows }); });
app.post("/api/admin/task-submissions/:id", async (req, res) => { if (!requireAdmin(req, res)) return; if (!pool) return jsonError(res, 501, "DB_REQUIRED", "Нужна PostgreSQL база"); const status = String(req.body.status || "pending"); const sub = (await pool.query("select s.*, t.reward_stars from task_submissions s join tasks t on t.id=s.task_id where s.id=$1", [req.params.id])).rows[0]; if (!sub) return jsonError(res, 404, "NOT_FOUND", "Заявка не найдена"); if (sub.status === "approved") return jsonError(res, 409, "ALREADY_APPROVED", "Уже одобрено"); if (status === "approved") await changeBalance(String(sub.telegram_id), sub.reward_stars, `Задание #${sub.task_id}`, "task", String(sub.task_id), `task:${sub.task_id}:${sub.telegram_id}`); const updated = (await pool.query("update task_submissions set status=$1, admin_note=$2, reviewed_at=now() where id=$3 returning *", [status, req.body.admin_note || null, req.params.id])).rows[0]; await audit("task_submission_update", { id: req.params.id, status }); res.json({ ok: true, submission: updated }); });

async function answerPreCheckout(id, ok = true, error_message = undefined) {
  if (!BOT_TOKEN || !id) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pre_checkout_query_id: id, ok, error_message }) });
}
async function sendStart(chatId) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: `Добро пожаловать в ${PUBLIC_APP_NAME}\n\nОткрой mini app, чтобы перейти к играм, подаркам и инвентарю.`, reply_markup: { inline_keyboard: [[{ text: "Канал", url: PUBLIC_CHANNEL_URL }, { text: "Поддержка", url: PUBLIC_SUPPORT_URL }], [{ text: "Играть", web_app: { url: APP_BASE_URL } }]] } })
  });
}
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    if (WEBHOOK_SECRET && req.header("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) return res.status(403).json({ ok: false });
    if (req.body?.pre_checkout_query) { await answerPreCheckout(req.body.pre_checkout_query.id, true); return res.json({ ok: true }); }
    const msg = req.body?.message;
    if (msg?.from) await upsertUser(msg.from);
    if (msg?.chat?.id && String(msg?.text || "").startsWith("/start")) await sendStart(msg.chat.id);
    const sp = msg?.successful_payment;
    if (sp?.invoice_payload) await settlePayment(sp.invoice_payload, sp.telegram_payment_charge_id || sp.provider_payment_charge_id || null);
    res.json({ ok: true });
  } catch (e) { console.error("webhook", e); res.status(500).json({ ok: false }); }
});

app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
initDb().then(() => app.listen(PORT, () => console.log(`StarLucky v12.1 on ${PORT}`))).catch(e => { console.error(e); process.exit(1); });
