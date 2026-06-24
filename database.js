const fs = require('fs');
const path = require('path');
const { perfumes } = require('./products');

const DB_FILE = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], orders: [], balance_transactions: [], nextId: { users: 1, orders: 1, balance_transactions: 1 } };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function now() {
  return new Date().toISOString();
}

const db = {
  getUserById(id) {
    return load().users.find(u => u.id === id) || null;
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
    const user = data.users.find(u => u.id === userId);
    if (!user) return null;
    user.balance += delta;
    save(data);
    return user;
  },

  addBalanceTransaction(userId, amount, type) {
    const data = load();
    data.balance_transactions.push({
      id: data.nextId.balance_transactions++,
      user_id: userId,
      amount,
      type,
      created_at: now()
    });
    save(data);
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
    return load().orders
      .filter(o => o.user_id === userId)
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
    order.status = status;
    save(data);
    return order;
  }
};

module.exports = { db, perfumes };
