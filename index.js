

`javascript
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
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;

// Проверка токена
if (!BOT_TOKEN) {
  console.error('❌ Ошибка: BOT_TOKEN не указан в .env файле!');
  console.log('Создайте файл .env и добавьте: BOT_TOKEN=ваш_токен');
  process.exit(1);
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');
const CART_FILE = path.join(DATA_DIR, 'cart.json');

// Создаем папку data если её нет
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Функция инициализации файлов
function initDB() {
  const files = [ORDERS_FILE, REVIEWS_FILE, STATUS_FILE, CART_FILE];
  files.forEach(file => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([]));
    }
  });
}
initDB();

// ==================== ФУНКЦИИ РАБОТЫ С ДАННЫМИ ====================
function readJSON(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Ошибка чтения ${file}:`, error.message);
    return [];
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Ошибка записи ${file}:`, error.message);
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
  const carts = getCarts();
  let cart = carts.find(c => c.userId === userId);
  if (!cart) {
    cart = { userId, items: [] };
    carts.push(cart);
    saveCarts(carts);
  }
  return cart;
}

function saveUserCart(userId, items) {
  const carts = getCarts();
  const index = carts.findIndex(c => c.userId === userId);
  if (index >= 0) {
    carts[index].items = items;
  } else {
    carts.push({ userId, items });
  }
  saveCarts(carts);
}

function addReview(review) {
  const reviews = getReviews();
  const newReview = {
    id: reviews.length > 0 ? reviews[reviews.length - 1].id + 1 : 1,
    ...review,
    date: new Date().toISOString()
  };
  reviews.push(newReview);
  saveReviews(reviews);
  return newReview;
}

// ==================== ТОВАРЫ ====================
const products = {
  'esp32 devkit': {
    name: 'ESP32 DevKit V1',
    price: '19 BYN',
    status: '✅ В наличии',
    photo: 'https://via.placeholder.com/400x300/667eea/ffffff?text=ESP32',
    keywords: ['esp32', 'devkit', 'esp'],
    category: 'Микроконтроллеры',
    description: 'Мощный микроконтроллер с Wi-Fi и Bluetooth'
  },
  'esp8266': {
    name: 'ESP8266 NodeMCU',
    price: '15 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/764ba2/ffffff?text=ESP8266',
    keywords: ['esp8266', 'nodemcu', 'wifi'],
    category: 'Микроконтроллеры',
    description: 'Популярный Wi-Fi модуль для IoT проектов'
  },
  'arduino nano': {
    name: 'Arduino Nano V3',
    price: '14 BYN',
    status: '✅ В наличии',
    photo: 'https://via.placeholder.com/400x300/00b894/ffffff?text=Arduino+Nano',
    keywords: ['arduino', 'nano'],
    category: 'Микроконтроллеры',
    description: 'Компактная плата Arduino с Type-C'
  },
  'arduino uno': {
    name: 'Arduino Uno R3',
    price: '25 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=Arduino+Uno',
    keywords: ['arduino', 'uno'],
    category: 'Микроконтроллеры',
    description: 'Классическая плата Arduino Uno R3'
  },
  'arduino mega': {
    name: 'Arduino Mega 2560',
    price: '35 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=Arduino+Mega',
    keywords: ['arduino', 'mega'],
    category: 'Микроконтроллеры',
    description: 'Мощная плата с большим количеством пинов'
  },
  'stm32': {
    name: 'STM32F103C8T6 (Blue Pill)',
    price: '12 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/0984e3/ffffff?text=STM32',
    keywords: ['stm32', 'blue pill'],
    category: 'Микроконтроллеры',
    description: '32-битный ARM микроконтроллер'
  },
  'raspberry pi pico': {
    name: 'Raspberry Pi Pico',
    price: '15 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=Raspberry+Pico',
    keywords: ['raspberry', 'pico'],
    category: 'Микроконтроллеры',
    description: 'Микроконтроллер с RP2040 от Raspberry'
  },
  'esp32-cam': {
    name: 'ESP32-CAM с камерой',
    price: '18 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=ESP32-CAM',
    keywords: ['esp32', 'cam', 'камера'],
    category: 'Микроконтроллеры',
    description: 'ESP32 с камерой OV2640'
  },
  'esp32-s3': {
    name: 'ESP32-S3',
    price: '18 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fab1a0/333333?text=ESP32-S3',
    keywords: ['esp32', 's3', 'wifi'],
    category: 'Микроконтроллеры',
    description: 'ESP32-S3 с Wi-Fi и BLE'
  },
  'oled 0.96': {
    name: 'OLED 0.96" I2C (SSD1306)',
    price: '9 BYN',
    status: '✅ В наличии',
    photo: 'https://via.placeholder.com/400x300/00cec9/ffffff?text=OLED+0.96',
    keywords: ['oled', '0.96', 'ssd1306', 'дисплей'],
    category: 'Дисплеи',
    description: 'Маленький OLED дисплей 0.96 дюйма'
  },
  'oled 1.3': {
    name: 'OLED 1.3" I2C (SH1106)',
    price: '12 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00b894/ffffff?text=OLED+1.3',
    keywords: ['oled', '1.3', 'sh1106', 'дисплей'],
    category: 'Дисплеи',
    description: 'OLED дисплей 1.3 дюйма'
  },
  'lcd 1602': {
    name: 'LCD 1602',
    price: '9 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/0984e3/ffffff?text=LCD+1602',
    keywords: ['lcd', '1602', 'дисплей'],
    category: 'Дисплеи',
    description: 'Символьный LCD дисплей 16x2'
  },
  'lcd 2004': {
    name: 'LCD 2004',
    price: '11 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=LCD+2004',
    keywords: ['lcd', '2004', 'дисплей'],
    category: 'Дисплеи',
    description: 'Символьный LCD дисплей 20x4'
  },
  'tft 1.8': {
    name: 'TFT 1.8" ST7735',
    price: '12 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=TFT+1.8',
    keywords: ['tft', '1.8', 'st7735', 'дисплей'],
    category: 'Дисплеи',
    description: 'Цветной TFT дисплей 1.8 дюйма'
    },
  'tft 2.4': {
    name: 'TFT 2.4" ILI9341',
    price: '18 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=TFT+2.4',
    keywords: ['tft', '2.4', 'ili9341', 'дисплей'],
    category: 'Дисплеи',
    description: 'Цветной TFT дисплей 2.4 дюйма'
  },
  '7 segment': {
    name: '7-сегментный индикатор',
    price: '6 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=7-Segment',
    keywords: ['7 сегмент', 'сегмент', 'индикатор'],
    category: 'Дисплеи',
    description: '4-разрядный 7-сегментный индикатор'
  },
  'max7219': {
    name: 'MAX7219 8x8 матрица',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00cec9/ffffff?text=MAX7219',
    keywords: ['max7219', 'матрица', '8x8'],
    category: 'Дисплеи',
    description: 'Светодиодная матрица 8x8 с драйвером MAX7219'
  },
  'hc-sr04': {
    name: 'HC-SR04 ультразвуковой датчик',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00b894/ffffff?text=HC-SR04',
    keywords: ['hc-sr04', 'ультразвук', 'датчик'],
    category: 'Датчики',
    description: 'Ультразвуковой датчик расстояния'
  },
  'dht22': {
    name: 'DHT22 температура/влажность',
    price: '14 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/0984e3/ffffff?text=DHT22',
    keywords: ['dht22', 'температура', 'влажность'],
    category: 'Датчики',
    description: 'Цифровой датчик температуры и влажности'
  },
  'dht11': {
    name: 'DHT11 температура/влажность',
    price: '8 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=DHT11',
    keywords: ['dht11', 'температура', 'влажность'],
    category: 'Датчики',
    description: 'Бюджетный датчик температуры и влажности'
  },
  'ds18b20': {
    name: 'DS18B20 температура',
    price: '6 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=DS18B20',
    keywords: ['ds18b20', 'температура', '1-wire'],
    category: 'Датчики',
    description: 'Цифровой датчик температуры с интерфейсом 1-Wire'
  },
  'bme280': {
    name: 'BME280 темп./влажн./давление',
    price: '15 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=BME280',
    keywords: ['bme280', 'температура', 'влажность', 'давление'],
    category: 'Датчики',
    description: 'Датчик температуры, влажности и атмосферного давления'
  },
  'mpu6050': {
    name: 'MPU6050 гироскоп+акселерометр',
    price: '12 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=MPU6050',
    keywords: ['mpu6050', 'гироскоп', 'акселерометр'],
    category: 'Датчики',
    description: '6-осевой IMU датчик (гироскоп + акселерометр)'
  },
  'hc-05': {
    name: 'HC-05 Bluetooth модуль',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00cec9/ffffff?text=HC-05',
    keywords: ['hc-05', 'bluetooth', 'модуль'],
    category: 'Датчики',
    description: 'Bluetooth модуль для беспроводной связи'
  },
  'rfid rc522': {
    name: 'RFID RC522 считыватель',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00b894/ffffff?text=RFID+RC522',
    keywords: ['rfid', 'rc522', 'считыватель'],
    category: 'Датчики',
    description: 'Модуль считывания RFID карт и ключей'
  },
  'max30102': {
    name: 'MAX30102 пульсоксиметр',
    price: '12 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/0984e3/ffffff?text=MAX30102',
    keywords: ['max30102', 'пульсоксиметр', 'пульс'],
    category: 'Датчики',
    description: 'Датчик пульса и уровня кислорода в крови'
  },
  'mq-2': {
    name: 'MQ-2 газовый датчик',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=MQ-2',
    keywords: ['mq-2', 'газ', 'датчик'],
    category: 'Датчики',
    description: 'Датчик обнаружения газов и дыма'
  },
  'ttp223': {
    name: 'TTP223 сенсорная кнопка',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=TTP223',
    keywords: ['ttp223', 'сенсор', 'кнопка'],
    category: 'Датчики',
    description: 'Модуль сенсорной кнопки'
  },
  'ky-038': {
    name: 'KY-038 датчик звука',
    price: '5 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=KY-038',
    keywords: ['ky-038', 'звук', 'микрофон'],
    category: 'Датчики',
    description: 'Модуль датчика звука с микрофоном'
  },
  'pir hc-sr501': {
    name: 'PIR HC-SR501 датчик движения',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=PIR',
    keywords: ['pir', 'hc-sr501', 'движение'],
    category: 'Датчики',
    description: 'Инфракрасный датчик движения'
  },
  'bc547': {
    name: 'BC547 (NPN) 10 шт.',
    price: '5 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=BC547',
    keywords: ['bc547', 'транзистор', 'npn'],
    category: 'Транзисторы',
    description: 'NPN биполярный транзистор, 10 штук'
  },
  'bc557': {
    name: 'BC557 (PNP) 10 шт.',
    price: '5 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=BC557',
    keywords: ['bc557', 'транзистор', 'pnp'],
    category: 'Транзисторы',
    description: 'PNP биполярный транзистор, 10 штук'
  },
  '2n2222': {
    name: '2N2222 (NPN) 10 шт.',
    price: '5 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=2N2222',
    keywords: ['2n2222', 'транзистор', 'npn'],
    category: 'Транзисторы',
    description: 'NPN биполярный транзистор, 10 штук'
  },
  '2n3904': {
    name: '2N3904 (NPN) 10 шт.',
    price: '5 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00cec9/ffffff?text=2N3904',
    keywords: ['2n3904', 'транзистор', 'npn'],
    category: 'Транзисторы',
    description: 'NPN биполярный транзистор, 10 штук'
  },
  '2n3906': {
    name: '2N3906 (PNP) 10 шт.',
    price: '5 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00b894/ffffff?text=2N3906',
    keywords: ['2n3906', 'транзистор', 'pnp'],
    category: 'Транзисторы',
    description: 'PNP биполярный транзистор, 10 штук'
  },
  's8050': {
    name: 'S8050 (NPN) 10 шт.',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/0984e3/ffffff?text=S8050',
    keywords: ['s8050', 'транзистор', 'npn'],
    category: 'Транзисторы',
    description: 'NPN биполярный транзистор, 10 штук'
  },
  's8550': {
    name: 'S8550 (PNP) 10 шт.',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=S8550',
    keywords: ['s8550', 'транзистор', 'pnp'],
    category: 'Транзисторы',
    description: 'PNP биполярный транзистор, 10 штук'
  },
  'ne555': {
    name: 'NE555 таймер',
    price: '3 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=NE555',
    keywords: ['ne555', '555', 'таймер'],
    category: 'Микросхемы',
    description: 'Классический таймер NE555'
  },
  'lm358': {
    name: 'LM358 сдвоенный ОУ',
    price: '3 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=LM358',
    keywords: ['lm358', 'операционный усилитель'],
    category: 'Микросхемы',
    description: 'Сдвоенный операционный усилитель'
  },
  'lm324': {
    name: 'LM324 четверной ОУ',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=LM324',
    keywords: ['lm324', 'операционный усилитель'],
    category: 'Микросхемы',
    description: 'Четверной операционный усилитель'
  },
  '74hc595': {
    name: '74HC595 сдвиговый регистр',
    price: '3 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00cec9/ffffff?text=74HC595',
    keywords: ['74hc595', 'сдвиговый регистр'],
    category: 'Микросхемы',
    description: '8-битный сдвиговый регистр'
  },
  '7805': {
    name: '7805 +5V стабилизатор',
    price: '3 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/0984e3/ffffff?text=7805',
    keywords: ['7805', 'стабилизатор', '5v'],
    category: 'Стабилизаторы',
    description: 'Линейный стабилизатор напряжения +5В'
  },
  '7812': {
    name: '7812 +12V стабилизатор',
    price: '3 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=7812',
    keywords: ['7812', 'стабилизатор', '12v'],
    category: 'Стабилизаторы',
    description: 'Линейный стабилизатор напряжения +12В'
  },
  'lm317': {
    name: 'LM317 регулируемый стабилизатор',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=LM317',
    keywords: ['lm317', 'стабилизатор', 'регулируемый'],
    category: 'Стабилизаторы',
    description: 'Регулируемый стабилизатор напряжения'
  },
  'реле 1': {
    name: 'Реле 5V 1-канальное',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=Relay+1',
    keywords: ['реле', 'relay', '1 канал'],
    category: 'Реле и драйверы',
    description: 'Одноканальное реле на 5В'
  },
  'реле 2': {
    name: 'Реле 5V 2-канальное',
    price: '6 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00b894/ffffff?text=Relay+2',
    keywords: ['реле', 'relay', '2 канала'],
    category: 'Реле и драйверы',
    description: 'Двухканальное реле на 5В'
  },
  'реле 4': {
    name: 'Реле 5V 4-канальное',
    price: '9 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00cec9/ffffff?text=Relay+4',
    keywords: ['реле', 'relay', '4 канала'],
    category: 'Реле и драйверы',
    description: 'Четырехканальное реле на 5В'
  },
  'l298n': {
    name: 'Драйвер L298N',
    price: '12 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=L298N',
    keywords: ['l298n', 'драйвер', 'мотор'],
    category: 'Реле и драйверы',
    description: 'Драйвер моторов L298N'
  },
  'l293d': {
    name: 'Драйвер L293D',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=L293D',
    keywords: ['l293d', 'драйвер', 'мотор'],
    category: 'Реле и драйверы',
    description: 'Драйвер моторов L293D'
  },
  'pca9685': {
    name: 'PCA9685 ШИМ-драйвер',
    price: '12 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=PCA9685',
    keywords: ['pca9685', 'шим', 'драйвер'],
    category: 'Реле и драйверы',
    description: '16-канальный ШИМ-драйвер PCA9685'
  },
  'a4988': {
    name: 'A4988 драйвер шагового',
    price: '6 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00cec9/ffffff?text=A4988',
    keywords: ['a4988', 'шаговый', 'драйвер'],
    category: 'Реле и драйверы',
    description: 'Драйвер шагового двигателя A4988'
  },
  '5v 2a': {
    name: '5V 2A USB-адаптер',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00b894/ffffff?text=5V+2A',
    keywords: ['блок питания', '5v', '2a', 'usb'],
    category: 'Блоки питания',
    description: 'Блок питания 5В 2А с USB'
  },
  '12v 2a': {
    name: '12V 2A адаптер',
    price: '10 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/0984e3/ffffff?text=12V+2A',
    keywords: ['блок питания', '12v', '2a', 'адаптер'],
    category: 'Блоки питания',
    description: 'Блок питания 12В 2А'
  },
  '12v 5a': {
    name: '12V 5A импульсный',
    price: '22 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=12V+5A',
    keywords: ['блок питания', '12v', '5a', 'импульсный'],
    category: 'Блоки питания',
    description: 'Импульсный блок питания 12В 5А'
  },
  '12v 10a': {
    name: '12V 10A импульсный',
    price: '32 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=12V+10A',
    keywords: ['блок питания', '12v', '10a', 'импульсный'],
    category: 'Блоки питания',
    description: 'Импульсный блок питания 12В 10А'
  },
  '24v 5a': {
    name: '24V 5A импульсный',
    price: '28 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=24V+5A',
    keywords: ['блок питания', '24v', '5a', 'импульсный'],
    category: 'Блоки питания',
    description: 'Импульсный блок питания 24В 5А'
  },
  'sg90': {
    name: 'SG90 микро-серво',
    price: '6 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=SG90',
    keywords: ['sg90', 'серво', 'servo'],
    category: 'Моторы и серво',
    description: 'Микро-сервопривод SG90 9г'
  },
  'mg90s': {
    name: 'MG90S металлический серво',
    price: '8 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=MG90S',
    keywords: ['mg90s', 'серво', 'servo'],
    category: 'Моторы и серво',
    description: 'Сервопривод MG90S с металлическими шестернями'
  },
  'mg995': {
    name: 'MG995 большой серво',
    price: '14 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00cec9/ffffff?text=MG995',
    keywords: ['mg995', 'серво', 'servo'],
    category: 'Моторы и серво',
    description: 'Большой сервопривод MG995 55г'
  },
  '28byj-48': {
    name: '28BYJ-48 шаговый двигатель',
    price: '6 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/00b894/ffffff?text=28BYJ-48',
    keywords: ['28byj-48', 'шаговый', 'двигатель'],
    category: 'Моторы и серво',
    description: '5В шаговый двигатель 28BYJ-48'
  },
  'nema17': {
    name: 'NEMA17 шаговый двигатель',
    price: '14 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/0984e3/ffffff?text=NEMA17',
    keywords: ['nema17', 'шаговый', 'двигатель'],
    category: 'Моторы и серво',
    description: 'Шаговый двигатель NEMA17'
  },
  'dupont мм': {
    name: 'Dupont мама-мама 40 шт.',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/6c5ce7/ffffff?text=Dupont+MM',
    keywords: ['dupont', 'мама-мама', 'провода'],
    category: 'Разъёмы и провода',
    description: 'Набор проводов Dupont мама-мама 40 шт.'
  },
  'dupont пп': {
    name: 'Dupont папа-папа 40 шт.',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e17055/ffffff?text=Dupont+PP',
    keywords: ['dupont', 'папа-папа', 'провода'],
    category: 'Разъёмы и провода',
    description: 'Набор проводов Dupont папа-папа 40 шт.'
  },
  'dupont пм': {
    name: 'Dupont папа-мама 40 шт.',
    price: '4 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/e84393/ffffff?text=Dupont+PM',
    keywords: ['dupont', 'папа-мама', 'провода'],
    category: 'Разъёмы и провода',
    description: 'Набор проводов Dupont папа-мама 40 шт.'
  },
  'макетная плата': {
    name: 'Макетная плата (Breadboard)',
    price: '12 BYN',
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://via.placeholder.com/400x300/fdcb6e/333333?text=Breadboard',
    keywords: ['макетная плата', 'breadboard', 'макетка'],
    category: 'Разъёмы и провода',
    description: 'Беспаечная макетная плата для прототипирования'
  }
};

// ==================== ПОИСКОВАЯ СИСТЕМА ====================
class SearchEngine {
  constructor() {
    this.products = products;
    this.invertedIndex = {};
    this.buildIndex();
  }

  buildIndex() {
    for (const [key, product] of Object.entries(this.products)) {
      const texts = [
        key.toLowerCase(),
        product.name.toLowerCase(),
        product.category.toLowerCase(),
        product.description.toLowerCase(),
        ...(product.keywords || []).map(k => k.toLowerCase())
      ];
      
      const words = new Set();
      texts.forEach(text => {
        const cleanText = text.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
        cleanText.split(' ').forEach(word => {
          if (word.length > 1) {
            words.add(word);
          }
        });
      });
      
      words.forEach(word => {
        if (!this.invertedIndex[word]) {
          this.invertedIndex[word] = [];
        }
        if (!this.invertedIndex[word].includes(key)) {
          this.invertedIndex[word].push(key);
        }
      });
    }
  }

  search(query) {
    const cleanQuery = query.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!cleanQuery) return [];

    const words = cleanQuery.split(' ');
    const results = new Map();
    const scores = new Map();

    words.forEach(word => {
      if (this.invertedIndex[word]) {
        this.invertedIndex[word].forEach(key => {
          const product = this.products[key];
          let score = 0;
          
          if (key.includes(word)) score += 5;
          if (product.name.toLowerCase().includes(word)) score += 4;
          if (product.category.toLowerCase().includes(word)) score += 3;
          if ((product.keywords || []).some(k => k.toLowerCase().includes(word))) score += 2;
          
          if (score > 0) {
            const currentScore = scores.get(key) || 0;
            scores.set(key, currentScore + score);
            results.set(key, product);
          }
        });
      }
    });

    return Array.from(results.entries())
      .sort((a, b) => (scores.get(b[0])  0) - (scores.get(a[0])  0))
      .map(([key, product]) => ({ key, product, score: scores.get(key) || 0 }));
  }
}

const searchEngine = new SearchEngine();

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getStars(rating) {
  return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
}

function formatCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return '🛒 Корзина пуста';
  
  let text = '🛒 ВАША КОРЗИНА:\n\n';
  let total = 0;
  cartItems.forEach((item, index) => {
    const product = products[item.key];
    if (product) {
      const price = parseFloat(product.price);
      const subtotal = price * (item.quantity || 1);
      text += ${index+1}. ${product.name}\n;
      text +=    💰 ${product.price} × ${item.quantity || 1} = ${subtotal.toFixed(2)} BYN\n\n;
      total += subtotal;
    }
  });
  text += 💵 ИТОГО: ${total.toFixed(2)} BYN;
  return text;
}

// ==================== СОЗДАНИЕ БОТА ====================
const bot = new Telegraf(BOT_TOKEN);
bot.use(session({
  defaultSession: () => ({
    cart: [],
    rating: null,
    currentOrder: null
  })
}));

const app = express();
app.use(cors());
app.use(express.json());

// ==================== ВЕБ-СЕРВЕР ====================
app.get('/', (req, res) => {
  res.send(
    <!DOCTYPE html>
    <html>
    <head>
      <title>RadioPartsBY Bot</title>
      <style>
        body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; }
        .status { color: #00b894; font-weight: bold; }
        .info { color: #666; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📦 RadioPartsBY</h1>
        <p class="status">✅ Бот работает!</p>
        <p class="info">Telegram бот для магазина радиодеталей</p>
        <p style="margin-top: 20px; color: #999; font-size: 14px;">
          Товаров в каталоге: ${Object.keys(products).length}
        </p>
      </div>
    </body>
    </html>
  );
});

// ==================== API ЭНДПОИНТЫ ====================
app.get('/api/orders', (req, res) => {
  res.json(getOrders());
});

app.get('/api/reviews', (req, res) => {
  res.json(getReviews());
});

app.get('/api/products', (req, res) => {
  const statuses = getStatuses();
  const productsWithStatus = Object.entries(products).map(([key, product]) => ({
    ...product,
    key,
    status: statuses[key] || product.status
  }));
  res.json(productsWithStatus);
});

app.get('/api/search', (req, res) => {
  const query = req.query.q || '';
  const results = searchEngine.search(query);
  res.json(results);
});

// ==================== КОМАНДЫ БОТА ====================

bot.start((ctx) => {
  const keyboard = Markup.keyboard([
    ['🛒 Каталог', '📦 Корзина', '📦 Статус'],
    ['🔍 Поиск', '📞 Помощь', '⭐ Оставить отзыв']
  ]).resize();
  ctx.reply(
    '👋 Добро пожаловать в RadioPartsBY!\n\n' +
    '🔍 Просто напишите название товара для поиска!\n' +
    '✅ В наличии: ESP32 DevKit, Arduino Nano, OLED 0.96"\n' +
    '🚚 Остальное — под заказ (14–30 дней)',
    keyboard
  );
});

bot.hears('🔍 Поиск', (ctx) => {
  ctx.reply('🔍 Введите запрос для поиска:\n\nПримеры:\n• esp32\n• дисплей\n• транзистор\n• реле');
});

bot.hears('🛒 Каталог', (ctx) => {
  let text = '📦 КАТАЛОГ:\n\n';
  const categories = {};
  for (const [key, product] of Object.entries(products)) {
    const cat = product.category || 'Другое';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(key);
  }
  for (const [category, items] of Object.entries(categories)) {
    text += 🔹 ${category} (${items.length})\n;
  }
  text += '\n🔍 Напишите название для поиска';
  ctx.reply(text);
});

bot.hears('📦 Корзина', (ctx) => {
  const cart = getUserCart(ctx.from.id);
  if (cart.items.length === 0) {
    return ctx.reply('🛒 Ваша корзина пуста');
  }
  const text = formatCart(cart.items);
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Оформить заказ', 'checkout')],
    [Markup.button.callback('🗑️ Очистить корзину', 'clear_cart')]
  ]);
  ctx.reply(text, keyboard);
});

bot.hears('📦 Статус', (ctx) => {
  const orders = getOrders();
  const userOrders = orders.filter(o => o.userId === ctx.from.id);
  
if (userOrders.length === 0) {
    return ctx.reply('📭 У вас нет заказов');
  }
  let text = '📦 ВАШИ ЗАКАЗЫ:\n\n';
  userOrders.slice(-5).reverse().forEach(order => {
    text += #${order.id} — ${order.status || 'Новый'}\n;
    text += 📅 ${new Date(order.date).toLocaleDateString()}\n;
    text += 💵 ${order.total || 0} BYN\n\n;
  });
  ctx.reply(text);
});

bot.hears('📞 Помощь', (ctx) => {
  ctx.reply(
    '📞 ПОМОЩЬ:\n\n' +
    '🔍 Как найти: напишите название в чат\n' +
    '📦 Как заказать: добавьте в корзину и оформите\n' +
    '⏰ Время работы: Пн-Пт 9:00–18:00'
  );
});

bot.hears('⭐ Оставить отзыв', (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⭐ 1', 'rating_1'), Markup.button.callback('⭐⭐ 2', 'rating_2'), Markup.button.callback('⭐⭐⭐ 3', 'rating_3')],
    [Markup.button.callback('⭐⭐⭐⭐ 4', 'rating_4'), Markup.button.callback('⭐⭐⭐⭐⭐ 5', 'rating_5')]
  ]);
  ctx.reply('⭐ Оцените наш магазин от 1 до 5 звёзд:', keyboard);
});

bot.action(/rating_([1-5])/, (ctx) => {
  const rating = parseInt(ctx.match[1]);
  ctx.answerCbQuery('Вы выбрали ' + rating + ' звёзд');
  ctx.session.rating = rating;
  ctx.reply('Вы выбрали ' + getStars(rating) + '\n\nТеперь напишите текст отзыва:');
});

bot.on('text', (ctx) => {
  const text = ctx.message.text.trim();
  
  if (ctx.session?.rating && !text.startsWith('/') && !['🛒 Каталог', '📦 Корзина', '📦 Статус', '🔍 Поиск', '📞 Помощь', '⭐ Оставить отзыв'].includes(text)) {
    const rating = ctx.session.rating;
    const review = addReview({
      text: text,
      rating: rating,
      author: ctx.from.username  ctx.from.first_name  'Аноним'
    });
    ctx.session.rating = null;
    ctx.reply('✅ Спасибо за отзыв!\n\n⭐ ' + getStars(rating) + '\n📝 ' + text);
    return;
  }
  
  if (!text.startsWith('/') && !['🛒 Каталог', '📦 Корзина', '📦 Статус', '🔍 Поиск', '📞 Помощь', '⭐ Оставить отзыв'].includes(text)) {
    const results = searchEngine.search(text);
    
    if (results.length === 0) {
      return ctx.reply('🤷 Ничего не найдено. Попробуйте другие ключевые слова');
    }
    
    if (results.length === 1) {
      const { key, product } = results[0];
      const statuses = getStatuses();
      const status = statuses[key] || product.status;
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🛒 В корзину', add_to_cart_${key})]
      ]);
      ctx.replyWithPhoto(product.photo, {
        caption: '📦 ' + product.name + '\n💰 ' + product.price + '\n' + status + '\n\n' + product.description,
        ...keyboard
      });
      return;
    }
    
    let response = '🔍 Найдено ' + results.length + ' товаров:\n\n';
    results.slice(0, 10).forEach(({key, product}) => {
      const statuses = getStatuses();
      const status = statuses[key] || product.status;
      const icon = status.includes('✅') ? '✅' : '🚚';
      response += ${icon} ${product.name} — ${product.price}\n;
    });
    if (results.length > 10) response += \n... и еще ${results.length - 10};
    ctx.reply(response);
  }
});

bot.action(/add_to_cart_(.+)/, (ctx) => {
  const key = ctx.match[1];
  const product = products[key];
  if (!product) return ctx.answerCbQuery('❌ Товар не найден');
  
  const cart = getUserCart(ctx.from.id);
  const existing = cart.items.find(item => item.key === key);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.items.push({ key, quantity: 1 });
  }
  saveUserCart(ctx.from.id, cart.items);
  
  ctx.answerCbQuery('✅ Добавлено в корзину!');
  ctx.reply('✅ ' + product.name + ' добавлен в корзину!\n\nПерейдите в 📦 Корзина для оформления');
});

bot.action('clear_cart', (ctx) => {
  saveUserCart(ctx.from.id, []);
  ctx.answerCbQuery('🗑️ Корзина очищена');
  ctx.reply('🗑️ Корзина очищена');
});

bot.action('checkout', (ctx) => {
  const cart = getUserCart(ctx.from.id);
  if (cart.items.length === 0) {
    return ctx.answerCbQuery('❌ Корзина пуста');
  }
  
  ctx.session.currentOrder = {
    cart: cart.items,
    step: 'address'
  };
  
  ctx.reply(
    '📝 ОФОРМЛЕНИЕ ЗАКАЗА\n\nШаг 1/3: Введите адрес доставки:',
    Markup.inlineKeyboard([[Markup.button.callback('❌ Отмена', 'cancel_order')]])
  );
});

bot.action('cancel_order', (ctx) => {
  ctx.session.currentOrder = null;
  ctx.reply('❌ Оформление заказа отменено');
});

bot.on('text', async (ctx) => {
  const order = ctx.session.currentOrder;
  if (!order) return;
  if (['🛒 Каталог', '📦 Корзина', '📦 Статус', '🔍 Поиск', '📞 Помощь', '⭐ Оставить отзыв'].includes(ctx.message.text)) return;
  
  const text = ctx.message.text.trim();
  
  if (order.step === 'address') {
    order.address = text;
    order.step = 'phone';
    ctx.reply('📝 Шаг 2/3: Введите номер телефона:');
  } else if (order.step === 'phone') {
    order.phone = text;
    order.step = 'confirm';
    
    let orderText = '✅ ПОДТВЕРДИТЕ ЗАКАЗ:\n\n';
    let total = 0;
    order.cart.forEach(item => {
      const product = products[item.key];
      if (product) {
        const price = parseFloat(product.price);
        const subtotal = price * (item.quantity || 1);
        orderText += • ${product.name} x${item.quantity || 1} = ${subtotal.toFixed(2)} BYN\n;
        total += subtotal;
      }
    });
    orderText += \n💵 Итого: ${total.toFixed(2)} BYN;
    orderText += \n📍 ${order.address};
    orderText += \n📱 ${order.phone};
    
    ctx.reply(orderText, Markup.inlineKeyboard([
      [Markup.button.callback('✅ Подтвердить', 'confirm_order')],
      [Markup.button.callback('❌ Отмена', 'cancel_order')]
    ]));
  }
});

bot.action('confirm_order', (ctx) => {
  const order = ctx.session.currentOrder;
  if (!order) return;
  
  const orders = getOrders();
  const newOrder = {
    id: orders.length + 1,
    userId: ctx.from.id,
    items: order.cart,
    total: order.cart.reduce((sum, item) => {
      const product = products[item.key];
      return sum + parseFloat(product?.price  '0') * (item.quantity  1);
    }, 0),
    address: order.address,
    phone: order.phone,
    status: 'Новый',
    date: new Date().toISOString()
  };
  
  orders.push(newOrder);
  saveOrders(orders);
  saveUserCart(ctx.from.id, []);
  ctx.session.currentOrder = null;
  
  ctx.reply('✅ ЗАКАЗ #' + newOrder.id + ' ОФОРМЛЕН!\n\nСпасибо за покупку!');
  
  bot.telegram.sendMessage(
    ADMIN_ID,
    '📦 НОВЫЙ ЗАКАЗ #' + newOrder.id + '\n\n' +
    '👤 ' + ctx.from.first_name + '\n' +
    '📍 ' + newOrder.address + '\n' +
    '📱 ' + newOrder.phone + '\n' +
    '💵 ' + newOrder.total.toFixed(2) + ' BYN'
  );
});

// ==================== АДМИН-КОМАНДЫ ====================
bot.command('status', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const orders = getOrders();
  const reviews = getReviews();
  let avgRating = 0;
  if (reviews.length > 0) {
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    avgRating = (sum / reviews.length).toFixed(1);
  }
  ctx.reply(
    '📊 СТАТИСТИКА:\n\n' +
    '📦 Заказов: ' + orders.length + '\n' +
    '⭐ Отзывов: ' + reviews.length + '\n' +
    '📈 Рейтинг: ' + avgRating + ' ' + getStars(Math.round(avgRating))
  );
});

bot.command('export', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const orders = getOrders();
  if (orders.length === 0) return ctx.reply('📭 Нет заказов');
  const filePath = path.join(DATA_DIR, 'export_orders.json');
  fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
  ctx.replyWithDocument(
    { source: filePath, filename: 'orders_' + new Date().toISOString().slice(0, 10) + '.json' },
    { caption: '📦 Экспорт заказов (' + orders.length + ' шт.)' }
  );
  fs.unlinkSync(filePath);
});

bot.command('set_status', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    return ctx.reply('⚠️ Используйте: /set_status "ключ" "статус"\n\nПример: /set_status "esp32 devkit" "✅ В наличии"');
  }
  const key = args.slice(1, -1).join(' ').toLowerCase();
  const newStatus = args.slice(-1).join(' ');
  if (!products[key]) {
    return ctx.reply('❌ Товар не найден. Доступные ключи:\n' + Object.keys(products).slice(0, 10).join(', ') + '...');
  }
  const statuses = getStatuses();
  statuses[key] = newStatus;
  saveStatuses(statuses);
  ctx.reply('✅ Статус товара "' + products[key].name + '" изменён на:\n' + newStatus);
});

bot.command('reset_status', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('⚠️ Используйте: /reset_status "ключ"');
  const key = args.slice(1).join(' ').toLowerCase();
  if (!products[key]) return ctx.reply('❌ Товар не найден');
  const statuses = getStatuses();
  if (statuses[key]) {
    delete statuses[key];
    saveStatuses(statuses);
    ctx.reply('✅ Статус товара "' + products[key].name + '" сброшен до значения из кода.');
  } else {
    ctx.reply('ℹ️ У товара "' + products[key].name + '" не было переопределённого статуса.');
  }
});

bot.command('delete_order', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('⚠️ Укажите номер заказа: /delete_order 123');
  const orderId = parseInt(args[1]);
  if (isNaN(orderId)) return ctx.reply('⚠️ Номер должен быть числом.');
  let orders = getOrders();
  const index = orders.findIndex(o => o.id === orderId);
  if (index === -1) return ctx.reply('❌ Заказ #' + orderId + ' не найден.');
  orders.splice(index, 1);
  saveOrders(orders);
  ctx.reply('✅ Заказ #' + orderId + ' удалён.');
});

bot.command('delete_review', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('⚠️ Укажите номер отзыва: /delete_review 123');
  const reviewId = parseInt(args[1]);
  if (isNaN(reviewId)) return ctx.reply('⚠️ Номер должен быть числом.');
  let reviews = getReviews();
  const index = reviews.findIndex(r => r.id === reviewId);
  if (index === -1) return ctx.reply('❌ Отзыв #' + reviewId + ' не найден.');
  reviews.splice(index, 1);
  saveReviews(reviews);
  ctx.reply('✅ Отзыв #' + reviewId + ' удалён.');
});

// ==================== ЗАПУСК ====================
const server = app.listen(PORT, () => {
  console.log(✅ Веб-сервер запущен на порту ${PORT});
  console.log(🌐 Админ-панель: ${PUBLIC_URL});
});

bot.launch()
  .then(() => {
    console.log('✅ Бот запущен!');
    console.log(📱 Бот: https://t.me/${bot.botInfo.username});
    console.log(📊 Товаров в каталоге: ${Object.keys(products).length});
  })
  .catch(err => {
    console.error('❌ Ошибка запуска бота:', err.message);
    process.exit(1);
  });

process.once('SIGINT', () => {
  bot.stop('SIGINT');
  server.close();
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  server.close();
});

console.log('✅ Бот готов к работе!');
    
