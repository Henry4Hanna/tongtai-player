/* Các màn hình: Trang chủ, Danh mục, Tìm kiếm, Chi tiết, Lịch sử, Thông tin. */
(function (w) {
  'use strict';
  var d = document;
  var C = w.APP_CONFIG, Store = w.Store, Api = w.Api, UI = w.UI, Nav = w.Nav, Player = w.Player;
  var el = UI.el;

  var TABS = [
    { id: 'home', name: 'Trang chủ' }, { id: 'chans', name: 'Kênh' }, { id: 'cats', name: 'Danh mục' }, { id: 'search', name: 'Tìm kiếm' },
    { id: 'history', name: 'Lịch sử' }, { id: 'guide', name: 'Hướng dẫn' }, { id: 'info', name: 'Thông tin' }, { id: 'settings', name: 'Cài đặt' }
  ];

  var S = { stack: [], tab: 'home', tabEls: {} };

  /* ---------- Quản lý màn hình ---------- */

  function current() { return S.stack[S.stack.length - 1]; }

  function setActiveTab(id) {
    S.tab = id;
    TABS.forEach(function (t) { S.tabEls[t.id].classList.toggle('active', t.id === id); });
  }

  function mount(view) {
    var cur = current();
    if (cur) { cur.focusEl = Nav.cur; cur.el.style.display = 'none'; }
    S.stack.push(view);
    d.getElementById('views').appendChild(view.el);
    Nav.focusFirst();
  }

  function goTab(id) {
    var views = d.getElementById('views');
    views.innerHTML = '';
    S.stack = [];
    if (Nav.cur) Nav.cur.classList.remove('focus');
    Nav.cur = null;
    setActiveTab(id);
    var b = { home: Home, chans: Chans, cats: Cats, search: Search, history: History, guide: Guide, info: Info, settings: SettingsScreen }[id];
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
      favch: UI.row('Từ kênh yêu thích', ''),
      fresh: UI.row('Phim mới cập nhật', 'Từ các kênh bạn theo dõi'),
      hot: UI.row('Đang hot', 'Xem nhiều nhất trong 30 ngày'),
      rec: UI.row('Đề xuất cho bạn'),
      top: weeklyRow(openItem),
      movie: UI.row('Phim lẻ hay', 'Từ ' + (C.MOVIE_CHANNELS || []).length + ' kênh phim lẻ'),
      anime: UI.row('Hoạt hình', 'Từ ' + (C.ANIME_CHANNELS || []).length + ' kênh hoạt hình · AI, 2D, 3D')
    };
    ['cont', 'favch', 'fresh', 'hot', 'movie', 'rec', 'top', 'anime'].forEach(function (k) { if (k !== 'top') rows[k].wrap.classList.add('row-' + k); v.appendChild(rows[k].wrap); });
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
    var on = { cont: C.SHOW_CONT !== false, favch: C.SHOW_FAVCH !== false, fresh: C.SHOW_FRESH !== false, hot: C.SHOW_HOT !== false, movie: C.SHOW_MOVIE !== false, rec: C.SHOW_REC !== false, anime: C.SHOW_ANIME !== false };
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

    var heroFav = false;
    function setHero(item) {
      if (item && Store.isFavCh(item.chId)) heroFav = true;
      hero.innerHTML = '';
      var bg = UI.thumb(item, true);
      bg.className = 'thumb hero-img';
      hero.appendChild(bg);
      hero.appendChild(el('div', 'hero-shade'));
      var box = el('div', 'hero-box');
      var chips = el('div', 'chips');
      chips.appendChild(el('span', 'chip gold', 'Mới cập nhật'));
      if (item.tag) chips.appendChild(el('span', 'chip white', item.tag));
      chips.appendChild(el('span', 'chip', 'Phim lẻ'));
      UI.catChips(chips, item);
      box.appendChild(chips);
      box.appendChild(el('h1', 'hero-title', item.title));
      var meta = [];
      if (item.dur) meta.push(UI.fmtLong(item.dur));
      if (item.views) meta.push(UI.fmtViews(item.views));
      if (item.pub) meta.push(UI.fmtAgo(item.pub));
      box.appendChild(el('div', 'hero-meta', meta.join('  ·  ')));
      box.appendChild(el('div', 'hero-desc', item.desc || ''));
      var btns = el('div', 'btns');
      var b1 = UI.button('Xem ngay', 'gold', function () { playFilm(item); }, UI.ICON_PLAY);
      var b2 = UI.button('Chi tiết', '', function () { openItem(item); });
      btns.appendChild(b1); btns.appendChild(b2);
      box.appendChild(btns);
      hero.appendChild(box);
      if (Nav.cur && Nav.cur.dataset && Nav.cur.dataset.tab === 'home' && current() && current().el === v) Nav.focus(b1, true);
    }

    function fail(r, e) { r.msg(Api.explain(e)); }

    // Phim mới + đang hot: lấy từ các kênh theo dõi (làm mới mỗi giờ, gần như không tốn hạn mức)
    Api.followedFilms().then(function (all) {
      if (!all.length) throw { message: 'Chưa lấy được phim từ các kênh theo dõi' };
      var list = unseen(all);
      rows.fresh.cards(spread(list, 2, 30), function (it, i) { return UI.card(it, cardOpts({ isNew: Date.now() - new Date(it.pub || 0).getTime() < 86400e3 })); });
      if (!heroFav) setHero(list[0]);
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
    var catA = filmCats[dayN % filmCats.length], catB = filmCats[(dayN * 7 + 5) % filmCats.length];
    if (catB === catA) catB = filmCats[(dayN + 1) % filmCats.length];
    rows.rec.wrap.querySelector('.rt').textContent = 'Đề xuất cho bạn';
    rows.rec.wrap.querySelector('.rowhead').appendChild(el('span', 'rh', 'Hôm nay: ' + catA.name + ' · ' + catB.name));
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
          if (first) setHero(first);
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
        rows.rec.cards(unseen(out.slice(0, 16).concat(extra)), function (it) { return UI.card(it, cardOpts({})); });
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
    if (!isAnime) {   // danh sách phát hoạt hình (nhiều tập) không có một video để xem bình luận
      btns.appendChild(UI.button('Bình luận', '', function () { push(Comments(item)); },
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>'));
    }
    info.appendChild(btns);
    top.appendChild(info);
    v.appendChild(top);

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
    var h = el('div', 'pagehead', 'Lịch sử xem · ' + Store.profileName());
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
    ppInfo.appendChild(el('span', '', 'Dòng có hình ' + meP.name + ' là cài đặt RIÊNG của hồ sơ “' + meP.name + '” (giao diện, đồng hồ, chủ đề, xem phim, các hàng Trang chủ, lọc lứa tuổi). Mỗi người chỉnh theo ý mình; đổi hồ sơ là đổi theo. Các dòng khác dùng chung cho cả máy.'));
    wrap.appendChild(ppInfo);
    sec('Giao diện');
    opt('THEME', 'Giao diện Tối / Sáng', 'Tự động = đổi theo chế độ của điện thoại / máy tính',
      [{ v: 'dark', t: 'Tối', on: true }, { v: 'light', t: 'Sáng', on: true }, { v: 'auto', t: 'Tự động', on: true }]);
    opt('BOOT_SECS', 'Màn hình khởi động', 'Hiện logo bao lâu khi mở app. Bấm OK để vào ngay bất cứ lúc nào', [
      { v: 'auto', t: 'Đến khi tải xong', on: true }, { v: 1, t: '1 giây', on: true }, { v: 2, t: '2 giây', on: true }, { v: 3, t: '3 giây', on: true },
      { v: 5, t: '5 giây', on: true }, { v: 8, t: '8 giây', on: true }]);
    opt('CLOCK_12', 'Đồng hồ', 'Kiểu giờ ở góc trên và trong app', [{ v: false, t: '24 giờ (14:05)', on: true }, { v: true, t: '12 giờ (2:05 PM)', on: true }]);

    sec('Hồ sơ người xem');
    row('Đang xem với hồ sơ', 'Mỗi hồ sơ có lịch sử, phim xem dở, danh sách và từ khóa tìm kiếm riêng', function () {
      return { t: Store.profileName() + ' · Đổi', on: true };
    }, function () { push(Who()); });
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
    row('Mã PIN của hồ sơ này', 'Khóa hồ sơ đang xem: chọn hồ sơ này ở “Ai đang xem?” phải nhập mã. Mã PIN người lớn mở được mọi hồ sơ', function () {
      var me = profileOf(Store.profile()) || {}; return me.pinH ? { t: '🔒 Đã đặt · Đổi', on: true } : { t: 'Chưa đặt' };
    }, function (paint) {
      var me = profileOf(Store.profile());
      unlockProfile(me, 'đổi PIN hồ sơ', function () {
        setTimeout(function () {
          push(TextEdit('Mã PIN mới cho ' + me.name + ' (4–8 số)', '', function (p1) {
            p1 = String(p1 || '').trim();
            if (!p1) {
              if (me.pinH) { Store.setProfilePin(me.id, null); UI.toast('Đã bỏ mã PIN của ' + me.name); paint(); }
              return;
            }
            if (!/^\d{4,8}$/.test(p1)) { UI.toast('Mã PIN phải gồm 4 đến 8 chữ số'); return; }
            setTimeout(function () {
              push(TextEdit('Nhập lại mã PIN mới', '', function (p2) {
                if (String(p2 || '').trim() !== p1) { UI.toast('Hai lần nhập không khớp, chưa đặt mã'); return; }
                Store.setProfilePin(me.id, Settings.hashPin(p1)); paint();
                UI.toast('Đã đặt mã PIN cho ' + me.name);
              }, { mask: true, hint: 'Nhập lại đúng mã vừa chọn rồi chọn Lưu.' }));
            }, 30);
          }, { mask: true, hint: me.pinH ? 'Nhập mã mới rồi Lưu. Để TRỐNG rồi Lưu = bỏ mã PIN.' : 'Chọn số bằng mũi tên, OK để nhập, rồi chọn Lưu.' }));
        }, 30);
      });
    });
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

    sec('Chủ đề theo mùa và ngày lễ');
    row('Chủ đề', 'Tự động đổi theo ngày: Tết, Noel, Năm mới, Valentine, 8/3, 20/10, 1/6, Ngày của Mẹ/Cha, Trung thu, Halloween, Lễ Tạ Ơn, hoa anh đào, 4 mùa', function () {
      var m = Settings.get('SEASON'), th = w.Season ? w.Season.current() : null;
      if (m === 'off') return { t: 'Tắt' };
      if (m === 'auto') return { t: 'Tự động · ' + (th ? th.name : 'không có'), on: true };
      return { t: (th ? th.name : m) + ' (chọn tay)', on: true };
    }, function () { push(SeasonPick()); });
    opt('SEASON_FX', 'Hiệu ứng rơi (tuyết, hoa, lá, bóng bay…)', 'Tắt nếu TV chạy chậm. Vẫn giữ dây đèn và hình trên logo', ONOFF);

    sec('Cập nhật phim mới');
    opt('AUTO_REFRESH', 'Tự cập nhật phim mới', 'Lấy video mới từ các kênh theo dõi khi đang mở app', ONOFF);
    opt('REFRESH_HOURS', 'Cập nhật mỗi', 'Càng thưa càng tiết kiệm hạn mức', [1, 2, 3, 6, 12].map(function (h) { return { v: h, t: h + ' giờ' }; }));
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
    row('Xuất mã sao lưu', 'Chép lịch sử, tiến độ, danh sách sang máy khác', function () { return { t: 'Mở' }; }, function () { push(Backup('out')); });
    row('Nhập mã sao lưu', 'Dán mã đã xuất từ máy khác (gộp với dữ liệu trên máy này)', function () { return { t: 'Mở' }; }, function () { push(Backup('in')); });

    sec('Remote');
    opt('OK2_HOME', 'Bấm OK 2 lần liên tục để về Trang chủ', 'Không áp dụng khi đang gõ chữ hoặc ở trang Cài đặt', ONOFF);

    sec('Trang chủ');
    opt('HIDE_WATCHED', 'Ẩn phim đã xem hết', 'Không hiện lại ở Phim mới, Đang hot, Đề xuất, Phim lẻ hay. Nơi khác có dấu “✓ Đã xem”', ONOFF);
    opt('SHOW_CONT', 'Tiếp tục xem', '', SHOWHIDE);
    opt('SHOW_FAVCH', 'Từ kênh yêu thích', 'Hàng phim mới của các kênh hồ sơ đang xem yêu thích', SHOWHIDE);
    opt('SHOW_FRESH', 'Phim mới cập nhật', '', SHOWHIDE);
    opt('SHOW_HOT', 'Đang hot', '', SHOWHIDE);
    opt('SHOW_REC', 'Đề xuất cho bạn', '', SHOWHIDE);
    opt('SHOW_TOP10', 'Top 10 phim trong tuần', 'Hiện ở Trang chủ và trang chi tiết phim', SHOWHIDE);
    opt('SHOW_MOVIE', 'Phim lẻ hay', '', SHOWHIDE);
    opt('SHOW_ANIME', 'Hoạt hình', '', SHOWHIDE);

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
    return { name: 'settings', el: v, refresh: function () { painters.forEach(function (f) { try { f(); } catch (e) { /* bỏ qua */ } }); updEst(); } };
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
  }

  function Who() {
    var v = UI.view();
    v.classList.add('who');
    v.appendChild(el('div', 'whot', 'Ai đang xem?'));
    v.appendChild(el('div', 'whos', 'Mỗi người có lịch sử xem, phim xem dở, danh sách và từ khóa tìm kiếm riêng.'));
    var g = el('div', 'whogrid');
    var mine = null;
    var tv = !!(w.tizen || w.AndroidApp);
    Store.profiles().forEach(function (p) {
      var t = el('div', 'wtile f');
      t.appendChild(avatar(p));
      t.appendChild(el('div', 'wname', (p.pinH ? '🔒 ' : '') + p.name));
      if (p.id === Store.profile()) { t.classList.add('cur'); t.appendChild(el('div', 'wcur', 'Đang xem')); mine = t; }
      t._ok = function () { chooseProfile(p.id); };
      if (p.id !== 'guest') {
        var del = function () {
          unlockProfile(p, 'xóa hồ sơ', function () { setTimeout(delGo, 30); });
        };
        var delGo = function () {
          push(ConfirmDel('Hồ sơ', p.name, function () {
            Store.removeProfile(p.id); paintWho(); UI.toast('Đã xóa hồ sơ ' + p.name);
            setTimeout(function () { back(); push(Who()); }, 30);
          }, 'hồ sơ'));
        };
        t._hold = del;
        if (!tv) {
          var x = el('div', 'cdel', '✕');
          x.title = 'Xóa hồ sơ';
          x.onclick = function (ev) { ev.stopPropagation(); del(); };
          t.appendChild(x);
        }
      }
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
    g.appendChild(add);
    v.appendChild(g);
    var bx = el('div', 'btns center');
    bx.appendChild(UI.button('Đổi hình cho “' + Store.profileName() + '”', 'small', function () {
      var me = Store.profiles().filter(function (x) { return x.id === Store.profile(); })[0];
      push(AvatarPick(me.name, me.av != null ? me.av : freeAvatar(), function (av) {
        Store.setAvatar(me.id, av); paintWho(); UI.toast('Đã đổi hình');
        setTimeout(function () { back(); push(Who()); }, 30);
      }));
    }));
    v.appendChild(bx);
    v.appendChild(el('div', 'whoh', tv ? 'Giữ lâu nút OK trên một hồ sơ để xóa. Hồ sơ có 🔒 cần mã PIN riêng. Guest luôn có sẵn.' : 'Giữ lâu trên hồ sơ để hiện dấu ✕ xóa. Hồ sơ có 🔒 cần mã PIN riêng. Guest luôn có sẵn.'));
    var view = { name: 'who', el: v };
    setTimeout(function () { if (mine && current() === view) Nav.focus(mine); }, 0);
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
    cr.appendChild(el('div', 'ititle', 'Lưu ý bản quyền'));
    ['Ứng dụng không lưu trữ hay tải về video. Mọi phim phát qua trình phát chính thức của YouTube và chỉ những video chủ kênh cho phép nhúng.',
      'Bản quyền phim, hình ảnh, âm nhạc thuộc về chủ kênh và nhà sản xuất gốc. Muốn gỡ phim, hãy liên hệ chủ kênh trên YouTube.',
      'Dùng cho mục đích cá nhân, gia đình, phi thương mại. © 2026 ' + C.AUTHOR + '.'].forEach(function (t) {
      var r = el('div', 'iline'); r.appendChild(el('span', 'dot')); r.appendChild(el('span', 'itxt', t)); cr.appendChild(r);
    });
    ab.appendChild(cr);
    v.appendChild(ab);

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
      qk('Đã dùng hôm nay (TV này)', num(q.units) + ' / 10.000 đơn vị');
      qk('Tìm kiếm · Đọc kênh/video', q.search + ' lần = ' + num(q.search * 100) + ' · ' + q.other + ' lần = ' + num(q.other));
      qk('Hạn mức làm mới sau', hm(q.resetAt - Date.now()) + ' (lúc ' + UI.hhmm(q.resetAt) + ')');
      qk('Ước tính theo Cài đặt', '~' + e.hour + ' đơn vị/giờ · mở 8 tiếng ≈ ' + num(e.day) + '/ngày');
      qk('Cập nhật phim mới', nr.text);
      var sy = Sync.status();
      qk('Khung hình', (w.UI_fitInfo ? w.UI_fitInfo() : '—') + (w.DEVICE && w.DEVICE.size ? ' · màn ' + w.DEVICE.size : ''), '');
      if (sy.loggedIn) qk('Đồng bộ', ((sy.google ? (sy.email || 'Google') : '') + (sy.google && sy.github ? ' + ' : '') + (sy.github ? 'GitHub' : '')) + ' · ' + (sy.error || 'lần cuối ' + (sy.lastSync ? UI.hhmm(sy.lastSync) : '—')), sy.error ? 'bad' : '');
      var bk = Sync.backupStatus ? Sync.backupStatus() : null;
      if (bk && bk.can) qk('Sao lưu hằng tuần', bk.error ? bk.error : bk.at ? 'Đã sao lưu lúc ' + UI.hhmm(bk.at) + ' ngày ' + new Date(bk.at).toLocaleDateString('vi-VN') + (bk.where ? ' · ' + bk.where : '') : 'Chưa sao lưu', bk.error ? 'bad' : '');
      var pct = Math.min(100, q.units / 100);
      fill.style.width = Math.max(1, pct) + '%';
      fill.className = 'qfill' + (pct > 80 || over ? ' bad' : pct > 50 ? ' mid' : '');
      qnote.textContent = 'Chỉ đếm trên TV này. Nếu Samsung và Hisense dùng chung API key thì tổng thật là cộng cả hai. Xem phim không tốn hạn mức.';
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
    panel('Nội dung', '', [
      'Phim ngắn lấy từ YouTube, phát ngay trong ứng dụng.',
      'Phim lẻ chỉ có 1 tập. Phim do AI tạo được gắn nhãn “AI”.',
      'Hoạt hình từ ' + (C.ANIME_CHANNELS || []).length + ' kênh (nhãn AI, 2D, 3D). Phim lẻ hay từ ' + (C.MOVIE_CHANNELS || []).length + ' kênh.',
      'Phim mới từ ' + (C.CHANNELS || []).length + ' kênh bạn theo dõi, tự cập nhật mỗi ' + C.REFRESH_HOURS + ' giờ.'
    ]);
    var p4 = el('div', 'ipanel f rowwrap');
    p4.appendChild(el('div', 'ititle', 'Tác giả và phiên bản'));
    function kv(k, val) {
      var r = el('div', 'kv');
      r.appendChild(el('span', 'k', k));
      r.appendChild(el('span', 'val', val));
      p4.appendChild(r);
    }
    kv('Tác giả', C.AUTHOR);
    kv('Phiên bản', C.VERSION + ' (build ' + C.BUILD + ')');
    kv('Trình phát', Player.playMode ? Player.playMode() : '');
    kv('Màn hình', w.DEVICE ? w.DEVICE.label + (w.DEVICE.size ? ' · ' + w.DEVICE.size : '') : '');
    kv('Nguồn dữ liệu', Api.hasKey() ? 'YouTube API: đã kết nối' : 'Chế độ demo (chưa có API key)');
    grid.appendChild(p4);
    panel('An toàn', 'green', [
      'Chỉ phát video được YouTube cho phép nhúng.',
      'Không cần đăng nhập. Lịch sử xem lưu trên thiết bị, chỉ đồng bộ khi bạn đăng nhập Google/GitHub.',
      'Lọc theo lứa tuổi: ' + (C.AGE_FILTER === true ? 'đang bật, ẩn phim có ' + (C.AGE_WORDS || []).length + ' từ khóa nhạy cảm.' : 'đang tắt.')
    ]);
    panel('Cảnh báo', 'warn', [
      'Một số phim có nội dung 16+ như cãi vã, bạo lực nhẹ, tình cảm.',
      'Hình ảnh và giọng nói trong phim AI không phải người thật. Bản quyền thuộc chủ kênh gốc.'
    ]);
    v.appendChild(grid);
    return { name: 'info', el: v };
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
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M100 22l9 18 20 3-14 14 3 20-18-9-18 9 3-20-14-14 20-3z" fill="#E8B04B"/><text x="100" y="104" text-anchor="middle" font-size="16" font-weight="800" fill="#F4F1EC" font-family="sans-serif">2.17.0</text></svg>', t: 'Có gì mới (2.10 – 2.17)', l: ['Màn hình khởi động vàng kim có tiến độ tải kênh. Hồ sơ người xem với 25 hình thú kawaii.', 'Hẹn giờ tắt, tự phát phim tiếp theo, đánh dấu “Đã xem”, thống kê thời gian xem từng hồ sơ.', 'Lọc phim theo lứa tuổi có mã PIN (đổi được), lịch sử tìm kiếm, chủ đề theo mùa và ngày lễ, kênh yêu thích theo hồ sơ, đồng hồ 12 giờ.', 'Nhật ký lỗi, thông báo lỗi dễ hiểu, sao lưu tự động hằng tuần, nút kiểm tra bản mới. Chi tiết từng mục ở bên dưới.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="74" y="18" width="52" height="52" rx="12" fill="#E8B04B"/><path d="M86 38v-8l7 4 7-10 7 10 7-4v8z" fill="#221206"/><path d="M93 44v18l15-9z" fill="#221206"/><rect x="50" y="88" width="100" height="6" rx="3" fill="#2A3042"/><rect x="50" y="88" width="46" height="6" rx="3" fill="#F5D58E"/></svg>', t: 'Màn hình khởi động', l: ['Mở app: logo vương miện vàng, dòng “Đang lấy phim mới… 3/38 kênh” và thanh tiến độ cho biết app đang tải phim từ bao nhiêu kênh.', 'Mạng chậm: bấm OK để vào ngay, phim tiếp tục tải phía sau.', 'Hiện bao lâu: Cài đặt → Giao diện → Màn hình khởi động: 1, 2, 3 (mặc định), 5, 8 giây, hoặc “Đến khi tải xong”.', 'Dịp lễ: dòng chữ dưới logo đổi thành lời chúc (ví dụ “Giáng Sinh An Lành”).'] },
      { svg: REMOTE, t: 'Remote', l: ['Mũi tên để di chuyển, OK để chọn. Ô đang chọn có viền trắng.', 'Đồng hồ góc trên: Cài đặt → Giao diện → Đồng hồ: 24 giờ hoặc 12 giờ (AM/PM).', 'Bấm OK 2 lần thật nhanh: về Trang chủ từ bất kỳ đâu (kể cả đang xem phim). Tắt được trong Cài đặt → Remote.', 'Back để quay lại trang trước. Ở trang chủ bấm Back 2 lần để thoát app.', 'GIỮ LÂU nút OK (khoảng 1 giây): hỏi xóa phim ở Lịch sử, xóa kênh, xóa hồ sơ.'] },
      { img: 'g_home', t: 'Trang chủ', l: ['Ảnh lớn đầu trang là phim mới nhất. “Xem ngay” để phát, “Chi tiết” để xem thông tin.', 'Các hàng: Tiếp tục xem, Phim mới cập nhật, Đang hot, Phim lẻ hay, Đề xuất (2 danh mục mỗi ngày), Top 10 phim trong tuần, Hoạt hình.', 'Dòng vàng cạnh “Phim mới cập nhật” cho biết còn bao lâu app tự lấy phim mới.'] },
      { img: 'g_play', t: 'Xem phim', l: ['OK: tạm dừng / phát. Trái / phải: tua 10 giây (bấm liên tục để tua nhanh).', 'Mũi tên lên: chọn các nút −10s, +10s, Danh sách, Bỏ phim, Phụ đề, Hẹn giờ, Chất lượng. Bấm ▲ 2 lần nhanh: bật/tắt phụ đề tiếng Việt.', 'Thanh điều khiển tự ẩn sau 5 giây. Back để thoát phim, app nhớ chỗ đang xem.'] },
      { img: 'g_quality', t: 'Phụ đề và chất lượng', l: ['Nút Phụ đề: bật/tắt phụ đề tiếng Việt (YouTube tự dịch nếu phim chỉ có phụ đề khác).', 'Nút Chất lượng: Tự động, 4K, 1080p, 720p… app đổi kích thước khung phát để YouTube chọn mức tương ứng, mất vài giây mới đổi. YouTube vẫn có thể tự hạ khi mạng yếu hoặc video không có mức đó.', 'Bỏ phim: ẩn phim lỗi. Hiện lại trong Lịch sử hoặc Cài đặt.'] },
      { img: 'g_detail', t: 'Tiếp tục xem', l: ['Phim xem dở có thanh tiến độ và thời gian còn lại.', '“Tiếp tục xem” để xem tiếp, “Xem từ đầu” để xem lại.', '“+ Danh sách” để lưu phim, xem lại trong tab Lịch sử.', '“Bình luận”: đọc bình luận của phim trên YouTube (Hay nhất / Mới nhất). OK để mở rộng bình luận dài. Cần API key, tốn 1 đơn vị hạn mức mỗi lần tải.'] },
      { img: 'g_anime', t: 'Hoạt hình nhiều tập', l: ['Các tập cùng một bộ được gộp thành 1 phim, thẻ phim ghi số tập.', 'Vào phim: “Xem từ tập 1” hoặc chọn tập trong Danh sách tập bên dưới.', 'Xem hết một tập, app tự chuyển sang tập sau. Xem dở thì nút ghi “Tiếp tục xem tập …”.'] },
      { img: 'g_chans', t: 'Kênh', l: ['Tất cả kênh bạn theo dõi. Chữ vàng là kênh có phim mới hôm nay. Kênh yêu thích có ★ và nằm đầu danh sách.', 'Kênh yêu thích (riêng từng hồ sơ): mở một kênh → “☆ Yêu thích”, hoặc trang chi tiết phim → “☆ Thích kênh này”, hoặc Cài đặt → Kênh yêu thích. Phim mới của các kênh này hiện ở hàng “Từ kênh yêu thích” đầu Trang chủ và trong ảnh lớn.', 'OK để xem phim mới nhất của kênh. Kênh hoạt hình ghi “Hoạt hình”, kênh phim lẻ ghi “Phim lẻ hay”.', 'Dấu “?” là kênh chưa tìm được (thường do hết hạn mức), app tự thử lại.'] },
      { img: 'g_cats', t: 'Danh mục và Tìm kiếm', l: ['16 thể loại, mỗi ô dùng ảnh của phim nổi bật trong thể loại đó.', 'Tìm kiếm: chọn chữ trên bàn phím màn hình, không cần gõ dấu.', '“Tìm gần đây”: 5 từ khóa vừa tìm (riêng từng hồ sơ), chọn để tìm lại ngay, khỏi gõ lại. “Xóa lịch sử tìm” để xóa.'] },
      { img: 'g_addch', t: 'Thêm kênh mới', l: ['Cài đặt → Kênh theo dõi → “+ Thêm kênh mới”. Gõ tên kênh (không cần dấu) hoặc @tên-kênh.', 'Chọn “Lưu vào Phim ngắn”, “Lưu vào Phim lẻ hay” hoặc “Lưu vào Hoạt hình”.', 'Mỗi kênh có nút đổi loại: Phim ngắn → Phim lẻ hay → Hoạt hình → Tắt.'] },
      { img: 'g_google', t: 'Đăng nhập Google (đồng bộ nhiều máy)', l: ['Cài đặt → Tài khoản Google → “Đăng nhập Google”.', 'TV: mở google.com/device trên điện thoại, đăng nhập Gmail, nhập mã hiện trên TV. Màn hình TV tự chuyển khi xong.', 'Trình duyệt / iPhone: chọn tài khoản Google trong cửa sổ hiện ra.', 'Lịch sử, phim xem dở, danh sách, phim đã bỏ, cài đặt, kênh bạn thêm giống nhau trên mọi máy cùng Gmail. API key và PLAYER_HOST giữ riêng từng máy.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M60 78a22 22 0 0 1 4-43 30 30 0 0 1 58-2 26 26 0 0 1 8 51z" fill="none" stroke="#E8B04B" stroke-width="6" stroke-linejoin="round"/><path d="M88 62l12-12 12 12M100 50v30" fill="none" stroke="#F4F1EC" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>', t: 'Đồng bộ bằng GitHub (không cần Google)', l: ['Lấy token: github.com → ảnh đại diện → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic).', 'Đặt tên bất kỳ, chọn hạn dùng, CHỈ tick ô “gist”, bấm Generate rồi sao chép token (chỉ hiện một lần).', 'Trong app: Cài đặt → Đồng bộ bằng GitHub → Token GitHub → dán token → OK. Làm lại trên mỗi máy muốn đồng bộ.', 'Dữ liệu nằm trong một Gist riêng tư tên tongtai-sync. Token chỉ lưu trên máy, giữ kín như mật khẩu, đừng gửi cho ai. Mất hoặc lộ token thì xóa nó trong GitHub Settings.', 'GitHub không nhận username và mật khẩu cho việc này, chỉ nhận token.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><circle cx="70" cy="52" r="18" fill="#E8B04B"/><path d="M40 96c0-17 13-28 30-28s30 11 30 28z" fill="#E8B04B"/><circle cx="130" cy="56" r="14" fill="#4FAE8A"/><path d="M106 96c0-14 11-23 24-23s24 9 24 23z" fill="#4FAE8A"/></svg>', t: 'Hồ sơ người xem (Ai đang xem?)', l: ['Mở app sẽ hỏi “Ai đang xem?”. Chọn Guest hoặc hồ sơ của bạn. Đổi hồ sơ bất cứ lúc nào: ô tròn chữ cái góc trên bên phải, hoặc Cài đặt → Hồ sơ người xem.', 'Mỗi hồ sơ có lịch sử xem, phim xem dở, danh sách và 5 từ khóa tìm gần nhất riêng.', '“+ Thêm” để tạo hồ sơ mới (tối đa 8): gõ tên rồi chọn 1 trong 25 hình thú kawaii. Nút “Đổi hình” để đổi hình cho hồ sơ đang xem (Guest cũng đổi được). Xóa hồ sơ: giữ lâu nút OK trên hồ sơ đó (điện thoại, máy tính: giữ lâu để hiện dấu ✕ rồi bấm ✕).', 'Cài đặt riêng từng hồ sơ: các dòng có hình con thú trong Cài đặt (giao diện, đồng hồ, chủ đề, xem phim, các hàng Trang chủ, lọc lứa tuổi) là của riêng người đang xem; đổi hồ sơ là đổi theo.', 'Mã PIN riêng cho từng hồ sơ: Cài đặt → Hồ sơ người xem → Mã PIN của hồ sơ này. Hồ sơ có 🔒 phải nhập mã mới vào được; mã PIN người lớn mở được mọi hồ sơ.', 'Không muốn bị hỏi mỗi lần mở app: Cài đặt → “Hỏi Ai đang xem? khi mở app” → Tắt.', 'Chủ đề theo mùa và ngày lễ: Cài đặt → Chủ đề. Tự động đổi theo ngày (Tết, Noel, Valentine, Halloween, 4 mùa…), chọn tay một chủ đề, hoặc Tắt. TV chậm thì tắt “Hiệu ứng rơi”.', 'Thống kê xem (Lịch sử → “Thống kê xem”, hoặc Cài đặt → Hồ sơ người xem): số phút xem 7 ngày qua, kênh xem nhiều nhất, so sánh các hồ sơ. Xóa thống kê cần mã PIN.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="40" y="26" width="120" height="68" rx="10" fill="none" stroke="#E8B04B" stroke-width="6"/><path d="M88 46v28l22-14z" fill="#F4F1EC"/><path d="M40 104h120" stroke="#4FAE8A" stroke-width="6" stroke-linecap="round"/></svg>', t: 'Tự phát phim tiếp theo', l: ['Hết phim, màn hình hiện phim/tập tiếp theo và đếm ngược 30 giây rồi tự phát.', '“Phát ngay” để xem luôn, “Hủy” (hoặc Back) để dừng lại. Trái/phải để chọn nút.', 'Phim tiếp theo ưu tiên phim chưa xem, cùng kênh, cùng thể loại. Tắt trong Cài đặt → Xem phim → Tự phát phim tiếp theo.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><circle cx="100" cy="62" r="38" fill="none" stroke="#E8B04B" stroke-width="6"/><path d="M100 40v24l16 10" fill="none" stroke="#F4F1EC" stroke-width="6" stroke-linecap="round"/></svg>', t: 'Hẹn giờ tắt và Đã xem', l: ['Đang xem phim: bấm ▲ để hiện nút, chọn “Hẹn giờ”. Mỗi lần OK đổi: 30 phút → 60 phút → 90 phút → Hết phim này → Tắt.', 'Hết giờ, phim tạm dừng và hiện thông báo; bấm OK để xem tiếp. Còn 1 phút app nhắc trước.', 'Phim xem hết có dấu “✓ Đã xem” và không hiện lại ở Phim mới, Đang hot, Đề xuất (tắt trong Cài đặt → Trang chủ).', 'Trang chi tiết phim: nút “Đánh dấu đã xem” / “Đã xem ✓” để tự đánh dấu hoặc bỏ đánh dấu.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="40" y="80" width="18" height="22" rx="3" fill="#E8B04B"/><rect x="66" y="56" width="18" height="46" rx="3" fill="#E8B04B"/><rect x="92" y="66" width="18" height="36" rx="3" fill="#E8B04B"/><rect x="118" y="34" width="18" height="68" rx="3" fill="#E8B04B"/><rect x="144" y="46" width="18" height="56" rx="3" fill="#4FAE8A"/></svg>', t: 'Thống kê xem', l: ['Lịch sử → nút “Thống kê xem” (hoặc Cài đặt → Hồ sơ người xem → Thống kê xem). Chọn 7 ngày hoặc 30 ngày ở góc phải.', 'Tổng, trung bình, hôm nay, phim xem hết (so với 7 ngày trước); biểu đồ theo ngày có đường trung bình, chọn từng cột để xem chi tiết; nhận xét tự động; khung giờ hay xem; 5 kênh xem nhiều nhất.', 'So sánh thời gian xem của tất cả hồ sơ, tiện theo dõi bé xem bao lâu. Chỉ tính lúc phim đang chạy, mỗi thiết bị tính riêng, giữ 35 ngày. Xóa thống kê cần mã PIN.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><g fill="#fff"><circle cx="40" cy="30" r="4"/><circle cx="160" cy="24" r="5"/><circle cx="120" cy="90" r="4"/><circle cx="66" cy="96" r="3"/></g><path d="M30 104h140" stroke="#D7262E" stroke-width="2"/><circle cx="50" cy="104" r="5" fill="#F5C542"/><circle cx="80" cy="104" r="5" fill="#2FA84F"/><circle cx="110" cy="104" r="5" fill="#D7262E"/><circle cx="140" cy="104" r="5" fill="#4FA3FF"/><path d="M100 22l26 52H74z" fill="#2FA84F"/><rect x="95" y="74" width="10" height="12" fill="#8A5A33"/><path d="M100 14l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="#F5C542"/></svg>', t: 'Chủ đề theo mùa và ngày lễ', l: ['Cài đặt → Chủ đề theo mùa và ngày lễ → Chủ đề: Tự động (đổi theo ngày), Tắt, hoặc chọn tay một chủ đề.', '17 chủ đề: Tết, Valentine, Năm mới, Giáng sinh, 8/3, 20/10, 1/6, Ngày của Mẹ, Ngày của Cha, Trung thu, Halloween, Lễ Tạ Ơn, Hoa anh đào, Xuân, Hạ, Thu, Đông. Tết và Trung thu tính theo âm lịch.', 'Có tuyết, hoa, lá, trái tim… rơi; dây đèn nhấp nháy; lồng đèn; hình nhỏ trên logo; lời chúc. TV chạy chậm: tắt “Hiệu ứng rơi”.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M100 18l58 22v28c0 26-24 44-58 52-34-8-58-26-58-52V40z" fill="none" stroke="#E8B04B" stroke-width="6"/><path d="M76 66l16 16 32-32" fill="none" stroke="#4FAE8A" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>', t: 'Lọc phim theo lứa tuổi và mã PIN', l: ['Cài đặt → Lọc theo lứa tuổi → “Chỉ hiện phim phù hợp lứa tuổi”: ẩn phim có từ khóa nhạy cảm trong tên hoặc mô tả, ở mọi trang.', '“Từ khóa nhạy cảm”: thêm hoặc xóa từ khóa (gõ không dấu cũng được, “ma tuy” khớp “Ma Túy”).', 'Lọc mặc định TẮT; bật trong Cài đặt khi cần.', 'Mã PIN (mặc định 1234) cần khi: tắt lọc, sửa từ khóa, khôi phục mặc định, xóa thống kê. Trẻ nhỏ không tự tắt được.', 'Đổi mã PIN: Cài đặt → Lọc theo lứa tuổi → Mã PIN. Nhập PIN cũ, rồi PIN mới (4–8 số) hai lần. PIN mới đồng bộ sang các máy đã đăng nhập.', 'Quên PIN: người lớn mở js/config.js, điền PIN_FORCE: ‘1234’, mở lại app một lần, rồi xóa đi.'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><path d="M60 82a22 22 0 0 1 4-43 30 30 0 0 1 58-2 26 26 0 0 1 8 51z" fill="none" stroke="#E8B04B" stroke-width="6" stroke-linejoin="round"/><path d="M84 64l12 12 22-24" fill="none" stroke="#4FAE8A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>', t: 'Sao lưu tự động hằng tuần', l: ['Đã đăng nhập Google hoặc kết nối GitHub thì app tự sao lưu mỗi tuần và báo “Đã sao lưu lúc…”.', 'Google Drive giữ 4 bản gần nhất (thư mục ẩn của app). GitHub giữ mọi bản trong mục Revisions của Gist tongtai-sync.', 'Cài đặt → Sao lưu tự động hằng tuần: “Sao lưu ngay” hoặc “Khôi phục bản sao lưu” (gộp, không xóa dữ liệu đang có).'] },
      { svg: '<svg viewBox="0 0 200 120" width="100%" height="100%"><rect width="200" height="120" rx="12" fill="#1D2230"/><rect x="34" y="20" width="132" height="80" rx="10" fill="#151922" stroke="#2A3042" stroke-width="3"/><path d="M50 40h70M50 56h96M50 72h60M50 88h80" stroke="#9AA0AE" stroke-width="6" stroke-linecap="round"/><path d="M50 56h96" stroke="#FF6B6B" stroke-width="6" stroke-linecap="round"/></svg>', t: 'Nhật ký lỗi và báo lỗi', l: ['Cài đặt → Hỗ trợ → Nhật ký lỗi: 50 dòng gần nhất, lỗi tô màu đỏ.', 'Máy tính / điện thoại: “Sao chép để gửi” rồi dán vào Zalo, Messenger hoặc email.', 'TV: “Sao chép để gửi” hiện mã QR, quét bằng camera điện thoại để lấy nội dung rồi gửi.', 'Thông báo lỗi ghi rõ nguyên nhân và cách xử lý: mất mạng, hết hạn mức, API key sai…'] },
      { img: 'g_key', t: 'Nhập YouTube API key', l: ['Lấy key ở console.cloud.google.com → APIs & Services → Credentials (chuỗi 39 ký tự, giữ kín, đừng gửi cho ai).', 'Trên TV: Cài đặt → Kết nối → “YouTube API key” → OK.', 'Gõ từng ký tự: “Chữ HOA” đổi hoa/thường, “Xóa” xóa 1 ký tự. Xong chọn “Lưu”.', 'Kiểm tra: tab Thông tin → Nguồn dữ liệu ghi “YouTube API: đã kết nối”.'] },
      { img: 'g_host', t: 'Nhập PLAYER_HOST (chỉ Samsung)', l: ['Chỉ TV Samsung cần. Hisense / Android TV bỏ qua bước này.', 'Cài đặt → Kết nối → “PLAYER_HOST (Samsung)” → OK. Đã có sẵn “https://”.', 'Gõ tiếp địa chỉ GitHub Pages của bạn, dạng tên-của-bạn.github.io/tongtai-player/ (dùng phím . / -) rồi “Lưu”.', 'Kiểm tra: tab Thông tin → Trình phát ghi “Qua https://…”. Còn lỗi 153 là địa chỉ chưa đúng.'] },
      { img: 'g_set_update', t: 'Cài đặt: Cập nhật phim mới', l: ['Tự cập nhật phim mới: Bật thì app tự lấy phim mới khi đang mở.', 'Cập nhật mỗi: 1, 2, 3, 6 hoặc 12 giờ. Càng thưa càng tiết kiệm hạn mức.', 'Tạm dừng khi TV để không: không ai bấm remote sau 1, 3 hoặc 6 giờ thì ngừng cập nhật.', 'Số video lấy mỗi kênh: 10, 25 hoặc 50 (gồm hết video mới + video cũ chọn ngẫu nhiên).'] },
      { img: 'g_set_home', t: 'Cài đặt: Trang chủ, danh mục, phim', l: ['Ẩn phim đã xem hết: Bật thì phim xem xong không hiện lại ở Phim mới, Đang hot, Đề xuất, Phim lẻ hay.', 'Ẩn/Hiện từng hàng: Tiếp tục xem, Phim mới cập nhật, Đang hot, Phim lẻ hay, Đề xuất, Top 10 phim trong tuần, Hoạt hình.', 'Danh mục ít phim thì tìm thêm trên YouTube: Tắt để tiết kiệm (~100 đơn vị mỗi lần tìm).', 'Phim lẻ dài tối thiểu, Hoạt hình dài tối thiểu, Phim quay dọc Hiện/Ẩn. Đổi xong app tải lại danh sách.'] },
      { img: 'g_set_more', t: 'Cài đặt: Xem phim, kênh, nút cuối trang', l: ['Tự phát phim tiếp theo (Bật/Tắt), Phụ đề tiếng Việt khi mở phim, Chất lượng mặc định.', 'Hồ sơ người xem: đổi hồ sơ, hình đại diện, thống kê, hỏi “Ai đang xem?”. Hỗ trợ: Nhật ký lỗi, Giới thiệu.', 'Kênh theo dõi: “+ Thêm kênh mới”; mỗi kênh đổi Phim ngắn → Phim lẻ hay → Hoạt hình → Tắt.', 'Ước tính hạn mức hiện ngay theo cài đặt bạn chọn.', 'Cập nhật ngay · Hiện lại phim đã bỏ · Khôi phục mặc định (vẫn giữ kênh, API key, PLAYER_HOST).'] },
      { img: 'g_info', t: 'Thông tin, giới thiệu và hạn mức', l: ['Khung “Giới thiệu”: phiên bản, tác giả, lưu ý bản quyền. Nút “Kiểm tra bản mới” so với bản trên GitHub Pages (version.json).', 'Hạn mức YouTube đã dùng hôm nay trên TV này, còn bao lâu làm mới hạn mức.', 'Ước tính theo Cài đặt và còn bao nhiêu phút cập nhật phim mới.', 'Xem phim không tốn hạn mức. Hạn mức làm mới lúc 0 giờ giờ California (3 giờ chiều VN).'] },
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
      return c ? [d.getElementById('topbar'), c.el] : [d.getElementById('topbar')];
    };
    goTab('home');
    Nav.focus(S.tabEls.home, true);
    setInterval(autoRefresh, 5 * 60e3);
    d.addEventListener('visibilitychange', function () { if (!d.hidden) autoRefresh(); });
  }

  w.Screens = {
    init: init, who: function () { push(Who()); }, avatarEl: function (p, cls) { return avatar(p, cls); }, paintWho: function () { paintWho(); }, errorLog: function () { push(ErrorLog()); }, back: back, goTab: goTab, openItem: openItem, autoRefresh: autoRefresh, nextRefresh: nextRefresh, home: home,
    depth: function () { return S.stack.length; },
    current: function () { return current(); }
  };
})(window);
