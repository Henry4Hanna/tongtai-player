/* Nhật ký lỗi: giữ 50 dòng gần nhất trên thiết bị này (không đồng bộ).
   Lỗi tô đỏ trong màn hình Cài đặt → Nhật ký lỗi, có nút "Sao chép để gửi". */
(function (w) {
  'use strict';
  var KEY = 'tt.log', MAX = 50;

  function read() {
    try { var a = JSON.parse(w.localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function write(a) {
    try { w.localStorage.setItem(KEY, JSON.stringify(a.slice(-MAX))); } catch (e) { /* đầy bộ nhớ: bỏ qua */ }
  }

  // Ghi một dòng. Cùng nội dung lặp lại liên tục thì chỉ tăng số lần (×3) cho đỡ rối.
  function add(lvl, msg) {
    msg = String(msg == null ? '' : msg).replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!msg) return;
    var a = read(), last = a[a.length - 1], now = Date.now();
    if (last && last.m === msg && last.l === lvl && now - last.t < 10 * 60e3) {
      last.n = (last.n || 1) + 1; last.t = now;
    } else a.push({ t: now, l: lvl, m: msg });
    write(a);
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function stamp(t) {
    var d = new Date(t);
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }
  function line(x) {
    return stamp(x.t) + ' ' + (x.l === 'err' ? '[LỖI] ' : x.l === 'warn' ? '[CHÚ Ý] ' : '') + x.m + (x.n > 1 ? ' (×' + x.n + ')' : '');
  }

  // Văn bản để gửi cho người hỗ trợ: phiên bản, thiết bị, rồi các dòng nhật ký
  function report(maxLen) {
    var C = w.APP_CONFIG || {}, dev = w.DEVICE || {};
    var kind = w.tizen ? 'Samsung TV' : w.AndroidApp ? 'Android TV' : 'Trình duyệt';
    var head = 'Tổng Tài TV ' + (C.VERSION || '') + ' (build ' + (C.BUILD || '') + ') · ' + kind +
      (dev.label ? ' · ' + dev.label : '') + '\n' + String(w.navigator.userAgent || '').slice(0, 160) + '\n---\n';
    var lines = read().map(line);
    if (maxLen) {   // bản gọn cho mã QR: bớt dòng cũ cho tới khi vừa
      while (lines.length && (head + lines.join('\n')).length > maxLen) lines.shift();
    }
    return head + (lines.length ? lines.join('\n') : '(nhật ký trống)');
  }

  w.Log = {
    err: function (m) { add('err', m); },
    warn: function (m) { add('warn', m); },
    info: function (m) { add('info', m); },
    list: function () { return read(); },
    line: line, report: report,
    errCount: function () { return read().filter(function (x) { return x.l === 'err'; }).length; },
    clear: function () { write([]); }
  };

  // Lỗi JavaScript và lỗi Promise không ai bắt
  w.addEventListener('error', function (e) {
    if (!e || !e.message) return;
    add('err', 'Lỗi chương trình: ' + e.message + ' (' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0) + ')');
  });
  w.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason;
    var m = r && (r.message || r.error || (typeof r === 'string' ? r : ''));
    if (m) add('err', 'Lỗi chưa xử lý: ' + m);
  });
  w.addEventListener('offline', function () { add('warn', 'Mất kết nối mạng'); });
  w.addEventListener('online', function () { add('info', 'Đã có mạng lại'); });
})(window);
