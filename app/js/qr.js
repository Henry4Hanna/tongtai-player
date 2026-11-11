/* Tạo mã QR (chế độ byte, sửa lỗi L hoặc M) — chạy hoàn toàn trong app, không cần mạng.
   Dùng: QR.svg('chữ cần mã hóa', 520) -> chuỗi SVG, hoặc null nếu quá dài. Viết theo chuẩn ISO/IEC 18004. */
(function (w) {
  'use strict';
  // [mức][phiên bản]: số byte sửa lỗi mỗi khối, số khối. Mức 0 = L, 1 = M
  var ECC = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
  ];
  var BLK = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
  ];
  var FMT = [1, 0];   // bit định dạng của L và M

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) {
      var na = Math.floor(v / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (v >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(v, l) { return Math.floor(rawModules(v) / 8) - ECC[l][v] * BLK[l][v]; }

  // ---- Reed-Solomon trên GF(256)
  function mul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function rsDiv(deg) {
    var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1);
    var root = 1;
    for (var k = 0; k < deg; k++) {
      for (var j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
      root = mul(root, 2);
    }
    return r;
  }
  function rsRem(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= mul(c, f); });
    });
    return r;
  }

  function utf8(s) { var u = unescape(encodeURIComponent(s)), a = []; for (var i = 0; i < u.length; i++) a.push(u.charCodeAt(i)); return a; }
  function bit(x, i) { return ((x >>> i) & 1) !== 0; }

  function build(bytes, ver, lvl) {
    var size = ver * 4 + 17, cap = dataCodewords(ver, lvl);
    // luồng bit: chế độ byte (0100) + độ dài + dữ liệu
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var capBits = cap * 8;
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    for (var pad = 0xEC; data.length < cap; pad ^= 0xEC ^ 0x11) data.push(pad);

    // chia khối + sửa lỗi + xen kẽ
    var nb = BLK[lvl][ver], eccLen = ECC[lvl][ver], raw = Math.floor(rawModules(ver) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDiv(eccLen), blocks = [];
    for (var bi = 0, k = 0; bi < nb; bi++) {
      var dat = data.slice(k, k + shortLen - eccLen + (bi < nShort ? 0 : 1)); k += dat.length;
      var ecc = rsRem(dat, div);
      if (bi < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var all = [];
    for (var x = 0; x < blocks[0].length; x++) blocks.forEach(function (blk, bj) { if (x !== shortLen - eccLen || bj >= nShort) all.push(blk[x]); });

    // ma trận
    var m = [], fn = [];
    for (var y = 0; y < size; y++) { m.push([]); fn.push([]); for (var xx = 0; xx < size; xx++) { m[y].push(false); fn[y].push(false); } }
    function setF(x2, y2, d) { m[y2][x2] = d; fn[y2][x2] = true; }
    for (var t = 0; t < size; t++) { setF(6, t, t % 2 === 0); setF(t, 6, t % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy)), px = cx + dx, py = cy + dy;
        if (px >= 0 && px < size && py >= 0 && py < size) setF(px, py, dist !== 2 && dist !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = [];
    if (ver > 1) {
      var na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
      ap = [6]; for (var pos = size - 7; ap.length < na; pos -= step) ap.splice(1, 0, pos);
    }
    ap.forEach(function (ay, i) {
      ap.forEach(function (ax, j) {
        if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) return;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    function fmt(mask) {
      var d = (FMT[lvl] << 3) | mask, rem = d;
      for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bt = ((d << 10) | rem) ^ 0x5412;
      for (var a = 0; a <= 5; a++) setF(8, a, bit(bt, a));
      setF(8, 7, bit(bt, 6)); setF(8, 8, bit(bt, 7)); setF(7, 8, bit(bt, 8));
      for (var b2 = 9; b2 < 15; b2++) setF(14 - b2, 8, bit(bt, b2));
      for (var c = 0; c < 8; c++) setF(size - 1 - c, 8, bit(bt, c));
      for (var e = 8; e < 15; e++) setF(8, size - 15 + e, bit(bt, e));
      setF(8, size - 8, true);
    }
    fmt(0);
    if (ver >= 7) {
      var vr = ver; for (var q = 0; q < 12; q++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1F25);
      var vb = (ver << 12) | vr;
      for (var z = 0; z < 18; z++) { var vbit = bit(vb, z), va = size - 11 + z % 3, vbb = Math.floor(z / 3); setF(va, vbb, vbit); setF(vbb, va, vbit); }
    }
    // đặt dữ liệu theo đường zigzag
    var n = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var jj = 0; jj < 2; jj++) {
        var cx = right - jj, up = ((right + 1) & 2) === 0, cy = up ? size - 1 - vert : vert;
        if (!fn[cy][cx] && n < all.length * 8) { m[cy][cx] = bit(all[n >>> 3], 7 - (n & 7)); n++; }
      }
    }
    // chọn mặt nạ có điểm phạt thấp nhất
    function mask(mk) {
      for (var y2 = 0; y2 < size; y2++) for (var x2 = 0; x2 < size; x2++) {
        var inv;
        switch (mk) {
          case 0: inv = (x2 + y2) % 2 === 0; break;
          case 1: inv = y2 % 2 === 0; break;
          case 2: inv = x2 % 3 === 0; break;
          case 3: inv = (x2 + y2) % 3 === 0; break;
          case 4: inv = (Math.floor(x2 / 3) + Math.floor(y2 / 2)) % 2 === 0; break;
          case 5: inv = x2 * y2 % 2 + x2 * y2 % 3 === 0; break;
          case 6: inv = (x2 * y2 % 2 + x2 * y2 % 3) % 2 === 0; break;
          default: inv = ((x2 + y2) % 2 + x2 * y2 % 3) % 2 === 0;
        }
        if (!fn[y2][x2] && inv) m[y2][x2] = !m[y2][x2];
      }
    }
    function penalty() {
      var p = 0, dark = 0, y2, x2, run, i2;
      for (y2 = 0; y2 < size; y2++) {
        run = 1;
        for (x2 = 1; x2 < size; x2++) { if (m[y2][x2] === m[y2][x2 - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      }
      for (x2 = 0; x2 < size; x2++) {
        run = 1;
        for (y2 = 1; y2 < size; y2++) { if (m[y2][x2] === m[y2 - 1][x2]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
      }
      for (y2 = 0; y2 < size - 1; y2++) for (x2 = 0; x2 < size - 1; x2++) {
        var c = m[y2][x2]; if (c === m[y2][x2 + 1] && c === m[y2 + 1][x2] && c === m[y2 + 1][x2 + 1]) p += 3;
      }
      for (y2 = 0; y2 < size; y2++) for (x2 = 0; x2 < size; x2++) if (m[y2][x2]) dark++;
      i2 = Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1;
      return p + i2 * 10;
    }
    var best = 0, bestP = 1e9;
    for (var mk = 0; mk < 8; mk++) {
      fmt(mk); mask(mk);
      var pp = penalty();
      if (pp < bestP) { bestP = pp; best = mk; }
      mask(mk);   // gỡ mặt nạ (XOR lần 2)
    }
    fmt(best); mask(best);
    return m;
  }

  function make(text, minLevel) {
    var bytes = utf8(text);
    for (var lvl = (minLevel == null ? 1 : minLevel); lvl >= 0; lvl--) {
      for (var v = 1; v <= 40; v++) {
        var need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
        if (need <= dataCodewords(v, lvl) * 8) return build(bytes, v, lvl);
      }
    }
    return null;
  }

  function svg(text, px, minLevel) {
    var m = make(text, minLevel);
    if (!m) return null;
    var n = m.length, q = 4, d = '';
    for (var y = 0; y < n; y++) {
      var x = 0;
      while (x < n) {
        if (m[y][x]) { var s = x; while (x < n && m[y][x]) x++; d += 'M' + (s + q) + ' ' + (y + q) + 'h' + (x - s) + 'v1h-' + (x - s) + 'z'; } else x++;
      }
    }
    var t = n + q * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + t + ' ' + t + '" width="' + px + '" height="' + px +
      '" shape-rendering="crispEdges"><rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }

  w.QR = { svg: svg, make: make, capacity: function () { return Math.floor(dataCodewords(40, 0)) - 3; } };
})(window);
