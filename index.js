
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ========== НАСТРОЙКИ ==========
const BOT_TOKEN = '8916472134:AAE3-pCZpxR2xCm7pC3I6YvGwWDUPW8cQmc';          // ЗАМЕНИ НА СВОЙ ТОКЕН
const ADMIN_ID = 5179932939;             // ТВОЙ TELEGRAM ID

// ========== ТОВАРЫ ==========
const GOODS = [
    { id: 1, name: 'ESP32 DevKit V1 (30 pin, Type-C)', price: 19 },
    { id: 2, name: 'SIMCom A7670E (4G/GPS, без антенны)', price: 35 },
    { id: 3, name: 'OLED 0.96" I2C (SSD1306)', price: 9 },
    { id: 4, name: 'Arduino Nano V3 (Type-C, с пинами)', price: 12 },
    { id: 5, name: 'Резисторы 0805 (набор 150 шт, 15 номиналов)', price: 10 },
    { id: 6, name: 'Резисторы 0805 (набор 300 шт, 15 номиналов)', price: 15 }
];

// ========== ФАЙЛЫ ==========
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const FEEDBACKS_FILE = path.join(__dirname, 'feedbacks.json');
const CONTACTS_FILE = path.join(__dirname, 'contacts.json');

if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
if (!fs.existsSync(FEEDBACKS_FILE)) fs.writeFileSync(FEEDBACKS_FILE, '[]');
if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, '[]');

// ========== СЕССИИ И КОРЗИНЫ ==========
const sessions = new Map();
const carts = new Map();
const bot = new Telegraf(BOT_TOKEN);

function getSession(userId) {
    if (!sessions.has(userId)) sessions.set(userId, {});
    return sessions.get(userId);
}

function getCart(userId) {
    if (!carts.has(userId)) carts.set(userId, []);
    return carts.get(userId);
}

function saveOrder(order) {
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    orders.push(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

    const contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE));
    if (!contacts.some(c => c.userId === order.userId)) {
        contacts.push({ userId: order.userId, phone: order.phone, date: new Date().toISOString() });
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
    }
}

// ========== ГЛАВНАЯ КЛАВИАТУРА ==========
function getMainKeyboard() {
    const buttons = GOODS.map(g => {
        return Markup.button.callback(g.name + ' - ' + g.price + ' BYN', 'add_' + g.id);
    });
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    rows.push([Markup.button.callback('🛒 Корзина', 'show_cart')]);
    rows.push([Markup.button.callback('📦 Оформить заказ', 'checkout')]);
    rows.push([Markup.button.callback('🔄 Повторить заказ', 'repeat_order')]);
    rows.push([Markup.button.callback('⭐ Отзывы', 'feedback_button')]);
    rows.push([Markup.button.callback('❓ Помощь', 'help_button')]);
    return Markup.inlineKeyboard(rows);
}

// ========== КОМАНДЫ ==========
bot.start(async (ctx) => {
    carts.set(ctx.from.id, []);
    sessions.set(ctx.from.id, {});
    await ctx.reply(
        '👋 *Привет! Добро пожаловать в магазин радиодеталей.*\n\n' +
        'Выберите товары из каталога и оформите заказ.\n' +
        'Нажмите «Помощь», если что-то непонятно.',
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

bot.action('help_button', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '📖 *Инструкция:*\n\n' +
        '1. Нажмите кнопку с товаром, чтобы добавить его в корзину.\n' +
        '2. Нажмите «Корзина», чтобы посмотреть выбранные товары.\n' +
        '3. Нажмите «Оформить заказ» и введите адрес и телефон.\n' +
        '4. После оформления вы получите подтверждение.\n\n' +
        '💬 Если есть вопросы — напишите /feedback.',
        { parse_mode: 'Markdown' }
    );
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        '📖 *Инструкция:*\n\n' +
        '1. Нажмите кнопку с товаром, чтобы добавить его в корзину.\n' +'2. Нажмите «Корзина», чтобы посмотреть выбранные товары.\n' +
        '3. Нажмите «Оформить заказ» и введите адрес и телефон.\n' +
        '4. После оформления вы получите подтверждение.\n\n' +
        '💬 Если есть вопросы — напишите /feedback.',
        { parse_mode: 'Markdown' }
    );
});

bot.action(/add_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = GOODS.find(g => g.id === productId);
    if (!product) return ctx.answerCbQuery('❌ Товар не найден');
    const cart = getCart(ctx.from.id);
    const existing = cart.find(item => item.id === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ id: productId, quantity: 1 });
    await ctx.answerCbQuery('✅ ' + product.name + ' добавлен');
    await ctx.editMessageText(
        '📦 *' + product.name + '*\n💰 ' + product.price + ' BYN\n📌 Количество: ' + (existing ? existing.quantity : 1),
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

bot.action('show_cart', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Корзина пуста');
        return ctx.reply('🛒 *Корзина пуста*', { parse_mode: 'Markdown', ...getMainKeyboard() });
    }
    let text = '🛒 *Ваша корзина:*\n\n';
    let total = 0;
    cart.forEach(item => {
        const product = GOODS.find(g => g.id === item.id);
        const sum = product.price * item.quantity;
        total += sum;
        text += product.name + ' x ' + item.quantity + ' = ' + sum + ' BYN\n';
    });
    text += '\n💰 *Итого: ' + total + ' BYN*';
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🗑 Очистить', 'clear_cart')],
            [Markup.button.callback('🔙 Назад', 'back_catalog')],
            [Markup.button.callback('📦 Оформить', 'checkout')]
        ])
    });
});

bot.action('clear_cart', async (ctx) => {
    carts.set(ctx.from.id, []);
    await ctx.answerCbQuery('🗑 Корзина очищена');
    await ctx.editMessageText('🛒 *Корзина очищена*', { parse_mode: 'Markdown', ...getMainKeyboard() });
});

bot.action('back_catalog', async (ctx) => {
    await ctx.editMessageText(
        '📋 *Каталог товаров:*\n\nВыберите нужный товар:',
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

bot.action('repeat_order', async (ctx) => {
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    const userOrders = orders.filter(o => o.userId === ctx.from.id);
    if (userOrders.length === 0) {
        await ctx.answerCbQuery('❌ У вас пока нет заказов');
        return;
    }
    const last = userOrders[userOrders.length - 1];
    const cart = getCart(ctx.from.id);
    last.items.forEach(item => {
        const existing = cart.find(i => i.id === item.id);
        if (existing) existing.quantity += item.quantity;
        else cart.push({ id: item.id, quantity: item.quantity });
    });
    await ctx.answerCbQuery('✅ Последний заказ добавлен в корзину');
    await ctx.editMessageText('🔄 *Последний заказ добавлен в корзину.*', { parse_mode: 'Markdown', ...getMainKeyboard() });
});

bot.action('feedback_button', async (ctx) => {
    const session = getSession(ctx.from.id);
    session.waitingFor = 'feedback';
    await ctx.reply('📝 *Напишите ваш отзыв о нашем магазине:*\n(можно одним сообщением)', { parse_mode: 'Markdown' });
});

bot.command('feedback', async (ctx) => {
    const session = getSession(ctx.from.id);
    session.waitingFor = 'feedback';
    await ctx.reply('📝 *Напишите ваш отзыв о нашем магазине:*\n(можно одним сообщением)', { parse_mode: 'Markdown' });
});

bot.action('checkout', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Корзина пуста');
        return;
    }
    const session = getSession(ctx.from.id);
    session.waitingFor = 'address';
    await ctx.reply('📝 *Введите ваш адрес:*\n(город, улица, дом, квартира)', { parse_mode: 'Markdown' });
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const cart = getCart(userId);
    const session = getSession(userId);

    if (session.waitingFor === 'address') {
        session.address = text;
        session.waitingFor = 'phone';
        await ctx.reply('📞 *Введите ваш номер телефона:*\n(например, +375291234567)', { parse_mode: 'Markdown' });
        return;
    }

    if (session.waitingFor === 'phone') {
        if (cart.length === 0) {
            await ctx.reply('❌ *Корзина пуста*', { parse_mode: 'Markdown', ...getMainKeyboard() });
            session.waitingFor = null;
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
            itemsText += product.name + ' x ' + item.quantity + '\n';
        });
        const order = {
            id: Date.now(),
            userId: userId,
            items: cart.slice(),
            total: total,
            address: session.address,
            phone: text,
            date: new Date().toISOString(),
            status: 'новый'
        };
        saveOrder(order);
        await ctx.reply(
            '✅ *Заказ #' + order.id + ' оформлен!*\n\n' +
            '📦 *Состав:*\n' + itemsText +
            '💰 *Сумма:* ' + total + ' BYN\n' +
            '📍 *Адрес:* ' + order.address + '\n' +
            '📞 *Телефон:* ' + order.phone + '\n\n' +
            '🙏 Спасибо за покупку!',
            { parse_mode: 'Markdown', ...getMainKeyboard() }
        );
        carts.set(userId, []);
        sessions.set(userId, {});
        await bot.telegram.sendMessage(
            ADMIN_ID,
            '📦 *НОВЫЙ ЗАКАЗ #' + order.id + '*\n\n' +
            itemsText +
            '💰 *Сумма:* ' + total + ' BYN\n' +
            '📍 *Адрес:* ' + order.address + '\n' +
            '📞 *Телефон:* ' + order.phone,
            { parse_mode: 'Markdown' }
        );
        return;
    }

    if (session.waitingFor === 'feedback') {
        const feedbacks = JSON.parse(fs.readFileSync(FEEDBACKS_FILE));
        feedbacks.push({
            userId: ctx.from.id,
            username: ctx.from.username || 'аноним',
            text: text,
            date: new Date().toISOString()
        });
        fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(feedbacks, null, 2));
        await ctx.reply('🙏 *Спасибо за ваш отзыв!*', { parse_mode: 'Markdown', ...getMainKeyboard() });
        session.waitingFor = null;
        return;
    }

    await ctx.reply('Используйте кнопки меню.', getMainKeyboard());
});

// ========== АДМИН-КОМАНДЫ ==========
bot.command('orders', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('⛔ Нет прав.');
        return;
    }
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    if (!orders.length) {
        await ctx.reply('📭 Заказов пока нет.');
        return;
    }
    let text = '📋 *Последние 5 заказов:*\n\n';
    orders.slice(-5).reverse().forEach(o => {
        text += '#' + o.id + ' — ' + o.total + ' BYN — ' + o.status + '\n';
    });
    await ctx.reply(text, { parse_mode: 'Markdown' });
});

bot.command('status', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('⛔ Нет прав.');
        return;
    }
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) {
        await ctx.reply('📌 Формат: /status <id> <новый статус>\nНапример: /status 1234567890 отправлен');
        return;
    }
    const id = parseInt(parts[1]);
    const newStatus = parts.slice(2).join(' ');
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    const order = orders.find(o => o.id === id);
    if (!order) {
        await ctx.reply('❌ Заказ не найден.');
        return;
    }
    order.status = newStatus;
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    await ctx.reply('✅ Статус заказа #' + id + ' изменён на "' + newStatus + '"');
    try {
        await bot.telegram.sendMessage(
            order.userId,
            '📦 Статус вашего заказа #' + id + ' изменён на "' + newStatus + '"'
        );
    } catch (e) {}
});

bot.command('export', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('⛔ Нет прав.');
        return;
    }
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    if (!orders.length) {
        await ctx.reply('📭 Заказов пока нет.');
        return;
    }
    let csv = 'ID,Дата,Товары,Сумма,Адрес,Телефон,Статус\n';
    orders.forEach(o => {
        const items = o.items.map(i => {
            const product = GOODS.find(g => g.id === i.id);
            return product.name + 'x' + i.quantity;
        }).join('; ');
        csv += o.id + ',' + o.date + ',' + items + ',' + o.total + ',' + o.address + ',' + o.phone + ',' + o.status + '\n';
    });
    const csvPath = path.join(__dirname, 'orders_export.csv');
    fs.writeFileSync(csvPath, csv);
    await ctx.replyWithDocument({ source: csvPath, filename: 'orders_export.csv' });
    fs.unlinkSync(csvPath);
});

bot.command('broadcast', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('⛔ Нет прав.');
        return;
    }
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) {
        await ctx.reply('📌 Формат: /broadcast <текст сообщения>');
        return;
    }
    const contacts = JSON.parse(fs.readFileSync(CONTACTS_FILE));
    if (!contacts.length) {
        await ctx.reply('📭 Нет контактов для рассылки.');
        return;
    }
    let sent = 0;
    for (const c of contacts) {
        try {
            await bot.telegram.sendMessage(c.userId, '📢 *Рассылка*\n\n' + text, { parse_mode: 'Markdown' });
            sent++;
        } catch (e) {}
    }
    await ctx.reply('✅ Отправлено ' + sent + ' пользователям.');
});

// ========== HTTP-СЕРВЕР ДЛЯ RENDER ==========
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running');
}).listen(PORT, () => {
    console.log('✅ HTTP server on port ' + PORT);
});

// ========== ЗАПУСК ==========
bot.launch().then(() => {
    console.log('✅ Bot started!');
}).catch((err) => {
    console.error('❌ Error:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
