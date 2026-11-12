/* Cài đặt người dùng: lưu trên TV, ghi đè giá trị trong config.js. */
(function (w) {
  'use strict';
  var C = w.APP_CONFIG;
  var KEY = 'settings';

  // Mã PIN không lưu dạng chữ thường, chỉ lưu dấu băm (nhìn vào mã sao lưu cũng không thấy PIN)
  function pinHash(v) {
    var s = 'tongtai-pin:' + String(v == null ? '' : v).trim(), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(36);
  }

  // Giá trị gốc từ config.js (để "Khôi phục mặc định")
  var BASE = {
    PIN_H: pinHash(C.PIN || '1234'),
    API_KEY: C.API_KEY, PLAYER_HOST: C.PLAYER_HOST,
    AUTO_REFRESH: true, REFRESH_HOURS: C.REFRESH_HOURS,
    IDLE_STOP_HOURS: C.IDLE_STOP_HOURS, CHANNEL_VIDEOS: C.CHANNEL_VIDEOS,
    SHOW_CONT: true, SHOW_FAVCH: false,
    HOME_ORDER: ['cont', 'favch', 'fresh', 'hot', 'rec', 'top', 'movie', 'anime'], SHOW_FRESH: true, SHOW_HOT: true, SHOW_MOVIE: true, SHOW_REC: true, SHOW_TOP10: true, SHOW_ANIME: true,
    CAT_SEARCH_MORE: true, MIN_FILM_MINUTES: C.MIN_FILM_MINUTES, MIN_ANIME_MINUTES: C.MIN_ANIME_MINUTES,
    HIDE_VERTICAL: C.HIDE_VERTICAL, OK2_HOME: C.OK2_HOME !== false,
    THEME: C.THEME || 'dark',
    CLOCK_12: C.CLOCK_12 !== false, BOOT_SECS: C.BOOT_SECS == null ? 3 : C.BOOT_SECS, SCREENSAVER: C.SCREENSAVER == null ? 10 : C.SCREENSAVER, SAVER_QUOTE: C.SAVER_QUOTE !== false, SLEEP_AT: C.SLEEP_AT || '', SLEEP_WHO: C.SLEEP_WHO || 'all', PRELOAD: C.PRELOAD !== false, SHOW_NEWEPS: C.SHOW_NEWEPS !== false, SHOW_QUIZ: C.SHOW_QUIZ !== false,
    MUSIC: C.MUSIC || 'songs', MUSIC_URL: C.MUSIC_URL || '', STATS_URL: C.STATS_URL || '', MUSIC_VIEW: C.MUSIC_VIEW || 'split', MUSIC_VOL: C.MUSIC_VOL || 'low', MUSIC_LEVEL: C.MUSIC_LEVEL !== false, QUOTA_SAVER: C.QUOTA_SAVER !== false,
    SEASON: C.SEASON || 'auto', SEASON_FX: C.SEASON_FX !== false,
    AUTO_NEXT: C.AUTO_NEXT !== false, HIDE_WATCHED: C.HIDE_WATCHED !== false, ASK_PROFILE: C.ASK_PROFILE !== false, AUTO_BACKUP: C.AUTO_BACKUP !== false,
    AGE_FILTER: !!C.AGE_FILTER, AGE_WORDS: (C.AGE_WORDS || []).slice()
  };

  // Danh sách kênh gốc trong config.js
  var BASE_DRAMA = (C.CHANNELS || []).slice(), BASE_ANIME = (C.ANIME_CHANNELS || []).slice(), BASE_MOVIE = (C.MOVIE_CHANNELS || []).slice();

  function saved() { return w.Store.pref(KEY, {}) || {}; }
  // so tên kênh không phân biệt dấu, hoa/thường, khoảng trắng
  function nk(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* TV cũ */ }
    return s.replace(/đ/g, 'd').replace(/[^a-z0-9@]/g, '');
  }

  // Tất cả kênh (gốc + tự thêm) kèm loại: 'drama' (Phim ngắn), 'movie' (Phim lẻ hay), 'anime' (Hoạt hình), 'off' (tắt)
  function allChannels() {
    var s = saved(), ov = s.CH_TYPE || {}, out = [], seen = {};
    var del = {}; (s.CH_DEL || []).forEach(function (n) { del[nk(n)] = 1; });
    function add(c, def, extra) {
      var k = nk(c.name);
      if (seen[k] || del[k]) return;
      seen[k] = 1;
      out.push({ name: c.name, id: c.id, tag: c.tag, type: ov[c.name] || def, extra: !!extra });
    }
    var sh = null; try { sh = w.Store.keep('shared'); } catch (e) { /* bỏ qua */ }
    if (sh && sh.list && sh.list.length) {   // danh sách kênh trong channels.json (trang quản trị) thay cho config.js
      sh.list.forEach(function (c) { if (c && c.name && c.on !== false) add(c, c.type || 'drama'); });
    } else {
      BASE_DRAMA.forEach(function (c) { add(c, 'drama'); });
      BASE_ANIME.forEach(function (c) { add(c, 'anime'); });
      BASE_MOVIE.forEach(function (c) { add(c, 'movie'); });
    }
    (s.CH_EXTRA || []).forEach(function (c) { add(c, c.type || 'drama', true); });
    return out;
  }
  function strip(c) { var o = { name: c.name }; if (c.id) o.id = c.id; if (c.tag) o.tag = c.tag; return o; }

  function setChannelType(name, type) {
    var s = saved();
    s.CH_TYPE = s.CH_TYPE || {};
    s.CH_TYPE[name] = type;
    w.Store.setPref(KEY, s);
    apply();
  }

  function addChannel(name, type) {
    name = String(name || '').trim();
    if (!name) return false;
    var found = allChannels().filter(function (c) { return nk(c.name) === nk(name); })[0];
    if (found) { setChannelType(found.name, type); return 'exists:' + found.name; }
    var s = saved();
    s.CH_DEL = (s.CH_DEL || []).filter(function (n) { return nk(n) !== nk(name); });
    s.CH_EXTRA = (s.CH_EXTRA || []).concat([{ name: name, type: type }]);
    w.Store.setPref(KEY, s);
    apply();
    return 'added';
  }

  function removeChannel(name) {
    var s = saved();
    var dl = (s.CH_DEL || []).filter(function (n) { return nk(n) !== nk(name); });
    dl.push(name); s.CH_DEL = dl;
    s.CH_EXTRA = (s.CH_EXTRA || []).filter(function (c) { return c.name !== name; });
    if (s.CH_TYPE) delete s.CH_TYPE[name];
    w.Store.setPref(KEY, s);
    apply();
  }

  /* Cài đặt RIÊNG từng hồ sơ: giao diện, đồng hồ, chủ đề, xem phim, các hàng Trang chủ, lọc lứa tuổi.
     Các mục còn lại (API key, kênh, cập nhật, sao lưu, mã PIN người lớn…) dùng chung cho cả máy. */
  var PP = { HOME_ORDER: 1, MUSIC_VIEW: 1, MUSIC: 1, MUSIC_VOL: 1, MUSIC_LEVEL: 1, THEME: 1, CLOCK_12: 1, SEASON: 1, SEASON_FX: 1, AUTO_NEXT: 1, HIDE_WATCHED: 1, AGE_FILTER: 1,
    SHOW_CONT: 1, SHOW_NEWEPS: 1, SHOW_QUIZ: 1, SHOW_FAVCH: 1, SHOW_FRESH: 1, SHOW_HOT: 1, SHOW_MOVIE: 1, SHOW_REC: 1, SHOW_TOP10: 1, SHOW_ANIME: 1 };
  function psaved() { return (w.Store.pref('psettings', {}) || {})[w.Store.profile()] || {}; }
  function get(k) {
    if (PP[k]) { var ps = psaved(); if (ps[k] !== undefined) return ps[k]; }
    var s = saved();
    return s[k] !== undefined ? s[k] : BASE[k];
  }

  function apply() {
    var k, s = saved();
    // Danh sách kênh gốc đã thay mới: bỏ kênh tự thêm / đổi loại của danh sách cũ (1 lần)
    if ((s.chSet || 0) !== (C.CHANNEL_SET || 0)) {
      delete s.CH_EXTRA; delete s.CH_TYPE; s.chSet = C.CHANNEL_SET || 0;
      w.Store.setPref(KEY, s);
    }
    // Quên mã PIN: PIN_FORCE trong config.js đặt lại mã (chỉ áp dụng một lần cho mỗi giá trị)
    if (C.PIN_FORCE && s.pinForced !== pinHash(C.PIN_FORCE)) {
      s.PIN_H = pinHash(C.PIN_FORCE); s.pinForced = s.PIN_H;
      w.Store.setPref(KEY, s);
    }
    for (k in BASE) C[k] = get(k);
    var chs = allChannels();
    C.CHANNELS = chs.filter(function (c) { return c.type === 'drama'; }).map(strip);
    C.ANIME_CHANNELS = chs.filter(function (c) { return c.type === 'anime'; }).map(strip);
    C.MOVIE_CHANNELS = chs.filter(function (c) { return c.type === 'movie'; }).map(strip);
    // một số giá trị đi kèm
    C.CHANNEL_HOURS = C.REFRESH_HOURS;
    C.CACHE_HOURS = C.REFRESH_HOURS;
    if (!C.AUTO_REFRESH) { C.CHANNEL_HOURS = 24; C.CACHE_HOURS = 24; }
    applyTheme();
    if (w.Season) w.Season.apply();
    if (w.appClock) try { w.appClock(); } catch (e) { /* chưa khởi động */ }
  }

  // Giao diện Tối / Sáng / Tự động (theo máy). Ghi nhớ nhanh để lần mở sau không bị chớp màu.
  var mq = null;
  function applyTheme() {
    var t = C.THEME || 'dark', light = t === 'light';
    if (t === 'auto') {
      try {
        mq = mq || w.matchMedia('(prefers-color-scheme: light)');
        light = !!mq.matches;
        if (!applyTheme.bound && mq.addListener) { applyTheme.bound = true; mq.addListener(function () { if (C.THEME === 'auto') applyTheme(); }); }
      } catch (e) { light = false; }
    }
    var h = document.documentElement;
    if (light) h.classList.add('light'); else h.classList.remove('light');
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', light ? '#F5F3EE' : '#0B0D12');
    try { w.localStorage.setItem('tt.themeFast', light ? 'light' : 'dark'); } catch (e) { /* bỏ qua */ }
  }

  function set(k, v) {
    if (PP[k]) {   // lưu vào hồ sơ đang xem
      var all = w.Store.pref('psettings', {}) || {}, me = w.Store.profile();
      all[me] = all[me] || {}; all[me][k] = v;
      w.Store.setPref('psettings', all);
      apply();
      return;
    }
    var s = saved();
    if (v === BASE[k] || (Array.isArray(v) && JSON.stringify(v) === JSON.stringify(BASE[k]))) delete s[k]; else s[k] = v;
    w.Store.setPref(KEY, s);
    apply();
  }

  // Khôi phục mặc định: giữ lại kênh bạn đã thêm/chuyển loại
  function reset() {
    var s = saved(), keep = {};
    if (s.CH_EXTRA) keep.CH_EXTRA = s.CH_EXTRA;
    if (s.CH_TYPE) keep.CH_TYPE = s.CH_TYPE;
    if (s.API_KEY) keep.API_KEY = s.API_KEY;
    if (s.PLAYER_HOST) keep.PLAYER_HOST = s.PLAYER_HOST;
    if (s.MUSIC_URL) keep.MUSIC_URL = s.MUSIC_URL;
    if (s.AGE_WORDS) keep.AGE_WORDS = s.AGE_WORDS;
    if (s.PIN_H) keep.PIN_H = s.PIN_H;
    var all = w.Store.pref('psettings', {}) || {};   // xóa cài đặt riêng của hồ sơ đang xem
    delete all[w.Store.profile()]; w.Store.setPref('psettings', all);   // giữ mã PIN đã đổi   // danh sách từ khóa bạn tự quản lý: giữ lại
    w.Store.setPref(KEY, keep);
    apply();
  }

  /* ---------- Lọc phim theo lứa tuổi ----------
     Ẩn phim có từ khóa nhạy cảm trong tên hoặc mô tả. So khớp không phân biệt dấu, hoa/thường, theo nguyên từ
     ("ma" không khớp "mạnh"). Danh sách do bạn tự quản lý trong Cài đặt. */
  function fold(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* TV cũ */ }
    return ' ' + s.replace(/đ/g, 'd').replace(/[^a-z0-9+]+/g, ' ').trim() + ' ';
  }
  var wordsCache = null, wordsKey = '';
  function ageWords() {
    var list = get('AGE_WORDS') || [], key = list.join('|');
    if (key !== wordsKey) {
      wordsKey = key;
      wordsCache = list.map(function (x) { return fold(x); }).filter(function (x) { return x.trim(); });
    }
    return wordsCache;
  }
  function hitWord(text) {
    var t = fold(text), ws = ageWords();
    for (var i = 0; i < ws.length; i++) if (t.indexOf(ws[i]) >= 0) return ws[i].trim();
    return '';
  }
  function hides(it) {
    if (!it || C.AGE_FILTER !== true) return false;
    return !!hitWord((it.title || '') + ' ' + (it.desc || ''));
  }
  function addWord(wd) {
    wd = String(wd || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!wd) return false;
    var list = (get('AGE_WORDS') || []).slice();
    if (list.some(function (x) { return fold(x) === fold(wd); })) return 'exists';
    list.push(wd);
    set('AGE_WORDS', list);
    return true;
  }
  function removeWord(wd) {
    set('AGE_WORDS', (get('AGE_WORDS') || []).filter(function (x) { return x !== wd; }));
  }

  // Ước tính hạn mức YouTube API (đơn vị): mỗi giờ và khi mở app 8 tiếng/ngày
  function estimate() {
    var ch = (C.CHANNELS || []).length + (C.ANIME_CHANNELS || []).length + (C.MOVIE_CHANNELS || []).length;
    var perRefresh = ch + 4;                       // 1 đơn vị/kênh + vài lần lấy chi tiết video mới
    var perHour = C.AUTO_REFRESH ? perRefresh / (C.REFRESH_HOURS || 1) : 0;
    var day = perHour * 8 + perRefresh * 8 / (C.FULL_REFRESH_HOURS || 6) / (C.REFRESH_HOURS || 1) + (C.CAT_SEARCH_MORE ? 200 : 0);
    return { hour: Math.round(perHour), day: Math.round(C.AUTO_REFRESH ? day : perRefresh * 3 + (C.CAT_SEARCH_MORE ? 200 : 0)) };
  }

  apply();
  w.Settings = {
    get: get, set: set, reset: reset, apply: apply, estimate: estimate, base: BASE,
    checkPin: function (v) { return pinHash(v) === get('PIN_H'); },
    perProfile: function (k) { return !!PP[k]; },
    hashPin: pinHash,
    setPin: function (v) { set('PIN_H', pinHash(v)); },
    pinIsDefault: function () { return get('PIN_H') === pinHash('1234'); },
    hides: hides, hitWord: hitWord, addWord: addWord, removeWord: removeWord,
    channels: allChannels, addChannel: addChannel, setChannelType: setChannelType, removeChannel: removeChannel
  };
})(window);
