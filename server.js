require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { db, perfumes } = require('./database');
const { getAIResponse, getAIStatus, generateProductDescription } = require('./ai-service');
const { getCRMUrl, getCRMStatus, sendOrderToCRM, bootstrapCRM, testAmoCRMConnection } = require('./crm-service');

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');

if (isProduction) app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: isProduction,
    sameSite: 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = db.getUserById(id);
  done(null, user || null);
});

const publicBaseUrl = () => {
  const render = process.env.RENDER_EXTERNAL_URL;
  if (render) return render.replace(/\/$/, '');
  if (isProduction && process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  return `http://localhost:${PORT}`;
};

let GOOGLE_CALLBACK = process.env.GOOGLE_CALLBACK_URL || `${publicBaseUrl()}/auth/google/callback`;
if (isProduction && /localhost|127\.0\.0\.1/i.test(GOOGLE_CALLBACK)) {
  GOOGLE_CALLBACK = `${publicBaseUrl()}/auth/google/callback`;
}

const isGoogleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (isGoogleConfigured()) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: GOOGLE_CALLBACK
  }, (accessToken, refreshToken, profile, done) => {
    let user = db.getUserByGoogleId(profile.id);
    const adminGoogleId = process.env.ADMIN_GOOGLE_ID;
    const userCount = db.getUserCount();
    // Logic: First user ever is admin, OR Google ID matches env, OR user already has is_admin flag in DB
    const isAdmin = (adminGoogleId && profile.id === adminGoogleId) || (!adminGoogleId && userCount === 0) || (user && user.is_admin);

    if (!user) {
      user = db.createUser({
        google_id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        avatar: profile.photos?.[0]?.value || null,
        is_admin: isAdmin
      });
      console.log(`\n  ✓ Новый пользователь: ${user.name} (${user.email})`);
      console.log(`    Google ID: ${profile.id}`);
      if (isAdmin) console.log('    Назначен администратором (первый пользователь)\n');
      else console.log(`    Для назначения админом добавьте в .env: ADMIN_GOOGLE_ID=${profile.id}\n`);
    } else {
      user = db.updateUser(user.id, {
        email: profile.emails?.[0]?.value || user.email,
        name: profile.displayName,
        avatar: profile.photos?.[0]?.value || user.avatar,
        is_admin: isAdmin || user.is_admin
      });
    }
    done(null, user);
  }));
}

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.use(express.static(PUBLIC_DIR, { index: 'index.html' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Требуется авторизация' });
}

function requireAdmin(req, res, next) {
  const isAuth = req.isAuthenticated && req.isAuthenticated();
  const isAdmin = isAuth && req.user && req.user.is_admin;

  if (isAdmin) return next();

  console.warn(`[Admin] Denied access: Auth=${isAuth}, User=${req.user?.email || 'none'}, Admin=${!!req.user?.is_admin}`);
  res.status(403).json({ error: 'Доступ только для администратора' });
}

function crmUrlForAdmin(user) {
  if (!user?.is_admin) return null;
  return getCRMUrl();
}

const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: smtpPort,
  secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined
});

async function sendOrderEmail(order, customerEmail, customerName) {
  const emailTo = (customerEmail || order.user_email || '').trim().toLowerCase();
  if (!emailTo) {
    console.log('[Email] Нет email клиента для заказа #' + order.id);
    return { sent: false, to: null, reason: 'no_email' };
  }

  if (!process.env.SMTP_USER) {
    console.log('[Email] SMTP не настроен. Заказ #' + order.id + ' — письмо на ' + emailTo + ' не отправлено.');
    return { sent: false, to: emailTo, reason: 'smtp_not_configured' };
  }

  const items = JSON.parse(order.items);
  const itemsList = items.map(i => `• ${i.name} (${i.brand}) × ${i.qty} — ${(i.price * i.qty).toLocaleString('ru-RU')} ₽`).join('\n');
  const name = customerName || order.user_name || 'клиент';

  const mailOptions = {
    from: `"ScentForge" <${process.env.SMTP_USER}>`,
    to: emailTo,
    subject: `Заказ #${order.id} оформлен — ScentForge`,
    text: `Здравствуйте, ${name}!\n\nВаш заказ #${order.id} успешно оформлен.\n\nСостав заказа:\n${itemsList}\n\nИтого: ${order.total.toLocaleString('ru-RU')} ₽\n\nСпасибо за покупку!\nScentForge — мужская парфюмерия`
  };

  const adminMail = {
    from: `"ScentForge" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
    subject: `Новый заказ #${order.id} — ${name}`,
    text: `Новый заказ от ${name} (${emailTo})\n\n${itemsList}\n\nИтого: ${order.total.toLocaleString('ru-RU')} ₽`
  };

  try {
    const clientInfo = await mailTransporter.sendMail(mailOptions);
    await mailTransporter.sendMail(adminMail);
    console.log('[Email] Уведомления отправлены для заказа #' + order.id + ' → ' + emailTo);
    const preview = nodemailer.getTestMessageUrl(clientInfo);
    if (preview) {
      console.log('[Email] Демо-просмотр письма клиенту: ' + preview);
    }
    return { sent: true, to: emailTo, preview: preview || null };
  } catch (err) {
    console.error('[Email] Ошибка отправки на ' + emailTo + ':', err.message);
    return { sent: false, to: emailTo, reason: 'send_failed' };
  }
}

// Auth routes
app.get('/api/email/status', (req, res) => {
  res.json({
    configured: !!process.env.SMTP_USER && !!process.env.SMTP_PASS,
    from: process.env.SMTP_USER || null
  });
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    configured: isGoogleConfigured(),
    callbackUrl: GOOGLE_CALLBACK,
    loggedIn: !!req.user
  });
});

app.get('/auth/google', (req, res, next) => {
  if (!isGoogleConfigured()) {
    return res.redirect('/setup.html');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback', (req, res, next) => {
  if (!isGoogleConfigured()) {
    return res.redirect('/setup.html');
  }
  passport.authenticate('google', { failureRedirect: '/?error=auth_failed' })(req, res, (err) => {
    if (err) return res.redirect('/?error=auth_failed');
    res.redirect('/?login=success');
  });
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

app.get('/api/user', (req, res) => {
  if (!req.user) return res.json({ user: null });
  const user = db.getUserById(req.user.id);
  if (!user) return res.json({ user: null });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      balance: user.balance,
      is_admin: !!user.is_admin,
      crm_url: crmUrlForAdmin(user)
    }
  });
});

// Products
app.get('/api/products', (req, res) => {
  res.json(db.getAllProducts());
});

// Admin Products API
app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(db.getAllProducts());
});

app.post('/api/admin/products', requireAdmin, (req, res) => {
  const product = db.createProduct(req.body);
  res.status(201).json(product);
});

app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  const product = db.updateProduct(req.params.id, req.body);
  if (!product) return res.status(404).json({ error: 'Товар не найден' });
  res.json(product);
});

app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const success = db.deleteProduct(req.params.id);
  if (!success) return res.status(404).json({ error: 'Товар не найден' });
  res.json({ success: true });
});

app.post('/api/admin/generate-description', requireAdmin, async (req, res) => {
  const { name, brand } = req.body;
  if (!name || !brand) return res.status(400).json({ error: 'Название и бренд обязательны' });
  try {
    const description = await generateProductDescription(name, brand);
    res.json({ description });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка генерации описания' });
  }
});

// Balance top-up
app.post('/api/balance/topup', requireAuth, (req, res) => {
  const amount = parseFloat(req.body.amount);
  if (!amount || amount <= 0 || amount > 1000000) {
    return res.status(400).json({ error: 'Некорректная сумма (от 1 до 1 000 000 ₽)' });
  }

  db.updateBalance(req.user.id, amount);
  db.addBalanceTransaction(req.user.id, amount, 'topup');

  const user = db.getUserById(req.user.id);
  if (req.user) req.user.balance = user.balance;
  res.json({ balance: user.balance, message: `Баланс пополнен на ${amount.toLocaleString('ru-RU')} ₽` });
});

function validateOrderItems(rawItems) {
  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    return { error: 'Корзина пуста' };
  }

  const merged = new Map();
  for (const item of rawItems) {
    const id = parseInt(item.id, 10);
    const qty = parseInt(item.qty, 10);
    if (!id || !qty || qty < 1 || qty > 99) {
      return { error: 'Некорректное количество товара' };
    }

    const product = db.getProductById(id);
    if (!product) {
      return { error: `Товар «${item.name || id}» больше не доступен` };
    }

    if (merged.has(id)) {
      merged.get(id).qty += qty;
      if (merged.get(id).qty > 99) {
        return { error: 'Максимум 99 шт. одного товара в заказе' };
      }
    } else {
      merged.set(id, {
        id: product.id,
        name: product.name,
        brand: product.brand,
        price: product.price,
        image: product.image,
        qty
      });
    }
  }

  const items = Array.from(merged.values());
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  return { items, total };
}

// Checkout
app.post('/api/orders', requireAuth, async (req, res) => {
  const validated = validateOrderItems(req.body.items);
  if (validated.error) {
    return res.status(400).json({ error: validated.error });
  }

  const { items, total } = validated;
  const user = db.getUserById(req.user.id);
  if (!user) {
    return res.status(400).json({ error: 'Пользователь не найден' });
  }

  const customerEmail = (user.email || '').trim().toLowerCase();
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return res.status(400).json({
      error: 'Не найдена почта Google в профиле. Выйдите из аккаунта и войдите снова через Google.'
    });
  }

  const result = db.checkoutOrder({
    user_id: req.user.id,
    user_email: customerEmail,
    user_name: user.name,
    items,
    total
  });

  if (result.error) {
    return res.status(400).json({ error: result.error, balance: result.balance });
  }

  const { order, balance } = result;
  if (req.user) req.user.balance = balance;

  const crmResult = await sendOrderToCRM(order, { id: user.id, name: user.name, email: customerEmail });

  res.json({
    order: { id: order.id, total: order.total, items, created_at: order.created_at },
    balance,
    email: { sent: false, to: customerEmail, pending: !!process.env.SMTP_USER },
    crm: crmResult
  });

  sendOrderEmail(order, customerEmail, user.name).catch(err => {
    console.error('[Email] Фоновая отправка заказа #' + order.id + ':', err.message);
  });
});

// User orders
app.get('/api/orders/my', requireAuth, (req, res) => {
  const orders = db.getOrdersByUserId(req.user.id);
  res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items) })));
});

// amoCRM
app.get('/api/crm/status', requireAdmin, (req, res) => {
  res.json(getCRMStatus());
});

app.post('/api/crm/test', requireAdmin, async (req, res) => {
  res.json(await testAmoCRMConnection());
});

// AI Assistant
app.get('/api/ai/status', (req, res) => {
  res.json(getAIStatus());
});

app.post('/api/ai/chat', async (req, res) => {
  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: 'Сообщение пустое' });

  try {
    const result = await getAIResponse(message, history);
    res.json(result);
  } catch (err) {
    console.error('[AI] Error:', err.message);
    res.status(500).json({ error: 'Ошибка ИИ-помощника' });
  }
});

app.use((req, res) => {
  if (req.path.endsWith('.html')) {
    const file = path.join(PUBLIC_DIR, req.path);
    if (fs.existsSync(file)) return res.sendFile(file);
  }
  res.status(404).send('Страница не найдена. <a href="/">На главную</a>');
});

app.listen(PORT, '0.0.0.0', () => {
  bootstrapCRM();

  console.log('\n  ═══════════════════════════════════════');
  const baseUrl = publicBaseUrl();
  console.log('  ScentForge: ' + baseUrl);
  console.log('  ═══════════════════════════════════════\n');

  if (isGoogleConfigured()) {
    console.log('  ✓ Google OAuth подключён');
    console.log('    Callback URL: ' + GOOGLE_CALLBACK);
  } else {
    console.log('  ⚠ Google OAuth не настроен → /setup.html');
  }

  const ai = getAIStatus();
  console.log('  ✓ ИИ-консультант: ' + ai.label + ' (v' + ai.version + ')');
  if (ai.needsKey) {
    console.log('    Добавьте GEMINI_API_KEY: https://aistudio.google.com/apikey');
    console.log('    Или GROQ_API_KEY: https://console.groq.com/keys');
  }

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('  ✓ Email SMTP: ' + process.env.SMTP_USER);
  } else {
    console.log('  ⚠ Email не настроен — добавьте SMTP_PASS в .env');
    console.log('    Пароль приложения: https://myaccount.google.com/apppasswords');
  }

  const crm = getCRMStatus();
  if (crm.configured) {
    console.log('  ✓ amoCRM: ' + crm.url);
    if (crm.pipeline_id) console.log('    Воронка: ' + crm.pipeline_id);
  } else {
    console.log('  ⚠ amoCRM не настроена — добавьте AMOCRM_SUBDOMAIN и AMOCRM_ACCESS_TOKEN');
    console.log('    Инструкция: /setup.html');
  }
  console.log('');
});
