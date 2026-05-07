import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.APP_BASE_URL || `http://localhost:${PORT}`;
const BOT_USERNAME = (process.env.PUBLIC_TG_BOT_USERNAME || 'StarLucky_bot').replace('@','');
const CHANNEL_URL = process.env.PUBLIC_CHANNEL_URL || 'https://t.me/telegram';
const SUPPORT_URL = process.env.PUBLIC_SUPPORT_URL || 'https://t.me/telegram';

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static('public', { etag: false, maxAge: 0 }));

app.get('/health', (_, res) => res.json({ ok: true }));
app.get('/api/version', (_, res) => res.json({ ok: true, app: 'StarLucky', version: '3.0.0-systems-fixed' }));
app.get('/api/config', (_, res) => res.json({
  appName: process.env.PUBLIC_APP_NAME || 'StarLucky',
  botUsername: BOT_USERNAME,
  channelUrl: CHANNEL_URL,
  supportUrl: SUPPORT_URL,
  tonManifestUrl: process.env.PUBLIC_TON_MANIFEST_URL || `${BASE_URL}/tonconnect-manifest.json`,
  tonReceiverWallet: process.env.PUBLIC_TON_RECEIVER_WALLET || '',
  baseUrl: BASE_URL
}));
app.get('/tonconnect-manifest.json', (_, res) => res.json({
  url: BASE_URL,
  name: process.env.PUBLIC_APP_NAME || 'StarLucky',
  iconUrl: `${BASE_URL}/icon.png`
}));

async function sendTelegram(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN is missing' };
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
  });
  return response.json();
}

app.post('/api/telegram/webhook', async (req, res) => {
  const expected = process.env.WEBHOOK_SECRET;
  if (expected && req.header('x-telegram-bot-api-secret-token') !== expected) return res.status(403).json({ ok: false });
  const msg = req.body?.message;
  if (msg?.text?.startsWith('/start')) {
    const chatId = msg.chat.id;
    await sendTelegram('sendMessage', {
      chat_id: chatId,
      text: '⭐ Добро пожаловать в StarLucky\n\nЗабирай бонусы, выполняй задания, открывай кейсы и играй во внутренней Star-системе.',
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [
        [{ text: 'Канал', url: CHANNEL_URL }, { text: 'Играть', web_app: { url: BASE_URL } }],
        [{ text: 'Поддержка', url: SUPPORT_URL }]
      ]}
    });
  }
  res.json({ ok: true });
});

app.get('*', (_, res) => res.sendFile(process.cwd() + '/public/index.html'));
app.listen(PORT, () => console.log(`StarLucky listening on ${PORT}`));
