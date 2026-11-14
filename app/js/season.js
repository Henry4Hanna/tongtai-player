/* Chủ đề theo mùa và ngày lễ: tự đổi theo ngày (Noel, Tết, Valentine, Halloween…), hoặc chọn tay, hoặc tắt.
   Mỗi chủ đề có: màu nhấn, hạt rơi (tuyết, hoa anh đào, lá thu…), dây đèn nhấp nháy, hình nhỏ trên logo, lời chúc. */
(function (w) {
  'use strict';
  var d = document;

  /* ---------- Hình vẽ SVG (nhẹ, không cần tải ảnh) ---------- */
  function S(inner, vb) { return '<svg viewBox="' + (vb || '0 0 24 24') + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>'; }
  var SH = {
    snow: function () { return S('<g stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7"/><path d="M9 3.6l3 2.2 3-2.2M9 20.4l3-2.2 3 2.2M3.4 10.6l3.3-1.2-.5-3.6M20.6 13.4l-3.3 1.2.5 3.6M3.4 13.4l3.3 1.2-.5 3.6M20.6 10.6l-3.3-1.2.5-3.6"/></g>'); },
    flower: function (c, m) {
      var g = '';
      for (var i = 0; i < 5; i++) g += '<ellipse cx="12" cy="6.6" rx="3.7" ry="5.4" transform="rotate(' + i * 72 + ' 12 12)"/>';
      return S('<g fill="' + c + '">' + g + '</g><circle cx="12" cy="12" r="2.4" fill="' + (m || '#FFE38A') + '"/>');
    },
    petal: function (c) { return S('<path d="M12 3C7 7 6 13 12 21c6-8 5-14 0-18z" fill="' + c + '"/><path d="M12 6v12" stroke="rgba(255,255,255,.5)" stroke-width="1"/>'); },
    leaf: function (c) { return S('<path d="M12 1.5l2 4.6 3.8-1.6-.9 4.6 4.8.8-3.6 3 1.8 3.2-4.6-.9-.9 3.9L12 16l-2.4 3.1-.9-3.9-4.6.9 1.8-3.2-3.6-3 4.8-.8-.9-4.6 3.8 1.6z" fill="' + c + '"/><path d="M12 15v8" stroke="#7A4A1E" stroke-width="1.4" stroke-linecap="round"/>'); },
    heart: function (c) { return S('<path d="M12 21s-8.5-5.3-8.5-11.2A4.7 4.7 0 0 1 12 7a4.7 4.7 0 0 1 8.5 2.8C20.5 15.7 12 21 12 21z" fill="' + c + '"/><ellipse cx="8.3" cy="9.6" rx="1.6" ry="1" fill="rgba(255,255,255,.6)"/>'); },
    star: function (c) { return S('<path d="M12 2l2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 17l-6.1 3.3 1.4-6.7-5-4.6 6.8-.8z" fill="' + c + '"/>'); },
    spark: function (c) { return S('<path d="M12 1c.8 6 4.9 10.2 11 11-6.1.8-10.2 5-11 11-.8-6-4.9-10.2-11-11 6.1-.8 10.2-5 11-11z" fill="' + c + '"/>'); },
    pumpkin: function () { return S('<path d="M12 6c1-3 3-4 4-3.6" stroke="#4E8A3A" stroke-width="1.8" fill="none" stroke-linecap="round"/><ellipse cx="7.5" cy="14" rx="5" ry="7" fill="#E8761E"/><ellipse cx="16.5" cy="14" rx="5" ry="7" fill="#E8761E"/><ellipse cx="12" cy="14" rx="5" ry="7.4" fill="#F59331"/><path d="M8.6 12l1.6-1.8 1.4 1.8zM12.4 12l1.6-1.8 1.4 1.8z" fill="#3A1A05"/><path d="M8.6 15.6q3.4 2.8 6.8 0l-1.2.4-.8-.8-.8.8-1.2-.6-1 .8z" fill="#3A1A05"/>'); },
    bat: function () { return S('<path d="M12 9c.8-1.6 1.6-1.6 1.8-.2 2.2-2 6.2-2.6 9.2-.8-2.2.6-3.2 2.2-3.2 4.2-1.4-1.2-3.2-1.2-4.4.4-.8-1-1.8-1.6-3.4-1.6s-2.6.6-3.4 1.6c-1.2-1.6-3-1.6-4.4-.4 0-2-1-3.6-3.2-4.2 3-1.8 7-1.2 9.2.8.2-1.4 1-1.4 1.8.2z" fill="#7A4FC0" stroke="#C9A8FF" stroke-width=".5"/><circle cx="11" cy="10" r=".5" fill="#FFD84D"/><circle cx="13" cy="10" r=".5" fill="#FFD84D"/>'); },
    lantern: function (c, gold) {
      c = c || '#E0262B'; gold = gold || '#F5C542';
      return S('<path d="M12 0v3" stroke="' + gold + '" stroke-width="1.2"/><rect x="8.5" y="3" width="7" height="2" rx="1" fill="' + gold + '"/><ellipse cx="12" cy="11.5" rx="7.5" ry="6.6" fill="' + c + '"/>' +
        '<path d="M12 5c-3 2-3 11 0 13M12 5c3 2 3 11 0 13" stroke="rgba(0,0,0,.18)" stroke-width="1" fill="none"/><rect x="8.5" y="17.6" width="7" height="2" rx="1" fill="' + gold + '"/><path d="M11 19.6v4M12 19.6v4.4M13 19.6v4" stroke="' + gold + '" stroke-width=".8"/>');
    },
    balloon: function (c) { return S('<ellipse cx="12" cy="9" rx="6.5" ry="8" fill="' + c + '"/><ellipse cx="9.4" cy="6" rx="1.6" ry="2.4" fill="rgba(255,255,255,.45)"/><path d="M11 17l1-1 1 1z" fill="' + c + '"/><path d="M12 17.4q-2 3 0 6.6" stroke="#cfcfcf" stroke-width=".8" fill="none"/>'); },
    bubble: function () { return S('<circle cx="12" cy="12" r="9" fill="rgba(160,225,255,.18)" stroke="rgba(200,240,255,.85)" stroke-width="1.3"/><ellipse cx="8.5" cy="8.5" rx="2.2" ry="1.4" fill="rgba(255,255,255,.7)" transform="rotate(-35 8.5 8.5)"/>'); },
    sun: function () { return S('<g stroke="#FFC93C" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g><circle cx="12" cy="12" r="5.2" fill="#FFD84D"/>'); },
    tie: function (c) { return S('<path d="M9.5 2h5l-1 3 3 12-4.5 5-4.5-5 3-12z" fill="' + c + '"/><path d="M9.5 2h5l-1 3h-3z" fill="rgba(0,0,0,.2)"/><path d="M11 9l4 2M10.5 13l4.5 2" stroke="rgba(255,255,255,.35)" stroke-width="1"/>'); },
    moon: function () { return S('<path d="M15 2a10 10 0 1 0 7 15.5A8 8 0 0 1 15 2z" fill="#FFE08A"/>'); },
    hat: function () { return S('<path d="M3 17c3-1 4-9 9-12 3-2 6 0 6 3 1 2 0 4-1 5L19 17z" fill="#D7262E"/><rect x="2" y="16" width="19" height="4" rx="2" fill="#fff"/><circle cx="19" cy="13" r="2.6" fill="#fff"/>'); },
    turkey: function () { return S('<g><path d="M12 13L4 6M12 13l-3-9M12 13l3-9M12 13l8-7" stroke-width="4" stroke-linecap="round" stroke="#C8571E"/></g><path d="M12 13L3 10M12 13l18-3" stroke="#E8A13B" stroke-width="4" stroke-linecap="round"/><ellipse cx="12" cy="16" rx="5" ry="5.5" fill="#8A4B22"/><circle cx="12" cy="10.5" r="3" fill="#8A4B22"/><circle cx="11" cy="10" r=".7" fill="#fff"/><path d="M12 11.5l2 .8-2 .6z" fill="#F6B042"/><path d="M12 12.6q-.8 1.6.4 2" stroke="#D7262E" stroke-width="1" fill="none"/>'); },
    gift: function () { return S('<rect x="3" y="9" width="18" height="12" rx="1.5" fill="#D7262E"/><rect x="2" y="6.5" width="20" height="4" rx="1.2" fill="#E8434A"/><rect x="10.5" y="6.5" width="3" height="14.5" fill="#F5C542"/><path d="M12 6.5C10 2 6 3 8 6.5M12 6.5c2-4.5 6-3.5 4 0" stroke="#F5C542" stroke-width="1.6" fill="none"/>'); }
  };

  /* ---------- Tính ngày ---------- */
  function nthWeekday(y, m, wd, n) {   // tháng m (0-11), thứ wd (0=CN), lần thứ n
    var x = new Date(y, m, 1), off = (wd - x.getDay() + 7) % 7;
    return new Date(y, m, 1 + off + (n - 1) * 7);
  }
  // Ngày Tết Nguyên Đán và Trung thu (âm lịch) đã tính sẵn
  var TET = { 2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08' };
  var MOON = { 2025: '10-06', 2026: '09-25', 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12', 2031: '10-01', 2032: '09-19', 2033: '09-08', 2034: '09-27', 2035: '09-16' };
  function fromTable(t, y) { var s = t[y]; if (!s) return null; var p = s.split('-'); return new Date(y, +p[0] - 1, +p[1]); }
  function day0(x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); }
  function around(base, before, after) {
    return function (now) { var b = base(now.getFullYear()); if (!b) return false; var t = day0(now), c = day0(b); return t >= c - before * 864e5 && t <= c + after * 864e5; };
  }
  function md(m1, d1, m2, d2) {   // khoảng ngày cố định trong năm (tháng 1-12), có thể vắt qua năm mới
    return function (now) {
      var v = (now.getMonth() + 1) * 100 + now.getDate(), a = m1 * 100 + d1, b = m2 * 100 + d2;
      return a <= b ? v >= a && v <= b : v >= a || v <= b;
    };
  }

  /* ---------- Danh sách chủ đề (ưu tiên từ trên xuống) ---------- */
  var T = [
    { id: 'tet', name: 'Tết Nguyên Đán', when: 'Từ 5 ngày trước đến mùng 7 Tết', greet: 'Chúc Mừng Năm Mới · An Khang Thịnh Vượng', accent: '#E0262B',
      fx: [['flower', '#FFD23F', '#E8761E'], ['flower', '#FF9EBB', '#FFE38A'], ['petal', '#FFD23F']], garland: ['#E0262B', '#F5C542'], badge: ['lantern'], hang: true,
      test: around(function (y) { return fromTable(TET, y); }, 5, 7) },
    { id: 'valentine', name: 'Valentine', when: '12/2 – 14/2', greet: 'Valentine ngọt ngào · Happy Valentine’s Day', accent: '#FF4D7E',
      fx: [['heart', '#FF4D7E'], ['heart', '#FF9EBB'], ['heart', '#E0262B']], badge: ['heart', '#FF4D7E'], test: md(2, 12, 2, 14) },
    { id: 'newyear', name: 'Năm mới', when: '30/12 – 2/1', greet: 'Chúc Mừng Năm Mới · Happy New Year', accent: '#F5C542',
      fx: [['spark', '#F5C542'], ['spark', '#FFFFFF'], ['star', '#7FD1FF'], ['balloon', '#B88CFF']], garland: ['#F5C542', '#7FD1FF', '#FF6FAE', '#FFFFFF'], badge: ['star', '#F5C542'], test: md(12, 30, 1, 2) },
    { id: 'noel', name: 'Giáng sinh', when: '10/12 – 26/12', greet: 'Giáng Sinh An Lành · Merry Christmas', accent: '#D7262E',
      fx: [['snow'], ['snow'], ['snow'], ['star', '#F5C542'], ['gift']], garland: ['#D7262E', '#2FA84F', '#F5C542', '#4FA3FF'], badge: ['hat'], test: md(12, 10, 12, 26) },
    { id: 'phunu83', name: 'Quốc tế Phụ nữ 8/3', when: '6/3 – 8/3', greet: 'Chúc mừng ngày Quốc tế Phụ nữ 8/3', accent: '#E8437A',
      fx: [['flower', '#FF6F9C', '#FFE38A'], ['petal', '#FF9EBB'], ['heart', '#E8437A']], badge: ['flower', '#FF6F9C'], test: md(3, 6, 3, 8) },
    { id: 'phunu2010', name: 'Phụ nữ Việt Nam 20/10', when: '18/10 – 20/10', greet: 'Chúc mừng ngày Phụ nữ Việt Nam 20/10', accent: '#E8437A',
      fx: [['flower', '#FF6F9C', '#FFE38A'], ['petal', '#E8437A'], ['heart', '#FF9EBB']], badge: ['flower', '#E8437A'], test: md(10, 18, 10, 20) },
    { id: 'thieunhi', name: 'Quốc tế Thiếu nhi 1/6', when: '30/5 – 1/6', greet: 'Chúc các bé ngày 1/6 thật vui!', accent: '#4FA3FF',
      fx: [['balloon', '#FF6F6F'], ['balloon', '#4FA3FF'], ['balloon', '#FFD23F'], ['balloon', '#4FCB7A'], ['star', '#FFD23F']], rise: true, garland: ['#FF6F6F', '#FFD23F', '#4FCB7A', '#4FA3FF'], badge: ['balloon', '#FF6F6F'], test: md(5, 30, 6, 1) },
    { id: 'me', name: 'Ngày của Mẹ', when: 'Chủ nhật thứ 2 tháng 5 (và 3 ngày trước)', greet: 'Ngày của Mẹ · Thương mẹ nhiều lắm', accent: '#F06C9B',
      fx: [['flower', '#F06C9B', '#FFF1A8'], ['heart', '#FF9EBB'], ['petal', '#F06C9B']], badge: ['heart', '#F06C9B'], test: around(function (y) { return nthWeekday(y, 4, 0, 2); }, 3, 0) },
    { id: 'cha', name: 'Ngày của Cha', when: 'Chủ nhật thứ 3 tháng 6 (và 3 ngày trước)', greet: 'Ngày của Cha · Cảm ơn bố', accent: '#3E7BD6',
      fx: [['tie', '#3E7BD6'], ['star', '#F5C542'], ['tie', '#1F4E9A']], badge: ['tie', '#3E7BD6'], test: around(function (y) { return nthWeekday(y, 5, 0, 3); }, 3, 0) },
    { id: 'trungthu', name: 'Trung thu', when: 'Rằm tháng 8 âm lịch (5 ngày trước)', greet: 'Trung Thu Đoàn Viên · Vui Tết Trăng Rằm', accent: '#F5A623',
      fx: [['lantern', '#F5A623', '#E0262B'], ['star', '#FFE08A'], ['lantern', '#E0262B', '#F5C542']], rise: true, garland: ['#F5A623', '#E0262B', '#FFE08A'], badge: ['moon'], hang: true,
      test: around(function (y) { return fromTable(MOON, y); }, 5, 1) },
    { id: 'halloween', name: 'Halloween', when: '25/10 – 31/10', greet: 'Happy Halloween · Đêm hội bí ngô', accent: '#F5821F',
      fx: [['pumpkin'], ['bat'], ['bat'], ['star', '#B88CFF']], garland: ['#F5821F', '#8A4FD8', '#7FD36A'], badge: ['pumpkin'], test: md(10, 25, 10, 31) },
    { id: 'thanksgiving', name: 'Lễ Tạ Ơn', when: 'Thứ 5 tuần thứ 4 tháng 11 (4 ngày trước)', greet: 'Happy Thanksgiving · Cảm ơn vì tất cả', accent: '#C8571E',
      fx: [['leaf', '#C8571E'], ['leaf', '#E8A13B'], ['leaf', '#8A4B22'], ['turkey']], badge: ['turkey'], test: around(function (y) { return nthWeekday(y, 10, 4, 4); }, 4, 1) },
    { id: 'sakura', name: 'Hoa anh đào', when: '20/3 – 15/4', greet: 'Mùa hoa anh đào', accent: '#F49AC1',
      fx: [['flower', '#FFC1D8', '#FFF1A8'], ['petal', '#FFC1D8'], ['petal', '#FFDCE8']], badge: ['flower', '#FFC1D8'], test: md(3, 20, 4, 15) },
    // Mùa: dùng khi không có ngày lễ
    { id: 'xuan', name: 'Mùa xuân', when: 'Tháng 3 – 5', greet: 'Mùa xuân tươi mới', accent: '#5CBF6A', season: true,
      fx: [['flower', '#FFD23F', '#E8761E'], ['petal', '#9BD77F'], ['flower', '#FF9EBB', '#FFE38A']], badge: ['flower', '#FFD23F'], test: md(3, 1, 5, 31) },
    { id: 'he', name: 'Mùa hè', when: 'Tháng 6 – 8', greet: 'Mùa hè rực rỡ', accent: '#FFB020', season: true,
      fx: [['bubble'], ['bubble'], ['sun']], rise: true, badge: ['sun'], test: md(6, 1, 8, 31) },
    { id: 'thu', name: 'Mùa thu', when: 'Tháng 9 – 11', greet: 'Mùa thu lá vàng', accent: '#E07B2A', season: true,
      fx: [['leaf', '#E07B2A'], ['leaf', '#F2B33D'], ['leaf', '#B5482A']], badge: ['leaf', '#E07B2A'], test: md(9, 1, 11, 30) },
    { id: 'dong', name: 'Mùa đông', when: 'Tháng 12 – 2', greet: 'Mùa đông ấm áp', accent: '#7FC6FF', season: true,
      fx: [['snow'], ['snow'], ['snow']], badge: ['snow'], test: md(12, 1, 2, 28) }
  ];
  function byId(id) { for (var i = 0; i < T.length; i++) if (T[i].id === id) return T[i]; return null; }
  function autoTheme(now) {
    now = now || new Date();
    for (var i = 0; i < T.length; i++) if (T[i].test(now)) return T[i];
    return null;
  }
  function mode() { return (w.APP_CONFIG && w.APP_CONFIG.SEASON) || 'auto'; }
  function current() {
    var m = mode();
    if (m === 'off') return null;
    if (m === 'auto') return autoTheme();
    return byId(m) || autoTheme();
  }

  function shape(spec) {
    var f = SH[spec[0]];
    return f ? f(spec[1], spec[2]) : '';
  }
  // Mức hiệu ứng rơi: off · low (ít, mặc định) · mid (vừa) · high (nhiều). Bản cũ lưu true/false
  function fxLevel() {
    var v = w.APP_CONFIG ? w.APP_CONFIG.SEASON_FX : 'low';
    if (v === false || v === 'off') return 'off';
    return v === 'mid' || v === 'high' ? v : 'low';
  }
  function isMobile() { return d.documentElement.classList.contains('mobile'); }

  /* ---------- Áp dụng lên giao diện ---------- */
  var applied = '';
  function apply(force) {
    var th = current(), lv = fxLevel(), fx = lv !== 'off';
    var key = (th ? th.id : 'none') + ':' + lv + ':' + isMobile();
    if (key === applied && !force) return th;
    applied = key;
    var html = d.documentElement;
    html.className = html.className.replace(/\bseason-\S+/g, '').replace(/\s+/g, ' ').trim();
    var old = d.getElementById('season'); if (old) old.parentNode.removeChild(old);
    var oldG = d.getElementById('sgarland'); if (oldG) oldG.parentNode.removeChild(oldG);
    [].slice.call(d.querySelectorAll('.sbadge')).forEach(function (x) { x.parentNode.removeChild(x); });
    var oldH = d.getElementById('shang'); if (oldH) oldH.parentNode.removeChild(oldH);
    if (!th) { html.style.removeProperty('--season'); bootTag(null); return null; }
    html.classList.add('season-on');
    html.classList.add('season-' + th.id);
    html.style.setProperty('--season', th.accent);
    var app = d.getElementById('app'), bar = d.getElementById('topbar');
    // hình nhỏ trên logo
    if (th.badge) [].slice.call(d.querySelectorAll('#topbar > .brand, #mhead .mlogo')).forEach(function (brand) {
      var b = d.createElement('div'); b.className = 'sbadge'; b.innerHTML = shape(th.badge); brand.appendChild(b);
    });
    // dây đèn dưới thanh trên cùng
    if (bar && th.garland) {
      var g = d.createElement('div'); g.id = 'sgarland';
      var n = isMobile() ? 14 : 34, html2 = '';
      for (var i = 0; i < n; i++) html2 += '<i style="background:' + th.garland[i % th.garland.length] + ';color:' + th.garland[i % th.garland.length] + ';animation-delay:' + (i % 3) * 0.5 + 's"></i>';
      g.innerHTML = html2; bar.appendChild(g);
    }
    // lồng đèn treo (Tết, Trung thu)
    if (th.hang && app && !isMobile()) {
      var h = d.createElement('div'); h.id = 'shang';
      h.innerHTML = '<div class="sh l">' + shape(['lantern', th.id === 'tet' ? '#E0262B' : '#F5A623', '#F5C542']) + '</div><div class="sh r">' + shape(['lantern', '#E0262B', '#F5C542']) + '</div>';
      app.appendChild(h);
    }
    // hạt rơi / bay lên
    if (fx && app && th.fx) {
      var o = d.createElement('div'); o.id = 'season'; if (th.rise) o.className = 'rise';
      var cnt = ({ low: isMobile() ? 4 : 8, mid: isMobile() ? 9 : 18, high: isMobile() ? 16 : 32 })[lv] || 4, out = '';
      for (var k = 0; k < cnt; k++) {
        var sz = Math.round((isMobile() ? 14 : 26) + Math.random() * (isMobile() ? 12 : 26));
        var dur = (11 + Math.random() * 10).toFixed(1), del = (-Math.random() * 20).toFixed(1);
        out += '<div class="sp" style="left:' + (Math.random() * 98).toFixed(1) + '%;width:' + sz + 'px;height:' + sz + 'px;animation-duration:' + dur + 's;animation-delay:' + del + 's">' +
          '<div class="spi" style="animation-duration:' + (2.6 + Math.random() * 2.5).toFixed(1) + 's;animation-delay:' + del + 's">' + shape(th.fx[k % th.fx.length]) + '</div></div>';
      }
      o.innerHTML = out; app.appendChild(o);
    }
    bootTag(th);
    return th;
  }
  // Màn hình khởi động: thay dòng giới thiệu bằng lời chúc của dịp lễ
  function bootTag(th) {
    var t = d.querySelector('#boot .btag span');
    if (!t) return;
    var txt = th ? th.greet : 'Phim ngắn · Ngọt sủng · Báo thù';
    if (!th) { t.textContent = txt; t.parentNode.classList.remove('fx'); return; }
    // Từng chữ bay lên lần lượt, sau đó làn sáng chạy qua từ trái sang phải (lặp lại)
    var html = '', n = 0;
    txt.split(' ').forEach(function (word, wi) {
      if (word === '·') { html += '<span class="bdot"> · </span>'; n += 2; return; }   // điện thoại: xuống dòng ở dấu chấm giữa
      if (wi) { html += ' '; n++; }
      html += '<span class="bw">';
      (Array.from ? Array.from(word) : word.split('')).forEach(function (ch) {
        var dl = (0.9 + n * 0.06).toFixed(2), sh = (2.2 + n * 0.08).toFixed(2);
        html += '<em style="animation-delay:' + dl + 's,' + sh + 's">' + ch.replace(/[<&>]/g, '') + '</em>';
        n++;
      });
      html += '</span>';
    });
    var bs = th.badge || (th.fx && th.fx[0]), ic = bs ? '<span class="bico">' + shape(bs) + '</span>' : '';
    t.innerHTML = ic + html + ic;
    t.parentNode.classList.add('fx');
  }
  // Lời chào một lần mỗi ngày (sau màn hình khởi động)
  function greetOnce() {
    var th = current();
    if (!th || th.season || !w.Store || !w.UI) return;
    var k = w.Store.dayKey ? w.Store.dayKey() : '';
    if (w.Store.pref('seasonGreet', '') === th.id + k) return;
    w.Store.setPref('seasonGreet', th.id + k);
    w.UI.toast(th.greet);
  }

  setInterval(function () { apply(false); }, 30 * 60e3);   // qua ngày mới thì tự đổi
  w.addEventListener('resize', function () { setTimeout(function () { apply(false); }, 400); });

  w.Season = {
    list: function () { return T; }, byId: byId, auto: autoTheme, current: current, apply: apply, greetOnce: greetOnce,
    icon: function (th) { return th && th.badge ? shape(th.badge) : ''; }
  };
})(window);
