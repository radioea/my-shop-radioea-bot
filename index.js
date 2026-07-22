
const { Telegraf, Markup, session } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ==================== НАСТРОЙКИ ====================
const BOT_TOKEN = process.env.BOT_TOKEN || '8916472134:AAGEakb5G9SzUZ2vfqGVKh2RZMTNLw97tjA';
const ADMIN_ID = parseInt(process.env.ADMIN_ID) || 5179932939;
const PORT = process.env.PORT || 3000;

// ==================== РАБОТА С БАЗОЙ ====================
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');

// Создаём папку data, если её нет
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Инициализация файлов с правильным содержимым
function initDB() {
  if (!fs.existsSync(ORDERS_FILE)) {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(REVIEWS_FILE)) {
    fs.writeFileSync(REVIEWS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(STATUS_FILE)) {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({}));
  }
}
initDB();

function getOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8')); } catch { return []; }
}
function getReviews() {
  try { return JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8')); } catch { return []; }
}
function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}
function saveReviews(reviews) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviews, null, 2));
}
function loadStatuses() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); } catch { return {}; }
}
function saveStatuses(statuses) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(statuses, null, 2));
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

// ==================== ТОВАРЫ (полный ассортимент) ====================
const products = {
  'esp32 devkit': { name: 'ESP32 DevKit V1 (30 pin, Type-C)', price: '19 BYN', status: '✅ В наличии', photo: 'https://example.com/esp32.jpg' },
  'esp8266': { name: 'ESP8266 NodeMCU (Wi-Fi)', price: '15 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/esp8266.jpg' },
  'arduino nano': { name: 'Arduino Nano V3 (Type-C)', price: '14 BYN', status: '✅ В наличии', photo: 'https://example.com/nano.jpg' },
  'arduino uno': { name: 'Arduino Uno R3 (ATmega328)', price: '25 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/uno.jpg' },
  'arduino mega': { name: 'Arduino Mega 2560', price: '35 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/mega.jpg' },
  'stm32': { name: 'STM32F103C8T6 (Blue Pill)', price: '12 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/stm32.jpg' },
  'raspberry pi pico': { name: 'Raspberry Pi Pico (RP2040)', price: '15 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/pico.jpg' },
  'esp32-cam': { name: 'ESP32-CAM (с камерой OV2640)', price: '18 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/esp32cam.jpg' },
  'esp32-s3': { name: 'ESP32-S3 (Wi-Fi + BLE)', price: '18 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/esp32s3.jpg' },
  'oled 0.96': { name: 'OLED 0.96" I2C (SSD1306)', price: '9 BYN', status: '✅ В наличии', photo: 'https://example.com/oled96.jpg' },
  'oled 1.3': { name: 'OLED 1.3" I2C (SH1106)', price: '12 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/oled13.jpg' },
  'lcd 1602': { name: 'LCD 1602 (синий/жёлтый)', price: '9 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lcd1602.jpg' },
  'lcd 2004': { name: 'LCD 2004 (20x4)', price: '11 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lcd2004.jpg' },
  'tft 1.8': { name: 'TFT 1.8" ST7735 (128x160)', price: '12 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/tft18.jpg' },
  'tft 2.4': { name: 'TFT 2.4" ILI9341 (320x240)', price: '18 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/tft24.jpg' },
  '7 segment': { name: '7-сегментный индикатор (4 разряда)', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/7seg.jpg' },
  'max7219': { name: 'MAX7219 (матрица 8x8)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/max7219.jpg' },
  'hc-sr04': { name: 'HC-SR04 (ультразвуковой датчик)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/hcsr04.jpg' },
  'dht22': { name: 'DHT22 (температура/влажность)', price: '14 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/dht22.jpg' },
  'dht11': { name: 'DHT11 (температура/влажность)', price: '8 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/dht11.jpg' },
  'ds18b20': { name: 'DS18B20 (температура, 1-Wire)', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/ds18b20.jpg' },
  'bme280': { name: 'BME280 (темп./влажн./давление)', price: '15 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/bme280.jpg' },
  'mpu6050': { name: 'MPU6050 (гироскоп+акселерометр)', price: '12 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/mpu6050.jpg' },
  'hc-05': { name: 'HC-05 (Bluetooth модуль)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/hc05.jpg' },
  'rfid rc522': { name: 'RFID RC522 (считыватель)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/rfid.jpg' },
  'max30102': { name: 'MAX30102 (пульсоксиметр)', price: '12 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/max30102.jpg' },
  'mq-2': { name: 'MQ-2 (газовый датчик)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/mq2.jpg' },
  'ttp223': { name: 'TTP223 (сенсорная кнопка)', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/ttp223.jpg' },
  'ky-038': { name: 'KY-038 (датчик звука)', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/ky038.jpg' },
  'pir hc-sr501': { name: 'PIR HC-SR501 (датчик движения)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/pir.jpg' },
  'фоторезистор': { name: 'Фоторезистор с модулем', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/photoresistor.jpg' },
  'влажность почвы': { name: 'Датчик влажности почвы', price: '7 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/soilmoisture.jpg' },
  'bc547': { name: 'BC547 (NPN) — 10 шт.', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/bc547.jpg' },
  'bc557': { name: 'BC557 (PNP) — 10 шт.', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/bc557.jpg' },
  '2n2222': { name: '2N2222 (NPN) — 10 шт.', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/2n2222.jpg' },
  '2n3904': { name: '2N3904 (NPN) — 10 шт.', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/2n3904.jpg' },
  '2n3906': { name: '2N3906 (PNP) — 10 шт.', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/2n3906.jpg' },
  's8050': { name: 'S8050 (NPN) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/s8050.jpg' },
  's8550': { name: 'S8550 (PNP) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/s8550.jpg' },
  'bc337': { name: 'BC337 (NPN) — 10 шт.', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/bc337.jpg' },
  'bc327': { name: 'BC327 (PNP) — 10 шт.', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/bc327.jpg' },
  'a1015': { name: 'A1015 (PNP) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/a1015.jpg' },
  'c1815': { name: 'C1815 (NPN) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/c1815.jpg' },
  'irfz44n': { name: 'IRFZ44N (MOSFET)', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/irfz44n.jpg' },
  'irf540n': { name: 'IRF540N (MOSFET)', price: '8 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/irf540n.jpg' },
  'irf3205': { name: 'IRF3205 (MOSFET)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/irf3205.jpg' },
  'irlz44n': { name: 'IRLZ44N (MOSFET)', price: '7 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/irlz44n.jpg' },
  '1n4007': { name: '1N4007 (выпрямительный) — 10 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/1n4007.jpg' },
  '1n4148': { name: '1N4148 (импульсный) — 10 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/1n4148.jpg' },
  '1n5819': { name: '1N5819 (Шоттки) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/1n5819.jpg' },
  '1n5408': { name: '1N5408 (3A) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/1n5408.jpg' },
  'fr107': { name: 'FR107 (быстрый) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/fr107.jpg' },
  'bzx55 3.3': { name: 'BZX55C3V3 (3.3V) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/bzx55_3v3.jpg' },
  'bzx55 5.1': { name: 'BZX55C5V1 (5.1V) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/bzx55_5v1.jpg' },
  'bzx55 12': { name: 'BZX55C12 (12V) — 10 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/bzx55_12.jpg' },
  '1n4742a': { name: '1N4742A (12V 1W) — 10 шт.', price: '5 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/1n4742a.jpg' },
  'ne555': { name: 'NE555 (таймер) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/ne555.jpg' },
  'lm358': { name: 'LM358 (сдвоенный ОУ) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lm358.jpg' },
  'lm324': { name: 'LM324 (четверной ОУ) — 1 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lm324.jpg' },
  'lm393': { name: 'LM393 (компаратор) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lm393.jpg' },
  'lm741': { name: 'LM741 (классический ОУ) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lm741.jpg' },
  '74hc595': { name: '74HC595 (сдвиговый регистр) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/74hc595.jpg' },
  '74hc00': { name: '74HC00 (4 элемента 2И-НЕ) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/74hc00.jpg' },
  '74hc04': { name: '74HC04 (6 инверторов) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/74hc04.jpg' },
  'pc817': { name: 'PC817 (оптопара) — 1 шт.', price: '2 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/pc817.jpg' },
  'moc3021': { name: 'MOC3021 (оптосимистор) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/moc3021.jpg' },
  '7805': { name: '7805 (+5V, 1A) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/7805.jpg' },
  '7812': { name: '7812 (+12V, 1A) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/7812.jpg' },
  '7905': { name: '7905 (-5V, 1A) — 1 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/7905.jpg' },
  'lm317': { name: 'LM317 (регулируемый, 1.5A) — 1 шт.', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lm317.jpg' },
  'lm1117': { name: 'LM1117-3.3 (3.3V, SMD) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lm1117.jpg' },
  'ams1117': { name: 'AMS1117-3.3 (3.3V) — 1 шт.', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/ams1117.jpg' },
  'реле 1': { name: 'Реле 5V 1-канальное', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/relay1.jpg' },
  'реле 2': { name: 'Реле 5V 2-канальное', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/relay2.jpg' },
  'реле 4': { name: 'Реле 5V 4-канальное', price: '9 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/relay4.jpg' },
  'реле 8': { name: 'Реле 5V 8-канальное', price: '14 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/relay8.jpg' },
  'l298n': { name: 'Драйвер L298N (моторов)', price: '12 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/l298n.jpg' },
  'l293d': { name: 'Драйвер L293D (моторов)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/l293d.jpg' },
  'pca9685': { name: 'PCA9685 (16-канальный ШИМ-драйвер)', price: '12 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/pca9685.jpg' },
  'a4988': { name: 'A4988 (драйвер шагового двигателя)', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/a4988.jpg' },
  'резисторы 150': { name: 'Резисторы 0805 1% (набор 150 шт., 15 номиналов × 10 шт.)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/resistors_150.jpg' },
  'резисторы 300': { name: 'Резисторы 0805 1% (набор 300 шт., 15 номиналов × 20 шт.)', price: '15 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/resistors_300.jpg' },
  'резисторы выводные': { name: 'Резисторы выводные (набор 600 шт., 30 номиналов)', price: '18 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/resistors_through.jpg' },
  'конденсаторы керамика': { name: 'Керамические конденсаторы (набор 20 значений)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/ceramic_caps.jpg' },
  'конденсаторы электролит': { name: 'Электролитические конденсаторы (набор 15 значений)', price: '14 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/electrolytic_caps.jpg' },
  'конденсаторы пленка': { name: 'Плёночные конденсаторы (набор)', price: '9 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/film_caps.jpg' },
  '5v 2a': { name: '5V 2A (USB-адаптер)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/5v2a.jpg' },
  '12v 2a': { name: '12V 2A (адаптер)', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/12v2a.jpg' },
  '12v 5a': { name: '12V 5A (импульсный)', price: '22 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/12v5a.jpg' },
  '12v 10a': { name: '12V 10A (импульсный)', price: '32 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/12v10a.jpg' },
  '24v 5a': { name: '24V 5A (импульсный)', price: '28 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/24v5a.jpg' },
  'lm2596': { name: 'LM2596 (понижающий, 3A)', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/lm2596.jpg' },
  'xl4015': { name: 'XL4015 (понижающий, 5A)', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/xl4015.jpg' },
  'mt3608': { name: 'MT3608 (повышающий, 2A)', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/mt3608.jpg' },
  'sg90': { name: 'SG90 (микро-серво, 9g)', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/sg90.jpg' },
  'mg90s': { name: 'MG90S (металл, 13g)', price: '8 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/mg90s.jpg' },
  'mg995': { name: 'MG995 (большой, 55g)', price: '14 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/mg995.jpg' },
  'ds3218': { name: 'DS3218 (25kg, металл)', price: '18 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/ds3218.jpg' },
  'моторчик 3v': { name: 'Моторчик 3V (для игрушек)', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/motor3v.jpg' },
  'моторчик 6v': { name: 'Моторчик 6V (с редуктором)', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/motor6v.jpg' },
  'моторчик 12v': { name: 'Моторчик 12V (5000 RPM)', price: '8 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/motor12v.jpg' },
  'n20': { name: 'N20 (12V, 100 RPM) с редуктором', price: '10 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/n20.jpg' },
  '28byj-48': { name: '28BYJ-48 (шаговый, 5V)', price: '6 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/28byj48.jpg' },
  'nema17': { name: 'NEMA17 (шаговый, 12V)', price: '14 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/nema17.jpg' },
  'dupont мм': { name: 'Провода Dupont (40 шт, мама-мама)', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/dupont_f_f.jpg' },
  'dupont пп': { name: 'Провода Dupont (40 шт, папа-папа)', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/dupont_m_m.jpg' },
  'dupont пм': { name: 'Провода Dupont (40 шт, папа-мама)', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/dupont_m_f.jpg' },
  'клеммники': { name: 'Клеммники 2P, 3P, 4P (набор 10 шт.)', price: '4 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/terminals.jpg' },
  'разъёмы': { name: 'Разъёмы USB, DC, аудио (набор 10 шт.)', price: '8 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/connectors.jpg' },
  'макетная плата': { name: 'Макетная плата (Breadboard)', price: '12 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/breadboard.jpg' },
  'пин гребёнки': { name: 'Пин-гребёнки (40 pin)', price: '3 BYN', status: '🚚 Под заказ (14–30 дней)', photo: 'https://example.com/pin_headers.jpg' }
};

// ==================== БОТ И СЕРВЕР ====================
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

const app = express();
app.get('/', (req, res) => res.send('✅ RadioPartsBY Bot is running!'));
app.listen(PORT, () => {
  console.log('✅ HTTP server running on port ' + PORT);
});

function getStars(rating) {
  return '⭐'.repeat(rating) + '☆'.repeat(5 - rating);
}

// -------------------- СТАРТ --------------------
bot.start((ctx) => {
  const keyboard = Markup.keyboard([
    ['🛒 Каталог', '📦 Корзина', '📦 Статус'],
    ['📞 Помощь', '⭐ Оставить отзыв']
  ]).resize();
  ctx.reply(
    👋 Добро пожаловать в RadioPartsBY!

✅ В наличии:
• ESP32 DevKit — 19 BYN
• Arduino Nano — 14 BYN
• OLED 0.96" — 9 BYN

🚚 Остальные товары — под заказ (14–30 дней).

Напишите название товара или нажмите "🛒 Каталог".,
    keyboard
  );
});

// -------------------- КАТАЛОГ (динамический) --------------------
bot.hears('🛒 Каталог', (ctx) => {
  const statuses = loadStatuses();
  const categories = {
    '🔹 МИКРОКОНТРОЛЛЕРЫ': ['esp32 devkit','esp8266','arduino nano','arduino uno','arduino mega','stm32','raspberry pi pico','esp32-cam','esp32-s3'],
    '🔹 ДИСПЛЕИ': ['oled 0.96','oled 1.3','lcd 1602','lcd 2004','tft 1.8','tft 2.4','7 segment','max7219'],
    '🔹 ДАТЧИКИ': ['hc-sr04','dht22','dht11','ds18b20','bme280','mpu6050','hc-05','rfid rc522','max30102','mq-2','ttp223','ky-038','pir hc-sr501','фоторезистор','влажность почвы'],
    '🔹 ТРАНЗИСТОРЫ (за 10 шт.)': ['bc547','bc557','2n2222','2n3904','2n3906','s8050','s8550','bc337','bc327','a1015','c1815'],
    '🔹 MOSFET': ['irfz44n','irf540n','irf3205','irlz44n'],
    '🔹 ДИОДЫ (за 10 шт.)': ['1n4007','1n4148','1n5819','1n5408','fr107'],
    '🔹 СТАБИЛИТРОНЫ (за 10 шт.)': ['bzx55 3.3','bzx55 5.1','bzx55 12','1n4742a'],
    '🔹 МИКРОСХЕМЫ (за 1 шт.)': ['ne555','lm358','lm324','lm393','lm741','74hc595','74hc00','74hc04','pc817','moc3021'],
    '🔹 СТАБИЛИЗАТОРЫ (за 1 шт.)': ['7805','7812','7905','lm317','lm1117','ams1117'],
    '🔹 РЕЛЕ И ДРАЙВЕРЫ': ['реле 1','реле 2','реле 4','реле 8','l298n','l293d','pca9685','a4988'],
    '🔹 ПАССИВНЫЕ КОМПОНЕНТЫ': ['резисторы 150','резисторы 300','резисторы выводные','конденсаторы керамика','конденсаторы электролит','конденсаторы пленка'],
    '🔹 БЛОКИ ПИТАНИЯ': ['5v 2a','12v 2a','12v 5a','12v 10a','24v 5a','lm2596','xl4015','mt3608'],
    '🔹 МОТОРЫ И СЕРВО': ['sg90','mg90s','mg995','ds3218','моторчик 3v','моторчик 6v','моторчик 12v','n20','28byj-48','nema17'],
    '🔹 РАЗЪЁМЫ И ПРОВОДА': ['dupont мм','dupont пп','dupont пм','клеммники','разъёмы','макетная плата','пин гребёнки']
  };

  let reply = '📦 ПОЛНЫЙ КАТАЛОГ RadioPartsBY:\n\n';
  for (const [category, keys] of Object.entries(categories)) {
    reply += ${category}:\n;
    for (const key of keys) {
      const product = products[key];
      if (product) {
        const finalStatus = statuses[key] || product.status;
        let icon = '❓';
        if (finalStatus.includes('В наличии')) icon = '✅';
        else if (finalStatus.includes('Под заказ')) icon = '🚚';
        else if (finalStatus.includes('Закончился') || finalStatus.includes('Нет')) icon = '❌';
        else icon = '📌';
        reply +=   ${product.name} — ${product.price} ${icon}\n;
      }
    }
    reply += '\n';
  }
  reply += 'Напишите название товара для фото и подробностей.';
  ctx.reply(reply);
});

// -------------------- ДРУГИЕ КНОПКИ --------------------
bot.hears('📦 Корзина', (ctx) => ctx.reply('🛒 Ваша корзина пока пуста. Добавьте товары через поиск.'));
bot.hears('📞 Помощь', (ctx) => ctx.reply(
  📞 Контакты:\n• Telegram: @RadioPartsBY_bot\n• Заказ: t.me/RadioPartsBY_bot\n• Время работы: Пн-Пт 9:00–18:00
));

// -------------------- ОТЗЫВЫ --------------------
bot.hears('⭐ Оставить отзыв', (ctx) => {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⭐ 1', 'rating_1'), Markup.button.callback('⭐⭐ 2', 'rating_2'), Markup.button.callback('⭐⭐⭐ 3', 'rating_3')],
    [Markup.button.callback('⭐⭐⭐⭐ 4', 'rating_4'), Markup.button.callback('⭐⭐⭐⭐⭐ 5', 'rating_5')]
  ]);
  ctx.reply('⭐ Оцените наш магазин от 1 до 5 звёзд:', keyboard);
});

bot.action(/rating_([1-5])/, (ctx) => {
  const rating = parseInt(ctx.match[1]);
  ctx.answerCbQuery(Вы выбрали ${rating} звёзд);
  ctx.session.rating = rating;
  ctx.reply(Вы выбрали ${getStars(rating)}\n\nТеперь напишите текст отзыва:);
});

bot.on('text', (ctx) => {
  const text = ctx.message.text.trim();
  if (ctx.session.rating && !text.startsWith('/') && !text.startsWith('отзыв:')) {
    const rating = ctx.session.rating;
    const review = addReview({
      text: text,
      rating: rating,
      author: ctx.from.username  ctx.from.first_name  'Аноним'
    });
    ctx.session.rating = null;
    ctx.reply(
      ✅ Спасибо за отзыв!\n\n⭐ Оценка: ${getStars(rating)}\n📝 Текст: ${text}\n\nВаш отзыв #${review.id} сохранён.
    );
  }
});

// -------------------- СТАТУС --------------------
bot.hears('📦 Статус', (ctx) => {
  const orders = getOrders();
  const reviews = getReviews();
  const userId = ctx.from.id;
  let avgRating = 0;
  if (reviews.length > 0) {
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    avgRating = (sum / reviews.length).toFixed(1);
  }
  const buttons = [
    Markup.button.callback(📋 Заказы (${orders.length}), 'view_orders'),
    Markup.button.callback(⭐ Отзывы (${reviews.length}), 'view_reviews')
  ];
  if (userId === ADMIN_ID) {
    buttons.push(Markup.button.callback('⚙️ Админ-панель', 'admin_panel'));
  }
  ctx.reply(
    📊 Статистика:\n\n📦 Всего заказов: ${orders.length}\n⭐ Всего отзывов: ${reviews.length}\n📈 Средний рейтинг: ${avgRating} ${getStars(Math.round(avgRating))},
    Markup.inlineKeyboard([buttons])
  );
});

bot.action('view_orders', (ctx) => {
  const orders = getOrders();
  if (orders.length === 0) return ctx.reply('📭 Заказов пока нет.');
  let text = '📋 Список заказов:\n\n';
  orders.slice(-5).forEach((order) => {
    text += #${order.id} — ${order.items || 'Товары'} — ${order.status}\n;
  });
  text += \nВсего: ${orders.length} заказов;
  ctx.reply(text);
});

bot.action('view_reviews', (ctx) => {
  const reviews = getReviews();
  if (reviews.length === 0) return ctx.reply('📭 Отзывов пока нет.');
  let text = '⭐ Все отзывы:\n\n';
  reviews.slice(-10).reverse().forEach((review) => {
    text += #${review.id} — ${getStars(review.rating || 0)} — ${review.text}\n👤 ${review.author}\n\n;
  });
  text += \nВсего: ${reviews.length} отзывов;
  ctx.reply(text);
});

bot.action('admin_panel', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('⛔ Доступ запрещён!');
  ctx.answerCbQuery();
  ctx.reply(
    ⚙️ Админ-панель:\n/export — выгрузить заказы в файл\n/status — статистика по заказам\n/delete_order — удалить заказ по номеру\n/delete_review — удалить отзыв по номеру\n/set_status — установить статус товара\n/reset_status — сбросить статус товара
  );
});

// -------------------- АДМИН-КОМАНДЫ --------------------
bot.command('export', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const orders = getOrders();
  if (orders.length === 0) return ctx.reply('📭 Нет заказов для экспорта.');
  const filePath = path.join(DATA_DIR, 'export_orders.json');
  fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
  ctx.replyWithDocument(
    { source: filePath, filename: orders_${new Date().toISOString().slice(0, 10)}.json },
    { caption: 📦 Экспорт заказов (${orders.length} шт.) }
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
    📊 Полная статистика:\n\n📦 Всего заказов: ${orders.length}\n⭐ Всего отзывов: ${reviews.length}\n📈 Средний рейтинг: ${avgRating} ${getStars(Math.round(avgRating))}\n\nВ обработке: ${orders.filter(o => o.status === 'В обработке').length}\nОтправлено: ${orders.filter(o => o.status === 'Отправлен').length}\nДоставлено: ${orders.filter(o => o.status === 'Доставлен').length}
  );
});

bot.command('delete_order', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('⚠️ Укажите номер заказа: /delete_order 123');
  const orderId = parseInt(args[1]);
  if (isNaN(orderId)) return ctx.reply('⚠️ Номер должен быть числом.');
  let orders = getOrders();
  const index = orders.findIndex(o => o.id === orderId);
  if (index === -1) return ctx.reply(❌ Заказ #${orderId} не найден.);
  orders.splice(index, 1);
  saveOrders(orders);
  ctx.reply(✅ Заказ #${orderId} удалён.);
});

bot.command('delete_review', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 2) return ctx.reply('⚠️ Укажите номер отзыва: /delete_review 123');
  const reviewId = parseInt(args[1]);
  if (isNaN(reviewId)) return ctx.reply('⚠️ Номер должен быть числом.');
  let reviews = getReviews();
  const index = reviews.findIndex(r => r.id === reviewId);
  if (index === -1) return ctx.reply(❌ Отзыв #${reviewId} не найден.);
  reviews.splice(index, 1);
  saveReviews(reviews);
  ctx.reply(✅ Отзыв #${reviewId} удалён.);
});

bot.command('set_status', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    return ctx.reply(
      ⚠️ Используйте:\n/set_status "ключ_товара" "новый_статус"\n\nПример:\n/set_status "резисторы 150" "🚚 Под заказ (14–30 дней)"
    );
  }
  const key = args.slice(1, -1).join(' ').toLowerCase();
  const newStatus = args.slice(-1).join(' ');
  if (!products[key]) {
    return ctx.reply(❌ Товар с ключом "${key}" не найден. Список ключей:\n${Object.keys(products).join(', ')});
  }
  const statuses = loadStatuses();
  statuses[key] = newStatus;
  saveStatuses(statuses);
  ctx.reply(✅ Статус товара "${products[key].name}" изменён на:\n${newStatus});
});

bot.command('reset_status', (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('⛔ У вас нет прав.');
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
    return ctx.reply('⚠️ Используйте: /reset_status "ключ_товара"');
  }
  const key = args.slice(1).join(' ').toLowerCase();
  if (!products[key]) {
    return ctx.reply(❌ Товар с ключом "${key}" не найден.);
  }
  const statuses = loadStatuses();
  if (statuses[key]) {
    delete statuses[key];
    saveStatuses(statuses);
    ctx.reply(✅ Статус товара "${products[key].name}" сброшен до значения из кода.);
  } else {
    ctx.reply(ℹ️ У товара "${products[key].name}" не было переопределённого статуса.);
  }
});

// -------------------- ПОИСК ТОВАРОВ --------------------
bot.on('text', (ctx) => {
  const query = ctx.message.text.toLowerCase().trim();
  if (query.startsWith('/')) return;
  if (['каталог', 'корзина', 'помощь', 'статус', 'оставить отзыв'].includes(query)) return;

  const statuses = loadStatuses();
  let found = false;
  for (const [key, product] of Object.entries(products)) {
    if (query.includes(key)) {
      const finalStatus = statuses[key] || product.status;
      ctx.replyWithPhoto(product.photo, {
        caption: 📦 ${product.name}\n💰 Цена: ${product.price}\n${finalStatus}\n\nДля заказа напишите "Корзина" или свяжитесь с @RadioPartsBY_bot
      });
      found = true;
      break;
    }
  }
  if (!found) {
    ctx.reply(
      🤷 Не нашел такой товар.\n\nПопробуйте написать:\n• ESP32 DevKit — 19 BYN ✅\n• Arduino Nano — 14 BYN ✅\n• OLED 0.96" — 9 BYN ✅\n• Резисторы 150 — 10 BYN 🚚\n• NE555 — 3 BYN 🚚\n• 7805 — 3 BYN 🚚\n• Реле 1 — 4 BYN 🚚\n\nИли нажмите "🛒 Каталог" для полного списка.
    );
  }
});

// -------------------- ЗАПУСК --------------------
bot.launch()
  .then(() => console.log('✅ Бот запущен!'))
  .catch(err => console.error('❌ Ошибка запуска бота:', err.message));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
