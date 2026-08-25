
const { Telegraf, Markup, session } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const BOT_TOKEN = process.env.BOT_TOKEN || '8916472134:AAF0oi0BJeEDkC8pN7weabKMt8pqfhRUmjI';
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 5179932939;
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || https://your-domain.com/webhook;

const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');
const CART_FILE = path.join(DATA_DIR, 'cart.json');

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function initDB() {
  const files = [ORDERS_FILE, REVIEWS_FILE, STATUS_FILE, CART_FILE];
  files.forEach(file => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify([]));
  });
}
initDB();

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } 
  catch { return []; }
}
function writeJSON(file, data) { 
  fs.writeFileSync(file, JSON.stringify(data, null, 2)); 
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

// ==================== ТОВАРЫ ====================
const products = {
  'esp32 devkit': { 
    name: 'ESP32 DevKit V1', 
    price: '19 BYN', 
    status: '✅ В наличии',
    photo: 'https://example.com/esp32.jpg',
    keywords: ['esp32', 'devkit', 'esp', 'esp32 dev kit', 'esp32 development board', 'esp32 v1', 'type-c'],
    category: 'Микроконтроллеры',
    description: 'Мощный микроконтроллер с Wi-Fi и Bluetooth'
  },
  'esp8266': { 
    name: 'ESP8266 NodeMCU', 
    price: '15 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/esp8266.jpg',
    keywords: ['esp8266', 'nodemcu', 'esp', 'esp8266 wifi', 'iot'],
    category: 'Микроконтроллеры',
    description: 'Популярный Wi-Fi модуль для IoT проектов'
  },
  'arduino nano': { 
    name: 'Arduino Nano V3', 
    price: '14 BYN', 
    status: '✅ В наличии',
    photo: 'https://example.com/nano.jpg',
    keywords: ['arduino', 'nano', 'arduino nano', 'nano v3', 'arduino board', 'type-c'],
    category: 'Микроконтроллеры',
    description: 'Компактная плата Arduino с Type-C'
  },
  'arduino uno': { 
    name: 'Arduino Uno R3', 
    price: '25 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/uno.jpg',
    keywords: ['arduino', 'uno', 'arduino uno', 'uno r3', 'atmega328'],
    category: 'Микроконтроллеры',
    description: 'Классическая плата Arduino Uno R3'
  },
  'arduino mega': { 
    name: 'Arduino Mega 2560', 
    price: '35 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/mega.jpg',
    keywords: ['arduino', 'mega', 'mega 2560', 'arduino mega', 'atmega2560'],

    category: 'Микроконтроллеры',
    description: 'Мощная плата с большим количеством пинов'
  },
  'stm32': { 
    name: 'STM32F103C8T6 (Blue Pill)', 
    price: '12 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/stm32.jpg',
    keywords: ['stm32', 'blue pill', 'stm32f103', 'stm32f103c8t6', 'arm'],
    category: 'Микроконтроллеры',
    description: '32-битный ARM микроконтроллер'
  },
  'raspberry pi pico': { 
    name: 'Raspberry Pi Pico', 
    price: '15 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/pico.jpg',
    keywords: ['raspberry', 'pico', 'raspberry pi pico', 'rp2040', 'raspberry pico'],
    category: 'Микроконтроллеры',
    description: 'Микроконтроллер с RP2040 от Raspberry'
  },
  'esp32-cam': { 
    name: 'ESP32-CAM с камерой', 
    price: '18 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/esp32cam.jpg',
    keywords: ['esp32', 'cam', 'esp32-cam', 'камера', 'esp32 camera', 'ov2640'],
    category: 'Микроконтроллеры',
    description: 'ESP32 с камерой OV2640'
  },
  'esp32-s3': { 
    name: 'ESP32-S3', 
    price: '18 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/esp32s3.jpg',
    keywords: ['esp32', 's3', 'esp32-s3', 'wifi', 'ble', 'bluetooth'],
    category: 'Микроконтроллеры',
    description: 'ESP32-S3 с Wi-Fi и BLE'
  },
  'oled 0.96': { 
    name: 'OLED 0.96" I2C (SSD1306)', 
    price: '9 BYN', 
    status: '✅ В наличии',
    photo: 'https://example.com/oled96.jpg',
    keywords: ['oled', '0.96', 'ssd1306', 'i2c', 'дисплей', 'экран', '0.96 дюйма'],
    category: 'Дисплеи',
    description: 'Маленький OLED дисплей 0.96 дюйма'
  },
  'oled 1.3': { 
    name: 'OLED 1.3" I2C (SH1106)', 
    price: '12 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/oled13.jpg',
    keywords: ['oled', '1.3', 'sh1106', 'дисплей', 'экран', '1.3 дюйма'],
    category: 'Дисплеи',
    description: 'OLED дисплей 1.3 дюйма'
  },
  'lcd 1602': { 
    name: 'LCD 1602', 
    price: '9 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/lcd1602.jpg',
    keywords: ['lcd', '1602', 'lcd 1602', 'дисплей', 'экран', 'жидкокристаллический'],
    category: 'Дисплеи',
    description: 'Символьный LCD дисплей 16x2'
  },
  'lcd 2004': { 
    name: 'LCD 2004', 
    price: '11 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/lcd2004.jpg',
    keywords: ['lcd', '2004', 'lcd 2004', 'дисплей', 'экран', '20x4'],
    category: 'Дисплеи',
    description: 'Символьный LCD дисплей 20x4'
  },
  'tft 1.8': { 
    name: 'TFT 1.8" ST7735', 
    price: '12 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/tft18.jpg',
    keywords: ['tft', '1.8', 'st7735', 'дисплей', 'цветной', 'экран'],
    category: 'Дисплеи',
    description: 'Цветной TFT дисплей 1.8 дюйма'
  },
  'tft 2.4': { 
    name: 'TFT 2.4" ILI9341', 
    price: '18 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/tft24.jpg',
    keywords: ['tft', '2.4', 'ili9341', 'дисплей', 'цветной', 'экран', '240x320'],
    category: 'Дисплеи',
    description: 'Цветной TFT дисплей 2.4 дюйма'
  },
  '7 segment': { 
    name: '7-сегментный индикатор', 
    price: '6 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/7seg.jpg',
    keywords: ['7 сегмент', 'сегмент', 'индикатор', 'семисегментный', '4 разряда'],
    category: 'Дисплеи',
    description: '4-разрядный 7-сегментный индикатор'
  },
  'max7219': { 
    name: 'MAX7219 8x8 матрица', 
    price: '10 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/max7219.jpg',
    keywords: ['max7219', 'матрица', '8x8', 'светодиодная матрица', 'led matrix'],

    category: 'Дисплеи',
    description: 'Светодиодная матрица 8x8 с драйвером MAX7219'
  },
  'hc-sr04': { 
    name: 'HC-SR04 ультразвуковой датчик', 
    price: '10 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/hcsr04.jpg',
    keywords: ['hc-sr04', 'ультразвук', 'датчик расстояния', 'ultrasonic', 'sonar', 'эхолокатор'],
    category: 'Датчики',
    description: 'Ультразвуковой датчик расстояния'
  },
  'dht22': { 
    name: 'DHT22 температура/влажность', 
    price: '14 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/dht22.jpg',
    keywords: ['dht22', 'температура', 'влажность', 'dht', 'датчик температуры', 'датчик влажности'],
    category: 'Датчики',
    description: 'Цифровой датчик температуры и влажности'
  },
  'dht11': { 
    name: 'DHT11 температура/влажность', 
    price: '8 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/dht11.jpg',
    keywords: ['dht11', 'температура', 'влажность', 'датчик температуры', 'датчик влажности'],
    category: 'Датчики',
    description: 'Бюджетный датчик температуры и влажности'
  },
  'ds18b20': { 
    name: 'DS18B20 температура', 
    price: '6 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/ds18b20.jpg',
    keywords: ['ds18b20', 'температура', 'датчик температуры', '1-wire', 'цифровой'],
    category: 'Датчики',
    description: 'Цифровой датчик температуры с интерфейсом 1-Wire'
  },
  'bme280': { 
    name: 'BME280 темп./влажн./давление', 
    price: '15 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/bme280.jpg',
    keywords: ['bme280', 'температура', 'влажность', 'давление', 'барометр', 'атмосферное давление'],
    category: 'Датчики',
    description: 'Датчик температуры, влажности и атмосферного давления'
  },
  'mpu6050': { 
    name: 'MPU6050 гироскоп+акселерометр', 
    price: '12 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/mpu6050.jpg',
    keywords: ['mpu6050', 'гироскоп', 'акселерометр', 'imu', 'датчик движения', 'gyroscope'],
    category: 'Датчики',
    description: '6-осевой IMU датчик (гироскоп + акселерометр)'
  },
  'hc-05': { 
    name: 'HC-05 Bluetooth модуль', 
    price: '10 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/hc05.jpg',
    keywords: ['hc-05', 'bluetooth', 'bluetooth модуль', 'hc05', 'blue tooth'],
    category: 'Датчики',
    description: 'Bluetooth модуль для беспроводной связи'
  },
  'rfid rc522': { 
    name: 'RFID RC522 считыватель', 
    price: '10 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/rfid.jpg',
    keywords: ['rfid', 'rc522', 'считыватель', 'rfid модуль', 'карта', 'ключ-карта'],
    category: 'Датчики',
    description: 'Модуль считывания RFID карт и ключей'
  },
  'max30102': { 
    name: 'MAX30102 пульсоксиметр', 
    price: '12 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/max30102.jpg',
    keywords: ['max30102', 'пульсоксиметр', 'пульс', 'оксиметр', 'spo2', 'heart rate'],
    category: 'Датчики',
    description: 'Датчик пульса и уровня кислорода в крови'
  },
  'mq-2': { 
    name: 'MQ-2 газовый датчик', 
    price: '10 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/mq2.jpg',
    keywords: ['mq-2', 'газ', 'датчик газа', 'газовый датчик', 'сжиженный газ', 'дым'],
    category: 'Датчики',
    description: 'Датчик обнаружения газов и дыма'
  },
  'ttp223': { 
    name: 'TTP223 сенсорная кнопка', 
    price: '4 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/ttp223.jpg',
    keywords: ['ttp223', 'сенсорная кнопка', 'сенсор', 'touch', 'касание'],
    category: 'Датчики',

    description: 'Модуль сенсорной кнопки'
  },
  'ky-038': { 
    name: 'KY-038 датчик звука', 
    price: '5 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/ky038.jpg',
    keywords: ['ky-038', 'звук', 'микрофон', 'датчик звука', 'audio', 'microphone'],
    category: 'Датчики',
    description: 'Модуль датчика звука с микрофоном'
  },
  'pir hc-sr501': { 
    name: 'PIR HC-SR501 датчик движения', 
    price: '10 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/pir.jpg',
    keywords: ['pir', 'hc-sr501', 'датчик движения', 'детектор движения', 'инфракрасный', 'motion'],
    category: 'Датчики',
    description: 'Инфракрасный датчик движения'
  },
  'фоторезистор': { 
    name: 'Фоторезистор с модулем', 
    price: '5 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/photoresistor.jpg',
    keywords: ['фоторезистор', 'свет', 'датчик света', 'освещенность', 'photoresistor', 'ldr'],
    category: 'Датчики',
    description: 'Датчик освещенности на фоторезисторе'
  },
  'влажность почвы': { 
    name: 'Датчик влажности почвы', 
    price: '7 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/soilmoisture.jpg',
    keywords: ['влажность', 'почва', 'земля', 'датчик почвы', 'soil moisture', 'гигрометр'],
    category: 'Датчики',
    description: 'Датчик для измерения влажности почвы'
  },
  'bc547': { 
    name: 'BC547 (NPN) 10 шт.', 
    price: '5 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/bc547.jpg',
    keywords: ['bc547', 'транзистор', 'npn', 'bc547b', 'bc547c', 'биполярный'],
    category: 'Транзисторы',
    description: 'NPN биполярный транзистор, 10 штук'
  },
  'bc557': { 
    name: 'BC557 (PNP) 10 шт.', 
    price: '5 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/bc557.jpg',
    keywords: ['bc557', 'транзистор', 'pnp', 'bc557b', 'bc557c'],
    category: 'Транзисторы',
    description: 'PNP биполярный транзистор, 10 штук'
  },
  '2n2222': { 
    name: '2N2222 (NPN) 10 шт.', 
    price: '5 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/2n2222.jpg',
    keywords: ['2n2222', 'транзистор', 'npn', '2n2222a'],
    category: 'Транзисторы',
    description: 'NPN биполярный транзистор, 10 штук'
  },
  '2n3904': { 
    name: '2N3904 (NPN) 10 шт.', 
    price: '5 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/2n3904.jpg',
    keywords: ['2n3904', 'транзистор', 'npn'],
    category: 'Транзисторы',
    description: 'NPN биполярный транзистор, 10 штук'
  },
  '2n3906': { 
    name: '2N3906 (PNP) 10 шт.', 
    price: '5 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/2n3906.jpg',
    keywords: ['2n3906', 'транзистор', 'pnp'],
    category: 'Транзисторы',
    description: 'PNP биполярный транзистор, 10 штук'
  },
  's8050': { 
    name: 'S8050 (NPN) 10 шт.', 
    price: '4 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/s8050.jpg',
    keywords: ['s8050', 'транзистор', 'npn', 's8050c'],
    category: 'Транзисторы',
    description: 'NPN биполярный транзистор, 10 штук'
  },
  's8550': { 
    name: 'S8550 (PNP) 10 шт.', 
    price: '4 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/s8550.jpg',
    keywords: ['s8550', 'транзистор', 'pnp', 's8550c'],
    category: 'Транзисторы',
    description: 'PNP биполярный транзистор, 10 штук'
  },
  'ne555': { 
    name: 'NE555 таймер', 
    price: '3 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/ne555.jpg',
    keywords: ['ne555', '555', 'таймер', 'timer', 'ne555p'],
    category: 'Микросхемы',
    description: 'Классический таймер NE555'

    },
  'lm358': { 
    name: 'LM358 сдвоенный ОУ', 
    price: '3 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/lm358.jpg',
    keywords: ['lm358', 'операционный усилитель', 'оу', 'dual op-amp'],
    category: 'Микросхемы',
    description: 'Сдвоенный операционный усилитель'
  },
  'lm324': { 
    name: 'LM324 четверной ОУ', 
    price: '4 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/lm324.jpg',
    keywords: ['lm324', 'операционный усилитель', 'оу', 'quad op-amp'],
    category: 'Микросхемы',
    description: 'Четверной операционный усилитель'
  },
  '74hc595': { 
    name: '74HC595 сдвиговый регистр', 
    price: '3 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/74hc595.jpg',
    keywords: ['74hc595', 'сдвиговый регистр', 'shift register', 'hc595'],
    category: 'Микросхемы',
    description: '8-битный сдвиговый регистр'
  },
  '7805': { 
    name: '7805 +5V стабилизатор', 
    price: '3 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/7805.jpg',
    keywords: ['7805', 'стабилизатор', '5v', 'l7805', 'lm7805', '+5v'],
    category: 'Стабилизаторы',
    description: 'Линейный стабилизатор напряжения +5В'
  },
  '7812': { 
    name: '7812 +12V стабилизатор', 
    price: '3 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/7812.jpg',
    keywords: ['7812', 'стабилизатор', '12v', 'l7812', 'lm7812', '+12v'],
    category: 'Стабилизаторы',
    description: 'Линейный стабилизатор напряжения +12В'
  },
  'lm317': { 
    name: 'LM317 регулируемый стабилизатор', 
    price: '4 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/lm317.jpg',
    keywords: ['lm317', 'стабилизатор', 'регулируемый', 'lm317t'],
    category: 'Стабилизаторы',
    description: 'Регулируемый стабилизатор напряжения'
  },
  'реле 1': { 
    name: 'Реле 5V 1-канальное', 
    price: '4 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/relay1.jpg',
    keywords: ['реле', 'реле 5в', '1 канал', 'relay', 'механическое реле'],
    category: 'Реле и драйверы',
    description: 'Одноканальное реле на 5В'
  },
  'реле 2': { 
    name: 'Реле 5V 2-канальное', 
    price: '6 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/relay2.jpg',
    keywords: ['реле', '2 канала', 'relay', 'реле 5в 2 канала'],
    category: 'Реле и драйверы',
    description: 'Двухканальное реле на 5В'
  },
  'реле 4': { 
    name: 'Реле 5V 4-канальное', 
    price: '9 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/relay4.jpg',
    keywords: ['реле', '4 канала', 'relay', 'реле 5в 4 канала'],
    category: 'Реле и драйверы',
    description: 'Четырехканальное реле на 5В'
  },
  '5v 2a': { 
    name: '5V 2A USB-адаптер', 
    price: '10 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/5v2a.jpg',
    keywords: ['блок питания', '5v', '2a', 'usb', 'адаптер', 'зарядка', 'power supply'],
    category: 'Блоки питания',
    description: 'Блок питания 5В 2А с USB'
  },
  '12v 2a': { 
    name: '12V 2A адаптер', 
    price: '10 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/12v2a.jpg',
    keywords: ['блок питания', '12v', '2a', 'адаптер', 'power supply', '12 вольт'],
    category: 'Блоки питания',
    description: 'Блок питания 12В 2А'
  },
  '12v 5a': { 
    name: '12V 5A импульсный', 
    price: '22 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/12v5a.jpg',
    keywords: ['блок питания', '12v', '5a', 'импульсный', 'power supply', '12 вольт 5 ампер'],
    category: 'Блоки питания',
    description: 'Импульсный блок питания 12В 5А'
  },

  'sg90': { 
    name: 'SG90 микро-серво', 
    price: '6 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/sg90.jpg',
    keywords: ['sg90', 'серво', 'micro servo', 'сервопривод', '9g', 'сервомашинка'],
    category: 'Моторы и серво',
    description: 'Микро-сервопривод SG90 9г'
  },
  'mg90s': { 
    name: 'MG90S металлический серво', 
    price: '8 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/mg90s.jpg',
    keywords: ['mg90s', 'серво', 'металлический', 'servo', '13g', 'сервопривод'],
    category: 'Моторы и серво',
    description: 'Сервопривод MG90S с металлическими шестернями'
  },
  '28byj-48': { 
    name: '28BYJ-48 шаговый двигатель', 
    price: '6 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/28byj48.jpg',
    keywords: ['28byj-48', 'шаговый двигатель', 'шаговик', 'stepper', 'step motor'],
    category: 'Моторы и серво',
    description: '5В шаговый двигатель 28BYJ-48'
  },
  'nema17': { 
    name: 'NEMA17 шаговый двигатель', 
    price: '14 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/nema17.jpg',
    keywords: ['nema17', 'шаговый двигатель', 'шаговик', 'nema 17', 'stepper'],
    category: 'Моторы и серво',
    description: 'Шаговый двигатель NEMA17'
  },
  'dupont мм': { 
    name: 'Dupont мама-мама 40 шт.', 
    price: '4 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/dupont_f_f.jpg',
    keywords: ['dupont', 'мама-мама', 'провода', 'перемычки', 'f-f', 'соединительные провода'],
    category: 'Разъёмы и провода',
    description: 'Набор проводов Dupont мама-мама 40 шт.'
  },
  'dupont пп': { 
    name: 'Dupont папа-папа 40 шт.', 
    price: '4 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/dupont_m_m.jpg',
    keywords: ['dupont', 'папа-папа', 'провода', 'перемычки', 'm-m'],
    category: 'Разъёмы и провода',
    description: 'Набор проводов Dupont папа-папа 40 шт.'
  },
  'макетная плата': { 
    name: 'Макетная плата (Breadboard)', 
    price: '12 BYN', 
    status: '🚚 Под заказ (14–30 дней)',
    photo: 'https://example.com/breadboard.jpg',
    keywords: ['макетная плата', 'breadboard', 'макетка', 'беспаечная плата', 'плата для макетирования'],
    category: 'Разъёмы и провода',
    description: 'Беспаечная макетная плата для прототипирования'
  }
};

// ==================== ПОИСКОВАЯ СИСТЕМА ====================
class SearchEngine {
  constructor() {
    this.products = products;
    this.invertedIndex = {};
    this.synonyms = {};
    this.buildIndex();
    this.buildSynonyms();
  }

  buildIndex() {
    this.invertedIndex = {};
    for (const [key, product] of Object.entries(this.products)) {
      const texts = [
        key,
        product.name,
        product.category,
        product.description || '',
        ...(product.keywords || [])
      ];
      
      const words = new Set();
      texts.forEach(text => {
        const cleanText = text.toLowerCase()
          .replace(/[^\w\s\-]/g, ' ')
          .replace(/\s+/g, ' ');
        cleanText.split(' ').forEach(word => {
          if (word.length > 1) {
            words.add(word);
            for (let i = 2; i <= word.length; i++) {
              words.add(word.substring(0, i));
            }
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

  buildSynonyms() {
    this.synonyms = {
      'esp': ['esp32', 'esp8266', 'esp32-s3', 'esp32-cam'],
      'arduino': ['nano', 'uno', 'mega', 'arduino nano', 'arduino uno', 'arduino mega'],

      'дисплей': ['oled', 'lcd', 'tft', 'экран', 'индикатор'],
      'экран': ['дисплей', 'oled', 'lcd', 'tft', 'индикатор'],
      'датчик': ['сенсор', 'датчики', 'модуль датчика'],
      'сенсор': ['датчик', 'датчики'],
      'транзистор': ['bc547', 'bc557', '2n2222', '2n3904', 's8050', 's8550'],
      'стабилизатор': ['7805', '7812', 'lm317', 'lm2596'],
      'реле': ['relay', 'реле 5в'],
      'серво': ['sg90', 'mg90s', 'mg995', 'сервопривод'],
      'мотор': ['двигатель', 'шаговый', 'моторчик'],
      'двигатель': ['мотор', 'моторчик', 'шаговый'],
      'питание': ['блок питания', 'адаптер', 'power supply'],
      'bluetooth': ['hc-05', 'bluetooth модуль'],
      'wifi': ['esp8266', 'esp32', 'esp32-s3'],
      'камера': ['esp32-cam', 'ov2640'],
      'ультразвук': ['hc-sr04', 'ultrasonic'],
      'инфракрасный': ['pir', 'hc-sr501', 'ir'],
      'звук': ['ky-038', 'микрофон'],
      'свет': ['фоторезистор', 'фоторезистор с модулем'],
      'газ': ['mq-2', 'газовый датчик'],
      'пульс': ['max30102', 'пульсоксиметр'],
      'макетка': ['макетная плата', 'breadboard'],
      'шаговик': ['28byj-48', 'nema17', 'шаговый двигатель']
    };
  }

  getSynonyms(word) {
    const cleanWord = word.toLowerCase().replace(/[^\w\s]/g, '');
    return this.synonyms[cleanWord] || [];
  }

  search(query) {
    const cleanQuery = query.toLowerCase()
      .replace(/[^\w\s\-]/g, ' ')
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
          const productName = product.name.toLowerCase();
          const keywords = product.keywords || [];
          
          let score = 0;
          if (key.includes(word)) score += 5;
          if (productName.includes(word)) score += 4;
          if (keywords.some(k => k.includes(word))) score += 3;
          if (product.category.toLowerCase().includes(word)) score += 2;
          if (word.length >= 3 && productName.includes(word)) score += 1;
          
          if (score > 0) {
            const currentScore = scores.get(key) || 0;
            scores.set(key, currentScore + score);
            results.set(key, product);
          }
        });
      }

      const synonyms = this.getSynonyms(word);
      synonyms.forEach(synonym => {
        if (this.invertedIndex[synonym]) {
          this.invertedIndex[synonym].forEach(key => {
            const product = this.products[key];
            const currentScore = scores.get(key) || 0;
            scores.set(key, currentScore + 3);
            results.set(key, product);
          });
        }
      });
    });

    Object.entries(this.products).forEach(([key, product]) => {
      const productName = product.name.toLowerCase();
      const hasAllWords = words.every(word => {
        return productName.includes(word) || 
               key.includes(word) ||
               (product.keywords || []).some(k => k.includes(word));
      });
      
      if (hasAllWords && !results.has(key)) {
        const score = words.length * 2;
        scores.set(key, score);
        results.set(key, product);
      }
    });

    return Array.from(results.entries())
      .sort((a, b) => (scores.get(b[0])  0) - (scores.get(a[0])  0))
      .map(([key, product]) => ({
        key,
        product,
        score: scores.get(key) || 0
      }));
  }

  searchByCategory(category) {
    const results = [];
    for (const [key, product] of Object.entries(this.products)) {
      if (product.category && product.category.toLowerCase().includes(category.toLowerCase())) {
        results.push({ key, product, score: 5 });
      }
    }
    return results;
  }

  getAllCategories() {
    const categories = new Set();
    for (const product of Object.values(this.products)) {
      if (product.category) categories.add(product.category);
    }
    return Array.from(categories);
  }
}

const searchEngine = new SearchEngine();

// ==================== БОТ ====================
const bot = new Telegraf(BOT_TOKEN);
bot.use(session({
  defaultSession: () => ({
    cart: [],
    rating: null,
    currentOrder: null,
    lastSearch: null,
    searchQuery: null
  })
}));

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== ВЕБ-ИНТЕРФЕЙС ДЛЯ АДМИНА ====================
// Создаем папку public с HTML
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);

// Главная страница админ-панели
const adminHTML = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RadioPartsBY - Админ-панель</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .header h1 { font-size: 28px; }
        .header p { opacity: 0.9; margin-top: 5px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .stat-card h3 { color: #666; font-size: 14px; text-transform: uppercase; }
        .stat-card .number { font-size: 32px; font-weight: bold; color: #333; margin-top: 5px; }
        .stat-card .label { color: #888; font-size: 12px; margin-top: 5px; }
        .section { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .section h2 { margin-bottom: 15px; color: #333; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f0f0f0; padding: 10px; text-align: left; font-weight: 600; }
        td { padding: 10px; border-bottom: 1px solid #eee; }
        .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-new { background: #ffd93d; color: #333; }
        .status-processing { background: #6c5ce7; color: white; }
        .status-shipped { background: #00b894; color: white; }
        .status-delivered { background: #00b894; color: white; }
        .btn { padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; transition: 0.3s; }
        .btn-primary { background: #667eea; color: white; }
        .btn-primary:hover { background: #5a6fd6; }
        .btn-danger { background: #e74c3c; color: white; }
        .btn-danger:hover { background: #c0392b; }
        .btn-success { background: #00b894; color: white; }
        .btn-success:hover { background: #00a381; }
        .btn-sm { padding: 4px 10px; font-size: 12px; }
        .search-box { display: flex; gap: 10px; margin-bottom: 15px; }
        .search-box input { flex: 1; padding: 10px; border: 2px solid #ddd; border-radius: 5px; font-size: 16px; }
        .search-box input:focus { outline: none; border-color: #667eea; }
        .search-box button { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .search-box button:hover { background: #5a6fd6; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; }
        .modal-content { background: white; padding: 30px; border-radius: 10px; max-width: 500px; width: 90%; }

        .modal-content h3 { margin-bottom: 15px; }
        .modal-content input, .modal-content select { width: 100%; padding: 10px; margin-bottom: 10px; border: 2px solid #ddd; border-radius: 5px; }
        .modal-content .buttons { display: flex; gap: 10px; justify-content: flex-end; margin-top: 15px; }
        .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
        .product-card { background: #fafafa; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
        .product-card h4 { margin-bottom: 5px; }
        .product-card .price { color: #667eea; font-weight: bold; }
        .product-card .status { font-size: 12px; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab { padding: 10px 20px; background: #f0f0f0; border-radius: 5px; cursor: pointer; border: none; }
        .tab.active { background: #667eea; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        @media (max-width: 768px) { .stats { grid-template-columns: 1fr 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 RadioPartsBY Админ-панель</h1>
            <p>Управление заказами, товарами и отзывами</p>
        </div>

        <div class="stats" id="stats">
            <div class="stat-card">
                <h3>📦 Заказы</h3>
                <div class="number" id="totalOrders">0</div>
                <div class="label">Всего заказов</div>
            </div>
            <div class="stat-card">
                <h3>🔄 В обработке</h3>
                <div class="number" id="processingOrders">0</div>
                <div class="label">Активных заказов</div>
            </div>
            <div class="stat-card">
                <h3>⭐ Отзывы</h3>
                <div class="number" id="totalReviews">0</div>
                <div class="label">Всего отзывов</div>
            </div>
            <div class="stat-card">
                <h3>📈 Рейтинг</h3>
                <div class="number" id="avgRating">0</div>
                <div class="label">Средний рейтинг</div>
            </div>
            <div class="stat-card">
                <h3>📦 Товары</h3>
                <div class="number" id="totalProducts">0</div>
                <div class="label">В каталоге</div>
            </div>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('orders')">📦 Заказы</button>
            <button class="tab" onclick="showTab('products')">🛒 Товары</button>
            <button class="tab" onclick="showTab('reviews')">⭐ Отзывы</button>
        </div>

        <div id="tab-orders" class="tab-content active">
            <div class="section">
                <h2>📦 Заказы</h2>
                <div id="ordersList">Загрузка...</div>
            </div>
        </div>

        <div id="tab-products" class="tab-content">
            <div class="section">
                <h2>🛒 Товары</h2>
                <div class="search-box">
                    <input type="text" id="productSearch" placeholder="Поиск товаров..." onkeyup="searchProducts()">
                    <button onclick="searchProducts()">🔍 Найти</button>
                    <button class="btn btn-success" onclick="showAddProduct()">➕ Добавить</button>
                </div>
                <div id="productsList" class="product-grid">Загрузка...</div>
            </div>
        </div>

        <div id="tab-reviews" class="tab-content">
            <div class="section">
                <h2>⭐ Отзывы</h2>
                <div id="reviewsList">Загрузка...</div>
            </div>
        </div>
    </div>

    <!-- Модальное окно -->
    <div class="modal" id="modal">
        <div class="modal-content">

        <h3 id="modalTitle">Действие</h3>
            <div id="modalBody"></div>
            <div class="buttons">
                <button class="btn" onclick="closeModal()">Отмена</button>
                <button class="btn btn-primary" id="modalConfirm">Подтвердить</button>
            </div>
        </div>
    </div>

    <script>
        let currentData = { orders: [], products: [], reviews: [] };

        async function loadData() {
            try {
                const [ordersRes, reviewsRes] = await Promise.all([
                    fetch('/api/orders'),
                    fetch('/api/reviews')
                ]);
                currentData.orders = await ordersRes.json();
                currentData.reviews = await reviewsRes.json();
                currentData.products = ${JSON.stringify(Object.entries(products).map(([key, p]) => ({...p, key})))};
                
                updateStats();
                renderOrders();
                renderProducts();
                renderReviews();
            } catch (e) {
                console.error('Ошибка загрузки:', e);
            }
        }

        function updateStats() {
            const orders = currentData.orders;
            const reviews = currentData.reviews;
            const products = currentData.products;
            
            document.getElementById('totalOrders').textContent = orders.length;
            document.getElementById('processingOrders').textContent = orders.filter(o => o.status === 'Новый' || o.status === 'В обработке').length;
            document.getElementById('totalReviews').textContent = reviews.length;
            document.getElementById('totalProducts').textContent = products.length;
            
            if (reviews.length > 0) {
                const avg = reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length;
                document.getElementById('avgRating').textContent = avg.toFixed(1) + ' ⭐';
            } else {
                document.getElementById('avgRating').textContent = 'Нет';
            }
        }

        function renderOrders() {
            const container = document.getElementById('ordersList');
            const orders = currentData.orders;
            if (orders.length === 0) {
                container.innerHTML = '<p>📭 Нет заказов</p>';
                return;
            }
            
            let html = '<table><thead><tr><th>#</th><th>Пользователь</th><th>Товаров</th><th>Сумма</th><th>Статус</th><th>Дата</th><th>Действия</th></tr></thead><tbody>';
            orders.slice().reverse().forEach(order => {
                const statusClass = {
                    'Новый': 'status-new',
                    'В обработке': 'status-processing',
                    'Отправлен': 'status-shipped',
                    'Доставлен': 'status-delivered'
                }[order.status] || 'status-new';
                
                html += '<tr>';
                html += <td>#${order.id}</td>;
                html += <td>${order.userName || 'Пользователь'}</td>;
                html += <td>${order.items ? order.items.length : 0}</td>;
                html += <td>${order.total || 0} BYN</td>;
                html += <td><span class="status-badge ${statusClass}">${order.status || 'Новый'}</span></td>;
                html += <td>${new Date(order.date).toLocaleDateString()}</td>;
                html += <td>
                    <button class="btn btn-sm btn-primary" onclick="updateOrderStatus(${order.id})">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteOrder(${order.id})">🗑️</button>
                </td>;
                html += '</tr>';
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }

        function renderProducts() {
            const container = document.getElementById('productsList');
            const products = currentData.products;
            if (products.length === 0) {
                container.innerHTML = '<p>📭 Нет товаров</p>';
                return;
            }
            
            let html = '';
            products.forEach(product => {
                html += '<div class="product-card">';
                html += <h4>${product.name}</h4>;
                html += <div class="price">${product.price}</div>;
                html += <div class="status">${product.status}</div>;
                html += <div style="margin-top:10px;">
                    <button class="btn btn-sm btn-primary" onclick="editProduct('${product.key}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.key}')">🗑️</button>
                </div>;
                html += '</div>';
            });
            container.innerHTML = html;
        }

        function renderReviews() {
            const container = document.getElementById('reviewsList');
            const reviews = currentData.reviews;
            if (reviews.length === 0) {
                container.innerHTML = '<p>📭 Нет отзывов</p>';
                return;
            }
            
            let html = '<table><thead><tr><th>#</th><th>Рейтинг</th><th>Текст</th><th>Автор</th><th>Дата</th><th>Действия</th></tr></thead><tbody>';
            reviews.slice().reverse().forEach(review => {
                const stars = '⭐'.repeat(review.rating  0) + '☆'.repeat(5 - (review.rating  0));
                html += '<tr>';
                html += <td>#${review.id}</td>;
                html += <td>${stars}</td>;
                html += <td>${review.text.substring(0, 50)}${review.text.length > 50 ? '...' : ''}</td>;
                html += <td>${review.author || 'Аноним'}</td>;
                html += <td>${new Date(review.date).toLocaleDateString()}</td>;
                html += <td><button class="btn btn-sm btn-danger" onclick="deleteReview(${review.id})">🗑️</button></td>;
                html += '</tr>';
            });
            html += '</tbody></table>';
            container.innerHTML = html;
        }

        function showTab(tab) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.querySelector(.tab[onclick="showTab('${tab}')"]).classList.add('active');
            document.getElementById(tab-${tab}).classList.add('active');
        }

        async function updateOrderStatus(id) {
            const orders = currentData.orders;
            const order = orders.find(o => o.id === id);
            if (!order) return;
            
            const statuses = ['Новый', 'В обработке', 'Отправлен', 'Доставлен'];
            const currentIndex = statuses.indexOf(order.status);
            const nextIndex = (currentIndex + 1) % statuses.length;
            
            const newStatus = statuses[nextIndex];
            const confirm = await showConfirm(Изменить статус заказа #${id} на "${newStatus}"?);
            if (!confirm) return;
            
            try {
                const res = await fetch('/api/order/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, status: newStatus })
                });
                if (res.ok) {
                    order.status = newStatus;
                    renderOrders();
                    updateStats();
                }
            } catch (e) {
                alert('Ошибка обновления статуса');
            }
        }

        async function deleteOrder(id) {
            const confirm = await showConfirm(Удалить заказ #${id}?);
            if (!confirm) return;
            
            try {
                const res = await fetch('/api/order/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                if (res.ok) {
                    currentData.orders = currentData.orders.filter(o => o.id !== id);
                    renderOrders();
                    updateStats();
                }
            } catch (e) {
                alert('Ошибка удаления');
            }
        }

        async function deleteReview(id) {
            const confirm = await showConfirm(Удалить отзыв #${id}?);
            if (!confirm) return;
            
            try {
                const res = await fetch('/api/review/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                if (res.ok) {
                    currentData.reviews = currentData.reviews.filter(r => r.id !== id);
                    renderReviews();
                    updateStats();
                }
            } catch (e) {
                alert('Ошибка удаления');
            }
        }

        function searchProducts() {
            const query = document.getElementById('productSearch').value.toLowerCase();
            const products = currentData.products;
            const filtered = products.filter(p => 
                p.name.toLowerCase().includes(query) || 
                p.key.toLowerCase().includes(query) ||
                (p.category && p.category.toLowerCase().includes(query))
            );
            
            const container = document.getElementById('productsList');
            if (filtered.length === 0) {
                container.innerHTML = '<p>📭 Ничего не найдено</p>';
                return;
            }
            
            let html = '';
            filtered.forEach(product => {
                html += '<div class="product-card">';
                html += <h4>${product.name}</h4>;
                html += <div class="price">${product.price}</div>;
                html += <div class="status">${product.status}</div>;
                html += <div style="margin-top:10px;">
                    <button class="btn btn-sm btn-primary" onclick="editProduct('${product.key}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.key}')">🗑️</button>
                </div>;
                html += '</div>';
            });
            container.innerHTML = html;
        }

        function showConfirm(message) {
            return new Promise((resolve) => {
                document.getElementById('modalTitle').textContent = 'Подтверждение';
                document.getElementById('modalBody').innerHTML = <p>${message}</p>;
                document.getElementById('modalConfirm').onclick = () => { closeModal(); resolve(true); };
                document.getElementById('modal').style.display = 'flex';
                document.querySelector('#modal .btn:first-child').onclick = () => { closeModal(); resolve(false); };
            });
        }

        function closeModal() {
            document.getElementById('modal').style.display = 'none';
        }

        // Загрузка
        loadData();
        // Автообновление каждые 30 секунд
        setInterval(loadData, 30000);
    </script>
</body>
</html>
`;

fs.writeFileSync(path.join(publicDir, 'index.html'), adminHTML);

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

app.post('/api/order/status', (req, res) => {
  const { id, status } = req.body;
  const orders = getOrders();
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.status = status;
  saveOrders(orders);
  res.json({ success: true });
});

app.post('/api/order/delete', (req, res) => {
  const { id } = req.body;
  let orders = getOrders();
  orders = orders.filter(o => o.id !== id);
  saveOrders(orders);
  res.json({ success: true });
});

app.post('/api/review/delete', (req, res) => {
  const { id } = req.body;
  let reviews = getReviews();
  reviews = reviews.filter(r => r.id !== id);
  saveReviews(reviews);
  res.json({ success: true });
});

app.get('/api/search', (req, res) => {
  const query = req.query.q || '';
  const results = searchEngine.search(query);
  res.json(results);
});

// ==================== INLINE MODE ====================
bot.on('inline_query', async (ctx) => {
  const query = ctx.inlineQuery.query || '';
  const results = searchEngine.search(query);
  
  const inlineResults = results.slice(0, 20).map(({key, product}) => {
    const statuses = getStatuses();
    const status = statuses[key] || product.status;
    const icon = status.includes('✅') ? '✅' : '🚚';
    
    return {
      type: 'article',
      id: key,
      title: ${icon} ${product.name},
      description: ${product.price} • ${status},
      input_message_content: {
        message_text: 📦 ${product.name}\n💰 ${product.price}\n${status}\n\n🏷️ Категория: ${product.category || 'Другое'}\n\n🛒 Для заказа напишите @RadioPartsBY_bot
      },
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛒 Добавить в корзину', callback_data: add_to_cart_${key} }]
        ]
      }
    };
  });
  
  if (inlineResults.length === 0) {
    return ctx.answerInlineQuery([{
      type: 'article',
      id: 'no_results',
      title: '❌ Ничего не найдено',
      description: По запросу "${query}" ничего не найдено,
      input_message_content: {
        message_text: ❌ По запросу "${query}" ничего не найдено.\n\nПопробуйте другие ключевые слова или откройте @RadioPartsBY_bot
      }
    }]);
  }
  
  ctx.answerInlineQuery(inlineResults, {
    cache_time: 60,
    switch_pm_text: '📦 Открыть магазин',
    switch_pm_parameter: 'start'
  });
});

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getStars(rating) {
  return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
}

function sendLongMessage(ctx, text) {
  const MAX_LENGTH = 4000;
  if (text.length <= MAX_LENGTH) {
    ctx.reply(text);
  } else {
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + MAX_LENGTH, text.length);
      if (end < text.length) {
        const lastNewline = text.lastIndexOf('\n', end);
        if (lastNewline > start) {
          end = lastNewline + 1;
        }
      }
      ctx.reply(text.slice(start, end));
      start = end;
    }
  }
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

function formatCart(cartItems) {
  if (!cartItems || cartItems.length === 0) return '🛒 Корзина пуста';
  
  let text = '🛒 ВАША КОРЗИНА:\n\n';
  let total = 0;
  cartItems.forEach((item, index) => {
    const product = products[item.key];
    if (product) {const price = parseFloat(product.price);
      const subtotal = price * (item.quantity || 1);
      text += ${index+1}. ${product.name}\n;
      text +=    💰 ${product.price} × ${item.quantity || 1} = ${subtotal.toFixed(2)} BYN\n\n;
      total += subtotal;
    }
  });
  text += 💵 ИТОГО: ${total.toFixed(2)} BYN;
  return text;
}

// ==================== КОМАНДЫ БОТА ====================

// /start
bot.start((ctx) => {
  const keyboard = Markup.keyboard([
    ['🛒 Каталог', '📦 Корзина', '📦 Статус'],
    ['🔍 Поиск', '📞 Помощь', '⭐ Оставить отзыв']
  ]).resize();
  ctx.reply(
    '👋 Добро пожаловать в RadioPartsBY!\n\n' +
    '🔍 Ищете детали? Просто напишите название!\n' +
    '✅ В наличии: ESP32 DevKit, Arduino Nano, OLED 0.96"\n' +
    '🚚 Остальное — под заказ (14–30 дней)\n\n' +
    '💡 Используйте Inline Mode: @' + ctx.botInfo.username + ' esp32\n' +
    '🌐 Админ-панель: ' + (process.env.PUBLIC_URL || 'http://localhost:3000'),
    keyboard
  );
});

// Поиск
bot.hears('🔍 Поиск', (ctx) => {
  ctx.reply(
    '🔍 Введите запрос для поиска:\n\n' +
    'Примеры:\n' +
    '• esp32\n' +
    '• дисплей oled\n' +
    '• транзистор bc547\n' +
    '• реле 5v\n' +
    '• блок питания 12v\n\n' +
    '💡 Или используйте @' + ctx.botInfo.username + ' в любом чате!'
  );
  ctx.session.searchQuery = true;
});

// Каталог
bot.hears('🛒 Каталог', (ctx) => {
  const categories = searchEngine.getAllCategories();
  
  let text = '📦 КАТАЛОГ ПО КАТЕГОРИЯМ:\n\n';
  categories.forEach(cat => {
    const items = searchEngine.searchByCategory(cat);
    text += 🔹 ${cat} (${items.length})\n;
    const sample = items.slice(0, 3).map(r => r.product.name).join(', ');
    text +=    ${sample}...\n\n;
  });
  text += '🔍 Напишите название для поиска';

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔍 Показать категории', 'show_categories')]
  ]);
  sendLongMessage(ctx, text);
});

bot.action('show_categories', (ctx) => {
  const categories = searchEngine.getAllCategories();
  const keyboard = [];
  categories.forEach(cat => {
    keyboard.push([Markup.button.callback(🔹 ${cat}, cat_${cat})]);
  });
  keyboard.push([Markup.button.callback('📋 Все категории', 'all_categories')]);
  ctx.reply('📂 Выберите категорию:', Markup.inlineKeyboard(keyboard));
});

bot.action(/cat_(.+)/, (ctx) => {
  const category = ctx.match[1];
  const results = searchEngine.searchByCategory(category);
  
  if (results.length === 0) {
    return ctx.reply('❌ Нет товаров в этой категории');
  }

  let text = 📦 ${category}:\n\n;
  results.slice(0, 10).forEach(({key, product}) => {
    const statuses = getStatuses();
    const status = statuses[key] || product.status;
    const icon = status.includes('✅') ? '✅' : '🚚';
    text += ${icon} ${product.name}\n;
    text +=    💰 ${product.price}\n;
  });
  
  if (results.length > 10) {
    text += \n... и еще ${results.length - 10} товаров;
  }
  
  text += '\n🔍 Напишите точное название для подробностей';
  ctx.reply(text);
});

// ==================== ОБРАБОТКА ТЕКСТА ====================
bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;

  if (text.startsWith('/')) return;
  if (['🛒 Каталог', '📦 Корзина', '📦 Статус', '🔍 Поиск', '📞 Помощь', '⭐ Оставить отзыв'].includes(text)) return;

  // Обработка отзыва
  if (ctx.session?.rating && !text.startsWith('/')) {
    const rating = ctx.session.rating;
    const review = addReview({
      text: text,
      rating: rating,
      author: ctx.from.username  ctx.from.first_name  'Аноним'
    });
    ctx.session.rating = null;
    ctx.reply(
      '✅ Спасибо за отзыв!\n\n' +
      '⭐ Оценка: ' + getStars(rating) + '\n' +
      '📝 Текст: ' + text + '\n\n' +
      'Ваш отзыв #' + review.id + ' сохранён.'
    );
    return;
  }

       // Поиск
  const results = searchEngine.search(text);
  
  if (results.length === 0) {
    return ctx.reply(
      '🤷 Ничего не найдено по запросу "' + text + '"\n\n' +
      '💡 Попробуйте:\n' +
      '• Использовать другие ключевые слова\n' +
      '• Написать по-английски (ESP, Arduino)\n' +
      '• Посмотреть каталог "🛒 Каталог"\n\n' +
      '📌 Примеры: ESP32, дисплей, реле, блок питания'
    );
  }

  ctx.session.lastSearch = results;
  
  if (results.length === 1) {
    const { key, product } = results[0];
    const statuses = getStatuses();
    const status = statuses[key] || product.status;
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🛒 В корзину', add_to_cart_${key})],
      [Markup.button.callback('📦 Похожие', similar_${key})]
    ]);
    
    ctx.replyWithPhoto(product.photo, {
      caption: '📦 ' + product.name + '\n' +
               '💰 Цена: ' + product.price + '\n' +
               status + '\n' +
               (product.description ? '\n📝 ' + product.description : '') + '\n\n' +
               '🏷️ Категория: ' + (product.category || 'Другое'),
      ...keyboard
    });
    return;
  }

  let response = '🔍 Найдено ' + results.length + ' товаров:\n\n';
  const keyboard = [];
  
  results.slice(0, 10).forEach(({key, product}, index) => {
    const statuses = getStatuses();
    const status = statuses[key] || product.status;
    const icon = status.includes('✅') ? '✅' : '🚚';
    response += ${icon} ${product.name} — ${product.price}\n;
    keyboard.push([Markup.button.callback(${index+1}. ${product.name}, select_product_${key})]);
  });
  
  if (results.length > 10) {
    response += \n... и еще ${results.length - 10} товаров;
  }
  
  response += '\n\n⚡ Нажмите на товар для подробностей';
  ctx.reply(response, Markup.inlineKeyboard(keyboard));
});

// Выбор товара из результатов
bot.action(/select_product_(.+)/, (ctx) => {
  const key = ctx.match[1];
  const product = products[key];
  if (!product) return ctx.answerCbQuery('❌ Товар не найден');
  
  const statuses = getStatuses();
  const status = statuses[key] || product.status;
  
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🛒 В корзину', add_to_cart_${key})],
    [Markup.button.callback('📦 Похожие', similar_${key})]
  ]);
  
  ctx.replyWithPhoto(product.photo, {
    caption: '📦 ' + product.name + '\n' +
             '💰 Цена: ' + product.price + '\n' +
             status + '\n' +
             (product.description ? '\n📝 ' + product.description : '') + '\n\n' +
             '🏷️ Категория: ' + (product.category || 'Другое'),
    ...keyboard
  });
  ctx.answerCbQuery();
});

// Добавление в корзину
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
  
  ctx.answerCbQuery(✅ ${product.name} добавлен в корзину!);
  ctx.reply(
    '✅ Добавлено в корзину!\n\n' +
    '📦 ' + product.name + '\n' +
    '💰 ' + product.price + '\n' +
    '📦 Всего в корзине: ' + cart.items.length + ' позиций\n\n' +
    'Продолжайте покупки или перейдите в 📦 Корзина'
  );
});

// Похожие товары
bot.action(/similar_(.+)/, (ctx) => {
  const key = ctx.match[1];
  const product = products[key];
  if (!product) return ctx.answerCbQuery('❌ Товар не найден');
  
  const category = product.category || 'Другое';
  const results = searchEngine.search(category);
  const similar = results.filter(r => r.key !== key).slice(0, 5);

       if (similar.length === 0) {
    return ctx.reply('📭 Нет похожих товаров');
  }
  
  let text = '📦 Похожие товары:\n\n';
  similar.forEach(({key, product}) => {
    text += • ${product.name} — ${product.price}\n;
  });
  text += '\nНапишите название для подробностей';
  ctx.reply(text);
});

// Корзина
bot.hears('📦 Корзина', (ctx) => {
  const cart = getUserCart(ctx.from.id);
  
  if (cart.items.length === 0) {
    return ctx.reply(
      '🛒 Ваша корзина пуста\n\n' +
      '🔍 Найдите товары через поиск или каталог'
    );
  }
  
  const text = formatCart(cart.items);
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Оформить заказ', 'checkout')],
    [Markup.button.callback('🗑️ Очистить корзину', 'clear_cart')],
    [Markup.button.callback('✏️ Изменить количество', 'edit_cart')]
  ]);
  
  ctx.reply(text, keyboard);
});

// Изменение количества
bot.action('edit_cart', (ctx) => {
  const cart = getUserCart(ctx.from.id);
  if (cart.items.length === 0) return ctx.reply('🛒 Корзина пуста');
  
  const keyboard = [];
  cart.items.forEach((item, index) => {
    const product = products[item.key];
    if (product) {
      keyboard.push([
        Markup.button.callback(➖, decrease_${index}),
        Markup.button.callback(${item.quantity || 1} ${product.name}, item_${index}),
        Markup.button.callback(➕, increase_${index})
      ]);
    }
  });
  keyboard.push([Markup.button.callback('🔙 Назад в корзину', 'back_to_cart')]);
  
  ctx.reply('✏️ Выберите товар для изменения количества:', Markup.inlineKeyboard(keyboard));
});

bot.action(/increase_(\d+)/, (ctx) => {
  const index = parseInt(ctx.match[1]);
  const cart = getUserCart(ctx.from.id);
  if (index < cart.items.length) {
    cart.items[index].quantity = (cart.items[index].quantity || 1) + 1;
    saveUserCart(ctx.from.id, cart.items);
    ctx.answerCbQuery('✅ Количество увеличено');
    ctx.reply('✅ Количество обновлено! Перейдите в 📦 Корзина');
  }
});

bot.action(/decrease_(\d+)/, (ctx) => {
  const index = parseInt(ctx.match[1]);
  const cart = getUserCart(ctx.from.id);
  if (index < cart.items.length) {
    const newQty = (cart.items[index].quantity || 1) - 1;
    if (newQty <= 0) {
      cart.items.splice(index, 1);
      ctx.answerCbQuery('🗑️ Товар удален');
    } else {
      cart.items[index].quantity = newQty;
      ctx.answerCbQuery('✅ Количество уменьшено');
    }
    saveUserCart(ctx.from.id, cart.items);
    ctx.reply('✅ Корзина обновлена! Перейдите в 📦 Корзина');
  }
});

bot.action('back_to_cart', (ctx) => {
  ctx.reply('📦 Перейдите в 📦 Корзина');
});

bot.action('clear_cart', (ctx) => {
  saveUserCart(ctx.from.id, []);
  ctx.answerCbQuery('🗑️ Корзина очищена');
  ctx.reply('🗑️ Корзина очищена');
});

// Оформление заказа
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
    '📝 ОФОРМЛЕНИЕ ЗАКАЗА\n\n' +
    'Шаг 1/3: Введите адрес доставки:\n' +
    '(город, улица, дом, квартира)',
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', 'cancel_order')]
    ])
  );
});

bot.action('cancel_order', (ctx) => {
  ctx.session.currentOrder = null;
  ctx.reply('❌ Оформление заказа отменено');
});

// Статус
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
    text += 💵 ${order.total || 0} BYN\n;
    text += 📦 ${order.items ? order.items.length : 0} товаров\n\n;
  });
  
  ctx.reply(text);
});

// Помощь
bot.hears('📞 Помощь', (ctx) => {
  ctx.reply(
    '📞 ПОМОЩЬ И КОНТАКТЫ:\n\n' +
    '🔍 Как найти товар:\n' +
    '• Напишите название в чат\n' +
    '• Используйте "🔍 Поиск"\n' +
    '• Просмотрите "🛒 Каталог"\n' +
    '• Используйте @' + ctx.botInfo.username + ' в любом чате\n\n' +
    '📦 Как заказать:\n' +
    '• Добавьте товары в корзину\n' +
    '• Нажмите "Оформить заказ"\n' +
    '• Укажите адрес и телефон\n\n' +
    '📞 Контакты:\n' +
    '• Telegram: @RadioPartsBY_bot\n' +
    '• Время работы: Пн-Пт 9:00–18:00'
  );
});

// Отзывы
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

// Обработка ввода адреса для заказа
bot.on('text', async (ctx) => {
  const order = ctx.session.currentOrder;
  if (!order) return;
  if (['🛒 Каталог', '📦 Корзина', '📦 Статус', '🔍 Поиск', '📞 Помощь', '⭐ Оставить отзыв'].includes(ctx.message.text)) return;
  
  const text = ctx.message.text.trim();
  
  if (order.step === 'address') {
    order.address = text;
    order.step = 'phone';
    ctx.reply(
      '📝 Шаг 2/3: Введите номер телефона для связи:\n' +
      '(например, +375291234567)',
      Markup.inlineKeyboard([
        [Markup.button.callback('❌ Отмена', 'cancel_order')]
      ])
    );
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
    orderText += \n📍 Адрес: ${order.address};
    orderText += \n📱 Телефон: ${order.phone};
    
    ctx.reply(orderText, Markup.inlineKeyboard([
      [Markup.button.callback('✅ Подтвердить заказ', 'confirm_order')],
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
    userName: ctx.from.first_name + (ctx.from.username ? ' @' + ctx.from.username : ''),
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
  
  ctx.reply(
    '✅ ЗАКАЗ #' + newOrder.id + ' ОФОРМЛЕН!\n\n' +
    'Спасибо за покупку! В ближайшее время с вами свяжутся.\n' +
    'Статус заказа можно проверить в 📦 Статус'
  );
  
  bot.telegram.sendMessage(
    ADMIN_ID,
    '📦 НОВЫЙ ЗАКАЗ #' + newOrder.id + '\n\n' +
    '👤 ' + newOrder.userName + '\n' +
    '📍 ' + newOrder.address + '\n' +
    '📱 ' + newOrder.phone + '\n' +
    '💵 ' + newOrder.total.toFixed(2) + ' BYN\n' +
    '📦 ' + newOrder.items.length + ' товаров\n\n' +
    '🌐 Админ-панель: ' + (process.env.PUBLIC_URL || 'http://localhost:3000')
  );
});

// ==================== АДМИН-КОМАНДЫ ====================
bot.command('export', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const orders = getOrders();
  if (orders.length === 0) return ctx.reply('📭 Нет заказов для экспорта.');
  const filePath = path.join(DATA_DIR, 'export_orders.json');
  fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
  ctx.replyWithDocument(
    { source: filePath, filename: 'orders_' + new Date().toISOString().slice(0, 10) + '.json' },
    { caption: '📦 Экспорт заказов (' + orders.length + ' шт.)' }
  );
  fs.unlinkSync(filePath);
});

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
    '📊 ПОЛНАЯ СТАТИСТИКА:\n\n' +
    '📦 Заказов: ' + orders.length + '\n' +
    '⭐ Отзывов: ' + reviews.length + '\n' +
    '📈 Рейтинг: ' + avgRating + ' ' + getStars(Math.round(avgRating)) + '\n\n' +
    '📋 Статусы:\n' +
    '• Новые: ' + orders.filter(o => o.status === 'Новый').length + '\n' +
    '• В обработке: ' + orders.filter(o => o.status === 'В обработке').length + '\n' +
    '• Отправлено: ' + orders.filter(o => o.status === 'Отправлен').length + '\n' +
    '• Доставлено: ' + orders.filter(o => o.status === 'Доставлен').length + '\n\n' +
    '🌐 Админ-панель: ' + (process.env.PUBLIC_URL || 'http://localhost:3000')
  );
});

bot.command('admin', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  ctx.reply(
    '⚙️ АДМИН-ПАНЕЛЬ:\n\n' +
    '🌐 Веб-интерфейс: ' + (process.env.PUBLIC_URL || 'http://localhost:3000') + '\n\n' +
    '🤖 Команды:\n' +
    '/status — статистика\n' +
    '/export — экспорт заказов\n' +
    '/set_status "ключ" "статус" — изменить статус товара\n' +
    '/reset_status "ключ" — сбросить статус\n' +
    '/delete_order 123 — удалить заказ\n' +
    '/delete_review 123 — удалить отзыв'
  );
});

bot.command('set_status', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    return ctx.reply(
      '⚠️ Используйте:\n/set_status "ключ_товара" "новый_статус"\n\n' +
      'Пример:\n/set_status "esp32 devkit" "✅ В наличии"\n\n' +
      'Доступные ключи: ' + Object.keys(products).slice(0, 10).join(', ') + '...'
    );
  }
  const key = args.slice(1, -1).join(' ').toLowerCase();
  const newStatus = args.slice(-1).join(' ');
  if (!products[key]) {
    return ctx.reply('❌ Товар с ключом "' + key + '" не найден.');
  }
  const statuses = getStatuses();
  statuses[key] = newStatus;
  saveStatuses(statuses);
  ctx.reply('✅ Статус товара "' + products[key].name + '" изменён на:\n' + newStatus);
});

bot.command('reset_status', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('⚠️ Используйте: /reset_status "ключ_товара"');
  }
  const key = args.slice(1).join(' ').toLowerCase();
  if (!products[key]) {
    return ctx.reply('❌ Товар с ключом "' + key + '" не найден.');
  }
  const statuses = getStatuses();
  if (statuses[key]) {
    delete statuses[key];
    saveStatuses(statuses);
    ctx.reply('✅ Статус товара "' + products[key].name + '" сброшен.');
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
bot.launch()
  .then(() => console.log('✅ Бот запущен!'))
  .catch(err => console.error('❌ Ошибка запуска бота:', err.message));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
