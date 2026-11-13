/* Huy hiệu thành tích: 12 huy hiệu vàng · bạc · đồng, riêng từng hồ sơ, đồng bộ qua Google (khóa "badges").
   Dữ liệu: { <hồ sơ>: { u: {mã huy hiệu: lúc mở khóa}, c: {bộ đếm}, sd: {ngày: phút cuối dùng app buổi tối}, w: {k: tuần, n: {bộ đếm tuần}} } } */
(function (w) {
  'use strict';
  var Store = w.Store, K = 'badges';
  var I = {
    music: '<path d="M9 18V6l10-2v12" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6.5" cy="18" r="2.6"/><circle cx="16.5" cy="16" r="2.6"/>',
    ear: '<path d="M12 3a6 6 0 0 0-6 6c0 3 2 4 2 6s1 4 3.5 4 3-2 3-3 3-2 3.5-6A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="9.5" r="2"/>',
    quote: '<path d="M5 17l2-5H5V7h5v5l-2 5zm9 0l2-5h-2V7h5v5l-2 5z"/>',
    clock: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    heart: '<path d="M12 20s-7-4.3-8.8-8.6C1.9 8.1 4 4.8 7.3 4.8c1.9 0 3.3 1 4.7 2.8 1.4-1.8 2.8-2.8 4.7-2.8 3.3 0 5.4 3.3 4.1 6.6C19 15.7 12 20 12 20z"/>',
    film: '<rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 9h16M4 15h16M8 5v4M12 5v4M16 5v4M8 15v4M12 15v4M16 15v4" stroke="currentColor" stroke-width="1.6"/>',
    mail: '<rect x="3.5" y="6" width="17" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="2.2"/>',
    vote: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11l2-7h5l-1 7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 8l2 2 4-4" fill="none" stroke="currentColor" stroke-width="2"/>',
    cake: '<rect x="4" y="12" width="16" height="8" rx="2"/><path d="M12 5v5M8 7v3M16 7v3" stroke="currentColor" stroke-width="2"/>',
    fire: '<path d="M12 21c-4 0-7-2.8-7-6.6 0-3.2 2.4-5.2 3.4-8 .8 2 2 2.8 2.6 2.8C11 6.5 12 4 14 2c0 3 5 6 5 12 0 4-3 7-7 7z"/>',
    crown: '<path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5z"/>'
  };
  // t: g = vàng, s = bạc, b = đồng
  var DEF = [
    { id: 'song', n: 'Thánh đoán nhạc', d: 'Đoán đúng 10 bài hát', full: 'Đoán đúng 10 bài hát trong “Đoán tên bài hát”', t: 'g', ic: 'music', need: 10, c: 'songok', unit: 'bài', q: 'Tai em thính thật. Tôi hát bài nào em cũng biết.' },
    { id: 'ear', n: 'Tai nghe tổng tài', d: 'Đúng cả 10 câu trong 1 lượt', full: 'Đoán đúng cả 10 bài trong một lượt “Đoán tên bài hát”', t: 's', ic: 'ear', need: 1, c: 'sp', unit: 'lượt', q: 'Mười câu, mười lần đúng. Tôi bắt đầu thấy sợ em rồi đấy.' },
    { id: 'quote', n: 'Bậc thầy câu thoại', d: '100 điểm Câu đố tổng tài', full: 'Ghi đủ 100 điểm trong “Câu đố tổng tài”', t: 'g', ic: 'quote', need: 100, c: 'qpts', unit: 'điểm', q: 'Câu thoại của tôi, em thuộc còn hơn cả tôi.' },
    { id: 'ontime', n: 'Xem đúng giờ', d: '7 ngày liền trong giờ cho phép', full: '7 ngày xem phim liền nhau, ngày nào cũng trong giờ cho phép', t: 'g', ic: 'clock', need: 7, c: 'ot', unit: 'ngày', q: 'Biết giữ lời với chính mình. Tôi thích người như vậy.' },
    { id: 'sleep', n: 'Ngủ sớm', d: 'Tắt TV trước giờ ngủ 5 lần', full: 'Tắt TV trước giờ ngủ 5 tối', t: 's', ic: 'moon', need: 5, c: 'sl', unit: 'lần', q: 'Ngủ sớm đi. Mai tôi còn muốn thấy em tươi tỉnh.' },
    { id: 'fan', n: 'Fan cứng', d: 'Thả tim 20 phim', full: 'Thêm 20 phim vào danh sách yêu thích', t: 's', ic: 'heart', need: 20, c: 'fav', unit: 'phim', q: 'Thích nhiều phim vậy, nhưng nhớ chỉ thích một tổng tài thôi.' },
    { id: 'film', n: 'Mọt phim', d: 'Xem hết 10 phim', full: 'Xem hết 10 phim (tới đoạn cuối)', t: 'b', ic: 'film', need: 10, c: 'fin', unit: 'phim', q: 'Mười bộ phim. Em xem phim còn chăm hơn tôi họp.' },
    { id: 'mail', n: 'Người đưa thư', d: 'Gửi 5 lời nhắn', full: 'Gửi 5 lời nhắn phim cho người nhà', t: 's', ic: 'mail', need: 5, c: 'msg', unit: 'lời nhắn', q: 'Lời nhắn của em, cả nhà đều chờ đọc.' },
    { id: 'vote', n: 'Cổ đông bình chọn', d: 'Bình chọn phim 5 lần', full: 'Tham gia Cả nhà bình chọn phim 5 lần', t: 'b', ic: 'vote', need: 5, c: 'vote', unit: 'lần', q: 'Một phiếu của em, nặng hơn cả hội đồng quản trị.' },
    { id: 'bday', n: 'Sinh nhật vui vẻ', d: 'Mở app đúng ngày sinh nhật', full: 'Mở app đúng ngày sinh nhật của hồ sơ', t: 'b', ic: 'cake', need: 1, c: 'bd', unit: 'lần', q: 'Hôm nay cả thành phố này chúc mừng em.' },
    { id: 'streak', n: 'Chuỗi 30 ngày', d: 'Mở app 30 ngày liền', full: 'Mở app 30 ngày liền, không bỏ ngày nào', t: 'g', ic: 'fire', need: 30, c: 'best', cur: 'st', unit: 'ngày', q: 'Ba mươi ngày không vắng mặt. Em giữ lời giỏi hơn tôi.' },
    { id: 'boss', n: 'Tổng tài nhà mình', d: 'Có đủ 10 huy hiệu', full: 'Mở khóa đủ 10 huy hiệu khác', t: 'g', ic: 'crown', need: 10, unit: 'huy hiệu', q: 'Từ hôm nay, tổng tài của nhà này là em.' }
  ];
  var BY = {}; DEF.forEach(function (b) { BY[b.id] = b; });
  // Thử thách tuần: đổi mỗi tuần, đếm từ thứ Hai
  var WEEK = [
    { k: 'sl', need: 5, t: 'Ngủ sớm 5 tối', d: function () { return 'Tắt TV trước ' + bedText() + ' tối. Ai làm được có dấu ✓ trên bảng thi đua.'; } },
    { k: 'songok', need: 8, t: 'Đoán đúng 8 bài hát', d: function () { return 'Chơi “Đoán tên bài hát” (nút ♪ cạnh Câu đố). Ai làm được có dấu ✓.'; } },
    { k: 'msg', need: 3, t: 'Gửi 3 lời nhắn', d: function () { return 'Trang phim → ✉ Gửi cho… một người trong nhà. Ai làm được có dấu ✓.'; } },
    { k: 'qpts', need: 50, t: '50 điểm Câu đố', d: function () { return 'Chơi “Câu đố tổng tài”, mỗi câu đúng +10 điểm. Ai làm được có dấu ✓.'; } },
    { k: 'open', need: 6, t: 'Mở app 6 ngày trong tuần', d: function () { return 'Ghé app 6 ngày khác nhau trong tuần này. Ai làm được có dấu ✓.'; } },
    { k: 'favw', need: 3, t: 'Thả tim 3 phim', d: function () { return 'Thêm 3 phim vào danh sách yêu thích. Ai làm được có dấu ✓.'; } }
  ];
  var limOf = function () { return null; }, onUnlock = null, queue = [];

  function all() { return Store.raw(K, {}) || {}; }
  function save(m) { Store.applyRaw(K, m); if (w.Sync && w.Sync.dirty) w.Sync.dirty(K); }
  function rec(m, pid) { var r = m[pid] = m[pid] || {}; r.u = r.u || {}; r.c = r.c || {}; r.sd = r.sd || {}; return r; }
  function dk(t) { return Store.dayKey(t); }
  function weekKey(t) { var x = new Date(t || Date.now()); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return dk(x.getTime()); }
  function weekIdx() { var x = new Date(weekKey() + 'T00:00:00'); return Math.floor(x.getTime() / (7 * 864e5)); }
  function challenge() { return WEEK[((weekIdx() % WEEK.length) + WEEK.length) % WEEK.length]; }
  function wk(r) { var k = weekKey(); if (!r.w || r.w.k !== k) r.w = { k: k, n: {} }; return r.w; }
  function bedText() { var b = (w.Settings && w.Settings.get && w.Settings.get('SLEEP_AT')) || '21:00'; return b; }
  function bedMin() { var p = /^(\d{1,2}):(\d{2})$/.exec(bedText()) || [0, 21, 0]; return +p[1] * 60 + +p[2]; }

  function bump(r, key, n) { r.c[key] = (r.c[key] || 0) + n; var x = wk(r); x.n[key] = (x.n[key] || 0) + n; }
  // các số tính từ dữ liệu sẵn có (danh sách yêu thích, phim đã xem hết, ngày xem đúng giờ)
  function derive(r, pid) {
    try {
      Store.as(pid, function () {
        r.c.fav = Math.max(r.c.fav || 0, Store.favs().length);
        var prog = Store.raw(pid === 'guest' ? 'prog' : 'prog@' + pid, {}) || {}, fin = 0;
        Object.keys(prog).forEach(function (id) { if (Store.isWatched(id)) fin++; });
        r.c.fin = Math.max(r.c.fin || 0, fin);
      });
      var st = Store.stats(pid) || {}, lim = limOf(pid), n = 0, now = Date.now();
      for (var i = 0; i < 40; i++) {
        var t = now - i * 864e5, k = dk(t), s = ((st[k] || {}).s || 0);
        if (s <= 0) continue;   // ngày không xem: không tính, cũng không làm đứt chuỗi
        var dw = new Date(t).getDay(), L = lim ? (dw === 0 || dw === 6 ? lim.we : lim.wd) : 0;
        if (L && s / 60 > L + 1) break;
        n++;
      }
      r.c.ot = Math.max(r.c.ot || 0, n); r.c.otNow = n;
    } catch (e) { /* bỏ qua */ }
  }
  function cur(r, b) {
    if (b.id === 'boss') return Object.keys(r.u).filter(function (k) { return k !== 'boss' && BY[k]; }).length;
    if (b.id === 'ontime') return r.u.ontime ? (r.c.ot || 0) : (r.c.otNow || 0);
    return r.c[b.cur || b.c] || 0;
  }
  function check(pid, m) {
    pid = pid || Store.profile();
    var own = !m; m = m || all();
    var before = own ? JSON.stringify(m[pid] || null) : '';
    var r = rec(m, pid), got = [];
    derive(r, pid);
    for (var pass = 0; pass < 2; pass++) {   // lần 2: huy hiệu "Tổng tài nhà mình"
      DEF.forEach(function (b) {
        var have = b.id === 'streak' ? Math.max(r.c.best || 0, r.c.st || 0) : b.id === 'ontime' ? (r.c.ot || 0) : cur(r, b);
        if (!r.u[b.id] && have >= b.need) { r.u[b.id] = Date.now(); got.push(b); }
      });
    }
    if (own && JSON.stringify(m[pid]) !== before) save(m);
    if (got.length && pid === Store.profile()) {
      got.forEach(function (b) { queue.push({ pid: pid, b: b }); });
      if (onUnlock) setTimeout(onUnlock, 300);
    }
    return got;
  }
  function add(key, n, pid) {
    pid = pid || Store.profile();
    var m = all(), r = rec(m, pid);
    bump(r, key, n == null ? 1 : n);
    check(pid, m); save(m);
  }
  // mở app / đổi hồ sơ: chuỗi ngày, ngủ sớm của những tối trước, sinh nhật
  function open(pid, isBday) {
    pid = pid || Store.profile();
    var m = all(), r = rec(m, pid), today = dk();
    if (r.c.last !== today) {
      var y = dk(Date.now() - 864e5);
      r.c.st = r.c.last === y ? (r.c.st || 0) + 1 : 1;
      r.c.best = Math.max(r.c.best || 0, r.c.st);
      r.c.last = today;
      bump(r, 'open', 1);
    }
    var bm = bedMin();
    Object.keys(r.sd).forEach(function (day) {
      if (day >= today) return;
      if (r.sd[day] < bm) { r.c.sl = (r.c.sl || 0) + 1; if (weekKey(new Date(day + 'T12:00:00').getTime()) === weekKey()) { var x = wk(r); x.n.sl = (x.n.sl || 0) + 1; } }
      delete r.sd[day];
    });
    if (isBday && r.c.bdDay !== today) { r.c.bdDay = today; bump(r, 'bd', 1); }
    check(pid, m); save(m);
  }
  // mỗi phút khi app đang bật: nhớ phút cuối dùng app buổi tối (để tính "Ngủ sớm")
  function tick() {
    try {
      if (document.hidden) return;
      var n = new Date(), mm = n.getHours() * 60 + n.getMinutes();
      if (n.getHours() < 17) return;
      var m = all(), r = rec(m, Store.profile()), k = dk();
      if (r.sd[k] === mm) return;
      r.sd[k] = mm; Store.applyRaw(K, m);   // không cần đồng bộ ngay
    } catch (e) { /* bỏ qua */ }
  }
  setInterval(tick, 60000);

  function list(pid) {
    pid = pid || Store.profile();
    var m = all(), r = rec(m, pid); derive(r, pid);
    return DEF.map(function (b) { var c = b.id === 'streak' ? (r.u.streak ? b.need : r.c.st || 0) : cur(r, b); return { b: b, got: r.u[b.id] || 0, cur: Math.min(c, b.need), need: b.need }; });
  }
  function count(pid) { var r = all()[pid]; return r && r.u ? Object.keys(r.u).filter(function (k) { return BY[k]; }).length : 0; }
  function newest(pid) {
    var r = all()[pid]; if (!r || !r.u) return null;
    var k = Object.keys(r.u).filter(function (x) { return BY[x]; }).sort(function (a, b) { return r.u[b] - r.u[a]; })[0];
    return k ? { b: BY[k], at: r.u[k] } : null;
  }
  function weekN(pid, key) { var r = all()[pid]; return r && r.w && r.w.k === weekKey() ? (r.w.n[key] || 0) : 0; }

  // gộp khi đồng bộ: huy hiệu lấy lần mở khóa sớm nhất, bộ đếm lấy số lớn hơn
  function merge(a, b) {
    var o = {};
    [a || {}, b || {}].forEach(function (src) {
      Object.keys(src).forEach(function (pid) {
        var x = src[pid] || {}, r = o[pid] = o[pid] || { u: {}, c: {}, sd: {} };
        Object.keys(x.u || {}).forEach(function (k) { if (!r.u[k] || x.u[k] < r.u[k]) r.u[k] = x.u[k]; });
        var xc = x.c || {};
        Object.keys(xc).forEach(function (k) {
          if (k === 'last' || k === 'st' || k === 'bdDay') return;
          if (typeof xc[k] === 'number') r.c[k] = Math.max(r.c[k] || 0, xc[k]);
        });
        if (xc.last && (!r.c.last || xc.last > r.c.last || (xc.last === r.c.last && (xc.st || 0) > (r.c.st || 0)))) { r.c.last = xc.last; r.c.st = xc.st || 0; }
        if (xc.bdDay && (!r.c.bdDay || xc.bdDay > r.c.bdDay)) r.c.bdDay = xc.bdDay;
        Object.keys(x.sd || {}).forEach(function (k) { r.sd[k] = Math.max(r.sd[k] || 0, x.sd[k]); });
        if (x.w && x.w.k) {
          if (!r.w || x.w.k > r.w.k) r.w = JSON.parse(JSON.stringify(x.w));
          else if (x.w.k === r.w.k) Object.keys(x.w.n || {}).forEach(function (k) { r.w.n[k] = Math.max(r.w.n[k] || 0, x.w.n[k]); });
        }
      });
    });
    return o;
  }
  function icon(id) { return I[(BY[id] || {}).ic] || ''; }
  function medal(id, size, locked) {
    var b = BY[id] || DEF[0], d = document, s = size || 96;
    var wrap = d.createElement('div'); wrap.className = 'bmed ' + (locked ? 'lock' : 't' + b.t); wrap.style.width = s + 'px'; wrap.style.height = Math.round(s * 1.15) + 'px';
    if (!locked) { var rb = d.createElement('div'); rb.className = 'bmrib'; rb.style.width = Math.round(s / 2) + 'px'; rb.style.height = Math.round(s * 0.42) + 'px'; rb.style.top = Math.round(s * 0.78) + 'px'; wrap.appendChild(rb); }
    var c = d.createElement('div'); c.className = 'bmc'; c.style.width = c.style.height = s + 'px';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="' + Math.round(s * 0.46) + '" height="' + Math.round(s * 0.46) + '" fill="currentColor">' + icon(b.id) + '</svg>';
    wrap.appendChild(c);
    return wrap;
  }

  w.Badges = {
    DEF: DEF, by: function (id) { return BY[id]; }, add: add, open: open, check: check, list: list, count: count, newest: newest,
    challenge: challenge, weekN: weekN, weekKey: weekKey, merge: merge, medal: medal, bedText: bedText,
    next: function () { return queue.shift() || null; }, pending: function () { return queue.length; },
    setup: function (o) { if (o.limOf) limOf = o.limOf; if (o.onUnlock) onUnlock = o.onUnlock; }
  };
})(window);
