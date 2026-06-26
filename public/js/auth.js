let currentUser = null;
let googleAuthReady = false;

async function initAuth() {
  if (!SF.isServer) {
    currentUser = null;
    googleAuthReady = false;
    updateHeaderUI();
    showFileModeWarning();
    return;
  }

  try {
    const [userRes, statusRes] = await Promise.all([
      SF.fetch('/api/user'),
      SF.fetch('/api/auth/status')
    ]);
    const userData = await userRes.json();
    const statusData = await statusRes.json();
    currentUser = userData.user;
    googleAuthReady = statusData.configured;
    updateHeaderUI();
    updateAuthBanner(statusData);
  } catch {
    currentUser = null;
    googleAuthReady = false;
    updateHeaderUI();
  }
}

function showFileModeWarning() {
  const banner = document.getElementById('auth-banner');
  if (!banner) return;
  banner.style.display = 'block';
  banner.className = 'auth-banner auth-banner-error';
  banner.innerHTML = `
    <span>Авторизация Google работает только через сервер.</span>
    <a href="setup.html" class="btn btn-sm btn-outline">Как настроить</a>
  `;
}

function updateAuthBanner(status) {
  const banner = document.getElementById('auth-banner');
  if (!banner || currentUser) {
    if (banner) banner.style.display = 'none';
    return;
  }

  if (!status.configured) {
    banner.style.display = 'flex';
    banner.className = 'auth-banner auth-banner-warn';
    banner.innerHTML = `
      <span>Google OAuth не настроен — войти через Google пока нельзя.</span>
      <a href="setup.html" class="btn btn-sm btn-primary">Инструкция по настройке</a>
    `;
  } else {
    banner.style.display = 'none';
  }
}

function updateHeaderUI() {
  const userMenu = document.getElementById('user-menu');
  const balanceEl = document.getElementById('header-balance');
  const adminLink = document.getElementById('admin-link');
  const crmLink = document.getElementById('crm-link');

  if (!userMenu) return;

  if (currentUser) {
    userMenu.innerHTML = `
      <a href="profile.html" style="display:flex;align-items:center;gap:8px;color:var(--text);text-decoration:none">
        ${currentUser.avatar ? `<img src="${currentUser.avatar}" class="user-avatar" alt="">` : ''}
        <span style="font-size:0.85rem">${currentUser.name.split(' ')[0]}</span>
      </a>
    `;
    if (balanceEl) {
      balanceEl.style.display = 'inline';
      balanceEl.textContent = formatPrice(currentUser.balance);
    }
    if (adminLink && currentUser.is_admin) {
      adminLink.href = '/admin.html';
      adminLink.style.display = 'inline';
    }
    if (crmLink && currentUser.is_admin && currentUser.crm_url) {
      crmLink.href = currentUser.crm_url;
      crmLink.style.display = 'inline';
    }
  } else {
    const authHref = googleAuthReady ? SF.authUrl() : 'setup.html';
    const authLabel = googleAuthReady ? 'Войти через Google' : 'Настроить Google';
    userMenu.innerHTML = `<a href="${authHref}" class="btn btn-outline btn-sm" data-auth-link>${authLabel}</a>`;
    setupAuthLinks();
    if (balanceEl) balanceEl.style.display = 'none';
    if (adminLink) adminLink.style.display = 'none';
  }
}

function requireAuth() {
  if (!SF.isServer) {
    showToast('Запустите сервер через start.bat', 'error');
    return false;
  }
  if (!googleAuthReady) {
    showToast('Сначала настройте Google OAuth', 'error');
    window.location.href = 'setup.html';
    return false;
  }
  if (!currentUser) {
    openAuthModal();
    return false;
  }
  return true;
}

function openAuthModal() {
  if (!googleAuthReady) {
    window.location.href = 'setup.html';
    return;
  }
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('open');
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('open');
}

function formatPrice(n) {
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  const params = new URLSearchParams(window.location.search);
  if (params.get('login') === 'success') {
    showToast('Вы успешно вошли через Google!', 'success');
    history.replaceState({}, '', window.location.pathname);
    initAuth();
  }
  if (params.get('error') === 'auth_failed') {
    showToast('Ошибка входа через Google. Проверьте настройки в setup.html', 'error');
    history.replaceState({}, '', window.location.pathname);
  }
});
