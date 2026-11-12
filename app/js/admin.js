/* Trang quản trị Tổng Tài TV: đăng nhập Google, đọc số liệu từ máy chủ thống kê (Cloudflare Worker). */
(function (w, d) {
  'use strict';
  var C = w.APP_CONFIG || {};
  var COLORS = ['#2F6FDE', '#E8590C', '#2B8A3E', '#9C36B5', '#C2255C', '#0B7285', '#B08900', '#D9302C'];
  var SCREENS = { home: 'Trang chủ', music: 'Nhạc', songs: 'Nhạc', lrcsync: 'Nhạc', songlist: 'Nhạc', search: 'Tìm kiếm', chans: 'Duyệt phim', cats: 'Duyệt phim', detail: 'Duyệt phim', history: 'Duyệt phim', settings: 'Cài đặt', who: 'Chọn hồ sơ', guide: 'Hướng dẫn', info: 'Hướng dẫn' };
  var state = { days: 30, view: 'overview', profile: '', colorOf: {}, token: '' };
  var $ = function (id) { return d.getElementById(id); };
  function el(tag, cls, html) { var e = d.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hm(min) { min = Math.round(min || 0); return min >= 60 ? Math.floor(min / 60) + ' giờ ' + ('0' + min % 60).slice(-2) + ' phút' : min + ' phút'; }
  function nf(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function when(ts) {
    if (!ts) return '';
    var t = new Date(ts), n = new Date(), hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
    var dd = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
    if (dd === 0) return 'Hôm nay ' + hh; if (dd === 1) return 'Hôm qua ' + hh;
    return t.getDate() + '/' + (t.getMonth() + 1) + ' ' + hh;
  }
  function place(x) { return [x.city, x.region, x.country === 'US' ? 'Hoa Kỳ' : x.country === 'VN' ? 'Việt Nam' : x.country].filter(Boolean).join(', '); }
  // hồ sơ của app trên cùng trình duyệt (cùng trang GitHub Pages): lấy hình thú và màu riêng từng hồ sơ
  var LOCALP = {}; (function () { try { ((JSON.parse(localStorage.getItem('tt.prefs') || '{}').profiles) || []).forEach(function (p) { if (p && p.id) LOCALP[p.id] = p; }); } catch (e) { /* bỏ qua */ } })();
  function initColors() { if (w.Avatars && w.Avatars.colors) { var list = Object.keys(LOCALP).map(function (k) { return LOCALP[k]; }); state.colorOf = w.Avatars.colors(list, COLORS); } }
  function color(id) {   // mỗi hồ sơ một màu khác nhau
    if (!state.colorOf[id]) { var used = {}; Object.keys(state.colorOf).forEach(function (k) { used[state.colorOf[k]] = 1; }); state.colorOf[id] = COLORS.filter(function (c) { return !used[c]; })[0] || COLORS[Object.keys(state.colorOf).length % COLORS.length]; }
    return state.colorOf[id];
  }
  function av(name, id, s) {
    s = s || 32;
    var lp = LOCALP[id];
    if (lp && lp.av != null && w.Avatars) return '<span class="av pic" style="width:' + s + 'px;height:' + s + 'px;box-shadow:0 0 0 2px ' + color(id) + '">' + w.Avatars.svg(lp.av, s) + '</span>';
    return '<span class="av" style="width:' + s + 'px;height:' + s + 'px;background:' + color(id) + '">' + esc(String(name || '?').charAt(0).toUpperCase()) + '</span>';
  }

  /* ---------- cấu hình: máy chủ + Client ID (config.js, cài đặt app trên máy này, hoặc nhập tay) ---------- */
  function appSettings() { try { return (JSON.parse(localStorage.getItem('tt.prefs') || '{}').settings) || {}; } catch (e) { return {}; } }
  function cfg() {
    var a = {}; try { a = JSON.parse(localStorage.getItem('tt.admin') || '{}'); } catch (e) { a = {}; }
    var s = appSettings();
    return { url: String(a.url || C.STATS_URL || s.STATS_URL || '').replace(/\/+$/, ''), cid: String(a.cid || C.GOOGLE_WEB_CLIENT_ID || s.GOOGLE_WEB_CLIENT_ID || '').trim() };
  }
  function showSetup(on) {
    var c = cfg();
    $('setup').style.display = on ? 'flex' : 'none';
    $('f-url').value = c.url; $('f-cid').value = c.cid;
  }
  $('f-save').onclick = function () {
    localStorage.setItem('tt.admin', JSON.stringify({ url: $('f-url').value.trim(), cid: $('f-cid').value.trim() }));
    location.reload();
  };
  $('f-show').onclick = function () { showSetup($('setup').style.display === 'none'); };

  /* ---------- đăng nhập Google ---------- */
  function loginMsg(t) { $('lmsg').textContent = t || ''; }
  function showLogin(msg) {
    $('app').style.display = 'none'; $('login').style.display = 'flex';
    loginMsg(msg);
    var c = cfg();
    if (!c.url || !c.cid) { showSetup(true); loginMsg('Điền địa chỉ máy chủ và Google Client ID trước.'); return; }
    var s = d.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = function () {
      w.google.accounts.id.initialize({ client_id: c.cid, callback: function (r) { state.token = r.credential; sessionStorage.setItem('tt.admintok', r.credential); start(); }, auto_select: true });
      w.google.accounts.id.renderButton($('gbtn'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', width: 300 });
      w.google.accounts.id.prompt();
    };
    s.onerror = function () { loginMsg('Không tải được nút đăng nhập Google. Kiểm tra mạng.'); };
    d.head.appendChild(s);
  }
  $('logout').onclick = function () {
    sessionStorage.removeItem('tt.admintok'); state.token = '';
    try { w.google.accounts.id.disableAutoSelect(); } catch (e) { /* bỏ qua */ }
    location.reload();
  };

  function api(path, opt) {
    var c = cfg(), sep = path.indexOf('?') < 0 ? '?' : '&';
    return fetch(c.url + path + sep + 'days=' + state.days + '&tz=' + new Date().getTimezoneOffset(), Object.assign({ headers: { Authorization: 'Bearer ' + state.token, 'Content-Type': 'application/json' } }, opt || {}))
      .then(function (r) {
        if (r.status === 401) { sessionStorage.removeItem('tt.admintok'); showLogin('Phiên đăng nhập đã hết, đăng nhập lại.'); throw new Error('login'); }
        if (r.status === 403) { return r.json().then(function (j) { sessionStorage.removeItem('tt.admintok'); showLogin('Tài khoản ' + (j.email || '') + ' không có quyền truy cập.'); throw new Error('denied'); }); }
        return /csv/.test(path) ? r.blob() : r.json();
      });
  }

  function start() {
    api('/a/me').then(function (j) {
      state.me = j.me; $('login').style.display = 'none'; $('app').style.display = 'flex';
      $('me-name').textContent = j.me.name || ''; $('me-mail').textContent = j.me.email || '';
      if (j.me.picture) $('me-pic').src = j.me.picture; else $('me-pic').style.display = 'none';
      go(state.view);
    }).catch(function (e) { if (e.message !== 'login' && e.message !== 'denied') showLogin('Không kết nối được máy chủ thống kê: ' + e.message); });
  }

  /* ---------- điều hướng ---------- */
  var navs = d.querySelectorAll('.nav');
  Array.prototype.forEach.call(navs, function (b) { b.onclick = function () { go(b.getAttribute('data-v')); }; });
  Array.prototype.forEach.call(d.querySelectorAll('#range .pill[data-d]'), function (b) {
    b.onclick = function () {
      state.days = +b.getAttribute('data-d');
      Array.prototype.forEach.call(d.querySelectorAll('#range .pill[data-d]'), function (x) { x.classList.toggle('on', x === b); });
      go(state.view);
    };
  });
  $('pdf').onclick = function () { state.autoPrint = true; go('report'); };
  $('csv').onclick = function () {
    api('/a/csv').then(function (blob) {
      var a = d.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tongtai-xem-phim-' + state.days + '-ngay.csv'; d.body.appendChild(a); a.click(); a.remove();
    });
  };
  var liveT = 0;
  function go(v) {
    state.view = v;
    Array.prototype.forEach.call(navs, function (b) { b.classList.toggle('on', b.getAttribute('data-v') === v); });
    clearInterval(liveT);
    var view = $('view'); view.innerHTML = '<div class="empty">Đang tải…</div>';
    var rl = state.days === 1 ? 'hôm nay' : state.days + ' ngày qua';
    if (v === 'overview') {
      $('title').textContent = 'Tổng quan'; $('subtitle').textContent = 'Cả nhà · ' + rl;
      loadOverview(); liveT = setInterval(loadOverview, 30000);
    } else if (v === 'devices') {
      $('title').textContent = 'Thiết bị và IP'; $('subtitle').textContent = 'Thiết bị đã kết nối, địa chỉ IP, vị trí gần đúng · ' + rl;
      loadDevices();
    } else if (v === 'report') {
      $('title').textContent = 'Báo cáo PDF'; $('subtitle').textContent = 'Bản tóm tắt để lưu hoặc in · ' + rl;
      loadReport();
    } else {
      $('title').textContent = 'Hồ sơ'; $('subtitle').textContent = 'Xem gì, lúc nào, trên máy nào, dùng bao nhiêu đơn vị YouTube · ' + rl;
      loadProfile();
    }
  }


  /* ---------- Báo cáo PDF: tóm tắt cả nhà + từng hồ sơ + thiết bị, in hoặc lưu PDF ---------- */
  function dmy(t) { var x = new Date(t); return x.getDate() + '/' + (x.getMonth() + 1) + '/' + x.getFullYear(); }
  function loadReport() {
    var me = state.me || {};
    Promise.all([api('/a/overview'), api('/a/devices')]).then(function (r) {
      var o = r[0], dv = r[1];
      o.profiles.forEach(function (p) { color(p.id); });
      return Promise.all(o.profiles.map(function (p) { return api('/a/profile?id=' + encodeURIComponent(p.id)); })).then(function (ps) {
        if (state.view !== 'report') return;
        var v = $('view'); v.innerHTML = ''; v.style.cssText = 'display:flex;flex-direction:column;gap:16px';
        var bar = el('div', 'rbar card');
        bar.appendChild(el('div', '', '<b>Lưu thành PDF</b><div class="muted">Bấm “In / Lưu PDF”, rồi chọn máy in <b>“Lưu dưới dạng PDF”</b> (Save as PDF). Trên iPhone: Chia sẻ → In → chụm hai ngón ra để lưu PDF.</div>'));
        var pb = el('button', 'btn dark', '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>In / Lưu PDF');
        pb.onclick = function () { w.print(); };
        bar.appendChild(pb); v.appendChild(bar);
        var R = el('div', 'report');
        var to = Date.now(), from = to - (o.range.days - 1) * 864e5;
        var k = o.kpi;
        var h = '<div class="rhead"><div class="logo" style="width:46px;height:46px;border-radius:12px">' + d.querySelector('.brand .logo').innerHTML + '</div><div style="flex:1"><div class="rk">TỔNG TÀI TV · BÁO CÁO SỬ DỤNG</div><div class="rt">' + (o.range.days === 1 ? 'Hôm nay ' + dmy(to) : dmy(from) + ' – ' + dmy(to) + ' (' + o.range.days + ' ngày)') + '</div></div><div class="muted" style="text-align:right">Lập lúc ' + when(to) + '<br>' + esc(me.email || '') + '</div></div>';
        h += '<div class="rkpis">' + [['Tổng giờ xem', hm(k.minutes), 'TB ' + hm(k.minutes / Math.max(1, o.range.days)) + '/ngày'], ['Phim đã xem', k.films, 'của cả nhà'], ['Hồ sơ dùng app', k.profiles, o.profiles[0] ? o.profiles[0].name + ' xem nhiều nhất' : ''], ['Thiết bị', k.devicesActive, dv.devices.filter(function (x) { return x.blocked; }).length + ' đang bị chặn']].map(function (x) { return '<div><div class="t">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="s">' + esc(x[2]) + '</div></div>'; }).join('') + '</div>';
        R.appendChild(el('div', '', h));
        var series = o.profiles.map(function (p) { return { key: p.id, name: p.name, color: color(p.id) }; });
        var ch = el('section', 'rsec'); ch.appendChild(el('h3', '', 'Thời gian xem mỗi ngày'));
        ch.appendChild(el('div', 'legend', series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('')));
        ch.appendChild(barChart(o.daily, series, 170)); R.appendChild(ch);
        var tot = o.profiles.reduce(function (a, p) { return a + p.minutes; }, 0) || 1;
        R.appendChild(el('section', 'rsec', '<h3>Hồ sơ</h3><table><thead><tr><th>Hồ sơ</th><th>Giờ xem</th><th>Tỉ lệ</th><th>Phim</th><th>Đơn vị YouTube</th><th>Thiết bị</th></tr></thead><tbody>' + o.profiles.map(function (p, i) {
          var u = ps[i].units.reduce(function (a, x) { return a + (x.u || 0); }, 0);
          return '<tr><td><span class="who">' + av(p.name, p.id, 26) + esc(p.name) + '</span></td><td><b>' + hm(p.minutes) + '</b></td><td>' + Math.round(p.minutes / tot * 100) + '%</td><td>' + p.films + '</td><td>' + nf(u) + '</td><td class="muted">' + esc(p.devices.join(', ')) + '</td></tr>';
        }).join('') + '</tbody></table>'));
        o.profiles.forEach(function (p, i) {
          var j = ps[i], col = color(p.id), m = j.daily.reduce(function (a, x) { return a + x.m; }, 0);
          var done = j.films.filter(function (f) { return f.dur && f.pos / f.dur > 0.9; }).length;
          var u = j.units.reduce(function (a, x) { return a + (x.u || 0); }, 0);
          var mx = Math.max.apply(null, j.hours.concat([1])), top = j.hours.indexOf(mx);
          var cs = j.channels.reduce(function (a, x) { return a + x.s; }, 0) || 1;
          var s = el('section', 'rsec rprof');
          s.innerHTML = '<h3 class="who" style="gap:12px">' + av(p.name, p.id, 34) + esc(p.name) + '</h3>' +
            '<div class="rkpis sm">' + [['Giờ xem', hm(m)], ['Phim', j.films.length + ' (' + done + ' xem hết)'], ['Đơn vị YouTube', nf(u)], ['Giờ hay xem', mx > 1 ? top + '–' + (top + 1) + ' giờ' : '—']].map(function (x) { return '<div><div class="t">' + x[0] + '</div><div class="v">' + x[1] + '</div></div>'; }).join('') + '</div>' +
            '<div class="heat" style="margin:12px 0 4px">' + j.hours.map(function (x, hh) { return '<div><i style="height:22px;background:' + col + ';opacity:' + (0.08 + 0.92 * x / mx).toFixed(2) + '"></i>' + (hh % 3 === 0 ? hh : '&nbsp;') + '</div>'; }).join('') + '</div>' +
            '<div class="rcols"><div><h4>Kênh xem nhiều</h4>' + (j.channels.slice(0, 5).map(function (x) { return '<div class="rl"><span>' + esc(x.ch) + '</span><b>' + Math.round(x.s / cs * 100) + '%</b></div>'; }).join('') || '<div class="muted">Chưa có.</div>') + '</div>' +
            '<div><h4>Hay tìm</h4>' + (j.searches.length ? '<div class="chips">' + j.searches.slice(0, 8).map(function (q) { return '<span>' + esc(q.q) + (q.n > 1 ? ' ×' + q.n : '') + '</span>'; }).join('') + '</div>' : '<div class="muted">Không tìm kiếm.</div>') +
            '<h4 style="margin-top:12px">Thiết bị</h4><div class="muted">' + esc(j.devices.map(function (x) { return x.label; }).join(', ') || '—') + '</div></div></div>' +
            '<h4>Phim xem gần đây</h4>' + (j.films.length ? '<table><thead><tr><th>Phim</th><th>Lúc</th><th>Xem</th><th>Tiến độ</th></tr></thead><tbody>' + j.films.slice(0, 8).map(function (f) { var pc = f.dur ? Math.min(100, Math.round(f.pos / f.dur * 100)) : 0; return '<tr><td><b>' + esc(f.title) + '</b><div class="muted">' + esc(f.ch) + '</div></td><td class="muted">' + when(f.last) + '</td><td>' + hm(f.s / 60) + '</td><td>' + (pc >= 90 ? 'Xem hết' : pc + '%') + '</td></tr>'; }).join('') + '</tbody></table>' + (j.films.length > 8 ? '<div class="muted" style="margin-top:6px">… và ' + (j.films.length - 8) + ' phim khác.</div>' : '') : '<div class="muted">Chưa xem phim nào.</div>');
          R.appendChild(s);
        });
        R.appendChild(el('section', 'rsec rbreak', '<h3>Thiết bị và địa chỉ IP</h3><table><thead><tr><th>Thiết bị</th><th>IP · nhà mạng</th><th>Vị trí (gần đúng)</th><th>Hồ sơ</th><th>Lần cuối</th></tr></thead><tbody>' + dv.devices.map(function (x) {
          return '<tr><td><b>' + esc(x.name || x.label) + '</b>' + (x.blocked ? ' <span class="tag block">Đã chặn</span>' : x.trusted ? ' <span class="tag ok">Người nhà</span>' : ' <span class="tag new">Chưa xác nhận</span>') + '<div class="muted">' + esc(x.label) + '</div></td><td class="mono">' + esc(x.ip) + '<div class="muted">' + esc(x.isp || '') + '</div></td><td>' + esc(place(x)) + '</td><td>' + esc(x.profiles.map(function (q) { return q.name; }).join(', ')) + '</td><td class="muted">' + when(x.last_seen) + '</td></tr>';
        }).join('') + '</tbody></table><div class="muted" style="margin-top:14px">Vị trí tính từ địa chỉ IP nên chỉ gần đúng tới thành phố. Đơn vị YouTube tính từ khi bật máy chủ thống kê. Báo cáo chỉ dành cho người quản trị.</div>'));
        v.appendChild(R);
        if (state.autoPrint) { state.autoPrint = false; setTimeout(function () { w.print(); }, 600); }
      });
    }).catch(function (e) { if (e.message !== 'login' && e.message !== 'denied') $('view').innerHTML = '<div class="empty">Lỗi: ' + esc(e.message) + '</div>'; });
  }

  /* ---------- biểu đồ cột ---------- */
  var tip = $('tip');
  function showTip(e, html) { tip.innerHTML = html; tip.style.display = 'block'; tip.style.left = Math.min(innerWidth - 220, e.clientX + 12) + 'px'; tip.style.top = (e.clientY + 12) + 'px'; }
  function hideTip() { tip.style.display = 'none'; }
  function barChart(days, series, height) {
    // days: [{day, by:{key:min}}], series: [{key, name, color}]
    var mx = 30;
    days.forEach(function (x) { var s = 0; series.forEach(function (k) { s += x.by[k.key] || 0; }); mx = Math.max(mx, s); });
    var step = mx <= 60 ? 15 : mx <= 180 ? 60 : mx <= 480 ? 120 : 240;
    mx = Math.ceil(mx / step) * step;
    var box = el('div', 'chart'); box.style.height = height + 'px';
    for (var v = 0; v <= mx; v += step) { var g = el('div', 'grid', '<span>' + (step >= 60 ? (v / 60) + ' giờ' : v + ' ph') + '</span>'); g.style.bottom = (v / mx * height) + 'px'; box.appendChild(g); }
    var bars = el('div', 'bars'); box.appendChild(bars);
    var every = days.length > 45 ? 10 : days.length > 14 ? 5 : 1;
    days.forEach(function (x, i) {
      var b = el('div', 'bar'), st = el('div', 'stack'), tot = 0, lines = [];
      series.slice().reverse().forEach(function (k) {
        var m = x.by[k.key] || 0; if (!m) return; tot += m;
        var s = el('div'); s.style.height = (m / mx * height) + 'px'; s.style.background = k.color; st.appendChild(s);
      });
      series.forEach(function (k) { if (x.by[k.key]) lines.push('<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:' + k.color + ';margin-right:6px"></i>' + esc(k.name) + ': ' + hm(x.by[k.key])); });
      b.appendChild(st);
      var dt = new Date(x.day + 'T12:00:00');
      if (i % every === 0 || i === days.length - 1) b.appendChild(el('div', 'lab', dt.getDate() + '/' + (dt.getMonth() + 1)));
      b.onmousemove = function (e) { showTip(e, '<b>' + dt.getDate() + '/' + (dt.getMonth() + 1) + ' · ' + hm(tot) + '</b><br>' + (lines.join('<br>') || 'Không xem')); };
      b.onmouseleave = hideTip;
      bars.appendChild(b);
    });
    return box;
  }
  function card(title, sub) { var c = el('section', 'card'); c.appendChild(el('h2', '', esc(title) + (sub ? '<span>' + esc(sub) + '</span>' : ''))); return c; }

  /* ---------- Tổng quan ---------- */
  function loadOverview() {
    api('/a/overview').then(function (j) {
      if (state.view !== 'overview') return;
      var v = $('view'); v.innerHTML = ''; v.style.cssText = 'display:flex;flex-direction:column;gap:16px';
      j.profiles.forEach(function (p) { color(p.id); });
      (j.newDevices || []).forEach(function (x) {
        var a = el('section', 'alert', '<div style="flex:1 1 320px"><b>Thiết bị mới: ' + esc(x.label) + '</b><div class="muted">' + esc(place(x)) + ' · <span class="mono">' + esc(x.ip) + '</span> · hồ sơ ' + esc(x.pname || '') + ' · ' + when(x.first_seen) + '</div></div>');
        var ok = el('button', 'btn', 'Đây là người nhà'); ok.onclick = function () { act(x.id, 'trust').then(loadOverview); };
        var bl = el('button', 'btn warn', 'Chặn thiết bị này'); bl.onclick = function () { if (confirm('Chặn ' + x.label + '? Thiết bị này sẽ không xem được nữa.')) act(x.id, 'block').then(loadOverview); };
        a.appendChild(ok); a.appendChild(bl); v.appendChild(a);
      });
      var k = j.kpi, ks = el('div', 'kpis');
      [['Thiết bị hoạt động', k.devicesActive, k.devicesLive + ' thiết bị đang mở app'], ['Tổng giờ xem', hm(k.minutes), k.films + ' phim · trung bình ' + hm(k.minutes / Math.max(1, j.range.days)) + '/ngày'],
        ['Hồ sơ dùng app', k.profiles, j.profiles[0] ? j.profiles[0].name + ' xem nhiều nhất' : ''], ['Đơn vị YouTube hôm nay', nf(k.unitsToday) + ' / 10.000', 'Đặt lại lúc ' + when(j.quotaResetAt)]]
        .forEach(function (x) { var c = el('section', 'card kpi', '<div class="t">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="s">' + esc(x[2]) + '</div>'); ks.appendChild(c); });
      v.appendChild(ks);
      var series = j.profiles.map(function (p) { return { key: p.id, name: p.name, color: color(p.id) }; });
      var ch = card('Thời gian xem mỗi ngày theo hồ sơ', 'rê chuột vào cột để xem chi tiết');
      ch.appendChild(el('div', 'legend', series.map(function (s) { return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('')));
      ch.appendChild(barChart(j.daily, series, 220)); v.appendChild(ch);
      var r2 = el('div', 'row2'); r2.style.alignItems = 'flex-start';
      var t = card('Hồ sơ', 'bấm tên để xem chi tiết'); t.style.flex = '999 1 620px';
      var rows = j.profiles.map(function (p) {
        return '<tr><td><a href="#" class="who" data-p="' + esc(p.id) + '" style="color:inherit;text-decoration:none">' + av(p.name, p.id) + esc(p.name) + '</a></td><td><b>' + hm(p.minutes) + '</b></td><td>' + p.films + '</td><td>' + nf(p.unitsToday) + '</td><td class="muted">' + esc(p.devices.join(' · ')) + '</td><td>' + (p.live ? '<span class="live">Đang mở</span>' : '<span class="muted">' + when(p.last) + '</span>') + '</td></tr>';
      }).join('');
      t.appendChild(el('div', 'tbl', j.profiles.length ? '<table style="min-width:720px"><thead><tr><th>Hồ sơ</th><th>Giờ xem</th><th>Phim</th><th>Đơn vị YT hôm nay</th><th>Thiết bị hay dùng</th><th>Lần cuối</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<div class="empty">Chưa có số liệu. Mở app trên một máy (đã điền máy chủ thống kê) rồi quay lại sau vài phút.</div>'));
      Array.prototype.forEach.call(t.querySelectorAll('[data-p]'), function (a) { a.onclick = function (e) { e.preventDefault(); state.profile = a.getAttribute('data-p'); go('profile'); }; });
      var right = el('div'); right.style.cssText = 'flex:1 1 300px;display:flex;flex-direction:column;gap:14px;min-width:0';
      var lv = card('Đang mở ngay bây giờ', 'tự cập nhật mỗi 30 giây');
      lv.appendChild(el('div', '', (j.live || []).length ? j.live.map(function (x) {
        return '<div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)">' + av(x.pname, x.profile, 36) + '<div style="min-width:0"><b>' + esc(x.pname || '') + '</b> · ' + esc(x.film || SCREENS[x.screen] || x.screen || '') + '<div class="muted">' + esc(x.label) + ' · <span class="mono">' + esc(x.ip) + '</span> · ' + esc(place(x)) + '</div></div></div>';
      }).join('') : '<div class="muted">Không có thiết bị nào đang mở app.</div>'));
      right.appendChild(lv);
      var uc = card('Đơn vị YouTube hôm nay', nf(k.unitsToday) + ' / 10.000'), ub = el('div', 'ubar');
      j.profiles.forEach(function (p) { if (p.unitsToday) { var s = el('div'); s.style.width = Math.min(100, p.unitsToday / 100) + '%'; s.style.background = color(p.id); ub.appendChild(s); } });
      uc.appendChild(ub);
      uc.appendChild(el('div', '', '<div style="margin-top:10px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;font-size:13px">' + j.profiles.map(function (p) { return '<span><i style="display:inline-block;width:10px;height:10px;border-radius:2px;background:' + color(p.id) + ';margin-right:6px"></i>' + esc(p.name) + ': <b>' + nf(p.unitsToday) + '</b></span>'; }).join('') + '</div><div class="muted" style="margin-top:10px">Mỗi lần tìm kiếm tốn 100 đơn vị; tải phim của một kênh tốn 1 đơn vị. Số này tính từ khi bật máy chủ thống kê.</div>'));
      right.appendChild(uc);
      r2.appendChild(t); r2.appendChild(right); v.appendChild(r2);
    }).catch(function (e) { if (e.message !== 'login' && e.message !== 'denied') $('view').innerHTML = '<div class="empty">Lỗi: ' + esc(e.message) + '</div>'; });
  }

  function act(id, action, name) { return api('/a/device', { method: 'POST', body: JSON.stringify({ id: id, action: action, name: name }) }); }

  /* ---------- Thiết bị ---------- */
  function loadDevices() {
    api('/a/devices').then(function (j) {
      var v = $('view'); v.innerHTML = ''; v.style.cssText = 'display:flex;flex-direction:column;gap:16px';
      var c = card('Thiết bị đã kết nối', j.devices.length + ' thiết bị');
      var rows = j.devices.map(function (x) {
        var tags = (x.blocked ? ' <span class="tag block">Đã chặn</span>' : '') + (!x.trusted && Date.now() - x.first_seen < 14 * 864e5 ? ' <span class="tag new">Mới</span>' : '') + (x.trusted ? ' <span class="tag ok">Người nhà</span>' : '');
        var profs = x.profiles.map(function (p) { return '<span title="' + esc(p.name) + '" style="margin-right:-6px;border:2px solid #fff;border-radius:50%;display:inline-flex">' + av(p.name, p.id, 28) + '</span>'; }).join('');
        return '<tr><td><b>' + esc(x.name || x.label) + '</b>' + tags + '<div class="muted">' + esc(x.label) + (x.version ? ' · bản ' + esc(x.version) : '') + '</div></td>' +
          '<td class="mono">' + esc(x.ip) + '<div class="muted" style="font-family:inherit">' + esc(x.isp || '') + '</div></td><td>' + esc(place(x)) + '</td>' +
          '<td><div style="display:flex;padding-right:6px">' + profs + '</div><div class="muted" style="margin-top:4px">' + esc(x.profiles.map(function (p) { return p.name; }).join(', ')) + '</div></td>' +
          '<td class="muted">' + when(x.first_seen) + '</td><td>' + (x.live ? '<span class="live">Đang mở</span>' : '<span class="muted">' + when(x.last_seen) + '</span>') + '</td>' +
          '<td style="white-space:nowrap"><button class="btn sm" data-a="rename" data-id="' + esc(x.id) + '" data-n="' + esc(x.name || x.label) + '">Đặt tên</button> ' +
          (x.blocked ? '<button class="btn sm" data-a="unblock" data-id="' + esc(x.id) + '">Bỏ chặn</button>' : '<button class="btn sm" data-a="block" data-id="' + esc(x.id) + '">Chặn</button>') +
          ' <button class="btn sm" data-a="hist" data-id="' + esc(x.id) + '">Lịch sử IP</button></td></tr>' +
          '<tr class="hist" data-for="' + esc(x.id) + '" style="display:none"><td colspan="7" style="background:var(--bg)">' + (x.history.length ? '<table><tbody>' + x.history.map(function (h) { return '<tr><td class="muted" style="width:150px">' + when(h.ts) + '</td><td class="mono">' + esc(h.ip) + '</td><td>' + esc(place(h)) + '</td><td class="muted">' + esc(h.isp || '') + '</td><td>' + esc(h.pname || '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<span class="muted">Chưa có.</span>') + '</td></tr>';
      }).join('');
      c.appendChild(el('div', 'tbl', j.devices.length ? '<table style="min-width:980px"><thead><tr><th>Thiết bị</th><th>Địa chỉ IP</th><th>Vị trí (gần đúng)</th><th>Hồ sơ đã dùng</th><th>Lần đầu</th><th>Lần cuối</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' : '<div class="empty">Chưa có thiết bị nào gửi số liệu.</div>'));
      Array.prototype.forEach.call(c.querySelectorAll('button[data-a]'), function (b) {
        b.onclick = function () {
          var id = b.getAttribute('data-id'), a = b.getAttribute('data-a');
          if (a === 'hist') { var r = c.querySelector('tr.hist[data-for="' + id + '"]'); r.style.display = r.style.display === 'none' ? '' : 'none'; return; }
          if (a === 'rename') { var n = prompt('Tên thiết bị (ví dụ: TV phòng khách)', b.getAttribute('data-n')); if (n == null) return; act(id, 'rename', n).then(loadDevices); return; }
          if (a === 'block' && !confirm('Chặn thiết bị này? App trên máy đó sẽ hiện "Thiết bị này đã bị tạm khóa".')) return;
          act(id, a).then(loadDevices);
        };
      });
      v.appendChild(c);
      var r2 = el('div', 'row2');
      var lc = card('Nơi kết nối', 'theo địa chỉ IP');
      lc.appendChild(el('div', '', (j.locations || []).map(function (x) { return '<div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line)"><span>' + esc(place(x) || 'Không rõ') + '</span><b>' + x.n + ' thiết bị</b></div>'; }).join('') || '<div class="muted">Chưa có.</div>'));
      var hw = card('Cách ghi nhận');
      hw.appendChild(el('ul', '', '<li>App gửi tín hiệu khi mở, khi đổi hồ sơ và mỗi phút khi đang dùng.</li><li>IP và thành phố do Cloudflare thấy ở mỗi lần kết nối; vị trí chỉ gần đúng, mạng di động có thể lệch sang thành phố khác.</li><li>Số liệu tự xóa sau 90 ngày. "Chặn" làm app trên máy đó dừng lại.</li>'));
      hw.querySelector('ul').style.cssText = 'margin:0;padding-left:18px;line-height:1.7;font-size:14px';
      r2.appendChild(lc); r2.appendChild(hw); v.appendChild(r2);
    }).catch(function (e) { if (e.message !== 'login' && e.message !== 'denied') $('view').innerHTML = '<div class="empty">Lỗi: ' + esc(e.message) + '</div>'; });
  }

  /* ---------- Hồ sơ ---------- */
  function loadProfile() {
    api('/a/overview').then(function (o) {
      o.profiles.forEach(function (p) { color(p.id); });
      if (!state.profile && o.profiles[0]) state.profile = o.profiles[0].id;
      var v = $('view'); v.innerHTML = ''; v.style.cssText = 'display:flex;flex-direction:column;gap:16px';
      var pl = el('div', 'plist');
      o.profiles.forEach(function (p) {
        var b = el('button', p.id === state.profile ? 'on' : '', av(p.name, p.id, 28) + esc(p.name));
        b.onclick = function () { state.profile = p.id; loadProfile(); };
        pl.appendChild(b);
      });
      v.appendChild(pl);
      if (!state.profile) { v.appendChild(el('div', 'empty', 'Chưa có số liệu hồ sơ.')); return; }
      var op = o.profiles.filter(function (p) { return p.id === state.profile; })[0] || {};
      return api('/a/profile?id=' + encodeURIComponent(state.profile)).then(function (j) {
        var col = color(state.profile);
        var tot = j.daily.reduce(function (a, x) { return a + x.m; }, 0);
        var done = j.films.filter(function (f) { return f.dur && f.pos / f.dur > 0.9; }).length;
        var uTot = j.units.reduce(function (a, x) { return a + (x.u || 0); }, 0);
        var ks = el('div', 'kpis');
        [['Giờ xem', hm(tot), 'Trung bình ' + hm(tot / Math.max(1, j.range.days)) + '/ngày'], ['Phim đã xem', j.films.length + ' phim', done + ' xem hết · ' + (j.films.length - done) + ' xem dở'], ['Đơn vị YouTube', nf(uTot), 'Hôm nay ' + nf(op.unitsToday || 0)], ['Thiết bị đã dùng', j.devices.length, j.devices.map(function (x) { return x.label; }).slice(0, 3).join(', ')]]
          .forEach(function (x) { ks.appendChild(el('section', 'card kpi', '<div class="t">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="s">' + esc(x[2]) + '</div>')); });
        v.appendChild(ks);
        var dc = card('Phút xem mỗi ngày');
        dc.appendChild(barChart(j.daily.map(function (x) { return { day: x.day, by: { p: x.m } }; }), [{ key: 'p', name: j.profile.name, color: col }], 180));
        v.appendChild(dc);
        var r1 = el('div', 'row2');
        var hc = card('Khung giờ hay xem', '0 giờ → 23 giờ, đậm = xem nhiều'), mx = Math.max.apply(null, j.hours.concat([1]));
        var heat = el('div', 'heat');
        j.hours.forEach(function (m, h) { var x = el('div', '', '<i style="background:' + col + ';opacity:' + (0.08 + 0.92 * m / mx).toFixed(2) + '" title="' + h + ' giờ: ' + hm(m) + '"></i>' + (h % 3 === 0 ? h : '&nbsp;')); heat.appendChild(x); });
        hc.appendChild(heat);
        var top = j.hours.indexOf(mx); if (mx > 1) hc.appendChild(el('div', 'muted', 'Xem nhiều nhất khoảng <b>' + top + ' – ' + (top + 1) + ' giờ</b>.')).style.marginTop = '10px';
        var uc = card('Dùng app vào việc gì', 'theo thời gian mở app');
        var groups = {}, watchS = 0;
        j.screens.forEach(function (s) { watchS += s.w || 0; var g = SCREENS[s.screen] || 'Khác'; groups[g] = (groups[g] || 0) + Math.max(0, (s.a || 0) - (s.w || 0)); });
        var parts = [['Xem phim', watchS, col]].concat(Object.keys(groups).map(function (g, i) { return [g, groups[g], COLORS[(i + 3) % COLORS.length]]; })).filter(function (x) { return x[1] > 30; }).sort(function (a, b) { return b[1] - a[1]; });
        var sum = parts.reduce(function (a, x) { return a + x[1]; }, 0) || 1;
        var ub = el('div', 'ubar'); parts.forEach(function (x) { var s = el('div'); s.style.width = (x[1] / sum * 100) + '%'; s.style.background = x[2]; ub.appendChild(s); });
        uc.appendChild(ub);
        uc.appendChild(el('div', '', '<div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;font-size:14px">' + parts.map(function (x) { return '<div style="display:flex;gap:8px;align-items:center"><i style="width:12px;height:12px;border-radius:3px;background:' + x[2] + '"></i><span style="flex:1">' + x[0] + '</span><span class="muted">' + hm(x[1] / 60) + '</span><b style="width:44px;text-align:right">' + Math.round(x[1] / sum * 100) + '%</b></div>'; }).join('') + '</div>'));
        r1.appendChild(hc); r1.appendChild(uc); v.appendChild(r1);
        var r2 = el('div', 'row2');
        var cc = card('Kênh xem nhiều nhất', '% thời gian xem'), cs = j.channels.reduce(function (a, x) { return a + x.s; }, 0) || 1, cm = j.channels[0] ? j.channels[0].s : 1;
        cc.appendChild(el('div', 'hbars', j.channels.map(function (x) { return '<div class="hbar"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.ch) + '</span><div class="tr"><div style="width:' + (x.s / cm * 100) + '%;background:' + col + '"></div></div><b style="text-align:right">' + Math.round(x.s / cs * 100) + '%</b></div>'; }).join('') || '<div class="muted">Chưa có.</div>'));
        var qc = card('Đơn vị YouTube đã dùng', nf(uTot) + ' đơn vị');
        var KIND = { search: ['Tìm kiếm phim', '100 / lần'], list: ['Tải phim, chi tiết, gợi ý', '1 / lần'] };
        qc.appendChild(el('div', 'tbl', '<table><thead><tr><th>Việc</th><th>Giá</th><th>Số lần</th><th style="text-align:right">Đơn vị</th></tr></thead><tbody>' + j.units.map(function (x) { var k = KIND[x.kind] || [x.kind, '']; return '<tr><td>' + k[0] + '</td><td class="muted">' + k[1] + '</td><td>' + nf(x.n) + '</td><td style="text-align:right"><b>' + nf(x.u) + '</b></td></tr>'; }).join('') + '</tbody></table>'));
        if ((j.rates || []).length) {   // đánh giá phim của hồ sơ
          var lk = j.rates.filter(function (x) { return x.r === 1; }), dl = j.rates.filter(function (x) { return x.r === -1; });
          qc.appendChild(el('div', '', '<div class="muted" style="margin:12px 0 6px">Đánh giá: ❤ ' + lk.length + ' thích · 👎 ' + dl.length + ' không thích</div><div class="chips">' + lk.slice(0, 8).map(function (x) { return '<span>❤ ' + esc(x.title) + '</span>'; }).join('') + dl.slice(0, 4).map(function (x) { return '<span style="opacity:.7">👎 ' + esc(x.title) + '</span>'; }).join('') + '</div>'));
        }
        if (j.searches.length) qc.appendChild(el('div', '', '<div class="muted" style="margin:12px 0 6px">Hay tìm:</div><div class="chips">' + j.searches.map(function (s) { return '<span>' + esc(s.q) + (s.n > 1 ? ' ×' + s.n : '') + '</span>'; }).join('') + '</div>'));
        r2.appendChild(cc); r2.appendChild(qc); v.appendChild(r2);
        var fc = card('Phim xem gần đây', j.films.length + ' phim');
        fc.appendChild(el('div', 'tbl', j.films.length ? '<table style="min-width:760px"><thead><tr><th>Phim</th><th>Lúc</th><th>Thời gian xem</th><th>Thiết bị</th><th>Tiến độ</th></tr></thead><tbody>' + j.films.map(function (f) {
          var p = f.dur ? Math.min(100, Math.round(f.pos / f.dur * 100)) : 0, full = p >= 90;
          return '<tr><td><b>' + esc(f.title) + '</b><div class="muted">' + esc(f.ch) + '</div></td><td>' + when(f.last) + '</td><td>' + hm(f.s / 60) + '</td><td class="muted">' + esc(f.device || '') + '</td><td><div class="prog"><div style="width:' + p + '%;background:' + (full ? '#2B8A3E' : col) + '"></div></div><div class="muted" style="margin-top:4px">' + (full ? 'Xem hết' : 'Đến ' + p + '%') + '</div></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">Chưa xem phim nào trong khoảng này.</div>'));
        v.appendChild(fc);
      });
    }).catch(function (e) { if (e.message !== 'login' && e.message !== 'denied') $('view').innerHTML = '<div class="empty">Lỗi: ' + esc(e.message) + '</div>'; });
  }

  // vào trang: đã có token trong phiên này thì vào thẳng
  var qv = /[?&]v=(overview|devices|profile|report)/.exec(location.search); if (qv) state.view = qv[1];
  initColors();
  state.token = sessionStorage.getItem('tt.admintok') || '';
  if (state.token && cfg().url) start(); else showLogin('');
})(window, document);
