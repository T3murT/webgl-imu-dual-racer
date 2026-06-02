/**
 * MV.js — Matrix & Vector Mathematics Library
 * Angel's Interactive Computer Graphics, 7th Edition
 * Vektör ve matris işlemleri için yardımcı kütüphane
 */

"use strict";

// ─── RADIANS / DEGREES ─────────────────────────────────────────
function radians(degrees) { return degrees * Math.PI / 180.0; }
function degrees(r) { return r * 180.0 / Math.PI; }

// ─── VECTOR CONSTRUCTORS ────────────────────────────────────────
function vec2() {
  var result = _argumentsToArray(arguments);
  switch (result.length) {
    case 0: result.push(0.0);
    case 1: result.push(0.0);
  }
  return result.splice(0, 2);
}

function vec3() {
  var result = _argumentsToArray(arguments);
  switch (result.length) {
    case 0: result.push(0.0);
    case 1: result.push(0.0);
    case 2: result.push(0.0);
  }
  return result.splice(0, 3);
}

function vec4() {
  var result = _argumentsToArray(arguments);
  switch (result.length) {
    case 0: result.push(0.0);
    case 1: result.push(0.0);
    case 2: result.push(0.0);
    case 3: result.push(1.0);
  }
  return result.splice(0, 4);
}

// ─── MATRIX CONSTRUCTORS ────────────────────────────────────────
function mat2() {
  var v = _argumentsToArray(arguments);
  var m = [];
  switch (v.length) {
    case 0:
      v[0] = 1;
    case 1:
      m = [[v[0], 0.0], [0.0, v[0]]];
      break;
    default:
      m.push(vec2(v.splice(0, 2)));
      m.push(vec2(v.splice(0, 2)));
      break;
  }
  m.matrix = true;
  return m;
}

function mat3() {
  var v = _argumentsToArray(arguments);
  var m = [];
  switch (v.length) {
    case 0:
      v[0] = 1;
    case 1:
      m = [[v[0], 0.0, 0.0],
           [0.0, v[0], 0.0],
           [0.0, 0.0, v[0]]];
      break;
    default:
      m.push(vec3(v.splice(0, 3)));
      m.push(vec3(v.splice(0, 3)));
      m.push(vec3(v.splice(0, 3)));
      break;
  }
  m.matrix = true;
  return m;
}

function mat4() {
  var v = _argumentsToArray(arguments);
  var m = [];
  switch (v.length) {
    case 0:
      v[0] = 1;
    case 1:
      m = [[v[0], 0.0, 0.0, 0.0],
           [0.0, v[0], 0.0, 0.0],
           [0.0, 0.0, v[0], 0.0],
           [0.0, 0.0, 0.0, v[0]]];
      break;
    default:
      m.push(vec4(v.splice(0, 4)));
      m.push(vec4(v.splice(0, 4)));
      m.push(vec4(v.splice(0, 4)));
      m.push(vec4(v.splice(0, 4)));
      break;
  }
  m.matrix = true;
  return m;
}

// ─── HELPERS ────────────────────────────────────────────────────
function _argumentsToArray(args) {
  return [].concat.apply([], Array.prototype.slice.apply(args));
}

// ─── VECTOR OPERATIONS ──────────────────────────────────────────
function equal(u, v) {
  if (u.length != v.length) return false;
  for (var i = 0; i < u.length; i++) {
    if (u[i] !== v[i]) return false;
  }
  return true;
}

function add(u, v) {
  var result = [];
  if (u.matrix && v.matrix) {
    if (u.length != v.length) throw "add(): incompatible matrix sizes";
    for (var i = 0; i < u.length; i++) {
      result.push(add(u[i], v[i]));
    }
    result.matrix = true;
    return result;
  }
  if (u.matrix || v.matrix) throw "add(): trying to add matrix and non-matrix variable";
  if (u.length != v.length) throw "add(): vectors are not the same size";
  for (var i = 0; i < u.length; i++) result.push(u[i] + v[i]);
  return result;
}

function subtract(u, v) {
  var result = [];
  if (u.matrix && v.matrix) {
    if (u.length != v.length) throw "subtract(): incompatible matrix sizes";
    for (var i = 0; i < u.length; i++) result.push(subtract(u[i], v[i]));
    result.matrix = true;
    return result;
  }
  if (u.matrix || v.matrix) throw "subtract(): trying to subtract matrix and non-matrix variable";
  if (u.length != v.length) throw "subtract(): vectors are not the same size";
  for (var i = 0; i < u.length; i++) result.push(u[i] - v[i]);
  return result;
}

function mult(u, v) {
  var result = [];
  if (u.matrix && v.matrix) {
    if (u.length != v.length) throw "mult(): incompatible matrix sizes";
    for (var i = 0; i < u.length; i++) {
      var row = [];
      for (var j = 0; j < v.length; j++) {
        var sum = 0;
        for (var k = 0; k < u.length; k++) {
          sum += u[i][k] * v[k][j];
        }
        row.push(sum);
      }
      result.push(row);
    }
    result.matrix = true;
    return result;
  }
  if (u.matrix && !v.matrix) {
    // Matrix * vector
    for (var i = 0; i < u.length; i++) {
      var sum = 0;
      for (var j = 0; j < v.length; j++) {
        sum += u[i][j] * v[j];
      }
      result.push(sum);
    }
    return result;
  }
  if (!u.matrix && v.matrix) {
    for (var j = 0; j < v.length; j++) {
      var sum = 0;
      for (var i = 0; i < u.length; i++) {
        sum += u[i] * v[i][j];
      }
      result.push(sum);
    }
    return result;
  }
  // Scalar * vector or vector * scalar
  if (typeof u === 'number') {
    for (var i = 0; i < v.length; i++) result.push(u * v[i]);
    return result;
  }
  if (typeof v === 'number') {
    for (var i = 0; i < u.length; i++) result.push(u[i] * v);
    return result;
  }
  if (u.length != v.length) throw "mult(): incompatible array sizes";
  for (var i = 0; i < u.length; i++) result.push(u[i] * v[i]);
  return result;
}

function scale(s, u) {
  if (!Array.isArray(u)) throw "scale(): second argument must be a vector";
  var result = [];
  for (var i = 0; i < u.length; i++) result.push(s * u[i]);
  return result;
}

function negate(u) {
  var result = [];
  for (var i = 0; i < u.length; i++) result.push(-u[i]);
  return result;
}

// ─── DOT / CROSS ────────────────────────────────────────────────
function dot(u, v) {
  if (u.length != v.length) throw "dot(): vectors are not the same size";
  var sum = 0;
  for (var i = 0; i < u.length; i++) sum += u[i] * v[i];
  return sum;
}

function cross(u, v) {
  if (u.length < 3 || v.length < 3) throw "cross(): vectors are not length 3";
  return [
    u[1]*v[2] - u[2]*v[1],
    u[2]*v[0] - u[0]*v[2],
    u[0]*v[1] - u[1]*v[0]
  ];
}

function length(u) { return Math.sqrt(dot(u, u)); }

function normalize(u, excludeLastComponent) {
  if (excludeLastComponent) {
    var last = u.pop();
    var len = length(u);
    if (len === 0) throw "normalize(): vector has zero length";
    u = scale(1 / len, u);
    u.push(last);
    return u;
  }
  var len = length(u);
  if (len === 0) throw "normalize(): vector has zero length";
  return scale(1 / len, u);
}

function mix(u, v, s) {
  if (typeof s !== 'number') throw "mix(): third argument is not a number";
  if (u.length != v.length) throw "mix(): vectors are not the same size";
  var result = [];
  for (var i = 0; i < u.length; i++) result.push((1 - s) * u[i] + s * v[i]);
  return result;
}

// ─── MATRIX OPERATIONS ──────────────────────────────────────────
function transpose(m) {
  if (!m.matrix) throw "transpose(): argument is not a matrix";
  var result = [];
  for (var i = 0; i < m.length; i++) {
    var row = [];
    for (var j = 0; j < m[i].length; j++) row.push(m[j][i]);
    result.push(row);
  }
  result.matrix = true;
  return result;
}

// ─── AFFINE TRANSFORMATIONS ─────────────────────────────────────
// Ölçek matrisi (Angel 7th Ed., Chapter 4)
function scalem(x, y, z) {
  var result = mat4();
  result[0][0] = x;
  result[1][1] = y;
  result[2][2] = z;
  return result;
}

// Öteleme matrisi
function translate(x, y, z) {
  if (Array.isArray(x) && x.length == 3) { z = x[2]; y = x[1]; x = x[0]; }
  var result = mat4();
  result[0][3] = x;
  result[1][3] = y;
  result[2][3] = z;
  return result;
}

// Dönme matrisi — eksen ve açı (derece)
function rotate(angle, axis) {
  if (!Array.isArray(axis)) axis = [arguments[1], arguments[2], arguments[3]];
  var v = normalize(vec3(axis));
  var x = v[0], y = v[1], z = v[2];
  var c = Math.cos(radians(angle));
  var s = Math.sin(radians(angle));
  var omc = 1.0 - c;

  var result = mat4(
    [x*x*omc + c,   x*y*omc - z*s, x*z*omc + y*s, 0.0],
    [x*y*omc + z*s, y*y*omc + c,   y*z*omc - x*s, 0.0],
    [x*z*omc - y*s, y*z*omc + x*s, z*z*omc + c,   0.0],
    [0.0,           0.0,           0.0,            1.0]
  );
  return result;
}

// ─── VIEWING ────────────────────────────────────────────────────
// lookAt — Angel 7th Ed., Chapter 5
function lookAt(eye, at, up) {
  if (!Array.isArray(eye) || eye.length < 3) throw "lookAt(): first parameter [eye] must be an a vec3";
  if (!Array.isArray(at)  || at.length  < 3) throw "lookAt(): second parameter [at] must be an a vec3";
  if (!Array.isArray(up)  || up.length  < 3) throw "lookAt(): third parameter [up] must be an a vec3";

  if (equal(eye, at)) return mat4();

  var v = normalize(subtract(at, eye));
  var n = normalize(cross(v, up));
  var u = cross(n, v);

  v = negate(v);

  return mat4(
    [n[0], n[1], n[2], -dot(n, eye)],
    [u[0], u[1], u[2], -dot(u, eye)],
    [v[0], v[1], v[2], -dot(v, eye)],
    [0.0,  0.0,  0.0,  1.0]
  );
}

// Perspektif projeksiyon — Angel 7th Ed., Chapter 5
function perspective(fovy, aspect, near, far) {
  var f = 1.0 / Math.tan(radians(fovy) / 2);
  var d = far - near;
  return mat4(
    [f / aspect, 0.0, 0.0,                  0.0],
    [0.0,        f,   0.0,                  0.0],
    [0.0,        0.0, -(near + far) / d,    -2 * near * far / d],
    [0.0,        0.0, -1.0,                 0.0]
  );
}

// Ortografik projeksiyon
function ortho(left, right, bottom, top, near, far) {
  if (left == right) throw "ortho(): left and right are equal";
  if (bottom == top) throw "ortho(): bottom and top are equal";
  if (near == far)   throw "ortho(): near and far are equal";
  var w = right - left, h = top - bottom, d = far - near;
  return mat4(
    [2.0/w, 0.0,   0.0,   -(left+right)/w],
    [0.0,   2.0/h, 0.0,   -(top+bottom)/h],
    [0.0,   0.0,   -2/d,  -(near+far)/d],
    [0.0,   0.0,   0.0,   1.0]
  );
}

// ─── FLATTEN (WebGL için) ────────────────────────────────────────
function flatten(v) {
  if (v.matrix === true) {
    v = transpose(v);
  }
  var n = v.length;
  var elemsAreArrays = false;
  if (Array.isArray(v[0])) {
    elemsAreArrays = true;
    n *= v[0].length;
  }
  var floats = new Float32Array(n);
  if (elemsAreArrays) {
    var idx = 0;
    for (var i = 0; i < v.length; i++) {
      for (var j = 0; j < v[i].length; j++) {
        floats[idx++] = v[i][j];
      }
    }
  } else {
    for (var i = 0; i < v.length; i++) floats[i] = v[i];
  }
  return floats;
}

// ─── PRINT UTILITIES ────────────────────────────────────────────
function printv(v) {
  var vStr = "[";
  for (var i = 0; i < v.length; i++) vStr += v[i].toFixed(4) + (i < v.length - 1 ? ", " : "]");
  console.log(vStr);
}

function printm(m) {
  if (m.length == 2) { printv(m[0]); printv(m[1]); }
  else if (m.length == 3) { printv(m[0]); printv(m[1]); printv(m[2]); }
  else { printv(m[0]); printv(m[1]); printv(m[2]); printv(m[3]); }
}
