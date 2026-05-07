# StarLucky v7 DB Serious

Сборка без клиентского стартового баланса и без встроенных лёгких заданий.
Баланс, задания, подарки и инвентарь хранятся в PostgreSQL.

## Railway env

Обязательные:

```env
DATABASE_URL=postgresql://...
TELEGRAM_BOT_TOKEN=...
WEBHOOK_SECRET=...
ADMIN_TOKEN=...
APP_BASE_URL=https://your-app.up.railway.app
PUBLIC_APP_NAME=StarLucky
PUBLIC_TG_BOT_USERNAME=YourBot
PUBLIC_CHANNEL_URL=https://t.me/your_channel
PUBLIC_SUPPORT_URL=https://t.me/your_support
```

Опционально для TON NFT sync:

```env
TON_API_KEY=...
TON_API_BASE=https://tonapi.io
NFT_SYNC_ENABLED=true
```

## Проверка

`/api/version` должен вернуть `7.0.0-db-serious`.

## Админка

Открой `/admin.html`, вставь `ADMIN_TOKEN` и создавай:
- задания: название, описание, reward, image_url, button_url;
- подарки: название, цена, stock, image_url;
- вручную одобряй task claims;
- вручную начисляй баланс пользователю по Telegram ID.

## Важно

В этой версии игры не начисляют баланс. Реальные звёзды/подарки нельзя выдавать через клиентский RNG или локальный баланс.
Начисления идут только через серверный ledger и уникальные external_id, чтобы не было дублей.
