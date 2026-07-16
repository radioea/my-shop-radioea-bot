const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');

// ======= НАСТРОЙКИ =======
const BOT_TOKEN = '8916472134:AANyJzLb0n82faTZ0H6GYbsGpEpokRcfuVk';
const ADMIN_ID = 5179932939;

// ======= ТОВАРЫ =======
const GOODS = [
    { id: 1, name: 'ESP32 DevKit V1', price: 45 },
    { id: 2, name: 'SIMCom A7670E', price: 80 },
    { id: 3, name: 'OLED 0.96 I2C', price: 14 },
    { id: 4, name: 'Resistors 0805 set', price: 22 }
];

// ======= ФАЙЛЫ =======
const ORDERS_FILE = path.join(__dirname, 'orders.json');
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

// ======= КОРЗИНЫ =======
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
        Markup.button.callback(${g.name} - ${g.price} BYN, add_${g.id})
    );
    const rows = [];
    for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
    rows.push([Markup.button.callback('🛒 Cart', 'show_cart')]);
    rows.push([Markup.button.callback('📦 Checkout', 'checkout')]);
    return Markup.inlineKeyboard(rows);
}

// ======= КОМАНДЫ =======
bot.start(async (ctx) => {
    carts.set(ctx.from.id, []);
    await ctx.reply('Hello! Choose product:', getMainKeyboard());
});

bot.action(/add_(\d+)/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    const product = GOODS.find(g => g.id === id);
    if (!product) return ctx.answerCbQuery('Not found');
    const cart = getCart(ctx.from.id);
    const found = cart.find(i => i.id === id);
    if (found) found.quantity += 1;
    else cart.push({ id, quantity: 1 });
    await ctx.answerCbQuery('Added: ' + product.name);
    await ctx.editMessageText(
        ${product.name} - ${product.price} BYN\nQty: ${found ? found.quantity : 1},
        getMainKeyboard()
    );
});

bot.action('show_cart', async (ctx) => {
    const cart = getCart(ctx.from.id);
    if (cart.length === 0) {
        await ctx.answerCbQuery('Cart is empty');
        return ctx.reply('Cart is empty', getMainKeyboard());
    }
    let text = 'Your cart:\n\n';
    let total = 0;
    cart.forEach(i => {
        const p = GOODS.find(g => g.id === i.id);
        const sum = p.price * i.quantity;
        total += sum;
        text += ${p.name} x ${i.quantity} = ${sum} BYN\n;
    });
    text += \nTotal: ${total} BYN;
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
    if (cart.length === 0) return ctx.answerCbQuery('Cart is empty');
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
      return ctx.reply('Enter your phone number:');
    }
    if (ctx.session && ctx.session.waitingFor === 'phone') {
        let total = 0;
        cart.forEach(i => { const p = GOODS.find(g => g.id === i.id); total += p.price * i.quantity; });
        let itemsText = '';
        cart.forEach(i => { const p = GOODS.find(g => g.id === i.id); itemsText += ${p.name} x ${i.quantity}\n; });
        const order = {
            id: Date.now(),
            userId,
            items: cart,
            total,
            address: ctx.session.address,
            phone: text,
            date: new Date().toISOString(),
            status: 'new'
        };
        saveOrder(order);
        await ctx.reply(
            Order #${order.id} confirmed!\nTotal: ${total} BYN\nAddress: ${order.address}\nPhone: ${order.phone}\n\nThank you!,
            getMainKeyboard()
        );
        carts.set(userId, []);
        ctx.session = null;
        await bot.telegram.sendMessage(
            ADMIN_ID,
            NEW ORDER #${order.id}\n${itemsText}Total: ${total} BYN\nAddress: ${order.address}\nPhone: ${order.phone}
        );
    }
});

bot.command('orders', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.reply('No access');
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    if (!orders.length) return ctx.reply('No orders.');
    let text = 'Last 5 orders:\n\n';
    orders.slice(-5).reverse().forEach(o => {
        text += #${o.id} - ${o.total} BYN - ${o.status}\n;
    });
    await ctx.reply(text);
});

// ======= HTTP-СЕРВЕР ДЛЯ RENDER (WEB SERVICE) =======
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running');
}).listen(PORT, () => {
    console.log(✅ HTTP server on port ${PORT});
});

// ======= ЗАПУСК БОТА =======
bot.launch().then(() => {
    console.log('✅ Bot started!');
}).catch(err => {
    console.error('❌ Error:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
