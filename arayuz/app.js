
"use strict";


var VERT_MAIN = [
  "attribute vec4 aPosition;",
  "attribute vec4 aNormal;",
  "attribute vec2 aTexCoord;",
  "",
  "uniform mat4 uModelMatrix;",
  "uniform mat4 uViewMatrix;",
  "uniform mat4 uProjectionMatrix;",
  "uniform mat4 uNormalMatrix;",
  "",
  "varying vec3 vNormal;",
  "varying vec3 vPosition;",
  "varying vec2 vTexCoord;",
  "",
  "void main() {",
  "  vec4 worldPos = uModelMatrix * aPosition;",
  "  vPosition    = worldPos.xyz;",
  "  vNormal      = normalize((uNormalMatrix * aNormal).xyz);",
  "  vTexCoord    = aTexCoord;",
  "  gl_Position  = uProjectionMatrix * uViewMatrix * worldPos;",
  "}"
].join("\n");

var FRAG_MAIN = [
  "precision highp float;",
  "",
  "varying vec3 vNormal;",
  "varying vec3 vPosition;",
  "varying vec2 vTexCoord;",
  "",
  "uniform vec3  uLightPos;",       // Güneş/Ay pozisyonu
  "uniform vec4  uAmbient;",
  "uniform vec4  uDiffuse;",
  "uniform vec4  uSpecular;",
  "uniform float uShininess;",
  "uniform vec4  uBaseColor;",
  "uniform bool  uUseTexture;",
  "uniform sampler2D uTexture;",
  "uniform float uNightBlend;",     // 0=gündüz, 1=gece
  "",
  "void main() {",
  "  vec3 N = normalize(vNormal);",
  "  vec3 L = normalize(uLightPos - vPosition);",
  "  vec3 V = normalize(-vPosition);",
  "  vec3 H = normalize(L + V);",
  "",
  "  float diff = max(dot(N, L), 0.0);",
  "  float spec = pow(max(dot(N, H), 0.0), uShininess);",
  "",
  "  vec4 texColor = uUseTexture ? texture2D(uTexture, vTexCoord) : uBaseColor;",
  "",
  "  // Gece modunda ambient azalır, gündüz parlak",
  "  float ambFactor = mix(1.0, 0.15, uNightBlend);",
  "  float difFactor = mix(1.0, 0.05, uNightBlend);",
  "",
  "  vec4 ambient = uAmbient * texColor * ambFactor;",
  "  vec4 diffuse = uDiffuse * texColor * diff * difFactor;",
  "  vec4 specular = uSpecular * spec * (1.0 - uNightBlend * 0.8);",
  "",
  "  vec4 result = ambient + diffuse + specular;",
  "  result.a = texColor.a;",
  "  gl_FragColor = clamp(result, 0.0, 1.0);",
  "}"
].join("\n");

var VERT_SKY = [
  "attribute vec4 aPosition;",
  "attribute vec2 aTexCoord;",
  "",
  "varying vec2 vTexCoord;",
  "",
  "void main() {",
  "  vTexCoord   = aTexCoord;",
  "  gl_Position = aPosition;",
  "}"
].join("\n");

var FRAG_SKY = [
  "precision mediump float;",
  "",
  "varying vec2 vTexCoord;",
  "",
  "uniform float uNightBlend;",    // 0=gündüz, 1=gece
  "uniform float uSunAngleDeg;",  // 0-180 derece
  "",
  "void main() {",
  "  float y = vTexCoord.y;",     // 0=alt, 1=üst
  "",
  "  // Gündüz gökyüzü: açık mavi + horizon sarısı",
  "  vec3 dayTop    = vec3(0.25, 0.55, 0.95);",
  "  vec3 dayMid    = vec3(0.55, 0.78, 0.98);",
  "  vec3 dayHoriz  = vec3(0.85, 0.88, 0.70);",
  "",
  "  // Gece gökyüzü: derin lacivert",
  "  vec3 nightTop  = vec3(0.02, 0.03, 0.12);",
  "  vec3 nightMid  = vec3(0.04, 0.06, 0.18);",
  "  vec3 nightHoriz= vec3(0.08, 0.06, 0.10);",
  "",
  "  vec3 dayColor   = mix(dayHoriz,  mix(dayMid,  dayTop,  y), y);",
  "  vec3 nightColor = mix(nightHoriz, mix(nightMid, nightTop, y), y);",
  "",
  "  vec3 skyColor = mix(dayColor, nightColor, uNightBlend);",
  "",
  "  // Gün batımı efekti: 0.8 < nightBlend < 1.0 arası turuncu-kırmızı bant",
  "  float sunsetT = smoothstep(0.5, 0.9, uNightBlend) * (1.0 - smoothstep(0.9, 1.0, uNightBlend));",
  "  vec3 sunsetColor = mix(vec3(0.98, 0.45, 0.12), vec3(0.7, 0.2, 0.1), y);",
  "  float horizonBand = smoothstep(0.0, 0.25, y) * (1.0 - smoothstep(0.25, 0.55, y));",
  "  skyColor += sunsetColor * sunsetT * horizonBand * 0.6;",
  "",
  "  gl_FragColor = vec4(skyColor, 1.0);",
  "}"
].join("\n");

var VERT_STAR = [
  "attribute vec4  aPosition;",
  "attribute float aBrightness;",
  "attribute float aSize;",
  "",
  "uniform mat4 uViewMatrix;",
  "uniform mat4 uProjectionMatrix;",
  "",
  "varying float vBrightness;",
  "",
  "void main() {",
  "  vBrightness  = aBrightness;",
  "  gl_Position  = uProjectionMatrix * uViewMatrix * aPosition;",
  "  gl_PointSize = aSize;",
  "}"
].join("\n");

var FRAG_STAR = [
  "precision mediump float;",
  "varying float vBrightness;",
  "uniform float uNightBlend;",
  "",
  "void main() {",
  "  vec2  coord = gl_PointCoord - vec2(0.5);",
  "  float dist  = length(coord);",
  "  if (dist > 0.5) discard;",
  "  float alpha  = smoothstep(0.5, 0.0, dist) * vBrightness * uNightBlend;",
  "  float twinkle = vBrightness;",
  "  vec3  starCol = mix(vec3(0.85, 0.90, 1.0), vec3(1.0, 0.95, 0.8), twinkle);",
  "  gl_FragColor = vec4(starCol, alpha);",
  "}"
].join("\n");

var VERT_SUN = [
  "attribute vec4 aPosition;",
  "attribute vec3 aNormal;",
  "attribute vec2 aTexCoord;",
  "",
  "uniform mat4 uModelMatrix;",
  "uniform mat4 uViewMatrix;",
  "uniform mat4 uProjectionMatrix;",
  "",
  "varying vec3 vNormal;",
  "varying vec3 vNormalView;",
  "varying vec2 vTexCoord;",
  "",
  "void main() {",
  "  vNormal     = normalize(aNormal);",
  "  // View uzayında normal: kameraya dönük yüzler +Z yönünü gösterir",
  "  vNormalView = normalize((uViewMatrix * uModelMatrix * vec4(aNormal, 0.0)).xyz);",
  "  vTexCoord   = aTexCoord;",
  "  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition;",
  "}"
].join("\n");

var FRAG_SUN = [
  "precision highp float;",
  "",
  "varying vec3 vNormal;",
  "varying vec3 vNormalView;",
  "varying vec2 vTexCoord;",
  "",
  "uniform float uIsMoon;",
  "uniform float uNightBlend;",
  "",
  "float hash(vec2 p) {",
  "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);",
  "}",
  "",
  "void main() {",
  "  vec3 Nv = normalize(vNormalView);",
  "  // Kameraya dönük etken: merkez=1, kenar=0",
  "  float facing = max(dot(Nv, vec3(0.0, 0.0, -1.0)), 0.0);",
  "",
  "  if (uIsMoon < 0.5) {",
  "    // ── GÜNEŞ 3D KÜRE ──────────────────────────────────────",
  "    // Limb karartma: kenarlar daha sıcak turuncu",
  "    float limb = pow(facing, 0.4);",
  "    vec3 core  = vec3(1.00, 0.98, 0.80);",
  "    vec3 edge  = vec3(1.00, 0.48, 0.04);",
  "    vec3 col   = mix(edge, core, limb * limb);",
  "    // Yüzey granülasyon (solar granulation)",
  "    float gran = hash(floor(vTexCoord * 14.0)) * 0.07 - 0.03;",
  "    col = clamp(col + gran, 0.0, 1.0);",
  "    gl_FragColor = vec4(col, 1.0);",
  "  } else {",
  "    // ── AY 3D KÜRE ──────────────────────────────────────────",
  "    vec3 moonBase = vec3(0.80, 0.80, 0.76);",
  "    // Prosedürel kraterler (UV tabanlı)",
  "    vec2 uv8  = vTexCoord * 8.0;",
  "    vec2 cell = floor(uv8);",
  "    vec2 f    = fract(uv8) - 0.5;",
  "    float c   = hash(cell);",
  "    float d   = length(f);",
  "    float crater = step(0.62, c) * smoothstep(0.45, 0.28, d) * 0.28;",
  "    // Krater halka kenarı (biraz daha açık)",
  "    float rim  = step(0.62, c) * smoothstep(0.50, 0.44, d) * smoothstep(0.28, 0.38, d) * 0.12;",
  "    moonBase = moonBase - crater + rim;",
  "    // Yönlü güneş ışığı (güneşin dünya uzayındaki yönü)",
  "    vec3 sunDir  = normalize(vec3(1.0, 0.4, -0.3));",
  "    vec3 Nw      = normalize(vNormal);",
  "    float diff   = max(dot(Nw, sunDir), 0.0);",
  "    float ambient = 0.08;",
  "    moonBase *= (ambient + (1.0 - ambient) * diff);",
  "    // View-space limb karartma",
  "    moonBase *= (0.35 + 0.65 * facing);",
  "    float alpha = clamp(uNightBlend * 1.5, 0.0, 1.0);",
  "    gl_FragColor = vec4(moonBase, alpha);",
  "  }",
  "}"
].join("\n");

/**
 * Yarış arabası texture'ı oluşturur (canvas 2D).
 * @param {string} primaryColor  — Ana gövde rengi (hex)
 * @param {string} stripeColor   — Şerit rengi (hex)
 * @returns {HTMLCanvasElement}
 */
function makeCarTexture(primaryColor, stripeColor) {
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  var ctx = cv.getContext('2d');

  // Temel renk
  ctx.fillStyle = primaryColor;
  ctx.fillRect(0, 0, 256, 256);

  // Yarış şeridi (dikey)
  var grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0.0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.3, stripeColor);
  grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.7, stripeColor);
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(80, 0, 96, 256);

  // Karbonfiber desen (ince grid)
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  for (var x = 0; x < 256; x += 16) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  for (var y = 0; y < 256; y += 16) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }

  // Yarış numarası
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 48px Orbitron, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(primaryColor === '#1a6fff' ? '01' : '02', 128, 128);

  return cv;
}

/**
 * Yol (pist) texture'ı oluşturur (canvas 2D).
 * @returns {HTMLCanvasElement}
 */
function makeRoadTexture() {
  var cv = document.createElement('canvas');
  cv.width = 512; cv.height = 512;
  var ctx = cv.getContext('2d');

  // Asfalt
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(0, 0, 512, 512);

  // Asfalt doku gürültüsü
  for (var i = 0; i < 3000; i++) {
    var rx = Math.random() * 512;
    var ry = Math.random() * 512;
    var rs = Math.random() * 2;
    var bright = Math.random() * 0.08;
    ctx.fillStyle = 'rgba(255,255,255,' + bright + ')';
    ctx.fillRect(rx, ry, rs, rs);
  }

  // Merkez kesik çizgi (sarı)
  ctx.strokeStyle = '#e8b23a';
  ctx.lineWidth = 5;
  ctx.setLineDash([40, 30]);
  ctx.beginPath();
  ctx.moveTo(256, 0); ctx.lineTo(256, 512);
  ctx.stroke();
  ctx.setLineDash([]);

  // Kenar çizgileri (beyaz)
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 0); ctx.lineTo(30, 512); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(482, 0); ctx.lineTo(482, 512); ctx.stroke();

  return cv;
}

/**
 * Zemin (çim/beton) texture'ı oluşturur.
 * @returns {HTMLCanvasElement}
 */
function makeGroundTexture() {
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 256;
  var ctx = cv.getContext('2d');

  // Çim yeşili
  ctx.fillStyle = '#2d5a1b';
  ctx.fillRect(0, 0, 256, 256);

  // Çim gürültüsü
  for (var i = 0; i < 5000; i++) {
    var gx = Math.random() * 256;
    var gy = Math.random() * 256;
    var gb = 0.05 + Math.random() * 0.12;
    ctx.fillStyle = 'rgba(' + Math.floor(30 + Math.random() * 40) + ',' +
      Math.floor(80 + Math.random() * 40) + ',20,' + gb + ')';
    ctx.fillRect(gx, gy, 2, Math.random() * 4 + 1);
  }

  return cv;
}

function makeStartLineTexture() {
  var cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  var ctx = cv.getContext('2d');

  var cols = 16, rows = 4;
  var cw = cv.width / cols, ch = cv.height / rows;

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111111';
      ctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }
  return cv;
}
