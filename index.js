const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ========== НАСТРОЙКИ ==========
const BOT_TOKEN = '8916472134:AANyJzLb0n82faTZ0H6GYbsGpEpokRcfuVk';
const ADMIN_ID = 5179932939;

// ========== ТОВАРЫ ==========
const GOODS = [
    { id: 1, name: 'ESP32 DevKit V1', price: 45 },
    { id: 2, name: 'SIMCom A7670E', price: 80 },
    { id: 3, name: 'OLED 0.96 I2C', price: 14 },
    { id: 4, name: 'Resistors 0805 set', price: 22 }
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
    const buttons = [];
    for (let i = 0; i < GOODS.length; i++) {
        const g = GOODS[i];
        const label = g.name + ' - ' + g.price + ' BYN';
        const callback = 'add_' + g.id;
        buttons.push(Markup.button.callback(label, callback));
    }
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) {
        rows.push(buttons.slice(i, i + 2));
    }
    rows.push([Markup.button.callback('Cart', 'show_cart')]);
    rows.push([Markup.button.callback('Checkout', 'checkout')]);
    return Markup.inlineKeyboard(rows);
}

// ========== КОМАНДЫ ==========
bot.start(async (ctx) => {
    carts.set(ctx.from.id, []);
    await ctx.reply('Hello! Choose product:', getMainKeyboard());
});

bot.action(/add_(\d+)/, async (ctx) => {
    const productId = parseInt(ctx.match[1], 10);
    const product = GOODS.find(function(g) { return g.id === productId; });
    if (!product) {
        await ctx.answerCbQuery('Not found');
        return;
    }
    const cart = getCart(ctx.from.id);
    let found = false;
    for (let i = 0; i < cart.length; i++) {
        if (cart[i].id === productId) {
            cart[i].quantity += 1;
            found = true;
            break;
        }
    }
    if (!found) {
        cart.push({ id: productId, quantity: 1 });
    }
    await ctx.answerCbQuery('Added: ' + product.name);
    const qty = found ? cart.find(function(item) { return item.id === productId; }).quantity : 1;
    await ctx.editMessageText(
        product.name + ' - ' + product.price + ' BYN\nQty: ' + qty,
        getMainKeyboard()
    );
});

bot.action('show_cart', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Cart is empty');
        await ctx.reply('Cart is empty', getMainKeyboard());
        return;
    }
    let text = 'Your cart:\n\n';
    let total = 0;
    for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const product = GOODS.find(function(g) { return g.id === item.id; });
        const sum = product.price * item.quantity;
        total += sum;
        text += product.name + ' x ' + item.quantity + ' = ' + sum + ' BYN\n';
    }
    text += '\nTotal: ' + total + ' BYN';
    await ctx.editMessageText(text, {
        ...Markup.inlineKeyboard([
            [Markup.button.callback('Clear', 'clear_cart')],
            [Markup.button.callback('Back', 'back_catalog')],
            [Markup.button.callback('Checkout', 'checkout')]
        ])
    });
});

bot.action('clear_cart', async (ctx) => {
    carts.set(ctx.from.id, []);
    await ctx.answerCbQuery('Cleared');
    await ctx.editMessageText('Cart is empty', getMainKeyboard());
});

bot.action('back_catalog', async (ctx) => {
    await ctx.editMessageText('Catalog:', getMainKeyboard());
});
bot.action('checkout', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Cart is empty');
        return;
    }
    ctx.session = ctx.session || {};
    ctx.session.waitingFor = 'address';
    await ctx.reply('Enter your address:');
});

bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    const cart = getCart(userId);

    if (ctx.session && ctx.session.waitingFor === 'address') {
        ctx.session.address = text;
        ctx.session.waitingFor = 'phone';
        await ctx.reply('Enter your phone number:');
        return;
    }

    if (ctx.session && ctx.session.waitingFor === 'phone') {
        let total = 0;
        for (let i = 0; i < cart.length; i++) {
            const item = cart[i];
            const product = GOODS.find(function(g) { return g.id === item.id; });
            total += product.price * item.quantity;
        }
        let itemsText = '';
        for (let i = 0; i < cart.length; i++) {
            const item = cart[i];
            const product = GOODS.find(function(g) { return g.id === item.id; });
            itemsText += product.name + ' x ' + item.quantity + '\n';
        }
        const order = {
            id: Date.now(),
            userId: userId,
            items: cart,
            total: total,
            address: ctx.session.address,
            phone: text,
            date: new Date().toISOString(),
            status: 'new'
        };
        saveOrder(order);

        await ctx.reply(
            'Order #' + order.id + ' confirmed!\n' +
            'Total: ' + total + ' BYN\n' +
            'Address: ' + order.address + '\n' +
            'Phone: ' + order.phone + '\n\n' +
            'Thank you!',
            getMainKeyboard()
        );
        carts.set(userId, []);
        ctx.session = null;

        await bot.telegram.sendMessage(
            ADMIN_ID,
            'NEW ORDER #' + order.id + '\n' +
            itemsText +
            'Total: ' + total + ' BYN\n' +
            'Address: ' + order.address + '\n' +
            'Phone: ' + order.phone
        );
    }
});

bot.command('orders', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        await ctx.reply('No access');
        return;
    }
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    if (orders.length === 0) {
        await ctx.reply('No orders.');
        return;
    }
    const lastOrders = orders.slice(-5).reverse();
    let text = 'Last 5 orders:\n\n';
    for (let i = 0; i < lastOrders.length; i++) {
        const o = lastOrders[i];
        text += '#' + o.id + ' - ' + o.total + ' BYN - ' + o.status + '\n';
    }
    await ctx.reply(text);
});

// ========== HTTP-СЕРВЕР ДЛЯ RENDER ==========
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
}).listen(PORT, function() {
    console.log('HTTP server on port ' + PORT);
});

// ========== ЗАПУСК БОТА ==========
bot.launch().then(function() {
    console.log('Bot started!');
}).catch(function(err) {
    console.error('Error:', err);
});

process.once('SIGINT', function() { bot.stop('SIGINT'); });
process.once('SIGTERM', function() { bot.stop('SIGTERM'); });
