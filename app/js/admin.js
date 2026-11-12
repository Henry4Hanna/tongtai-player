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
  var navs = d.querySelectorAll('.nav[data-v]');
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
    $('range').style.display = v === 'music' || v === 'channels' ? 'none' : '';
    if (v === 'overview') {
      $('title').textContent = 'Tổng quan'; $('subtitle').textContent = 'Cả nhà · ' + rl;
      loadOverview(); liveT = setInterval(loadOverview, 30000);
    } else if (v === 'devices') {
      $('title').textContent = 'Thiết bị và IP'; $('subtitle').textContent = 'Thiết bị đã kết nối, địa chỉ IP, vị trí gần đúng · ' + rl;
      loadDevices();
    } else if (v === 'channels') {
      $('title').textContent = 'Kênh'; $('subtitle').textContent = 'Thêm, sửa, tắt kênh, đổi ảnh · lưu vào channels.json trên GitHub';
      loadChannels();
    } else if (v === 'music') {
      $('title').textContent = 'Nhạc'; $('subtitle').textContent = 'Thêm bài, gắn lời (.lrc / .ass), viết tóm tắt cho trang Nhạc';
      loadMusic();
    } else if (v === 'report') {
      $('title').textContent = 'Báo cáo PDF'; $('subtitle').textContent = 'Bản tóm tắt để lưu hoặc in · ' + rl;
      loadReport();
    } else {
      $('title').textContent = 'Hồ sơ'; $('subtitle').textContent = 'Xem gì, lúc nào, trên máy nào, dùng bao nhiêu đơn vị YouTube · ' + rl;
      loadProfile();
    }
  }



  /* ---------- Nhạc: danh sách bài, thêm bài, lời .lrc/.ass, tóm tắt (lưu lên GitHub qua máy chủ) ---------- */
  var MUS = { list: null, sha: '' };
  function mmss(t) { t = Math.max(0, Math.floor(t || 0)); return Math.floor(t / 60) + ':' + ('0' + t % 60).slice(-2); }
  function slug(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'bai-hat';
  }
  // đọc lời: .lrc  ([mm:ss.xx] câu, dòng [Chorus] = tên đoạn)  hoặc  .ass  (Dialogue: …)
  var SEC = { 'verse': 'LỜI', 'verse 1': 'LỜI 1', 'verse 2': 'LỜI 2', 'verse 3': 'LỜI 3', 'pre-chorus': 'TIỀN ĐIỆP KHÚC', 'chorus': 'ĐIỆP KHÚC', 'final chorus': 'ĐIỆP KHÚC CUỐI', 'bridge': 'CẦU NỐI', 'outro': 'KẾT', 'intro': 'MỞ ĐẦU' };
  function secName(x) { x = String(x || '').trim(); return SEC[x.toLowerCase()] || x.toUpperCase(); }
  function parseLyrics(txt) {
    var out = [], sec = '', m;
    txt = String(txt || '').replace(/\r/g, '');
    if (/^\s*Dialogue:/m.test(txt)) {
      txt.split('\n').forEach(function (ln) {
        if (!/^Dialogue:/.test(ln)) return;
        var p = ln.split(','); if (p.length < 10) return;
        var a = p[1].split(':'), at = (+a[0]) * 3600 + (+a[1]) * 60 + parseFloat(a[2]);
        var raw = p.slice(9).join(','), t = raw.replace(/\{[^}]*\}/g, '').replace(/\\N/g, ' ').replace(/\s+/g, ' ').trim();
        if (!t) return;
        var ws = [], k0 = at, km, kre = /\{\\[kK][fo]?(\d+)\}([^{]*)/g;
        while ((km = kre.exec(raw))) { var wd = km[2].replace(/\\N/g, ' ').trim(); if (wd) ws.push([Math.round(k0 * 100) / 100, wd]); k0 += (+km[1]) / 100; }
        var o = { s: '', t: t, at: Math.round(at * 100) / 100 }; if (ws.length > 1) o.w = ws;
        out.push(o);
      });
    } else {
      txt.split('\n').forEach(function (ln) {
        ln = ln.trim(); if (!ln) return;
        var tags = [], re = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
        while ((m = re.exec(ln))) tags.push((+m[1]) * 60 + parseFloat(m[2]));
        var ws = [], wm, wre = /<(\d+):(\d+(?:\.\d+)?)>\s*([^<]+)/g;   // LRC nâng cao: <00:12.30>chữ
        while ((wm = wre.exec(ln))) ws.push([Math.round(((+wm[1]) * 60 + parseFloat(wm[2])) * 100) / 100, wm[3].trim()]);
        var t = ln.replace(/\[[^\]]*\]/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (!tags.length) { var sm = /^\[([^\]:]+)\]$/.exec(ln) || /^\(([^)]+)\)$/.exec(ln); if (sm && !/^(ti|ar|al|by|offset|length|re|ve)$/i.test(sm[1])) sec = secName(sm[1]); return; }
        if (!t) return;
        tags.forEach(function (at) { var o = { s: sec, t: t, at: Math.round(at * 100) / 100 }; if (ws.length > 1 && tags.length === 1) o.w = ws; out.push(o); sec = ''; });
      });
      out.sort(function (a, b) { return a.at - b.at; });
    }
    return out;
  }
  function readFile(f, asText) {
    return new Promise(function (ok, no) {
      var r = new FileReader();
      r.onload = function () { ok(r.result); }; r.onerror = function () { no(r.error); };
      if (asText) r.readAsText(f, 'utf-8'); else r.readAsDataURL(f);
    });
  }
  function audioDur(f) {
    return new Promise(function (ok) {
      var a = new Audio(); a.preload = 'metadata';
      a.onloadedmetadata = function () { ok(Math.round(a.duration || 0)); URL.revokeObjectURL(a.src); };
      a.onerror = function () { ok(0); };
      a.src = URL.createObjectURL(f);
    });
  }
  function loadMusic() {
    var view = $('view');
    api('/a/music').catch(function () { return null; }).then(function (j) {
      if (j && j.ok) { MUS.list = j.list; MUS.sha = j.sha; MUS.files = j.files || {}; MUS.branch = j.branch; return; }
      MUS.gh = j && j.repo === '' ? '' : null;
      return fetch('music/list.json?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (x) { MUS.list = x; MUS.sha = ''; });
    }).then(function () {
      var songs = MUS.list.songs || [];
      view.innerHTML = '';
      if (!MUS.sha) view.appendChild(el('div', 'gh', '<b>ⓘ</b><div>Chưa nối máy chủ với GitHub nên mới <b>xem</b> được. Muốn lưu bài mới / lời / tóm tắt: làm bước <b>“Nối GitHub”</b> trong HUONG-DAN-ADMIN (5 phút).</div>'));
      var withSum = songs.filter(function (x) { return x.sum; }).length, withL = songs.filter(function (x) { return x.lrcAuto === false; }).length;
      var ks = el('div', 'kpis');
      [['Số bài', songs.length, mmss(songs.reduce(function (a, x) { return a + (x.dur || 0); }, 0)) + ' tổng thời lượng'], ['Có lời canh giờ chuẩn', withL + ' / ' + songs.length, 'Từ file .lrc hoặc .ass'], ['Có tóm tắt', withSum + ' / ' + songs.length, 'Hiện ở trang Nhạc']]
        .forEach(function (x) { ks.appendChild(el('section', 'card kpi', '<div class="t">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="s">' + esc(x[2]) + '</div>')); });
      view.appendChild(ks);
      var c = card('Danh sách bài', 'Bấm “Sửa” để thay lời, tóm tắt, hoặc file nhạc');
      var add = el('button', 'btn dark sm', '+ Thêm bài'); add.onclick = function () { editSong(-1); };
      var lv = el('button', 'btn sm', 'Cân bằng âm lượng tất cả'); lv.style.marginLeft = 'auto';
      lv.onclick = function () {
        if (!MUS.sha) { alert('Chưa nối GitHub nên chưa lưu được.'); return; }
        lv.disabled = true; var gains = {}, k = 0;
        (function step() {
          if (k >= songs.length) {
            lv.textContent = 'Đang lưu…';
            api('/a/music', { method: 'POST', body: JSON.stringify({ sha: MUS.sha, op: 'gains', gains: gains }) }).then(function (j) { if (!j.ok) throw new Error(j.error); MUS.list = j.list; MUS.sha = j.sha; go('music'); }).catch(function (e) { lv.disabled = false; lv.textContent = 'Lỗi: ' + e.message; });
            return;
          }
          var x = songs[k++]; lv.textContent = 'Đang đo ' + k + ' / ' + songs.length + '…';
          loudness('music/' + x.file).then(function (L) { gains[x.file] = gainOf(L); }, function () {}).then(step);
        })();
      };
      var hb = el('button', 'btn sm', '↶ Lịch sử'); hb.onclick = function () { historyView('music'); };
      c.querySelector('h2').appendChild(lv);
      c.querySelector('h2').appendChild(hb);
      c.querySelector('h2').appendChild(add);
      var L = el('div', 'mlist');
      L.appendChild(el('div', 'mrow mhead', '<span></span><span>Bài</span><span class="d">Dài</span><span class="l">Lời</span><span class="s">Tóm tắt</span><span></span>'));
      songs.forEach(function (x, i) {
        var r = el('div', 'mrow', '<span class="n">' + (i + 1) + '</span><span class="t"><b>' + esc(x.title) + '</b><small>' + esc(x.file) + '</small></span><span class="d muted">' + mmss(x.dur) + '</span>' +
          '<span class="l">' + (x.lrcAuto === false ? '<span class="tag ok">Canh giờ chuẩn</span>' : (x.lyrics || []).length ? '<span class="tag new">Tự động</span>' : '<span class="tag block">Chưa có lời</span>') + '</span>' +
          (x.gain != null ? '' : '') + '<span class="s' + (x.sum ? '' : ' none') + '">' + esc(x.sum || 'Chưa có tóm tắt') + '</span>');
        var b = el('button', 'btn sm', 'Sửa'); b.onclick = function () { editSong(i); }; r.appendChild(b);
        L.appendChild(r);
      });
      c.appendChild(L); view.appendChild(c);
    }).catch(function (e) { view.innerHTML = '<div class="empty">Không đọc được music/list.json: ' + esc(e.message) + '</div>'; });
  }
  function editSong(i) {
    var songs = MUS.list.songs || [], x = i >= 0 ? JSON.parse(JSON.stringify(songs[i])) : { title: '', file: '', dur: 0, lyrics: [], lrcAuto: true };
    var up = { mp3: null };
    if (MUS.draft && MUS.draft.i === i) { x = MUS.draft.x; up = MUS.draft.up; } MUS.draft = null;
    $('title').textContent = i >= 0 ? x.title : 'Thêm bài mới';
    $('subtitle').textContent = i >= 0 ? 'Bài ' + (i + 1) + ' / ' + songs.length + ' · ' + x.file : 'Chọn file nhạc, gắn lời, viết tóm tắt rồi bấm Lưu';
    var view = $('view'); view.innerHTML = '';
    var c = el('section', 'card'), ed = el('div', 'ed'), L = el('div'), R = el('div');
    L.style.cssText = R.style.cssText = 'display:flex;flex-direction:column;gap:16px;min-width:0';
    L.innerHTML =
      '<div class="field"><label>Tên bài</label><input type="text" id="e-title" value="' + esc(x.title) + '" placeholder="Ví dụ: Báo Thù Kiêu Hãnh"></div>' +
      '<div class="field"><label>File nhạc (.mp3)</label><label class="drop' + (x.file ? ' ok' : '') + '" id="e-mp3d"><span class="ic">♪</span><div><b id="e-mp3n">' + (x.file ? esc(x.file) : 'Chọn file .mp3') + '</b><span id="e-mp3s">' + (x.file ? mmss(x.dur) + ' · bấm để thay file khác' : 'Tối đa 25 MB') + '</span></div><input type="file" accept="audio/mpeg,.mp3" id="e-mp3" hidden></label></div>' +
      '<div class="field"><label>Lời bài hát (.lrc hoặc .ass)</label><label class="drop' + (x.lrcAuto === false ? ' ok' : '') + '" id="e-lrcd"><span class="ic">♫</span><div><b id="e-lrcn">' + (x.lrcAuto === false ? 'Lời canh giờ chuẩn · ' + x.lyrics.length + ' câu' : 'Chọn file .lrc / .ass') + '</b><span id="e-lrcs">' + (x.lrcAuto === false ? 'Bấm để thay file khác' : (x.lyrics || []).length ? 'Hiện đang dùng lời canh giờ tự động (' + x.lyrics.length + ' câu)' : 'Chưa có lời') + '</span></div><input type="file" accept=".lrc,.ass,.txt" id="e-lrc" hidden></label></div>' +
      '<div class="field"><label>Lời chạy trên màn hình</label><div class="seg" id="e-mode"><button data-m="line">Hiện theo câu</button><button data-m="word">Chạy theo từng chữ</button><button data-m="">Tô dần cả câu</button></div><small id="e-modes"></small></div>' +
      '<div class="syncbar"><div><b>Canh lời theo nhạc</b><span>Nghe nhạc, chỉnh giờ từng câu, sửa chữ, xem trước như trên TV</span></div><button class="btn dark sm" id="e-sync">Mở trình canh lời</button></div>' +
      '<div class="lprev" id="e-prev"></div>';
    R.innerHTML =
      '<div class="field"><label>Ảnh trên trang Nhạc <span class="muted" style="font-weight:400">· 10 ảnh, đổi mỗi 8 giây</span></label>' +
      '<div class="seg" id="e-imode"><button data-m="keys">Phim tự chọn theo từ khóa</button><button data-m="films">Phim tôi chọn</button><button data-m="up">Ảnh tải lên</button></div>' +
      '<div class="imode" data-m="keys"><input type="text" id="e-keys" placeholder="báo thù, trả thù, vợ cũ"><small class="muted">App lấy 10 phim thật trong kho phim (các kênh đang theo dõi) có tên chứa một trong các từ này, đổi bộ phim mỗi ngày. Không đủ thì thêm phim tổng tài khác. Không tốn đơn vị.</small></div>' +
      '<div class="imode" data-m="films"><textarea id="e-films" style="min-height:70px" placeholder="Dán link phim YouTube, mỗi dòng một phim (tối đa 10)"></textarea><div class="covs" id="e-fl"></div><small class="muted">Ảnh lấy thẳng từ YouTube khi mở trang, không tốn đơn vị.</small></div>' +
      '<div class="imode" data-m="up"><div class="covs" id="e-covs"></div><small class="muted">Ảnh của bạn (tối đa 10). Ảnh ngang 16:9, tự cắt và thu nhỏ còn 1280×720.</small><input type="file" accept="image/*" id="e-covf" multiple hidden></div>' +
      '<span id="e-covn" hidden></span></div>' +
      '<div class="field"><label>Tóm tắt (hiện ở trang Nhạc)</label><textarea id="e-sum" maxlength="400" placeholder="Bài hát … thể hiện …">' + esc(x.sum || '') + '</textarea><small id="e-sumc"></small></div>' +
      '<div class="field"><label>Đoạn trích ngắn (mỗi câu một dòng, mặc định 3 câu)</label><textarea id="e-ex" style="min-height:90px" placeholder="Báo thù kiêu hãnh, em không cần ai cúi đầu">' + esc((x.ex || []).join('\n')) + '</textarea></div>' +
      '<div class="field"><label>Âm lượng</label><div class="loud" id="e-loud"><div class="lm"><i id="e-lbar"></i><b id="e-lref"></b></div><div class="lt" id="e-lt">Đang đo độ to của bài…</div><label class="chk"><input type="checkbox" id="e-lon" checked> Cân bằng: bài to hơn các bài khác thì tự giảm cho nghe đều nhau</label></div></div>' +
      '<div class="field"><label>Xem trước</label><div class="pv" id="e-pv"></div></div>';
    ed.appendChild(L); ed.appendChild(R); c.appendChild(ed);
    var bar = el('div', 'edbar', '<span class="muted" id="e-msg">' + (MUS.sha ? 'Lưu xong khoảng 1–2 phút sau mọi máy (web, TV) sẽ thấy.' : 'Chưa nối GitHub: chỉ xem thử được, chưa lưu được.') + '</span>');
    var cancel = el('button', 'btn', 'Quay lại'); cancel.onclick = function () { go('music'); };
    var save = el('button', 'btn dark', 'Lưu lên GitHub');
    if (i >= 0) { var del = el('button', 'btn', 'Xóa bài'); del.style.color = '#B42318'; del.onclick = function () { if (confirm('Xóa bài "' + x.title + '" khỏi danh sách? (file mp3 cũng bị xóa)')) push({ op: 'delete', file: x.file }); }; bar.appendChild(del); }
    bar.appendChild(cancel); bar.appendChild(save); c.appendChild(bar);
    view.appendChild(c);
    function prev() {
      $('e-prev').innerHTML = (x.lyrics || []).map(function (l) { return '<div><i>' + mmss(l.at) + '</i><span>' + (l.s ? '<em>' + esc(l.s) + '</em><br>' : '') + esc(l.t) + '</span></div>'; }).join('') || '<div><span class="muted">Chưa có lời.</span></div>';
      var t = $('e-title').value.trim() || 'Tên bài', sm = $('e-sum').value.trim(), exl = $('e-ex').value.split('\n').map(function (q) { return q.trim(); }).filter(Boolean);
      $('e-pv').innerHTML = '<div class="k">NHẠC CỦA TÔI</div><div class="tt">' + esc(t) + '</div>' + (sm ? '<p>' + esc(sm) + '</p>' : '<p style="opacity:.5">(chưa có tóm tắt)</p>') + (exl.length ? '<blockquote>' + exl.map(esc).join('<br>') + '</blockquote>' : '');
      $('e-sumc').textContent = sm.length + ' / 400 ký tự · nên 1–2 câu';
    }
    ['e-title', 'e-sum', 'e-ex'].forEach(function (id) { $(id).oninput = prev; });
    prev();
    // ảnh bìa: tối đa 10 ảnh mỗi bài
    var MAXC = 10;
    var covs = (x.covers || (x.cover ? [x.cover] : [])).map(function (p0) { return { path: p0, src: 'music/' + p0 }; });
    function paintCov() {
      var box = $('e-covs'); box.innerHTML = '';
      covs.forEach(function (c, k) {
        var t = el('div', 'ctile' + (c.data ? ' new' : ''));
        t.style.backgroundImage = 'url("' + c.src + '")';
        t.innerHTML = '<span class="cn">' + (k + 1) + '</span>' + (c.data ? '<span class="cnew">mới</span>' : '') + '<div class="cact"><button title="Sang trái">‹</button><button title="Xóa">×</button><button title="Sang phải">›</button></div>';
        var b = t.querySelectorAll('button');
        b[0].onclick = function () { if (k > 0) { covs.splice(k - 1, 0, covs.splice(k, 1)[0]); paintCov(); } };
        b[1].onclick = function () { covs.splice(k, 1); paintCov(); };
        b[2].onclick = function () { if (k < covs.length - 1) { covs.splice(k + 1, 0, covs.splice(k, 1)[0]); paintCov(); } };
        box.appendChild(t);
      });
      if (covs.length < MAXC) { var a = el('label', 'ctile add', '<b>+</b><span>Thêm ảnh</span>'); a.setAttribute('for', 'e-covf'); box.appendChild(a); }
      $('e-covn').textContent = '· ' + covs.length + ' / ' + MAXC + ' ảnh';
      var u = covs.length ? covs[0].src : '';
      var pv = $('e-pv'); pv.style.backgroundImage = u ? 'linear-gradient(90deg, rgba(20,22,29,.96) 40%, rgba(20,22,29,.6)), url("' + u + '")' : '';
    }
    function addImg(f) {
      return new Promise(function (ok) {
        var im = new Image(); im.onload = function () {
          var W = 1280, H = 720, cv = d.createElement('canvas'); cv.width = W; cv.height = H;
          var r = Math.max(W / im.width, H / im.height), sw = W / r, sh = H / r;
          cv.getContext('2d').drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, 0, 0, W, H);
          var dta = cv.toDataURL('image/jpeg', 0.84); covs.push({ data: dta, src: dta }); ok();
        };
        im.onerror = ok; im.src = URL.createObjectURL(f);
      });
    }
    $('e-covf').onchange = function () {
      var fs = [].slice.call(this.files, 0, MAXC - covs.length), inp = this;
      if (this.files.length > fs.length) alert('Mỗi bài tối đa ' + MAXC + ' ảnh: chỉ lấy ' + fs.length + ' ảnh đầu.');
      fs.reduce(function (p0, f) { return p0.then(function () { return addImg(f); }); }, Promise.resolve()).then(function () { inp.value = ''; paintCov(); });
    };
    paintCov();
    // phim cho ảnh: từ khóa / phim chọn / ảnh tải lên
    var imode = covs.length ? 'up' : (x.films || []).length ? 'films' : 'keys';
    $('e-keys').value = (x.keys || []).join(', ');
    $('e-films').value = (x.films || []).map(function (id) { return 'https://youtu.be/' + id; }).join('\n');
    function vidOf(t) { var m = /(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/.exec(t) || /^([\w-]{11})$/.exec(t.trim()); return m && m[1]; }
    function films() { var seen = {}; return $('e-films').value.split(/\s+/).map(vidOf).filter(function (id) { if (!id || seen[id]) return false; seen[id] = 1; return true; }).slice(0, 10); }
    function paintFilms() {
      var box = $('e-fl'); box.innerHTML = '';
      films().forEach(function (id, k) { var t = el('div', 'ctile'); t.style.backgroundImage = 'url("https://i.ytimg.com/vi/' + id + '/hqdefault.jpg")'; t.innerHTML = '<span class="cn">' + (k + 1) + '</span>'; box.appendChild(t); });
    }
    $('e-films').oninput = paintFilms; paintFilms();
    function paintMode2() {
      [].forEach.call($('e-imode').children, function (b) { b.classList.toggle('on', b.dataset.m === imode); });
      [].forEach.call(d.querySelectorAll('.imode'), function (q) { q.style.display = q.dataset.m === imode ? '' : 'none'; });
    }
    [].forEach.call($('e-imode').children, function (b) { b.onclick = function () { imode = b.dataset.m; paintMode2(); }; });
    paintMode2();
    // kiểu chạy lời
    function paintMode() {
      var m = x.mode || '', hasW = (x.lyrics || []).some(function (l) { return l.w && l.w.length; });
      [].forEach.call($('e-mode').children, function (b) { b.classList.toggle('on', b.dataset.m === m); });
      $('e-modes').textContent = m === 'line' ? 'Câu đang hát sáng cả câu, không chạy chữ.' : m === 'word' ? (hasW ? 'Từng chữ sáng đúng lúc hát (giờ từng chữ lấy từ file .ass).' : 'File lời chưa có giờ từng chữ: app chia đều chữ trong câu. Muốn chính xác hãy dùng file .ass có \\k.') : 'Câu đang hát tô màu dần từ trái sang phải (như hiện nay).';
    }
    [].forEach.call($('e-mode').children, function (b) { b.onclick = function () { x.mode = b.dataset.m || undefined; paintMode(); }; });
    paintMode();
    // đo độ to
    var src = function () { return up.mp3 ? URL.createObjectURL(up.mp3) : 'music/' + x.file; };
    function measure() {
      if (!x.file && !up.mp3) { $('e-lt').textContent = 'Chọn file nhạc để đo.'; return; }
      $('e-lt').textContent = 'Đang đo độ to của bài…';
      loudness(up.mp3 || ('music/' + x.file)).then(function (L) {
        var g = gainOf(L);
        x._loud = L; if ($('e-lon').checked) x.gain = g; else delete x.gain;
        var pct = function (db) { return Math.max(0, Math.min(100, (db + 30) / 28 * 100)); };
        $('e-lbar').style.width = pct(L) + '%'; $('e-lref').style.left = pct(REF_DB) + '%';
        $('e-lt').innerHTML = 'Độ to: <b>' + L.toFixed(1) + ' dB</b> · chuẩn chung ' + REF_DB + ' dB → ' + (g < -0.4 ? 'app sẽ <b>giảm ' + (-g).toFixed(1) + ' dB</b>' : g > 0.4 ? 'app sẽ <b>tăng ' + g.toFixed(1) + ' dB</b>' : 'vừa chuẩn, giữ nguyên');
      }).catch(function () { $('e-lt').textContent = 'Không đo được (file chưa có trên GitHub?).'; });
    }
    $('e-lon').checked = x.gain !== undefined || !x.hasOwnProperty('gain');
    $('e-lon').onchange = function () { if (this.checked && x._loud != null) x.gain = gainOf(x._loud); else if (!this.checked) delete x.gain; };
    measure();
    $('e-sync').onclick = function () { syncEditor(x, src(), function () { editAgain(); }); };
    function editAgain() { MUS.draft = { i: i, x: x, up: up }; editSong(i); }
    $('e-mp3').onchange = function () {
      var f = this.files[0]; if (!f) return;
      if (f.size > 25 * 1024 * 1024) { alert('File lớn quá (tối đa 25 MB).'); return; }
      up.mp3 = f;
      audioDur(f).then(function (dur) {
        x.dur = dur || x.dur;
        if (!x.file) x.file = slug($('e-title').value || f.name.replace(/\.mp3$/i, '')) + '.mp3';
        if (!$('e-title').value.trim()) { $('e-title').value = f.name.replace(/\.mp3$/i, '').replace(/[_-]+/g, ' '); prev(); }
        $('e-mp3d').classList.add('ok'); $('e-mp3n').textContent = f.name; $('e-mp3s').textContent = mmss(x.dur) + ' · ' + (f.size / 1048576).toFixed(1) + ' MB · sẽ lưu thành ' + x.file;
      });
    };
    $('e-lrc').onchange = function () {
      var f = this.files[0]; if (!f) return;
      readFile(f, true).then(function (txt) {
        var ls = parseLyrics(txt);
        if (!ls.length) { alert('Không đọc được lời trong file này. Cần .lrc có [phút:giây] hoặc .ass có dòng Dialogue.'); return; }
        x.lyrics = ls; x.lrcAuto = false;
        if (!$('e-ex').value.trim()) { $('e-ex').value = pickEx(ls).join('\n'); } if (ls.some(function (l) { return l.w; }) && !x.mode) x.mode = 'word'; paintMode();
        $('e-lrcd').classList.add('ok'); $('e-lrcn').textContent = (f.name.length > 34 ? f.name.slice(0, 22) + '…' + f.name.slice(-9) : f.name) + ' · ' + ls.length + ' câu'; $('e-lrcs').textContent = 'Câu đầu ở ' + mmss(ls[0].at) + ', câu cuối ở ' + mmss(ls[ls.length - 1].at);
        prev();
      });
    };
    function push(body) {
      if (!MUS.sha) { $('e-msg').innerHTML = '<b style="color:#B42318">Chưa nối GitHub nên chưa lưu được.</b> Xem bước “Nối GitHub” trong hướng dẫn.'; return; }
      save.disabled = true; $('e-msg').textContent = 'Đang lưu…';
      api('/a/music', { method: 'POST', body: JSON.stringify(Object.assign({ sha: MUS.sha }, body)) }).then(function (j) {
        if (!j.ok) throw new Error(j.error || 'lỗi');
        MUS.list = j.list; MUS.sha = j.sha; MUS.files = j.files || MUS.files;
        alert('Đã lưu. Khoảng 1–2 phút nữa app trên mọi máy sẽ thấy.');
        go('music');
      }).catch(function (e) { save.disabled = false; $('e-msg').innerHTML = '<b style="color:#B42318">Không lưu được: ' + esc(e.message) + '</b>'; });
    }
    save.onclick = function () {
      x.title = $('e-title').value.trim();
      x.sum = $('e-sum').value.trim();
      x.ex = $('e-ex').value.split('\n').map(function (q) { return q.trim(); }).filter(Boolean).slice(0, 6); if (!x.ex.length && x.lyrics && x.lyrics.length) x.ex = pickEx(x.lyrics);
      if (!x.sum) delete x.sum; if (!x.ex.length) delete x.ex; delete x._loud;
      if (x.mode === 'word') x.lyrics.forEach(function (l, k) { if (!l.w || !l.w.length) l.w = evenWords(l, x.lyrics[k + 1], x.dur); });
      if (!x.title) { alert('Nhập tên bài.'); return; }
      if (i < 0 && !up.mp3) { alert('Chọn file .mp3 cho bài mới.'); return; }
      var p = up.mp3 ? readFile(up.mp3).then(function (u) { return u.split(',')[1]; }) : Promise.resolve('');
      if (!MUS.sha) { push({}); return; }
      if (i < 0 && songs.some(function (s) { return s.file === x.file; })) x.file = x.file.replace(/\.mp3$/, '-' + Date.now().toString(36).slice(-4) + '.mp3');
      save.disabled = true;
      p.then(function (b64) {
        if (!b64) return;
        $('e-msg').textContent = 'Đang tải file nhạc lên GitHub… (' + (up.mp3.size / 1048576).toFixed(1) + ' MB)';
        var body = { message: (i < 0 ? 'Thêm nhạc: ' : 'Thay nhạc: ') + x.title, content: b64, branch: MUS.branch };
        if (MUS.files[x.file]) body.sha = MUS.files[x.file];
        return api('/a/music/file?name=' + encodeURIComponent(x.file), { method: 'POST', body: JSON.stringify(body) }).then(function (j) {
          if (!j.ok) throw new Error(j.error || 'lỗi tải file');
          MUS.files[x.file] = j.sha;
        });
      }).then(function () {   // tải từng ảnh bìa mới
        var news = imode === 'up' ? covs.filter(function (c) { return c.data; }) : [], n = 0;
        return news.reduce(function (p0, c) {
          return p0.then(function () {
            var cn = 'covers/' + x.file.replace(/\.mp3$/, '') + '-' + Date.now().toString(36) + (n++) + '.jpg';
            $('e-msg').textContent = 'Đang tải ảnh bìa ' + n + ' / ' + news.length + '…';
            return api('/a/music/file?name=' + encodeURIComponent(cn), { method: 'POST', body: JSON.stringify({ message: 'Ảnh bìa ' + n + ': ' + x.title, content: c.data.split(',')[1], branch: MUS.branch }) })
              .then(function (j) { if (!j.ok) throw new Error(j.error || 'lỗi tải ảnh'); c.path = cn; delete c.data; c.src = 'music/' + cn; });
          });
        }, Promise.resolve());
      }).then(function () {
        x.covers = imode === 'up' ? covs.map(function (c) { return c.path; }).filter(Boolean) : []; delete x.cover;
        x.films = imode === 'films' ? films() : [];
        x.keys = $('e-keys').value.split(',').map(function (q) { return q.trim(); }).filter(Boolean).slice(0, 8);
        ['covers', 'films', 'keys'].forEach(function (k) { if (!x[k].length) delete x[k]; });
        push({ op: i < 0 ? 'add' : 'update', song: x });
      })
        .catch(function (e) { save.disabled = false; $('e-msg').innerHTML = '<b style="color:#B42318">Không lưu được: ' + esc(e.message) + '</b>'; });
    };
  }



  /* ---------- Kênh: quản lý danh sách kênh (channels.json trên GitHub) ---------- */
  var CH = { list: null, sha: '', live: false, tab: 'all', q: '' };
  var TYPES = { drama: 'Phim ngắn', anime: 'Hoạt hình', movie: 'Phim lẻ' };
  function nn(x) { try { x = String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { x = String(x || '').toLowerCase(); } return x.replace(/đ/g, 'd').replace(/[^a-z0-9@]/g, ''); }
  function fromConfig(map) {
    var out = [];
    [['CHANNELS', 'drama'], ['ANIME_CHANNELS', 'anime'], ['MOVIE_CHANNELS', 'movie']].forEach(function (p) {
      (C[p[0]] || []).forEach(function (c) { var m = map[nn(c.name)] || {}; out.push({ name: c.name, id: c.id || m.id || '', title: m.title || '', thumb: m.thumb || '', type: p[1], tag: c.tag || '' }); });
    });
    return out;
  }
  function chAvatar(c, big) {
    var src = c.img ? (/^(https?:|data:)/.test(c.img) ? c.img : '../' + c.img) : c.thumb, lab = String(c.title || c.name || '?').replace(/^@/, '');
    var i = Math.abs(lab.split('').reduce(function (a, ch) { return a * 31 + ch.charCodeAt(0) | 0; }, 7)) % COLORS.length;
    return '<span class="cav' + (big ? ' big' : '') + '" style="background:' + COLORS[i] + '">' + (src ? '<img src="' + esc(src) + '" alt="" onerror="this.remove()">' : '') + esc(lab.charAt(0).toUpperCase()) + '</span>';
  }

  // Tự lấy mã kênh / tên / ảnh từ YouTube. Kênh có @tên: 1 đơn vị. Tên thường: tìm kiếm 100 đơn vị. Làm mới 50 kênh có mã: 1 đơn vị.
  function ytKey() {
    var k = C.API_KEY || '';
    try { var pr = JSON.parse(localStorage.getItem('tt.prefs') || '{}'); k = (pr.settings && pr.settings.API_KEY) || k; } catch (e) { /* bỏ qua */ }
    try { k = sessionStorage.getItem('tt.ytkey') || k; } catch (e) { /* bỏ qua */ }
    return k;
  }
  function yt(path, q) {
    q.key = ytKey();
    var u = 'https://www.googleapis.com/youtube/v3/' + path + '?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&');
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw new Error(j.error.message || 'YouTube lỗi'); return j; });
  }
  function thumbOf(sn) { var t = (sn && sn.thumbnails) || {}; return (t.medium || t.high || t.default || {}).url || ''; }
  function idCost(L) {
    var miss = L.filter(function (c) { return !c.id; }), at = miss.filter(function (c) { return /^@/.test(c.name); }).length;
    return { miss: miss.length, at: at, search: miss.length - at, units: at + (miss.length - at) * 100, refresh: Math.ceil(L.filter(function (c) { return c.id || /^@/.test(c.name); }).length / 50) };
  }
  function lookupOne(c) {
    if (/^@/.test(c.name)) return yt('channels', { part: 'snippet', forHandle: c.name }).then(function (j) { var it = (j.items || [])[0]; if (!it) return false; c.id = it.id; c.thumb = thumbOf(it.snippet); if (!c.title) c.title = it.snippet.title; return true; });
    return yt('search', { part: 'snippet', type: 'channel', q: c.name, maxResults: 1 }).then(function (j) { var it = (j.items || [])[0]; if (!it) return false; c.id = it.id.channelId; c.thumb = thumbOf(it.snippet); if (!c.title) c.title = it.snippet.title; return true; });
  }
  function autoIds(btn, msgEl) {
    var L = CH.list || [], miss = L.filter(function (c) { return !c.id; }), ok = 0, k = 0;
    if (!ytKey()) { var key = prompt('Dán mã YouTube API (chỉ dùng trên máy này, không lưu lên GitHub):'); if (!key) return; try { sessionStorage.setItem('tt.ytkey', key.trim()); } catch (e) { /* bỏ qua */ } }
    btn.disabled = true;
    function step() {
      if (k >= miss.length) {
        msgEl.innerHTML = 'Lấy được mã cho <b>' + ok + ' / ' + miss.length + '</b> kênh.' + (ok ? ' Đang lưu…' : '');
        if (ok) saveChannels('Tự lấy mã cho ' + ok + ' kênh').then(function () { go('channels'); }, function () { btn.disabled = false; }); else btn.disabled = false;
        return;
      }
      var c = miss[k++]; msgEl.textContent = 'Đang tìm ' + c.name + ' (' + k + ' / ' + miss.length + ')…';
      lookupOne(c).then(function (r) { if (r) ok++; }, function (e) { msgEl.textContent = 'Lỗi: ' + e.message; k = miss.length; }).then(step);
    }
    step();
  }
  function refreshAll(btn, msgEl) {
    var L = (CH.list || []).filter(function (c) { return c.id; });
    if (!ytKey()) { var key = prompt('Dán mã YouTube API (chỉ dùng trên máy này, không lưu lên GitHub):'); if (!key) return; try { sessionStorage.setItem('tt.ytkey', key.trim()); } catch (e) { /* bỏ qua */ } }
    btn.disabled = true; var parts = [];
    for (var i = 0; i < L.length; i += 50) parts.push(L.slice(i, i + 50));
    Promise.all(parts.map(function (p) { return yt('channels', { part: 'snippet', id: p.map(function (c) { return c.id; }).join(','), maxResults: 50 }); })).then(function (rs) {
      var by = {}; rs.forEach(function (j) { (j.items || []).forEach(function (it) { by[it.id] = it.snippet; }); });
      var n = 0; L.forEach(function (c) { var sn = by[c.id]; if (sn) { c.thumb = thumbOf(sn); if (!c.title) c.title = sn.title; n++; } });
      msgEl.textContent = 'Đã cập nhật ảnh cho ' + n + ' kênh. Đang lưu…';
      return saveChannels('Cập nhật ảnh kênh từ YouTube').then(function () { go('channels'); });
    }).catch(function (e) { btn.disabled = false; msgEl.textContent = 'Lỗi: ' + e.message; });
  }


  var DORM = 60;
  function ageDays(iso) { var t = iso ? Date.parse(iso) : NaN; return isNaN(t) ? -1 : Math.floor((Date.now() - t) / 86400e3); }
  function lastTag(c) {
    if (c.gone) return '<span class="lt bad">Không còn trên YouTube</span>';
    var a = ageDays(c.last); if (a < 0) return '';
    if (a >= DORM) return '<span class="lt warn">Ngủ đông ' + a + ' ngày</span>';
    return '<span class="lt">Phim mới: ' + (a === 0 ? 'hôm nay' : a + ' ngày trước') + '</span>';
  }
  function checkChannels(btn, msgEl) {
    var L = CH.list || [], ids = L.filter(function (c) { return c.id; }).map(function (c) { return c.id; }), parts = [], res = {};
    for (var i = 0; i < ids.length; i += 20) parts.push(ids.slice(i, i + 20));
    btn.disabled = true; var k = 0;
    (function step() {
      if (k >= parts.length) {
        var now = new Date().toISOString(), n = 0;
        L.forEach(function (c) { var r = c.id && res[c.id]; if (!r || r.err) return; n++; c.chk = now; if (r.gone) c.gone = true; else { delete c.gone; if (r.last) c.last = r.last; } });
        msgEl.textContent = 'Đã kiểm tra ' + n + ' kênh. Đang lưu…';
        saveChannels('Kiểm tra ' + n + ' kênh (ngủ đông)').then(function () { go('channels'); }, function () { btn.disabled = false; });
        return;
      }
      msgEl.textContent = 'Đang kiểm tra ' + Math.min(ids.length, (k + 1) * 20) + ' / ' + ids.length + ' kênh…';
      api('/a/channels/check', { method: 'POST', body: JSON.stringify({ ids: parts[k++] }) }).then(function (j) { if (j.ok) Object.assign(res, j.res); else throw new Error(j.error); }).then(step, function (e) { btn.disabled = false; msgEl.textContent = 'Lỗi: ' + e.message; });
    })();
  }

  /* ---------- Lịch sử thay đổi + hoàn tác (Kênh, Nhạc) ---------- */
  function when(iso) { var d0 = new Date(iso); return d0.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' }) + ' · ' + d0.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
  function diffChannels(a, b) {   // a: bản cũ hơn, b: bản này
    var A = {}, B = {}, out = [];
    ((a && a.channels) || []).forEach(function (c) { A[nn(c.name)] = c; }); ((b && b.channels) || []).forEach(function (c) { B[nn(c.name)] = c; });
    Object.keys(B).forEach(function (k) {
      var x = B[k], y = A[k], nm = esc(x.title || x.name);
      if (!y) { out.push(['add', 'Thêm kênh ' + nm]); return; }
      if ((y.on === false) !== (x.on === false)) out.push([x.on === false ? 'off' : 'on', (x.on === false ? 'Tắt ' : 'Bật ') + nm]);
      if ((y.title || '') !== (x.title || '')) out.push(['ed', 'Đổi tên hiển thị ' + esc(y.title || y.name) + ' → ' + nm]);
      if (y.type !== x.type) out.push(['ed', nm + ': loại ' + (TYPES[y.type] || y.type) + ' → ' + (TYPES[x.type] || x.type)]);
      if (!y.id && x.id) out.push(['ed', nm + ': có mã kênh']);
      if ((y.img || '') !== (x.img || '')) out.push(['ed', nm + ': đổi ảnh']);
    });
    var nl = 0; Object.keys(B).forEach(function (k) { var x = B[k], y = A[k]; if (!y) return; if ((y.last || '') !== (x.last || '')) nl++; if (!y.gone && x.gone) out.push(['del', esc(x.title || x.name) + ': không còn trên YouTube']); });
    if (nl) out.push(['ed', 'Cập nhật ngày ra phim mới cho ' + nl + ' kênh']);
    Object.keys(A).forEach(function (k) { if (!B[k]) out.push(['del', 'Xóa kênh ' + esc(A[k].title || A[k].name)]); });
    var oa = ((a && a.channels) || []).map(function (c) { return nn(c.name); }).filter(function (k) { return B[k]; }).join(), ob = ((b && b.channels) || []).map(function (c) { return nn(c.name); }).filter(function (k) { return A[k]; }).join();
    if (oa !== ob) out.push(['ed', 'Đổi thứ tự kênh']);
    return out;
  }
  function diffMusic(a, b) {
    var A = {}, B = {}, out = [];
    ((a && a.songs) || []).forEach(function (x) { A[x.file] = x; }); ((b && b.songs) || []).forEach(function (x) { B[x.file] = x; });
    Object.keys(B).forEach(function (k) {
      var x = B[k], y = A[k], nm = esc(x.title);
      if (!y) { out.push(['add', 'Thêm bài ' + nm]); return; }
      if (y.title !== x.title) out.push(['ed', 'Đổi tên ' + esc(y.title) + ' → ' + nm]);
      if ((y.sum || '') !== (x.sum || '') || JSON.stringify(y.ex || []) !== JSON.stringify(x.ex || [])) out.push(['ed', nm + ': tóm tắt / đoạn trích']);
      if (JSON.stringify(y.lyrics || []) !== JSON.stringify(x.lyrics || [])) out.push(['ed', nm + ': lời / giờ lời (' + (x.lyrics || []).length + ' câu)']);
      if ((y.mode || '') !== (x.mode || '')) out.push(['ed', nm + ': kiểu chạy lời']);
      if (JSON.stringify(y.covers || (y.cover ? [y.cover] : [])) !== JSON.stringify(x.covers || (x.cover ? [x.cover] : []))) out.push(['ed', nm + ': ảnh bìa (' + (x.covers || []).length + ' ảnh)']);
      if ((y.gain || 0) !== (x.gain || 0)) out.push(['ed', nm + ': âm lượng']);
    });
    Object.keys(A).forEach(function (k) { if (!B[k]) out.push(['del', 'Xóa bài ' + esc(A[k].title)]); });
    return out;
  }
  function historyView(kind) {
    var back = kind === 'channels' ? 'channels' : 'music';
    $('title').textContent = 'Lịch sử thay đổi · ' + (kind === 'channels' ? 'Kênh' : 'Nhạc');
    $('subtitle').textContent = 'Mỗi lần lưu là một bản. Quay về bản cũ không xóa gì: chỉ thêm một bản mới giống bản cũ.';
    var view = $('view'); view.innerHTML = '<div class="empty">Đang tải lịch sử…</div>';
    var cache = {};
    function ver(sha) { return cache[sha] ? Promise.resolve(cache[sha]) : api('/a/history?kind=' + kind + '&sha=' + sha).then(function (j) { if (!j.ok) throw new Error(j.error); return (cache[sha] = j.data); }); }
    api('/a/history?kind=' + kind).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'lỗi');
      view.innerHTML = '';
      var c = card(j.list.length + ' lần lưu gần nhất', j.path + ' trên GitHub');
      var bk = el('button', 'btn sm', '‹ Quay lại'); bk.style.marginLeft = 'auto'; bk.onclick = function () { go(back); }; c.querySelector('h2').appendChild(bk);
      var box = el('div', 'hist'); c.appendChild(box); view.appendChild(c);
      j.list.forEach(function (h, i) {
        var r = el('div', 'hrow' + (i === 0 ? ' now' : ''));
        r.innerHTML = '<div class="hdot"></div><div class="hm"><div class="ht"><b>' + esc(h.msg.replace(/ \(trang quản trị\)$/, '')) + '</b>' + (i === 0 ? '<span class="tag ok">Đang dùng</span>' : '') + '</div><div class="hs">' + when(h.at) + ' · ' + esc(h.by || '') + ' · ' + h.sha.slice(0, 7) + '</div><div class="hd"></div></div>';
        var acts = el('div', 'ha');
        var bv = el('button', 'btn sm', 'Xem thay đổi'), hd = r.querySelector('.hd');
        bv.onclick = function () {
          if (hd.innerHTML) { hd.innerHTML = ''; bv.textContent = 'Xem thay đổi'; return; }
          hd.innerHTML = '<span class="muted">Đang so sánh…</span>';
          var prev = j.list[i + 1];
          Promise.all([ver(h.sha), prev ? ver(prev.sha) : Promise.resolve(null)]).then(function (vv) {
            var dd = (kind === 'channels' ? diffChannels : diffMusic)(vv[1], vv[0]);
            hd.innerHTML = !prev ? '<span class="muted">Bản đầu tiên.</span>' : dd.length ? '<ul>' + dd.slice(0, 30).map(function (x) { return '<li class="' + x[0] + '">' + x[1] + '</li>'; }).join('') + (dd.length > 30 ? '<li>… và ' + (dd.length - 30) + ' thay đổi khác</li>' : '') + '</ul>' : '<span class="muted">Không có thay đổi nội dung.</span>';
            bv.textContent = 'Ẩn';
          }).catch(function (e) { hd.textContent = 'Lỗi: ' + e.message; });
        };
        acts.appendChild(bv);
        if (i > 0) {
          var br = el('button', 'btn sm dark', 'Quay về bản này');
          br.onclick = function () {
            if (!confirm('Quay về bản “' + h.msg.replace(/ \(trang quản trị\)$/, '') + '” lúc ' + when(h.at) + '?\nMọi thay đổi sau đó sẽ được bỏ (vẫn còn trong lịch sử để quay lại).')) return;
            br.disabled = true;
            api('/a/history?kind=' + kind, { method: 'POST', body: JSON.stringify({ sha: h.sha, label: when(h.at) }) }).then(function (x) { if (!x.ok) throw new Error(x.error); alert('Đã quay về bản lúc ' + when(h.at) + '. Khoảng 1–2 phút nữa mọi máy sẽ thấy.'); historyView(kind); }).catch(function (e) { br.disabled = false; alert('Không quay về được: ' + e.message); });
          };
          acts.appendChild(br);
        }
        r.appendChild(acts); box.appendChild(r);
      });
      if (kind === 'music') c.appendChild(el('div', 'muted', 'Lưu ý: quay về bản cũ chỉ đổi danh sách bài (tên, lời, tóm tắt…). File nhạc đã xóa thì không tự có lại.'));
    }).catch(function (e) { view.innerHTML = '<div class="empty">Không tải được lịch sử: ' + esc(e.message) + '<br><br><button class="btn" onclick="history.back()">Quay lại</button></div>'; });
  }

  function loadChannels() {
    var view = $('view');
    api('/a/channels').catch(function () { return null; }).then(function (j) {
      if (j && j.ok) { CH.sha = j.sha; CH.live = true; var dd = j.data || {}; if (dd.v >= 2) { CH.list = dd.channels; return; } var map = {}; (dd.channels || []).forEach(function (c) { if (c && c.name) map[nn(c.name)] = c; }); CH.list = fromConfig(map); return; }
      CH.live = false;
      return fetch('../channels.json?t=' + Date.now()).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (dd) {
        if (dd && dd.v >= 2) { CH.list = dd.channels; return; }
        var map = {}; ((dd && dd.channels) || (Array.isArray(dd) ? dd : [])).forEach(function (c) { if (c && c.name) map[nn(c.name)] = c; });
        CH.list = fromConfig(map);
      });
    }).then(paintChannels).catch(function (e) { view.innerHTML = '<div class="empty">Không đọc được danh sách kênh: ' + esc(e.message) + '</div>'; });
  }
  function paintChannels() {
    var view = $('view'), L = CH.list || []; view.innerHTML = '';
    if (!CH.live) view.appendChild(el('div', 'gh', '<b>ⓘ</b><div>Chưa nối máy chủ với GitHub nên mới <b>xem</b> được. Muốn lưu kênh: làm bước <b>“Nối GitHub”</b> trong HUONG-DAN-ADMIN.</div>'));
    var on = L.filter(function (c) { return c.on !== false; });
    var ks = el('div', 'kpis');
    [['Kênh đang hiện', on.length + ' / ' + L.length, L.length - on.length ? (L.length - on.length) + ' kênh đang tắt' : 'Tất cả đều bật'],
     ['Phim ngắn', on.filter(function (c) { return c.type === 'drama'; }).length, 'Hàng phim tổng tài, Danh mục'],
     ['Hoạt hình', on.filter(function (c) { return c.type === 'anime'; }).length, 'Nhãn AI / 2D / 3D'],
     ['Có mã kênh', L.filter(function (c) { return c.id; }).length + ' / ' + L.length, 'Có mã thì app không tốn 100 đơn vị tìm kênh']]
      .forEach(function (x) { ks.appendChild(el('section', 'card kpi', '<div class="t">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="s">' + esc(x[2]) + '</div>')); });
    view.appendChild(ks);
    var cost = idCost(L), ac = el('section', 'card idc');
    ac.innerHTML = '<div class="idt"><b>Tự lấy mã kênh từ YouTube</b><span>' + (cost.miss ? cost.miss + ' kênh chưa có mã: ' + (cost.at ? cost.at + ' kênh có @tên × 1 đơn vị' : '') + (cost.at && cost.search ? ' + ' : '') + (cost.search ? cost.search + ' kênh không có @tên × 100 đơn vị' : '') : 'Tất cả kênh đã có mã.') + '</span></div>' +
      '<div class="idu"><b>≈ ' + cost.units + '</b><span>đơn vị / 10.000 mỗi ngày</span></div>';
    var b1 = el('button', 'btn dark sm', cost.miss ? 'Lấy mã ' + cost.miss + ' kênh' : 'Đã đủ mã'); b1.disabled = !cost.miss;
    var b2 = el('button', 'btn sm', 'Cập nhật ảnh tất cả (≈' + cost.refresh + ' đv)');
    var am = el('div', 'idm muted', 'Mã của kênh lưu trong channels.json, nên TV, điện thoại, máy tính không phải tìm lại (mỗi máy tiết kiệm đúng số đơn vị trên).');
    b1.onclick = function () { autoIds(b1, am); }; b2.onclick = function () { refreshAll(b2, am); };
    var ab = el('div', 'idb'); ab.appendChild(b1); ab.appendChild(b2); ac.appendChild(ab); ac.appendChild(am);
    var dorm = L.filter(function (c) { return c.on !== false && (c.gone || ageDays(c.last) >= DORM); });
    var chk = el('section', 'card idc dorm');
    var lastChk = L.reduce(function (a, c) { return c.chk && c.chk > a ? c.chk : a; }, '');
    chk.innerHTML = '<div class="idt"><b>Kênh “ngủ đông”</b><span>Kênh ' + DORM + ' ngày không ra phim mới, hoặc không còn trên YouTube. Kiểm tra bằng RSS của YouTube: <strong>không tốn đơn vị</strong>.' + (lastChk ? ' Lần kiểm tra trước: ' + new Date(lastChk).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '.' : '') + '</span></div>' +
      '<div class="idu"><b class="' + (dorm.length ? 'warn' : '') + '">' + dorm.length + '</b><span>kênh đang bật bị ngủ đông</span></div>';
    var cb1 = el('button', 'btn dark sm', 'Kiểm tra ' + L.filter(function (c) { return c.id; }).length + ' kênh (0 đơn vị)');
    var cb2 = el('button', 'btn sm', 'Tắt ' + dorm.length + ' kênh ngủ đông'); cb2.disabled = !dorm.length;
    var cm = el('div', 'idm muted', dorm.length ? 'Ngủ đông: ' + dorm.map(function (c) { return esc(c.title || c.name); }).join(', ') : 'Kênh chưa có mã thì chưa kiểm tra được: lấy mã trước.');
    cm.innerHTML = cm.textContent;
    cb1.onclick = function () { checkChannels(cb1, cm); };
    cb2.onclick = function () { if (!confirm('Tắt ' + dorm.length + ' kênh ngủ đông? (bật lại lúc nào cũng được)')) return; dorm.forEach(function (c) { c.on = false; }); saveChannels('Tắt ' + dorm.length + ' kênh ngủ đông').then(function () { go('channels'); }); };
    var cbx = el('div', 'idb'); cbx.appendChild(cb1); cbx.appendChild(cb2); chk.appendChild(cbx); chk.appendChild(cm);
    var two = el('div', 'two'); two.appendChild(ac); two.appendChild(chk); view.appendChild(two);
    var c = card('Danh sách kênh', 'Thứ tự ở đây = thứ tự trong app');
    var hb = el('button', 'btn sm', '↶ Lịch sử thay đổi'); hb.style.marginLeft = 'auto'; hb.onclick = function () { historyView('channels'); };
    c.querySelector('h2').appendChild(hb);
    var add = el('button', 'btn dark sm', '+ Thêm kênh'); add.onclick = function () { editChannel(-1); };
    c.querySelector('h2').appendChild(add);
    var tb = el('div', 'chtool');
    tb.innerHTML = '<div class="seg" id="c-tab">' + [['all', 'Tất cả', L.length]].concat(Object.keys(TYPES).map(function (k) { return [k, TYPES[k], L.filter(function (c) { return c.type === k; }).length]; }))
      .map(function (t) { return '<button data-t="' + t[0] + '"' + (CH.tab === t[0] ? ' class="on"' : '') + '>' + t[1] + ' <small>' + t[2] + '</small></button>'; }).join('') + '</div><input type="search" id="c-q" placeholder="Tìm kênh…" value="' + esc(CH.q) + '">';
    c.appendChild(tb);
    var box = el('div', 'clist'); c.appendChild(box); view.appendChild(c);
    function rowsPaint() {
      box.innerHTML = '';
      var q = nn(CH.q);
      L.forEach(function (ch, i) {
        if (CH.tab !== 'all' && ch.type !== CH.tab) return;
        if (q && nn(ch.name + ' ' + ch.title).indexOf(q) < 0) return;
        var r = el('div', 'crow' + (ch.on === false ? ' off' : ''),
          '<span class="ord"><button class="nb" data-u title="Lên">▲</button><button class="nb" data-d title="Xuống">▼</button></span>' + chAvatar(ch) +
          '<span class="t"><b>' + esc(ch.title || ch.name.replace(/^@/, '')) + '</b><small>' + esc(ch.name) + '</small></span>' +
          '<span><span class="tag ty-' + ch.type + '">' + TYPES[ch.type] + (ch.tag ? ' · ' + esc(ch.tag) : '') + '</span></span>' +
          '<span class="id">' + (ch.id ? '<span class="ok">✓</span> ' + esc(ch.id.slice(0, 6) + '…' + ch.id.slice(-4)) : '<span class="warn">Chưa có mã</span>') + lastTag(ch) + '</span>' +
          '<label class="sw" title="Hiện trong app"><input type="checkbox"' + (ch.on === false ? '' : ' checked') + '><i></i></label>');
        var b = el('button', 'btn sm', 'Sửa'); b.onclick = function () { editChannel(i); }; r.appendChild(b);
        r.querySelector('input').onchange = function () { if (this.checked) delete ch.on; else ch.on = false; saveChannels((this.checked ? 'Bật' : 'Tắt') + ' kênh ' + ch.name); r.classList.toggle('off', !this.checked); };
        r.querySelector('[data-u]').onclick = function () { if (i > 0) { L.splice(i - 1, 0, L.splice(i, 1)[0]); rowsPaint(); dirty(); } };
        r.querySelector('[data-d]').onclick = function () { if (i < L.length - 1) { L.splice(i + 1, 0, L.splice(i, 1)[0]); rowsPaint(); dirty(); } };
        box.appendChild(r);
      });
      if (!box.children.length) box.appendChild(el('div', 'empty', 'Không có kênh nào.'));
    }
    var bar = el('div', 'edbar', '<span class="muted" id="c-msg">' + (CH.live ? 'Lưu xong khoảng 1–2 phút sau mọi máy thấy (TV làm mới danh sách kênh trong vòng 12 giờ, hoặc bấm “Làm mới” trong app).' : 'Chưa nối GitHub: chỉ xem được.') + '</span>');
    var sv = el('button', 'btn dark', 'Lưu thứ tự'); sv.id = 'c-save'; sv.style.display = 'none'; sv.onclick = function () { saveChannels('Đổi thứ tự kênh'); };
    bar.appendChild(sv); c.appendChild(bar);
    function dirty() { sv.style.display = ''; }
    [].forEach.call($('c-tab').children, function (b) { b.onclick = function () { CH.tab = b.dataset.t; [].forEach.call($('c-tab').children, function (q) { q.classList.toggle('on', q === b); }); rowsPaint(); }; });
    $('c-q').oninput = function () { CH.q = this.value; rowsPaint(); };
    rowsPaint();
  }
  function saveChannels(msg) {
    var m = $('c-msg') || $('ce-msg');
    if (!CH.live) { if (m) m.innerHTML = '<b style="color:#B42318">Chưa nối GitHub nên chưa lưu được.</b>'; return Promise.reject(new Error('offline')); }
    if (m) m.textContent = 'Đang lưu…';
    return api('/a/channels', { method: 'POST', body: JSON.stringify({ sha: CH.sha, message: msg, channels: CH.list }) }).then(function (j) {
      if (!j.ok) throw new Error(j.error || 'lỗi');
      CH.sha = j.sha; CH.list = j.data.channels;
      if (m) m.innerHTML = '<b style="color:#1E6B33">Đã lưu.</b> ' + esc(msg);
      if ($('c-save')) $('c-save').style.display = 'none';
    }).catch(function (e) { if (m) m.innerHTML = '<b style="color:#B42318">Không lưu được: ' + esc(e.message) + '</b>'; throw e; });
  }
  function handleOf(v) {
    v = String(v || '').trim();
    var m = /youtube\.com\/(@[^/?#\s]+)/i.exec(v) || /youtube\.com\/channel\/(UC[\w-]{20,})/i.exec(v);
    if (m) v = decodeURIComponent(m[1]);
    if (/^UC[\w-]{20,}$/.test(v)) return { id: v };
    if (v && v.charAt(0) !== '@') v = '@' + v;
    return { name: v.replace(/\s+/g, '') };
  }
  function editChannel(i) {
    var L = CH.list || [], c = i >= 0 ? JSON.parse(JSON.stringify(L[i])) : { name: '', type: CH.tab !== 'all' ? CH.tab : 'drama' }, imgFile = null;
    $('title').textContent = i >= 0 ? (c.title || c.name) : 'Thêm kênh';
    $('subtitle').textContent = i >= 0 ? 'Kênh ' + (i + 1) + ' / ' + L.length + ' · ' + TYPES[c.type] : 'Dán link kênh YouTube hoặc @tên kênh';
    var view = $('view'); view.innerHTML = '';
    var k = el('section', 'card'), ed = el('div', 'ed');
    ed.innerHTML =
      '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
      '<div class="field"><label>Kênh YouTube (@tên hoặc link)</label><input type="text" id="ce-name" value="' + esc(c.name) + '" placeholder="@ghienphimtongtai hoặc https://youtube.com/@…"><small><a id="ce-open" target="_blank" rel="noopener">Mở kênh trên YouTube ↗</a></small></div>' +
      '<div class="field"><label>Tên hiển thị trong app</label><input type="text" id="ce-title" value="' + esc(c.title || '') + '" placeholder="Để trống = tên kênh trên YouTube"></div>' +
      '<div class="field"><label>Mã kênh (UC…) <span class="muted" style="font-weight:400">· không bắt buộc, có thì tiết kiệm hạn mức</span></label><div style="display:flex;gap:8px"><input type="text" id="ce-id" value="' + esc(c.id || '') + '" placeholder="UCxxxxxxxxxxxxxxxxxxxxxx" spellcheck="false" style="flex:1"><button class="btn sm" id="ce-find">Tự lấy mã</button></div><small id="ce-findc"></small></div>' +
      '<div class="field"><label>Loại</label><div class="seg" id="ce-type">' + Object.keys(TYPES).map(function (t) { return '<button data-t="' + t + '">' + TYPES[t] + '</button>'; }).join('') + '</div></div>' +
      '<div class="field" id="ce-tagf"><label>Nhãn hoạt hình (khi tiêu đề không ghi)</label><div class="seg" id="ce-tag"><button data-g="">Không</button><button data-g="AI">AI</button><button data-g="2D">2D</button><button data-g="3D">3D</button></div></div>' +
      '<label class="chk big"><input type="checkbox" id="ce-on"' + (c.on === false ? '' : ' checked') + '> Hiện kênh này trong app</label>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:16px;min-width:0">' +
      '<div class="field"><label>Ảnh kênh</label><div class="cimg"><span id="ce-av"></span><div><label class="btn sm">Tải ảnh lên<input type="file" accept="image/*" id="ce-file" hidden></label> <button class="btn sm" id="ce-yt">Dùng ảnh YouTube</button><small class="muted" style="display:block;margin-top:8px">Ảnh vuông, app tự cắt tròn. Tự thu nhỏ còn 256×256.</small></div></div></div>' +
      '<div class="field"><label>Ghi chú (chỉ hiện ở đây)</label><textarea id="ce-note" style="min-height:80px" placeholder="Ví dụ: kênh của KK Studio, ra phim mới thứ 3, thứ 5">' + esc(c.note || '') + '</textarea></div>' +
      '<div class="field"><label>Xem trước trong app</label><div class="cpv" id="ce-pv"></div></div>' +
      '</div>';
    k.appendChild(ed);
    var bar = el('div', 'edbar', '<span class="muted" id="ce-msg"></span>');
    if (i >= 0) { var del = el('button', 'btn', 'Xóa kênh'); del.style.color = '#B42318'; del.onclick = function () { if (confirm('Xóa kênh ' + c.name + '?')) { L.splice(i, 1); saveChannels('Xóa kênh ' + c.name).then(function () { go('channels'); }, function () {}); } }; bar.appendChild(del); }
    var back = el('button', 'btn', 'Quay lại'); back.onclick = function () { go('channels'); };
    var save = el('button', 'btn dark', 'Lưu lên GitHub');
    bar.appendChild(back); bar.appendChild(save); k.appendChild(bar); view.appendChild(k);
    function paint() {
      var h = handleOf($('ce-name').value);
      $('ce-open').href = h.id ? 'https://www.youtube.com/channel/' + h.id : 'https://www.youtube.com/' + encodeURIComponent(h.name || '');
      [].forEach.call($('ce-type').children, function (b) { b.classList.toggle('on', b.dataset.t === c.type); });
      [].forEach.call($('ce-tag').children, function (b) { b.classList.toggle('on', b.dataset.g === (c.tag || '')); });
      $('ce-tagf').style.display = c.type === 'anime' ? '' : 'none';
      var tmp = { name: h.name || c.name, title: $('ce-title').value.trim(), img: c.img, thumb: c.thumb };
      if (imgFile) tmp.img = imgFile.url;
      $('ce-av').innerHTML = chAvatar(tmp, true);
      $('ce-pv').innerHTML = '<div class="cpvrow">' + chAvatar(tmp, true) + '<div><b>' + esc(tmp.title || (tmp.name || '@kênh').replace(/^@/, '')) + '</b><span>' + TYPES[c.type] + (c.type === 'anime' && c.tag ? ' · ' + c.tag : '') + ' · 25 phim mới nhất</span></div><span class="cpvbadge">Mới 3</span></div>';
    }
    ['ce-name', 'ce-title'].forEach(function (id) { $(id).oninput = paint; });
    function findCost() { var h = handleOf($('ce-name').value); $('ce-findc').textContent = h.id ? 'Đã là mã kênh.' : h.name ? 'Tốn 1 đơn vị (tra theo @tên).' : 'Nhập @tên kênh trước.'; }
    $('ce-name').addEventListener('input', findCost); findCost();
    $('ce-find').onclick = function () {
      var h = handleOf($('ce-name').value); if (!h.name) return;
      if (!ytKey()) { var key = prompt('Dán mã YouTube API (chỉ dùng trên máy này, không lưu lên GitHub):'); if (!key) return; try { sessionStorage.setItem('tt.ytkey', key.trim()); } catch (e) { /* bỏ qua */ } }
      var tmp = { name: h.name, title: $('ce-title').value.trim() };
      $('ce-findc').textContent = 'Đang tìm…';
      lookupOne(tmp).then(function (ok) {
        if (!ok) { $('ce-findc').textContent = 'Không thấy kênh ' + h.name + ' trên YouTube.'; return; }
        $('ce-id').value = tmp.id; c.thumb = tmp.thumb; if (!$('ce-title').value.trim()) $('ce-title').value = tmp.title;
        $('ce-findc').innerHTML = '<b style="color:#1E6B33">Đã lấy mã</b> · tốn 1 đơn vị'; paint();
      }, function (e) { $('ce-findc').textContent = 'Lỗi: ' + e.message; });
    };
    [].forEach.call($('ce-type').children, function (b) { b.onclick = function () { c.type = b.dataset.t; paint(); }; });
    [].forEach.call($('ce-tag').children, function (b) { b.onclick = function () { c.tag = b.dataset.g; paint(); }; });
    $('ce-yt').onclick = function () { imgFile = null; delete c.img; paint(); };
    $('ce-file').onchange = function () {
      var f = this.files[0]; if (!f) return;
      var im = new Image(); im.onload = function () {
        var S = 256, cv = d.createElement('canvas'); cv.width = cv.height = S;
        var m = Math.min(im.width, im.height); cv.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, S, S);
        imgFile = { url: cv.toDataURL('image/jpeg', 0.86) }; paint();
      };
      im.src = URL.createObjectURL(f);
    };
    paint();
    save.onclick = function () {
      var h = handleOf($('ce-name').value);
      if (!h.name && !h.id) { alert('Nhập @tên kênh hoặc link kênh.'); return; }
      c.name = h.name || c.name || h.id; if (h.id) c.id = h.id;
      var idv = $('ce-id').value.trim(); if (idv) { if (!/^UC[\w-]{20,}$/.test(idv)) { alert('Mã kênh phải bắt đầu bằng UC.'); return; } c.id = idv; } else if (!h.id) delete c.id;
      c.title = $('ce-title').value.trim(); if (!c.title) delete c.title;
      c.note = $('ce-note').value.trim(); if (!c.note) delete c.note;
      if ($('ce-on').checked) delete c.on; else c.on = false;
      if (!c.tag || c.type !== 'anime') delete c.tag;
      if (i < 0 && L.some(function (q) { return nn(q.name) === nn(c.name); })) { alert('Kênh này đã có trong danh sách.'); return; }
      save.disabled = true;
      var p = Promise.resolve();
      if (imgFile && CH.live) {
        var fn = 'kenh/' + (nn(c.name).replace(/@/g, '') || 'kenh') + '.jpg';
        $('ce-msg').textContent = 'Đang tải ảnh…';
        p = api('/a/music/file?name=' + encodeURIComponent(fn), { method: 'POST', body: JSON.stringify({ message: 'Ảnh kênh ' + c.name, content: imgFile.url.split(',')[1], branch: MUS.branch || 'main', sha: CH.imgSha && CH.imgSha[fn] }) })
          .then(function (j) { if (!j.ok) throw new Error(j.error); c.img = j.path + '?v=' + Date.now().toString(36); });
      }
      p.then(function () { if (i >= 0) L[i] = c; else L.push(c); return saveChannels((i >= 0 ? 'Sửa kênh ' : 'Thêm kênh ') + c.name); })
        .then(function () { go('channels'); }, function () { save.disabled = false; });
    };
  }

  /* ---------- Độ to của bài (để các bài nghe đều nhau) ---------- */
  var REF_DB = -16;   // độ to chung (đo trên trình duyệt); bài to hơn thì giảm, nhỏ hơn thì tăng (tối đa +6 dB)
  function gainOf(L) { return Math.max(-12, Math.min(6, Math.round((REF_DB - L) * 10) / 10)); }
  function loudness(srcOrFile) {
    var get = typeof srcOrFile === 'string' ? fetch(srcOrFile).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }) : srcOrFile.arrayBuffer();
    return get.then(function (buf) {
      var AC = w.AudioContext || w.webkitAudioContext, ac = new AC();
      return new Promise(function (ok, no) { ac.decodeAudioData(buf, ok, no); }).then(function (ab) {
        try { ac.close(); } catch (e) { /* bỏ qua */ }
        var ch = [], n = ab.length, sr = ab.sampleRate, win = Math.round(sr * 0.4), vals = [];
        for (var c = 0; c < ab.numberOfChannels; c++) ch.push(ab.getChannelData(c));
        for (var i = 0; i + win < n; i += win) {
          var sum = 0;
          for (var j = i; j < i + win; j += 4) { var v = 0; for (var c2 = 0; c2 < ch.length; c2++) v += ch[c2][j]; v /= ch.length; sum += v * v; }
          vals.push(10 * Math.log10(sum / (win / 4) + 1e-12));
        }
        vals = vals.filter(function (v) { return v > -50; }).sort(function (a, b) { return a - b; });
        var top = vals.slice(Math.floor(vals.length * 0.3));          // bỏ đoạn im / nhỏ
        var e = top.reduce(function (a, v) { return a + Math.pow(10, v / 10); }, 0) / Math.max(1, top.length);
        return 10 * Math.log10(e);
      });
    });
  }
  // đoạn trích mặc định: 3 câu đầu điệp khúc (không có thì 3 câu đầu bài)
  function pickEx(ls) {
    var i = -1; ls.forEach(function (l, k) { if (i < 0 && /ĐIỆP KHÚC|CHORUS/i.test(l.s || '')) i = k; });
    if (i < 0) { var cnt = {}; ls.forEach(function (l) { cnt[l.t] = (cnt[l.t] || 0) + 1; }); ls.forEach(function (l, k) { if (i < 0 && cnt[l.t] > 1) i = k; }); }
    if (i < 0) i = 0;
    return ls.slice(i, i + 3).map(function (l) { return l.t; });
  }
  // chia đều giờ từng chữ trong câu (khi file lời không có giờ từng chữ)
  function evenWords(l, next, dur) {
    var words = String(l.t).split(/\s+/).filter(Boolean), a = l.at, b = next ? next.at - 0.3 : Math.min(dur || a + 5, a + 5);
    var len = Math.max(0.6, Math.min(b - a, words.length * 0.6)), tot = words.reduce(function (s, x) { return s + x.length + 1; }, 0), acc = 0;
    return words.map(function (x) { var at = a + len * acc / tot; acc += x.length + 1; return [Math.round(at * 100) / 100, x]; });
  }

  /* ---------- Trình canh lời theo nhạc: nghe, chỉnh giờ, sửa chữ, xem trước ---------- */
  function syncEditor(x, url, done) {
    var orig = JSON.stringify(x.lyrics || []);
    var L = JSON.parse(orig), cur = -1, tapI = -1, raf = 0;
    $('title').textContent = 'Canh lời: ' + (x.title || 'bài mới');
    $('subtitle').textContent = L.length + ' câu · bấm vào sóng nhạc để nhảy tới · phím cách = phát / dừng';
    var view = $('view'); view.innerHTML = '';
    var c = el('section', 'card sync');
    c.innerHTML =
      '<div class="tr"><button class="play" id="s-play" aria-label="Phát">▶</button><div class="tm"><b id="s-t">0:00.0</b> / <span id="s-d">' + mmss(x.dur) + '</span></div>' +
      '<div class="seg sm" id="s-rate"><button data-r="0.75">0.75×</button><button data-r="1" class="on">1×</button></div>' +
      '<div class="seg sm" id="s-mode"><button data-m="line">Theo câu</button><button data-m="word">Theo chữ</button><button data-m="">Tô dần</button></div>' +
      '<span class="grow"></span><span class="muted" style="font-size:13px">Lệch cả bài</span><button class="btn sm" id="s-m">−0.2s</button><button class="btn sm" id="s-p">+0.2s</button>' +
      '<button class="btn sm tap" id="s-tap">● Bấm theo nhạc</button></div>' +
      '<canvas id="s-wave" height="96"></canvas>' +
      '<div class="tapbar" id="s-tapbar" hidden><div><b id="s-tapn"></b><span>Bấm <kbd>Space</kbd> hoặc nút bên phải <b>đúng lúc câu này bắt đầu hát</b>. Bấm Esc để dừng.</span></div><button class="btn dark" id="s-mark">Câu này bắt đầu ↵</button></div>' +
      '<div class="sg"><div class="sl" id="s-lines"></div><div><div class="kv" id="s-pv"><div class="kbg"></div><div class="ktag" id="k-tag"></div><div class="kl p" id="k-p"></div><div class="kl c" id="k-c"></div><div class="kl n" id="k-n"></div><div class="kfoot">XEM TRƯỚC · giống trang Nhạc trên TV</div></div>' +
      '<div class="muted" style="font-size:13px;margin-top:10px;line-height:1.5">Mẹo: phát 0.75× để bấm dễ hơn. Câu nào lệch thì bấm ▶ ở câu đó nghe lại rồi chỉnh −/+ 0.1 giây.</div></div></div>' +
      '<div class="edbar"><span class="muted" id="s-msg">Thay đổi chỉ được lưu khi bấm “Lưu lên GitHub” ở trang trước.</span><button class="btn" id="s-cancel">Bỏ thay đổi</button><button class="btn dark" id="s-ok">Xong</button></div>';
    view.appendChild(c);
    var au = new Audio(url); au.preload = 'auto';
    var wave = $('s-wave'), peaks = null;
    fetch(url).then(function (r) { return r.arrayBuffer(); }).then(function (buf) {
      var ac = new (w.AudioContext || w.webkitAudioContext)();
      return new Promise(function (ok, no) { ac.decodeAudioData(buf, ok, no); });
    }).then(function (ab) {
      var d0 = ab.getChannelData(0), n = 1200, step = Math.floor(d0.length / n); peaks = [];
      for (var i = 0; i < n; i++) { var m = 0; for (var j = i * step; j < (i + 1) * step; j += 16) { var v = Math.abs(d0[j]); if (v > m) m = v; } peaks.push(m); }
      if (!x.dur) x.dur = Math.round(ab.duration);
    }).catch(function () { peaks = []; });
    function dur() { return au.duration || x.dur || 240; }
    function f2(t) { t = Math.max(0, t); return Math.floor(t / 60) + ':' + ('0' + (t % 60).toFixed(1)).slice(-4); }
    function drawWave() {
      var W = wave.clientWidth * 2, H = 192; if (wave.width !== W) wave.width = W;
      var g = wave.getContext('2d'); g.clearRect(0, 0, W, H);
      var D = dur(), t = au.currentTime;
      if (peaks && peaks.length) {
        var bw = W / peaks.length;
        for (var i = 0; i < peaks.length; i++) { var h = Math.max(2, peaks[i] * (H - 40)); g.fillStyle = i / peaks.length < t / D ? '#C9973F' : '#D7DAE2'; g.fillRect(i * bw, (H - h) / 2, Math.max(1, bw - 0.6), h); }
      }
      L.forEach(function (l, k) {
        var xx = l.at / D * W; g.fillStyle = k === cur ? '#B42318' : 'rgba(20,22,29,.55)'; g.fillRect(xx, 0, k === cur ? 3 : 2, H);
        if (k % (W < 1400 ? 5 : 2) === 0 || k === cur) { g.font = '600 18px system-ui'; g.fillText(String(k + 1), xx + 4, 18); }
      });
      g.fillStyle = '#14161D'; g.fillRect(t / D * W - 1, 0, 3, H);
    }
    wave.onclick = function (e) { var r = wave.getBoundingClientRect(); au.currentTime = (e.clientX - r.left) / r.width * dur(); };
    var box = $('s-lines');
    function rows() {
      box.innerHTML = '';
      L.forEach(function (l, k) {
        var r = el('div', 'srow', '<span class="n">' + (k + 1) + '</span><input class="tt" value="' + f2(l.at) + '"><button class="nb" data-d="-0.1">−</button><button class="nb" data-d="0.1">+</button><input class="tx" value="' + esc(l.t) + '"><button class="nb pl" title="Nghe từ câu này">▶</button>');
        r.dataset.k = k;
        r.querySelector('.tt').onchange = function () { var m = /^(\d+):(\d+(?:\.\d+)?)$/.exec(this.value.trim()); if (m) setAt(k, (+m[1]) * 60 + parseFloat(m[2])); else this.value = f2(L[k].at); };
        [].forEach.call(r.querySelectorAll('[data-d]'), function (b) { b.onclick = function () { setAt(k, L[k].at + parseFloat(b.dataset.d)); au.currentTime = Math.max(0, L[k].at - 1); if (au.paused) au.play(); }; });
        r.querySelector('.tx').oninput = function () { var nw = this.value; if (L[k].w && nw.split(/\s+/).filter(Boolean).length !== L[k].w.length) delete L[k].w; L[k].t = nw; cur = -2; };
        r.querySelector('.pl').onclick = function () { au.currentTime = Math.max(0, L[k].at - 0.8); au.play(); };
        box.appendChild(r);
      });
    }
    function setAt(k, at) {
      at = Math.max(0, Math.round(at * 100) / 100); var d = at - L[k].at; L[k].at = at;
      if (L[k].w) L[k].w = L[k].w.map(function (q) { return [Math.round((q[0] + d) * 100) / 100, q[1]]; });
      var r = box.children[k]; if (r) r.querySelector('.tt').value = f2(at);
      cur = -2;
    }
    function shiftAll(d) { L.forEach(function (l, k) { setAt(k, l.at + d); }); }
    rows();
    function lineAt(t) { var i = -1; for (var k = 0; k < L.length; k++) { if (L[k].at <= t + 0.05) i = k; else break; } return i; }
    function sweep(k, t) {
      var l = L[k]; if (!l) return 1;
      var b = L[k + 1] ? L[k + 1].at : l.at + 4, m = x.mode || '';
      if (m === 'line') return 1;
      if (m === 'word') {
        var ws = l.w && l.w.length ? l.w : evenWords(l, L[k + 1], x.dur), tot = 0, done = 0;
        ws.forEach(function (q) { tot += q[1].length + 1; });
        for (var q = 0; q < ws.length; q++) { var ln = ws[q][1].length + 1, s0 = ws[q][0], s1 = ws[q + 1] ? ws[q + 1][0] : Math.min(b, s0 + 1.2); if (t >= s1) done += ln; else { if (t > s0) done += ln * (t - s0) / Math.max(0.05, s1 - s0); break; } }
        return done / Math.max(1, tot);
      }
      return Math.max(0, Math.min(1, (t - l.at) / Math.max(0.8, Math.min(b - l.at, 8) - 0.3)));
    }
    function frame() {
      var t = au.currentTime, k = lineAt(t);
      $('s-t').textContent = f2(t); if (au.duration) $('s-d').textContent = mmss(au.duration);
      if (k !== cur) {
        cur = k;
        [].forEach.call(box.children, function (r, j) { r.classList.toggle('on', j === k); r.classList.toggle('done', j < k); });
        var rr = box.children[Math.max(0, k)]; if (rr && tapI < 0) box.scrollTop = rr.offsetTop - box.clientHeight * 0.35;
        var tg = ''; for (var q = Math.max(0, k); q >= 0; q--) if (L[q] && L[q].s) { tg = L[q].s; break; }
        $('k-tag').textContent = k < 0 ? 'NHẠC DẠO' : tg;
        $('k-p').textContent = L[k - 1] ? L[k - 1].t : ''; $('k-c').textContent = k >= 0 ? L[k].t : (L[0] ? '♪ ' + L[0].t : ''); $('k-n').textContent = L[k + 1] ? L[k + 1].t : '';
        $('k-c').classList.toggle('wait', k < 0);
      }
      $('k-c').style.backgroundSize = (k >= 0 ? sweep(k, t) * 100 : 0).toFixed(1) + '% 100%, 100% 100%';
      drawWave();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    au.onplay = function () { $('s-play').textContent = '❚❚'; }; au.onpause = function () { $('s-play').textContent = '▶'; };
    $('s-play').onclick = function () { au.paused ? au.play() : au.pause(); };
    [].forEach.call($('s-rate').children, function (b) { b.onclick = function () { au.playbackRate = +b.dataset.r; [].forEach.call($('s-rate').children, function (q) { q.classList.toggle('on', q === b); }); }; });
    function pm() { [].forEach.call($('s-mode').children, function (b) { b.classList.toggle('on', b.dataset.m === (x.mode || '')); }); }
    [].forEach.call($('s-mode').children, function (b) { b.onclick = function () { x.mode = b.dataset.m || undefined; pm(); }; }); pm();
    $('s-m').onclick = function () { shiftAll(-0.2); }; $('s-p').onclick = function () { shiftAll(0.2); };
    function tapShow() { $('s-tapbar').hidden = tapI < 0; $('s-tap').classList.toggle('on', tapI >= 0); if (tapI >= 0) { $('s-tapn').textContent = 'Câu ' + (tapI + 1) + ' / ' + L.length + ': “' + (L[tapI] ? L[tapI].t : '') + '”'; var r = box.children[tapI]; if (r) { [].forEach.call(box.children, function (q) { q.classList.remove('tap'); }); r.classList.add('tap'); box.scrollTop = r.offsetTop - box.clientHeight * 0.35; } } }
    $('s-tap').onclick = function () {
      if (tapI >= 0) { tapI = -1; tapShow(); return; }
      var k = lineAt(au.currentTime); tapI = Math.max(0, k + 1 < L.length && k >= 0 ? k + 1 : 0); if (k < 0) tapI = 0;
      au.currentTime = Math.max(0, tapI > 0 ? L[tapI].at - 3 : 0); au.play(); tapShow();
    };
    function mark() { if (tapI < 0) return; setAt(tapI, au.currentTime - 0.12); tapI++; if (tapI >= L.length) { tapI = -1; $('s-msg').innerHTML = '<b style="color:#1E6B33">Đã bấm xong ' + L.length + ' câu.</b> Nghe lại để kiểm tra rồi bấm Xong.'; } tapShow(); }
    $('s-mark').onclick = mark;
    function key(e) {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); if (tapI >= 0) mark(); else $('s-play').onclick(); }
      else if (e.key === 'Escape') { tapI = -1; tapShow(); }
    }
    d.addEventListener('keydown', key);
    function leave(keep) {
      cancelAnimationFrame(raf); au.pause(); d.removeEventListener('keydown', key);
      if (keep) { L.sort(function (a, b) { return a.at - b.at; }); x.lyrics = L; if (JSON.stringify(L) !== orig) x.lrcAuto = false; }
      done();
    }
    $('s-cancel').onclick = function () { leave(false); }; $('s-ok').onclick = function () { leave(true); };
    MUS.syncAudio = au;
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
  var qv = /[?&]v=(overview|devices|profile|report|music|channels)/.exec(location.search); if (qv) state.view = qv[1];
  initColors();
  state.token = sessionStorage.getItem('tt.admintok') || '';
  if (state.token && cfg().url) start(); else showLogin('');
})(window, document);
