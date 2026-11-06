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
    return {
      v: 1, at: Date.now(), stamps: R('stamps', {}),
      prog: R('prog', {}), recent: R('recent', []), favs: R('favs', []), blocked: R('blocked', {}), prefs: stripPrefs(R('prefs', {})), ch: ch
    };
  }
  function merge(a, b) {
    if (!b || !b.v) return a;
    var sa = a.stamps || {}, sb = b.stamps || {}, out = { v: 1, at: Date.now(), stamps: {} };
    var clr = Math.max(sa.histClr || 0, sb.histClr || 0);
    if (clr) out.stamps.histClr = clr;
    // tiến độ xem: lấy bản mới hơn của từng phim
    var prog = {};
    [b.prog || {}, a.prog || {}].forEach(function (m) {
      Object.keys(m).forEach(function (id) {
        var x = m[id];
        if (!x || (x.t || 0) < clr) return;
        if (!prog[id] || (x.t || 0) > (prog[id].t || 0)) prog[id] = x;
      });
    });
    var keys = Object.keys(prog).sort(function (x, y) { return prog[y].t - prog[x].t; });
    keys.slice(300).forEach(function (k) { delete prog[k]; });
    out.prog = prog;
    // vừa xem: gộp, mới nhất trước
    var rec = {}, list = [];
    (b.recent || []).concat(a.recent || []).forEach(function (r) {
      if (!r || !r.key || (r.t || 0) < clr) return;
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
    ['prog', 'recent'].forEach(function (k) { out.stamps[k] = Math.max(sa[k] || 0, sb[k] || 0); });
    // mã kênh đã tìm: gộp (máy này đã tìm thì máy kia khỏi tốn hạn mức)
    out.ch = {};
    [b.ch || {}, a.ch || {}].forEach(function (m) { Object.keys(m).forEach(function (k) { out.ch[k] = m[k]; }); });
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
    A('stamps', m.stamps);
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
        e && e.status === 403 ? 'Chưa bật Google Drive API' :
        e && e.data && e.data.error === 'invalid_grant' ? 'Hết hạn đăng nhập, hãy đăng nhập lại' : 'Lỗi đồng bộ';
      w.Store.applyRaw('syncErr', msg);
      notify();
      return false;
    });
    return busy;
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

  function init() {
    if (status().loggedIn) setTimeout(function () { sync('start'); }, 4000);
    setInterval(function () { if (!d.hidden) sync('timer'); }, 10 * 60e3);
  }

  w.Sync = {
    status: status, sync: sync, dirty: dirty, logout: logout, init: init,
    startDevice: startDevice, webLogin: webLoginTap, connectGithub: connectGithub, disconnectGithub: disconnectGithub, onChange: function (f) { listeners.push(f); },
    _merge: merge
  };
})(window);
