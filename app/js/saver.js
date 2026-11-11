/* Màn hình chờ: để yên một lúc (mặc định 10 phút) thì hiện ảnh bìa phim mới chạy chậm kèm đồng hồ.
   Bấm phím bất kỳ / chạm / bấm chuột để quay lại đúng chỗ cũ (phím đó không làm gì khác). */
(function (w, d) {
  'use strict';
  var last = Date.now(), on = false, box = null, layers = [], cur = 0, items = [], idx = 0;
  var slideTimer = null, clockTimer = null, mx = -1, my = -1, shownAt = 0;
  var SLIDE_MS = 12000;
  var DAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  var MOVES = ['kb1', 'kb2', 'kb3', 'kb4'];

  function C() { return w.APP_CONFIG || {}; }
  function minutes() { var m = Number(C().SCREENSAVER); return isFinite(m) && m > 0 ? m : 0; }
  function busy() {
    if (d.getElementById('boot')) return true;
    if (w.Player && w.Player.isPlaying && w.Player.isPlaying()) return true;   // đang chiếu phim thì không hiện
    return d.hidden;
  }

  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Phim mới nhất (đã qua bộ lọc lứa tuổi), có ảnh bìa
  function pickItems() {
    var pool = [];
    try { pool = (w.Api && w.Api.pool && w.Api.pool()) || []; } catch (e) { pool = []; }
    var seen = {};
    pool = pool.filter(function (it) {
      if (!it || !(it.hero || it.thumb) || seen[it.id]) return false;
      seen[it.id] = 1;
      return !(w.Settings && w.Settings.hides && w.Settings.hides(it));
    });
    pool.sort(function (a, b) { return String(b.pub || '') > String(a.pub || '') ? 1 : -1; });
    return shuffle(pool.slice(0, 30));
  }

  function el(tag, cls, txt) { var e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function build() {
    box = el('div'); box.id = 'saver';
    for (var i = 0; i < 2; i++) { var l = el('div', 'svimg'); box.appendChild(l); layers.push(l); }
    box.appendChild(el('div', 'svshade'));
    var info = el('div', 'svinfo');
    info.appendChild(el('div', 'svbrand', 'Tổng Tài TV'));
    info.appendChild(el('div', 'svtag', 'Phim mới'));
    info.appendChild(el('div', 'svtitle', ''));
    info.appendChild(el('div', 'svch', ''));
    box.appendChild(info);
    var clk = el('div', 'svclock');
    clk.appendChild(el('div', 'svtime', ''));
    clk.appendChild(el('div', 'svdate', ''));
    box.appendChild(clk);
    box.appendChild(el('div', 'svhint', 'Bấm phím bất kỳ để quay lại'));
    (d.getElementById('app') || d.body).appendChild(box);
  }

  function paintClock() {
    if (!box) return;
    var n = new Date();
    box.querySelector('.svtime').textContent = w.UI && w.UI.hhmm ? w.UI.hhmm(n.getTime()) : n.toTimeString().slice(0, 5);
    box.querySelector('.svdate').textContent = DAYS[n.getDay()] + ', ' + n.getDate() + ' tháng ' + (n.getMonth() + 1);
  }

  function nextSlide() {
    if (!on) return;
    if (!items.length) { box.classList.add('noimg'); return; }
    var it = items[idx % items.length]; idx++;
    var src = it.hero || it.thumb;
    var img = new Image();
    img.onload = img.onerror = function () {
      if (!on) return;
      var nl = layers[1 - cur], ol = layers[cur];
      nl.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
      MOVES.forEach(function (m) { nl.classList.remove(m); });
      void nl.offsetWidth;   // chạy lại hiệu ứng trượt
      nl.classList.add(MOVES[Math.floor(Math.random() * MOVES.length)]);
      nl.classList.add('show'); ol.classList.remove('show');
      cur = 1 - cur;
      var info = box.querySelector('.svinfo');
      info.classList.remove('in'); void info.offsetWidth;
      box.querySelector('.svtitle').textContent = it.title || '';
      box.querySelector('.svch').textContent = (it.ch || '') + (it.eps > 1 ? ' · ' + it.eps + ' tập' : '');
      info.classList.add('in');
      box.classList.toggle('alt', idx % 2 === 0);   // đổi góc đồng hồ, tránh in hình lên màn TV
    };
    img.src = src;
  }

  function show() {
    if (on) return;
    if (!box) build();
    on = true; shownAt = Date.now(); mx = my = -1;
    items = pickItems(); idx = 0;
    box.classList.toggle('noimg', !items.length);
    paintClock();
    d.documentElement.classList.add('ssaver');
    box.classList.add('on');
    nextSlide();
    slideTimer = setInterval(nextSlide, SLIDE_MS);
    clockTimer = setInterval(paintClock, 10000);
    if (w.Log) w.Log.info('Bật màn hình chờ');
  }

  function hide() {
    if (!on) return;
    on = false; last = Date.now();
    clearInterval(slideTimer); clearInterval(clockTimer);
    d.documentElement.classList.remove('ssaver');
    box.classList.remove('on');
    layers.forEach(function (l) { l.classList.remove('show'); });
  }

  // Phím / chạm / chuột: đang hiện màn hình chờ thì chỉ tắt nó, không làm gì khác
  function activity(e) {
    last = Date.now();
    if (!on) return;
    if (e.type === 'mousemove') {
      if (Date.now() - shownAt < 800) return;
      if (mx < 0) { mx = e.clientX; my = e.clientY; return; }
      if (Math.abs(e.clientX - mx) + Math.abs(e.clientY - my) < 24) return;
    }
    if (e.type === 'keyup') { e.stopPropagation(); return; }
    e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation();
    if (e.cancelable && e.type !== 'mousemove') e.preventDefault();
    hide();
    if (e.type === 'pointerdown' || e.type === 'touchstart' || e.type === 'mousedown') swallowClick = Date.now();
  }
  var swallowClick = 0;
  ['keydown', 'keyup', 'pointerdown', 'mousedown', 'touchstart', 'wheel', 'mousemove'].forEach(function (ev) {
    w.addEventListener(ev, activity, { capture: true, passive: false });
  });
  w.addEventListener('click', function (e) { if (Date.now() - swallowClick < 700) { e.stopPropagation(); e.preventDefault(); } }, true);

  setInterval(function () {
    var m = minutes();
    if (on || !m) return;
    if (busy()) { last = Date.now(); return; }   // đang chiếu phim: tính lại từ lúc dừng
    if (Date.now() - last >= m * 60000) show();
  }, 5000);

  w.Saver = { show: show, hide: hide, isOn: function () { return on; } };
})(window, document);
