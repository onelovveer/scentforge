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
    if (existing.qty >= 99) {
      showToast('Максимум 99 шт. одного товара', 'error');
      return;
    }
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
  if (item.qty > 99) {
    item.qty = 99;
    showToast('Максимум 99 шт. одного товара', 'error');
  }
  saveCart(cart);
  renderCartPage();
}

function getCartTotal() {
  return getCart().reduce((s, i) => s + i.price * i.qty, 0);
}

async function syncCartPrices() {
  if (!SF.isServer) return false;

  try {
    const res = await SF.fetch('/api/products');
    if (!res.ok) return false;
    const products = await res.json();
    const cart = getCart();
    let changed = false;
    let removed = false;

    const validCart = cart.filter(item => {
      const product = products.find(p => p.id === item.id);
      if (!product) {
        removed = true;
        return false;
      }
      if (item.price !== product.price) {
        item.price = product.price;
        changed = true;
      }
      item.name = product.name;
      item.brand = product.brand;
      item.image = product.image;
      return true;
    });

    if (removed || validCart.length !== cart.length) {
      saveCart(validCart);
      showToast('Корзина обновлена: недоступные товары удалены', 'error');
      return true;
    }
    if (changed) {
      saveCart(validCart);
      showToast('Цены в корзине обновлены', 'success');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function updateCheckoutState(total) {
  const btn = document.getElementById('checkout-btn');
  const warningEl = document.getElementById('balance-warning');
  const balanceEl = document.getElementById('summary-balance');
  if (!btn) return;

  const balance = currentUser?.balance ?? 0;
  const canPay = currentUser && balance >= total;

  if (balanceEl) {
    balanceEl.textContent = formatPrice(balance);
  }

  if (warningEl) {
    if (currentUser && total > balance) {
      const shortage = total - balance;
      warningEl.style.display = 'block';
      warningEl.innerHTML = `Недостаточно средств. Не хватает <strong>${formatPrice(shortage)}</strong>. <a href="profile.html">Пополнить баланс</a>`;
    } else {
      warningEl.style.display = 'none';
      warningEl.innerHTML = '';
    }
  }

  btn.disabled = !canPay || total === 0;
  btn.textContent = canPay ? 'Оплатить с баланса' : 'Недостаточно средств';
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
  updateCheckoutState(total);

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

let checkoutInProgress = false;

async function initCartPage() {
  await syncCartPrices();
  renderCartPage();
  const btn = document.getElementById('checkout-btn');
  if (btn && !btn.dataset.checkoutBound) {
    btn.dataset.checkoutBound = '1';
    btn.addEventListener('click', checkout);
  }
}

function finishCheckoutSuccess(data) {
  localStorage.removeItem(CART_KEY);
  updateCartBadge();
  currentUser.balance = data.balance;
  updateHeaderUI();
  renderCartPage();

  const orderId = data.order?.id;
  const emailTo = data.email?.to;
  if (data.email?.sent) {
    showToast(`Заказ #${orderId} оформлен! Письмо отправлено на ${emailTo}`, 'success');
  } else if (emailTo) {
    showToast(`Заказ #${orderId} оформлен! Подтверждение придёт на ${emailTo}`, 'success');
  } else {
    showToast(`Заказ #${orderId} оформлен!`, 'success');
  }

  setTimeout(() => { window.location.href = 'profile.html'; }, 1500);
}

async function checkout() {
  if (checkoutInProgress) return;
  if (!requireAuth()) return;

  const cart = getCart();
  if (cart.length === 0) {
    showToast('Корзина пуста', 'error');
    return;
  }

  const total = getCartTotal();
  if (currentUser.balance < total) {
    showToast(`Недостаточно средств. Нужно ${formatPrice(total)}, на балансе ${formatPrice(currentUser.balance)}`, 'error');
    return;
  }

  const btn = document.getElementById('checkout-btn');
  if (!btn) return;

  checkoutInProgress = true;
  btn.disabled = true;
  btn.textContent = 'Оформление...';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await SF.fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cart }),
      signal: controller.signal
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Ошибка сервера. Проверьте профиль — заказ мог быть оформлен.');
    }

    if (!res.ok) throw new Error(data.error || 'Не удалось оформить заказ');
    if (!data.order?.id) throw new Error('Некорректный ответ сервера');

    finishCheckoutSuccess(data);
  } catch (err) {
    const message = err.name === 'AbortError'
      ? 'Сервер долго не отвечает. Проверьте профиль — заказ мог быть оформлен.'
      : (err.message || 'Не удалось оформить заказ');
    showToast(message, 'error');
    updateCheckoutState(getCartTotal());
  } finally {
    clearTimeout(timeoutId);
    checkoutInProgress = false;
  }
}

document.addEventListener('DOMContentLoaded', updateCartBadge);
