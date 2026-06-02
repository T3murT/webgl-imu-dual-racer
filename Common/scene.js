"use strict";

var gl;
var canvas;

var progMain, progSky, progStar, progSun;

var TRACK_RADIUS = 60.0;

var imuCar = {
  x: 0, z: TRACK_RADIUS - 4.5,
  yaw: -90,
  speed: 0,
  roll: 0,
  imu: { sapma: 0, yunuslama: 0, yuvarlanma: 0 }
};

var wasdCar = {
  x: 0, z: TRACK_RADIUS + 4.5,   // Dış şerit
  yaw: -90,
  speed: 0,
  roll: 0
};

// Güneş/Ay
var sunAngle = 90;
var nightBlend = 0.0;
var SUN_RADIUS = 45.0;

// Klavye
var keys = {};

// Kamera
var camera = { eye: [0, 6, -20], at: [0, 1, 0], up: [0, 1, 0] };

// Geometri tamponları
var skyBuf = {}, groundBuf = {}, roadBuf = {}, starBuf = {}, sunBuf = {}, startLineBuf = {};
var imuCarBufs = [], wasdCarBufs = [];

// Texture'lar
var texRoad, texGround, texCarIMU, texCarWASD, texStartLine;

// Zaman
var lastTime = 0, startTime = 0;
var raceRunning = false;

// WebSocket
var ws, wsConnected = false;

// Fizik sabitleri
var ACCEL = 15.0;
var BRAKE = 22.0;
var REV_ACCEL = 9.0;
var MAX_FWD = 30.0;
var MAX_REV = 14.0;
var TURN_SPD = 85.0;

window.addEventListener('load', function () {
  canvas = document.getElementById('gl-canvas');
  gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) { alert('WebGL desteklenmiyor!'); return; }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  progMain = initShadersFromSource(gl, VERT_MAIN, FRAG_MAIN);
  progSky = initShadersFromSource(gl, VERT_SKY, FRAG_SKY);
  progStar = initShadersFromSource(gl, VERT_STAR, FRAG_STAR);
  progSun = initShadersFromSource(gl, VERT_SUN, FRAG_SUN);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  buildSkyGeometry();
  buildGroundGeometry();
  buildTrackGeometry();
  buildStartLineGeometry();
  buildStarGeometry();
  buildSunGeometry();
  buildCarGeometry(imuCarBufs, true);
  buildCarGeometry(wasdCarBufs, false);

  texRoad = createTextureFromCanvas(makeRoadTexture());
  texGround = createTextureFromCanvas(makeGroundTexture());
  texStartLine = createTextureFromCanvas(makeStartLineTexture());
  texCarIMU = createTextureFromCanvas(makeCarTexture('#1a6fff', 'rgba(200,230,255,0.8)'));
  texCarWASD = createTextureFromCanvas(makeCarTexture('#cc2222', 'rgba(255,200,200,0.8)'));

  setupInputListeners();
  connectWS();

  document.getElementById('start-btn').addEventListener('click', function () {
    document.getElementById('start-overlay').classList.add('hidden');
    raceRunning = true;
    startTime = performance.now();
    lastTime = startTime;
    requestAnimationFrame(render);
  });

  requestAnimationFrame(render);
});

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function createBuffer(data) {
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  return buf;
}

function buildSkyGeometry() {
  var v = [
    -1, -1, 0.999, 0, 0,
    1, -1, 0.999, 1, 0,
    1, 1, 0.999, 1, 1,
    -1, -1, 0.999, 0, 0,
    1, 1, 0.999, 1, 1,
    -1, 1, 0.999, 0, 1
  ];
  skyBuf.vbo = createBuffer(v); skyBuf.count = 6; skyBuf.stride = 5 * 4;
}

function buildGroundGeometry() {
  var S = 200, T = 20;
  var v = [
    -S, 0, -S, 0, 1, 0, 0, 0,
    S, 0, -S, 0, 1, 0, T, 0,
    S, 0, S, 0, 1, 0, T, T,
    -S, 0, -S, 0, 1, 0, 0, 0,
    S, 0, S, 0, 1, 0, T, T,
    -S, 0, S, 0, 1, 0, 0, T
  ];
  groundBuf.vbo = createBuffer(v); groundBuf.count = 6; groundBuf.stride = 8 * 4;
}

function buildTrackGeometry() {
  var SEGS = 120;         // Pist segmenti sayısı
  var ROAD_W = 18;          // Asfalt genişliği
  var CURB_W = 3;           // Kaldırım genişliği
  var Ri = TRACK_RADIUS - ROAD_W / 2;   // İç yarıçap
  var Ro = TRACK_RADIUS + ROAD_W / 2;   // Dış yarıçap
  var Rci = Ri - CURB_W;                 // İç kaldırım iç kenarı
  var Rco = Ro + CURB_W;                 // Dış kaldırım dış kenarı
  var Y_ROAD = 0.01;
  var Y_CURB = 0.005;

  var vRoad = [], vCurb = [];

  for (var i = 0; i < SEGS; i++) {
    var a0 = (i / SEGS) * Math.PI * 2;
    var a1 = ((i + 1) / SEGS) * Math.PI * 2;
    var u0 = i / SEGS;
    var u1 = (i + 1) / SEGS;

    var xi0 = Math.cos(a0) * Ri, zi0 = Math.sin(a0) * Ri;
    var xo0 = Math.cos(a0) * Ro, zo0 = Math.sin(a0) * Ro;
    var xi1 = Math.cos(a1) * Ri, zi1 = Math.sin(a1) * Ri;
    var xo1 = Math.cos(a1) * Ro, zo1 = Math.sin(a1) * Ro;

    // Asfalt quad (2 üçgen)
    vRoad.push(
      xi0, Y_ROAD, zi0, 0, 1, 0, u0, 0,
      xo0, Y_ROAD, zo0, 0, 1, 0, u0, 1,
      xo1, Y_ROAD, zo1, 0, 1, 0, u1, 1,
      xi0, Y_ROAD, zi0, 0, 1, 0, u0, 0,
      xo1, Y_ROAD, zo1, 0, 1, 0, u1, 1,
      xi1, Y_ROAD, zi1, 0, 1, 0, u1, 0
    );

    // İç kaldırım
    var xci0 = Math.cos(a0) * Rci, zci0 = Math.sin(a0) * Rci;
    var xci1 = Math.cos(a1) * Rci, zci1 = Math.sin(a1) * Rci;
    vCurb.push(
      xci0, Y_CURB, zci0, 0, 1, 0, u0, 0,
      xi0, Y_CURB, zi0, 0, 1, 0, u0, 1,
      xi1, Y_CURB, zi1, 0, 1, 0, u1, 1,
      xci0, Y_CURB, zci0, 0, 1, 0, u0, 0,
      xi1, Y_CURB, zi1, 0, 1, 0, u1, 1,
      xci1, Y_CURB, zci1, 0, 1, 0, u1, 0
    );

    // Dış kaldırım
    var xco0 = Math.cos(a0) * Rco, zco0 = Math.sin(a0) * Rco;
    var xco1 = Math.cos(a1) * Rco, zco1 = Math.sin(a1) * Rco;
    vCurb.push(
      xo0, Y_CURB, zo0, 0, 1, 0, u0, 0,
      xco0, Y_CURB, zco0, 0, 1, 0, u0, 1,
      xco1, Y_CURB, zco1, 0, 1, 0, u1, 1,
      xo0, Y_CURB, zo0, 0, 1, 0, u0, 0,
      xco1, Y_CURB, zco1, 0, 1, 0, u1, 1,
      xo1, Y_CURB, zo1, 0, 1, 0, u1, 0
    );
  }

  var allV = vRoad.concat(vCurb);
  roadBuf.vbo = createBuffer(allV);
  roadBuf.roadCount = SEGS * 6;        // sadece asfalt
  roadBuf.curbCount = SEGS * 6 * 2;   // iki kaldırım
  roadBuf.count = SEGS * 6;
  roadBuf.stride = 8 * 4;
}

function buildStarGeometry() {
  var N = 600, pos = [], bri = [], siz = [];
  for (var i = 0; i < N; i++) {
    var theta = Math.random() * Math.PI;
    var phi = Math.random() * Math.PI * 2;
    var r = 180;
    pos.push(r * Math.sin(theta) * Math.cos(phi), r * Math.abs(Math.cos(theta)) + 5, r * Math.sin(theta) * Math.sin(phi));
    bri.push(0.4 + Math.random() * 0.6);
    siz.push(1.0 + Math.random() * 2.5);
  }
  starBuf.posBuf = createBuffer(pos);
  starBuf.briBuf = createBuffer(bri);
  starBuf.sizBuf = createBuffer(siz);
  starBuf.count = N;
}

function buildSphereVerts(r, lonSegs, latSegs) {
  var v = [];
  for (var lat = 0; lat < latSegs; lat++) {
    var t0 = (lat / latSegs) * Math.PI;
    var t1 = ((lat + 1) / latSegs) * Math.PI;
    for (var lon = 0; lon < lonSegs; lon++) {
      var p0 = (lon / lonSegs) * Math.PI * 2;
      var p1 = ((lon + 1) / lonSegs) * Math.PI * 2;
      function pushV(t, p) {
        var nx = Math.sin(t) * Math.cos(p);
        var ny = Math.cos(t);
        var nz = Math.sin(t) * Math.sin(p);
        v.push(r * nx, r * ny, r * nz, nx, ny, nz, p / (2 * Math.PI), 1.0 - t / Math.PI);
      }
      pushV(t0, p0); pushV(t0, p1); pushV(t1, p1);
      pushV(t0, p0); pushV(t1, p1); pushV(t1, p0);
    }
  }
  return v;
}

function buildSunGeometry() {
  var verts = buildSphereVerts(1.0, 32, 24);
  sunBuf.vbo = createBuffer(verts);
  sunBuf.count = verts.length / 8;   // 8 float / vertex
  sunBuf.stride = 8 * 4;
}

function buildStartLineGeometry() {
  var Ri = TRACK_RADIUS - 9;   // Pist iç kenar
  var Ro = TRACK_RADIUS + 9;   // Pist dış kenar
  var hw = 1.0;                // Yarı genişlik (X ekseni = tangential yön)
  var y = 0.028;              // Z-fighting önlemek için hafif üst

  var v = [
    -hw, y, Ri, 0, 1, 0, 0, 0,
    hw, y, Ri, 0, 1, 0, 0, 1,
    hw, y, Ro, 0, 1, 0, 1, 1,
    -hw, y, Ri, 0, 1, 0, 0, 0,
    hw, y, Ro, 0, 1, 0, 1, 1,
    -hw, y, Ro, 0, 1, 0, 1, 0
  ];
  startLineBuf.vbo = createBuffer(v);
  startLineBuf.count = 6;
  startLineBuf.stride = 8 * 4;
}

function buildCarGeometry(bufs, isIMU) {
  var b = isIMU ? [0.1, 0.4, 1.0, 1.0] : [0.8, 0.1, 0.1, 1.0];
  var c = isIMU ? [0.05, 0.25, 0.7, 1.0] : [0.5, 0.05, 0.05, 1.0];

  bufs.push(buildBox(3.6, 0.6, 1.8, [0, 0.5, 0], b, true));
  bufs.push(buildBox(2.2, 0.55, 1.6, [0, 1.05, 0], c, true));
  bufs.push(buildBox(0.12, 0.4, 1.8, [-1.7, 0.7, 0], [0.15, 0.15, 0.15, 1], false));

  var wp = [[1.2, 0.42, 0.95], [1.2, 0.42, -0.95], [-1.2, 0.42, 0.95], [-1.2, 0.42, -0.95]];
  for (var i = 0; i < 4; i++) {
    bufs.push(buildCylinder(0.42, 0.35, 16, wp[i], [0.1, 0.1, 0.12, 1]));
    bufs.push(buildCylinder(0.25, 0.36, 8, wp[i], [0.7, 0.7, 0.75, 1]));
  }

  bufs.push(buildBox(0.12, 0.18, 0.32, [1.82, 0.55, 0.6], [1, 1, 0.6, 1], false));
  bufs.push(buildBox(0.12, 0.18, 0.32, [1.82, 0.55, -0.6], [1, 1, 0.6, 1], false));
  bufs.push(buildBox(0.10, 0.14, 0.30, [-1.82, 0.55, 0.6], [1, 0.1, 0.1, 1], false));
  bufs.push(buildBox(0.10, 0.14, 0.30, [-1.82, 0.55, -0.6], [1, 0.1, 0.1, 1], false));
}

function buildBox(w, h, d, offset, color, useTexture) {
  var hw = w / 2, hh = h / 2, hd = d / 2;
  var ox = offset[0], oy = offset[1], oz = offset[2];
  var f = [];
  function addFace(verts, nx, ny, nz) {
    var uvs = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
    var tri = [0, 1, 2, 0, 2, 3];
    for (var i = 0; i < 6; i++) {
      var vi = tri[i];
      f.push(verts[vi][0] + ox, verts[vi][1] + oy, verts[vi][2] + oz, nx, ny, nz, uvs[i][0], uvs[i][1]);
    }
  }
  addFace([[-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd]], 1, 0, 0);
  addFace([[hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd]], -1, 0, 0);
  addFace([[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]], 0, 1, 0);
  addFace([[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]], 0, -1, 0);
  addFace([[hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd]], 0, 0, 1);
  addFace([[-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd]], 0, 0, -1);
  return { vbo: createBuffer(f), count: f.length / 8, stride: 8 * 4, baseColor: color, useTexture: useTexture, isTire: false };
}

function buildCylinder(r, hw, segs, offset, color) {
  var ox = offset[0], oy = offset[1], oz = offset[2];
  var f = [];
  for (var i = 0; i < segs; i++) {
    // Silindir ekseni Z yönünde: X-Y düzleminde çember, Z'de derinlik
    var a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2;
    var x0 = Math.cos(a0), y0 = Math.sin(a0), x1 = Math.cos(a1), y1 = Math.sin(a1);
    // Yan yüzey (Z ekseni boyunca tüp)
    f.push(x0 * r + ox, y0 * r + oy, -hw + oz, x0, y0, 0, a0 / (2 * Math.PI), 0);
    f.push(x1 * r + ox, y1 * r + oy, -hw + oz, x1, y1, 0, a1 / (2 * Math.PI), 0);
    f.push(x1 * r + ox, y1 * r + oy, hw + oz, x1, y1, 0, a1 / (2 * Math.PI), 1);
    f.push(x0 * r + ox, y0 * r + oy, -hw + oz, x0, y0, 0, a0 / (2 * Math.PI), 0);
    f.push(x1 * r + ox, y1 * r + oy, hw + oz, x1, y1, 0, a1 / (2 * Math.PI), 1);
    f.push(x0 * r + ox, y0 * r + oy, hw + oz, x0, y0, 0, a0 / (2 * Math.PI), 1);
    // Ön kapak (-Z)
    f.push(ox, oy, -hw + oz, 0, 0, -1, 0.5, 0.5);
    f.push(x0 * r + ox, y0 * r + oy, -hw + oz, 0, 0, -1, 0.5 + 0.5 * x0, 0.5 + 0.5 * y0);
    f.push(x1 * r + ox, y1 * r + oy, -hw + oz, 0, 0, -1, 0.5 + 0.5 * x1, 0.5 + 0.5 * y1);
    // Arka kapak (+Z)
    f.push(ox, oy, hw + oz, 0, 0, 1, 0.5, 0.5);
    f.push(x1 * r + ox, y1 * r + oy, hw + oz, 0, 0, 1, 0.5 + 0.5 * x1, 0.5 + 0.5 * y1);
    f.push(x0 * r + ox, y0 * r + oy, hw + oz, 0, 0, 1, 0.5 + 0.5 * x0, 0.5 + 0.5 * y0);
  }
  return { vbo: createBuffer(f), count: f.length / 8, stride: 8 * 4, baseColor: color, useTexture: false, isTire: true };
}

function createTextureFromCanvas(cv) {
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function setupInputListeners() {
  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    var km = { 'KeyW': 'key-w', 'KeyA': 'key-a', 'KeyS': 'key-s', 'KeyD': 'key-d' };
    if (km[e.code]) document.getElementById(km[e.code]).classList.add('pressed');
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) e.preventDefault();
  });
  document.addEventListener('keyup', function (e) {
    keys[e.code] = false;
    var km = { 'KeyW': 'key-w', 'KeyA': 'key-a', 'KeyS': 'key-s', 'KeyD': 'key-d' };
    if (km[e.code]) document.getElementById(km[e.code]).classList.remove('pressed');
  });

  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    sunAngle = Math.max(0, Math.min(180, sunAngle + e.deltaY * 0.1));
    updateSunMeterUI();
  }, { passive: false });

  document.addEventListener('keydown', function (e) {
    if (e.code === 'KeyC') {
      imuBase = null; // Kalibrasyonu sıfırla
      console.log('[IMU] Manuel yeniden kalibrasyon tetiklendi (C tuşu)');
    }
  });
}

var imuBase = null; // Başlangıç (0 noktası) offset değerleri

function applyIMUData(data) {
  // Gelen veride Türkçe veya İngilizce anahtarlar olabilir
  var rawSapma = parseFloat(data.sapma !== undefined ? data.sapma : (data.yaw || 0));
  var rawYunuslama = parseFloat(data.yunuslama !== undefined ? data.yunuslama : (data.pitch || 0));
  var rawYuvarlanma = parseFloat(data.yuvarlanma !== undefined ? data.yuvarlanma : (data.roll || 0));

  // İlk veri geldiğinde (veya C tuşuyla sıfırlandığında) mevcut değeri 0 noktası kabul et
  if (!imuBase) {
    imuBase = {
      sapma: rawSapma,
      yunuslama: rawYunuslama,
      yuvarlanma: rawYuvarlanma
    };
    console.log('[IMU] Kalibrasyon tamamlandı (0 Noktası):', imuBase);
  }

  // Değerleri kalibre ederek (başlangıç noktasını çıkararak) aktar
  imuCar.imu.sapma = rawSapma - imuBase.sapma;
  imuCar.imu.yunuslama = rawYunuslama - imuBase.yunuslama;
  imuCar.imu.yuvarlanma = rawYuvarlanma - imuBase.yuvarlanma;

  updateIMUPanel();
}

function updateIMUPanel() {
  var s = imuCar.imu.sapma, p = imuCar.imu.yunuslama, r = imuCar.imu.yuvarlanma;
  document.getElementById('val-sapma').textContent = s.toFixed(1);
  document.getElementById('val-yunuslama').textContent = p.toFixed(1);
  document.getElementById('val-yuvarlanma').textContent = r.toFixed(1);
  var toBar = function (v) { return Math.min(100, Math.max(0, 50 + v / 180 * 100)) + '%'; };
  document.getElementById('bar-sapma').style.width = toBar(s);
  document.getElementById('bar-yunuslama').style.width = toBar(p);
  document.getElementById('bar-yuvarlanma').style.width = toBar(r);
}

function updateSunMeterUI() {
  var pct = sunAngle / 180;
  var bar = document.getElementById('sun-meter-bar');
  bar.style.setProperty('--thumb-pos', (pct * 100) + '%');
  document.getElementById('sun-angle-label').textContent = sunAngle.toFixed(0);
  var isNight = nightBlend > 0.5;
  var ind = document.getElementById('daynight-indicator');
  document.getElementById('daynight-text').textContent = isNight ? 'NIGHT' : 'DAY';
  ind.classList.toggle('night', isNight);
}

function connectWS() {
  try {
    ws = new WebSocket('ws://localhost:3000');

    ws.onopen = function () {
      wsConnected = true;
      document.getElementById('imu-status-dot').classList.add('active');
      document.getElementById('imu-status-text').textContent = 'connected';
      document.getElementById('imu-status-text').classList.add('connected');
      console.log('[WS] Bağlandı');
    };

    ws.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data);
        if (typeof data === 'object' &&
          (data.sapma !== undefined || data.yunuslama !== undefined || data.yuvarlanma !== undefined)) {
          applyIMUData(data);
        }
      } catch (err) {
        console.warn('[WS] Parse hatası:', err);
      }
    };

    ws.onclose = function () {
      wsConnected = false;
      document.getElementById('imu-status-dot').classList.remove('active');
      document.getElementById('imu-status-text').textContent = 'disconnected';
      document.getElementById('imu-status-text').classList.remove('connected');
      setTimeout(connectWS, 3000);
    };

    ws.onerror = function () {
      wsConnected = false;
      ws.close();
    };

  } catch (e) {
    setTimeout(connectWS, 3000);
  }
}

function update(dt) {
  if (!raceRunning) return;

  var wAccel = 0;
  if (keys['KeyW']) wAccel = ACCEL;
  if (keys['KeyS']) {
    if (wasdCar.speed > 0.5) wAccel = -BRAKE;
    else wAccel = -REV_ACCEL;
  }

  if (!keys['KeyW'] && !keys['KeyS']) {
    if (wasdCar.speed > 0) wasdCar.speed = Math.max(0, wasdCar.speed - BRAKE * 0.5 * dt);
    else if (wasdCar.speed < 0) wasdCar.speed = Math.min(0, wasdCar.speed + BRAKE * 0.5 * dt);
  } else {
    wasdCar.speed += wAccel * dt;
    wasdCar.speed = Math.max(-MAX_REV, Math.min(MAX_FWD, wasdCar.speed));
  }

  var wSpeedFac = Math.abs(wasdCar.speed) / MAX_FWD;
  var wTurnDir = 0;
  if (keys['KeyA']) wTurnDir = 1;   // Sol
  if (keys['KeyD']) wTurnDir = -1;   // Sağ
  if (wasdCar.speed < 0) wTurnDir = -wTurnDir;

  wasdCar.yaw += wTurnDir * TURN_SPD * wSpeedFac * dt;

  var wRad = radians(wasdCar.yaw);
  wasdCar.x += Math.sin(wRad) * wasdCar.speed * dt;
  wasdCar.z += Math.cos(wRad) * wasdCar.speed * dt;

  var wTargetRoll = -wTurnDir * wSpeedFac * 5.0;
  wasdCar.roll += (wTargetRoll - wasdCar.roll) * Math.min(1, dt * 6);

  var FWD_THR = 5;
  var TURN_THR = 8;

  var imuW = imuCar.imu.yuvarlanma < -FWD_THR; // roll ileri
  var imuS = imuCar.imu.yuvarlanma > FWD_THR; // roll geri
  var imuD = imuCar.imu.yunuslama < -TURN_THR; // pitch sağ (terslendi)
  var imuA = imuCar.imu.yunuslama > TURN_THR; // pitch sol (terslendi)

  var iAccel = 0;
  if (imuW) iAccel = ACCEL;
  if (imuS) {
    if (imuCar.speed > 0.5) iAccel = -BRAKE;
    else iAccel = -REV_ACCEL;
  }

  if (!imuW && !imuS) {
    if (imuCar.speed > 0) imuCar.speed = Math.max(0, imuCar.speed - BRAKE * 0.5 * dt);
    else if (imuCar.speed < 0) imuCar.speed = Math.min(0, imuCar.speed + BRAKE * 0.5 * dt);
  } else {
    imuCar.speed += iAccel * dt;
    imuCar.speed = Math.max(-MAX_REV, Math.min(MAX_FWD, imuCar.speed));
  }

  // A = sol (yaw artar, CCW), D = sağ (yaw azalır, CW)
  var iSpeedFac = Math.abs(imuCar.speed) / MAX_FWD;
  var iTurnDir = 0;
  if (imuA) iTurnDir = 1;   // Sol
  if (imuD) iTurnDir = -1;   // Sağ
  if (imuCar.speed < 0) iTurnDir = -iTurnDir;

  imuCar.yaw += iTurnDir * TURN_SPD * iSpeedFac * dt;

  var iRad = radians(imuCar.yaw);
  imuCar.x += Math.sin(iRad) * imuCar.speed * dt;
  imuCar.z += Math.cos(iRad) * imuCar.speed * dt;

  var iTargetRoll = imuCar.imu.yuvarlanma * 0.06;
  imuCar.roll += (iTargetRoll - imuCar.roll) * Math.min(1, dt * 5);

  // ─── Güneş Açısı → Gece Karışımı ──────────────────────────
  var horizonDist = Math.min(sunAngle, 180 - sunAngle);
  nightBlend = Math.max(0, Math.min(1, 1.0 - horizonDist / 40.0));
  nightBlend = Math.pow(nightBlend, 1.5);

  updateSunMeterUI();

  document.getElementById('pos-imu').textContent = (imuCar.speed * 3.6).toFixed(0) + ' km/h';
  document.getElementById('pos-wasd').textContent = (wasdCar.speed * 3.6).toFixed(0) + ' km/h';

  var elapsed = (performance.now() - startTime) / 1000;
  var mm = Math.floor(elapsed / 60), ss = elapsed % 60;
  document.getElementById('race-time').textContent =
    (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss.toFixed(3);
}

var fpsFrames = 0, fpsSec = 0;

function drawScene(viewM, projM, sunPos) {
  drawSky(nightBlend, sunAngle);
  if (nightBlend > 0.05) drawStars(viewM, projM, nightBlend);
  drawSunOrMoon(viewM, projM, sunPos, nightBlend);
  drawGround(viewM, projM, sunPos, nightBlend);
  drawTrack(viewM, projM, sunPos, nightBlend);
  drawStartLine(viewM, projM, sunPos, nightBlend);
  drawCar(imuCarBufs, viewM, projM, sunPos, nightBlend,
    imuCar.x, 0, imuCar.z, imuCar.yaw, imuCar.roll, texCarIMU);
  drawCar(wasdCarBufs, viewM, projM, sunPos, nightBlend,
    wasdCar.x, 0, wasdCar.z, wasdCar.yaw, wasdCar.roll, texCarWASD);
}

function render(now) {
  requestAnimationFrame(render);

  var dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  fpsFrames++; fpsSec += dt;
  if (fpsSec >= 0.5) {
    document.getElementById('fps-display').textContent = Math.round(fpsFrames / fpsSec);
    fpsFrames = 0; fpsSec = 0;
  }

  update(dt);

  // Güneş/Ay pozisyonu
  var sunRad = radians(sunAngle);
  var sunPos = [Math.cos(sunRad) * SUN_RADIUS, Math.sin(sunRad) * SUN_RADIUS, 0.0];

  var CAM_DIST = 14, CAM_H = 6;
  var halfW = Math.floor(canvas.width / 2);
  var fullH = canvas.height;
  var aspect = halfW / fullH;

  gl.enable(gl.SCISSOR_TEST);

  gl.viewport(0, 0, halfW, fullH);
  gl.scissor(0, 0, halfW, fullH);
  gl.clearColor(0.04, 0.04, 0.06, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var iRad = radians(imuCar.yaw);
  var imuEye = [imuCar.x - Math.sin(iRad) * CAM_DIST, CAM_H, imuCar.z - Math.cos(iRad) * CAM_DIST];
  var imuView = lookAt(imuEye, [imuCar.x, 1.0, imuCar.z], [0, 1, 0]);
  var imuProj = perspective(55, aspect, 0.5, 600);
  drawScene(imuView, imuProj, sunPos);

  gl.viewport(halfW, 0, halfW, fullH);
  gl.scissor(halfW, 0, halfW, fullH);
  gl.clearColor(0.04, 0.04, 0.06, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var wRad2 = radians(wasdCar.yaw);
  var wasdEye = [wasdCar.x - Math.sin(wRad2) * CAM_DIST, CAM_H, wasdCar.z - Math.cos(wRad2) * CAM_DIST];
  var wasdView = lookAt(wasdEye, [wasdCar.x, 1.0, wasdCar.z], [0, 1, 0]);
  var wasdProj = perspective(55, aspect, 0.5, 600);
  drawScene(wasdView, wasdProj, sunPos);

  gl.disable(gl.SCISSOR_TEST);
}

function drawSky(nBlend, sAngle) {
  gl.useProgram(progSky);
  gl.disable(gl.DEPTH_TEST);
  gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf.vbo);
  var aPos = gl.getAttribLocation(progSky, 'aPosition');
  var aTex = gl.getAttribLocation(progSky, 'aTexCoord');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aTex);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, skyBuf.stride, 0);
  gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, skyBuf.stride, 12);
  gl.uniform1f(gl.getUniformLocation(progSky, 'uNightBlend'), nBlend);
  gl.uniform1f(gl.getUniformLocation(progSky, 'uSunAngleDeg'), sAngle);
  gl.drawArrays(gl.TRIANGLES, 0, skyBuf.count);
  gl.enable(gl.DEPTH_TEST);
}

function drawStars(viewM, projM, nBlend) {
  gl.useProgram(progStar);
  var aPos = gl.getAttribLocation(progStar, 'aPosition');
  var aBri = gl.getAttribLocation(progStar, 'aBrightness');
  var aSiz = gl.getAttribLocation(progStar, 'aSize');
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.posBuf);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.briBuf);
  gl.enableVertexAttribArray(aBri);
  gl.vertexAttribPointer(aBri, 1, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, starBuf.sizBuf);
  gl.enableVertexAttribArray(aSiz);
  gl.vertexAttribPointer(aSiz, 1, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(gl.getUniformLocation(progStar, 'uViewMatrix'), false, flatten(viewM));
  gl.uniformMatrix4fv(gl.getUniformLocation(progStar, 'uProjectionMatrix'), false, flatten(projM));
  gl.uniform1f(gl.getUniformLocation(progStar, 'uNightBlend'), nBlend);
  gl.drawArrays(gl.POINTS, 0, starBuf.count);
}

function drawSunOrMoon(viewM, projM, sunPos, nBlend) {
  gl.useProgram(progSun);
  var size = nBlend > 0.5 ? 5.0 : 8.0;
  var modelM = mult(translate(sunPos[0], sunPos[1], sunPos[2]), scalem(size, size, size));
  gl.bindBuffer(gl.ARRAY_BUFFER, sunBuf.vbo);
  var aPos = gl.getAttribLocation(progSun, 'aPosition');
  var aNorm = gl.getAttribLocation(progSun, 'aNormal');
  var aTex = gl.getAttribLocation(progSun, 'aTexCoord');
  gl.enableVertexAttribArray(aPos);
  if (aNorm >= 0) { gl.enableVertexAttribArray(aNorm); }
  gl.enableVertexAttribArray(aTex);
  // Stride: pos(12) + normal(12) + uv(8) = 32 bytes
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, sunBuf.stride, 0);
  if (aNorm >= 0) { gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, sunBuf.stride, 12); }
  gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, sunBuf.stride, 24);
  gl.uniformMatrix4fv(gl.getUniformLocation(progSun, 'uModelMatrix'), false, flatten(modelM));
  gl.uniformMatrix4fv(gl.getUniformLocation(progSun, 'uViewMatrix'), false, flatten(viewM));
  gl.uniformMatrix4fv(gl.getUniformLocation(progSun, 'uProjectionMatrix'), false, flatten(projM));
  gl.uniform1f(gl.getUniformLocation(progSun, 'uIsMoon'), nBlend > 0.5 ? 1.0 : 0.0);
  gl.uniform1f(gl.getUniformLocation(progSun, 'uNightBlend'), nBlend);
  gl.drawArrays(gl.TRIANGLES, 0, sunBuf.count);
}

function drawGround(viewM, projM, sunPos, nBlend) {
  gl.useProgram(progMain);
  var modelM = mat4();
  gl.bindBuffer(gl.ARRAY_BUFFER, groundBuf.vbo);
  bindMainAttribs(groundBuf.stride);
  setMainUniforms(modelM, viewM, projM, sunPos, nBlend, [0.25, 0.45, 0.15, 1], true, texGround);
  gl.drawArrays(gl.TRIANGLES, 0, groundBuf.count);
}

function drawTrack(viewM, projM, sunPos, nBlend) {
  gl.useProgram(progMain);
  var modelM = mat4();
  gl.bindBuffer(gl.ARRAY_BUFFER, roadBuf.vbo);
  bindMainAttribs(roadBuf.stride);
  // Yol asfaltı (dairesel)
  setMainUniforms(modelM, viewM, projM, sunPos, nBlend, [0.22, 0.22, 0.24, 1], true, texRoad);
  gl.drawArrays(gl.TRIANGLES, 0, roadBuf.roadCount);
  // Kaldırım bantları — dönüşümlü kırmızı/beyaz
  setMainUniforms(modelM, viewM, projM, sunPos, nBlend, [0.72, 0.18, 0.12, 1], false, null);
  gl.drawArrays(gl.TRIANGLES, roadBuf.roadCount, roadBuf.curbCount);
}

function drawStartLine(viewM, projM, sunPos, nBlend) {
  gl.useProgram(progMain);
  var modelM = mat4();
  gl.bindBuffer(gl.ARRAY_BUFFER, startLineBuf.vbo);
  bindMainAttribs(startLineBuf.stride);
  setMainUniforms(modelM, viewM, projM, sunPos, nBlend, [1, 1, 1, 1], true, texStartLine);
  gl.drawArrays(gl.TRIANGLES, 0, startLineBuf.count);
}

function drawCar(bufs, viewM, projM, sunPos, nBlend, cx, cy, cz, yaw, roll, tex) {
  gl.useProgram(progMain);

  var carModel = mult(
    mult(translate(cx, cy, cz), rotate(yaw, [0, 1, 0])),
    mult(rotate(roll, [1, 0, 0]), rotate(-90, [0, 1, 0]))
  );
  for (var i = 0; i < bufs.length; i++) {
    var part = bufs[i];
    gl.bindBuffer(gl.ARRAY_BUFFER, part.vbo);
    bindMainAttribs(part.stride);
    var useTex = part.useTexture && tex && !part.isTire;
    setMainUniforms(carModel, viewM, projM, sunPos, nBlend, part.baseColor, useTex, useTex ? tex : null);
    gl.drawArrays(gl.TRIANGLES, 0, part.count);
  }
}

function bindMainAttribs(stride) {
  var aPos = gl.getAttribLocation(progMain, 'aPosition');
  var aNorm = gl.getAttribLocation(progMain, 'aNormal');
  var aTex = gl.getAttribLocation(progMain, 'aTexCoord');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aNorm);
  gl.enableVertexAttribArray(aTex);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, stride, 0);
  gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, stride, 12);
  gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, stride, 24);
}

function setMainUniforms(modelM, viewM, projM, lightPos, nBlend, baseColor, useTexture, tex) {
  var nm = transpose(modelM);
  gl.uniformMatrix4fv(gl.getUniformLocation(progMain, 'uModelMatrix'), false, flatten(modelM));
  gl.uniformMatrix4fv(gl.getUniformLocation(progMain, 'uViewMatrix'), false, flatten(viewM));
  gl.uniformMatrix4fv(gl.getUniformLocation(progMain, 'uProjectionMatrix'), false, flatten(projM));
  gl.uniformMatrix4fv(gl.getUniformLocation(progMain, 'uNormalMatrix'), false, flatten(nm));
  gl.uniform3fv(gl.getUniformLocation(progMain, 'uLightPos'), lightPos);
  gl.uniform4fv(gl.getUniformLocation(progMain, 'uAmbient'), [0.4, 0.4, 0.4, 1.0]);
  gl.uniform4fv(gl.getUniformLocation(progMain, 'uDiffuse'), [0.9, 0.9, 0.9, 1.0]);
  gl.uniform4fv(gl.getUniformLocation(progMain, 'uSpecular'), [0.6, 0.6, 0.6, 1.0]);
  gl.uniform1f(gl.getUniformLocation(progMain, 'uShininess'), 60.0);
  gl.uniform4fv(gl.getUniformLocation(progMain, 'uBaseColor'), baseColor);
  gl.uniform1f(gl.getUniformLocation(progMain, 'uNightBlend'), nBlend);
  if (useTexture && tex) {
    gl.uniform1i(gl.getUniformLocation(progMain, 'uUseTexture'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(progMain, 'uTexture'), 0);
  } else {
    gl.uniform1i(gl.getUniformLocation(progMain, 'uUseTexture'), 0);
  }
}
