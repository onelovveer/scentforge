const FALLBACK_PRODUCTS = [
  {
    id: 1,
    name: 'Sauvage',
    brand: 'Dior',
    price: 11900,
    volume: '100 ml',
    notes: 'Bergamot, перец, ambroxan',
    description: 'Легендарный мужской аромат. Свежий, пряный, с мощным шлейфом. Один из самых популярных парфюмов в мире.',
    image: 'images/perfumes/dior-sauvage.jpg'
  },
  {
    id: 2,
    name: 'Bleu de Chanel',
    brand: 'Chanel',
    price: 11500,
    volume: '100 ml',
    notes: 'Цитрус, ладан, кедр, сандал',
    description: 'Аромат-воплощение элегантности. Универсальный, уверенный, подходит для офиса и вечера.',
    image: 'images/perfumes/bleu-de-chanel.jpg'
  },
  {
    id: 3,
    name: 'Ombré Leather',
    brand: 'Tom Ford',
    price: 16500,
    volume: '100 ml',
    notes: 'Кожа, фиалка, жасмин, мох',
    description: 'Роскошный кожаный аромат от Tom Ford. Брутальный, соблазнительный, с характером.',
    image: 'images/perfumes/tom-ford-ombre-leather.jpg'
  },
  {
    id: 4,
    name: 'Acqua di Giò',
    brand: 'Giorgio Armani',
    price: 7900,
    volume: '100 ml',
    notes: 'Морские ноты, bergamot, розмарин, мускус',
    description: 'Классика мужской парфюмерии с 1996 года. Свежий, морской, идеален для каждого дня.',
    image: 'images/perfumes/acqua-di-gio.jpg'
  },
  {
    id: 5,
    name: 'Eros',
    brand: 'Versace',
    price: 6900,
    volume: '100 ml',
    notes: 'Мята, зелёное яблоко, ваниль, кедр',
    description: 'Страстный и энергичный аромат. Мятная свежесть с тёплым ванильным базисом.',
    image: 'images/perfumes/versace-eros.jpg'
  },
  {
    id: 6,
    name: 'Y Eau de Parfum',
    brand: 'Yves Saint Laurent',
    price: 9800,
    volume: '100 ml',
    notes: 'Шалфей, имбирь, бобы тонка, vetiver',
    description: 'Современная классика YSL. Свежий и древесный, для уверенного мужчины.',
    image: 'images/perfumes/ysl-y.jpg'
  },
  {
    id: 7,
    name: 'Millésime Impérial',
    brand: 'Creed',
    price: 24500,
    volume: '100 ml',
    notes: 'Мандарин, морские ноты, мускус, амбра',
    description: 'Нишевый люкс от дома Creed. Цитрусовая свежесть с королевским шлейфом.',
    image: 'images/perfumes/creed-imperial.jpg'
  },
  {
    id: 8,
    name: 'Stronger With You',
    brand: 'Emporio Armani',
    price: 8200,
    volume: '100 ml',
    notes: 'Кардамон, фиалка, каштан, ваниль',
    description: 'Тёплый и обволакивающий аромат. Сладковатый, романтичный, стойкий.',
    image: 'images/perfumes/emporio-armani.jpg'
  }
];

function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  productsCache = products;

  grid.innerHTML = products.map(p => `
    <article class="product-card">
      <div class="product-image">
        <img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy">
      </div>
      <div class="product-info">
        <div class="product-brand">${p.brand}</div>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-notes">${p.notes} · ${p.volume}</p>
        <p class="product-desc">${p.description}</p>
        <div class="product-footer">
          <div>
            <div class="product-price">${formatPrice(p.price)}</div>
          </div>
          <button class="btn btn-primary btn-sm" data-product-id="${p.id}">
            В корзину
          </button>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('[data-product-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = productsCache.find(p => p.id === parseInt(btn.dataset.productId));
      if (product) addToCart(product);
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await initAuth();
  loadProducts();
});

let productsCache = [];

async function loadProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  try {
    const res = await SF.fetch('/api/products');
    if (!res.ok) throw new Error('API error');
    renderProducts(await res.json());
  } catch {
    renderProducts(FALLBACK_PRODUCTS);
  }
}
