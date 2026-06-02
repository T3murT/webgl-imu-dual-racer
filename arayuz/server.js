/**
 * server.js — Araba Yarışı IMU WebSocket Sunucusu
 *
 * Görev:
 *  1. index.html'yi statik serv eder (port 3000)
 *  2. WebSocket üzerinden IMU JSON verisini tarayıcıya iletir
 *  3. HTTP POST /imu endpoint'i ile dışarıdan veri kabul eder
 *
 * Kullanım:
 *  node server.js
 *
 * Sensör → HTTP POST http://localhost:3000/imu
 *  Body: {"sapma": 10, "yunuslama": 20, "yuvarlanma": -10}
 *
 * Demo modu (sensör yoksa):
 *  GET http://localhost:3000/demo  → Simüle veri akışını başlatır/durdurur
 */

"use strict";

var http       = require('http');
var fs         = require('fs');
var path       = require('path');
var WebSocket  = require('ws');
var url        = require('url');

// Seri port kütüphaneleri
var { SerialPort } = require('serialport');
var { ReadlineParser } = require('@serialport/parser-readline');

var PORT = 3000;

// ─── MIME TİPLERİ ──────────────────────────────────────────────
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.json': 'application/json',
  '.ico':  'image/x-icon'
};

// ─── HTTP SUNUCUSU ──────────────────────────────────────────────
var server = http.createServer(function(req, res) {
  var parsed  = url.parse(req.url, true);
  var pathname = parsed.pathname;

  // ── POST /imu → IMU verisi al ve broadcast et
  if (req.method === 'POST' && pathname === '/imu') {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end',  function() {
      try {
        var data = JSON.parse(body);
        broadcastIMU(data);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, data: data }));
        console.log('[IMU]', JSON.stringify(data));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Geçersiz JSON: ' + e.message }));
      }
    });
    return;
  }

  // ── OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ── GET /demo → Demo modunu aç/kapat
  if (pathname === '/demo') {
    toggleDemo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ demo: demoActive }));
    return;
  }

  // ── Statik dosya servisi
  var filePath = pathname === '/' ? '/index.html' : pathname;
  var fullPath = path.join(__dirname, filePath);

  fs.readFile(fullPath, function(err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Dosya bulunamadı: ' + filePath);
      return;
    }
    var ext  = path.extname(fullPath);
    var mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

// ─── WEBSOCKET SUNUCUSU ──────────────────────────────────────────
var wss = new WebSocket.Server({ server: server });

wss.on('connection', function(socket) {
  console.log('[WS] Yeni bağlantı');
  socket.on('message', function(msg) {
    // Tarayıcıdan gelen mesajları işle (isteğe bağlı)
    try {
      var d = JSON.parse(msg);
      if (d.sapma !== undefined) broadcastIMU(d);
    } catch(e) {}
  });
  socket.on('close', function() {
    console.log('[WS] Bağlantı kapandı');
  });
});

/**
 * Tüm bağlı WebSocket istemcilerine IMU verisi yayınlar.
 */
function broadcastIMU(data) {
  var msg = JSON.stringify(data);
  wss.clients.forEach(function(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ─── DEMO MODU ───────────────────────────────────────────────────
var demoActive   = false;
var demoInterval = null;
var demoT        = 0;

function toggleDemo() {
  if (demoActive) {
    clearInterval(demoInterval);
    demoActive = false;
    console.log('[Demo] Durduruldu');
  } else {
    demoActive = true;
    demoT = 0;
    demoInterval = setInterval(function() {
      demoT += 0.05;
      // Sinüs dalgaları ile gerçekçi simüle edilmiş IMU verisi
      var data = {
        sapma:      Math.sin(demoT * 0.7)  * 30,
        yunuslama:  Math.sin(demoT * 1.1)  * 25,
        yuvarlanma: Math.cos(demoT * 0.9)  * 20
      };
      broadcastIMU(data);
    }, 50); // 20 Hz
    console.log('[Demo] Başlatıldı (20 Hz)');
  }
}

// ─── SUNUCUYU BAŞLAT ─────────────────────────────────────────────
server.listen(PORT, function() {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   🏁 Araba Yarışı IMU Sunucusu           ║');
  console.log('╠═══════════════════════════════════════════╣');
  console.log('║  Tarayıcı:  http://localhost:' + PORT + '         ║');
  console.log('║  IMU POST:  POST /imu                     ║');
  console.log('║  Demo:      GET  /demo                    ║');
  console.log('║  COM Port:  Otomatik Algılanıyor...       ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log('IMU Veri Formatı:');
  console.log('  {"sapma": 10, "yunuslama": 20, "yuvarlanma": -10}');
  console.log('');

  initSerialPort();
});

// ─── SERİ PORT (COM PORT) BAĞLANTISI ─────────────────────────────
var serialPortPath = process.argv[2]; // Komut satırından da verilebilir: node server.js COM3
var SERIAL_BAUD    = 9600;            // Baud rate

async function initSerialPort() {
  try {
    if (!serialPortPath) {
      const ports = await SerialPort.list();
      // İçerisinde 'usb' geçen (Mac/Linux) veya vendorId'si olan ilk portu bul (Arduino/CH340/FTDI vs.)
      const port = ports.find(p => p.vendorId || (p.path && p.path.toLowerCase().includes('usb')));
      if (port) {
        serialPortPath = port.path;
        console.log('[Serial] Uygun COM port bulundu:', serialPortPath);
      } else {
        console.log('[Serial] Sistemde bağlı seri port bulunamadı! (COM / USB)');
        return;
      }
    } else {
      console.log('[Serial] Kullanıcı tanımlı port kullanılıyor:', serialPortPath);
    }

    const port = new SerialPort({ path: serialPortPath, baudRate: SERIAL_BAUD });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', function() {
      console.log('[Serial] Port AÇILDI. Veri bekleniyor...');
    });

    port.on('error', function(err) {
      console.warn('[Serial] Hata:', err.message);
    });

    var firstPacketReceived = false;
    var errorCount = 0;
    var packetCounter = 0;

    parser.on('data', function(data) {
      var str = data.trim();
      if (!str) return;
      try {
        var d = JSON.parse(str);
        if (d.sapma !== undefined || d.yunuslama !== undefined || d.yuvarlanma !== undefined ||
            d.yaw !== undefined || d.pitch !== undefined || d.roll !== undefined) {
          if (!firstPacketReceived) {
            console.log('[Serial] ✅ İlk geçerli IMU verisi alındı ve tarayıcıya aktarılıyor:', str);
            firstPacketReceived = true;
          }
          packetCounter++;
          if (packetCounter % 50 === 0) {
             console.log('[Serial] Paket akışı devam ediyor. Son veri:', str);
          }
          broadcastIMU(d);
        }
      } catch(e) {
        if (errorCount < 3) {
          console.warn('[Serial] ⚠️ JSON ayrıştırma hatası veya düz metin geldi. Gelen ham veri (ilk 3 hata gösterilir):', str);
          errorCount++;
        }
      }
    });

  } catch (err) {
    console.warn('[Serial] Port taraması sırasında hata:', err.message);
  }
}
