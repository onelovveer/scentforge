const fs = require('fs');
const path = require('path');
const { perfumes } = require('./products');

const DB_FILE = path.join(__dirname, 'data.json');

function load() {
  let data;
  if (!fs.existsSync(DB_FILE)) {
    data = {
      users: [],
      orders: [],
      balance_transactions: [],
      products: [],
      nextId: { users: 1, orders: 1, balance_transactions: 1, products: 1 }
    };
  } else {
    data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  }

  // Seed products if missing or empty on first run
  if (!data.products || (data.products.length === 0 && (!data.nextId.products || data.nextId.products === 1))) {
    data.products = JSON.parse(JSON.stringify(perfumes));
    const maxId = data.products.reduce((max, p) => Math.max(max, p.id || 0), 0);
    data.nextId = data.nextId || {};
    data.nextId.products = maxId + 1;
    if (!data.nextId.users) data.nextId.users = 1;
    if (!data.nextId.orders) data.nextId.orders = 1;
    if (!data.nextId.balance_transactions) data.nextId.balance_transactions = 1;
    save(data);
  }
  return data;
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function now() {
  return new Date().toISOString();
}

const db = {
  getUserById(id) {
    const numId = Number(id);
    return load().users.find(u => u.id === numId || u.id === id) || null;
  },

  getUserByGoogleId(googleId) {
    return load().users.find(u => u.google_id === googleId) || null;
  },

  getUserCount() {
    return load().users.length;
  },

  createUser({ google_id, email, name, avatar, is_admin }) {
    const data = load();
    const user = {
      id: data.nextId.users++,
      google_id,
      email,
      name,
      avatar,
      balance: 0,
      is_admin: is_admin ? 1 : 0,
      created_at: now()
    };
    data.users.push(user);
    save(data);
    return user;
  },

  updateUser(id, { name, avatar, is_admin, email }) {
    const data = load();
    const user = data.users.find(u => u.id === id);
    if (!user) return null;
    if (name !== undefined) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    if (email !== undefined) user.email = email;
    if (is_admin !== undefined) user.is_admin = is_admin ? 1 : 0;
    save(data);
    return user;
  },

  updateBalance(userId, delta) {
    const data = load();
    const numId = Number(userId);
    const user = data.users.find(u => u.id === numId || u.id === userId);
    if (!user) return null;
    user.balance += delta;
    save(data);
    return user;
  },

  addBalanceTransaction(userId, amount, type, orderId = null) {
    const data = load();
    const tx = {
      id: data.nextId.balance_transactions++,
      user_id: userId,
      amount,
      type,
      created_at: now()
    };
    if (orderId != null) tx.order_id = orderId;
    data.balance_transactions.push(tx);
    save(data);
  },

  checkoutOrder({ user_id, user_email, user_name, items, total }) {
    const data = load();
    const numId = Number(user_id);
    const user = data.users.find(u => u.id === numId || u.id === user_id);
    if (!user) return { error: 'Пользователь не найден' };
    if (user.balance < total) {
      return {
        error: `Недостаточно средств. Нужно ${total.toLocaleString('ru-RU')} ₽, на балансе ${user.balance.toLocaleString('ru-RU')} ₽`,
        balance: user.balance
      };
    }

    user.balance -= total;

    const order = {
      id: data.nextId.orders++,
      user_id,
      user_email,
      user_name,
      items: JSON.stringify(items),
      total,
      status: 'completed',
      created_at: now()
    };
    data.orders.push(order);
    data.balance_transactions.push({
      id: data.nextId.balance_transactions++,
      user_id,
      amount: -total,
      type: 'purchase',
      order_id: order.id,
      created_at: now()
    });
    save(data);
    return { order, balance: user.balance };
  },

  createOrder({ user_id, user_email, user_name, items, total }) {
    const data = load();
    const order = {
      id: data.nextId.orders++,
      user_id,
      user_email,
      user_name,
      items: JSON.stringify(items),
      total,
      status: 'completed',
      created_at: now()
    };
    data.orders.push(order);
    save(data);
    return order;
  },

  getOrderById(id) {
    return load().orders.find(o => o.id === parseInt(id)) || null;
  },

  getOrdersByUserId(userId) {
    const numId = Number(userId);
    return load().orders
      .filter(o => o.user_id === numId || o.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getAllOrders() {
    return load().orders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },

  getStats() {
    const data = load();
    return {
      totalOrders: data.orders.length,
      totalRevenue: data.orders.reduce((s, o) => s + o.total, 0),
      totalUsers: data.users.length
    };
  },

  updateOrderStatus(id, status) {
    const data = load();
    const order = data.orders.find(o => o.id === parseInt(id));
    if (!order) return null;

    const prevStatus = order.status;
    order.status = status;

    if (status === 'cancelled' && prevStatus !== 'cancelled') {
      const user = data.users.find(u => u.id === order.user_id);
      if (user) {
        user.balance += order.total;
        data.balance_transactions.push({
          id: data.nextId.balance_transactions++,
          user_id: user.id,
          amount: order.total,
          type: 'refund',
          order_id: order.id,
          created_at: now()
        });
      }
    }

    save(data);
    return order;
  },

  // PRODUCT CRUD
  getAllProducts() {
    return load().products || [];
  },

  getProductById(id) {
    const numId = parseInt(id);
    return load().products.find(p => p.id === numId) || null;
  },

  createProduct(productData) {
    const data = load();
    const product = {
      ...productData,
      id: data.nextId.products++,
      created_at: now()
    };
    data.products.push(product);
    save(data);
    return product;
  },

  updateProduct(id, productData) {
    const data = load();
    const numId = parseInt(id);
    const index = data.products.findIndex(p => p.id === numId);
    if (index === -1) return null;

    data.products[index] = {
      ...data.products[index],
      ...productData,
      id: numId // Preserve original ID
    };
    save(data);
    return data.products[index];
  },

  deleteProduct(id) {
    const data = load();
    const numId = parseInt(id);
    const index = data.products.findIndex(p => p.id === numId);
    if (index === -1) return false;

    data.products.splice(index, 1);
    save(data);
    return true;
  }
};

module.exports = { db, perfumes };
