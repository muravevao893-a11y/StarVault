# StarLucky root hotfix

Этот архив должен лежать в корне репозитория Railway.

В корне должны быть:

- package.json
- server.mjs
- railway.json
- public/index.html
- public/styles.css
- public/app.js

Проверка после деплоя:

- /api/version должен вернуть `StarLucky` и `2.1.0-root-hotfix`
- в HTML title должен быть StarLucky, не StarVault

