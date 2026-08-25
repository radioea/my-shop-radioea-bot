      
require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

// ==================== КОНФИГУРАЦИЯ ====================
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 5179932939;
const PORT = process.env.PORT || 3000;
const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:" + PORT;

if (!BOT_TOKEN) {
  console.error("Ошибка: BOT_TOKEN не указан в .env файле!");
  console.log("Создайте файл .env и добавьте: BOT_TOKEN=ваш_токен");
  process.exit(1);
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");
const STATUS_FILE = path.join(DATA_DIR, "status.json");
const CART_FILE = path.join(DATA_DIR, "cart.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function initDB() {
  var files = [ORDERS_FILE, REVIEWS_FILE, STATUS_FILE, CART_FILE];
  for (var i = 0; i < files.length; i++) {
    if (!fs.existsSync(files[i])) {
      fs.writeFileSync(files[i], JSON.stringify([]));
    }
  }
}
initDB();

function readJSON(file) {
  try {
    var data = fs.readFileSync(file, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Ошибка чтения " + file + ":", error.message);
    return [];
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Ошибка записи " + file + ":", error.message);
  }
}

function getOrders() { return readJSON(ORDERS_FILE); }
function getReviews() { return readJSON(REVIEWS_FILE); }
function getStatuses() { return readJSON(STATUS_FILE); }
function getCarts() { return readJSON(CART_FILE); }

function saveOrders(orders) { writeJSON(ORDERS_FILE, orders); }
function saveReviews(reviews) { writeJSON(REVIEWS_FILE, reviews); }
function saveStatuses(statuses) { writeJSON(STATUS_FILE, statuses); }
function saveCarts(carts) { writeJSON(CART_FILE, carts); }

function getUserCart(userId) {
  var carts = getCarts();
  var cart = null;
  for (var i = 0; i < carts.length; i++) {
    if (carts[i].userId === userId) {
      cart = carts[i];
      break;
    }
  }
  if (!cart) {
    cart = { userId: userId, items: [] };
    carts.push(cart);
    saveCarts(carts);
  }
  return cart;
}

function saveUserCart(userId, items) {
  var carts = getCarts();
  var found = false;
  for (var i = 0; i < carts.length; i++) {
    if (carts[i].userId === userId) {
      carts[i].items = items;
      found = true;
      break;
    }
  }
  if (!found) {
    carts.push({ userId: userId, items: items });
  }
  saveCarts(carts);
}

function addReview(review) {
  var reviews = getReviews();
  var newId = 1;
  if (reviews.length > 0) {
    newId = reviews[reviews.length - 1].id + 1;
  }
  var newReview = {
    id: newId,
    text: review.text,
    rating: review.rating,
    author: review.author,
    date: new Date().toISOString()
  };
  reviews.push(newReview);
  saveReviews(reviews);
  return newReview;
}

// ==================== ТОВАРЫ (сокращённо, но все ключевые) ====================
var products = {
  "esp32 devkit": {
    name: "ESP32 DevKit V1",
    price: "19 BYN",
    status: "✅ В наличии",
    photo: "https://via.placeholder.com/400x300/667eea/ffffff?text=ESP32",
    keywords: ["esp32", "devkit", "esp"],
    category: "Микроконтроллеры",
    description: "Мощный микроконтроллер с Wi-Fi и Bluetooth"
  },
  "esp8266": {
    name: "ESP8266 NodeMCU",
    price: "15 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/764ba2/ffffff?text=ESP8266",
    keywords: ["esp8266", "nodemcu", "wifi"],
    category: "Микроконтроллеры",
    description: "Популярный Wi-Fi модуль для IoT проектов"
  },
  "arduino nano": {
    name: "Arduino Nano V3",
    price: "14 BYN",
    status: "✅ В наличии",
    photo: "https://via.placeholder.com/400x300/00b894/ffffff?text=Arduino+Nano",
    keywords: ["arduino", "nano"],
    category: "Микроконтроллеры",
    description: "Компактная плата Arduino с Type-C"
  },
  "arduino uno": {
    name: "Arduino Uno R3",
    price: "25 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/e17055/ffffff?text=Arduino+Uno",
    keywords: ["arduino", "uno"],
    category: "Микроконтроллеры",
    description: "Классическая плата Arduino Uno R3"
  },
  "oled 0.96": {
    name: "OLED 0.96\" I2C (SSD1306)",
    price: "9 BYN",
    status: "✅ В наличии",
    photo: "https://via.placeholder.com/400x300/00cec9/ffffff?text=OLED+0.96",
    keywords: ["oled", "0.96", "ssd1306", "дисплей"],
    category: "Дисплеи",
    description: "Маленький OLED дисплей 0.96 дюйма"
  },
  "hc-sr04": {
    name: "HC-SR04 ультразвуковой датчик",
    price: "10 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/00b894/ffffff?text=HC-SR04",
    keywords: ["hc-sr04", "ультразвук", "датчик"],
    category: "Датчики",
    description: "Ультразвуковой датчик расстояния"
  },
  "bc547": {
    name: "BC547 (NPN) 10 шт.",
    price: "5 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/e17055/ffffff?text=BC547",
    keywords: ["bc547", "транзистор", "npn"],
    category: "Транзисторы",
    description: "NPN биполярный транзистор, 10 штук"
  },
  "ne555": {
    name: "NE555 таймер",
    price: "3 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/fdcb6e/333333?text=NE555",
    keywords: ["ne555", "555", "таймер"],
    category: "Микросхемы",
    description: "Классический таймер NE555"
  },
  "7805": {
    name: "7805 +5V стабилизатор",
    price: "3 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/0984e3/ffffff?text=7805",
    keywords: ["7805", "стабилизатор", "5v"],
    category: "Стабилизаторы",
    description: "Линейный стабилизатор напряжения +5В"
  },
  "реле 1": {
    name: "Реле 5V 1-канальное",
    price: "4 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/6c5ce7/ffffff?text=Relay+1",
    keywords: ["реле", "relay", "1 канал"],
    category: "Реле и драйверы",
    description: "Одноканальное реле на 5В"
  },
  "sg90": {
    name: "SG90 микро-серво",
    price: "6 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/e84393/ffffff?text=SG90",
    keywords: ["sg90", "серво", "servo"],
    category: "Моторы и серво",
    description: "Микро-сервопривод SG90 9г"
  },
  "12v 2a": {
    name: "12V 2A адаптер",
    price: "10 BYN",
    status: "🚚 Под заказ (14–30 дней)",
    photo: "https://via.placeholder.com/400x300/00cec9/ffffff?text=12V+2A",
    keywords: ["блок питания", "12v", "2a", "адаптер"],
    category: "Блоки питания",
    description: "Блок питания 12В 2А"
  }
};

// ==================== ПОИСКОВАЯ СИСТЕМА ====================
function buildIndex() {
  var index = {};
  for (var key in products) {
    if (products.hasOwnProperty(key)) {
      var product = products[key];
      var texts = [
        key.toLowerCase(),
        product.name.toLowerCase(),
        product.category.toLowerCase(),
        product.description.toLowerCase()
      ];
      if (product.keywords) {
        for (var i = 0; i < product.keywords.length; i++) {
          texts.push(product.keywords[i].toLowerCase());
}
      }
      var words = {};
      for (var t = 0; t < texts.length; t++) {
        var clean = texts[t].replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
        var parts = clean.split(" ");
        for (var p = 0; p < parts.length; p++) {
          var w = parts[p];
          if (w.length > 1) {
            words[w] = true;
          }
        }
      }
      for (var w2 in words) {
        if (words.hasOwnProperty(w2)) {
          if (!index[w2]) index[w2] = [];
          if (index[w2].indexOf(key) === -1) {
            index[w2].push(key);
          }
        }
      }
    }
  }
  return index;
}

var invertedIndex = buildIndex();

function search(query) {
  var cleanQuery = query.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleanQuery) return [];

  var words = cleanQuery.split(" ");
  var results = {};
  var scores = {};

  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (invertedIndex[word]) {
      var keys = invertedIndex[word];
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var product = products[key];
        var score = 0;
        if (key.indexOf(word) !== -1) score += 5;
        if (product.name.toLowerCase().indexOf(word) !== -1) score += 4;
        if (product.category.toLowerCase().indexOf(word) !== -1) score += 3;
        if (product.keywords) {
          for (var k = 0; k < product.keywords.length; k++) {
            if (product.keywords[k].toLowerCase().indexOf(word) !== -1) {
              score += 2;
              break;
            }
          }
        }
        if (score > 0) {
          if (!scores[key]) scores[key] = 0;
          scores[key] += score;
          results[key] = product;
        }
      }
    }
  }

  var sorted = Object.keys(results).sort(function(a, b) {
    return (scores[b]  0) - (scores[a]  0);   // <-- ИСПРАВЛЕНО
  });

  return sorted.map(function(key) {
    return { key: key, product: results[key], score: scores[key] || 0 };
  });
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getStars(rating) {
  return "⭐".repeat(rating) + "☆".repeat(5 - rating);
}

function formatCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return "🛒 Корзина пуста";
  var text = "🛒 ВАША КОРЗИНА:\n\n";
  var total = 0;
  for (var i = 0; i < cartItems.length; i++) {
    var item = cartItems[i];
    var product = products[item.key];
    if (product) {
      var price = parseFloat(product.price);
      var subtotal = price * (item.quantity || 1);
      text = text + (i + 1) + ". " + product.name + "\n";
      text = text + "   💰 " + product.price + " × " + (item.quantity || 1) + " = " + subtotal.toFixed(2) + " BYN\n\n";
      total += subtotal;
    }
  }
  text = text + "💵 ИТОГО: " + total.toFixed(2) + " BYN";
  return text;
}

// ==================== СОЗДАНИЕ БОТА ====================
var bot = new Telegraf(BOT_TOKEN);
bot.use(session({
  defaultSession: function() {
    return { cart: [], rating: null, currentOrder: null };
  }
}));

var app = express();
app.use(cors());
app.use(express.json());

// ==================== ВЕБ-СЕРВЕР ====================
app.get("/", function(req, res) {
  var html = "<!DOCTYPE html><html><head><title>RadioPartsBY Bot</title><style>";
  html = html + "body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }";
  html = html + ".container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }";
  html = html + "h1 { color: #333; } .status { color: #00b894; font-weight: bold; }";
  html = html + ".info { color: #666; margin: 20px 0; }</style></head><body>";
  html = html + '<div class="container"><h1>📦 RadioPartsBY</h1>';
  html = html + '<p class="status">✅ Бот работает!</p>';

  html = html + '<p class="info">Telegram бот для магазина радиодеталей</p>';
  html = html + '<p style="margin-top:20px;color:#999;font-size:14px;">Товаров в каталоге: ' + Object.keys(products).length + '</p>';
  html = html + '</div></body></html>';
  res.send(html);
});

// ==================== API ЭНДПОИНТЫ ====================
app.get("/api/orders", function(req, res) {
  res.json(getOrders());
});

app.get("/api/reviews", function(req, res) {
  res.json(getReviews());
});

app.get("/api/products", function(req, res) {
  var statuses = getStatuses();
  var result = [];
  for (var key in products) {
    if (products.hasOwnProperty(key)) {
      var p = products[key];
      result.push({
        key: key,
        name: p.name,
        price: p.price,
        status: statuses[key] || p.status,
        category: p.category,
        description: p.description,
        photo: p.photo,
        keywords: p.keywords
      });
    }
  }
  res.json(result);
});

app.get("/api/search", function(req, res) {
  var query = req.query.q || "";
  var results = search(query);
  res.json(results);
});

// ==================== КОМАНДЫ БОТА ====================

bot.start(function(ctx) {
  var keyboard = Markup.keyboard([
    ["🛒 Каталог", "📦 Корзина", "📦 Статус"],
    ["🔍 Поиск", "📞 Помощь", "⭐ Оставить отзыв"]
  ]).resize();
  ctx.reply(
    "👋 Добро пожаловать в RadioPartsBY!\n\n" +
    "🔍 Просто напишите название товара для поиска!\n" +
    "✅ В наличии: ESP32 DevKit, Arduino Nano, OLED 0.96\"\n" +
    "🚚 Остальное — под заказ (14–30 дней)",
    keyboard
  );
});

bot.hears("🔍 Поиск", function(ctx) {
  ctx.reply("🔍 Введите запрос для поиска:\n\nПримеры:\n• esp32\n• дисплей\n• транзистор\n• реле");
});

bot.hears("🛒 Каталог", function(ctx) {
  var categories = {};
  for (var key in products) {
    if (products.hasOwnProperty(key)) {
      var p = products[key];
      var cat = p.category || "Другое";
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(key);
    }
  }
  var text = "📦 КАТАЛОГ:\n\n";
  for (var cat2 in categories) {
    if (categories.hasOwnProperty(cat2)) {
      text = text + "🔹 " + cat2 + " (" + categories[cat2].length + ")\n";
    }
  }
  text = text + "\n🔍 Напишите название для поиска";
  ctx.reply(text);
});

bot.hears("📦 Корзина", function(ctx) {
  var cart = getUserCart(ctx.from.id);
  if (cart.items.length === 0) {
    return ctx.reply("🛒 Ваша корзина пуста");
  }
  var text = formatCart(cart.items);
  var keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("✅ Оформить заказ", "checkout")],
    [Markup.button.callback("🗑️ Очистить корзину", "clear_cart")]
  ]);
  ctx.reply(text, keyboard);
});

bot.hears("📦 Статус", function(ctx) {
  var orders = getOrders();
  var userOrders = [];
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].userId === ctx.from.id) {
      userOrders.push(orders[i]);
    }
  }
  if (userOrders.length === 0) {
    return ctx.reply("📭 У вас нет заказов");
  }
  var text = "📦 ВАШИ ЗАКАЗЫ:\n\n";
  var last = userOrders.slice(-5).reverse();
  for (var j = 0; j < last.length; j++) {
    var order = last[j];
    text = text + "#" + order.id + " — " + (order.status || "Новый") + "\n";
    text = text + "📅 " + new Date(order.date).toLocaleDateString() + "\n";
    text = text + "💵 " + (order.total || 0) + " BYN\n\n";
  }
  ctx.reply(text);
});

bot.hears("📞 Помощь", function(ctx) {
  ctx.reply(
    "📞 ПОМОЩЬ:\n\n" +
    "🔍 Как найти: напишите название в чат\n" +
    "📦 Как заказать: добавьте в корзину и оформите\n" +
    "⏰ Время работы: Пн-Пт 9:00–18:00"
  );
});

bot.hears("⭐ Оставить отзыв", function(ctx) {
  var keyboard = Markup.inlineKeyboard([
    [Markup.button.callback("⭐ 1", "rating_1"), Markup.button.callback("⭐⭐ 2", "rating_2"), Markup.button.callback("⭐⭐⭐ 3", "rating_3")],
    [Markup.button.callback("⭐⭐⭐⭐ 4", "rating_4"), Markup.button.callback("⭐⭐⭐⭐⭐ 5", "rating_5")]
  ]);
  ctx.reply("⭐ Оцените наш магазин от 1 до 5 звёзд:", keyboard);
});

bot.action(/rating_([1-5])/, function(ctx) {
  var rating = parseInt(ctx.match[1]);
  ctx.answerCbQuery("Вы выбрали " + rating + " звёзд");
  ctx.session.rating = rating;
  ctx.reply("Вы выбрали " + getStars(rating) + "\n\nТеперь напишите текст отзыва:");
});

bot.on("text", function(ctx) {
  var text = ctx.message.text.trim();

  // Обработка отзыва
  if (ctx.session && ctx.session.rating && !text.startsWith("/") && !["🛒 Каталог", "📦 Корзина", "📦 Статус", "🔍 Поиск", "📞 Помощь", "⭐ Оставить отзыв"].includes(text)) {
    var rating = ctx.session.rating;
    var review = addReview({
      text: text,
      rating: rating,
      author: ctx.from.username  ctx.from.first_name  "Аноним"
    });
    ctx.session.rating = null;
    ctx.reply("✅ Спасибо за отзыв!\n\n⭐ " + getStars(rating) + "\n📝 " + text);
    return;
  }

  // Поиск
  if (!text.startsWith("/") && !["🛒 Каталог", "📦 Корзина", "📦 Статус", "🔍 Поиск", "📞 Помощь", "⭐ Оставить отзыв"].includes(text)) {
    var results = search(text);

    if (results.length === 0) {
      return ctx.reply("🤷 Ничего не найдено. Попробуйте другие ключевые слова");
    }

    if (results.length === 1) {
      var r = results[0];
      var key = r.key;
      var product = r.product;
      var statuses = getStatuses();
      var status = statuses[key] || product.status;
      var keyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🛒 В корзину", "add_to_cart_" + key)]
      ]);
      ctx.replyWithPhoto(product.photo, {
        caption: "📦 " + product.name + "\n💰 " + product.price + "\n" + status + "\n\n" + product.description,
        reply_markup: keyboard.reply_markup
      });
      return;
    }

    var response = "🔍 Найдено " + results.length + " товаров:\n\n";
    for (var i = 0; i < Math.min(results.length, 10); i++) {
      var item = results[i];
      var st = getStatuses()[item.key] || item.product.status;
      var icon = st.indexOf("✅") !== -1 ? "✅" : "🚚";
      response = response + icon + " " + item.product.name + " — " + item.product.price + "\n";
    }
    if (results.length > 10) response = response + "\n... и еще " + (results.length - 10);
    ctx.reply(response);
  }
});

bot.action(/add_to_cart_(.+)/, function(ctx) {
  var key = ctx.match[1];
  var product = products[key];
  if (!product) return ctx.answerCbQuery("❌ Товар не найден");

  var cart = getUserCart(ctx.from.id);
  var existing = null;
  for (var i = 0; i < cart.items.length; i++) {
    if (cart.items[i].key === key) {
      existing = cart.items[i];
      break;
    }
  }
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.items.push({ key: key, quantity: 1 });
  }
  saveUserCart(ctx.from.id, cart.items);

  ctx.answerCbQuery("✅ Добавлено в корзину!");
  ctx.reply("✅ " + product.name + " добавлен в корзину!\n\nПерейдите в 📦 Корзина для оформления");
});

bot.action("clear_cart", function(ctx) {
  saveUserCart(ctx.from.id, []);
  ctx.answerCbQuery("🗑️ Корзина очищена");
  ctx.reply("🗑️ Корзина очищена");
});

bot.action("checkout", function(ctx) {
  var cart = getUserCart(ctx.from.id);
  if (cart.items.length === 0) {
    return ctx.answerCbQuery("❌ Корзина пуста");
  }
  ctx.session.currentOrder = {
    cart: cart.items,
    step: "address"
  };
  ctx.reply(
    "📝 ОФОРМЛЕНИЕ ЗАКАЗА\n\nШаг 1/3: Введите адрес доставки:",
    Markup.inlineKeyboard([[Markup.button.callback("❌ Отмена", "cancel_order")]])
  );
});

bot.action("cancel_order", function(ctx) {
  ctx.session.currentOrder = null;
  ctx.reply("❌ Оформление заказа отменено");
});

// Второй обработчик текста для оформления заказа (должен быть до остальных)
bot.on("text", function(ctx) {
  var order = ctx.session.currentOrder;
  if (!order) return;
  if (["🛒 Каталог", "📦 Корзина", "📦 Статус", "🔍 Поиск", "📞 Помощь", "⭐ Оставить отзыв"].includes(ctx.message.text)) return;

  var text = ctx.message.text.trim();

  if (order.step === "address") {
    order.address = text;
    order.step = "phone";
    ctx.reply("📝 Шаг 2/3: Введите номер телефона:");
  } else if (order.step === "phone") {
    order.phone = text;
    order.step = "confirm";

    var orderText = "✅ ПОДТВЕРДИТЕ ЗАКАЗ:\n\n";
    var total = 0;
    for (var i = 0; i < order.cart.length; i++) {
      var item = order.cart[i];
      var product = products[item.key];
      if (product) {
        var price = parseFloat(product.price);
        var subtotal = price * (item.quantity || 1);
        orderText = orderText + "• " + product.name + " x" + (item.quantity || 1) + " = " + subtotal.toFixed(2) + " BYN\n";
        total += subtotal;
      }
    }
    orderText = orderText + "\n💵 Итого: " + total.toFixed(2) + " BYN";
    orderText = orderText + "\n📍 " + order.address;
    orderText = orderText + "\n📱 " + order.phone;

    ctx.reply(orderText, Markup.inlineKeyboard([
      [Markup.button.callback("✅ Подтвердить", "confirm_order")],
      [Markup.button.callback("❌ Отмена", "cancel_order")]
    ]));
  }
});

bot.action("confirm_order", function(ctx) {
  var order = ctx.session.currentOrder;
  if (!order) return;

  var orders = getOrders();
  var newOrder = {
    id: orders.length + 1,
    userId: ctx.from.id,
    items: order.cart,
    total: 0,
    address: order.address,
    phone: order.phone,
    status: "Новый",
    date: new Date().toISOString()
  };

  for (var i = 0; i < order.cart.length; i++) {
    var item = order.cart[i];
    var product = products[item.key];
    if (product) {
      newOrder.total += parseFloat(product.price) * (item.quantity || 1);
    }
  }

  orders.push(newOrder);
  saveOrders(orders);
  saveUserCart(ctx.from.id, []);
  ctx.session.currentOrder = null;

  ctx.reply("✅ ЗАКАЗ #" + newOrder.id + " ОФОРМЛЕН!\n\nСпасибо за покупку!");

  bot.telegram.sendMessage(
    ADMIN_ID,
    "📦 НОВЫЙ ЗАКАЗ #" + newOrder.id + "\n\n" +
    "👤 " + ctx.from.first_name + "\n" +
    "📍 " + newOrder.address + "\n" +
    "📱 " + newOrder.phone + "\n" +
    "💵 " + newOrder.total.toFixed(2) + " BYN"
  );
});

// ==================== АДМИН-КОМАНДЫ ====================
bot.command("status", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var orders = getOrders();
  var reviews = getReviews();
  var avgRating = 0;
  if (reviews.length > 0) {
    var sum = 0;
    for (var i = 0; i < reviews.length; i++) {
      sum += reviews[i].rating || 0;
    }
    avgRating = (sum / reviews.length).toFixed(1);
  }
  ctx.reply(
    "📊 СТАТИСТИКА:\n\n" +
    "📦 Заказов: " + orders.length + "\n" +
    "⭐ Отзывов: " + reviews.length + "\n" +
    "📈 Рейтинг: " + avgRating + " " + getStars(Math.round(avgRating))
  );
});

bot.command("export", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var orders = getOrders();
  if (orders.length === 0) return ctx.reply("📭 Нет заказов");
  var filePath = path.join(DATA_DIR, "export_orders.json");
  fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
  ctx.replyWithDocument(
    { source: filePath, filename: "orders_" + new Date().toISOString().slice(0, 10) + ".json" },
    { caption: "📦 Экспорт заказов (" + orders.length + " шт.)" }
  );
  fs.unlinkSync(filePath);
});

bot.command("set_status", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var args = ctx.message.text.split(" ");
  if (args.length < 3) {
    return ctx.reply("⚠️ Используйте: /set_status \"ключ\" \"статус\"\n\nПример: /set_status \"esp32 devkit\" \"✅ В наличии\"");
  }
  var key = args.slice(1, -1).join(" ").toLowerCase();
  var newStatus = args.slice(-1).join(" ");
  if (!products[key]) {
    var keysList = Object.keys(products).slice(0, 10).join(", ");
    return ctx.reply("❌ Товар не найден. Доступные ключи:\n" + keysList + "...");
  }
  var statuses = getStatuses();
  statuses[key] = newStatus;
  saveStatuses(statuses);
  ctx.reply("✅ Статус товара \"" + products[key].name + "\" изменён на:\n" + newStatus);
});

bot.command("reset_status", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var args = ctx.message.text.split(" ");
  if (args.length < 2) return ctx.reply("⚠️ Используйте: /reset_status \"ключ\"");
  var key = args.slice(1).join(" ").toLowerCase();
  if (!products[key]) return ctx.reply("❌ Товар не найден");
  var statuses = getStatuses();
  if (statuses[key]) {
    delete statuses[key];
    saveStatuses(statuses);
    ctx.reply("✅ Статус товара \"" + products[key].name + "\" сброшен до значения из кода.");
  } else {
    ctx.reply("ℹ️ У товара \"" + products[key].name + "\" не было переопределённого статуса.");
  }
});

bot.command("delete_order", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var args = ctx.message.text.split(" ");
  if (args.length < 2) return ctx.reply("⚠️ Укажите номер заказа: /delete_order 123");
  var orderId = parseInt(args[1]);
  if (isNaN(orderId)) return ctx.reply("⚠️ Номер должен быть числом.");
  var orders = getOrders();
  var index = -1;
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].id === orderId) { index = i; break; }
  }
  if (index === -1) return ctx.reply("❌ Заказ #" + orderId + " не найден.");
  orders.splice(index, 1);
  saveOrders(orders);
  ctx.reply("✅ Заказ #" + orderId + " удалён.");
});

bot.command("delete_review", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var args = ctx.message.text.split(" ");
  if (args.length < 2) return ctx.reply("⚠️ Укажите номер отзыва: /delete_review 123");
  var reviewId = parseInt(args[1]);
  if (isNaN(reviewId)) return ctx.reply("⚠️ Номер должен быть числом.");
  var reviews = getReviews();
  var index = -1;
  for (var i = 0; i < reviews.length; i++) {
    if (reviews[i].id === reviewId) { index = i; break; }
  }
  if (index === -1) return ctx.reply("❌ Отзыв #" + reviewId + " не найден.");
  reviews.splice(index, 1);
  saveReviews(reviews);
  ctx.reply("✅ Отзыв #" + reviewId + " удалён.");
});

// ==================== ЗАПУСК ====================
var server = app.listen(PORT, function() {
  console.log("✅ Веб-сервер запущен на порту " + PORT);
  console.log("🌐 Админ-панель: " + PUBLIC_URL);
});

bot.launch()
  .then(function() {
    console.log("✅ Бот запущен!");
    console.log("📱 Бот: https://t.me/" + bot.botInfo.username);
    console.log("📊 Товаров в каталоге: " + Object.keys(products).length);
  })
  .catch(function(err) {
    console.error("❌ Ошибка запуска бота:", err.message);
    process.exit(1);
  });

process.once("SIGINT", function() {
  bot.stop("SIGINT");
  server.close();
});
process.once("SIGTERM", function() {
  bot.stop("SIGTERM");
  server.close();
});

console.log("✅ Бот готов к работе!");


        
