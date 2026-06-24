# Как выложить ScentForge в интернет (всё работает)

Нужен **Render.com** (бесплатно, поддерживает Node.js). InfinityFree и GitHub Pages **не подходят**.

---

## Быстрый путь (≈15 минут)

### 1. GitHub — загрузить код

1. Откройте [github.com/new](https://github.com/new) → имя `scentforge` → **Create repository**.
2. Нажмите **Add file → Upload files**.
3. Перетащите **всю папку проекта**, кроме:
   - `node_modules` (не загружать!)
   - `.env` (секреты!)
   - `data.json` (личные данные)
4. **Commit changes**.

### 2. Render — запустить сервер

1. [render.com](https://render.com) → Sign up → **New +** → **Web Service**.
2. Подключите репозиторий `scentforge`.
3. Настройки:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
4. **Environment** → Add Environment Variable:

| Key | Value |
|-----|--------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | любая длинная случайная строка |
| `GOOGLE_CLIENT_ID` | из вашего `.env` |
| `GOOGLE_CLIENT_SECRET` | из вашего `.env` |
| `GOOGLE_CALLBACK_URL` | `https://ВАШ-САЙТ.onrender.com/auth/google/callback` |
| `GEMINI_API_KEY` или `GROQ_API_KEY` | для ИИ (опционально) |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | для почты (опционально) |

5. **Create Web Service** → дождитесь деплоя.
6. Скопируйте URL вида `https://scentforge-xxxx.onrender.com`.

### 3. Google OAuth

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Ваш OAuth client → **Authorized JavaScript origins:**
   ```
   https://scentforge-xxxx.onrender.com
   ```
3. **Authorized redirect URIs:**
   ```
   https://scentforge-xxxx.onrender.com/auth/google/callback
   ```
4. В Render обновите `GOOGLE_CALLBACK_URL` → **Manual Deploy**.

### 4. Проверка

- [ ] Сайт открывается
- [ ] Вход через Google
- [ ] Корзина и заказ
- [ ] ИИ-консультант
- [ ] Админ `/admin.html` (первый вошедший = админ)

---

## Важно

- **Первое открытие** после простоя может грузиться 30–60 сек (бесплатный Render).
- **Данные** (заказы, баланс) на Free могут сброситься при перезапуске.
- **Локально** по-прежнему: `start.bat` → http://localhost:3000
