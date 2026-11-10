/* Khởi động app, đăng ký phím remote, đồng hồ. */
(function (w) {
  'use strict';
  var d = document;

  function registerKeys() {
    try {
      ['MediaPlay', 'MediaPause', 'MediaPlayPause', 'MediaFastForward', 'MediaRewind', 'MediaStop', 'ColorF2Yellow']
        .forEach(function (k) { w.tizen.tvinputdevice.registerKey(k); });
    } catch (e) { /* chạy ngoài TV */ }
  }

  function clock() {
    var c = d.getElementById('clock');
    c.textContent = w.UI.hhmm(Date.now());
    c.classList.toggle('h12', !!w.APP_CONFIG.CLOCK_12);
  }
  w.appClock = clock;

  var okAt = 0;
  var IS_TV = !!(w.tizen || w.AndroidApp);

  // OK 2 lần liên tục (trong 0,45 giây) -> về Trang chủ. Không áp dụng khi đang gõ chữ / chỉnh Cài đặt.
  function doubleOk(k) {
    if (k !== 13) return false;
    var now = Date.now(), dbl = now - okAt < 450;
    okAt = dbl ? 0 : now;
    if (!dbl || w.APP_CONFIG.OK2_HOME === false) return false;
    var cur = w.Screens.current && w.Screens.current();
    if (cur && /^(search|textedit|settings)$/.test(cur.name)) return false;
    if (w.Player.isOpen() && w.Player.inMenu && w.Player.inMenu()) return false;
    return true;
  }

  // Giữ lâu nút giữa (OK) trên một phim có thể xóa: hiện hộp hỏi xóa. Nhấn nhanh vẫn là mở phim như thường.
  var holdTimer = 0, holdFired = false;
  d.addEventListener('keyup', function (e) {
    if (e.keyCode !== 13) return;
    if (holdTimer) {
      clearTimeout(holdTimer); holdTimer = 0;
      if (!holdFired) w.Nav.ok();   // nhả sớm = nhấn OK bình thường
    }
    holdFired = false;
  });

  function onKey(e) {
    var k = e.keyCode;
    w.lastKeyAt = Date.now();
    if (bootOn) {   // đang ở màn hình khởi động: OK / Back = vào ngay
      if (k === 13 || k === 10009 || k === 27 || k === 8) hideBoot();
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (k === 13 && (e.repeat || holdTimer || holdFired)) { if (e.preventDefault) e.preventDefault(); return; }   // giữ phím OK: bỏ các lần lặp (tránh tính nhầm là OK hai lần)
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
      if (k === 27) { e.target.blur(); w.Screens.back(); e.preventDefault(); }
      return;   // đang gõ trong ô nhập thật (điện thoại)
    }
    if (doubleOk(k)) {
      if (w.Player.isOpen()) w.Player.close();
      w.Screens.home();
      if (e.preventDefault) e.preventDefault();
      return;
    }
    if (w.Player.isOpen()) {
      w.Player.key(k);
      e.preventDefault();
      return;
    }
    // Bàn phím thật (máy tính): gõ chữ vào ô Tìm kiếm / ô nhập
    var cur = w.Screens.current && w.Screens.current();
    if (!IS_TV && cur && cur.typing && e.key) {
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { cur.typing.ch(e.key); e.preventDefault(); return; }
      if (k === 8) { cur.typing.back(); e.preventDefault(); return; }
    }
    switch (k) {
      case 37: w.Nav.move('left'); break;
      case 38: w.Nav.move('up'); break;
      case 39: w.Nav.move('right'); break;
      case 40: w.Nav.move('down'); break;
      case 13: {
        var f0 = w.Nav.cur;
        if (f0 && f0._hold && !w.Player.isOpen()) {
          holdFired = false;
          holdTimer = setTimeout(function () { holdTimer = 0; holdFired = true; f0._hold(); }, 650);
        } else w.Nav.ok();
        break;
      }
      case 405: case 89: {   // nút VÀNG (hoặc phím Y): hành động nhanh của màn hình (ví dụ xóa phim ở Lịch sử)
        var sc = w.Screens.current && w.Screens.current();
        if (sc && sc.onYellow) sc.onYellow(); else return;
        break;
      }
      case 10009: case 27: case 8: w.Screens.back(); break;
      default: return;
    }
    e.preventDefault();
  }

  // Dán (⌘V / Ctrl+V) vào ô nhập: tiện để dán API key trên máy tính
  d.addEventListener('paste', function (e) {
    // Ô nhập thật (iPhone/điện thoại): để trình duyệt tự dán vào ô, ô sẽ báo lại cho app qua sự kiện input
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    var cur = w.Screens.current && w.Screens.current();
    if (!cur || !cur.typing) return;
    var t = (e.clipboardData || w.clipboardData).getData('text') || '';
    t = t.replace(/[\r\n]/g, '').trim();
    if (cur.typing.paste) cur.typing.paste(t);
    else t.split('').forEach(function (c) { cur.typing.ch(c); });
    e.preventDefault();
  });

  /* ---------- Chuột / màn hình cảm ứng (bản trình duyệt) ---------- */
  function setupPointer() {
    // Bấm vào ô nào thì chọn và mở ô đó
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (bootOn) { hideBoot(); return; }
      if (w.Player.isOpen()) {
        var ub = t.closest && t.closest('.upbtn');
        if (ub) { w.Player.upClick(ub.getAttribute('data-act')); return; }
        var pb = t.closest && t.closest('.plb');
        if (pb && pb._idx !== undefined) { w.Player.clickBtn(pb._idx); return; }
        if (t.closest && t.closest('#pl-close')) { w.Player.close(); return; }
        w.Player.key(13);   // bấm vào video: tạm dừng / phát
        return;
      }
      if (t.tagName === 'INPUT') return;
      if (t.closest && t.closest('.cdel:not(.on)')) return;   // nút ✕ xóa tự xử lý
      var f = t.closest && t.closest('.f');
      if (!f) return;
      w.lastKeyAt = Date.now();
      w.Nav.focus(f);
      w.Nav.ok();
    });
    // Lăn chuột / vuốt: di chuyển như mũi tên
    var wheelAt = 0;
    d.addEventListener('wheel', function (e) {
      if (w.Player.isOpen() || w.UI.isMobile()) return;   // điện thoại: cuộn tự nhiên
      var now = Date.now();
      if (now - wheelAt < 160) { e.preventDefault(); return; }
      wheelAt = now;
      var dx = e.deltaX, dy = e.deltaY;
      if (Math.abs(dx) > Math.abs(dy)) w.Nav.move(dx > 0 ? 'right' : 'left'); else w.Nav.move(dy > 0 ? 'down' : 'up');
      e.preventDefault();
    }, { passive: false });
    var tx = 0, ty = 0;
    d.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    d.addEventListener('touchend', function (e) {
      if (w.Player.isOpen() || w.UI.isMobile()) return;
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
      if (Math.abs(dx) > Math.abs(dy)) w.Nav.move(dx < 0 ? 'right' : 'left'); else w.Nav.move(dy < 0 ? 'down' : 'up');
    }, { passive: true });
    // Điện thoại: đầu trang kiểu app phim (logo giữa, nút nhanh, menu ☰ và 🔍)
    var ICON = {
      history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
      chans: '<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M15 14.5c3.2 0 6 1.9 6 5"/>',
      cats: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
      guide: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5h.01"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
    };
    function svgI(p) { return '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>'; }
    var mh = d.createElement('div');
    mh.id = 'mhead';
    var logo = d.querySelector('#topbar .brand').cloneNode(true);
    logo.className = 'mlogo';
    logo.innerHTML = logo.innerHTML.replace(/id="bg"/, 'id="bgm"').replace(/url\(#bg\)/, 'url(#bgm)');
    logo.onclick = function () { w.Screens.home(); };
    mh.appendChild(logo);
    var quick = d.createElement('div');
    quick.className = 'mquick';
    [['history', 'Lịch sử'], ['chans', 'Kênh'], ['cats', 'Thể loại'], ['guide', 'Hướng dẫn'], ['settings', 'Cài đặt']].forEach(function (q) {
      var b = d.createElement('div');
      b.className = 'mq';
      b.innerHTML = svgI(ICON[q[0]]) + '<span>' + q[1] + '</span>';
      b.onclick = function (e) { e.stopPropagation(); w.Screens.goTab(q[0]); };
      quick.appendChild(b);
    });
    mh.appendChild(quick);
    var bar = d.createElement('div');
    bar.className = 'mbar';
    bar.innerHTML = '<div class="mbtn mmenu"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg></div>' +
      '<div class="mtitle"></div>' +
      '<div class="mbtn msearch"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></div>';
    mh.appendChild(bar);
    d.getElementById('topbar').appendChild(mh);
    // ngăn kéo menu: tất cả các trang
    var dr = d.createElement('div');
    dr.id = 'mdrawer';
    dr.className = 'hidden';
    var panel = d.createElement('div');
    panel.className = 'mdpanel';
    function fillDrawer() {
      panel.innerHTML = '';
      var me = d.createElement('div');
      me.className = 'mditem who';
      me.textContent = '👤 ' + w.Store.profileName() + ' · Đổi hồ sơ';
      me.onclick = function (e) { e.stopPropagation(); dr.classList.add('hidden'); w.Screens.who(); };
      panel.appendChild(me);
      [].forEach.call(d.querySelectorAll('#tabs .tab'), function (t) {
        var it = d.createElement('div');
        it.className = 'mditem' + (t.classList.contains('active') ? ' on' : '');
        it.textContent = t.textContent;
        it.onclick = function (e) { e.stopPropagation(); dr.classList.add('hidden'); w.Screens.goTab(t.dataset.tab); };
        panel.appendChild(it);
      });
    }
    dr.appendChild(panel);
    dr.onclick = function (e) { e.stopPropagation(); dr.classList.add('hidden'); };
    d.getElementById('app').appendChild(dr);
    bar.querySelector('.mmenu').onclick = function (e) { e.stopPropagation(); fillDrawer(); dr.classList.remove('hidden'); };
    bar.querySelector('.msearch').onclick = function (e) { e.stopPropagation(); w.Screens.goTab('search'); };
    // cuộn xuống: thu gọn đầu trang
    d.addEventListener('scroll', function (e) {
      if (!w.UI.isMobile() || !e.target.classList || !e.target.classList.contains('view')) return;
      d.documentElement.classList.toggle('mscrolled', e.target.scrollTop > 60);
    }, true);
    setInterval(function () {
      var a = d.querySelector('#tabs .tab.active');
      bar.querySelector('.mtitle').textContent = a ? a.textContent : '';
    }, 400);

    // Nút Quay lại cho chuột / điện thoại
    var bk = d.createElement('div');
    bk.id = 'webback';
    bk.textContent = '‹ Quay lại';
    bk.onclick = function (e) { e.stopPropagation(); if (w.Player.isOpen()) w.Player.close(); else w.Screens.back(); };
    d.getElementById('app').appendChild(bk);
    d.documentElement.className += ' webmode';
    // Điện thoại: chỉ hiện nút Quay lại khi có trang để quay lại
    setInterval(function () {
      var need = w.Player.isOpen() || (w.Screens.depth && w.Screens.depth() > 1) || !w.UI.isMobile();
      bk.style.display = need ? '' : 'none';
      bk.classList.toggle('inplayer', w.Player.isOpen());
      bk.textContent = w.Player.isOpen() && w.UI.isMobile() ? '✕ Đóng' : '‹ Quay lại';
    }, 300);
  }

  // Ứng dụng Android gọi hàm này khi người dùng bấm phím trên remote
  w.androidKey = function (k) { onKey({ keyCode: k, preventDefault: function () {} }); };

  /* ---------- Màn hình khởi động: logo + "Đang lấy phim mới… 3/38 kênh" ----------
     Trang chủ tải ngầm phía sau. Xong hết kênh (hoặc quá 25 giây, hoặc bấm OK) thì tắt màn hình này,
     rồi hỏi "Ai đang xem?" nếu bật trong Cài đặt. */
  var bootOn = false, bootT = 0;
  function bootWatch() {
    var boot = d.getElementById('boot');
    if (!boot) { afterBoot(); return; }
    bootOn = true;
    var C = w.APP_CONFIG, msgE = d.getElementById('bootmsg'), fill = d.getElementById('bootfill'), hint = d.getElementById('boothint');
    var need = (C.CHANNELS || []).length + (C.SHOW_ANIME !== false ? (C.ANIME_CHANNELS || []).length : 0) + (C.SHOW_MOVIE !== false ? (C.MOVIE_CHANNELS || []).length : 0);
    var t0 = Date.now();
    function paint(n) {
      if (!bootOn) return;
      if (!w.Api.hasKey()) { msgE.textContent = 'Chế độ demo (chưa có YouTube API key)'; fill.style.width = '100%'; return; }
      if (w.navigator.onLine === false) { msgE.textContent = 'Mất mạng: đang mở danh sách phim đã lưu…'; }
      else if (!n) msgE.textContent = 'Đang tìm kênh theo dõi…';
      else msgE.textContent = 'Đang lấy phim mới… ' + Math.min(n, need) + '/' + need + ' kênh';
      fill.style.width = Math.max(4, Math.round(Math.min(1, n / Math.max(1, need)) * 100)) + '%';
    }
    paint(0);
    w.Api.onProgress(function (n) {
      paint(n);
      if (n >= need) bootDone(250);
    });
    if (!w.Api.hasKey() || !need) bootDone(900);
    setTimeout(function () { if (bootOn) hint.textContent = 'Bấm OK để vào ngay, phim sẽ tiếp tục tải phía sau'; }, 4000);
    bootT = setTimeout(function () {
      if (!bootOn) return;
      if (w.Log) w.Log.warn('Khởi động: sau 25 giây mới tải được ' + w.Api.progress().n + '/' + need + ' kênh (mạng chậm?)');
      bootDone(0);
    }, 25000);
    var minAt = t0 + 1800;   // hiện logo ít nhất 1,8 giây cho trọn hiệu ứng vương miện
    function bootDone(delay) {
      clearTimeout(bootT);
      setTimeout(hideBoot, Math.max(delay, minAt - Date.now()));
    }
  }
  function hideBoot() {
    if (!bootOn) return;
    bootOn = false;
    var boot = d.getElementById('boot');
    if (boot) {
      boot.classList.add('out');
      setTimeout(function () { if (boot.parentNode) boot.parentNode.removeChild(boot); }, 520);
    }
    afterBoot();
  }
  function afterBoot() {
    if (w.Season) setTimeout(w.Season.greetOnce, 600);
    if (w.APP_CONFIG.ASK_PROFILE !== false && w.Screens.who && !w.Player.isOpen()) w.Screens.who();
  }

  // Mất mạng / có mạng lại: báo ngay bằng câu dễ hiểu
  w.addEventListener('offline', function () { if (w.UI) w.UI.toast('Mất mạng: kiểm tra Wi-Fi hoặc dây mạng. Phim đã tải vẫn xem lại được trong danh sách.'); });
  w.addEventListener('online', function () { if (w.UI) w.UI.toast('Đã có mạng lại'); });

  // Khởi động ngay khi trang sẵn sàng (không chờ font/ảnh: TV mạng chậm vẫn mở nhanh)
  var started = false;
  function start() {
    if (started) return;
    started = true;
    // Bản 1.6.x trên Samsung ẩn nhầm các phim bị lỗi 153 -> hiện lại một lần
    if (!/^https?:/.test(w.location.protocol) && !w.Store.pref('fix153', false)) {
      w.Store.clearBlocked();
      w.Store.setPref('fix153', true);
    }
    w.lastKeyAt = Date.now();
    registerKeys();
    clock();
    setInterval(clock, 20000);
    d.addEventListener('keydown', onKey);
    if (!IS_TV) setupPointer();
    if (w.Log) w.Log.info('Mở app ' + w.APP_CONFIG.VERSION + ' · hồ sơ ' + w.Store.profileName());
    if (w.Season) w.Season.apply(true);
    bootWatch();
    w.Screens.init();
    if (w.Sync) w.Sync.init();
    // Mở từ mã QR sao lưu: địa chỉ có dạng .../#bk=TTQR1:... -> tự nhập rồi xóa phần mã khỏi thanh địa chỉ
    try {
      var hm = /^#bk=(TT(?:QR|BK)1:[A-Za-z0-9+\/=_-]+)/.exec(w.location.hash || '');
      if (hm && w.Sync && w.Sync.importAny) {
        try { w.history.replaceState(null, '', w.location.pathname + w.location.search); } catch (e2) { /* bỏ qua */ }
        w.Sync.importAny(hm[1]).then(function (r) {
          w.UI.toast('Đã nhập từ mã QR: ' + r.films + ' phim có tiến độ, ' + r.favs + ' phim trong danh sách');
          if (w.Screens.current && w.Screens.current().refresh) w.Screens.current().refresh();
        }, function (e3) {
          w.UI.toast(e3 && e3.nokey ? 'Cần nhập API key YouTube trong Cài đặt rồi quét lại mã QR' : 'Mã QR không đúng hoặc không nhập được');
        });
      }
    } catch (e1) { /* bỏ qua */ }
    if (!w.Api.hasKey()) w.UI.toast('Chế độ demo: chưa có YouTube API key. Vào Cài đặt → YouTube API key để nhập.');
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
  w.addEventListener('load', start);
})(window);
