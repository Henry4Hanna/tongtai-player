/* Lưu lịch sử xem, tiến độ, danh sách yêu thích, cache. Dùng localStorage trên TV. */
(function (w) {
  'use strict';
  var P = 'tt.';

  function get(k, d) {
    try {
      var v = w.localStorage.getItem(P + k);
      return v ? JSON.parse(v) : d;
    } catch (e) { return d; }
  }
  // Dữ liệu được đồng bộ qua tài khoản Google (nếu đăng nhập)
  var SYNC_KEYS = { prog: 1, recent: 1, favs: 1, blocked: 1, prefs: 1 };
  // Dữ liệu RIÊNG của từng hồ sơ người xem. Hồ sơ "guest" dùng khóa gốc (dữ liệu cũ thuộc về Guest).
  var PER_PROFILE = { prog: 1, recent: 1, favs: 1, sq: 1, stats: 1 };
  var prof = 'guest';
  try { prof = w.localStorage.getItem(P + 'profile') || 'guest'; } catch (e) { /* bỏ qua */ }
  function pk(k) { return PER_PROFILE[k] && prof !== 'guest' ? k + '@' + prof : k; }
  function stampsKey(suffix) { return suffix ? 'stamps@' + suffix : 'stamps'; }
  var applying = false;
  function set(k, v) {
    try { w.localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* đầy bộ nhớ: bỏ qua */ }
    var at = k.indexOf('@'), base = at > 0 ? k.slice(0, at) : k, suffix = at > 0 ? k.slice(at + 1) : '';
    if (SYNC_KEYS[base] && !applying) {
      var sk = stampsKey(suffix), st = get(sk, {});
      st[base] = Date.now();
      try { w.localStorage.setItem(P + sk, JSON.stringify(st)); } catch (e) { /* bỏ qua */ }
      if (w.Sync && w.Sync.dirty) w.Sync.dirty(k);
    }
  }
  // Đọc/ghi dữ liệu của hồ sơ đang xem
  function pget(k, d) { return get(pk(k), d); }
  function pset(k, v) { set(pk(k), v); }
  function curStamps() { return stampsKey(prof === 'guest' ? '' : prof); }

  var Store = {
    getProgress: function (id) {
      var m = pget('prog', {});
      return m[id] || null;
    },
    setProgress: function (id, p, d) {
      var m = pget('prog', {});
      m[id] = { p: Math.floor(p || 0), d: Math.floor(d || 0), t: Date.now() };
      var keys = Object.keys(m);
      if (keys.length > 300) {
        keys.sort(function (a, b) { return m[a].t - m[b].t; });
        keys.slice(0, keys.length - 300).forEach(function (k) { delete m[k]; });
      }
      pset('prog', m);
    },

    // Đã xem hết: xem tới 92% hoặc còn dưới 90 giây
    isWatched: function (id) {
      var p = pget('prog', {})[id];
      return !!(p && p.d > 0 && (p.p >= p.d - 90 || p.p / p.d >= 0.92));
    },
    // Đánh dấu / bỏ đánh dấu "Đã xem" bằng tay
    setWatched: function (item, on) {
      var m = pget('prog', {});
      if (on) {
        var d = item.dur || (m[item.id] && m[item.id].d) || 1;
        m[item.id] = { p: d, d: d, t: Date.now() };
      } else {
        delete m[item.id];
        var sk = curStamps(), st = get(sk, {}), rm = st.rm || {};
        rm['p:' + item.id] = Date.now(); st.rm = rm; set(sk, st);   // đồng bộ không đưa nó trở lại
      }
      pset('prog', m);
    },

    recent: function () { return pget('recent', []); },
    touchRecent: function (rec) {
      var a = pget('recent', []).filter(function (r) { return r.key !== rec.key; });
      rec.t = Date.now();
      a.unshift(rec);
      pset('recent', a.slice(0, 40));
    },
    clearHistory: function () {
      var sk = curStamps(), st = get(sk, {}); st.histClr = Date.now(); set(sk, st);
      pset('recent', []);
      pset('prog', {});
    },

    // Xóa MỘT phim khỏi "Đã xem gần đây" (kèm tiến độ). Ghi dấu xóa để đồng bộ không làm nó hiện lại.
    removeRecent: function (key) {
      var a = pget('recent', []), r = null;
      a.forEach(function (x) { if (x.key === key) r = x; });
      var sk = curStamps(), st = get(sk, {}), rm = st.rm || {}, now = Date.now();
      rm['r:' + key] = now;
      if (r && r.vid) rm['p:' + r.vid] = now;
      var ks = Object.keys(rm);
      if (ks.length > 150) { ks.sort(function (x, y) { return rm[y] - rm[x]; }).slice(150).forEach(function (k) { delete rm[k]; }); }
      st.rm = rm; set(sk, st);
      pset('recent', a.filter(function (x) { return x.key !== key; }));
      if (r && r.vid) { var p = pget('prog', {}); if (p[r.vid]) { delete p[r.vid]; pset('prog', p); } }
    },
    // Xóa MỘT phim khỏi "Danh sách của tôi"
    removeFav: function (id) {
      pset('favs', pget('favs', []).filter(function (f) { return f.id !== id; }));
    },

    favs: function () { return pget('favs', []); },
    isFav: function (item) {
      return pget('favs', []).some(function (f) { return f.id === item.id; });
    },
    toggleFav: function (item) {
      var a = pget('favs', []);
      var has = a.some(function (f) { return f.id === item.id; });
      if (has) {
        a = a.filter(function (f) { return f.id !== item.id; });
      } else {
        var c = {};
        for (var k in item) { if (k !== 'desc') c[k] = item[k]; }
        c.desc = (item.desc || '').slice(0, 300);
        a.unshift(c);
      }
      pset('favs', a.slice(0, 60));
      return !has;
    },

    /* ---------- Hồ sơ người xem ---------- */
    profile: function () { return prof; },
    profiles: function () {
      var pr = get('prefs', {}), list = pr.profiles || [];
      var out = [{ id: 'guest', name: 'Guest', c: 0, av: pr.guestAv, pinH: pr.guestPin }];
      list.forEach(function (x) { if (x && x.id && x.id !== 'guest') out.push(x); });
      // Hồ sơ chưa chọn hình (Guest, hồ sơ tạo từ bản cũ): tự gán một con thú chưa ai dùng (Guest ưu tiên gấu trúc)
      var used = {}, PREF = [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      out.forEach(function (x) { if (x.av != null) used[x.av] = 1; });
      out = out.map(function (x, i) {
        if (x.av != null) return x;
        var y = {}; Object.keys(x).forEach(function (k) { y[k] = x[k]; });
        var pick = PREF.filter(function (n) { return !used[n]; })[0];
        y.av = pick != null ? pick : i % 25;
        used[y.av] = 1;
        return y;
      });
      return out;
    },
    profileName: function () {
      var me = Store.profiles().filter(function (x) { return x.id === prof; })[0];
      return me ? me.name : 'Guest';
    },
    setProfile: function (id) {
      if (!Store.profiles().some(function (x) { return x.id === id; })) id = 'guest';
      prof = id;
      try { w.localStorage.setItem(P + 'profile', id); } catch (e) { /* bỏ qua */ }
      tog = []; set('together', []);   // chọn một người = thôi xem chung
    },
    // Mã PIN riêng của hồ sơ (lưu dạng băm). hash = null để bỏ mã
    setProfilePin: function (id, hash) {
      var m = get('prefs', {});
      if (id === 'guest') { if (hash) m.guestPin = hash; else delete m.guestPin; }
      else (m.profiles || []).forEach(function (x) { if (x.id === id) { if (hash) x.pinH = hash; else delete x.pinH; } });
      set('prefs', m);
    },
    // Đổi hình con thú của một hồ sơ (Guest cũng đổi được)
    setAvatar: function (id, av) {
      var m = get('prefs', {});
      if (id === 'guest') m.guestAv = av;
      else (m.profiles || []).forEach(function (x) { if (x.id === id) x.av = av; });
      set('prefs', m);
    },
    addProfile: function (name, av) {
      name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20);
      if (!name) return null;
      var m = get('prefs', {}), list = (m.profiles || []).slice();
      var lower = name.toLowerCase();
      if (lower === 'guest' || list.some(function (x) { return String(x.name).toLowerCase() === lower; })) return 'exists';
      var id = 'p' + Date.now().toString(36);
      var pf = { id: id, name: name, c: (list.length + 1) % 6 };
      if (av != null) pf.av = av;
      list.push(pf);
      m.profiles = list;
      set('prefs', m);
      return id;
    },
    // Hồ sơ gửi từ TV qua mã QR: tạo đúng mã hồ sơ đó trên máy này nếu chưa có
    ensureProfile: function (id, name, av) {
      if (!id || id === 'guest' || Store.profiles().some(function (x) { return x.id === id; })) return id || 'guest';
      var m = get('prefs', {}), list = (m.profiles || []).slice();
      name = String(name || 'Hồ sơ').slice(0, 20);
      if (list.some(function (x) { return String(x.name).toLowerCase() === name.toLowerCase(); })) name = name + ' (TV)';
      var pf = { id: String(id).slice(0, 30), name: name, c: (list.length + 1) % 6 };
      if (av != null) pf.av = av;
      list.push(pf); m.profiles = list; set('prefs', m);
      return pf.id;
    },
    // Xóa hồ sơ (không xóa được Guest): xóa luôn lịch sử, tiến độ, danh sách của hồ sơ đó
    removeProfile: function (id) {
      if (!id || id === 'guest') return false;
      var m = get('prefs', {});
      m.profiles = (m.profiles || []).filter(function (x) { return x.id !== id; });
      m.profDel = m.profDel || {}; m.profDel[id] = Date.now();   // nhớ đã xóa, để đồng bộ không mang hồ sơ này về lại
      set('prefs', m);
      ['prog', 'recent', 'favs', 'sq', 'stamps'].forEach(function (k) { try { w.localStorage.removeItem(P + k + '@' + id); } catch (e) { /* bỏ qua */ } });
      if (prof === id) Store.setProfile('guest');
      return true;
    },

    /* ---------- Thống kê xem: số giây xem mỗi ngày và theo kênh (giữ 35 ngày, riêng từng hồ sơ) ---------- */
    dayKey: function (t) {
      var x = new Date(t || Date.now()), m = x.getMonth() + 1, dd = x.getDate();
      return x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd;
    },
    addWatch: function (secs, ch) {
      if (!(secs > 0)) return;
      var st = pget('stats', {}), k = Store.dayKey(), day = st[k] || { s: 0, ch: {} };
      day.s = Math.round((day.s + secs) * 10) / 10;
      ch = String(ch || 'Khác').slice(0, 60);
      day.ch[ch] = Math.round(((day.ch[ch] || 0) + secs) * 10) / 10;
      // theo giờ trong ngày (0–23) để biết khung giờ hay xem
      var hr = new Date().getHours();
      if (!day.h || day.h.length !== 24) day.h = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      day.h[hr] = Math.round((day.h[hr] + secs) * 10) / 10;
      st[k] = day;
      var keys = Object.keys(st).sort();
      keys.slice(0, Math.max(0, keys.length - 35)).forEach(function (x) { delete st[x]; });
      pset('stats', st);
    },
    // id = hồ sơ (bỏ trống = hồ sơ đang xem)
    stats: function (id) {
      if (!id || id === prof) return pget('stats', {});
      return get(id === 'guest' ? 'stats' : 'stats@' + id, {});
    },
    clearStats: function () { pset('stats', {}); },

    /* ---------- Kênh yêu thích (riêng từng hồ sơ, lưu trong prefs nên được đồng bộ) ---------- */
    favChs: function () { return ((get('prefs', {}).favch || {})[prof]) || []; },
    isFavCh: function (id) { return !!id && Store.favChs().some(function (x) { return x.id === id; }); },
    toggleFavCh: function (ch) {
      if (!ch || !ch.id) return false;
      var m = get('prefs', {}), all = m.favch || {}, l = (all[prof] || []).slice();
      var has = l.some(function (x) { return x.id === ch.id; });
      l = has ? l.filter(function (x) { return x.id !== ch.id; }) : l.concat([{ id: ch.id, name: String(ch.title || ch.name || '').slice(0, 60) }]);
      all[prof] = l; m.favch = all; set('prefs', m);
      return !has;
    },

    /* ---------- Lịch sử tìm kiếm: 5 từ khóa gần nhất (riêng từng hồ sơ) ---------- */
    searches: function () { return pget('sq', []); },
    addSearch: function (q) {
      q = String(q || '').replace(/\s+/g, ' ').trim();
      if (!q) return;
      var a = pget('sq', []).filter(function (x) { return x.toLowerCase() !== q.toLowerCase(); });
      a.unshift(q);
      pset('sq', a.slice(0, 5));
    },
    clearSearches: function () { pset('sq', []); },

    // Dùng cho đồng bộ: đọc/ghi thô, không đánh dấu thay đổi
    raw: function (k, d) { return get(k, d); },
    applyRaw: function (k, v) { applying = true; try { set(k, v); } finally { applying = false; } },

    pref: function (k, def) { var m = get('prefs', {}); return m[k] !== undefined ? m[k] : def; },
    setPref: function (k, v) { var m = get('prefs', {}); m[k] = v; set('prefs', m); },

    // Bộ nhớ lâu dài (không tự xóa): id kênh đã tìm được
    keep: function (k, v) { var m = get('keep', {}); if (v === undefined) return m[k]; m[k] = v; set('keep', m); },

    block: function (id) {
      var m = get('blocked', {});
      m[id] = 1;
      set('blocked', m);
    },
    isBlocked: function (id) { return !!get('blocked', {})[id]; },
    blockedCount: function () { return Object.keys(get('blocked', {})).length; },
    clearBlocked: function () { set('blocked', {}); },

    cacheGet: function (k, hours) {
      var c = get('cache', {});
      var e = c[k];
      if (e && Date.now() - e.t < hours * 3600e3) return e.v;
      return null;
    },
    clearCache: function () {
      set('cache', {});
      var m = get('keep', {}), k;
      for (k in m) if (k.indexOf('m:') === 0) delete m[k];   // bắt lấy lại đầy đủ
      set('keep', m);
    },
    cacheGetAny: function (k) { var e = get('cache', {})[k]; return e ? e.v : null; },
    cacheSet: function (k, v) {
      var c = get('cache', {});
      c[k] = { t: Date.now(), v: v };
      var keys = Object.keys(c);
      if (keys.length > 120) {
        keys.sort(function (a, b) { return c[a].t - c[b].t; });
        keys.slice(0, keys.length - 40).forEach(function (x) { delete c[x]; });
      }
      try {
        w.localStorage.setItem(P + 'cache', JSON.stringify(c));
      } catch (e) {
        try { w.localStorage.removeItem(P + 'cache'); } catch (e2) { /* bỏ qua */ }
      }
    }
  };

  /* ---------- Xem chung: nhiều hồ sơ cùng xem; phim, tiến độ, thời gian xem ghi cho tất cả ---------- */
  var tog = get('together', []);
  function others() {
    if (!(tog && tog.length > 1) || tog.indexOf(prof) < 0) return [];
    var ok = {}; Store.profiles().forEach(function (x) { ok[x.id] = 1; });
    return tog.filter(function (id) { return id !== prof && ok[id]; });
  }
  // chạy fn như thể đang ở hồ sơ id (đọc/ghi dữ liệu riêng của hồ sơ đó)
  Store.as = function (id, fn) { var keep = prof; prof = id; try { return fn(); } finally { prof = keep; } };
  Store.together = function () { var o = others(); return o.length ? [prof].concat(o) : []; };
  Store.setTogether = function (ids) {
    ids = (ids || []).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    Store.setProfile(ids[0] || 'guest');
    tog = ids.length > 1 ? ids : []; set('together', tog);
  };
  ['setProgress', 'touchRecent', 'addWatch', 'setWatched'].forEach(function (n) {
    var f = Store[n];
    Store[n] = function () {
      var a = arguments, r = f.apply(Store, a);
      others().forEach(function (id) { try { Store.as(id, function () { f.apply(Store, a); }); } catch (e) { /* bỏ qua */ } });
      return r;
    };
  });

  w.Store = Store;
})(window);
