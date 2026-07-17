
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

// ========== ФАЙЛ ДЛЯ ЗАКАЗОВ ==========
const ORDERS_FILE = path.join(__dirname, 'orders.json');
if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, '[]');
}

// ========== КОРЗИНЫ ==========
const carts = new Map();
const bot = new Telegraf(BOT_TOKEN);

function getCart(userId) {
    if (!carts.has(userId)) {
        carts.set(userId, []);
    }
    return carts.get(userId);
}

function saveOrder(order) {
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    orders.push(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function getMainKeyboard() {
    const buttons = GOODS.map(function(g) {
        return Markup.button.callback(g.name + ' - ' + g.price + ' BYN', 'add_' + g.id);
    });
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
        rows.push(buttons.slice(i, i + 2));
    }
    rows.push([Markup.button.callback('Корзина', 'show_cart')]);
    rows.push([Markup.button.callback('Оформить', 'checkout')]);
    return Markup.inlineKeyboard(rows);
}

bot.start(async function(ctx) {
    const userId = ctx.from.id;
    carts.set(userId, []);
    ctx.session = {};
    await ctx.reply('Привет! Выбери товар:', getMainKeyboard());
});

bot.action(/add_(\d+)/, async function(ctx) {
    const productId = parseInt(ctx.match[1], 10);
    const product = GOODS.find(function(g) { return g.id === productId; });
    if (!product) {
        await ctx.answerCbQuery('Нет такого');
        return;
    }
    const cart = getCart(ctx.from.id);
    const existing = cart.find(function(item) { return item.id === productId; });
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ id: productId, quantity: 1 });
    }
    await ctx.answerCbQuery('Добавлено: ' + product.name);
    await ctx.editMessageText(
        product.name + ' - ' + product.price + ' BYN\nКол-во: ' + (existing ? existing.quantity : 1),
        getMainKeyboard()
    );
});

bot.action('show_cart', async function(ctx) {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Корзина пуста');
        await ctx.reply('Корзина пуста', getMainKeyboard());
        return;
    }
    let text = 'Ваша корзина:\n\n';
    let total = 0;
    cart.forEach(function(item) {
        const product = GOODS.find(function(g) { return g.id === item.id; });
        const sum = product.price * item.quantity;
        total += sum;
        text += product.name + ' x ' + item.quantity + ' = ' + sum + ' BYN\n';
    });
    text += '\nИтого: ' + total + ' BYN';
    await ctx.editMessageText(text, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Очистить', 'clear_cart')],
            [Markup.button.callback('Назад', 'back_catalog')],
            [Markup.button.callback('Оформить', 'checkout')]
        ])
    });
});

bot.action('clear_cart', async function(ctx) {
    carts.set(ctx.from.id, []);
    await ctx.answerCbQuery('Очищено');
    await ctx.editMessageText('Корзина пуста', getMainKeyboard());
});

bot.action('back_catalog', async function(ctx) {
    await ctx.editMessageText('Каталог:', getMainKeyboard());
});

bot.action('checkout', async function(ctx) {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Корзина пуста');
        return;
    }
    ctx.session = { waitingFor: 'address' };
    await ctx.reply('Введите адрес (город, улица, дом, квартира):');
});

bot.on('text', async function(ctx) {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const cart = getCart(userId);
       if (ctx.session && ctx.session.waitingFor === 'address') {
        ctx.session.address = text;
        ctx.session.waitingFor = 'phone';
        await ctx.reply('Введите номер телефона:');
        return;
    }

    if (ctx.session && ctx.session.waitingFor === 'phone') {
        if (cart.length === 0) {
            await ctx.reply('Корзина пуста', getMainKeyboard());
            ctx.session = {};
            return;
        }

        let total = 0;
        cart.forEach(function(item) {
            const product = GOODS.find(function(g) { return g.id === item.id; });
            total += product.price * item.quantity;
        });

        let itemsText = '';
        cart.forEach(function(item) {
            const product = GOODS.find(function(g) { return g.id === item.id; });
            itemsText += product.name + ' x ' + item.quantity + '\n';
        });

        const order = {
            id: Date.now(),
            userId: userId,
            items: cart,
            total: total,
            address: ctx.session.address,
            phone: text,
            date: new Date().toISOString(),
            status: 'новый'
        };

        saveOrder(order);

        await ctx.reply(
            'Заказ #' + order.id + ' оформлен!\n' +
            'Сумма: ' + total + ' BYN\n' +
            'Адрес: ' + order.address + '\n' +
            'Телефон: ' + order.phone + '\n\n' +
            'Спасибо!',
            getMainKeyboard()
        );

        carts.set(userId, []);
        ctx.session = {};

        await bot.telegram.sendMessage(
            ADMIN_ID,
            'НОВЫЙ ЗАКАЗ #' + order.id + '\n' +
            itemsText +
            'Общая сумма: ' + total + ' BYN\n' +
            'Адрес: ' + order.address + '\n' +
            'Телефон: ' + order.phone
        );
        return;
    }

    await ctx.reply('Используйте кнопки.', getMainKeyboard());
});

bot.command('orders', async function(ctx) {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('Нет прав');
        return;
    }
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    if (orders.length === 0) {
        await ctx.reply('Заказов нет');
        return;
    }
    let text = 'Последние 5 заказов:\n\n';
    orders.slice(-5).reverse().forEach(function(o) {
        text += '#' + o.id + ' - ' + o.total + ' BYN - ' + o.status + '\n';
    });
    await ctx.reply(text);
});

bot.command('status', async function(ctx) {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('Нет прав');
        return;
    }
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) {
        await ctx.reply('Формат: /status <id> <статус>');
        return;
    }
    const id = parseInt(parts[1], 10);
    const newStatus = parts.slice(2).join(' ');
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    const order = orders.find(function(o) { return o.id === id; });
    if (!order) {
        await ctx.reply('Заказ не найден');
        return;
    }
    order.status = newStatus;
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    await ctx.reply('Статус заказа #' + id + ' изменён на ' + newStatus);
});

// ========== HTTP-СЕРВЕР ДЛЯ RENDER ==========
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer(function(req, res) {
    res.writeHead(200);
    res.end('Bot is running');
}).listen(PORT, function() {
    console.log('HTTP server on port ' + PORT);
});

// ========== ЗАПУСК ==========
bot.launch().then(function() {
    console.log('Bot started!');
}).catch(function(err) {
    console.error('Error:', err);
});

process.once('SIGINT', function() { bot.stop('SIGINT'); });
process.once('SIGTERM', function() { bot.stop('SIGTERM'); });
