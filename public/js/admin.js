document.addEventListener('DOMContentLoaded', async () => {
  const user = await initAuth();
  if (!user || !user.is_admin) {
    window.location.href = '/';
    return;
  }

  loadAdminProducts();

  const crmLink = document.getElementById('crm-link');
  if (user && crmLink && user.crm_url) {
    crmLink.href = user.crm_url;
    crmLink.target = '_blank';
  } else if (crmLink) {
    crmLink.style.display = 'none';
  }

  document.getElementById('add-product-btn').addEventListener('click', () => openModal());
  document.getElementById('product-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('generate-desc-btn').addEventListener('click', generateDescription);
});

let adminProducts = [];

async function loadAdminProducts() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Загрузка...</td></tr>';

  try {
    const res = await SF.fetch('/api/admin/products');
    if (!res.ok) throw new Error('Ошибка загрузки');
    adminProducts = await res.json();
    renderAdminTable();
  } catch (err) {
    showToast(err.message, 'error');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger)">Не удалось загрузить товары</td></tr>';
  }
}

function renderAdminTable() {
  const tbody = document.getElementById('products-tbody');
  if (adminProducts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center">Товары отсутствуют</td></tr>';
    return;
  }

  tbody.innerHTML = adminProducts.map(p => `
    <tr>
      <td>${p.id}</td>
      <td><img src="${p.image}" class="product-thumb" onerror="this.src='https://placehold.co/40x40?text=?'"></td>
      <td>${p.brand}</td>
      <td>${p.name}</td>
      <td>${p.price.toLocaleString('ru-RU')} ₽</td>
      <td class="actions-cell">
        <button class="btn btn-ghost btn-sm" onclick="openModal(${p.id})">⚙️</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="deleteProduct(${p.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function openModal(id = null) {
  const modal = document.getElementById('product-modal');
  const form = document.getElementById('product-form');
  const title = document.getElementById('modal-title');

  form.reset();
  document.getElementById('product-id').value = id || '';

  if (id) {
    const p = adminProducts.find(x => x.id === id);
    if (p) {
      title.innerText = 'Редактировать товар';
      document.getElementById('p-brand').value = p.brand;
      document.getElementById('p-name').value = p.name;
      document.getElementById('p-price').value = p.price;
      document.getElementById('p-volume').value = p.volume;
      document.getElementById('p-image').value = p.image;
      document.getElementById('p-notes').value = p.notes;
      document.getElementById('p-description').value = p.description;
    }
  } else {
    title.innerText = 'Добавить новый товар';
  }

  modal.style.display = 'flex';
  modal.classList.add('open');
}

function closeModal() {
  const modal = document.getElementById('product-modal');
  modal.style.display = 'none';
  modal.classList.remove('open');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('product-id').value;

  // Default values for internal engine
  const brandValue = document.getElementById('p-brand').value;
  const brandSlug = brandValue.toLowerCase().replace(/\s+/g, '');

  const data = {
    brand: brandValue,
    name: document.getElementById('p-name').value,
    price: parseInt(document.getElementById('p-price').value),
    volume: document.getElementById('p-volume').value,
    image: document.getElementById('p-image').value,
    notes: document.getElementById('p-notes').value,
    description: document.getElementById('p-description').value,
    tags: [],
    profile: {
      occasions: ['daily'],
      vibes: ['fresh'],
      seasons: ['all'],
      tier: 'mid',
      brands: [brandSlug],
      versatile: true
    }
  };

  try {
    const url = id ? `/api/admin/products/${id}` : '/api/admin/products';
    const method = id ? 'PUT' : 'POST';

    const res = await SF.fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!res.ok) throw new Error('Ошибка сохранения');

    showToast(id ? 'Товар обновлен' : 'Товар добавлен', 'success');
    closeModal();
    loadAdminProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;

  try {
    const res = await SF.fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Ошибка удаления');

    showToast('Товар удален', 'success');
    loadAdminProducts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function generateDescription() {
  const name = document.getElementById('p-name').value;
  const brand = document.getElementById('p-brand').value;
  const btn = document.getElementById('generate-desc-btn');

  if (!name || !brand) {
    showToast('Сначала введите название и бренд', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerText = '⌛ Генерирую...';

  try {
    const res = await SF.fetch('/api/admin/generate-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, brand })
    });

    if (!res.ok) throw new Error('Ошибка ИИ');
    const data = await res.json();
    document.getElementById('p-description').value = data.description;
    showToast('Описание сгенерировано', 'success');
  } catch (err) {
    showToast('Не удалось сгенерировать описание', 'error');
  } finally {
    btn.disabled = false;
    btn.innerText = '✨ Сгенерировать ИИ-описание';
  }
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.innerText = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3000);
}
