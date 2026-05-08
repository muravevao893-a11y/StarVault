# StarLucky v12

Production-oriented Telegram Mini App build:

- compact dark UI;
- fixed clickable interface;
- game pages with bet picker, color picker, spin button, global history and personal bet history;
- PostgreSQL users, ledger, payments, gifts, inventory, delivery orders, live drops, tasks;
- Stars invoice creation through Telegram Bot API (`XTR`);
- TON payment intent creation for TON Connect flow;
- admin panel at `/admin.html`;
- server-side balance and game results.

## Required Railway variables

```env
APP_BASE_URL=https://your-app.up.railway.app
PUBLIC_APP_NAME=StarLucky
PUBLIC_TG_BOT_USERNAME=your_bot_username
PUBLIC_CHANNEL_URL=https://t.me/your_channel
PUBLIC_SUPPORT_URL=https://t.me/your_support
TELEGRAM_BOT_TOKEN=...
WEBHOOK_SECRET=...
ADMIN_TOKEN=...
DATABASE_URL=postgresql://...
PUBLIC_TON_RECEIVER_WALLET=UQ...
TON_API_KEY=...
TON_API_BASE=https://tonapi.io
NFT_SYNC_ENABLED=true
```

## Check version

`/api/version` must return:

```json
{"ok":true,"app":"StarLucky","version":"12.2.0-admin-payments-delivery-polished"}
```

## Set webhook

```powershell
$BOT_TOKEN="your_bot_token"
$WEBHOOK_SECRET="your_webhook_secret"
$APP_URL="https://your-app.up.railway.app"
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" -Body @{
  url="$APP_URL/api/telegram/webhook"
  secret_token=$WEBHOOK_SECRET
}
```
