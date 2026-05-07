# StarLucky Mini App — Railway build

Готовый Railway-friendly проект в стиле чёрный + золото:

- Telegram Mini App UI под mobile/desktop.
- Стартовый экран и `/start` webhook для Telegram-бота.
- Inline-кнопки: **Канал**, **Играть**, **Поддержка**.
- Профиль, Игры, Кейсы, Бонусы, Задания.
- Лайв-дропы, баланс, реф-ссылка, кейсы, инвентарь, ежедневный бонус, задания.
- Star Spin и Color Roulette на внутренней валюте `⭐`.
- TON Connect UI + intent endpoint для подготовки TON-транзакции.

> Важно: экономика здесь сделана как внутренняя развлекательная система без вывода/обмена на деньги. Реальные ставки, выплаты и казино-механика требуют лицензии, KYC/AML, возрастных ограничений, аудита RNG и юридической проверки.

---

## 1. Локальный запуск

```bash
npm install
npm start
```

Открой:

```text
http://localhost:3000
```

---

## 2. Railway env

В Railway: **Project → Service → Variables**.

Минимум:

```env
NODE_ENV=production
APP_BASE_URL=https://your-app.up.railway.app
PUBLIC_APP_NAME=StarLucky
PUBLIC_MODE=production
PUBLIC_TG_BOT_USERNAME=your_bot_username
PUBLIC_CHANNEL_URL=https://t.me/your_channel
PUBLIC_SUPPORT_URL=https://t.me/your_support
PUBLIC_TON_MANIFEST_URL=https://your-app.up.railway.app/tonconnect-manifest.json
PUBLIC_TON_RECEIVER_WALLET=UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TELEGRAM_BOT_TOKEN=123456:botfather_token
WEBHOOK_SECRET=random_hex_secret
JWT_SECRET=another_random_hex_secret
```

Генерация секретов на Windows PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 3. Деплой на Railway

```bash
git init
git add .
git commit -m "StarLucky mini app"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

Railway → **New Project → Deploy from GitHub repo**.

После деплоя: **Settings → Networking → Public Networking → Generate Domain**.

---

## 4. BotFather

1. Создай бота: `/newbot`.
2. Получи `TELEGRAM_BOT_TOKEN`.
3. Укажи домен mini app/web app.
4. Можно поставить аватарку `public/icon.png`.

---

## 5. Установка webhook для `/start`

В PowerShell/Bash после деплоя:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://your-app.up.railway.app/api/telegram/webhook" \
  -d "secret_token=$WEBHOOK_SECRET"
```

На Windows PowerShell удобнее так:

```powershell
$BOT_TOKEN="123456:your_token"
$WEBHOOK_SECRET="your_webhook_secret"
$APP_URL="https://your-app.up.railway.app"

Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" -Body @{
  url="$APP_URL/api/telegram/webhook"
  secret_token=$WEBHOOK_SECRET
}
```

После этого при `/start` бот отправит welcome-текст и inline-кнопки:

- Канал → `PUBLIC_CHANNEL_URL`
- Играть → mini app через `web_app`
- Поддержка → `PUBLIC_SUPPORT_URL`

---

## 6. TON manifest

Manifest доступен тут:

```text
https://your-app.up.railway.app/tonconnect-manifest.json
```

Он генерируется сервером из env:

```json
{
  "url": "APP_BASE_URL",
  "name": "PUBLIC_APP_NAME",
  "iconUrl": "APP_BASE_URL/icon.png"
}
```

---

## 7. Где бизнес-логика

- `/api/auth/telegram` — авторизация mini app через Telegram initData.
- `/api/me` — профиль, дропы, кейсы, задания.
- `/api/games/spin` — Star Spin.
- `/api/games/color` — Color Roulette.
- `/api/cases/open` — открытие кейсов.
- `/api/bonus/daily` — ежедневный бонус.
- `/api/tasks/claim` — выполнение заданий.
- `/api/topup/ton-intent` — создание TON intent.
- `/api/telegram/webhook` — Telegram webhook для `/start`.

Сейчас данные хранятся в `data/db.json`. Для нормального продакшена лучше подключить Postgres через `DATABASE_URL` и заменить file storage на БД.
