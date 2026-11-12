/* Đánh giá phim theo hồ sơ: 1 = Thích, 0 = Bình thường, -1 = Không thích. Lưu trong prefs (đồng bộ Google). */
(function (w) {
  'use strict';
  function all() { return (w.Store.pref('rates', {}) || {}); }
  function ids() { var t = w.Store.together ? w.Store.together() : []; return t.length ? t : [w.Store.profile()]; }
  var R = {
    get: function (id, prof) { var m = all()[prof || w.Store.profile()] || {}; var x = m[id]; return x ? x.r : null; },
    of: function (prof) { return all()[prof || w.Store.profile()] || {}; },
    set: function (item, r) {
      if (!item || !item.id) return;
      var a = all(), keep = { r: r, t: Date.now(), title: String(item.title || '').slice(0, 120), ch: String(item.ch || '').slice(0, 60), cats: item.cats || null, kind: item.kind || '', thumb: item.thumb || '' };
      ids().forEach(function (p) {   // xem chung: ghi cho mọi người
        var m = a[p] || {}; m[item.id] = keep;
        var ks = Object.keys(m); if (ks.length > 400) { ks.sort(function (x, y) { return m[x].t - m[y].t; }).slice(0, ks.length - 400).forEach(function (k) { delete m[k]; }); }
        a[p] = m;
      });
      w.Store.setPref('rates', a);
      if (w.Tele && w.Tele.rate) w.Tele.rate(item, r);
    },
    label: function (r) { return r === 1 ? '❤ Thích' : r === -1 ? '👎 Không thích' : r === 0 ? '😐 Bình thường' : ''; }
  };
  w.Rates = R;
})(window);
