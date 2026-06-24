const CART_KEY = 'scentforge_cart';

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const cart = getCart();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cart-count');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function addToCart(product) {
  if (!requireAuth()) return;

  const cart = getCart();
  const existing = cart.find(i => i.id === product.id);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: product.id, name: product.name, brand: product.brand, price: product.price, image: product.image, qty: 1 });
  }
  saveCart(cart);
  showToast(`${product.name} добавлен в корзину`, 'success');
}

function removeFromCart(id) {
  const cart = getCart().filter(i => i.id !== id);
  saveCart(cart);
  renderCartPage();
}

function changeQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(id);
    return;
  }
  saveCart(cart);
  renderCartPage();
}

function getCartTotal() {
  return getCart().reduce((s, i) => s + i.price * i.qty, 0);
}

function renderCartPage() {
  const itemsEl = document.getElementById('cart-items');
  if (!itemsEl) return;

  const cart = getCart();
  const emptyEl = document.getElementById('cart-empty');
  const contentEl = document.getElementById('cart-content');

  if (cart.length === 0) {
    if (contentEl) contentEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (contentEl) contentEl.style.display = 'block';
  if (emptyEl) emptyEl.style.display = 'none';

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-image">
        <img src="${item.image || 'images/perfumes/dior-sauvage.jpg'}" alt="${item.name}">
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-brand">${item.brand}</div>
        <div class="cart-item-price">${formatPrice(item.price)}</div>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
        <span>${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
      </div>
      <button class="remove-btn" onclick="removeFromCart(${item.id})" title="Удалить">✕</button>
    </div>
  `).join('');

  const total = getCartTotal();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('summary-count').textContent = count;
  document.getElementById('summary-total').textContent = formatPrice(total);

  const emailHint = document.getElementById('order-email-hint');
  const emailEl = document.getElementById('order-email');
  if (emailHint && emailEl) {
    if (currentUser?.email) {
      emailEl.textContent = currentUser.email;
      emailHint.style.display = 'block';
    } else {
      emailHint.style.display = 'none';
    }
  }
}

async function checkout() {
  if (!requireAuth()) return;

  const cart = getCart();
  if (cart.length === 0) {
    showToast('Корзина пуста', 'error');
    return;
  }

  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.textContent = 'Оформление...';

  try {
    const res = await SF.fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    localStorage.removeItem(CART_KEY);
    updateCartBadge();
    currentUser.balance = data.balance;
    updateHeaderUI();

    if (data.email?.sent) {
      showToast(`Заказ #${data.order.id} оформлен! Письмо отправлено на ${data.email.to}`, 'success');
    } else if (data.email?.to) {
      showToast(`Заказ #${data.order.id} оформлен! Подтверждение будет на ${data.email.to}`, 'success');
    } else {
      showToast(`Заказ #${data.order.id} оформлен!`, 'success');
    }
    setTimeout(() => window.location.href = '/profile.html', 1500);
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Оплатить с баланса';
  }
}

document.addEventListener('DOMContentLoaded', updateCartBadge);
