
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = '8916472134:AAE3-pCZpxR2xCm7pC3I6YvGwWDUPW8cQmc';
const ADMIN_ID = 5179932939;

const GOODS = [
    { id: 1, name: 'ESP32 DevKit V1 (30 pin, Type-C)', price: 19 },
    { id: 2, name: 'SIMCom A7670E (4G/GPS, без антенны)', price: 35 },
    { id: 3, name: 'OLED 0.96″ I2C (SSD1306)', price: 9 },
    { id: 4, name: 'Arduino Nano V3 (Type-C, с пинами)', price: 12 },
    { id: 5, name: 'Резисторы 0805 (набор 150 шт, 15 номиналов: 10,100,220,330,470 Ом, 1,2.2,4.7,10,22,47,100,220,470 кОм, 1 МОм)', price: 10 },
    { id: 6, name: 'Резисторы 0805 (набор 300 шт, те же 15 номиналов × 20 шт)', price: 15 },
];

const ORDERS_FILE = path.join(__dirname, 'orders.json');
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

const carts = new Map();
const bot = new Telegraf(BOT_TOKEN);

// Хранилище временных данных пользователя
const userData = new Map();

function getCart(userId) {
    if (!carts.has(userId)) carts.set(userId, []);
    return carts.get(userId);
}

function getUserData(userId) {
    if (!userData.has(userId)) {
        userData.set(userId, { step: null, address: null, phone: null });
    }
    return userData.get(userId);
}

function saveOrder(order) {
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    orders.push(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function getMainKeyboard() {
    const buttons = GOODS.map(g => {
        return Markup.button.callback(g.name + ' - ' + g.price + ' BYN', 'add_' + g.id);
    });
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    rows.push([Markup.button.callback('🛒 Корзина', 'show_cart')]);
    rows.push([Markup.button.callback('📦 Оформить', 'checkout')]);
    return Markup.inlineKeyboard(rows);
}

bot.start(async (ctx) => {
    const userId = ctx.from.id;
    carts.set(userId, []);
    userData.set(userId, { step: null, address: null, phone: null });
    await ctx.reply('👋 Привет! Выбери товар:', getMainKeyboard());
});

bot.action(/add_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const product = GOODS.find(g => g.id === productId);
    if (!product) return ctx.answerCbQuery('Нет такого');
    const cart = getCart(ctx.from.id);
    const existing = cart.find(item => item.id === productId);
    if (existing) existing.quantity += 1;
    else cart.push({ id: productId, quantity: 1 });
    await ctx.answerCbQuery('✅ ' + product.name + ' добавлен');
    await ctx.editMessageText(
        product.name + ' - ' + product.price + ' BYN\nКол-во: ' + (existing ? existing.quantity : 1),
        getMainKeyboard()
    );
});

bot.action('show_cart', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Корзина пуста');
        return ctx.reply('🛒 Корзина пуста', getMainKeyboard());
    }
    let text = '🛒 Ваша корзина:\n\n';
    let total = 0;
    cart.forEach(item => {
        const product = GOODS.find(g => g.id === item.id);
        const sum = product.price * item.quantity;
        total += sum;
        text += product.name + ' x ' + item.quantity + ' = ' + sum + ' BYN\n';
    });
    text += '\n💰 Итого: ' + total + ' BYN';
    await ctx.editMessageText(text, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🗑 Очистить', 'clear_cart')],
            [Markup.button.callback('🔙 Назад', 'back_catalog')],
            [Markup.button.callback('📦 Оформить', 'checkout')]
        ])
    });
});

bot.action('clear_cart', async (ctx) => {
    carts.set(ctx.from.id, []);
    await ctx.answerCbQuery('Очищено');
    await ctx.editMessageText('Корзина пуста', getMainKeyboard());
});

bot.action('back_catalog', async (ctx) => {
    await ctx.editMessageText('Каталог:', getMainKeyboard());
});

bot.action('checkout', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Корзина пуста');
        return;
    }
    const data = getUserData(ctx.from.id);
    data.step = 'address';
    await ctx.reply('📝 Введите адрес (город, улица, дом, квартира):');
});
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const cart = getCart(userId);
    const data = getUserData(userId);

    // Если пользователь в процессе оформления
    if (data.step === 'address') {
        data.address = text;
        data.step = 'phone';
        await ctx.reply('📞 Введите номер телефона:');
        return;
    }

    if (data.step === 'phone') {
        if (cart.length === 0) {
            await ctx.reply('Корзина пуста', getMainKeyboard());
            data.step = null;
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
            items: cart,
            total: total,
            address: data.address,
            phone: text,
            date: new Date().toISOString(),
            status: 'новый'
        };

        saveOrder(order);

        await ctx.reply(
            '✅ Заказ #' + order.id + ' оформлен!\n' +
            'Сумма: ' + total + ' BYN\n' +
            'Адрес: ' + order.address + '\n' +
            'Телефон: ' + order.phone + '\n\n' +
            'Спасибо за покупку!',
            getMainKeyboard()
        );

        carts.set(userId, []);
        data.step = null;
        data.address = null;
        data.phone = null;

        await bot.telegram.sendMessage(
            ADMIN_ID,
            '📦 НОВЫЙ ЗАКАЗ #' + order.id + '\n' +
            itemsText +
            '💰 Общая сумма: ' + total + ' BYN\n' +
            '📍 Адрес: ' + order.address + '\n' +
            '📞 Телефон: ' + order.phone
        );
        return;
    }

    // Если пользователь просто пишет текст
    await ctx.reply('Используйте кнопки меню.', getMainKeyboard());
});

bot.command('orders', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Нет прав');
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    if (!orders.length) return ctx.reply('Заказов нет');
    let text = '📋 Последние 5 заказов:\n\n';
    orders.slice(-5).reverse().forEach(o => {
        text += '#' + o.id + ' - ' + o.total + ' BYN - ' + o.status + '\n';
    });
    await ctx.reply(text);
});

bot.command('status', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ Нет прав');
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) return ctx.reply('Формат: /status <id> <статус>');
    const id = parseInt(parts[1], 10);
    const newStatus = parts.slice(2).join(' ');
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    const order = orders.find(o => o.id === id);
    if (!order) return ctx.reply('Заказ не найден');
    order.status = newStatus;
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    await ctx.reply('Статус заказа #' + id + ' изменён на ' + newStatus);
});

const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running');
}).listen(PORT, () => console.log('HTTP server on port ' + PORT));

bot.launch().then(() => console.log('Bot started!')).catch(console.error);
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
