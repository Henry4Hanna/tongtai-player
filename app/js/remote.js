/* Điều khiển TV bằng điện thoại: TV hiện mã QR, điện thoại mở trang remote trên máy chủ quản trị (STATS_URL).
   Điện thoại gửi lệnh -> máy chủ giữ hàng đợi -> TV hỏi mỗi 0,7 giây. TV gửi lại "đang phát gì" để điện thoại hiện.
   Hỏi liên tục tối đa 30 phút sau lệnh cuối, rồi tự ngừng (đỡ tốn lượt gọi máy chủ). */
(function (w) {
  'use strict';
  var d = document, room = '', tk = '', since = 0, pollT = 0, lastCmd = 0, busy = false, stT = 0, lastSt = '';
  function base() { return w.Tele && w.Tele.base ? w.Tele.base() : ''; }
  function req(path, body) {
    return fetch(base() + path, body ? { method: 'POST', body: JSON.stringify(body) } : {}).then(function (r) { return r.json(); });
  }
  function ensureRoom() {
    var sv = w.Store.keep('rc') || null;
    if (sv && sv.room && Date.now() - sv.t < 10 * 3600e3) { room = sv.room; tk = sv.tk; since = Math.max(since, sv.s || 0); return Promise.resolve(); }
    return req('/rc', { name: (w.DEVICE && w.DEVICE.name) || 'TV', dev: w.Tele && w.Tele.id ? w.Tele.id() : '' }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'lỗi');
      room = j.room; tk = j.tk; since = 0;
      w.Store.keep('rc', { room: room, tk: tk, t: Date.now() });
    });
  }
  function url() { return base() + '/remote/' + room; }
  function key(c) { if (w.androidKey) w.androidKey(c); }
  function run(c) {
    w.lastKeyAt = Date.now();
    var P = w.Player, S = w.Screens, k = c.k;
    if (P && P.stillAsk && P.stillAsk()) { P.stillOk(); return; }   // "Còn xem không?": bấm gì cũng là xem tiếp
    if (P && P.isOpen() && P.remote && P.remote(k)) return;
    switch (k) {
      case 'up': key(38); break; case 'down': key(40); break; case 'left': key(37); break; case 'right': key(39); break;
      case 'ok': key(13); break;
      case 'back': key(10009); break;
      case 'home': if (P && P.isOpen()) P.close(); S.home(); break;
      case 'history': case 'cats': case 'music': if (P && P.isOpen()) P.close(); S.goTab(k); break;
      case 'admin': if (P && P.isOpen()) P.close(); if (w.Tele.adminEmail && w.Tele.adminEmail()) S.adminTV(); break;
      case 'search':
        if (P && P.isOpen()) P.close();
        S.goTab('search');
        setTimeout(function () { var cur = S.current(); if (cur && cur.el && cur.el._remoteQ) cur.el._remoteQ(c.t || ''); }, 120);
        break;
    }
    // OK bằng remote ảo: giữ lâu không có, nhả ngay
    if (k === 'ok') { var ev = d.createEvent('Event'); ev.initEvent('keyup', true, true); ev.keyCode = 13; d.dispatchEvent(ev); }
    pushState(true);
  }
  function poll() {
    clearTimeout(pollT);
    if (!room || !base()) return;
    if (Date.now() - lastCmd > 30 * 60e3) { pollT = 0; return; }   // 30 phút không ai bấm: ngừng hỏi
    if (busy || d.hidden) { pollT = setTimeout(poll, 1500); return; }
    busy = true;
    req('/rc/' + room + '?tk=' + encodeURIComponent(tk) + '&since=' + since).then(function (j) {
      busy = false;
      if (j && j.ok) {
        (j.cmds || []).forEach(function (c) { since = Math.max(since, c.id); lastCmd = Date.now(); try { run(c); } catch (e) { /* bỏ qua */ } });
        if (j.last) since = Math.max(since, j.last);
        var sv2 = w.Store.keep('rc'); if (sv2 && sv2.s !== since) { sv2.s = since; w.Store.keep('rc', sv2); }
        if (j.phones) lastCmd = Math.max(lastCmd, Date.now() - 25 * 60e3);   // điện thoại còn mở trang remote
      } else if (j && j.error === 'room') { w.Store.keep('rc', null); room = ''; return; }
      pollT = setTimeout(poll, 700);
    }, function () { busy = false; pollT = setTimeout(poll, 3000); });
  }
  function state() {
    var P = w.Player, info = P && P.nowInfo ? P.nowInfo() : null, me = w.Store.profiles().filter(function (p) { return p.id === w.Store.profile(); })[0] || { name: 'Guest' };
    var cur = w.Screens.current && w.Screens.current();
    return { p: me.name, scr: cur ? cur.name : '', adm: !!(w.Tele.adminEmail && w.Tele.adminEmail()), now: info };
  }
  function pushState(soon) {
    clearTimeout(stT);
    stT = setTimeout(function () {
      if (!room || Date.now() - lastCmd > 30 * 60e3) return;
      var s = JSON.stringify(state());
      if (s !== lastSt) { lastSt = s; req('/rc/' + room + '/state', { tk: tk, st: JSON.parse(s), dev: w.Tele && w.Tele.id ? w.Tele.id() : '' }).catch(function () {}); }
      pushState(false);
    }, soon ? 300 : 3000);
  }
  function show() {
    if (!base()) { w.UI.toast('Cần bật Máy chủ thống kê (Cài đặt → Kết nối) để dùng điện thoại làm remote'); return; }
    ensureRoom().then(function () {
      lastCmd = Date.now(); poll(); pushState(true);
      var o = d.createElement('div'); o.id = 'rcqr';
      o.innerHTML = '<div class="rcbox"><div class="rcq">' + (w.QR ? w.QR.svg(url(), 320) : '') + '</div><div class="rct"><div class="rck">ĐIỀU KHIỂN BẰNG ĐIỆN THOẠI</div>' +
        '<div class="rch">Quét mã để dùng điện thoại làm remote</div><div class="rcl">• Mũi tên, OK, Quay lại, Trang chủ<br>• Tạm dừng, tua ±10 giây, phụ đề, tập sau<br>• Lịch sử, Thể loại, Nhạc, Quản trị<br>• Gõ chữ tìm phim bằng bàn phím điện thoại</div>' +
        '<div class="rcf">Mã phòng <b>' + room + '</b> · cả nhà quét cùng lúc được · bấm phím bất kỳ để đóng</div></div></div>';
      o.onclick = function () { hide(); };
      (d.getElementById('app') || d.body).appendChild(o);
      setTimeout(function () { d.addEventListener('keydown', hideK, true); }, 300);
    }).catch(function (e) { w.UI.toast('Chưa mở được remote: ' + (e && e.message || 'mạng?') + '. Máy chủ quản trị cần bản mới (deploy worker.js).'); });
  }
  function hideK(e) { hide(); if (e && e.stopPropagation) { e.stopPropagation(); e.preventDefault(); } }
  function hide() { var o = d.getElementById('rcqr'); if (o) o.parentNode.removeChild(o); d.removeEventListener('keydown', hideK, true); }
  // Mở app lại trong ngày: nếu đã có phòng thì nghe lệnh tiếp (điện thoại vẫn giữ trang remote)
  setTimeout(function () { var sv = w.Store.keep('rc'); if (sv && sv.room && Date.now() - sv.t < 10 * 3600e3 && base()) { room = sv.room; tk = sv.tk; since = sv.s || 0; lastCmd = Date.now() - 20 * 60e3; poll(); } }, 4000);
  w.Remote = { show: show, hide: hide, on: function () { return !!room; } };
})(window);
