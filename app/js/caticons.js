/* Hình minh họa cho từng danh mục (SVG tự vẽ, không cần mạng). */
(function (w) {
  'use strict';
  var S = 'fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
  var G = '#F5D58E';
  var I = {
    // Xuyên không: cổng không gian xoáy + đồng hồ cát
    xuyenkhong: '<circle cx="60" cy="60" r="44" ' + S + ' opacity=".5"/><path d="M60 22a38 38 0 1 1-30 15" ' + S + '/><path d="M60 34a26 26 0 1 1-20 10" ' + S + ' opacity=".8"/>' +
      '<path d="M50 46h20M50 74h20M52 46c0 10 16 10 16 14s-16 4-16 14M68 46c0 10-16 10-16 14s16 4 16 14" fill="none" stroke="' + G + '" stroke-width="4" stroke-linecap="round"/>',
    // Trùng sinh: mũi tên vòng quay lại + ngôi sao
    trungsinh: '<path d="M96 60a36 36 0 1 1-11-26" ' + S + '/><path d="M88 18v18H70" ' + S + '/>' +
      '<path d="M60 40l6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2z" fill="' + G + '"/>',
    // Giả nghèo: vương miện giấu sau miếng vá
    giangheo: '<path d="M22 82l8-40 18 18 12-26 12 26 18-18 8 40z" ' + S + '/><path d="M22 92h76" ' + S + '/>' +
      '<rect x="44" y="56" width="34" height="22" rx="4" transform="rotate(-12 61 67)" fill="' + G + '"/><path d="M50 62l4 4M58 60l4 4M66 58l4 4" stroke="#7a5418" stroke-width="3" transform="rotate(-12 61 67)"/>',
    // Giả chết: bóng ma
    giachet: '<path d="M30 96V54a30 30 0 0 1 60 0v42l-10-8-10 8-10-8-10 8-10-8z" ' + S + '/><circle cx="50" cy="54" r="5" fill="' + G + '"/><circle cx="70" cy="54" r="5" fill="' + G + '"/><path d="M52 72q8 6 16 0" ' + S + '/>',
    // Hoạt hình AI: robot
    hoathinh: '<rect x="28" y="40" width="64" height="50" rx="14" ' + S + '/><path d="M60 40V26" ' + S + '/><circle cx="60" cy="22" r="5" fill="' + G + '"/>' +
      '<circle cx="47" cy="62" r="7" fill="' + G + '"/><circle cx="73" cy="62" r="7" fill="' + G + '"/><path d="M48 78h24M20 58v14M100 58v14" ' + S + '/>',
    // Tổng tài: vương miện + cà vạt
    tongtai: '<path d="M30 46l8-22 12 12 10-16 10 16 12-12 8 22z" fill="' + G + '"/><path d="M48 54h24l-6 10 8 30-14 12-14-12 8-30z" ' + S + '/>',
    // Ngọt sủng: trái tim + lấp lánh
    ngotsung: '<path d="M60 96S24 74 24 48a18 18 0 0 1 36-6 18 18 0 0 1 36 6c0 26-36 48-36 48z" fill="' + G + '"/><path d="M96 20v14M89 27h14M22 86v10M17 91h10" ' + S + '/>',
    // Báo thù: ngọn lửa + thanh kiếm
    baothu: '<path d="M60 100c-20 0-30-14-30-28 0-16 14-22 14-40 10 6 16 16 16 26 4-4 6-10 6-16 12 10 24 20 24 32 0 14-12 26-30 26z" fill="' + G + '"/><path d="M60 98V58M50 66h20" stroke="#4a1c1c" stroke-width="6" stroke-linecap="round"/>',
    // Hôn nhân: hai chiếc nhẫn
    honnhan: '<circle cx="46" cy="68" r="24" ' + S + '/><circle cx="74" cy="68" r="24" ' + S + '/><path d="M66 24l8-10 8 10-8 10z" fill="' + G + '"/><path d="M74 34v8" ' + S + '/>',
    // Gia đình: bố, mẹ, con
    giadinh: '<circle cx="38" cy="38" r="11" ' + S + '/><circle cx="82" cy="38" r="11" ' + S + '/><circle cx="60" cy="62" r="8" fill="' + G + '"/>' +
      '<path d="M20 92c0-16 8-28 18-28s18 12 18 28M64 92c0-16 8-28 18-28s18 12 18 28M48 96c0-10 5-18 12-18s12 8 12 18" ' + S + '/>',
    // Cổ trang: mái chùa
    cotrang: '<path d="M14 50q46-30 92 0M26 50l-6 10M94 50l6 10" ' + S + '/><path d="M60 22v-8" ' + S + '/><path d="M34 52v38M86 52v38M24 92h72M48 92V66h24v26" ' + S + '/><circle cx="60" cy="14" r="5" fill="' + G + '"/>',
    // Thiên kim: viên kim cương
    thienkim: '<path d="M32 38h56l16 20-44 46-44-46z" fill="' + G + '"/><path d="M16 58h88M44 38l-6 20 22 46 22-46-6-20M60 38l-22 20M60 38l22 20" fill="none" stroke="#7a5418" stroke-width="3" stroke-linejoin="round"/>',
    // Trẻ em: quả bóng bay + gấu bông
    treem: '<ellipse cx="78" cy="38" rx="18" ry="22" fill="' + G + '"/><path d="M78 60q-6 12 2 22t-4 26" ' + S + '/>' +
      '<circle cx="40" cy="62" r="16" ' + S + '/><circle cx="28" cy="48" r="6" ' + S + '/><circle cx="52" cy="48" r="6" ' + S + '/><path d="M24 104c0-14 7-22 16-22s16 8 16 22" ' + S + '/>',
    // Sinh đôi: hai em bé
    sinhdoi: '<circle cx="40" cy="48" r="16" ' + S + '/><circle cx="80" cy="48" r="16" fill="' + G + '" stroke="#fff" stroke-width="5"/>' +
      '<path d="M18 100c0-18 10-30 22-30s22 12 22 30M58 100c0-18 10-30 22-30s22 12 22 30" ' + S + '/><path d="M34 46h0M46 46h0M74 46h0M86 46h0" stroke="#fff" stroke-width="5" stroke-linecap="round"/>',
    // Làng quê: ngôi nhà, ruộng lúa, mặt trời
    langque: '<circle cx="92" cy="26" r="10" fill="' + G + '"/><path d="M18 62l26-22 26 22M24 56v30h40V56M38 86V70h12v16" ' + S + '/>' +
      '<path d="M10 98q20-8 40 0t40 0 30 0M80 86v-14M88 86v-18M96 86v-12" ' + S + '/>',
    // Phim lẻ hay: cuộn phim + vé
    phimle: '<circle cx="50" cy="56" r="34" ' + S + '/><circle cx="50" cy="56" r="8" fill="' + G + '"/><circle cx="50" cy="34" r="7" ' + S + '/><circle cx="50" cy="78" r="7" ' + S + '/><circle cx="28" cy="56" r="7" ' + S + '/><circle cx="72" cy="56" r="7" ' + S + '/><path d="M84 90l20-8v18l-20 8z" fill="' + G + '"/>',
    // Hài: mặt cười
    hai: '<circle cx="60" cy="60" r="42" fill="' + G + '"/><path d="M40 50q6-8 12 0M68 50q6-8 12 0" fill="none" stroke="#7a5418" stroke-width="5" stroke-linecap="round"/><path d="M36 66h48q-4 22-24 22T36 66z" fill="#7a5418"/>'
  };
  w.CAT_ICONS = function (id) {
    var body = I[id] || I.tongtai;
    return '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">' + body + '</svg>';
  };
})(window);
