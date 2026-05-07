import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const APP_NAME = process.env.PUBLIC_APP_NAME || 'StarLucky';
const APP_BASE_URL = process.env.APP_BASE_URL || '';
const BOT_USERNAME = process.env.PUBLIC_TG_BOT_USERNAME || 'StarLucky_bot';
const CHANNEL_URL = process.env.PUBLIC_CHANNEL_URL || 'https://t.me/';
const SUPPORT_URL = process.env.PUBLIC_SUPPORT_URL || 'https://t.me/';
const TON_MANIFEST_URL = process.env.PUBLIC_TON_MANIFEST_URL || `${APP_BASE_URL}/tonconnect-manifest.json`;
const TON_RECEIVER_WALLET = process.env.PUBLIC_TON_RECEIVER_WALLET || '';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path === '/tonconnect-manifest.json' || req.path === '/health') {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: process.env.NODE_ENV === 'production' ? '5m' : 0
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true, app: APP_NAME });
});

app.get('/api/version', (_req, res) => {
  res.json({ ok: true, app: 'StarLucky', version: '4.0.0-full-fixed', time: new Date().toISOString() });
});

app.get('/api/config', (_req, res) => {
  res.json({
    appName: APP_NAME,
    baseUrl: APP_BASE_URL,
    botUsername: BOT_USERNAME,
    channelUrl: CHANNEL_URL,
    supportUrl: SUPPORT_URL,
    tonManifestUrl: TON_MANIFEST_URL,
    tonReceiverWallet: TON_RECEIVER_WALLET
  });
});

app.get('/tonconnect-manifest.json', (_req, res) => {
  const base = APP_BASE_URL || 'https://example.com';
  res.json({
    url: base,
    name: APP_NAME,
    iconUrl: `${base}/icon.svg`
  });
});

async function telegram(method, payload) {
  if (!BOT_TOKEN) return { ok: false, skipped: true };
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) console.error('Telegram API error', method, data);
  return data;
}

async function handleStart(chatId) {
  const playUrl = APP_BASE_URL || 'https://example.com';
  const text = `✨ Добро пожаловать в ${APP_NAME}\n\nИграй, открывай кейсы, забирай бонусы и выполняй задания.\n\nНажми «Играть», чтобы открыть mini app.`;
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Канал', url: CHANNEL_URL },
          { text: 'Поддержка', url: SUPPORT_URL }
        ],
        [
          { text: 'Играть', web_app: { url: playUrl } }
        ]
      ]
    }
  });
}

app.post('/api/telegram/webhook', async (req, res) => {
  try {
    if (WEBHOOK_SECRET) {
      const incoming = req.header('x-telegram-bot-api-secret-token');
      if (incoming !== WEBHOOK_SECRET) return res.status(403).json({ ok: false, error: 'bad secret' });
    }

    const msg = req.body?.message;
    const text = msg?.text || '';
    const chatId = msg?.chat?.id;
    if (chatId && text.startsWith('/start')) await handleStart(chatId);
    res.json({ ok: true });
  } catch (error) {
    console.error('webhook failed', error);
    res.status(500).json({ ok: false });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`${APP_NAME} listening on ${PORT}`));
