# StarLucky Mini App

Railway-ready Telegram Mini App in dark/gold style.

## Files

- `server.mjs` — Express server, static frontend, `/start` webhook.
- `public/index.html` — Telegram Mini App markup.
- `public/styles.css` — full dark/gold mobile UI.
- `public/app.js` — working internal balance, games, cases, bonuses, tasks, profile.
- `railway.json` — Railway start and healthcheck.

## Deploy

```powershell
git add -A
git commit -m "Deploy StarLucky full fixed"
git push
```

## Check

Open:

```text
https://YOUR_DOMAIN.up.railway.app/api/version
```

Expected version: `4.0.0-full-fixed`.

## Telegram webhook

```powershell
$BOT_TOKEN="YOUR_BOT_TOKEN"
$WEBHOOK_SECRET="YOUR_WEBHOOK_SECRET"
$APP_URL="https://YOUR_DOMAIN.up.railway.app"

Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" -Body @{
  url="$APP_URL/api/telegram/webhook"
  secret_token=$WEBHOOK_SECRET
}
```

This project uses an internal entertainment balance only. Real-money gambling, payouts, or casino flows require licensed backend infrastructure and are intentionally not included.
