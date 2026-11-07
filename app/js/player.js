/* Trình phát toàn màn hình: nhúng trình phát YouTube, điều khiển bằng remote, lưu tiến độ xem. */
(function (w) {
  'use strict';
  var d = document;
  var $ = function (id) { return d.getElementById(id); };

  var yt = null, apiState = 0;           // 0 chưa tải, 1 đang tải, 2 sẵn sàng, -1 lỗi
  var apiWait = [];
  var isOpen = false;
  var upAt = 0;           // lần bấm ▲ gần nhất (bấm ▲ 2 lần nhanh = bật/tắt phụ đề)
  var demoHint = false;   // đang hiện thông báo "chưa có API key": bấm OK / chạm để mở Cài đặt
  var q = null;                           // {items, index, heading, key, series, onClose}
  var tickT = 0, hideT = 0, errT = 0, lastSave = 0;
  var mode = 'seek', btnIdx = 0, btns = [];
  var seekN = 0, seekAt = 0, scrubbing = false;
  var playing = false;
  var menuIdx = 0, applied = '';          // menu chất lượng; video đã áp dụng phụ đề/chất lượng

  /* ---------- Phụ đề và chất lượng ---------- */

  var QUALITIES = [
    { id: 'auto', label: 'Tự động' }, { id: 'hd2160', label: '4K' }, { id: 'hd1080', label: '1080p' },
    { id: 'hd720', label: '720p' }, { id: 'large', label: '480p' }, { id: 'medium', label: '360p' }
  ];
  var Q_NAMES = { hd2160: '4K', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p' };

  function ccOn() { return !!w.Store.pref('cc', true); }   // mặc định bật phụ đề tiếng Việt
  // TV 4K: mặc định xin YouTube phát 4K (video nào có 4K mới được)
  function qPref() { return w.Store.pref('quality', (w.DEVICE && w.DEVICE.is4k) ? 'hd2160' : 'auto'); }
  function qLabel(id) { for (var i = 0; i < QUALITIES.length; i++) if (QUALITIES[i].id === id) return QUALITIES[i].label; return Q_NAMES[id] || id; }
  function qNow() { try { return Q_NAMES[yt.getPlaybackQuality()] || ''; } catch (x) { return ''; } }

  var LANG_VI = { zh: 'tiếng Trung', 'zh-Hans': 'tiếng Trung', 'zh-Hant': 'tiếng Trung', 'zh-CN': 'tiếng Trung', 'zh-TW': 'tiếng Trung',
    en: 'tiếng Anh', ko: 'tiếng Hàn', ja: 'tiếng Nhật', th: 'tiếng Thái', id: 'tiếng Indonesia' };
  var ccInfo = '';   // phụ đề đang hiện: 'vi' (có sẵn) hoặc 'dich' (YouTube dịch sang tiếng Việt)

  // Chọn phụ đề: ưu tiên tiếng Việt do người làm phim gắn, rồi tiếng Việt tự tạo,
  // không có thì lấy phụ đề khác để YouTube dịch tự động sang tiếng Việt
  function pickTrack(list) {
    var viMan = null, viAuto = null, other = null;
    (list || []).forEach(function (t) {
      if (!t || !t.languageCode) return;
      var auto = t.kind === 'asr' || /tự động|auto/i.test(t.displayName || '');
      if (/^vi/i.test(t.languageCode)) { if (!auto && !viMan) viMan = t; else if (!viAuto) viAuto = t; }
      else if (!other || (/^zh/i.test(t.languageCode) && !/^zh/i.test(other.languageCode))) other = t;
    });
    if (viMan || viAuto) return { track: viMan || viAuto, translate: false };
    if (other) return { track: other, translate: true };
    return null;
  }

  // Bật/tắt phụ đề TIẾNG VIỆT cho video đang phát. tell = báo kết quả bằng thông báo
  function applyCaptions(tell, retry) {
    if (!yt || !yt.loadModule) return;
    try {
      if (!ccOn()) {
        ccInfo = '';
        try { yt.setOption('captions', 'track', {}); } catch (x) { /* bỏ qua */ }
        yt.unloadModule('captions');
        if (tell) w.UI.toast('Đã tắt phụ đề');
        renderLabel();
        return;
      }
      yt.loadModule('captions');
      try { yt.setOption('captions', 'reload', true); } catch (x) { /* bỏ qua */ }
      var pick = pickTrack(yt.getOption('captions', 'tracklist'));
      if (pick && !pick.translate) {
        yt.setOption('captions', 'track', { languageCode: pick.track.languageCode });
        ccInfo = 'vi';
        if (tell) w.UI.toast('Phụ đề tiếng Việt: Bật');
      } else if (pick) {
        // YouTube tự dịch phụ đề gốc sang tiếng Việt
        yt.setOption('captions', 'track', {
          languageCode: pick.track.languageCode,
          translationLanguage: { languageCode: 'vi', languageName: 'Tiếng Việt' }
        });
        ccInfo = 'dich';
        var src = LANG_VI[pick.track.languageCode] || LANG_VI[String(pick.track.languageCode).split('-')[0]] || pick.track.displayName || 'phụ đề gốc';
        if (tell) w.UI.toast('Phụ đề tiếng Việt (YouTube dịch tự động từ ' + src + ')');
      } else if (!retry) {
        setTimeout(function () { if (isOpen) applyCaptions(tell, true); }, 1800);   // danh sách phụ đề tải chậm
        return;
      } else {
        ccInfo = '';
        if (tell) w.UI.toast('Video này không có phụ đề để chuyển sang tiếng Việt (nhiều phim đã in sẵn chữ trên hình)');
      }
      renderLabel();
    } catch (x) { if (tell) w.UI.toast('Không bật được phụ đề cho video này'); }
  }

  function renderLabel() { if (isOpen && mode !== 'menu') renderBtns(); }

  /* Chất lượng: YouTube đã bỏ khả năng ép chất lượng từ ứng dụng nhúng (setPlaybackQuality bị bỏ qua),
     nhưng chế độ Tự động chọn độ phân giải theo KÍCH THƯỚC khung phát (tính bằng điểm ảnh thật).
     Nên app đổi kích thước khung: khung 640x360 -> xin ~360p, khung 3840x2160 -> xin 4K,
     rồi phóng / thu lại cho vừa màn hình bằng transform. */
  var Q_H = { hd2160: 2160, hd1080: 1080, hd720: 720, large: 480, medium: 360 };

  function sizeForQuality() {
    var host = $('yt-host'), fr = host && host.querySelector('iframe');
    if (!fr) return;
    var qp = qPref(), H = Q_H[qp];
    var set = function (k, v) { fr.style.setProperty(k, v, 'important'); };
    if (!H || w.AndroidApp) {                        // Tự động (hoặc TV Android: video phần cứng không chịu phóng/thu -> bị cắt, nên không dùng mẹo này)
      ['width', 'height', 'transform', '-webkit-transform', 'transform-origin'].forEach(function (k) { fr.style.removeProperty(k); });
      return;
    }
    var hw = host.offsetWidth, hh = host.offsetHeight, r = host.getBoundingClientRect();
    var devH = r.height * (w.devicePixelRatio || 1);   // chiều cao thật của khung, tính bằng điểm ảnh màn hình
    if (!hw || !hh || !devH) return;
    var f = Math.max(0.15, Math.min(3, H / devH));
    set('width', Math.round(hw * f) + 'px');
    set('height', Math.round(hh * f) + 'px');
    set('transform-origin', '0 0');
    set('transform', 'scale(' + (1 / f) + ')');
    set('-webkit-transform', 'scale(' + (1 / f) + ')');
  }

  function applyQuality(tell) {
    var qp = qPref();
    sizeForQuality();
    try {
      if (qp !== 'auto' && yt && yt.setPlaybackQuality) yt.setPlaybackQuality(qp);   // vẫn gửi gợi ý, đề phòng YouTube còn nghe
    } catch (x) { /* bỏ qua */ }
    if (tell) {
      w.UI.toast('Đang chuyển sang ' + qLabel(qp) + '… YouTube cần vài giây');
      [3500, 8000].forEach(function (ms, i) {
        setTimeout(function () {
          if (!isOpen) return;
          var now = qNow();
          renderBtns();
          if (i === 1 && now) w.UI.toast('Chất lượng: ' + qLabel(qp) + ' · đang phát ' + now + (qp !== 'auto' && now !== qLabel(qp) ? ' (video này chỉ có tới mức đó hoặc mạng chưa đủ)' : ''));
        }, ms);
      });
    }
  }

  /* ---------- Xoay hình (phim bị quay ngang/ngược) ---------- */

  function rotOf() { return 0; }   // không xoay: phim dọc hiện giữa màn hình như YouTube
  function applyRot() {
    var r = rotOf(), host = $('yt-host');
    // xoay 90/270: thu nhỏ để cả khung hình nằm vừa màn hình ngang
    host.style.transform = r ? 'rotate(' + r + 'deg)' + (r % 180 ? ' scale(0.5625)' : '') : '';
    host.style.webkitTransform = host.style.transform;
  }
  function setRot(r) {
    w.Store.setPref('rot:' + cur().id, r);
    applyRot();
    w.UI.toast(r ? 'Đã xoay hình ' + r + '° (app nhớ cho phim này)' : 'Hình về như cũ');
  }

  /* ---------- Bỏ phim lỗi: ẩn vĩnh viễn, chuyển phim/tập khác ---------- */

  function skipVideo() {
    var it = cur();
    w.Store.block(it.id);
    if (q.series && q.series.id && q.series.id !== it.id && q.items.length > 1) {
      w.UI.toast('Đã bỏ tập này');
    } else {
      w.Store.block((q.series || it).id);
      w.UI.toast('Đã ẩn phim này, sẽ không hiện lại');
    }
    if (q.index < q.items.length - 1) play(q.index + 1); else close();
  }

  function renderMenu() {
    var m = $('pl-menu');
    if (mode !== 'menu') { m.classList.add('hidden'); return; }
    m.innerHTML = '';
    var h = d.createElement('div');
    h.className = 'pmh';
    var now = qNow();
    h.textContent = 'Chất lượng' + (now ? ' · đang phát ' + now : '');
    m.appendChild(h);
    QUALITIES.forEach(function (o, i) {
      var r = d.createElement('div');
      r.className = 'pmi' + (i === menuIdx ? ' focus' : '') + (o.id === qPref() ? ' on' : '');
      r.textContent = o.label;
      m.appendChild(r);
    });
    m.classList.remove('hidden');
  }

  function openMenu() {
    mode = 'menu';
    menuIdx = 0;
    QUALITIES.forEach(function (o, i) { if (o.id === qPref()) menuIdx = i; });
    renderMenu();
    showUi();
  }

  function closeMenu() {
    mode = 'btn';
    renderMenu();
    renderBtns();
    showUi();
  }

  /* ---------- Samsung Tizen: phát qua trang trung gian (tránh lỗi 153) ----------
     App Tizen chạy từ file nội bộ nên YouTube không biết nguồn và từ chối (lỗi 153).
     Trang trung gian (player-host/index.html, đặt trên GitHub Pages) nhúng YouTube giúp,
     app điều khiển nó qua postMessage. Trang này không chứa API key. */

  var isWeb = /^https?:/.test(w.location.protocol);
  function hostUrl() { return String((w.APP_CONFIG && w.APP_CONFIG.PLAYER_HOST) || '').trim(); }
  function useHost() { return (!isWeb || !!w.AndroidApp) && !!hostUrl(); }   // Samsung luôn; Android chỉ khi bạn điền PLAYER_HOST

  function srcMode() { return useHost() ? 'host' : (isWeb ? 'web' : 'direct'); }

  function HostPlayer(elId, opts) {
    var self = this, ready = false, queue = [];
    var st = { t: 0, d: 0, s: -1, q: '', tracks: [] };
    var frame = d.createElement('iframe');
    frame.setAttribute('allow', 'autoplay; encrypted-media');
    frame.setAttribute('tabindex', '-1');
    frame.style.cssText = 'width:1920px;height:1080px;border:0;background:#000';
    function post(m) {
      if (!ready) { queue.push(m); return; }
      try { frame.contentWindow.postMessage(JSON.stringify(m), '*'); } catch (x) { /* bỏ qua */ }
    }
    function onMsg(e) {
      if (e.source !== frame.contentWindow) return;
      var m;
      try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (x) { return; }
      if (!m || !m.type) return;
      if (m.type === 'hello' && !ready) {
        ready = true;
        frame.contentWindow.postMessage(JSON.stringify({ cmd: 'create', videoId: opts.videoId, vars: opts.playerVars }), '*');
        queue.splice(0).forEach(post);
      } else if (m.type === 'snap') {
        st.t = m.t; st.d = m.d; st.s = m.s; st.q = m.q; st.tracks = m.tracks || [];
      } else if (m.type === 'ready') {
        opts.events.onReady({ target: self });
      } else if (m.type === 'state') {
        st.s = m.data;
        opts.events.onStateChange({ data: m.data, target: self });
      } else if (m.type === 'error') {
        opts.events.onError({ data: m.data, target: self });
      }
    }
    w.addEventListener('message', onMsg);
    ['playVideo', 'pauseVideo', 'stopVideo', 'seekTo', 'loadVideoById', 'loadModule', 'unloadModule', 'setOption', 'setPlaybackQuality']
      .forEach(function (fn) {
        self[fn] = function () {
          var a = Array.prototype.slice.call(arguments);
          if (fn === 'seekTo') st.t = a[0];
          if (fn === 'loadVideoById') { st.t = (a[0] && a[0].startSeconds) || 0; st.d = 0; }
          post({ cmd: 'call', fn: fn, args: a });
        };
      });
    self.getCurrentTime = function () { return st.t || 0; };
    self.getDuration = function () { return st.d || 0; };
    self.getPlayerState = function () { return st.s; };
    self.getPlaybackQuality = function () { return st.q || ''; };
    self.getOption = function (mod, key) { return key === 'tracklist' ? st.tracks : null; };
    // Gỡ hẳn trang phát khi đóng: TV Samsung không còn giữ hình/tiếng video ở nền
    self.destroy = function () {
      w.removeEventListener('message', onMsg);
      try { frame.contentWindow.postMessage(JSON.stringify({ cmd: 'call', fn: 'stopVideo', args: [] }), '*'); } catch (x) { /* bỏ qua */ }
      try { frame.src = 'about:blank'; } catch (x) { /* bỏ qua */ }
      if (frame.parentNode) frame.parentNode.removeChild(frame);
    };
    var host = d.getElementById(elId);
    host.innerHTML = '';
    host.appendChild(frame);
    frame.src = hostUrl();
    // trang trung gian không trả lời -> báo lỗi rõ ràng
    setTimeout(function () { if (!ready) opts.events.onError({ data: 'host', target: self }); }, 20000);
  }

  function loadApi(cb) {
    if (useHost()) {
      if (!w.YT) w.YT = { PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
      cb(true);
      return;
    }
    if (apiState === 2) { cb(true); return; }
    apiWait.push(cb);
    if (apiState === 1) return;
    apiState = 1;
    w.onYouTubeIframeAPIReady = function () {
      apiState = 2;
      apiWait.splice(0).forEach(function (f) { f(true); });
    };
    var s = d.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = fail;
    d.head.appendChild(s);
    setTimeout(function () { if (apiState === 1) fail(); }, 15000);
    function fail() {
      apiState = -1;
      apiWait.splice(0).forEach(function (f) { f(false); });
    }
  }

  function msg(t) {
    var m = $('pl-msg');
    if (!t) { m.classList.add('hidden'); return; }
    m.textContent = t;
    m.classList.remove('hidden');
  }

  function cur() { return q.items[q.index]; }

  function slim(it) {
    var o = {};
    ['id', 'kind', 'title', 'thumb', 'hero', 'tag', 'ch', 'dur', 'eps', 'views', 'pub', 'src', 'cc', 'anime', 'chId'].forEach(function (k) { if (it[k] != null) o[k] = it[k]; });
    o.desc = (it.desc || '').slice(0, 200);
    return o;
  }

  function showUi() {
    $('pl-ui').classList.add('show');
    clearTimeout(hideT);
    // 5 giây không bấm remote: ẩn thanh điều khiển (kể cả khi đang chọn nút hoặc tạm dừng)
    hideT = setTimeout(function () {
      if (!isOpen || mode === 'menu') return;
      if (mode === 'btn') { mode = 'seek'; renderBtns(); }
      $('pl-ui').classList.remove('show');
    }, 5000);
  }

  function renderBtns() {
    if (!q) return;   // trình phát đã đóng (tin nhắn đến trễ)
    var box = $('pl-btns');
    box.innerHTML = '';
    var multi = q.items.length > 1;
    btns = [];
    if (multi) btns.push({ id: 'prev', label: 'Tập trước', svg: '<path d="M6 5v14"/><path d="M19 5L9 12l10 7z" fill="currentColor"/>' });
    btns.push({ id: 'back', label: '-10s', svg: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>' });
    btns.push({ id: 'play', label: playing ? 'Tạm dừng' : 'Phát', svg: playing ? '<rect x="6" y="4" width="4.2" height="16" rx="1" fill="currentColor"/><rect x="13.8" y="4" width="4.2" height="16" rx="1" fill="currentColor"/>' : '<path d="M6 3l15 9-15 9z" fill="currentColor"/>' });
    btns.push({ id: 'fwd', label: '+10s', svg: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>' });
    if (multi) btns.push({ id: 'next', label: 'Tập sau', svg: '<path d="M18 5v14"/><path d="M5 5l10 7-10 7z" fill="currentColor"/>' });
    btns.push({ id: 'skip', label: 'Bỏ phim', svg: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>' });
    btns.push({ id: 'cc', wide: true, label: ccOn() ? (ccInfo === 'dich' ? 'Phụ đề: Việt (dịch)' : 'Phụ đề: Tiếng Việt') : 'Phụ đề: Tắt', on: ccOn(), svg: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 10.2a2.4 2.4 0 1 0 0 3.6M17 10.2a2.4 2.4 0 1 0 0 3.6"/>' });
    var nowQ = qNow();
    btns.push({ id: 'quality', wide: true, label: 'Chất lượng: ' + (qPref() === 'auto' && nowQ ? 'Tự động (' + nowQ + ')' : qLabel(qPref())), svg: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>' });
    var pi = 0;
    btns.forEach(function (b, i) { if (b.id === 'play') pi = i; });
    if (btnIdx >= btns.length || btnIdx < 0) btnIdx = pi;
    btns.forEach(function (b, i) {
      var e = d.createElement('div');
      e._idx = i;
      e.className = 'plb' + (b.id === 'play' ? ' big' : '') + (b.wide ? ' wide' : '') + (b.on ? ' on' : '') +
        ((mode === 'btn' || mode === 'menu') && i === btnIdx ? ' focus' : '');
      e.innerHTML = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + b.svg + '</svg>';
      var l = d.createElement('span');
      l.textContent = b.label;
      e.appendChild(l);
      box.appendChild(e);
    });
  }

  function setTitles() {
    var it = cur(), s = q.series || it;
    $('pl-title').textContent = q.heading || it.title;
    var sub = '';
    if (q.items.length > 1) sub = 'Tập ' + (it.ep || (q.index + 1)) + ' / ' + q.items.length + (it.title && it.title !== q.heading ? ' · ' + it.title : '');
    else sub = (s.anime ? 'Hoạt hình' + (s.tag ? ' ' + s.tag : '') : 'Phim lẻ' + (s.tag === 'AI' ? ' AI' : '')) + (s.ch ? ' · ' + s.ch : '') + (it.dur ? ' · ' + w.UI.fmtLong(it.dur) : '');
    $('pl-sub').textContent = sub;
  }

  function touchRecent() {
    var it = cur();
    w.Store.touchRecent({ key: q.key, item: slim(q.series || it), vid: it.id, ep: it.ep || 0 });
  }

  function startPos(it) {
    var p = w.Store.getProgress(it.id);
    if (q.fromStart) return 0;
    if (p && p.p > 15 && p.d && p.p < p.d - 20) return p.p;
    return 0;
  }

  function play(i) {
    q.index = i;
    var it = cur();
    clearTimeout(errT);
    setTitles();
    touchRecent();
    mode = 'seek';
    applied = '';
    applyRot();
    ccInfo = '';
    renderMenu();
    renderBtns();
    $('pl-fill').style.width = '0%';
    $('pl-knob').style.left = '0%';
    $('pl-cur').textContent = '00:00';
    $('pl-dur').textContent = it.dur ? w.UI.fmtDur(it.dur) : '--:--';
    playing = false;
    showUi();

    demoHint = false;
    if (String(it.id).indexOf('demo') === 0) {
      demoHint = true;
      msg('Chế độ demo: chưa có API key nên chưa phát được video.\nBấm OK (hoặc chạm vào đây) để mở Cài đặt và điền YouTube API key.');
      return;
    }
    msg('Đang tải video…');
    var s = startPos(it);
    if (s > 0) w.UI.toast('Tiếp tục từ ' + w.UI.fmtDur(s));
    loadApi(function (ok) {
      if (!isOpen || cur() !== it) return;
      if (!ok) { msg('Không tải được trình phát YouTube. Kiểm tra mạng của TV.'); errT = setTimeout(close, 4000); return; }
      if (yt && yt.loadVideoById) {
        var lv = { videoId: it.id, startSeconds: s };
        if (qPref() !== 'auto') lv.suggestedQuality = qPref();
        yt.loadVideoById(lv);
      } else {
        var web = /^https?:/.test(w.location.protocol);
        var vars = { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, hl: 'vi', start: s,
          cc_load_policy: ccOn() ? 1 : 0, cc_lang_pref: 'vi' };
        if (web) vars.origin = w.location.origin;
        // App chạy từ widget:// hoặc file:// không có referrer: khai báo nguồn để YouTube cho phép nhúng
        vars.widget_referrer = web ? w.location.href : 'https://tongtaitv.app/';
        var opt = {
          width: '1920', height: '1080', videoId: it.id, playerVars: vars,
          events: { onReady: onReady, onStateChange: onState, onError: onError }
        };
        yt = useHost() ? new HostPlayer('yt', opt) : new w.YT.Player('yt', opt);
      }
    });
  }

  function onReady(e) {
    if (!isOpen || !q) { try { e.target.stopVideo(); } catch (x) { /* bỏ qua */ } return; }
    try { e.target.playVideo(); } catch (x) { /* bỏ qua */ }
  }

  function onState(e) {
    if (!isOpen || !q) return;   // sự kiện đến sau khi đã đóng trình phát
    var S = w.YT.PlayerState;
    if (e.data === S.PLAYING) {
      playing = true; msg('');
      var vid = cur().id;
      if (applied !== vid) { applied = vid; applyCaptions(false); applyQuality(false); }
      if (mode !== 'menu') renderBtns();
      showUi();
    } else if (e.data === S.PAUSED) {
      playing = false; renderBtns(); $('pl-ui').classList.add('show');
    } else if (e.data === S.BUFFERING) {
      if (!playing) msg('Đang tải…'); else msg('');
    } else if (e.data === S.ENDED) {
      playing = false;
      var it = cur(), dur = yt.getDuration() || it.dur || 0;
      w.Store.setProgress(it.id, dur, dur);
      if (q.index < q.items.length - 1) play(q.index + 1); else close();
    }
  }

  function onError(e) {
    if (!isOpen || !q) return;
    var it = cur(), c = e.data;
    // Lỗi 153 do môi trường TV (không phải do phim) -> không ẩn phim
    if (c === 100 || c === 101 || c === 150) w.Store.block(it.id);
    if ((c === 153 || c === 'host') && !isWeb) {
      msg(c === 'host'
        ? 'Không mở được trang phát video: ' + hostUrl() + ' — kiểm tra địa chỉ PLAYER_HOST và GitHub Pages.'
        : useHost()
          ? 'Lỗi 153 dù đã dùng trang phát ' + hostUrl() + '. Chụp màn hình này gửi lại để sửa.'
          : 'Chưa điền PLAYER_HOST (lỗi 153). Vào Cài đặt → PLAYER_HOST để nhập, hoặc làm theo mục “PLAYER_HOST” trong README.');
      clearTimeout(errT);
      errT = setTimeout(close, 8000);
      return;
    }
    var txt = c === 101 || c === 150 ? 'Chủ video không cho phát ngoài YouTube.' :
      c === 153 ? 'YouTube từ chối nhúng video này (lỗi 153).' :
      c === 100 ? 'Video đã bị xóa hoặc ẩn.' : 'Không phát được video (mã ' + c + ').';
    var hasNext = q.index < q.items.length - 1;
    msg(txt + (hasNext ? ' Chuyển sang tập sau…' : ' Quay lại sau vài giây…'));
    clearTimeout(errT);
    errT = setTimeout(function () { if (hasNext) play(q.index + 1); else close(); }, 3000);
  }

  function tick() {
    if (!yt || !yt.getCurrentTime || !isOpen) return;
    var c = 0, du = 0;
    try { c = yt.getCurrentTime() || 0; du = yt.getDuration() || 0; } catch (x) { return; }
    if (!du || scrubbing) return;
    var pct = Math.min(100, c / du * 100);
    $('pl-fill').style.width = pct + '%';
    $('pl-knob').style.left = pct + '%';
    $('pl-cur').textContent = w.UI.fmtDur(c);
    $('pl-dur').textContent = w.UI.fmtDur(du);
    var now = Date.now();
    if (playing && c > 3 && now - lastSave > 5000) {
      lastSave = now;
      w.Store.setProgress(cur().id, c, du);
    }
  }

  function saveNow() {
    if (!yt || !yt.getCurrentTime) return;
    try {
      var c = yt.getCurrentTime() || 0, du = yt.getDuration() || 0;
      if (du && c > 3) w.Store.setProgress(cur().id, c, du);
    } catch (x) { /* bỏ qua */ }
  }

  function seek(delta) {
    if (!yt || !yt.seekTo) return;
    var now = Date.now();
    seekN = now - seekAt < 600 ? seekN + 1 : 1;
    seekAt = now;
    var step = seekN > 4 ? 30 : 10;
    try {
      var t = Math.max(0, (yt.getCurrentTime() || 0) + delta * step);
      var du = yt.getDuration() || 0;
      if (du) t = Math.min(du - 1, t);
      yt.seekTo(t, true);
    } catch (x) { /* bỏ qua */ }
    showUi();
  }

  function toggle() {
    if (!yt || !yt.getPlayerState) return;
    try {
      if (yt.getPlayerState() === w.YT.PlayerState.PLAYING) yt.pauseVideo(); else yt.playVideo();
    } catch (x) { /* bỏ qua */ }
    showUi();
  }

  function close() {
    if (!isOpen) return;
    saveNow();
    isOpen = false;
    demoHint = false;
    playing = false;
    clearInterval(tickT); clearTimeout(hideT); clearTimeout(errT);
    try { if (yt && yt.stopVideo) yt.stopVideo(); } catch (x) { /* bỏ qua */ }
    if (yt && yt instanceof HostPlayer) { yt.destroy(); yt = null; }
    $('player').classList.add('hidden');
    var cb = q && q.onClose;
    q = null;
    if (cb) cb();
  }

  function press(id) {
    if (id === 'play') toggle();
    else if (id === 'back') seek(-1);
    else if (id === 'fwd') seek(1);
    else if (id === 'prev') { if (q.index > 0) play(q.index - 1); }
    else if (id === 'next') { if (q.index < q.items.length - 1) play(q.index + 1); }
    else if (id === 'cc') { w.Store.setPref('cc', !ccOn()); applyCaptions(true); }
    else if (id === 'quality') { openMenu(); }
    else if (id === 'rotate') { setRot((rotOf() + 90) % 360); }
    else if (id === 'skip') { skipVideo(); }
  }

  /* Trả về true nếu đã xử lý phím */
  function key(k) {
    if (!isOpen) return false;
    if (demoHint && k === 13) {       // chưa có API key: đi thẳng tới Cài đặt để nhập
      demoHint = false;
      close();
      if (w.Screens && w.Screens.goTab) w.Screens.goTab('settings');
      return true;
    }
    var ui = $('pl-ui').classList.contains('show');
    if (mode === 'menu') {
      if (k === 38 || k === 40) {
        menuIdx = Math.max(0, Math.min(QUALITIES.length - 1, menuIdx + (k === 40 ? 1 : -1)));
        renderMenu(); showUi();
      } else if (k === 13) {
        w.Store.setPref('quality', QUALITIES[menuIdx].id);
        closeMenu();
        applyQuality(true);
      } else if (k === 10009 || k === 27 || k === 8 || k === 37 || k === 39) {
        closeMenu();
      }
      return true;
    }
    switch (k) {
      case 10009: case 27: case 8: case 413:   // Back, Esc, Backspace, Stop
        close(); return true;
      case 415: case 10252: toggle(); return true;
      case 19: if (yt && yt.pauseVideo) { yt.pauseVideo(); showUi(); } return true;
      case 417: seek(1); return true;
      case 412: seek(-1); return true;
      case 38:   // lên: hiện nút điều khiển. Bấm ▲ 2 lần liên tục (dưới 0,5 giây): bật/tắt phụ đề tiếng Việt
        if (Date.now() - upAt < 500) {
          upAt = 0;
          w.Store.setPref('cc', !ccOn());
          if (yt && yt.loadModule) applyCaptions(true);
          else w.UI.toast(ccOn() ? 'Phụ đề tiếng Việt: Bật' : 'Đã tắt phụ đề');
          mode = 'seek'; renderBtns(); showUi();
          return true;
        }
        upAt = Date.now();
        showUi();
        if (mode === 'seek') { mode = 'btn'; btnIdx = -1; renderBtns(); }
        return true;
      case 40:
        showUi();
        if (mode === 'btn') { mode = 'seek'; renderBtns(); }
        return true;
      case 37: case 39:
        if (mode === 'btn') {
          btnIdx = Math.max(0, Math.min(btns.length - 1, btnIdx + (k === 39 ? 1 : -1)));
          renderBtns(); showUi();
        } else seek(k === 39 ? 1 : -1);
        return true;
      case 13:
        if (mode === 'btn') { press(btns[btnIdx].id); if (mode === 'btn') renderBtns(); showUi(); }
        else if (!ui) { toggle(); }
        else toggle();
        return true;
    }
    return true;   // nuốt mọi phím khác khi đang xem
  }

  function open(opts) {
    q = {
      items: opts.items, index: opts.index || 0, heading: opts.heading, key: opts.key,
      series: opts.series, onClose: opts.onClose, fromStart: !!opts.fromStart
    };
    isOpen = true;
    lastSave = 0;
    btnIdx = -1;
    $('player').classList.remove('hidden');
    clearInterval(tickT);
    tickT = setInterval(tick, 500);
    play(q.index);
  }

  /* ---------- Kéo thanh tua bằng ngón tay / chuột ---------- */
  (function () {
    var track = d.querySelector('.pl-track');
    if (!track) return;
    var pending = 0;
    function frac(e) {
      var r = track.getBoundingClientRect();   // tính theo toạ độ thật trên màn hình nên đúng cả khi app bị co giãn
      return Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
    }
    function paint(f) {
      var du = 0;
      try { du = yt && yt.getDuration ? yt.getDuration() : 0; } catch (x) { /* bỏ qua */ }
      $('pl-fill').style.width = f * 100 + '%';
      $('pl-knob').style.left = f * 100 + '%';
      if (du) $('pl-cur').textContent = w.UI.fmtDur(f * du);
      return du;
    }
    track.addEventListener('pointerdown', function (e) {
      if (!isOpen || !yt) return;
      e.preventDefault(); e.stopPropagation();
      scrubbing = true;
      try { track.setPointerCapture(e.pointerId); } catch (x) { /* bỏ qua */ }
      pending = frac(e); paint(pending); showUi();
    });
    track.addEventListener('pointermove', function (e) {
      if (!scrubbing) return;
      e.preventDefault();
      pending = frac(e); paint(pending); showUi();
    });
    function end(e) {
      if (!scrubbing) return;
      scrubbing = false;
      try { track.releasePointerCapture(e.pointerId); } catch (x) { /* bỏ qua */ }
      var du = paint(pending);
      if (du && yt && yt.seekTo) { try { yt.seekTo(Math.min(du - 1, pending * du), true); } catch (x) { /* bỏ qua */ } }
      showUi();
    }
    track.addEventListener('pointerup', end);
    track.addEventListener('pointercancel', end);
    // chạm vào thanh không được làm hiện / ẩn nút hay tạm dừng
    ['click', 'touchstart', 'mousedown'].forEach(function (n) { track.addEventListener(n, function (e) { e.stopPropagation(); }); });
  })();

  w.Player = {
    inMenu: function () { return mode === 'menu'; },
    clickBtn: function (i) { if (!btns[i]) return; mode = 'btn'; btnIdx = i; press(btns[i].id); if (mode === 'btn') renderBtns(); showUi(); },
    playMode: function () { return srcMode() === 'host' ? 'Qua ' + hostUrl() : srcMode() === 'direct' ? 'Trực tiếp (chưa có PLAYER_HOST)' : 'Trực tiếp'; }, open: open, key: key, isOpen: function () { return isOpen; }, close: close };
})(window);
