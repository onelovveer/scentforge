const perfumes = [
  {
    id: 1,
    name: 'Sauvage',
    brand: 'Dior',
    price: 11900,
    volume: '100 ml',
    notes: 'Bergamot, перец, ambroxan',
    description: 'Легендарный мужской аромат. Свежий, пряный, с мощным шлейфом.',
    image: 'images/perfumes/dior-sauvage.jpg',
    tags: ['свежий', 'пряный', 'смелый', 'вечерний', 'стойкий'],
    profile: {
      occasions: ['evening', 'date', 'daily', 'party', 'gift'],
      vibes: ['fresh', 'bold', 'romantic'],
      seasons: ['summer', 'all'],
      tier: 'premium',
      brands: ['dior'],
      versatile: true
    }
  },
  {
    id: 2,
    name: 'Bleu de Chanel',
    brand: 'Chanel',
    price: 11500,
    volume: '100 ml',
    notes: 'Цитрус, ладан, кедр, сандал',
    description: 'Элегантный универсальный аромат для офиса и вечера.',
    image: 'images/perfumes/bleu-de-chanel.jpg',
    tags: ['элегантный', 'универсальный', 'древесный', 'офис'],
    profile: {
      occasions: ['office', 'daily', 'evening', 'gift'],
      vibes: ['woody', 'fresh', 'subtle', 'luxury'],
      seasons: ['all'],
      tier: 'premium',
      brands: ['chanel'],
      versatile: true
    }
  },
  {
    id: 3,
    name: 'Ombré Leather',
    brand: 'Tom Ford',
    price: 16500,
    volume: '100 ml',
    notes: 'Кожа, фиалка, жасмин, мох',
    description: 'Роскошный кожаный аромат. Брутальный и соблазнительный.',
    image: 'images/perfumes/tom-ford-ombre-leather.jpg',
    tags: ['кожаный', 'брутальный', 'люкс', 'вечерний'],
    profile: {
      occasions: ['evening', 'date', 'party'],
      vibes: ['leather', 'bold', 'luxury', 'romantic'],
      seasons: ['winter', 'all'],
      tier: 'luxury',
      brands: ['tomford'],
      versatile: false
    }
  },
  {
    id: 4,
    name: 'Acqua di Giò',
    brand: 'Giorgio Armani',
    price: 7900,
    volume: '100 ml',
    notes: 'Морские ноты, bergamot, розмарин, мускус',
    description: 'Классика. Свежий морской аромат на каждый день.',
    image: 'images/perfumes/acqua-di-gio.jpg',
    tags: ['свежий', 'морской', 'лёгкий', 'офис'],
    profile: {
      occasions: ['office', 'daily', 'sport', 'gift'],
      vibes: ['fresh', 'subtle'],
      seasons: ['summer', 'all'],
      tier: 'mid',
      brands: ['armani'],
      versatile: true
    }
  },
  {
    id: 5,
    name: 'Eros',
    brand: 'Versace',
    price: 6900,
    volume: '100 ml',
    notes: 'Мята, зелёное яблоко, ваниль, кедр',
    description: 'Энергичный сладкий аромат. Отличный бюджетный выбор.',
    image: 'images/perfumes/versace-eros.jpg',
    tags: ['сладкий', 'энергичный', 'вечерний', 'молодёжный'],
    profile: {
      occasions: ['date', 'evening', 'party', 'daily'],
      vibes: ['sweet', 'bold', 'romantic'],
      seasons: ['all'],
      tier: 'budget',
      brands: ['versace'],
      versatile: true
    }
  },
  {
    id: 6,
    name: 'Y Eau de Parfum',
    brand: 'Yves Saint Laurent',
    price: 9800,
    volume: '100 ml',
    notes: 'Шалфей, имбирь, бобы тонка, vetiver',
    description: 'Современная классика. Свежий и древесный.',
    image: 'images/perfumes/ysl-y.jpg',
    tags: ['свежий', 'древесный', 'универсальный', 'офис'],
    profile: {
      occasions: ['office', 'daily', 'date', 'gift'],
      vibes: ['fresh', 'woody', 'subtle'],
      seasons: ['all'],
      tier: 'mid',
      brands: ['ysl'],
      versatile: true
    }
  },
  {
    id: 7,
    name: 'Millésime Impérial',
    brand: 'Creed',
    price: 24500,
    volume: '100 ml',
    notes: 'Мандарин, морские ноты, мускус, амбра',
    description: 'Нишевый люкс. Цитрусовая свежесть и статус.',
    image: 'images/perfumes/creed-imperial.jpg',
    tags: ['люкс', 'премиум', 'свежий', 'статусный'],
    profile: {
      occasions: ['daily', 'office', 'gift', 'evening'],
      vibes: ['fresh', 'luxury'],
      seasons: ['summer', 'all'],
      tier: 'luxury',
      brands: ['creed'],
      versatile: false
    }
  },
  {
    id: 8,
    name: 'Stronger With You',
    brand: 'Emporio Armani',
    price: 8200,
    volume: '100 ml',
    notes: 'Кардамон, фиалка, каштан, ваниль',
    description: 'Тёплый сладкий аромат. Идеален для свиданий.',
    image: 'images/perfumes/emporio-armani.jpg',
    tags: ['сладкий', 'тёплый', 'романтичный', 'ванильный'],
    profile: {
      occasions: ['date', 'evening', 'gift'],
      vibes: ['sweet', 'romantic', 'bold'],
      seasons: ['winter', 'all'],
      tier: 'mid',
      brands: ['armani'],
      versatile: false
    }
  }
];

module.exports = { perfumes };
