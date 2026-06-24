# Деплой ScentForge в интернет

## Важно про InfinityFree

**InfinityFree не поддерживает Node.js** — на нём нельзя запустить этот проект целиком (Google-вход, корзина, заказы, ИИ, почта).

| Хостинг | Что работает |
|---------|----------------|
| **Render.com** (бесплатно) | Всё |
| **InfinityFree** | Только редирект на Render или статичная витрина без заказов |

---

## Вариант 1 — полный сайт на Render (рекомендуется)

### 1. GitHub

1. Создайте репозиторий на [github.com](https://github.com) (например `scentforge`).
2. Загрузите папку проекта (без `node_modules` и без `.env`).
3. В репозитории не должно быть секретов — `.env` в `.gitignore`.

### 2. Render

1. [render.com](https://render.com) → регистрация → **New +** → **Web Service**.
2. Подключите GitHub-репозиторий.
3. Настройки:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. В **Environment** добавьте переменные:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://ВАШ-САЙТ.onrender.com/auth/google/callback
SESSION_SECRET=любая-длинная-случайная-строка
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=...
SMTP_PASS=...
ADMIN_EMAIL=...
```

5. Нажмите **Deploy**. Через 2–5 минут сайт откроется по адресу вида `https://scentforge-xxxx.onrender.com`.

### 3. Google OAuth

В [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Откройте ваш OAuth Client.
2. В **Authorized redirect URIs** добавьте:
   ```
   https://ВАШ-САЙТ.onrender.com/auth/google/callback
   ```
3. Сохраните и обновите `GOOGLE_CALLBACK_URL` в Render.

### 4. Первый вход

Первый пользователь на Render снова станет админом. Данные заказов на бесплатном Render **могут сброситься** при перезапуске сервера — для учебного проекта это нормально.

---

## Вариант 2 — домен InfinityFree → редирект на Render

Если нужен именно адрес InfinityFree (`ваш-сайт.infinityfreeapp.com`):

1. Зарегистрируйтесь на [infinityfree.com](https://www.infinityfree.com).
2. Создайте сайт, откройте **FTP** в панели.
3. Загрузите файл `deploy/infinityfree/index.php` в папку `htdocs`.
4. В `index.php` замените URL на ваш Render-адрес.
5. Посетители с InfinityFree будут перенаправляться на полный сайт.

---

## Локальный запуск

```
start.bat
```

Сайт: http://localhost:3000
