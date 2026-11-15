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
  function isPhone() { return d.documentElement.classList.contains('mobile'); }
  // 2.39.1: mã phần cứng TV Samsung (DUID, đã băm): cài lại app vẫn được mã remote cũ
  function hwId() {
    try {
      var u = w.webapis && w.webapis.productinfo && w.webapis.productinfo.getDuid ? String(w.webapis.productinfo.getDuid() || '') : '';
      if (!u) return '';
      var h1 = 0x811c9dc5, h2 = 0x1b873593;
      for (var i = 0; i < u.length; i++) { var c = u.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
      return 'hw' + h1.toString(36) + h2.toString(36);
    } catch (e) { return ''; }
  }
  function regBody(extra) {
    var b = { name: (w.DEVICE && w.DEVICE.name) || 'TV', dev: w.Tele && w.Tele.id ? w.Tele.id() : '', hw: hwId() };
    for (var k in extra) b[k] = extra[k];
    return b;
  }
  // TV nhập lại mã cũ (ví dụ sau khi cài lại app) để remote đã lưu trên điện thoại dùng tiếp
  function claim(code) {
    return req('/rc', regBody({ want: String(code || '').toUpperCase() })).then(function (j) {
      if (!j.ok) throw new Error(j.error === 'busy' ? 'Mã này đang được một TV khác dùng' : (j.error || 'lỗi'));
      if (j.room !== room) since = 0;
      room = j.room; tk = j.tk;
      w.Store.keep('rc', { room: room, tk: tk, t: Date.now(), v2: 1, s: since });
      lastCmd = Date.now(); poll();
      return room;
    });
  }
  // 2.37.1: mã phòng cố định cho mỗi TV (máy chủ trả lại mã cũ theo mã thiết bị)
  function ensureRoom() {
    var sv = w.Store.keep('rc') || null;
    if (sv && sv.room && sv.v2) { room = sv.room; tk = sv.tk; since = Math.max(since, sv.s || 0); return Promise.resolve(); }
    return req('/rc', regBody({})).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'lỗi');
      if (j.room !== room) since = 0;
      room = j.room; tk = j.tk;
      w.Store.keep('rc', { room: room, tk: tk, t: Date.now(), v2: 1, s: since });
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
      case 'search': case 'vsearch':   // 2.39: vsearch = nói bằng giọng trên điện thoại: chỉ 1 phim khớp thì mở luôn
        if (P && P.isOpen()) P.close();
        S.goTab('search');
        setTimeout(function () { var cur = S.current(); if (cur && cur.el && cur.el._remoteQ) cur.el._remoteQ(c.t || ''); }, 120);
        if (k === 'vsearch') { w.UI.toast('🎤 Tìm bằng giọng nói: “' + (c.t || '') + '”', 3000); autoOne(); }
        break;
      case 'open': case 'later':   // 2.38: điện thoại gửi phim lên TV · 2.39: hoặc thêm vào Xem sau
        try {
          var v = JSON.parse(c.t || '{}');
          if (k === 'later') { if (S.addLater) S.addLater(v); }
          else if (v && v.id && S.openFromPhone) S.openFromPhone(v);
          else if (v && v.u && w.Api && w.Api.fromLink) w.Api.fromLink(v.u).then(function (f) { if (f.kind === 'anime') S.openItem(f); else S.openFromPhone({ id: f.id, t: f.title, img: f.thumb, ch: f.ch }); }, function (e) { w.UI.toast('Không mở được link: ' + ((e && e.message) || '')); });
        } catch (e) { /* bỏ qua */ }
        break;
      case 'sleep': if (P && P.isOpen() && P.cycleSleep) P.cycleSleep(); break;   // 2.38: hẹn giờ tắt phim
      case 'dice': if (P && P.isOpen()) P.close(); if (S.dice) S.dice(); break;     // 2.38: bốc thăm
    }
    // OK bằng remote ảo: giữ lâu không có, nhả ngay
    if (k === 'ok') { var ev = d.createEvent('Event'); ev.initEvent('keyup', true, true); ev.keyCode = 13; d.dispatchEvent(ev); }
    pushState(true);
  }
  // tìm bằng giọng nói: đợi kết quả, chỉ có đúng 1 phim thì mở
  function autoOne() {
    var n = 0;
    setTimeout(function chk() {
      var cur = w.Screens.current && w.Screens.current();
      if (!cur || cur.name !== 'search' || ++n > 14) return;
      var cards = cur.el.querySelectorAll('.spane .card:not(.skel)');
      if (!cards.length) { setTimeout(chk, 500); return; }
      if (cards.length === 1 && cards[0]._ok) { w.UI.toast('Chỉ có 1 phim khớp, mở luôn'); cards[0]._ok(); }
    }, 1400);
  }
  function poll() {
    clearTimeout(pollT);
    if (!room || !base()) return;
    var idle = Date.now() - lastCmd > 30 * 60e3;   // 30 phút không ai bấm: hỏi thưa (10 giây) để điện thoại vẫn đánh thức được TV
    if (busy || d.hidden) { pollT = setTimeout(poll, 1500); return; }
    busy = true;
    req('/rc/' + room + '?tk=' + encodeURIComponent(tk) + '&since=' + since).then(function (j) {
      busy = false;
      if (j && j.ok) {
        (j.cmds || []).forEach(function (c) { since = Math.max(since, c.id); lastCmd = Date.now(); try { run(c); } catch (e) { /* bỏ qua */ } });
        if (j.last) since = Math.max(since, j.last);
        var sv2 = w.Store.keep('rc'); if (sv2 && sv2.s !== since) { sv2.s = since; w.Store.keep('rc', sv2); }
        if (j.phones) lastCmd = Math.max(lastCmd, Date.now() - 25 * 60e3);   // điện thoại còn mở trang remote
      } else if (j && j.error === 'room') { w.Store.keep('rc', null); room = ''; ensureRoom().then(poll, function () {}); return; }
      if (j && j.cmds && j.cmds.length) pushState(true);
      pollT = setTimeout(poll, Date.now() - lastCmd > 30 * 60e3 ? 10000 : 700);
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
        '<div class="rcf">Mã TV <b>' + room + '</b> · trong app trên điện thoại: menu ☰ → <b>Remote TV</b> → nhập mã này (nối 1 lần là nhớ) · bấm phím bất kỳ để đóng</div></div></div>';
      o.onclick = function () { hide(); };
      (d.getElementById('app') || d.body).appendChild(o);
      setTimeout(function () { d.addEventListener('keydown', hideK, true); }, 300);
    }).catch(function (e) { w.UI.toast('Chưa mở được remote: ' + (e && e.message || 'mạng?') + '. Máy chủ quản trị cần bản mới (deploy worker.js).'); });
  }
  function hideK(e) { hide(); if (e && e.stopPropagation) { e.stopPropagation(); e.preventDefault(); } }
  function hide() { var o = d.getElementById('rcqr'); if (o) o.parentNode.removeChild(o); d.removeEventListener('keydown', hideK, true); }
  // Mở app lại trong ngày: nếu đã có phòng thì nghe lệnh tiếp (điện thoại vẫn giữ trang remote)
  // TV (không phải điện thoại): luôn nghe lệnh, thưa khi không ai bấm. Điện thoại nối 1 lần là điều khiển được
  setTimeout(function () { if (!base() || isPhone()) return; ensureRoom().then(function () { lastCmd = Date.now() - 31 * 60e3; poll(); }, function () {}); }, 4000);
  w.Remote = { show: show, hide: hide, on: function () { return !!room; }, claim: claim, code: function () { return ensureRoom().then(function () { return room; }); } };
})(window);

/* ---------- 2.37.1: Remote TV trong menu điện thoại ----------
   Nối 1 lần (nhập mã 4 chữ trên TV hoặc chọn TV hồ sơ này hay xem), app nhớ. Remote mở ngay trong app (khung trang remote của máy chủ). */
(function (w) {
  'use strict';
  var d = document;
  var icN = 0;
  function icon() { icN++; return ICON.replace(/rcg/g, 'rcg' + icN); }
  var ICON = '<svg viewBox="0 0 64 64" width="100%" height="100%"><defs><linearGradient id="rcg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FAD680"/><stop offset="1" stop-color="#C48026"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#rcg)"/><rect x="20" y="6" width="24" height="52" rx="12" fill="#221206"/><path d="M24.5 15.5l3.2 2.2 4.3-5 4.3 5 3.2-2.2-1.2 6.5h-12.6z" fill="url(#rcg)"/><circle cx="32" cy="33" r="7.5" fill="none" stroke="url(#rcg)" stroke-width="2.4"/><path d="M30 29.8v6.4l5-3.2z" fill="url(#rcg)"/><circle cx="27" cy="47" r="2.2" fill="url(#rcg)"/><circle cx="37" cy="47" r="2.2" fill="url(#rcg)"/></svg>';
  function base() { return w.Tele && w.Tele.base ? w.Tele.base() : ''; }
  function get(p) { return fetch(base() + p).then(function (r) { return r.json().then(function (j) { if (!r.ok && !j.error) j.error = r.status; return j; }); }); }
  function pair() { return w.Store.keep('rcpair') || null; }
  function esc(t) { return String(t || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(cls, html) { var e = d.createElement('div'); e.className = cls; if (html != null) e.innerHTML = html; return e; }
  // Dòng "Remote TV" trong menu (chỉ điện thoại)
  function menuItem(close) {
    var p = pair();
    var it = el('mditem mdrc', '<span class="mdrci">' + icon() + '</span><span class="mdrct"><b>Remote TV</b><small>' + (p ? esc(p.name || 'TV') : 'Chưa nối TV · bấm để nối') + '</small></span><span class="mdrcs"></span>');
    it.onclick = function (e) { e.stopPropagation(); close(); open(); };
    if (p && base()) get('/rc/' + p.room).then(function (j) {
      if (j && j.ok) { if (j.name && j.name !== p.name) { p.name = j.name; w.Store.keep('rcpair', p); it.querySelector('small').textContent = p.name; } if (j.alive) it.querySelector('.mdrcs').innerHTML = '<i>ĐANG MỞ</i>'; }
    }).catch(function () {});
    return it;
  }
  function open() {
    if (!base()) { w.UI.toast('Cần bật Máy chủ thống kê (Cài đặt → Kết nối) để dùng Remote TV', 4000); return; }
    var p = pair();
    if (!p) { sheet(); return; }
    get('/rc/' + p.room).then(function (j) {
      if (j && j.ok) { remote(p, j); return; }
      w.Store.keep('rcpair', null);
      w.UI.toast('TV đã đổi mã, nối lại nhé', 3500); sheet();
    }, function () { remote(p, null); });
  }
  function overlay(cls) { var o = el('rcov ' + cls); (d.getElementById('app') || d.body).appendChild(o); setTimeout(function () { o.classList.add('on'); }, 20); return o; }
  function shut(o) { o.classList.remove('on'); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 250); }
  function sheet() {
    var o = overlay('rcsheet');
    var s = el('rcs', '<div class="rchandle"></div><h3><span class="rcico">' + icon() + '</span>Nối với TV</h3>' +
      '<div class="rcp">Trên TV bấm nút <b>Xanh lá</b> trên remote (hoặc Cài đặt → Remote → Điều khiển bằng điện thoại). Nhập <b>mã 4 chữ</b> hiện trên TV:</div>');
    var inp = d.createElement('input'); inp.className = 'rccode'; inp.maxLength = 4; inp.autocapitalize = 'characters'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.placeholder = '____'; inp.setAttribute('inputmode', 'text');
    s.appendChild(inp);
    var msg = el('rcmsg', ''), go = el('rcgo', 'Nối');
    s.appendChild(go); s.appendChild(msg);
    var lst = el('rclist', ''); s.appendChild(lst);
    s.appendChild(el('rcp rcfoot', 'Nối 1 lần là app nhớ. TV đổi mã thì app tự hỏi lại.'));
    o.appendChild(s);
    o.onclick = function (e) { if (e.target === o) shut(o); };
    function done(room, name) { w.Store.keep('rcpair', { room: room, name: name || 'TV' }); shut(o); open(); }
    go.onclick = function () {
      var c = String(inp.value || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
      if (c.length !== 4) { msg.textContent = 'Mã gồm 4 chữ, ví dụ F9EJ'; return; }
      msg.textContent = 'Đang nối…';
      get('/rc/' + c).then(function (j) { if (j && j.ok) done(c, j.name); else msg.textContent = 'Không thấy TV có mã ' + c + '. Kiểm tra lại mã trên TV.'; }, function () { msg.textContent = 'Mất mạng, thử lại.'; });
    };
    inp.oninput = function () { inp.value = String(inp.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); if (inp.value.length === 4) go.onclick(); };
    var pid = w.Store.profile();
    if (pid && pid !== 'guest') get('/rc/pair?p=' + encodeURIComponent(pid)).then(function (j) {
      var l = (j && j.list) || []; if (!l.length) return;
      lst.appendChild(el('rcor', 'hoặc chọn TV ' + esc((w.Store.profiles().filter(function (x) { return x.id === pid; })[0] || {}).name || '') + ' hay xem'));
      l.forEach(function (t) {
        var r = el('rctv', '📺 <b>' + esc(t.name) + '</b>' + (t.live ? '<small>ĐANG MỞ</small>' : '<small class="off">đang tắt</small>'));
        r.onclick = function () { done(t.room, t.name); };
        lst.appendChild(r);
      });
    }).catch(function () {});
  }
  function remote(p, j) {
    var o = overlay('rcfull');
    var hd = el('rch', '<span class="rcico">' + icon() + '</span><span class="rcht"><b>' + esc(p.name || 'TV') + '</b><small class="' + (j && j.alive ? 'on' : '') + '">' + (j && j.alive ? '● Đã nối' : '● TV đang tắt hoặc chưa mở app') + '</small></span><span class="rcchg">Đổi TV</span><span class="rcx">✕</span>');
    o.appendChild(hd);
    var f = d.createElement('iframe'); f.className = 'rcframe'; f.src = base() + '/remote/' + p.room + '?app=1'; f.setAttribute('allow', 'clipboard-write; microphone');   // 2.39: nói để tìm phim
    o.appendChild(f);
    hd.querySelector('.rcx').onclick = function () { shut(o); };
    hd.querySelector('.rcchg').onclick = function () { w.Store.keep('rcpair', null); shut(o); setTimeout(sheet, 260); };
    var t = setInterval(function () {
      if (!o.parentNode) { clearInterval(t); return; }
      get('/rc/' + p.room).then(function (k) { var sm = hd.querySelector('small'); if (!k || !k.ok) return; sm.className = k.alive ? 'on' : ''; sm.textContent = k.alive ? '● Đã nối' : '● TV đang tắt hoặc chưa mở app'; }).catch(function () {});
    }, 8000);
  }
  // 2.38: gửi phim lên TV đã nối
  function send(v, kind) {
    var p = pair(); if (!p || !base()) { w.UI.toast('Chưa nối TV: menu ☰ → Remote TV'); return; }
    var lt = kind === 'later';
    fetch(base() + '/rc/' + p.room, { method: 'POST', body: JSON.stringify({ k: lt ? 'later' : 'open', t: JSON.stringify(v).slice(0, 600) }) })
      .then(function (r) { return r.json(); }).then(function (j) { w.UI.toast(j && j.ok ? (lt ? '📥 Đã thêm vào Xem sau trên ' + (p.name || 'TV') : '📺 Đã gửi lên ' + (p.name || 'TV') + '. TV đang mở app sẽ phát trong vài giây') : 'Chưa gửi được: ' + ((j && j.error) || '')); })
      .catch(function () { w.UI.toast('Mất mạng, thử lại'); });
  }
  w.RemoteTV = { menuItem: menuItem, open: open, icon: ICON, send: send };
})(window);
