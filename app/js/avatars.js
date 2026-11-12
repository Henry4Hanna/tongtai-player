/* 25 hình thú kawaii cho hồ sơ người xem. Vẽ bằng SVG (không cần tải ảnh, nét trên TV 4K). */
(function (w) {
  'use strict';
  var INK = '#3A2A22', BLUSH = '#FF8FA3';

  function E(tag, a, inner) {
    var s = '<' + tag;
    for (var k in a) s += ' ' + k + '="' + a[k] + '"';
    return inner == null ? s + '/>' : s + '>' + inner + '</' + tag + '>';
  }
  function c(x, y, r, f, extra) { var a = { cx: x, cy: y, r: r, fill: f }; for (var k in extra || {}) a[k] = extra[k]; return E('circle', a); }
  function el(x, y, rx, ry, f, extra) { var a = { cx: x, cy: y, rx: rx, ry: ry, fill: f }; for (var k in extra || {}) a[k] = extra[k]; return E('ellipse', a); }
  function p(d, f, extra) { var a = { d: d, fill: f || 'none' }; for (var k in extra || {}) a[k] = extra[k]; return E('path', a); }
  function line(d, col, wd) { return p(d, 'none', { stroke: col || INK, 'stroke-width': wd || 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }); }

  // Mắt to long lanh, má hồng, miệng chữ "w"
  function eyes(y, dx, r) {
    y = y || 56; dx = dx || 12; r = r || 4.4;
    return el(50 - dx, y, r, r * 1.15, INK) + el(50 + dx, y, r, r * 1.15, INK) +
      c(50 - dx + 1.4, y - 1.8, r * 0.36, '#fff') + c(50 + dx + 1.4, y - 1.8, r * 0.36, '#fff');
  }
  function blush(y, dx) { y = y || 64; dx = dx || 21; return el(50 - dx, y, 5, 3, BLUSH, { opacity: 0.75 }) + el(50 + dx, y, 5, 3, BLUSH, { opacity: 0.75 }); }
  function mouth(y) { y = y || 65; return line('M44.5 ' + y + 'q2.75 3.2 5.5 0q2.75 3.2 5.5 0'); }
  function nose(y, f) { y = y || 61; return el(50, y, 2.8, 2, f || INK); }
  function face(y, ey, my) { return eyes(ey) + blush(y) + nose(my ? my - 4 : 61) + mouth(my); }

  var A = [
    { id: 'meo', name: 'Mèo', bg: '#FFE3C2', d: function () {
      return p('M24 44L28 16L46 34Z', '#F6B15E') + p('M76 44L72 16L54 34Z', '#F6B15E') + p('M29 38L31 23L41 33Z', '#FFD7DE') + p('M71 38L69 23L59 33Z', '#FFD7DE') +
        el(50, 58, 32, 27, '#F6B15E') + face() + line('M18 58h-10M18 63l-9 3M82 58h10M82 63l9 3', INK, 1.6);
    } },
    { id: 'cho', name: 'Chó', bg: '#DDEBFF', d: function () {
      return el(50, 58, 30, 27, '#E8C79A') + p('M22 40c-10 4-10 26 -2 30c6-4 8-18 2-30z', '#9A6A43') + p('M78 40c10 4 10 26 2 30c-6-4-8-18-2-30z', '#9A6A43') +
        el(50, 66, 13, 9, '#FFF3E2') + eyes(55) + blush(64) + el(50, 61.5, 4, 3, INK) + mouth(67);
    } },
    { id: 'gau', name: 'Gấu', bg: '#FFE9D6', d: function () {
      return c(26, 34, 10, '#B07A4E') + c(74, 34, 10, '#B07A4E') + c(26, 34, 5, '#E8B98F') + c(74, 34, 5, '#E8B98F') +
        el(50, 58, 31, 28, '#B07A4E') + el(50, 66, 12, 9, '#E8C8A4') + eyes(55) + blush(64) + nose(62) + mouth(67);
    } },
    { id: 'gautruc', name: 'Gấu trúc', bg: '#E4F6E8', d: function () {
      return c(26, 33, 10, INK) + c(74, 33, 10, INK) + el(50, 58, 32, 28, '#FFFFFF', { stroke: '#E6E6E6', 'stroke-width': 1 }) +
        el(37, 55, 8, 10, INK, { transform: 'rotate(-20 37 55)' }) + el(63, 55, 8, 10, INK, { transform: 'rotate(20 63 55)' }) +
        c(38, 54, 3.3, '#fff') + c(62, 54, 3.3, '#fff') + c(38.8, 53.2, 1.6, INK) + c(62.8, 53.2, 1.6, INK) + blush(66, 22) + nose(63) + mouth(68);
    } },
    { id: 'tho', name: 'Thỏ', bg: '#FFE4EE', d: function () {
      return el(38, 24, 7, 20, '#FFFFFF') + el(62, 24, 7, 20, '#FFFFFF') + el(38, 25, 3.5, 14, '#FFC3D2') + el(62, 25, 3.5, 14, '#FFC3D2') +
        el(50, 60, 30, 26, '#FFFFFF', { stroke: '#F1E4E8', 'stroke-width': 1 }) + eyes(58) + blush(66) + nose(63, '#FF8FA3') + mouth(68);
    } },
    { id: 'cao', name: 'Cáo', bg: '#FFF1D6', d: function () {
      return p('M22 46L24 14L46 34Z', '#F28C3A') + p('M78 46L76 14L54 34Z', '#F28C3A') + p('M27 38L28 22L39 32Z', '#FFF') + p('M73 38L72 22L61 32Z', '#FFF') +
        p('M18 50Q50 20 82 50Q80 78 50 86Q20 78 18 50Z', '#F28C3A') + p('M22 58Q36 62 50 86Q64 62 78 58Q72 82 50 86Q28 82 22 58Z', '#FFF') +
        eyes(54) + blush(64, 22) + nose(70) + line('M46 74q4 3 8 0');
    } },
    { id: 'heo', name: 'Heo', bg: '#FFE3E8', d: function () {
      return p('M24 40L26 22L40 32Z', '#FFA9BA') + p('M76 40L74 22L60 32Z', '#FFA9BA') + el(50, 58, 32, 27, '#FFC1CD') +
        eyes(52) + blush(62, 24) + el(50, 66, 11, 8, '#FF97AB') + el(46, 66, 2, 3, '#C9566D') + el(54, 66, 2, 3, '#C9566D');
    } },
    { id: 'koala', name: 'Koala', bg: '#E2F0F7', d: function () {
      return c(22, 42, 14, '#A9B4BE') + c(78, 42, 14, '#A9B4BE') + c(22, 42, 8, '#EEF1F4') + c(78, 42, 8, '#EEF1F4') +
        el(50, 58, 30, 27, '#A9B4BE') + eyes(54, 13) + blush(66, 20) + el(50, 64, 7, 9, INK) + c(48, 61, 1.6, '#fff');
    } },
    { id: 'chuot', name: 'Chuột', bg: '#EFE6FF', d: function () {
      return c(24, 34, 15, '#C9C3D6') + c(76, 34, 15, '#C9C3D6') + c(24, 34, 9, '#FFC9D6') + c(76, 34, 9, '#FFC9D6') +
        el(50, 60, 28, 25, '#C9C3D6') + eyes(57) + blush(65, 19) + nose(62, '#FF8FA3') + mouth(67) + line('M24 63h-12M24 68l-11 3M76 63h12M76 68l11 3', INK, 1.4);
    } },
    { id: 'ech', name: 'Ếch', bg: '#E5F7D9', d: function () {
      return c(32, 32, 13, '#7FCB62') + c(68, 32, 13, '#7FCB62') + c(32, 32, 8, '#FFF') + c(68, 32, 8, '#FFF') +
        c(33, 33, 4.5, INK) + c(67, 33, 4.5, INK) + c(34.3, 31.5, 1.6, '#fff') + c(68.3, 31.5, 1.6, '#fff') +
        el(50, 60, 34, 25, '#7FCB62') + blush(64, 23) + line('M38 66Q50 76 62 66', INK, 2.6);
    } },
    { id: 'chimcanhcut', name: 'Chim cánh cụt', bg: '#DDF3FF', d: function () {
      return el(50, 56, 32, 32, '#2F3B52') + p('M50 34C34 34 26 48 30 64C34 80 66 80 70 64C74 48 66 34 50 34Z', '#FFFFFF') +
        eyes(54, 11, 4) + blush(63, 17) + p('M44 60L56 60L50 67Z', '#F6B042');
    } },
    { id: 'cu', name: 'Cú', bg: '#F3E8D8', d: function () {
      return p('M22 30L36 40L28 46Z', '#8D6748') + p('M78 30L64 40L72 46Z', '#8D6748') + el(50, 58, 31, 29, '#8D6748') +
        el(50, 66, 18, 16, '#E8D2B2') + c(38, 52, 11, '#FFF6E6') + c(62, 52, 11, '#FFF6E6') +
        c(38, 52, 5, INK) + c(62, 52, 5, INK) + c(39.6, 50.4, 1.8, '#fff') + c(63.6, 50.4, 1.8, '#fff') + p('M46 60L54 60L50 67Z', '#F6A63A') + blush(66, 23);
    } },
    { id: 'gacon', name: 'Gà con', bg: '#FFF7CC', d: function () {
      return p('M46 26q4 -10 8 0q-4 -4 -8 0', '#F6C343') + c(50, 58, 31, '#FFD84D') + eyes(54) + blush(63, 20) + p('M44 61L56 61L50 68Z', '#F6913A');
    } },
    { id: 'sutu', name: 'Sư tử', bg: '#FFEBC9', d: function () {
      var m = '';
      for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; m += c((50 + Math.cos(a) * 30).toFixed(1), (56 + Math.sin(a) * 30).toFixed(1), 12, '#D9822B'); }
      return m + c(50, 56, 27, '#F6C26B') + c(30, 36, 6, '#F6C26B') + c(70, 36, 6, '#F6C26B') + el(50, 65, 11, 8, '#FFE6BD') + eyes(53) + blush(62, 18) + nose(62) + mouth(67);
    } },
    { id: 'ho', name: 'Hổ', bg: '#FFE7CF', d: function () {
      return c(26, 34, 9, '#F39A3B') + c(74, 34, 9, '#F39A3B') + c(26, 34, 4.5, '#FFF') + c(74, 34, 4.5, '#FFF') + el(50, 58, 32, 28, '#F39A3B') +
        p('M50 31v9M43 32l2 7M57 32l-2 7', 'none', { stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }) +
        p('M18 54h8M19 61h7M82 54h-8M81 61h-7', 'none', { stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }) +
        el(50, 67, 13, 9, '#FFF') + eyes(54) + blush(63, 22) + nose(63) + mouth(68);
    } },
    { id: 'khi', name: 'Khỉ', bg: '#FFE9DA', d: function () {
      return c(20, 54, 10, '#A0673F') + c(80, 54, 10, '#A0673F') + c(20, 54, 6, '#F4CDA7') + c(80, 54, 6, '#F4CDA7') + el(50, 56, 29, 28, '#A0673F') +
        p('M50 44C40 36 26 42 30 56C32 70 42 80 50 80C58 80 68 70 70 56C74 42 60 36 50 44Z', '#F4CDA7') + eyes(55, 10) + blush(65, 15) + nose(63) + mouth(68);
    } },
    { id: 'bo', name: 'Bò sữa', bg: '#E9F5FF', d: function () {
      return el(22, 40, 10, 5, '#FFF', { transform: 'rotate(-25 22 40)' }) + el(78, 40, 10, 5, '#FFF', { transform: 'rotate(25 78 40)' }) +
        p('M34 32q-4 -10 2 -12M66 32q4 -10 -2 -12', 'none', { stroke: '#E5C07B', 'stroke-width': 5, 'stroke-linecap': 'round' }) +
        el(50, 56, 29, 27, '#FFFFFF', { stroke: '#E3E3E3', 'stroke-width': 1 }) + el(38, 42, 9, 6, INK) + el(66, 48, 6, 5, INK) +
        el(50, 70, 17, 10, '#FFC6D0') + el(45, 70, 2, 2.6, '#C9566D') + el(55, 70, 2, 2.6, '#C9566D') + eyes(55) + blush(62, 23);
    } },
    { id: 'cuu', name: 'Cừu', bg: '#F2EEFF', d: function () {
      var f = '';
      [[30, 34], [40, 28], [50, 26], [60, 28], [70, 34], [76, 44], [24, 44]].forEach(function (q) { f += c(q[0], q[1], 10, '#FFFFFF', { stroke: '#E7E2F2', 'stroke-width': 1 }); });
      return el(22, 52, 8, 5, '#6E5A55') + el(78, 52, 8, 5, '#6E5A55') + f + el(50, 60, 22, 24, '#6E5A55') + eyes(58, 9, 3.8) + blush(66, 14) + mouth(70);
    } },
    { id: 'hamster', name: 'Hamster', bg: '#FFF0DE', d: function () {
      return c(28, 32, 8, '#F2B26B') + c(72, 32, 8, '#F2B26B') + c(28, 32, 4, '#FFC9D6') + c(72, 32, 4, '#FFC9D6') +
        el(50, 60, 34, 28, '#F2B26B') + el(50, 68, 26, 18, '#FFF5E8') + c(30, 66, 10, '#FFF5E8') + c(70, 66, 10, '#FFF5E8') + eyes(55) + blush(66, 22) + nose(62, '#FF8FA3') + mouth(67);
    } },
    { id: 'gaumeo', name: 'Gấu mèo', bg: '#E7EEF2', d: function () {
      return p('M24 42L26 20L42 32Z', '#8E949C') + p('M76 42L74 20L58 32Z', '#8E949C') + el(50, 58, 32, 27, '#8E949C') +
        p('M20 54Q35 44 50 52Q65 44 80 54Q72 64 50 60Q28 64 20 54Z', INK) + el(50, 68, 14, 10, '#FFF') + c(37, 55, 7, '#FFF') + c(63, 55, 7, '#FFF') + eyes(55, 13) + blush(66, 23) + nose(64) + mouth(69);
    } },
    { id: 'nai', name: 'Nai con', bg: '#FFF0E0', d: function () {
      return p('M34 34l-6 -16M28 26l-7 -4M30 22l2 -6M66 34l6 -16M72 26l7 -4M70 22l-2 -6', 'none', { stroke: '#8A5A33', 'stroke-width': 3.5, 'stroke-linecap': 'round' }) +
        el(24, 44, 9, 5, '#D9955A', { transform: 'rotate(-20 24 44)' }) + el(76, 44, 9, 5, '#D9955A', { transform: 'rotate(20 76 44)' }) +
        el(50, 58, 27, 28, '#D9955A') + c(40, 44, 2.2, '#FFF') + c(60, 42, 2, '#FFF') + c(50, 40, 1.8, '#FFF') + el(50, 70, 11, 9, '#F7DCC0') + eyes(56, 11) + blush(64, 19) + nose(68);
    } },
    { id: 'capy', name: 'Capybara', bg: '#EEF6DF', d: function () {
      return c(30, 32, 6, '#8B5E3C') + c(70, 32, 6, '#8B5E3C') + p('M22 40Q22 28 50 28Q78 28 78 40L80 70Q80 86 50 86Q20 86 20 70Z', '#B07C52') +
        el(50, 72, 18, 11, '#8B5E3C') + el(44, 70, 2.4, 1.6, INK) + el(56, 70, 2.4, 1.6, INK) + el(36, 50, 3.6, 2.4, INK) + el(64, 50, 3.6, 2.4, INK) +
        blush(59, 22) + line('M47 78q3 2 6 0', INK, 1.8) + c(50, 24, 5, '#FF9D3A') + p('M50 19c2 -4 6 -4 7 -1', 'none', { stroke: '#5BA85A', 'stroke-width': 2.4, 'stroke-linecap': 'round' });
    } },
    { id: 'rua', name: 'Rùa', bg: '#E2F6EF', d: function () {
      return el(50, 76, 34, 14, '#6BB36E') + p('M22 74Q24 48 50 46Q76 48 78 74Z', '#4E9A57') + p('M36 62h28M42 52l-6 22M58 52l6 22', 'none', { stroke: '#3C7C45', 'stroke-width': 2 }) +
        c(50, 36, 18, '#9BD78F') + eyes(35, 7, 3.4) + blush(40, 11) + line('M47 41q3 2.4 6 0', INK, 1.8);
    } },
    { id: 'kylan', name: 'Kỳ lân', bg: '#F6E8FF', d: function () {
      return p('M46 30L50 6L54 30Z', '#FFD45E') + line('M47 24l6 -2M48 17l4 -1.4', '#E8A93B', 1.6) +
        p('M24 42L28 22L40 34Z', '#FFFFFF') + p('M76 42L72 22L60 34Z', '#FFFFFF') + el(50, 58, 30, 27, '#FFFFFF', { stroke: '#EEE3F6', 'stroke-width': 1 }) +
        p('M62 32Q80 30 82 52Q74 42 66 44Z', '#B88CFF') + p('M66 36Q84 40 80 62Q74 50 68 48Z', '#7FD1FF') + p('M58 30Q70 26 76 36Q68 34 62 38Z', '#FF9FC7') +
        eyes(57) + blush(65, 20) + el(46, 66, 1.6, 1.2, INK) + el(54, 66, 1.6, 1.2, INK);
    } },
    { id: 'voi', name: 'Voi', bg: '#E3EDFF', d: function () {
      return el(20, 54, 15, 19, '#A7B9D9') + el(80, 54, 15, 19, '#A7B9D9') + el(20, 54, 9, 13, '#F7C6D3') + el(80, 54, 9, 13, '#F7C6D3') +
        el(50, 54, 25, 25, '#A7B9D9') + p('M44 62Q44 84 56 86Q60 86 60 82Q52 80 54 62Z', '#A7B9D9') + eyes(50, 11) + blush(60, 17);
    } }
  ];

  function svg(i, px) {
    var a = A[((i % A.length) + A.length) % A.length];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + (px || 100) + '" height="' + (px || 100) + '">' +
      c(50, 50, 50, a.bg) + a.d() + '</svg>';
  }

  function bg(i) { return (A[((i % A.length) + A.length) % A.length] || {}).bg || ''; }
  function hsl(hex) {
    var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); if (!m) return null;
    var r = parseInt(m[1], 16) / 255, g = parseInt(m[2], 16) / 255, b = parseInt(m[3], 16) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(mx + mn - 1) || 1) };
  }
  // Mỗi hồ sơ một màu riêng, gần với màu nền hình thú của hồ sơ đó; không hai hồ sơ trùng màu.
  // list: [{id, av}] theo thứ tự hồ sơ trong app; pal: bảng màu đậm. Trả về {id: màu}.
  function colors(list, pal) {
    var out = {}, used = {}, ph = pal.map(hsl);
    function free() { for (var i = 0; i < pal.length; i++) if (!used[i]) return i; return -1; }
    (list || []).forEach(function (p) {
      if (!p || !p.id || out[p.id] || p.av == null) return;
      var h = hsl(bg(p.av)), best = -1, bd = 999;
      pal.forEach(function (c2, i) {
        if (used[i] || !ph[i] || ph[i].s < 0.25) return;
        var dd = Math.abs(ph[i].h - h.h); dd = Math.min(dd, 360 - dd);
        if (dd < bd) { bd = dd; best = i; }
      });
      if (best < 0) best = free();
      if (best >= 0) { used[best] = 1; out[p.id] = pal[best]; }
    });
    (list || []).forEach(function (p) { if (p && p.id && !out[p.id]) { var i = free(); out[p.id] = i >= 0 ? pal[i] : pal[Object.keys(out).length % pal.length]; if (i >= 0) used[i] = 1; } });
    return out;
  }

  w.Avatars = { count: A.length, svg: svg, bg: bg, colors: colors, name: function (i) { return (A[i] || {}).name || ''; } };
})(window);
