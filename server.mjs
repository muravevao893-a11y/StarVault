import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const APP_NAME = process.env.PUBLIC_APP_NAME || "StarLucky";
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const BOT_USERNAME = process.env.PUBLIC_TG_BOT_USERNAME || "StarLucky_bot";
const CHANNEL_URL = process.env.PUBLIC_CHANNEL_URL || "https://t.me/";
const SUPPORT_URL = process.env.PUBLIC_SUPPORT_URL || "https://t.me/";
const TON_RECEIVER_WALLET = process.env.PUBLIC_TON_RECEIVER_WALLET || "";
const TON_API_BASE = (process.env.TON_API_BASE || "https://tonapi.io").replace(/\/$/, "");
const TON_API_KEY = process.env.TON_API_KEY || "";
const NFT_SYNC_ENABLED = process.env.NFT_SYNC_ENABLED !== "false";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.use(express.static(path.join(__dirname, "public")));

function isLikelyTonAddress(value = "") {
  return /^(EQ|UQ)[A-Za-z0-9_-]{46,60}$/.test(value) || /^-?\d+:[a-fA-F0-9]{64}$/.test(value);
}

app.get("/health", (_req, res) => res.json({ ok: true, app: APP_NAME }));
app.get("/api/version", (_req, res) => res.json({ ok: true, app: "StarLucky", version: "6.0.0-nft-animations", time: new Date().toISOString() }));

app.get("/api/config", (_req, res) => {
  res.json({
    appName: APP_NAME,
    baseUrl: APP_BASE_URL,
    botUsername: BOT_USERNAME,
    channelUrl: CHANNEL_URL,
    supportUrl: SUPPORT_URL,
    tonReceiverWallet: TON_RECEIVER_WALLET,
    tonManifestUrl: `${APP_BASE_URL}/tonconnect-manifest.json`,
    nftSyncEnabled: NFT_SYNC_ENABLED
  });
});

app.get("/tonconnect-manifest.json", (_req, res) => {
  res.json({
    url: APP_BASE_URL,
    name: APP_NAME,
    iconUrl: `${APP_BASE_URL}/icon.png`
  });
});

app.get("/api/ton/nfts", async (req, res) => {
  try {
    if (!NFT_SYNC_ENABLED) return res.status(403).json({ ok: false, error: "NFT sync disabled" });
    const address = String(req.query.address || "").trim();
    if (!isLikelyTonAddress(address)) return res.status(400).json({ ok: false, error: "Invalid TON address" });

    const url = `${TON_API_BASE}/v2/accounts/${encodeURIComponent(address)}/nfts?limit=100&offset=0`;
    const headers = { accept: "application/json" };
    if (TON_API_KEY) headers.Authorization = `Bearer ${TON_API_KEY}`;

    const response = await fetch(url, { headers });
    const text = await response.text();
    if (!response.ok) return res.status(response.status).json({ ok: false, error: "TON API error", status: response.status, details: text.slice(0, 500) });

    const data = JSON.parse(text || "{}");
    const raw = Array.isArray(data.nft_items) ? data.nft_items : Array.isArray(data.items) ? data.items : [];
    const items = raw.map((nft) => {
      const metadata = nft.metadata || {};
      const collectionName = nft.collection?.name || metadata.collection || "";
      const name = metadata.name || nft.name || "NFT";
      const image = metadata.image || metadata.image_url || nft.previews?.find?.(p => p.resolution === "500x500")?.url || nft.previews?.[0]?.url || "";
      const description = metadata.description || "";
      const address = nft.address || nft.item_address || "";
      const collectionAddress = nft.collection?.address || "";
      const text = `${name} ${collectionName} ${description}`.toLowerCase();
      const isGift = /(telegram|gift|present|collectible|plush|pepe|durov|snoop|precious|signet|bonded|swag|nft gift)/i.test(text);
      return { address, name, collectionName, collectionAddress, image, description, isGift };
    });

    res.json({ ok: true, address, total: items.length, nfts: items.filter(x => !x.isGift), gifts: items.filter(x => x.isGift), all: items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: "NFT sync failed" });
  }
});

async function telegram(method, payload) {
  if (!BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return r.json();
}

async function sendStart(chatId) {
  const text = `Добро пожаловать в ${APP_NAME}\n\nИгры, кейсы, бонусы, задания, инвентарь и синхронизация TON NFT/подарков.\n\nЖми «Играть», чтобы открыть mini app.`;
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Канал", url: CHANNEL_URL }, { text: "Поддержка", url: SUPPORT_URL }],
        [{ text: "Играть", web_app: { url: APP_BASE_URL } }]
      ]
    }
  });
}

app.post("/api/telegram/webhook", async (req, res) => {
  try {
    if (WEBHOOK_SECRET) {
      const incoming = req.header("x-telegram-bot-api-secret-token");
      if (incoming !== WEBHOOK_SECRET) return res.status(403).json({ ok: false });
    }
    const msg = req.body?.message;
    if (msg?.chat?.id && String(msg.text || "").startsWith("/start")) await sendStart(msg.chat.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false });
  }
});

app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`${APP_NAME} listening on ${PORT}`));
