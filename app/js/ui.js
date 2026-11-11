/* Thành phần giao diện và điều hướng bằng remote (lên, xuống, trái, phải, OK). */
(function (w) {
  'use strict';
  var d = document;

  var GR = [
    'linear-gradient(135deg,#3a1c4a,#c2456b)', 'linear-gradient(135deg,#0f2a43,#2f7fb8)',
    'linear-gradient(135deg,#3b2a14,#d9973c)', 'linear-gradient(135deg,#1b3a2f,#4fae8a)',
    'linear-gradient(135deg,#2a2145,#7a6ad8)', 'linear-gradient(135deg,#4a1c1c,#e0653d)'
  ];

  function el(tag, cls, text) {
    var e = d.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;   // luôn dùng textContent: tiêu đề từ internet không được chèn HTML
    return e;
  }
  function hash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function grad(id) { return GR[hash(String(id)) % GR.length]; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function fmtDur(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? h + ':' + pad(m) + ':' + pad(x) : pad(m) + ':' + pad(x);
  }
  function fmtLong(s) {
    s = Math.max(0, Math.round((s || 0) / 60));
    var h = Math.floor(s / 60), m = s % 60;
    if (h && m) return h + ' giờ ' + m + ' phút';
    if (h) return h + ' giờ';
    return m + ' phút';
  }
  function fmtShort(s) {
    s = Math.max(0, Math.round((s || 0) / 60));
    var h = Math.floor(s / 60), m = s % 60;
    return h ? h + 'h' + pad(m) : m + ' phút';
  }
  function fmtViews(n) {
    n = +n || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' tr lượt xem';
    if (n >= 1e3) return Math.round(n / 1e3) + ' nghìn lượt xem';
    return n ? n + ' lượt xem' : '';
  }
  function fmtAgo(iso) {
    if (!iso) return '';
    var days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return 'hôm nay';
    if (days === 1) return 'hôm qua';
    if (days < 7) return days + ' ngày trước';
    if (days < 30) return Math.floor(days / 7) + ' tuần trước';
    if (days < 365) return Math.floor(days / 30) + ' tháng trước';
    return Math.floor(days / 365) + ' năm trước';
  }

  function thumb(item, hero) {
    var t = el('div', 'thumb');
    t.style.background = grad(item.id);
    var src = hero ? (item.hero || item.thumb) : item.thumb;
    if (src) {
      var im = d.createElement('img');
      im.className = 'timg';
      im.draggable = false;
      im.onload = function () { im.classList.add('on'); };
      im.onerror = function () {
        if (hero && item.thumb && im.getAttribute('src') !== item.thumb) im.src = item.thumb;
        else im.style.display = 'none';
      };
      im.src = src;
      t.appendChild(im);
    }
    return t;
  }

  function subline(it) {
    if (it.kind === 'anime') return 'Hoạt hình' + (it.eps ? ' · ' + it.eps + ' tập' : '');
    if (it.anime) return (it.dur ? fmtShort(it.dur) + ' · ' : '') + (it.ch || 'Hoạt hình');
    if (it.kind === 'ep') return it.dur ? fmtShort(it.dur) : '';
    var a = [];
    if (it.dur) a.push(fmtShort(it.dur));
    var v = fmtViews(it.views);
    if (v) a.push(v);
    return a.join(' · ') || it.ch || '';
  }

  function card(item, o) {
    o = o || {};
    var c = el('div', 'card f' + (o.grid ? ' grid' : ''));
    var t = thumb(item);
    if (item.tag) t.appendChild(el('div', 'badge tag', item.tag));
    if (o.isNew) t.appendChild(el('div', 'badge new', 'MỚI'));
    if (item.kind === 'anime' && (item.eps || 0) > 1) t.appendChild(el('div', 'badge multi' + (o.isNew ? ' shift' : ''), 'Nhiều tập'));
    if (o.rank) { t.classList.add('ranked'); t.appendChild(el('div', 'rank', String(o.rank))); }
    var dur = item.kind === 'anime' ? (item.eps ? item.eps + ' tập' : '') : (item.dur ? fmtDur(item.dur) : '');
    if (dur) t.appendChild(el('div', 'badge dur', dur));
    // Phim đã xem hết: dấu "✓ Đã xem", ảnh mờ đi một chút
    if (o.progress == null && item.kind !== 'anime' && w.Store && w.Store.isWatched && w.Store.isWatched(item.id)) {
      c.classList.add('seen');
      t.appendChild(el('div', 'badge seenb', '✓ Đã xem'));
    }
    var cats = w.Api ? w.Api.catsOf(item) : [];
    if (cats.length) t.appendChild(el('div', 'badge cat', cats[0]));
    if (o.progress != null) {
      var pb = el('div', 'pbar'), pf = el('div', 'pfill');
      pf.style.width = Math.round(Math.min(1, o.progress) * 100) + '%';
      pb.appendChild(pf);
      t.appendChild(pb);
    }
    c.appendChild(t);
    c.appendChild(el('div', 'ctitle', o.title || item.title));
    var sub = o.sub != null ? o.sub : subline(item);
    if (sub) c.appendChild(el('div', 'csub', sub));
    c._item = item;
    c._ok = function () { if (o.onSelect) o.onSelect(item); };
    return c;
  }

  function skel() {
    var c = el('div', 'card skel');
    c.appendChild(el('div', 'thumb'));
    c.appendChild(el('div', 'sk-l1'));
    c.appendChild(el('div', 'sk-l2'));
    return c;
  }

  function row(title, hint) {
    var wrap = el('div', 'rowwrap');
    var head = el('div', 'rowhead');
    head.appendChild(el('span', 'rt', title));
    if (hint) head.appendChild(el('span', 'rh', hint));
    var track = el('div', 'track');
    wrap.appendChild(head);
    wrap.appendChild(track);
    // Mũi tên ◀ ▶ (chuột): cuộn hàng phim sang trái/phải
    function arrow(cls, ch, dir) {
      var a = el('div', 'rarrow ' + cls, ch);
      a.onclick = function (ev) {
        ev.stopPropagation();
        var to = track.scrollLeft + dir * 1500;
        to = Math.max(0, Math.min(track.scrollWidth - track.clientWidth, to));
        anim(track, 'scrollLeft', to);
        setTimeout(upArrows, 260);
      };
      return a;
    }
    var aL = arrow('l', '\u276E', -1), aR = arrow('r', '\u276F', 1);
    wrap.appendChild(aL); wrap.appendChild(aR);
    function upArrows() {
      aL.classList.toggle('off', track.scrollLeft < 8);
      aR.classList.toggle('off', track.scrollLeft > track.scrollWidth - track.clientWidth - 8);
    }
    wrap.addEventListener('mouseenter', upArrows);
    track.addEventListener('scroll', upArrows);
    var api = {
      wrap: wrap, track: track,
      loading: function () {
        track.innerHTML = '';
        for (var i = 0; i < 5; i++) track.appendChild(skel());
      },
      cards: function (list, mk) {
        track.innerHTML = '';
        track.scrollLeft = 0;
        if (!list.length) { api.msg('Chưa có phim phù hợp.'); return; }
        list.forEach(function (it, i) { track.appendChild(mk(it, i)); });
      },
      msg: function (t) {
        track.innerHTML = '';
        track.appendChild(el('div', 'rowmsg', t));
      },
      hide: function () { wrap.classList.add('hidden'); },
      show: function () { wrap.classList.remove('hidden'); }
    };
    api.loading();
    return api;
  }

  function view() { return el('div', 'view scroller'); }

  function button(label, cls, onOk, iconSvg) {
    var b = el('div', 'btn f ' + (cls || ''));
    if (iconSvg) { var s = el('span', 'bico'); s.innerHTML = iconSvg; b.appendChild(s); }   // icon là SVG tĩnh của app
    b.appendChild(el('span', 'blabel', label));
    b._ok = onOk;
    b.setLabel = function (t) { b.querySelector('.blabel').textContent = t; };
    return b;
  }

  var toastT = 0;
  function toast(msg) {
    var t = d.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.add('hidden'); }, 2600);
  }

  var ICON_PLAY = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M6 3l15 9-15 9z" fill="currentColor"/></svg>';
  var ICON_PLUS = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
  var ICON_CHECK = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  /* ---------- Điều hướng bằng phím ---------- */

  function anim(node, prop, to) {
    var from = node[prop];
    if (Math.abs(to - from) < 2) return;
    if (node._anim) cancelAnimationFrame(node._anim);
    var t0 = w.performance.now(), ms = 180;
    (function step(t) {
      var k = Math.min(1, (t - t0) / ms);
      k = 1 - Math.pow(1 - k, 3);
      node[prop] = from + (to - from) * k;
      node._anim = k < 1 ? requestAnimationFrame(step) : 0;
    })(t0);
  }

  /* Co giãn khung 1920x1080 cho vừa mọi màn hình (Full HD, 4K, Fire TV, Android TV, Samsung).
     Không dựa vào thẻ viewport vì mỗi hãng TV xử lý khác nhau. */
  // Trình duyệt TV cũ không hỗ trợ "gap" cho flex -> bật bộ margin thay thế (.nogap trong app.css)
  (function () {
    var f = d.createElement('div');
    f.style.cssText = 'display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden';
    f.appendChild(d.createElement('div'));
    f.appendChild(d.createElement('div'));
    d.body.appendChild(f);
    if (f.scrollHeight !== 1) d.documentElement.className += ' nogap';
    d.body.removeChild(f);
  })();

  var scale = 1;
  function fit() {
    var app = d.getElementById('app');
    if (!app) return;
    var vw = w.innerWidth || d.documentElement.clientWidth || 1920;
    var vh = w.innerHeight || d.documentElement.clientHeight || 1080;
    // Điện thoại (trình duyệt): giao diện mobile riêng, không co khung TV
    var mob = !(w.tizen || w.AndroidApp) && (vw < 900 || vh < 500);
    d.documentElement.classList.toggle('mobile', mob);
    if (mob) {
      scale = 1;
      app.style.transform = app.style.webkitTransform = 'none';
      app.style.left = app.style.top = '0px';
      return;
    }
    scale = Math.min(vw / 1920, vh / 1080);
    // Gần đúng 1:1 thì bỏ hẳn transform: video phần cứng của TV Android (Hisense) bị cắt/lệch nếu khung có transform
    var tf = Math.abs(scale - 1) < 0.01 ? 'none' : 'scale(' + scale + ')';
    app.style.transform = tf;
    app.style.webkitTransform = tf;
    app.style.left = Math.round((vw - 1920 * scale) / 2) + 'px';
    app.style.top = Math.round((vh - 1080 * scale) / 2) + 'px';
  }
  fit();
  w.UI_fitInfo = function () { return (w.innerWidth || 0) + '×' + (w.innerHeight || 0) + ' @' + (w.devicePixelRatio || 1) + ' · tỉ lệ ' + (Math.round(scale * 100) / 100); };
  w.addEventListener('resize', fit);
  w.addEventListener('load', fit);
  setTimeout(fit, 300);

  function isMobile() { return d.documentElement.classList.contains('mobile'); }

  function reveal(e) {
    if (isMobile()) return;   // điện thoại: tự cuộn bằng tay
    var tr = e.closest('.track');
    if (tr) {
      var L = e.offsetLeft, R = L + e.offsetWidth;
      var v0 = tr.scrollLeft + 80, v1 = tr.scrollLeft + 1920 - 140;
      if (L < v0) anim(tr, 'scrollLeft', Math.max(0, L - 80));
      else if (R > v1) anim(tr, 'scrollLeft', R - 1920 + 140);
    }
    var sc = e.closest('.scroller');
    if (sc) {
      var tgt = e.closest('.rowwrap') || e;
      var sr = sc.getBoundingClientRect(), rr = tgt.getBoundingClientRect();
      // toạ độ trên màn hình đã bị co giãn: đổi về đơn vị của khung 1920x1080
      var top = (rr.top - sr.top) / scale, bot = (rr.bottom - sr.bottom) / scale;
      // Hàng đầu tiên của màn hình (không còn ô nào nằm phía trên): cuộn hẳn lên đầu để thấy ảnh, tên phim, tiêu đề
      var above = false, all = sc.querySelectorAll('.f');
      for (var i = 0; i < all.length; i++) {
        if (all[i] !== e && all[i].getClientRects().length && all[i].getBoundingClientRect().bottom <= rr.top + 4) { above = true; break; }
      }
      if (!above && sc.scrollTop > 0) anim(sc, 'scrollTop', 0);
      else if (top < 10) anim(sc, 'scrollTop', sc.scrollTop + top - 24);
      else if (bot > -10) anim(sc, 'scrollTop', sc.scrollTop + bot + 64);
    }
  }

  var Nav = {
    cur: null,
    roots: function () { return [d.getElementById('topbar')]; },

    all: function () {
      var out = [];
      Nav.roots().forEach(function (r) {
        if (!r) return;
        var list = r.querySelectorAll('.f');
        for (var i = 0; i < list.length; i++) {
          if (list[i].getClientRects().length && !list[i].closest('.hidden')) out.push(list[i]);
        }
      });
      return out;
    },

    focus: function (e, noReveal) {
      if (!e) return;
      if (Nav.cur) Nav.cur.classList.remove('focus');
      Nav.cur = e;
      e.classList.add('focus');
      if (!noReveal) reveal(e);
    },

    focusFirst: function (rootIndex) {
      var roots = Nav.roots(), r = roots[rootIndex == null ? roots.length - 1 : rootIndex];
      var list = r ? r.querySelectorAll('.f') : [];
      for (var i = 0; i < list.length; i++) {
        if (list[i].getClientRects().length && !list[i].closest('.hidden')) { Nav.focus(list[i]); return; }
      }
      var a = Nav.all();
      if (a.length) Nav.focus(a[0]);
    },

    move: function (dir) {
      var cur = Nav.cur;
      if (!cur || !d.body.contains(cur) || !cur.getClientRects().length) { Nav.focusFirst(); return; }
      var cr = cur.getBoundingClientRect();
      var cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      var best = null, bs = 1e12, horiz = dir === 'left' || dir === 'right';
      Nav.all().forEach(function (c) {
        if (c === cur) return;
        var r = c.getBoundingClientRect();
        var dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy, p, s;
        if (dir === 'right') { if (dx <= 2) return; p = dx; s = Math.abs(dy); }
        else if (dir === 'left') { if (dx >= -2) return; p = -dx; s = Math.abs(dy); }
        else if (dir === 'down') { if (dy <= 2) return; p = dy; s = Math.abs(dx); }
        else { if (dy >= -2) return; p = -dy; s = Math.abs(dx); }
        if (horiz && s > Math.max(cr.height, r.height) * 0.8) return;   // trái/phải chỉ đi trong cùng hàng
        var score = horiz ? p + s * 3 : p + s * 1.5;
        if (score < bs) { bs = score; best = c; }
      });
      if (best && dir === 'up' && !isMobile()) {
        var sc2 = cur.closest('.scroller');
        if (sc2 && !best.closest('.scroller') && sc2.scrollTop > 8) { anim(sc2, 'scrollTop', 0); return; }   // lên đầu trang trước, bấm lần nữa mới lên menu
      }
      if (best) Nav.focus(best);
    },

    ok: function () {
      if (Nav.cur && Nav._ok !== false && Nav.cur._ok) Nav.cur._ok(Nav.cur);
    }
  };

  // Các nhãn danh mục dạng chip (dùng ở trang chủ và chi tiết)
  function catChips(box, item) {
    (w.Api ? w.Api.catsOf(item) : []).forEach(function (n) { box.appendChild(el('span', 'chip cat', n)); });
  }

  // Giờ:phút theo kiểu đã chọn trong Cài đặt: 24 giờ (14:05) hoặc 12 giờ (2:05 PM)
  function hhmm(t) {
    var n = new Date(t), h = n.getHours(), m = n.getMinutes(), mm = (m < 10 ? '0' : '') + m;
    if (w.APP_CONFIG && w.APP_CONFIG.CLOCK_12) return (h % 12 || 12) + ':' + mm + ' ' + (h < 12 ? 'AM' : 'PM');
    return (h < 10 ? '0' : '') + h + ':' + mm;
  }

  // Một mốc giờ (0–23): "20h" hoặc "8 PM"
  function hr(h) {
    h = ((h % 24) + 24) % 24;
    return w.APP_CONFIG && w.APP_CONFIG.CLOCK_12 ? (h % 12 || 12) + ' ' + (h < 12 ? 'AM' : 'PM') : h + 'h';
  }

  w.UI = {
    hhmm: hhmm, hr: hr, catChips: catChips, fit: fit, grad: grad, isMobile: isMobile,
    el: el, grad: grad, thumb: thumb, card: card, row: row, view: view, button: button, toast: toast,
    fmtDur: fmtDur, fmtLong: fmtLong, fmtShort: fmtShort, fmtViews: fmtViews, fmtAgo: fmtAgo,
    ICON_PLAY: ICON_PLAY, ICON_PLUS: ICON_PLUS, ICON_CHECK: ICON_CHECK
  };
  w.Nav = Nav;
})(window);
