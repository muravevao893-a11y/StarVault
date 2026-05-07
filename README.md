# StarLucky Railway Inline Hotfix

This build intentionally embeds CSS and JS directly in `public/index.html` so Telegram/Railway cannot serve a half-styled page because of stale/cached assets.

Check `/api/version` after deployment.
