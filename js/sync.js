/* Đăng nhập Google và đồng bộ lịch sử xem, tiến độ, danh sách, cài đặt giữa các máy.
   Dữ liệu lưu trong thư mục ẩn của app trên Google Drive của bạn (appDataFolder):
   chỉ app này đọc được, không hiện trong Drive, không ai khác xem được.
   - TV (Samsung, Android TV): đăng nhập bằng mã trên google.com/device (không cần gõ mật khẩu trên TV).
   - Trình duyệt (máy tính, iPhone): cửa sổ đăng nhập Google. */
(function (w) {
  'use strict';
  var d = document, C = w.APP_CONFIG;
  var SCOPE = 'openid email https://www.googleapis.com/auth/drive.appdata';
  var FILE = 'tongtai-sync.json';
  var isWeb = /^https?:/.test(w.location.protocol) && !w.AndroidApp && !w.tizen;

  function S() { return w.Store.raw('google', null); }
  function save(a) { w.Store.applyRaw('google', a); }
  function tvId() { return String(C.GOOGLE_TV_CLIENT_ID || '').trim(); }
  function tvSecret() { return String(C.GOOGLE_TV_CLIENT_SECRET || '').trim(); }
  function webId() { return String(C.GOOGLE_WEB_CLIENT_ID || '').trim(); }
  function configured() { return isWeb ? !!webId() : !!(tvId() && tvSecret()); }

  /* ---------- HTTP (Android dùng cầu nối Java để tránh lỗi CORS) ---------- */

  var cbN = 0;
  w.__httpCb = {};
  function http(method, url, headers, body) {
    return new Promise(function (resolve, reject) {
      function done(status, text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
        if (status >= 200 && status < 300) resolve(data);
        else reject({ status: status, data: data, net: status === 0 });
      }
      if (w.AndroidApp && w.AndroidApp.http) {
        var id = 'h' + (++cbN);
        w.__httpCb[id] = function (status, text) { delete w.__httpCb[id]; done(status, text); };
        w.AndroidApp.http(id, method, url, JSON.stringify(headers || {}), body || '');
        return;
      }
      var x = new XMLHttpRequest();
      x.open(method, url);
      Object.keys(headers || {}).forEach(function (k) { x.setRequestHeader(k, headers[k]); });
      x.timeout = 20000;
      x.onload = function () { done(x.status, x.responseText); };
      x.onerror = x.ontimeout = function () { done(0, ''); };
      x.send(body || null);
    });
  }
  function form(o) {
    return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&');
  }
  function emailFromIdToken(t) {
    try {
      var p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      return JSON.parse(decodeURIComponent(escape(atob(p)))).email || '';
    } catch (e) { return ''; }
  }

  /* ---------- Đăng nhập trên TV: mã thiết bị (google.com/device) ---------- */

  // Bắt đầu: trả về { code, url, interval, expires, poll(): Promise }
  function startDevice() {
    if (!tvId() || !tvSecret()) return Promise.reject({ config: true });
    return http('POST', 'https://oauth2.googleapis.com/device/code',
      { 'Content-Type': 'application/x-www-form-urlencoded' }, form({ client_id: tvId(), scope: SCOPE }))
      .then(function (r) {
        var stop = false, wait = (r.interval || 5) * 1000, until = Date.now() + (r.expires_in || 1800) * 1000;
        function poll() {
          return new Promise(function (resolve, reject) {
            (function tick() {
              if (stop) return reject({ cancelled: true });
              if (Date.now() > until) return reject({ expired: true });
              http('POST', 'https://oauth2.googleapis.com/token', { 'Content-Type': 'application/x-www-form-urlencoded' },
                form({ client_id: tvId(), client_secret: tvSecret(), device_code: r.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }))
                .then(function (t) {
                  var acc = { kind: 'device', access: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000, refresh: t.refresh_token, email: emailFromIdToken(t.id_token || '') };
                  save(acc);
                  resolve(acc);
                }, function (e) {
                  var err = e && e.data && e.data.error;
                  if (err === 'authorization_pending') return setTimeout(tick, wait);
                  if (err === 'slow_down') { wait += 5000; return setTimeout(tick, wait); }
                  reject(e);
                });
            })();
          });
        }
        return { code: r.user_code, url: r.verification_url || 'https://www.google.com/device', poll: poll, cancel: function () { stop = true; } };
      });
  }

  /* ---------- Đăng nhập trên trình duyệt: Google Identity Services ---------- */

  var gisP = null, tokenClient = null;
  function loadGis() {
    if (gisP) return gisP;
    gisP = new Promise(function (resolve, reject) {
      if (w.google && w.google.accounts && w.google.accounts.oauth2) return resolve();
      var s = d.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = function () { resolve(); };
      s.onerror = function () { gisP = null; reject({ net: true }); };
      d.head.appendChild(s);
    });
    return gisP;
  }
  function webLogin(silent) {
    return loadGis().then(function () {
      return new Promise(function (resolve, reject) {
        var old = S();
        tokenClient = w.google.accounts.oauth2.initTokenClient({
          client_id: webId(), scope: SCOPE, prompt: silent ? '' : 'select_account',
          hint: old && old.email ? old.email : undefined,
          callback: function (t) {
            if (!t || t.error) return reject(t || {});
            var acc = { kind: 'web', access: t.access_token, exp: Date.now() + ((+t.expires_in || 3600) - 60) * 1000, email: old && old.email || '' };
            save(acc);
            http('GET', 'https://www.googleapis.com/oauth2/v3/userinfo', { Authorization: 'Bearer ' + acc.access })
              .then(function (u) { acc.email = u.email || acc.email; save(acc); resolve(acc); }, function () { resolve(acc); });
          },
          error_callback: function (e) { reject(e || {}); }
        });
        tokenClient.requestAccessToken();
      });
    });
  }

  /* ---------- Mã truy cập ---------- */

  function token() {
    var a = S();
    if (!a) return Promise.reject({ nologin: true });
    if (a.access && a.exp > Date.now()) return Promise.resolve(a.access);
    if (a.kind === 'device' && a.refresh) {
      return http('POST', 'https://oauth2.googleapis.com/token', { 'Content-Type': 'application/x-www-form-urlencoded' },
        form({ client_id: tvId(), client_secret: tvSecret(), refresh_token: a.refresh, grant_type: 'refresh_token' }))
        .then(function (t) {
          a.access = t.access_token;
          a.exp = Date.now() + (t.expires_in - 60) * 1000;
          save(a);
          return a.access;
        }, function (e) {
          if (e && e.data && e.data.error === 'invalid_grant') { a.access = ''; a.refresh = ''; a.expired = true; save(a); }
          throw e;
        });
    }
    // trình duyệt: cần một lần chạm để lấy lại mã (trình duyệt chặn cửa sổ tự mở)
    a.needTap = true;
    save(a);
    return Promise.reject({ needTap: true });
  }

  /* ---------- Google Drive: 1 file JSON trong thư mục ẩn của app ---------- */

  function drive(method, url, body, type) {
    return token().then(function (tk) {
      var h = { Authorization: 'Bearer ' + tk };
      if (type) h['Content-Type'] = type;
      return http(method, url, h, body);
    });
  }
  function findFile() {
    var id = w.Store.raw('syncFile', '');
    if (id) return Promise.resolve(id);
    return drive('GET', 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=' +
      encodeURIComponent("name='" + FILE + "'")).then(function (r) {
      var f = (r && r.files || [])[0];
      if (f) w.Store.applyRaw('syncFile', f.id);
      return f ? f.id : '';
    });
  }
  function download(id) {
    if (!id) return Promise.resolve(null);
    return drive('GET', 'https://www.googleapis.com/drive/v3/files/' + id + '?alt=media').catch(function (e) {
      if (e && e.status === 404) { w.Store.applyRaw('syncFile', ''); return null; }
      throw e;
    });
  }
  function upload(id, data) {
    var json = JSON.stringify(data);
    if (id) return drive('PATCH', 'https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', json, 'application/json');
    var b = 'tongtai' + Date.now();
    var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) + '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' +
      json + '\r\n--' + b + '--';
    return drive('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', body, 'multipart/related; boundary=' + b)
      .then(function (r) { if (r && r.id) w.Store.applyRaw('syncFile', r.id); return r; });
  }

  /* ---------- GitHub Gist: cách đồng bộ khác, không cần đăng nhập Google ----------
     Người dùng dán một token GitHub (classic, chỉ tick quyền "gist"). Dữ liệu nằm trong một Gist RIÊNG TƯ
     của chính họ. Token chỉ lưu trên thiết bị này (không đồng bộ, không nằm trong code). */

  var GIST_DESC = 'tongtai-sync';
  function ghToken() { var g = w.Store.raw('gh', null); return g && g.token ? g.token : ''; }
  function gh(method, path, body) {
    var h = { Authorization: 'Bearer ' + ghToken(), Accept: 'application/vnd.github+json' };
    if (body) h['Content-Type'] = 'application/json';
    return http(method, 'https://api.github.com' + path, h, body ? JSON.stringify(body) : '');
  }
  function gistFind() {
    var id = w.Store.raw('ghGist', '');
    if (id) return Promise.resolve(id);
    return gh('GET', '/gists?per_page=100').then(function (list) {
      var f = (Array.isArray(list) ? list : []).filter(function (g) { return g.description === GIST_DESC && g.files && g.files[FILE]; })[0];
      if (f) w.Store.applyRaw('ghGist', f.id);
      return f ? f.id : '';
    });
  }
  function gistDownload(id) {
    if (!id) return Promise.resolve(null);
    return gh('GET', '/gists/' + id).then(function (g) {
      var f = g && g.files && g.files[FILE];
      if (!f) return null;
      var text = f.truncated && f.raw_url ? http('GET', f.raw_url, {}) : Promise.resolve(f.content);
      return text.then(function (t) { try { return typeof t === 'string' ? JSON.parse(t) : t; } catch (e) { return null; } });
    }, function (e) {
      if (e && e.status === 404) { w.Store.applyRaw('ghGist', ''); return null; }
      throw e;
    });
  }
  function gistUpload(id, data) {
    var files = {}; files[FILE] = { content: JSON.stringify(data) };
    if (id) return gh('PATCH', '/gists/' + id, { files: files });
    return gh('POST', '/gists', { description: GIST_DESC, public: false, files: files })
      .then(function (r) { if (r && r.id) w.Store.applyRaw('ghGist', r.id); return r; });
  }
  // Kết nối: kiểm tra token đúng chưa rồi lưu
  function connectGithub(tok) {
    tok = String(tok || '').replace(/\s+/g, '');
    if (tok.length < 20) return Promise.reject({ bad: true });
    w.Store.applyRaw('gh', { token: tok });
    return gh('GET', '/user').then(function () { return sync('login'); }, function (e) {
      w.Store.applyRaw('gh', null);
      throw e;
    });
  }
  function disconnectGithub() {
    w.Store.applyRaw('gh', null); w.Store.applyRaw('ghGist', '');
    notify();
  }

  /* ---------- Gộp dữ liệu hai bên ---------- */

  // API key và PLAYER_HOST là riêng từng máy (TV và web có thể dùng key khác nhau): không đồng bộ
  var LOCAL_ONLY = ['API_KEY', 'PLAYER_HOST', 'THEME'];
  function stripPrefs(p) {
    var o = JSON.parse(JSON.stringify(p || {}));
    if (o.settings) LOCAL_ONLY.forEach(function (k) { delete o.settings[k]; });
    return o;
  }

  function snapshot() {
    var R = w.Store.raw, keep = R('keep', {}), ch = {};
    Object.keys(keep).forEach(function (k) { if (k.indexOf('ch:') === 0) ch[k] = keep[k]; });
    // Hồ sơ người xem khác Guest: lịch sử, tiến độ, danh sách riêng
    var pf = {};
    ((R('prefs', {}).profiles) || []).forEach(function (x) {
      if (!x || !x.id || x.id === 'guest') return;
      pf[x.id] = { stamps: R('stamps@' + x.id, {}), prog: R('prog@' + x.id, {}), recent: R('recent@' + x.id, []), favs: R('favs@' + x.id, []), stats: R('stats@' + x.id, {}), sq: R('sq@' + x.id, []) };
    });
    return {
      v: 1, at: Date.now(), stamps: R('stamps', {}),
      prog: R('prog', {}), recent: R('recent', []), favs: R('favs', []), blocked: R('blocked', {}), prefs: stripPrefs(R('prefs', {})), ch: ch, pf: pf, stats: R('stats', {}), sq: R('sq', [])
    };
  }
  function wrapPf(x) { x = x || {}; return { v: 1, stamps: x.stamps || {}, prog: x.prog || {}, recent: x.recent || [], favs: x.favs || [], stats: x.stats || {}, sq: x.sq || [], blocked: {}, prefs: {} }; }
  // Hồ sơ người xem: KHÔNG bao giờ mất khi gộp (cài lại app rồi khôi phục, hay hai máy cùng thêm hồ sơ).
  // Bản cài đặt được chọn giữ nguyên; hồ sơ chỉ có ở bản kia thì thêm vào, trừ hồ sơ đã bị xóa (profDel).
  function mergeProfiles(win, other) {
    if (!win || !other) return win || other;
    var o = JSON.parse(JSON.stringify(win)), x = other;
    var del = {};
    [o.profDel || {}, x.profDel || {}].forEach(function (m) { Object.keys(m).forEach(function (k) { if (!del[k] || m[k] > del[k]) del[k] = m[k]; }); });
    var list = (o.profiles || []).slice(), have = {};
    list.forEach(function (p) { if (p && p.id) have[p.id] = 1; });
    (x.profiles || []).forEach(function (p) { if (p && p.id && !have[p.id] && !del[p.id]) { list.push(p); have[p.id] = 1; } });
    o.profiles = list.filter(function (p) { return p && !del[p.id]; });
    if (Object.keys(del).length) o.profDel = del;
    if (o.guestAv == null && x.guestAv != null) o.guestAv = x.guestAv;
    if (!o.guestPin && x.guestPin) o.guestPin = x.guestPin;
    ['psettings', 'favch'].forEach(function (k) {   // cài đặt riêng, kênh yêu thích của hồ sơ chỉ có ở bản kia
      var src = x[k] || {};
      Object.keys(src).forEach(function (id) { o[k] = o[k] || {}; if (o[k][id] === undefined && !del[id]) o[k][id] = src[id]; });
    });
    return o;
  }
  // Thống kê xem: mỗi ngày lấy bản có nhiều thời gian xem hơn (tránh cộng trùng); giữ 35 ngày gần nhất
  function mergeStats(a, b) {
    var o = {};
    [a || {}, b || {}].forEach(function (m) { Object.keys(m).forEach(function (k) { if (m[k] && (!o[k] || (m[k].s || 0) > (o[k].s || 0))) o[k] = m[k]; }); });
    var keys = Object.keys(o).sort();
    keys.slice(0, Math.max(0, keys.length - 35)).forEach(function (k) { delete o[k]; });
    return o;
  }
  // 5 từ khóa tìm gần đây: máy này trước, thêm từ máy kia
  function mergeSq(a, b) {
    var o = [];
    (a || []).concat(b || []).forEach(function (q) { if (q && !o.some(function (x) { return x.toLowerCase() === String(q).toLowerCase(); })) o.push(q); });
    return o.slice(0, 5);
  }
  function merge(a, b) {
    if (!b || !b.v) return a;
    var sa = a.stamps || {}, sb = b.stamps || {}, out = { v: 1, at: Date.now(), stamps: {} };
    var clr = Math.max(sa.histClr || 0, sb.histClr || 0);
    if (clr) out.stamps.histClr = clr;
    // dấu "đã xóa 1 phim": gộp hai bên, bỏ dấu quá 60 ngày
    var rm = {}, old = Date.now() - 60 * 86400e3;
    [sb.rm || {}, sa.rm || {}].forEach(function (m) { Object.keys(m).forEach(function (k) { if (m[k] > old && m[k] > (rm[k] || 0)) rm[k] = m[k]; }); });
    out.stamps.rm = rm;
    // tiến độ xem: lấy bản mới hơn của từng phim
    var prog = {};
    [b.prog || {}, a.prog || {}].forEach(function (m) {
      Object.keys(m).forEach(function (id) {
        var x = m[id];
        if (!x || (x.t || 0) < Math.max(clr, rm['p:' + id] || 0)) return;
        if (!prog[id] || (x.t || 0) > (prog[id].t || 0)) prog[id] = x;
      });
    });
    var keys = Object.keys(prog).sort(function (x, y) { return prog[y].t - prog[x].t; });
    keys.slice(300).forEach(function (k) { delete prog[k]; });
    out.prog = prog;
    // vừa xem: gộp, mới nhất trước
    var rec = {}, list = [];
    (b.recent || []).concat(a.recent || []).forEach(function (r) {
      if (!r || !r.key || (r.t || 0) < Math.max(clr, rm['r:' + r.key] || 0)) return;
      if (!rec[r.key] || (r.t || 0) > (rec[r.key].t || 0)) rec[r.key] = r;
    });
    Object.keys(rec).forEach(function (k) { list.push(rec[k]); });
    list.sort(function (x, y) { return (y.t || 0) - (x.t || 0); });
    out.recent = list.slice(0, 40);
    // danh sách, phim đã bỏ, cài đặt: lấy bên sửa sau cùng
    ['favs', 'blocked', 'prefs'].forEach(function (k) {
      var ta = sa[k] || 0, tb = sb[k] || 0;
      out[k] = tb > ta ? b[k] : a[k];
      out.stamps[k] = Math.max(ta, tb);
    });
    if (!a.isPf) out.prefs = mergeProfiles(out.prefs, (sb.prefs || 0) > (sa.prefs || 0) ? a.prefs : b.prefs);
    ['prog', 'recent'].forEach(function (k) { out.stamps[k] = Math.max(sa[k] || 0, sb[k] || 0); });
    // mã kênh đã tìm: gộp (máy này đã tìm thì máy kia khỏi tốn hạn mức)
    out.stats = mergeStats(a.stats, b.stats);
    out.sq = mergeSq(a.sq, b.sq);
    out.ch = {};
    [b.ch || {}, a.ch || {}].forEach(function (m) { Object.keys(m).forEach(function (k) { out.ch[k] = m[k]; }); });
    // từng hồ sơ: gộp như dữ liệu chính
    if (!a.isPf) {
      out.pf = {};
      var ids = {};
      [a.pf || {}, b.pf || {}].forEach(function (m) { Object.keys(m).forEach(function (k) { ids[k] = 1; }); });
      Object.keys(ids).forEach(function (id) {
        var pa = wrapPf((a.pf || {})[id]), pb = (b.pf || {})[id] ? wrapPf(b.pf[id]) : null;
        pa.isPf = true;
        var mm = merge(pa, pb);
        out.pf[id] = { stamps: mm.stamps, prog: mm.prog, recent: mm.recent, favs: mm.favs, stats: mm.stats, sq: mm.sq };
      });
    }
    return out;
  }
  function apply(m) {
    var A = w.Store.applyRaw, R = w.Store.raw;
    var changed = false;
    // giữ lại API key / PLAYER_HOST của máy này
    var mine = (R('prefs', {}).settings) || {}, p2 = JSON.parse(JSON.stringify(m.prefs || {}));
    p2.settings = p2.settings || {};
    LOCAL_ONLY.forEach(function (k) { if (mine[k] !== undefined) p2.settings[k] = mine[k]; });
    m = JSON.parse(JSON.stringify(m)); m.prefs = p2;
    ['prog', 'recent', 'favs', 'blocked', 'prefs'].forEach(function (k) {
      if (JSON.stringify(R(k, null)) !== JSON.stringify(m[k])) { A(k, m[k]); changed = true; }
    });
    ['stats', 'sq'].forEach(function (k) { if (m[k] && JSON.stringify(R(k, null)) !== JSON.stringify(m[k])) A(k, m[k]); });
    A('stamps', m.stamps);
    // hồ sơ người xem: chỉ ghi cho hồ sơ còn trong danh sách
    var live = {};
    ((R('prefs', {}).profiles) || []).forEach(function (x) { if (x && x.id) live[x.id] = 1; });
    Object.keys(m.pf || {}).forEach(function (id) {
      if (!live[id]) return;
      var x = m.pf[id];
      ['prog', 'recent', 'favs', 'stats', 'sq'].forEach(function (k) {
        if (x[k] && JSON.stringify(R(k + '@' + id, null)) !== JSON.stringify(x[k])) { A(k + '@' + id, x[k]); changed = true; }
      });
      if (x.stamps) A('stamps@' + id, x.stamps);
    });
    var keep = R('keep', {});
    Object.keys(m.ch || {}).forEach(function (k) { if (!keep[k]) { keep[k] = m.ch[k]; } });
    A('keep', keep);
    if (changed && w.Settings && w.Settings.apply) w.Settings.apply();
    return changed;
  }

  /* ---------- Đồng bộ ---------- */

  var busy = null, dirtyT = null, listeners = [];
  function status() {
    var a = S();
    return {
      configured: configured(), web: isWeb, google: !!(a && (a.refresh || a.access || a.kind === 'web')),
      github: !!ghToken(),
      loggedIn: !!(a && (a.refresh || a.access || a.kind === 'web')) || !!ghToken(),
      email: a && a.email || '', lastSync: w.Store.raw('syncAt', 0), error: w.Store.raw('syncErr', ''),
      needTap: !!(a && a.needTap), expired: !!(a && a.expired)
    };
  }
  function notify() { listeners.forEach(function (f) { try { f(status()); } catch (e) { /* bỏ qua */ } }); }

  // Một "nơi lưu": Google Drive hoặc GitHub Gist
  var DRIVE = { on: function () { var a = S(); return !!(a && (a.refresh || a.access || a.kind === 'web')); }, find: findFile, download: download, upload: upload };
  var GIST = { on: function () { return !!ghToken(); }, find: gistFind, download: gistDownload, upload: gistUpload };

  function syncOne(B) {
    return B.find().then(function (id) {
      return B.download(id).then(function (remote) {
        var merged = merge(snapshot(), remote);
        var changed = apply(merged);
        return B.upload(id, merged).then(function () { return changed; });
      });
    });
  }

  function sync(why) {
    if (busy) return busy;
    if (!status().loggedIn) return Promise.resolve(false);
    var list = [DRIVE, GIST].filter(function (B) { return B.on(); });
    busy = list.reduce(function (p, B) {
      return p.then(function (ch) { return syncOne(B).then(function (c) { return ch || c; }); });
    }, Promise.resolve(false)).then(function (changed) {
      w.Store.applyRaw('syncAt', Date.now());
      w.Store.applyRaw('syncErr', '');
      busy = null;
      notify();
      if (changed && why === 'start' && w.Screens && w.Screens.current && w.Screens.current().name === 'home') w.Screens.goTab('home');
      return changed;
    }, function (e) {
      busy = null;
      var msg = e && e.needTap ? 'Chạm “Đồng bộ ngay” để đăng nhập lại' :
        e && e.net ? 'Mất mạng, sẽ thử lại' :
        e && e.status === 401 && ghToken() ? 'Token GitHub sai hoặc hết hạn' :
        e && e.status === 403 && ghToken() ? 'GitHub từ chối: token cần quyền gist' :
        e && e.status === 403 ? driveWhy(e) :
        e && e.data && e.data.error === 'invalid_grant' ? 'Hết hạn đăng nhập, hãy đăng nhập lại' : 'Lỗi đồng bộ';
      w.Store.applyRaw('syncErr', msg);
      if (w.Log) w.Log.err('Đồng bộ: ' + msg + (e && e.status ? ' (mã ' + e.status + ')' : ''));
      notify();
      return false;
    });
    return busy;
  }
  function driveWhy(e) {
    var d = e && e.data && e.data.error, r = '';
    if (d) r = (d.errors && d.errors[0] && d.errors[0].reason) || d.status || '';
    var m = String((d && d.message) || '');
    if (r === 'accessNotConfigured' || /has not been used|is disabled|SERVICE_DISABLED/i.test(m) || r === 'SERVICE_DISABLED') return 'Chưa bật Google Drive API trong Google Cloud (Library → Google Drive API → Enable)';
    if (r === 'insufficientPermissions' || r === 'PERMISSION_DENIED' && /scope/i.test(m)) return 'Thiếu quyền Drive: đăng xuất rồi đăng nhập lại và tick cho phép lưu dữ liệu app';
    if (r === 'rateLimitExceeded' || r === 'userRateLimitExceeded' || r === 'quotaExceeded') return 'Google tạm giới hạn lượt gọi, sẽ thử lại';
    return 'Google từ chối (403' + (r ? ': ' + r : '') + ')';
  }
  function dirty() {
    if (!status().loggedIn) return;
    clearTimeout(dirtyT);
    dirtyT = setTimeout(function () { sync('change'); }, 8000);
  }
  function logout() {
    w.Store.applyRaw('google', null);
    w.Store.applyRaw('syncFile', '');
    if (!ghToken()) w.Store.applyRaw('syncAt', 0);
    try { if (isWeb && w.google && w.google.accounts) w.google.accounts.oauth2.revoke(''); } catch (e) { /* bỏ qua */ }
    notify();
  }
  // Trình duyệt: đăng nhập / lấy lại mã khi người dùng chạm (trình duyệt chỉ cho mở cửa sổ khi có chạm)
  function webLoginTap() {
    var a = S();
    return webLogin(!!(a && a.email)).then(function () {
      var a2 = S(); if (a2) { a2.needTap = false; save(a2); }
      return sync('login');
    });
  }

  /* ---------- Sao lưu tự động hằng tuần ----------
     Google Drive: mỗi tuần một file tongtai-backup-NĂM-THÁNG-NGÀY.json trong thư mục ẩn của app, giữ 4 bản gần nhất.
     GitHub: file tongtai-backup.json trong Gist tongtai-sync (GitHub tự giữ mọi bản cũ trong Revisions). */
  var WEEK = 7 * 86400e3, BKP = 'tongtai-backup', bkBusy = null;
  function ymd(t) { var x = new Date(t), m = x.getMonth() + 1, dd = x.getDate(); return x.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (dd < 10 ? '0' : '') + dd; }
  function backupData() { var m = snapshot(); m.kind = 'backup'; m.app = C.VERSION; return m; }
  function driveBackups() {
    return drive('GET', 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=100&fields=files(id,name,modifiedTime)&q=' +
      encodeURIComponent("name contains '" + BKP + "-'")).then(function (r) {
      return ((r && r.files) || []).sort(function (x, y) { return String(y.name).localeCompare(String(x.name)); });
    });
  }
  function driveBackup(data) {
    var name = BKP + '-' + ymd(Date.now()) + '.json', json = JSON.stringify(data);
    return driveBackups().then(function (list) {
      var same = list.filter(function (f) { return f.name === name; })[0];
      var put;
      if (same) put = drive('PATCH', 'https://www.googleapis.com/upload/drive/v3/files/' + same.id + '?uploadType=media', json, 'application/json');
      else {
        var b = 'ttbk' + Date.now();
        var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: name, parents: ['appDataFolder'] }) +
          '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + json + '\r\n--' + b + '--';
        put = drive('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', body, 'multipart/related; boundary=' + b);
        list = [{ name: name }].concat(list);
      }
      return put.then(function () {
        // giữ 4 bản gần nhất
        return Promise.all(list.slice(4).filter(function (f) { return f.id; }).map(function (f) {
          return drive('DELETE', 'https://www.googleapis.com/drive/v3/files/' + f.id).catch(function () { /* bỏ qua */ });
        }));
      });
    });
  }
  function gistBackup(data) {
    return gistFind().then(function (id) {
      var files = {}; files[BKP + '.json'] = { content: JSON.stringify(data) };
      if (!id) { files[FILE] = { content: JSON.stringify(snapshot()) }; return gh('POST', '/gists', { description: GIST_DESC, public: false, files: files }).then(function (r) { if (r && r.id) w.Store.applyRaw('ghGist', r.id); }); }
      return gh('PATCH', '/gists/' + id, { files: files });
    });
  }
  function backupStatus() {
    var at = w.Store.raw('backupAt', 0), st = status();
    return {
      on: C.AUTO_BACKUP !== false, can: st.loggedIn, at: at, where: w.Store.raw('backupWhere', ''),
      error: w.Store.raw('backupErr', ''), next: at ? at + WEEK : 0
    };
  }
  function backupWhy(e) {
    if (e && e.needTap) return 'Cần chạm “Đồng bộ ngay” để đăng nhập Google lại';
    if (e && e.net) return 'Mất mạng, sẽ thử lại';
    if (e && e.status === 401) return ghToken() ? 'Token GitHub sai hoặc hết hạn' : 'Hết hạn đăng nhập Google, hãy đăng nhập lại';
    if (e && e.status === 403) return ghToken() ? 'GitHub từ chối: token cần quyền gist' : driveWhy(e);
    return 'Lỗi sao lưu' + (e && e.status ? ' (mã ' + e.status + ')' : '');
  }
  function backupNow(why) {
    if (bkBusy) return bkBusy;
    if (!status().loggedIn) return Promise.reject({ nologin: true });
    var data = backupData(), where = [];
    var jobs = [];
    if (DRIVE.on()) jobs.push(function () { return driveBackup(data).then(function () { where.push('Google Drive'); }); });
    if (GIST.on()) jobs.push(function () { return gistBackup(data).then(function () { where.push('GitHub Gist'); }); });
    bkBusy = jobs.reduce(function (p, j) { return p.then(j); }, Promise.resolve()).then(function () {
      var now = Date.now();
      w.Store.applyRaw('backupAt', now);
      w.Store.applyRaw('backupWhere', where.join(' + '));
      w.Store.applyRaw('backupErr', '');
      bkBusy = null;
      if (w.Log) w.Log.info('Đã sao lưu ' + (why === 'auto' ? 'tự động ' : '') + 'vào ' + where.join(' + '));
      notify();
      return { at: now, where: where.join(' + ') };
    }, function (e) {
      bkBusy = null;
      var msg = backupWhy(e);
      w.Store.applyRaw('backupErr', msg);
      if (w.Log) w.Log.err('Sao lưu thất bại: ' + msg);
      notify();
      throw e;
    });
    return bkBusy;
  }
  // Lấy bản sao lưu mới nhất về và GỘP với dữ liệu trên máy này (không xóa gì)
  function restoreLatest() {
    if (!status().loggedIn) return Promise.reject({ nologin: true });
    var p = DRIVE.on()
      ? driveBackups().then(function (l) { return l[0] ? drive('GET', 'https://www.googleapis.com/drive/v3/files/' + l[0].id + '?alt=media') : null; })
      : gistFind().then(function (id) {
        if (!id) return null;
        return gh('GET', '/gists/' + id).then(function (g) {
          var f = g && g.files && g.files[BKP + '.json'];
          if (!f) return null;
          var t = f.truncated && f.raw_url ? http('GET', f.raw_url, {}) : Promise.resolve(f.content);
          return t.then(function (x) { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch (e) { return null; } });
        });
      });
    return p.then(function (data) {
      if (!data || !data.v) { var e = new Error('none'); e.none = true; throw e; }
      var r = mergeIn(data);
      r.at = data.at || 0;
      if (w.Log) w.Log.info('Đã khôi phục bản sao lưu ngày ' + ymd(r.at || Date.now()));
      return r;
    });
  }
  function autoBackup() {
    var b = backupStatus();
    if (!b.on || !b.can || d.hidden || bkBusy) return;
    if (Date.now() - b.at < WEEK) return;
    if (b.error && Date.now() - (w.Store.raw('backupTry', 0)) < 3600e3) return;   // lỗi: 1 giờ sau mới thử lại
    w.Store.applyRaw('backupTry', Date.now());
    backupNow('auto').then(function (r) {
      if (w.UI) w.UI.toast('Đã sao lưu lúc ' + w.UI.hhmm(r.at) + ' vào ' + r.where);
    }, function () { /* đã ghi nhật ký */ });
  }

  function init() {
    if (status().loggedIn) setTimeout(function () { sync('start'); }, 4000);
    setTimeout(autoBackup, 60e3);
    setInterval(function () { if (!d.hidden) { sync('timer'); setTimeout(autoBackup, 20e3); } }, 10 * 60e3);
  }

  /* ---------- Mã sao lưu (không cần tài khoản) ----------
     Xuất toàn bộ lịch sử, tiến độ, danh sách, cài đặt thành một đoạn mã để chép sang máy khác. Không chứa API key. */
  var BK = 'TTBK1:';
  function b64(s) { return btoa(unescape(encodeURIComponent(s))); }
  function unb64(s) { return decodeURIComponent(escape(atob(s))); }
  function exportCode() {
    var m = snapshot();
    delete m.ch;
    var ids = Object.keys(m.prog || {}).sort(function (x, y) { return (m.prog[y].t || 0) - (m.prog[x].t || 0); });
    ids.slice(200).forEach(function (k) { delete m.prog[k]; });
    return BK + b64(JSON.stringify(m));
  }
  function mergeIn(m) {
    var mine = snapshot(), merged = merge(mine, m);
    // danh sách yêu thích và phim đã bỏ: gộp cả hai bên (nhập mã thì không nên mất gì)
    var seen = {}, favs = [];
    (merged.favs || []).concat(mine.favs || [], m.favs || []).forEach(function (f) {
      var id = f && (f.id || f.key); if (id && !seen[id]) { seen[id] = 1; favs.push(f); }
    });
    merged.favs = favs;
    var bl = {};
    [m.blocked || {}, mine.blocked || {}, merged.blocked || {}].forEach(function (o) { Object.keys(o).forEach(function (k) { bl[k] = o[k]; }); });
    merged.blocked = bl;
    merged.stamps = merged.stamps || {};
    merged.stamps.favs = Date.now(); merged.stamps.blocked = Date.now();
    apply(merged);
    try { dirty(); } catch (e) { /* chưa đăng nhập thì bỏ qua */ }
    return { films: Object.keys(merged.prog || {}).length, favs: (merged.favs || []).length };
  }
  function importCode(str) {
    str = String(str || '').replace(/\s+/g, '');
    var m = null;
    if (str.indexOf(BK) === 0) { try { m = JSON.parse(unb64(str.slice(BK.length))); } catch (e) { m = null; } }
    if (!m || !m.v) { var er = new Error('bad'); er.bad = true; throw er; }
    return mergeIn(m);
  }

  /* ---------- Bản gọn cho mã QR: chỉ mã phim + tiến độ (khoảng 1.500 ký tự) ---------- */
  var QK = 'TTQR1:';
  function slimFilm(it) {
    var o = {};
    ['id', 'kind', 'title', 'thumb', 'hero', 'tag', 'ch', 'dur', 'eps', 'views', 'pub', 'src', 'cc', 'anime', 'chId'].forEach(function (k) { if (it[k] != null) o[k] = it[k]; });
    o.desc = (it.desc || '').slice(0, 200);
    return o;
  }
  function liteBuild(nf, nr) {
    var m = snapshot(), prog = m.prog || {};
    var f = (m.favs || []).filter(function (x) { return x && x.kind === 'film' && x.id; }).slice(0, nf).map(function (x) { return x.id; });
    var r = [];
    (m.recent || []).forEach(function (x) {
      if (r.length >= nr || !x || !x.vid || String(x.key).indexOf('v:') !== 0) return;
      var pg = prog[x.vid] || {};
      r.push([x.vid, Math.floor((x.t || 0) / 1000), pg.p || 0, pg.d || 0]);
    });
    return QK + b64(JSON.stringify({ v: 1, f: f, r: r }));
  }
  /** Mã gọn để làm QR: giảm dần số phim cho tới khi đủ ngắn để camera quét dễ. */
  function exportLite(maxLen) {
    maxLen = maxLen || 1500;
    var nf = 40, nr = 30, c = liteBuild(nf, nr);
    while (c.length > maxLen && (nf > 0 || nr > 0)) {
      if (nr >= nf && nr > 0) nr -= 2; else nf -= 2;
      if (nr < 0) nr = 0; if (nf < 0) nf = 0;
      c = liteBuild(nf, nr);
    }
    var lm = JSON.parse(unb64(c.slice(QK.length)));
    return { code: c, favs: lm.f.length, recent: lm.r.length };
  }
  /** Nhập mã gọn: cần API key để lấy lại tên và ảnh phim từ YouTube. Trả về Promise. */
  function importLite(str) {
    return new Promise(function (resolve, reject) {
      var m = null;
      try { m = JSON.parse(unb64(String(str).replace(/\s+/g, '').slice(QK.length))); } catch (e) { m = null; }
      if (!m || !m.v) { var er = new Error('bad'); er.bad = true; return reject(er); }
      var ids = {}; (m.f || []).forEach(function (i) { ids[i] = 1; }); (m.r || []).forEach(function (x) { ids[x[0]] = 1; });
      var list = Object.keys(ids);
      if (!list.length) return resolve({ films: 0, favs: 0 });
      if (!w.Api || !w.Api.hasKey()) { var e2 = new Error('nokey'); e2.nokey = true; return reject(e2); }
      w.Api.details(list).then(function (films) {
        var by = {}; films.forEach(function (f) { by[f.id] = f; });
        var now = Date.now(), prog = {}, recent = [], favs = [];
        (m.f || []).forEach(function (i) { if (by[i]) favs.push(slimFilm(by[i])); });
        (m.r || []).forEach(function (x) {
          var f = by[x[0]]; if (!f) return;
          var t = (x[1] || 0) * 1000 || now;
          recent.push({ key: 'v:' + f.id, item: slimFilm(f), vid: f.id, ep: 0, t: t });
          if (x[2]) prog[f.id] = { p: x[2], d: x[3] || f.dur || 0, t: t };
        });
        var st = { prog: now, recent: now, favs: now };
        resolve(mergeIn({ v: 1, at: now, stamps: st, prog: prog, recent: recent, favs: favs, blocked: {}, prefs: {} }));
      }, reject);
    });
  }
  /** Nhận cả mã đầy đủ (TTBK1) và mã gọn (TTQR1), luôn trả về Promise. */
  function importAny(str) {
    var t = String(str || '').replace(/\s+/g, '');
    var mm = /TT(?:QR|BK)1:[A-Za-z0-9+\/=_-]+/.exec(t);   // cho phép dán cả đường link có chứa mã
    if (mm) t = mm[0];
    if (t.indexOf(QK) === 0) return importLite(t);
    try { return Promise.resolve(importCode(t)); } catch (e) { return Promise.reject(e); }
  }

  w.Sync = {
    exportCode: exportCode, importCode: importCode, exportLite: exportLite, importAny: importAny,
    status: status, sync: sync, dirty: dirty, logout: logout, init: init,
    backupNow: backupNow, backupStatus: backupStatus, restoreLatest: restoreLatest,
    startDevice: startDevice, webLogin: webLoginTap, connectGithub: connectGithub, disconnectGithub: disconnectGithub, onChange: function (f) { listeners.push(f); },
    _merge: merge
  };
})(window);
