require('dotenv').config();
const nodemailer = require('nodemailer');

const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const to = process.argv[2] || user;

if (!user || !pass) {
  console.log('\n  [!] Заполните SMTP_USER и SMTP_PASS в .env');
  console.log('  Или запустите setup-ethereal.bat (демо без регистрации)');
  console.log('  Или настройте Яндекс: https://mail.yandex.ru\n');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587', 10) === 465,
  auth: { user, pass }
});

(async () => {
  console.log('\n  Проверка SMTP...');
  await transporter.verify();
  console.log('  ✓ Подключение к почте OK\n');

  const info = await transporter.sendMail({
    from: `"ScentForge" <${user}>`,
    to,
    subject: 'Тест ScentForge — почта работает',
    text: `Здравствуйте!\n\nЭто тестовое письмо от ScentForge.\nЕсли вы его видите — уведомления о заказах будут приходить на ${to}.\n\nScentForge`
  });

  const preview = nodemailer.getTestMessageUrl(info);
  console.log('  ✓ Письмо отправлено на:', to);
  if (preview) {
    console.log('  ✓ Демо-просмотр (Ethereal):', preview);
    console.log('  (В реальный Gmail это письмо не попадёт — только по ссылке выше)\n');
  } else {
    console.log('  Проверьте папку «Входящие» и «Спам».\n');
  }
})().catch(err => {
  console.error('\n  [!] Ошибка:', err.message);
  if (/invalid login|authentication|username and password/i.test(err.message)) {
    console.log('\n  Чаще всего это неверный SMTP_PASS.');
    console.log('  Нужен пароль приложения Google, не обычный пароль от Gmail.');
    console.log('  https://myaccount.google.com/apppasswords\n');
  }
  process.exit(1);
});
