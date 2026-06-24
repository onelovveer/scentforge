/**
 * Тестовая почта без регистрации (Ethereal).
 * Письма НЕ приходят в реальный Gmail — только ссылка для просмотра в консоли.
 */
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const envPath = path.join(__dirname, '.env');

(async () => {
  console.log('\n  Создаём тестовый почтовый ящик Ethereal (без регистрации)...\n');
  const account = await nodemailer.createTestAccount();

  const block = `
# Email — тест Ethereal (без регистрации, только для демо)
# Письма в реальный Gmail НЕ доходят — ссылка на просмотр в консоли сервера
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=${account.user}
SMTP_PASS=${account.pass}
ADMIN_EMAIL=andronchik665@gmail.com
`;

  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  env = env.replace(/# Email[\s\S]*?(?=\n# |\n[A-Z_]+=|$)/, '').trimEnd();
  if (!env.endsWith('\n')) env += '\n';
  env += block;

  fs.writeFileSync(envPath, env);

  console.log('  ✓ Настройки записаны в .env');
  console.log('  ✓ Логин Ethereal:', account.user);
  console.log('\n  Перезапустите start.bat и оформите заказ.');
  console.log('  Ссылку на письмо смотрите в чёрном окне сервера.\n');
  console.log('  Для РЕАЛЬНОЙ доставки на Gmail — настройте Яндекс Почту (setup.html, шаг 7).\n');
})().catch(err => {
  console.error('\n  [!] Ошибка:', err.message);
  console.log('  Нужен интернет. Или настройте Яндекс Почту вручную.\n');
  process.exit(1);
});
