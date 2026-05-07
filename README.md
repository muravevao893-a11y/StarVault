# StarVault Telegram Mini App Prototype

Красивый адаптивный прототип Telegram Mini App с вкладками:

- Профиль
- Игры
- Кейсы
- Бонусы
- Задания

Внутри есть:

- SVG-иконки вместо emoji
- автоопределение desktop/mobile layout
- Telegram WebApp API init/expand/theme hook
- TON Connect UI hook для подключения кошелька
- демо-баланс `SV`, сохранение в `localStorage`
- Spin Wheel и Color Roulette с weighted RNG в демо-режиме
- визуальная лента подарков/NFT, кейсы, бонусы, задания

## Важное ограничение

Этот проект намеренно **не содержит реальных ставок, списаний, выплат, вывода подарков/NFT или автоматического приема TON/Stars на кошелёк**.

Для реального проекта с денежной ценностью понадобятся как минимум:

1. юридическая проверка и лицензия для азартных игр в целевых странах;
2. возрастные ограничения, KYC/AML, лимиты, самоисключение, журнал спорных операций;
3. серверная валидация Telegram `initData`;
4. серверная генерация Telegram Stars invoice в валюте `XTR`;
5. обработка `pre_checkout_query`, `successful_payment`, хранение `telegram_payment_charge_id` и `/paysupport`;
6. отдельный backend ledger — баланс не должен считаться на фронтенде;
7. аудит RNG/provably fair, журналирование и антифрод;
8. TON Connect только через официальный протокол, транзакции — через server-side reconciliation и лицензированный flow;
9. NFT/gifts sync через проверенный TON indexer/API на сервере.

## Локальный запуск

```bash
python3 -m http.server 8080
```

Открой:

```text
http://localhost:8080
```

TON Connect обычно требует HTTPS и корректный `tonconnect-manifest.json` на публичном домене. Для Telegram Mini App тоже нужен HTTPS-домен, добавленный в BotFather.

## Что менять перед деплоем

1. В `tonconnect-manifest.json` замени `url`, `name`, `iconUrl` на свой HTTPS-домен.
2. В BotFather укажи Web App URL.
3. Вынеси демо-баланс, ставки, бонусы и коллекции на backend.
4. Не доверяй `localStorage` и клиентскому RNG в проде.

## Безопасные API-контракты для будущего backend

```http
POST /api/auth/telegram
body: { initData: string }

POST /api/stars/invoice
body: { packageId: string }

POST /api/payments/telegram/webhook
body: TelegramUpdate

GET /api/me/balance
GET /api/me/gifts
GET /api/me/nfts
POST /api/game/spin
POST /api/game/color
POST /api/support/payments
```

Сервер должен сам проверять пользователя, баланс, правила игры, лимиты и легальность операции.

## Deploy to Railway

This build includes a tiny Node.js static server for Railway.

1. Push this folder to a GitHub repository.
2. In Railway, create a new project and choose **Deploy from GitHub repo**.
3. Railway should detect `package.json` and run `npm start`.
4. After deploy, open **Settings → Networking → Public Networking** and generate a public domain.
5. Use the generated HTTPS domain as your Telegram Mini App URL in BotFather.
6. Update `tonconnect-manifest.json` so its `url` and `iconUrl` fields point to your real Railway/custom domain.

Local run:

```bash
npm start
```

Railway supplies `PORT` automatically in production; `server.mjs` falls back to port `3000` locally.
