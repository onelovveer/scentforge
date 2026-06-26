# ScentForge — Маркетплейс мужской парфюмерии

Полнофункциональный интернет-магазин с авторизацией Google, ИИ-консультантом, балансом, корзиной, CRM для администратора и email-уведомлениями.

## Возможности

- **Каталог** — 8 мужских ароматов с описанием и нотами
- **Google OAuth** — вход через Google аккаунт
- **Баланс** — пополнение в профиле (демо: мгновенное зачисление)
- **Корзина и оплата** — списание с баланса при оформлении
- **ИИ-помощник** — чат-консультант (OpenAI или встроенные ответы)
- **Внешняя CRM** — заказы уходят в webhook или amoCRM; админ открывает внешнюю панель по ссылке
- **Email** — уведомление клиенту и админу при заказе

## Быстрый старт

```bash
npm install
cp .env.example .env
npm start
```

Откройте http://localhost:3000

## Настройка Google OAuth

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект → APIs & Services → Credentials
3. Create Credentials → OAuth client ID → Web application
4. Authorized redirect URI: `http://localhost:3000/auth/google/callback`
5. Скопируйте Client ID и Client Secret в `.env`

### Назначение администратора

1. Войдите через Google один раз
2. В консоли сервера или в БД (`scentforge.db`) найдите ваш `google_id`
3. Добавьте его в `.env` как `ADMIN_GOOGLE_ID=...`
4. Перезапустите сервер и войдите снова

## Настройка Email (SMTP)

Для Gmail используйте [App Password](https://myaccount.google.com/apppasswords):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
ADMIN_EMAIL=admin@example.com
```

## ИИ-помощник

Добавьте `OPENAI_API_KEY` в `.env` для полноценного GPT-консультанта.
Без ключа работает встроенный fallback с рекомендациями по каталогу.

## Внешняя CRM

Заказы автоматически отправляются во внешнюю систему при оформлении.

**Webhook** (Zapier, Make, n8n, Bitrix24 и др.):

```
CRM_URL=https://your-crm.example.com
CRM_WEBHOOK_URL=https://hooks.zapier.com/...
CRM_WEBHOOK_SECRET=optional-bearer-token
```

**amoCRM**:

```
CRM_PROVIDER=amocrm
CRM_URL=https://yourcompany.amocrm.ru
AMOCRM_SUBDOMAIN=yourcompany
AMOCRM_ACCESS_TOKEN=your-token
AMOCRM_PIPELINE_ID=123456
```

Ссылка «CRM» в меню сайта (только для администратора) ведёт на `CRM_URL`.

## Структура проекта

```
├── server.js          — Express-сервер, API, OAuth, email
├── database.js        — SQLite, каталог товаров
├── public/
│   ├── index.html     — Главная / каталог
│   ├── cart.html      — Корзина
│   ├── profile.html   — Профиль и баланс
│   ├── css/styles.css — Стили
│   └── js/            — Клиентский JavaScript
└── .env.example       — Пример конфигурации
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/products` | Каталог |
| GET | `/api/user` | Текущий пользователь |
| POST | `/api/balance/topup` | Пополнение баланса |
| POST | `/api/orders` | Оформление заказа |
| GET | `/api/orders/my` | Мои заказы |
| GET | `/api/crm/status` | Статус внешней CRM (admin) |
| POST | `/api/ai/chat` | ИИ-консультант |
