/* Lấy phim từ YouTube Data API v3. Không có API key thì chạy chế độ demo. */
(function (w) {
  'use strict';
  var C = w.APP_CONFIG;
  var Store = w.Store;
  var BASE = 'https://www.googleapis.com/youtube/v3/';

  // "AI" viết hoa đứng riêng (tránh nhầm với từ "ai" trong tiếng Việt)
  var AI_RE = /\bAI\b|trí tuệ nhân tạo|AI[- ]generated|#ai\b|\b(?:Sora|Veo ?\d?|Kling|Hailuo|Seedance|Midjourney|Runway)\b/;
  // Phim do AI tạo: YouTube yêu cầu người đăng khai báo "nội dung tổng hợp / bị thay đổi" (status.containsSyntheticMedia),
  // đây là cờ chính thức, đáng tin hơn đoán chữ. Không có cờ thì đoán theo tiêu đề, mô tả, thẻ.
  function isAiVideo(v) {
    var sn = v.snippet || {}, st = v.status || {};
    if (st.containsSyntheticMedia === true) return true;
    var tags = sn.tags || [];
    for (var i = 0; i < tags.length; i++) if (/^(ai|#ai|ai video|phim ai|video ai|ai generated)$/i.test(String(tags[i]).trim())) return true;
    var text = (sn.title || '') + ' ' + (sn.description || '').slice(0, 500) + ' ' + tags.join(' ');
    return AI_RE.test(text);
  }
  var D3_RE = /\b3D\b/i;
  var D2_RE = /\b2D\b/i;
  // Nhãn hoạt hình: 3D / 2D / AI theo tiêu đề, mô tả, thẻ; không rõ thì dùng nhãn mặc định của kênh
  function animeTag(v, def) {
    var sn = v.snippet || {}, t = (sn.tags || []).join(' ') + ' ' + (sn.description || '').slice(0, 300);
    if (D3_RE.test(sn.title || '')) return '3D';
    if (D2_RE.test(sn.title || '')) return '2D';
    if (AI_RE.test(sn.title || '')) return 'AI';
    if (D3_RE.test(t)) return '3D';
    if (D2_RE.test(t)) return '2D';
    if (isAiVideo(v)) return 'AI';
    return def || '';
  }

  var pool = [];

  function hasKey() { return !!C.API_KEY; }

  /* ---------- Nhãn danh mục cho từng phim ---------- */

  function catById(id) {
    for (var i = 0; i < C.CATEGORIES.length; i++) if (C.CATEGORIES[i].id === id) return C.CATEGORIES[i];
    return null;
  }
  function catOfQuery(q) {
    for (var i = 0; i < C.CATEGORIES.length; i++) if (C.CATEGORIES[i].q === q) return C.CATEGORIES[i].id;
    return '';
  }
  // Trả về danh sách tên danh mục của phim (tối đa 3), luôn có ít nhất 1 nhãn
  function catsOf(it) {
    if (!it) return [];
    if (it.kind === 'anime' || it.kind === 'ep') return ['Hoạt hình'];
    if (it.kind === 'channel') return [];
    if (it.anime) return ['Hoạt hình'];
    var text = (it.title || '') + ' ' + (it.desc || '');
    var ids = [];
    C.CATEGORIES.forEach(function (c) { if (c.kw && c.kw.test(text)) ids.push(c.id); });
    if (it.src && ids.indexOf(it.src) < 0) ids.push(it.src);      // phim lấy từ danh mục nào thì luôn có nhãn đó
    if (!ids.length) ids.push('tongtai');
    return ids.map(function (id) { var c = catById(id); return c ? c.name : ''; }).filter(Boolean).slice(0, 3);
  }

  function decode(s) {
    return String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  }

  /* ---------- Đếm hạn mức đã dùng trên TV này (theo ngày giờ California) ---------- */

  // Giờ California: UTC-8, mùa hè (Chủ nhật thứ 2 tháng 3 -> Chủ nhật đầu tháng 11) UTC-7
  function ptOffsetHours(t) {
    var d0 = new Date(t), y = d0.getUTCFullYear();
    function nthSunday(m, n) {
      var d = new Date(Date.UTC(y, m, 1)), first = (7 - d.getUTCDay()) % 7;
      return Date.UTC(y, m, 1 + first + 7 * (n - 1), 10);   // ~2 giờ sáng giờ California
    }
    return (t >= nthSunday(2, 2) && t < nthSunday(10, 1)) ? -7 : -8;
  }
  function ptDay(t) {
    var x = new Date(t + ptOffsetHours(t) * 3600e3);
    return x.getUTCFullYear() + '-' + (x.getUTCMonth() + 1) + '-' + x.getUTCDate();
  }
  // Thời điểm hạn mức làm mới tiếp theo (0 giờ giờ California)
  function quotaResetAt(t) {
    t = t || Date.now();
    var off = ptOffsetHours(t), x = new Date(t + off * 3600e3);
    return Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate() + 1) - off * 3600e3;
  }
  function quotaLog(path, err) {
    var day = ptDay(Date.now()), q = Store.keep('quota');
    if (!q || q.day !== day) q = { day: day, search: 0, other: 0, calls: 0, errAt: 0 };
    if (err && err.quota) { q.errAt = Date.now(); }
    else if (!err || !err.net) {
      if (path === 'search') q.search += 1; else q.other += 1;
      if (w.Tele) w.Tele.units(path);   // trang quản trị: đơn vị YouTube theo hồ sơ
      q.calls += 1;
    }
    Store.keep('quota', q);
  }
  function quotaToday() {
    var q = Store.keep('quota'), day = ptDay(Date.now());
    if (!q || q.day !== day) q = { day: day, search: 0, other: 0, calls: 0, errAt: 0 };
    q.units = q.search * 100 + q.other;
    q.resetAt = quotaResetAt();
    return q;
  }

  /* Tiết kiệm đơn vị tự động: gần hết 10.000 đơn vị/ngày thì làm mới chậm lại, không để bị khóa giữa chừng.
     Mức 0: bình thường · Mức 1 (từ 70%): làm mới thưa gấp 3 · Mức 2 (từ 90%): chỉ dùng phim đã lưu, tạm tắt tìm kiếm. */
  var SAVE_MULT = [1, 3, 12], saveShown = -1;
  function familyUnits() {   // tổng cả nhà do máy chủ quản trị báo về (nếu có)
    var f = Store.keep('famq'); return f && f.day === ptDay(Date.now()) ? f.u : 0;
  }
  function saveInfo() {
    var lim = C.QUOTA_LIMIT || 10000, mine = quotaToday().units, fam = familyUnits(), u = Math.max(mine, fam);
    var on = !w.Settings || w.Settings.get('QUOTA_SAVER') !== false;
    var lvl = !on ? 0 : u >= lim * 0.9 ? 2 : u >= lim * 0.7 ? 1 : 0;
    return { level: lvl, units: u, mine: mine, family: fam, limit: lim, on: on, resetAt: quotaResetAt() };
  }
  function cacheH(h) { return (h || C.CACHE_HOURS || 1) * SAVE_MULT[saveInfo().level]; }
  function saveNotify() {
    var si = saveInfo();
    if (si.level === saveShown) return si;
    if (saveShown >= 0 && si.level > saveShown && w.UI) {
      w.UI.toast(si.level === 2 ? 'Hôm nay đã dùng ' + Math.round(si.units / 100) + '% đơn vị YouTube: tạm tắt tìm kiếm, chỉ hiện phim đã lưu đến ' + hhmm(si.resetAt) + '.'
        : 'Hôm nay đã dùng ' + Math.round(si.units / 100) + '% đơn vị YouTube: app tự làm mới phim chậm lại để không hết hạn mức.');
    }
    saveShown = si.level; return si;
  }
  function famSet(u) { Store.keep('famq', { u: +u || 0, day: ptDay(Date.now()), at: Date.now() }); saveNotify(); }

  function call(path, params) {
    if (path === 'search' && saveNotify().level >= 2) {
      var se = new Error('saver'); se.saver = true; se.quota = false;
      if (w.UI) w.UI.toast('Đang tiết kiệm đơn vị YouTube: tìm kiếm tạm tắt đến ' + hhmm(quotaResetAt()) + '. Phim đã lưu vẫn xem bình thường.');
      return Promise.reject(se);
    }
    return callRaw(path, params).then(function (d) { quotaLog(path); return d; }, function (e) {
      quotaLog(path, e);
      if (w.Log) w.Log.err('YouTube API (' + path + '): ' + explain(e) + (e && e.reason ? ' [' + e.reason + ']' : ''));
      throw e;
    });
  }

  function callRaw(path, params) {
    return new Promise(function (resolve, reject) {
      var q = ['key=' + encodeURIComponent(C.API_KEY)];
      Object.keys(params).forEach(function (k) {
        var v = params[k];
        if (v !== undefined && v !== null && v !== '') q.push(k + '=' + encodeURIComponent(v));
      });
      var x = new XMLHttpRequest();
      x.open('GET', BASE + path + '?' + q.join('&'));
      x.timeout = 20000;
      x.onload = function () {
        var d = null;
        try { d = JSON.parse(x.responseText); } catch (e) { d = null; }
        if (x.status >= 200 && x.status < 300 && d) { resolve(d); return; }
        if (x.status === 0) { reject({ message: 'Không có kết nối mạng', net: true }); return; }
        var err = d && d.error ? d.error : {};
        var reason = err.errors && err.errors[0] ? err.errors[0].reason : '';
        var det = (err.details || []).map(function (x2) { return x2 && x2.reason; }).join(' ');
        var msg = String(err.message || '');
        reject({
          message: msg || ('Lỗi ' + x.status), status: x.status, reason: reason || det,
          quota: reason === 'quotaExceeded' || reason === 'dailyLimitExceeded' || reason === 'rateLimitExceeded',
          badKey: reason === 'keyInvalid' || /API_KEY_INVALID/.test(det) || /API key not valid|API key expired/i.test(msg),
          apiOff: reason === 'accessNotConfigured' || /SERVICE_DISABLED/.test(det) || /has not been used|is disabled/i.test(msg),
          keyLimited: reason === 'ipRefererBlocked' || /API_KEY_(HTTP_REFERRER|IP_ADDRESS|ANDROID_APP|IOS_APP|SERVICE)_BLOCKED/.test(det) || /referer|blocked/i.test(msg) && x.status === 403
        });
      };
      x.onerror = function () { reject({ message: 'Không có kết nối mạng', net: true }); };
      x.ontimeout = function () { reject({ message: 'Mạng quá chậm', net: true, slow: true }); };
      x.send();
    });
  }

  // Lỗi dễ hiểu bằng tiếng Việt: chuyện gì xảy ra + cách xử lý
  function hm(ms) {
    var m = Math.max(1, Math.round(ms / 60000));
    return (m >= 60 ? Math.floor(m / 60) + ' giờ ' : '') + (m % 60 ? (m % 60) + ' phút' : '');
  }
  function explain(e) {
    if (!e) return 'Có lỗi xảy ra. Thử lại sau ít phút; nếu vẫn lỗi, vào Cài đặt → Nhật ký lỗi → “Sao chép để gửi”.';
    if (e.disabled) return 'Phim này đã tắt bình luận.';
    if (e.nokey) return 'Chưa có YouTube API key. Vào Cài đặt → Kết nối → “YouTube API key” để nhập key.';
    if (w.navigator.onLine === false || (e.net && !e.slow)) return 'Mất mạng: ' + ((w.tizen || w.AndroidApp) ? 'TV' : 'máy') + ' không kết nối được Internet. Kiểm tra Wi-Fi hoặc dây mạng, tắt/bật lại modem rồi mở lại trang này.';
    if (e.slow) return 'Mạng quá chậm nên YouTube chưa trả lời kịp. Đợi một chút rồi thử lại, hoặc khởi động lại modem.';
    if (e.quota) {
      var at = quotaResetAt();
      return 'Hết hạn mức YouTube hôm nay (10.000 đơn vị/ngày). Hạn mức tự làm mới lúc ' + hhmm(at) + ' (còn ' + hm(at - Date.now()) +
        '). Trong lúc chờ: xem phim đã có vẫn được; muốn tiết kiệm thì Cài đặt → “Cập nhật mỗi” chọn thưa hơn.';
    }
    if (e.badKey) return 'API key sai hoặc đã bị xóa. Vào Cài đặt → Kết nối → “YouTube API key”, nhập lại đủ 39 ký tự (bắt đầu bằng AIza), chú ý chữ hoa/thường.';
    if (e.apiOff) return 'API key chưa bật “YouTube Data API v3”. Vào console.cloud.google.com → APIs & Services → Library → YouTube Data API v3 → Enable.';
    if (e.keyLimited) return 'API key đang bị giới hạn (chỉ cho trang web/ứng dụng khác dùng). Vào console.cloud.google.com → Credentials → chọn key → Application restrictions: chọn “None”.';
    if (e.status >= 500) return 'Máy chủ YouTube đang trục trặc (lỗi ' + e.status + '). Không phải lỗi của TV, thử lại sau vài phút.';
    return 'Không tải được: ' + e.message + '. Thử lại sau; nếu lặp lại, vào Cài đặt → Nhật ký lỗi → “Sao chép để gửi”.';
  }
  function hhmm(t) {
    if (w.UI && w.UI.hhmm) return w.UI.hhmm(t);
    var n = new Date(t), h = n.getHours(), m = n.getMinutes(); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function parseDur(iso) {
    var m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
    if (!m) return 0;
    return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
  }

  // Ảnh bìa: TV 4K dùng ảnh lớn hơn cho nét (ảnh 4:3 được cắt viền đen tự động)
  var CARD = (w.DEVICE && w.DEVICE.is4k) ? ['standard', 'high', 'medium', 'default'] : ['medium', 'high', 'default'];
  var HERO = ['maxres', 'standard', 'high', 'medium'];

  function pick(th, order) {
    th = th || {};
    for (var i = 0; i < order.length; i++) if (th[order[i]] && th[order[i]].url) return th[order[i]].url;
    return '';
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function addPool(list) {
    list.forEach(function (it) {
      if (it.kind !== 'film' || it.anime || it.movie) return;
      for (var i = 0; i < pool.length; i++) if (pool[i].id === it.id) return;
      pool.push(it);
    });
    if (pool.length > 120) pool = pool.slice(pool.length - 120);
  }

  /* ---------- Phim lẻ ---------- */

  function isVertical(v) {
    var p = v.player || {}, ew = +p.embedWidth || 0, eh = +p.embedHeight || 0;
    return ew > 0 && eh > ew * 0.9;
  }
  function notBlocked(list) { return list.filter(function (x) { return !Store.isBlocked(x.id); }); }

  // Hết hạn mức hoặc mất mạng: dùng lại danh sách cũ đã lưu thay vì báo lỗi
  var staleWarned = false;
  function stale(ck, e) {
    var old = Store.cacheGetAny(ck);
    if (!old) throw e;
    if (e && (e.quota || e.net) && !staleWarned && w.UI) { staleWarned = true; w.UI.toast(e.quota ? 'Hết hạn mức YouTube hôm nay, tự làm mới lúc ' + hhmm(quotaResetAt()) + '. Đang hiện danh sách phim đã lưu.' : 'Mất mạng: đang hiện danh sách phim đã lưu. Kiểm tra Wi-Fi của TV.'); }
    old = notBlocked(old);
    addPool(old);
    return old;
  }

  function okFilm(v) {
    var sn = v.snippet || {}, st = v.status || {}, cd = v.contentDetails || {};
    var dur = parseDur(cd.duration);
    return st.embeddable !== false && st.privacyStatus === 'public' &&
      sn.liveBroadcastContent === 'none' &&
      dur >= C.MIN_FILM_MINUTES * 60 && dur <= 4 * 3600 && !(C.HIDE_VERTICAL && isVertical(v)) &&
      !C.FILM_EXCLUDE.test(sn.title || '') && !Store.isBlocked(v.id);
  }

  function toFilm(v, src) {
    var sn = v.snippet, th = sn.thumbnails;
    var text = (sn.title || '') + ' ' + (sn.description || '').slice(0, 500) + ' ' + (sn.tags || []).join(' ');
    return {
      id: v.id, kind: 'film', title: sn.title, ch: sn.channelTitle || '',
      thumb: pick(th, CARD),
      hero: pick(th, HERO),
      dur: parseDur(v.contentDetails.duration),
      views: +((v.statistics || {}).viewCount || 0),
      pub: sn.publishedAt, desc: (sn.description || '').slice(0, 280),
      tag: isAiVideo(v) ? 'AI' : '', src: src || '', cc: (v.contentDetails || {}).caption === 'true'
    };
  }

  function videoDetails(ids) {
    var parts = chunk(ids, 50).map(function (g) {
      // part=player + maxWidth: YouTube trả về kích thước khung thật -> biết phim quay dọc hay ngang
      return call('videos', { part: 'snippet,contentDetails,statistics,status,player', id: g.join(','), maxResults: 50, maxWidth: 1920 });
    });
    return Promise.all(parts).then(function (res) {
      var all = [];
      res.forEach(function (r) { all = all.concat(r.items || []); });
      var map = {};
      all.forEach(function (v) { map[v.id] = v; });
      return ids.map(function (id) { return map[id]; }).filter(Boolean);
    });
  }

  function films(q, order) {
    if (!hasKey()) return Promise.resolve(demoFilms(order));
    var ck = 'f6:' + q + ':' + (order || 'relevance');
    var hit = Store.cacheGet(ck, cacheH());
    if (hit) { hit = notBlocked(hit); addPool(hit); return Promise.resolve(hit); }
    return call('search', {
      part: 'snippet', type: 'video', q: q, order: order || 'relevance', maxResults: 50,
      regionCode: C.REGION, relevanceLanguage: C.LANG, videoEmbeddable: 'true',
      videoSyndicated: 'true', videoDuration: 'long', safeSearch: 'moderate'
    }).then(function (d) {
      var ids = (d.items || []).map(function (i) { return i.id && i.id.videoId; }).filter(Boolean);
      return ids.length ? videoDetails(ids) : [];
    }).then(function (vs) {
      var src = catOfQuery(q);
      var list = vs.filter(okFilm).map(function (v) { return toFilm(v, src); }).slice(0, 30);
      Store.cacheSet(ck, list);
      addPool(list);
      return list;
    }).catch(function (e) { return stale(ck, e); });
  }

  /* ---------- Hoạt hình AI (danh sách phát = nhiều tập). Loại bỏ mọi hoạt hình 3D ---------- */

  function anime(q) {
    if (!hasKey()) return Promise.resolve(demoAnime());
    var ck = 'a3:' + q;   // khóa mới: bỏ cache cũ còn lẫn hoạt hình 3D
    var hit = Store.cacheGet(ck, cacheH());
    if (hit) return Promise.resolve(notBlocked(hit));
    return call('search', {
      part: 'snippet', type: 'playlist', q: q, maxResults: 30,
      regionCode: C.REGION, relevanceLanguage: C.LANG, safeSearch: 'moderate'
    }).then(function (d) {
      var items = [];
      (d.items || []).forEach(function (i) {
        var sn = i.snippet || {};
        var title = decode(sn.title), text = title + ' ' + decode(sn.description);
        var is3d = D3_RE.test(text), isAi = AI_RE.test(text);
        if (!i.id || !i.id.playlistId) return;
        items.push({
          id: i.id.playlistId, kind: 'anime', title: title, ch: sn.channelTitle || '',
          thumb: pick(sn.thumbnails, CARD),
          hero: pick(sn.thumbnails, HERO),
          desc: decode(sn.description).slice(0, 280), tag: is3d ? '3D' : D2_RE.test(text) ? '2D' : isAi ? 'AI' : '', eps: 0
        });
      });
      if (!items.length) return [];
      return call('playlists', { part: 'contentDetails', id: items.map(function (x) { return x.id; }).join(','), maxResults: 50 })
        .then(function (r) {
          var cnt = {};
          (r.items || []).forEach(function (p) { cnt[p.id] = p.contentDetails.itemCount; });
          return items.filter(function (x) { x.eps = cnt[x.id] || 0; return x.eps >= 2; });
        });
    }).then(function (list) {
      Store.cacheSet(ck, list);
      return list;
    }).catch(function (e) { return stale(ck, e); });
  }

  function animeSearchAll() {
    return Promise.all(C.ANIME_QUERIES.map(function (q) { return anime(q).catch(function () { return []; }); }))
      .then(function (arr) {
        var seen = {}, out = [];
        arr.forEach(function (l) { l.forEach(function (it) { if (!seen[it.id]) { seen[it.id] = 1; out.push(it); } }); });
        return out;
      });
  }

  function episodes(pl) {
    // bộ hoạt hình gộp từ video của kênh: danh sách tập đã có sẵn
    if (pl && String(pl.id).indexOf('grp:') === 0) {
      if (groups[pl.id]) return Promise.resolve(notBlocked(groups[pl.id]));
      return animeAll().then(function () { return notBlocked(groups[pl.id] || []); });
    }
    if (!hasKey()) return Promise.resolve(demoEpisodes(pl));
    var ck = 'e2:' + pl.id;
    var hit = Store.cacheGet(ck, cacheH());
    if (hit) return Promise.resolve(notBlocked(hit));
    var ids = [];
    function page(token, n) {
      return call('playlistItems', { part: 'contentDetails', playlistId: pl.id, maxResults: 50, pageToken: token }).then(function (d) {
        (d.items || []).forEach(function (i) { if (i.contentDetails && i.contentDetails.videoId) ids.push(i.contentDetails.videoId); });
        if (d.nextPageToken && n < 2) return page(d.nextPageToken, n + 1);
      });
    }
    return page('', 0).then(function () {
      return ids.length ? videoDetails(ids) : [];
    }).then(function (vs) {
      var out = [];
      vs.forEach(function (v) {
        var st = v.status || {};
        if (st.embeddable === false || st.privacyStatus !== 'public' || Store.isBlocked(v.id)) return;
        var sn = v.snippet;
        out.push({
          id: v.id, kind: 'ep', title: sn.title, ep: out.length + 1,
          thumb: pick(sn.thumbnails, CARD),
          hero: pick(sn.thumbnails, HERO),
          dur: parseDur(v.contentDetails.duration), desc: (sn.description || '').slice(0, 200), tag: pl.tag
        });
      });
      Store.cacheSet(ck, out);
      return out;
    }).catch(function (e) { return stale(ck, e); });
  }

  /* ---------- Kênh YouTube theo dõi ---------- */

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
  }

  // Tìm id kênh theo tên: chỉ tốn hạn mức lần đầu, sau đó nhớ vĩnh viễn trên thiết bị
  // Gộp các yêu cầu giống nhau đang chạy cùng lúc (tránh tốn hạn mức gấp 2-3 lần)
  var inflight = {};
  function once(key, fn) {
    if (inflight[key]) return inflight[key];
    var p = fn();
    inflight[key] = p;
    var done = function () { delete inflight[key]; };
    p.then(done, done);
    return p;
  }

  /* Mã kênh dùng chung: channels.json đặt cạnh trang phát trên GitHub Pages.
     Có file này thì TV không phải tìm kênh (100 đơn vị/kênh), kể cả sau khi cài lại app. */
  var sharedP = null;
  function normName(s) {
    s = String(s || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* TV cũ */ }
    return s.replace(/đ/g, 'd').replace(/[^a-z0-9@]/g, '');
  }
  function sharedChannels() {
    if (sharedP) return sharedP;
    var host = String(C.PLAYER_HOST || '').trim(), url = '';
    var saved = Store.keep('shared') || null;
    if (C.CHANNELS_JSON) url = C.CHANNELS_JSON;
    else if (host) url = host + (host.slice(-1) === '/' ? '' : '/') + 'channels.json';
    else if (/^https?:/.test(w.location.protocol) && !w.AndroidApp) url = '../channels.json';   // bản trình duyệt trên GitHub Pages
    if (!url) { sharedP = Promise.resolve(saved ? saved.map : {}); return sharedP; }
    if (saved && Date.now() - saved.t < 12 * 3600e3) { sharedP = Promise.resolve(saved.map); return sharedP; }
    sharedP = new Promise(function (resolve) {
      var x = new XMLHttpRequest();
      x.open('GET', url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Math.floor(Date.now() / 3600e3));
      x.timeout = 10000;
      x.onload = function () {
        var map = {};
        try {
          var d = JSON.parse(x.responseText), base = url.replace(/[^\/]*$/, '');
          (d.channels || d || []).forEach(function (c) {
            if (!c || !c.name) return;
            if (c.img && !/^https?:/.test(c.img)) c.img = base + c.img;   // ảnh kênh tải lên từ trang quản trị (đường dẫn tính từ channels.json)
            if (c.id || c.img || c.title) map[normName(c.name)] = c;
          });
          var list = d.v >= 2 ? d.channels : null;   // channels.json bản 2: danh sách kênh do trang quản trị quản lý
        } catch (e) { map = saved ? saved.map : {}; list = saved && saved.list; }
        if (x.status === 200) {
          var changed = JSON.stringify(list || null) !== JSON.stringify((saved && saved.list) || null);
          Store.keep('shared', { t: Date.now(), map: map, list: list || null });
          if (changed && w.Settings && w.Settings.apply) { try { w.Settings.apply(); } catch (e2) { /* bỏ qua */ } }
        }
        resolve(map);
      };
      x.onerror = x.ontimeout = function () { resolve(saved ? saved.map : {}); };
      x.send();
    });
    return sharedP;
  }

  function sharedInfo(c, ch) {   // tên hiển thị + ảnh kênh do trang quản trị đặt
    var sv = Store.keep('shared'), s2 = sv && sv.map && sv.map[normName(c.name)];
    if (s2) { if (s2.title) ch.title = s2.title; if (s2.img) ch.thumb = s2.img; else if (!ch.thumb && s2.thumb) ch.thumb = s2.thumb; }
    return ch;
  }
  function resolveChannel(c) {
    if (c.id) return sharedChannels().then(function () { var k = Store.keep('ch:' + c.name); return sharedInfo(c, { name: c.name, id: c.id, title: (k && k.title) || c.name, thumb: (k && k.thumb) || '' }); });
    return resolveChannel0(c).then(function (ch) { return ch ? sharedInfo(c, ch) : ch; });
  }
  function resolveChannel0(c) {
    if (Store.keep('ch:' + c.name)) return Promise.resolve(Store.keep('ch:' + c.name));
    return sharedChannels().then(function (map) {
      var s = map[normName(c.name)];
      if (s && s.id) {
        var ch = { name: c.name, id: s.id, title: s.title || c.name, thumb: s.thumb || '' };
        Store.keep('ch:' + c.name, ch);
        return ch;
      }
      return once('rc:' + c.name, function () { return resolveChannelNow(c); });
    });
  }
  function resolveChannelOld(c) {
    return once('rc:' + c.name, function () { return resolveChannelNow(c); });
  }

  function resolveChannelNow(c) {
    if (c.id) return Promise.resolve({ name: c.name, id: c.id, title: c.name, thumb: '' });
    var nm = String(c.name || '').trim();
    // Người dùng nhập @tên-kênh hoặc mã kênh UC…: tra trực tiếp (1 đơn vị thay vì 100)
    if (/^@/.test(nm) || /^UC[\w-]{22}$/.test(nm)) {
      var pr = { part: 'snippet' };
      if (nm.charAt(0) === '@') pr.forHandle = nm; else pr.id = nm;
      return call('channels', pr).then(function (d) {
        var it = (d.items || [])[0];
        if (!it) return null;
        var sn = it.snippet || {};
        var ch = { name: c.name, id: it.id, title: decode(sn.title || nm), thumb: pick(sn.thumbnails, ['high', 'medium', 'default']) };
        Store.keep('ch:' + c.name, ch);
        return ch;
      });
    }
    var saved = Store.keep('ch:' + c.name);
    if (saved) return Promise.resolve(saved);
    return call('search', { part: 'snippet', type: 'channel', q: c.name, maxResults: 5, regionCode: C.REGION })
      .then(function (d) {
        var items = d.items || [], want = norm(c.name), best = null;
        items.forEach(function (i) {
          var t = norm(i.snippet && i.snippet.title);
          if (!best && t === want) best = i;
        });
        items.forEach(function (i) {
          var t = norm(i.snippet && i.snippet.title);
          if (!best && (t.indexOf(want) >= 0 || want.indexOf(t) >= 0)) best = i;
        });
        best = best || items[0];
        if (!best) return null;
        var sn = best.snippet || {};
        var ch = {
          name: c.name, id: (best.id && best.id.channelId) || sn.channelId, title: decode(sn.title || c.name),
          thumb: pick(sn.thumbnails, ['high', 'medium', 'default'])
        };
        if (ch.id) Store.keep('ch:' + c.name, ch);
        return ch.id ? ch : null;
      });
  }

  function channels() {
    if (!hasKey()) return Promise.resolve(demoChannels());
    var list = (C.CHANNELS || []).map(function (c) { return { c: c, type: 'drama' }; })
      .concat((C.ANIME_CHANNELS || []).map(function (c) { return { c: c, type: 'anime' }; }))
      .concat((C.MOVIE_CHANNELS || []).map(function (c) { return { c: c, type: 'movie' }; }));
    var missing = [];
    return Promise.all(list.map(function (x) {
      return resolveChannel(x.c).then(function (ch) {
        if (!ch) { markCh('miss:' + x.c.name); missing.push({ name: x.c.name, anime: x.type === 'anime', movie: x.type === 'movie', why: 'notfound' }); return null; }
        var o = {}; for (var k in ch) o[k] = ch[k];
        o.anime = x.type === 'anime'; o.movie = x.type === 'movie'; o.type = x.type; o.tag = x.c.tag || '';
        return o;
      }).catch(function (e) { markCh('miss:' + x.c.name); missing.push({ name: x.c.name, anime: x.type === 'anime', movie: x.type === 'movie', why: e && e.quota ? 'quota' : 'error' }); return null; });
    })).then(function (l) { lastMissing = missing; return l.filter(Boolean); });
  }
  var lastMissing = [];

  // Video hoạt hình AI hợp lệ: phát nhúng được, đủ dài, không phải 3D
  function okAnimeVideo(v) {
    var sn = v.snippet || {}, st = v.status || {}, cd = v.contentDetails || {};
    var dur = parseDur(cd.duration);
    return st.embeddable !== false && st.privacyStatus === 'public' && sn.liveBroadcastContent === 'none' &&
      dur >= (C.MIN_ANIME_MINUTES || 5) * 60 &&
      !Store.isBlocked(v.id);
  }

  // Video mới nhất của 1 kênh: đọc danh sách tải lên (1 đơn vị hạn mức thay vì 100)
  function channelWhy(ch) {
    var ck = (ch.anime ? 'ca2:' : ch.movie ? 'cm:' : 'cv:') + ch.id, y = Store.keep('why:' + ck);
    if (!y) return '';
    if (!y.got) return 'YouTube không trả về video nào của kênh này.';
    var p = [];
    if (y.noEmbed) p.push(y.noEmbed + ' video bị kênh tắt cho phép nhúng (không phát được trong app)');
    if (y.short) p.push(y.short + ' video ngắn hơn ' + y.min + ' phút');
    if (y.notPublic) p.push(y.notPublic + ' video không công khai');
    if (y.live) p.push(y.live + ' video đang/sắp phát trực tiếp');
    return p.length ? 'Đã đọc ' + y.read + ' video, đều bị bỏ: ' + p.join(', ') + '.' : '';
  }
  /* ---------- Tiến độ tải kênh (màn hình khởi động: "Đang lấy phim mới… 3/38 kênh") ---------- */
  var progDone = {}, progN = 0, progFns = [];
  function totalChannels() { return (C.CHANNELS || []).length + (C.ANIME_CHANNELS || []).length + (C.MOVIE_CHANNELS || []).length; }
  function markCh(k) {
    if (progDone[k]) return;
    progDone[k] = 1; progN++;
    var tot = Math.max(progN, totalChannels());
    progFns.forEach(function (f) { try { f(progN, tot); } catch (e) { /* bỏ qua */ } });
  }

  function channelFilms(ch) {
    var ck0 = (ch.anime ? 'ca2:' : ch.movie ? 'cm:' : 'cv:') + ch.id;
    var p = channelFilms0(ch);
    p.then(function () { markCh(ck0); }, function () { markCh(ck0); });
    return p;
  }
  function channelFilms0(ch) {
    if (!hasKey()) return Promise.resolve(demoFilms('date').map(function (f) { var x = {}; for (var k in f) x[k] = f[k]; x.ch = ch.title; return x; }));
    var ck = (ch.anime ? 'ca2:' : ch.movie ? 'cm:' : 'cv:') + ch.id;
    var hit = Store.cacheGet(ck, C.CHANNEL_HOURS);
    if (hit) { hit = notBlocked(hit); addPool(hit); return Promise.resolve(hit); }
    return once(ck, function () { return channelFilmsNow(ch, ck); });
  }

  function seeded(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hashStr(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }

  function pickIds(items, chId) {
    var n = C.CHANNEL_VIDEOS || 25, cut = Date.now() - (C.NEW_DAYS || 3) * 86400e3;
    var fresh = [], rest = [];
    items.forEach(function (i) {
      var cd = i.contentDetails || {}, id = cd.videoId;
      if (!id) return;
      if (new Date(cd.videoPublishedAt || 0).getTime() > cut) fresh.push(id); else rest.push(id);
    });
    fresh = fresh.slice(0, n);
    var rnd = seeded(hashStr(chId + ':' + Math.floor(Date.now() / 86400e3)));
    for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    return fresh.concat(rest.slice(0, Math.max(0, n - fresh.length)));
  }

  function channelFilmsNow(ch, ck) {
    var uploads = 'UU' + ch.id.slice(2);
    // Tiết kiệm: mỗi giờ chỉ đọc danh sách tải lên (1 đơn vị) và lấy chi tiết video MỚI;
    // lượt xem của video cũ được làm mới mỗi C.FULL_REFRESH_HOURS giờ
    var meta = Store.keep('m:' + ck) || null, old = Store.cacheGetAny(ck);
    var incremental = meta && old && Array.isArray(old) && old.length > 0 && Date.now() - (meta.full || 0) < cacheH(C.FULL_REFRESH_HOURS || 6) * 3600e3;
    var ids = [];
    // Đọc 50 video gần nhất (vẫn 1 đơn vị). Lấy hết video MỚI, phần còn lại chọn ngẫu nhiên
    // từ video cũ hơn của kênh (đổi mỗi ngày) cho đủ CHANNEL_VIDEOS.
    return call('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: 50 })
      .then(function (d) {
        ids = pickIds(d.items || [], ch.id);
        var need = incremental ? ids.filter(function (id) { return meta.seen.indexOf(id) < 0; }) : ids;
        return need.length ? videoDetails(need) : [];
      }).then(function (vs) {
        var why = { got: ids.length, read: vs.length, noEmbed: 0, notPublic: 0, live: 0, short: 0, min: ch.anime ? (C.MIN_ANIME_MINUTES || 5) : (C.MIN_FILM_MINUTES || 20) };
        vs.forEach(function (v) {
          var sn = v.snippet || {}, st = v.status || {}, cd = v.contentDetails || {};
          if (st.embeddable === false) why.noEmbed++;
          else if (st.privacyStatus !== 'public') why.notPublic++;
          else if (sn.liveBroadcastContent && sn.liveBroadcastContent !== 'none') why.live++;
          else if (parseDur(cd.duration) < why.min * 60) why.short++;
        });
        Store.keep('why:' + ck, why);
        var fresh = ch.anime
          ? vs.filter(okAnimeVideo).map(function (v) { var f = toFilm(v, ''); f.chId = ch.id; f.anime = true; f.tag = animeTag(v, ch.tag); return f; })
          : vs.filter(okFilm).map(function (v) { var f = toFilm(v, ''); f.chId = ch.id; if (ch.movie) f.movie = true; return f; });
        var list = fresh;
        if (incremental) {
          var keepIds = {};
          ids.forEach(function (id) { keepIds[id] = 1; });
          list = fresh.concat(old.filter(function (f) { return keepIds[f.id]; }));
          list.sort(function (a, b) { return String(b.pub || '').localeCompare(String(a.pub || '')); });
        }
        Store.keep('m:' + ck, { seen: ids, full: incremental ? meta.full : Date.now() });
        Store.cacheSet(ck, list);
        list = notBlocked(list);
        addPool(list);
        return list;
      }).catch(function (e) { return stale(ck, e); });
  }

  // Gộp phim mới của tất cả kênh, mới nhất trước
  // type: 'drama' (phim ngắn), 'anime' (hoạt hình), 'movie' (phim lẻ hay)
  function mergeChannels(type) {
    if (type === true) type = 'anime';
    if (type === false || !type) type = 'drama';
    return channels().then(function (chs) {
      chs = chs.filter(function (c) { return (c.type || (c.anime ? 'anime' : 'drama')) === type; });
      return Promise.all(chs.map(function (c) { return channelFilms(c).catch(function () { return []; }); }));
    }).then(function (arr) {
      var seen = {}, out = [];
      arr.forEach(function (l) { l.forEach(function (f) { if (!seen[f.id]) { seen[f.id] = 1; out.push(f); } }); });
      out.sort(function (a, b) { return String(b.pub || '').localeCompare(String(a.pub || '')); });
      return out;
    });
  }
  function followedFilms() { return mergeChannels('drama'); }
  // Phim lẻ hay: xem nhiều trước
  function movieFilms() {
    return mergeChannels('movie').then(function (l) {
      return l.slice().sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
    });
  }

  // Phim theo danh mục: lấy từ phim các kênh theo dõi (không tốn hạn mức).
  // Chỉ khi có ít hơn C.CAT_MIN_FROM_CHANNELS phim mới tìm thêm trên YouTube (tốn ~100).
  function catFilms(cat, forRec) {
    return followedFilms().catch(function () { return []; }).then(function (all) {
      var mine = all.filter(function (f) { return catsOf(f).indexOf(cat.name) >= 0; });
      if (forRec) {
        // Hàng Đề xuất: không bao giờ tìm kiếm; thiếu thì thêm phim xem nhiều từ các kênh
        mine = mine.slice().sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
        if (mine.length < 10) {
          var have = {};
          mine.forEach(function (f) { have[f.id] = 1; });
          mine = mine.concat(all.filter(function (f) { return !have[f.id]; }).sort(function (a, b) { return (b.views || 0) - (a.views || 0); }));
        }
        if (mine.length) return mine;
      }
      if (mine.length >= (C.CAT_MIN_FROM_CHANNELS || 12) || !cat.q || C.CAT_SEARCH_MORE === false) return mine;
      return films(cat.q, 'relevance').then(function (more) {
        var seen = {};
        mine.forEach(function (f) { seen[f.id] = 1; });
        return mine.concat(more.filter(function (f) { return !seen[f.id]; }));
      }).catch(function (e) { if (mine.length) return mine; throw e; });
    });
  }

  // Tìm hoạt hình AI trong các kênh hoạt hình đã tải (không tốn hạn mức)
  function animeSearchLocal(text) {
    var t = norm(text);
    return animeAll().then(function (l) {
      return l.filter(function (f) { return norm(f.title + ' ' + (f.ch || '')).indexOf(t) >= 0; });
    }).catch(function () { return []; });
  }

  // Hoạt hình AI: lấy từ các kênh hoạt hình bạn chọn; không có thì tìm danh sách phát như cũ
  function animeAll() {
    return mergeChannels('anime').then(function (l) {
      if (l.length) return groupEpisodes(l);
      return animeSearchAll();
    }).catch(function () { return animeSearchAll(); });
  }

  /* ---------- Gộp hoạt hình nhiều tập ----------
     Video cùng kênh, cùng tên phim, khác "Tập N" -> 1 thẻ phim (hiện Tập 1), vào trong có danh sách tập. */
  var EP_RE = /(?:tập|tap|phần|phan|ep(?:isode)?|part|chương|chuong)\s*[.:#]?\s*(\d{1,3})\b|#\s?(\d{1,3})\b|\[(\d{1,3})\]/i;
  var groups = {};
  function epInfo(title) {
    var m = EP_RE.exec(title || '');
    if (!m) return null;
    var n = +(m[1] || m[2] || m[3]);
    var base = (title.slice(0, m.index) + ' ' + title.slice(m.index + m[0].length));
    // tên bộ phim: bỏ phần quảng cáo sau dấu | và các chữ chung chung
    var name = base.split('|')[0].replace(/[-–:,.\s]+$/, '').replace(/^[-–:,.\s\[\]()]+/, '').trim();
    var key = normName(base.replace(/hoạt hình ai|hoat hinh ai|ai animation|thuyết minh|vietsub|review|full|trọn bộ|mới nhất/gi, ''));
    return { n: n, name: name || title, key: key };
  }
  function groupEpisodes(list) {
    var by = {}, order = [];
    list.forEach(function (f) {
      var e = epInfo(f.title);
      // gộp theo tên phim (kể cả khi các tập nằm ở kênh khác nhau)
      var k = e && e.key && e.key.length >= 4 ? e.key : null;
      if (!k) { order.push({ single: f }); return; }
      if (!by[k]) { by[k] = { key: k, name: e.name, items: [] }; order.push({ group: by[k] }); }
      by[k].items.push({ f: f, n: e.n });
    });
    var out = [];
    order.forEach(function (o) {
      if (o.single) { out.push(o.single); return; }
      var g = o.group;
      if (g.items.length < 2) { out.push(g.items[0].f); return; }
      g.items.sort(function (a, b) { return a.n - b.n || String(a.f.pub).localeCompare(String(b.f.pub)); });
      // cùng số tập ở nhiều kênh: giữ một
      var seenN = {};
      g.items = g.items.filter(function (x) { if (seenN[x.n]) return false; seenN[x.n] = 1; return true; });
      if (g.items.length < 2) { out.push(g.items[0].f); return; }
      var first = g.items[0].f, latest = g.items.reduce(function (m, x) { return String(x.f.pub) > String(m) ? x.f.pub : m; }, '');
      var eps = g.items.map(function (x) {
        var f = x.f;
        return { id: f.id, kind: 'ep', title: f.title, ep: x.n, thumb: f.thumb, hero: f.hero, dur: f.dur, desc: f.desc, tag: f.tag || '', pub: f.pub, ch: f.ch };
      });
      var item = {
        id: 'grp:' + g.key, kind: 'anime', title: g.name, thumb: first.thumb, hero: first.hero || first.thumb,
        ch: first.ch, chId: first.chId, eps: eps.length, desc: first.desc, tag: first.tag || '', pub: latest,
        views: g.items.reduce(function (s, x) { return s + (x.f.views || 0); }, 0), grouped: true
      };
      groups[item.id] = eps;
      out.push(item);
    });
    return out;
  }


  function demoChannels() {
    return (C.CHANNELS || []).map(function (c, i) { return { name: c.name, id: 'demo-ch' + i, title: c.name, thumb: '' }; });
  }

  /* ---------- Dữ liệu demo (khi chưa có API key) ---------- */

  var DEMO_TITLES = [
    'Tổng Tài Giả Nghèo, Cô Vợ Bé Nhỏ', 'Trùng Sinh Báo Thù, Tổng Tài Quỳ Gối',
    'Xuyên Không Về Làm Phu Nhân Tổng Tài', 'Giả Chết Bỏ Trốn, Tổng Tài Phát Điên',
    'Thiên Kim Thật Trở Về', 'Mẹ Đơn Thân Và Ông Chủ Bí Ẩn', 'Cưng Chiều Vợ Nhỏ Hết Mực',
    'Hôn Nhân Chớp Nhoáng Với Tổng Tài', 'Trọng Sinh 2000, Làm Giàu Từ Số Không',
    'Nữ Phụ Xuyên Sách Phản Công', 'Chủ Tịch Giả Nghèo Đi Xem Mắt', 'Xuyên Về Cổ Đại Mở Quán Ăn'
  ];
  var DEMO_DESC = 'Đây là dữ liệu mẫu. Hãy vào Cài đặt → YouTube API key để nhập key và thấy phim thật.';

  function demoFilms(order) {
    var shift = order === 'viewCount' ? 3 : (order === 'date' ? 0 : 6);
    var out = [];
    for (var i = 0; i < DEMO_TITLES.length; i++) {
      var n = (i + shift) % DEMO_TITLES.length;
      out.push({
        id: 'demo-f' + n, kind: 'film', title: DEMO_TITLES[n], ch: 'Kênh mẫu', thumb: '', hero: '',
        dur: 4200 + n * 240, views: 2400000 - n * 150000, pub: new Date(Date.now() - n * 86400000).toISOString(),
        desc: DEMO_DESC, tag: n % 5 === 4 ? '' : 'AI', src: ''
      });
    }
    addPool(out);
    return out;
  }

  var DEMO_ANIME = ['Cô Bé Phép Thuật Và Chú Mèo Tổng Tài', 'Hiệp Sĩ Nhí Giữ Thành', 'Công Chúa Gấu Bông', 'Vương Quốc Bánh Ngọt', 'Phi Thuyền Cún Con'];
  function demoAnime() {
    return DEMO_ANIME.map(function (t, i) {
      return { id: 'demo-a' + i, kind: 'anime', title: t, ch: 'Kênh mẫu', thumb: '', hero: '', desc: DEMO_DESC, tag: 'AI', eps: 12 + i * 4 };
    });
  }
  function demoEpisodes(pl) {
    var out = [];
    for (var i = 1; i <= Math.min(pl.eps || 12, 24); i++) {
      out.push({ id: 'demo-e' + pl.id + '-' + i, kind: 'ep', title: pl.title + ' - Tập ' + i, ep: i, thumb: '', hero: '', dur: 660 + i * 7, desc: '', tag: pl.tag });
    }
    return Promise.resolve(out);
  }

  /* ---------- Bình luận (commentThreads.list: 1 đơn vị hạn mức mỗi lần) ---------- */

  function comments(videoId, o) {
    o = o || {};
    if (!hasKey()) return Promise.reject({ message: 'Chưa có API key', nokey: true });
    return call('commentThreads', {
      part: 'snippet', videoId: videoId, maxResults: 25, order: o.order === 'time' ? 'time' : 'relevance',
      textFormat: 'plainText', pageToken: o.page || ''
    }).then(function (d) {
      return {
        next: d.nextPageToken || '',
        items: (d.items || []).map(function (x) {
          var c = ((x.snippet || {}).topLevelComment || {}).snippet || {};
          return { who: c.authorDisplayName || 'Ẩn danh', text: c.textDisplay || '', likes: +c.likeCount || 0,
            at: c.publishedAt || '', replies: +(x.snippet || {}).totalReplyCount || 0 };
        })
      };
    }, function (e) {
      if (e && /commentsDisabled|disabled comments/i.test(e.message || '')) e.disabled = true;
      throw e;
    });
  }

  /* ---------- Kiểm tra bản mới: đọc version.json (đặt cùng bản web trên GitHub Pages) ---------- */
  // Các nơi có thể có version.json, thử lần lượt: UPDATE_URL; bản web cạnh trang; thư mục app/ cạnh hoặc trên PLAYER_HOST
  function updateUrls() {
    if (C.UPDATE_URL) return [C.UPDATE_URL];
    if (/^https?:/.test(w.location.protocol) && !w.AndroidApp && !w.tizen) return ['version.json'];
    var host = String(C.PLAYER_HOST || '').trim(), out = [];
    if (!host) return out;
    if (host.slice(-1) !== '/') host += '/';
    ['app/version.json', '../app/version.json', 'version.json'].forEach(function (rel) {
      var u = host + rel;
      try { u = new w.URL(rel, host).href; } catch (e) { /* TV cũ: giữ nguyên */ }
      if (out.indexOf(u) < 0) out.push(u);
    });
    return out;
  }
  function updateUrl() { return updateUrls()[0] || ''; }
  function fetchVersion(url) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('GET', url + (url.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now());
      x.timeout = 12000;
      x.onload = function () {
        var d = null;
        try { d = JSON.parse(x.responseText); } catch (e) { d = null; }
        if (x.status !== 200 || !d || !d.version) { reject({ notfound: true, status: x.status, url: url }); return; }
        resolve(d);
      };
      x.onerror = x.ontimeout = function () { reject({ net: true, url: url }); };
      x.send();
    });
  }
  function checkUpdate() {
    var urls = updateUrls();
    if (!urls.length) return Promise.reject({ nourl: true });
    var i = 0, lastErr = null;
    function next() {
      if (i >= urls.length) return Promise.reject(lastErr || { notfound: true, url: urls[0] });
      var u = urls[i++];
      return fetchVersion(u).catch(function (e) { lastErr = lastErr && lastErr.notfound ? lastErr : e; if (lastErr && lastErr.notfound) lastErr.url = urls[0]; return next(); });
    }
    return next().then(function (d) {
      var newer = (+d.build || 0) > (+C.BUILD || 0) || ((+d.build || 0) === 0 && String(d.version) !== String(C.VERSION));
      return { version: String(d.version), build: +d.build || 0, notes: String(d.notes || ''), updated: String(d.updated || ''), url: String(d.url || ''), newer: newer };
    });
  }

  /* ---------- Lọc phim theo lứa tuổi: áp dụng ở mọi danh sách trả ra ngoài ---------- */
  function fl(list) {
    if (!Array.isArray(list) || !w.Settings || !w.Settings.hides) return list;
    return list.filter(function (x) { return !w.Settings.hides(x); });
  }
  function fP(fn) { return function () { return fn.apply(null, arguments).then(fl); }; }

  w.Api = {
    updateUrls: updateUrls,
    details: function (ids) { return videoDetails(ids); },
    comments: comments, hasKey: hasKey, films: fP(films), anime: fP(anime), animeAll: fP(animeAll), episodes: fP(episodes),
    explain: explain, pool: function () { return fl(pool); }, catsOf: catsOf,
    channels: channels, channelFilms: fP(channelFilms), channelWhy: channelWhy, groupEpisodes: groupEpisodes, movieFilms: fP(movieFilms),
    cachedFilms: function (q) { return fl((q && Store.cacheGetAny('f6:' + q + ':relevance')) || []); },
    missingChannels: function () { return lastMissing; }, quotaToday: quotaToday, saveInfo: saveInfo, famSet: famSet, cacheHours: cacheH, followedFilms: fP(followedFilms), catFilms: fP(catFilms), animeSearchLocal: fP(animeSearchLocal),
    onProgress: function (f) { progFns.push(f); }, progress: function () { return { n: progN, total: Math.max(progN, totalChannels()) }; },
    checkUpdate: checkUpdate, updateUrl: updateUrl, filter: fl
  };
})(window);
