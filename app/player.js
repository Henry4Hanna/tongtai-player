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
  // 2.39: ◀ 2 lần nhanh = xem lại có phụ đề tạm; giữ ◀/▶ = dải ảnh tua nhanh
  var tmpCC = null, tmpCCT = 0, arrK = 0, arrAt = 0, arrN = 0, arrOrigin = 0, leftTapAt = 0, strip = null;
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
  var qManual = false;   // 2.38: người xem tự chọn chất lượng cho phim này thì không tiết kiệm dữ liệu nữa
  function qPref() {
    var p = w.Store.pref('quality', (w.DEVICE && w.DEVICE.is4k) ? 'hd2160' : 'auto');
    if (!qManual && w.DataSaver && w.DataSaver.on()) { var s = w.DataSaver.q(), H = { hd2160: 5, hd1080: 4, hd720: 3, large: 2, medium: 1 }; if (p === 'auto' || (H[p] || 0) > H[s]) return s; }
    return p;
  }
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
      if (!ccOn() && !tmpCC) {
        ccInfo = '';
        try { yt.setOption('captions', 'track', {}); } catch (x) { /* bỏ qua */ }
        yt.unloadModule('captions');
        if (tell) w.UI.toast('Đã tắt phụ đề');
        renderLabel();
        return;
      }
      yt.loadModule('captions');
      try { yt.setOption('captions', 'reload', true); } catch (x) { /* bỏ qua */ }
      if (d.documentElement.classList.contains('elder')) { try { yt.setOption('captions', 'fontSize', 3); } catch (x) { /* bỏ qua */ } }   // 2.43: chữ phụ đề to nhất
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
    var iosFix = mob();   // 2.46.7: iPhone tự nới khung YouTube theo nội dung (phim lệch phải, mất mép) -> width 1px + min-width
    if (!H || w.AndroidApp) {                        // Tự động (hoặc TV Android: video phần cứng không chịu phóng/thu -> bị cắt, nên không dùng mẹo này)
      ['width', 'height', 'transform', '-webkit-transform', 'transform-origin', 'min-width', 'max-width'].forEach(function (k) { fr.style.removeProperty(k); });
      if (iosFix) { set('width', '1px'); set('min-width', '100%'); set('max-width', '100%'); }
      return;
    }
    var hw = host.offsetWidth, hh = host.offsetHeight, r = host.getBoundingClientRect();
    var devH = r.height * (w.devicePixelRatio || 1);   // chiều cao thật của khung, tính bằng điểm ảnh màn hình
    if (!hw || !hh || !devH) return;
    var f = Math.max(0.15, Math.min(3, H / devH));
    if (iosFix) { set('width', '1px'); set('min-width', Math.round(hw * f) + 'px'); set('max-width', Math.round(hw * f) + 'px'); }
    else set('width', Math.round(hw * f) + 'px');
    set('height', Math.round(hh * f) + 'px');
    set('transform-origin', '0 0');
    set('transform', 'scale(' + (1 / f) + ')');
    set('-webkit-transform', 'scale(' + (1 / f) + ')');
  }

  /* 2.46.2: iPhone xoay máy: khung phim đúng bằng vùng thấy được (không lệch, không bị cắt), nút Đóng bấm được */
  function fitBox() {
    var p = $('player');
    if (!p || !mob()) return;
    try { if (w.scrollX || w.scrollY) w.scrollTo(0, 0); d.documentElement.scrollLeft = d.body.scrollLeft = 0; } catch (x) { /* bỏ qua */ }
    if (!isOpen || mini) { p.style.width = p.style.height = ''; setTimeout(alignFrame, 200); return; }
    var vv = w.visualViewport, W = Math.round((vv && vv.width) || w.innerWidth), H = Math.round((vv && vv.height) || w.innerHeight);
    if (W && H) { p.style.width = W + 'px'; p.style.height = H + 'px'; }
    sizeForQuality(); setTimeout(alignFrame, 200);
    var bk = d.getElementById('webback');   // vẽ lại nút để iPhone nhận cú chạm đúng chỗ mới
    if (bk) { var dsp = bk.style.display; bk.style.display = 'none'; void bk.offsetWidth; bk.style.display = dsp; }
  }
  /* 2.47.8: iPhone hay tự nới khung YouTube rộng hơn khung của app (phim lệch, mất mép, nhất là khung nhỏ khi xoay ngang).
     Đo khung thật: rộng hơn bao nhiêu thì dời sang trái một nửa để phim nằm giữa; ghi vào Nhật ký để dò lỗi */
  var alignLast = '';
  function alignFrame() {
    try {
      if (!isOpen || !mob()) return;
      var host = $('yt-host'), fr = host && host.querySelector('iframe'); if (!fr) return;
      if (fr.getAttribute('scrolling') !== 'no') fr.setAttribute('scrolling', 'no');
      var hr = host.getBoundingClientRect(), r = fr.getBoundingClientRect();
      var extra = Math.round(r.width - hr.width);
      if (extra > 2) fr.style.setProperty('left', -Math.round(extra / 2 / ((r.width / (fr.offsetWidth || r.width)) || 1)) + 'px', 'important');
      else fr.style.removeProperty('left');
      var info = (mini ? 'nhỏ' : 'lớn') + ' ' + (w.innerWidth > w.innerHeight ? 'ngang' : 'dọc') + ' · khung ' + Math.round(hr.width) + ' · YouTube ' + Math.round(r.width) + ' · lệch ' + Math.round(r.left - hr.left) + (extra > 2 ? ' · đã bù ' + Math.round(extra / 2) : '');
      if (info !== alignLast) { alignLast = info; if (w.Log) w.Log.info('Khung phim: ' + info); }
    } catch (e) { /* bỏ qua */ }
  }
  setInterval(alignFrame, 1500);
  (function () {
    var t = [];
    function later() { t.forEach(clearTimeout); t = [60, 350, 900].map(function (ms) { return setTimeout(fitBox, ms); }); fitBox(); }
    w.addEventListener('resize', later);
    w.addEventListener('orientationchange', later);
    if (w.visualViewport) w.visualViewport.addEventListener('resize', later);
  })();

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
    frame.style.cssText = opts.small ? 'width:100%;height:100%;border:0;background:#000' : 'width:1920px;height:1080px;border:0;background:#000';
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
    ['playVideo', 'pauseVideo', 'stopVideo', 'seekTo', 'loadVideoById', 'loadModule', 'unloadModule', 'setOption', 'setPlaybackQuality', 'setVolume', 'mute', 'unMute']
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
    var favOn = w.Store.isFav(q.series || cur());
    btns.push({ id: 'fav', label: favOn ? 'Đã lưu' : 'Danh sách', on: favOn, svg: favOn ? '<path d="M5 12.5l4.5 4.5L19 7.5"/>' : '<path d="M12 5v14M5 12h14"/>' });
    btns.push({ id: 'skip', label: 'Bỏ phim', svg: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>' });
    btns.push({ id: 'cc', wide: !w.UI.isMobile(), label: w.UI.isMobile() ? (ccOn() ? (ccInfo === 'dich' ? 'Việt (dịch)' : 'Tiếng Việt') : 'Tắt phụ đề') : ccOn() ? (ccInfo === 'dich' ? 'Phụ đề: Việt (dịch)' : 'Phụ đề: Tiếng Việt') : 'Phụ đề: Tắt', on: ccOn(), svg: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 10.2a2.4 2.4 0 1 0 0 3.6M17 10.2a2.4 2.4 0 1 0 0 3.6"/>' });
    if (w.QR && sendUrl()) {
      if (w.UI.isMobile()) btns.push({ id: 'send', label: 'Mã QR', svg: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3M14 21h2"/>' });
      else btns.push({ id: 'send', wide: true, label: 'Gửi sang điện thoại', svg: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>' });
    }
    btns.push({ id: 'sleep', wide: true, label: sleepLabel(), on: sleep.mode !== 'off', svg: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2.5h6"/>' });
    var nowQ = qNow();
    btns.push({ id: 'quality', wide: !w.UI.isMobile(), label: w.UI.isMobile() ? 'Chất lượng' : 'Chất lượng: ' + (qPref() === 'auto' && nowQ ? 'Tự động (' + nowQ + ')' : qLabel(qPref())), svg: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>' });
    if (d.documentElement.classList.contains('elder')) {   // 2.43: chế độ ông bà: ít nút, chữ rõ
      var EL = { prev: 'Tập trước', back: 'Lùi 10 giây', play: playing ? 'Dừng' : 'Phát', fwd: 'Tới 10 giây', next: 'Tập sau', cc: ccOn() ? 'Phụ đề: Bật' : 'Phụ đề: Tắt', sleep: sleepLabel().replace('Hẹn giờ: Tắt', 'Hẹn giờ tắt') };
      btns = btns.filter(function (b) { return EL[b.id]; });
      btns.forEach(function (b) { b.label = EL[b.id]; b.wide = true; });
    }
    var pi = 0;
    btns.forEach(function (b, i) { if (b.id === 'play') pi = i; });
    if (btnIdx >= btns.length || btnIdx < 0) btnIdx = pi;
    btns.forEach(function (b, i) {
      var e = d.createElement('div');
      e._idx = i;
      e.className = 'plb' + (b.id === 'play' ? ' big' : '') + (b.id === 'sleep' ? ' sleepb' : '') + (b.wide ? ' wide' : '') + (b.on ? ' on' : '') +
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
    if (q.startAt != null && q.index === q.startIdx) { var sa = q.startAt; q.startAt = null; return sa; }
    if (q.fromStart) return 0;
    if (p && p.p > 15 && p.d && p.p < p.d - 20) return p.p;
    return 0;
  }

  function play(i) {
    hideUp(); tmpCC = null; if (strip) { strip = null; paintStrip(); }
    if (audOn) setTimeout(function () { if (audOn) audioOnly(true); }, 60);   // 2.40: đổi tập vẫn giữ Chỉ nghe tiếng
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
      if (!ok) {
        msg('Không tải được trình phát YouTube.\nKiểm tra mạng (Wi-Fi hoặc dây mạng) rồi mở lại phim.');
        if (w.Log) w.Log.err('Không tải được trình phát YouTube (mạng?)');
        errT = setTimeout(close, 5000); return;
      }
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
      ended();
    }
  }

  function onError(e) {
    if (!isOpen || !q) return;
    var it = cur(), c = e.data;
    try { if (w.Tele && w.Tele.perr) w.Tele.perr(it, c); } catch (e2) { /* bỏ qua */ }
    // Lỗi 153 do môi trường TV (không phải do phim) -> không ẩn phim
    if (c === 100 || c === 101 || c === 150) w.Store.block(it.id);
    if ((c === 153 || c === 'host') && !isWeb) {
      if (w.Log) w.Log.err(c === 'host' ? 'Không mở được trang phát PLAYER_HOST: ' + hostUrl() : 'Lỗi 153 khi phát ' + it.id + (useHost() ? ' qua ' + hostUrl() : ' (chưa có PLAYER_HOST)'));
      msg(c === 'host'
        ? 'Không mở được trang phát video: ' + hostUrl() + ' — kiểm tra địa chỉ PLAYER_HOST và GitHub Pages.'
        : useHost()
          ? 'Lỗi 153 dù đã dùng trang phát ' + hostUrl() + '. Chụp màn hình này gửi lại để sửa.'
          : 'Chưa điền PLAYER_HOST (lỗi 153). Vào Cài đặt → PLAYER_HOST để nhập, hoặc làm theo mục “PLAYER_HOST” trong README.');
      clearTimeout(errT);
      errT = setTimeout(close, 8000);
      return;
    }
    var txt = c === 101 || c === 150 ? 'Chủ video không cho phát ngoài YouTube nên app đã ẩn phim này.' :
      c === 153 ? 'YouTube từ chối nhúng video này (lỗi 153).' :
      c === 100 ? 'Video đã bị xóa hoặc chuyển sang riêng tư nên app đã ẩn phim này.' :
      c === 5 ? 'Trình phát của thiết bị không chạy được video này (lỗi 5).' :
      c === 2 ? 'Mã video không hợp lệ (lỗi 2).' : 'Không phát được video (mã ' + c + '). Thử lại sau.';
    if (w.Log) w.Log.err('Phát phim “' + (it.title || it.id) + '” (' + it.id + '): ' + txt);
    var hasNext = q.index < q.items.length - 1;
    msg(txt + (hasNext ? ' Chuyển sang tập sau…' : ' Quay lại sau vài giây…'));
    clearTimeout(errT);
    errT = setTimeout(function () { if (hasNext) play(q.index + 1); else close(); }, 3000);
  }

  /* Thống kê xem: cộng thời gian ĐANG PHÁT thật (không tính lúc tạm dừng, tải, quảng cáo chưa chạy) */
  var watchAcc = 0, watchAt = 0, watchFlushAt = 0;
  function countWatch() {
    var now = Date.now();
    if (playing && watchAt && !sleepHold && !up) watchAcc += Math.min(2, (now - watchAt) / 1000);
    watchAt = now;
    if (watchAcc >= 15 || (watchAcc > 0 && now - watchFlushAt > 30000)) flushWatch();
  }
  function flushWatch() {
    watchFlushAt = Date.now();
    if (watchAcc <= 0 || !q) { watchAcc = 0; return; }
    var s = q.series || cur();
    w.Store.addWatch(watchAcc, s.ch || (cur() && cur().ch) || '');
    if (w.Tele) {   // trang quản trị: phim đang xem, thời gian xem, đã xem tới đâu
      var e = cur() || {}, pos = 0, du = 0;
      try { pos = yt && yt.getCurrentTime ? yt.getCurrentTime() || 0 : 0; du = yt && yt.getDuration ? yt.getDuration() || 0 : 0; } catch (x) { /* bỏ qua */ }
      w.Tele.watch(watchAcc, { id: e.id || s.id, title: s.title || e.title, ch: s.ch || e.ch }, pos, du);
    }
    watchAcc = 0;
  }

  function tick() {
    if (mini) paintMini();
    checkSleep();
    countWatch();
    checkStill();
    if (!yt || !yt.getCurrentTime || !isOpen) return;
    var c = 0, du = 0;
    try { c = yt.getCurrentTime() || 0; du = yt.getDuration() || 0; } catch (x) { return; }
    if (tmpCC && c > tmpCC.until + 1) { tmpCC = null; if (!ccOn()) applyCaptions(false); }   // qua đoạn vừa tua lại: tắt phụ đề tạm
    if (!du || scrubbing) return;
    var pct = Math.min(100, c / du * 100);
    $('pl-fill').style.width = pct + '%';
    $('pl-knob').style.left = pct + '%';
    var eld = d.documentElement.classList.contains('elder');   // 2.43: chế độ ông bà: ghi rõ "Còn 18 phút"
    $('pl-cur').textContent = eld ? Math.floor(c / 60) + ' phút' : w.UI.fmtDur(c);
    $('pl-dur').textContent = eld ? 'Còn ' + w.UI.fmtLong(du - c) : w.UI.fmtDur(du);
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

  /* 2.40: Chỉ nghe tiếng (chế độ xe): che hình, nút lớn */
  var audOn = false;
  function audioOnly(on) {
    audOn = !!on;
    var b = $('pl-aud');
    if (!audOn) { if (b) b.parentNode.removeChild(b); return; }
    if (!b) { b = d.createElement('div'); b.id = 'pl-aud'; $('player').appendChild(b); }
    var it = cur() || {};
    b.innerHTML = '<div class="pla-k">🎧 CHỈ NGHE TIẾNG</div><div class="pla-t"></div><div class="pla-s"></div>' +
      '<div class="pla-b"><div class="pla-x" data-a="rw">⏪ 10</div><div class="pla-x big" data-a="pp">⏯</div><div class="pla-x" data-a="ff">10 ⏩</div></div>' +
      '<div class="pla-row"><div class="pla-y" data-a="show">Hiện hình</div><div class="pla-y" data-a="close">✕ Đóng</div></div>';
    b.querySelector('.pla-t').textContent = (q && q.heading) || it.title || '';
    b.querySelector('.pla-s').textContent = it.ep ? 'Tập ' + it.ep : (it.ch || '');
    b.onclick = function (e) {
      e.stopPropagation();
      var a = e.target && e.target.getAttribute ? e.target.getAttribute('data-a') : '';
      if (a === 'pp') toggle();
      else if (a === 'rw' || a === 'ff') { try { yt.seekTo(Math.max(0, curT() + (a === 'ff' ? 10 : -10)), true); } catch (x) { /* bỏ qua */ } }
      else if (a === 'show') audioOnly(false);
      else if (a === 'close') close();
    };
  }
  function curT() { try { return yt.getCurrentTime() || 0; } catch (x) { return 0; } }
  function tempCC(origin) {
    if (ccOn() || !yt || !yt.loadModule) { w.UI.toast('⟲ Xem lại 10 giây'); return; }
    tmpCC = { until: origin };
    applyCaptions(false);
    w.UI.toast(ccInfo ? '⟲ Xem lại 10 giây · bật phụ đề tạm' : '⟲ Xem lại 10 giây (phim này không có phụ đề)');
  }
  /* Dải ảnh tua nhanh: mốc 10 phút (phim ngắn chia 6 mốc). YouTube chỉ có 3 ảnh tự động mỗi video (¼, ½, ¾) */
  function stripImg(t, du) {
    var it = cur() || {}, f = du ? t / du : 0;
    if (f < 0.125 || !/^[\w-]{11}$/.test(it.id || '')) return it.hero || it.thumb || '';
    return 'https://i.ytimg.com/vi/' + it.id + '/hq' + (f < 0.375 ? 1 : f < 0.625 ? 2 : 3) + '.jpg';
  }
  function openStrip(dir) {
    var du = 0; try { du = yt.getDuration() || 0; } catch (x) { /* bỏ qua */ }
    if (!du || du < 60) return false;
    var step = du > 1800 ? 600 : du > 360 ? Math.max(60, Math.round(du / 6 / 60) * 60) : 30, marks = [];
    for (var t = 0; t < du - 5; t += step) marks.push(t);
    var o = arrOrigin, idx = 0;
    if (dir > 0) { idx = marks.length - 1; for (var i = 0; i < marks.length; i++) if (marks[i] > o + 2) { idx = i; break; } }
    else { for (var j = marks.length - 1; j >= 0; j--) if (marks[j] < o - 2) { idx = j; break; } }
    try { yt.seekTo(o, true); } catch (x) { /* bỏ qua */ }
    clearTimeout(tmpCCT);
    strip = { marks: marks, idx: idx, du: du, at: 0 };
    $('pl-ui').classList.remove('show');   // ẩn thanh điều khiển cho khỏi chồng lên dải ảnh
    paintStrip();
    return true;
  }
  function paintStrip() {
    var b = $('pl-strip');
    if (!b) { b = d.createElement('div'); b.id = 'pl-strip'; $('player').appendChild(b); }
    if (!strip) { b.className = 'hidden'; b.innerHTML = ''; return; }
    b.className = '';
    var row = d.createElement('div'); row.className = 'stp-row';
    for (var k = strip.idx - 2; k <= strip.idx + 2; k++) {
      var c = d.createElement('div');
      if (k < 0 || k >= strip.marks.length) { c.className = 'stp-c empty'; row.appendChild(c); continue; }
      c.className = 'stp-c' + (k === strip.idx ? ' on' : '');
      var im = d.createElement('div'); im.className = 'stp-im'; im.style.backgroundImage = 'url("' + stripImg(strip.marks[k], strip.du) + '")';
      var lb = d.createElement('div'); lb.className = 'stp-t'; lb.textContent = w.UI.fmtDur(strip.marks[k]);
      c.appendChild(im); c.appendChild(lb); row.appendChild(c);
    }
    var bar = d.createElement('div'); bar.className = 'stp-bar';
    var fl = d.createElement('i'); fl.style.width = Math.round(strip.marks[strip.idx] / strip.du * 100) + '%'; bar.appendChild(fl);
    var hint = d.createElement('div'); hint.className = 'stp-h'; hint.textContent = '◀ ▶ chọn mốc · OK để tới · Quay lại để hủy';
    b.innerHTML = ''; b.appendChild(row); b.appendChild(bar); b.appendChild(hint);
  }
  function stripKey(k) {
    if (k === 37 || k === 39 || k === 412 || k === 417) {
      var now = Date.now(); if (now - strip.at < 170) return true;   // giữ phím: chạy từng mốc, không vọt
      strip.at = now;
      strip.idx = Math.max(0, Math.min(strip.marks.length - 1, strip.idx + (k === 39 || k === 417 ? 1 : -1)));
      paintStrip(); return true;
    }
    if (k === 13) { var t = strip.marks[strip.idx]; strip = null; paintStrip(); try { yt.seekTo(t, true); } catch (x) { /* bỏ qua */ } showUi(); return true; }
    if (k === 10009 || k === 27 || k === 8 || k === 413 || k === 38 || k === 40) { strip = null; paintStrip(); showUi(); return true; }
    return true;
  }
  function arrow(k) {   // ◀ ▶ khi đang xem
    var now = Date.now();
    if (k === arrK && now - arrAt < 260) arrN++; else { arrN = 1; arrOrigin = curT(); }
    arrK = k; arrAt = now;
    if (arrN >= 3 && openStrip(k === 39 ? 1 : -1)) return;   // giữ phím (phím tự lặp): mở dải ảnh
    if (k === 37 && arrN === 1) {
      if (leftTapAt && now - leftTapAt < 550) {   // ◀ lần 2: xem lại có phụ đề (đợi chút, nếu là giữ phím thì thôi)
        leftTapAt = 0; var org = arrOrigin + 10;
        clearTimeout(tmpCCT); tmpCCT = setTimeout(function () { if (!strip && isOpen) tempCC(org); }, 320);
      } else leftTapAt = now;
    }
    seek(k === 39 ? 1 : -1);
  }

  function toggle() {
    if (!yt || !yt.getPlayerState) return;
    try {
      if (yt.getPlayerState() === w.YT.PlayerState.PLAYING) yt.pauseVideo(); else yt.playVideo();
    } catch (x) { /* bỏ qua */ }
    showUi();
  }

  /* ---------- Hẹn giờ tắt: 30 / 60 / 90 phút hoặc hết phim này ----------
     Hẹn giờ tính cho cả lượt xem (kể cả khi tự phát phim tiếp theo), không lưu khi tắt app. */
  var sleep = { mode: 'off', at: 0, warned: false }, sleepHold = false, sleepCloseT = 0;
  var SLEEP_STEPS = ['off', 15, 30, 60, 90, 'end', 'end2'];
  var sleepVol = -1;   // âm lượng trước khi nhỏ dần (để trả lại)
  function sleepLabel() {
    if (sleep.mode === 'end2') return 'Hẹn giờ: Hết 2 tập';
    if (sleep.mode === 'end') return 'Hẹn giờ: Hết phim';
    if (sleep.mode === 't') return 'Hẹn giờ: ' + Math.max(1, Math.ceil((sleep.at - Date.now()) / 60000)) + ' phút';
    return 'Hẹn giờ: Tắt';
  }
  function setSleep(v) {
    sleep.warned = false;
    if (v === 'off') { sleep.mode = 'off'; sleep.at = 0; }
    else if (v === 'end' || v === 'end2') { sleep.mode = v; sleep.at = 0; }
    else { sleep.mode = 't'; sleep.at = Date.now() + v * 60000; sleep.mins = v; }
  }
  function cycleSleep() {
    var curV = sleep.mode === 'end' || sleep.mode === 'end2' ? sleep.mode : sleep.mode === 't' ? sleep.mins : 'off';
    var i = SLEEP_STEPS.indexOf(curV), nx = SLEEP_STEPS[(i + 1) % SLEEP_STEPS.length];
    setSleep(nx); volBack(); paintSleepBadge();
    w.UI.toast(nx === 'off' ? 'Đã tắt hẹn giờ' : nx === 'end' ? 'Sẽ dừng khi hết tập này' : nx === 'end2' ? 'Sẽ dừng khi hết 2 tập (tập này và tập sau)' : 'Sẽ tạm dừng phim sau ' + nx + ' phút');
  }
  // 2.38: nhỏ tiếng dần 30 giây cuối + đồng hồ ở góc
  function volBack() { if (sleepVol >= 0) { try { yt.setVolume(sleepVol); } catch (x) { /* bỏ qua */ } sleepVol = -1; } }
  function volFade(leftMs) {
    if (!yt || !yt.setVolume) return;
    try { if (sleepVol < 0) sleepVol = yt.getVolume ? yt.getVolume() : 100; yt.setVolume(Math.max(3, Math.round(sleepVol * Math.max(0, leftMs) / 30000))); } catch (x) { /* bỏ qua */ }
  }
  function paintSleepBadge() {
    var b = $('pl-sleepbadge');
    if (!b) { b = d.createElement('div'); b.id = 'pl-sleepbadge'; var pl = $('player'); if (!pl) return; pl.appendChild(b); }
    if (sleep.mode === 'off' || !isOpen || sleepHold) { b.className = 'hidden'; return; }
    var t;
    if (sleep.mode === 't') { var s = Math.max(0, Math.round((sleep.at - Date.now()) / 1000)); t = 'Tắt sau ' + Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
    else t = sleep.mode === 'end2' ? 'Hết 2 tập' : 'Hết tập này';
    b.className = ''; b.textContent = '🌙 ' + t;
  }
  function checkSleep() {
    paintSleepBadge();
    if (sleep.mode === 'end' && isOpen && yt && yt.getDuration) {   // hết tập này: nhỏ dần 30 giây cuối phim
      try { var du = yt.getDuration(), po = yt.getCurrentTime(); if (du > 60 && du - po <= 30) volFade((du - po) * 1000); } catch (x) { /* bỏ qua */ }
    }
    if (sleep.mode !== 't') return;
    var left = sleep.at - Date.now();
    if (left <= 30000 && left > 0 && isOpen) volFade(left);
    if (!isOpen) { if (left <= 0) setSleep('off'); return; }
    if (left <= 60000 && left > 0 && !sleep.warned) { sleep.warned = true; w.UI.toast('Còn 1 phút nữa phim sẽ tạm dừng (hẹn giờ)'); }
    if (left > 0) { if (mode === 'btn' && $('pl-ui').classList.contains('show')) { var b = d.querySelector('.plb.sleepb span'); if (b) b.textContent = sleepLabel(); } return; }
    setSleep('off');
    hideUp();
    try { if (yt && yt.pauseVideo) yt.pauseVideo(); } catch (x) { /* bỏ qua */ }
    volBack();
    saveNow();
    sleepHold = true; paintSleepBadge();
    msg('🌙 Đã tắt phim theo hẹn giờ.\nBấm OK để xem tiếp đúng chỗ này, Back để thoát.');
    if (w.Log) w.Log.info('Hẹn giờ: đã tạm dừng phim');
    clearTimeout(sleepCloseT);
    // 15 phút không ai bấm: đóng hẳn trình phát cho TV được nghỉ
    sleepCloseT = setTimeout(function () { if (sleepHold && isOpen) { sleepHold = false; close(); } }, 15 * 60e3);
  }

  /* ---------- Hết phim: đếm ngược 30 giây rồi tự phát phim/tập tiếp theo ---------- */
  var UP_SECS = 30, up = null;
  function upSecs() { return mob() ? UP_SECS : 10; }   // 2.39: TV đếm 10 giây trên màn hình lớn   // up = { t: đích, left, idx (0 Phát ngay, 1 Hủy), timer }
  function nextTarget() {
    if (q.index < q.items.length - 1) return Promise.resolve({ ep: true, index: q.index + 1, item: q.items[q.index + 1] });
    if (!q.next) return Promise.resolve(null);
    return Promise.resolve().then(function () { return q.next(q.series || cur()); }).then(function (it) { return it ? { item: it } : null; }, function () { return null; });
  }
  function ended() {
    if (sleep.mode === 'end2') { sleep.mode = 'end'; w.UI.toast('🌙 Hẹn giờ: dừng khi hết tập này'); }   // còn 1 tập: chạy tiếp như thường
    else if (sleep.mode === 'end') {   // hẹn giờ "Hết phim này": dừng lại, không phát phim tiếp
      setSleep('off'); volBack();
      close();
      w.UI.toast('Đã dừng theo hẹn giờ. Chúc ngủ ngon!');
      if (w.Log) w.Log.info('Hẹn giờ: dừng khi hết phim');
      return;
    }
    if (!w.APP_CONFIG || w.APP_CONFIG.AUTO_NEXT === false) {   // tắt tự phát: như bản cũ
      if (q.index < q.items.length - 1) play(q.index + 1); else close();
      return;
    }
    var me = q;
    nextTarget().then(function (t) {
      if (!isOpen || q !== me) return;
      if (!t) { close(); return; }
      showUpNext(t);
    });
  }
  function upBox() {
    var b = $('pl-next');
    if (!b) { b = d.createElement('div'); b.id = 'pl-next'; b.className = 'hidden'; $('player').appendChild(b); }
    return b;
  }
  // 2.39: TV: màn hình "Tập tiếp" lớn
  function paintBig() {
    var b = upBox(), it = up.t.item, pv = up.prevEp;
    b.className = 'big';
    b.innerHTML = '';
    var bg = d.createElement('div'); bg.className = 'upb-bg'; bg.style.backgroundImage = 'url("' + (it.hero || it.thumb || '') + '")'; b.appendChild(bg);
    var box = d.createElement('div'); box.className = 'upb';
    if (up.prev) {   // đánh giá phim vừa xem
      var rt = d.createElement('div'); rt.className = 'upb-rate';
      var cr = w.Rates ? w.Rates.get(up.prev.id) : null;
      var rl = d.createElement('span'); rl.textContent = cr != null ? 'Đã lưu: ' + w.Rates.label(cr) : 'Bạn thấy phim vừa xem thế nào?'; rt.appendChild(rl);
      [['like', '❤ Thích'], ['meh', '😐 Bình thường'], ['dislike', '👎 Không thích']].forEach(function (x, i) {
        var e = d.createElement('div'), val = x[0] === 'like' ? 1 : x[0] === 'dislike' ? -1 : 0;
        e.className = 'upbtn rate sm' + (cr === val ? ' on' : '') + (up.row === 0 && i === up.ridx ? ' focus' : '');
        e.setAttribute('data-act', x[0]); e.textContent = x[1]; rt.appendChild(e);
      });
      box.appendChild(rt);
    }
    var hd = d.createElement('div'); hd.className = 'upb-h';
    if (up.t.ep) hd.innerHTML = 'Bạn vừa xem xong <b>' + (pv ? 'Tập ' + pv : 'tập này') + '</b>';
    else hd.innerHTML = up.seriesEnd ? 'Đã xem hết phim 🎉 <b>Phim gợi ý tiếp theo</b>' : 'Phim tiếp theo';
    box.appendChild(hd);
    var card = d.createElement('div'); card.className = 'upb-card'; card.style.backgroundImage = 'url("' + (it.hero || it.thumb || '') + '")';
    var lb = d.createElement('div'); lb.className = 'upb-lb';
    var k1 = d.createElement('div'); k1.className = 'upb-k'; k1.textContent = up.t.ep ? 'TẬP TIẾP THEO' : 'PHIM TIẾP THEO';
    var t1 = d.createElement('div'); t1.className = 'upb-t';
    t1.textContent = up.t.ep ? ((q.heading ? q.heading + ' · ' : '') + 'Tập ' + (it.ep || (up.t.index + 1))) : it.title;
    var s1 = d.createElement('div'); s1.className = 'upb-s';
    s1.textContent = up.t.ep ? (it.title && it.title !== q.heading ? it.title : '') : [it.ch, it.dur ? w.UI.fmtLong(it.dur) : ''].filter(Boolean).join(' · ');
    lb.appendChild(k1); lb.appendChild(t1); if (s1.textContent) lb.appendChild(s1);
    card.appendChild(lb);
    var tot = upSecs(), C = 119.4, off = C * (1 - (tot - up.left) / tot);
    var ring = d.createElement('div'); ring.className = 'upb-ring';
    ring.innerHTML = '<svg viewBox="0 0 44 44" width="110" height="110"><circle cx="22" cy="22" r="19" fill="rgba(0,0,0,.6)" stroke="rgba(255,255,255,.25)" stroke-width="4"/>' +
      '<circle cx="22" cy="22" r="19" fill="none" stroke="#E8B04B" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 22 22)"/>' +
      '<text x="22" y="28.5" text-anchor="middle" font-size="17" font-weight="800" fill="#fff">' + up.left + '</text></svg>';
    card.appendChild(ring);
    box.appendChild(card);
    var bx = d.createElement('div'); bx.className = 'upb-btns';
    [['play', '▶ Xem tiếp'], ['cancel', 'Thôi, để mai']].forEach(function (x, i) {
      var e = d.createElement('div');
      e.className = 'upbtn big' + (i === 0 ? ' gold' : '') + (up.row === 1 && i === up.idx ? ' focus' : '');
      e.setAttribute('data-act', x[0]); e.textContent = x[1]; bx.appendChild(e);
    });
    box.appendChild(bx);
    b.appendChild(box);
  }
  function paintUp() {
    if (!up) return;
    if (!mob()) { paintBig(); return; }
    var b = upBox(), it = up.t.item;
    b.className = '';
    b.innerHTML = '';
    var card = d.createElement('div'); card.className = 'upn';
    var th = w.UI.thumb(it, true); th.className = 'thumb upn-th';
    card.appendChild(th);
    var tx = d.createElement('div'); tx.className = 'upn-tx';
    var h = d.createElement('div'); h.className = 'upn-h';
    h.textContent = up.t.ep ? 'Tập tiếp theo' : 'Phim tiếp theo';
    var tt = d.createElement('div'); tt.className = 'upn-t';
    tt.textContent = up.t.ep ? 'Tập ' + (it.ep || (up.t.index + 1)) + (it.title ? ' · ' + it.title : '') : it.title;
    var sb = d.createElement('div'); sb.className = 'upn-s';
    sb.textContent = up.t.ep ? (q.heading || '') : [it.ch, it.dur ? w.UI.fmtLong(it.dur) : ''].filter(Boolean).join(' · ');
    var cd = d.createElement('div'); cd.className = 'upn-cd';
    cd.textContent = 'Tự phát sau ' + up.left + ' giây';
    var bar = d.createElement('div'); bar.className = 'upn-bar';
    var fill = d.createElement('div'); fill.className = 'upn-fill';
    fill.style.width = Math.round((upSecs() - up.left) / upSecs() * 100) + '%';
    bar.appendChild(fill);
    var bx = d.createElement('div'); bx.className = 'upn-btns';
    [['play', 'Phát ngay'], ['cancel', 'Hủy']].forEach(function (x, i) {
      var e = d.createElement('div');
      e.className = 'upbtn' + (i === 0 ? ' gold' : '') + (up.row === 1 && i === up.idx ? ' focus' : '');
      e.setAttribute('data-act', x[0]);
      e.textContent = x[1];
      bx.appendChild(e);
    });
    [h, tt, sb, cd, bar, bx].forEach(function (x) { tx.appendChild(x); });
    card.appendChild(tx);
    if (up.prev) {   // đánh giá phim vừa xem xong
      var rt = d.createElement('div'); rt.className = 'uprate';
      var rl = d.createElement('div'); rl.className = 'uprl';
      var cr = w.Rates ? w.Rates.get(up.prev.id) : null;
      rl.textContent = cr != null ? 'Đã lưu: ' + w.Rates.label(cr) + ' · ' + (up.prev.title || '') : 'Bạn thấy “' + (up.prev.title || 'phim vừa xem') + '” thế nào?';
      rt.appendChild(rl);
      var rb = d.createElement('div'); rb.className = 'uprb';
      [['like', '❤ Thích'], ['meh', '😐 Bình thường'], ['dislike', '👎 Không thích']].forEach(function (x, i) {
        var e = d.createElement('div');
        var val = x[0] === 'like' ? 1 : x[0] === 'dislike' ? -1 : 0;
        e.className = 'upbtn rate' + (cr === val ? ' on' : '') + (up.row === 0 && i === up.ridx ? ' focus' : '');
        e.setAttribute('data-act', x[0]);
        e.textContent = x[1];
        rb.appendChild(e);
      });
      rt.appendChild(rb);
      b.appendChild(rt);
    }
    b.appendChild(card);
    b.classList.remove('hidden');
  }
  function showUpNext(t) {
    hideUp();
    var pv = cur();
    up = { t: t, left: upSecs(), idx: 0, row: 1, ridx: 0, prev: pv && pv.kind !== 'ep' && w.Rates ? slim(q.series || pv) : null,
      prevEp: pv && (pv.ep || (q.items.length > 1 ? q.index + 1 : 0)), seriesEnd: !t.ep && q.items.length > 1 };
    msg('');
    $('pl-ui').classList.remove('show');
    paintUp();
    up.timer = setInterval(function () {
      if (!up) return;
      up.left -= 1;
      if (up.left <= 0) { upGo(); return; }
      paintUp();
    }, 1000);
  }
  function hideUp() {
    if (up && up.timer) clearInterval(up.timer);
    up = null;
    var b = $('pl-next');
    if (b) { b.classList.add('hidden'); b.innerHTML = ''; }
  }
  function upGo() {
    if (!up) return;
    flushWatch();
    var t = up.t;
    hideUp();
    if (t.ep) { play(t.index); return; }
    // phim lẻ tiếp theo: thay hàng đợi bằng phim mới, vẫn giữ cách chọn phim kế tiếp
    q.items = [t.item]; q.index = 0; q.series = t.item; q.heading = t.item.title; q.key = 'v:' + t.item.id; q.fromStart = false;
    play(0);
  }
  function upAct(a) {
    if (a === 'like' || a === 'meh' || a === 'dislike') {
      if (up && up.prev && w.Rates) { var v = a === 'like' ? 1 : a === 'dislike' ? -1 : 0; w.Rates.set(up.prev, v); w.UI.toast('Đã lưu: ' + w.Rates.label(v)); up.row = 1; up.idx = 0; paintUp(); }
      return;
    }
    if (a === 'play') upGo(); else { hideUp(); close(); }
  }


  /* ---------- 2.38.1: Phim thu nhỏ (điện thoại) ----------
     Nút ⌄ cạnh ✕ Đóng (hoặc vuốt xuống): phim thu vào góc, vẫn chạy, lướt app tiếp. Chạm để phóng to, kéo để dời góc. */
  var mini = false, miniCorner = { x: 'r', y: 'b' };
  function mob() { return d.documentElement.classList.contains('mobile'); }
  function ensureMiniUI() {
    var p = $('player'); if (!p) return;
    if (!$('pl-min')) {
      var b = d.createElement('div'); b.id = 'pl-min'; b.title = 'Thu nhỏ'; b.setAttribute('aria-label', 'Thu nhỏ phim');
      b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      b.onclick = function (e) { e.stopPropagation(); setMini(true); };
      p.appendChild(b);
    }
    if (!$('pl-minibar')) {
      var m = d.createElement('div'); m.id = 'pl-minibar';
      m.innerHTML = '<div class="mpb"><i></i></div><div class="mrow"><b></b><span class="mpp" data-m="pp">❚❚</span><span class="mx" data-m="x">✕</span></div>';
      p.appendChild(m);
    }
  }
  function paintMini() {
    var m = $('pl-minibar'); if (!m || !mini) return;
    var it = cur(); m.querySelector('b').textContent = (it && it.title) || '';
    try {
      var c = yt.getCurrentTime(), du = yt.getDuration(), st = yt.getPlayerState();
      m.querySelector('.mpb i').style.width = (du ? Math.min(100, c / du * 100) : 0) + '%';
      m.querySelector('.mpp').textContent = st === 1 || st === 3 ? '❚❚' : '▶';
    } catch (x) { /* bỏ qua */ }
  }
  function placeMini() {
    var p = $('player'); if (!p) return;
    p.style.left = p.style.right = p.style.top = p.style.bottom = '';
    p.classList.toggle('mleft', miniCorner.x === 'l'); p.classList.toggle('mtop', miniCorner.y === 't');
  }
  function setMini(on) {
    on = !!on && isOpen && mob();
    if (on === mini) return;
    mini = on;
    var p = $('player'); ensureMiniUI();
    if (mode === 'menu') closeMenu(); hideUp(); hideSend();
    p.classList.toggle('mini', mini); d.documentElement.classList.toggle('plmini', mini);
    if (mini) { placeMini(); paintMini(); } else { p.style.left = p.style.right = p.style.top = p.style.bottom = ''; p.classList.remove('mleft', 'mtop'); showUi(); }
    setTimeout(fitBox, 60);
    try {
      if (mini && !w.localStorage.getItem('tt.miniTip')) { w.localStorage.setItem('tt.miniTip', '1'); w.UI.toast('Phim vẫn chạy khi bạn lướt app. Chạm để phóng to, kéo để dời góc, ✕ để tắt', 5000); }
    } catch (x) { /* bỏ qua */ }
  }
  // kéo khung nhỏ sang góc khác; vuốt xuống trên phim lớn để thu nhỏ
  (function () {
    var sx = 0, sy = 0, dragging = false, moved = false, ox = 0, oy = 0;
    d.addEventListener('touchstart', function (e) {
      if (!isOpen || !mob()) return;
      var t = e.touches[0], p = $('player'); if (!t || !p || !p.contains(e.target)) return;
      sx = t.clientX; sy = t.clientY; moved = false; dragging = mini;
      if (mini) { var r = p.getBoundingClientRect(); ox = r.left; oy = r.top; }
    }, { passive: true });
    d.addEventListener('touchmove', function (e) {
      if (!isOpen || !mob()) return;
      var t = e.touches[0]; if (!t) return;
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 10) moved = true;
      // 2.45.8: vuốt ngang trên phim = tua (trái: lùi, phải: tới). Cả màn hình ngang = 3 phút
      if (!mini && mode !== 'menu' && !audOn && !(e.target.closest && e.target.closest('.pl-track, #pl-btns, #pl-strip, #pl-next')) && (scrub || (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * 1.5))) {
        if (!scrub) { scrub = true; try { scrubBase = yt.getCurrentTime() || 0; scrubDu = yt.getDuration() || 0; } catch (x) { scrubBase = 0; } }
        scrubSec = Math.round(dx / (w.innerWidth || 400) * 180);
        var to = Math.max(0, scrubBase + scrubSec); if (scrubDu) to = Math.min(scrubDu - 1, to);
        var o = $('pl-swipe'); if (!o) { o = d.createElement('div'); o.id = 'pl-swipe'; $('player').appendChild(o); }
        o.innerHTML = '<b>' + (scrubSec >= 0 ? '⏩ Tới ' : '⏪ Lùi ') + Math.abs(scrubSec) + ' giây</b><span>' + w.UI.fmtDur(to) + (scrubDu ? ' / ' + w.UI.fmtDur(scrubDu) : '') + '</span>';
        o.style.display = 'flex';
        e.preventDefault(); return;
      }
      if (dragging && moved) { var p = $('player'); p.style.right = p.style.bottom = 'auto'; p.style.left = (ox + dx) + 'px'; p.style.top = (oy + dy) + 'px'; e.preventDefault(); }
    }, { passive: false });
    d.addEventListener('touchend', function (e) {
      if (!isOpen || !mob()) return;
      var t = e.changedTouches[0]; if (!t) return;
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (scrub) {   // 2.45.8: thả tay: tua tới chỗ đã chọn
        scrub = false; var o = $('pl-swipe'); if (o) o.style.display = 'none';
        try { var to = Math.max(0, scrubBase + scrubSec); if (scrubDu) to = Math.min(scrubDu - 1, to); if (scrubSec) yt.seekTo(to, true); } catch (x) { /* bỏ qua */ }
        swipeAt = Date.now(); showUi(); return;
      }
      if (dragging && moved) {
        miniCorner = { x: t.clientX < w.innerWidth / 2 ? 'l' : 'r', y: t.clientY < w.innerHeight / 2 ? 't' : 'b' };
        placeMini(); miniDragAt = Date.now(); dragging = false; return;
      }
      dragging = false;
      if (!mini && mode !== 'menu' && !d.documentElement.classList.contains('elder') && dy > 110 && Math.abs(dx) < 70 && sy < w.innerHeight * 0.7) setMini(true);   // vuốt xuống
    }, { passive: true });
  })();
  var miniDragAt = 0, scrub = false, scrubBase = 0, scrubDu = 0, scrubSec = 0, swipeAt = 0;
  // bấm trong khung nhỏ
  function miniClick(t) {
    if (Date.now() - miniDragAt < 400) return;
    var a = t && t.closest && t.closest('[data-m]'), k = a && a.getAttribute('data-m');
    if (k === 'x') { setMini(false); close(); return; }
    if (k === 'pp') { try { if (yt.getPlayerState() === 1) yt.pauseVideo(); else yt.playVideo(); } catch (x) { /* bỏ qua */ } setTimeout(paintMini, 200); return; }
    setMini(false);
  }
  function close() {
    if (!isOpen) return;
    if (mini) setMini(false);
    flushWatch(); watchAt = 0; tmpCC = null; if (audOn) audioOnly(false); if (strip) { strip = null; paintStrip(); }
    hideUp(); hideSend();
    sleepHold = false; clearTimeout(sleepCloseT); volBack(); var sbg = $('pl-sleepbadge'); if (sbg) sbg.className = 'hidden';
    saveNow();
    isOpen = false;
    fitBox();
    demoHint = false;
    playing = false;
    clearInterval(tickT); clearTimeout(hideT); clearTimeout(errT); stillClear();
    try { if (yt && yt.stopVideo) yt.stopVideo(); } catch (x) { /* bỏ qua */ }
    if (yt && yt instanceof HostPlayer) { yt.destroy(); yt = null; }
    else if (yt && w.UI.isMobile()) {
      // iPhone: khung video YouTube vẫn bám trên màn hình (đơ hình, chạm không ăn) dù đã ẩn trình phát.
      // Gỡ hẳn trình phát khi đóng; lần sau mở phim sẽ tạo lại.
      try { yt.destroy(); } catch (x) { /* bỏ qua */ }
      yt = null;
      var hh = $('yt-host'); if (hh) hh.innerHTML = '<div id="yt"></div>';
    }
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
    else if (id === 'sleep') { cycleSleep(); }
    else if (id === 'send') { showSend(); }
    else if (id === 'fav') {
      var fi = slim(q.series || cur()), fon = w.Store.toggleFav(fi);
      w.UI.toast(fon ? 'Đã thêm vào Danh sách của tôi' : 'Đã bỏ khỏi Danh sách của tôi');
      renderBtns();
    }
  }

  /* ---------- "Còn xem không?": phim tự phát lâu mà không ai bấm gì thì hỏi lại, không ai trả lời thì tắt ---------- */
  var still = null;
  function stillHours() { var v = w.APP_CONFIG ? w.APP_CONFIG.STILL_HOURS : 2; return v === 0 ? 0 : (+v || 2); }
  function checkStill() {
    if (!isOpen || still || !playing) return;
    var h = stillHours(); if (!h) return;
    var last = Math.max(w.lastKeyAt || 0, openAt || 0);
    if (Date.now() - last < h * 3600e3) return;
    try { yt.pauseVideo(); } catch (x) { /* bỏ qua */ }
    var b = d.createElement('div'); b.id = 'pl-still';
    b.innerHTML = '<div class="stbox"><div class="stk">ĐÃ XEM ' + h + ' GIỜ LIÊN TỤC</div><div class="stt">Còn xem không?</div>' +
      '<div class="sts">Không ai bấm gì trong <b>60</b> giây thì phim tự tắt</div><div class="stb"><div class="upbtn gold focus" data-a="ok">▶ Xem tiếp</div><div class="upbtn" data-a="no">Tắt phim</div></div></div>';
    $('player').appendChild(b);
    var n = 60, nb = b.querySelector('.sts b');
    still = { el: b, idx: 0, t: setInterval(function () { n--; if (nb) nb.textContent = n; if (n <= 0) stillNo(); }, 1000) };
    [].slice.call(b.querySelectorAll('.upbtn')).forEach(function (x) { x.onclick = function (e) { e.stopPropagation(); if (x.getAttribute('data-a') === 'ok') stillOk(); else stillNo(); }; });
    $('pl-ui').classList.remove('show');
  }
  function stillClear() { if (!still) return; clearInterval(still.t); if (still.el.parentNode) still.el.parentNode.removeChild(still.el); still = null; }
  function stillOk() { stillClear(); w.lastKeyAt = Date.now(); try { yt.playVideo(); } catch (x) { /* bỏ qua */ } }
  function stillNo() { stillClear(); close(); if (w.UI) w.UI.toast('Đã tắt phim vì không ai xem. Phim sẽ xem tiếp đúng chỗ này lần sau'); }
  function stillPaint() { if (!still) return; [].slice.call(still.el.querySelectorAll('.upbtn')).forEach(function (x, i) { x.classList.toggle('focus', i === still.idx); }); }

  /* ---------- Remote điện thoại: lệnh cho trình phát ---------- */
  function remote(k) {
    if (!isOpen) return false;
    if (k === 'play') { toggle(); return true; }
    if (k === 'b10') { seek(-1); return true; }
    if (k === 'f10') { seek(1); return true; }
    if (k === 'cc') { w.Store.setPref('cc', !ccOn()); applyCaptions(true); renderBtns(); return true; }
    if (k === 'next') { if (q.index < q.items.length - 1) play(q.index + 1); else w.UI.toast('Phim này không có tập sau'); return true; }
    if (k === 'close') { close(); return true; }
    return false;
  }
  function nowInfo() {
    if (!isOpen || !q) return null;
    var it = cur() || {}, c = 0, du = 0;
    try { c = yt.getCurrentTime() || 0; du = yt.getDuration() || 0; } catch (x) { /* bỏ qua */ }
    return { t: String(it.title || '').slice(0, 120), img: it.thumb || '', pos: Math.floor(c), dur: Math.floor(du || it.dur || 0), pl: playing };
  }

  /* ---------- Xem trước: giữ lâu trên ảnh phim, phim phát ngay trong ảnh (không tiếng) ---------- */
  var pv = null;
  function pvSecs() { if (w.DataSaver && w.DataSaver.on()) return 0; var v = w.APP_CONFIG ? w.APP_CONFIG.PREVIEW_SECS : 20; return v === 0 ? 0 : (+v || 20); }   // 2.38: tiết kiệm dữ liệu: không xem trước
  function preview(card, thumbEl, it) {
    if (isOpen) return;
    if (pv && pv.card === card) { previewOpen(); return; }
    stopPreview();
    var secs = pvSecs();
    if (!secs) { if (card._ok) card._ok(); return; }
    var p = w.Store.getProgress(it.id), dur = it.dur || (p && p.d) || 0;
    var start = p && p.p > 15 && (!dur || p.p < dur - 30) ? Math.floor(p.p) : Math.floor(Math.min(dur ? dur * 0.12 : 60, 300) || 60);
    if (dur && start > dur - secs - 5) start = Math.max(0, Math.floor(dur - secs - 5));
    var box = d.createElement('div'); box.className = 'pvbox';
    var host = d.createElement('div'); host.className = 'pvyt'; host.id = 'pvyt' + Date.now(); box.appendChild(host);
    box.insertAdjacentHTML('beforeend', '<div class="pvtag"><i></i>XEM TRƯỚC</div><div class="pvmt" title="Bật tiếng">🔇</div><div class="pvsec"></div><div class="pvpb"><b></b></div>' +
      (w.UI.isMobile() ? '' : '<div class="pvhint">OK: xem phim từ đây</div>'));
    thumbEl.appendChild(box);
    card.classList.add('pvcard');
    try { if (w.Nav && w.Nav.cur !== card) w.Nav.focus(card, true); } catch (x) { /* bỏ qua */ }
    pv = { card: card, it: it, box: box, start: start, t0: 0, secs: secs, yt: null, timer: 0, muted: true, ended: false, at: Date.now() };
    var me = pv;
    var mt = box.querySelector('.pvmt');
    mt.addEventListener('click', function (e) {
      e.stopPropagation(); if (!me.yt) return;
      me.muted = !me.muted;
      try { if (me.muted) me.yt.mute(); else { me.yt.unMute(); me.yt.setVolume(100); } } catch (x) { /* bỏ qua */ }
      mt.textContent = me.muted ? '🔇' : '🔊';
    });
    var sec = box.querySelector('.pvsec'), bar = box.querySelector('.pvpb b');
    sec.textContent = secs + 's';
    loadApi(function (ok) {
      if (pv !== me) return;
      if (!ok) { stopPreview(); w.UI.toast('Chưa xem trước được (mạng?)'); return; }
      var web = /^https?:/.test(w.location.protocol);
      var vars = { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, mute: 1, start: start, hl: 'vi' };
      if (web) vars.origin = w.location.origin;
      vars.widget_referrer = web ? w.location.href : 'https://tongtaitv.app/';
      var opt = { width: '100%', height: '100%', videoId: it.id, playerVars: vars, small: true, events: {
        onReady: function (e) { if (pv !== me) { try { e.target.stopVideo(); } catch (x) { /* bỏ qua */ } return; } try { e.target.mute(); e.target.playVideo(); } catch (x) { /* bỏ qua */ } },
        onStateChange: function (e) { if (pv !== me) return; if (e.data === 1 && !me.t0) { me.t0 = Date.now(); box.classList.add('live'); } },
        onError: function () { if (pv === me) { stopPreview(); w.UI.toast('Phim này không xem trước được'); } }
      } };
      me.yt = useHost() ? new HostPlayer(host.id, opt) : new w.YT.Player(host.id, opt);
    });
    me.timer = setInterval(function () {
      if (pv !== me) return;
      // ngừng khi rời ô: chọn ô khác, đổi trang, ô bị gỡ
      if (!d.body.contains(card) || (w.Nav && w.Nav.cur && w.Nav.cur !== card && !w.UI.isMobile())) { stopPreview(); return; }
      if (!me.t0) return;
      var left = me.secs - (Date.now() - me.t0) / 1000;
      sec.textContent = Math.max(0, Math.ceil(left)) + 's';
      bar.style.width = Math.min(100, (1 - left / me.secs) * 100) + '%';
      if (left <= 0) stopPreview();
    }, 250);
  }
  function previewTime() {
    if (!pv) return 0;
    var t = 0; try { t = pv.yt && pv.yt.getCurrentTime ? pv.yt.getCurrentTime() : 0; } catch (x) { /* bỏ qua */ }
    if (!t && pv.t0) t = pv.start + (Date.now() - pv.t0) / 1000;
    return Math.floor(t || pv.start);
  }
  function previewOpen() {
    if (!pv) return;
    var it = pv.it, t = previewTime();
    stopPreview();
    open({ items: [it], index: 0, heading: it.title, key: 'v:' + it.id, series: it, startAt: t });
  }
  function stopPreview() {
    if (!pv) return;
    var me = pv; pv = null;
    clearInterval(me.timer);
    try { if (me.yt) { if (me.yt.destroy) me.yt.destroy(); else me.yt.stopVideo(); } } catch (x) { /* bỏ qua */ }
    if (me.box.parentNode) me.box.parentNode.removeChild(me.box);
    me.card.classList.remove('pvcard');
  }
  // điện thoại: chạm ra ngoài hoặc cuộn thì ngừng xem trước
  d.addEventListener('pointerdown', function (e) { if (pv && !(e.target.closest && e.target.closest('.pvcard'))) stopPreview(); }, true);
  d.addEventListener('scroll', function (e) { if (pv && w.UI.isMobile() && Date.now() - (pv.at || 0) > 800 && e.target && e.target.contains && e.target.contains(pv.card)) stopPreview(); }, true);

  /* ---------- Gửi phim sang điện thoại: mã QR mở đúng phim, đúng chỗ, đúng hồ sơ (không cần đăng nhập) ---------- */
  var sendOn = false;
  function sendUrl() {
    var base = '';
    if (/^https?:/.test(w.location.protocol) && !w.AndroidApp && !w.tizen) base = w.location.href.replace(/[?#].*$/, '').replace(/[^\/]*$/, '');
    else { var a = String((w.APP_CONFIG || {}).ADMIN_PAGE || ''); if (a) base = a.replace(/[^\/]*$/, ''); }
    return base;
  }
  function showSend() {
    var it = cur(); if (!it) return;
    var t = 0; try { t = Math.floor(yt.getCurrentTime() || 0); } catch (x) { /* bỏ qua */ }
    var mob = w.UI.isMobile();
    if (!mob) { try { if (yt && yt.pauseVideo) yt.pauseVideo(); } catch (x) { /* bỏ qua */ } }
    var me = (w.Store.profiles().filter(function (p) { return p.id === w.Store.profile(); })[0]) || { id: 'guest', name: 'Guest' };
    var pay = { v: it.id, t: t, ti: String(it.title || '').slice(0, 80), c: String(it.ch || '').slice(0, 40), p: { id: me.id, n: me.name, a: me.av } };
    var url = sendUrl() + '#send=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(pay)))));
    var b = $('pl-send'); if (!b) { b = d.createElement('div'); b.id = 'pl-send'; $('player').appendChild(b); }
    var yurl = 'https://youtu.be/' + encodeURIComponent(it.id) + (t > 5 ? '?t=' + t : '');   // xem trên YouTube, đúng chỗ đang xem
    var svg = w.QR.svg(url, 300) || '', ysvg = w.QR.svg(yurl, 300) || '';
    var mm = Math.floor(t / 60), ss = ('0' + (t % 60)).slice(-2), nm = me.name.replace(/</g, '');
    if (mob) {   // điện thoại: bảng 2 mã QR để người bên cạnh quét, kèm nút sao chép / chia sẻ link (phim vẫn chạy)
      b.className = 'mob';
      b.innerHTML = '<div class="psend m"><div class="psmh"><div><div class="psk">MÃ QR CỦA PHIM NÀY</div><div class="psn"></div></div><div class="psx">✕</div></div>' +
        '<div class="pss">Đưa điện thoại cho người bên cạnh quét · đang xem tới ' + mm + ':' + ss + '</div>' +
        '<div class="psqs"><div class="psc"><div class="psq">' + svg + '</div><div class="pslb"><b>Tổng Tài TV</b>Mở trong app, đúng chỗ ' + mm + ':' + ss + '</div><div class="pscp" data-u="app">Sao chép link</div></div>' +
        '<div class="psc yt"><div class="psq">' + ysvg + '</div><div class="pslb"><b><span class="ytlogo">▶</span> YouTube</b>Mở bằng ứng dụng YouTube</div><div class="pscp" data-u="yt">Sao chép link</div></div></div>' +
        (navigator.share ? '<div class="psshare">Chia sẻ link phim…</div>' : '') + '</div>';
      b.querySelector('.psn').textContent = it.title || '';
      var copy = function (u, el) {
        var done = function () { el.textContent = '✓ Đã sao chép'; setTimeout(function () { el.textContent = 'Sao chép link'; }, 1800); };
        try { navigator.clipboard.writeText(u).then(done, function () { w.prompt('Sao chép link này:', u); }); } catch (x) { w.prompt('Sao chép link này:', u); }
      };
      [].slice.call(b.querySelectorAll('.pscp')).forEach(function (el) { el.onclick = function (e) { e.stopPropagation(); copy(el.getAttribute('data-u') === 'yt' ? yurl : url, el); }; });
      var sh = b.querySelector('.psshare');
      if (sh) sh.onclick = function (e) { e.stopPropagation(); try { navigator.share({ title: it.title || 'Tổng Tài TV', text: (it.title || '') + '\nXem trên YouTube: ' + yurl, url: url }); } catch (x) { /* bỏ qua */ } };
      b.querySelector('.psx').onclick = function (e) { e.stopPropagation(); hideSend(); showUi(); };
      b.onclick = function (e) { if (e.target === b) { hideSend(); showUi(); } };
      b.querySelector('.psend').onclick = function (e) { e.stopPropagation(); };
      b.classList.remove('hidden'); sendOn = true;
      $('pl-ui').classList.remove('show');
      return;
    }
    b.className = '';
    b.innerHTML = '<div class="psend"><div class="pst top"><div class="psk">GỬI PHIM SANG ĐIỆN THOẠI</div><div class="psn"></div><div class="pss">Đang xem tới ' + mm + ':' + ss + ' · hồ sơ ' + nm + ' · phim đang tạm dừng trên TV</div></div>' +
      '<div class="psqs"><div class="psc"><div class="psq">' + svg + '</div><div class="pslb"><b>Tổng Tài TV</b>Mở đúng chỗ ' + mm + ':' + ss + ', cùng hồ sơ ' + nm + '. Không cần đăng nhập.</div></div>' +
      '<div class="psc yt"><div class="psq">' + ysvg + '</div><div class="pslb"><b><span class="ytlogo">▶</span> YouTube</b>Mở bằng ứng dụng YouTube, đúng chỗ ' + mm + ':' + ss + '. Thích, bình luận, đăng ký kênh ngay trên YouTube.</div></div></div>' +
      '<div class="psh">Mở camera điện thoại, quét một trong hai mã · bấm phím bất kỳ để đóng</div></div>';
    b.querySelector('.psn').textContent = it.title || '';
    b.classList.remove('hidden'); sendOn = true;
    $('pl-ui').classList.remove('show');
  }
  function hideSend() { var b = $('pl-send'); if (b) b.classList.add('hidden'); sendOn = false; }

  /* Trả về true nếu đã xử lý phím */
  function key(k) {
    if (!isOpen) return false;
    if (sendOn) { hideSend(); showUi(); return true; }
    if (still) {
      w.lastKeyAt = Date.now();
      if (k === 37 || k === 39) { still.idx = k === 39 ? 1 : 0; stillPaint(); }
      else if (k === 13) { if (still.idx === 0) stillOk(); else stillNo(); }
      else if (k === 10009 || k === 27 || k === 8) stillNo();
      return true;
    }
    if (demoHint && k === 13) {       // chưa có API key: đi thẳng tới Cài đặt để nhập
      demoHint = false;
      close();
      if (w.Screens && w.Screens.goTab) w.Screens.goTab('settings');
      return true;
    }
    if (sleepHold) {   // đã dừng vì hẹn giờ: OK = xem tiếp, Back = thoát
      if (k === 13 || k === 415 || k === 10252) { sleepHold = false; msg(''); volBack(); try { yt.playVideo(); } catch (x) { /* bỏ qua */ } w.UI.toast('Xem tiếp. Hẹn giờ đã tắt'); }
      else if (k === 10009 || k === 27 || k === 8 || k === 413) { sleepHold = false; close(); }
      return true;
    }
    if (strip) return stripKey(k);
    if (up) {
      if (k === 38 && up.prev) { up.row = 0; paintUp(); }
      else if (k === 40) { up.row = 1; paintUp(); }
      else if (k === 37 || k === 39) {
        if (up.row === 0) up.ridx = Math.max(0, Math.min(2, up.ridx + (k === 39 ? 1 : -1)));
        else up.idx = k === 39 ? 1 : 0;
        paintUp();
      }
      else if (k === 13) upAct(up.row === 0 ? ['like', 'meh', 'dislike'][up.ridx] : up.idx === 0 ? 'play' : 'cancel');
      else if (k === 10009 || k === 27 || k === 8 || k === 413) upAct('cancel');
      else if (k === 415 || k === 10252 || k === 417) upAct('play');
      return true;
    }
    var ui = $('pl-ui').classList.contains('show');
    if (mode === 'menu') {
      if (k === 38 || k === 40) {
        menuIdx = Math.max(0, Math.min(QUALITIES.length - 1, menuIdx + (k === 40 ? 1 : -1)));
        renderMenu(); showUi();
      } else if (k === 13) {
        w.Store.setPref('quality', QUALITIES[menuIdx].id); qManual = true;
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
        if (mode === 'btn' && !ui) { mode = 'seek'; btnIdx = -1; renderBtns(); }   // 2.47.1: nút đang ẩn: ◀ ▶ là tua ngay (không phải đi qua các nút)
        if (mode === 'btn') {
          btnIdx = Math.max(0, Math.min(btns.length - 1, btnIdx + (k === 39 ? 1 : -1)));
          renderBtns(); showUi();
        } else arrow(k);
        return true;
      case 13:
        if (mode === 'btn') { press(btns[btnIdx].id); if (mode === 'btn') renderBtns(); showUi(); }
        else if (!ui) { toggle(); }
        else toggle();
        return true;
    }
    return true;   // nuốt mọi phím khác khi đang xem
  }

  var adTold = false;
  var openAt = 0;
  function open(opts) {
    openAt = Date.now();
    if (mini) setMini(false);   // đang thu nhỏ mà mở phim khác: phim mới toàn màn hình
    q = {
      items: opts.items, index: opts.index || 0, heading: opts.heading, key: opts.key,
      series: opts.series, onClose: opts.onClose, fromStart: !!opts.fromStart, next: opts.next || null,
      startAt: opts.startAt != null ? opts.startAt : null, startIdx: opts.index || 0
    };
    stopPreview();
    hideUp();
    isOpen = true;
    setTimeout(fitBox, 50);
    if (mob()) ensureMiniUI();
    qManual = false;
    try { if (w.DataSaver && w.DataSaver.on()) setTimeout(function () { if (isOpen) w.UI.toast('📶 ' + w.DataSaver.why().replace(/^t/, 'T') + ': phát ' + (w.DataSaver.q() === 'medium' ? '360p' : '480p') + '. Bấm Chất lượng để chọn cao hơn cho phim này', 4500); }, 1800); } catch (x) { /* bỏ qua */ }
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
    audioOnly: audioOnly,
    isMini: function () { return mini; }, swipedAt: function () { return swipeAt; }, setMini: setMini, miniClick: miniClick,
    inMenu: function () { return mode === 'menu' || !!up || sleepHold; },
    cycleSleep: function () { cycleSleep(); if (isOpen && mode === 'btn') renderBtns(); }, setSleep: function (v) { setSleep(v); volBack(); paintSleepBadge(); }, sleepInfo: function () { return sleepLabel(); }, _sleepIn: function (ms) { sleep.mode = 't'; sleep.at = Date.now() + ms; },
    upClick: function (a) { if (up) upAct(a); },
    sendClose: function () { if (sendOn) hideSend(); },
    sleepEnd: function () { if (sleep.mode !== 'end') { setSleep('end'); if (isOpen && mode === 'btn') renderBtns(); } },
    setVolume: function (v) { try { if (yt && yt.setVolume) yt.setVolume(v); } catch (x) { /* bỏ qua */ } },
    clickBtn: function (i) { if (!btns[i]) return; mode = 'btn'; btnIdx = i; press(btns[i].id); if (mode === 'btn') renderBtns(); showUi(); },
    playMode: function () { return srcMode() === 'host' ? 'Qua ' + hostUrl() : srcMode() === 'direct' ? 'Trực tiếp (chưa có PLAYER_HOST)' : 'Trực tiếp'; }, open: open, key: key, isOpen: function () { return isOpen; }, preview: preview, previewOpen: previewOpen, remote: remote, nowInfo: nowInfo, stillAsk: function () { return !!still; }, stillOk: function () { stillOk(); }, stopPreview: stopPreview, previewOn: function (c) { return !!pv && pv.card === c; }, isPlaying: function () { return isOpen && playing; }, close: close };
})(window);
