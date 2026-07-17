
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ========== НАСТРОЙКИ ==========
const BOT_TOKEN = '8916472134:AAE3-pCZpxR2xCm7pC3I6YvGwWDUPW8cQmc';
const ADMIN_ID = 5179932939;

// ========== ТОВАРЫ ==========
const GOODS = [
    { id: 1, name: 'ESP32 DevKit V1', price: 45 },
    { id: 2, name: 'SIMCom A7670E', price: 80 },
    { id: 3, name: 'OLED 0.96 I2C', price: 14 },
    { id: 4, name: 'Набор резисторов 0805', price: 22 }
];

// ========== ФАЙЛЫ ==========
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');

if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
if (!fs.existsSync(SESSIONS_FILE)) fs.writeFileSync(SESSIONS_FILE, '{}');

// ========== СЕССИИ (упрощённо) ==========
function loadSessions() {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE));
}
function saveSessions(sessions) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}
function getSession(userId) {
    const sessions = loadSessions();
    if (!sessions[userId]) sessions[userId] = {};
    return sessions[userId];
}
function setSession(userId, data) {
    const sessions = loadSessions();
    sessions[userId] = { ...sessions[userId], ...data };
    saveSessions(sessions);
}
function deleteSession(userId) {
    const sessions = loadSessions();
    delete sessions[userId];
    saveSessions(sessions);
}

// ========== КОРЗИНЫ ==========
const carts = new Map();
const bot = new Telegraf(BOT_TOKEN);

function getCart(userId) {
    if (!carts.has(userId)) carts.set(userId, []);
    return carts.get(userId);
}

function saveOrder(order) {
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    orders.push(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function getMainKeyboard() {
    const buttons = GOODS.map(g =>
        Markup.button.callback(${g.name} — ${g.price} BYN, add_${g.id})
    );
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    rows.push([Markup.button.callback('🛒 Корзина', 'show_cart')]);
    rows.push([Markup.button.callback('📦 Оформить заказ', 'checkout')]);
    rows.push([Markup.button.callback('❓ Помощь', 'help')]);
    return Markup.inlineKeyboard(rows);
}

// ========== КОМАНДЫ ==========
bot.start(async (ctx) => {
    const userId = ctx.from.id;
    carts.set(userId, []);
    deleteSession(userId);
    await ctx.reply(
        👋 *Привет, ${ctx.from.first_name}!*\n\n +
        'Добро пожаловать в магазин радиодеталей!\n' +
        'Выберите товары из каталога ниже.',
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        '📖 *Инструкция:*\n\n' +
        '1. Нажмите кнопку с товаром, чтобы добавить в корзину.\n' +
        '2. Перейдите в «Корзину» → проверьте заказ.\n' +
        '3. Нажмите «Оформить заказ» → введите адрес и телефон.\n' +
        '4. После оформления мы свяжемся с вами.',
        { parse_mode: 'Markdown' }
    );
});

bot.action('help', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '📖 *Инструкция:*\n\n' +
        '1. Нажмите кнопку с товаром, чтобы добавить в корзину.\n' +
        '2. Перейдите в «Корзину» → проверьте заказ.\n' +
        '3. Нажмите «Оформить заказ» → введите адрес и телефон.\n' +
        '4. После оформления мы свяжемся с вами.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/add_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const product = GOODS.find(g => g.id === productId);
    if (!product) return ctx.answerCbQuery('❌ Товар не найден');
    const cart = getCart(ctx.from.id);
    const existing = cart.find(item => item.id === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ id: productId, quantity: 1 });
    await ctx.answerCbQuery(✅ Добавлено: ${product.name});
    await ctx.editMessageText(
        📦 *${product.name}*\n💰 ${product.price} BYN\n📌 Кол-во: ${existing ? existing.quantity : 1},
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

bot.action('show_cart', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('🛒 Корзина пуста');
        return ctx.reply('🛒 *Корзина пуста*\nДобавьте товары из каталога.', { parse_mode: 'Markdown', ...getMainKeyboard() });
    }
    let text = '🛒 *Ваша корзина:*\n\n';
    let total = 0;
    cart.forEach(item => {
        const product = GOODS.find(g => g.id === item.id);
        const sum = product.price * item.quantity;
        total += sum;
        text += • ${product.name} × ${item.quantity} = ${sum} BYN\n;
    });
    text += \n💰 *Итого: ${total} BYN*;
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🗑 Очистить', 'clear_cart')],
            [Markup.button.callback('🔙 Назад', 'back_catalog')],
            [Markup.button.callback('📦 Оформить заказ', 'checkout')]
        ])
    });
});

bot.action('clear_cart', async (ctx) => {
    carts.set(ctx.from.id, []);
    await ctx.answerCbQuery('🗑 Корзина очищена');
    await ctx.editMessageText('🛒 *Корзина очищена*\nВыберите товары заново.', { parse_mode: 'Markdown', ...getMainKeyboard() });
});

bot.action('back_catalog', async (ctx) => {
    await ctx.editMessageText('📋 *Каталог товаров:*\n\nВыберите нужный товар:', { parse_mode: 'Markdown', ...getMainKeyboard() });
});

bot.action('checkout', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('🛒 Корзина пуста');
        return;
    }
    setSession(ctx.from.id, { waitingFor: 'address' });
    await ctx.reply('📝 *Введите ваш адрес:*\n(город, улица, дом, квартира)', { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const session = getSession(userId);
    const cart = getCart(userId);

    if (session.waitingFor === 'address') {
        setSession(userId, { address: text, waitingFor: 'phone' });
        await ctx.reply('📞 *Введите ваш номер телефона:*\n(например, +375291234567)', { parse_mode: 'Markdown' });
        return;
    }

    if (session.waitingFor === 'phone') {
        if (cart.length === 0) {
            await ctx.reply('❌ *Корзина пуста*\nДобавьте товары.', { parse_mode: 'Markdown', ...getMainKeyboard() });
            deleteSession(userId);
            return;
        }
        let total = 0;
        cart.forEach(item => {
            const product = GOODS.find(g => g.id === item.id);
            total += product.price * item.quantity;
        });
        let itemsText = '';
        cart.forEach(item => {
            const product = GOODS.find(g => g.id === item.id);
            itemsText += ${product.name} x ${item.quantity}\n;
        });
        const order = {
            id: Date.now(),
            userId,
            items: cart,
            total,
            address: session.address,
            phone: text,
            date: new Date().toISOString(),
            status: 'новый'
        };
        saveOrder(order);
        await ctx.reply(
            ✅ *Заказ #${order.id} оформлен!*\n\n +
            📦 *Состав:*\n${itemsText}\n +
            💰 *Сумма:* ${total} BYN\n +
            📍 *Адрес:* ${order.address}\n +
            📞 *Телефон:* ${order.phone}\n\n +
            🙏 Спасибо! Мы свяжемся с вами.,
            { parse_mode: 'Markdown', ...getMainKeyboard() }
        );
        carts.set(userId, []);
        deleteSession(userId);
        await bot.telegram.sendMessage(
            ADMIN_ID,
            📦 *НОВЫЙ ЗАКАЗ #${order.id}*\n\n${itemsText}💰 *Сумма:* ${total} BYN\n📍 *Адрес:* ${order.address}\n📞 *Телефон:* ${order.phone},
            { parse_mode: 'Markdown' }
        );
        return;
    }

    await ctx.reply('Используйте кнопки меню.', getMainKeyboard());
});

// ========== АДМИН-КОМАНДЫ ==========
bot.command('orders', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Нет прав.');
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    if (!orders.length) return ctx.reply('📭 Заказов пока нет.');
    let text = '📋 *Последние 5 заказов:*\n\n';
    orders.slice(-5).reverse().forEach(o => {
        text += #${o.id} — ${o.total} BYN — ${o.status}\n;
    });
    await ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('status', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Нет прав.');
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('📌 Формат: /status <id> <новый статус>');
    const id = parseInt(parts[1], 10);
    const newStatus = parts.slice(2).join(' ');
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    const order = orders.find(o => o.id === id);
    if (!order) return ctx.reply('❌ Заказ не найден.');
    order.status = newStatus;
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    await ctx.reply(✅ Статус заказа #${id} изменён на "${newStatus}");
});

// ========== HTTP-СЕРВЕР ДЛЯ RENDER ==========
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
}).listen(PORT, () => console.log(✅ HTTP server on port ${PORT}));

// ========== ЗАПУСК ==========
bot.launch().then(() => console.log('✅ Bot started!')).catch(console.error);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
