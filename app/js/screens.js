/* Các màn hình: Trang chủ, Danh mục, Tìm kiếm, Chi tiết, Lịch sử, Thông tin. */
(function (w) {
  'use strict';
  var d = document;
  var C = w.APP_CONFIG, Store = w.Store, Api = w.Api, UI = w.UI, Nav = w.Nav, Player = w.Player;
  var el = UI.el;

  var TABS = [
    { id: 'home', name: 'Trang chủ' }, { id: 'chans', name: 'Kênh' }, { id: 'cats', name: 'Danh mục' }, { id: 'music', name: 'Nhạc' }, { id: 'search', name: 'Tìm kiếm' },
    { id: 'history', name: 'Lịch sử' }, { id: 'guide', name: 'Hướng dẫn' }, { id: 'info', name: 'Thông tin' }, { id: 'settings', name: 'Cài đặt' }
  ];

  var S = { stack: [], tab: 'home', tabEls: {} };

  /* ---------- Quản lý màn hình ---------- */

  function current() { return S.stack[S.stack.length - 1]; }

  function setActiveTab(id) {
    S.tab = id;
    TABS.forEach(function (t) { S.tabEls[t.id].classList.toggle('active', t.id === id); });
  }

  // Đang ở màn hình "Ai đang xem?" (kể cả các bước con: nhập PIN, chọn hình…): khóa thanh tab, chỉ bấm trong khung
  function whoLocked() { return S.stack.some(function (v) { return v.name === 'who'; }); }
  function updateLock() { d.documentElement.classList.toggle('wholock', whoLocked()); }
  function mount(view) {
    setTimeout(updateLock, 0);
    var cur = current();
    if (cur) { cur.focusEl = Nav.cur; cur.el.style.display = 'none'; }
    S.stack.push(view);
    d.getElementById('views').appendChild(view.el);
    Nav.focusFirst();
  }

  function goTab(id) {
    setTimeout(updateLock, 0);
    var views = d.getElementById('views');
    views.innerHTML = '';
    S.stack = [];
    if (Nav.cur) Nav.cur.classList.remove('focus');
    Nav.cur = null;
    setActiveTab(id);
    var b = { home: Home, chans: Chans, cats: Cats, music: function () { return w.MusicPage.open(); }, search: Search, history: History, guide: Guide, info: Info, settings: SettingsScreen }[id];
    mount(b());
  }

  function push(view) { mount(view); }

  /* ---------- Tự cập nhật mỗi REFRESH_HOURS giờ ---------- */

  var lastLoad = 0;
  // Trạng thái lần cập nhật phim kế tiếp: { text, mins }
  function nextRefresh() {
    if (C.AUTO_REFRESH === false) return { text: 'Đã tắt tự cập nhật (bật trong Cài đặt)', mins: -1 };
    if (C.IDLE_STOP_HOURS > 0 && Date.now() - (w.lastKeyAt || 0) > C.IDLE_STOP_HOURS * 3600e3)
      return { text: 'Đang tạm dừng vì TV để không — bấm remote để tiếp tục', mins: -1 };
    if (!lastLoad) return { text: 'Đang tải…', mins: 0 };
    var ms = lastLoad + C.REFRESH_HOURS * 3600e3 - Date.now();
    var m = Math.max(0, Math.ceil(ms / 60000));
    return { text: m <= 0 ? 'Sắp cập nhật (khi bạn rảnh tay 1 phút)' : 'Cập nhật phim mới sau ' + (m >= 60 ? Math.floor(m / 60) + ' giờ ' + (m % 60) + ' phút' : m + ' phút'), mins: m };
  }
  function autoRefresh() {
    if (!lastLoad || Date.now() - lastLoad < C.REFRESH_HOURS * 3600e3) return;
    if (Player.isOpen()) return;                                  // đang xem phim: chờ xem xong
    if (Date.now() - (w.lastKeyAt || 0) < 60e3) return;           // đang bấm remote: chờ rảnh tay 1 phút
    if (C.AUTO_REFRESH === false) return;
    if (C.IDLE_STOP_HOURS > 0 && Date.now() - (w.lastKeyAt || 0) > C.IDLE_STOP_HOURS * 3600e3) return;   // lâu không ai xem: tạm dừng cập nhật cho đỡ tốn
    if (S.tab !== 'home' || S.stack.length !== 1) return;         // trang khác: tự mới khi quay về trang chủ (cache đã hết hạn)
    var onTabs = Nav.cur && Nav.cur.dataset && Nav.cur.dataset.tab;
    goTab('home');
    if (onTabs) Nav.focus(S.tabEls.home, true);
    UI.toast('Đã cập nhật phim mới');
  }

  var backAt = 0;
  // Về trang chủ từ bất kỳ đâu (OK 2 lần liên tục)
  function home() {
    while (S.stack.length > 1) {
      var v = S.stack.pop();
      if (v.el.parentNode) v.el.parentNode.removeChild(v.el);
    }
    goTab('home');
    var b = d.querySelector('.hero .btn');
    Nav.focus(b || S.tabEls.home, true);
    UI.toast('Trang chủ');
  }

  function back() {
    var top = current();
    if (top && top.name === 'who' && top.startup) return;   // lúc mở app: phải chọn hồ sơ
    if (top && top.onBeforeBack) { try { if (top.onBeforeBack() === false) return; } catch (e) { /* bỏ qua */ } }   // màn hình muốn hỏi trước khi rời (ví dụ chưa lưu)
    setTimeout(updateLock, 0);
    if (S.stack.length > 1) {
      var v = S.stack.pop();
      if (v.onLeave) try { v.onLeave(); } catch (e) { /* bỏ qua */ }
      if (Nav.cur) Nav.cur.classList.remove('focus');
      v.el.parentNode.removeChild(v.el);
      var p = current();
      p.el.style.display = '';
      if (p.refresh) p.refresh();
      if (p.focusEl && d.body.contains(p.focusEl)) Nav.focus(p.focusEl); else Nav.focusFirst();
      return;
    }
    if (S.tab !== 'home') { goTab('home'); return; }
    var now = Date.now();
    if (now - backAt < 2000) {
      if (w.AndroidApp && w.AndroidApp.exit) { w.AndroidApp.exit(); return; }
      try { w.tizen.application.getCurrentApplication().exit(); } catch (e) { /* chạy trên trình duyệt */ }
      return;
    }
    backAt = now;
    UI.toast('Nhấn Back thêm lần nữa để thoát');
  }

  function afterPlayer() {
    var c = current();
    if (c && c.refresh) c.refresh();
    if (Nav.cur && !d.body.contains(Nav.cur)) Nav.focusFirst(); else if (Nav.cur) Nav.focus(Nav.cur);
  }

  /* ---------- Hành động chung ---------- */

  function playFilm(item, fromStart) {
    Player.open({ items: [item], index: 0, heading: item.title, key: 'v:' + item.id, series: item, fromStart: fromStart, onClose: afterPlayer, next: pickNext });
  }

  /* Chọn phim tiếp theo khi hết phim: ưu tiên phim chưa xem, cùng kênh, cùng thể loại, nhiều lượt xem.
     Không lặp lại phim vừa phát trong cùng lượt xem liên tục. */
  var chainSeen = {};
  function pickNext(item) {
    chainSeen[item.id] = 1;
    var watched = {};
    Store.recent().forEach(function (r) { if (r.vid) watched[r.vid] = 1; if (r.item) watched[r.item.id] = 1; });
    var src = item.anime || item.kind === 'anime' ? Api.animeAll() : Promise.resolve(Api.pool()).then(function (l) {
      return l.length >= 6 ? l : Api.followedFilms().catch(function () { return l; });
    });
    var cats = Api.catsOf(item);
    return src.then(function (list) {
      var cand = list.filter(function (x) { return x && x.kind === 'film' && x.id !== item.id && !chainSeen[x.id] && !Store.isBlocked(x.id); });
      function score(x) {
        var sc = 0;
        if (!watched[x.id]) sc += 10;
        if (x.ch && x.ch === item.ch) sc += 3;
        if (Store.isFavCh(x.chId)) sc += 4;
        if (Api.catsOf(x).some(function (c) { return cats.indexOf(c) >= 0; })) sc += 2;
        return sc + Math.min(2, (x.views || 0) / 1e6);
      }
      cand.sort(function (a, b) { return score(b) - score(a); });
      var nx = cand[0] || null;
      if (nx) chainSeen[nx.id] = 1;
      return nx;
    });
  }

  function openItem(item) { push(Detail(item)); }

  function progressOf(id) {
    var p = Store.getProgress(id);
    return p && p.d ? p : null;
  }
  function canResume(p) { return !!(p && p.p > 15 && p.p < p.d - 20); }

  // Thứ tự các hàng Trang chủ của hồ sơ đang xem (đủ 8 hàng, bỏ mã lạ)
  var ROW_IDS = ['cont', 'neweps', 'quiz', 'favch', 'fresh', 'hot', 'rec', 'top', 'movie', 'anime'];
  var ROW_NAMES = { cont: 'Tiếp tục xem', neweps: 'Có tập mới', quiz: '🎯 Câu đố tổng tài', favch: 'Từ kênh yêu thích', fresh: 'Phim mới cập nhật', hot: 'Đang hot', rec: 'Đề xuất theo hồ sơ', top: 'Top 10 phim trong tuần', movie: 'Phim lẻ hay', anime: 'Hoạt hình' };
  var ROW_KEYS = { cont: 'SHOW_CONT', neweps: 'SHOW_NEWEPS', quiz: 'SHOW_QUIZ', favch: 'SHOW_FAVCH', fresh: 'SHOW_FRESH', hot: 'SHOW_HOT', rec: 'SHOW_REC', top: 'SHOW_TOP10', movie: 'SHOW_MOVIE', anime: 'SHOW_ANIME' };
  function homeOrder() {
    var o = (Settings.get('HOME_ORDER') || []).filter(function (k) { return ROW_IDS.indexOf(k) >= 0; });
    ROW_IDS.forEach(function (k, i) {   // hàng mới: chen ngay sau hàng đứng trước nó trong thứ tự mặc định
      if (o.indexOf(k) >= 0) return;
      var at = -1; for (var j = i - 1; j >= 0 && at < 0; j--) at = o.indexOf(ROW_IDS[j]);
      o.splice(at + 1, 0, k);
    });
    return o;
  }
  function rowOn(k) { var v = Settings.get(ROW_KEYS[k]); return k === 'favch' ? v === true : v !== false; }
  // Thể loại hồ sơ đang xem hay xem nhất
  function profileCats(filmCats) {
    var score = {};
    function addIt(it, wgt) { if (!it) return; Api.catsOf(it).forEach(function (c) { score[c] = (score[c] || 0) + wgt; }); }
    function one() {
      Store.recent().slice(0, 40).forEach(function (r, i) { addIt(r.item, (Store.isWatched(r.vid) ? 3 : 1.5) * (1 - i / 60)); });
      Store.favs().forEach(function (it) { addIt(it, 2); });
      if (w.Rates) { var rm = w.Rates.of(); Object.keys(rm).forEach(function (k) { var x = rm[k]; if (x.r === 1) addIt(x, 4); else if (x.r === -1) addIt(x, -3); }); }   // ❤ / 👎
    }
    var tg = Store.together();   // xem chung: cộng sở thích của mọi người
    if (tg.length) tg.forEach(function (id) { Store.as(id, one); }); else one();
    return filmCats.filter(function (c) { return score[c.name] > 0; }).sort(function (a, b) { return score[b.name] - score[a.name]; }).slice(0, 2);
  }

  // Trang chủ: bỏ phim đã xem hết (bật/tắt trong Cài đặt). Còn quá ít phim thì giữ nguyên để hàng không trống.
  function unseen(list) {
    if (C.HIDE_WATCHED === false) return list;
    var l = list.filter(function (x) { return !Store.isWatched(x.id); });
    return l.length >= 4 || l.length === list.length ? l : list;
  }

  // Trải đều các kênh: mỗi kênh tối đa perCh phim ở lượt đầu, rồi mới lấy thêm
  function spread(list, perCh, limit) {
    var cnt = {}, first = [], rest = [];
    list.forEach(function (f) {
      var k = f.chId || f.ch || '';
      cnt[k] = (cnt[k] || 0) + 1;
      (cnt[k] <= perCh ? first : rest).push(f);
    });
    return first.concat(rest).slice(0, limit);
  }

  function cardOpts(extra) {
    var o = { onSelect: openItem };
    for (var k in extra) o[k] = extra[k];
    return o;
  }

  // Top 10 phim trong tuần: phim ra trong 7 ngày qua, từ tất cả kênh phim ngắn đang theo dõi, xem nhiều nhất trước.
  // Dùng ở Trang chủ và trang chi tiết phim; Cài đặt → Trang chủ → Top 10 phim trong tuần để Hiện / Ẩn.
  function weeklyRow(onSelect) {
    var tt = UI.row('Top 10 phim trong tuần', 'Phim mới ra trong 7 ngày · xem nhiều nhất');
    tt.wrap.classList.add('row-hot', 'row-top10');   // dùng lại kiểu số hạng 1, 2, 3… của hàng Đang hot
    if (C.SHOW_TOP10 === false) { tt.hide(); return tt; }
    Api.followedFilms().then(function (all) {
      var week = Date.now() - 7 * 86400e3;
      var top = all.filter(function (f) { return new Date(f.pub || 0).getTime() > week; })
        .sort(function (a, b) { return (b.views || 0) - (a.views || 0); }).slice(0, 10);
      if (!top.length) { tt.msg('Tuần này chưa có phim mới từ các kênh theo dõi.'); return; }
      tt.cards(top, function (it, i) { return UI.card(it, { rank: i + 1, onSelect: onSelect }); });
    }).catch(function (e) { tt.msg(Api.explain(e)); });
    return tt;
  }

  /* ---------- Trang chủ ---------- */

  function Home() {
    lastLoad = Date.now();
    var v = UI.view();
    var hero = el('div', 'hero rowwrap');
    v.appendChild(hero);
    hero.appendChild(el('div', 'hero-load', 'Đang tải phim…'));

    var rows = {
      cont: UI.row('Tiếp tục xem'),
      neweps: UI.row('Có tập mới', 'Phim bộ bạn đang theo dõi vừa ra tập mới'),
      quiz: quizStrip(),
      favch: UI.row('Từ kênh yêu thích', ''),
      fresh: UI.row('Phim mới cập nhật', 'Từ các kênh bạn theo dõi'),
      hot: UI.row('Đang hot', 'Xem nhiều nhất trong 30 ngày'),
      rec: UI.row('Đề xuất theo hồ sơ'),
      top: weeklyRow(openItem),
      movie: UI.row('Phim lẻ hay', 'Từ ' + (C.MOVIE_CHANNELS || []).length + ' kênh phim lẻ'),
      anime: UI.row('Hoạt hình', 'Từ ' + (C.ANIME_CHANNELS || []).length + ' kênh hoạt hình · AI, 2D, 3D')
    };
    homeOrder().forEach(function (k) { if (k !== 'top') rows[k].wrap.classList.add('row-' + k); v.appendChild(rows[k].wrap); });   // thứ tự hàng theo hồ sơ
    var wkc = weekCard(); if (wkc) hero.parentNode.insertBefore(wkc, hero.nextSibling);   // báo cáo tuần (hồ sơ người lớn)
    rows.neweps.hide();
    v.classList.add('homev');

    // Điện thoại: nút chuyển "Mới cập nhật | Hoạt hình AI" + thanh thể loại (TV không hiện)
    var seg = el('div', 'mseg monly');
    var segA = el('div', 'msegb on', '🔥 Mới'), segM = el('div', 'msegb', '🎬 Phim lẻ'), segB = el('div', 'msegb', '✨ Hoạt hình');
    function pick(which) {
      segA.classList.toggle('on', which === 'fresh');
      segM.classList.toggle('on', which === 'movie');
      segB.classList.toggle('on', which === 'anime');
      v.classList.toggle('showanime', which === 'anime');
      v.classList.toggle('showmovie', which === 'movie');
    }
    segA.onclick = function () { pick('fresh'); };
    segM.onclick = function () { pick('movie'); };
    segB.onclick = function () { pick('anime'); };
    seg.appendChild(segA); seg.appendChild(segM); seg.appendChild(segB);
    var pills = el('div', 'mpills monly');
    C.CATEGORIES.filter(function (c) { return c.kind === 'film'; }).forEach(function (c) {
      var b = el('div', 'mpill', c.name);
      b.onclick = function () { push(CatList(c)); };
      pills.appendChild(b);
    });
    v.insertBefore(seg, rows.fresh.wrap);
    v.insertBefore(pills, rows.fresh.wrap);
    // dòng đếm ngược "Cập nhật phim mới sau … phút"
    var cd = el('span', 'rh cdown', '');
    rows.fresh.wrap.querySelector('.rowhead').appendChild(cd);
    function tickCd() { if (!d.body.contains(v) && cdT) { clearInterval(cdT); return; } cd.textContent = '· ' + nextRefresh().text; }
    var cdT = setInterval(tickCd, 30000);
    setTimeout(tickCd, 50);
    var on = { quiz: C.SHOW_QUIZ !== false, cont: C.SHOW_CONT !== false, favch: C.SHOW_FAVCH === true, fresh: C.SHOW_FRESH !== false, hot: C.SHOW_HOT !== false, movie: C.SHOW_MOVIE !== false, rec: C.SHOW_REC !== false, anime: C.SHOW_ANIME !== false };
    Object.keys(on).forEach(function (k) { if (!on[k]) rows[k].hide(); });

    function renderCont() {
      var list = Store.recent().filter(function (r) { return !Settings.hides(r.item); }).filter(function (r) {
        var p = progressOf(r.vid);
        return canResume(p);
      }).slice(0, 12);
      if (!list.length || C.SHOW_CONT === false) { rows.cont.hide(); return; }
      rows.cont.show();
      rows.cont.cards(list, function (r) {
        var p = progressOf(r.vid);
        var sub = (r.item.kind === 'anime' ? 'Tập ' + r.ep + ' · ' : '') + 'Còn ' + UI.fmtLong(p.d - p.p);
        return UI.card(r.item, {
          progress: p.p / p.d, sub: sub,
          onSelect: function (it) { if (it.kind === 'anime') openItem(it); else playFilm(it); }
        });
      });
    }
    renderCont();
    if (C.SHOW_NEWEPS !== false) Api.animeAll().then(function (series) {   // phim bộ có tập mới
      var l = newEpisodes(series);
      if (!l.length) return;
      rows.neweps.show();
      var rh = rows.cont.wrap.querySelector('.rowhead'); if (rh && !rh.querySelector('.newepsn')) rh.appendChild(el('span', 'rh newepsn', '● ' + l.length + ' phim có tập mới'));
      rows.neweps.cards(l.map(function (x) { return x.item; }), function (it) {
        var n = (l.filter(function (x) { return x.item === it; })[0] || {}).n || 1;
        var c = UI.card(it, cardOpts({ sub: 'Tập ' + it.eps + ' đã ra' }));
        var th = c.querySelector('.thumb') || c; th.appendChild(el('span', 'eptag', n > 1 ? n + ' tập mới' : 'Tập ' + it.eps + ' mới'));
        return c;
      });
    }).catch(function () { /* bỏ qua */ });

    var heroFav = false;
    // Phim đang xem dở gần nhất (trong 4 ngày): đưa lên banner với nút Xem tiếp
    function heroResume() {
      var r = Store.recent().filter(function (x) { return x.item && !Settings.hides(x.item); })[0];
      if (!r || Date.now() - (r.t || 0) > 4 * 86400e3) return false;
      var p = progressOf(r.vid); if (!canResume(p)) return false;
      var item = r.item, anime = item.kind === 'anime';
      heroFav = true;
      hero.innerHTML = '';
      var bg = UI.thumb(item, true); bg.className = 'thumb hero-img'; hero.appendChild(bg);
      hero.appendChild(el('div', 'hero-shade'));
      var box = el('div', 'hero-box'), chips = el('div', 'chips');
      chips.appendChild(el('span', 'chip gold', '▶ Xem tiếp'));
      if (anime && r.ep) chips.appendChild(el('span', 'chip', 'Tập ' + r.ep + (item.eps ? ' / ' + item.eps : '')));
      UI.catChips(chips, item);
      box.appendChild(chips);
      box.appendChild(el('h1', 'hero-title', item.title));
      var t = new Date(r.t), now = new Date(), dd = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
      var when = 'lúc ' + UI.hhmm(r.t) + (dd === 0 ? ' hôm nay' : dd === 1 ? ' hôm qua' : ' ngày ' + t.getDate() + '/' + (t.getMonth() + 1));
      var meta = el('div', 'hero-meta'); meta.appendChild(d.createTextNode('Bạn xem dở ' + when + '  ·  ')); meta.appendChild(el('b', 'hero-left', 'còn ' + UI.fmtLong(p.d - p.p)));
      box.appendChild(meta);
      var bar = el('div', 'hero-prog'), fl = el('i'); fl.style.width = Math.round(p.p / p.d * 100) + '%'; bar.appendChild(fl); box.appendChild(bar);
      var btns = el('div', 'btns');
      var b1 = UI.button('Xem tiếp', 'gold', function () { if (anime) openItem(item); else playFilm(item); }, UI.ICON_PLAY);
      btns.appendChild(b1);
      btns.appendChild(UI.button(anime ? 'Chi tiết' : 'Xem từ đầu', '', function () { if (anime) openItem(item); else playFilm(item, true); }));
      box.appendChild(btns);
      hero.appendChild(box);
      if (Nav.cur && Nav.cur.dataset && Nav.cur.dataset.tab === 'home' && current() && current().el === v) Nav.focus(b1, true);
      return true;
    }
    var heroResumed = heroResume();
    setTimeout(function () { if (current() && current().el === v) showMsgs(); }, 1500);
    var msgT = setInterval(function () { if (!d.body.contains(v)) { clearInterval(msgT); return; } if (current() && current().el === v && Date.now() - (w.lastKeyAt || 0) > 8000) showMsgs(); }, 60000);
    // Bài hát của ngày: banner đổi qua lại giữa phim và bài hát mỗi 12 giây
    var songOn = false, songLayer = null, heroDots = el('div', 'hero-dots'), heroSongI = -1;
    function buildSong() {
      if (!w.MusicPage || !w.Music || !w.Music.S || !w.MusicPage.songOfDay) return null;
      var i = w.MusicPage.songOfDay(), sg = i >= 0 ? w.Music.S.song(i) : null; if (!sg) return null;
      heroSongI = i;
      var L = el('div', 'hero-song hidden');
      var bg = el('div', 'thumb hero-img'), src = w.MusicPage.songImage(i);
      if (src) bg.style.backgroundImage = 'url("' + src.replace(/"/g, '%22') + '")';
      L.appendChild(bg); L.appendChild(el('div', 'hero-shade'));
      var box = el('div', 'hero-box'), chips = el('div', 'chips'), n = new Date();
      chips.appendChild(el('span', 'chip gold', '♪ Bài hát của ngày'));
      chips.appendChild(el('span', 'chip', ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][n.getDay()] + ' ' + n.getDate() + '/' + (n.getMonth() + 1)));
      box.appendChild(chips);
      box.appendChild(el('h1', 'hero-title', sg.title));
      var sum = String(sg.sum || '').replace(/^Bài hát\s+["“][^"”]+["”]\s*/, '');
      if (sum) box.appendChild(el('div', 'hero-meta hero-ssum', sum.charAt(0).toUpperCase() + sum.slice(1)));
      var ex = (sg.ex || []).slice(0, 3);
      if (ex.length) { var q = el('div', 'hero-sex'); ex.forEach(function (x) { q.appendChild(el('div', 'hero-quote', x)); }); box.appendChild(q); }
      var btns = el('div', 'btns');
      btns.appendChild(UI.button('Nghe ngay' + (sg.dur ? ' · ' + Math.floor(sg.dur / 60) + ':' + ('0' + sg.dur % 60).slice(-2) : ''), 'gold', function () { w.MusicPage.openSong(i); }, UI.ICON_PLAY));
      btns.appendChild(UI.button('Mở trang Nhạc', '', function () { goTab('music'); }));
      box.appendChild(btns); L.appendChild(box);
      return L;
    }
    function applySong(moveFocus) {
      if (!songLayer) return;
      if (songLayer.parentNode !== hero) hero.appendChild(songLayer);
      if (heroDots.parentNode !== hero) hero.appendChild(heroDots);
      var had = Nav.cur && hero.contains(Nav.cur);
      Array.prototype.forEach.call(hero.children, function (c) { if (c !== songLayer && c !== heroDots) c.classList.toggle('hidden', songOn); });
      songLayer.classList.toggle('hidden', !songOn);
      heroDots.innerHTML = ''; heroDots.appendChild(el('i', songOn ? '' : 'on')); heroDots.appendChild(el('i', songOn ? 'on' : ''));
      if (had && moveFocus) { var fb = (songOn ? songLayer : hero).querySelector('.btn:not(.hidden)'); var vis = Array.prototype.filter.call(hero.querySelectorAll('.btn'), function (b) { return b.getClientRects().length && !b.closest('.hidden'); })[0]; if (vis || fb) Nav.focus(vis || fb, true); }
    }
    var songT = setInterval(function () {
      if (!d.body.contains(v)) { clearInterval(songT); return; }
      if (d.hidden || C.SONG_OF_DAY === false || current() && current().el !== v) return;
      if (Date.now() - (w.lastKeyAt || 0) < 6000) return;   // đang bấm remote: đứng yên
      if (!songLayer) { songLayer = buildSong(); if (!songLayer) return; }
      if (!hero.querySelector('.hero-box')) return;   // banner phim chưa tải xong
      songOn = !songOn; applySong(true);
    }, 12000);
    function setHero(item, week) {
      if (item && Store.isFavCh(item.chId)) heroFav = true;
      hero.innerHTML = '';
      var bg = UI.thumb(item, true);
      bg.className = 'thumb hero-img';
      hero.appendChild(bg);
      hero.appendChild(el('div', 'hero-shade'));
      var box = el('div', 'hero-box');
      var chips = el('div', 'chips');
      if (week) { chips.appendChild(el('span', 'chip gold', '👑 Tổng tài của tuần')); chips.appendChild(el('span', 'chip', 'Tuần ' + weekNo())); }
      else {
        chips.appendChild(el('span', 'chip gold', 'Mới cập nhật'));
        if (item.tag) chips.appendChild(el('span', 'chip white', item.tag));
        chips.appendChild(el('span', 'chip', 'Phim lẻ'));
      }
      UI.catChips(chips, item);
      box.appendChild(chips);
      box.appendChild(el('h1', 'hero-title', item.title));
      var meta = [];
      if (item.dur) meta.push(UI.fmtLong(item.dur));
      if (item.views) meta.push(UI.fmtViews(item.views));
      if (item.pub) meta.push(UI.fmtAgo(item.pub));
      box.appendChild(el('div', 'hero-meta', meta.join('  ·  ')));
      if (week && w.Quotes) {
        var hd = el('div', 'hero-desc');
        hd.appendChild(el('div', 'hero-quote', '“' + w.Quotes.get((weekNo() * 37) % w.Quotes.count).text + '”'));
        hd.appendChild(el('div', 'hero-wk', 'Phim cả nhà xem nhiều nhất 7 ngày qua, kèm một câu thoại tổng tài.'));
        box.appendChild(hd);
      } else box.appendChild(el('div', 'hero-desc', item.desc || ''));
      var btns = el('div', 'btns');
      var b1 = UI.button('Xem ngay', 'gold', function () { playFilm(item); }, UI.ICON_PLAY);
      var b2 = UI.button('Chi tiết', '', function () { openItem(item); });
      btns.appendChild(b1); btns.appendChild(b2);
      box.appendChild(btns);
      hero.appendChild(box);
      if (Nav.cur && Nav.cur.dataset && Nav.cur.dataset.tab === 'home' && current() && current().el === v) Nav.focus(b1, true);
      if (songLayer) { songOn = false; applySong(false); }
    }

    function fail(r, e) { r.msg(Api.explain(e)); }

    // Phim mới + đang hot: lấy từ các kênh theo dõi (làm mới mỗi giờ, gần như không tốn hạn mức)
    Api.followedFilms().then(function (all) {
      if (!all.length) throw { message: 'Chưa lấy được phim từ các kênh theo dõi' };
      paintChBadge(all);
      preload(all);
      var list = unseen(all);
      rows.fresh.cards(spread(list, 2, 30), function (it, i) { return UI.card(it, cardOpts({ isNew: Date.now() - new Date(it.pub || 0).getTime() < 86400e3 })); });
      if (!heroFav) { var wkItem = weekPick(all); if (wkItem) { setHero(wkItem, true); heroResumed = true; } else setHero(list[0]); }
      var month = Date.now() - 30 * 86400e3;
      var hot = list.filter(function (f) { return new Date(f.pub || 0).getTime() > month; });
      if (hot.length < 10) hot = list.slice();
      hot.sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
      rows.hot.cards(spread(hot, 2, 15), function (it, i) { return UI.card(it, cardOpts({ rank: i + 1 })); });
    }).catch(function (e) {
      // dự phòng: tìm kiếm chung như bản cũ
      Api.films(C.HOME_QUERY, 'date').then(function (list) {
        rows.fresh.cards(list.slice(0, 14), function (it, i) { return UI.card(it, cardOpts({ isNew: i < 3 })); });
        if (list.length) setHero(list[0]); else hero.innerHTML = '';
        rows.hot.cards(list.slice().sort(function (a, b) { return b.views - a.views; }).slice(0, 10), function (it, i) { return UI.card(it, cardOpts({ rank: i + 1 })); });
      }).catch(function (e2) {
        fail(rows.fresh, e2); fail(rows.hot, e2);
        hero.innerHTML = '';
        hero.appendChild(el('div', 'hero-load', Api.explain(e2)));
      });
    });

    // Đề xuất: mỗi ngày 2 danh mục, xen kẽ phim của hai danh mục
    var filmCats = C.CATEGORIES.filter(function (c) { return c.kind === 'film'; });

    var dayN = Math.floor(Date.now() / 86400000);
    // Đề xuất theo hồ sơ: 2 thể loại người đang xem hay xem nhất (từ lịch sử, danh sách, phim đã xem hết)
    var pref = profileCats(filmCats), byProfile = pref.length > 0;
    var catA = pref[0] || filmCats[dayN % filmCats.length];
    var catB = pref[1] || filmCats[(dayN * 7 + 5) % filmCats.length];
    if (catB === catA) catB = filmCats[(filmCats.indexOf(catA) + 1) % filmCats.length];
    rows.rec.wrap.querySelector('.rt').textContent = 'Đề xuất cho ' + (Store.together().length ? Store.together().map(function (id) { return (profileOf(id) || { name: 'Guest' }).name; }).join(' + ') : Store.profileName());
    rows.rec.wrap.querySelector('.rowhead').appendChild(el('span', 'rh', (byProfile ? 'Theo thể loại hay xem: ' : 'Chưa có lịch sử xem, gợi ý hôm nay: ') + catA.name + ' · ' + catB.name));
    // Kênh yêu thích của hồ sơ đang xem: hàng riêng ngay dưới "Tiếp tục xem", và ảnh lớn đầu trang lấy từ đây
    if (on.favch) {
      var favs = Store.favChs(), favSet = {};
      favs.forEach(function (x) { favSet[x.id] = 1; });
      rows.favch.wrap.querySelector('.rt').textContent = 'Từ kênh yêu thích của ' + Store.profileName();
      if (!favs.length) {
        rows.favch.msg('Chưa có kênh yêu thích. Vào tab Kênh, mở một kênh rồi chọn “☆ Yêu thích” (hoặc Cài đặt → Kênh yêu thích).');
      } else {
        var rh = el('span', 'rh', favs.length + ' kênh · mới nhất trước');
        rows.favch.wrap.querySelector('.rowhead').appendChild(rh);
        Promise.all([Api.followedFilms().catch(function () { return []; }), Api.movieFilms().catch(function () { return []; }), Api.animeAll().catch(function () { return []; })]).then(function (r) {
          var seen = {}, list = [];
          r[0].concat(r[1], r[2]).forEach(function (f) { if (f && favSet[f.chId] && !seen[f.id]) { seen[f.id] = 1; list.push(f); } });
          list.sort(function (a, b) { return String(b.pub || '').localeCompare(String(a.pub || '')); });
          list = spread(unseen(list), 3, 24);
          if (!list.length) { rows.favch.msg('Các kênh yêu thích chưa có phim mới. Phim sẽ hiện ở đây khi kênh đăng phim.'); return; }
          rows.favch.cards(list, function (it) { return UI.card(it, cardOpts({ isNew: Date.now() - new Date(it.pub || 0).getTime() < 86400e3 })); });
          var first = list.filter(function (f) { return f.kind === 'film'; })[0];
          if (first && !heroResumed) setHero(first);
        });
      }
    }

    if (on.rec) Promise.all([Api.catFilms(catA, true), Api.catFilms(catB, true)]).then(function (r) {
      var out = [], seen = {}, i;
      for (i = 0; i < 14; i++) {
        [r[0][i], r[1][i]].forEach(function (f) { if (f && !seen[f.id]) { seen[f.id] = 1; out.push(f); } });
      }
      // thêm phim của các kênh phim ngắn chưa có mặt, để kênh nào cũng được đề xuất
      Api.followedFilms().then(function (all) {
        var has = {};
        out.forEach(function (f) { has[f.chId || f.ch] = 1; });
        var extra = spread(all.filter(function (f) { return !seen[f.id] && !has[f.chId || f.ch]; })
          .sort(function (a, b) { return (b.views || 0) - (a.views || 0); }), 1, 12);
        rows.rec.cards(unseen(out.slice(0, 16).concat(extra)).filter(function (f) { return !(w.Rates && w.Rates.get(f.id) === -1); }), function (it) { return UI.card(it, cardOpts({})); });
      });
    }).catch(function (e) { fail(rows.rec, e); });

    // Phim lẻ hay: từ các kênh phim lẻ, xem nhiều trước
    if (on.movie) Api.movieFilms().then(function (list) {
      if (!list.length) {
        var mm = Api.missingChannels().filter(function (m) { return m.movie; });
        rows.movie.msg(mm.length && mm[0].why === 'quota' ? 'Chưa tìm được kênh phim lẻ vì đã hết hạn mức YouTube hôm nay.' : 'Chưa có phim lẻ. Kiểm tra kênh trong Cài đặt → Kênh theo dõi.');
        return;
      }
      rows.movie.cards(unseen(list).slice(0, 16), function (it) { return UI.card(it, cardOpts({})); });
    }).catch(function (e) { fail(rows.movie, e); });

    if (on.anime) Api.animeAll().then(function (list) {
      if (!list.length) {
        var miss = Api.missingChannels().filter(function (m) { return m.anime; });
        rows.anime.msg(miss.length && miss[0].why === 'quota'
          ? 'Chưa tìm được kênh hoạt hình vì hôm nay đã hết hạn mức YouTube. App sẽ tự thử lại sau khi hạn mức làm mới.'
          : 'Chưa có phim hoạt hình. Kiểm tra kênh trong Cài đặt → Kênh theo dõi.');
        return;
      }
      rows.anime.cards(list.slice(0, 14), function (it) { return UI.card(it, cardOpts({})); });
    }).catch(function (e) { fail(rows.anime, e); });

    return { name: 'home', el: v, refresh: renderCont };
  }

  /* ---------- Kênh theo dõi ---------- */

  function Chans() {
    var v = UI.view();
    v.classList.add('scroller');
    var h = el('div', 'pagehead', 'Kênh của bạn');
    h.appendChild(el('span', 'rh', ((C.CHANNELS || []).length + (C.ANIME_CHANNELS || []).length + (C.MOVIE_CHANNELS || []).length) + ' kênh · phim mới cập nhật mỗi ' + C.CHANNEL_HOURS + ' giờ'));
    v.appendChild(h);
    var g = el('div', 'chgrid');
    g.appendChild(el('div', 'rowmsg', 'Đang tải kênh…'));
    v.appendChild(g);
    Api.channels().then(function (chs) {
      g.innerHTML = '';
      if (!chs.length && !Api.missingChannels().length) { g.appendChild(el('div', 'rowmsg', 'Chưa tìm được kênh nào. Kiểm tra API key và mạng.')); return; }
      chs = chs.slice().sort(function (a, b) { return Store.isFavCh(b.id) - Store.isFavCh(a.id); });   // kênh yêu thích lên đầu
      chs.forEach(function (c) {
        var e = el('div', 'chcard f rowwrap' + (Store.isFavCh(c.id) ? ' fav' : ''));
        if (Store.isFavCh(c.id)) e.appendChild(el('div', 'chstar', '★'));
        e._hold = function () {
          push(ConfirmDel('Kênh theo dõi', c.title || c.name, function () {
            Settings.removeChannel(c.name); Store.clearCache(); UI.toast('Đã xóa kênh'); setTimeout(function () { goTab('chans'); }, 50);
          }, 'kênh'));
        };
        var av = el('div', 'chav');
        av.style.background = UI.grad ? UI.grad(c.id) : '#2A3042';
        av.appendChild(el('span', 'chini', (c.title || c.name).replace(/[^A-Za-zÀ-ỹ0-9]/g, '').slice(0, 1).toUpperCase()));
        if (c.thumb) {
          var im = d.createElement('img');
          im.onload = function () { im.classList.add('on'); };
          im.onerror = function () { im.remove(); };
          im.src = c.thumb;
          av.appendChild(im);
        }
        e.appendChild(av);
        e.appendChild(el('div', 'chname', c.title || c.name));
        var sub = el('div', 'chsub', '');
        e.appendChild(sub);
        Api.channelFilms(c).then(function (l) {
          if (Store.isFavCh(c.id)) {   // kênh yêu thích: số phim mới từ lần xem kênh gần nhất
            var k = chNewCount(c.id, l);
            if (k) { e.appendChild(el('span', 'chbadge', String(k))); sub.textContent = k + ' phim mới'; sub.classList.add('new'); return; }
          }
          var day = Date.now() - 86400e3;
          var n = l.filter(function (f) { return new Date(f.pub || 0).getTime() > day; }).length;
          sub.textContent = n ? n + ' phim mới hôm nay' : l.length + ' phim' + (c.anime ? ' · Hoạt hình' : c.movie ? ' · Phim lẻ hay' : '');
          if (n) sub.classList.add('new');
        }).catch(function () { sub.textContent = ''; });
        e._ok = function () { push(ChannelList(c)); };
        g.appendChild(e);
      });
      // Kênh chưa tìm được (thường do hết hạn mức): vẫn hiện để biết
      Api.missingChannels().forEach(function (m) {
        var e = el('div', 'chcard f rowwrap miss');
        var av = el('div', 'chav');
        av.style.background = '#2A3042';
        av.appendChild(el('span', 'chini', '?'));
        e.appendChild(av);
        e.appendChild(el('div', 'chname', m.name));
        e.appendChild(el('div', 'chsub', m.why === 'quota' ? 'Chờ hạn mức làm mới' : m.why === 'notfound' ? 'Không tìm thấy kênh' : 'Lỗi mạng, thử lại sau'));
        e._ok = function () {
          UI.toast(m.why === 'quota' ? 'Hết hạn mức YouTube hôm nay. Kênh sẽ tự hiện sau 0 giờ giờ California.' :
            'Không tìm thấy “' + m.name + '”. Giữ OK để xóa kênh này, hoặc vào Cài đặt → Thêm kênh, gõ @tên-kênh.');
        };
        e._hold = function () {
          push(ConfirmDel('Kênh theo dõi', m.name, function () {
            Settings.removeChannel(m.name); Store.clearCache(); UI.toast('Đã xóa kênh'); setTimeout(function () { goTab('chans'); }, 50);
          }, 'kênh'));
        };
        g.appendChild(e);
      });
      function focusFirst() {
        if (current() && current().el === v && Nav.cur && Nav.cur.dataset && Nav.cur.dataset.tab) Nav.focus(v.querySelector('.trow') || g.firstChild, true);
      }
      // Bảng xếp hạng: top 3 kênh có nhiều phim mới nhất trong 7 ngày, chia theo 3 nhóm
      var top = el('div', 'chtop');
      v.insertBefore(top, g);
      var groups = [
        { name: 'Phim ngắn', icon: '🎬', test: function (c) { return !c.anime && !c.movie; } },
        { name: 'Hoạt hình', icon: '✨', test: function (c) { return !!c.anime; } },
        { name: 'Phim lẻ hay', icon: '🍿', test: function (c) { return !!c.movie; } }
      ];
      var week = Date.now() - 7 * 86400e3;
      Promise.all(chs.map(function (c) {
        return Api.channelFilms(c).then(function (l) {
          var fresh = l.filter(function (f) { return new Date(f.pub || 0).getTime() > week; });
          if (c.anime) fresh = Api.groupEpisodes(fresh);
          var views = 0; fresh.forEach(function (f) { views += f.views || 0; });
          return { c: c, n: fresh.length, views: views };
        }).catch(function () { return { c: c, n: 0, views: 0 }; });
      })).then(function (stats) {
        top.appendChild(el('div', 'chtop-h', '🏆 Top 3 kênh trong tuần'));
        top.appendChild(el('div', 'chtop-s', 'Xếp theo số phim mới đăng trong 7 ngày'));
        var cols = el('div', 'chtop-cols');
        groups.forEach(function (gr) {
          var col = el('div', 'tcol');
          col.appendChild(el('div', 'tcol-h', gr.icon + ' ' + gr.name));
          var list = stats.filter(function (x) { return gr.test(x.c) && x.n > 0; })
            .sort(function (a, b) { return (b.n - a.n) || (b.views - a.views); }).slice(0, 3);
          if (!list.length) col.appendChild(el('div', 'tempty', 'Tuần này chưa có phim mới'));
          list.forEach(function (x, i) {
            var r = el('div', 'trow f r' + (i + 1));
            r.appendChild(el('div', 'tmedal', String(i + 1)));
            var av = el('div', 'chav tav');
            av.style.background = UI.grad ? UI.grad(x.c.id) : '#2A3042';
            av.appendChild(el('span', 'chini', (x.c.title || x.c.name).replace(/[^A-Za-zÀ-ỹ0-9]/g, '').slice(0, 1).toUpperCase()));
            if (x.c.thumb) {
              var im = d.createElement('img');
              im.onload = function () { im.classList.add('on'); };
              im.onerror = function () { im.remove(); };
              im.src = x.c.thumb;
              av.appendChild(im);
            }
            r.appendChild(av);
            var tx = el('div', 'ttx');
            tx.appendChild(el('div', 'tname', x.c.title || x.c.name));
            tx.appendChild(el('div', 'tnum', x.n + ' phim mới'));
            r.appendChild(tx);
            r._ok = function () { push(ChannelList(x.c)); };
            col.appendChild(r);
          });
          cols.appendChild(col);
        });
        top.appendChild(cols);
        focusFirst();
      }).catch(focusFirst);
      focusFirst();
    });
    return { name: 'chans', el: v };
  }

  function ChannelList(c) {
    if (c && c.id && Store.isFavCh(c.id)) { chSeenMark(c.id); setTimeout(function () { paintChBadge(); }, 50); }
    var v = UI.view();
    v.classList.add('scroller');
    var h = el('div', 'pagehead', c.title || c.name);
    h.appendChild(el('span', 'rh', 'Phim mới nhất của kênh'));
    if (c.id && String(c.id).indexOf('demo') !== 0) {
      var bFav = UI.button('', 'small favch', function () {
        var on = Store.toggleFavCh(c);
        paintFav();
        UI.toast(on ? 'Đã thêm “' + (c.title || c.name) + '” vào kênh yêu thích của ' + Store.profileName() : 'Đã bỏ khỏi kênh yêu thích');
      });
      var paintFav = function () { var on = Store.isFavCh(c.id); bFav.setLabel(on ? '★ Kênh yêu thích' : '☆ Yêu thích'); bFav.classList.toggle('on', on); };
      paintFav();
      h.appendChild(bFav);
    }
    v.appendChild(h);
    var holder = el('div', 'gridwrap');
    holder.appendChild(el('div', 'rowmsg', 'Đang tải…'));
    v.appendChild(holder);
    Api.channelFilms(c).then(function (list) {
      if (c.anime) list = Api.groupEpisodes(list);
      holder.innerHTML = '';
      if (!list.length) { holder.appendChild(el('div', 'rowmsg', 'Kênh chưa có phim dài từ ' + (c.anime ? (C.MIN_ANIME_MINUTES || 5) : C.MIN_FILM_MINUTES) + ' phút.' + (Api.channelWhy ? ' ' + Api.channelWhy(c) : ''))); return; }
      var g = el('div', 'grid4');
      list.forEach(function (it) { g.appendChild(UI.card(it, { grid: true, onSelect: openItem })); });
      holder.appendChild(g);
      if (current() && current().el === v && (!Nav.cur || !d.body.contains(Nav.cur) || (Nav.cur.dataset && Nav.cur.dataset.tab))) Nav.focus(g.firstChild, true);
    }).catch(function (e) { holder.innerHTML = ''; holder.appendChild(el('div', 'rowmsg', Api.explain(e))); });
    return { name: 'chlist', el: v };
  }

  /* ---------- Danh mục ---------- */

  function Cats() {
    var v = UI.view();
    v.appendChild(el('div', 'pagehead', 'Danh mục'));
    v.lastChild.appendChild(el('span', 'rh', C.CATEGORIES.length + ' thể loại · chọn bằng phím mũi tên, nhấn OK để mở'));
    var g = el('div', 'catgrid');
    C.CATEGORIES.forEach(function (c, i) {
      var e = el('div', 'catcard f');
      e.style.background = 'linear-gradient(135deg,' + ['#3a1c4a,#c2456b', '#0f2a43,#2f7fb8', '#3b2a14,#d9973c', '#1b3a2f,#4fae8a', '#2a2145,#7a6ad8', '#4a1c1c,#e0653d'][i % 6] + ')';
      e.appendChild(el('div', 'ring r1'));
      e.appendChild(el('div', 'ring r2'));
      var photo = el('div', 'catimg');          // hình thật: ảnh bìa phim nổi bật của danh mục
      e.appendChild(photo);
      e._photo = photo;
      e.appendChild(el('div', 'catshade'));
      var ic = el('div', 'caticon');
      if (w.CAT_ICONS) ic.innerHTML = w.CAT_ICONS(c.id);   // hình vẽ dự phòng khi chưa có ảnh
      e.appendChild(ic);
      e._ic = ic;
      e._cat = c;
      var t = el('div', 'cattext');
      t.appendChild(el('div', 'catname', c.name));
      t.appendChild(el('div', 'catsub', c.kind === 'anime' ? 'AI · 2D · 3D' : c.kind === 'movie' ? 'Phim điện ảnh' : 'Phim lẻ 1 tập'));
      e.appendChild(t);
      e._ok = function () { push(CatList(c)); };
      g.appendChild(e);
    });
    v.appendChild(g);

    // Gắn ảnh thật cho từng danh mục: phim xem nhiều nhất thuộc danh mục đó (không tốn hạn mức)
    var used = {};
    function setPhoto(card, f) {
      var url = f && (f.hero || f.thumb);
      if (!url) return;
      used[f.id] = 1;
      var im = new Image();
      im.onload = function () {
        card._photo.style.backgroundImage = 'url("' + url + '")';
        card.classList.add('hasimg');
      };
      im.src = url;
    }
    Promise.all([Api.followedFilms().catch(function () { return []; }), Api.animeAll().catch(function () { return []; }), Api.movieFilms().catch(function () { return []; })]).then(function (r) {
      var movies = r[2] || [];
      var films = r[0].slice().sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
      var anime = r[1].slice().sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
      [].forEach.call(g.children, function (card) {
        var c = card._cat;
        if (!c) return;
        if (c.kind === 'anime') { setPhoto(card, anime.filter(function (f) { return !used[f.id]; })[0] || anime[0]); return; }
        if (c.kind === 'movie') { setPhoto(card, movies.filter(function (f) { return !used[f.id]; })[0]); return; }
        // ưu tiên phim có đúng nhãn danh mục này đứng đầu
        var pick = films.filter(function (f) { return !used[f.id] && Api.catsOf(f)[0] === c.name; })[0] ||
          films.filter(function (f) { return !used[f.id] && Api.catsOf(f).indexOf(c.name) >= 0; })[0] ||
          // chưa có phim gắn nhãn: dùng phim đã tìm cho danh mục này trước đó (nếu có)
          Api.cachedFilms(c.q).filter(function (f) { return !used[f.id]; })[0];
        if (!pick) card._late = true;   // xử lý sau cùng để không lấy mất ảnh của danh mục khác
        else setPhoto(card, pick);
      });
      // Danh mục vẫn chưa có ảnh: lấy ảnh phim nổi bật còn lại để ô nào cũng có hình thật
      [].forEach.call(g.children, function (card) {
        if (!card._late) return;
        setPhoto(card, films.filter(function (f) { return !used[f.id]; })[0]);
      });
    });
    return { name: 'cats', el: v };
  }

  function CatList(cat) {
    var v = UI.view();
    var h = el('div', 'pagehead', cat.name);
    h.appendChild(el('span', 'rh', cat.kind === 'anime' ? 'Hoạt hình AI, 2D, 3D · từ các kênh bạn chọn, mới nhất trước' : cat.kind === 'movie' ? 'Phim lẻ hay · xem nhiều nhất' : 'Phim lẻ 1 tập'));
    v.appendChild(h);
    var holder = el('div', 'gridwrap');
    holder.appendChild(el('div', 'rowmsg', 'Đang tải…'));
    v.appendChild(holder);
    var p = cat.kind === 'anime' ? Api.animeAll() : cat.kind === 'movie' ? Api.movieFilms() : Api.catFilms(cat);
    p.then(function (list) {
      holder.innerHTML = '';
      if (!list.length) { holder.appendChild(el('div', 'rowmsg', 'Chưa có phim phù hợp.')); return; }
      var g = el('div', 'grid4');
      list.forEach(function (it) { g.appendChild(UI.card(it, { grid: true, onSelect: openItem })); });
      holder.appendChild(g);
      if (Nav.cur && !d.body.contains(Nav.cur)) Nav.focusFirst();
      if (current() && current().el === v && Nav.cur && Nav.cur.dataset && Nav.cur.dataset.tab) Nav.focus(g.firstChild, true);
    }).catch(function (e) { holder.innerHTML = ''; holder.appendChild(el('div', 'rowmsg', Api.explain(e))); });
    return { name: 'catlist', el: v };
  }

  /* ---------- Tìm kiếm ---------- */

  function Search() {
    var v = UI.view();
    v.classList.add('search');
    var left = el('div', 'sleft');
    var box = el('div', 'sbox');
    box.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9AA0AE" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
    var qtxt = el('span', 'sq', '');
    box.appendChild(qtxt);
    box.appendChild(el('span', 'caret'));
    var MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    var mic = null, sheet = null;
    function hideSheet() { if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet); sheet = null; if (mic) mic.classList.remove('on'); }
    function listen() {   // tìm bằng giọng nói
      hideSheet();
      sheet = el('div', 'vsheet');
      var ring = el('div', 'vring'); ring.innerHTML = MIC; sheet.appendChild(ring);
      sheet.appendChild(el('div', 'vst', 'Đang nghe…'));
      var said = el('div', 'vsaid', ''); sheet.appendChild(said);
      sheet.appendChild(el('div', 'vtip', 'Nói tiếng Việt, ví dụ: “phim ngọt sủng mới nhất”'));
      sheet.onclick = function () { w.Voice.stop(); hideSheet(); };
      if (!w.Voice.android()) d.body.appendChild(sheet);   // Android TV dùng hộp giọng nói của Google
      if (mic) mic.classList.add('on');
      w.Voice.start(function (t) { said.textContent = '“' + t + '”'; }, function (t) {
        hideSheet();
        t = String(t || '').replace(/[.!?。]+$/, '').trim();
        if (!t) return;
        setQ(t); if (mIn) mIn.value = q; run();
      }, function (msg) { hideSheet(); if (msg) UI.toast(msg); });
    }
    if (w.Voice && w.Voice.available()) {
      mic = el('div', 'smic f'); mic.innerHTML = MIC; mic.title = 'Tìm bằng giọng nói';
      mic._ok = listen;
      mic.onclick = function (e) { e.stopPropagation(); listen(); };
      box.appendChild(mic);
      w.__voiceKeyHere = function () { if (current() && current().el === v) { listen(); return true; } return false; };
    }
    left.appendChild(box);

    var q = '';
    function setQ(s) {
      q = s.slice(0, 40);
      qtxt.textContent = q;
      qtxt.classList.toggle('ph', !q);
      if (!q) qtxt.textContent = '';
    }

    var kb = el('div', 'kb');
    'abcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach(function (ch) {
      var k = el('div', 'key f', ch);
      k._ok = function () { setQ(q + ch); };
      kb.appendChild(k);
    });
    var sp = el('div', 'key f wide3', 'Dấu cách');
    sp._ok = function () { if (q && q.slice(-1) !== ' ') setQ(q + ' '); };
    var del = el('div', 'key f wide3', 'Xóa');
    del._ok = function () { setQ(q.slice(0, -1)); };
    kb.appendChild(sp); kb.appendChild(del);
    var go = el('div', 'key f wide6 gold', 'Tìm kiếm');
    go._ok = function () { run(); };
    kb.appendChild(go);
    left.appendChild(kb);
    left.appendChild(el('div', 'shint', 'Chọn chữ bằng phím mũi tên, nhấn OK để nhập. Không cần gõ dấu tiếng Việt.'));
    v.appendChild(left);

    var pane = el('div', 'spane scroller');
    v.appendChild(pane);

    function suggestions() {
      pane.innerHTML = '';
      pane.scrollTop = 0;
      // 5 từ khóa tìm gần nhất: chọn lại nhanh, đỡ phải gõ trên TV
      var past = Store.searches();
      if (past.length) {
        var ph = el('div', 'pagehead small', 'Tìm gần đây');
        pane.appendChild(ph);
        var pc = el('div', 'sugs');
        past.forEach(function (s0) {
          var c0 = el('div', 'sug past f', s0);
          c0._ok = function () { setQ(s0); mIn.value = s0; run(); };
          pc.appendChild(c0);
        });
        var cx = el('div', 'sug clear f', 'Xóa lịch sử tìm');
        cx._ok = function () { Store.clearSearches(); suggestions(); Nav.focus(go); UI.toast('Đã xóa lịch sử tìm kiếm'); };
        pc.appendChild(cx);
        pane.appendChild(pc);
      }
      pane.appendChild(el('div', 'pagehead small', 'Gợi ý tìm nhanh'));
      var chips = el('div', 'sugs');
      ['xuyên không', 'trùng sinh', 'giả nghèo', 'giả chết', 'tổng tài', 'hoạt hình'].forEach(function (s) {
        var c = el('div', 'sug f', s);
        c._ok = function () { setQ(s); mIn.value = s; run(); };
        chips.appendChild(c);
      });
      pane.appendChild(chips);
    }
    suggestions();

    var token = 0;
    function run() {
      var text = q.trim();
      if (!text) { UI.toast('Hãy nhập từ khóa trước'); return; }
      Store.addSearch(text);
      var my = ++token;
      pane.innerHTML = '';
      pane.scrollTop = 0;
      pane.appendChild(el('div', 'pagehead small', 'Đang tìm “' + text + '”…'));
      var errs = [];
      function safe(p) { return p.catch(function (e) { errs.push(e); return []; }); }
      Promise.all([safe(Api.films(text, 'relevance')), safe(Api.animeSearchLocal(text))]).then(function (res) {
        if (my !== token) return;
        var list = res[0].concat(res[1]);
        pane.innerHTML = '';
        var h = el('div', 'pagehead small', 'Kết quả cho “' + text + '”');
        h.appendChild(el('span', 'rh', list.length + ' phim'));
        pane.appendChild(h);
        if (!list.length) {
          pane.appendChild(el('div', 'rowmsg', errs.length ? Api.explain(errs[0]) : 'Không tìm thấy phim phù hợp. Thử từ khóa khác nhé.'));
          return;
        }
        var g = el('div', 'grid3');
        list.forEach(function (it) { g.appendChild(UI.card(it, { grid: true, onSelect: openItem })); });
        pane.appendChild(g);
        if (Nav.cur === go) Nav.focus(g.firstChild);
      });
    }

    // Điện thoại: ô nhập thật (bàn phím của máy)
    var mIn = d.createElement('input');
    mIn.className = 'minput';
    mIn.type = 'search';
    mIn.placeholder = 'Tìm phim, ví dụ: tổng tài giả nghèo';
    mIn.oninput = function () { setQ(mIn.value.slice(0, 60)); };
    mIn.onkeydown = function (e) { if (e.keyCode === 13) { mIn.blur(); run(); } };
    qtxt.parentNode.appendChild(mIn);
    var view = { name: 'search', el: v };
    // gõ bằng bàn phím thật / dán (bản trình duyệt)
    view.typing = { ch: function (c) { setQ((q + c).slice(0, 60)); }, back: function () { setQ(q.slice(0, -1)); }, enter: function () { run(); } };
    return view;
  }

  /* ---------- Chi tiết ---------- */

  function Detail(item) {
    var v = UI.view();
    var isAnime = item.kind === 'anime';
    var top = el('div', 'dtop');

    var bgImg = item.hero || item.thumb;
    if (bgImg) { var dbg = el('div', 'dbg monly'); dbg.style.backgroundImage = 'url("' + bgImg + '")'; v.appendChild(dbg); }
    var poster = UI.thumb(item, true);
    poster.className = 'thumb poster';
    top.appendChild(poster);

    var info = el('div', 'dinfo');
    var chips = el('div', 'chips');
    if (item.tag) chips.appendChild(el('span', 'chip gold', item.tag));
    chips.appendChild(el('span', 'chip', isAnime || item.anime ? 'Hoạt hình' : 'Phim lẻ'));
    if (isAnime && (item.eps || 0) > 1) chips.appendChild(el('span', 'chip multi', 'Nhiều tập · ' + item.eps + ' tập'));
    if (!isAnime) UI.catChips(chips, item);
    if (item.cc) chips.appendChild(el('span', 'chip', 'CC Phụ đề'));
    info.appendChild(chips);
    info.appendChild(el('h1', 'dtitle', item.title));
    var meta = [];
    if (isAnime) { if (item.eps) meta.push(item.eps + ' tập'); }
    else {
      if (item.dur) meta.push(UI.fmtLong(item.dur));
      if (item.views) meta.push(UI.fmtViews(item.views));
      if (item.pub) meta.push(UI.fmtAgo(item.pub));
    }
    meta.push('HD');
    info.appendChild(el('div', 'dmeta', meta.join('  ·  ')));
    info.appendChild(el('div', 'ddesc', item.desc || 'Chưa có mô tả.'));
    info.appendChild(el('div', 'dsrc', (item.tag === 'AI' ? 'Phim do AI tạo · ' : '') + 'Nguồn: ' + (item.ch || 'YouTube') + ' · phát ngay trong ứng dụng'));

    // Khối "đang xem dở": thanh tiến độ + còn lại bao lâu
    var prog = el('div', 'dprog hidden');
    var progBar = el('div', 'dpbar'), progFill = el('div', 'dpfill');
    progBar.appendChild(progFill);
    var progTxt = el('div', 'dptxt');
    prog.appendChild(progBar);
    prog.appendChild(progTxt);
    info.appendChild(prog);

    var eps = null;
    var btns = el('div', 'btns');
    var bPlay = UI.button('Xem ngay', 'gold', function () { doPlay(false); }, UI.ICON_PLAY);
    var bRe = UI.button(isAnime ? 'Xem từ tập 1' : 'Xem từ đầu', '', function () { doPlay(true); });
    var bFav = UI.button('Danh sách', '', function () {
      var on = Store.toggleFav(item);
      UI.toast(on ? 'Đã thêm vào danh sách của bạn' : 'Đã bỏ khỏi danh sách');
      favLabel();
    }, UI.ICON_PLUS);
    btns.appendChild(bPlay); btns.appendChild(bRe); btns.appendChild(bFav);
    if (msgTargets().length) btns.appendChild(UI.button('✉ Gửi cho…', '', function () { push(MsgTo(item)); }));
    if (item.chId) {
      var bCh = UI.button('', 'favch', function () {
        var on = Store.toggleFavCh({ id: item.chId, name: item.ch });
        chLabel();
        UI.toast(on ? 'Đã thích kênh “' + (item.ch || '') + '”. Phim mới của kênh sẽ hiện đầu Trang chủ' : 'Đã bỏ kênh khỏi danh sách yêu thích');
      });
      var chLabel = function () { var on = Store.isFavCh(item.chId); bCh.setLabel(on ? '★ Kênh yêu thích' : '☆ Thích kênh này'); bCh.classList.toggle('on', on); };
      chLabel();
      btns.appendChild(bCh);
    }
    var bSeen = null;
    if (!isAnime) {
      bSeen = UI.button('Đánh dấu đã xem', '', function () {
        var on = !Store.isWatched(item.id);
        Store.setWatched(item, on);
        UI.toast(on ? 'Đã đánh dấu đã xem. Phim sẽ không hiện ở hàng Phim mới nữa' : 'Đã bỏ đánh dấu, phim hiện lại như chưa xem');
        updateButtons();
      }, UI.ICON_CHECK);
      btns.appendChild(bSeen);
    }
    if (w.Rates) {   // đánh giá: ❤ Thích / 👎 Không thích (bấm lại để bỏ)
      var bLike = UI.button('Thích', '', function () { var on = w.Rates.get(item.id) === 1; w.Rates.set(item, on ? null : 1); paintRate(); UI.toast(on ? 'Đã bỏ đánh giá' : 'Đã lưu: ❤ Thích. Gợi ý sẽ có thêm phim giống vậy'); });
      var bDis = UI.button('Không thích', '', function () { var on = w.Rates.get(item.id) === -1; w.Rates.set(item, on ? null : -1); paintRate(); UI.toast(on ? 'Đã bỏ đánh giá' : 'Đã lưu: 👎 Không thích. Sẽ ít gợi ý phim giống vậy'); });
      var paintRate = function () { var r0 = w.Rates.get(item.id); bLike.setLabel(r0 === 1 ? '❤ Đã thích' : '♡ Thích'); bDis.setLabel(r0 === -1 ? '👎 Không thích ✓' : '👎 Không thích'); bLike.classList.toggle('on', r0 === 1); bDis.classList.toggle('on', r0 === -1); };
      paintRate();
      btns.appendChild(bLike); btns.appendChild(bDis);
    }
    if (!isAnime) {   // danh sách phát hoạt hình (nhiều tập) không có một video để xem bình luận
      btns.appendChild(UI.button('Bình luận', '', function () { push(Comments(item)); },
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>'));
    }
    info.appendChild(btns);
    top.appendChild(info);
    v.appendChild(top);
    // Nhạc hợp phim: bài hát có từ khóa khớp tên phim
    (function () {
      var si = w.MusicPage && w.MusicPage.songForFilm && w.Music && w.Music.S ? w.MusicPage.songForFilm(item) : -1, sg = si >= 0 ? w.Music.S.song(si) : null;
      if (!sg || C.SONG_FOR_FILM === false) return;
      var c = el('div', 'dsong f');
      c.appendChild(el('div', 'dsdisc'));
      var tx = el('div', 'dstx');
      tx.appendChild(el('div', 'dsk', '♪ NGHE BÀI HÁT HỢP PHIM NÀY'));
      tx.appendChild(el('div', 'dst', sg.title));
      tx.appendChild(el('div', 'dsw', 'Nhạc của tôi' + (sg.dur ? ' · ' + Math.floor(sg.dur / 60) + ':' + ('0' + sg.dur % 60).slice(-2) : '')));
      if ((sg.ex || [])[1] || (sg.ex || [])[0]) tx.appendChild(el('div', 'dsx', '“' + (sg.ex[1] || sg.ex[0]) + '”'));
      c.appendChild(tx);
      c.appendChild(el('div', 'dsgo', '▶ Nghe'));
      c._ok = function () { w.MusicPage.openSong(si); };
      c.onclick = function () { c._ok(); };
      v.appendChild(c);
    })();

    function favLabel() {
      var on = Store.isFav(item);
      bFav.setLabel(on ? 'Đã lưu' : 'Danh sách');
      bFav.querySelector('.bico').innerHTML = on ? UI.ICON_CHECK : UI.ICON_PLUS;
    }

    function resumeInfo() {
      if (!isAnime) {
        var p = progressOf(item.id);
        return canResume(p) ? { label: 'Tiếp tục xem', idx: 0, p: p } : null;
      }
      if (!eps) return null;
      var rec = Store.recent().filter(function (r) { return r.key === 'pl:' + item.id; })[0];
      if (!rec) return null;
      for (var i = 0; i < eps.length; i++) {
        if (eps[i].id === rec.vid) {
          var pr = progressOf(rec.vid);
          if (canResume(pr)) return { label: 'Tiếp tục xem tập ' + eps[i].ep, idx: i, p: pr, ep: eps[i].ep, left: eps.length - i };
          if (pr && i < eps.length - 1) return { label: 'Xem tiếp tập ' + eps[i + 1].ep, idx: i + 1, ep: eps[i + 1].ep, left: eps.length - i - 1 };
        }
      }
      return null;
    }

    function updateProgress(r) {
      if (!r) { prog.classList.add('hidden'); return; }
      prog.classList.remove('hidden');
      if (r.p) {
        progFill.style.width = Math.round(Math.min(1, r.p.p / r.p.d) * 100) + '%';
        var t = 'Đã xem ' + UI.fmtLong(r.p.p) + ' / ' + UI.fmtLong(r.p.d) + '  ·  Còn lại ' + UI.fmtLong(r.p.d - r.p.p);
        if (isAnime) t = 'Tập ' + r.ep + ': ' + t;
        progTxt.textContent = t;
      } else {
        progFill.style.width = '0%';
        progTxt.textContent = 'Xem tiếp từ tập ' + r.ep + '  ·  Còn ' + r.left + ' tập';
      }
    }

    function updateButtons() {
      var r = resumeInfo();
      updateProgress(r);
      bPlay.setLabel(r ? r.label : (isAnime ? 'Xem từ tập 1' : 'Xem ngay'));
      bRe.style.display = r ? '' : 'none';
      favLabel();
      if (bSeen) {
        var sn = Store.isWatched(item.id);
        bSeen.setLabel(sn ? 'Đã xem ✓' : 'Đánh dấu đã xem');
        bSeen.classList.toggle('on', sn);
        if (sn && !r) bRe.style.display = '';
      }
    }

    function doPlay(fromStart) {
      if (!isAnime) { playFilm(item, fromStart); return; }
      if (!eps || !eps.length) { UI.toast(eps ? 'Chưa có tập nào phát được' : 'Đang tải danh sách tập…'); return; }
      var r = fromStart ? null : resumeInfo();
      Player.open({
        items: eps, index: r ? r.idx : 0, heading: item.title, key: 'pl:' + item.id,
        series: item, fromStart: fromStart, onClose: afterPlayer, next: pickNext
      });
    }

    if (isAnime) {
      var er = UI.row('Danh sách tập', item.eps ? item.eps + ' tập' : '');
      v.appendChild(er.wrap);
      Api.episodes(item).then(function (list) {
        eps = list;
        er.cards(list, function (e) {
          var p = progressOf(e.id);
          return UI.card(e, {
            title: 'Tập ' + e.ep, sub: e.title, progress: p ? p.p / p.d : null,
            onSelect: function () {
              Player.open({ items: eps, index: eps.indexOf(e) >= 0 ? eps.indexOf(e) : e.ep - 1, heading: item.title, key: 'pl:' + item.id, series: item, onClose: afterPlayer, next: pickNext });
            }
          });
        });
        updateButtons();
      }).catch(function (e) { er.msg(Api.explain(e)); });
    } else if (item.anime) {
      // hoạt hình AI: gợi ý thêm hoạt hình cùng kênh trước, rồi các kênh hoạt hình khác
      var ar = UI.row('Hoạt hình khác', item.ch || '');
      v.appendChild(ar.wrap);
      Api.animeAll().then(function (l) {
        l = l.filter(function (x) { return x.id !== item.id; });
        l.sort(function (a, b) { return (b.chId === item.chId) - (a.chId === item.chId); });
        ar.cards(l.slice(0, 14), function (it) { return UI.card(it, { onSelect: function (x) { push(Detail(x)); } }); });
      }).catch(function (e) { ar.msg(Api.explain(e)); });
    } else {
      var rel = Api.pool().filter(function (x) { return x.id !== item.id; }).slice(0, 12);
      if (rel.length) {
        var rr = UI.row('Có thể bạn thích');
        rr.cards(rel, function (it) { return UI.card(it, { onSelect: function (x) { push(Detail(x)); } }); });
        v.appendChild(rr.wrap);
      }
      v.appendChild(weeklyRow(function (x) { push(Detail(x)); }).wrap);
    }

    updateButtons();
    return { name: 'detail', el: v, refresh: updateButtons };
  }

  /* ---------- Bình luận của phim (YouTube commentThreads, 1 đơn vị hạn mức mỗi lần tải) ---------- */

  function Comments(item) {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Bình luận');
    head.appendChild(el('span', 'rh', item.title));
    var order = 'relevance';
    var bSort = UI.button('Hay nhất', 'small', function () {
      order = order === 'relevance' ? 'time' : 'relevance';
      bSort.setLabel(order === 'relevance' ? 'Hay nhất' : 'Mới nhất');
      load(true);
    });
    head.appendChild(bSort);
    v.appendChild(head);
    var list = el('div', 'cmlist');
    v.appendChild(list);
    var more = null, busy = false;

    function fmtN(n) { return n >= 1000 ? (Math.round(n / 100) / 10) + 'K' : String(n); }
    function note(t) { var m = el('div', 'cmnote f', t); m._ok = function () {}; list.appendChild(m); return m; }

    function load(reset, page) {
      if (busy) return;
      busy = true;
      if (reset) { list.innerHTML = ''; more = null; }
      if (more && more.parentNode) more.parentNode.removeChild(more);
      var wait = el('div', 'cmnote', 'Đang tải bình luận…');
      list.appendChild(wait);
      Api.comments(item.id, { order: order, page: page || '' }).then(function (r) {
        busy = false;
        if (wait.parentNode) list.removeChild(wait);
        if (!r.items.length && reset) { var m = note('Chưa có bình luận nào.'); Nav.focus(m); return; }
        var first = null;
        r.items.forEach(function (c) {
          var row = el('div', 'cm f');
          var top = el('div', 'cmtop');
          top.appendChild(el('span', 'cmwho', c.who));
          top.appendChild(el('span', 'cmmeta', (c.at ? UI.fmtAgo(c.at) + '  ·  ' : '') + '♥ ' + fmtN(c.likes) + (c.replies ? '  ·  ' + c.replies + ' trả lời' : '')));
          row.appendChild(top);
          row.appendChild(el('div', 'cmtxt', c.text));
          row._ok = function () { row.classList.toggle('open'); };   // OK: mở rộng / thu gọn bình luận dài
          list.appendChild(row);
          if (!first) first = row;
        });
        if (r.next) {
          more = UI.button('Xem thêm bình luận', 'small', function () { load(false, r.next); });
          list.appendChild(more);
        }
        if (reset && first) Nav.focus(first);
      }, function (e) {
        busy = false;
        if (wait.parentNode) list.removeChild(wait);
        var m = note(e && e.nokey ? 'Cần YouTube API key để xem bình luận. Vào Cài đặt → YouTube API key.' : Api.explain(e));
        Nav.focus(m);
      });
    }
    load(true);
    return { name: 'comments', el: v };
  }

  /* ---------- Lịch sử ---------- */

  function History() {
    var v = UI.view();
    var h = el('div', 'pagehead hashbtns'); h.appendChild(el('span', 'pht', 'Lịch sử xem · ' + Store.profileName()));
    var clr = UI.button('Xóa lịch sử', 'small', function () {
      if (!clr._armed) {
        clr._armed = true;
        clr.setLabel('Nhấn OK lần nữa để xóa');
        setTimeout(function () { clr._armed = false; clr.setLabel('Xóa lịch sử'); }, 4000);
        return;
      }
      Store.clearHistory();
      UI.toast('Đã xóa lịch sử xem');
      render();
      Nav.focus(clr);
    });
    var unb = UI.button('Hiện lại phim đã bỏ', 'small', function () {
      var n = Store.blockedCount();
      Store.clearBlocked();
      UI.toast(n ? 'Đã hiện lại ' + n + ' phim' : 'Chưa bỏ phim nào');
    });
    var delMode = false, delBtn = clr;
    h.appendChild(UI.button('Thống kê xem', 'small', function () { push(Stats()); }));
    h.appendChild(unb);
    h.appendChild(clr);
    v.appendChild(h);
    if (w.tizen || w.AndroidApp) v.appendChild(el('div', 'histhint', 'Xóa một phim: chọn phim rồi GIỮ LÂU nút giữa (OK) của remote, sẽ hiện hộp hỏi xóa.'));
    else v.appendChild(el('div', 'histhint', 'Xóa một phim: GIỮ LÂU trên ảnh phim để hiện dấu ✕, rồi bấm ✕.'));

    var r1 = UI.row('Đã xem gần đây');
    var r2 = UI.row('Danh sách của tôi');
    v.appendChild(r1.wrap);
    v.appendChild(r2.wrap);

    var canTap = !(w.tizen || w.AndroidApp);   // trình duyệt: có nút ✕ trên từng phim
    // Gắn khả năng xóa vào thẻ: chế độ "Xóa từng phim" (remote) hoặc nút ✕ (chuột / cảm ứng)
    function removable(c, which, doRemove, title) {
      var go = function () {
        var cards = [].slice.call(which.wrap.querySelectorAll('.card.f')), i = cards.indexOf(c);
        doRemove();
        UI.toast('Đã xóa khỏi “' + (which === r1 ? 'Đã xem gần đây' : 'Danh sách của tôi') + '”');
        render();
        var now = [].slice.call(which.wrap.querySelectorAll('.card.f'));
        var next = now[Math.min(i, now.length - 1)] || delBtn;
        Nav.focus(next);
      };
      c._del = go;
      c._hold = function () { push(ConfirmDel(which === r1 ? 'Đã xem gần đây' : 'Danh sách của tôi', title, go)); };
      if (delMode) {
        c.classList.add('delmode');
        c.querySelector('.thumb').appendChild(el('div', 'cdel on', '✕'));
        c._ok = go;
      } else if (canTap) {
        var x = el('div', 'cdel', '✕');
        x.title = 'Xóa khỏi danh sách';
        x.onclick = function (ev) { ev.stopPropagation(); go(); };
        c.querySelector('.thumb').appendChild(x);
      }
      return c;
    }

    function render() {
      var rec = Store.recent().filter(function (r) { return !Settings.hides(r.item); });
      if (!rec.length) r1.msg('Bạn chưa xem phim nào.');
      else r1.cards(rec, function (r) {
        var p = progressOf(r.vid);
        var sub = r.item.kind === 'anime' ? 'Tập ' + r.ep : (p ? (canResume(p) ? 'Còn ' + UI.fmtLong(p.d - p.p) : 'Đã xem xong') : '');
        return removable(UI.card(r.item, { progress: p ? p.p / p.d : null, sub: sub, onSelect: openItem }), r1, function () { Store.removeRecent(r.key); }, r.item.title);
      });
      var fav = Store.favs().filter(function (it) { return !Settings.hides(it); });
      if (!fav.length) r2.msg('Chưa có phim nào. Vào chi tiết phim và chọn “Danh sách”.');
      else r2.cards(fav, function (it) {
        return removable(UI.card(it, { onSelect: openItem }), r2, function () { Store.removeFav(it.id); }, it.title);
      });
    }
    render();
    // Nút VÀNG trên remote (hoặc phím Y): xóa phim đang chọn, bấm hai lần để chắc chắn
    var armed = null, armT = 0;
    function onYellow() {
      var f = Nav.cur;
      if (!f || !f._del) { UI.toast('Chọn một phim ở Lịch sử rồi nhấn nút vàng để xóa phim đó'); return; }
      if (armed === f && Date.now() - armT < 3500) { armed = null; f._del(); return; }
      armed = f; armT = Date.now();
      UI.toast('Nhấn nút vàng lần nữa để xóa phim này');
    }
    return { name: 'history', el: v, refresh: render, onYellow: onYellow };
  }

  /* ---------- Thông tin ---------- */

  /* ---------- Cài đặt ---------- */

  function SettingsScreen() {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Cài đặt');
    head.appendChild(el('span', 'rh', 'Chọn dòng bằng mũi tên, nhấn OK để đổi. Lưu ngay trên TV này.'));
    v.appendChild(head);
    var wrap = el('div', 'setwrap');
    v.appendChild(wrap);
    var est, painters = [];

    function sec(t) { wrap.appendChild(el('div', 'setsec', t)); }

    // Một dòng cài đặt: OK để đổi giá trị
    function row(label, desc, show, onOk) {
      var r = el('div', 'setrow f rowwrap');
      var l = el('div', 'sleft2');
      l.appendChild(el('div', 'sl', label));
      if (desc) l.appendChild(el('div', 'sd', desc));
      r.appendChild(l);
      var val = el('div', 'sv', '');
      r.appendChild(val);
      function paint() {
        var x = show();
        val.textContent = x.t;
        val.classList.toggle('on', !!x.on);
      }
      paint();
      painters.push(paint);
      r._ok = function () { onOk(paint); updEst(); };
      wrap.appendChild(r);
      return r;
    }

    function cycle(key, opts, after) {
      return function (paint) {
        var curV = Settings.get(key), i = 0;
        opts.forEach(function (o, k) { if (o.v === curV) i = k; });
        var nx = opts[(i + 1) % opts.length];
        Settings.set(key, nx.v);
        paint();
        if (after) after(nx);
      };
    }
    function shower(key, opts) {
      return function () {
        var curV = Settings.get(key), o = null;
        opts.forEach(function (x) { if (x.v === curV) o = x; });
        return o ? { t: o.t, on: o.on } : { t: String(curV) };
      };
    }
    // Dòng cài đặt riêng của hồ sơ: hình con thú nhỏ trước tên
    var meP = Store.profiles().filter(function (x) { return x.id === Store.profile(); })[0] || { id: 'guest', name: 'Guest' };
    function markPP(r) {
      var sl = r.querySelector('.sl');
      sl.insertBefore(avatar(meP, 'pp'), sl.firstChild);
      r.classList.add('ppr');
      return r;
    }
    function opt(key, label, desc, opts, after) {
      var r = row(label, desc, shower(key, opts), cycle(key, opts, after));
      return Settings.perProfile(key) ? markPP(r) : r;
    }
    var ONOFF = [{ v: true, t: 'Bật', on: true }, { v: false, t: 'Tắt' }];
    var SHOWHIDE = [{ v: true, t: 'Hiện', on: true }, { v: false, t: 'Ẩn' }];
    function reloadLists() { Store.clearCache(); UI.toast('Đã lưu. Danh sách phim sẽ tải lại theo cài đặt mới'); }

    var ppInfo = el('div', 'setinfo ppinfo');
    ppInfo.appendChild(avatar(meP, 'pp'));
    ppInfo.appendChild(el('span', '', 'Dòng có hình ' + meP.name + ' là cài đặt RIÊNG của hồ sơ “' + meP.name + '” (giao diện, đồng hồ, nhạc nền, chủ đề, xem phim, các hàng Trang chủ, lọc lứa tuổi). Mỗi người chỉnh theo ý mình; đổi hồ sơ là đổi theo. Các dòng khác dùng chung cho cả máy.'));
    wrap.appendChild(ppInfo);
    sec('Giao diện');
    opt('THEME', 'Giao diện Tối / Sáng', 'Tự động = đổi theo chế độ của điện thoại / máy tính',
      [{ v: 'dark', t: 'Tối', on: true }, { v: 'light', t: 'Sáng', on: true }, { v: 'auto', t: 'Tự động', on: true }]);
    opt('BOOT_SECS', 'Màn hình khởi động', 'Hiện logo bao lâu khi mở app. Bấm OK để vào ngay bất cứ lúc nào', [
      { v: 'auto', t: 'Đến khi tải xong', on: true }, { v: 1, t: '1 giây', on: true }, { v: 2, t: '2 giây', on: true }, { v: 3, t: '3 giây', on: true },
      { v: 5, t: '5 giây', on: true }, { v: 8, t: '8 giây', on: true }]);
    opt('SCREENSAVER', 'Màn hình chờ', 'Để yên bao lâu thì hiện ảnh bìa phim mới chạy chậm kèm đồng hồ. Đang chiếu phim thì không hiện', [
      { v: 0, t: 'Tắt' }, { v: 5, t: '5 phút', on: true }, { v: 10, t: '10 phút', on: true }, { v: 15, t: '15 phút', on: true }, { v: 30, t: '30 phút', on: true }]);
    opt('SAVER_QUOTE', 'Câu thoại tổng tài', 'Mỗi lần màn hình chờ hiện là một câu thoại tổng tài mới (250 câu, 5 chủ đề), kèm tên phim', [{ v: true, t: 'Bật', on: true }, { v: false, t: 'Tắt' }]);
    opt('SLEEP_AT', 'Chế độ ngủ', 'Tới giờ này: màn hình tối dần, âm lượng nhỏ lại, hết phim thì tắt app (có nút xem thêm 15 phút)', [{ v: '', t: 'Tắt' }, { v: '21:00', t: '21:00', on: true }, { v: '21:30', t: '21:30', on: true }, { v: '22:00', t: '22:00', on: true }, { v: '22:30', t: '22:30', on: true }, { v: '23:00', t: '23:00', on: true }]);
    opt('SLEEP_WHO', 'Chế độ ngủ áp dụng cho', 'Cả nhà, hoặc chỉ khi đang xem bằng hồ sơ có giới hạn giờ xem', [{ v: 'all', t: 'Cả nhà', on: true }, { v: 'lim', t: 'Hồ sơ có giới hạn', on: true }]);
    opt('PRELOAD', 'Tải sẵn ảnh bìa', 'Lưu sẵn ảnh bìa phim mới khi rảnh để TV mở nhanh, đỡ giật khi mạng yếu (tạm dừng khi đang xem phim)', [{ v: true, t: 'Bật', on: true }, { v: false, t: 'Tắt' }]);
    row('Xem thử màn hình chờ', 'Bấm phím bất kỳ để quay lại', function () { return { t: 'Xem thử' }; }, function () { if (w.Saver) setTimeout(w.Saver.show, 150); });
    opt('CLOCK_12', 'Đồng hồ', 'Kiểu giờ ở góc trên và trong app', [{ v: true, t: '12 giờ (2:05 PM)', on: true }, { v: false, t: '24 giờ (14:05)', on: true }]);

    sec('Hồ sơ người xem');
    row('Đang xem với hồ sơ', 'Mỗi hồ sơ có lịch sử, phim xem dở, danh sách và từ khóa tìm kiếm riêng', function () {
      return { t: Store.profileName() + ' · Đổi', on: true };
    }, function () { push(Who()); });
    row('Giới hạn giờ xem', 'Số giờ xem mỗi ngày và khung giờ được xem cho từng hồ sơ. Đổi cần mã PIN người lớn', function () {
      var n = Object.keys(limAll()).filter(function (k) { return limOf(k); }).length;
      return { t: n ? n + ' hồ sơ có giới hạn' : 'Chưa đặt', on: !!n };
    }, function () { withPin('đặt giới hạn giờ xem', function () { setTimeout(function () { push(LimitList()); }, 30); }); });
    row('Ngày sinh của hồ sơ', 'Hôm đó app chúc mừng sinh nhật, có pháo bông, nhạc và thêm 30 phút xem phim (nếu có giới hạn giờ)', function () {
      var b = bdayOf(Store.profile()); return { t: b ? Store.profileName() + ' · ' + b : 'Chưa đặt', on: !!b };
    }, function (paint) {
      push(TextEdit('Ngày sinh của ' + Store.profileName() + ' (ngày và tháng)', (bdayOf(Store.profile()) || '').replace('/', ''), function (val) {
        var m = /^(\d{1,2})\D?(\d{1,2})$/.exec(String(val || '').trim()), bd = Store.pref('bdays', {}) || {};
        if (!String(val || '').trim()) { delete bd[Store.profile()]; Store.setPref('bdays', bd); paint(); UI.toast('Đã xóa ngày sinh'); return; }
        if (!m || +m[1] < 1 || +m[1] > 31 || +m[2] < 1 || +m[2] > 12) { UI.toast('Nhập ngày rồi tháng, ví dụ 1411 cho 14/11'); return; }
        bd[Store.profile()] = ('0' + m[1]).slice(-2) + '/' + ('0' + m[2]).slice(-2); Store.setPref('bdays', bd); paint();
        UI.toast('Đã lưu sinh nhật ' + Store.profileName() + ': ' + bd[Store.profile()]);
      }, { hint: 'Gõ ngày rồi tháng, ví dụ 1411 cho ngày 14 tháng 11. Để trống rồi Lưu để xóa.' }));
    });
    row('Hồ sơ xem báo cáo tuần', 'Sáng thứ Hai, Trang chủ của các hồ sơ này hiện báo cáo tuần của cả nhà. Đổi cần mã PIN người lớn', function () {
      var a = (Store.pref('adults', []) || []).map(function (id) { return (profileOf(id) || { name: id === 'guest' ? 'Guest' : '' }).name; }).filter(Boolean);
      return { t: a.length ? a.join(', ') : 'Chưa chọn', on: !!a.length };
    }, function (paint) {
      withPin('chọn hồ sơ xem báo cáo tuần', function () {
        setTimeout(function () {
          var v2 = UI.view(); v2.classList.add('scroller');
          var h2 = el('div', 'pagehead', 'Hồ sơ xem báo cáo tuần'); h2.appendChild(el('span', 'rh', 'OK để bật / tắt')); v2.appendChild(h2);
          var wr = el('div', 'limwrap'), first = null;
          [{ id: 'guest', name: 'Guest' }].concat(Store.profiles().filter(function (p) { return p.id !== 'guest'; })).forEach(function (p0) {
            var pr = profileOf(p0.id) || p0, r = el('div', 'setrow f rowwrap ppr'), l = el('div', 'sleft2'), sl = el('div', 'sl');
            sl.appendChild(avatar(pr, 'pp')); sl.appendChild(d.createTextNode(pr.name)); l.appendChild(sl); r.appendChild(l);
            var val = el('div', 'sv'); r.appendChild(val);
            function pt() { var on = (Store.pref('adults', []) || []).indexOf(pr.id) >= 0; val.textContent = on ? 'Xem báo cáo' : 'Không'; val.classList.toggle('on', on); }
            r._ok = function () { var a = (Store.pref('adults', []) || []).slice(), i = a.indexOf(pr.id); if (i >= 0) a.splice(i, 1); else a.push(pr.id); Store.setPref('adults', a); pt(); paint(); };
            pt(); wr.appendChild(r); if (!first) first = r;
          });
          v2.appendChild(wr);
          push({ name: 'adults', el: v2 });
          setTimeout(function () { Nav.focus(first, true); }, 30);
        }, 30);
      });
    });
    row('Hình đại diện', 'Chọn 1 trong 25 hình thú kawaii cho hồ sơ đang xem', function () {
      var me = Store.profiles().filter(function (x) { return x.id === Store.profile(); })[0] || {};
      return { t: me.av != null && w.Avatars ? w.Avatars.name(me.av) : 'Chưa chọn' };
    }, function (paint) {
      var me = Store.profiles().filter(function (x) { return x.id === Store.profile(); })[0];
      push(AvatarPick(me.name, me.av != null ? me.av : freeAvatar(), function (av) { Store.setAvatar(me.id, av); paintWho(); paint(); UI.toast('Đã đổi hình'); }));
    });
    row('Kênh yêu thích', 'Phim mới của các kênh này hiện đầu Trang chủ (riêng từng hồ sơ)', function () {
      var n = Store.favChs().length; return { t: n ? n + ' kênh' : 'Chưa chọn', on: !!n };
    }, function () { push(FavChannels()); });
    row('Thống kê xem', 'Số phút xem mỗi ngày, kênh xem nhiều nhất, so sánh các hồ sơ', function () {
      var t = 0; weekOf(Store.stats()).forEach(function (d) { t += d.s; });
      return { t: '7 ngày: ' + fmtMin(t) };
    }, function () { push(Stats()); });
    markPP(row('Mã PIN của hồ sơ này', 'Khóa hồ sơ đang xem: chọn hồ sơ này ở “Ai đang xem?” phải nhập mã. Mã PIN người lớn mở được mọi hồ sơ', function () {
      var me = profileOf(Store.profile()) || {}; return me.pinH ? { t: '🔒 Đã đặt · Đổi / Bỏ', on: true } : { t: 'Chưa đặt · Đặt' };
    }, function (paint) {
      var me = profileOf(Store.profile());
      if (!me) return;
      if (!me.pinH) { setProfilePinFlow(me, paint); return; }
      push(ProfileMenu(me, true));   // Đổi mã PIN / Bỏ mã PIN
    }));
    opt('ASK_PROFILE', 'Hỏi “Ai đang xem?” khi mở app', '', ONOFF);

    sec('Lọc theo lứa tuổi');
    markPP(row('Chỉ hiện phim phù hợp lứa tuổi', 'Riêng từng hồ sơ: ẩn phim có từ khóa nhạy cảm trong tên hoặc mô tả. Tắt cần mã PIN người lớn', function () {
      var on = Settings.get('AGE_FILTER') === true; return { t: on ? 'Bật' : 'Tắt', on: on };
    }, function (paint) {
      if (Settings.get('AGE_FILTER') !== true) { Settings.set('AGE_FILTER', true); paint(); UI.toast('Đã bật lọc theo lứa tuổi'); return; }
      withPin('tắt lọc theo lứa tuổi', function () { Settings.set('AGE_FILTER', false); paint(); UI.toast('Đã tắt lọc theo lứa tuổi'); });
    }));
    row('Từ khóa nhạy cảm', 'Danh sách bạn tự quản lý: thêm, xóa từ khóa. Cần mã PIN', function () {
      return { t: (Settings.get('AGE_WORDS') || []).length + ' từ khóa' };
    }, function () { withPin('sửa từ khóa nhạy cảm', function () { push(AgeWords()); }); });

    row('Mã PIN', 'Dùng khi tắt lọc, sửa từ khóa, khôi phục mặc định. Đồng bộ sang các máy đã đăng nhập', function () {
      return Settings.pinIsDefault() ? { t: 'Đang dùng 1234 · Đổi' } : { t: 'Đã đổi · Đổi', on: true };
    }, function (paint) { changePin(paint); });

    sec('Nhạc nền Trang chủ');
    var MOPTS = [{ v: 'songs', t: 'Nhạc của tôi (lần lượt)', on: true }, { v: 'songsx', t: 'Nhạc của tôi (trộn bài)', on: true }, { v: 'auto', t: 'Hòa tấu (lần lượt 5 bài)', on: true }, { v: 'off', t: 'Tắt' }].concat(
      (w.Music ? w.Music.tracks() : []).map(function (n, i) { return { v: i, t: (i + 1) + '. ' + n, on: true }; }));
    opt('MUSIC', 'Nhạc nền', 'Nhạc của tôi (bài hát trong thư mục music/) hoặc 5 bản hòa tấu. Chỉ phát ở Trang chủ, tự dừng khi xem phim, quay lại phát tiếp. Mỗi lần OK đổi một kiểu', MOPTS);
    opt('MUSIC_VIEW', 'Kiểu trang Nhạc', 'Kiểu A: ảnh + lời + bài tiếp theo. Kiểu B: ảnh phủ toàn màn hình, lời to kiểu karaoke. Đổi nhanh bằng nút trên trang Nhạc', [{ v: 'split', t: 'Kiểu A: chia đôi', on: true }, { v: 'karaoke', t: 'Kiểu B: toàn màn hình', on: true }]);
    row('Chọn bài (Nhạc của tôi)', 'Danh sách bài hát của bạn. OK để nghe bài đó ngay', function () {
      var n = w.Music && w.Music.songs ? w.Music.songs().length : 0;
      return { t: n ? n + ' bài · Mở' : 'Mở', on: n > 0 };
    }, function () { push(SongPick()); });
    row('Hẹn giờ tắt nhạc', 'Nghe nhạc 15, 30, 60 phút hoặc hết bài rồi tự tắt (nhạc nhỏ dần trong 30 giây). Nút 🌙 cũng có ở trang Nhạc', function () {
      var t = w.MusicPage && w.MusicPage.sleepText ? w.MusicPage.sleepText() : '';
      return t ? { t: t.replace('🌙 ', ''), on: true } : { t: 'Tắt · Đặt giờ' };
    }, function () { if (w.MusicPage) w.MusicPage.sleep(); });
    opt('MUSIC_LEVEL', 'Cân bằng âm lượng các bài', 'Bài nào cũng nghe to như nhau, ở Trang chủ, trang Nhạc và màn hình chờ', [{ v: true, t: 'Bật', on: true }, { v: false, t: 'Tắt' }]);
        opt('MUSIC_VOL', 'Âm lượng nhạc nền', 'Ngưỡng: rất nhỏ, vừa đủ nghe (nhỏ hơn mức Nhỏ)', [{ v: 'min', t: 'Ngưỡng', on: true }, { v: 'low', t: 'Nhỏ', on: true }, { v: 'mid', t: 'Vừa', on: true }, { v: 'high', t: 'To', on: true }]);

    sec('Chủ đề theo mùa và ngày lễ');
    markPP(row('Chủ đề', 'Tự động đổi theo ngày: Tết, Noel, Năm mới, Valentine, 8/3, 20/10, 1/6, Ngày của Mẹ/Cha, Trung thu, Halloween, Lễ Tạ Ơn, hoa anh đào, 4 mùa', function () {
      var m = Settings.get('SEASON'), th = w.Season ? w.Season.current() : null;
      if (m === 'off') return { t: 'Tắt' };
      if (m === 'auto') return { t: 'Tự động · ' + (th ? th.name : 'không có'), on: true };
      return { t: (th ? th.name : m) + ' (chọn tay)', on: true };
    }, function () { push(SeasonPick()); }));
    opt('SEASON_FX', 'Hiệu ứng rơi (tuyết, hoa, lá, bóng bay…)', 'Tắt nếu TV chạy chậm. Vẫn giữ dây đèn và hình trên logo', ONOFF);

    sec('Cập nhật phim mới');
    opt('AUTO_REFRESH', 'Tự cập nhật phim mới', 'Lấy video mới từ các kênh theo dõi khi đang mở app', ONOFF);
    opt('REFRESH_HOURS', 'Cập nhật mỗi', 'Càng thưa càng tiết kiệm hạn mức', [1, 2, 3, 6, 12].map(function (h) { return { v: h, t: h + ' giờ' }; }));
    opt('QUOTA_SAVER', 'Tiết kiệm đơn vị YouTube', 'Gần hết 10.000 đơn vị trong ngày thì tự làm mới phim chậm lại; quá 90% thì chỉ hiện phim đã lưu', [{ v: true, t: 'Tự động', on: true }, { v: false, t: 'Tắt' }]);
    opt('IDLE_STOP_HOURS', 'Tạm dừng khi TV để không', 'Không ai bấm remote một lúc thì ngừng cập nhật',
      [{ v: 1, t: 'Sau 1 giờ' }, { v: 3, t: 'Sau 3 giờ' }, { v: 6, t: 'Sau 6 giờ' }, { v: 0, t: 'Không tạm dừng' }]);
    opt('CHANNEL_VIDEOS', 'Số video lấy mỗi kênh', 'Nhiều hơn = danh mục đầy hơn, vẫn 1 đơn vị/kênh',
      [10, 25, 50].map(function (n) { return { v: n, t: n + ' video' }; }), reloadLists);

    sec('Tài khoản Google (đồng bộ nhiều máy)');
    function hhmm2(t) { return t ? UI.hhmm(t) : '—'; }
    row('Đăng nhập Google', 'Giữ lịch sử, phim xem dở, danh sách, cài đặt giống nhau trên TV, điện thoại, máy tính', function () {
      var s = Sync.status();
      if (!s.configured) return { t: 'Chưa cài Client ID' };
      if (s.google && !s.expired) return { t: s.email || 'Đã đăng nhập', on: true };
      return { t: s.expired ? 'Đăng nhập lại' : 'Đăng nhập', on: false };
    }, function (paint) {
      var s = Sync.status();
      if (!s.configured) { UI.toast('Cần điền Google Client ID trong config.js (xem Hướng dẫn → Đăng nhập Google)'); return; }
      if (s.google && !s.expired && !s.needTap) { UI.toast('Đã đăng nhập ' + (s.email || '') + '. Chọn “Đăng xuất” để đổi tài khoản.'); return; }
      if (s.web) {
        Sync.webLogin().then(function () { paint(); UI.toast('Đã đăng nhập và đồng bộ'); goTab('settings'); },
          function () { UI.toast('Chưa đăng nhập được Google'); });
      } else push(GoogleLogin());
    });
    row('Đồng bộ ngay', 'Tự đồng bộ khi mở app, sau khi xem phim và mỗi 10 phút', function () {
      var s = Sync.status();
      if (!s.loggedIn) return { t: '—' };
      return { t: s.error ? s.error : 'Lần cuối ' + hhmm2(s.lastSync), on: !s.error };
    }, function (paint) {
      var s = Sync.status();
      if (!s.loggedIn) { UI.toast('Hãy đăng nhập Google hoặc kết nối GitHub trước'); return; }
      var p = s.google && s.needTap && s.web ? Sync.webLogin() : Sync.sync('manual');
      UI.toast('Đang đồng bộ…');
      p.then(function () { paint(); var st = Sync.status(); UI.toast(st.error || 'Đã đồng bộ'); }, function () { paint(); });
    });
    row('Đăng xuất Google', 'Dữ liệu trên máy này vẫn giữ nguyên', function () {
      return { t: Sync.status().google ? 'Đăng xuất' : '—' };
    }, function (paint) {
      if (!Sync.status().google) return;
      Sync.logout(); UI.toast('Đã đăng xuất Google'); goTab('settings');
    });

    sec('Đồng bộ bằng GitHub (cách khác, không cần Google)');
    row('Token GitHub', 'Dán token quyền gist (xem Hướng dẫn). Lưu trên máy này, dữ liệu nằm trong Gist riêng tư của bạn', function () {
      return Sync.status().github ? { t: 'Đã kết nối', on: true } : { t: 'Chưa có' };
    }, function (paint) {
      push(TextEdit('Token GitHub (quyền gist)', '', function (val) {
        UI.toast('Đang kiểm tra token…');
        Sync.connectGithub(val).then(function () { UI.toast(Sync.status().error || 'Đã kết nối GitHub và đồng bộ'); goTab('settings'); },
          function (e) {
            UI.toast(e && e.bad ? 'Token quá ngắn, hãy dán lại đủ' : e && e.status === 401 ? 'Token GitHub không đúng hoặc đã hết hạn' :
              e && e.net ? 'Không có mạng' : 'GitHub từ chối token (cần quyền gist)');
          });
      }));
    });
    row('Ngắt kết nối GitHub', 'Dữ liệu trên máy này vẫn giữ nguyên', function () {
      return { t: Sync.status().github ? 'Ngắt kết nối' : '—' };
    }, function () {
      if (!Sync.status().github) return;
      Sync.disconnectGithub(); UI.toast('Đã ngắt kết nối GitHub'); goTab('settings');
    });

    sec('Sao lưu tự động hằng tuần');
    function when(t) {
      var x = new Date(t), p2 = function (n) { return n < 10 ? '0' + n : '' + n; };
      return UI.hhmm(t) + ' · ' + p2(x.getDate()) + '/' + p2(x.getMonth() + 1) + '/' + x.getFullYear();
    }
    opt('AUTO_BACKUP', 'Sao lưu tự động mỗi tuần', 'Vào Google Drive (giữ 4 bản gần nhất) hoặc GitHub Gist (giữ mọi bản). Cần đăng nhập ở trên', ONOFF);
    row('Sao lưu ngay', 'Bấm để sao lưu lịch sử, danh sách, hồ sơ, cài đặt ngay bây giờ', function () {
      var b = Sync.backupStatus();
      if (!b.can) return { t: 'Cần đăng nhập Google hoặc GitHub' };
      if (b.error) return { t: b.error };
      return b.at ? { t: 'Đã sao lưu lúc ' + when(b.at), on: true } : { t: 'Chưa sao lưu' };
    }, function (paint) {
      if (!Sync.backupStatus().can) { UI.toast('Hãy đăng nhập Google hoặc kết nối GitHub ở trên trước'); return; }
      UI.toast('Đang sao lưu…');
      Sync.backupNow('manual').then(function (r) { paint(); UI.toast('Đã sao lưu lúc ' + UI.hhmm(r.at) + ' vào ' + r.where); },
        function () { paint(); UI.toast(Sync.backupStatus().error || 'Chưa sao lưu được'); });
    });
    row('Khôi phục bản sao lưu', 'Lấy bản sao lưu mới nhất về, gộp với dữ liệu trên máy này (không xóa gì)', function () {
      return { t: Sync.backupStatus().can ? 'Khôi phục' : '—' };
    }, function () {
      if (!Sync.backupStatus().can) { UI.toast('Hãy đăng nhập Google hoặc kết nối GitHub ở trên trước'); return; }
      UI.toast('Đang tải bản sao lưu…');
      Sync.restoreLatest().then(function (r) {
        UI.toast('Đã khôi phục bản ' + (r.at ? when(r.at) : '') + ': ' + r.films + ' phim có tiến độ, ' + r.favs + ' phim trong danh sách');
        paintWho();
      }, function (e) {
        UI.toast(e && e.none ? 'Chưa có bản sao lưu nào. Bấm “Sao lưu ngay” trước' : e && e.net ? 'Mất mạng, chưa tải được bản sao lưu' : 'Không khôi phục được');
      });
    });

    sec('Sao lưu bằng mã (không cần đăng nhập)');
    row('Xuất mã sao lưu', 'Mọi hồ sơ, hình, mã PIN, lịch sử, danh sách, cài đặt. Lưu mã này trước khi cài lại app hoặc đổi máy', function () { return { t: 'Mở' }; }, function () { push(Backup('out')); });
    row('Nhập mã sao lưu', 'Dán mã đã xuất từ máy khác (gộp với dữ liệu trên máy này)', function () { return { t: 'Mở' }; }, function () { push(Backup('in')); });

    sec('Remote');
    opt('OK2_HOME', 'Bấm OK 2 lần liên tục để về Trang chủ', 'Không áp dụng khi đang gõ chữ hoặc ở trang Cài đặt', ONOFF);

    sec('Trang chủ');
    opt('HIDE_WATCHED', 'Ẩn phim đã xem hết', 'Không hiện lại ở Phim mới, Đang hot, Đề xuất, Phim lẻ hay. Nơi khác có dấu “✓ Đã xem”', ONOFF);
    var sortRow = markPP(row('Sắp xếp các hàng', 'Đổi thứ tự các hàng ở Trang chủ theo ý hồ sơ đang xem', function () { return { t: 'Sắp xếp' }; }, function () { push(RowOrder()); }));
    var RDESC = { favch: 'Hàng phim mới của các kênh hồ sơ đang xem yêu thích', rec: 'Theo thể loại hồ sơ đang xem hay xem', top: 'Hiện ở Trang chủ và trang chi tiết phim' };
    var FAVOPT = [{ v: false, t: 'Ẩn' }, { v: true, t: 'Hiện', on: true }];
    var homeRows = {};
    homeOrder().forEach(function (k) { homeRows[k] = opt(ROW_KEYS[k], ROW_NAMES[k], RDESC[k] || '', k === 'favch' ? FAVOPT : SHOWHIDE); });
    function reorderHomeRows() {   // sau khi sắp xếp xong, dòng trong Cài đặt cũng theo thứ tự mới
      var prev = sortRow;
      homeOrder().forEach(function (k) { prev.parentNode.insertBefore(homeRows[k], prev.nextSibling); prev = homeRows[k]; });
    }

    sec('Danh mục và phim');
    opt('CAT_SEARCH_MORE', 'Danh mục ít phim thì tìm thêm trên YouTube', 'Mỗi lần tìm thêm tốn khoảng 100 đơn vị', ONOFF);
    opt('MIN_FILM_MINUTES', 'Phim lẻ dài tối thiểu', '', [10, 20, 30, 45].map(function (n) { return { v: n, t: n + ' phút' }; }), reloadLists);
    opt('MIN_ANIME_MINUTES', 'Hoạt hình dài tối thiểu', '', [1, 3, 5, 10].map(function (n) { return { v: n, t: n + ' phút' }; }), reloadLists);
    opt('HIDE_VERTICAL', 'Phim quay dọc', 'Chiếu giữa màn hình giống YouTube',
      [{ v: false, t: 'Hiện', on: true }, { v: true, t: 'Ẩn' }], reloadLists);

    sec('Xem phim');
    opt('AUTO_NEXT', 'Tự phát phim tiếp theo', 'Hết phim: đếm ngược 30 giây, có nút “Phát ngay” và “Hủy”', ONOFF);
    row('Phụ đề tiếng Việt khi mở phim', '', function () {
      var on = !!Store.pref('cc', true); return { t: on ? 'Bật' : 'Tắt', on: on };
    }, function (paint) { Store.setPref('cc', !Store.pref('cc', true)); paint(); });
    var QS = [{ v: 'auto', t: 'Tự động' }, { v: 'hd2160', t: '4K' }, { v: 'hd1080', t: '1080p' }, { v: 'hd720', t: '720p' }, { v: 'large', t: '480p' }];
    row('Chất lượng mặc định', 'YouTube có thể tự hạ khi mạng yếu', function () {
      var q = Store.pref('quality', (w.DEVICE && w.DEVICE.is4k) ? 'hd2160' : 'auto'), t = q;
      QS.forEach(function (o) { if (o.v === q) t = o.t; });
      return { t: t };
    }, function (paint) {
      var q = Store.pref('quality', (w.DEVICE && w.DEVICE.is4k) ? 'hd2160' : 'auto'), i = 0;
      QS.forEach(function (o, k) { if (o.v === q) i = k; });
      Store.setPref('quality', QS[(i + 1) % QS.length].v);
      paint();
    });

    sec('Kết nối');
    function mask(s) { return s ? (s.length > 14 ? s.slice(0, 8) + '…' + s.slice(-4) : s) : 'Chưa có'; }
    row('YouTube API key', 'Bấm để nhập hoặc dán key. Lưu trên thiết bị này', function () {
      return { t: mask(Settings.get('API_KEY')), on: !!Settings.get('API_KEY') };
    }, function (paint) {
      push(TextEdit('YouTube API key', Settings.get('API_KEY') || '', function (val) {
        Settings.set('API_KEY', val.trim()); paint(); UI.toast('Đã lưu API key');
      }));
    });
    row('Máy chủ thống kê (quản trị)', 'Nơi app gửi thiết bị, hồ sơ và thời gian xem cho trang quản trị của phụ huynh. Đổi cần mã PIN người lớn', function () {
      var h = Settings.get('STATS_URL');
      return { t: h ? 'Đang bật · ' + h.replace(/^https?:\/\//, '').slice(0, 26) : 'Tắt', on: !!h };
    }, function (paint) {
      withPin('đổi máy chủ thống kê', function () {
        setTimeout(function () {
          push(TextEdit('Địa chỉ máy chủ thống kê (để trống = tắt)', Settings.get('STATS_URL') || 'https://', function (val) {
            val = val.trim(); if (val === 'https://') val = '';
            Settings.set('STATS_URL', val.replace(/\/+$/, '')); paint();
            UI.toast(val ? 'Đã bật gửi số liệu cho trang quản trị' : 'Đã tắt gửi số liệu');
          }));
        }, 30);
      });
    });
    row('Địa chỉ nhạc (Nhạc của tôi)', 'Trang GitHub Pages có thư mục music/. Để trống: bản web tự lấy cùng chỗ, TV dò theo PLAYER_HOST', function () {
      var h = Settings.get('MUSIC_URL'), src = w.Music && w.Music.songsSource ? w.Music.songsSource() : '';
      return { t: h ? h.replace(/^https?:\/\//, '').slice(0, 34) : (src ? 'Tự động · đã có nhạc' : 'Tự động'), on: !!(h || src) };
    }, function (paint) {
      push(TextEdit('Địa chỉ nhạc', Settings.get('MUSIC_URL') || 'https://', function (val) {
        val = val.trim();
        if (val === 'https://') val = '';
        Settings.set('MUSIC_URL', val); paint();
        if (w.Music && w.Music.reloadSongs) w.Music.reloadSongs().then(function (l) { UI.toast(l && l.length ? 'Đã tìm thấy ' + l.length + ' bài' : 'Chưa tìm thấy music/list.json ở địa chỉ này'); paint(); });
      }));
    });
    row('PLAYER_HOST (Samsung)', 'Trang phát video trên GitHub Pages', function () {
      var h = Settings.get('PLAYER_HOST');
      return { t: h ? h.replace(/^https?:\/\//, '').slice(0, 34) : 'Chưa có', on: !!h };
    }, function (paint) {
      push(TextEdit('PLAYER_HOST', Settings.get('PLAYER_HOST') || 'https://', function (val) {
        val = val.trim();
        if (val === 'https://') val = '';
        Settings.set('PLAYER_HOST', val); paint(); UI.toast('Đã lưu. Mở phim để dùng địa chỉ mới');
      }));
    });

    sec('Kênh theo dõi');
    if (w.tizen || w.AndroidApp) wrap.appendChild(el('div', 'setinfo', 'Xóa một kênh: chọn kênh rồi GIỮ LÂU nút giữa (OK), sẽ hiện hộp hỏi xóa.')); else wrap.appendChild(el('div', 'setinfo', 'Xóa một kênh: GIỮ LÂU trên dòng kênh để hiện dấu ✕, rồi bấm ✕.'));
    var TYPES = [{ v: 'drama', t: 'Phim ngắn', on: true }, { v: 'movie', t: 'Phim lẻ hay', on: true }, { v: 'anime', t: 'Hoạt hình', on: true }, { v: 'off', t: 'Tắt' }];
    function addRow() {
      row('+ Thêm kênh mới', 'Gõ tên kênh, @tên-kênh hoặc mã kênh UC…, rồi chọn Phim ngắn, Phim lẻ hay hoặc Hoạt hình', function () {
        return { t: 'Thêm', on: true };
      }, function () {
        push(TextEdit('Thêm kênh YouTube', '', null, {
          space: true,
          hint: 'Gõ tên kênh (không cần dấu), hoặc @tên-kênh. Chọn nút lưu theo loại kênh. Back để hủy.',
          saves: [
            { label: 'Lưu vào Phim ngắn', type: 'drama' },
            { label: 'Lưu vào Phim lẻ hay', type: 'movie' },
            { label: 'Lưu vào Hoạt hình', type: 'anime' }
          ].map(function (o) {
            return {
              label: o.label, fn: function (val) {
                var r = Settings.addChannel(val, o.type), where = o.type === 'anime' ? 'Hoạt hình' : o.type === 'movie' ? 'Phim lẻ hay' : 'Phim ngắn';
                if (!r) { UI.toast('Chưa nhập tên kênh'); return; }
                if (r === 'added') UI.toast('Đã thêm “' + val.trim() + '” vào ' + where + '. Lần tìm kênh đầu tốn ~100 đơn vị');
                else UI.toast('Kênh “' + r.slice(7) + '” đã có, chuyển vào ' + where);
                setTimeout(function () { goTab('settings'); }, 50);
              }
            };
          })
        }));
      });
    }
    addRow();
    Settings.channels().forEach(function (c) {
      row(c.name, c.extra ? 'Kênh bạn thêm' : '', function () {
        var t = Settings.channels().filter(function (x) { return x.name === c.name; })[0];
        var o = TYPES.filter(function (x) { return t && x.v === t.type; })[0] || TYPES[0];
        return { t: o.t, on: o.on };
      }, function (paint) {
        var t = Settings.channels().filter(function (x) { return x.name === c.name; })[0];
        var i = 0;
        TYPES.forEach(function (x, k) { if (t && x.v === t.type) i = k; });
        Settings.setChannelType(c.name, TYPES[(i + 1) % TYPES.length].v);
        paint();
      });
      var rr = wrap.lastChild;
      var delCh = function () {
        push(ConfirmDel('Kênh theo dõi', c.name, function () {
          Settings.removeChannel(c.name); Store.clearCache(); UI.toast('Đã xóa kênh ' + c.name);
          setTimeout(function () { goTab('settings'); }, 50);
        }, 'kênh'));
      };
      rr._hold = delCh;
      if (!w.tizen && !w.AndroidApp) {
        var x = el('span', 'chdel', '✕');
        x.title = 'Xóa kênh này';
        x.onclick = function (ev) { ev.stopPropagation(); delCh(); };
        rr.appendChild(x);
      }
    });

    sec('Hỗ trợ');
    row('Nhật ký lỗi', '50 dòng gần nhất, có nút “Sao chép để gửi” khi cần hỗ trợ', function () {
      var n = w.Log ? w.Log.errCount() : 0;
      return { t: n ? n + ' lỗi' : 'Không có lỗi', on: !n };
    }, function () { push(ErrorLog()); });
    row('Giới thiệu và kiểm tra bản mới', 'Phiên bản ' + C.VERSION + ' · tác giả ' + C.AUTHOR, function () { return { t: 'Mở' }; }, function () { goTab('info'); });

    sec('Hạn mức YouTube');
    est = el('div', 'setinfo', '');
    wrap.appendChild(est);
    function updEst() {
      var e = Settings.estimate();
      est.textContent = 'Ước tính: khoảng ' + e.hour + ' đơn vị mỗi giờ · mở app 8 tiếng/ngày ≈ ' + e.day +
        ' đơn vị (hạn mức 10.000/ngày, làm mới lúc 0 giờ giờ California). Xem phim không tốn hạn mức.';
    }
    updEst();

    var bx = el('div', 'setbtns');
    bx.appendChild(UI.button('Cập nhật ngay', 'gold', function () {
      Store.clearCache();
      UI.toast('Đang lấy phim mới…');
      goTab('home');
      Nav.focus(S.tabEls.home, true);
    }));
    bx.appendChild(UI.button('Hiện lại phim đã bỏ', '', function () {
      var n = Store.blockedCount(); Store.clearBlocked();
      UI.toast(n ? 'Đã hiện lại ' + n + ' phim' : 'Chưa bỏ phim nào');
    }));
    bx.appendChild(UI.button('Khôi phục mặc định', '', function () {
      push(TextEdit('Nhập mã PIN để khôi phục mặc định', '', function (val) {
        if (!Settings.checkPin(val)) { UI.toast('Sai mã PIN, chưa khôi phục'); return; }
        Settings.reset();
        Store.clearCache();
        UI.toast('Đã khôi phục cài đặt mặc định');
        goTab('settings');
      }, { mask: true, hint: 'Nhập mã PIN bằng phím số rồi chọn Lưu. Back để hủy.' }));
    }));
    var bw = el('div', 'rowwrap');
    bw.appendChild(bx);
    wrap.appendChild(bw);
    // quay lại từ trang con (nhập PIN, từ khóa, hồ sơ…): cập nhật giá trị các dòng
    return { name: 'settings', el: v, refresh: function () { painters.forEach(function (f) { try { f(); } catch (e) { /* bỏ qua */ } }); try { reorderHomeRows(); } catch (e) { /* bỏ qua */ } updEst(); } };
  }

  /** Đang nghe nhạc, bấm vào ảnh phim: hỏi có mở phim đó không. Mặc định chọn “Ở lại nghe nhạc”. */
  function AskFilm(item) {
    var v = UI.view();
    v.classList.add('glogin');
    var box = el('div', 'gbox askfilm');
    box.appendChild(el('div', 'gt', 'Xem phim này?'));
    var th = el('div', 'afthumb'); th.style.backgroundImage = 'url("' + String(item.hero || item.thumb || '').replace(/"/g, '%22') + '")'; box.appendChild(th);
    box.appendChild(el('div', 'gsteps', '“' + (item.title || 'Phim') + '”' + (item.ch ? ' · ' + item.ch : '')));
    box.appendChild(el('div', 'gnote', 'Mở phim thì nhạc tạm dừng. “Danh sách” lưu phim để xem sau (tab Lịch sử), nhạc vẫn phát.'));
    var bx = el('div', 'btns center');
    var stay = UI.button('Ở lại nghe nhạc', '', function () { back(); });
    bx.appendChild(stay);
    var fav = UI.button(Store.isFav(item) ? 'Đã lưu' : 'Danh sách', '', function () {
      var on = Store.toggleFav(item);
      UI.toast(on ? 'Đã thêm “' + (item.title || 'phim') + '” vào danh sách của bạn' : 'Đã bỏ khỏi danh sách');
      fav.setLabel(on ? 'Đã lưu' : 'Danh sách'); fav.querySelector('.bico').innerHTML = on ? UI.ICON_CHECK : UI.ICON_PLUS;
    }, Store.isFav(item) ? UI.ICON_CHECK : UI.ICON_PLUS);
    bx.appendChild(fav);
    bx.appendChild(UI.button('Mở phim', 'gold', function () { back(); openItem(item); }, UI.ICON_PLAY));
    box.appendChild(bx);
    v.appendChild(box);
    return { name: 'askfilm', el: v, focus: stay };
  }

  /** Hộp hỏi “Xóa phim này?” (mở khi giữ lâu nút giữa/OK trên phim ở Lịch sử). Mặc định chọn Hủy cho an toàn. */
  function ConfirmDel(listName, title, onYes, noun) {
    var v = UI.view();
    v.classList.add('glogin');
    var box = el('div', 'gbox');
    noun = noun || 'phim';
    box.appendChild(el('div', 'gt', 'Xóa ' + noun + ' này?'));
    box.appendChild(el('div', 'gsteps', noun === 'hồ sơ'
      ? '“' + title + '” cùng lịch sử xem, phim xem dở và danh sách riêng của hồ sơ này sẽ bị xóa.'
      : '“' + (title || noun) + '” sẽ bị xóa khỏi “' + listName + '”.'));
    var bx = el('div', 'btns center');
    bx.appendChild(UI.button('Hủy', '', function () { back(); }));
    bx.appendChild(UI.button('Xóa', 'gold', function () { back(); onYes(); }));
    box.appendChild(bx);
    v.appendChild(box);
    return { name: 'confirm', el: v };
  }

  // Đăng nhập Google trên TV: nhập mã trên điện thoại (google.com/device)
  function GoogleLogin() {
    var v = UI.view();
    v.classList.add('glogin');
    var box = el('div', 'gbox');
    box.appendChild(el('div', 'gt', 'Đăng nhập Google'));
    var step = el('div', 'gsteps', 'Đang lấy mã…');
    box.appendChild(step);
    var code = el('div', 'gcode', '');
    box.appendChild(code);
    var note = el('div', 'gnote', '');
    box.appendChild(note);
    var cancelBtn = UI.button('Hủy', '', function () { back(); });
    var bx = el('div', 'btns center');
    bx.appendChild(cancelBtn);
    box.appendChild(bx);
    v.appendChild(box);
    var flow = null;
    Sync.startDevice().then(function (f) {
      flow = f;
      step.innerHTML = '';
      [['1', 'Trên điện thoại hoặc máy tính, mở trang:'], ['', (f.url || '').replace(/^https?:\/\/(www\.)?/, '')], ['2', 'Đăng nhập Gmail của bạn và nhập mã:']]
        .forEach(function (x, i) {
          var r = el('div', i === 1 ? 'gurl' : 'gline', x[1]);
          if (x[0]) r.insertBefore(el('span', 'gnum', x[0]), r.firstChild);
          step.appendChild(r);
        });
      code.textContent = f.code;
      note.textContent = 'Màn hình này tự chuyển khi bạn đăng nhập xong. Mã dùng được 30 phút.';
      return f.poll();
    }).then(function (acc) {
      UI.toast('Đã đăng nhập ' + (acc.email || 'Google') + '. Đang đồng bộ…');
      back();
      Sync.sync('login').then(function () { UI.toast(Sync.status().error || 'Đã đồng bộ'); if (current().name === 'settings') goTab('settings'); });
    }, function (e) {
      if (e && e.cancelled) return;
      step.textContent = googleWhy(e);
      code.textContent = '';
    });
    var view = { name: 'glogin', el: v };
    view.onLeave = function () { if (flow) flow.cancel(); };
    return view;
  }

  // Bàn phím nhập chữ (API key, địa chỉ web)
  /* ---------- Sao lưu bằng mã ---------- */

  /** Giải thích lỗi đăng nhập Google trên TV bằng tiếng Việt, kèm mã lỗi gốc của Google để dễ tìm nguyên nhân. */
  function googleWhy(e) {
    var dt = e && e.data, er = dt && dt.error, ds = dt && dt.error_description;
    var raw = ' [' + (er || (e && e.status ? 'HTTP ' + e.status : (e && e.message) || 'không rõ')) + (ds ? ': ' + ds : '') + ']';
    if (e && e.config) return 'Bản TV chưa có GOOGLE_TV_CLIENT_ID và GOOGLE_TV_CLIENT_SECRET trong js/config.js. Bản web dùng Client ID khác, nên phải tạo thêm một Client ID loại “TVs and Limited Input devices” (xem Hướng dẫn).';
    if (e && e.expired) return 'Mã đã hết hạn. Bấm Hủy rồi thử lại.';
    if (er === 'access_denied') return 'Google từ chối: bạn bấm Hủy, hoặc Gmail này chưa được thêm vào “Test users” (hay chưa Publish app) trong Google Cloud.' + raw;
    if (er === 'invalid_client') return 'Client ID hoặc Client secret sai, hoặc Client ID không phải loại “TVs and Limited Input devices” (Client ID loại Web không dùng được trên TV).' + raw;
    if (er === 'unauthorized_client') return 'Client ID này không được phép đăng nhập bằng mã. Hãy tạo Client ID loại “TVs and Limited Input devices”.' + raw;
    if (er === 'invalid_scope') return 'Google không cho phép quyền xin ở bản TV.' + raw;
    if (e && e.net) return 'Không kết nối được Google. Kiểm tra mạng của TV.';
    return 'Không đăng nhập được.' + raw;
  }

  /** Mở camera, quét mã QR chứa mã sao lưu (cần trình duyệt có BarcodeDetector, ví dụ Chrome trên Android). */
  function scanQr(onText) {
    var ov = el('div', 'bkscan');
    var vid = d.createElement('video');
    vid.setAttribute('playsinline', ''); vid.muted = true;
    ov.appendChild(vid);
    ov.appendChild(el('div', 'bkscan-t', 'Đưa mã QR vào khung hình'));
    var stop = el('div', 'btn f bkscan-x', 'Đóng');
    ov.appendChild(stop);
    d.body.appendChild(ov);
    var stream = null, alive = true, det = null;
    function close() {
      alive = false;
      try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* bỏ qua */ }
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    stop.onclick = close;
    try { det = new w.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { close(); UI.toast('Trình duyệt này chưa hỗ trợ quét QR'); return; }
    w.navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
      if (!alive) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s; vid.srcObject = s; vid.play();
      (function loop() {
        if (!alive) return;
        det.detect(vid).then(function (codes) {
          for (var i = 0; i < codes.length; i++) {
            var v = codes[i].rawValue || '';
            if (v.indexOf('TTQR1:') === 0 || v.indexOf('TTBK1:') === 0) { close(); onText(v); return; }
          }
          setTimeout(loop, 250);
        }, function () { setTimeout(loop, 400); });
      })();
    }, function () { close(); UI.toast('Không mở được camera. Hãy cho phép dùng camera cho trang này'); });
  }

  function Backup(kind) {
    var v = UI.view();
    v.classList.add('scroller');
    var out = kind === 'out';
    v.appendChild(el('div', 'pagehead', out ? 'Xuất mã sao lưu' : 'Nhập mã sao lưu'));
    var box = el('div', 'bkwrap');
    box.appendChild(el('div', 'bkhint', out
      ? 'Đây là toàn bộ lịch sử xem, tiến độ, danh sách và cài đặt của bạn, gói thành một đoạn mã. Bấm “Sao chép mã”, rồi sang máy khác vào Cài đặt → “Nhập mã sao lưu” và dán vào. Mã không chứa API key. Ai có mã sẽ xem được lịch sử của bạn, nên đừng đăng công khai.'
      : 'Dán mã sao lưu đã xuất từ máy khác vào ô bên dưới rồi bấm “Nhập mã”. Dữ liệu được gộp với máy này, không mất gì. Trên TV khó gõ mã dài, nên nhập trên máy tính hoặc điện thoại.'));
    if (out) {
      try {
        var lite = Sync.exportLite(1500);
        var qsvg = w.QR ? w.QR.svg(lite.code, 480, 0) : null;
        if (qsvg) {
          var qrow = el('div', 'bkqr');
          var qimg = el('div', 'bkqr-img'); qimg.innerHTML = qsvg;
          qrow.appendChild(qimg);
          var qtx = el('div', 'bkqr-tx');
          qtx.appendChild(el('div', 'bkqr-h', 'Quét bằng camera điện thoại'));
          qtx.appendChild(el('div', 'bkqr-p', 'Mã QR bản gọn: ' + lite.favs + ' phim trong danh sách và ' + lite.recent + ' phim xem gần nhất, kèm tiến độ. ' + 'Quét xong, điện thoại hiện một đoạn mã: chép nó, mở app → Cài đặt → “Nhập mã sao lưu” và dán vào.  Máy nhận cần có API key YouTube để tải lại tên và ảnh phim. Muốn chép đủ mọi thứ (kể cả cài đặt) thì dùng mã dài bên dưới.'));
          qrow.appendChild(qtx);
          box.appendChild(qrow);
        }
      } catch (e) { /* QR không bắt buộc */ }
    }
    var ta = d.createElement('textarea');
    ta.className = 'bkbox';
    ta.spellcheck = false;
    ta.setAttribute('autocapitalize', 'off');
    ta.setAttribute('autocorrect', 'off');
    if (out) {
      ta.readOnly = true;
      try { ta.value = Sync.exportCode(); } catch (e) { ta.value = 'Không tạo được mã.'; }
    } else ta.placeholder = 'Dán mã bắt đầu bằng TTBK1: hoặc TTQR1: vào đây';
    box.appendChild(ta);
    var info = el('div', 'bkinfo', out ? 'Độ dài mã: ' + ta.value.length + ' ký tự' : '');
    box.appendChild(info);
    var btns = el('div', 'btns');
    function btn(label, cls, fn) { var b = el('div', 'btn f ' + cls, label); b._ok = fn; btns.appendChild(b); return b; }
    if (out) {
      btn('Sao chép mã', 'gold', function () {
        ta.focus(); ta.select();
        var done = function () { UI.toast('Đã sao chép. Hãy dán vào máy khác'); };
        try {
          if (w.navigator.clipboard && w.navigator.clipboard.writeText) { w.navigator.clipboard.writeText(ta.value).then(done, function () { d.execCommand('copy'); done(); }); return; }
          d.execCommand('copy'); done();
        } catch (e) { UI.toast('Hãy chọn hết ô mã rồi sao chép thủ công'); }
      });
      if (/^https?:/.test(w.location.protocol) && !w.AndroidApp && !w.tizen) {
        btn('Lưu thành file', '', function () {
          try {
            var a = d.createElement('a');
            a.href = w.URL.createObjectURL(new w.Blob([ta.value], { type: 'text/plain' }));
            a.download = 'tong-tai-tv-sao-luu.txt';
            d.body.appendChild(a); a.click(); d.body.removeChild(a);
            UI.toast('Đã lưu file sao lưu');
          } catch (e) { UI.toast('Không lưu được file'); }
        });
      }
    } else {
      function doImport() {
        info.classList.remove('ok'); info.textContent = 'Đang nhập…';
        Sync.importAny(ta.value).then(function (r) {
          UI.toast('Đã nhập: ' + r.films + ' phim có tiến độ, ' + r.favs + ' phim trong danh sách');
          info.textContent = 'Nhập thành công'; info.classList.add('ok');
        }, function (e) {
          info.textContent = '';
          if (e && e.nokey) UI.toast('Cần nhập API key YouTube trong Cài đặt trước, rồi nhập lại mã này');
          else if (e && e.bad) UI.toast('Mã không đúng. Hãy chép đủ cả đoạn, bắt đầu bằng TTBK1: hoặc TTQR1:');
          else UI.toast('Không nhập được: ' + ((e && e.message) || 'lỗi mạng'));
        });
      }
      btn('Nhập mã', 'gold', doImport);
      if (w.BarcodeDetector && w.navigator.mediaDevices && w.navigator.mediaDevices.getUserMedia) {
        btn('Quét mã QR', '', function () {
          scanQr(function (txt) { ta.value = txt; doImport(); });
        });
      }
      if (w.navigator.clipboard && w.navigator.clipboard.readText) {
        btn('Dán từ bộ nhớ tạm', '', function () {
          w.navigator.clipboard.readText().then(function (t) { ta.value = t; UI.toast('Đã dán. Bấm “Nhập mã”'); },
            function () { UI.toast('Trình duyệt chặn dán tự động. Hãy bấm vào ô rồi nhấn Ctrl+V'); });
        });
      }
    }
    btn('Quay lại', '', function () { back(); });
    box.appendChild(btns);
    v.appendChild(box);
    return { name: 'backup', el: v };
  }


  /* ---------- Hồ sơ người xem: “Ai đang xem?” ---------- */

  var AV = ['#E8B04B', '#4FAE8A', '#2F7FB8', '#C2456B', '#7A6AD8', '#E0653D'];
  function avatar(p, cls) {
    if (p.av != null && w.Avatars) {   // hình thú kawaii
      var pic = el('div', 'wav pic ' + (cls || ''));
      pic.innerHTML = w.Avatars.svg(p.av);   // SVG tĩnh của app
      return pic;
    }
    var a = el('div', 'wav ' + (cls || ''), String(p.name || '?').trim().charAt(0).toUpperCase());
    a.style.background = p.id === 'guest' ? '#5A6072' : AV[(p.c || 0) % AV.length];
    return a;
  }
  function paintWho() {
    var b = d.getElementById('whobtn');
    if (!b) return;
    var me = Store.profiles().filter(function (x) { return x.id === Store.profile(); })[0] || { id: 'guest', name: 'Guest' };
    b.innerHTML = '';
    var tg = Store.together();
    if (tg.length) {
      var names = [];
      b.classList.add('tog');
      tg.forEach(function (id, i) { var p = profileOf(id) || { id: id, name: 'Guest' }; names.push(p.name); var a2 = avatar(p, 'sm'); if (i) a2.classList.add('stk'); b.appendChild(a2); });
      b.appendChild(el('span', 'whonames', names.join(' + ')));
      b.title = 'Đang xem chung: ' + names.join(' + ') + ' (bấm để đổi)';
      return;
    }
    b.classList.remove('tog');
    b.appendChild(avatar(me, 'sm'));
    b.title = 'Đang xem: ' + me.name + ' (bấm để đổi)';
  }
  // Hồ sơ có mã PIN riêng: phải nhập đúng (hoặc mã PIN người lớn) mới vào được
  function profileOf(id) { return Store.profiles().filter(function (x) { return x.id === id; })[0]; }
  function unlockProfile(p, what, fn) {
    if (!p || !p.pinH) { fn(); return; }
    push(TextEdit('Mã PIN của ' + p.name, '', function (val) {
      if (Settings.hashPin(val) !== p.pinH && !Settings.checkPin(val)) { UI.toast('Sai mã PIN của ' + p.name); if (w.Log) w.Log.warn('Nhập sai PIN hồ sơ ' + p.name + ' khi ' + what); return; }
      fn();
    }, { mask: true, hint: 'Nhập mã PIN của hồ sơ này rồi chọn Lưu. Quên mã: dùng mã PIN người lớn. Back để hủy.' }));
  }
  function chooseProfile(id, skipPin) {
    if (!skipPin) {
      var pp = profileOf(id);
      if (pp && pp.pinH) { unlockProfile(pp, 'mở hồ sơ', function () { setTimeout(function () { chooseProfile(id, true); }, 30); }); return; }
    }
    Store.setProfile(id);
    Settings.apply();   // cài đặt riêng của hồ sơ (giao diện, chủ đề, đồng hồ…)
    paintWho();
    chainSeen = {};
    UI.toast('Xin chào ' + Store.profileName() + '!');
    goTab('home');
    Nav.focus(d.querySelector('.hero .btn') || S.tabEls.home, true);
    checkBirthday();
  }

  var whoMode = 'one';   // 'one' = một người, 'tog' = xem chung
  function Who(startup) {
    var v = UI.view();
    v.classList.add('who');
    v.appendChild(el('div', 'whot', 'Ai đang xem?'));
    var sub = el('div', 'whos', '');
    v.appendChild(sub);
    var tv = !!(w.tizen || w.AndroidApp);
    var sel = Store.together().slice();
    if (!sel.length && whoMode === 'tog') sel = [];
    // chọn chế độ: Một người / Xem chung
    var seg = el('div', 'whomode');
    var sOne = el('div', 'wmb f', 'Một người'), sTog = el('div', 'wmb f', '👥 Xem chung');
    sOne._ok = function () { if (whoMode !== 'one') { whoMode = 'one'; reWho(); } };
    sTog._ok = function () { if (whoMode !== 'tog') { whoMode = 'tog'; reWho(); } };
    seg.appendChild(sOne); seg.appendChild(sTog);
    v.appendChild(seg);
    var g = el('div', 'whogrid');
    var mine = null;
    var go = el('div', 'btn f gold whogo');
    function paintSel() {
      sOne.classList.toggle('on', whoMode === 'one'); sTog.classList.toggle('on', whoMode === 'tog');
      sub.textContent = whoMode === 'tog' ? 'Chọn những ai cùng ngồi xem. Phim, phim xem dở và thời gian xem ghi cho tất cả; gợi ý theo sở thích chung.' : 'Mỗi người có lịch sử xem, phim xem dở, danh sách và từ khóa tìm kiếm riêng.';
      Array.prototype.forEach.call(g.querySelectorAll('.wtile[data-id]'), function (t) { t.classList.toggle('sel', whoMode === 'tog' && sel.indexOf(t.getAttribute('data-id')) >= 0); });
      var names = sel.map(function (id) { return (profileOf(id) || { name: id === 'guest' ? 'Guest' : '?' }).name; });
      go.style.display = whoMode === 'tog' ? '' : 'none';
      go.innerHTML = '';
      go.appendChild(el('span', 'blabel', sel.length >= 2 ? '▶ Xem chung: ' + names.join(' + ') : 'Chọn ít nhất 2 người'));
      go.classList.toggle('dim', sel.length < 2);
      gov.style.display = whoMode === 'tog' && sel.length >= 2 ? '' : 'none';
    }
    go._ok = function () {
      if (sel.length < 2) { UI.toast('Chọn ít nhất 2 người để xem chung'); return; }
      Store.setTogether(sel);
      Settings.apply();
      paintWho();
      chainSeen = {};
      UI.toast('Xem chung: ' + sel.map(function (id) { return (profileOf(id) || { name: 'Guest' }).name; }).join(' + '));
      goTab('home');
      Nav.focus(d.querySelector('.hero .btn') || S.tabEls.home, true);
    };
    var gov = el('div', 'btn f whogo whovote', '🗳 Cả nhà bình chọn phim');   // xem chung: bình chọn phim tối nay
    gov._ok = function () {
      if (sel.length < 2) { UI.toast('Chọn ít nhất 2 người để xem chung'); return; }
      Store.setTogether(sel); Settings.apply(); paintWho(); chainSeen = {};
      goTab('home'); setTimeout(function () { push(VoteTV()); }, 60);
    };
    Store.profiles().forEach(function (p) {
      var t = el('div', 'wtile f');
      t.setAttribute('data-id', p.id);
      t.appendChild(avatar(p));
      t.appendChild(el('div', 'wname', (p.pinH ? '🔒 ' : '') + p.name));
      t.appendChild(el('div', 'wchk', '✓'));
      if (p.id === Store.profile() && whoMode === 'one') { t.classList.add('cur'); t.appendChild(el('div', 'wcur', Store.together().length ? 'Đang xem chung' : 'Đang xem')); mine = t; }
      t._ok = function () {
        if (whoMode !== 'tog') { chooseProfile(p.id); return; }
        var i = sel.indexOf(p.id);
        if (i >= 0) { sel.splice(i, 1); paintSel(); return; }
        if (sel.length >= 4) { UI.toast('Xem chung tối đa 4 người'); return; }
        unlockProfile(p, 'xem chung', function () { setTimeout(function () { sel.push(p.id); paintSel(); }, 30); });
      };
      t._hold = function () { push(ProfileMenu(p)); };   // giữ lâu: đặt mã PIN, đổi hình, xóa
      g.appendChild(t);
    });
    var add = el('div', 'wtile add f');
    add.appendChild(el('div', 'wav plus', '+'));
    add.appendChild(el('div', 'wname', 'Thêm'));
    add._ok = function () {
      if (Store.profiles().length >= 8) { UI.toast('Tối đa 8 hồ sơ. Xóa bớt hồ sơ cũ trước nhé'); return; }
      push(TextEdit('Tên hồ sơ mới', '', function (val) {
        var name = String(val || '').trim();
        if (!name) { UI.toast('Chưa nhập tên hồ sơ'); return; }
        if (Store.profiles().some(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })) { UI.toast('Đã có hồ sơ tên này'); return; }
        // bước 2: chọn hình con thú
        setTimeout(function () {
          push(AvatarPick(name, freeAvatar(), function (av) {
            var r = Store.addProfile(name, av);
            if (!r || r === 'exists') { UI.toast('Chưa tạo được hồ sơ'); return; }
            chooseProfile(r);
          }));
        }, 30);
      }, { space: true, hint: 'Gõ tên (ví dụ: bo, me, be na) rồi chọn Lưu. Bước sau chọn hình con thú. Back để hủy.' }));
    };
    if (whoMode === 'tog') add.style.display = 'none';
    g.appendChild(add);
    v.appendChild(g);
    var gw = el('div', 'whogos'); gw.appendChild(go); gw.appendChild(gov); v.appendChild(gw);
    if (!startup) {   // mở từ nút hồ sơ: có nút quay lại ngay trong khung
      var bx = el('div', 'btns center');
      bx.appendChild(UI.button('‹ Quay lại', 'small', function () { back(); }));
      v.appendChild(bx);
    }
    var syncCard = whoSync(tv);
    if (syncCard) v.appendChild(syncCard);
    // 3 Không + tác giả
    var k3 = el('div', 'who3');
    var stamp = el('div', 'w3stamp'); stamp.appendChild(el('b', '', '3')); stamp.appendChild(el('span', '', 'KHÔNG')); k3.appendChild(stamp);
    ['Không quảng cáo chèn thêm', 'Không giới hạn giờ xem', 'Không thu phí'].forEach(function (t) {
      var c = el('div', 'w3chip'); var x = el('i', 'w3x'); x.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>'; c.appendChild(x); c.appendChild(el('span', '', t)); k3.appendChild(c);
    });
    v.appendChild(k3);
    v.appendChild(el('div', 'whoh', tv ? 'Giữ lâu nút OK trên một hồ sơ để: đặt mã PIN, đổi hình, xóa. Hồ sơ có 🔒 cần mã PIN riêng.' : 'Giữ lâu trên một hồ sơ để: đặt mã PIN, đổi hình, xóa. Hồ sơ có 🔒 cần mã PIN riêng.'));
    var view = { name: 'who', el: v, startup: !!startup };
    paintSel();
    setTimeout(function () { if (current() === view) Nav.focus(mine || (whoMode === 'tog' ? sTog : null) || g.querySelector('.wtile')); }, 0);
    return view;
  }

  /* Menu khi GIỮ LÂU trên một hồ sơ: đặt / đổi / bỏ mã PIN, đổi hình, xóa */
  /* Ô "Đồng bộ với Google" trên màn hình Ai đang xem.
     Chưa đăng nhập: điện thoại/máy tính có nút Đăng nhập Google; TV hiện sẵn mã QR + mã nhập ở google.com/device.
     Đã đăng nhập: email, lần đồng bộ cuối, nút Đồng bộ ngay / Đổi tài khoản. */
  var G_LOGO = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.5z"/></svg>';
  function maskMail(m) { m = String(m || ''); var i = m.indexOf('@'); if (i < 0) return m; var u = m.slice(0, i); return (u.length > 4 ? u.slice(0, 4) + '…' : u) + m.slice(i); }
  function agoText(t) {
    if (!t) return 'chưa đồng bộ lần nào';
    var m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'vừa xong' : m < 60 ? m + ' phút trước' : m < 1440 ? Math.round(m / 60) + ' giờ trước' : Math.round(m / 1440) + ' ngày trước';
  }
  function whoSync(tv) {
    var Sy = w.Sync; if (!Sy) return null;
    var s = Sy.status();
    if (!s.configured || C.WHO_SYNC === false) return null;
    if (!s.google && Store.raw('whoSyncHide', 0) > Date.now()) return null;   // "Để sau": ẩn 30 ngày
    var c = el('div', 'wsync'), flow = null, watch = null;
    function stop() { if (flow) { flow.cancel(); flow = null; } clearInterval(watch); }
    function after(msg) { Sy.sync('login').then(function () { UI.toast(Sy.status().error || msg || 'Đã đồng bộ'); reWho(); }, function () { reWho(); }); }
    function logo() { var g = el('div', 'wsg'); g.innerHTML = G_LOGO; return g; }
    function bt(label, cls, fn, ic) { var b = UI.button(label, cls, fn); if (ic) { var i = el('span', 'wsbi'); i.innerHTML = G_LOGO; b.insertBefore(i, b.firstChild); } return b; }
    function later() { return bt('Để sau', 'wslater', function () { Store.applyRaw('whoSyncHide', Date.now() + 30 * 864e5); stop(); if (c.parentNode) c.parentNode.removeChild(c); UI.toast('Đã ẩn. Đăng nhập Google lúc nào cũng được trong Cài đặt'); }); }
    var tx = el('div', 'wstx'), bx = el('div', 'wsbtns');
    if (s.google && !s.expired) {
      var av = el('div', 'wsav', (s.email || 'G').charAt(0).toUpperCase()); av.appendChild(el('i', '', '✓'));
      c.appendChild(av);
      tx.appendChild(el('div', 'wsh', maskMail(s.email) || 'Đã đăng nhập Google'));
      var st = el('div', 'wsp');
      if (s.error) st.appendChild(el('span', 'wsbad', '● ' + s.error));
      else if (s.needTap) st.appendChild(el('span', 'wsbad', '● Bấm “Đồng bộ ngay” để tiếp tục'));
      else { st.appendChild(el('span', 'wsok', '● Đã đồng bộ')); st.appendChild(d.createTextNode(' · ' + agoText(s.lastSync) + ' · ' + Store.profiles().length + ' hồ sơ')); }
      tx.appendChild(st); c.appendChild(tx);
      bx.appendChild(bt('↻ Đồng bộ ngay', '', function () {
        UI.toast('Đang đồng bộ…');
        var p = s.needTap && s.web ? Sy.webLogin() : Sy.sync('manual');
        p.then(function () { UI.toast(Sy.status().error || 'Đã đồng bộ'); reWho(); }, function () { UI.toast('Chưa đồng bộ được, thử lại sau'); reWho(); });
      }));
      bx.appendChild(bt('Đổi tài khoản', '', function () {
        Sy.logout();
        if (s.web) Sy.webLogin().then(function () { after('Đã đổi tài khoản và đồng bộ'); }, function () { UI.toast('Chưa đăng nhập được Google'); reWho(); });
        else reWho();
      }));
      c.appendChild(bx);
      return c;
    }
    // chưa đăng nhập (hoặc hết hạn)
    tx.appendChild(el('div', 'wsh', s.expired ? 'Đăng nhập Google lại để đồng bộ' : 'Đồng bộ với Google'));
    if (!tv) {
      c.appendChild(logo());
      tx.appendChild(el('div', 'wsp', 'Hồ sơ, lịch sử, phim xem dở và danh sách giống nhau trên TV, điện thoại, máy tính. Đổi máy không mất gì.'));
      c.appendChild(tx);
      bx.appendChild(bt('Đăng nhập Google', 'gold', function () {
        Sy.webLogin().then(function () { after('Đã đăng nhập và đồng bộ'); }, function () { UI.toast('Chưa đăng nhập được Google'); });
      }, true));
      bx.appendChild(later());
      c.appendChild(bx);
      return c;
    }
    // TV: mã QR + mã nhập, tự chuyển khi đăng nhập xong trên điện thoại
    c.classList.add('wstv');
    var qr = el('div', 'wsqr'); c.appendChild(qr);
    var h = tx.firstChild; h.insertBefore(logo(), h.firstChild);
    var how = el('div', 'wsp', 'Đang lấy mã…'), code = el('div', 'wscode', ''), note = el('div', 'wsp sm', '');
    tx.appendChild(how); tx.appendChild(code); tx.appendChild(note);
    bx.appendChild(later()); tx.appendChild(bx);
    c.appendChild(tx);
    setTimeout(function () {
      if (!d.body.contains(c)) return;
      Sy.startDevice().then(function (f) {
        if (!d.body.contains(c)) { f.cancel(); return; }
        flow = f;
        var url = (f.url || 'https://www.google.com/device').replace(/^http:/, 'https:');
        qr.innerHTML = (w.QR && w.QR.svg(url, 300)) || '';
        how.innerHTML = '';
        how.appendChild(d.createTextNode('Quét mã bằng điện thoại, hoặc mở '));
        how.appendChild(el('b', '', url.replace(/^https?:\/\/(www\.)?/, '')));
        how.appendChild(d.createTextNode(', đăng nhập Gmail rồi nhập mã:'));
        code.textContent = f.code;
        var until = Date.now() + 30 * 60000;
        function left() { var m = Math.max(0, Math.round((until - Date.now()) / 60000)); note.textContent = 'Mã dùng được ' + m + ' phút nữa · màn hình tự chuyển khi bạn đăng nhập xong. Hồ sơ, lịch sử, phim xem dở và danh sách sẽ giống nhau trên mọi máy.'; }
        left();
        watch = setInterval(function () { if (!d.body.contains(c)) stop(); else left(); }, 15000);
        return f.poll();
      }).then(function (acc) {
        if (!acc) return;
        clearInterval(watch); flow = null;
        UI.toast('Đã đăng nhập ' + (acc.email || 'Google') + '. Đang đồng bộ…');
        after('Đã đồng bộ');
      }, function (e) {
        clearInterval(watch);
        if (e && e.cancelled) return;
        if (!d.body.contains(c)) return;
        qr.innerHTML = ''; code.textContent = '';
        how.textContent = e && e.expired ? 'Mã đã hết hạn.' : googleWhy(e);
        bx.insertBefore(UI.button('Lấy mã mới', 'gold', function () { reWho(); }), bx.firstChild);
      });
    }, 400);
    return c;
  }
  /* ---------- Lời nhắn gia đình: gửi một phim kèm lời nhắn cho hồ sơ khác (đồng bộ Google để sang máy khác) ---------- */
  function allPeople() { return Store.profiles(); }
  function msgTargets() { var me = Store.profile(); return allPeople().filter(function (p) { return p.id !== me; }); }
  function msgList() { return Store.raw('msgs', []) || []; }
  function msgSave(l) { Store.applyRaw('msgs', l.slice(0, 60)); if (w.Sync && w.Sync.dirty) w.Sync.dirty('msgs'); }
  function slimItem(it) {
    var o = {}; ['id', 'kind', 'title', 'ch', 'chId', 'thumb', 'hero', 'dur', 'eps', 'pub', 'views', 'cat'].forEach(function (k) { if (it[k] != null) o[k] = it[k]; });
    if (it.desc) o.desc = String(it.desc).slice(0, 300);
    return o;
  }
  function sendMsg(to, item, text) {
    var me = Store.profile(), mp = profileOf(me) || { name: 'Guest' };
    var l = msgList();
    l.unshift({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), from: me, fromN: mp.name, to: to.id, ts: Date.now(), text: String(text || '').slice(0, 300), item: slimItem(item), dev: w.tizen ? 'TV Samsung' : w.AndroidApp ? 'Android TV' : /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'điện thoại' : 'máy tính' });
    msgSave(l);
  }
  function markMsg(id, k) { var l = msgList(); l.forEach(function (x) { if (x.id === id) x[k || 'read'] = Date.now(); }); msgSave(l); }
  function pendingMsgs() { var me = Store.profile(); return msgList().filter(function (x) { return x.to === me && !x.read && !x.del && x.item && x.item.id; }).sort(function (a, b) { return a.ts - b.ts; }); }
  function showMsgs() {
    if (C.FAMILY_MSGS === false) return;
    var m = pendingMsgs()[0]; if (!m) return;
    var cur = current(); if (!cur || cur.name === 'msg' || cur.name === 'who' || Player.isOpen()) return;
    push(MsgPopup(m));
  }
  var MSG_PRESETS = ['Phim này hay lắm, xem thử nha!', 'Tối nay xem phim này cùng nhau nhé?', 'Tập cuối cảm động lắm 😢', 'Tổng tài trong phim này ngầu lắm 😄'];
  function MsgTo(item) {
    var v = UI.view(); v.classList.add('glogin');
    var box = el('div', 'gbox msgbox');
    box.appendChild(el('div', 'gt', '✉ Gửi phim cho…'));
    box.appendChild(el('div', 'gnote', '“' + item.title + '” · người nhận mở app sẽ thấy ngay' + (w.Sync && w.Sync.status().google ? ' (cả trên máy khác)' : '. Muốn gửi sang máy khác thì bật Đồng bộ Google')));
    var g = el('div', 'msgwho'), first = null;
    msgTargets().forEach(function (p) {
      var t = el('div', 'wtile f'); t.appendChild(avatar(p)); t.appendChild(el('div', 'wname', p.name));
      t._ok = function () { push(MsgText(item, p)); };
      if (!first) first = t; g.appendChild(t);
    });
    box.appendChild(g);
    var bx = el('div', 'btns center'); bx.appendChild(UI.button('Hủy', '', function () { back(); })); box.appendChild(bx);
    v.appendChild(box);
    return { name: 'msgto', el: v, focus: first };
  }
  function MsgText(item, p) {
    var v = UI.view(); v.classList.add('glogin');
    var box = el('div', 'gbox msgbox');
    box.appendChild(el('div', 'gt', 'Lời nhắn cho ' + p.name));
    box.appendChild(el('div', 'gnote', 'Chọn một câu có sẵn hoặc tự viết'));
    var col = el('div', 'msgopts'), first = null;
    function done(text) {
      sendMsg(p, item, text);
      UI.toast('✉ Đã gửi cho ' + p.name);
      back(); back();
    }
    MSG_PRESETS.forEach(function (t) { var b = UI.button(t, '', function () { done(t); }); if (!first) first = b; col.appendChild(b); });
    col.appendChild(UI.button('✏ Tự viết…', 'gold', function () {
      push(TextEdit('Lời nhắn cho ' + p.name, '', function (val) {
        val = String(val || '').trim(); if (!val) { UI.toast('Chưa có lời nhắn'); return; }
        setTimeout(function () { done(val); }, 30);
      }, { space: true, hint: 'Gõ lời nhắn (không dấu cũng được) rồi chọn Lưu. Back để hủy.' }));
    }));
    box.appendChild(col); v.appendChild(box);
    return { name: 'msgtext', el: v, focus: first };
  }
  function MsgPopup(m) {
    var it = m.item, v = UI.view(); v.classList.add('glogin'); v.classList.add('msgpop');
    var box = el('div', 'gbox msgcard');
    var ph = el('div', 'thumb msgimg'); if (it.hero || it.thumb) ph.style.backgroundImage = 'url("' + String(it.hero || it.thumb).replace(/"/g, '%22') + '")';
    box.appendChild(ph);
    var R2 = el('div', 'msgr');
    var me = Store.profile(), mp = profileOf(me) || { name: 'Guest' };
    var ago = Math.round((Date.now() - m.ts) / 60000);
    R2.appendChild(el('div', 'msgk', '✉ LỜI NHẮN CHO ' + String(mp.name).toUpperCase() + ' · ' + (ago < 1 ? 'VỪA XONG' : ago < 60 ? ago + ' PHÚT TRƯỚC' : ago < 1440 ? Math.round(ago / 60) + ' GIỜ TRƯỚC' : Math.round(ago / 1440) + ' NGÀY TRƯỚC')));
    var fr = el('div', 'msgfrom'), fp = profileOf(m.from) || { id: m.from, name: m.fromN || '?' };
    fr.appendChild(avatar(fp, 'msgav')); var fn = el('div'); fn.appendChild(el('b', '', m.fromN || fp.name)); fn.appendChild(el('div', 'msgdev', 'gửi từ ' + (m.dev || 'máy khác'))); fr.appendChild(fn);
    R2.appendChild(fr);
    if (m.text) R2.appendChild(el('div', 'msgbub', m.text));
    R2.appendChild(el('div', 'msgt', it.title));
    R2.appendChild(el('div', 'msgm', it.kind === 'anime' ? (it.eps || '?') + ' tập' + (it.ch ? ' · ' + it.ch : '') : (it.ch || '') + (it.dur ? ' · ' + Math.round(it.dur / 60) + ' phút' : '')));
    var bx = el('div', 'btns');
    var b1 = UI.button('Xem ngay', 'gold', function () { markMsg(m.id); back(); if (it.kind === 'anime') openItem(it); else playFilm(it); }, UI.ICON_PLAY);
    bx.appendChild(b1);
    if (!Store.isFav(it)) bx.appendChild(UI.button('Danh sách', '', function () { Store.toggleFav(it); markMsg(m.id); UI.toast('Đã thêm vào danh sách'); back(); setTimeout(showMsgs, 400); }, UI.ICON_PLUS));
    bx.appendChild(UI.button('Để sau', '', function () { markMsg(m.id); back(); setTimeout(showMsgs, 400); }));
    R2.appendChild(bx); box.appendChild(R2); v.appendChild(box);
    return { name: 'msg', el: v, focus: b1 };
  }

  /* ---------- Bình chọn phim tối nay (Xem chung) ----------
     TV đưa ra 3 phim hợp với những người đang xem chung. Mỗi người quét mã QR để chọn trên điện thoại
     (cần máy chủ thống kê STATS_URL), hoặc bấm OK trên phim bằng remote. Hết giờ: mở phim nhiều phiếu nhất. */
  function votePick(n) {
    var ids = Store.together().length ? Store.together() : [Store.profile()];
    var pool = (Api.pool() || []).filter(function (f) { return f && f.id && !Settings.hides(f) && (f.hero || f.thumb); });
    var seen = {}; ids.forEach(function (id) { Store.as(id, function () { pool.forEach(function (f) { if (Store.isWatched(f.id)) seen[f.id] = 1; }); }); });
    var cats = {}; profileCats(C.CATEGORIES.filter(function (c) { return c.kind === 'film'; })).forEach(function (c) { cats[c.name] = 1; });
    var sc = pool.filter(function (f) { return !seen[f.id]; }).map(function (f) {
      var s0 = Math.random() * 2 + Math.log(1 + (f.views || 0)) / 6; Api.catsOf(f).forEach(function (c) { if (cats[c]) s0 += 2; }); return { f: f, s: s0 };
    }).sort(function (a, b) { return b.s - a.s; });
    var out = [], ch = {};
    sc.forEach(function (x) { if (out.length < n && !ch[x.f.ch]) { out.push(x.f); ch[x.f.ch] = 1; } });
    sc.forEach(function (x) { if (out.length < n && out.indexOf(x.f) < 0) out.push(x.f); });
    return out;
  }
  function VoteTV() {
    var v = UI.view(); v.classList.add('votev');
    var head = el('div', 'vhead'), ht = el('div', 'vht');
    ht.appendChild(el('div', 'vk', '👥 XEM CHUNG · BÌNH CHỌN PHIM TỐI NAY'));
    ht.appendChild(el('div', 'vh1', 'Cả nhà chọn phim nào?'));
    var stat = el('div', 'vstat', ''); ht.appendChild(stat);
    head.appendChild(ht);
    var qr = el('div', 'vqr hidden'), qrt = el('div', 'vqrt', '');
    head.appendChild(qr); head.appendChild(qrt);
    v.appendChild(head);
    var grid = el('div', 'vgrid'); v.appendChild(grid);
    var bx = el('div', 'btns'); v.appendChild(bx);
    var films = [], votes = [], room = '', ends = 0, tvN = 0, timer = null, done = false, cards = [], base = String(C.STATS_URL || '').replace(/\/+$/, '');
    var people = (Store.together().length ? Store.together() : [Store.profile()]).map(function (id) { var p = profileOf(id) || { id: id, name: id === 'guest' ? 'Guest' : '?' }; return { id: p.id, n: p.name, e: '' }; });
    var SECS = 60;
    function counts() { var c = films.map(function () { return 0; }); votes.forEach(function (x) { if (c[x.pick] != null) c[x.pick]++; }); return c; }
    function paint() {
      var c = counts(), mx = Math.max.apply(null, c.concat([0])), n = votes.length;
      cards.forEach(function (cd, i) {
        cd.querySelector('.vbar i').style.width = (n ? c[i] / n * 100 : 0) + '%';
        var who = votes.filter(function (x) { return x.pick === i; }).map(function (x) { return x.name || 'Remote'; });
        cd.querySelector('.vn').textContent = c[i] ? c[i] + ' phiếu' + (c[i] === mx && mx > 0 ? ' · dẫn đầu' : '') : 'chưa có phiếu';
        cd.querySelector('.vwho').textContent = who.join(', ');
        cd.classList.toggle('win', c[i] === mx && mx > 0);
      });
      var left = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
      stat.textContent = done ? 'Đã chốt phim!' : n + ' / ' + people.length + ' người đã chọn · còn ' + left + ' giây';
    }
    function winner() { var c = counts(), mx = Math.max.apply(null, c); if (mx <= 0) return -1; return c.indexOf(mx); }
    function start() {
      films = votePick(3); votes = []; done = false; tvN = 0; room = '';
      if (films.length < 2) { stat.textContent = 'Chưa đủ phim để chọn, thử lại sau'; return; }
      grid.innerHTML = ''; cards = [];
      films.forEach(function (f, i) {
        var cd = el('div', 'vcard f');
        var th = el('div', 'thumb vimg'); th.style.backgroundImage = 'url("' + String(f.hero || f.thumb).replace(/"/g, '%22') + '")'; cd.appendChild(th);
        var inn = el('div', 'vin'); inn.appendChild(el('div', 'vt', f.title));
        var bar = el('div', 'vbar'); bar.appendChild(el('i')); inn.appendChild(bar);
        var ln = el('div', 'vln'); ln.appendChild(el('span', 'vwho', '')); ln.appendChild(el('span', 'vn', '')); inn.appendChild(ln);
        cd.appendChild(inn);
        cd._ok = function () {   // bấm OK = thêm một phiếu cho người ngồi cạnh (không có điện thoại)
          if (done) { finish(i); return; }
          var vt = { voter: 'tv' + (++tvN), name: 'Remote', pick: i };
          votes.push(vt); paint(); UI.toast('+1 phiếu cho “' + f.title + '”');
          if (room) fetch(base + '/v/' + room, { method: 'POST', body: JSON.stringify(vt) }).catch(function () { /* bỏ qua */ });
        };
        cards.push(cd); grid.appendChild(cd);
      });
      ends = Date.now() + SECS * 1000;
      qr.classList.add('hidden'); qrt.textContent = base ? 'Đang tạo mã…' : 'Bấm OK trên phim để bỏ phiếu (mỗi lần bấm một phiếu).';
      if (base) {
        fetch(base + '/v', { method: 'POST', body: JSON.stringify({ opts: films.map(function (f) { return { t: f.title, img: f.thumb || f.hero }; }), who: people, secs: SECS }) })
          .then(function (r) { return r.json(); }).then(function (j) {
            if (!j.ok) throw j;
            room = j.room; ends = Date.now() + SECS * 1000;
            var url = base + '/vote/' + room;
            qr.innerHTML = (w.QR && w.QR.svg(url, 300)) || ''; qr.classList.remove('hidden');
            qrt.innerHTML = ''; qrt.appendChild(d.createTextNode('Quét bằng điện thoại để chọn.')); qrt.appendChild(el('br')); qrt.appendChild(el('b', '', url.replace(/^https?:\/\//, '')));
          }).catch(function () { qrt.textContent = 'Chưa tạo được mã cho điện thoại. Bấm OK trên phim để bỏ phiếu.'; });
      }
      clearInterval(timer);
      var k = 0;
      timer = setInterval(function () {
        if (!d.body.contains(v)) { clearInterval(timer); return; }
        if (done) return;
        k++;
        if (room && k % 2 === 0) fetch(base + '/v/' + room).then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) { votes = j.votes || []; paint(); } }).catch(function () { /* bỏ qua */ });
        if (Date.now() >= ends || (votes.length >= people.length && people.length >= 2 && votes.some(function (x) { return x.name !== 'Remote'; }))) { lock(); return; }
        paint();
      }, 1000);
      paint();
      bx.innerHTML = '';
      bx.appendChild(UI.button('▶ Xem phim dẫn đầu ngay', 'gold', function () { lock(); var i = winner(); finish(i < 0 ? 0 : i); }));
      bx.appendChild(UI.button('Đổi 3 phim khác', '', function () { start(); }));
      bx.appendChild(UI.button('Thôi', '', function () { back(); }));
      setTimeout(function () { if (current() === view && cards[0]) Nav.focus(cards[0]); }, 50);
    }
    var autoT = null;
    function lock() {
      if (done) return; done = true; clearInterval(timer);
      var i = winner(); paint();
      if (i < 0) { stat.textContent = 'Chưa ai chọn. Bấm OK trên một phim để xem.'; return; }
      var n = 8;
      stat.textContent = 'Phim thắng: “' + films[i].title + '” · tự mở sau ' + n + ' giây';
      autoT = setInterval(function () { if (!d.body.contains(v)) { clearInterval(autoT); return; } n--; if (n <= 0) { clearInterval(autoT); finish(i); } else stat.textContent = 'Phim thắng: “' + films[i].title + '” · tự mở sau ' + n + ' giây'; }, 1000);
    }
    function finish(i) {
      clearInterval(autoT); clearInterval(timer);
      var f = films[i]; if (!f) return;
      back();
      if (f.kind === 'anime') openItem(f); else playFilm(f);
    }
    var view = { name: 'vote', el: v };
    view.onLeave = function () { clearInterval(timer); clearInterval(autoT); };
    setTimeout(start, 0);
    return view;
  }

  function reWho() {   // vẽ lại màn hình Ai đang xem (giữ nguyên chế độ lúc mở app)
    var top = current();
    if (top && top.name === 'who') { var st = top.startup; S.stack.pop(); if (top.el.parentNode) top.el.parentNode.removeChild(top.el); push(Who(st)); }
    else if (top && top.refresh) top.refresh();   // ví dụ đang ở Cài đặt: cập nhật dòng Mã PIN
  }
  function setProfilePinFlow(p, done) {
    push(TextEdit('Mã PIN mới cho ' + p.name + ' (4–8 số)', '', function (p1) {
      p1 = String(p1 || '').trim();
      if (!/^\d{4,8}$/.test(p1)) { UI.toast('Mã PIN phải gồm 4 đến 8 chữ số'); return; }
      setTimeout(function () {
        push(TextEdit('Nhập lại mã PIN mới', '', function (p2) {
          if (String(p2 || '').trim() !== p1) { UI.toast('Hai lần nhập không khớp, chưa đặt mã'); return; }
          Store.setProfilePin(p.id, Settings.hashPin(p1));
          UI.toast('Đã đặt mã PIN cho ' + p.name);
          if (done) done();
        }, { mask: true, hint: 'Nhập lại đúng mã vừa chọn rồi chọn Lưu.' }));
      }, 30);
    }, { mask: true, hint: 'Chọn số bằng mũi tên, OK để nhập, rồi chọn Lưu. Back để hủy.' }));
  }
  function ProfileMenu(p, pinOnly) {
    var v = UI.view();
    v.classList.add('glogin');
    var box = el('div', 'gbox pmenu');
    var hd = el('div', 'pmhead');
    hd.appendChild(avatar(p, 'pm'));
    hd.appendChild(el('div', 'gt', (p.pinH ? '🔒 ' : '') + p.name));
    box.appendChild(hd);
    var bx = el('div', 'pmbtns');
    function item(label, cls, fn) { var b = UI.button(label, cls, function () { back(); setTimeout(fn, 30); }); bx.appendChild(b); return b; }
    var first;
    if (!p.pinH) first = item('🔒 Đặt mã PIN', 'gold', function () { setProfilePinFlow(p, function () { setTimeout(reWho, 30); }); });
    else {
      first = item('🔒 Đổi mã PIN', 'gold', function () { unlockProfile(p, 'đổi mã PIN', function () { setTimeout(function () { setProfilePinFlow(p, function () { setTimeout(reWho, 30); }); }, 30); }); });
      item('🔓 Bỏ mã PIN', '', function () { unlockProfile(p, 'bỏ mã PIN', function () { Store.setProfilePin(p.id, null); UI.toast('Đã bỏ mã PIN của ' + p.name); setTimeout(reWho, 30); }); });
    }
    if (!pinOnly) item('🐾 Đổi hình', '', function () {
      push(AvatarPick(p.name, p.av != null ? p.av : freeAvatar(), function (av) { Store.setAvatar(p.id, av); paintWho(); UI.toast('Đã đổi hình cho ' + p.name); setTimeout(reWho, 30); }));
    });
    if (p.id !== 'guest' && !pinOnly) item('🗑 Xóa hồ sơ', 'danger', function () {
      unlockProfile(p, 'xóa hồ sơ', function () {
        setTimeout(function () {
          push(ConfirmDel('Hồ sơ', p.name, function () { Store.removeProfile(p.id); paintWho(); UI.toast('Đã xóa hồ sơ ' + p.name); setTimeout(reWho, 30); }, 'hồ sơ'));
        }, 30);
      });
    });
    var cancel = UI.button('Hủy', '', function () { back(); });
    bx.appendChild(cancel);
    box.appendChild(bx);
    v.appendChild(box);
    var view = { name: 'profmenu', el: v };
    setTimeout(function () { if (current() === view) Nav.focus(first); }, 0);
    return view;
  }

  // Hình con thú chưa ai dùng (để gợi ý sẵn)
  function freeAvatar() {
    var used = {};
    Store.profiles().forEach(function (x) { if (x.av != null) used[x.av] = 1; });
    for (var i = 0; i < (w.Avatars ? w.Avatars.count : 1); i++) if (!used[i]) return i;
    return 0;
  }

  /* Chọn 1 trong 25 hình thú kawaii */
  function AvatarPick(name, cur, onPick) {
    var v = UI.view();
    v.classList.add('who');
    v.classList.add('avpick');
    v.appendChild(el('div', 'whot small', 'Chọn hình cho “' + name + '”'));
    v.appendChild(el('div', 'whos', 'Chọn bằng mũi tên, nhấn OK. Back để quay lại.'));
    var g = el('div', 'avgrid'), mine = null;
    for (var i = 0; i < w.Avatars.count; i++) {
      (function (i) {
        var t = el('div', 'avt f' + (i === cur ? ' cur' : ''));
        var pic = el('div', 'avimg');
        pic.innerHTML = w.Avatars.svg(i);   // SVG tĩnh của app
        t.appendChild(pic);
        t.appendChild(el('div', 'avn', w.Avatars.name(i)));
        t._ok = function () { back(); onPick(i); };
        if (i === cur) mine = t;
        g.appendChild(t);
      })(i);
    }
    v.appendChild(g);
    var view = { name: 'avpick', el: v };
    setTimeout(function () { if (mine && current() === view) Nav.focus(mine); }, 0);
    return view;
  }

  /* ---------- Thống kê xem ---------- */
  function fmtMin(secs) {
    var m = Math.round((secs || 0) / 60);
    if (m < 60) return m + ' phút';
    return Math.floor(m / 60) + ' giờ' + (m % 60 ? ' ' + (m % 60) + ' phút' : '');
  }
  function fmtHM(secs) {   // gọn: 1g 25p / 42p
    var m = Math.round((secs || 0) / 60);
    return m < 60 ? m + 'p' : Math.floor(m / 60) + 'g' + (m % 60 ? ' ' + (m % 60) + 'p' : '');
  }
  var DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], DOWL = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  // n ngày gần nhất (cũ → mới), bắt đầu lùi lại 'skip' ngày
  function daysOf(st, n, skip) {
    var out = [];
    for (var i = n - 1 + (skip || 0); i >= (skip || 0); i--) {
      var t = Date.now() - i * 86400e3, x = new Date(t), k = Store.dayKey(t), day = st[k] || {};
      out.push({ k: k, t: t, dow: x.getDay(), today: i === 0, date: x.getDate() + '/' + (x.getMonth() + 1), s: day.s || 0, ch: day.ch || {}, h: day.h || null });
    }
    return out;
  }
  function weekOf(st) { return daysOf(st, 7, 0); }
  function sumS(l) { var t = 0; l.forEach(function (d) { t += d.s; }); return t; }

  function Stats(period) {
    period = period || 7;
    var v = UI.view();
    v.classList.add('scroller');
    v.classList.add('stats');
    var me = Store.profiles().filter(function (x) { return x.id === Store.profile(); })[0] || { id: 'guest', name: 'Guest' };
    var st = Store.stats(), days = daysOf(st, period), prev = daysOf(st, 7, 7);
    var total = sumS(days), active = days.filter(function (d) { return d.s >= 60; }).length;
    var avg = total / period, maxD = days.reduce(function (m, d) { return d.s > m.s ? d : m; }, days[0]);
    var seen = 0, from = Date.now() - period * 86400e3;
    Store.recent().forEach(function (r) { var p = Store.getProgress(r.vid); if (p && p.t > from && Store.isWatched(r.vid)) seen++; });

    // ----- đầu trang: hình hồ sơ, tên, chọn khoảng thời gian
    var top = el('div', 'sthead');
    top.appendChild(avatar(me, 'stav'));
    var tt = el('div', 'sttitle');
    tt.appendChild(el('div', 'stt1', 'Thống kê xem'));
    tt.appendChild(el('div', 'stt2', me.name + ' · ' + days[0].date + ' – ' + days[days.length - 1].date + ' · chỉ tính lúc phim đang phát'));
    top.appendChild(tt);
    var seg = el('div', 'stseg');
    [7, 30].forEach(function (n) {
      var b = el('div', 'stsegb f' + (n === period ? ' on' : ''), n + ' ngày');
      b._ok = function () { if (n !== period) { back(); push(Stats(n)); } };
      seg.appendChild(b);
    });
    top.appendChild(seg);
    v.appendChild(top);

    var wrap = el('div', 'stwrap');
    v.appendChild(wrap);

    // ----- 4 ô số liệu
    function delta(cur, old) {
      if (period !== 7 || !old) return null;
      var pct = Math.round((cur - old) / old * 100);
      return { up: pct >= 0, t: (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct) + '% so với 7 ngày trước' };
    }
    var prevTotal = sumS(prev);
    var kpis = [
      { k: period === 7 ? 'Tổng 7 ngày' : 'Tổng 30 ngày', v: fmtMin(total), d: delta(total, prevTotal), ic: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
      { k: 'Trung bình mỗi ngày', v: fmtMin(avg), d: delta(avg, prevTotal / 7), ic: '<path d="M4 19h16M7 15l3-4 3 2 4-6"/>' },
      { k: 'Hôm nay', v: fmtMin(days[days.length - 1].s), sub: 'TB ' + fmtMin(avg) + '/ngày', ic: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>' },
      { k: 'Phim xem hết', v: seen + ' phim', sub: active + '/' + period + ' ngày có xem', ic: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' }
    ];
    var kr = el('div', 'stkpis rowwrap');
    kpis.forEach(function (x) {
      var t = el('div', 'stkpi f');
      t._ok = function () {};
      var ic = el('div', 'stkic'); ic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + x.ic + '</svg>';
      t.appendChild(ic);
      t.appendChild(el('div', 'stk', x.k));
      t.appendChild(el('div', 'stv', x.v));
      if (x.d) t.appendChild(el('div', 'stdelta' + (x.d.up ? ' up' : ' down'), x.d.t));
      else t.appendChild(el('div', 'stdelta', x.sub || (period === 7 ? 'Chưa có dữ liệu tuần trước' : '')));
      kr.appendChild(t);
    });
    wrap.appendChild(kr);

    // ----- biểu đồ theo ngày + nhận xét
    var row1 = el('div', 'strow');
    var cp = el('div', 'stcard wide rowwrap');
    var ch = el('div', 'stch-h');
    ch.appendChild(el('div', 'stct', 'Thời gian xem mỗi ngày'));
    ch.appendChild(el('div', 'stcs', 'Chọn từng cột để xem chi tiết'));
    cp.appendChild(ch);
    var maxS = Math.max(60, maxD.s), niceMax = Math.ceil(maxS / 60 / 30) * 30 * 60 || 1800;   // làm tròn lên bội số 30 phút
    var plot = el('div', 'stplot' + (period > 7 ? ' dense' : ''));
    [1, 0.5, 0].forEach(function (f) {
      var gl = el('div', 'stgrid'); gl.style.bottom = (f * 100) + '%';
      gl.appendChild(el('span', 'stgl', fmtHM(niceMax * f)));
      plot.appendChild(gl);
    });
    if (avg > 0) {
      var al = el('div', 'stavg'); al.style.bottom = Math.min(100, avg / niceMax * 100) + '%';
      al.appendChild(el('span', 'stavgl', 'TB ' + fmtHM(avg)));
      plot.appendChild(al);
    }
    var bars = el('div', 'stbars2');
    days.forEach(function (dd) {
      var col = el('div', 'stb f' + (dd.today ? ' today' : '') + (dd === maxD && dd.s > 0 ? ' max' : ''));
      col._ok = function () {};
      var bar = el('div', 'stbfill');
      bar.style.height = (dd.s > 0 ? Math.max(1.5, dd.s / niceMax * 100) : 0) + '%';
      col.appendChild(bar);
      if ((dd === maxD || dd.today) && dd.s >= 60) { var lab = el('div', 'stblab', fmtHM(dd.s)); lab.style.bottom = 'calc(' + Math.min(100, dd.s / niceMax * 100) + '% + 6px)'; col.appendChild(lab); }
      var tip = el('div', 'sttip');
      tip.appendChild(el('b', '', DOWL[dd.dow] + ' ' + dd.date + (dd.today ? ' (hôm nay)' : '')));
      tip.appendChild(el('span', '', dd.s ? fmtMin(dd.s) : 'Không xem'));
      var topc = Object.keys(dd.ch).sort(function (a2, b2) { return dd.ch[b2] - dd.ch[a2]; })[0];
      if (topc) tip.appendChild(el('span', 'm', 'Nhiều nhất: ' + topc));
      col.appendChild(tip);
      bars.appendChild(col);
    });
    plot.appendChild(bars);
    cp.appendChild(plot);
    var axis = el('div', 'staxis' + (period > 7 ? ' dense' : ''));
    days.forEach(function (dd, i) {
      var show = period <= 7 || dd.today || i % 5 === 0;
      var a = el('div', 'stax' + (dd.today ? ' today' : ''));
      if (show) { a.appendChild(el('div', 'stax1', dd.today ? 'Hôm nay' : DOW[dd.dow])); a.appendChild(el('div', 'stax2', dd.date)); }
      axis.appendChild(a);
    });
    cp.appendChild(axis);
    row1.appendChild(cp);

    // nhận xét tự động
    var ins = el('div', 'stcard side rowwrap f');
    ins._ok = function () {};
    ins.appendChild(el('div', 'stct', 'Nhận xét'));
    var hrs = []; for (var hI = 0; hI < 24; hI++) hrs.push(0);
    var hasH = false;
    days.forEach(function (dd) { if (dd.h) { hasH = true; dd.h.forEach(function (x, i) { hrs[i] += x; }); } });
    var peak = -1, pv = 0;
    for (var j = 0; j < 24; j++) { var two = hrs[j] + hrs[(j + 1) % 24]; if (two > pv) { pv = two; peak = j; } }
    var byDow = [0, 0, 0, 0, 0, 0, 0]; days.forEach(function (dd) { byDow[dd.dow] += dd.s; });
    var bestDow = byDow.indexOf(Math.max.apply(null, byDow));
    var streak = 0; for (var q = days.length - 1; q >= 0 && days[q].s >= 60; q--) streak++;
    var notes = [];
    if (!total) notes.push(['Chưa có dữ liệu', 'Xem phim một lúc rồi quay lại đây, thống kê sẽ tự cập nhật.']);
    else {
      notes.push(['Ngày xem nhiều nhất', DOWL[maxD.dow] + ' ' + maxD.date + ' · ' + fmtMin(maxD.s)]);
      if (period > 7) notes.push(['Thứ hay xem nhất', DOWL[bestDow] + ' · trung bình ' + fmtMin(byDow[bestDow] / Math.max(1, Math.round(period / 7)))]);
      if (hasH && pv > 0) notes.push(['Khung giờ cao điểm', UI.hr(peak) + ' – ' + UI.hr(peak + 2)]);
      notes.push(['Chuỗi ngày liên tiếp', streak ? streak + ' ngày có xem phim' : 'Hôm nay chưa xem']);
      var d7 = delta(total, prevTotal);
      if (d7) notes.push(['So với 7 ngày trước', (d7.up ? 'Nhiều hơn ' : 'Ít hơn ') + fmtMin(Math.abs(total - prevTotal))]);
    }
    notes.forEach(function (n) {
      var r = el('div', 'stins');
      r.appendChild(el('div', 'stik', n[0]));
      r.appendChild(el('div', 'stiv', n[1]));
      ins.appendChild(r);
    });
    row1.appendChild(ins);
    wrap.appendChild(row1);

    // ----- khung giờ trong ngày + kênh xem nhiều nhất
    var row2 = el('div', 'strow');
    var hp = el('div', 'stcard half rowwrap f');
    hp._ok = function () {};
    hp.appendChild(el('div', 'stct', 'Khung giờ hay xem'));
    if (!hasH) hp.appendChild(el('div', 'stempty', 'Bắt đầu ghi từ bản 2.15. Xem phim vài lần là có dữ liệu.'));
    else {
      var hmax = Math.max.apply(null, hrs) || 1;
      var hb = el('div', 'sthours');
      hrs.forEach(function (x, i) {
        var c = el('div', 'sthr');
        var f = el('div', 'sthrf'); f.style.height = (x > 0 ? Math.max(4, x / hmax * 100) : 0) + '%';
        f.style.opacity = x > 0 ? (0.35 + 0.65 * x / hmax).toFixed(2) : 0;
        if (x === hmax && x > 0) f.appendChild(el('div', 'sthrl', UI.hr(i)));   // nhãn giờ cao điểm
        c.appendChild(f);
        c.title = UI.hr(i) + ': ' + fmtMin(x);
        hb.appendChild(c);
      });
      hp.appendChild(hb);
      var hx = el('div', 'sthx');
      [0, 6, 12, 18, 23].forEach(function (t) { hx.appendChild(el('span', '', UI.hr(t))); });
      hp.appendChild(hx);
    }
    row2.appendChild(hp);

    var chs = {};
    days.forEach(function (dd) { Object.keys(dd.ch).forEach(function (c) { chs[c] = (chs[c] || 0) + dd.ch[c]; }); });
    var topCh = Object.keys(chs).map(function (c) { return { c: c, s: chs[c] }; }).sort(function (a2, b2) { return b2.s - a2.s; }).slice(0, 5);
    var cc = el('div', 'stcard half rowwrap f');
    cc._ok = function () {};
    cc.appendChild(el('div', 'stct', 'Kênh xem nhiều nhất'));
    if (!topCh.length) cc.appendChild(el('div', 'stempty', 'Chưa có dữ liệu.'));
    topCh.forEach(function (x, i) {
      var r = el('div', 'strank2');
      r.appendChild(el('div', 'strn', String(i + 1)));
      var mid = el('div', 'strmid');
      var ln = el('div', 'strl');
      ln.appendChild(el('span', 'strname', x.c));
      ln.appendChild(el('span', 'strval', fmtHM(x.s) + ' · ' + Math.round(x.s / total * 100) + '%'));
      mid.appendChild(ln);
      var bw = el('div', 'strbar'), bf = el('div', 'strbarf');
      bf.style.width = Math.max(2, x.s / topCh[0].s * 100) + '%';
      bw.appendChild(bf); mid.appendChild(bw);
      r.appendChild(mid);
      cc.appendChild(r);
    });
    row2.appendChild(cc);
    wrap.appendChild(row2);

    // ----- so sánh các hồ sơ
    var all = Store.profiles();
    if (all.length > 1) {
      var pp = el('div', 'stcard rowwrap f');
      pp._ok = function () {};
      var ph = el('div', 'stch-h');
      ph.appendChild(el('div', 'stct', 'Các hồ sơ trên thiết bị này'));
      ph.appendChild(el('div', 'stcs', period + ' ngày gần nhất'));
      pp.appendChild(ph);
      var rows = all.map(function (p) {
        var l = daysOf(Store.stats(p.id), period);
        return { p: p, t: sumS(l), td: l[l.length - 1].s };
      }).sort(function (a2, b2) { return b2.t - a2.t; });
      var mx = Math.max(1, rows[0].t);
      var grid = el('div', 'stprof');
      rows.forEach(function (x) {
        var r = el('div', 'stpr' + (x.p.id === me.id ? ' me' : ''));
        r.appendChild(avatar(x.p, 'xs'));
        var mid = el('div', 'strmid');
        var ln = el('div', 'strl');
        ln.appendChild(el('span', 'strname', x.p.name + (x.p.id === me.id ? ' (đang xem)' : '')));
        ln.appendChild(el('span', 'strval', fmtMin(x.t) + ' · hôm nay ' + fmtHM(x.td)));
        mid.appendChild(ln);
        var bw = el('div', 'strbar'), bf = el('div', 'strbarf');
        bf.style.width = (x.t > 0 ? Math.max(2, x.t / mx * 100) : 0) + '%';
        bw.appendChild(bf); mid.appendChild(bw);
        r.appendChild(mid);
        grid.appendChild(r);
      });
      pp.appendChild(grid);
      wrap.appendChild(pp);
    }

    var foot = el('div', 'stfoot rowwrap');
    foot.appendChild(el('div', 'stnote', 'Thống kê lưu trên thiết bị này (TV và điện thoại tính riêng), giữ 35 ngày.'));
    foot.appendChild(UI.button('Xóa thống kê của ' + me.name, 'small', function () {
      withPin('xóa thống kê', function () { Store.clearStats(); UI.toast('Đã xóa thống kê'); setTimeout(function () { back(); push(Stats(period)); }, 30); });
    }));
    wrap.appendChild(foot);
    var view = { name: 'stats', el: v };
    setTimeout(function () { var on = seg.querySelector('.on'); if (on && current() === view) Nav.focus(on); }, 0);
    return view;
  }

  /* ---------- Chọn bài: danh sách Nhạc của tôi (đang ở màn hình này vẫn phát nhạc để nghe thử) ---------- */
  function fmtDur(s) { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function SongPick() {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Nhạc của tôi');
    var sub = el('span', 'rh', '');
    head.appendChild(sub);
    v.appendChild(head);
    var info = el('div', 'setinfo ordinfo', 'Chọn một bài để nghe ngay. Nhạc chỉ phát ở Trang chủ (và ở đây để nghe thử); hết bài tự sang bài kế.');
    v.appendChild(info);
    var list = el('div', 'ordlist songlist');
    v.appendChild(list);
    var view = { name: 'songs', el: v };
    function render(focusIdx) {
      list.innerHTML = '';
      var songs = w.Music ? w.Music.songs() : [], cur = w.Music ? w.Music.songIndex() : -1, items = [];
      var tot = songs.reduce(function (a, x) { return a + (x.dur || 0); }, 0);
      sub.textContent = songs.length ? songs.length + ' bài · ' + Math.round(tot / 60) + ' phút' : '';
      if (!songs.length) {
        list.appendChild(el('div', 'setinfo', 'Chưa tải được nhạc. Bản web: chép thư mục music/ lên cùng chỗ với app. TV: Cài đặt → Kết nối → Địa chỉ nhạc.'));
        var again = UI.button('Thử lại', 'gold', function () { w.Music.reloadSongs().then(function () { render(0); }); });
        list.appendChild(again); items.push(again);
      }
      songs.forEach(function (x, i) {
        var playingNow = i === cur && (w.Music.playing() === x.title);
        var r = el('div', 'ordrow f' + (playingNow ? ' now' : ''));
        r.appendChild(el('div', 'ordnum', playingNow ? '♪' : String(i + 1)));
        r.appendChild(el('div', 'ordname', x.title));
        r.appendChild(el('div', 'ordstate', fmtDur(x.dur)));
        r._ok = function () {
          var m = Settings.get('MUSIC');
          if (m !== 'songs' && m !== 'songsx') Settings.set('MUSIC', 'songs');
          w.Music.playSong(i);
          setTimeout(function () { render(i); }, 60);
        };
        list.appendChild(r); items.push(r);
      });
      if (focusIdx != null && items[focusIdx]) Nav.focus(items[focusIdx]);
    }
    if (w.Music && !w.Music.songs().length && w.Music.reloadSongs) w.Music.reloadSongs().then(function () { render(0); });
    render(Math.max(0, w.Music ? w.Music.songIndex() : 0));
    var tmr = setInterval(function () { if (!v.parentNode) { clearInterval(tmr); return; } var c = v.querySelector('.ordrow.now .ordname'); if (w.Music && c && c.textContent !== w.Music.playing()) render(w.Music.songIndex()); }, 2000);
    return view;
  }

  /* ---------- Sắp xếp các hàng Trang chủ (riêng từng hồ sơ) ----------
     TV: chọn hàng, OK để nhấc lên, ▲▼ để di chuyển, OK để đặt xuống. Điện thoại / máy tính: bấm ▲ ▼. */
  function RowOrder() {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Sắp xếp các hàng Trang chủ');
    head.appendChild(el('span', 'rh', Store.profileName() + ' · ảnh lớn đầu trang luôn ở trên cùng'));
    v.appendChild(head);
    var tv = !!(w.tizen || w.AndroidApp);
    v.appendChild(el('div', 'setinfo ordinfo', (tv ? 'Chọn một hàng, nhấn OK để nhấc lên, bấm ▲ ▼ để di chuyển, nhấn OK để đặt xuống.' : 'Bấm ▲ ▼ để đưa hàng lên hoặc xuống.') +
      ' Xong bấm “Xem trước” để xem Trang chủ sẽ trông thế nào, rồi “Lưu”. Hàng đang ẩn vẫn giữ chỗ, bật lại trong Cài đặt.'));
    var bar = el('div', 'btns ordbar');
    v.appendChild(bar);
    var status = el('div', 'ordstatus', '');
    v.appendChild(status);
    var list = el('div', 'ordlist');
    v.appendChild(list);
    var saved = homeOrder(), order = saved.slice(), moving = -1, asking = false;
    var view = { name: 'roworder', el: v };
    function dirty() { return order.join() !== saved.join(); }
    function save() {
      Settings.set('HOME_ORDER', order.slice());
      saved = order.slice(); asking = false;
      UI.toast('Đã lưu thứ tự các hàng cho ' + Store.profileName());
      render(null);
    }
    function move(i, dir) {
      var j = i + dir;
      if (j < 0 || j >= order.length) return i;
      var t = order[i]; order[i] = order[j]; order[j] = t;
      asking = false;
      return j;
    }
    var bPrev = UI.button('👁 Xem trước', 'gold', function () { moving = -1; push(HomePreview(order.slice(), function () { order = order.slice(); save(); })); });
    var bSave = UI.button('✓ Lưu', '', function () { if (dirty()) save(); else UI.toast('Thứ tự chưa thay đổi'); });
    var bUndo = UI.button('↺ Bỏ thay đổi', '', function () { order = saved.slice(); moving = -1; asking = false; render(0); UI.toast('Đã trở lại thứ tự đang dùng'); });
    var bDef = UI.button('Mặc định', '', function () { order = ROW_IDS.slice(); moving = -1; asking = false; render(0); UI.toast('Đã đưa về thứ tự mặc định. Bấm Lưu để dùng'); });
    [bPrev, bSave, bUndo, bDef].forEach(function (b) { bar.appendChild(b); });
    function render(focusIdx) {
      var dz = dirty();
      bSave.classList.toggle('gold', dz);
      bUndo.style.display = dz ? '' : 'none';
      status.className = 'ordstatus' + (dz ? ' dirty' : '') + (asking ? ' ask' : '');
      status.textContent = asking ? 'Bạn chưa lưu thứ tự mới. Bấm “Lưu” để giữ, hoặc bấm Quay lại lần nữa để bỏ thay đổi.' :
        dz ? '● Có thay đổi chưa lưu' : '✓ Đang dùng thứ tự này';
      list.innerHTML = '';
      var items = [];
      order.forEach(function (k, i) {
        var changed = saved[i] !== k;
        var r = el('div', 'ordrow f' + (i === moving ? ' moving' : '') + (rowOn(k) ? '' : ' off') + (changed ? ' changed' : ''));
        r.appendChild(el('div', 'ordnum', String(i + 1)));
        r.appendChild(el('div', 'ordname', ROW_NAMES[k]));
        r.appendChild(el('div', 'ordstate', rowOn(k) ? 'Hiện' : 'Ẩn'));
        if (!tv) {
          var up = el('div', 'ordbtn', '▲'), dn = el('div', 'ordbtn', '▼');
          if (i === 0) up.classList.add('dis');
          if (i === order.length - 1) dn.classList.add('dis');
          up.onclick = function (e) { e.stopPropagation(); render(move(i, -1)); };
          dn.onclick = function (e) { e.stopPropagation(); render(move(i, 1)); };
          r.appendChild(up); r.appendChild(dn);
        }
        r._ok = function () {
          if (!tv) return;
          moving = moving === i ? -1 : i;
          if (moving >= 0) UI.toast('Bấm ▲ ▼ để di chuyển “' + ROW_NAMES[k] + '”, OK để đặt xuống');
          render(i);
        };
        list.appendChild(r); items.push(r);
      });
      if (asking) Nav.focus(bSave);
      else if (focusIdx != null && items[focusIdx]) Nav.focus(items[focusIdx]);
    }
    view.onKeyHook = function (k) {
      if (moving < 0) return false;
      if (k === 38 || k === 40) { moving = move(moving, k === 38 ? -1 : 1); render(moving); return true; }
      if (k === 13 || k === 10009 || k === 27 || k === 8) { var i = moving; moving = -1; render(i); return true; }
      return true;
    };
    view.onBeforeBack = function () {
      if (!dirty() || asking) { if (asking) UI.toast('Đã bỏ thay đổi, giữ thứ tự cũ'); return true; }
      asking = true; render(null);
      return false;
    };
    view.refresh = function () { saved = homeOrder(); render(null); };
    render(0);
    return view;
  }

  // Xem trước Trang chủ với thứ tự đang sắp (chưa lưu): ảnh lớn đầu trang rồi từng hàng, mỗi hàng vài ảnh bìa thật
  function HomePreview(order, onSave) {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Xem trước Trang chủ');
    head.appendChild(el('span', 'rh', Store.profileName() + ' · chưa lưu'));
    v.appendChild(head);
    var bar = el('div', 'btns ordbar');
    var bOk = UI.button('✓ Lưu thứ tự này', 'gold', function () { back(); setTimeout(onSave, 30); });
    bar.appendChild(bOk);
    bar.appendChild(UI.button('‹ Sửa tiếp', '', function () { back(); }));
    v.appendChild(bar);
    var pool = [];
    try { pool = (Api.pool() || []).filter(function (it) { return it && (it.thumb || it.hero) && !Settings.hides(it); }); } catch (e) { pool = []; }
    var seed = 0;
    function pick(n) { var o = []; for (var i = 0; i < n; i++) { var it = pool.length ? pool[(seed++ * 7 + i) % pool.length] : null; o.push(it); } return o; }
    var frame = el('div', 'pvframe');
    var hero = el('div', 'pvhero');
    var h0 = pick(1)[0];
    if (h0) hero.style.backgroundImage = 'url("' + (h0.hero || h0.thumb) + '")';
    hero.appendChild(el('div', 'pvherot', h0 ? h0.title : 'Ảnh lớn đầu trang'));
    frame.appendChild(hero);
    var hidden = [], shown = 0;
    order.forEach(function (k) {
      if (!rowOn(k)) { hidden.push(ROW_NAMES[k]); return; }
      var i = shown++;
      var rw = el('div', 'pvrow');
      var t = k === 'rec' ? 'Đề xuất cho ' + Store.profileName() : ROW_NAMES[k];
      var rh = el('div', 'pvrt');
      rh.appendChild(el('span', 'pvn', String(i + 1)));
      rh.appendChild(el('span', '', t));
      rw.appendChild(rh);
      var cards = el('div', 'pvcards' + (k === 'top' ? ' top' : ''));
      pick(6).forEach(function (it, j) {
        var c = el('div', 'pvcard');
        if (it) c.style.backgroundImage = 'url("' + (it.thumb || it.hero) + '")';
        if (k === 'top') c.appendChild(el('div', 'pvrank', String(j + 1)));
        cards.appendChild(c);
      });
      rw.appendChild(cards);
      frame.appendChild(rw);
    });
    v.appendChild(frame);
    if (hidden.length) v.appendChild(el('div', 'setinfo ordinfo', 'Đang ẩn (không hiện ở Trang chủ): ' + hidden.join(', ') + '.'));
    var view = { name: 'homepreview', el: v };
    setTimeout(function () { Nav.focus(bOk); }, 0);
    return view;
  }

  /* ---------- Chọn kênh yêu thích (OK để bật/tắt ★) ---------- */
  function FavChannels() {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Kênh yêu thích');
    head.appendChild(el('span', 'rh', Store.profileName() + ' · chọn kênh rồi nhấn OK để bật/tắt ★'));
    v.appendChild(head);
    var wrap = el('div', 'favwrap');
    wrap.appendChild(el('div', 'rowmsg', 'Đang tải kênh…'));
    v.appendChild(wrap);
    var view = { name: 'favch', el: v };
    Api.channels().then(function (chs) {
      wrap.innerHTML = '';
      if (!chs.length) { wrap.appendChild(el('div', 'rowmsg', 'Chưa tải được danh sách kênh. Kiểm tra API key và mạng.')); return; }
      var TYPE = { drama: 'Phim ngắn', movie: 'Phim lẻ hay', anime: 'Hoạt hình' };
      var g = el('div', 'favgrid');
      chs.forEach(function (c) {
        var r = el('div', 'favrow f');
        var av = el('div', 'chav sm');
        av.style.background = UI.grad(c.id);
        av.appendChild(el('span', 'chini', (c.title || c.name).replace(/[^A-Za-zÀ-ỹ0-9]/g, '').slice(0, 1).toUpperCase()));
        if (c.thumb) { var im = d.createElement('img'); im.onload = function () { im.classList.add('on'); }; im.onerror = function () { im.remove(); }; im.src = c.thumb; av.appendChild(im); }
        r.appendChild(av);
        var tx = el('div', 'favtx');
        tx.appendChild(el('div', 'favname', c.title || c.name));
        tx.appendChild(el('div', 'favtype', TYPE[c.type] || ''));
        r.appendChild(tx);
        var star = el('div', 'favstar');
        function paint() { var on = Store.isFavCh(c.id); star.textContent = on ? '★' : '☆'; r.classList.toggle('on', on); }
        paint();
        r.appendChild(star);
        r._ok = function () { Store.toggleFavCh(c); paint(); };
        g.appendChild(r);
      });
      wrap.appendChild(g);
      if (current() === view) Nav.focus(g.firstChild);
    }).catch(function (e) { wrap.innerHTML = ''; wrap.appendChild(el('div', 'rowmsg', Api.explain(e))); });
    return view;
  }

  /* ---------- Chọn chủ đề theo mùa / ngày lễ ---------- */
  function SeasonPick() {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Chủ đề theo mùa và ngày lễ');
    head.appendChild(el('span', 'rh', 'Chọn rồi nhấn OK, giao diện đổi ngay'));
    v.appendChild(head);
    var g = el('div', 'sngrid'), mine = null, curM = Settings.get('SEASON');
    var auto = w.Season.auto();
    function tile(id, name, sub, icon, accent) {
      var t = el('div', 'sntile f' + (curM === id ? ' cur' : ''));
      var ic = el('div', 'snicon'); ic.innerHTML = icon || '';   // SVG tĩnh của app
      if (accent) { ic.style.borderColor = accent; ic.style.boxShadow = '0 0 18px -4px ' + accent; }
      t.appendChild(ic);
      var tx = el('div', 'sntx');
      tx.appendChild(el('div', 'snname', name));
      tx.appendChild(el('div', 'snsub', sub));
      t.appendChild(tx);
      if (curM === id) { t.appendChild(el('div', 'sncheck', '✓')); mine = t; }
      t._ok = function () {
        Settings.set('SEASON', id);
        var th = w.Season.apply(true);
        UI.toast(id === 'off' ? 'Đã tắt chủ đề' : id === 'auto' ? 'Tự động: ' + (th ? th.name : 'hôm nay không có dịp nào') : 'Đang dùng chủ đề ' + name);
        back();
      };
      g.appendChild(t);
    }
    tile('auto', 'Tự động', 'Đổi theo ngày. Hôm nay: ' + (auto ? auto.name : 'không có'), w.Season.icon(auto), auto ? auto.accent : '#3A4258');
    tile('off', 'Tắt', 'Giao diện bình thường, không trang trí', '', '#3A4258');
    w.Season.list().forEach(function (th) { tile(th.id, th.name, th.when, w.Season.icon(th), th.accent); });
    v.appendChild(g);
    var view = { name: 'seasonpick', el: v };
    setTimeout(function () { if (mine && current() === view) Nav.focus(mine); }, 0);
    return view;
  }

  /* ---------- Nhập mã PIN (bảo vệ các cài đặt dành cho người lớn) ---------- */
  function withPin(what, fn) {
    push(TextEdit('Nhập mã PIN để ' + what, '', function (val) {
      if (!Settings.checkPin(val)) { UI.toast('Sai mã PIN'); if (w.Log) w.Log.warn('Nhập sai mã PIN khi ' + what); return; }
      fn();
    }, { mask: true, hint: 'Nhập mã PIN rồi chọn Lưu. Back để hủy.' + (Settings.pinIsDefault() ? ' (Mã mặc định: 1234)' : '') }));
  }

  /* Đổi mã PIN: nhập PIN cũ → PIN mới (4–8 số) → nhập lại PIN mới */
  function changePin(done) {
    withPin('đổi mã PIN', function () {
      setTimeout(function () {
        push(TextEdit('Mã PIN mới (4 đến 8 số)', '', function (p1) {
          p1 = String(p1 || '').trim();
          if (!/^\d{4,8}$/.test(p1)) { UI.toast('Mã PIN phải gồm 4 đến 8 chữ số'); return; }
          if (p1 === '1234') { UI.toast('Hãy chọn mã khác 1234 (mã mặc định ai cũng biết)'); return; }
          setTimeout(function () {
            push(TextEdit('Nhập lại mã PIN mới', '', function (p2) {
              if (String(p2 || '').trim() !== p1) { UI.toast('Hai lần nhập không khớp, chưa đổi mã PIN'); return; }
              Settings.setPin(p1);
              if (w.Log) w.Log.info('Đã đổi mã PIN');
              UI.toast('Đã đổi mã PIN. Hãy ghi nhớ mã mới');
              if (done) done();
            }, { mask: true, hint: 'Nhập lại đúng mã PIN mới rồi chọn Lưu.' }));
          }, 30);
        }, { mask: true, hint: 'Chọn số bằng mũi tên, OK để nhập, rồi chọn Lưu. Back để hủy.' }));
      }, 30);
    });
  }

  /* ---------- Lọc theo lứa tuổi: quản lý từ khóa nhạy cảm ---------- */
  function AgeWords() {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Từ khóa nhạy cảm');
    head.appendChild(el('span', 'rh', 'Phim có các từ này trong tên hoặc mô tả sẽ bị ẩn'));
    v.appendChild(head);
    var wrap = el('div', 'setwrap');
    v.appendChild(wrap);
    var view = { name: 'agewords', el: v };
    function render(focusAdd) {
      wrap.innerHTML = '';
      var on = Settings.get('AGE_FILTER') === true;
      wrap.appendChild(el('div', 'setinfo', (on ? 'Lọc đang BẬT. ' : 'Lọc đang TẮT (bật trong Cài đặt → Lọc theo lứa tuổi). ') +
        'So khớp nguyên từ, không phân biệt dấu và chữ hoa: “ma tuy” khớp “Ma Túy”. Chọn một từ rồi OK để xóa.'));
      var box = el('div', 'sugs wwords');
      var addB = el('div', 'sug gold f', '+ Thêm từ khóa');
      addB._ok = function () {
        push(TextEdit('Thêm từ khóa nhạy cảm', '', function (val) {
          var r = Settings.addWord(val);
          if (!r) UI.toast('Chưa nhập từ khóa');
          else if (r === 'exists') UI.toast('Từ khóa này đã có');
          else UI.toast('Đã thêm “' + val.trim() + '”');
          setTimeout(function () { render(true); }, 30);
        }, { space: true, hint: 'Gõ từ khóa, không cần dấu (ví dụ: ma tuy). Chọn Lưu. Back để hủy.' }));
      };
      box.appendChild(addB);
      (Settings.get('AGE_WORDS') || []).forEach(function (wd) {
        var c = el('div', 'sug word f', wd + '  ✕');
        c._ok = function () {
          push(ConfirmDel('Từ khóa nhạy cảm', wd, function () {
            Settings.removeWord(wd); UI.toast('Đã xóa “' + wd + '”'); setTimeout(function () { render(true); }, 30);
          }, 'từ khóa'));
        };
        box.appendChild(c);
      });
      wrap.appendChild(box);
      var bx = el('div', 'setbtns');
      bx.appendChild(UI.button('Dùng danh sách gợi ý', '', function () {
        Settings.set('AGE_WORDS', (C.AGE_WORDS_DEFAULT || Settings.base.AGE_WORDS).slice());
        UI.toast('Đã đặt lại danh sách gợi ý'); render(true);
      }));
      var bw = el('div', 'rowwrap'); bw.appendChild(bx); wrap.appendChild(bw);
      if (focusAdd) Nav.focus(addB);
    }
    render(false);
    view.refresh = function () { /* render lại khi quay về */ };
    return view;
  }

  /* ---------- Nhật ký lỗi: 50 dòng gần nhất ---------- */
  function ErrorLog() {
    var v = UI.view();
    v.classList.add('scroller');
    var head = el('div', 'pagehead', 'Nhật ký lỗi');
    head.appendChild(el('span', 'rh', '50 dòng gần nhất trên thiết bị này · lỗi tô màu đỏ'));
    v.appendChild(head);
    var wrap = el('div', 'logwrap');
    v.appendChild(wrap);
    var tv = !!(w.tizen || w.AndroidApp);
    var qrBox = el('div', 'bkqr hidden');
    function copyText() {
      var txt = w.Log.report();
      var done = function () { UI.toast('Đã sao chép nhật ký. Dán vào Zalo / Messenger / email để gửi'); };
      var fallback = function () {
        var ta = d.createElement('textarea');
        ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
        d.body.appendChild(ta); ta.focus(); ta.select();
        var ok = false;
        try { ok = d.execCommand('copy'); } catch (e) { ok = false; }
        d.body.removeChild(ta);
        if (ok) done(); else showQr();
      };
      try {
        if (w.navigator.clipboard && w.navigator.clipboard.writeText) { w.navigator.clipboard.writeText(txt).then(done, fallback); return; }
      } catch (e) { /* bỏ qua */ }
      fallback();
    }
    // TV không có bộ nhớ tạm: hiện mã QR chứa nhật ký (bản gọn) để quét bằng điện thoại rồi gửi
    function showQr() {
      var svg = null, n = 900;
      while (!svg && n > 150) { svg = w.QR ? w.QR.svg(w.Log.report(n), 480, 0) : null; n -= 150; }
      qrBox.innerHTML = '';
      if (!svg) { UI.toast('Không tạo được mã QR'); return; }
      var im = el('div', 'bkqr-img'); im.innerHTML = svg;
      var tx = el('div', 'bkqr-tx');
      tx.appendChild(el('div', 'bkqr-h', 'Quét bằng camera điện thoại'));
      tx.appendChild(el('div', 'bkqr-p', 'Điện thoại sẽ hiện nội dung nhật ký (các dòng mới nhất). Chép nội dung đó rồi gửi qua Zalo, Messenger hoặc email để được hỗ trợ.'));
      qrBox.appendChild(im); qrBox.appendChild(tx);
      qrBox.classList.remove('hidden');
    }
    function render() {
      wrap.innerHTML = '';
      var bx = el('div', 'btns');
      var cp = UI.button('Sao chép để gửi', 'gold', function () { if (tv) showQr(); else copyText(); });
      bx.appendChild(cp);
      if (!tv && w.navigator.share) {
        bx.appendChild(UI.button('Chia sẻ', '', function () {
          w.navigator.share({ title: 'Nhật ký lỗi Tổng Tài TV', text: w.Log.report() }).catch(function () { /* người dùng hủy */ });
        }));
      }
      bx.appendChild(UI.button('Xóa nhật ký', '', function () { w.Log.clear(); UI.toast('Đã xóa nhật ký'); render(); }));
      var bw = el('div', 'rowwrap'); bw.appendChild(bx);
      wrap.appendChild(bw);
      wrap.appendChild(qrBox);
      var list = w.Log.list().slice().reverse();
      if (!list.length) wrap.appendChild(el('div', 'logl f', 'Chưa có lỗi nào. Mọi thứ đang chạy tốt.'));
      list.forEach(function (x) {
        var r = el('div', 'logl f ' + (x.l === 'err' ? 'err' : x.l === 'warn' ? 'warn' : ''), w.Log.line(x));
        r._ok = function () {};
        wrap.appendChild(r);
      });
    }
    render();
    return { name: 'errlog', el: v };
  }

  function TextEdit(title, value, onSave, opts) {
    opts = opts || {};
    var v = UI.view();
    v.classList.add('search');
    var left = el('div', 'sleft tedit');
    left.appendChild(el('div', 'pagehead small', title));
    var box = el('div', 'sbox mono');
    var txt = el('span', 'sq', '');
    box.appendChild(txt);
    box.appendChild(el('span', 'caret'));
    left.appendChild(box);
    var val = value, upper = false;
    function setV(s) { val = s.slice(0, 120); txt.textContent = opts.mask ? val.replace(/./g, '•') : val; }
    setV(val);
    var kb = el('div', 'kb kb11');
    var letterKeys = [];
    'abcdefghijklmnopqrstuvwxyz0123456789-_.:/?=&@'.split('').forEach(function (ch) {
      var k = el('div', 'key f', ch);
      k._ch = ch;
      k._ok = function () { setV(val + (upper ? k._ch.toUpperCase() : k._ch)); };
      if (/[a-z]/.test(ch)) letterKeys.push(k);
      kb.appendChild(k);
    });
    var sh = el('div', 'key f wide3', 'Chữ HOA');
    sh._ok = function () {
      upper = !upper;
      sh.classList.toggle('gold', upper);
      letterKeys.forEach(function (k) { k.textContent = upper ? k._ch.toUpperCase() : k._ch; });
    };
    var del = el('div', 'key f wide2', 'Xóa');
    del._ok = function () { setV(val.slice(0, -1)); };
    var clr = el('div', 'key f wide3', 'Xóa hết');
    clr._ok = function () { setV(''); };
    var ctrl = [sh, del, clr];
    if (opts.space) {
      var sp = el('div', 'key f wide3', 'Dấu cách');
      sp._ok = function () { if (val && val.slice(-1) !== ' ') setV(val + ' '); };
      ctrl.push(sp);
    }
    var saves = opts.saves || [{ label: 'Lưu', fn: onSave }];
    saves.forEach(function (s) {
      var k = el('div', 'key f gold ' + (saves.length > 1 ? 'wide5' : 'wide3'), s.label);
      k._ok = function () { back(); s.fn(val); };
      ctrl.push(k);
    });
    ctrl.forEach(function (k) { kb.appendChild(k); });
    left.appendChild(kb);
    left.appendChild(el('div', 'shint', opts.hint || 'Chọn ký tự bằng mũi tên, OK để nhập. “Chữ HOA” để đổi chữ thường/hoa. Back để hủy.'));
    v.appendChild(left);
    var mIn = d.createElement('input');
    mIn.className = 'minput';
    mIn.type = opts.mask ? 'password' : 'text';
    mIn.autocapitalize = 'off';
    mIn.setAttribute('autocorrect', 'off');
    mIn.spellcheck = false;
    mIn.value = val;
    mIn.oninput = function () { setV(mIn.value); };
    txt.parentNode.appendChild(mIn);
    var view = { name: 'textedit', el: v };
    // máy tính / điện thoại: gõ hoặc dán (⌘V) trực tiếp
    view.typing = {
      ch: function (c) { setV(val + c); }, back: function () { setV(val.slice(0, -1)); }, enter: null,
      paste: function (t) { setV(/^https?:\/\/$/.test(val) && /^https?:/.test(t) ? t : (val === value && value && value !== 'https://' ? t : val + t)); }
    };
    return view;
  }

  function Info() {
    var v = UI.view();
    v.classList.add('info');
    v.classList.add('scroller');

    // Giới thiệu: phiên bản, tác giả, kiểm tra bản mới, lưu ý bản quyền
    var ab = el('div', 'ipanel wide about rowwrap');
    var abL = el('div', 'abl');
    var logo = d.querySelector('#topbar .brand svg');
    if (logo) { var lg = el('div', 'ablogo'); lg.innerHTML = logo.outerHTML.replace(/id="bg"/, 'id="bga"').replace(/url\(#bg\)/, 'url(#bga)'); abL.appendChild(lg); }
    var abT = el('div', 'abt');
    abT.appendChild(el('div', 'abname', 'Tổng Tài TV'));
    abT.appendChild(el('div', 'abtag', 'Phim ngắn tổng tài · ngọt sủng · báo thù, gom về một nơi, xem trên mọi màn hình.'));
    abT.appendChild(el('div', 'abintro', 'Tổng Tài TV tuyển chọn phim ngắn mới nhất từ các kênh YouTube bạn theo dõi, sắp xếp gọn gàng theo thể loại và phát mượt trên TV Samsung, Android TV, điện thoại và máy tính. Mỗi thành viên trong gia đình có hồ sơ, lịch sử và gợi ý của riêng mình.'));
    abT.appendChild(el('div', 'abver', 'Phiên bản ' + C.VERSION + ' (build ' + C.BUILD + ') · cập nhật ' + C.UPDATED));
    abT.appendChild(el('div', 'abauth', 'Tác giả: ' + C.AUTHOR + (C.CONTACT ? ' · ' + C.CONTACT : '')));
    var upd = el('div', 'abupd', '');
    abT.appendChild(upd);
    var bx = el('div', 'btns');
    var bUp = UI.button('Kiểm tra bản mới', 'gold small', function () {
      upd.className = 'abupd'; upd.textContent = 'Đang kiểm tra…';
      Api.checkUpdate().then(function (r) {
        if (r.newer) {
          upd.className = 'abupd new';
          upd.textContent = 'Có bản mới ' + r.version + (r.updated ? ' (' + r.updated + ')' : '') + '. ' +
            (r.notes ? r.notes + ' ' : '') + (w.tizen || w.AndroidApp ? 'Cài bản mới theo HUONG-DAN-TV.' : 'Tải lại trang (kéo xuống hoặc F5) để dùng bản mới.');
          if (w.Log) w.Log.info('Có bản mới ' + r.version);
        } else {
          upd.className = 'abupd ok';
          upd.textContent = 'Bạn đang dùng bản mới nhất (' + C.VERSION + ').';
        }
      }, function (e) {
        upd.className = 'abupd bad';
        upd.textContent = e && e.nourl ? 'Chưa có địa chỉ kiểm tra bản mới. Điền PLAYER_HOST trong Cài đặt, hoặc UPDATE_URL trong config.js.' :
          e && e.net ? 'Mất mạng, chưa kiểm tra được. Thử lại sau.' : 'Không tìm thấy thông tin phiên bản (version.json) tại ' + (e && e.url || '') + '.';
        if (w.Log) w.Log.warn('Kiểm tra bản mới: ' + upd.textContent);
      });
    });
    bx.appendChild(bUp);
    bx.appendChild(UI.button('Nhật ký lỗi', 'small', function () { push(ErrorLog()); }));
    abT.appendChild(bx);
    abL.appendChild(abT);
    ab.appendChild(abL);
    var cr = el('div', 'abcopy');
    cr.appendChild(el('div', 'ititle', 'Bản quyền và miễn trừ trách nhiệm'));
    ['Tổng Tài TV không lưu trữ, tải xuống hay phân phối lại video. Mọi phim được phát qua trình phát nhúng chính thức của YouTube, chỉ với những video chủ kênh cho phép nhúng.',
      'Quyền sở hữu phim, hình ảnh và âm thanh thuộc về chủ kênh và nhà sản xuất. Yêu cầu gỡ nội dung xin gửi trực tiếp tới chủ kênh trên YouTube.',
      'Nhạc nền Trang chủ: bộ sưu tập bài hát của ' + C.AUTHOR + ' và 5 bản hòa tấu sáng tác riêng cho ứng dụng.',
      'Ứng dụng phục vụ mục đích cá nhân và gia đình, phi thương mại, không liên kết với YouTube hay Google. © 2026 ' + C.AUTHOR + '. Bảo lưu mọi quyền.'].forEach(function (t) {
      var r = el('div', 'iline'); r.appendChild(el('span', 'dot')); r.appendChild(el('span', 'itxt', t)); cr.appendChild(r);
    });
    ab.appendChild(cr);
    v.appendChild(ab);

    // Quản trị: chỉ hiện khi máy này đang đồng bộ bằng email quản trị (ADMIN_HASHES trong config)
    var admEm = w.Tele && w.Tele.adminEmail ? w.Tele.adminEmail() : '';
    if (admEm) {
      var ad = el('div', 'ipanel wide adm rowwrap');
      var adL = el('div', 'adml');
      var adT = el('div', 'ititle', 'Quản trị');
      adT.appendChild(el('span', 'admtag', 'Chỉ bạn thấy mục này'));
      adL.appendChild(adT);
      var page = w.Tele.adminPage(), onTV = !!(w.tizen || w.AndroidApp || !/^https?:/.test(w.location.protocol));
      [ 'Đang đồng bộ bằng ' + admEm + ', là email quản trị.',
        w.Tele.on() ? 'Máy chủ thống kê đang bật: xem thiết bị, IP, vị trí, hồ sơ, thời gian xem và đơn vị YouTube của cả nhà.' : 'Máy chủ thống kê chưa bật. Điền địa chỉ ở Cài đặt → Kết nối → Máy chủ thống kê (cần mã PIN người lớn).',
        'Trang quản trị bắt đăng nhập Google lần nữa; email khác sẽ bị từ chối.',
        onTV ? 'Bấm “Mở trang quản trị” để xem ngay trên TV. Báo cáo PDF và bản đầy đủ: quét mã QR bằng điện thoại.' : 'Báo cáo PDF: mở trang báo cáo, bấm “In / Lưu PDF”.'
      ].forEach(function (t) { var r = el('div', 'iline'); r.appendChild(el('span', 'dot')); r.appendChild(el('span', 'itxt', t)); adL.appendChild(r); });
      if (onTV) {
        var ab3 = el('div', 'btns');
        ab3.appendChild(UI.button('Mở trang quản trị', 'gold small', function () { push(AdminTV()); }));
        adL.appendChild(ab3);
      }
      if (!onTV && page) {
        var ab2 = el('div', 'btns');
        ab2.appendChild(UI.button('Mở trang quản trị', 'gold small', function () { w.open(page, '_blank'); }));
        ab2.appendChild(UI.button('Báo cáo PDF', 'small', function () { w.open(page + '?v=report', '_blank'); }));
        adL.appendChild(ab2);
      }
      ad.appendChild(adL);
      if (onTV && page && w.QR) {
        var qr = el('div', 'admqr');
        qr.innerHTML = w.QR.svg(page, 220) || '';
        qr.appendChild(el('div', 'admurl', page.replace(/^https?:\/\//, '')));
        ad.appendChild(qr);
      }
      v.appendChild(ad);
    }

    // Hạn mức & cập nhật (cập nhật trực tiếp mỗi 15 giây)
    var qp = el('div', 'ipanel wide f rowwrap');
    qp.appendChild(el('div', 'ititle', 'Hạn mức YouTube và cập nhật phim'));
    var qbody = el('div', 'qgrid');
    qp.appendChild(qbody);
    var bar = el('div', 'qbar'), fill = el('div', 'qfill');
    bar.appendChild(fill);
    qp.appendChild(bar);
    var qnote = el('div', 'qnote', '');
    qp.appendChild(qnote);
    v.appendChild(qp);

    function hm(ms) {
      var m = Math.max(0, Math.round(ms / 60000));
      return (m >= 60 ? Math.floor(m / 60) + ' giờ ' : '') + (m % 60) + ' phút';
    }
    function qk(k, val, cls) {
      var r = el('div', 'qkv ' + (cls || ''));
      r.appendChild(el('div', 'k', k));
      r.appendChild(el('div', 'val', val));
      qbody.appendChild(r);
    }
    function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function paintQuota() {
      var q = Api.quotaToday(), e = Settings.estimate(), nr = nextRefresh();
      qbody.innerHTML = '';
      var over = q.errAt && q.errAt > q.resetAt - 86400e3;
      qk('Trạng thái', over ? 'Đã hết hạn mức lúc ' + UI.hhmm(q.errAt) : 'Bình thường', over ? 'bad' : 'good');
      var si = Api.saveInfo();
      qk('Đã dùng hôm nay (TV này)', num(q.units) + ' / 10.000 đơn vị');
      if (si.family) qk('Cả nhà hôm nay (mọi máy)', num(si.family) + ' / 10.000 đơn vị');
      qk('Tiết kiệm tự động', !si.on ? 'Đang tắt (Cài đặt → Tiết kiệm đơn vị)' : si.level === 2 ? 'Mức 2: chỉ hiện phim đã lưu, tạm tắt tìm kiếm đến ' + UI.hhmm(si.resetAt) : si.level === 1 ? 'Mức 1: làm mới phim thưa gấp 3 (đã dùng trên 70%)' : 'Chưa cần (tự bật khi dùng quá 70%)', si.level === 2 ? 'bad' : si.level === 1 ? 'mid' : 'good');
      qk('Tìm kiếm · Đọc kênh/video', q.search + ' lần = ' + num(q.search * 100) + ' · ' + q.other + ' lần = ' + num(q.other));
      qk('Hạn mức làm mới sau', hm(q.resetAt - Date.now()) + ' (lúc ' + UI.hhmm(q.resetAt) + ')');
      qk('Ước tính theo Cài đặt', '~' + e.hour + ' đơn vị/giờ · mở 8 tiếng ≈ ' + num(e.day) + '/ngày');
      qk('Cập nhật phim mới', nr.text);
      var sy = Sync.status();
      qk('Khung hình', (w.UI_fitInfo ? w.UI_fitInfo() : '—') + (w.DEVICE && w.DEVICE.size ? ' · màn ' + w.DEVICE.size : ''), '');
      if (sy.loggedIn) qk('Đồng bộ', ((sy.google ? (sy.email || 'Google') : '') + (sy.google && sy.github ? ' + ' : '') + (sy.github ? 'GitHub' : '')) + ' · ' + (sy.error || 'lần cuối ' + (sy.lastSync ? UI.hhmm(sy.lastSync) : '—')), sy.error ? 'bad' : '');
      var bk = Sync.backupStatus ? Sync.backupStatus() : null;
      if (bk && bk.can) qk('Sao lưu hằng tuần', bk.error ? bk.error : bk.at ? 'Đã sao lưu lúc ' + UI.hhmm(bk.at) + ' ngày ' + new Date(bk.at).toLocaleDateString('vi-VN') + (bk.where ? ' · ' + bk.where : '') : 'Chưa sao lưu', bk.error ? 'bad' : '');
      var pct = Math.min(100, si.units / 100);
      fill.style.width = Math.max(1, pct) + '%';
      fill.className = 'qfill' + (pct > 80 || over ? ' bad' : pct > 50 ? ' mid' : '');
      qnote.textContent = si.family ? 'Thanh màu tính theo số lớn hơn: TV này hoặc cả nhà (máy chủ quản trị báo về mỗi phút). Xem phim không tốn hạn mức.' : 'Chỉ đếm trên TV này. Nếu Samsung và Hisense dùng chung API key thì tổng thật là cộng cả hai. Bật máy chủ quản trị để thấy số của cả nhà. Xem phim không tốn hạn mức.';
    }
    paintQuota();
    var qt = setInterval(function () { if (!d.body.contains(v)) { clearInterval(qt); return; } paintQuota(); }, 15000);

    var grid = el('div', 'igrid');
    function panel(title, cls, lines) {
      var p = el('div', 'ipanel f rowwrap ' + (cls || ''));
      p.appendChild(el('div', 'ititle', title));
      lines.forEach(function (t) {
        var r = el('div', 'iline');
        r.appendChild(el('span', 'dot'));
        r.appendChild(el('span', 'itxt', t));
        p.appendChild(r);
      });
      grid.appendChild(p);
      return p;
    }
    panel('Kho phim', '', [
      'Phim ngắn mới nhất từ ' + (C.CHANNELS || []).length + ' kênh theo dõi, tự cập nhật mỗi ' + C.REFRESH_HOURS + ' giờ.',
      'Phim lẻ hay từ ' + (C.MOVIE_CHANNELS || []).length + ' kênh; hoạt hình từ ' + (C.ANIME_CHANNELS || []).length + ' kênh (2D, 3D, AI).',
      'Phim do AI tạo được gắn nhãn “AI” để bạn dễ nhận biết.',
      'Gợi ý theo thể loại mỗi hồ sơ hay xem, cùng Top 10 phim trong tuần.'
    ]);
    panel('Dành cho cả gia đình', '', [
      'Tối đa 8 hồ sơ, mỗi hồ sơ có lịch sử, danh sách, cài đặt và mã PIN riêng.',
      'Lọc theo lứa tuổi, hẹn giờ tắt và thống kê thời gian xem giúp phụ huynh chủ động.',
      'Đồng bộ giữa các thiết bị và sao lưu hằng tuần qua Google Drive hoặc GitHub.'
    ]);
    var p4 = el('div', 'ipanel f rowwrap');
    p4.appendChild(el('div', 'ititle', 'Thông tin kỹ thuật'));
    function kv(k, val) {
      var r = el('div', 'kv');
      r.appendChild(el('span', 'k', k));
      r.appendChild(el('span', 'val', val));
      p4.appendChild(r);
    }
    kv('Tác giả', C.AUTHOR);
    kv('Phiên bản', C.VERSION + ' (build ' + C.BUILD + ') · ' + C.UPDATED);
    kv('Trình phát', Player.playMode ? Player.playMode() : '');
    kv('Màn hình', w.DEVICE ? w.DEVICE.label + (w.DEVICE.size ? ' · ' + w.DEVICE.size : '') : '');
    kv('Nguồn dữ liệu', Api.hasKey() ? 'YouTube API: đã kết nối' : 'Chế độ demo (chưa có API key)');
    grid.appendChild(p4);
    panel('Quyền riêng tư và an toàn', 'green', [
      'Không cần tài khoản để xem. Ứng dụng không chèn quảng cáo riêng.',
      (w.Tele && w.Tele.on()) ? 'Để phụ huynh quản lý, app gửi về máy chủ riêng của gia đình: loại thiết bị, địa chỉ IP và thành phố (gần đúng), hồ sơ đang dùng, phim đã xem, thời gian xem và đơn vị YouTube. Chỉ người quản trị xem được; dữ liệu tự xóa sau 90 ngày.' : 'Ứng dụng không gửi dữ liệu cá nhân đi đâu.',
      'Lịch sử và cài đặt lưu ngay trên thiết bị; chỉ đồng bộ khi bạn đăng nhập, và chỉ vào chính tài khoản Google hoặc GitHub của bạn.',
      'Chỉ phát video được YouTube cho phép nhúng.',
      'Lọc theo lứa tuổi: ' + (C.AGE_FILTER === true ? 'đang bật, ẩn phim chứa ' + (C.AGE_WORDS || []).length + ' từ khóa nhạy cảm.' : 'đang tắt. Bật trong Cài đặt → Lọc theo lứa tuổi.')
    ]);
    panel('Khuyến cáo nội dung', 'warn', [
      'Một số phim có yếu tố 16+: xung đột gia đình, bạo lực nhẹ, cảnh tình cảm. Phụ huynh nên bật Lọc theo lứa tuổi và đặt mã PIN cho hồ sơ của trẻ.',
      'Nhân vật, hình ảnh và giọng nói trong phim AI không phải người thật. Nội dung phim thể hiện quan điểm của chủ kênh, không phải của Tổng Tài TV.'
    ]);
    v.appendChild(grid);
    return { name: 'info', el: v };
  }

  /* ---------- Giới hạn giờ xem theo hồ sơ (cài trong Cài đặt, cần mã PIN người lớn) ---------- */
  var LIM_DAY = [0, 30, 45, 60, 90, 120, 180];
  var LIM_WIN = ['', '07:00-21:00', '08:00-20:00', '17:00-21:00', '18:00-21:00', '18:00-20:00', '19:00-21:00'];
  var LIM_WARN = [5, 10, 0];
  function limAll() { return Store.pref('limits', {}) || {}; }
  function limOf(id) { var c = limAll()[id]; return c && (c.wd || c.we || c.win) ? c : null; }
  function limSet(id, c) { var a = limAll(); if (c && (c.wd || c.we || c.win)) a[id] = c; else delete a[id]; Store.setPref('limits', a); }
  function limMin(m) { return !m ? 'Không giới hạn' : m < 60 ? m + ' phút' : (m / 60) + ' giờ'; }
  function limWinTxt(wn) { return wn ? wn.replace('-', ' – ') : 'Cả ngày'; }
  function hm2min(t) { var a = String(t).split(':'); return (+a[0]) * 60 + (+a[1] || 0); }
  function limState(id) {
    var c = limOf(id); if (!c) return null;
    var now = new Date(), dk = Store.dayKey(), we = now.getDay() === 0 || now.getDay() === 6;
    var lim = we ? (c.we || 0) : (c.wd || 0);
    var b = (Store.pref('limitBonus', {}) || {})[id]; if (!b || b.day !== dk) b = null;
    var used = ((Store.stats(id)[dk] || {}).s || 0) / 60;
    var left = lim ? lim + (b ? b.min : 0) - used : Infinity;
    var inWin = true, nowM = now.getHours() * 60 + now.getMinutes(), bonusLive = b && Date.now() < b.at + b.min * 60000;
    if (c.win) { var p = c.win.split('-'), f = hm2min(p[0]), t = hm2min(p[1]); inWin = f <= t ? nowM >= f && nowM < t : nowM >= f || nowM < t; }
    if (!inWin && bonusLive) inWin = true;
    var pr = profileOf(id) || { id: id, name: 'Guest' };
    return { id: id, p: pr, lim: lim, used: used, left: left, inWin: inWin, win: c.win, warn: c.warn == null ? 5 : c.warn, blocked: !inWin || left <= 0.05 };
  }
  // trạng thái gộp cho người đang xem (xem chung: người chặt nhất quyết định)
  function limNow() {
    var ids = Store.together().length ? Store.together() : [Store.profile()], out = null;
    ids.forEach(function (id) {
      var s2 = limState(id); if (!s2) return;
      if (!out || (s2.blocked && !out.blocked) || (s2.blocked === out.blocked && s2.left < out.left)) out = s2;
    });
    return out;
  }
  var limWarned = {};
  function limWarnBox(st) {
    var o = d.getElementById('limwarn'); if (o) o.parentNode.removeChild(o);
    o = el('div', 'limwarn'); o.id = 'limwarn';
    o.appendChild(avatar(st.p, 'sm'));
    var t = el('div', 'lwt');
    t.appendChild(el('div', 'lw1', '⏰ ' + st.p.name + ' còn ' + Math.max(1, Math.ceil(st.left)) + ' phút xem hôm nay'));
    t.appendChild(el('div', 'lw2', 'Hết giờ, phim sẽ tạm dừng'));
    o.appendChild(t);
    d.body.appendChild(o);
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 10000);
  }
  function limTick() {
    var st = limNow(); if (!st) return;
    if (!Player.isOpen || !Player.isOpen()) return;
    if (st.blocked) { try { Player.close(); } catch (e) { /* bỏ qua */ } setTimeout(function () { push(LimitLock(st)); }, 300); return; }
    var k = Store.dayKey() + st.id + st.lim + Math.round(st.left > st.warn ? 0 : 1);
    if (st.warn && st.left <= st.warn && !limWarned[k]) { limWarned[k] = 1; limWarnBox(st); }
  }
  function limGrant(st, mins) {
    var b = Store.pref('limitBonus', {}) || {}, dk = Store.dayKey();
    var ids = Store.together().length ? Store.together() : [st.id];
    ids.forEach(function (id) {
      var s2 = limState(id); if (!s2 || !s2.blocked && s2.left > 0 && s2.inWin) return;
      var cur = b[id] && b[id].day === dk ? b[id] : null;
      var add = mins + (s2.lim && s2.left < 0 ? -s2.left : 0);   // bù phần đã lố
      b[id] = { day: dk, min: (cur ? cur.min : 0) + add, at: Date.now() };
    });
    Store.setPref('limitBonus', b);
  }
  function LimitLock(st) {
    var v = UI.view();
    v.classList.add('limlock');
    var avs = el('div', 'llav');
    (Store.together().length ? Store.together() : [st.id]).forEach(function (id) { avs.appendChild(avatar(profileOf(id) || { id: id, name: 'Guest' })); });
    v.appendChild(avs);
    var late = !st.inWin;
    v.appendChild(el('div', 'llt', late ? 'Bây giờ chưa phải giờ xem phim' : 'Hết giờ xem phim hôm nay rồi!'));
    var from = st.win ? st.win.split('-')[0] : '';
    v.appendChild(el('div', 'lls', late ? st.p.name + ' được xem phim từ ' + limWinTxt(st.win) + '. Trong lúc chờ, vẫn nghe nhạc được.'
      : st.p.name + ' đã xem đủ ' + limMin(st.lim) + '. ' + (from ? 'Mai mở lại lúc ' + from + ' nhé.' : 'Mai xem tiếp nhé.') + ' Trong lúc chờ, vẫn nghe nhạc được.'));
    var bx = el('div', 'btns center');
    var b1 = UI.button('🎵 Nghe nhạc', 'gold', function () { back(); goTab('music'); });
    bx.appendChild(b1);
    bx.appendChild(UI.button('Đổi hồ sơ', '', function () { back(); push(Who()); }));
    bx.appendChild(UI.button('🔒 Người lớn: thêm giờ', '', function () {
      withPin('cho thêm giờ xem', function () {
        setTimeout(function () {
          var c = UI.view(); c.classList.add('limlock');
          c.appendChild(el('div', 'llt', 'Cho thêm bao lâu?'));
          var bb = el('div', 'btns center');
          [15, 30, 60].forEach(function (m, i) {
            bb.appendChild(UI.button('+' + m + ' phút', i === 1 ? 'gold' : '', function () {
              limGrant(st, m); UI.toast('Đã cho thêm ' + m + ' phút'); back(); back();
            }));
          });
          c.appendChild(bb);
          push({ name: 'limadd', el: c });
          setTimeout(function () { Nav.focus(bb.children[1], true); }, 30);
        }, 30);
      });
    }));
    v.appendChild(bx);
    var view = { name: 'limlock', el: v };
    setTimeout(function () { if (current() === view) Nav.focus(b1, true); }, 30);
    return view;
  }
  function limRowTxt(id) {
    var c = limOf(id); if (!c) return 'Không giới hạn';
    var a = [];
    if (c.wd || c.we) a.push(c.wd === c.we ? limMin(c.wd) + '/ngày' : limMin(c.wd) + ' · cuối tuần ' + limMin(c.we));
    if (c.win) a.push(limWinTxt(c.win));
    return a.join(' · ');
  }
  function LimitList() {
    var v = UI.view(); v.classList.add('scroller');
    var h = el('div', 'pagehead', 'Giới hạn giờ xem');
    h.appendChild(el('span', 'rh', 'Chọn hồ sơ để đặt giờ xem mỗi ngày và khung giờ được xem'));
    v.appendChild(h);
    var wrap = el('div', 'limwrap');
    var first = null;
    [{ id: 'guest', name: 'Guest' }].concat(Store.profiles().filter(function (p) { return p.id !== 'guest'; })).forEach(function (p) {
      var pr = profileOf(p.id) || p;
      var r = el('div', 'setrow f rowwrap ppr');
      var l = el('div', 'sleft2'), sl = el('div', 'sl');
      sl.appendChild(avatar(pr, 'pp')); sl.appendChild(d.createTextNode(pr.name));
      l.appendChild(sl);
      var st = limState(p.id);
      l.appendChild(el('div', 'sd', st ? 'Hôm nay đã xem ' + Math.round(st.used) + ' phút' + (st.lim ? ' · còn ' + Math.max(0, Math.round(st.left)) + ' phút' : '') : 'Xem thoải mái'));
      r.appendChild(l);
      r.appendChild(el('div', 'sv' + (limOf(p.id) ? ' on' : ''), limRowTxt(p.id)));
      r._ok = function () { push(LimitEdit(pr)); };
      wrap.appendChild(r);
      if (!first) first = r;
    });
    v.appendChild(wrap);
    var view = { name: 'limlist', el: v, refresh: function () { back(); push(LimitList()); } };
    setTimeout(function () { if (current() === view) Nav.focus(first, true); }, 30);
    return view;
  }
  function LimitEdit(p) {
    var v = UI.view(); v.classList.add('scroller');
    var h = el('div', 'pagehead', 'Giới hạn giờ xem · ' + p.name);
    h.appendChild(el('span', 'rh', 'Bấm OK trên một dòng để đổi · lưu ngay'));
    v.appendChild(h);
    var c = limOf(p.id) || { wd: 0, we: 0, win: '', warn: 5 };
    c = { wd: c.wd || 0, we: c.we || 0, win: c.win || '', warn: c.warn == null ? 5 : c.warn };
    var card = el('div', 'limcard');
    v.appendChild(card);
    function paintCard() {
      card.innerHTML = '';
      var st = limState(p.id);
      card.appendChild(avatar(p));
      var t = el('div', 'lct');
      t.appendChild(el('div', 'lc1', p.name + ' · hôm nay đã xem ' + fmtMin(((Store.stats(p.id)[Store.dayKey()] || {}).s || 0))));
      t.appendChild(el('div', 'lc2', !st ? 'Chưa đặt giới hạn: xem thoải mái' : (st.lim ? 'Còn ' + Math.max(0, Math.round(st.left)) + ' phút trong giới hạn ' + limMin(st.lim) : 'Không giới hạn số giờ') + (st.win ? ' · được xem ' + limWinTxt(st.win) : '')));
      var bar = el('div', 'lcbar'), f = el('i');
      f.style.width = st && st.lim ? Math.min(100, st.used / (st.lim + Math.max(0, st.left - st.lim + st.used)) * 100) + '%' : '0%';
      bar.appendChild(f); t.appendChild(bar);
      card.appendChild(t);
    }
    var wrap = el('div', 'limwrap'), first = null;
    function row(t, desc, list, key, fmt) {
      var r = el('div', 'setrow f rowwrap');
      var l = el('div', 'sleft2'); l.appendChild(el('div', 'sl', t)); l.appendChild(el('div', 'sd', desc)); r.appendChild(l);
      var val = el('div', 'sv'); r.appendChild(val);
      function paint() { val.textContent = fmt(c[key]); val.classList.toggle('on', !!c[key]); }
      r._ok = function () { var i = list.indexOf(c[key]); c[key] = list[(i + 1) % list.length]; limSet(p.id, c); paint(); paintCard(); };
      paint(); wrap.appendChild(r); if (!first) first = r;
    }
    row('Giới hạn mỗi ngày (T2–T6)', 'Tổng thời gian xem phim trong ngày', LIM_DAY, 'wd', limMin);
    row('Cuối tuần (T7, CN)', 'Ngày nghỉ có thể cho xem lâu hơn', LIM_DAY, 'we', limMin);
    row('Khung giờ được xem', 'Ngoài khung giờ này không mở được phim', LIM_WIN, 'win', limWinTxt);
    row('Nhắc trước khi hết giờ', 'Hiện thông báo ở góc màn hình', LIM_WARN, 'warn', function (x) { return x ? x + ' phút' : 'Không nhắc'; });
    var info = el('div', 'setrow rowwrap');
    var il = el('div', 'sleft2'); il.appendChild(el('div', 'sl', 'Khi hết giờ')); il.appendChild(el('div', 'sd', 'Phim dừng; vẫn nghe nhạc được. Người lớn nhập mã PIN để cho thêm 15 / 30 / 60 phút.')); info.appendChild(il);
    wrap.appendChild(info);
    v.appendChild(wrap);
    paintCard();
    var view = { name: 'limedit', el: v };
    setTimeout(function () { if (current() === view) Nav.focus(first, true); }, 30);
    return view;
  }

  /* ---------- Kênh yêu thích: đếm phim mới từ lần xem kênh gần nhất ---------- */
  var lastAll = [];
  function chSeenMap() { var m = Store.pref('chSeen', {}) || {}; return m[Store.profile()] || {}; }
  function chSeenMark(id, at) { var m = Store.pref('chSeen', {}) || {}, me = m[Store.profile()] || {}; me[id] = at || Date.now(); m[Store.profile()] = me; Store.setPref('chSeen', m); }
  function chNewCount(id, films) {
    var seen = chSeenMap()[id];
    if (!seen) { chSeenMark(id); return 0; }
    return (films || []).filter(function (f) { return f.chId === id && new Date(f.pub || 0).getTime() > seen; }).length;
  }
  function paintChBadge(all) {
    if (all) lastAll = all;
    var n = 0;
    Store.favChs().forEach(function (c) { n += chNewCount(c.id, lastAll); });
    var targets = [S.tabEls.chans].concat(Array.prototype.slice.call(d.querySelectorAll('.mq[data-q="chans"]')));
    targets.forEach(function (t) {
      if (!t) return;
      var b = t.querySelector('.tbadge');
      if (!n) { if (b) b.parentNode.removeChild(b); return; }
      if (!b) { b = el('span', 'tbadge'); t.appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n);
    });
  }

  /* ---------- Câu đố tổng tài: điền chữ còn thiếu trong câu thoại ---------- */
  function quizDay() { var q = Store.pref('quizDay', {}) || {}; return q.d === Store.dayKey() ? q : { d: Store.dayKey(), s: {} }; }
  function quizAdd(pid, pts) { var q = quizDay(); q.s[pid] = (q.s[pid] || 0) + pts; Store.setPref('quizDay', q); }
  function quizLeaders() {
    var s = quizDay().s;
    return Object.keys(s).map(function (id) { return { p: profileOf(id) || { id: id, name: 'Guest' }, n: s[id] }; }).filter(function (x) { return x.n > 0; }).sort(function (a, b) { return b.n - a.n; });
  }
  function quizStrip() {
    var wrap = el('div', 'rowwrap quizstrip');
    function paint() {
      wrap.innerHTML = '';
      if (!w.Quotes || !w.Quotes.quiz) return;
      var z = w.Quotes.quiz(Math.floor(Math.random() * w.Quotes.count));
      var ic = el('div', 'qsic', '🎯'); wrap.appendChild(ic);
      var t = el('div', 'qst');
      t.appendChild(el('div', 'qsk', 'CÂU ĐỐ TỔNG TÀI · HÔM NAY'));
      t.appendChild(el('div', 'qsh', 'Điền chữ còn thiếu trong câu thoại · hoặc đoán tên bài hát'));
      var pv = el('div', 'qsq'); pv.appendChild(d.createTextNode('“' + z.before)); pv.appendChild(el('b', '', '___')); pv.appendChild(d.createTextNode(z.after + '”'));
      t.appendChild(pv);
      wrap.appendChild(t);
      var ld = quizLeaders();
      if (ld.length) {
        var lb = el('div', 'qsld'), avs = el('div', 'qsavs');
        ld.slice(0, 3).forEach(function (x) { avs.appendChild(avatar(x.p, 'sm')); });
        lb.appendChild(avs); lb.appendChild(el('div', 'qsl', ld[0].p.name + ' dẫn đầu · ' + ld[0].n + ' điểm'));
        wrap.appendChild(lb);
      }
      wrap.appendChild(UI.button('▶ Chơi ngay', 'gold', function () { push(Quiz()); }));
      if (w.Music && w.Music.S && w.Music.S.all().length >= 4) wrap.appendChild(UI.button('♪ Đoán bài hát', '', function () { push(Quiz('song')); }));
      if (Store.together().length >= 2) wrap.appendChild(UI.button('🗳 Cả nhà chọn phim', '', function () { push(VoteTV()); }));
    }
    paint();
    return { wrap: wrap, hide: function () { wrap.classList.add('hidden'); }, show: function () { wrap.classList.remove('hidden'); }, refresh: paint };
  }
  function Quiz(kind) {
    var SONG = kind === 'song', MS = w.Music && w.Music.S, songUsed = {}, snipT = 0;
    var v = UI.view(); v.classList.add('quizv'); if (SONG) v.classList.add('songquiz');
    var me = profileOf(Store.profile()) || { id: 'guest', name: 'Guest' };
    var ROUNDS = 10, round = 0, score = 0, marks = [], used = {}, tmr = 0, left = 15, z = null, done = false;
    var head = el('div', 'qzhead'), card = el('div', 'qzcard'), grid = el('div', 'qzgrid'), foot = el('div', 'qzfoot');
    v.appendChild(head); v.appendChild(card); v.appendChild(grid); v.appendChild(foot);
    function paintHead() {
      head.innerHTML = '';
      head.appendChild(avatar(me, 'qzav'));
      var t = el('div', 'qzht'); t.appendChild(el('div', 'qzh1', (SONG ? 'Đoán tên bài hát · ' : 'Câu đố tổng tài · ') + me.name)); t.appendChild(el('div', 'qzh2', 'Câu ' + Math.min(round + 1, ROUNDS) + ' / ' + ROUNDS)); head.appendChild(t);
      var mk = el('div', 'qzmarks');
      for (var i = 0; i < ROUNDS; i++) mk.appendChild(el('i', i < marks.length ? (marks[i] ? 'ok' : 'bad') : i === round ? 'now' : ''));
      head.appendChild(mk);
      var sc = el('div', 'qzsc'); sc.appendChild(el('div', 'qzsk', 'Điểm')); sc.appendChild(el('div', 'qzsv', String(score))); head.appendChild(sc);
    }
    function next() {
      clearInterval(tmr);
      if (round >= ROUNDS) { finish(); return; }
      if (SONG) { z = songQ(); left = 20; }
      else { var i; do { i = Math.floor(Math.random() * w.Quotes.count); } while (used[i]); used[i] = 1; z = w.Quotes.quiz(i); left = 15; }
      done = false;
      paintHead();
      card.innerHTML = '';
      var top = el('div', 'qzct');
      if (SONG) { top.appendChild(el('div', 'qzk', 'NGHE ĐOẠN NHẠC · CÂU HÁT NÀY THUỘC BÀI NÀO?')); top.appendChild(el('div', 'qzcat', '♪ ' + z.sec)); }
      else { top.appendChild(el('div', 'qzk', 'ĐIỀN CHỮ CÒN THIẾU')); top.appendChild(el('div', 'qzcat', 'Chủ đề: ' + z.cat + ' · #' + ('00' + z.n).slice(-3))); }
      card.appendChild(top);
      var qt = el('div', 'qzq');
      if (SONG) { qt.appendChild(d.createTextNode('“' + z.line + '”')); var eq = el('div', 'qzeq'); for (var e6 = 0; e6 < 6; e6++) eq.appendChild(el('i')); qt.appendChild(eq); }
      else { qt.appendChild(d.createTextNode('“' + z.before)); var bl = el('span', 'qzblank', '?'); qt.appendChild(bl); qt.appendChild(d.createTextNode(z.after + '”')); }
      card.appendChild(qt);
      if (SONG) { clearTimeout(snipT); MS.playAt(z.idx, z.at); snipT = setTimeout(function () { if (current() === view) MS.stop(); qt.classList.add('qzstop'); }, 10000); }
      var st = el('div', 'qzst', ''); card.appendChild(st);
      grid.innerHTML = ''; foot.innerHTML = '';
      var first = null;
      z.options.forEach(function (o, k) {
        var b = el('div', 'qzopt f');
        b.appendChild(el('div', 'qzl', 'ABCD'.charAt(k))); b.appendChild(el('div', 'qzw', o));
        b._ok = function () { answer(o, b); };
        grid.appendChild(b); if (!first) first = b;
      });
      var ld = quizLeaders();
      foot.appendChild(el('div', 'qzlb', ld.length ? 'Bảng điểm hôm nay: ' + ld.map(function (x) { return x.p.name + ' ' + x.n; }).join(' · ') : 'Mỗi câu đúng +10 điểm · điểm cộng vào bảng điểm hôm nay'));
      function tick() { st.textContent = done ? '' : (SONG ? 'Chọn tên bài rồi bấm OK · còn ' : 'Chọn chữ đúng rồi bấm OK · còn ') + left + ' giây'; }
      tick();
      tmr = setInterval(function () { if (!d.body.contains(v)) { clearInterval(tmr); return; } left--; if (left <= 0) { answer(null, null); return; } tick(); }, 1000);
      setTimeout(function () { if (current() === view) Nav.focus(first, true); }, 30);
    }
    function answer(o, btn) {
      if (done) return; done = true; clearInterval(tmr);
      var ok = o === z.answer;
      marks.push(ok); if (ok) { score += 10; quizAdd(me.id, 10); }
      Array.prototype.forEach.call(grid.children, function (b) {
        var wv = b.querySelector('.qzw').textContent;
        b.classList.add(wv === z.answer ? 'right' : b === btn ? 'wrong' : 'dim');
      });
      var bl = card.querySelector('.qzblank'); if (bl) { bl.textContent = z.answer; bl.classList.add(ok ? 'ok' : 'bad'); }
      card.querySelector('.qzst').textContent = ok ? '✓ Đúng rồi! +10 điểm' : (o ? '✗ Chưa đúng. Đáp án: “' + z.answer + '”' : '⏰ Hết giờ. Đáp án: “' + z.answer + '”');
      card.querySelector('.qzst').className = 'qzst ' + (ok ? 'ok' : 'bad');
      round++; paintHead();
      foot.innerHTML = '';
      var bx = el('div', 'btns center');
      var bn = UI.button(round >= ROUNDS ? 'Xem kết quả ▶' : 'Câu tiếp theo ▶', 'gold', next);
      bx.appendChild(bn); bx.appendChild(UI.button('Dừng chơi', '', function () { back(); }));
      if (SONG) { var zi = z.idx; bx.appendChild(UI.button('♪ Nghe cả bài', '', function () { clearTimeout(snipT); if (w.MusicPage) w.MusicPage.openSong(zi); })); }
      foot.appendChild(bx);
      Nav.focus(bn, true);
    }
    function finish() {
      if (SONG) { clearTimeout(snipT); MS.stop(); }
      paintHead();
      grid.innerHTML = ''; card.innerHTML = '';
      card.appendChild(el('div', 'qzk', 'KẾT QUẢ'));
      card.appendChild(el('div', 'qzq', SONG ? (score >= 80 ? 'Tai nghe tổng tài! ' + score + ' điểm' : score >= 50 ? 'Khá lắm! ' + score + ' điểm' : 'Nghe thêm rồi chơi lại nhé! ' + score + ' điểm') : score >= 80 ? 'Đúng chất tổng tài! ' + score + ' điểm' : score >= 50 ? 'Khá lắm! ' + score + ' điểm' : 'Cố lên lần sau! ' + score + ' điểm'));
      var right = marks.filter(Boolean).length;
      card.appendChild(el('div', 'qzst ok', right + ' / ' + ROUNDS + ' câu đúng · đã cộng vào bảng điểm hôm nay'));
      foot.innerHTML = '';
      var ld = quizLeaders();
      if (ld.length) foot.appendChild(el('div', 'qzlb', 'Bảng điểm hôm nay: ' + ld.map(function (x) { return x.p.name + ' ' + x.n; }).join(' · ')));
      var bx = el('div', 'btns center');
      var b1 = UI.button('Chơi lại', 'gold', function () { round = 0; score = 0; marks = []; next(); });
      bx.appendChild(b1); bx.appendChild(UI.button('Về Trang chủ', '', function () { back(); }));
      foot.appendChild(bx);
      Nav.focus(b1, true);
    }
    // Đoán tên bài hát: chọn bài chưa hỏi, một câu hát không chứa tên bài, 3 tên bài khác làm đáp án sai
    function songQ() {
      var all = MS.all(), ids = all.map(function (_, k) { return k; }).filter(function (k) { return !songUsed[k] && (all[k].lyrics || []).length > 4; });
      if (!ids.length) { songUsed = {}; ids = all.map(function (_, k) { return k; }).filter(function (k) { return (all[k].lyrics || []).length > 4; }); }
      var k = ids[Math.floor(Math.random() * ids.length)], sg = all[k]; songUsed[k] = 1;
      var nk = function (x) { x = String(x || '').toLowerCase(); try { x = x.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* TV cũ */ } return x.replace(/đ/g, 'd').replace(/[^a-z0-9 ]/g, ''); };
      var tn = nk(sg.title), times = w.MusicPage && w.MusicPage.times ? w.MusicPage.times(sg) : [];
      var ls = sg.lyrics.map(function (l, n) { return { t: l.t, at: times[n] != null ? times[n] : l.at || 0, s: l.s }; }).filter(function (l) { return l.at >= 12 && nk(l.t).indexOf(tn) < 0 && l.t.length > 12; });
      if (!ls.length) ls = sg.lyrics.map(function (l, n) { return { t: l.t, at: times[n] || l.at || 0 }; });
      var L = ls[Math.floor(Math.random() * ls.length)];
      var others = all.map(function (x) { return x.title; }).filter(function (t) { return t !== sg.title; });
      for (var q = others.length - 1; q > 0; q--) { var r = Math.floor(Math.random() * (q + 1)), tmp = others[q]; others[q] = others[r]; others[r] = tmp; }
      var opts = others.slice(0, 3).concat([sg.title]);
      for (var q2 = opts.length - 1; q2 > 0; q2--) { var r2 = Math.floor(Math.random() * (q2 + 1)), t2 = opts[q2]; opts[q2] = opts[r2]; opts[r2] = t2; }
      return { idx: k, line: L.t, at: Math.max(0, L.at - 0.6), answer: sg.title, options: opts, sec: 'Câu ' + (round + 1) };
    }
    var view = { name: SONG ? 'songquiz' : 'quiz', el: v };
    setTimeout(next, 0);
    return view;
  }

  /* ---------- Sinh nhật: chúc mừng, pháo bông, nhạc, thêm 30 phút xem phim ---------- */
  function bdayOf(id) { return ((Store.pref('bdays', {}) || {})[id]) || ''; }
  function isBday(id) { var b = bdayOf(id); if (!b) return false; var n = new Date(); return b === ('0' + n.getDate()).slice(-2) + '/' + ('0' + (n.getMonth() + 1)).slice(-2); }
  function checkBirthday() {
    var id = Store.profile(); if (!isBday(id)) return;
    var shown = Store.pref('bdayShown', {}) || {}; if (shown[id] === Store.dayKey()) return;
    shown[id] = Store.dayKey(); Store.setPref('bdayShown', shown);
    var b = Store.pref('limitBonus', {}) || {}, dk = Store.dayKey();
    var gift = !!limOf(id);
    if (gift) { var cur = b[id] && b[id].day === dk ? b[id] : null; b[id] = { day: dk, min: (cur ? cur.min : 0) + 30, at: Date.now() }; Store.setPref('limitBonus', b); }
    setTimeout(function () { push(Birthday(profileOf(id) || { id: id, name: 'Guest' }, gift)); }, 400);
  }
  var bdayTune = null;
  function playBdayTune() {   // "Happy Birthday to You" (bài dân gian, không còn bản quyền), phát bằng Web Audio
    try {
      var AC = w.AudioContext || w.webkitAudioContext; if (!AC) return;
      if (bdayTune) { try { bdayTune.close(); } catch (e) { /* bỏ qua */ } }
      var ac = bdayTune = new AC(), t = ac.currentTime + 0.1;
      var N = { G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784 };
      var song = [['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2], ['G4', .75], ['G4', .25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2], ['G4', .75], ['G4', .25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2], ['F5', .75], ['F5', .25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 2.5]];
      var beat = 0.42;
      song.forEach(function (x) {
        var o = ac.createOscillator(), g = ac.createGain(), o2 = ac.createOscillator(), g2 = ac.createGain();
        o.type = 'triangle'; o.frequency.value = N[x[0]]; o2.type = 'sine'; o2.frequency.value = N[x[0]] * 2;
        var dur = x[1] * beat;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
        g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.05, t + 0.03); g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8);
        o.connect(g); g.connect(ac.destination); o2.connect(g2); g2.connect(ac.destination);
        o.start(t); o.stop(t + dur); o2.start(t); o2.stop(t + dur);
        t += dur;
      });
    } catch (e) { /* bỏ qua */ }
  }
  function Birthday(p, gift) {
    var v = UI.view(); v.classList.add('bdayv');
    var cv = d.createElement('canvas'); cv.className = 'bdcv'; v.appendChild(cv);
    var box = el('div', 'bdbox');
    var av = el('div', 'bdav'); av.appendChild(avatar(p)); av.appendChild(el('div', 'bdpop', '🎉')); box.appendChild(av);
    var n = new Date();
    box.appendChild(el('div', 'bdk', n.getDate() + ' · ' + (n.getMonth() + 1)));
    box.appendChild(el('div', 'bdt', 'Chúc mừng sinh nhật ' + p.name + '!'));
    box.appendChild(el('div', 'bds', '🎂 Hôm nay cả app là của ' + p.name + (gift ? ': nhạc sinh nhật và thêm 30 phút xem phim.' : ': nhạc sinh nhật và pháo bông.')));
    var bx = el('div', 'btns center');
    var b1 = UI.button('Vào xem phim', 'gold', function () { back(); });
    bx.appendChild(b1);
    bx.appendChild(UI.button('🎵 Nghe nhạc sinh nhật', '', function () { playBdayTune(); }));
    box.appendChild(bx);
    v.appendChild(box);
    // pháo bông động trên canvas
    var ctx = cv.getContext && cv.getContext('2d'), parts = [], raf = 0, last = 0, launchT = 0;
    var COLS = ['#FFD166', '#F0648C', '#5B9BFF', '#4CC27A', '#C37BF0', '#FF8A3D', '#FFFFFF'];
    function size() { cv.width = cv.clientWidth || 1280; cv.height = cv.clientHeight || 720; }
    function burst(x, y) {
      var c = COLS[Math.floor(Math.random() * COLS.length)], c2 = COLS[Math.floor(Math.random() * COLS.length)], N = 70 + Math.floor(Math.random() * 40);
      for (var i = 0; i < N; i++) { var a = Math.PI * 2 * i / N, sp = 2 + Math.random() * 4.5; parts.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: i % 3 ? c : c2, s: 2 + Math.random() * 2 }); }
    }
    function rocket() { parts.push({ x: cv.width * (0.15 + Math.random() * 0.7), y: cv.height, vx: (Math.random() - .5) * 1.5, vy: -(9 + Math.random() * 4), life: 1, c: '#FFE7A6', s: 3, rk: true }); }
    function frame(ts) {
      if (!d.body.contains(v)) { cancelAnimationFrame(raf); return; }
      if (!ctx) return;
      if (ts - launchT > 650) { launchT = ts; rocket(); if (Math.random() < .4) rocket(); }
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = parts.length - 1; i >= 0; i--) {
        var q = parts[i];
        q.x += q.vx; q.y += q.vy;
        if (q.rk) { q.vy += 0.16; if (q.vy >= -1.5) { burst(q.x, q.y); parts.splice(i, 1); continue; } }
        else { q.vy += 0.05; q.vx *= 0.985; q.vy *= 0.985; q.life -= 0.012; if (q.life <= 0) { parts.splice(i, 1); continue; } }
        ctx.globalAlpha = Math.max(0, q.life); ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }
    var view = { name: 'bday', el: v };
    setTimeout(function () { size(); burst(cv.width * .3, cv.height * .3); burst(cv.width * .7, cv.height * .25); raf = requestAnimationFrame(frame); if (current() === view) Nav.focus(b1, true); }, 60);
    setTimeout(playBdayTune, 700);
    return view;
  }

  /* ---------- Chế độ ngủ: tối màn hình, nhỏ tiếng, hết phim thì tắt ---------- */
  var sleepState = { on: false, snooze: 0, told: '', wasOpen: false, gn: false };
  function sleepApplies() {
    var at = Settings.get('SLEEP_AT'); if (!at) return false;
    var n = new Date(), m = n.getHours() * 60 + n.getMinutes(), s = hm2min(at);
    if (!(m >= s || m < 5 * 60)) return false;
    if (Settings.get('SLEEP_WHO') === 'lim') {
      var ids = Store.together().length ? Store.together() : [Store.profile()];
      if (!ids.some(function (id) { return !!limOf(id); })) return false;
    }
    return Date.now() > sleepState.snooze;
  }
  function sleepTick() {
    var on = sleepApplies(), html = d.documentElement;
    if (on !== sleepState.on) {
      sleepState.on = on; html.classList.toggle('sleepy', on);
      if (on) { if (Player.isOpen()) { Player.sleepEnd(); Player.setVolume(35); } }
      else { Player.setVolume(100); }
    }
    if (!on) { sleepState.wasOpen = false; return; }
    var night = Store.dayKey(new Date(Date.now() - 6 * 3600e3));
    if (sleepState.told !== night) { sleepState.told = night; sleepNotice(); }
    var open = Player.isOpen();
    if (open) { Player.sleepEnd(); Player.setVolume(35); sleepState.wasOpen = true; }
    else if (sleepState.wasOpen && !sleepState.gn) { sleepState.wasOpen = false; goodNight(); }
  }
  function sleepNotice() {
    var o = d.getElementById('sleepn'); if (o) o.parentNode.removeChild(o);
    o = el('div', 'sleepn'); o.id = 'sleepn';
    o.appendChild(el('div', 'snm', '🌙'));
    var t = el('div', 'snt'); t.appendChild(el('div', 'sn1', 'Đã ' + Settings.get('SLEEP_AT') + ', tới giờ đi ngủ rồi')); t.appendChild(el('div', 'sn2', 'Màn hình tối dần, âm lượng nhỏ lại. Hết phim này app sẽ tắt, không tự phát phim tiếp.')); o.appendChild(t);
    var b = el('div', 'snb', 'Xem thêm 15 phút');
    b.onclick = function () { sleepSnooze(); };
    o.appendChild(b);
    d.body.appendChild(o);
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 15000);
  }
  function sleepSnooze() {
    sleepState.snooze = Date.now() + 15 * 60000; sleepTick();
    var o = d.getElementById('sleepn'); if (o) o.parentNode.removeChild(o);
    UI.toast('Xem thêm 15 phút nữa nhé');
  }
  function goodNight() {
    sleepState.gn = true;
    var v = UI.view(); v.classList.add('gnight');
    v.appendChild(el('div', 'gnm', '🌙'));
    v.appendChild(el('div', 'gnt', 'Chúc ngủ ngon'));
    var s = el('div', 'gns', ''); v.appendChild(s);
    var bx = el('div', 'btns center');
    var b1 = UI.button('Xem thêm 15 phút', '', function () { sleepState.gn = false; clearInterval(t); back(); sleepSnooze(); });
    bx.appendChild(b1); v.appendChild(bx);
    var left = 30;
    function paint() { s.textContent = (w.AndroidApp || w.tizen) ? 'App sẽ tắt sau ' + left + ' giây' : 'Màn hình sẽ tối sau ' + left + ' giây'; }
    paint();
    var t = setInterval(function () {
      left--; paint();
      if (left > 0) return;
      clearInterval(t);
      try { if (w.AndroidApp && w.AndroidApp.exit) { w.AndroidApp.exit(); return; } } catch (e) { /* bỏ qua */ }
      try { if (w.tizen && w.tizen.application) { w.tizen.application.getCurrentApplication().exit(); return; } } catch (e) { /* bỏ qua */ }
      v.classList.add('off');   // trình duyệt: chỉ tắt tối màn hình
    }, 1000);
    var view = { name: 'gnight', el: v, onBeforeBack: function () { sleepState.gn = false; clearInterval(t); return true; } };
    push(view);
    setTimeout(function () { Nav.focus(b1, true); }, 30);
  }

  /* ---------- Báo cáo tuần (hồ sơ người lớn chọn trong Cài đặt) ---------- */
  function weekStart(t) { var x = new Date(t || Date.now()); x.setHours(0, 0, 0, 0); var wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x.getTime(); }
  function weekReport() {
    var me = Store.profile(), adults = Store.pref('adults', []) || [];
    if (adults.indexOf(me) < 0) return null;
    var now = new Date(), wd = (now.getDay() + 6) % 7; if (wd > 2) return null;   // thứ Hai đến thứ Tư
    var ws = weekStart() - 7 * 864e5, we = weekStart(), wk = Store.dayKey(ws);
    var dis = Store.pref('weekSeen', {}) || {}; if ((dis[me] || '') === wk) return null;
    var ids = ['guest'].concat(Store.profiles().filter(function (p) { return p.id !== 'guest'; }).map(function (p) { return p.id; }));
    var rows = [], tot = 0, films = 0, prevTot = 0, hours = [];
    for (var i = 0; i < 24; i++) hours.push(0);
    ids.forEach(function (id) {
      var st = Store.stats(id), m = 0, pm = 0;
      Object.keys(st).forEach(function (k) {
        var t = new Date(k + 'T00:00:00').getTime(), s = st[k].s || 0;
        if (t >= ws && t < we) { m += s; (st[k].h || []).forEach(function (x, h) { hours[h] += x; }); }
        else if (t >= ws - 7 * 864e5 && t < ws) pm += s;
      });
      var f = Store.as(id, function () { return Store.recent().filter(function (r) { return r.t >= ws && r.t < we; }).length; });
      tot += m; prevTot += pm; films += f;
      var lim = limOf(id), ok = 0, days = 0;
      if (lim) {
        for (var dd = 0; dd < 7; dd++) {
          var dt = new Date(ws + dd * 864e5), k2 = Store.dayKey(dt.getTime()), wk2 = dt.getDay() === 0 || dt.getDay() === 6, L = wk2 ? lim.we : lim.wd;
          if (!L) continue; days++; if (((st[k2] || {}).s || 0) / 60 <= L + 1) ok++;
        }
      }
      if (m > 0 || f > 0) rows.push({ p: profileOf(id) || { id: id, name: 'Guest' }, m: m, f: f, lim: lim ? ok + '/' + days : '' });
    });
    if (!rows.length) return null;
    rows.sort(function (a, b) { return b.m - a.m; });
    var likes = {};
    ids.forEach(function (id) { var m = w.Rates ? w.Rates.of(id) : {}; Object.keys(m).forEach(function (v2) { if (m[v2].r === 1) { likes[v2] = likes[v2] || { n: 0, title: m[v2].title }; likes[v2].n++; } }); });
    var best = Object.keys(likes).map(function (k) { return likes[k]; }).sort(function (a, b) { return b.n - a.n; })[0];
    var hmx = Math.max.apply(null, hours), hpk = hours.indexOf(hmx);
    // nhạc: lượt nghe bài hát (quá 30 giây) trong tuần
    var titles = {}; try { (w.Music.S.all() || []).forEach(function (x) { titles[x.file] = x.title; }); } catch (e) { /* bỏ qua */ }
    var mAll = {}, mProf = [], mN = 0;
    ids.forEach(function (id) {
      var st = Store.stats(id), mine = {};
      Object.keys(st).forEach(function (k) { var t = new Date(k + 'T00:00:00').getTime(); if (t >= ws && t < we && st[k].m) Object.keys(st[k].m).forEach(function (f) { var c = st[k].m[f] || 0; mine[f] = (mine[f] || 0) + c; mAll[f] = (mAll[f] || 0) + c; mN += c; }); });
      var top = Object.keys(mine).sort(function (a, b) { return mine[b] - mine[a]; })[0];
      if (top) mProf.push({ p: profileOf(id) || { id: id, name: 'Guest' }, title: titles[top] || top, n: mine[top] });
    });
    var music = mN ? { n: mN, top: Object.keys(mAll).sort(function (a, b) { return mAll[b] - mAll[a]; }).slice(0, 3).map(function (f) { return { title: titles[f] || f, n: mAll[f], file: f }; }), prof: mProf.sort(function (a, b) { return b.n - a.n; }) } : null;
    return { ws: ws, wk: wk, rows: rows, tot: tot, prev: prevTot, films: films, best: best, peak: hmx > 0 ? hpk : -1, music: music };
  }
  function weekCard() {
    var r = weekReport(); if (!r) return null;
    var c = el('div', 'rowwrap weekc');
    var L = el('div', 'wkl');
    var a = new Date(r.ws), b = new Date(r.ws + 6 * 864e5);
    L.appendChild(el('div', 'wkk', 'BÁO CÁO TUẦN · ' + a.getDate() + '/' + (a.getMonth() + 1) + '–' + b.getDate() + '/' + (b.getMonth() + 1)));
    L.appendChild(el('div', 'wkt', 'Tuần qua cả nhà xem ' + fmtMin(r.tot)));
    var diff = r.tot - r.prev, sub = [];
    if (r.prev > 0) sub.push((diff >= 0 ? 'Nhiều hơn' : 'Ít hơn') + ' tuần trước ' + fmtMin(Math.abs(diff)));
    if (r.films) sub.push(r.films + ' phim'); sub.push(r.rows[0].p.name + ' xem nhiều nhất');
    if (r.peak >= 0) sub.push('hay xem lúc ' + r.peak + '–' + (r.peak + 1) + ' giờ');
    L.appendChild(el('div', 'wks', sub.join(' · ')));
    var mx = r.rows[0].m || 1, cols = w.Avatars && w.Avatars.colors ? w.Avatars.colors(Store.profiles(), ['#5B9BFF', '#FF8A3D', '#4CC27A', '#C37BF0', '#F0648C', '#2EC4D6', '#E8B04B', '#FF6B6B']) : {};
    r.rows.forEach(function (x) {
      var rw = el('div', 'wkr');
      rw.appendChild(avatar(x.p, 'sm'));
      rw.appendChild(el('span', 'wkn', x.p.name));
      var mp = r.music ? r.music.prof.filter(function (q) { return q.p.id === x.p.id; })[0] : null;
      rw.appendChild(el('span', 'wkms', mp ? '♪ ' + mp.title : ''));
      var tr = el('div', 'wktr'), fl = el('i'); fl.style.width = Math.max(1, x.m / mx * 100) + '%'; fl.style.background = cols[x.p.id] || '#E8B04B'; tr.appendChild(fl); rw.appendChild(tr);
      rw.appendChild(el('span', 'wkv', fmtMin(x.m)));
      L.appendChild(rw);
    });
    c.appendChild(L);
    var R = el('div', 'wkrt');
    if (r.best) { var bb = el('div', 'wkbox'); bb.appendChild(el('div', 'wkbk', 'Phim cả nhà thích nhất')); bb.appendChild(el('div', 'wkbv', r.best.title)); bb.appendChild(el('div', 'wkbh', '❤ ' + r.best.n + ' người thích')); R.appendChild(bb); }
    if (r.music) {
      var allS = w.Music && w.Music.S ? w.Music.S.all() : [], fi = -1; allS.forEach(function (x, k) { if (x.file === r.music.top[0].file) fi = k; });
      var mb = el('div', 'wkbox wkmus' + (fi >= 0 ? ' f' : '')); mb.appendChild(el('div', 'wkbk', '♪ Bài cả nhà nghe nhiều nhất'));
      mb.appendChild(el('div', 'wkbv', r.music.top[0].title)); mb.appendChild(el('div', 'wkbh', r.music.top[0].n + ' lần nghe' + (fi >= 0 ? ' · OK để nghe' : '')));
      if (fi >= 0) { mb._ok = function () { w.MusicPage.openSong(fi); }; mb.onclick = mb._ok; }
      R.appendChild(mb);
    }
    var lims = r.rows.filter(function (x) { return x.lim; });
    if (lims.length) { var lb = el('div', 'wkbox'); lb.appendChild(el('div', 'wkbk', 'Giới hạn giờ xem')); lims.forEach(function (x) { lb.appendChild(el('div', 'wkbv sm', x.p.name + ': đúng giờ ' + x.lim + ' ngày')); }); R.appendChild(lb); }
    R.appendChild(UI.button('Đã xem · ẩn đến tuần sau', 'small', function () {
      var dis = Store.pref('weekSeen', {}) || {}; dis[Store.profile()] = r.wk; Store.setPref('weekSeen', dis);
      if (c.parentNode) c.parentNode.removeChild(c);
      Nav.focus(d.querySelector('.hero .btn') || S.tabEls.home, true);
    }));
    c.appendChild(R);
    return c;
  }

  /* ---------- Tổng tài của tuần: phim cả nhà xem nhiều nhất 7 ngày qua, kèm một câu thoại ---------- */
  function weekNo(t) { var x = new Date(t || Date.now()); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + 3 - (x.getDay() + 6) % 7); var w1 = new Date(x.getFullYear(), 0, 4); return 1 + Math.round(((x - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }
  function weekPick(all) {
    var since = Date.now() - 7 * 864e5, sc = {}, items = {};
    ['guest'].concat(Store.profiles().map(function (p) { return p.id; })).forEach(function (id) {
      Store.as(id, function () {
        Store.recent().forEach(function (r) {
          if (!r.item || r.t < since || r.item.kind === 'anime' || Settings.hides(r.item)) return;
          var p = Store.getProgress(r.vid), part = p && p.d ? Math.min(1, p.p / p.d) : 0.3;
          sc[r.item.id] = (sc[r.item.id] || 0) + 1 + part; items[r.item.id] = r.item;
          var rr = w.Rates ? w.Rates.get(r.item.id, id) : null; if (rr === 1) sc[r.item.id] += 1.5; else if (rr === -1) sc[r.item.id] -= 2;
        });
      });
    });
    var best = Object.keys(sc).sort(function (a, b) { return sc[b] - sc[a]; })[0];
    if (best && sc[best] > 0) return items[best];
    var wk = (all || []).filter(function (f) { return new Date(f.pub || 0).getTime() > since; }).sort(function (a, b) { return (b.views || 0) - (a.views || 0); });
    return wk[0] || null;
  }

  /* ---------- Có tập mới: phim bộ đang theo dõi vừa ra tập mới ---------- */
  function newEpisodes(series) {
    var byId = {}; (series || []).forEach(function (s) { byId[s.id] = s; });
    var out = [], seen = {};
    Store.recent().forEach(function (r) {
      var it = r.item; if (!it || it.kind !== 'anime' || seen[it.id]) return; seen[it.id] = 1;
      var cur = byId[it.id]; if (!cur || !(cur.eps > (it.eps || 0))) return;
      out.push({ item: cur, n: cur.eps - (it.eps || 0) });
    });
    return out;
  }

  /* ---------- Tải sẵn ảnh bìa ---------- */
  var preN = 0, preQ = [], preBusy = false, preSeen = {};
  function preload(list) {
    if (Settings.get('PRELOAD') === false) return;
    (list || []).slice(0, 90).forEach(function (f) { [f.thumb, f.hero].forEach(function (u) { if (u && !preSeen[u]) { preSeen[u] = 1; preQ.push(u); } }); });
    if (preBusy) return;
    preBusy = true;
    (function one() {
      var u = preQ.shift(); if (!u) { preBusy = false; return; }
      if (Player.isOpen()) { preQ.unshift(u); setTimeout(one, 5000); return; }   // đang xem phim: để mạng cho phim
      var im = new Image(); im.onload = function () { preN++; setTimeout(one, 120); }; im.onerror = function () { setTimeout(one, 120); }; im.src = u;
    })();
  }

  /* ---------- Quản trị trên TV: xem bằng remote, đăng nhập bằng Google của phần Đồng bộ ---------- */
  function AdminTV(tab, days) {
    tab = tab || 'overview'; days = days || 7;
    var v = UI.view();
    v.classList.add('scroller'); v.classList.add('stats'); v.classList.add('admtv');
    var COLS = ['#5B9BFF', '#FF8A3D', '#4CC27A', '#C37BF0', '#F0648C', '#2EC4D6', '#E8B04B', '#FF6B6B'];
    var base = String((w.Settings && Settings.get('STATS_URL')) || C.STATS_URL || '').replace(/\/+$/, '');
    var em = w.Tele && w.Tele.adminEmail ? w.Tele.adminEmail() : '';
    var SCR = { home: 'Trang chủ', music: 'Nghe nhạc', search: 'Tìm kiếm', chans: 'Duyệt kênh', cats: 'Danh mục', detail: 'Xem chi tiết phim', settings: 'Cài đặt', who: 'Chọn hồ sơ', info: 'Thông tin', guide: 'Hướng dẫn', history: 'Lịch sử' };
    var mine = {}; Store.profiles().forEach(function (p) { mine[p.id] = p; });
    var colorOf = w.Avatars && w.Avatars.colors ? w.Avatars.colors(Store.profiles(), COLS) : {};
    function col(id) {   // mỗi hồ sơ một màu, theo màu hình thú; hồ sơ lạ lấy màu còn trống
      if (!colorOf[id]) { var used = {}; Object.keys(colorOf).forEach(function (k) { used[colorOf[k]] = 1; }); colorOf[id] = COLS.filter(function (c2) { return !used[c2]; })[0] || COLS[Object.keys(colorOf).length % COLS.length]; }
      return colorOf[id];
    }
    function pav(id, name, cls) {
      if (mine[id]) return avatar(mine[id], 'admav ' + (cls || ''));
      var a = el('div', 'admav ini ' + (cls || ''), String(name || '?').charAt(0).toUpperCase()); a.style.background = col(id); return a;
    }
    function num(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
    function when(ts) {
      if (!ts) return '—';
      var t = new Date(ts), n = new Date(), dd = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 864e5);
      return (dd === 0 ? 'Hôm nay ' : dd === 1 ? 'Hôm qua ' : t.getDate() + '/' + (t.getMonth() + 1) + ' ') + UI.hhmm(ts);
    }
    function place(x) { return [x.city, x.country === 'US' ? 'Hoa Kỳ' : x.country === 'VN' ? 'Việt Nam' : x.country].filter(Boolean).join(', '); }
    function tok() { return w.__ttAdminTok ? Promise.resolve(w.__ttAdminTok) : Sync.idToken(); }
    function call(path, body) {
      return tok().then(function (t) {
        return new Promise(function (ok, bad) {
          var x = new XMLHttpRequest();
          x.open(body ? 'POST' : 'GET', base + path + (path.indexOf('?') < 0 ? '?' : '&') + 'days=' + days + '&tz=' + new Date().getTimezoneOffset());
          x.setRequestHeader('Authorization', 'Bearer ' + t);
          if (body) x.setRequestHeader('Content-Type', 'application/json');
          x.timeout = 15000;
          x.onload = function () { var j = null; try { j = JSON.parse(x.responseText); } catch (e) { /* bỏ qua */ } if (x.status === 200 && j) ok(j); else bad({ status: x.status, j: j }); };
          x.onerror = x.ontimeout = function () { bad({ net: true }); };
          x.send(body ? JSON.stringify(body) : null);
        });
      });
    }

    // đầu trang
    var top = el('div', 'sthead');
    var crown = el('div', 'admcrown'); crown.innerHTML = '<svg viewBox="0 0 40 40"><path d="M8 13l6 5 6-9 6 9 6-5-2 10H10z" fill="#1A1206"/><rect x="10" y="25" width="20" height="2.6" rx="1.3" fill="#1A1206"/></svg>';
    top.appendChild(crown);
    var tt = el('div', 'sttitle');
    tt.appendChild(el('div', 'stt1', 'Quản trị'));
    var sub = el('div', 'stt2', (em || '') + ' · đang tải…');
    tt.appendChild(sub);
    top.appendChild(tt);
    var seg = el('div', 'stseg');
    [[1, 'Hôm nay'], [7, '7 ngày'], [30, '30 ngày']].forEach(function (x) {
      if (tab === 'channels' || tab === 'music') return;
      var b = el('div', 'stsegb f' + (x[0] === days ? ' on' : ''), x[1]);
      b._ok = function () { if (x[0] !== days) { back(); push(AdminTV(tab, x[0])); } };
      seg.appendChild(b);
    });
    top.appendChild(seg);
    v.appendChild(top);
    var tabs = el('div', 'admtabs rowwrap');
    [['overview', 'Tổng quan'], ['devices', 'Thiết bị và IP'], ['profile', 'Hồ sơ'], ['channels', 'Kênh'], ['music', 'Nhạc']].forEach(function (x) {
      var b = el('div', 'admtab f' + (x[0] === tab ? ' on' : ''), x[1]);
      b._ok = function () { if (x[0] !== tab) { back(); push(AdminTV(x[0], days)); } };
      tabs.appendChild(b);
    });
    tabs.appendChild(el('div', 'admhint', 'Bản đầy đủ, báo cáo PDF: Thông tin → Quản trị → quét mã QR'));
    v.appendChild(tabs);
    var body = el('div', 'stwrap');
    body.appendChild(el('div', 'admmsg', 'Đang tải số liệu…'));
    v.appendChild(body);

    function fail(e) {
      body.innerHTML = '';
      var m = e && e.nologin ? 'Màn hình này dùng tài khoản Google của phần Đồng bộ. Vào Cài đặt → Đồng bộ, đăng nhập bằng email quản trị rồi mở lại.'
        : e && e.noid ? 'Google chưa trả mã xác minh. Đăng xuất phần Đồng bộ rồi đăng nhập lại một lần.'
        : e && e.status === 403 ? 'Máy chủ từ chối: email này không có trong danh sách quản trị.'
        : e && e.status === 401 ? 'Máy chủ chưa nhận Client ID của TV. Thêm GOOGLE_TV_CLIENT_ID vào biến GOOGLE_CLIENT_ID trên Cloudflare (xem HUONG-DAN-ADMIN).'
        : e && e.net ? 'Không kết nối được máy chủ thống kê. Kiểm tra mạng hoặc địa chỉ trong Cài đặt.' : 'Lỗi máy chủ (' + (e && e.status || '?') + ').';
      body.appendChild(el('div', 'admmsg bad', m));
    }
    function card(title, subt, cls) {
      var c = el('div', 'stcard rowwrap ' + (cls || ''));
      var h = el('div', 'stch-h'); h.appendChild(el('div', 'stct', title)); if (subt) h.appendChild(el('div', 'stcs', subt)); c.appendChild(h);
      return c;
    }
    function kpis(list) {
      var kr = el('div', 'stkpis rowwrap');
      list.forEach(function (x) {
        var t = el('div', 'stkpi f'); t._ok = function () {};
        t.appendChild(el('div', 'stk', x[0])); t.appendChild(el('div', 'stv', String(x[1]))); t.appendChild(el('div', 'stdelta', x[2] || ''));
        kr.appendChild(t);
      });
      return kr;
    }
    function act(id, action) {
      return call('/a/device', { id: id, action: action }).then(function () {
        UI.toast(action === 'block' ? 'Đã chặn thiết bị' : action === 'unblock' ? 'Đã bỏ chặn' : 'Đã đánh dấu người nhà');
        back(); push(AdminTV(tab, days));
      }, fail);
    }
    function stamp() { sub.textContent = (em ? em + ' · ' : '') + (days === 1 ? 'hôm nay' : days + ' ngày qua') + ' · cập nhật ' + UI.hhmm(Date.now()); }

    if (!base) { fail({ net: true }); body.firstChild.textContent = 'Chưa có máy chủ thống kê. Điền ở Cài đặt → Kết nối → Máy chủ thống kê.'; return { name: 'admintv', el: v }; }

    if (tab === 'overview') {
      call('/a/overview').then(function (j) {
        body.innerHTML = ''; stamp();
        j.profiles.forEach(function (p) { col(p.id); });
        (j.newDevices || []).forEach(function (x) {
          var a = el('div', 'admalert rowwrap');
          var t = el('div', 'admat');
          t.appendChild(el('div', 'admat1', 'Thiết bị mới: ' + x.label));
          t.appendChild(el('div', 'admat2', [place(x), x.ip, x.pname ? 'hồ sơ ' + x.pname : '', when(x.first_seen)].filter(Boolean).join(' · ')));
          a.appendChild(t);
          a.appendChild(UI.button('Đây là người nhà', 'gold small', function () { act(x.id, 'trust'); }));
          a.appendChild(UI.button('Chặn', 'small warn', function () { act(x.id, 'block'); }));
          body.appendChild(a);
        });
        var k = j.kpi;
        body.appendChild(kpis([['Tổng giờ xem', fmtMin(k.minutes * 60), k.films + ' phim'], ['Thiết bị hoạt động', k.devicesActive, k.devicesLive + ' đang mở app'], ['Hồ sơ dùng app', k.profiles, j.profiles[0] ? j.profiles[0].name + ' xem nhiều nhất' : ''], ['Đơn vị YouTube hôm nay', num(k.unitsToday), 'trên 10.000 mỗi ngày']]));
        var row = el('div', 'strow');
        var left = card('Giờ xem theo hồ sơ', days === 1 ? 'hôm nay' : days + ' ngày qua', 'wide');
        var mx = Math.max.apply(null, j.profiles.map(function (p) { return p.minutes; }).concat([1]));
        j.profiles.forEach(function (p) {
          var r = el('div', 'admprow f');
          r._ok = function () { back(); var s2 = AdminTV('profile', days); push(s2); };
          r.appendChild(pav(p.id, p.name));
          var mid = el('div', 'admpmid');
          var nm = el('div', 'admpn', p.name); if (p.live) nm.appendChild(el('span', 'admlive', 'Đang mở'));
          mid.appendChild(nm);
          var tr = el('div', 'admtr'), fl = el('div', 'admfl'); fl.style.width = Math.max(1, p.minutes / mx * 100) + '%'; fl.style.background = col(p.id); tr.appendChild(fl); mid.appendChild(tr);
          r.appendChild(mid);
          var rt = el('div', 'admpr'); rt.appendChild(el('div', 'admpv', fmtMin(p.minutes * 60))); rt.appendChild(el('div', 'admps', p.films + ' phim · ' + num(p.unitsToday) + ' đv hôm nay')); r.appendChild(rt);
          left.appendChild(r);
        });
        row.appendChild(left);
        var right = card('Đang mở app', (j.live || []).length + ' thiết bị');
        (j.live || []).forEach(function (x) {
          var r = el('div', 'admlv f'); r._ok = function () {};
          r.appendChild(pav(x.profile, x.pname, 'sm'));
          var t = el('div', 'admlvt');
          t.appendChild(el('div', 'admlv1', (x.pname || '') + ' · ' + (x.film || SCR[x.screen] || x.screen || '')));
          t.appendChild(el('div', 'admlv2', (x.name || x.label) + ' · ' + place(x)));
          r.appendChild(t); right.appendChild(r);
        });
        if (!(j.live || []).length) right.appendChild(el('div', 'admempty', 'Không có thiết bị nào đang mở app.'));
        row.appendChild(right);
        body.appendChild(row);
      }, fail);
    } else if (tab === 'devices') {
      call('/a/devices').then(function (j) {
        body.innerHTML = ''; stamp();
        var c = card('Thiết bị đã kết nối', j.devices.length + ' thiết bị · bấm Chặn để dừng app trên máy đó');
        j.devices.forEach(function (x) {
          var r = el('div', 'admdev rowwrap' + (x.blocked ? ' blk' : ''));
          var ic = el('div', 'admdic');
          ic.innerHTML = /tv/.test(x.kind) ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/></svg>' : /phone|tablet/.test(x.kind) ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/></svg>';
          r.appendChild(ic);
          var a = el('div', 'admd1');
          var n = el('div', 'admdn', x.name || x.label);
          if (x.blocked) n.appendChild(el('span', 'admtag blk', 'Đã chặn')); else if (x.trusted) n.appendChild(el('span', 'admtag ok', 'Người nhà')); else n.appendChild(el('span', 'admtag new', 'Mới'));
          if (x.live) n.appendChild(el('span', 'admlive', 'Đang mở'));
          a.appendChild(n);
          a.appendChild(el('div', 'admds', x.label + (x.version ? ' · bản ' + x.version : '') + ' · lần cuối ' + (x.live ? 'đang mở' : when(x.last_seen))));
          r.appendChild(a);
          var b = el('div', 'admd2'); b.appendChild(el('div', 'admip', x.ip)); b.appendChild(el('div', 'admds', (x.isp || '') + (place(x) ? ' · ' + place(x) : ''))); r.appendChild(b);
          var ps = el('div', 'admd3'); x.profiles.slice(0, 4).forEach(function (p) { ps.appendChild(pav(p.id, p.name, 'sm')); }); r.appendChild(ps);
          var bt = el('div', 'admd4');
          if (!x.trusted && !x.blocked) bt.appendChild(UI.button('Người nhà', 'small', function () { act(x.id, 'trust'); }));
          bt.appendChild(x.blocked ? UI.button('Bỏ chặn', 'gold small', function () { act(x.id, 'unblock'); }) : UI.button('Chặn', 'small warn', function () { act(x.id, 'block'); }));
          r.appendChild(bt);
          c.appendChild(r);
        });
        body.appendChild(c);
        if ((j.locations || []).length) {
          var lc = card('Vị trí kết nối', 'gần đúng tới thành phố, tính từ IP');
          var g = el('div', 'admlocs');
          j.locations.forEach(function (x) { var t = el('div', 'admloc'); t.appendChild(el('b', '', place(x) || 'Không rõ')); t.appendChild(el('span', '', x.n + ' thiết bị')); g.appendChild(t); });
          lc.appendChild(g); body.appendChild(lc);
        }
      }, fail);
    } else if (tab !== 'channels' && tab !== 'music') {
      call('/a/overview').then(function (o) {
        o.profiles.forEach(function (p) { col(p.id); });
        var pid = AdminTV.pid && o.profiles.some(function (p) { return p.id === AdminTV.pid; }) ? AdminTV.pid : (o.profiles[0] || {}).id;
        if (!pid) { body.innerHTML = ''; body.appendChild(el('div', 'admmsg', 'Chưa có số liệu hồ sơ.')); return; }
        return call('/a/profile?id=' + encodeURIComponent(pid)).then(function (j) {
          body.innerHTML = ''; stamp();
          var pl = el('div', 'admplist rowwrap');
          o.profiles.forEach(function (p) {
            var b = el('div', 'admpbtn f' + (p.id === pid ? ' on' : ''));
            b.appendChild(pav(p.id, p.name, 'sm')); b.appendChild(el('span', '', p.name));
            b._ok = function () { if (p.id !== pid) { AdminTV.pid = p.id; back(); push(AdminTV('profile', days)); } };
            pl.appendChild(b);
          });
          body.appendChild(pl);
          var c0 = col(pid), tot = j.daily.reduce(function (a, x) { return a + x.m; }, 0);
          var done = j.films.filter(function (f) { return f.dur && f.pos / f.dur > 0.9; }).length;
          var u = j.units.reduce(function (a, x) { return a + (x.u || 0); }, 0);
          var hmx = Math.max.apply(null, j.hours.concat([1])), ht = j.hours.indexOf(hmx);
          body.appendChild(kpis([['Giờ xem', fmtMin(tot * 60), 'TB ' + fmtMin(tot * 60 / Math.max(1, days)) + '/ngày'], ['Phim đã xem', j.films.length, done + ' xem hết'], ['Đơn vị YouTube', num(u), j.searches.length ? 'hay tìm: ' + j.searches[0].q : ''], ['Hay xem lúc', hmx > 1 ? ht + '–' + (ht + 1) + ' giờ' : '—', j.devices.map(function (x) { return x.label; }).slice(0, 2).join(', ')]]));
          var row = el('div', 'strow');
          var dc = card('Phút xem mỗi ngày', '', 'wide');
          var dmx = Math.max.apply(null, j.daily.map(function (x) { return x.m; }).concat([1]));
          var bars = el('div', 'admbars');
          j.daily.forEach(function (x, i) {
            var b = el('div', 'admbar'); var f = el('i'); f.style.height = Math.max(x.m ? 2 : 0, x.m / dmx * 100) + '%'; f.style.background = c0; b.appendChild(f);
            var dt = new Date(x.day); if (j.daily.length <= 7 || i % 5 === 0 || i === j.daily.length - 1) b.appendChild(el('span', '', dt.getDate() + '/' + (dt.getMonth() + 1)));
            bars.appendChild(b);
          });
          dc.appendChild(bars);
          var heat = el('div', 'admheat');
          j.hours.forEach(function (m, h) { var x = el('div'); var i2 = el('i'); i2.style.background = c0; i2.style.opacity = (0.08 + 0.92 * m / hmx).toFixed(2); x.appendChild(i2); x.appendChild(el('span', '', h % 3 === 0 ? String(h) : '')); heat.appendChild(x); });
          dc.appendChild(el('div', 'stcs admhl', 'Khung giờ hay xem (0 → 23 giờ)'));
          dc.appendChild(heat);
          row.appendChild(dc);
          var cc = card('Kênh xem nhiều');
          var cs = j.channels.reduce(function (a, x) { return a + x.s; }, 0) || 1;
          j.channels.slice(0, 5).forEach(function (x) {
            var r = el('div', 'admch'); r.appendChild(el('span', 'admchn', x.ch)); var tr = el('div', 'admtr'), fl = el('div', 'admfl'); fl.style.width = (x.s / cs * 100) + '%'; fl.style.background = c0; tr.appendChild(fl); r.appendChild(tr); r.appendChild(el('b', '', Math.round(x.s / cs * 100) + '%')); cc.appendChild(r);
          });
          if (!j.channels.length) cc.appendChild(el('div', 'admempty', 'Chưa có.'));
          row.appendChild(cc);
          body.appendChild(row);
          var fc = card('Phim xem gần đây', j.films.length + ' phim');
          j.films.slice(0, 8).forEach(function (f) {
            var p = f.dur ? Math.min(100, Math.round(f.pos / f.dur * 100)) : 0;
            var r = el('div', 'admfilm f'); r._ok = function () {};
            var t = el('div', 'admft'); t.appendChild(el('div', 'admf1', f.title)); t.appendChild(el('div', 'admds', f.ch + ' · ' + when(f.last) + ' · ' + (f.device || ''))); r.appendChild(t);
            r.appendChild(el('div', 'admfw', fmtMin(f.s)));
            var pg = el('div', 'admfp'); var tr = el('div', 'admtr'), fl = el('div', 'admfl'); fl.style.width = p + '%'; fl.style.background = p >= 90 ? '#4CC27A' : c0; tr.appendChild(fl); pg.appendChild(tr); pg.appendChild(el('span', '', p >= 90 ? 'Xem hết' : p + '%')); r.appendChild(pg);
            fc.appendChild(r);
          });
          if (!j.films.length) fc.appendChild(el('div', 'admempty', 'Chưa xem phim nào trong khoảng này.'));
          body.appendChild(fc);
        });
      }).then(null, fail);
    }

    if (tab === 'channels') {
      var TY = { drama: 'Phim ngắn', anime: 'Hoạt hình', movie: 'Phim lẻ' };
      call('/a/channels').then(function (j) {
        if (!j.ok) { fail({ status: 'GitHub' }); body.firstChild.textContent = 'Máy chủ chưa nối GitHub (GH_TOKEN, GH_REPO). Xem HUONG-DAN-ADMIN, bước “Nối GitHub”.'; return; }
        var dd = j.data || {}, L = dd.v >= 2 ? dd.channels : null, sha = j.sha;
        if (!L) {   // channels.json bản cũ: dựng từ danh sách đang dùng
          var mp = {}; (dd.channels || []).forEach(function (c) { if (c && c.name) mp[normKey(c.name)] = c; });
          L = [];
          [['CHANNELS', 'drama'], ['ANIME_CHANNELS', 'anime'], ['MOVIE_CHANNELS', 'movie']].forEach(function (q) { (C[q[0]] || []).forEach(function (c) { var m = mp[normKey(c.name)] || {}; var o = { name: c.name, type: q[1] }; if (c.id || m.id) o.id = c.id || m.id; if (m.title) o.title = m.title; if (m.thumb) o.thumb = m.thumb; if (c.tag) o.tag = c.tag; L.push(o); }); });
        }
        body.innerHTML = ''; sub.textContent = (em ? em + ' · ' : '') + L.length + ' kênh · channels.json trên GitHub';
        function save(msg) {
          return call('/a/channels', { sha: sha, message: msg, channels: L }).then(function (r) { if (!r.ok) throw r; sha = r.sha; UI.toast('Đã lưu: ' + msg); }, function (e) { UI.toast('Không lưu được'); throw e; });
        }
        var on = L.filter(function (c) { return c.on !== false; });
        var miss = L.filter(function (c) { return !c.id; }), at = miss.filter(function (c) { return /^@/.test(c.name); }).length, units = at + (miss.length - at) * 100;
        body.appendChild(kpis([['Kênh đang hiện', on.length + ' / ' + L.length, ''], ['Phim ngắn', on.filter(function (c) { return c.type === 'drama'; }).length, ''], ['Hoạt hình', on.filter(function (c) { return c.type === 'anime'; }).length, ''], ['Có mã kênh', (L.length - miss.length) + ' / ' + L.length, 'có mã = không tốn đơn vị tìm kênh']]));
        var idc = card('Tự lấy mã kênh', miss.length ? miss.length + ' kênh chưa có mã · ' + at + ' × 1 đơn vị' + (miss.length - at ? ' + ' + (miss.length - at) + ' × 100 đơn vị' : '') + ' = khoảng ' + units + ' đơn vị' : 'Tất cả kênh đã có mã');
        if (miss.length) idc.appendChild(UI.button('Lấy mã ' + miss.length + ' kênh (≈ ' + units + ' đơn vị)', 'gold', function () {
          var k = 0, ok = 0;
          (function step() {
            if (k >= miss.length) { if (ok) save('Tự lấy mã cho ' + ok + ' kênh').then(function () { back(); push(AdminTV('channels', days)); }); else UI.toast('Không lấy được mã nào'); return; }
            var c = miss[k++]; UI.toast('Đang tìm ' + c.name + ' (' + k + '/' + miss.length + ')');
            var pr = /^@/.test(c.name) ? { part: 'snippet', forHandle: c.name } : null;
            ytGet(pr ? 'channels' : 'search', pr || { part: 'snippet', type: 'channel', q: c.name, maxResults: 1 }).then(function (r) {
              var it = (r.items || [])[0]; if (!it) return;
              c.id = pr ? it.id : it.id.channelId; var th = (it.snippet.thumbnails || {}); c.thumb = (th.medium || th.default || {}).url || ''; if (!c.title) c.title = it.snippet.title; ok++;
            }).then(step, step);
          })();
        }));
        var ageD = function (c) { var t = c.last ? Date.parse(c.last) : NaN; return isNaN(t) ? -1 : Math.floor((Date.now() - t) / 86400e3); };
        var dorm = L.filter(function (c) { return c.on !== false && (c.gone || ageD(c) >= 60); });
        var dc = card('Kênh “ngủ đông”', dorm.length ? dorm.length + ' kênh đang bật: 60 ngày không ra phim mới hoặc không còn trên YouTube' : 'Không có kênh ngủ đông · kiểm tra bằng RSS, không tốn đơn vị');
        var dbx = el('div', 'admsegs');
        dbx.appendChild(UI.button('Kiểm tra ' + L.filter(function (c) { return c.id; }).length + ' kênh (0 đơn vị)', dorm.length ? '' : 'gold', function () {
          var ids = L.filter(function (c) { return c.id; }).map(function (c) { return c.id; }), parts = [], res = {}, k = 0;
          for (var q = 0; q < ids.length; q += 20) parts.push(ids.slice(q, q + 20));
          (function step() {
            if (k >= parts.length) {
              var now = new Date().toISOString(), n = 0;
              L.forEach(function (c) { var r = c.id && res[c.id]; if (!r || r.err) return; n++; c.chk = now; if (r.gone) c.gone = true; else { delete c.gone; if (r.last) c.last = r.last; } });
              save('Kiểm tra ' + n + ' kênh (ngủ đông)').then(function () { back(); push(AdminTV('channels', days)); });
              return;
            }
            UI.toast('Đang kiểm tra ' + Math.min(ids.length, (k + 1) * 20) + ' / ' + ids.length + ' kênh…');
            call('/a/channels/check', { ids: parts[k++] }).then(function (r) { if (r.ok) for (var key in r.res) res[key] = r.res[key]; }).then(step, step);
          })();
        }));
        if (dorm.length) dbx.appendChild(UI.button('Tắt ' + dorm.length + ' kênh ngủ đông', 'gold', function () { dorm.forEach(function (c) { c.on = false; }); save('Tắt ' + dorm.length + ' kênh ngủ đông').then(function () { back(); push(AdminTV('channels', days)); }); }));
        dbx.appendChild(UI.button('↶ Lịch sử thay đổi', '', function () { push(HistoryTV('channels', call)); }));
        dc.appendChild(dbx);
        body.appendChild(idc); body.appendChild(dc);
        var lc = card('Danh sách kênh', 'OK = bật / tắt kênh · thêm, sửa, đổi ảnh trên trang quản trị ở máy tính');
        L.forEach(function (c) {
          var r = el('div', 'admprow admchrow f' + (c.on === false ? ' off' : ''));
          var av = el('div', 'admav ini', String(c.title || c.name).replace(/^@/, '').charAt(0).toUpperCase()); av.style.background = col(c.name);
          var src = c.img ? (/^https?:/.test(c.img) ? c.img : String(C.CHANNELS_JSON || '').replace(/[^\/]*$/, '') + c.img) : c.thumb;
          if (src && (c.thumb || /^https?:/.test(src))) { var im = new Image(); im.onload = function () { av.style.backgroundImage = 'url(' + src + ')'; av.textContent = ''; av.classList.add('img'); }; im.src = src; }
          r.appendChild(av);
          var mid = el('div', 'admpmid'); mid.appendChild(el('div', 'admpn', c.title || c.name.replace(/^@/, '')));
          var ad = ageD(c), lt = c.gone ? 'không còn trên YouTube' : ad >= 60 ? 'ngủ đông ' + ad + ' ngày' : ad >= 0 ? 'phim mới ' + (ad ? ad + ' ngày trước' : 'hôm nay') : '';
          mid.appendChild(el('div', 'admps', c.name + ' · ' + TY[c.type] + (c.tag ? ' · ' + c.tag : '') + ' · ' + (c.id ? 'có mã' : 'chưa có mã') + (lt ? ' · ' : '')));
          if (lt) mid.lastChild.appendChild(el('span', c.gone || ad >= 60 ? 'admwarn' : '', lt));
          r.appendChild(mid);
          var swi = el('div', 'admsw' + (c.on === false ? '' : ' on'), c.on === false ? 'Tắt' : 'Bật'); r.appendChild(swi);
          r._ok = function () {
            if (c.on === false) delete c.on; else c.on = false;
            swi.className = 'admsw' + (c.on === false ? '' : ' on'); swi.textContent = c.on === false ? 'Tắt' : 'Bật'; r.classList.toggle('off', c.on === false);
            save((c.on === false ? 'Tắt' : 'Bật') + ' kênh ' + c.name);
          };
          lc.appendChild(r);
        });
        body.appendChild(lc);
      }).then(null, fail);
    } else if (tab === 'music') {
      call('/a/music').then(function (j) {
        if (!j.ok) { fail({ status: 'GitHub' }); body.firstChild.textContent = 'Máy chủ chưa nối GitHub (GH_TOKEN, GH_REPO). Xem HUONG-DAN-ADMIN, bước “Nối GitHub”.'; return; }
        var songs = j.list.songs || [];
        body.innerHTML = ''; sub.textContent = (em ? em + ' · ' : '') + songs.length + ' bài · music/list.json trên GitHub';
        var MD = { line: 'Hiện theo câu', word: 'Chạy theo chữ', sweep: 'Tô dần cả câu' };
        body.appendChild(kpis([['Số bài', songs.length, ''], ['Lời canh giờ chuẩn', songs.filter(function (x) { return x.lrcAuto === false; }).length + ' / ' + songs.length, ''], ['Có tóm tắt', songs.filter(function (x) { return x.sum; }).length + ' / ' + songs.length, ''], ['Cân bằng âm lượng', songs.filter(function (x) { return x.gain != null; }).length + ' / ' + songs.length, 'đo trên trang quản trị máy tính']]));
        var hc = el('div', 'admsegs'); hc.appendChild(UI.button('↶ Lịch sử thay đổi', '', function () { push(HistoryTV('music', call)); })); body.appendChild(hc);
        var amc = card('Lời chạy trên màn hình · tất cả bài', 'Chọn một kiểu rồi bấm OK thêm lần nữa để áp dụng cho cả ' + songs.length + ' bài');
        var amr = el('div', 'admsegs'), arm = '', rowsP = [];
        function allMode() { var m = {}; songs.forEach(function (x) { m[x.mode || 'line'] = 1; }); var k = Object.keys(m); return k.length === 1 ? k[0] : ''; }
        [['line', 'Hiện theo câu'], ['word', 'Chạy theo chữ'], ['sweep', 'Tô dần cả câu']].forEach(function (m) {
          var bt = UI.button(m[1], '', function () {
            if (allMode() === m[0]) { UI.toast('Cả ' + songs.length + ' bài đang dùng: ' + m[1]); return; }
            if (arm !== m[0]) { arm = m[0]; UI.toast('Bấm OK lần nữa để đổi cả ' + songs.length + ' bài thành “' + m[1] + '”'); return; }
            arm = '';
            call('/a/music', { sha: j.sha, op: 'mode', mode: m[0] }).then(function (r) {
              if (!r.ok) throw r; j.sha = r.sha; songs.forEach(function (x) { x.mode = m[0]; });
              rowsP.forEach(function (f) { f(); }); paintAm(); UI.toast('Đã đổi cả ' + songs.length + ' bài. 1–2 phút nữa mọi máy sẽ thấy.');
            }).then(null, function (e) { UI.toast('Không lưu được' + (e && e.j && e.j.error ? ': ' + e.j.error : '')); });
          });
          bt._m = m[0]; amr.appendChild(bt);
        });
        function paintAm() { var cur = allMode(); [].forEach.call(amr.children, function (q) { q.classList.toggle('on', q._m === cur); }); }
        paintAm(); amc.appendChild(amr); body.appendChild(amc);
        var lc = card('Danh sách bài', 'OK = mở bài: chọn kiểu chạy lời, canh lời bằng remote');
        songs.forEach(function (x, i) {
          var r = el('div', 'admprow f');
          r.appendChild(el('div', 'admnum', String(i + 1)));
          var mid = el('div', 'admpmid'); mid.appendChild(el('div', 'admpn', x.title));
          var ps = el('div', 'admps'); mid.appendChild(ps);
          (function (ps, x) { function f() { ps.textContent = fmtMin(x.dur || 0) + ' · ' + (x.lrcAuto === false ? 'lời canh giờ chuẩn' : 'lời tự động') + ' · ' + (MD[x.mode] || 'Hiện theo câu') + (x.sum ? ' · có tóm tắt' : ''); } f(); rowsP.push(f); })(ps, x);
          r.appendChild(mid);
          r._ok = function () { push(AdminSongTV(songs, i, j.sha, call)); };
          lc.appendChild(r);
        });
        body.appendChild(lc);
      }).then(null, fail);
    }
    function normKey(x) { x = String(x || '').toLowerCase(); try { x = x.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* TV cũ */ } return x.replace(/đ/g, 'd').replace(/[^a-z0-9@]/g, ''); }
    function ytGet(path, q) {
      return new Promise(function (ok, bad) {
        q.key = (w.Settings && Settings.get('API_KEY')) || C.API_KEY;
        var x = new XMLHttpRequest();
        x.open('GET', 'https://www.googleapis.com/youtube/v3/' + path + '?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&'));
        x.onload = function () { try { var r = JSON.parse(x.responseText); if (r.error) bad(r.error); else ok(r); } catch (e) { bad(e); } };
        x.onerror = function () { bad({ net: true }); }; x.send();
      });
    }
    return { name: 'admintv', el: v };
  }


  /* Quản trị trên TV: lịch sử thay đổi Kênh / Nhạc, bấm OK 2 lần để quay về bản cũ */
  function HistoryTV(kind, call) {
    var v = UI.view(); v.classList.add('scroller'); v.classList.add('stats'); v.classList.add('admtv');
    var top = el('div', 'sthead'), tt = el('div', 'sttitle');
    tt.appendChild(el('div', 'stt1', 'Lịch sử thay đổi · ' + (kind === 'channels' ? 'Kênh' : 'Nhạc')));
    tt.appendChild(el('div', 'stt2', 'Bấm OK 2 lần ở một dòng để quay về bản đó. Không mất gì: bản hiện tại vẫn nằm trong lịch sử.'));
    top.appendChild(tt); v.appendChild(top);
    var row0 = el('div', 'strow'), box = el('div', 'stcard rowwrap wide'); box.appendChild(el('div', 'admps', 'Đang tải…')); row0.appendChild(box); v.appendChild(row0);
    function when(iso) { var d0 = new Date(iso); return ('0' + d0.getDate()).slice(-2) + '/' + ('0' + (d0.getMonth() + 1)).slice(-2) + ' · ' + (UI.hhmm ? UI.hhmm(d0.getTime()) : d0.toTimeString().slice(0, 5)); }
    call('/a/history?kind=' + kind).then(function (j) {
      box.innerHTML = '';
      if (!j.ok) { box.appendChild(el('div', 'admps', j.error || 'Không tải được')); return; }
      j.list.forEach(function (h, i) {
        var r = el('div', 'admprow f');
        r.appendChild(el('div', 'admhdot' + (i === 0 ? ' now' : '')));
        var mid = el('div', 'admpmid'); mid.appendChild(el('div', 'admpn', h.msg.replace(/ \(trang quản trị\)$/, '')));
        mid.appendChild(el('div', 'admps', when(h.at) + ' · ' + (h.by || '') + (i === 0 ? ' · đang dùng' : ''))); r.appendChild(mid);
        var st = el('div', 'admsw' + (i === 0 ? ' on' : ''), i === 0 ? 'Đang dùng' : 'Quay về'); r.appendChild(st);
        var armed = 0;
        r._ok = function () {
          if (i === 0) return;
          if (Date.now() - armed > 4000) { armed = Date.now(); st.textContent = 'OK lần nữa'; st.classList.add('arm'); setTimeout(function () { if (st.classList.contains('arm')) { st.textContent = 'Quay về'; st.classList.remove('arm'); } }, 4000); return; }
          st.classList.remove('arm'); st.textContent = 'Đang quay về…';
          call('/a/history?kind=' + kind, { sha: h.sha, label: when(h.at) }).then(function (x) {
            if (!x.ok) throw x; UI.toast('Đã quay về bản lúc ' + when(h.at) + '. 1–2 phút nữa mọi máy sẽ thấy.'); back(); push(HistoryTV(kind, call));
          }).then(null, function () { st.textContent = 'Lỗi'; UI.toast('Không quay về được'); });
        };
        box.appendChild(r);
      });
    }).then(null, function () { box.innerHTML = ''; box.appendChild(el('div', 'admps', 'Không tải được lịch sử (kiểm tra mạng, máy chủ quản trị).')); });
    return { name: 'adminhist', el: v };
  }

  /* ---------- Quản trị trên TV: một bài nhạc (kiểu chạy lời, âm lượng, canh lời bằng remote) ---------- */
  function AdminSongTV(songs, i, sha, call) {
    var x = JSON.parse(JSON.stringify(songs[i])), v = UI.view(), idx0 = -1;
    (w.Music && Music.S ? Music.S.all() : []).forEach(function (s2, k) { if (s2.file === x.file) idx0 = k; });
    v.classList.add('scroller'); v.classList.add('stats'); v.classList.add('admtv');
    var top = el('div', 'sthead'); var tt = el('div', 'sttitle');
    tt.appendChild(el('div', 'stt1', x.title)); tt.appendChild(el('div', 'stt2', 'Bài ' + (i + 1) + ' / ' + songs.length + ' · ' + Math.floor((x.dur || 0) / 60) + ':' + ('0' + Math.round((x.dur || 0) % 60)).slice(-2) + ' · ' + (x.lyrics || []).length + ' câu'));
    top.appendChild(tt); v.appendChild(top);
    var row = el('div', 'strow'), L = el('div', 'stcard rowwrap wide'), R = el('div', 'stcard rowwrap');
    L.appendChild(el('div', 'stct', 'Lời chạy trên màn hình'));
    var seg = el('div', 'admsegs');
    [['line', 'Hiện theo câu'], ['word', 'Chạy theo từng chữ'], ['sweep', 'Tô dần cả câu']].forEach(function (m) {
      var b = el('div', 'stsegb f' + ((x.mode || 'line') === m[0] ? ' on' : ''), m[1]);
      b._ok = function () { x.mode = m[0]; [].forEach.call(seg.children, function (q) { q.classList.toggle('on', q === b); }); dirty(); };
      seg.appendChild(b);
    });
    L.appendChild(seg);
    var hasW = (x.lyrics || []).some(function (l) { return l.w; });
    L.appendChild(el('div', 'admps', hasW ? 'Bài này có giờ từng chữ (từ file .ass).' : 'Chưa có giờ từng chữ: “Chạy theo từng chữ” sẽ chia đều chữ trong câu.'));
    L.appendChild(el('div', 'stct gap', 'Âm lượng'));
    var gb = el('div', 'stsegb f' + (x.gain != null ? ' on' : ''), x.gain != null ? 'Cân bằng: Bật (' + (x.gain > 0 ? '+' : '') + x.gain + ' dB)' : 'Cân bằng: chưa đo');
    gb._ok = function () { if (x.gain != null) { x._g = x.gain; delete x.gain; } else if (x._g != null) x.gain = x._g; gb.className = 'stsegb f' + (x.gain != null ? ' on' : ''); gb.textContent = x.gain != null ? 'Cân bằng: Bật (' + x.gain + ' dB)' : 'Cân bằng: Tắt'; dirty(); };
    L.appendChild(gb);
    L.appendChild(el('div', 'stct gap', 'Canh lời theo nhạc'));
    var acts = el('div', 'admsegs');
    acts.appendChild(UI.button('Canh lời bằng remote', 'gold', function () { push(LyricSyncTV(x, songs[i], function () { dirty(); })); }));
    var bSave = UI.button('Lưu lên GitHub', '', function () {
      delete x._g;
      call('/a/music', { sha: sha, op: 'update', song: x }).then(function (r) {
        if (!r.ok) throw r; sha = r.sha; songs[i] = x; UI.toast('Đã lưu. 1–2 phút nữa mọi máy sẽ thấy.'); bSave.classList.add('hidden');
      }).then(null, function (e) { UI.toast('Không lưu được' + (e && e.j && e.j.error ? ': ' + e.j.error : '')); });
    });
    bSave.classList.add('hidden'); acts.appendChild(bSave);
    L.appendChild(acts);
    function dirty() { bSave.classList.remove('hidden'); }
    R.appendChild(el('div', 'stct', 'Trang Nhạc sẽ hiện'));
    var pv = el('div', 'admsong');
    pv.appendChild(el('div', 'mvik', 'GIỚI THIỆU BÀI HÁT'));
    pv.appendChild(el('p', 'mvsp', x.sum || '(chưa có tóm tắt — viết trên trang quản trị ở máy tính)'));
    if (x.ex && x.ex.length) { var q = el('blockquote', 'mvsq'); q.innerHTML = x.ex.map(function (t) { return String(t).replace(/</g, '&lt;'); }).join('<br>'); pv.appendChild(q); }
    R.appendChild(pv);
    var cvs = x.covers || (x.cover ? [x.cover] : []);
    var fl = x.films || [];
    R.appendChild(el('div', 'stct gap', 'Ảnh trên trang Nhạc: ' + (cvs.length ? cvs.length + ' ảnh tải lên' : fl.length ? fl.length + ' phim chọn sẵn' : '10 phim tự chọn theo từ khóa “' + (x.keys || [x.title]).join(', ') + '”')));
    if (cvs.length || fl.length) {
      var strip = el('div', 'admcovs'), mb = (idx0 >= 0 && Music.S.url ? String(Music.S.url(idx0)) : 'music/x').replace(/[^\/]*$/, '');
      (cvs.length ? cvs.map(function (c) { return mb + c; }) : fl.map(function (id) { return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; })).forEach(function (u) { var t = el('div', 'admcov'); t.style.backgroundImage = 'url("' + u + '")'; strip.appendChild(t); });
      R.appendChild(strip);
    }
    R.appendChild(el('div', 'admps', 'Đổi từ khóa, chọn phim, tải ảnh trên trang quản trị ở máy tính / điện thoại.'));
    row.appendChild(L); row.appendChild(R); v.appendChild(row);
    return { name: 'adminsong', el: v };
  }

  /* Canh lời bằng remote: nghe bài, bấm OK đúng lúc mỗi câu bắt đầu */
  function LyricSyncTV(x, orig, onDone) {
    var v = UI.view(); v.classList.add('lsync');
    var Ls = JSON.parse(JSON.stringify(x.lyrics || [])), tapI = -1, cur = -2, raf = 0;
    var idx = -1; (w.Music && Music.S ? Music.S.all() : []).forEach(function (s2, k) { if (s2.file === x.file) idx = k; });
    var au = new Audio(idx >= 0 ? Music.S.url(idx) : 'music/' + encodeURI(x.file)); au.preload = 'auto';
    var head = el('div', 'lshead'); head.appendChild(el('div', 'lst', 'Canh lời: ' + x.title)); var tm = el('div', 'lstm', '0:00'); head.appendChild(tm); v.appendChild(head);
    var bar = el('div', 'lsbar'), fill = el('div', 'lsfill'); bar.appendChild(fill);
    var D = x.dur || 240;
    Ls.forEach(function (l) { var m = el('div', 'lsmk'); m.style.left = (l.at / D * 100) + '%'; bar.appendChild(m); });
    v.appendChild(bar);
    var stage = el('div', 'lsstage'), tg = el('div', 'mvik'), lp = el('div', 'lsl p'), lc = el('div', 'lsl c'), ln = el('div', 'lsl n');
    stage.appendChild(tg); stage.appendChild(lp); stage.appendChild(lc); stage.appendChild(ln); v.appendChild(stage);
    var hint = el('div', 'lshint', 'Bấm ▶ để nghe. Muốn canh lại: bấm “Bắt đầu bấm theo nhạc”, rồi mỗi khi một câu bắt đầu hát thì bấm OK.');
    v.appendChild(hint);
    var ctl = el('div', 'lsctl rowwrap');
    var bPlay = UI.button('▶ Phát', 'gold', function () { if (au.paused) au.play(); else au.pause(); });
    var bTap = UI.button('● Bắt đầu bấm theo nhạc', '', function () {
      if (tapI >= 0) { tapI = -1; paintTap(); return; }
      var k = lineAt(au.currentTime); tapI = k < 0 ? 0 : Math.min(Ls.length - 1, k + 1);
      au.currentTime = Math.max(0, tapI > 0 ? Ls[tapI].at - 3 : 0); au.play(); paintTap(); setTimeout(function () { Nav.focus(bMark); }, 50);
    });
    var bMark = UI.button('Câu này bắt đầu  (OK)', 'gold big', function () { mark(); });
    var bM = UI.button('− 0,1 giây', 'small', function () { nudge(-0.1); });
    var bP = UI.button('+ 0,1 giây', 'small', function () { nudge(0.1); });
    var bAgain = UI.button('Nghe lại câu', 'small', function () { var k = Math.max(0, lineAt(au.currentTime)); au.currentTime = Math.max(0, Ls[k].at - 1); au.play(); });
    var bAll = [UI.button('Cả bài −0,2', 'small', function () { shift(-0.2); }), UI.button('Cả bài +0,2', 'small', function () { shift(0.2); })];
    var bDone = UI.button('Xong', '', function () { leave(true); });
    [bPlay, bTap, bMark, bM, bP, bAgain].concat(bAll).concat([bDone]).forEach(function (b) { ctl.appendChild(b); });
    v.appendChild(ctl);
    bMark.classList.add('hidden');
    function lineAt(t) { var r = -1; for (var k = 0; k < Ls.length; k++) { if (Ls[k].at <= t + 0.05) r = k; else break; } return r; }
    function setAt(k, at) { at = Math.max(0, Math.round(at * 100) / 100); var d0 = at - Ls[k].at; Ls[k].at = at; if (Ls[k].w) Ls[k].w = Ls[k].w.map(function (q) { return [Math.round((q[0] + d0) * 100) / 100, q[1]]; }); bar.children[k + 1].style.left = (at / D * 100) + '%'; cur = -2; }
    function nudge(dd) { var k = tapI >= 0 ? Math.max(0, tapI - 1) : Math.max(0, lineAt(au.currentTime)); setAt(k, Ls[k].at + dd); au.currentTime = Math.max(0, Ls[k].at - 1); au.play(); UI.toast('Câu ' + (k + 1) + ': ' + fmtT(Ls[k].at)); }
    function shift(dd) { Ls.forEach(function (l, k) { setAt(k, l.at + dd); }); UI.toast('Cả bài ' + (dd > 0 ? '+' : '') + dd.toFixed(1).replace('.', ',') + ' giây'); }
    function mark() { if (tapI < 0) return; setAt(tapI, au.currentTime - 0.15); tapI++; if (tapI >= Ls.length) { tapI = -1; UI.toast('Xong ' + Ls.length + ' câu. Nghe lại để kiểm tra.'); } paintTap(); }
    function paintTap() {
      bMark.classList.toggle('hidden', tapI < 0); bTap.setLabel(tapI >= 0 ? '■ Dừng bấm' : '● Bắt đầu bấm theo nhạc');
      hint.textContent = tapI >= 0 ? 'Câu ' + (tapI + 1) + ' / ' + Ls.length + ': “' + Ls[tapI].t + '” — bấm OK đúng lúc câu này bắt đầu hát' : 'Bấm ▶ để nghe. Muốn canh lại: bấm “Bắt đầu bấm theo nhạc”, rồi mỗi khi một câu bắt đầu hát thì bấm OK.';
      hint.classList.toggle('on', tapI >= 0);
    }
    function fmtT(t) { return Math.floor(t / 60) + ':' + ('0' + (t % 60).toFixed(1)).slice(-4).replace('.', ','); }
    function sweep(k, t) {
      var l = Ls[k], b = Ls[k + 1] ? Ls[k + 1].at : l.at + 4;
      if (!x.mode || x.mode === 'line') return 1;
      if (x.mode === 'word' && l.w && l.w.length) { var tot = 0, dn = 0; l.w.forEach(function (q) { tot += q[1].length + 1; }); for (var q = 0; q < l.w.length; q++) { var n = l.w[q][1].length + 1, s0 = l.w[q][0], s1 = l.w[q + 1] ? l.w[q + 1][0] : Math.min(b, s0 + 1.2); if (t >= s1) dn += n; else { if (t > s0) dn += n * (t - s0) / Math.max(0.05, s1 - s0); break; } } return dn / Math.max(1, tot); }
      return Math.max(0, Math.min(1, (t - l.at) / Math.max(0.8, Math.min(b - l.at, 8) - 0.3)));
    }
    function frame() {
      var t = au.currentTime || 0, k = lineAt(t);
      tm.textContent = fmtT(t) + ' / ' + Math.floor(D / 60) + ':' + ('0' + Math.round(D % 60)).slice(-2); fill.style.width = (t / D * 100) + '%';
      if (k !== cur) {
        cur = k; var sct = ''; for (var q = Math.max(0, k); q >= 0; q--) if (Ls[q] && Ls[q].s) { sct = Ls[q].s; break; }
        tg.textContent = k < 0 ? 'NHẠC DẠO' : sct; lp.textContent = Ls[k - 1] ? Ls[k - 1].t : ''; lc.textContent = k >= 0 ? Ls[k].t : (Ls[0] ? '♪ ' + Ls[0].t : ''); ln.textContent = Ls[k + 1] ? Ls[k + 1].t : '';
        lc.classList.toggle('wait', k < 0);
        [].forEach.call(bar.querySelectorAll('.lsmk'), function (m, j) { m.classList.toggle('on', j === k); });
      }
      lc.style.backgroundSize = (k >= 0 ? sweep(k, t) * 100 : 0).toFixed(1) + '% 100%, 100% 100%';
      raf = (w.requestAnimationFrame || setTimeout)(frame, 50);
    }
    frame();
    au.addEventListener('play', function () { bPlay.setLabel('❚❚ Dừng'); });
    au.addEventListener('pause', function () { bPlay.setLabel('▶ Phát'); });
    function leave(keep) {
      (w.cancelAnimationFrame || clearTimeout)(raf); au.pause();
      if (keep) { Ls.sort(function (a, b) { return a.at - b.at; }); if (JSON.stringify(Ls) !== JSON.stringify(x.lyrics)) { x.lyrics = Ls; x.lrcAuto = false; if (onDone) onDone(); } }
      back();
    }
    return { name: 'lyricsync', el: v, onLeave: function () { (w.cancelAnimationFrame || clearTimeout)(raf); au.pause(); } };
  }

  /* ---------- Hướng dẫn sử dụng (có hình) ---------- */

  function Guide() {
    var v = UI.view();
    var h = el('div', 'pagehead', 'Hướng dẫn');
    h.appendChild(el('span', 'rh', 'Bấm mũi tên lên/xuống để xem từng mục'));
    v.appendChild(h);
    var REMOTE = '<svg viewBox="0 0 720 405" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">' +
      '<rect width="720" height="405" rx="18" fill="#151922"/>' +
      '<rect x="50" y="28" width="170" height="350" rx="70" fill="#2A3042" stroke="#3A4258" stroke-width="3"/>' +
      '<circle cx="135" cy="135" r="62" fill="#1B2030"/>' +
      '<path d="M135 83 l14 18 h-28z M135 187 l14 -18 h-28z M83 135 l18 -14 v28z M187 135 l-18 -14 v28z" fill="#E8B04B"/>' +
      '<circle cx="135" cy="135" r="24" fill="#E8B04B"/><text x="135" y="142" text-anchor="middle" font-size="19" font-weight="800" fill="#1a1206">OK</text>' +
      '<circle cx="95" cy="240" r="22" fill="#1B2030"/><path d="M104 232 h-14 m0 0 l6 -6 m-6 6 l6 6 M90 232 q16 0 16 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<circle cx="175" cy="240" r="22" fill="#1B2030"/><path d="M168 230 v20 l15 -10z" fill="#fff"/>' +
      '<circle cx="95" cy="305" r="22" fill="#1B2030"/><path d="M104 297 l-10 8 10 8z M94 297 l-10 8 10 8z" fill="#fff"/>' +
      '<circle cx="175" cy="305" r="22" fill="#1B2030"/><path d="M166 297 l10 8 -10 8z M176 297 l10 8 -10 8z" fill="#fff"/>' +
      '<g font-size="22" fill="#F4F1EC">' +
      '<text x="262" y="72" font-weight="800" fill="#E8B04B">Mũi tên</text><text x="262" y="100">Di chuyển giữa phim, nút, tab</text>' +
      '<text x="262" y="148" font-weight="800" fill="#E8B04B">OK</text><text x="262" y="176">Chọn · Xem phim · Tạm dừng</text>' +
      '<text x="262" y="224" font-weight="800" fill="#E8B04B">Back · Play/Pause</text><text x="262" y="252">Quay lại · Phát/dừng khi xem phim</text>' +
      '<text x="262" y="300" font-weight="800" fill="#E8B04B">Tua lùi · Tua tới</text><text x="262" y="328">Lùi / tới khi đang xem phim</text>' +
      '<text x="262" y="372" font-size="18" fill="#9AA0AE">OK 2 lần nhanh: về Trang chủ · Back 2 lần: thoát</text>' +
      '</g></svg>';
    var SECTIONS = [
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M100 22l9 18 20 3-14 14 3 20-18-9-18 9 3-20-14-14 20-3z" fill="#E8B04B"/><text x="100" y="104" text-anchor="middle" font-size="16" font-weight="800" fill="#F4F1EC" font-family="sans-serif">' + (C.VERSION || '') + '</text></svg>', t: 'Có gì mới (2.25 – 2.29)', l: ['Mới 2.30: Lời nhắn gia đình (trang phim → ✉ Gửi cho…), Cả nhà bình chọn phim khi Xem chung (quét mã QR bằng điện thoại hoặc bấm OK bằng remote), hàng Tiếp tục xem báo số phim có tập mới.','Mới 2.29.1: màn hình Ai đang xem có ô Đồng bộ với Google (TV quét mã QR bằng điện thoại, không cần gõ mật khẩu).','Mới 2.29: Bài hát của ngày trên banner Trang chủ; Đoán tên bài hát (nút ♪ cạnh Câu đố); trang phim gợi ý bài hát hợp phim; hẹn giờ tắt nhạc (nút 🌙 ở trang Nhạc, hoặc Cài đặt); báo cáo tuần có bài cả nhà nghe nhiều nhất.','Trang Nhạc: mỗi bài có tóm tắt và đoạn trích, lời hiện theo câu hoặc chạy theo từng chữ, 10 ảnh phim tổng tài thật hợp với bài (đổi mỗi 8 giây). Bấm vào ảnh phim để mở phim đó.','Âm lượng các bài đều nhau (cả trên iPhone). Tiết kiệm đơn vị YouTube tự động khi cả nhà gần dùng hết hạn mức trong ngày.','Giới hạn giờ xem, Xem chung, tìm bằng giọng nói, câu đố tổng tài, đánh giá phim, gửi phim sang điện thoại, chế độ ngủ, sinh nhật có pháo hoa, báo cáo tuần.','Người quản lý: trang Quản trị (Thông tin → Quản trị) có Kênh và Nhạc: thêm/sửa/tắt kênh, thêm bài, gắn lời, lịch sử thay đổi và hoàn tác.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="74" y="18" width="52" height="52" rx="12" fill="#E8B04B"/><path d="M86 38v-8l7 4 7-10 7 10 7-4v8z" fill="#221206"/><path d="M93 44v18l15-9z" fill="#221206"/><rect x="50" y="88" width="100" height="6" rx="3" fill="#2A3042"/><rect x="50" y="88" width="46" height="6" rx="3" fill="#F5D58E"/></svg>', t: 'Màn hình khởi động', l: ['Mở app: logo vương miện vàng, dòng “Đang lấy phim mới… 3/38 kênh”, thanh tiến độ và số phiên bản đang dùng (ví dụ 2.28.0) ở dưới cùng.','Mạng chậm: bấm OK để vào ngay, phim tiếp tục tải phía sau.','Hiện bao lâu: Cài đặt → Giao diện → Màn hình khởi động: 1, 2, 3 (mặc định), 5, 8 giây.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M84 30v46a12 10 0 1 1-6-8.7V40l48-10v38a12 10 0 1 1-6-8.7V36.4z" fill="#E8B04B"/><g fill="#4FAE8A"><rect x="40" y="70" width="6" height="22" rx="3"/><rect x="50" y="58" width="6" height="34" rx="3"/><rect x="60" y="76" width="6" height="16" rx="3"/></g></svg>', t: 'Nhạc nền Trang chủ', l: ['Nhạc của tôi: 20 bài hát của Ryan Nguyen (Chủ Tịch Giả Nghèo, Tổng Tài Ở Rể, Vợ Yêu Đừng Chạy…) phát ở Trang chủ, lần lượt hoặc trộn bài.', 'Mở phim hay sang trang khác thì nhạc tạm dừng, quay lại Trang chủ phát tiếp đúng chỗ. Ô “♪ tên bài” góc dưới bên phải: bấm để qua bài.', 'Cài đặt → Nhạc nền Trang chủ: Nhạc của tôi (lần lượt / trộn bài), Hòa tấu (5 bản), Tắt; Chọn bài để nghe bài bất kỳ; Âm lượng. Riêng từng hồ sơ.', 'TV lấy nhạc từ GitHub Pages của bạn. Android TV: Cài đặt → Kết nối → Địa chỉ nhạc. Không tải được thì app tự phát 5 bản hòa tấu.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#14161E"/><rect x="10" y="12" width="80" height="45" rx="6" fill="#3A2A14"/><rect x="10" y="64" width="60" height="6" rx="2" fill="#F4F1EC"/><rect x="10" y="76" width="80" height="3" rx="1.5" fill="#33384A"/><rect x="10" y="76" width="34" height="3" rx="1.5" fill="#E8B04B"/><circle cx="50" cy="96" r="10" fill="#E8B04B"/><rect x="104" y="20" width="80" height="5" rx="2" fill="#5A5F6E"/><rect x="104" y="36" width="88" height="9" rx="3" fill="#E8B04B"/><rect x="104" y="54" width="76" height="5" rx="2" fill="#8A8F9E"/><rect x="104" y="66" width="70" height="5" rx="2" fill="#5A5F6E"/></svg>', t: 'Trang Nhạc', l: ['Tab Nhạc: 20 bài hát của Ryan Nguyen. Lúc nhạc dạo, khung lời hiện “Giới thiệu bài hát” (tóm tắt + đoạn trích); điện thoại thì tóm tắt nằm dưới tên bài.','Lời: câu đang hát sáng lên. Tùy bài: hiện cả câu, chạy theo từng chữ (như karaoke) hoặc tô dần cả câu. Lời lệch: nút ⏱ “Chỉnh lời”.','Ảnh: 10 ảnh phim tổng tài thật hợp với bài, đổi mỗi 8 giây, chấm dưới ảnh cho biết đang ở ảnh nào. Bấm vào ảnh (TV: chọn ảnh rồi OK) để hỏi “Xem phim này?”: “Ở lại nghe nhạc”, “Danh sách” (lưu phim xem sau, nhạc vẫn phát) hoặc “Mở phim”.','Kiểu A chia đôi hoặc Kiểu B toàn màn hình kiểu karaoke: nút ⛶. Nút: Trộn bài, Bài trước, Phát/Dừng, Bài kế, Hẹn giờ, ☰ Tất cả bài (tóm tắt và đoạn trích của cả 20 bài; chọn một bài để phát).','Các bài nghe to đều nhau. Tắt: Cài đặt → Cân bằng âm lượng các bài.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M40 92a60 60 0 0 1 120 0" stroke="#2A3042" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M40 92a60 60 0 0 1 96 -48" stroke="#E8B04B" stroke-width="14" fill="none" stroke-linecap="round"/><path d="M100 92 L132 56" stroke="#F4F1EC" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="92" r="8" fill="#F4F1EC"/><text x="100" y="114" text-anchor="middle" font-size="13" font-family="sans-serif" fill="#9AA0AE">7.420 / 10.000</text></svg>', t: 'Tiết kiệm đơn vị YouTube', l: ['YouTube cho mỗi ngày 10.000 đơn vị. Xem phim không tốn; làm mới phim, tìm kiếm thì tốn.', 'Dùng quá 70%: app tự làm mới phim thưa gấp 3. Quá 90%: chỉ hiện phim đã lưu, tạm tắt tìm kiếm tới nửa đêm (giờ California). Phim vẫn xem bình thường.', 'Có máy chủ quản trị thì app tính theo tổng của cả nhà. Xem ở Thông tin → Hạn mức YouTube. Tắt: Cài đặt → Tiết kiệm đơn vị YouTube.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="22" y="20" width="156" height="80" rx="10" fill="#F4F5F8"/><rect x="22" y="20" width="44" height="80" rx="10" fill="#FFFFFF"/><rect x="30" y="32" width="28" height="7" rx="3" fill="#E8B04B"/><rect x="30" y="46" width="28" height="7" rx="3" fill="#C9CDD6"/><rect x="30" y="60" width="28" height="7" rx="3" fill="#C9CDD6"/><rect x="76" y="32" width="90" height="10" rx="4" fill="#1B1F2A"/><rect x="76" y="50" width="90" height="12" rx="4" fill="#FFFFFF"/><rect x="76" y="68" width="90" height="12" rx="4" fill="#FFFFFF"/><circle cx="156" cy="56" r="5" fill="#2B8A3E"/><circle cx="156" cy="74" r="5" fill="#B26B00"/></svg>', t: 'Quản trị Kênh và Nhạc (người quản lý)', l: ['Chỉ hiện khi đồng bộ bằng email quản lý: Thông tin → Quản trị → Mở trang quản trị (máy tính / điện thoại) hoặc màn hình quản trị trên TV.', 'Kênh: bật / tắt, thêm, đổi tên, đổi ảnh, tự lấy mã kênh (ghi trước tốn bao nhiêu đơn vị), kiểm tra kênh “ngủ đông” 60 ngày không ra phim (không tốn đơn vị).', 'Nhạc: thêm bài, gắn lời .lrc / .ass, canh lời theo nhạc (TV: bấm OK đúng lúc mỗi câu bắt đầu), tóm tắt, chọn ảnh phim cho bài, cân bằng âm lượng.', 'Lịch sử thay đổi: xem từng lần sửa, “Quay về bản này” để hoàn tác (TV: OK 2 lần). Lưu xong khoảng 1–2 phút mọi máy thấy.'] },
      { svg: REMOTE, t: 'Remote', l: ['Mũi tên để di chuyển, OK để chọn. Ô đang chọn có viền trắng.', 'Đồng hồ góc trên: Cài đặt → Giao diện → Đồng hồ: 24 giờ hoặc 12 giờ (AM/PM).', 'Bấm OK 2 lần thật nhanh: về Trang chủ từ bất kỳ đâu (kể cả đang xem phim). Tắt được trong Cài đặt → Remote.', 'Back để quay lại trang trước. Ở trang chủ bấm Back 2 lần để thoát app.', 'GIỮ LÂU nút OK (khoảng 1 giây): hỏi xóa phim ở Lịch sử, xóa kênh, xóa hồ sơ.'] },
      { img: 'g_home', t: 'Trang chủ', l: ['Ảnh lớn đầu trang là phim mới nhất. “Xem ngay” để phát, “Chi tiết” để xem thông tin.', 'Các hàng: Tiếp tục xem, Từ kênh yêu thích (mặc định ẩn), Phim mới cập nhật, Đang hot, Đề xuất cho <tên hồ sơ> (theo 2 thể loại người đó hay xem), Top 10 phim trong tuần, Phim lẻ hay, Hoạt hình.', 'Mỗi hồ sơ tự sắp xếp thứ tự các hàng: Cài đặt → Trang chủ → Sắp xếp các hàng.', 'Dòng vàng cạnh “Phim mới cập nhật” cho biết còn bao lâu app tự lấy phim mới.'] },
      { img: 'g_play', t: 'Xem phim', l: ['OK: tạm dừng / phát. Trái / phải: tua 10 giây (bấm liên tục để tua nhanh).', 'Mũi tên lên: chọn các nút −10s, +10s, Danh sách, Bỏ phim, Phụ đề, Hẹn giờ, Chất lượng. Bấm ▲ 2 lần nhanh: bật/tắt phụ đề tiếng Việt.', 'Thanh điều khiển tự ẩn sau 5 giây. Back để thoát phim, app nhớ chỗ đang xem.'] },
      { img: 'g_quality', t: 'Phụ đề và chất lượng', l: ['Nút Phụ đề: bật/tắt phụ đề tiếng Việt (YouTube tự dịch nếu phim chỉ có phụ đề khác).', 'Nút Chất lượng: Tự động, 4K, 1080p, 720p… app đổi kích thước khung phát để YouTube chọn mức tương ứng, mất vài giây mới đổi. YouTube vẫn có thể tự hạ khi mạng yếu hoặc video không có mức đó.', 'Bỏ phim: ẩn phim lỗi. Hiện lại trong Lịch sử hoặc Cài đặt.'] },
      { img: 'g_detail', t: 'Tiếp tục xem', l: ['Phim xem dở có thanh tiến độ và thời gian còn lại.', '“Tiếp tục xem” để xem tiếp, “Xem từ đầu” để xem lại.', '“+ Danh sách” để lưu phim, xem lại trong tab Lịch sử.', '“Bình luận”: đọc bình luận của phim trên YouTube (Hay nhất / Mới nhất). OK để mở rộng bình luận dài. Cần API key, tốn 1 đơn vị hạn mức mỗi lần tải.'] },
      { img: 'g_anime', t: 'Hoạt hình nhiều tập', l: ['Các tập cùng một bộ được gộp thành 1 phim, thẻ phim ghi số tập.', 'Vào phim: “Xem từ tập 1” hoặc chọn tập trong Danh sách tập bên dưới.', 'Xem hết một tập, app tự chuyển sang tập sau. Xem dở thì nút ghi “Tiếp tục xem tập …”.'] },
      { img: 'g_chans', t: 'Kênh', l: ['Tất cả kênh bạn theo dõi. Chữ vàng là kênh có phim mới hôm nay. Kênh yêu thích có ★ và nằm đầu danh sách.', 'Kênh yêu thích (riêng từng hồ sơ): mở một kênh → “☆ Yêu thích”, hoặc trang chi tiết phim → “☆ Thích kênh này”, hoặc Cài đặt → Kênh yêu thích. Phim mới của các kênh này hiện ở hàng “Từ kênh yêu thích” đầu Trang chủ và trong ảnh lớn.', 'OK để xem phim mới nhất của kênh. Kênh hoạt hình ghi “Hoạt hình”, kênh phim lẻ ghi “Phim lẻ hay”.', 'Dấu “?” là kênh chưa tìm được (thường do hết hạn mức), app tự thử lại.'] },
      { img: 'g_cats', t: 'Danh mục và Tìm kiếm', l: ['16 thể loại, mỗi ô dùng ảnh của phim nổi bật trong thể loại đó.', 'Tìm kiếm: chọn chữ trên bàn phím màn hình, không cần gõ dấu.', '“Tìm gần đây”: 5 từ khóa vừa tìm (riêng từng hồ sơ), chọn để tìm lại ngay, khỏi gõ lại. “Xóa lịch sử tìm” để xóa.'] },
      { img: 'g_addch', t: 'Thêm kênh mới', l: ['Cài đặt → Kênh theo dõi → “+ Thêm kênh mới”. Gõ tên kênh (không cần dấu) hoặc @tên-kênh.', 'Chọn “Lưu vào Phim ngắn”, “Lưu vào Phim lẻ hay” hoặc “Lưu vào Hoạt hình”.', 'Mỗi kênh có nút đổi loại: Phim ngắn → Phim lẻ hay → Hoạt hình → Tắt.'] },
      { img: 'g_google', t: 'Đăng nhập Google (đồng bộ nhiều máy)', l: ['Cài đặt → Tài khoản Google → “Đăng nhập Google”.', 'TV: mở google.com/device trên điện thoại, đăng nhập Gmail, nhập mã hiện trên TV. Màn hình TV tự chuyển khi xong.', 'Trình duyệt / iPhone: chọn tài khoản Google trong cửa sổ hiện ra.', 'Lịch sử, phim xem dở, danh sách, phim đã bỏ, cài đặt, kênh bạn thêm giống nhau trên mọi máy cùng Gmail. API key và PLAYER_HOST giữ riêng từng máy.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M60 78a22 22 0 0 1 4-43 30 30 0 0 1 58-2 26 26 0 0 1 8 51z" fill="none" stroke="#E8B04B" stroke-width="6" stroke-linejoin="round"/><path d="M88 62l12-12 12 12M100 50v30" fill="none" stroke="#F4F1EC" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>', t: 'Đồng bộ bằng GitHub (không cần Google)', l: ['Lấy token: github.com → ảnh đại diện → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic).', 'Đặt tên bất kỳ, chọn hạn dùng, CHỈ tick ô “gist”, bấm Generate rồi sao chép token (chỉ hiện một lần).', 'Trong app: Cài đặt → Đồng bộ bằng GitHub → Token GitHub → dán token → OK. Làm lại trên mỗi máy muốn đồng bộ.', 'Dữ liệu nằm trong một Gist riêng tư tên tongtai-sync. Token chỉ lưu trên máy, giữ kín như mật khẩu, đừng gửi cho ai. Mất hoặc lộ token thì xóa nó trong GitHub Settings.', 'GitHub không nhận username và mật khẩu cho việc này, chỉ nhận token.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><circle cx="70" cy="52" r="18" fill="#E8B04B"/><path d="M40 96c0-17 13-28 30-28s30 11 30 28z" fill="#E8B04B"/><circle cx="130" cy="56" r="14" fill="#4FAE8A"/><path d="M106 96c0-14 11-23 24-23s24 9 24 23z" fill="#4FAE8A"/></svg>', t: 'Hồ sơ người xem (Ai đang xem?)', l: ['Mở app sẽ hỏi “Ai đang xem?”. Chọn Guest hoặc hồ sơ của bạn. Đổi hồ sơ bất cứ lúc nào: ô tròn chữ cái góc trên bên phải, hoặc Cài đặt → Hồ sơ người xem.', 'Mỗi hồ sơ có lịch sử xem, phim xem dở, danh sách và 5 từ khóa tìm gần nhất riêng.', '“+ Thêm” để tạo hồ sơ mới (tối đa 8): gõ tên rồi chọn 1 trong 25 hình thú kawaii. Guest tự có hình gấu trúc.', 'Giữ lâu trên một hồ sơ (TV: giữ lâu OK) để mở menu: Đặt / Đổi / Bỏ mã PIN, Đổi hình, Xóa hồ sơ.', 'Bỏ mã PIN khi không cần: menu giữ lâu → 🔓 Bỏ mã PIN, hoặc Cài đặt → Hồ sơ người xem → Mã PIN của hồ sơ này → Bỏ mã PIN. Nhập mã cũ (quên thì dùng mã PIN người lớn).', 'Cài đặt riêng từng hồ sơ: các dòng có hình con thú trong Cài đặt (giao diện, đồng hồ, chủ đề, xem phim, các hàng Trang chủ, lọc lứa tuổi) là của riêng người đang xem; đổi hồ sơ là đổi theo.', 'Mã PIN riêng cho từng hồ sơ: Cài đặt → Hồ sơ người xem → Mã PIN của hồ sơ này. Hồ sơ có 🔒 phải nhập mã mới vào được; mã PIN người lớn mở được mọi hồ sơ.', 'Không muốn bị hỏi mỗi lần mở app: Cài đặt → “Hỏi Ai đang xem? khi mở app” → Tắt.', 'Chủ đề theo mùa và ngày lễ: Cài đặt → Chủ đề. Tự động đổi theo ngày (Tết, Noel, Valentine, Halloween, 4 mùa…), chọn tay một chủ đề, hoặc Tắt. TV chậm thì tắt “Hiệu ứng rơi”.', 'Thống kê xem (Lịch sử → “Thống kê xem”, hoặc Cài đặt → Hồ sơ người xem): số phút xem 7 ngày qua, kênh xem nhiều nhất, so sánh các hồ sơ. Xóa thống kê cần mã PIN.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="40" y="26" width="120" height="68" rx="10" fill="none" stroke="#E8B04B" stroke-width="6"/><path d="M88 46v28l22-14z" fill="#F4F1EC"/><path d="M40 104h120" stroke="#4FAE8A" stroke-width="6" stroke-linecap="round"/></svg>', t: 'Tự phát phim tiếp theo', l: ['Hết phim, màn hình hiện phim/tập tiếp theo và đếm ngược 30 giây rồi tự phát.', '“Phát ngay” để xem luôn, “Hủy” (hoặc Back) để dừng lại. Trái/phải để chọn nút.', 'Phim tiếp theo ưu tiên phim chưa xem, cùng kênh, cùng thể loại. Tắt trong Cài đặt → Xem phim → Tự phát phim tiếp theo.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><circle cx="100" cy="62" r="38" fill="none" stroke="#E8B04B" stroke-width="6"/><path d="M100 40v24l16 10" fill="none" stroke="#F4F1EC" stroke-width="6" stroke-linecap="round"/></svg>', t: 'Hẹn giờ tắt và Đã xem', l: ['Đang xem phim: bấm ▲ để hiện nút, chọn “Hẹn giờ”. Mỗi lần OK đổi: 30 phút → 60 phút → 90 phút → Hết phim này → Tắt.', 'Hết giờ, phim tạm dừng và hiện thông báo; bấm OK để xem tiếp. Còn 1 phút app nhắc trước.', 'Phim xem hết có dấu “✓ Đã xem” và không hiện lại ở Phim mới, Đang hot, Đề xuất (tắt trong Cài đặt → Trang chủ).', 'Trang chi tiết phim: nút “Đánh dấu đã xem” / “Đã xem ✓” để tự đánh dấu hoặc bỏ đánh dấu.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><defs><linearGradient id="gsv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A2A14"/><stop offset="1" stop-color="#0B0B0E"/></linearGradient></defs><rect width="200" height="120" rx="12" fill="url(#gsv)"/><circle cx="60" cy="34" r="12" fill="#E8B04B" opacity=".35"/><circle cx="120" cy="26" r="9" fill="#E8B04B" opacity=".3"/><path d="M0 120V84h18v-14h16v20h14V64h20v56z" fill="#000" opacity=".7"/><rect x="16" y="92" width="26" height="6" rx="2" fill="#E8B04B"/><rect x="16" y="102" width="60" height="7" rx="2" fill="#F4F1EC"/><text x="186" y="104" text-anchor="end" font-size="26" font-weight="300" fill="#F4F1EC" font-family="sans-serif">11:19</text></svg>', t: 'Màn hình chờ', l: ['Để app yên 10 phút: hiện ảnh bìa phim mới chạy chậm, đổi phim mỗi 12 giây, kèm tên phim và đồng hồ lớn, giống Netflix.', 'Bấm phím bất kỳ (hoặc chạm) để quay lại đúng chỗ cũ, phím đó không làm gì khác.', 'Đang chiếu phim thì không hiện. Nhạc nền tạm im. Đồng hồ đổi góc để màn TV không bị in hình.', 'Cài đặt → Giao diện → Màn hình chờ: Tắt / 5 / 10 / 15 / 30 phút, có nút Xem thử.', 'Câu thoại tổng tài: mỗi lần màn hình chờ hiện là một câu mới (250 câu, 5 chủ đề, đi hết mới lặp lại), hiện cùng tên phim. Tắt ở Cài đặt → Câu thoại tổng tài.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><circle cx="100" cy="52" r="30" fill="none" stroke="#2A3042" stroke-width="10"/><path d="M100 22a30 30 0 0 1 26 45" fill="none" stroke="#E8B04B" stroke-width="10" stroke-linecap="round"/><text x="100" y="58" text-anchor="middle" font-size="16" font-weight="800" fill="#F4F1EC" font-family="sans-serif">1 giờ</text><text x="100" y="106" text-anchor="middle" font-size="13" fill="#9AA0AE" font-family="sans-serif">18:00 – 21:00</text></svg>', t: 'Giới hạn giờ xem', l: ['Cài đặt → Hồ sơ người xem → Giới hạn giờ xem (cần mã PIN người lớn). Chọn hồ sơ, đặt số giờ mỗi ngày, cuối tuần, khung giờ được xem, nhắc trước 5 hoặc 10 phút.', 'Sắp hết giờ: góc màn hình nhắc “còn 5 phút”. Hết giờ: phim dừng, hiện màn hình “Hết giờ xem phim hôm nay”. Vẫn nghe nhạc được.', 'Người lớn bấm “Người lớn: thêm giờ”, nhập mã PIN, cho thêm 15 / 30 / 60 phút.', 'Giới hạn đồng bộ qua Google nên áp dụng trên mọi máy của gia đình. Thời gian xem tính theo thống kê xem của hồ sơ.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><circle cx="82" cy="54" r="22" fill="#DDEBFF"/><circle cx="118" cy="54" r="22" fill="#FFE4EE" stroke="#1D2230" stroke-width="4"/><circle cx="134" cy="36" r="9" fill="#E8B04B"/><path d="M130 36l3 3 6-6" stroke="#1a1206" stroke-width="2.5" fill="none"/><rect x="50" y="88" width="100" height="18" rx="9" fill="#E8B04B"/></svg>', t: 'Xem chung', l: ['Ai đang xem? → chọn “Xem chung” → chọn 2 đến 4 người → “Xem chung: …”.', 'Phim, phim xem dở và thời gian xem được ghi cho tất cả. Hàng Đề xuất gợi ý theo sở thích chung.', 'Có giới hạn giờ xem thì người có giới hạn chặt nhất quyết định.', 'Thôi xem chung: chọn lại một hồ sơ trong Ai đang xem?.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><circle cx="100" cy="56" r="26" fill="#E0314B"/><rect x="93" y="40" width="14" height="24" rx="7" fill="#fff"/><path d="M86 58a14 14 0 0 0 28 0M100 72v8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><text x="100" y="106" text-anchor="middle" font-size="13" fill="#F4F1EC" font-family="sans-serif">“tổng tài giả nghèo”</text></svg>', t: 'Tìm bằng giọng nói', l: ['Trang Tìm kiếm có nút micro đỏ (điện thoại, máy tính, Android TV). Bấm rồi nói tên phim, app tự tìm.', 'Android TV: hộp giọng nói của Google hiện ra. Remote có nút Tìm kiếm thì bấm nút đó cũng được.', 'Lần đầu trình duyệt hỏi quyền dùng micro: chọn Cho phép.', 'TV Samsung không cho app dùng micro nên không có nút này.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="18" y="20" width="80" height="12" rx="6" fill="#E8B04B"/><rect x="18" y="42" width="120" height="14" rx="4" fill="#F4F1EC"/><rect x="18" y="66" width="140" height="8" rx="4" fill="#2A3042"/><rect x="18" y="66" width="100" height="8" rx="4" fill="#E8B04B"/><rect x="18" y="86" width="60" height="20" rx="10" fill="#E8B04B"/><circle cx="170" cy="30" r="12" fill="#E0314B"/><text x="170" y="35" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="sans-serif">3</text></svg>', t: 'Xem tiếp và phim mới của kênh yêu thích', l: ['Phim xem dở gần nhất (trong 4 ngày) lên banner Trang chủ: “còn 12 phút”, nút Xem tiếp hoặc Xem từ đầu.', 'Tab Kênh có chấm đỏ: tổng số phim mới của các kênh yêu thích từ lần bạn mở kênh đó gần nhất.', 'Trong trang Kênh, kênh yêu thích có số đỏ và dòng “3 phim mới”. Mở kênh là số được đặt lại.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#2a1f3a"/><text x="20" y="50" font-size="15" font-style="italic" fill="#FBF6EC" font-family="Georgia,serif">“…giữ luôn cả</text><rect x="122" y="56" width="50" height="4" rx="2" fill="#E8B04B"/><rect x="18" y="74" width="40" height="30" rx="7" fill="#151922"/><rect x="62" y="74" width="40" height="30" rx="7" fill="#2B8A3E"/><rect x="106" y="74" width="40" height="30" rx="7" fill="#151922"/><rect x="150" y="74" width="40" height="30" rx="7" fill="#151922"/><text x="82" y="94" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="sans-serif">đời</text></svg>', t: 'Câu đố tổng tài', l: ['Trang chủ có dải “Câu đố tổng tài” (đổi chỗ hoặc tắt trong Cài đặt → Các hàng Trang chủ). Bấm “Chơi ngay”.', 'Mỗi câu che một chữ trong câu thoại; chọn 1 trong 4 chữ bằng mũi tên rồi OK. 15 giây mỗi câu, 10 câu mỗi lượt.', 'Đúng +10 điểm. Điểm cộng vào bảng điểm hôm nay theo hồ sơ; người dẫn đầu hiện ngay trên Trang chủ.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><text x="100" y="58" text-anchor="middle" font-size="40" font-family="sans-serif">❤ 👎</text><text x="100" y="98" text-anchor="middle" font-size="14" fill="#F4F1EC" font-family="sans-serif">Bạn thấy phim này thế nào?</text></svg>', t: 'Đánh giá phim', l: ['Hết phim: phía trên thẻ “Phim tiếp theo” có ❤ Thích / 😐 Bình thường / 👎 Không thích. Bấm ▲ để chọn.', 'Trang chi tiết phim cũng có nút ♡ Thích và 👎 Không thích (bấm lại để bỏ).', 'Đề xuất theo hồ sơ học từ đánh giá: thể loại bạn thích lên trước, phim bạn không thích không hiện lại trong hàng Đề xuất.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="20" y="22" width="76" height="76" rx="8" fill="#fff"/><rect x="30" y="32" width="20" height="20" fill="#111"/><rect x="66" y="32" width="20" height="20" fill="#111"/><rect x="30" y="68" width="20" height="20" fill="#111"/><rect x="58" y="60" width="10" height="10" fill="#111"/><rect x="128" y="20" width="44" height="80" rx="8" fill="#2A3042" stroke="#E8B04B" stroke-width="3"/></svg>', t: 'Gửi phim sang điện thoại', l: ['Đang xem: bấm ▲ hiện nút → “Gửi sang điện thoại”. Phim tạm dừng, TV hiện mã QR.', 'Quét bằng camera điện thoại: phim mở đúng chỗ đang xem, cùng hồ sơ. Không cần đăng nhập.', 'Điện thoại chưa có hồ sơ đó thì app tự tạo hồ sơ cùng tên và hình.', 'Bên cạnh có mã QR thứ hai: mở phim bằng ứng dụng YouTube, đúng chỗ đang xem (để thích, bình luận, đăng ký kênh).'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#14162a"/><text x="100" y="66" text-anchor="middle" font-size="44" font-family="sans-serif">🌙</text><text x="100" y="102" text-anchor="middle" font-size="14" fill="#DCE3FF" font-family="sans-serif">22:00 · Chúc ngủ ngon</text></svg>', t: 'Chế độ ngủ, sinh nhật, báo cáo tuần', l: ['Chế độ ngủ (Cài đặt → Giao diện): tới giờ, màn hình tối dần, âm lượng nhỏ lại, hết phim không tự phát tiếp; 30 giây sau app tắt (TV) hoặc màn hình tối (trình duyệt). Có nút “Xem thêm 15 phút”.', 'Ngày sinh của hồ sơ (Cài đặt → Hồ sơ người xem): hôm đó app chúc mừng, pháo bông, nhạc sinh nhật và thêm 30 phút xem phim nếu có giới hạn.', 'Hồ sơ xem báo cáo tuần (Cài đặt → Hồ sơ người xem, cần PIN): thứ Hai đến thứ Tư, Trang chủ hiện báo cáo tuần trước của cả nhà.', 'Tổng tài của tuần: ảnh lớn đầu Trang chủ là phim cả nhà xem nhiều nhất 7 ngày qua, kèm một câu thoại. Có tập mới: hàng riêng khi phim bộ đang theo dõi ra tập mới.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M100 20l40 15v28c0 22-17 35-40 42-23-7-40-20-40-42V35z" fill="#E8B04B"/><path d="M84 62l11 11 22-24" fill="none" stroke="#221206" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>', t: 'Giữ hồ sơ khi cập nhật hay cài lại', l: ['Cập nhật bản mới (cài đè, cùng địa chỉ web): hồ sơ, hình, mã PIN, lịch sử còn nguyên.', 'Cài lại từ đầu, xóa dữ liệu, đổi máy: sao lưu TRƯỚC. Tốt nhất là đăng nhập Google (hoặc GitHub) trong Cài đặt, cài lại xong đăng nhập lại là đủ mọi hồ sơ.', 'Không có tài khoản: Cài đặt → Xuất mã sao lưu, gửi mã cho chính mình; cài lại xong vào Nhập mã sao lưu.', 'Khôi phục chỉ gộp thêm, không xóa gì. API key phải nhập lại trên máy mới.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="40" y="80" width="18" height="22" rx="3" fill="#E8B04B"/><rect x="66" y="56" width="18" height="46" rx="3" fill="#E8B04B"/><rect x="92" y="66" width="18" height="36" rx="3" fill="#E8B04B"/><rect x="118" y="34" width="18" height="68" rx="3" fill="#E8B04B"/><rect x="144" y="46" width="18" height="56" rx="3" fill="#4FAE8A"/></svg>', t: 'Thống kê xem', l: ['Lịch sử → nút “Thống kê xem” (hoặc Cài đặt → Hồ sơ người xem → Thống kê xem). Chọn 7 ngày hoặc 30 ngày ở góc phải.', 'Tổng, trung bình, hôm nay, phim xem hết (so với 7 ngày trước); biểu đồ theo ngày có đường trung bình, chọn từng cột để xem chi tiết; nhận xét tự động; khung giờ hay xem; 5 kênh xem nhiều nhất.', 'So sánh thời gian xem của tất cả hồ sơ, tiện theo dõi bé xem bao lâu. Chỉ tính lúc phim đang chạy, mỗi thiết bị tính riêng, giữ 35 ngày. Xóa thống kê cần mã PIN.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><g fill="#fff"><circle cx="40" cy="30" r="4"/><circle cx="160" cy="24" r="5"/><circle cx="120" cy="90" r="4"/><circle cx="66" cy="96" r="3"/></g><path d="M30 104h140" stroke="#D7262E" stroke-width="2"/><circle cx="50" cy="104" r="5" fill="#F5C542"/><circle cx="80" cy="104" r="5" fill="#2FA84F"/><circle cx="110" cy="104" r="5" fill="#D7262E"/><circle cx="140" cy="104" r="5" fill="#4FA3FF"/><path d="M100 22l26 52H74z" fill="#2FA84F"/><rect x="95" y="74" width="10" height="12" fill="#8A5A33"/><path d="M100 14l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="#F5C542"/></svg>', t: 'Chủ đề theo mùa và ngày lễ', l: ['Cài đặt → Chủ đề theo mùa và ngày lễ → Chủ đề: Tự động (đổi theo ngày), Tắt, hoặc chọn tay một chủ đề.', '17 chủ đề: Tết, Valentine, Năm mới, Giáng sinh, 8/3, 20/10, 1/6, Ngày của Mẹ, Ngày của Cha, Trung thu, Halloween, Lễ Tạ Ơn, Hoa anh đào, Xuân, Hạ, Thu, Đông. Tết và Trung thu tính theo âm lịch.', 'Có tuyết, hoa, lá, trái tim… rơi; dây đèn nhấp nháy; lồng đèn; hình nhỏ trên logo; lời chúc. TV chạy chậm: tắt “Hiệu ứng rơi”.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M100 18l58 22v28c0 26-24 44-58 52-34-8-58-26-58-52V40z" fill="none" stroke="#E8B04B" stroke-width="6"/><path d="M76 66l16 16 32-32" fill="none" stroke="#4FAE8A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>', t: 'Lọc phim theo lứa tuổi và mã PIN', l: ['Cài đặt → Lọc theo lứa tuổi → “Chỉ hiện phim phù hợp lứa tuổi”: ẩn phim có từ khóa nhạy cảm trong tên hoặc mô tả, ở mọi trang.', '“Từ khóa nhạy cảm”: thêm hoặc xóa từ khóa (gõ không dấu cũng được, “ma tuy” khớp “Ma Túy”).', 'Lọc mặc định TẮT; bật trong Cài đặt khi cần.', 'Mã PIN (mặc định 1234) cần khi: tắt lọc, sửa từ khóa, khôi phục mặc định, xóa thống kê. Trẻ nhỏ không tự tắt được.', 'Đổi mã PIN: Cài đặt → Lọc theo lứa tuổi → Mã PIN. Nhập PIN cũ, rồi PIN mới (4–8 số) hai lần. PIN mới đồng bộ sang các máy đã đăng nhập.', 'Quên PIN: người lớn mở js/config.js, điền PIN_FORCE: ‘1234’, mở lại app một lần, rồi xóa đi.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M60 82a22 22 0 0 1 4-43 30 30 0 0 1 58-2 26 26 0 0 1 8 51z" fill="none" stroke="#E8B04B" stroke-width="6" stroke-linejoin="round"/><path d="M84 64l12 12 22-24" fill="none" stroke="#4FAE8A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>', t: 'Sao lưu tự động hằng tuần', l: ['Đã đăng nhập Google hoặc kết nối GitHub thì app tự sao lưu mỗi tuần và báo “Đã sao lưu lúc…”.', 'Google Drive giữ 4 bản gần nhất (thư mục ẩn của app). GitHub giữ mọi bản trong mục Revisions của Gist tongtai-sync.', 'Cài đặt → Sao lưu tự động hằng tuần: “Sao lưu ngay” hoặc “Khôi phục bản sao lưu” (gộp, không xóa dữ liệu đang có).'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="34" y="20" width="132" height="80" rx="10" fill="#151922" stroke="#2A3042" stroke-width="3"/><path d="M50 40h70M50 56h96M50 72h60M50 88h80" stroke="#9AA0AE" stroke-width="6" stroke-linecap="round"/><path d="M50 56h96" stroke="#FF6B6B" stroke-width="6" stroke-linecap="round"/></svg>', t: 'Nhật ký lỗi và báo lỗi', l: ['Cài đặt → Hỗ trợ → Nhật ký lỗi: 50 dòng gần nhất, lỗi tô màu đỏ.', 'Máy tính / điện thoại: “Sao chép để gửi” rồi dán vào Zalo, Messenger hoặc email.', 'TV: “Sao chép để gửi” hiện mã QR, quét bằng camera điện thoại để lấy nội dung rồi gửi.', 'Thông báo lỗi ghi rõ nguyên nhân và cách xử lý: mất mạng, hết hạn mức, API key sai…'] },
      { img: 'g_key', t: 'Nhập YouTube API key', l: ['Lấy key ở console.cloud.google.com → APIs & Services → Credentials (chuỗi 39 ký tự, giữ kín, đừng gửi cho ai).', 'Trên TV: Cài đặt → Kết nối → “YouTube API key” → OK.', 'Gõ từng ký tự: “Chữ HOA” đổi hoa/thường, “Xóa” xóa 1 ký tự. Xong chọn “Lưu”.', 'Kiểm tra: tab Thông tin → Nguồn dữ liệu ghi “YouTube API: đã kết nối”.'] },
      { img: 'g_host', t: 'Nhập PLAYER_HOST (chỉ Samsung)', l: ['Chỉ TV Samsung cần. Hisense / Android TV bỏ qua bước này.', 'Cài đặt → Kết nối → “PLAYER_HOST (Samsung)” → OK. Đã có sẵn “https://”.', 'Gõ tiếp địa chỉ GitHub Pages của bạn, dạng tên-của-bạn.github.io/tongtai-player/ (dùng phím . / -) rồi “Lưu”.', 'Kiểm tra: tab Thông tin → Trình phát ghi “Qua https://…”. Còn lỗi 153 là địa chỉ chưa đúng.'] },
      { img: 'g_set_update', t: 'Cài đặt: Cập nhật phim mới', l: ['Tự cập nhật phim mới: Bật thì app tự lấy phim mới khi đang mở.', 'Cập nhật mỗi: 1, 2, 3, 6 hoặc 12 giờ. Càng thưa càng tiết kiệm hạn mức.', 'Tạm dừng khi TV để không: không ai bấm remote sau 1, 3 hoặc 6 giờ thì ngừng cập nhật.', 'Số video lấy mỗi kênh: 10, 25 hoặc 50 (gồm hết video mới + video cũ chọn ngẫu nhiên).'] },
      { img: 'g_set_home', t: 'Cài đặt: Trang chủ, danh mục, phim', l: ['Ẩn phim đã xem hết: Bật thì phim xem xong không hiện lại ở Phim mới, Đang hot, Đề xuất, Phim lẻ hay.', 'Sắp xếp các hàng: chọn một hàng, OK để nhấc lên, ▲ ▼ để di chuyển, OK để đặt xuống (điện thoại/máy tính bấm ▲ ▼). Bấm “Xem trước” để xem Trang chủ mới, rồi “Lưu”. Chưa lưu mà quay lại thì app hỏi trước. Riêng từng hồ sơ.', 'Ẩn/Hiện từng hàng, theo đúng thứ tự đã sắp xếp. “Từ kênh yêu thích” mặc định Ẩn.', 'Danh mục ít phim thì tìm thêm trên YouTube: Tắt để tiết kiệm (~100 đơn vị mỗi lần tìm).', 'Phim lẻ dài tối thiểu, Hoạt hình dài tối thiểu, Phim quay dọc Hiện/Ẩn. Đổi xong app tải lại danh sách.'] },
      { img: 'g_set_more', t: 'Cài đặt: Xem phim, kênh, nút cuối trang', l: ['Tự phát phim tiếp theo (Bật/Tắt), Phụ đề tiếng Việt khi mở phim, Chất lượng mặc định.', 'Hồ sơ người xem: đổi hồ sơ, hình đại diện, thống kê, hỏi “Ai đang xem?”. Hỗ trợ: Nhật ký lỗi, Giới thiệu.', 'Kênh theo dõi: “+ Thêm kênh mới”; mỗi kênh đổi Phim ngắn → Phim lẻ hay → Hoạt hình → Tắt.', 'Ước tính hạn mức hiện ngay theo cài đặt bạn chọn.', 'Cập nhật ngay · Hiện lại phim đã bỏ · Khôi phục mặc định (vẫn giữ kênh, API key, PLAYER_HOST).'] },
      { img: 'g_info', t: 'Thông tin, giới thiệu và hạn mức', l: ['Khung “Giới thiệu”: giới thiệu ứng dụng, phiên bản, tác giả, bản quyền và miễn trừ trách nhiệm. Bên dưới: Kho phim, Dành cho cả gia đình, Quyền riêng tư và an toàn, Khuyến cáo nội dung. Nút “Kiểm tra bản mới” so với bản trên GitHub Pages (version.json).', 'Hạn mức YouTube đã dùng hôm nay trên TV này, còn bao lâu làm mới hạn mức.', 'Ước tính theo Cài đặt và còn bao nhiêu phút cập nhật phim mới.', 'Xem phim không tốn hạn mức. Hạn mức làm mới lúc 0 giờ giờ California (3 giờ chiều VN).'] },
      { img: 'g_web', t: 'Xem trên trình duyệt (máy tính, điện thoại)', l: ['Mở địa chỉ bản web (dạng tên-của-bạn.github.io/tongtai-player/app/) bằng Chrome hoặc Safari.', 'Bấm chuột / chạm vào phim để mở. Lăn chuột hoặc vuốt để di chuyển. Phím mũi tên, Enter, Esc cũng dùng được.', 'Xóa phim ở Lịch sử, xóa kênh, xóa hồ sơ: GIỮ LÂU (chạm giữ hoặc giữ chuột) để hiện dấu ✕, rồi bấm ✕. Bấm ra chỗ khác để ẩn.', 'Nút “‹ Quay lại” ở góc dưới bên trái. Khi xem phim: bấm vào video để tạm dừng, bấm các nút để tua.', 'iPhone: giao diện điện thoại riêng, cuộn bằng tay. Safari → nút Chia sẻ → “Thêm vào MH chính” để có biểu tượng như app.', 'Lần đầu: Cài đặt → YouTube API key, dán key (key chỉ lưu trong trình duyệt của bạn).'] },
    ];
    SECTIONS.forEach(function (s) {
      var c = el('div', 'gcard f rowwrap');
      var pic = el('div', 'gpic');
      if (s.svg) pic.innerHTML = s.svg;   // hình vẽ tĩnh của app
      else {
        var im = d.createElement('img');
        im.src = 'img/guide/' + s.img + '.jpg';
        im.alt = s.t;
        pic.appendChild(im);
      }
      c.appendChild(pic);
      var tx = el('div', 'gtext');
      tx.appendChild(el('div', 'gtitle', s.t));
      s.l.forEach(function (t) {
        var r = el('div', 'iline');
        r.appendChild(el('span', 'dot'));
        r.appendChild(el('span', 'itxt', t));
        tx.appendChild(r);
      });
      c.appendChild(tx);
      v.appendChild(c);
    });
    return { name: 'guide', el: v };
  }

  /* ---------- Khởi tạo thanh tab ---------- */

  function init() {
    var po = w.Player.open;
    w.Player.open = function () {   // giới hạn giờ xem: chặn mở phim khi đã hết giờ / ngoài khung giờ
      var st = limNow();
      if (st && st.blocked) { push(LimitLock(st)); return; }
      return po.apply(this, arguments);
    };
    setInterval(limTick, 15000);
    setInterval(sleepTick, 30000); setTimeout(sleepTick, 3000);
    // nút micro / tìm kiếm trên remote Android TV
    w.__voiceKey = function () {
      if (!w.Voice || !w.Voice.available()) return;
      if (w.__voiceKeyHere && w.__voiceKeyHere()) return;
      goTab('search');
      setTimeout(function () { if (w.__voiceKeyHere) w.__voiceKeyHere(); }, 400);
    };
    var box = d.getElementById('tabs');
    TABS.forEach(function (t) {
      var e = el('div', 'tab f', t.name);
      e.dataset.tab = t.id;
      e._ok = function () { goTab(t.id); };
      box.appendChild(e);
      S.tabEls[t.id] = e;
    });
    // Ô hồ sơ người xem (góc trên bên phải): bấm để đổi người xem
    var wb = el('div', 'whobtn f');
    wb.id = 'whobtn';
    wb._ok = function () { push(Who()); };
    var clk = d.getElementById('clock');
    clk.parentNode.insertBefore(wb, clk);
    paintWho();
    Nav.roots = function () {
      var c = current();
      if (c && whoLocked()) return [c.el];   // "Ai đang xem?": không đi lên thanh tab được
      return c ? [d.getElementById('topbar'), c.el] : [d.getElementById('topbar')];
    };
    goTab('home');
    Nav.focus(S.tabEls.home, true);
    setInterval(autoRefresh, 5 * 60e3);
    d.addEventListener('visibilitychange', function () { if (!d.hidden) autoRefresh(); });
  }

  w.Screens = {
    init: init, vote: function () { push(VoteTV()); }, showMsgs: function () { showMsgs(); }, who: function (startup) { push(Who(startup)); }, avatarEl: function (p, cls) { return avatar(p, cls); }, paintWho: function () { paintWho(); }, errorLog: function () { push(ErrorLog()); }, adminTV: function (t, d2) { push(AdminTV(t, d2)); }, askFilm: function (it) { push(AskFilm(it)); }, quiz: function () { push(Quiz()); }, birthday: function (id) { push(Birthday(profileOf(id || Store.profile()) || { id: 'guest', name: 'Guest' }, false)); }, afterBoot: function () { checkBirthday(); }, sleepTick: function () { sleepTick(); }, preN: function () { return preN; }, weekPick: function () { return weekPick(Api.pool()); }, limitList: function () { push(LimitList()); }, limitLock: function () { var st = limNow(); if (st) push(LimitLock(st)); }, limNow: function () { return limNow(); }, chBadge: function () { paintChBadge(); }, push: push, back: back, goTab: goTab, openItem: openItem, autoRefresh: autoRefresh, nextRefresh: nextRefresh, home: home,
    depth: function () { return S.stack.length; },
    current: function () { return current(); }
  };
})(window);
