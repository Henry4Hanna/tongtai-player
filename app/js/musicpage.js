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
    var msum = el('div', 'mvsum');   // tóm tắt bài (điện thoại: luôn hiện dưới tên bài)
    meta.appendChild(msum);
    left.appendChild(meta);
    var prog = el('div', 'mvprog'), bar = el('div', 'mvbar'), fill = el('div', 'mvfill');
    bar.appendChild(fill); prog.appendChild(bar);
    var tl = el('div', 'mvtimes'), tNow = el('span', '', '0:00'), tTot = el('span', '', '0:00');
    tl.appendChild(tNow); tl.appendChild(tTot); prog.appendChild(tl);
    left.appendChild(prog);
    bar.onclick = function (e) { var r = bar.getBoundingClientRect(); S.seek((e.clientX - r.left) / r.width * S.duration()); };

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
      intro.innerHTML = has ? '<div class="mvik">GIỚI THIỆU BÀI HÁT</div>' + sumHTML(song, 'mvi') +
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

  w.MusicPage = { open: MusicPage, list: SongList, sync: LrcSync, times: lineTimes, songOfDay: songOfDay, songForFilm: songForFilm, songImage: songImage, openSong: openSong, sleep: function () { w.Screens.push(SleepSheet()); }, sleepText: sleepText };
})(window, document);
