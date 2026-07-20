
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const express = require('express');

// ============ НАСТРОЙКИ ============
const BOT_TOKEN = '8916472134:AAE3-pCZpxR2xCm7pC3I6YvGwIDUPW8CQmc';
const ADMIN_ID = 5179932939;
const PORT = 3000;

// ============ ТОВАРЫ ============
const GOODS = [
    { id: 1, name: 'ESP32 DevKit V1 (30 pin, Type-C)', price: 19 },
    { id: 2, name: 'SIMCom A7670E (4G/GPS, без антенны)', price: 35 },
    { id: 3, name: 'OLED 0.96" I2C (SSD1306)', price: 9 },
    { id: 4, name: 'Arduino Nano V3 (Type-C, с пинами)', price: 12 },
    { id: 5, name: 'Резисторы 0805 (набор 150 шт, 15 номиналов)', price: 18 },
    { id: 6, name: 'Резисторы 0805 (набор 300 шт, 15 номиналов)', price: 15 }
];

// ============ ФАЙЛЫ ============
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const FEEDBACKS_FILE = path.join(__dirname, 'feedbacks.json');

if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
if (!fs.existsSync(FEEDBACKS_FILE)) fs.writeFileSync(FEEDBACKS_FILE, '[]');

// ============ СЕССИИ И КОРЗИНЫ ============
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
}

function saveFeedback(feedback) {
    const feedbacks = JSON.parse(fs.readFileSync(FEEDBACKS_FILE));
    feedbacks.push(feedback);
    fs.writeFileSync(FEEDBACKS_FILE, JSON.stringify(feedbacks, null, 2));
}

// ============ КЛАВИАТУРА ============
function getMainKeyboard() {
    const buttons = GOODS.map(g => 
        Markup.button.callback(g.name + ' - ' + g.price + ' BYN', 'add_' + g.id)
    );
    
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    
    rows.push([Markup.button.callback('Корзина', 'show_cart')]);
    rows.push([Markup.button.callback('Оформить заказ', 'checkout')]);
    rows.push([Markup.button.callback('Повторить заказ', 'repeat_order')]);
    rows.push([Markup.button.callback('Отзывы', 'feedback_button')]);
    rows.push([Markup.button.callback('Помощь', 'help_button')]);
    rows.push([Markup.button.callback('Статус', 'status_button')]);
    rows.push([Markup.button.callback('Экспорт', 'export_button')]);
    
    return Markup.inlineKeyboard(rows);
}

// ============ КОМАНДЫ ============

bot.start(async (ctx) => {
    await ctx.reply(
        '👋 Добро пожаловать в Мой магазин!\n\nВыберите товар из каталога ниже:',
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

bot.command('help', async (ctx) => {
    await ctx.reply(
        '📖 Инструкция:\n\n' +
        '1️⃣ Нажмите кнопку с товаром, чтобы добавить его в корзину.\n' +
        '2️⃣ Нажмите «Корзина», чтобы посмотреть выбранные товары.\n' +
        '3️⃣ Нажмите «Оформить заказ» и введите адрес и телефон.\n' +
        '4️⃣ После оформления вы получите подтверждение.\n\n' +
        '💬 Если есть вопросы – напишите /feedback.',
        { parse_mode: 'Markdown' }
    );
});

bot.command('feedback', async (ctx) => {
    const session = getSession(ctx.from.id);
    session.waitingFor = 'feedback';
    await ctx.reply('✍️ Напишите ваш отзыв о нашем магазине:\n(можно одним сообщением)', { parse_mode: 'Markdown' });
});

// ============ ЭКСПОРТ (ТОЛЬКО АДМИН) ============
bot.command('export', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('⛔ Доступ запрещён. Только для администратора.');
        return;
    }

        try {
        const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
        const feedbacks = JSON.parse(fs.readFileSync(FEEDBACKS_FILE));
        
        const data = {
            exportDate: new Date().toISOString(),
            shop: 'Мой магазин',
            goods: GOODS,
            totalOrders: orders.length,
            totalFeedbacks: feedbacks.length,
            orders: orders,
            feedbacks: feedbacks
        };
        
        const fileName = 'export_' + Date.now() + '.json';
        const filePath = path.join(__dirname, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        
        await ctx.replyWithDocument(
            { source: filePath },
            {
                caption: '📦 Экспорт данных\n\n📅 ' + new Date().toLocaleString() + '\n📦 Заказов: ' + orders.length + '\n💬 Отзывов: ' + feedbacks.length,
                parse_mode: 'Markdown'
            }
        );
        
        fs.unlinkSync(filePath);
    } catch (err) {
        console.error('Export error:', err);
        await ctx.reply('❌ Ошибка при экспорте данных.');
    }
});

// ============ СТАТУС (ТОЛЬКО АДМИН) ============
bot.command('status', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('⛔ Доступ запрещён. Только для администратора.');
        return;
    }

    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    const feedbacks = JSON.parse(fs.readFileSync(FEEDBACKS_FILE));
    
    const sales = {};
    orders.forEach(order => {
        if (order.items) {
            order.items.forEach(item => {
                const product = GOODS.find(g => g.id === item.id);
                const name = product ? product.name : 'Товар #' + item.id;
                sales[name] = (sales[name] ||  0) + (item.quantity || 1);
            });
        }
    });
    
    let text = '📊 Статус магазина\n\n';
    text += '👤 Заказов: ' + orders.length + '\n';
    text += '💬 Отзывов: ' + feedbacks.length + '\n';
    text += '📦 Товаров: ' + GOODS.length + '\n\n';
    text += 'Продажи:\n';
    
    const sorted = Object.entries(sales).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
        text += 'Пока нет продаж 📭\n';
    } else {
        sorted.forEach(function(item) {
            text += '• ' + item[0] + ': ' + item[1] + ' шт.\n';
        });
    }
    
    await ctx.reply(text, { parse_mode: 'Markdown' });
});

// ============ ДЕЙСТВИЯ ============

bot.action(/add_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1]);
    const product = GOODS.find(g => g.id === productId);
    
    if (!product) {
        await ctx.answerCbQuery('❌ Товар не найден', true);
        return;
    }
    
    const cart = getCart(ctx.from.id);
    const existing = cart.find(item => item.id === productId);
    
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id: productId, quantity: 1 });
    }
    
    await ctx.answerCbQuery('✅ ' + product.name + ' добавлен');
    await ctx.editMessageText(
        '✅ Товар добавлен: ' + product.name + ' ' + product.price + ' BYN\n Количество: ' + (existing ? existing.quantity : 1),
        { parse_mode: 'Markdown' }
    );
});

bot.action('show_cart', async (ctx) => {
    const cart = getCart(ctx.from.id);
    
    if (cart.length === 0) {
        await ctx.answerCbQuery('🛒 Корзина пуста', true);
        await ctx.reply('🛒 Корзина пуста', { parse_mode: 'Markdown' });
        return;
    }
    
    let text = '🛒 Ваша корзина:\n\n';
    let total = 0;
    
    cart.forEach(item => {
        const product = GOODS.find(g => g.id === item.id);
        if (product) {
            const subtotal = product.price * item.quantity;
            text += '• ' + product.name + '\n  ' + item.quantity + ' шт. × ' + product.price + ' BYN = ' + subtotal + ' BYN\n\n';
            total += subtotal;
        }
    });
    
    text += '💰 Итого: ' + total + ' BYN';
    
    await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🗑 Очистить', 'clear_cart')],
            [Markup.button.callback('📦 Оформить', 'checkout')],
            [Markup.button.callback('◀️ Назад', 'back_catalog')]
        ])
    });
});

bot.action('clear_cart', async (ctx) => {
    carts.set(ctx.from.id, []);
    await ctx.answerCbQuery('🗑 Корзина очищена');
    await ctx.editMessageText('🗑 Корзина очищена', {
        parse_mode: 'Markdown',
        ...getMainKeyboard()
    });
});

bot.action('back_catalog', async (ctx) => {
    await ctx.editMessageText(
        '📦 Каталог товаров:\n\nВыберите нужный товар:',
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

bot.action('checkout', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('🛒 Корзина пуста', true);
        return;
    }
    
    const session = getSession(ctx.from.id);
    session.waitingFor = 'address';
    await ctx.reply(
        '📝 Введите адрес доставки и номер телефона:\n\nПример: г. Минск, ул. Ленина 1, +375291234567',
        { parse_mode: 'Markdown' }
    );
});

bot.action('repeat_order', async (ctx) => {
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    const userOrders = orders.filter(o => o.userId === ctx.from.id);
    
    if (userOrders.length === 0) {
        await ctx.answerCbQuery('❌ У вас пока нет заказов', true);
        return;
    }
    
    const last = userOrders[userOrders.length - 1];
    const cart = getCart(ctx.from.id);
    
    last.items.forEach(item => {
        const existing = cart.find(i => i.id === item.id);
        if (existing) {
            existing.quantity += item.quantity;
        } else {
            cart.push({ id: item.id, quantity: item.quantity });
        }
    });
    
    await ctx.answerCbQuery('✅ Последний заказ добавлен в корзину');
    await ctx.editMessageText(
        '✅ Последний заказ добавлен в корзину',
        { parse_mode: 'Markdown', ...getMainKeyboard() }
    );
});

bot.action('feedback_button', async (ctx) => {
    const session = getSession(ctx.from.id);
    session.waitingFor = 'feedback';
    await ctx.answerCbQuery();
    await ctx.reply('✍️ Напишите ваш отзыв о нашем магазине:\n(можно одним сообщением)', { parse_mode: 'Markdown' });
});

bot.action('help_button', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
        '📖 Инструкция:\n\n' +
        '1️⃣ Нажмите кнопку с товаром, чтобы добавить его в корзину.\n' +
        '2️⃣ Нажмите «Корзина», чтобы посмотреть выбранные товары.\n' +
        '3️⃣ Нажмите «Оформить заказ» и введите адрес и телефон.\n' +
        '4️⃣ После оформления вы получите подтверждение.\n\n' +
        '💬 Если есть вопросы – напишите /feedback.',
        { parse_mode: 'Markdown' }
    );
});

bot.action('status_button', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.answerCbQuery('⛔ Доступ запрещён', true);
        return;
    }
    await ctx.answerCbQuery();
    await ctx.reply('/status');
});

bot.action('export_button', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.answerCbQuery('⛔ Доступ запрещён', true);
        return;
    }
    await ctx.answerCbQuery('📤 Генерирую экспорт...');
    await ctx.reply('/export');
});

// ============ ОБРАБОТКА ТЕКСТА ============

bot.on('text', async (ctx) => {
    const session = getSession(ctx.from.id);
    const text = ctx.message.text;
    
    if (session.waitingFor === 'address') {
        const cart = getCart(ctx.from.id);
        if (cart.length === 0) {await ctx.reply('❌ Корзина пуста. Начните заново.');
            session.waitingFor = null;
            return;
        }
        
        const order = {
            id: Date.now(),
            userId: ctx.from.id,
            username: ctx.from.username || 'no_username',
            date: new Date().toISOString(),
            items: cart.map(item => ({ ...item })),
            address: text,
            status: 'новый'
        };
        
        saveOrder(order);
        carts.set(ctx.from.id, []);
        session.waitingFor = null;
        
        await ctx.reply(
            '✅ Заказ оформлен!\n\n' +
            '📦 Номер заказа: #' + order.id + '\n' +
            '📍 Адрес: ' + text + '\n\n' +
            'Спасибо за покупку! 🎉',
            { parse_mode: 'Markdown', ...getMainKeyboard() }
        );
        
        await bot.telegram.sendMessage(
            ADMIN_ID,
            '🆕 Новый заказ!\n\n' +
            '👤 Пользователь: @' + (ctx.from.username || 'нет') + '\n' +
            '📦 Заказ #' + order.id + '\n' +
            '📍 Адрес: ' + text
        );
        return;
    }
    
    if (session.waitingFor === 'feedback') {
        saveFeedback({
            userId: ctx.from.id,
            username: ctx.from.username || 'no_username',
            date: new Date().toISOString(),
            text: text
        });
        session.waitingFor = null;
        
        await ctx.reply(
            '✅ Спасибо за ваш отзыв! 💙',
            { parse_mode: 'Markdown', ...getMainKeyboard() }
        );
        
        await bot.telegram.sendMessage(
            ADMIN_ID,
            '💬 Новый отзыв!\n\n' +
            '👤 Пользователь: @' + (ctx.from.username || 'нет') + '\n' +
            '📝 Текст: ' + text
        );
    }
});

// ============ HTTP СЕРВЕР ============
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
    bot.handleUpdate(req.body, res);
});

app.get('/', (req, res) => {
    res.send('✅ Бот работает!');
});

// ============ ЗАПУСК ============
app.listen(PORT, () => {
    console.log('✅ HTTP сервер запущен на порту ' + PORT);
    console.log('🌐 http://localhost:' + PORT);
});

bot.launch().then(() => {
    console.log('✅ Бот запущен в polling режиме');
    console.log('👤 Админ ID: ' + ADMIN_ID);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
