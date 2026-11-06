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
  var applying = false;
  function set(k, v) {
    try { w.localStorage.setItem(P + k, JSON.stringify(v)); } catch (e) { /* đầy bộ nhớ: bỏ qua */ }
    if (SYNC_KEYS[k] && !applying) {
      var st = get('stamps', {});
      st[k] = Date.now();
      try { w.localStorage.setItem(P + 'stamps', JSON.stringify(st)); } catch (e) { /* bỏ qua */ }
      if (w.Sync && w.Sync.dirty) w.Sync.dirty(k);
    }
  }

  var Store = {
    getProgress: function (id) {
      var m = get('prog', {});
      return m[id] || null;
    },
    setProgress: function (id, p, d) {
      var m = get('prog', {});
      m[id] = { p: Math.floor(p || 0), d: Math.floor(d || 0), t: Date.now() };
      var keys = Object.keys(m);
      if (keys.length > 300) {
        keys.sort(function (a, b) { return m[a].t - m[b].t; });
        keys.slice(0, keys.length - 300).forEach(function (k) { delete m[k]; });
      }
      set('prog', m);
    },

    recent: function () { return get('recent', []); },
    touchRecent: function (rec) {
      var a = get('recent', []).filter(function (r) { return r.key !== rec.key; });
      rec.t = Date.now();
      a.unshift(rec);
      set('recent', a.slice(0, 40));
    },
    clearHistory: function () {
      var st = get('stamps', {}); st.histClr = Date.now(); set('stamps', st);
      set('recent', []);
      set('prog', {});
    },

    favs: function () { return get('favs', []); },
    isFav: function (item) {
      return get('favs', []).some(function (f) { return f.id === item.id; });
    },
    toggleFav: function (item) {
      var a = get('favs', []);
      var has = a.some(function (f) { return f.id === item.id; });
      if (has) {
        a = a.filter(function (f) { return f.id !== item.id; });
      } else {
        var c = {};
        for (var k in item) { if (k !== 'desc') c[k] = item[k]; }
        c.desc = (item.desc || '').slice(0, 300);
        a.unshift(c);
      }
      set('favs', a.slice(0, 60));
      return !has;
    },

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

  w.Store = Store;
})(window);
