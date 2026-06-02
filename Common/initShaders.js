/**
 * initShaders.js — Shader Initialization
 * Angel's Interactive Computer Graphics, 7th Edition
 * Shader derleme ve program bağlama yardımcısı
 */

"use strict";

/**
 * Verilen vertex ve fragment shader scriptlerinden WebGL programı oluşturur.
 * @param {WebGLRenderingContext} gl
 * @param {string} vertexShaderId - <script> tag ID'si
 * @param {string} fragmentShaderId - <script> tag ID'si
 * @returns {WebGLProgram}
 */
function initShaders(gl, vertexShaderId, fragmentShaderId) {
  var vertShdr = compileShader(gl, vertexShaderId, gl.VERTEX_SHADER);
  var fragShdr = compileShader(gl, fragmentShaderId, gl.FRAGMENT_SHADER);

  var program = gl.createProgram();
  gl.attachShader(program, vertShdr);
  gl.attachShader(program, fragShdr);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var msg = "Shader program bağlama başarısız:\n" + gl.getProgramInfoLog(program);
    console.error(msg);
    throw msg;
  }
  return program;
}

/**
 * GLSL shader kaynağından shader nesnesi derler.
 */
function compileShader(gl, id, type) {
  var shaderScript = document.getElementById(id);
  if (!shaderScript) {
    throw "Shader bulunamadı: " + id;
  }
  var shaderSource = shaderScript.text;
  var shader = gl.createShader(type);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var msg = "Shader derleme hatası [" + id + "]:\n" + gl.getShaderInfoLog(shader);
    console.error(msg);
    throw msg;
  }
  return shader;
}

/**
 * Shader kaynak kodu stringlerinden program oluşturur.
 * (Alternatif, inline source için)
 */
function initShadersFromSource(gl, vertSrc, fragSrc) {
  function compileFromSrc(src, type) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw "Shader hatası: " + gl.getShaderInfoLog(s);
    }
    return s;
  }

  var vert = compileFromSrc(vertSrc, gl.VERTEX_SHADER);
  var frag = compileFromSrc(fragSrc, gl.FRAGMENT_SHADER);

  var prog = gl.createProgram();
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw "Program bağlama hatası: " + gl.getProgramInfoLog(prog);
  }
  return prog;
}
