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
    Player.open({ items: [item], index: 0, heading: item.title, key: 'v:' + item.id, series: item, fromStart: fromStart, onClose: afterPlayer });
  }

  function openItem(item) { push(Detail(item)); }

  function progressOf(id) {
    var p = Store.getProgress(id);
    return p && p.d ? p : null;
  }
  function canResume(p) { return !!(p && p.p > 15 && p.p < p.d - 20); }

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

  /* ---------- Trang chủ ---------- */

  function Home() {
    lastLoad = Date.now();
    var v = UI.view();
    var hero = el('div', 'hero rowwrap');
    v.appendChild(hero);
    hero.appendChild(el('div', 'hero-load', 'Đang tải phim…'));

    var rows = {
      cont: UI.row('Tiếp tục xem'),
      fresh: UI.row('Phim mới cập nhật', 'Từ các kênh bạn theo dõi'),
      hot: UI.row('Đang hot', 'Xem nhiều nhất trong 30 ngày'),
      rec: UI.row('Đề xuất cho bạn'),
      movie: UI.row('Phim lẻ hay', 'Từ ' + (C.MOVIE_CHANNELS || []).length + ' kênh phim lẻ'),
      anime: UI.row('Hoạt hình', 'Từ ' + (C.ANIME_CHANNELS || []).length + ' kênh hoạt hình · AI, 2D, 3D')
    };
    ['cont', 'fresh', 'hot', 'movie', 'rec', 'anime'].forEach(function (k) { rows[k].wrap.classList.add('row-' + k); v.appendChild(rows[k].wrap); });
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
    var on = { cont: C.SHOW_CONT !== false, fresh: C.SHOW_FRESH !== false, hot: C.SHOW_HOT !== false, movie: C.SHOW_MOVIE !== false, rec: C.SHOW_REC !== false, anime: C.SHOW_ANIME !== false };
    Object.keys(on).forEach(function (k) { if (!on[k]) rows[k].hide(); });

    function renderCont() {
      var list = Store.recent().filter(function (r) {
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

    function setHero(item) {
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
    Api.followedFilms().then(function (list) {
      if (!list.length) throw { message: 'Chưa lấy được phim từ các kênh theo dõi' };
      rows.fresh.cards(spread(list, 2, 30), function (it, i) { return UI.card(it, cardOpts({ isNew: Date.now() - new Date(it.pub || 0).getTime() < 86400e3 })); });
      setHero(list[0]);
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
        rows.rec.cards(out.slice(0, 16).concat(extra), function (it) { return UI.card(it, cardOpts({})); });
      });
    }).catch(function (e) { fail(rows.rec, e); });

    // Phim lẻ hay: từ các kênh phim lẻ, xem nhiều trước
    if (on.movie) Api.movieFilms().then(function (list) {
      if (!list.length) {
        var mm = Api.missingChannels().filter(function (m) { return m.movie; });
        rows.movie.msg(mm.length && mm[0].why === 'quota' ? 'Chưa tìm được kênh phim lẻ vì đã hết hạn mức YouTube hôm nay.' : 'Chưa có phim lẻ. Kiểm tra kênh trong Cài đặt → Kênh theo dõi.');
        return;
      }
      rows.movie.cards(list.slice(0, 16), function (it) { return UI.card(it, cardOpts({})); });
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
    h.appendChild(el('span', 'rh', ((C.CHANNELS || []).length + (C.ANIME_CHANNELS || []).length) + ' kênh · phim mới cập nhật mỗi ' + C.CHANNEL_HOURS + ' giờ'));
    v.appendChild(h);
    var g = el('div', 'chgrid');
    g.appendChild(el('div', 'rowmsg', 'Đang tải kênh…'));
    v.appendChild(g);
    Api.channels().then(function (chs) {
      g.innerHTML = '';
      if (!chs.length && !Api.missingChannels().length) { g.appendChild(el('div', 'rowmsg', 'Chưa tìm được kênh nào. Kiểm tra API key và mạng.')); return; }
      chs.forEach(function (c) {
        var e = el('div', 'chcard f rowwrap');
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
            'Không tìm thấy “' + m.name + '”. Vào Cài đặt → Thêm kênh, gõ @tên-kênh.');
        };
        g.appendChild(e);
      });
      if (current() && current().el === v && Nav.cur && Nav.cur.dataset && Nav.cur.dataset.tab) Nav.focus(g.firstChild, true);
    });
    return { name: 'chans', el: v };
  }

  function ChannelList(c) {
    var v = UI.view();
    v.classList.add('scroller');
    var h = el('div', 'pagehead', c.title || c.name);
    h.appendChild(el('span', 'rh', 'Phim mới nhất của kênh'));
    v.appendChild(h);
    var holder = el('div', 'gridwrap');
    holder.appendChild(el('div', 'rowmsg', 'Đang tải…'));
    v.appendChild(holder);
    Api.channelFilms(c).then(function (list) {
      if (c.anime) list = Api.groupEpisodes(list);
      holder.innerHTML = '';
      if (!list.length) { holder.appendChild(el('div', 'rowmsg', 'Kênh chưa có phim dài từ ' + C.MIN_FILM_MINUTES + ' phút.')); return; }
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
      pane.appendChild(el('div', 'pagehead small', 'Gợi ý tìm nhanh'));
      var chips = el('div', 'sugs');
      ['xuyên không', 'trùng sinh', 'giả nghèo', 'giả chết', 'tổng tài', 'hoạt hình'].forEach(function (s) {
        var c = el('div', 'sug f', s);
        c._ok = function () { setQ(s); run(); };
        chips.appendChild(c);
      });
      pane.appendChild(chips);
    }
    suggestions();

    var token = 0;
    function run() {
      var text = q.trim();
      if (!text) { UI.toast('Hãy nhập từ khóa trước'); return; }
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
    }

    function doPlay(fromStart) {
      if (!isAnime) { playFilm(item, fromStart); return; }
      if (!eps || !eps.length) { UI.toast(eps ? 'Chưa có tập nào phát được' : 'Đang tải danh sách tập…'); return; }
      var r = fromStart ? null : resumeInfo();
      Player.open({
        items: eps, index: r ? r.idx : 0, heading: item.title, key: 'pl:' + item.id,
        series: item, fromStart: fromStart, onClose: afterPlayer
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
              Player.open({ items: eps, index: e.ep - 1, heading: item.title, key: 'pl:' + item.id, series: item, onClose: afterPlayer });
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
    var h = el('div', 'pagehead', 'Lịch sử xem');
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
    h.appendChild(unb);
    h.appendChild(clr);
    v.appendChild(h);

    var r1 = UI.row('Đã xem gần đây');
    var r2 = UI.row('Danh sách của tôi');
    v.appendChild(r1.wrap);
    v.appendChild(r2.wrap);

    function render() {
      var rec = Store.recent();
      if (!rec.length) r1.msg('Bạn chưa xem phim nào.');
      else r1.cards(rec, function (r) {
        var p = progressOf(r.vid);
        var sub = r.item.kind === 'anime' ? 'Tập ' + r.ep : (p ? (canResume(p) ? 'Còn ' + UI.fmtLong(p.d - p.p) : 'Đã xem xong') : '');
        return UI.card(r.item, { progress: p ? p.p / p.d : null, sub: sub, onSelect: openItem });
      });
      var fav = Store.favs();
      if (!fav.length) r2.msg('Chưa có phim nào. Vào chi tiết phim và chọn “Danh sách”.');
      else r2.cards(fav, function (it) { return UI.card(it, { onSelect: openItem }); });
    }
    render();
    return { name: 'history', el: v, refresh: render };
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
    var est;

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
    function opt(key, label, desc, opts, after) { return row(label, desc, shower(key, opts), cycle(key, opts, after)); }
    var ONOFF = [{ v: true, t: 'Bật', on: true }, { v: false, t: 'Tắt' }];
    var SHOWHIDE = [{ v: true, t: 'Hiện', on: true }, { v: false, t: 'Ẩn' }];
    function reloadLists() { Store.clearCache(); UI.toast('Đã lưu. Danh sách phim sẽ tải lại theo cài đặt mới'); }

    sec('Giao diện');
    opt('THEME', 'Giao diện Tối / Sáng', 'Tự động = đổi theo chế độ của điện thoại / máy tính',
      [{ v: 'dark', t: 'Tối', on: true }, { v: 'light', t: 'Sáng', on: true }, { v: 'auto', t: 'Tự động', on: true }]);

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
      if (s.loggedIn && !s.expired) return { t: s.email || 'Đã đăng nhập', on: true };
      return { t: s.expired ? 'Đăng nhập lại' : 'Đăng nhập', on: false };
    }, function (paint) {
      var s = Sync.status();
      if (!s.configured) { UI.toast('Cần điền Google Client ID trong config.js (xem Hướng dẫn → Đăng nhập Google)'); return; }
      if (s.loggedIn && !s.expired && !s.needTap) { UI.toast('Đã đăng nhập ' + (s.email || '') + '. Chọn “Đăng xuất” để đổi tài khoản.'); return; }
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
      if (!s.loggedIn) { UI.toast('Hãy đăng nhập Google trước'); return; }
      var p = s.needTap && s.web ? Sync.webLogin() : Sync.sync('manual');
      UI.toast('Đang đồng bộ…');
      p.then(function () { paint(); var st = Sync.status(); UI.toast(st.error || 'Đã đồng bộ'); }, function () { paint(); });
    });
    row('Đăng xuất Google', 'Dữ liệu trên máy này vẫn giữ nguyên', function () {
      return { t: Sync.status().loggedIn ? 'Đăng xuất' : '—' };
    }, function (paint) {
      if (!Sync.status().loggedIn) return;
      Sync.logout(); UI.toast('Đã đăng xuất Google'); goTab('settings');
    });

    sec('Remote');
    opt('OK2_HOME', 'Bấm OK 2 lần liên tục để về Trang chủ', 'Không áp dụng khi đang gõ chữ hoặc ở trang Cài đặt', ONOFF);

    sec('Trang chủ');
    opt('SHOW_CONT', 'Tiếp tục xem', '', SHOWHIDE);
    opt('SHOW_FRESH', 'Phim mới cập nhật', '', SHOWHIDE);
    opt('SHOW_HOT', 'Đang hot', '', SHOWHIDE);
    opt('SHOW_REC', 'Đề xuất cho bạn', '', SHOWHIDE);
    opt('SHOW_MOVIE', 'Phim lẻ hay', '', SHOWHIDE);
    opt('SHOW_ANIME', 'Hoạt hình', '', SHOWHIDE);

    sec('Danh mục và phim');
    opt('CAT_SEARCH_MORE', 'Danh mục ít phim thì tìm thêm trên YouTube', 'Mỗi lần tìm thêm tốn khoảng 100 đơn vị', ONOFF);
    opt('MIN_FILM_MINUTES', 'Phim lẻ dài tối thiểu', '', [10, 20, 30, 45].map(function (n) { return { v: n, t: n + ' phút' }; }), reloadLists);
    opt('MIN_ANIME_MINUTES', 'Hoạt hình dài tối thiểu', '', [1, 3, 5, 10].map(function (n) { return { v: n, t: n + ' phút' }; }), reloadLists);
    opt('HIDE_VERTICAL', 'Phim quay dọc', 'Chiếu giữa màn hình giống YouTube',
      [{ v: false, t: 'Hiện', on: true }, { v: true, t: 'Ẩn' }], reloadLists);

    sec('Xem phim');
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
    });

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
      Settings.reset();
      Store.clearCache();
      UI.toast('Đã khôi phục cài đặt mặc định');
      goTab('settings');
    }));
    var bw = el('div', 'rowwrap');
    bw.appendChild(bx);
    wrap.appendChild(bw);
    return { name: 'settings', el: v };
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
      step.textContent = e && e.expired ? 'Mã đã hết hạn. Bấm Hủy rồi thử lại.' :
        e && e.data && e.data.error === 'invalid_client' ? 'Client ID / Client secret chưa đúng (xem Hướng dẫn).' :
        e && e.data && e.data.error === 'access_denied' ? 'Bạn đã từ chối đăng nhập.' :
        e && e.net ? 'Không kết nối được Google. Kiểm tra mạng.' : 'Không đăng nhập được. Kiểm tra cài đặt Google Cloud (xem Hướng dẫn).';
      code.textContent = '';
    });
    var view = { name: 'glogin', el: v };
    view.onLeave = function () { if (flow) flow.cancel(); };
    return view;
  }

  // Bàn phím nhập chữ (API key, địa chỉ web)
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
    function setV(s) { val = s.slice(0, 120); txt.textContent = val; }
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
    mIn.type = 'text';
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
      if (sy.loggedIn) qk('Đồng bộ Google', (sy.email || 'Đã đăng nhập') + ' · ' + (sy.error || 'lần cuối ' + (sy.lastSync ? UI.hhmm(sy.lastSync) : '—')), sy.error ? 'bad' : '');
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
      'Không cần đăng nhập. Lịch sử xem chỉ lưu trên thiết bị này.'
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
      { svg: REMOTE, t: 'Remote', l: ['Mũi tên để di chuyển, OK để chọn. Ô đang chọn có viền trắng.', 'Bấm OK 2 lần thật nhanh: về Trang chủ từ bất kỳ đâu (kể cả đang xem phim). Tắt được trong Cài đặt → Remote.', 'Back để quay lại trang trước. Ở trang chủ bấm Back 2 lần để thoát app.'] },
      { img: 'g_home', t: 'Trang chủ', l: ['Ảnh lớn đầu trang là phim mới nhất. “Xem ngay” để phát, “Chi tiết” để xem thông tin.', 'Các hàng: Tiếp tục xem, Phim mới cập nhật, Đang hot, Phim lẻ hay, Đề xuất (2 danh mục mỗi ngày), Hoạt hình.', 'Dòng vàng cạnh “Phim mới cập nhật” cho biết còn bao lâu app tự lấy phim mới.'] },
      { img: 'g_play', t: 'Xem phim', l: ['OK: tạm dừng / phát. Trái / phải: tua 10 giây (bấm liên tục để tua nhanh).', 'Mũi tên lên: chọn các nút −10s, +10s, Bỏ phim, Phụ đề, Chất lượng. Bấm ▲ 2 lần nhanh: bật/tắt phụ đề tiếng Việt.', 'Thanh điều khiển tự ẩn sau 5 giây. Back để thoát phim, app nhớ chỗ đang xem.'] },
      { img: 'g_quality', t: 'Phụ đề và chất lượng', l: ['Nút Phụ đề: bật/tắt phụ đề tiếng Việt (YouTube tự dịch nếu phim chỉ có phụ đề khác).', 'Nút Chất lượng: Tự động, 4K, 1080p, 720p… app đổi kích thước khung phát để YouTube chọn mức tương ứng, mất vài giây mới đổi. YouTube vẫn có thể tự hạ khi mạng yếu hoặc video không có mức đó.', 'Bỏ phim: ẩn phim lỗi. Hiện lại trong Lịch sử hoặc Cài đặt.'] },
      { img: 'g_detail', t: 'Tiếp tục xem', l: ['Phim xem dở có thanh tiến độ và thời gian còn lại.', '“Tiếp tục xem” để xem tiếp, “Xem từ đầu” để xem lại.', '“+ Danh sách” để lưu phim, xem lại trong tab Lịch sử.', '“Bình luận”: đọc bình luận của phim trên YouTube (Hay nhất / Mới nhất). OK để mở rộng bình luận dài. Cần API key, tốn 1 đơn vị hạn mức mỗi lần tải.'] },
      { img: 'g_anime', t: 'Hoạt hình nhiều tập', l: ['Các tập cùng một bộ được gộp thành 1 phim, thẻ phim ghi số tập.', 'Vào phim: “Xem từ tập 1” hoặc chọn tập trong Danh sách tập bên dưới.', 'Xem hết một tập, app tự chuyển sang tập sau. Xem dở thì nút ghi “Tiếp tục xem tập …”.'] },
      { img: 'g_chans', t: 'Kênh', l: ['Tất cả kênh bạn theo dõi. Chữ vàng là kênh có phim mới hôm nay.', 'OK để xem phim mới nhất của kênh. Kênh hoạt hình ghi “Hoạt hình”, kênh phim lẻ ghi “Phim lẻ hay”.', 'Dấu “?” là kênh chưa tìm được (thường do hết hạn mức), app tự thử lại.'] },
      { img: 'g_cats', t: 'Danh mục và Tìm kiếm', l: ['16 thể loại, mỗi ô dùng ảnh của phim nổi bật trong thể loại đó.', 'Tìm kiếm: chọn chữ trên bàn phím màn hình, không cần gõ dấu.'] },
      { img: 'g_addch', t: 'Thêm kênh mới', l: ['Cài đặt → Kênh theo dõi → “+ Thêm kênh mới”. Gõ tên kênh (không cần dấu) hoặc @tên-kênh.', 'Chọn “Lưu vào Phim ngắn”, “Lưu vào Phim lẻ hay” hoặc “Lưu vào Hoạt hình”.', 'Mỗi kênh có nút đổi loại: Phim ngắn → Phim lẻ hay → Hoạt hình → Tắt.'] },
      { img: 'g_google', t: 'Đăng nhập Google (đồng bộ nhiều máy)', l: ['Cài đặt → Tài khoản Google → “Đăng nhập Google”.', 'TV: mở google.com/device trên điện thoại, đăng nhập Gmail, nhập mã hiện trên TV. Màn hình TV tự chuyển khi xong.', 'Trình duyệt / iPhone: chọn tài khoản Google trong cửa sổ hiện ra.', 'Lịch sử, phim xem dở, danh sách, phim đã bỏ, cài đặt, kênh bạn thêm giống nhau trên mọi máy cùng Gmail. API key và PLAYER_HOST giữ riêng từng máy.'] },
      { img: 'g_key', t: 'Nhập YouTube API key', l: ['Lấy key ở console.cloud.google.com → APIs & Services → Credentials (chuỗi 39 ký tự, giữ kín, đừng gửi cho ai).', 'Trên TV: Cài đặt → Kết nối → “YouTube API key” → OK.', 'Gõ từng ký tự: “Chữ HOA” đổi hoa/thường, “Xóa” xóa 1 ký tự. Xong chọn “Lưu”.', 'Kiểm tra: tab Thông tin → Nguồn dữ liệu ghi “YouTube API: đã kết nối”.'] },
      { img: 'g_host', t: 'Nhập PLAYER_HOST (chỉ Samsung)', l: ['Chỉ TV Samsung cần. Hisense / Android TV bỏ qua bước này.', 'Cài đặt → Kết nối → “PLAYER_HOST (Samsung)” → OK. Đã có sẵn “https://”.', 'Gõ tiếp địa chỉ GitHub Pages của bạn, dạng tên-của-bạn.github.io/tongtai-player/ (dùng phím . / -) rồi “Lưu”.', 'Kiểm tra: tab Thông tin → Trình phát ghi “Qua https://…”. Còn lỗi 153 là địa chỉ chưa đúng.'] },
      { img: 'g_set_update', t: 'Cài đặt: Cập nhật phim mới', l: ['Tự cập nhật phim mới: Bật thì app tự lấy phim mới khi đang mở.', 'Cập nhật mỗi: 1, 2, 3, 6 hoặc 12 giờ. Càng thưa càng tiết kiệm hạn mức.', 'Tạm dừng khi TV để không: không ai bấm remote sau 1, 3 hoặc 6 giờ thì ngừng cập nhật.', 'Số video lấy mỗi kênh: 10, 25 hoặc 50 (gồm hết video mới + video cũ chọn ngẫu nhiên).'] },
      { img: 'g_set_home', t: 'Cài đặt: Trang chủ, danh mục, phim', l: ['Ẩn/Hiện từng hàng: Tiếp tục xem, Phim mới cập nhật, Đang hot, Phim lẻ hay, Đề xuất, Hoạt hình.', 'Danh mục ít phim thì tìm thêm trên YouTube: Tắt để tiết kiệm (~100 đơn vị mỗi lần tìm).', 'Phim lẻ dài tối thiểu, Hoạt hình dài tối thiểu, Phim quay dọc Hiện/Ẩn. Đổi xong app tải lại danh sách.'] },
      { img: 'g_set_more', t: 'Cài đặt: Xem phim, kênh, nút cuối trang', l: ['Phụ đề tiếng Việt khi mở phim (Bật/Tắt), Chất lượng mặc định.', 'Kênh theo dõi: “+ Thêm kênh mới”; mỗi kênh đổi Phim ngắn → Phim lẻ hay → Hoạt hình → Tắt.', 'Ước tính hạn mức hiện ngay theo cài đặt bạn chọn.', 'Cập nhật ngay · Hiện lại phim đã bỏ · Khôi phục mặc định (vẫn giữ kênh, API key, PLAYER_HOST).'] },
      { img: 'g_info', t: 'Thông tin và hạn mức', l: ['Hạn mức YouTube đã dùng hôm nay trên TV này, còn bao lâu làm mới hạn mức.', 'Ước tính theo Cài đặt và còn bao nhiêu phút cập nhật phim mới.', 'Xem phim không tốn hạn mức. Hạn mức làm mới lúc 0 giờ giờ California (3 giờ chiều VN).'] },
      { img: 'g_web', t: 'Xem trên trình duyệt (máy tính, điện thoại)', l: ['Mở địa chỉ bản web (dạng tên-của-bạn.github.io/tongtai-player/app/) bằng Chrome hoặc Safari.', 'Bấm chuột / chạm vào phim để mở. Lăn chuột hoặc vuốt để di chuyển. Phím mũi tên, Enter, Esc cũng dùng được.', 'Nút “‹ Quay lại” ở góc dưới bên trái. Khi xem phim: bấm vào video để tạm dừng, bấm các nút để tua.', 'iPhone: giao diện điện thoại riêng, cuộn bằng tay. Safari → nút Chia sẻ → “Thêm vào MH chính” để có biểu tượng như app.', 'Lần đầu: Cài đặt → YouTube API key, dán key (key chỉ lưu trong trình duyệt của bạn).'] },
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
    init: init, back: back, goTab: goTab, openItem: openItem, autoRefresh: autoRefresh, nextRefresh: nextRefresh, home: home,
    depth: function () { return S.stack.length; },
    current: function () { return current(); }
  };
})(window);
