# StarLucky Mini App

Root-ready Railway build. UI, navigation, profile, games, cases, bonuses, tasks and /start webhook are included.

Deploy to Railway, set env variables from `.env.example`, then set webhook:

```powershell
$BOT_TOKEN="token"
$WEBHOOK_SECRET="secret"
$APP_URL="https://your-app.up.railway.app"
Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" -Body @{ url="$APP_URL/api/telegram/webhook"; secret_token=$WEBHOOK_SECRET }
```

Check: `/api/version`.
