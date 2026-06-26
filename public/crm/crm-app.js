const CRM_TOKEN_KEY = 'scentforge_crm_token';

function getToken() {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get('key');
  if (fromUrl) {
    sessionStorage.setItem(CRM_TOKEN_KEY, fromUrl);
    history.replaceState({}, '', location.pathname);
  }
  return sessionStorage.getItem(CRM_TOKEN_KEY) || '';
}

function crmFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    'X-CRM-Token': token,
    ...(options.headers || {})
  };
  return fetch(path, { ...options, headers });
}

function formatPrice(n) {
  return Number(n).toLocaleString('ru-RU') + ' ₽';
}

function statusLabel(s) {
  const map = {
    completed: 'Выполнен',
    processing: 'В обработке',
    shipped: 'Отправлен',
    cancelled: 'Отменён'
  };
  return map[s] || s;
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function showLogin() {
  document.getElementById('crm-login').style.display = 'flex';
  document.getElementById('crm-app').style.display = 'none';
}

function showApp() {
  document.getElementById('crm-login').style.display = 'none';
  document.getElementById('crm-app').style.display = 'block';
}

async function tryLogin(manualKey) {
  const key = (manualKey || getToken()).trim();
  if (!key) {
    showToast('Введите ключ доступа', 'error');
    return false;
  }
  sessionStorage.setItem(CRM_TOKEN_KEY, key);
  const res = await crmFetch('/api/crm/stats');
  if (!res.ok) {
    sessionStorage.removeItem(CRM_TOKEN_KEY);
    showToast('Неверный ключ доступа', 'error');
    return false;
  }
  return true;
}

async function loadDashboard() {
  const [statsRes, ordersRes] = await Promise.all([
    crmFetch('/api/crm/stats'),
    crmFetch('/api/crm/orders')
  ]);

  if (!statsRes.ok || !ordersRes.ok) {
    showLogin();
    return;
  }

  showApp();
  const stats = await statsRes.json();
  const orders = await ordersRes.json();

  document.getElementById('stat-orders').textContent = stats.totalOrders;
  document.getElementById('stat-revenue').textContent = formatPrice(stats.totalRevenue);
  document.getElementById('stat-users').textContent = stats.totalUsers;

  const tbody = document.getElementById('orders-table');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Заказов пока нет</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td>#${o.id}</td>
      <td>${new Date(o.created_at).toLocaleString('ru-RU')}</td>
      <td>${escapeHtml(o.user_name)}<br><small style="color:var(--text-muted)">${escapeHtml(o.user_email)}</small></td>
      <td>${o.items.map(i => `${escapeHtml(i.name)} ×${i.qty}`).join('<br>')}</td>
      <td>${formatPrice(o.total)}</td>
      <td>
        <select class="status-select" data-id="${o.id}" onchange="updateStatus(this)">
          ${['completed', 'processing', 'shipped', 'cancelled'].map(s =>
            `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`
          ).join('')}
        </select>
      </td>
    </tr>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function updateStatus(select) {
  const id = select.dataset.id;
  const status = select.value;
  try {
    const res = await crmFetch(`/api/crm/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Ошибка обновления');
    showToast('Статус обновлён', 'success');
    await loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function initCRM() {
  const params = new URLSearchParams(location.search);
  if (params.get('key') || getToken()) {
    const ok = await tryLogin();
    if (ok) await loadDashboard();
    else showLogin();
  } else {
    showLogin();
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = document.getElementById('crm-key').value;
    if (await tryLogin(key)) await loadDashboard();
  });

  document.getElementById('refresh-btn').addEventListener('click', loadDashboard);
  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem(CRM_TOKEN_KEY);
    showLogin();
  });
}

window.updateStatus = updateStatus;
document.addEventListener('DOMContentLoaded', initCRM);
