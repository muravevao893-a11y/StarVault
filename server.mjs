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

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false }, max: Number(process.env.PG_POOL_MAX || 20) }) : null;
const memory = { users: new Map(), gameRounds: [], ledger: [] };

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

function jsonError(res, status, code, message) { return res.status(status).json({ ok: false, code, message }); }
function nowIso() { return new Date().toISOString(); }
function safeInt(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) { r -= item.weight; if (r <= 0) return item; }
  return items[items.length - 1];
}
function shortName(user) {
  const first = user?.first_name || "";
  const last = user?.last_name || "";
  const full = `${first} ${last}`.trim();
  return full || user?.username || "Игрок";
}
function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calc = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  const userRaw = params.get("user");
  return userRaw ? JSON.parse(userRaw) : null;
}
function getTelegramUser(req) {
  const initData = req.header("x-telegram-init-data") || req.body?.initData || req.query?.initData;
  const validUser = validateInitData(initData);
  if (validUser) return validUser;
  if (process.env.ALLOW_UNSAFE_DEV_AUTH === "true") {
    const id = req.header("x-dev-user-id") || req.query.user_id || "1001";
    return { id: Number(id), first_name: "Игрок", username: "dev" };
  }
  return null;
}
async function initDb() {
  if (!pool) return;
  await pool.query(`
    create table if not exists users (
      id bigserial primary key,
      telegram_id bigint unique not null,
      first_name text,
      last_name text,
      username text,
      photo_url text,
      balance_stars integer not null default 0,
      xp integer not null default 0,
      level integer not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists ledger (
      id bigserial primary key,
      telegram_id bigint not null,
      amount integer not null,
      reason text not null,
      idempotency_key text unique,
      created_at timestamptz not null default now()
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
    create index if not exists idx_game_rounds_user_time on game_rounds(telegram_id, created_at desc);
    create index if not exists idx_game_rounds_game_time on game_rounds(game, created_at desc);
    create index if not exists idx_ledger_user_time on ledger(telegram_id, created_at desc);
  `);
}
async function upsertUser(tgUser) {
  const telegramId = BigInt(tgUser.id).toString();
  const levelFromXp = (xp) => Math.max(1, Math.floor(xp / 1000) + 1);
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
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      username = excluded.username,
      photo_url = coalesce(excluded.photo_url, users.photo_url),
      updated_at = now()
    returning telegram_id, first_name, last_name, username, photo_url, balance_stars, xp, level
  `, [telegramId, tgUser.first_name || "", tgUser.last_name || "", tgUser.username || "", tgUser.photo_url || null]);
  return rows[0];
}
async function withUserLock(telegramId, fn) {
  if (!pool) return fn(null);
  const client = await pool.connect();
  try {
    await client.query("begin");
    const user = (await client.query("select * from users where telegram_id=$1 for update", [telegramId])).rows[0];
    if (!user) throw new Error("USER_NOT_FOUND");
    const result = await fn(client, user);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally { client.release(); }
}
async function applyGameRound({ telegramId, game, bet, choice, outcome, multiplier }) {
  bet = safeInt(bet);
  if (![30, 50, 100, 200, 500, 1000, 2500, 5000].includes(bet)) throw new Error("BAD_BET");
  const payout = Math.floor(bet * Number(multiplier));
  if (!pool) {
    const user = memory.users.get(String(telegramId));
    if (!user || user.balance_stars < bet) throw new Error("INSUFFICIENT_BALANCE");
    user.balance_stars = user.balance_stars - bet + payout;
    user.xp += Math.max(1, Math.floor(bet / 10));
    user.level = Math.max(1, Math.floor(user.xp / 1000) + 1);
    const round = { id: memory.gameRounds.length + 1, telegram_id: String(telegramId), game, bet, choice, outcome, multiplier, payout, balance_after: user.balance_stars, created_at: nowIso() };
    memory.gameRounds.unshift(round);
    return { round, user };
  }
  return withUserLock(String(telegramId), async (client, user) => {
    if (user.balance_stars < bet) throw new Error("INSUFFICIENT_BALANCE");
    const xpAdd = Math.max(1, Math.floor(bet / 10));
    const nextBalance = user.balance_stars - bet + payout;
    const nextXp = user.xp + xpAdd;
    const nextLevel = Math.max(1, Math.floor(nextXp / 1000) + 1);
    await client.query("update users set balance_stars=$1, xp=$2, level=$3, updated_at=now() where telegram_id=$4", [nextBalance, nextXp, nextLevel, telegramId]);
    await client.query("insert into ledger (telegram_id, amount, reason, idempotency_key) values ($1,$2,$3,$4)", [telegramId, -bet, `${game}: bet`, crypto.randomUUID()]);
    if (payout > 0) await client.query("insert into ledger (telegram_id, amount, reason, idempotency_key) values ($1,$2,$3,$4)", [telegramId, payout, `${game}: payout`, crypto.randomUUID()]);
    const round = (await client.query(`insert into game_rounds (telegram_id, game, bet, choice, outcome, multiplier, payout, balance_after) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`, [telegramId, game, bet, choice || null, outcome, multiplier, payout, nextBalance])).rows[0];
    return { round, user: { ...user, balance_stars: nextBalance, xp: nextXp, level: nextLevel } };
  });
}
async function getGameHistory(telegramId, game) {
  if (!pool) {
    return memory.gameRounds.filter(r => !game || r.game === game).slice(0, 20).map(r => ({ ...r, mine: r.telegram_id === String(telegramId) }));
  }
  const global = (await pool.query("select game, outcome, multiplier, created_at from game_rounds where ($1::text is null or game=$1) order by created_at desc limit 12", [game || null])).rows;
  const mine = (await pool.query("select game, bet, choice, outcome, multiplier, payout, balance_after, created_at from game_rounds where telegram_id=$1 and ($2::text is null or game=$2) order by created_at desc limit 20", [telegramId, game || null])).rows;
  return { global, mine };
}

app.get("/health", (req, res) => res.json({ ok: true, app: PUBLIC_APP_NAME }));
app.get("/api/version", (req, res) => res.json({ ok: true, app: "StarLucky", version: "11.0.0-game-pages-history", db: Boolean(pool) }));
app.get("/api/config", (req, res) => res.json({ appName: PUBLIC_APP_NAME, botUsername: PUBLIC_TG_BOT_USERNAME, channelUrl: PUBLIC_CHANNEL_URL, supportUrl: PUBLIC_SUPPORT_URL, baseUrl: APP_BASE_URL }));
app.get("/api/me", async (req, res) => {
  const tgUser = getTelegramUser(req);
  if (!tgUser) return jsonError(res, 401, "AUTH_REQUIRED", "Open in Telegram Mini App");
  const user = await upsertUser(tgUser);
  res.json({ ok: true, user: { ...user, display_name: shortName(tgUser) } });
});
app.get("/api/games/history", async (req, res) => {
  const tgUser = getTelegramUser(req); if (!tgUser) return jsonError(res, 401, "AUTH_REQUIRED", "Open in Telegram Mini App");
  await upsertUser(tgUser);
  const game = req.query.game || null;
  const history = await getGameHistory(String(tgUser.id), game);
  res.json({ ok: true, ...history });
});
app.post("/api/games/star-spin/play", async (req, res) => {
  const tgUser = getTelegramUser(req); if (!tgUser) return jsonError(res, 401, "AUTH_REQUIRED", "Open in Telegram Mini App");
  await upsertUser(tgUser);
  const bet = safeInt(req.body.bet, 0);
  const item = pickWeighted([
    { outcome: "x0.5", multiplier: 0.5, weight: 38 }, { outcome: "x1", multiplier: 1, weight: 24 }, { outcome: "x1.5", multiplier: 1.5, weight: 18 },
    { outcome: "x2", multiplier: 2, weight: 10 }, { outcome: "x3", multiplier: 3, weight: 6 }, { outcome: "x5", multiplier: 5, weight: 3 }, { outcome: "x20", multiplier: 20, weight: 1 }
  ]);
  try {
    const result = await applyGameRound({ telegramId: String(tgUser.id), game: "star_spin", bet, choice: null, outcome: item.outcome, multiplier: item.multiplier });
    res.json({ ok: true, result });
  } catch (e) { return jsonError(res, e.message === "INSUFFICIENT_BALANCE" ? 402 : 400, e.message, e.message); }
});
app.post("/api/games/color-roulette/play", async (req, res) => {
  const tgUser = getTelegramUser(req); if (!tgUser) return jsonError(res, 401, "AUTH_REQUIRED", "Open in Telegram Mini App");
  await upsertUser(tgUser);
  const bet = safeInt(req.body.bet, 0);
  const choice = String(req.body.color || "").toLowerCase();
  const colors = [
    { color: "white", label: "Белый", multiplier: 2, weight: 48 }, { color: "green", label: "Зелёный", multiplier: 5, weight: 23 },
    { color: "blue", label: "Синий", multiplier: 8, weight: 15 }, { color: "purple", label: "Фиолетовый", multiplier: 12, weight: 9 }, { color: "gold", label: "Золотой", multiplier: 20, weight: 5 }
  ];
  if (!colors.some(c => c.color === choice)) return jsonError(res, 400, "BAD_COLOR", "Choose color");
  const dropped = pickWeighted(colors);
  const selected = colors.find(c => c.color === choice);
  const multiplier = dropped.color === choice ? selected.multiplier : 0;
  try {
    const result = await applyGameRound({ telegramId: String(tgUser.id), game: "color_roulette", bet, choice, outcome: dropped.label, multiplier });
    res.json({ ok: true, result, dropped, selected });
  } catch (e) { return jsonError(res, e.message === "INSUFFICIENT_BALANCE" ? 402 : 400, e.message, e.message); }
});

async function sendStart(chatId) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: `Добро пожаловать в ${PUBLIC_APP_NAME}\n\nИгры, кейсы, задания и инвентарь в одном mini app.`, reply_markup: { inline_keyboard: [[{ text: "Канал", url: PUBLIC_CHANNEL_URL }, { text: "Поддержка", url: PUBLIC_SUPPORT_URL }], [{ text: "Играть", web_app: { url: APP_BASE_URL } }]] } }) });
}
app.post("/api/telegram/webhook", async (req, res) => {
  try {
    if (WEBHOOK_SECRET && req.header("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) return res.status(403).json({ ok: false });
    const msg = req.body?.message;
    if (msg?.from) await upsertUser(msg.from);
    if (msg?.chat?.id && String(msg?.text || "").startsWith("/start")) await sendStart(msg.chat.id);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ ok: false }); }
});
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

initDb().then(() => app.listen(PORT, () => console.log(`StarLucky v11 on ${PORT}`))).catch(e => { console.error(e); process.exit(1); });
