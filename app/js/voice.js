/* Tìm bằng giọng nói. Trình duyệt: Web Speech API (Chrome, Edge, Safari iPhone/Mac). Android TV: hộp giọng nói của Google qua AndroidApp.
   TV Samsung (Tizen) không cho app web dùng micro, nên không có. */
(function (w) {
  'use strict';
  var SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  var rec = null, cb = null;
  function android() { try { return !!(w.AndroidApp && w.AndroidApp.voice && (!w.AndroidApp.hasVoice || w.AndroidApp.hasVoice())); } catch (e) { return false; } }
  function available() { return android() || (!!SR && !w.tizen); }
  var ERR = { 'not-allowed': 'Chưa cho phép dùng micro. Bật quyền micro cho trang này rồi thử lại.', 'service-not-allowed': 'Trình duyệt không cho dùng nhận giọng nói.', 'no-speech': 'Không nghe thấy gì, bấm micro và nói lại nhé.', 'audio-capture': 'Không tìm thấy micro.', network: 'Mất mạng, chưa nhận được giọng nói.', none: 'Máy này chưa có ứng dụng nhận giọng nói của Google.', cancel: '' };
  function done(kind, x) { var c = cb; cb = null; if (!c) return; if (kind === 'ok') c.onFinal(x); else c.onError(ERR[x] != null ? ERR[x] : 'Chưa nhận được giọng nói, thử lại nhé.'); }
  w.__voiceResult = function (t) { done('ok', String(t || '')); };
  w.__voiceError = function (code) { done('err', code); };
  function start(onPartial, onFinal, onError) {
    stop();
    cb = { onPartial: onPartial || function () {}, onFinal: onFinal, onError: onError || function () {} };
    if (android()) { w.AndroidApp.voice(); return; }
    if (!SR) { done('err', 'none'); return; }
    rec = new SR();
    rec.lang = 'vi-VN'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    var finalTxt = '';
    rec.onresult = function (e) {
      var t = '';
      for (var i = e.resultIndex; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalTxt = t; }
      if (cb) cb.onPartial(t);
    };
    rec.onerror = function (e) { var r = rec; rec = null; done('err', e && e.error || ''); try { r && r.abort(); } catch (x) { /* bỏ qua */ } };
    rec.onend = function () { rec = null; if (finalTxt) done('ok', finalTxt.trim()); else done('err', 'no-speech'); };
    try { rec.start(); } catch (e) { done('err', ''); }
  }
  function stop() { if (rec) { try { rec.abort(); } catch (e) { /* bỏ qua */ } rec = null; } cb = null; }
  w.Voice = { available: available, start: start, stop: stop, android: android };
})(window);
