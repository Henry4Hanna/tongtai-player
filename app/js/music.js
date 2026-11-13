/* Nhạc nền Trang chủ: 5 bản hòa tấu phong cách phim "tổng tài", tự sáng tác và tự chơi bằng Web Audio
   (piano, dàn dây, chuông, bass, trống nhẹ). Không cần tải file, không dùng bài hát có bản quyền.
   Chỉ phát ở Trang chủ; tự dừng khi xem phim, sang trang khác hoặc ẩn app. */
(function (w) {
  'use strict';

  /* ---------- 5 bài ---------- */
  // prog: mỗi ô nhịp một hợp âm [nốt gốc MIDI, 'm' thứ | 'M' trưởng]
  var TRACKS = [
    { name: 'Tổng Tài Lạnh Lùng', bpm: 74, key: 57, minor: true, seed: 11,
      prog: [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']], lead: 'piano', arp: [0, 1, 2, 1, 3, 2, 1, 2], pad: 0.5, perc: null, bassPat: [0, 4] },
    { name: 'Ngọt Sủng Ngày Đầu', bpm: 92, key: 60, minor: false, seed: 23,
      prog: [[60, 'M'], [55, 'M'], [57, 'm'], [53, 'M']], lead: 'bell', arp: [0, 2, 1, 2, 0, 2, 1, 2], pad: 0.3, perc: 'shaker', bassPat: [0, 3, 4] },
    { name: 'Hào Môn Đêm Mưa', bpm: 64, key: 62, minor: true, seed: 37,
      prog: [[62, 'm'], [58, 'M'], [53, 'M'], [60, 'M']], lead: 'piano', arp: [0, 1, 2, 3, 2, 1, 2, 1], pad: 0.65, perc: null, bassPat: [0] },
    { name: 'Gặp Lại Sau Năm Năm', bpm: 80, key: 64, minor: true, seed: 41,
      prog: [[64, 'm'], [60, 'M'], [55, 'M'], [62, 'M']], lead: 'strings', arp: [0, 1, 2, 1, 0, 1, 2, 1], pad: 0.45, perc: 'soft', bassPat: [0, 4, 6] },
    { name: 'Báo Thù Kiêu Hãnh', bpm: 100, key: 60, minor: true, seed: 59,
      prog: [[60, 'm'], [56, 'M'], [51, 'M'], [58, 'M']], lead: 'strings', arp: [0, 0, 2, 0, 1, 0, 2, 3], pad: 0.55, perc: 'drum', bassPat: [0, 2, 4, 6] }
  ];
  var MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10];

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rng(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function chordTones(c) { var r = c[0]; return c[1] === 'm' ? [r, r + 3, r + 7, r + 12] : [r, r + 4, r + 7, r + 12]; }
  function scaleNotes(t, lo, hi) {
    var sc = t.minor ? MIN : MAJ, out = [];
    for (var m = lo; m <= hi; m++) { var d = ((m - t.key) % 12 + 12) % 12; if (sc.indexOf(d) >= 0) out.push(m); }
    return out;
  }

  /* Giai điệu: 4 ô nhịp × 8 phách móc; nốt mạnh ưu tiên nốt trong hợp âm, đi từng bậc cho mượt */
  function makeMelody(t, seed, shift) {
    var r = rng(seed), sn = scaleNotes(t, t.key + 7 + shift, t.key + 24 + shift), out = [];
    var cur = sn[Math.floor(sn.length / 2)];
    for (var bar = 0; bar < 4; bar++) {
      var ct = chordTones(t.prog[bar]).map(function (x) { return x; });
      var rhythm = r() < 0.5 ? [2, 2, 1, 1, 2] : r() < 0.5 ? [3, 1, 2, 2] : [1, 1, 2, 1, 1, 2];
      if (bar === 3) rhythm = [2, 2, 4];   // câu kết: ngân dài
      var step = 0;
      rhythm.forEach(function (len, i) {
        var strong = step % 4 === 0;
        var target;
        if (strong) {   // nốt hợp âm gần nhất
          var best = null;
          sn.forEach(function (m) { if (ct.some(function (c) { return (m - c) % 12 === 0; }) && (best === null || Math.abs(m - cur) < Math.abs(best - cur))) best = m; });
          target = best || cur;
        } else {
          var idx = sn.indexOf(cur); if (idx < 0) idx = Math.floor(sn.length / 2);
          idx += (r() < 0.5 ? -1 : 1) * (r() < 0.75 ? 1 : 2);
          target = sn[Math.max(0, Math.min(sn.length - 1, idx))];
        }
        var rest = !strong && r() < 0.12;
        if (!rest) out.push({ s: bar * 8 + step, len: len, m: target });
        cur = target; step += len;
      });
    }
    return out;
  }

  /* ---------- Nhạc cụ ---------- */
  var reverbBuf = null;
  function makeReverb(ctx) {
    if (reverbBuf && reverbBuf.sampleRate === ctx.sampleRate) return reverbBuf;
    var len = Math.floor(ctx.sampleRate * 2.6), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var dt = b.getChannelData(ch);
      for (var i = 0; i < len; i++) dt[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverbBuf = b; return b;
  }
  var noiseBuf = null;
  function noise(ctx) {
    if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
    var b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b; return b;
  }
  function env(g, t, a, peak, dec, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + dec);
    g.gain.setValueAtTime(Math.max(0.0001, peak * sus), end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  }
  function piano(ctx, out, m, t, dur, vel) {
    var g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 2600 + vel * 1800;
    [['triangle', 1, 1], ['sine', 2, 0.35], ['sine', 3, 0.12]].forEach(function (p) {
      var o = ctx.createOscillator(); o.type = p[0]; o.frequency.value = hz(m) * p[1];
      var og = ctx.createGain(); og.gain.value = p[2];
      o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 1.3);
    });
    f.connect(g); g.connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.09 * vel, t + 0.5);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.35);
  }
  function bell(ctx, out, m, t, dur, vel) {
    [[1, 0.26], [2.76, 0.07], [5.4, 0.03]].forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = hz(m) * p[0];
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(p[1] * vel, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 + dur * 0.5);
      o.start(t); o.stop(t + 1.4 + dur);
    });
  }
  function strings(ctx, out, m, t, dur, vel, soft) {
    var g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = soft ? 900 : 1700; f.Q.value = 0.6;
    [-7, 0, 7].forEach(function (det) {
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 1.2);
    });
    f.connect(g); g.connect(out);
    env(g, t, soft ? 0.6 : 0.12, (soft ? 0.05 : 0.09) * vel, 0.3, 0.8, soft ? 0.9 : 0.4, t + dur);
  }
  function bass(ctx, out, m, t, dur) {
    var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'triangle'; o.frequency.value = hz(m); f.type = 'lowpass'; f.frequency.value = 500;
    o.connect(f); f.connect(g); g.connect(out);
    env(g, t, 0.01, 0.28, 0.25, 0.6, 0.2, t + dur);
    o.start(t); o.stop(t + dur + 0.4);
  }
  function hit(ctx, out, t, kind) {
    if (kind === 'kick') {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      o.connect(g); g.connect(out);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
      return;
    }
    var s = ctx.createBufferSource(), bf = ctx.createBiquadFilter(), gg = ctx.createGain();
    s.buffer = noise(ctx);
    bf.type = kind === 'snare' ? 'bandpass' : 'highpass'; bf.frequency.value = kind === 'snare' ? 1800 : 7000;
    s.connect(bf); bf.connect(gg); gg.connect(out);
    var pk = kind === 'snare' ? 0.16 : 0.05, dl = kind === 'snare' ? 0.16 : 0.06;
    gg.gain.setValueAtTime(pk, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + dl);
    s.start(t, Math.random() * 0.5); s.stop(t + dl + 0.02);
  }

  /* ---------- Soạn 1 vòng 16 ô nhịp (A A' B A) và lên lịch phát ---------- */
  function buildTrack(t) {
    var A = makeMelody(t, t.seed, 0), A2 = makeMelody(t, t.seed + 1, 0), B = makeMelody(t, t.seed + 7, 3);
    var mel = [];
    [A, A2, B, A].forEach(function (ph, sec) { ph.forEach(function (n) { mel.push({ s: n.s + sec * 32, len: n.len, m: n.m }); }); });
    return mel;
  }
  // Lên lịch các nốt thuộc phách [from, to) (đơn vị: phách móc, 128 phách = 1 vòng)
  function schedule(ctx, out, t, mel, from, to, t0) {
    var e = 60 / t.bpm / 2;   // độ dài 1 phách móc (giây)
    for (var s = from; s < to; s++) {
      var loopS = s % 128, bar = Math.floor(loopS / 8) % 4, inBar = loopS % 8, sec = Math.floor(loopS / 32);
      var when = t0 + s * e, ch = t.prog[bar], ct = chordTones(ch);
      if (inBar === 0 && t.pad) ct.slice(0, 3).forEach(function (m) { strings(ctx, out, m - 12, when, e * 8 - 0.05, t.pad, true); });
      if (t.bassPat.indexOf(inBar) >= 0) bass(ctx, out, ch[0] - 24, when, e * (inBar === 0 ? 2 : 1));
      // hợp âm rải (tay trái), phần B rải lên cao hơn một chút
      var ai = t.arp[inBar], am = ct[ai % ct.length] - (sec === 2 ? 0 : 12);
      if (!(t.lead === 'strings' && inBar % 2 === 1)) piano(ctx, out, am, when, e * 1.6, 0.45);
      // trống
      if (t.perc === 'drum') { if (inBar % 4 === 0) hit(ctx, out, when, 'kick'); if (inBar % 4 === 2) hit(ctx, out, when, 'snare'); hit(ctx, out, when, 'hat'); }
      else if (t.perc === 'shaker' && inBar % 2 === 1) hit(ctx, out, when, 'hat');
      else if (t.perc === 'soft' && inBar === 0 && sec > 0) hit(ctx, out, when, 'kick');
      // giai điệu
      mel.forEach(function (n) {
        if (n.s !== loopS) return;
        var d = n.len * e;
        if (t.lead === 'bell') bell(ctx, out, n.m + 12, when, d, 0.9);
        else if (t.lead === 'strings') strings(ctx, out, n.m, when, d * 0.95, 1, false);
        else piano(ctx, out, n.m, when, d, 0.85);
      });
    }
  }
  // Mạch âm thanh: các nốt → tiếng vang → âm lượng tổng
  function chain(ctx, dest) {
    var master = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain(), rv = ctx.createConvolver(), comp = ctx.createDynamicsCompressor();
    rv.buffer = makeReverb(ctx);
    dry.gain.value = 0.85; wet.gain.value = 0.35;
    dry.connect(comp); dry.connect(rv); rv.connect(wet); wet.connect(comp); comp.connect(master); master.connect(dest);
    return { input: dry, master: master };
  }

  /* ---------- Điều khiển phát ---------- */
  var ctx = null, net = null, playing = -1, mel = null, step = 0, t0 = 0, timer = 0, unlocked = false, loops = 0, autoIdx = -1;
  var VOL = { min: 0.07, low: 0.18, mid: 0.32, high: 0.5 };   // min = Ngưỡng: nghe rất nhỏ, vừa đủ nghe
  function cfg() { return w.APP_CONFIG || {}; }
  function vol() { return VOL[cfg().MUSIC_VOL] || VOL.low; }
  function songsMode() { var m = cfg().MUSIC; return (m === 'songs' || m === 'songsx' || m == null) && Songs.ok(); }
  function wanted() {
    var m = cfg().MUSIC;
    if (m === 'off' || songsMode() || onMusicPage()) return -1;
    if (m === 'songs' || m === 'songsx') m = 'auto';   // chưa tải được nhạc của tôi: tạm dùng bản hòa tấu
    if (m === 'auto' || m == null) { if (autoIdx < 0) autoIdx = Math.floor(Math.random() * TRACKS.length); return autoIdx; }
    var i = +m; return i >= 0 && i < TRACKS.length ? i : 0;
  }
  function onMusicPage() {
    try {
      if (d.getElementById('boot') || (w.Player && w.Player.isOpen()) || d.hidden || (w.Saver && w.Saver.isOn())) return false;
      var c = w.Screens && w.Screens.current && w.Screens.current();
      return !!c && (c.name === 'music' || c.name === 'lrcsync' || c.name === 'songquiz' || c.name === 'sleep' || c.name === 'askfilm');
    } catch (e) { return false; }
  }
  function onHome() {
    if (onMusicPage()) return true;   // trang Nhạc: luôn phát nhạc của tôi
    try {
      if (d.getElementById('boot') || (w.Player && w.Player.isOpen()) || d.hidden || (w.Saver && w.Saver.isOn())) return false;   // màn hình chờ: im lặng
      var c = w.Screens && w.Screens.current && w.Screens.current();
      return !!c && (c.name === 'home' || c.name === 'songs');   // màn hình Chọn bài cũng phát để nghe thử
    } catch (e) { return false; }
  }
  var d = document;
  function start(i) {
    if (!ctx) {
      var AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); } catch (e) { return; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    if (!net) net = chain(ctx, ctx.destination);
    stopNotes();
    playing = i; mel = buildTrack(TRACKS[i]); step = 0; loops = 0;
    t0 = ctx.currentTime + 0.15;
    net.master.gain.cancelScheduledValues(ctx.currentTime);
    net.master.gain.setValueAtTime(0.0001, ctx.currentTime);
    net.master.gain.exponentialRampToValueAtTime(vol(), ctx.currentTime + 2);
    clearInterval(timer);
    timer = setInterval(pump, 100);
    paintPill();
  }
  function pump() {
    if (playing < 0 || !ctx) return;
    var t = TRACKS[playing], e = 60 / t.bpm / 2, ahead = ctx.currentTime + 0.4;
    var upTo = Math.floor((ahead - t0) / e);
    if (upTo > step) { schedule(ctx, net.input, t, mel, step, upTo, t0); step = upTo; }
    // hết 2 vòng (khoảng 2–3 phút): chế độ Tự động chuyển bài kế tiếp
    if (step >= 256 && cfg().MUSIC === 'auto') { autoIdx = (playing + 1) % TRACKS.length; fadeTo(autoIdx); }
    else if (step >= 256) { step -= 0; }
  }
  function stopNotes() {
    if (!net || !ctx) return;
    // ngắt nhánh cũ để các nốt đã lên lịch không kêu nữa
    try { net.input.disconnect(); } catch (e) { /* bỏ qua */ }
    var old = net; net = chain(ctx, ctx.destination);
    try { old.master.disconnect(); } catch (e) { /* bỏ qua */ }
  }
  function fadeTo(i) {
    if (!ctx || !net) { start(i); return; }
    var g = net.master.gain, now = ctx.currentTime;
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.exponentialRampToValueAtTime(0.0001, now + 1.2);
    playing = -2; clearInterval(timer);
    setTimeout(function () { start(i); }, 1250);
  }
  function stop(fast) {
    if (playing === -1) return;
    clearInterval(timer);
    if (ctx && net) {
      var g = net.master.gain, now = ctx.currentTime;
      g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.exponentialRampToValueAtTime(0.0001, now + (fast ? 0.3 : 1));
      setTimeout(function () { if (playing === -1) { stopNotes(); if (ctx && ctx.suspend) ctx.suspend(); } }, fast ? 350 : 1100);
    }
    playing = -1;
    paintPill();
  }
  // Kiểm tra mỗi nửa giây: có đang ở Trang chủ không, cài đặt đổi chưa
  function tick() {
    Songs.tick();
    var want = wanted();
    if (!unlocked || want < 0 || !onHome()) { if (playing !== -1) stop(w.Player && w.Player.isOpen()); paintPill(); return; }
    if (playing === -2) return;
    if (playing !== want) { if (playing >= 0) fadeTo(want); else start(want); }
    else if (net && ctx && Math.abs(net.master.gain.value - vol()) > 0.02 && ctx.currentTime - t0 > 2.5) net.master.gain.setTargetAtTime(vol(), ctx.currentTime, 0.3);
  }
  // Trình duyệt chỉ cho phát tiếng sau lần bấm / chạm đầu tiên
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { tick(); } catch (e) { /* bỏ qua */ }   // gọi ngay trong lần bấm: iPhone chỉ cho phát tiếng lúc này
    setTimeout(tick, 50);
  }
  ['keydown', 'pointerdown', 'touchend', 'click'].forEach(function (ev) { w.addEventListener(ev, unlock, true); w.addEventListener(ev, function () { Songs.retry(); }, true); });
  if (w.tizen || w.AndroidApp) unlocked = true;   // ứng dụng TV: được phát ngay
  setInterval(tick, 500);
  d.addEventListener('visibilitychange', tick);

  /* ---------- Nhạc của tôi: file mp3 trong thư mục music/ (danh sách ở music/list.json) ----------
     Bản web: lấy cùng chỗ với app. TV: lấy từ GitHub Pages (MUSIC_URL, hoặc dò theo PLAYER_HOST / UPDATE_URL).
     Rời Trang chủ thì tạm dừng, quay lại phát tiếp đúng chỗ. Hết bài tự sang bài kế. */
  var Songs = (function () {
    var list = null, base = '', src = '', loading = null, failedAt = 0, au = null, idx = -1, order = [], pos = 0, fadeT = 0, fading = false, want = false, lastUrl = '';
    var SVOL = { min: 0.12, low: 0.35, mid: 0.6, high: 0.9 };
    function svol() {
      var v = SVOL[cfg().MUSIC_VOL] || SVOL.low, sg = list && list[idx];   // cân bằng âm lượng: mọi bài nghe đều nhau (gain do trang quản trị đo)
      if (sg && sg.gain && cfg().MUSIC_LEVEL !== false) v = v * Math.pow(10, Math.max(-12, Math.min(6, sg.gain)) / 20);
      return Math.min(1, v);
    }
    function urls() {
      var out = [], c = cfg();
      function add(u) { if (u && out.indexOf(u) < 0) out.push(u); }
      function fromBase(b) {
        b = String(b || '').trim(); if (!b) return;
        if (/\.json$/.test(b)) { add(b); return; }
        if (b.slice(-1) !== '/') b += '/';
        add(b + 'music/list.json');
      }
      fromBase(c.MUSIC_URL);
      if (/^https?:/.test(w.location.protocol) && !w.AndroidApp && !w.tizen) add('music/list.json');
      try { (w.Api && w.Api.updateUrls ? w.Api.updateUrls() : []).forEach(function (u) { if (/^https?:/.test(u)) add(u.replace(/version\.json(\?.*)?$/, 'music/list.json')); }); } catch (e) { /* bỏ qua */ }
      add('music/list.json');   // nhạc chép sẵn trong app (nếu có)
      return out;
    }
    function getJSON(u) {
      return new Promise(function (ok, no) {
        var x = new XMLHttpRequest();
        x.open('GET', u + (u.indexOf('?') < 0 ? '?t=' : '&t=') + Math.floor(Date.now() / 600000), true);
        x.timeout = 8000;
        x.onload = function () { if (x.status >= 200 && x.status < 300 || (x.status === 0 && x.responseText)) { try { ok(JSON.parse(x.responseText)); } catch (e) { no(e); } } else no({ status: x.status }); };
        x.onerror = x.ontimeout = function () { no({ net: true }); };
        x.send();
      });
    }
    function load(force) {
      if (loading && !force) return loading;
      var us = urls(), i = 0;
      function next() {
        if (i >= us.length) { list = []; failedAt = Date.now(); return Promise.resolve([]); }
        var u = us[i++];
        return getJSON(u).then(function (j) {
          var songs = (j && (j.songs || j)) || [];
          if (!songs.length) return next();
          base = u.replace(/[^\/]*$/, ''); src = u;
          list = songs.filter(function (x) { return x && x.file; });
          shuffle();
          return list;
        }, next);
      }
      loading = next();
      return loading;
    }
    function shuffle() {
      order = (list || []).map(function (_, i) { return i; });
      if (cfg().MUSIC === 'songsx') for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; }
      pos = idx >= 0 ? Math.max(0, order.indexOf(idx)) : 0;
    }
    // iPhone/iPad không cho đổi audio.volume: đi qua Web Audio (GainNode) để chỉnh được âm lượng như máy khác
    var IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var actx = null, gn = null, gv = 1;
    function graph() {
      if (!IOS || gn || !au) return;
      try {
        if (!actx) actx = new (w.AudioContext || w.webkitAudioContext)();
        if (actx.state !== 'running') { actx.resume(); return; }
        var src0 = actx.createMediaElementSource(au); gn = actx.createGain(); gn.gain.value = gv;
        src0.connect(gn); gn.connect(actx.destination);
      } catch (e) { IOS = false; }
    }
    function vget() { return gn ? gv : el().volume; }
    function vset(v) { gv = v; if (gn) { try { gn.gain.value = v; } catch (e) { /* bỏ qua */ } } else { try { el().volume = v; } catch (e) { /* bỏ qua */ } } }
    function el() {
      if (au) return au;
      au = new Audio(); au.preload = 'auto';
      au.addEventListener('ended', function () {
        if (sleepEnd) { sleepEnd = false; userPaused = true; want = false; paintPill(); if (w.UI && w.UI.toast) w.UI.toast('🌙 Hết bài, đã tắt nhạc'); return; }
        next();
      });
      au.addEventListener('error', function () { if (w.Log) w.Log.warn('Không phát được bài nhạc: ' + lastUrl); setTimeout(next, 1500); });
      return au;
    }
    function fade(to, ms, done) {
      clearInterval(fadeT); fading = true;
      var from = vget(), n = Math.max(1, Math.round(ms / 50)), k = 0;
      fadeT = setInterval(function () {
        k++; vset(Math.max(0, Math.min(1, from + (to - from) * k / n)));
        if (k >= n) { clearInterval(fadeT); fading = false; if (done) done(); }
      }, 50);
    }
    function play(i) {
      if (!list || !list.length) return;
      idx = ((i % list.length) + list.length) % list.length;
      pos = Math.max(0, order.indexOf(idx));
      var a = el(), u = base + encodeURI(list[idx].file).replace(/#/g, '%23');
      lastUrl = u; counted = false;
      vset(0);
      a.src = u;
      want = true;
      var pr = a.play(); if (pr && pr.catch) pr.catch(function () { /* chờ lần bấm đầu */ });
      fade(svol(), 1500);
      paintPill();
    }
    function next() { if (!list || !list.length) return; pos = (pos + 1) % order.length; if (pos === 0 && cfg().MUSIC === 'songsx') shuffle(); play(order[pos]); }
    function pause() {
      if (!au || au.paused) return;
      want = false;
      fade(0, 600, function () { if (!want) au.pause(); paintPill(); });
    }
    function resume() {
      var a = el(); want = true;
      if (a.paused) { var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); }
      fade(svol(), 1200);
    }
    var lastMode = '', userPaused = false, wasPage = false;
    // Đếm lượt nghe (quá 30 giây) cho báo cáo tuần; hẹn giờ tắt nhạc
    var counted = false, sleepAt = 0, sleepEnd = false, sleeping = false;
    function count() {
      if (counted || !au || au.paused || !want || idx < 0 || !list || !list[idx] || (au.currentTime || 0) < 30) return;
      counted = true;
      try { if (w.Store && w.Store.addPlay) w.Store.addPlay(list[idx].file); } catch (e) { /* bỏ qua */ }
      try { if (w.Tele && w.Tele.play) w.Tele.play(list[idx].file, list[idx].title); } catch (e) { /* bỏ qua */ }
    }
    function sleepTick() {
      if (!sleepAt || sleeping || Date.now() < sleepAt) return;
      sleepAt = 0;
      if (!au || au.paused) return;
      sleeping = true; want = true;
      fade(0, 30000, function () { sleeping = false; userPaused = true; want = false; if (au) au.pause(); paintPill(); if (w.UI && w.UI.toast) w.UI.toast('🌙 Đã tắt nhạc theo hẹn giờ'); });
    }
    function tick() {
      count(); sleepTick();
      if (sleeping) return;
      var m = cfg().MUSIC, page = onMusicPage(), mode = (m === 'songs' || m === 'songsx' || m == null) || page;
      if (wasPage && !page) userPaused = false;   // rời trang Nhạc: Trang chủ phát lại như thường
      wasPage = page;
      if (userPaused) { if (au && !au.paused && !fading) pause(); return; }
      if (mode && list === null) { load(); return; }
      if (mode && list && !list.length && Date.now() - failedAt > 600000) { loading = null; list = null; return; }   // thử lại sau 10 phút
      if (m !== lastMode) { lastMode = m; if (list && list.length) shuffle(); }
      if (!mode || !list || !list.length) { if (au && !au.paused) pause(); idx = mode ? idx : -1; return; }
      if (!unlocked || !onHome()) { pause(); return; }
      if (idx < 0) { play(order[0]); return; }
      if (au && au.paused && !want) resume();
      else if (au && !au.paused && Math.abs(vget() - svol()) > 0.03 && !fading) vset(svol());
    }
    return {
      ok: function () { return !!(list && list.length) || list === null; },
      list: function () { return (list || []).map(function (x) { return { title: x.title, dur: x.dur || 0 }; }); },
      index: function () { return idx; },
      title: function () { var m = cfg().MUSIC; return ((m === 'songs' || m === 'songsx' || m == null) || onMusicPage()) && list && idx >= 0 && list[idx] ? list[idx].title : ''; },
      song: function (i) { return list && list[i == null ? idx : i] || null; },
      all: function () { return list || []; },
      time: function () { return au ? au.currentTime || 0 : 0; },
      duration: function () { return au && isFinite(au.duration) ? au.duration : (list && list[idx] ? list[idx].dur || 0 : 0); },
      isPlaying: function () { return !!au && !au.paused && want; },
      // Hẹn giờ tắt nhạc: số phút, 'end' = hết bài này, 0 = tắt hẹn giờ
      sleep: function (m) { sleepEnd = m === 'end'; sleepAt = m > 0 ? Date.now() + m * 60000 : 0; if (!m && sleeping) { sleeping = false; clearInterval(fadeT); fading = false; vset(svol()); } },
      sleepInfo: function () { return sleepEnd ? { end: true } : sleepAt ? { left: Math.max(0, sleepAt - Date.now()), min: 0 } : sleeping ? { fading: true } : null; },
      userPaused: function () { return userPaused; },
      toggle: function () {
        if (!list || !list.length) return;
        if (idx < 0) { userPaused = false; play(order[0] || 0); return; }
        if (userPaused || !au || au.paused) { userPaused = false; resume(); } else { userPaused = true; pause(); }
      },
      prev: function () {
        if (!list || !list.length) return;
        if (au && au.currentTime > 4) { au.currentTime = 0; return; }
        pos = (pos - 1 + order.length) % order.length; userPaused = false; play(order[pos]);
      },
      seek: function (sec) { if (au && isFinite(au.duration)) { au.currentTime = Math.max(0, Math.min(au.duration - 0.5, sec)); } },
      reshuffle: function () { shuffle(); },
      order: function () { return order.slice(); },
      url: function (i) { return list && list[i] ? base + encodeURI(list[i].file).replace(/#/g, '%23') : ''; },
      paused: function () { return !au || au.paused; },
      source: function () { return src; },
      // iPhone: lần phát đầu bị chặn nếu không nằm trong một lần chạm; chạm lần sau thì phát tiếp
      retry: function () { graph(); if (actx && actx.state !== 'running') { try { actx.resume(); } catch (e) { /* bỏ qua */ } } if (au && want && au.paused) { var pr = au.play(); if (pr && pr.catch) pr.catch(function () {}); } },
      play: function (i) { userPaused = false; play(i); },
      // phát bài i từ giây thứ sec (Đoán tên bài hát: không tính là một lượt nghe)
      playAt: function (i, sec) {
        userPaused = false; play(i); counted = true;
        var a = el(), go = function () { try { a.currentTime = Math.max(0, sec || 0); } catch (e) { /* bỏ qua */ } };
        if (a.readyState >= 1) go(); else { var f = function () { a.removeEventListener('loadedmetadata', f); go(); }; a.addEventListener('loadedmetadata', f); }
      },
      stop: function () { userPaused = true; pause(); }, next: function () { userPaused = false; next(); }, tick: tick, load: function (f) { if (f) { loading = null; list = null; } return load(true); }
    };
  })();

  /* ---------- Ô nhỏ "♪ tên bài" ở góc Trang chủ ---------- */
  function paintPill() {
    var p = d.getElementById('musicpill');
    var sname = Songs.title();
    var show = (playing >= 0 || !!sname) && onHome() && !onMusicPage();
    if (!show) { if (p) p.classList.add('hidden'); return; }
    if (!p) {
      p = d.createElement('div'); p.id = 'musicpill';
      p.innerHTML = '<span class="eq"><i></i><i></i><i></i></span><span class="mt"></span>';
      p.title = 'Bấm để chuyển bài';
      p.onclick = function (e) { e.stopPropagation(); Music.next(); };
      (d.getElementById('app') || d.body).appendChild(p);
    }
    p.querySelector('.mt').textContent = sname || TRACKS[playing].name;
    p.classList.toggle('paused', !!sname && Songs.paused());
    p.classList.remove('hidden');
  }

  var Music = {
    tracks: function () { return TRACKS.map(function (t) { return t.name; }); },
    playing: function () { return Songs.title() || (playing >= 0 ? TRACKS[playing].name : ''); },
    songs: function () { return Songs.list(); },
    songIndex: function () { return Songs.index(); },
    playSong: function (i) { Songs.play(i); },
    S: Songs,   // trang Nhạc dùng trực tiếp: song, all, time, duration, toggle, prev, next, seek…
    onPage: onMusicPage,
    reloadSongs: function () { return Songs.load(true); },
    songsSource: function () { return Songs.source(); },
    next: function () {
      if (songsMode()) { Songs.next(); return; } var n = ((playing < 0 ? autoIdx : playing) + 1) % TRACKS.length; autoIdx = n; if (cfg().MUSIC !== 'auto' && w.Settings) w.Settings.set('MUSIC', 'auto'); fadeTo(n); },
    // Dựng sẵn vài giây nhạc (dùng để kiểm tra, xuất file nghe thử)
    render: function (i, secs) {
      var OAC = w.OfflineAudioContext || w.webkitOfflineAudioContext, sr = 44100;
      var oc = new OAC(2, Math.floor(sr * secs), sr), t = TRACKS[i], n = chain(oc, oc.destination);
      n.master.gain.value = 0.5;
      var e = 60 / t.bpm / 2;
      schedule(oc, n.input, t, buildTrack(t), 0, Math.ceil(secs / e), 0.05);
      return oc.startRendering();
    }
  };
  w.Music = Music;
})(window);
