/* Cài đặt người dùng: lưu trên TV, ghi đè giá trị trong config.js. */
(function (w) {
  'use strict';
  var C = w.APP_CONFIG;
  var KEY = 'settings';

  // Giá trị gốc từ config.js (để "Khôi phục mặc định")
  var BASE = {
    API_KEY: C.API_KEY, PLAYER_HOST: C.PLAYER_HOST,
    AUTO_REFRESH: true, REFRESH_HOURS: C.REFRESH_HOURS,
    IDLE_STOP_HOURS: C.IDLE_STOP_HOURS, CHANNEL_VIDEOS: C.CHANNEL_VIDEOS,
    SHOW_CONT: true, SHOW_FRESH: true, SHOW_HOT: true, SHOW_REC: true, SHOW_ANIME: true,
    CAT_SEARCH_MORE: true, MIN_FILM_MINUTES: C.MIN_FILM_MINUTES, MIN_ANIME_MINUTES: C.MIN_ANIME_MINUTES,
    HIDE_VERTICAL: C.HIDE_VERTICAL, OK2_HOME: C.OK2_HOME !== false
  };

  // Danh sách kênh gốc trong config.js
  var BASE_DRAMA = (C.CHANNELS || []).slice(), BASE_ANIME = (C.ANIME_CHANNELS || []).slice();

  function saved() { return w.Store.pref(KEY, {}) || {}; }
  // so tên kênh không phân biệt dấu, hoa/thường, khoảng trắng
  function nk(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* TV cũ */ }
    return s.replace(/đ/g, 'd').replace(/[^a-z0-9@]/g, '');
  }

  // Tất cả kênh (gốc + tự thêm) kèm loại: 'drama' (Tổng tài), 'anime' (Hoạt hình AI), 'off' (tắt)
  function allChannels() {
    var s = saved(), ov = s.CH_TYPE || {}, out = [], seen = {};
    function add(c, def, extra) {
      var k = nk(c.name);
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ name: c.name, id: c.id, type: ov[c.name] || def, extra: !!extra });
    }
    BASE_DRAMA.forEach(function (c) { add(c, 'drama'); });
    BASE_ANIME.forEach(function (c) { add(c, 'anime'); });
    (s.CH_EXTRA || []).forEach(function (c) { add(c, c.type || 'drama', true); });
    return out;
  }
  function strip(c) { var o = { name: c.name }; if (c.id) o.id = c.id; return o; }

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
    s.CH_EXTRA = (s.CH_EXTRA || []).concat([{ name: name, type: type }]);
    w.Store.setPref(KEY, s);
    apply();
    return 'added';
  }

  function removeChannel(name) {
    var s = saved();
    s.CH_EXTRA = (s.CH_EXTRA || []).filter(function (c) { return c.name !== name; });
    if (s.CH_TYPE) delete s.CH_TYPE[name];
    w.Store.setPref(KEY, s);
    apply();
  }

  function get(k) {
    var s = saved();
    return s[k] !== undefined ? s[k] : BASE[k];
  }

  function apply() {
    var k, s = saved();
    for (k in BASE) C[k] = s[k] !== undefined ? s[k] : BASE[k];
    var chs = allChannels();
    C.CHANNELS = chs.filter(function (c) { return c.type === 'drama'; }).map(strip);
    C.ANIME_CHANNELS = chs.filter(function (c) { return c.type === 'anime'; }).map(strip);
    // một số giá trị đi kèm
    C.CHANNEL_HOURS = C.REFRESH_HOURS;
    C.CACHE_HOURS = C.REFRESH_HOURS;
    if (!C.AUTO_REFRESH) { C.CHANNEL_HOURS = 24; C.CACHE_HOURS = 24; }
  }

  function set(k, v) {
    var s = saved();
    if (v === BASE[k]) delete s[k]; else s[k] = v;
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
    w.Store.setPref(KEY, keep);
    apply();
  }

  // Ước tính hạn mức YouTube API (đơn vị): mỗi giờ và khi mở app 8 tiếng/ngày
  function estimate() {
    var ch = (C.CHANNELS || []).length + (C.ANIME_CHANNELS || []).length;
    var perRefresh = ch + 4;                       // 1 đơn vị/kênh + vài lần lấy chi tiết video mới
    var perHour = C.AUTO_REFRESH ? perRefresh / (C.REFRESH_HOURS || 1) : 0;
    var day = perHour * 8 + perRefresh * 8 / (C.FULL_REFRESH_HOURS || 6) / (C.REFRESH_HOURS || 1) + (C.CAT_SEARCH_MORE ? 200 : 0);
    return { hour: Math.round(perHour), day: Math.round(C.AUTO_REFRESH ? day : perRefresh * 3 + (C.CAT_SEARCH_MORE ? 200 : 0)) };
  }

  apply();
  w.Settings = {
    get: get, set: set, reset: reset, apply: apply, estimate: estimate, base: BASE,
    channels: allChannels, addChannel: addChannel, setChannelType: setChannelType, removeChannel: removeChannel
  };
})(window);
