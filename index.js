
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

// ==================== ОБРАБОТКА ОШИБОК ====================
process.on('uncaughtException', function(err) {
  console.error("❌ Неперехваченная ошибка:", err.message);
});
process.on('unhandledRejection', function(reason) {
  console.error("❌ Необработанный reject:", reason);
});

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");
const STATUS_FILE = path.join(DATA_DIR, "status.json");
const CART_FILE = path.join(DATA_DIR, "cart.json");

if (fs.existsSync(DATA_DIR) && fs.statSync(DATA_DIR).isFile()) {
  fs.unlinkSync(DATA_DIR);
}
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
  try { var data = fs.readFileSync(file, "utf8"); return JSON.parse(data); }
  catch (e) { console.error("Ошибка чтения " + file + ":", e.message); return []; }
}
function writeJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch (e) { console.error("Ошибка записи " + file + ":", e.message); }
}

function getOrders() { return readJSON(ORDERS_FILE); }
function getReviews() { return readJSON(REVIEWS_FILE); }
function getStatuses() { return readJSON(STATUS_FILE); }
function getCarts() { return readJSON(CART_FILE); }
function saveOrders(o) { writeJSON(ORDERS_FILE, o); }
function saveReviews(r) { writeJSON(REVIEWS_FILE, r); }
function saveStatuses(s) { writeJSON(STATUS_FILE, s); }
function saveCarts(c) { writeJSON(CART_FILE, c); }

function getUserCart(userId) {
  var carts = getCarts();
  var cart = null;
  for (var i = 0; i < carts.length; i++) {
    if (carts[i].userId === userId) { cart = carts[i]; break; }
  }
  if (!cart) { cart = { userId: userId, items: [] }; carts.push(cart); saveCarts(carts); }
  return cart;
}
function saveUserCart(userId, items) {
  var carts = getCarts();
  var found = false;
  for (var i = 0; i < carts.length; i++) {
    if (carts[i].userId === userId) { carts[i].items = items; found = true; break; }
  }
  if (!found) carts.push({ userId: userId, items: items });
  saveCarts(carts);
}

function addReview(review) {
  var reviews = getReviews();
  var newId = reviews.length > 0 ? reviews[reviews.length - 1].id + 1 : 1;
  var newReview = { id: newId, text: review.text, rating: review.rating, author: review.author, date: new Date().toISOString() };
  reviews.push(newReview);
  saveReviews(reviews);
  return newReview;
}

// ==================== ТОВАРЫ ====================
var products = {
  "esp32 devkit": { name: "ESP32 DevKit V1", price: "19 BYN", status: "✅ В наличии", photo: "https://via.placeholder.com/400x300/667eea/ffffff?text=ESP32", keywords: ["esp32","devkit","esp"], category: "Микроконтроллеры", description: "Мощный микроконтроллер с Wi-Fi и Bluetooth" },
  "esp8266": { name: "ESP8266 NodeMCU", price: "15 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/764ba2/ffffff?text=ESP8266", keywords: ["esp8266","nodemcu","wifi"], category: "Микроконтроллеры", description: "Популярный Wi-Fi модуль для IoT проектов" },
 "arduino nano": { name: "Arduino Nano V3", price: "14 BYN", status: "✅ В наличии", photo: "https://via.placeholder.com/400x300/00b894/ffffff?text=Arduino+Nano", keywords: ["arduino","nano","nano v3"], category: "Микроконтроллеры", description: "Компактная плата Arduino с Type-C" },
  "arduino uno": { name: "Arduino Uno R3", price: "25 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/e17055/ffffff?text=Arduino+Uno", keywords: ["arduino","uno","uno r3"], category: "Микроконтроллеры", description: "Классическая плата Arduino Uno R3" },
  "arduino mega": { name: "Arduino Mega 2560", price: "35 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/fdcb6e/333333?text=Arduino+Mega", keywords: ["arduino","mega","mega 2560"], category: "Микроконтроллеры", description: "Мощная плата с большим количеством пинов" },
  "oled 0.96": { name: "OLED 0.96\" I2C (SSD1306)", price: "9 BYN", status: "✅ В наличии", photo: "https://via.placeholder.com/400x300/00cec9/ffffff?text=OLED+0.96", keywords: ["oled","0.96","ssd1306","дисплей"], category: "Дисплеи", description: "Маленький OLED дисплей 0.96 дюйма" },
  "oled 1.3": { name: "OLED 1.3\" I2C (SH1106)", price: "12 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/00b894/ffffff?text=OLED+1.3", keywords: ["oled","1.3","sh1106","дисплей"], category: "Дисплеи", description: "OLED дисплей 1.3 дюйма" },
  "lcd 1602": { name: "LCD 1602", price: "9 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/0984e3/ffffff?text=LCD+1602", keywords: ["lcd","1602","дисплей"], category: "Дисплеи", description: "Символьный LCD дисплей 16x2" },
  "lcd 2004": { name: "LCD 2004", price: "11 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/6c5ce7/ffffff?text=LCD+2004", keywords: ["lcd","2004","дисплей"], category: "Дисплеи", description: "Символьный LCD дисплей 20x4" },
  "hc-sr04": { name: "HC-SR04 ультразвуковой датчик", price: "10 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/00b894/ffffff?text=HC-SR04", keywords: ["hc-sr04","ультразвук","датчик"], category: "Датчики", description: "Ультразвуковой датчик расстояния" },
  "dht22": { name: "DHT22 температура/влажность", price: "14 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/0984e3/ffffff?text=DHT22", keywords: ["dht22","температура","влажность"], category: "Датчики", description: "Цифровой датчик температуры и влажности" },
  "dht11": { name: "DHT11 температура/влажность", price: "8 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/6c5ce7/ffffff?text=DHT11", keywords: ["dht11","температура","влажность"], category: "Датчики", description: "Бюджетный датчик температуры и влажности" },
  "bc547": { name: "BC547 (NPN) 10 шт.", price: "5 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/e17055/ffffff?text=BC547", keywords: ["bc547","транзистор","npn"], category: "Транзисторы", description: "NPN биполярный транзистор, 10 штук" },
  "bc557": { name: "BC557 (PNP) 10 шт.", price: "5 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/fdcb6e/333333?text=BC557", keywords: ["bc557","транзистор","pnp"], category: "Транзисторы", description: "PNP биполярный транзистор, 10 штук" },
  "ne555": { name: "NE555 таймер", price: "3 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/fdcb6e/333333?text=NE555", keywords: ["ne555","555","таймер"], category: "Микросхемы", description: "Классический таймер NE555" },
  "7805": { name: "7805 +5V стабилизатор", price: "3 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/0984e3/ffffff?text=7805", keywords: ["7805","стабилизатор","5v"], category: "Стабилизаторы", description: "Линейный стабилизатор напряжения +5В" },
 "реле 1": { name: "Реле 5V 1-канальное", price: "4 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/6c5ce7/ffffff?text=Relay+1", keywords: ["реле","relay","1 канал"], category: "Реле и драйверы", description: "Одноканальное реле на 5В" },
  "реле 2": { name: "Реле 5V 2-канальное", price: "6 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/00b894/ffffff?text=Relay+2", keywords: ["реле","relay","2 канала"], category: "Реле и драйверы", description: "Двухканальное реле на 5В" },
  "реле 4": { name: "Реле 5V 4-канальное", price: "9 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/00cec9/ffffff?text=Relay+4", keywords: ["реле","relay","4 канала"], category: "Реле и драйверы", description: "Четырёхканальное реле на 5В" },
  "sg90": { name: "SG90 микро-серво", price: "6 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/e84393/ffffff?text=SG90", keywords: ["sg90","серво","servo"], category: "Моторы и серво", description: "Микро-сервопривод SG90 9г" },
  "mg90s": { name: "MG90S металлический серво", price: "8 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/fdcb6e/333333?text=MG90S", keywords: ["mg90s","серво","servo"], category: "Моторы и серво", description: "Сервопривод MG90S с металлическими шестернями" },
  "12v 2a": { name: "12V 2A адаптер", price: "10 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/00cec9/ffffff?text=12V+2A", keywords: ["блок питания","12v","2a","адаптер"], category: "Блоки питания", description: "Блок питания 12В 2А" },
  "12v 5a": { name: "12V 5A импульсный", price: "22 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/0984e3/ffffff?text=12V+5A", keywords: ["блок питания","12v","5a","импульсный"], category: "Блоки питания", description: "Импульсный блок питания 12В 5А" },
  "dupont мм": { name: "Dupont мама-мама 40 шт.", price: "4 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/6c5ce7/ffffff?text=Dupont+MM", keywords: ["dupont","мама-мама","провода"], category: "Разъёмы и провода", description: "Набор проводов Dupont мама-мама 40 шт." },
  "dupont пп": { name: "Dupont папа-папа 40 шт.", price: "4 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/6c5ce7/ffffff?text=Dupont+PP", keywords: ["dupont","папа-папа","провода"], category: "Разъёмы и провода", description: "Набор проводов Dupont папа-папа 40 шт." },
  "dupont пм": { name: "Dupont папа-мама 40 шт.", price: "4 BYN", status: "🚚 Под заказ (14–30 дней)", photo: "https://via.placeholder.com/400x300/6c5ce7/ffffff?text=Dupont+PM", keywords: ["dupont","папа-мама","провода"], category: "Разъёмы и провода", description: "Набор проводов Dupont папа-мама 40 шт." }
};

// ==================== ПОИСК ====================
function buildIndex() {
  var index = {};
  for (var key in products) {
    if (!products.hasOwnProperty(key)) continue;
    var p = products[key];
    var texts = [key.toLowerCase(), p.name.toLowerCase(), p.category.toLowerCase(), p.description.toLowerCase()];
    if (p.keywords) {
      for (var i = 0; i < p.keywords.length; i++) {
        texts.push(p.keywords[i].toLowerCase());
      }
    }
    var words = {};
    for (var t = 0; t < texts.length; t++) {
      var clean = texts[t].replace(/[^\w\s]/g, " ").replace(/\s+/g, " ");
      var parts = clean.split(" ");
      for (var p2 = 0; p2 < parts.length; p2++) {
        var w = parts[p2];
        if (w.length > 1) words[w] = true;
      }
    }
    for (var w2 in words) {
      if (!words.hasOwnProperty(w2)) continue;
      if (!index[w2]) index[w2] = [];
      if (index[w2].indexOf(key) === -1) index[w2].push(key);
    }
  }
  return index;
}
var invertedIndex = buildIndex();

function search(query) {
  var cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return [];
 var words = cleanQuery.split(/\s+/);
  var results = {};
  var scores = {};

  for (var wi = 0; wi < words.length; wi++) {
    var word = words[wi];
    if (word.length < 1) continue;
    if (invertedIndex[word]) {
      var keys = invertedIndex[word];
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var p = products[key];
        var score = 0;
        if (key.indexOf(word) !== -1) score += 5;
        if (p.name.toLowerCase().indexOf(word) !== -1) score += 4;
        if (p.category.toLowerCase().indexOf(word) !== -1) score += 3;
        if (p.keywords) {
          for (var k = 0; k < p.keywords.length; k++) {
            if (p.keywords[k].toLowerCase().indexOf(word) !== -1) { score += 2; break; }
          }
        }
        if (score > 0) {
          if (!scores[key]) scores[key] = 0;
          scores[key] += score;
          results[key] = p;
        }
      }
    }
  }

  if (Object.keys(results).length === 0) {
    for (var key in products) {
      if (!products.hasOwnProperty(key)) continue;
      var p = products[key];
      var match = false;
      var score = 0;
      for (var wi2 = 0; wi2 < words.length; wi2++) {
        var w = words[wi2];
        if (w.length < 1) continue;
        if (key.toLowerCase().indexOf(w) !== -1) { match = true; score += 5; break; }
        if (p.name.toLowerCase().indexOf(w) !== -1) { match = true; score += 4; break; }
        if (p.category.toLowerCase().indexOf(w) !== -1) { match = true; score += 3; break; }
        if (p.keywords) {
          for (var k2 = 0; k2 < p.keywords.length; k2++) {
            if (p.keywords[k2].toLowerCase().indexOf(w) !== -1) { match = true; score += 2; break; }
          }
          if (match) break;
        }
        if (p.description && p.description.toLowerCase().indexOf(w) !== -1) { match = true; score += 1; break; }
      }
      if (match) {
        results[key] = p;
        scores[key] = score;
      }
    }
  }

  if (Object.keys(results).length === 0) {
    for (var key in products) {
      if (!products.hasOwnProperty(key)) continue;
      results[key] = products[key];
      scores[key] = 0;
    }
  }

  var sorted = Object.keys(results).sort(function(a, b) {
    return (scores[b] || 0) - (scores[a] || 0);
  });

  return sorted.map(function(key) {
    return { key: key, product: results[key], score: scores[key] || 0 };
  });
}

function getStars(rating) { return "⭐".repeat(rating) + "☆".repeat(5 - rating); }

function formatCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return "🛒 Корзина пуста";
  var text = "🛒 ВАША КОРЗИНА:\n\n";
  var total = 0;
  for (var i = 0; i < cartItems.length; i++) {
    var item = cartItems[i];
    var p = products[item.key];
    if (!p) continue;
    var price = parseFloat(p.price);
    var subtotal = price * (item.quantity || 1);
    text += (i + 1) + ". " + p.name + "\n   💰 " + p.price + " × " + (item.quantity || 1) + " = " + subtotal.toFixed(2) + " BYN\n\n";
    total += subtotal;
  }
  text += "💵 ИТОГО: " + total.toFixed(2) + " BYN";
  return text;
}

// ==================== БОТ ====================
var bot = new Telegraf(BOT_TOKEN);
bot.use(session({ defaultSession: function() { return { cart: [], rating: null, currentOrder: null }; } }));

var app = express();
app.use(cors());
app.use(express.json());

// ==================== ВЕБ-ЭНДПОИНТЫ ====================
app.get("/ping", function(req, res) { res.send("OK"); });
app.get("/", function(req, res) {
  var html = '<!DOCTYPE html><html><head><title>RadioPartsBY Bot</title><style>body{font-family:Arial;text-align:center;padding:50px;background:#f5f5f5;}.container{max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}h1{color:#333;}.status{color:#00b894;font-weight:bold;}.info{color:#666;margin:20px 0;}</style></head><body><div class=container><h1>📦 RadioPartsBY</h1><p class=status>✅ Бот работает!</p><p class=info>Telegram бот для магазина радиодеталей</p><p style="margin-top:20px;color:#999;font-size:14px;">Товаров в каталоге: ' +
   Object.keys(products).length + '</p></div></body></html>';
  res.send(html);
});

app.get("/api/orders", function(req, res) { res.json(getOrders()); });
app.get("/api/reviews", function(req, res) { res.json(getReviews()); });
app.get("/api/products", function(req, res) {
  var statuses = getStatuses();
  var result = [];
  for (var key in products) {
    if (!products.hasOwnProperty(key)) continue;
    var p = products[key];
    result.push({ key: key, name: p.name, price: p.price, status: statuses[key] || p.status, category: p.category, description: p.description, photo: p.photo, keywords: p.keywords });
  }
  res.json(result);
});
app.get("/api/search", function(req, res) {
  var query = req.query.q || "";
  res.json(search(query));
});

// ==================== КОМАНДЫ ====================
bot.start(function(ctx) {
  var keyboard = Markup.keyboard([["🛒 Каталог", "📦 Корзина", "📦 Статус"], ["🔍 Поиск", "📞 Помощь", "⭐ Оставить отзыв"]]).resize();
  ctx.reply("👋 Добро пожаловать в RadioPartsBY!\n\n🔍 Просто напишите название товара для поиска!\n✅ В наличии: ESP32 DevKit, Arduino Nano, OLED 0.96\"\n🚚 Остальное — под заказ (14–30 дней)", keyboard);
});

bot.hears("🔍 Поиск", function(ctx) { ctx.reply("🔍 Введите запрос для поиска:\n\nПримеры:\n• esp32\n• дисплей\n• транзистор\n• реле"); });
bot.hears("🛒 Каталог", function(ctx) {
  var categories = {};
  for (var key in products) {
    if (!products.hasOwnProperty(key)) continue;
    var cat = products[key].category || "Другое";
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(key);
  }
  var text = "📦 КАТАЛОГ:\n\n";
  for (var cat2 in categories) {
    if (!categories.hasOwnProperty(cat2)) continue;
    text += "🔹 " + cat2 + " (" + categories[cat2].length + ")\n";
  }
  text += "\n🔍 Напишите название для поиска";
  ctx.reply(text);
});

bot.hears("📦 Корзина", function(ctx) {
  var cart = getUserCart(ctx.from.id);
  if (cart.items.length === 0) return ctx.reply("🛒 Ваша корзина пуста");
  var text = formatCart(cart.items);
  ctx.reply(text, Markup.inlineKeyboard([
    [Markup.button.callback("✅ Оформить заказ", "checkout")],
    [Markup.button.callback("🗑️ Очистить корзину", "clear_cart")]
  ]));
});

bot.hears("📦 Статус", function(ctx) {
  var orders = getOrders();
  var userOrders = orders.filter(function(o) { return o.userId === ctx.from.id; });
  if (userOrders.length === 0) return ctx.reply("📭 У вас нет заказов");
  var text = "📦 ВАШИ ЗАКАЗЫ:\n\n";
  var last = userOrders.slice(-5).reverse();
  for (var i = 0; i < last.length; i++) {
    var o = last[i];
    text += "#" + o.id + " — " + (o.status  "Новый") + "\n📅 " + new Date(o.date).toLocaleDateString() + "\n💵 " + (o.total  0) + " BYN\n\n";
  }
  ctx.reply(text);
});

bot.hears("📞 Помощь", function(ctx) { ctx.reply("📞 ПОМОЩЬ:\n\n🔍 Как найти: напишите название в чат\n📦 Как заказать: добавьте в корзину и оформите\n⏰ Время работы: Пн-Пт 9:00–18:00"); });
bot.hears("⭐ Оставить отзыв", function(ctx) {
  ctx.reply("⭐ Оцените наш магазин от 1 до 5 звёзд:", Markup.inlineKeyboard([
    [Markup.button.callback("⭐ 1", "rating_1"), Markup.button.callback("⭐⭐ 2", "rating_2"), Markup.button.callback("⭐⭐⭐ 3", "rating_3")],
    [Markup.button.callback("⭐⭐⭐⭐ 4", "rating_4"), Markup.button.callback("⭐⭐⭐⭐⭐ 5", "rating_5")]
  ]));
});

bot.action(/rating_([1-5])/, function(ctx) {
  var rating = parseInt(ctx.match[1]);
  ctx.answerCbQuery("Вы выбрали " + rating + " звёзд");
  ctx.session.rating = rating;
  ctx.reply("Вы выбрали " + getStars(rating) + "\n\nТеперь напишите текст отзыва:");
});

// ========== ЕДИНЫЙ ОБРАБОТЧИК ТЕКСТА ==========
bot.on("text", function(ctx) {
  var text = ctx.message.text.trim();
  var order = ctx.session.currentOrder;

  // 1. Если есть активный заказ – обрабатываем шаги оформления
       if (order) {
    if (["🛒 Каталог", "📦 Корзина", "📦 Статус", "🔍 Поиск", "📞 Помощь", "⭐ Оставить отзыв"].includes(text)) return;
    if (order.step === "address") {
      order.address = text;
      order.step = "phone";
      ctx.reply("📝 Шаг 2/3: Введите номер телефона:");
      return;
    } else if (order.step === "phone") {
      order.phone = text;
      order.step = "confirm";
      var orderText = "✅ ПОДТВЕРДИТЕ ЗАКАЗ:\n\n";
      var total = 0;
      for (var i = 0; i < order.cart.length; i++) {
        var item = order.cart[i];
        var p = products[item.key];
        if (!p) continue;
        var price = parseFloat(p.price);
        var subtotal = price * (item.quantity || 1);
        orderText += "• " + p.name + " x" + (item.quantity || 1) + " = " + subtotal.toFixed(2) + " BYN\n";
        total += subtotal;
      }
      orderText += "\n💵 Итого: " + total.toFixed(2) + " BYN\n📍 " + order.address + "\n📱 " + order.phone;
      ctx.reply(orderText, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Подтвердить", "confirm_order")],
        [Markup.button.callback("❌ Отмена", "cancel_order")]
      ]));
      return;
    }
    // если шаг неизвестен – ничего не делаем
    return;
  }

  // 2. Если нет активного заказа, проверяем отзыв
  if (ctx.session && ctx.session.rating && !text.startsWith("/") && !["🛒 Каталог", "📦 Корзина", "📦 Статус", "🔍 Поиск", "📞 Помощь", "⭐ Оставить отзыв"].includes(text)) {
    var rating = ctx.session.rating;
    var review = addReview({ text: text, rating: rating, author: ctx.from.username  ctx.from.first_name  "Аноним" });
    ctx.session.rating = null;
    ctx.reply("✅ Спасибо за отзыв!\n\n⭐ " + getStars(rating) + "\n📝 " + text);
    return;
  }

  // 3. Поиск товаров (если текст не команда и не кнопка меню)
  if (!text.startsWith("/") && !["🛒 Каталог", "📦 Корзина", "📦 Статус", "🔍 Поиск", "📞 Помощь", "⭐ Оставить отзыв"].includes(text)) {
    var results = search(text);
    if (results.length === 0) {
      return ctx.reply("🤷 Ничего не найдено. Попробуйте другие ключевые слова");
    }
    if (results.length === 1) {
      var r = results[0];
      var statuses = getStatuses();
      var status = statuses[r.key] || r.product.status;
      ctx.replyWithPhoto(r.product.photo, {
        caption: "📦 " + r.product.name + "\n💰 " + r.product.price + "\n" + status + "\n\n" + r.product.description,
        reply_markup: Markup.inlineKeyboard([Markup.button.callback("🛒 В корзину", "add_to_cart_" + r.key)]).reply_markup
      });
      return;
    }
    var response = "🔍 Найдено " + results.length + " товаров:\n\n";
    var buttons = [];
    for (var i = 0; i < Math.min(results.length, 10); i++) {
      var item = results[i];
      var st = getStatuses()[item.key] || item.product.status;
      var icon = st.indexOf("✅") !== -1 ? "✅" : "🚚";
      response += icon + " " + item.product.name + " — " + item.product.price + "\n";
      buttons.push([Markup.button.callback("🛒 " + item.product.name, "add_to_cart_" + item.key)]);
    }
    if (results.length > 10) response += "\n... и еще " + (results.length - 10);
    ctx.reply(response, Markup.inlineKeyboard(buttons));
  }
});

// ========== ОБРАБОТЧИКИ КНОПОК ==========
bot.action(/add_to_cart_(.+)/, function(ctx) {
  var key = ctx.match[1];
  if (!products[key]) return ctx.answerCbQuery("❌ Товар не найден");
  var cart = getUserCart(ctx.from.id);
  var existing = null;
  for (var i = 0; i < cart.items.length; i++) {
    if (cart.items[i].key === key) { existing = cart.items[i]; break; }
  }
  if (existing) existing.quantity = (existing.quantity || 1) + 1;
  else cart.items.push({ key: key, quantity: 1 });
  saveUserCart(ctx.from.id, cart.items);
  ctx.answerCbQuery("✅ Добавлено в корзину!");
  ctx.reply("✅ " + products[key].name + " добавлен в корзину!\n\nПерейдите в 📦 Корзина для оформления");
});

bot.action("clear_cart", function(ctx) {
  saveUserCart(ctx.from.id, []);
  ctx.answerCbQuery("🗑️ Корзина очищена");
  ctx.reply("🗑️ Корзина очищена");
});
bot.action("checkout", function(ctx) {
  var cart = getUserCart(ctx.from.id);
  if (cart.items.length === 0) return ctx.answerCbQuery("❌ Корзина пуста");
  ctx.session.currentOrder = { cart: cart.items, step: "address" };
  ctx.reply("📝 ОФОРМЛЕНИЕ ЗАКАЗА\n\nШаг 1/3: Введите адрес доставки:", Markup.inlineKeyboard([[Markup.button.callback("❌ Отмена", "cancel_order")]]));
});

bot.action("cancel_order", function(ctx) {
  ctx.session.currentOrder = null;
  ctx.reply("❌ Оформление заказа отменено");
});

bot.action("confirm_order", function(ctx) {
  var order = ctx.session.currentOrder;
  if (!order) return;
  var orders = getOrders();
  var total = 0;
  for (var i = 0; i < order.cart.length; i++) {
    var p = products[order.cart[i].key];
    if (p) total += parseFloat(p.price) * (order.cart[i].quantity || 1);
  }
  var newOrder = {
    id: orders.length + 1,
    userId: ctx.from.id,
    items: order.cart,
    total: total,
    address: order.address,
    phone: order.phone,
    status: "Новый",
    date: new Date().toISOString()
  };
  orders.push(newOrder);
  saveOrders(orders);
  saveUserCart(ctx.from.id, []);
  ctx.session.currentOrder = null;
  ctx.reply("✅ ЗАКАЗ #" + newOrder.id + " ОФОРМЛЕН!\n\nСпасибо за покупку!");
  bot.telegram.sendMessage(ADMIN_ID, "📦 НОВЫЙ ЗАКАЗ #" + newOrder.id + "\n\n👤 " + ctx.from.first_name + "\n📍 " + newOrder.address + "\n📱 " + newOrder.phone + "\n💵 " + newOrder.total.toFixed(2) + " BYN");
});

// ========== АДМИН-КОМАНДЫ ==========
bot.command("status", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var orders = getOrders();
  var reviews = getReviews();
  var avg = 0;
  if (reviews.length > 0) {
    var sum = 0;
    for (var i = 0; i < reviews.length; i++) sum += reviews[i].rating || 0;
    avg = (sum / reviews.length).toFixed(1);
  }
  ctx.reply("📊 СТАТИСТИКА:\n\n📦 Заказов: " + orders.length + "\n⭐ Отзывов: " + reviews.length + "\n📈 Рейтинг: " + avg + " " + getStars(Math.round(avg)));
});

bot.command("export", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var orders = getOrders();
  if (orders.length === 0) return ctx.reply("📭 Нет заказов");
  var filePath = path.join(DATA_DIR, "export_orders.json");
  fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
  ctx.replyWithDocument({ source: filePath, filename: "orders_" + new Date().toISOString().slice(0, 10) + ".json" }, { caption: "📦 Экспорт заказов (" + orders.length + " шт.)" });
  fs.unlinkSync(filePath);
});

bot.command("set_status", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var args = ctx.message.text.split(" ");
  if (args.length < 3) return ctx.reply("⚠️ Используйте: /set_status \"ключ\" \"статус\"\nПример: /set_status \"esp32 devkit\" \"✅ В наличии\"");
  var key = args.slice(1, -1).join(" ").toLowerCase();
  var newStatus = args.slice(-1).join(" ");
  if (!products[key]) return ctx.reply("❌ Товар не найден. Доступные ключи: " + Object.keys(products).slice(0, 10).join(", ") + "...");
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
  if (statuses[key]) { delete statuses[key]; saveStatuses(statuses); ctx.reply("✅ Статус товара \"" + products[key].name + "\" сброшен."); }
  else ctx.reply("ℹ️ У товара \"" + products[key].name + "\" не было переопределённого статуса.");
});
bot.command("delete_order", function(ctx) {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply("⛔ У вас нет прав.");
  var args = ctx.message.text.split(" ");
  if (args.length < 2) return ctx.reply("⚠️ Укажите номер заказа: /delete_order 123");
  var orderId = parseInt(args[1]);
  if (isNaN(orderId)) return ctx.reply("⚠️ Номер должен быть числом.");
  var orders = getOrders();
  var idx = -1;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id === orderId) { idx = i; break; } }
  if (idx === -1) return ctx.reply("❌ Заказ #" + orderId + " не найден.");
  orders.splice(idx, 1);
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
  var idx = -1;
  for (var i = 0; i < reviews.length; i++) { if (reviews[i].id === reviewId) { idx = i; break; } }
  if (idx === -1) return ctx.reply("❌ Отзыв #" + reviewId + " не найден.");
  reviews.splice(idx, 1);
  saveReviews(reviews);
  ctx.reply("✅ Отзыв #" + reviewId + " удалён.");
});

// ==================== ЗАПУСК ====================
var server = app.listen(PORT, function() {
  console.log("✅ Веб-сервер запущен на порту " + PORT);
  console.log("🌐 Админ-панель: " + PUBLIC_URL);
});

// Авто-пинг каждые 30 секунд
setInterval(function() {
  require('http').get("http://localhost:" + PORT + "/ping", function(res) {}).on('error', function(e) {});
}, 30000);

bot.launch()
  .then(function() {
    console.log("✅ Бот запущен!");
    console.log("📱 Бот: https://t.me/" + bot.botInfo.username);
    console.log("📊 Товаров в каталоге: " + Object.keys(products).length);
  })
  .catch(function(err) {
    console.error("❌ Ошибка запуска бота:", err.message);
  });

process.once("SIGINT", function() { bot.stop("SIGINT"); server.close(); });
process.once("SIGTERM", function() { bot.stop("SIGTERM"); server.close(); });

console.log("✅ Бот готов к работе!");
