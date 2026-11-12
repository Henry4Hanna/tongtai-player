/* Gửi số liệu dùng app về máy chủ của phụ huynh (Cloudflare Worker), để xem ở trang quản trị.
   Chỉ chạy khi đã điền STATS_URL. Gửi: mã thiết bị (ngẫu nhiên), loại máy, hồ sơ đang dùng, trang đang mở,
   phim đang xem và thời gian xem, đơn vị YouTube đã dùng, từ khóa tìm. Địa chỉ IP và thành phố do máy chủ tự thấy. */
(function (w, d) {
  'use strict';
  var BEAT_MS = 60000;
  var queue = [], watchAcc = {}, units = { search: 0, other: 0 }, queries = [], rates = [], lastBeat = Date.now(), activeMs = 0, lastTick = Date.now();
  var blocked = false, started = false, lastProfile = '';

  function C() { return w.APP_CONFIG || {}; }
  function base() { var u = String((w.Settings && w.Settings.get('STATS_URL')) || C().STATS_URL || '').trim(); return u.replace(/\/+$/, ''); }
  function devId() {
    var k = 'tt.devid', v = '';
    try { v = localStorage.getItem(k) || ''; } catch (e) { /* bỏ qua */ }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
      v = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(k, v); } catch (e) { /* bỏ qua */ }
    }
    return v;
  }
  function kind() {
    var ua = navigator.userAgent || '';
    if (w.tizen || /Tizen/i.test(ua)) return { k: 'tv-samsung', l: 'TV Samsung' };
    if (w.AndroidApp) return { k: 'tv-android', l: 'Android TV' };
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return { k: 'tablet', l: 'iPad' };
    if (/iPhone/.test(ua)) return { k: 'phone', l: 'iPhone' };
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? { k: 'phone', l: 'Điện thoại Android' } : { k: 'tablet', l: 'Máy tính bảng Android' };
    var br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Trình duyệt';
    var os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
    return { k: 'desktop', l: br + (os ? ' trên ' + os : '') };
  }
  function screen() { try { var c = w.Screens && w.Screens.current(); return c ? c.name : ''; } catch (e) { return ''; } }
  function prof() {
    try { return { p: w.Store.profile(), pn: w.Store.profileName() }; } catch (e) { return { p: '', pn: '' }; }
  }
  function playing() {
    try {
      if (w.Player && w.Player.isOpen && w.Player.isOpen()) return 'film';
      if (w.Music && w.Music.S && w.Music.S.isPlaying && w.Music.S.isPlaying()) return 'music';
    } catch (e) { /* bỏ qua */ }
    return '';
  }
  function visible() { return !d.hidden && !(w.Saver && w.Saver.isOn && w.Saver.isOn()) || playing() === 'film'; }

  function event(t, extra) {
    var p = prof(), e = { t: t, ts: Date.now(), p: p.p, pn: p.pn, s: screen() };
    for (var k in extra) if (extra.hasOwnProperty(k)) e[k] = extra[k];
    queue.push(e);
    if (queue.length > 60) queue.splice(0, queue.length - 60);
  }

  function send(beacon) {
    var u = base();
    if (!u || !queue.length) return;
    var info = kind();
    info.v = C().VERSION || '';
    info.ua = (navigator.userAgent || '').slice(0, 300);
    var body = JSON.stringify({ d: devId(), i: info, e: queue });
    var sent = queue; queue = [];
    if (beacon && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(u + '/t', body)) return; } catch (e) { /* thử cách thường */ }
    }
    var x = new XMLHttpRequest();
    x.open('POST', u + '/t', true);
    x.setRequestHeader('Content-Type', 'text/plain');   // tránh hỏi trước (CORS preflight)
    x.timeout = 15000;
    x.onload = function () {
      try {
        var r = JSON.parse(x.responseText || '{}');
        if (r.blocked && !blocked) { blocked = true; showBlocked(); }
        if (r.q != null && w.Api && w.Api.famSet) w.Api.famSet(r.q);   // tổng đơn vị cả nhà hôm nay → tiết kiệm tự động
      } catch (e) { /* bỏ qua */ }
    };
    x.onerror = x.ontimeout = function () { queue = sent.concat(queue).slice(-60); };   // mất mạng: gửi lại lần sau
    x.send(body);
  }

  function beat(force) {
    var now = Date.now();
    if (!force && now - lastBeat < BEAT_MS) return;
    var w_ = [];
    for (var id in watchAcc) if (watchAcc.hasOwnProperty(id)) { var a = watchAcc[id]; if (a.s > 0) w_.push(a); }
    watchAcc = {};
    var hasUse = activeMs > 1000 || w_.length || units.search || units.other || queries.length || rates.length;
    if (hasUse) {
      event('hb', { a: Math.round(activeMs / 1000), w: w_, pl: playing() === 'film', f: curFilm(), u: { search: units.search, other: units.other }, q: queries.slice(0, 10), r: rates.slice(0, 20) });
      units = { search: 0, other: 0 }; queries = []; rates = [];
    }
    activeMs = 0; lastBeat = now;
    send(false);
  }
  var lastFilm = null;
  function curFilm() { return lastFilm ? { id: lastFilm.id, t: lastFilm.t } : null; }

  function tick() {
    var now = Date.now();
    if (visible()) activeMs += Math.min(5000, now - lastTick);
    lastTick = now;
    var p = prof().p;
    if (started && p && p !== lastProfile) { lastProfile = p; event('open', { why: 'profile' }); send(false); }
    beat(false);
  }

  function showBlocked() {
    var o = d.createElement('div');
    o.id = 'blocked';
    o.style.cssText = 'position:fixed;inset:0;z-index:200000;background:#0b0d12;color:#F4F1EC;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:inherit;padding:40px';
    o.innerHTML = '<div style="font-size:2.2em;font-weight:800;margin-bottom:14px">Thiết bị này đã bị tạm khóa</div><div style="font-size:1.2em;opacity:.8;max-width:900px;line-height:1.5">Người quản trị Tổng Tài TV đã tạm khóa thiết bị này. Hãy liên hệ người quản trị để mở lại.</div>';
    d.body.appendChild(o);
    try { if (w.Player && w.Player.close) w.Player.close(); } catch (e) { /* bỏ qua */ }
  }


  // SHA-256 (chạy cả trên TV cũ, không cần crypto.subtle) — để so email quản trị mà không ghi email thật trong mã
  function sha256(str) {
    var K = [], H = [], i, j, n = 2;
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    for (i = 0; i < 64; n++) { for (j = 2; j * j <= n; j++) if (n % j === 0) break; if (j * j > n) { if (i < 8) H[i] = frac(Math.pow(n, 1 / 2)); K[i++] = frac(Math.pow(n, 1 / 3)); } }
    var b = unescape(encodeURIComponent(str)), words = [], L = b.length * 8;
    for (i = 0; i < b.length; i++) words[i >> 2] |= b.charCodeAt(i) << (24 - (i % 4) * 8);
    words[L >> 5] |= 0x80 << (24 - L % 32);
    words[(((L + 64) >> 9) << 4) + 15] = L;
    function r(x, c) { return (x >>> c) | (x << (32 - c)); }
    for (i = 0; i < words.length; i += 16) {
      var W = [], a = H[0], bb = H[1], c = H[2], dd = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (j = 0; j < 64; j++) {
        if (j < 16) W[j] = words[i + j] | 0;
        else W[j] = (r(W[j - 2], 17) ^ r(W[j - 2], 19) ^ (W[j - 2] >>> 10)) + W[j - 7] + (r(W[j - 15], 7) ^ r(W[j - 15], 18) ^ (W[j - 15] >>> 3)) + W[j - 16] | 0;
        var t1 = h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[j] + W[j] | 0;
        var t2 = (r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c)) | 0;
        h = g; g = f; f = e; e = dd + t1 | 0; dd = c; c = bb; bb = a; a = t1 + t2 | 0;
      }
      H[0] = H[0] + a | 0; H[1] = H[1] + bb | 0; H[2] = H[2] + c | 0; H[3] = H[3] + dd | 0; H[4] = H[4] + e | 0; H[5] = H[5] + f | 0; H[6] = H[6] + g | 0; H[7] = H[7] + h | 0;
    }
    var out = '';
    for (i = 0; i < 8; i++) out += ('00000000' + (H[i] >>> 0).toString(16)).slice(-8);
    return out;
  }
  // email đang đồng bộ Google có nằm trong danh sách quản trị không (chỉ để hiện/ẩn mục; quyền thật do máy chủ kiểm tra)
  function adminEmail() {
    var st = w.Sync && w.Sync.status ? w.Sync.status() : null, em = st && st.google ? String(st.email || '').trim().toLowerCase() : '';
    var list = (w.APP_CONFIG || {}).ADMIN_HASHES || [];
    return em && list.indexOf(sha256(em)) >= 0 ? em : '';
  }
  function adminPage() {
    var C2 = w.APP_CONFIG || {};
    if (/^https?:/.test(w.location.protocol) && !w.AndroidApp && !w.tizen) return w.location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '') + 'admin.html';
    return String(C2.ADMIN_PAGE || '');
  }

  var T = {
    on: function () { return !!base(); },
    // gọi từ api.js mỗi lần gọi YouTube thành công
    units: function (path) { if (!base()) return; if (path === 'search') units.search++; else units.other++; },
    // gọi từ player.js mỗi khi cộng dồn thời gian xem
    watch: function (secs, item, pos, dur) {
      if (!base() || !(secs > 0) || !item) return;
      var id = String(item.id || item.vid || item.title || '').slice(0, 40);
      lastFilm = { id: id, t: item.title || '' };
      var a = watchAcc[id] || (watchAcc[id] = { id: id, t: String(item.title || '').slice(0, 160), c: String(item.ch || '').slice(0, 80), s: 0, pos: 0, dur: 0 });
      a.s = Math.round((a.s + secs) * 10) / 10; a.pos = Math.round(pos || 0); a.dur = Math.round(dur || 0);
    },
    search: function (q) { if (base() && q) queries.push(String(q).slice(0, 80)); },
    rate: function (item, r) { if (base() && item && item.id) { rates.push({ id: String(item.id).slice(0, 40), t: String(item.title || '').slice(0, 160), c: String(item.ch || '').slice(0, 80), r: r }); beat(true); } },
    flush: function () { beat(true); },
    id: devId,
    sha256: sha256, adminEmail: adminEmail, adminPage: adminPage
  };
  w.Tele = T;

  function start() {
    if (started) return;
    started = true;
    lastProfile = prof().p;
    event('open', { why: 'start' });
    send(false);
  }
  // bắt đầu sau khi app đã mở (hết màn hình khởi động)
  var wait = setInterval(function () {
    if (!base()) return;
    if (d.getElementById('boot')) return;
    clearInterval(wait); start();
  }, 2000);
  setInterval(function () { if (base() && started) tick(); }, 5000);
  d.addEventListener('visibilitychange', function () { if (d.hidden && base() && started) { beat(true); } });
  w.addEventListener('pagehide', function () { if (base() && started) { beat(true); send(true); } });
  // từ khóa tìm kiếm: bắt từ Store.addSearch
  var hook = setInterval(function () {
    if (!w.Store || !w.Store.addSearch || w.Store.addSearch.__tele) return;
    var orig = w.Store.addSearch;
    w.Store.addSearch = function (q) { T.search(q); return orig.apply(this, arguments); };
    w.Store.addSearch.__tele = true;
    clearInterval(hook);
  }, 500);
})(window, document);
