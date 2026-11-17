/* Trang Nhạc: nghe "Nhạc của tôi" với lời chạy theo bài và ảnh phim tổng tài đổi chậm.
   Hai kiểu: A (chia đôi: ảnh + lời + danh sách tiếp theo) và B (toàn màn hình kiểu karaoke).
   Lời lấy từ music/list.json (mỗi câu có giờ ước lượng tự động); bấm "Chỉnh lời" để canh giờ đúng bằng tay. */
(function (w, d) {
  'use strict';
  var UI = null;
  function el(a, b, c) { return w.UI.el(a, b, c); }
  var IMG_MS = 8000;
  var DAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  function M() { return w.Music && w.Music.S; }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  /* 2.47.0: vuốt ngang để tua bài hát (cả trang Nhạc), kéo trên thanh thời gian để tua tới đúng chỗ */
  function swipeSeek(root, bars) {
    var S = M(); if (!root || !S) return;
    var ov = null, st = null;
    function show(txt, sub) {
      if (!ov) { ov = d.createElement('div'); ov.className = 'mswipe'; d.body.appendChild(ov); }
      ov.innerHTML = '<b>' + txt + '</b><span>' + sub + '</span>'; ov.style.display = 'flex';
    }
    function hide() { if (ov) ov.style.display = 'none'; }
    function onBar(t) { for (var i = 0; i < (bars || []).length; i++) if (bars[i] && bars[i].contains(t)) return bars[i]; return null; }
    root.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { st = null; return; }
      var t = e.touches[0], tg = e.target;
      if (tg.closest && tg.closest('input, textarea, .track, .mpills, .emp-next')) { st = null; return; }
      var dur = S.duration ? S.duration() : 0;
      if (!dur || !isFinite(dur)) { st = null; return; }
      st = { x: t.clientX, y: t.clientY, t0: S.time ? S.time() : 0, dur: dur, bar: onBar(tg), on: false, to: 0 };
    }, { passive: true });
    root.addEventListener('touchmove', function (e) {
      if (!st) return;
      var t = e.touches[0], dx = t.clientX - st.x, dy = t.clientY - st.y;
      if (!st.on) {
        if (st.bar) st.on = Math.abs(dx) > 4 || Math.abs(dy) < 30;
        else if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.4) st.on = true;
        else if (Math.abs(dy) > 18) { st = null; return; }
        if (!st.on) return;
      }
      if (e.cancelable) e.preventDefault();
      if (st.bar) { var r = st.bar.getBoundingClientRect(); st.to = Math.max(0, Math.min(1, (t.clientX - r.left) / r.width)) * st.dur; }
      else st.to = st.t0 + dx / (w.innerWidth || 400) * 60;   // vuốt hết bề ngang màn hình = 1 phút
      st.to = Math.max(0, Math.min(st.dur - 1, st.to));
      var df = Math.round(st.to - st.t0);
      show((df >= 0 ? '+' : '−') + fmt(Math.abs(df)), 'tới ' + fmt(st.to) + ' / ' + fmt(st.dur));
    }, { passive: false });
    function end() {
      if (st && st.on) { S.seek(st.to); root._swipedAt = Date.now(); }
      st = null; setTimeout(hide, 250);
    }
    root.addEventListener('touchend', end); root.addEventListener('touchcancel', end);
    (bars || []).forEach(function (b) {   // chạm vào thanh thời gian: nhảy tới chỗ đó
      if (!b || b.onclick) return;
      b.onclick = function (e) { var r = b.getBoundingClientRect(), du = S.duration(); if (du) S.seek((e.clientX - r.left) / r.width * du); };
    });
  }
  function svg(path, size, fill) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 30) + '" height="' + (size || 30) + '" fill="' + (fill ? 'currentColor' : 'none') + '" stroke="' + (fill ? 'none' : 'currentColor') + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }
  var IC = {
    play: svg('<path d="M7 4l13 8-13 8z"/>', 40, true),
    pause: svg('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>', 40, true),
    prev: svg('<path d="M19 20 9 12l10-8v16z"/><path d="M5 19V5"/>'),
    next: svg('<path d="M5 4l10 8-10 8V4z"/><path d="M19 5v14"/>'),
    shuffle: svg('<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>'),
    mic: svg('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/>', 26),
    full: svg('<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>'),
    split: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>'),
    list: svg('<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>'),
    sync: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>')
  };

  // Giờ từng câu: đã chỉnh tay (lưu trong prefs.lrc, đồng bộ các máy) hoặc ước lượng tự động
  function lineTimes(song) {
    if (!song || !song.lyrics) return [];
    var own = (w.Store.pref('lrc', {}) || {})[song.file];
    if (own && own.length === song.lyrics.length) return own;
    return song.lyrics.map(function (l) { return l.at || 0; });
  }
  function hasOwnTimes(song) { var own = (w.Store.pref('lrc', {}) || {})[song.file]; return !!(own && own.length === (song.lyrics || []).length); }
  function lineAt(times, t) { var i = -1; for (var k = 0; k < times.length; k++) { if (times[k] <= t + 0.15) i = k; else break; } return i; }

  // Ảnh phim tổng tài từ kho phim (ảnh bìa lớn), mỗi bài bắt đầu ở một chỗ khác nhau
  var RX = /tổng tài|tong tai|chủ tịch|hào môn|tổng giám đốc|thiếu gia|bá đạo|ceo|giám đốc|vợ yêu|cưng chiều|hợp đồng hôn nhân/i;
  function images() {
    var pool = [];
    try { pool = (w.Api.pool() || []).filter(function (it) { return it && (it.hero || it.thumb) && !(w.Settings.hides && w.Settings.hides(it)); }); } catch (e) { pool = []; }
    var tt = pool.filter(function (it) {
      if (RX.test(it.title || '')) return true;
      try { return w.Api.catsOf(it).join(' ').toLowerCase().indexOf('tổng tài') >= 0; } catch (e) { return false; }
    });
    if (tt.length < 8) tt = tt.concat(pool.filter(function (it) { return tt.indexOf(it) < 0; }).slice(0, 30));
    var seen = {}, out = [];
    tt.forEach(function (it) { var u = it.hero || it.thumb; if (!seen[u]) { seen[u] = 1; out.push({ src: u, title: it.title || '', item: it.id ? it : null }); } });
    return out.slice(0, 60);
  }

  function nk0(x) { x = String(x || '').toLowerCase(); try { x = x.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* TV cũ */ } return x.replace(/đ/g, 'd'); }
  function dayNo() { var n = new Date(); return Math.floor((n.getTime() - n.getTimezoneOffset() * 60000) / 864e5); }
  // Bài hát của ngày: mỗi ngày một bài, đi lần lượt cả danh sách theo một thứ tự trộn cố định
  function songOfDay() {
    var all = M() ? M().all() : []; if (!all.length) return -1;
    var n = all.length, d0 = dayNo(), round = Math.floor(d0 / n), k = d0 % n;
    var ord = all.map(function (_, i) { return i; });
    var s0 = round * 7919 + 13; ord.sort(function (a, b) { return ((a * 2654435761 + s0) % 1009) - ((b * 2654435761 + s0) % 1009); });
    return ord[k];
  }
  // Nhạc hợp phim: bài có từ khóa nằm trong tên phim (bỏ từ chung như "tổng tài")
  var GENERIC = { 'tong tai': 1, 'yeu anh': 1, 'tim em': 1, 'tro ve': 1, 'dau long': 1, 'dich dang': 1 };
  function songForFilm(item) {
    var all = M() ? M().all() : []; if (!all.length || !item) return -1;
    var t = nk0(item.title) + ' ' + nk0(item.desc || '').slice(0, 300), best = -1, bs = 0;
    all.forEach(function (sg, i) {
      var sc = 0;
      (sg.keys || []).forEach(function (k) { k = nk0(k).trim(); if (k.length >= 4 && !GENERIC[k] && t.indexOf(k) >= 0) sc += k.length; });
      if (sc > bs) { bs = sc; best = i; }
    });
    return best;
  }
  // Ảnh nền cho bài (dùng ở Trang chủ): ảnh tải lên > phim chọn sẵn > phim trong kho có tên khớp từ khóa > phim tổng tài bất kỳ
  function songImage(i) {
    var S = M(), sg = S && S.song(i); if (!sg) return '';
    if ((sg.covers || []).length) return String(S.url(i)).replace(/[^\/]*$/, '') + sg.covers[dayNo() % sg.covers.length];
    if ((sg.films || []).length) return 'https://i.ytimg.com/vi/' + sg.films[dayNo() % sg.films.length] + '/hqdefault.jpg';
    var pool = []; try { pool = (w.Api.pool() || []).filter(function (it) { return it && (it.hero || it.thumb); }); } catch (e) { pool = []; }
    var keys = (sg.keys || []).map(nk0), hit = pool.filter(function (it) { var tt = nk0(it.title); return keys.some(function (k) { return k && tt.indexOf(k) >= 0; }); });
    var src = hit.length ? hit[dayNo() % hit.length] : images()[dayNo() % Math.max(1, images().length)];
    return src ? (src.hero || src.thumb || src.src || '') : '';
  }
  // Mở trang Nhạc và phát bài i
  function openSong(i) {
    if (!w.Music || i < 0) return;
    w.Music.playSong(i);
    if (w.Screens && w.Screens.goTab) w.Screens.goTab('music');
  }
  // Hộp hẹn giờ tắt nhạc
  function SleepSheet() {
    var UI2 = w.UI, S = M();
    var v = UI2.view(); v.classList.add('glogin');
    var box = el('div', 'gbox sleepbox');
    box.appendChild(el('div', 'gt', '🌙 Hẹn giờ tắt nhạc'));
    box.appendChild(el('div', 'gnote', 'Hết giờ: nhạc nhỏ dần trong 30 giây rồi tắt.'));
    var info = S.sleepInfo ? S.sleepInfo() : null, cur = !info ? 0 : info.end ? 'end' : -1, first = null;
    var col = el('div', 'sleepopts');
    [[0, 'Tắt hẹn giờ'], [15, '15 phút'], [30, '30 phút'], [60, '60 phút'], ['end', 'Hết bài này']].forEach(function (o) {
      var b = UI2.button(o[1] + (o[0] === cur ? '  ✓' : ''), o[0] === cur ? 'on' : '', function () {
        S.sleep(o[0]);
        UI2.toast(o[0] === 0 ? 'Đã tắt hẹn giờ' : o[0] === 'end' ? '🌙 Tắt nhạc khi hết bài này' : '🌙 Tắt nhạc sau ' + o[1]);
        w.Screens.back();
      });
      if (o[0] === cur || (cur === -1 && o[0] === 30)) first = b;
      col.appendChild(b);
    });
    box.appendChild(col); v.appendChild(box);
    return { name: 'sleep', el: v, focus: first || col.firstChild };
  }
  function sleepText() {
    var S = M(), i = S && S.sleepInfo ? S.sleepInfo() : null; if (!i) return '';
    if (i.end) return '🌙 Tắt nhạc khi hết bài';
    if (i.fading) return '🌙 Đang tắt nhạc…';
    return '🌙 Tắt nhạc sau ' + fmt(i.left / 1000);
  }

  function readMode() { return w.Settings.get('MUSIC_VIEW') === 'karaoke' ? 'karaoke' : 'split'; }

  function MusicPage() {
    UI = w.UI;
    var S = M();
    var v = el('div', 'view musicv');
    var mode = readMode();
    v.classList.add(mode === 'karaoke' ? 'mv-kara' : 'mv-split');
    var view = { name: 'music', el: v };

    // nền: 2 lớp ảnh đổi chéo
    var bgA = el('div', 'mvbg'), bgB = el('div', 'mvbg');
    v.appendChild(bgA); v.appendChild(bgB);
    v.appendChild(el('div', 'mvshade'));

    // Kiểu A: cột trái
    var left = el('div', 'mvleft');
    var art = el('div', 'mvart');
    var artA = el('div', 'mvartimg'), artB = el('div', 'mvartimg');
    art.appendChild(artA); art.appendChild(artB);
    art.appendChild(el('div', 'mvartshade'));
    var dots = el('div', 'mvdots'); art.appendChild(dots);
    var artCap = el('div', 'mvartcap', ''); art.appendChild(artCap);
    left.appendChild(art);
    var meta = el('div', 'mvmeta');
    var kicker = el('div', 'mvkick', 'NHẠC CỦA TÔI');
    var title = el('div', 'mvtitle', '');
    var sub = el('div', 'mvsub', '');
    meta.appendChild(kicker); meta.appendChild(title); meta.appendChild(sub);
    var wk = el('div', 'mvwake');   // ☀ Màn hình luôn sáng (điện thoại)
    function paintWake() {
      if (Wake.bg()) { wk.style.display = ''; wk.className = 'mvwake bg'; wk.innerHTML = '🔒 Nghe được cả khi khóa máy <i>· màn hình tự tắt như thường</i>'; return; }
      wk.className = 'mvwake';
      var sh = Wake.shown(); wk.style.display = sh ? '' : 'none'; if (!sh) return;
      var o = Wake.isOn(); wk.classList.toggle('off', !o);
      wk.innerHTML = o ? '☀ Màn hình luôn sáng <i>· chạm để tắt</i>' : '🌙 Máy tự khóa như thường <i>· chạm để giữ sáng</i>';
    }
    wk.onclick = function () { if (Wake.bg()) { if (w.UI) w.UI.toast('🔒 Khóa máy hoặc mở app khác vẫn nghe. Tắt trong Cài đặt → Nhạc → Nghe nhạc khi khóa máy', 4500); return; } var o = Wake.toggle(); paintWake(); if (w.UI) w.UI.toast(o ? '☀ Màn hình luôn sáng ở trang Nhạc' : '🌙 Máy sẽ tự khóa như thường (khóa màn hình là iPhone dừng nhạc)', 3500); };
    meta.appendChild(wk); paintWake();
    var wkT = setInterval(function () { if (!wk.parentNode || !d.body.contains(wk)) { clearInterval(wkT); return; } paintWake(); }, 1000);
    try { if (Wake.shown() && !w.localStorage.getItem('tt.wakeTip')) { w.localStorage.setItem('tt.wakeTip', '1'); setTimeout(function () { if (w.UI) w.UI.toast('☀ Ở trang Nhạc, màn hình luôn sáng để nhạc không bị tắt', 4500); }, 1200); } } catch (e) { /* bỏ qua */ }
    var msum = el('div', 'mvsum');   // tóm tắt bài (điện thoại: luôn hiện dưới tên bài)
    meta.appendChild(msum);
    left.appendChild(meta);
    var prog = el('div', 'mvprog'), bar = el('div', 'mvbar'), fill = el('div', 'mvfill');
    bar.appendChild(fill); prog.appendChild(bar);
    var tl = el('div', 'mvtimes'), tNow = el('span', '', '0:00'), tTot = el('span', '', '0:00');
    tl.appendChild(tNow); tl.appendChild(tTot); prog.appendChild(tl);
    left.appendChild(prog);
    bar.onclick = function (e) { var r = bar.getBoundingClientRect(); S.seek((e.clientX - r.left) / r.width * S.duration()); };
    swipeSeek(v, [bar]);

    function cbtn(cls, icon, label, fn) {
      var b = el('div', 'mvbtn f ' + cls);
      b.innerHTML = icon;
      b.setAttribute('aria-label', label); b.title = label;
      b._ok = fn;
      return b;
    }
    var ctr = el('div', 'mvctrl');
    var bShuf = cbtn('sm', IC.shuffle, 'Trộn bài', function () {
      var x = w.Settings.get('MUSIC') === 'songsx';
      w.Settings.set('MUSIC', x ? 'songs' : 'songsx'); S.reshuffle();
      UI.toast(x ? 'Phát lần lượt' : 'Trộn bài'); paintCtl();
    });
    var bPrev = cbtn('md', IC.prev, 'Bài trước', function () { S.prev(); });
    var bPlay = cbtn('lg', IC.pause, 'Phát / dừng', function () { S.toggle(); setTimeout(paintCtl, 80); });
    var bNext = cbtn('md', IC.next, 'Bài kế', function () { S.next(); });
    var bMode = cbtn('sm', mode === 'karaoke' ? IC.split : IC.full, mode === 'karaoke' ? 'Kiểu A: chia đôi' : 'Kiểu B: toàn màn hình', function () { setMode(mode === 'karaoke' ? 'split' : 'karaoke'); });
    var bSync = cbtn('sm', IC.sync, 'Chỉnh lời theo nhạc', function () { var i = S.index(); if (i >= 0) w.Screens.push(LrcSync(i)); });
    var bList = cbtn('sm', IC.list, 'Tất cả bài', function () { w.Screens.push(SongList()); });
    var bSleep = cbtn('sm', IC.moon, 'Hẹn giờ tắt nhạc', function () { w.Screens.push(SleepSheet()); });
    [bShuf, bPrev, bPlay, bNext, bMode, bSync, bList, bSleep].forEach(function (b) { ctr.appendChild(b); });
    left.appendChild(ctr);
    v.appendChild(left);

    // lời bài hát
    var lyr = el('div', 'mvlyr');
    var lhead = el('div', 'mvlhead');
    var micI = el('span', 'mvmic'); micI.innerHTML = IC.mic;
    var tag = el('span', 'mvtag', '');
    lhead.appendChild(micI); lhead.appendChild(tag); lhead.appendChild(el('span', 'mvline'));
    lyr.appendChild(lhead);
    var win = el('div', 'mvwin'), lines = el('div', 'mvlines');
    win.appendChild(lines); lyr.appendChild(win);
    var intro = el('div', 'mvintro');   // TV / máy tính: tóm tắt bài hiện trong khung lời lúc nhạc dạo
    lyr.appendChild(intro);
    var note = el('div', 'mvnote', '');
    lyr.appendChild(note);
    v.appendChild(lyr);

    // Kiểu B: đầu trang (ảnh nhỏ + tên bài, đồng hồ)
    var top = el('div', 'mvtop');
    var mini = el('div', 'mvmini');
    var mt = el('div', 'mvmt'), mk = el('div', 'mvkick', ''), mtt = el('div', 'mvtitle', ''), ms = el('div', 'mvsub', '');
    mt.appendChild(mk); mt.appendChild(mtt); mt.appendChild(ms);
    top.appendChild(mini); top.appendChild(mt);
    var clk = el('div', 'mvclock'), clkT = el('div', 'mvct', ''), clkD = el('div', 'mvcd', '');
    clk.appendChild(clkT); clk.appendChild(clkD);
    v.appendChild(top); v.appendChild(clk);
    var slp = el('div', 'mvsleep hidden', ''); v.appendChild(slp);   // đồng hồ đếm ngược hẹn giờ tắt nhạc

    // Kiểu A: hàng "Tiếp theo"
    var qwrap = el('div', 'mvqueue');
    var qh = el('div', 'mvqh', 'Tiếp theo');
    var qrow = el('div', 'mvqrow');
    qwrap.appendChild(qh); qwrap.appendChild(qrow);
    v.appendChild(qwrap);

    var imgs = images(), imgK = 0, imgLayer = 0, lastImgAt = 0;
    var curIdx = -2, times = [], curLine = -2;

    function setBg(layerPair, src) {
      var a = layerPair[imgLayer], b = layerPair[1 - imgLayer];
      b.style.backgroundImage = src ? 'url("' + src.replace(/"/g, '%22') + '")' : '';
      b.classList.remove('kb1', 'kb2'); void b.offsetWidth; b.classList.add(Math.random() < 0.5 ? 'kb1' : 'kb2');
      b.classList.add('on'); a.classList.remove('on');
    }
    // Ảnh của từng bài (10 ảnh, đổi mỗi 8 giây):
    // 1) ảnh tự tải lên trong trang quản trị (covers)  2) phim chọn sẵn (films: mã video YouTube)
    // 3) tự chọn 10 phim thật trong kho phim có tên hợp với bài (keys: từ khóa), đổi mỗi ngày
    function nk(x) { x = String(x || '').toLowerCase(); try { x = x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* TV cũ */ } return x.replace(/đ/g, 'd'); }
    function coversOf(i0) {
      var i = i0 == null ? S.index() : i0, sg = S.song(i);
      if (!sg) return null;
      var up = sg.covers || (sg.cover ? [sg.cover] : []);
      if (up.length) {
        var u = String(S.url ? S.url(i) : '').replace(/[^\/]*$/, '');
        return up.map(function (c) { return { src: u + c, title: '', cover: true }; });
      }
      var pool = []; try { pool = (w.Api.pool() || []).filter(function (it) { return it && (it.hero || it.thumb) && !(w.Settings.hides && w.Settings.hides(it)); }); } catch (e) { pool = []; }
      var byId = {}; pool.forEach(function (it) { byId[it.id] = it; });
      var out = [], seen = {};
      function add(it) { var src = it.hero || it.thumb; if (!src || seen[src] || out.length >= 10) return; seen[src] = 1; out.push({ src: src, title: it.title || '', item: it.id ? it : null }); }
      (sg.films || []).forEach(function (id) { add(byId[id] || { id: id, kind: 'film', hero: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg', thumb: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg', title: 'Phim trên YouTube' }); });
      if (out.length < 10 && pool.length) {
        var keys = (sg.keys && sg.keys.length ? sg.keys : [sg.title]).map(nk);
        var day = Math.floor(Date.now() / 864e5), hs = function (t) { var h = day; for (var q = 0; q < t.length; q++) h = (h * 31 + t.charCodeAt(q)) | 0; return h; };
        var hit = pool.filter(function (it) { var t = nk(it.title); return keys.some(function (k) { return t.indexOf(k) >= 0; }); });
        hit.sort(function (a, b) { return hs(sg.file + a.id) - hs(sg.file + b.id); });
        hit.forEach(add);
        if (out.length < 10) imgs.slice().sort(function (a, b) { return hs(sg.file + a.src) - hs(sg.file + b.src); }).forEach(function (it) { add(it.item ? it.item : { hero: it.src, title: it.title }); });
      }
      return out.length ? out : null;
    }
    var covK = 0, covList = null, curFilm = null;
    // Bấm vào ảnh phim (hoặc OK trên remote): hỏi có mở phim đó không
    art.classList.add('f');
    art._ok = function () { if (curFilm && w.Screens && Screens.askFilm) Screens.askFilm(curFilm); };
    art.addEventListener('click', function () { art._ok(); });
    function nextImage() {
      lastImgAt = Date.now();
      covList = coversOf();
      if (covList && covList.length === 1 && v.classList.contains('hascover') && artCap.dataset.src === covList[0].src) return;
      if (!covList && !imgs.length) { v.classList.add('noimg'); return; }
      var it = covList ? covList[covK % covList.length] : imgs[imgK % imgs.length];
      if (covList) covK++; else imgK++;
      artCap.dataset.src = it.src; v.classList.toggle('hascover', !!(it && it.cover));
      curFilm = it.item || null; art.classList.toggle('canopen', !!curFilm); v.classList.remove('noimg');
      var pre = new Image();
      pre.onload = pre.onerror = function () {
        setBg([bgA, bgB], it.src); setBg([artA, artB], it.src);
        imgLayer = 1 - imgLayer;
        artCap.textContent = it.title;
        mini.style.backgroundImage = 'url("' + it.src.replace(/"/g, '%22') + '")';
        paintDots();
      };
      pre.src = it.src;
    }
    function paintDots() {
      dots.innerHTML = '';
      var n = covList ? covList.length : Math.min(6, imgs.length), on = covList ? (covK - 1) % n : (imgK - 1) % n;
      if (n < 2) return;
      for (var i = 0; i < n; i++) dots.appendChild(el('i', i === on ? 'on' : ''));
    }

    function renderSong() {
      var i = S.index(), song = S.song(i);
      curIdx = i; curLine = -2;
      lines.innerHTML = '';
      if (!song) {
        title.textContent = mtt.textContent = 'Nhạc của tôi';
        sub.textContent = ms.textContent = S.all().length ? 'Đang chuẩn bị…' : 'Chưa tải được danh sách nhạc';
        note.textContent = S.all().length ? '' : 'Bản web: chép thư mục music/ lên cùng chỗ với app. TV: Cài đặt → Kết nối → Địa chỉ nhạc.';
        return;
      }
      times = lineTimes(song);
      paintSummary(song);
      var n = S.all().length;
      title.textContent = mtt.textContent = song.title;
      sub.textContent = ms.textContent = 'Ryan Nguyen · Bài ' + (i + 1) + ' / ' + n;
      kicker.textContent = mk.textContent = 'NHẠC CỦA TÔI' + (w.Settings.get('MUSIC') === 'songsx' ? ' · TRỘN BÀI' : '');
      (song.lyrics || []).forEach(function (l, k) {
        var e = el('div', 'mvl', l.t);
        e.dataset.k = k;
        lines.appendChild(e);
      });
      if (!(song.lyrics || []).length) lines.appendChild(el('div', 'mvl cur', '♪ Bài này chưa có lời'));
      note.textContent = hasOwnTimes(song) ? 'Lời đã canh giờ bằng tay' : song.lrcAuto === false ? 'Lời đã canh giờ theo nhạc' : 'Lời canh giờ tự động, có thể lệch vài giây · bấm ⏱ “Chỉnh lời” để canh đúng';
      // ảnh: mỗi bài bắt đầu ở chỗ khác
      imgK = imgs.length ? (i * 5) % imgs.length : 0; covK = 0;
      nextImage();
      renderQueue();
    }
    function sumHTML(song, cls) {
      var esc = function (x) { return String(x || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
      var ex = song.ex || [];
      return (song.sum ? '<p class="' + cls + 'p">' + esc(song.sum) + '</p>' : '') +
        (ex.length ? '<blockquote class="' + cls + 'q">' + ex.map(esc).join('<br>') + '</blockquote>' : '');
    }
    function paintSummary(song) {
      var has = !!(song && (song.sum || (song.ex && song.ex.length)));
      msum.innerHTML = has ? sumHTML(song, 'mvs') : '';
      msum.style.display = has ? '' : 'none';
      intro.innerHTML = has ? '<div class="mvik"><span class="mvik0">♪ NHẠC DẠO · </span>GIỚI THIỆU BÀI HÁT</div>' + sumHTML(song, 'mvi') +
        (times.length && times[0] > 3 ? '<div class="mvin">♪ Lời bắt đầu ở ' + fmt(times[0]) + '</div>' : '') : '';
      lyr.classList.toggle('hasintro', has);
    }
    function renderQueue() {
      qrow.innerHTML = '';
      var ord = S.order(), all = S.all(), i = S.index(), p = ord.indexOf(i);
      for (var k = 1; k <= 5 && k < all.length; k++) {
        var j = ord[(p + k) % ord.length], s = all[j];
        if (!s) continue;
        var c = el('div', 'mvq f');
        var cl = coversOf(j), im = cl && cl.length ? cl[0].src : imgs.length ? imgs[(j * 5 + 2) % imgs.length].src : '';   // ảnh đầu tiên của bài đó
        if (im) c.style.backgroundImage = 'url("' + im.replace(/"/g, '%22') + '")';
        c.appendChild(el('div', 'mvqshade'));
        var tt = el('div', 'mvqt');
        tt.appendChild(el('div', 'mvqn', s.title));
        tt.appendChild(el('div', 'mvqd', fmt(s.dur)));
        c.appendChild(tt);
        (function (jj) { c._ok = function () { S.play(jj); }; })(j);
        qrow.appendChild(c);
      }
    }

    function paintLine(t) {
      var song = S.song(); if (!song || !song.lyrics) return;
      var k = lineAt(times, t);
      var kids = lines.children;
      if (k !== curLine) {
        curLine = k;
        for (var j = 0; j < kids.length; j++) {
          var c = kids[j], dk = j - k;
          c.className = 'mvl' + (dk === 0 ? ' cur' : dk === -1 ? ' past p1' : dk < 0 ? ' past' : dk <= 3 ? ' nx' + dk : ' far');
        }
        // đoạn (Lời 1, Điệp khúc…)
        var tg = '';
        for (var q = Math.max(0, k); q >= 0; q--) { if (song.lyrics[q] && song.lyrics[q].s) { tg = song.lyrics[q].s; break; } }
        tag.textContent = k < 0 ? 'NHẠC DẠO' : tg;
        lyr.classList.toggle('inintro', k < 0);
        // đưa câu đang hát vào giữa khung
        var target = kids[Math.max(0, k)];
        if (target) {
          var off = target.offsetTop - (win.clientHeight * (mode === 'karaoke' ? 0.5 : 0.36)) + target.offsetHeight / 2;
          lines.style.transform = 'translateY(' + (-Math.max(0, off)) + 'px)';
        }
      }
      // tô màu dần câu đang hát (kiểu karaoke)
      var cur = kids[k];
      if (cur && k >= 0) {
        var a = times[k], b = times[k + 1] != null ? times[k + 1] : a + 4;
        var p = Math.max(0, Math.min(1, (t - a) / Math.max(0.8, Math.min(b - a, 8) - 0.3)));
        var L = song.lyrics[k], ws = L && L.w;
        if (!song.mode || song.mode === 'line') p = 1;        // mặc định: hiện cả câu
        else if (song.mode === 'word' && ws && ws.length) {     // chạy theo từng chữ (giờ từng chữ từ file .ass)
          var sh = a - (L.at || a), tot = 0, done = 0;           // sh: lệch khi người dùng tự chỉnh giờ câu
          ws.forEach(function (x) { tot += String(x[1]).length + 1; });
          for (var q = 0; q < ws.length; q++) {
            var ln = String(ws[q][1]).length + 1, s0 = ws[q][0] + sh, s1 = ws[q + 1] ? ws[q + 1][0] + sh : Math.min(b, s0 + 1.2);
            if (t >= s1) done += ln; else { if (t > s0) done += ln * (t - s0) / Math.max(0.05, s1 - s0); break; }
          }
          p = Math.min(1, done / Math.max(1, tot));
        }
        cur.style.backgroundSize = (p * 100).toFixed(1) + '% 100%, 100% 100%';
      }
    }

    function paintCtl() {
      var playing = S.isPlaying();
      bPlay.innerHTML = playing ? IC.pause : IC.play;
      bShuf.classList.toggle('on', w.Settings.get('MUSIC') === 'songsx');
    }
    function paintClock() {
      var n = new Date();
      clkT.textContent = UI.hhmm ? UI.hhmm(n.getTime()) : n.toTimeString().slice(0, 5);
      clkD.textContent = DAYS[n.getDay()] + ', ' + n.getDate() + ' tháng ' + (n.getMonth() + 1);
    }

    function setMode(m) {
      mode = m;
      w.Settings.set('MUSIC_VIEW', m);
      v.classList.toggle('mv-kara', m === 'karaoke');
      v.classList.toggle('mv-split', m !== 'karaoke');
      bMode.innerHTML = m === 'karaoke' ? IC.split : IC.full;
      bMode.title = m === 'karaoke' ? 'Kiểu A: chia đôi' : 'Kiểu B: toàn màn hình';
      curLine = -2;
      UI.toast(m === 'karaoke' ? 'Kiểu B: toàn màn hình' : 'Kiểu A: chia đôi');
    }

    var timer = setInterval(function () {
      if (!v.parentNode) { clearInterval(timer); return; }
      if (v.style.display === 'none') return;
      if (S.index() !== curIdx) renderSong();
      var stx = sleepText(); if (slp.textContent !== stx) slp.textContent = stx; slp.classList.toggle('hidden', !stx); bSleep.classList.toggle('on', !!stx);
      var t = S.time(), du = S.duration();
      fill.style.width = du ? (t / du * 100).toFixed(2) + '%' : '0';
      tNow.textContent = fmt(t); tTot.textContent = fmt(du);
      paintLine(t);
      paintCtl();
      if (Date.now() - lastImgAt > IMG_MS) nextImage();
    }, 200);
    var ct = setInterval(function () { if (!v.parentNode) { clearInterval(ct); return; } paintClock(); }, 15000);
    paintClock();

    // bắt đầu phát ngay khi mở trang (nếu chưa phát)
    function startIfIdle() {
      var all = S.all();
      if (!all.length) { if (w.Music.reloadSongs) w.Music.reloadSongs().then(function () { renderSong(); startIfIdle(); }); return; }
      if (S.index() < 0) S.play(S.order()[0] || 0);
    }
    startIfIdle();
    view.refresh = function () { imgs = images(); curIdx = -2; };
    // phím media trên remote
    view.onKeyHook = function (k) {
      if (k === 415 || k === 19 || k === 10252) { S.toggle(); return true; }   // Play / Pause
      if (k === 417) { S.next(); return true; }   // ⏭
      if (k === 412) { S.prev(); return true; }   // ⏮
      return false;
    };
    setTimeout(function () { w.Nav.focus(bPlay); }, 0);
    renderSong();
    return view;
  }

  /* 2.43: Nghe nhạc cho chế độ ông bà: ảnh phim đổi chậm, 3 câu hát chữ to, nút lớn */
  function ElderMusic() {
    UI = w.UI;
    var S = M();
    var v = el('div', 'view musicv elderv emus');
    var view = { name: 'music', el: v };
    var top = el('div', 'emtop');
    var art = el('div', 'emart'), artA = el('div', 'emimg'), artB = el('div', 'emimg');
    art.appendChild(artA); art.appendChild(artB);
    var cap = el('div', 'emcap', ''), dots = el('div', 'emdots');
    art.appendChild(cap); art.appendChild(dots);
    top.appendChild(art);
    var info = el('div', 'eminfo');
    var kick = el('div', 'emk', ''), ttl = el('div', 'emt', '');
    var l0 = el('div', 'eml0', ''), l1 = el('div', 'eml1', ''), l2 = el('div', 'eml2', '');
    var prog = el('div', 'emprog'), tNow = el('span', '', '0:00'), bar = el('div', 'embar'), fill = el('i'), tTot = el('span', '', '0:00');
    bar.appendChild(fill); prog.appendChild(tNow); prog.appendChild(bar); prog.appendChild(tTot);
    [kick, ttl, l0, l1, l2, prog].forEach(function (x) { info.appendChild(x); });
    swipeSeek(v, [bar]);
    top.appendChild(info);
    v.appendChild(top);
    function btn(cls, html, fn) { var b = el('div', 'emb f ' + cls); b.innerHTML = html; b._ok = fn; return b; }
    var bPrev = btn('', '⏮<span>Bài trước</span>', function () { S.prev(); });
    var bPlay = btn('on', '⏸<span>Dừng</span>', function () { S.toggle(); setTimeout(paintCtl, 80); });
    var bNext = btn('', '⏭<span>Bài sau</span>', function () { S.next(); });
    var bSleep = btn('', '🌙<span>Hẹn tắt</span>', function () { w.Screens.push(SleepSheet()); });
    var bList = btn('', '☰<span>Danh sách bài</span>', function () { w.Screens.push(SongList()); });
    var ctr = el('div', 'emctl');
    [bPrev, bPlay, bNext, bSleep, bList].forEach(function (b) { ctr.appendChild(b); });
    v.appendChild(ctr);
    var slp = el('div', 'emsleep', ''); v.appendChild(slp);
    var hint = el('div', 'ehint tonly'); hint.innerHTML = '<span><i>OK</i> Dừng / Phát</span><span><i>◀ ▶</i> Chọn nút</span><span><i>↩</i> Về trang đầu (nhạc vẫn phát)</span>'; v.appendChild(hint);

    var imgs = images(), layer = 0, list = [], k = 0, lastImg = 0, curIdx = -2, times = [], curLine = -3;
    function nk(x) { return nk0(x); }
    function coversOf(i) {
      var sg = S.song(i); if (!sg) return [];
      var up = sg.covers || (sg.cover ? [sg.cover] : []);
      if (up.length) { var u = String(S.url ? S.url(i) : '').replace(/[^\/]*$/, ''); return up.map(function (c) { return { src: u + c, title: '' }; }); }
      var out = [], seen = {};
      function add(src, t) { if (!src || seen[src] || out.length >= 10) return; seen[src] = 1; out.push({ src: src, title: t || '' }); }
      (sg.films || []).forEach(function (id) { add('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg', ''); });
      var keys = (sg.keys && sg.keys.length ? sg.keys : [sg.title]).map(nk);
      imgs.filter(function (x) { var t = nk(x.title); return keys.some(function (q) { return q && t.indexOf(q) >= 0; }); }).forEach(function (x) { add(x.src, x.title); });
      var off = (i * 5) % Math.max(1, imgs.length);
      imgs.slice(off).concat(imgs.slice(0, off)).forEach(function (x) { add(x.src, x.title); });
      return out;
    }
    function nextImg() {
      lastImg = Date.now();
      if (!list.length) { art.classList.add('noimg'); return; }
      var it = list[k % list.length]; k++;
      var pre = new Image();
      pre.onload = pre.onerror = function () {
        var a = layer ? artB : artA, b = layer ? artA : artB;
        b.style.backgroundImage = 'url("' + it.src.replace(/"/g, '%22') + '")'; b.classList.add('on'); a.classList.remove('on'); layer = 1 - layer;
        cap.textContent = it.title ? '📺 ' + it.title : ''; cap.style.display = it.title ? '' : 'none';
        dots.innerHTML = ''; var n = Math.min(list.length, 6); if (n > 1) for (var q = 0; q < n; q++) dots.appendChild(el('i', q === (k - 1) % n ? 'on' : ''));
      };
      pre.src = it.src;
    }
    function lineTxt(song, i) { var L = song && song.lyrics && song.lyrics[i]; return L ? L.t : ''; }
    function renderSong() {
      var i = S.index(), song = S.song(i); curIdx = i; curLine = -3;
      if (!song) { ttl.textContent = 'Nhạc của tôi'; kick.textContent = S.all().length ? 'ĐANG CHUẨN BỊ…' : 'CHƯA TẢI ĐƯỢC NHẠC'; l0.textContent = l1.textContent = l2.textContent = ''; return; }
      times = lineTimes(song);
      ttl.textContent = song.title;
      kick.textContent = 'ĐANG PHÁT · BÀI ' + (i + 1) + '/' + S.all().length;
      list = coversOf(i); k = 0; nextImg();
    }
    function paintLine(t) {
      var song = S.song(); if (!song) return;
      var n = (song.lyrics || []).length;
      if (!n) { if (curLine !== -9) { curLine = -9; l0.textContent = ''; l1.textContent = '♪ Bài này chưa có lời'; l2.textContent = ''; } return; }
      var q = lineAt(times, t);
      if (q === curLine) return;
      curLine = q;
      if (q < 0) { l0.textContent = ''; l1.textContent = '♪ Nhạc dạo…'; l2.textContent = lineTxt(song, 0); return; }
      l0.textContent = lineTxt(song, q - 1); l1.textContent = lineTxt(song, q); l2.textContent = lineTxt(song, q + 1);
    }
    function paintCtl() {
      var p = S.isPlaying();
      bPlay.innerHTML = p ? '⏸<span>Dừng</span>' : '▶<span>Phát</span>';
    }
    var timer = setInterval(function () {
      if (!v.parentNode) { clearInterval(timer); return; }
      if (v.style.display === 'none') return;
      if (S.index() !== curIdx) renderSong();
      var t = S.time(), du = S.duration();
      fill.style.width = du ? (t / du * 100).toFixed(2) + '%' : '0';
      tNow.textContent = fmt(t); tTot.textContent = fmt(du);
      paintLine(t); paintCtl();
      var stx = sleepText(); if (slp.textContent !== stx) slp.textContent = stx;
      if (Date.now() - lastImg > IMG_MS) nextImg();
    }, 250);
    function startIfIdle() {
      var all = S.all();
      if (!all.length) { if (w.Music.reloadSongs) w.Music.reloadSongs().then(function () { renderSong(); startIfIdle(); }); return; }
      if (S.index() < 0) S.play(S.order()[0] || 0);
    }
    startIfIdle();
    view.refresh = function () { imgs = images(); curIdx = -2; };
    view.onKeyHook = function (kc) {
      if (kc === 415 || kc === 19 || kc === 10252) { S.toggle(); return true; }
      if (kc === 417) { S.next(); return true; }
      if (kc === 412) { S.prev(); return true; }
      return false;
    };
    setTimeout(function () { w.Nav.focus(bPlay); }, 0);
    renderSong();
    return view;
  }

  /* 2.44: mục Nghe nhạc trong trang chính ông bà (TV): bài kế tiếp + ảnh phim ở trên, bài đang phát ở dưới */
  function ElderPane(host, view) {
    UI = w.UI;
    var S = M();
    var top = el('div', 'emp-top');
    var nx = el('div', 'emp-next'); nx.appendChild(el('div', 'emp-h', 'Bài kế tiếp'));
    var nxl = el('div', 'emp-nl'); nx.appendChild(nxl);
    var art = el('div', 'emp-art'), artA = el('div', 'emimg'), artB = el('div', 'emimg'), cap = el('div', 'emcap', '');
    art.appendChild(artA); art.appendChild(artB); art.appendChild(cap);
    top.appendChild(nx); top.appendChild(art); host.appendChild(top);
    var bot = el('div', 'emp-bot');
    var hr = el('div', 'emp-hr'), kick = el('span', 'emk', ''), ttl = el('span', 'emt', '');
    hr.appendChild(kick); hr.appendChild(ttl); bot.appendChild(hr);
    var l0 = el('div', 'eml0', ''), l1 = el('div', 'eml1', ''), l2 = el('div', 'eml2', '');
    bot.appendChild(l0); bot.appendChild(l1); bot.appendChild(l2);
    var prog = el('div', 'emprog'), tNow = el('span', '', '0:00'), bar = el('div', 'embar'), fill = el('i'), tTot = el('span', '', '0:00');
    bar.appendChild(fill); prog.appendChild(tNow); prog.appendChild(bar); prog.appendChild(tTot); bot.appendChild(prog);
    swipeSeek(host, [bar]);
    var ctl = el('div', 'emp-ctl');
    function btn(cls, html, fn) { var b = el('div', 'empb f ' + cls); b.innerHTML = html; b._ok = fn; return b; }
    var bPlay = btn('on', '⏸ Dừng', function () { S.toggle(); setTimeout(paint, 80); });
    var bSleep = btn('', '🌙 Hẹn tắt', function () { w.Screens.push(SleepSheet()); });
    var bNext = btn('', '⏭ Bài sau', function () { S.next(); });
    ctl.appendChild(bPlay); ctl.appendChild(bSleep); ctl.appendChild(bNext); bot.appendChild(ctl);
    var slp = el('div', 'emsleep', ''); bot.appendChild(slp);
    host.appendChild(bot);

    var imgs = images(), layer = 0, list = [], k = 0, lastImg = 0, curIdx = -2, times = [], curLine = -3;
    function coversOf(i) {
      var sg = S.song(i); if (!sg) return [];
      var up = sg.covers || (sg.cover ? [sg.cover] : []);
      if (up.length) { var u = String(S.url ? S.url(i) : '').replace(/[^\/]*$/, ''); return up.map(function (c) { return { src: u + c, title: '' }; }); }
      var out = [], seen = {};
      function add(src, t) { if (!src || seen[src] || out.length >= 10) return; seen[src] = 1; out.push({ src: src, title: t || '' }); }
      (sg.films || []).forEach(function (id) { add('https://i.ytimg.com/vi/' + id + '/hqdefault.jpg', ''); });
      var keys = (sg.keys && sg.keys.length ? sg.keys : [sg.title]).map(nk0);
      imgs.filter(function (x) { var t = nk0(x.title); return keys.some(function (q) { return q && t.indexOf(q) >= 0; }); }).forEach(function (x) { add(x.src, x.title); });
      var off = (i * 5) % Math.max(1, imgs.length);
      imgs.slice(off).concat(imgs.slice(0, off)).forEach(function (x) { add(x.src, x.title); });
      return out;
    }
    function nextImg() {
      lastImg = Date.now();
      if (!list.length) return;
      var it = list[k % list.length]; k++;
      var pre = new Image();
      pre.onload = pre.onerror = function () {
        var a = layer ? artB : artA, b = layer ? artA : artB;
        b.style.backgroundImage = 'url("' + it.src.replace(/"/g, '%22') + '")'; b.classList.add('on'); a.classList.remove('on'); layer = 1 - layer;
        cap.textContent = it.title ? '📺 ' + it.title : ''; cap.style.display = it.title ? '' : 'none';
      };
      pre.src = it.src;
    }
    function renderNext() {
      nxl.innerHTML = '';
      var ord = S.order(), all = S.all(), i = S.index(), p = ord.indexOf(i);
      for (var q = 1; q <= 3 && q < all.length; q++) {
        var j = ord[(p + q) % ord.length], s = all[j]; if (!s) continue;
        var r = el('div', 'emp-so f');
        r.appendChild(el('span', 'n', String(j + 1))); r.appendChild(el('span', 't', s.title)); r.appendChild(el('span', 'd', fmt(s.dur)));
        (function (jj) { r._ok = function () { S.play(jj); }; })(j);
        nxl.appendChild(r);
      }
    }
    function txt(song, i) { var L = song && song.lyrics && song.lyrics[i]; return L ? L.t : ''; }
    function renderSong() {
      var i = S.index(), song = S.song(i); curIdx = i; curLine = -3;
      if (!song) { ttl.textContent = 'Nhạc của tôi'; kick.textContent = S.all().length ? 'ĐANG CHUẨN BỊ…' : 'CHƯA TẢI ĐƯỢC NHẠC'; return; }
      times = lineTimes(song);
      ttl.textContent = song.title; kick.textContent = 'ĐANG PHÁT · BÀI ' + (i + 1) + '/' + S.all().length;
      list = coversOf(i); k = 0; nextImg(); renderNext();
    }
    function paint() { var p = S.isPlaying(); bPlay.innerHTML = p ? '⏸ Dừng' : '▶ Phát'; }
    var timer = setInterval(function () {
      if (!host.parentNode || !d.body.contains(host) || !view.elderMusic) { clearInterval(timer); return; }
      if (S.index() !== curIdx) renderSong();
      var t = S.time(), du = S.duration(), song = S.song();
      fill.style.width = du ? (t / du * 100).toFixed(2) + '%' : '0';
      tNow.textContent = fmt(t); tTot.textContent = fmt(du);
      if (song) {
        var n = (song.lyrics || []).length;
        if (!n) { if (curLine !== -9) { curLine = -9; l0.textContent = ''; l1.textContent = '♪ Bài này chưa có lời'; l2.textContent = ''; } }
        else { var q = lineAt(times, t); if (q !== curLine) { curLine = q; if (q < 0) { l0.textContent = ''; l1.textContent = '♪ Nhạc dạo…'; l2.textContent = txt(song, 0); } else { l0.textContent = txt(song, q - 1); l1.textContent = txt(song, q); l2.textContent = txt(song, q + 1); } } }
      }
      paint();
      var stx = sleepText(); if (slp.textContent !== stx) slp.textContent = stx;
      if (Date.now() - lastImg > IMG_MS) nextImg();
    }, 250);
    var all = S.all();
    if (!all.length) { if (w.Music.reloadSongs) w.Music.reloadSongs().then(function () { if (view.elderMusic) { if (S.index() < 0) S.play(S.order()[0] || 0); renderSong(); } }); }
    else if (S.index() < 0) S.play(S.order()[0] || 0);
    else if (S.paused && S.paused() && !(S.userPaused && S.userPaused())) { try { S.retry(); } catch (e) { /* bỏ qua */ } }
    renderSong();
    return function () { clearInterval(timer); view.elderMusic = false; };   // rời mục: nhạc tắt (music.js thấy không còn ở trang nhạc)
  }

  /* Danh sách tất cả bài */
  function SongList() {
    UI = w.UI;
    var S = M();
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Nhạc của tôi · tóm tắt các bài');
    var all = S.all();
    head.appendChild(el('span', 'rh', all.length + ' bài · ' + Math.round(all.reduce(function (a, x) { return a + (x.dur || 0); }, 0) / 60) + ' phút'));
    v.appendChild(head);
    var list = el('div', 'ordlist songlist');
    v.appendChild(list);
    var focusEl = null;
    all.forEach(function (x, i) {
      var r = el('div', 'ordrow f' + (i === S.index() ? ' now' : ''));
      r.appendChild(el('div', 'ordnum', i === S.index() ? '♪' : String(i + 1)));
      var nm = el('div', 'ordname');   // tên bài + tóm tắt + đoạn trích
      nm.appendChild(el('div', 'sgt', x.title));
      if (x.sum) nm.appendChild(el('div', 'sgs', x.sum));
      if (x.ex && x.ex.length) nm.appendChild(el('div', 'sgx', x.ex.join(' / ')));
      r.appendChild(nm);
      r.appendChild(el('div', 'ordstate', (hasOwnTimes(x) ? '⏱ ' : '') + fmt(x.dur)));
      r._ok = function () { S.play(i); w.Screens.back(); };
      if (i === S.index()) focusEl = r;
      list.appendChild(r);
    });
    setTimeout(function () { if (focusEl) w.Nav.focus(focusEl); }, 0);
    return { name: 'songlist', el: v };
  }

  /* Chỉnh lời theo nhạc: nghe từ đầu, câu nào bắt đầu hát thì bấm OK */
  function LrcSync(i) {
    UI = w.UI;
    var S = M(), song = S.song(i);
    var v = UI.view();
    v.classList.add('lrcv');
    var head = el('div', 'pagehead', 'Chỉnh lời theo nhạc');
    head.appendChild(el('span', 'rh', song.title));
    v.appendChild(head);
    v.appendChild(el('div', 'setinfo ordinfo', 'Bài hát phát lại từ đầu. Mỗi khi câu tô vàng BẮT ĐẦU được hát, bấm OK (hoặc chạm nút lớn). Bấm nhầm thì “Lùi 1 câu”. Xong câu cuối, app tự lưu.'));
    var stage = el('div', 'lrcstage');
    var prevL = el('div', 'lrcp', ''), curL = el('div', 'lrcc', ''), nextL = el('div', 'lrcn', ''), cnt = el('div', 'lrccount', '');
    stage.appendChild(prevL); stage.appendChild(curL); stage.appendChild(nextL); stage.appendChild(cnt);
    v.appendChild(stage);
    var tline = el('div', 'lrctime', '0:00');
    v.appendChild(tline);
    var bar = el('div', 'btns ordbar');
    var marks = [], n = song.lyrics.length;
    var bTap = UI.button('Câu này bắt đầu  ●', 'gold lrctap', function () { mark(); });
    var bUndo = UI.button('↶ Lùi 1 câu', '', function () {
      if (!marks.length) return;
      marks.pop();
      S.seek(Math.max(0, (marks.length ? marks[marks.length - 1] : 0) - 2));
      paint();
    });
    var bRestart = UI.button('↺ Làm lại từ đầu', '', function () { marks = []; S.seek(0); paint(); });
    var bAuto = UI.button('Dùng giờ tự động', '', function () {
      var m = w.Store.pref('lrc', {}) || {}; delete m[song.file]; w.Store.setPref('lrc', m);
      UI.toast('Đã trở về giờ tự động'); w.Screens.back();
    });
    [bTap, bUndo, bRestart, bAuto].forEach(function (b) { bar.appendChild(b); });
    v.appendChild(bar);
    function mark() {
      if (marks.length >= n) return;
      marks.push(Math.round(S.time() * 100) / 100);
      if (marks.length >= n) save(); else paint();
    }
    function save() {
      var m = w.Store.pref('lrc', {}) || {};
      m[song.file] = marks.slice();
      w.Store.setPref('lrc', m);
      UI.toast('Đã lưu giờ lời bài “' + song.title + '”');
      w.Screens.back();
    }
    function paint() {
      var k = marks.length;
      prevL.textContent = k > 0 ? song.lyrics[k - 1].t : '';
      curL.textContent = k < n ? song.lyrics[k].t : '';
      nextL.textContent = k + 1 < n ? song.lyrics[k + 1].t : '';
      cnt.textContent = 'Câu ' + Math.min(k + 1, n) + ' / ' + n + (song.lyrics[k] && song.lyrics[k].s ? ' · ' + song.lyrics[k].s : '');
    }
    var tm = setInterval(function () { if (!v.parentNode) { clearInterval(tm); return; } tline.textContent = fmt(S.time()) + ' / ' + fmt(S.duration()); }, 250);
    if (S.index() !== i) S.play(i); else { S.seek(0); if (!S.isPlaying()) S.toggle(); }
    paint();
    setTimeout(function () { w.Nav.focus(bTap); }, 0);
    return { name: 'lrcsync', el: v };
  }


  /* ---------- 2.36.2: giữ màn hình sáng ở trang Nhạc (điện thoại) ----------
     iPhone tự khóa màn hình sau 30 giây / 1 phút thì nhạc dừng. Ở trang Nhạc: xin "Screen Wake Lock" (iOS 16.4+),
     máy cũ dùng một video im lặng 16×16 phát lặp (video đang phát thì máy không tự khóa).
     Tắt khi rời trang Nhạc, khi hết hẹn giờ tắt nhạc, hoặc khi chạm nhãn ☀. */
  var Wake = (function () {
    var lock = null, vid = null, active = false, tempOff = false, sleepSeen = false, wasPage = false;
    var MP4 = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAANJbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAB9AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAnN0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAB9AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAfQAAAAAAABAAAAAAHrbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAUABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABlm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAVZzdGJsAAAAtnN0c2QAAAAAAAAAAQAAAKZhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MC4zMS4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALGF2Y0MBQsAK/+EAFWdCwAraewEQAAADABAAAAMAoPEiagEABGjOD8gAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAALUAAAC1AAAAAYc3R0cwAAAAAAAAABAAAACgAACAAAAAAUc3RzcwAAAAAAAAABAAAAAQAAABxzdHNjAAAAAAAAAAEAAAABAAAACgAAAAEAAAA8c3RzegAAAAAAAAAAAAAACgAAAoMAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAUc3RjbwAAAAAAAAABAAADeQAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjAuMTYuMTAwAAAACGZyZWUAAALcbWRhdAAAAm0GBf//adxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjQgcjMxMDggMzFlMTlmOSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjMgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0xIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxIG1lPWhleCBzdWJtZT0yIHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0wIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PTAgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTUgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD0xMCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAAAOZYiEBH///w9FAAEqv4AAAAAFQZogEfUAAAAFQZpAEfUAAAAFQZpgEfUAAAAFQZqAEfUAAAAFQZqgEfUAAAAFQZrAEfUAAAAFQZrgEfUAAAAFQZsAEPUAAAAFQZsgP9Q=';
    function phone() { return d.documentElement.classList.contains('mobile'); }
    function page() { try { var c = w.Screens && w.Screens.current(); return !!c && c.name === 'music' && !(w.Player && w.Player.isOpen()); } catch (e) { return false; } }
    function bg() { return !!(w.Music && w.Music.bgOn && w.Music.bgOn()); }
    function setting() { return !!(w.Settings && w.Settings.get('MUSIC_WAKE')) && !bg(); }   // nghe được khi khóa máy thì không cần giữ sáng
    function useVideo() {
      if (!vid) {
        vid = d.createElement('video');
        vid.muted = true; vid.loop = true; vid.playsInline = true;
        vid.setAttribute('muted', ''); vid.setAttribute('playsinline', ''); vid.setAttribute('aria-hidden', 'true');
        vid.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
        vid.src = MP4;
        d.body.appendChild(vid);
      }
      var pr = vid.play(); if (pr && pr.catch) pr.catch(function () { /* chờ lần chạm sau */ });
    }
    function on() {
      active = true;
      if (navigator.wakeLock && navigator.wakeLock.request) {
        if (lock) return;
        navigator.wakeLock.request('screen').then(function (l) {
          if (!active) { l.release(); return; }
          lock = l; l.addEventListener('release', function () { lock = null; });
        }).catch(function () { useVideo(); });
      } else useVideo();
    }
    function off() {
      active = false;
      if (lock) { try { lock.release(); } catch (e) { /* bỏ qua */ } lock = null; }
      if (vid) { try { vid.pause(); } catch (e) { /* bỏ qua */ } if (vid.parentNode) vid.parentNode.removeChild(vid); vid = null; }
    }
    function want() { return phone() && page() && setting() && !tempOff && !d.hidden; }
    function tick() {
      var pg = page();
      if (!pg && wasPage) tempOff = false;   // rời trang Nhạc: lần sau vào lại thì giữ sáng như thường
      wasPage = pg;
      // hết hẹn giờ tắt nhạc: cho máy tự khóa
      try {
        var S = w.Music && w.Music.S, si = S && S.sleepInfo ? S.sleepInfo() : null;
        if (si) sleepSeen = true;
        else if (sleepSeen) { sleepSeen = false; if (S.userPaused && S.userPaused()) tempOff = true; }
      } catch (e) { /* bỏ qua */ }
      if (want()) { if (!active || (!lock && !vid)) on(); else if (vid && vid.paused) useVideo(); }
      else if (active) off();
    }
    setInterval(tick, 1000);
    d.addEventListener('visibilitychange', function () { setTimeout(tick, 300); });
    w.addEventListener('pointerdown', function () { if (active && vid && vid.paused) useVideo(); if (want() && !lock && !vid) on(); }, true);
    return {
      bg: function () { return phone() && bg(); },
      shown: function () { return phone() && setting(); },
      isOn: function () { return phone() && setting() && !tempOff; },
      toggle: function () { tempOff = !tempOff; tick(); return !tempOff; },
      tick: tick
    };
  })();
  w.MusicPage = { open: MusicPage, elder: ElderMusic, elderPane: ElderPane, wake: Wake, list: SongList, sync: LrcSync, times: lineTimes, songOfDay: songOfDay, songForFilm: songForFilm, songImage: songImage, openSong: openSong, sleep: function () { w.Screens.push(SleepSheet()); }, sleepText: sleepText };
})(window, document);
