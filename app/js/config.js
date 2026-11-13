/* Cấu hình Tổng Tài TV. Chỉ cần điền API_KEY là chạy được. */
window.APP_CONFIG = {
  // Khóa YouTube Data API v3. Để trống = chế độ demo (dữ liệu mẫu, chưa phát được video).
  API_KEY: 'AIzaSyCXEkZ-8jg9V3SQgAKEhwms0Naqsl8h-bo',   // ĐỂ TRỐNG: bản web công khai, nhập key trong Cài đặt (chỉ lưu trên trình duyệt của bạn)

  // Samsung TV: địa chỉ trang phát video trên GitHub Pages (xem README mục PLAYER_HOST).
  // Android không cần. CHỈ có một dòng PLAYER_HOST trong file này.
  PLAYER_HOST: 'https://henry4hanna.github.io/tongtai-player/app/',

  REGION: 'VN',
  LANG: 'vi',
  REFRESH_HOURS: 1,        // trang chủ tự cập nhật phim mới mỗi 1 giờ (khi đang mở app)
  CHANNEL_HOURS: 1,        // phim mới từ các kênh theo dõi: làm mới mỗi 1 giờ (rất ít tốn hạn mức)
  CACHE_HOURS: 1,          // đề xuất / danh mục / hoạt hình / tìm kiếm: làm mới mỗi 1 giờ
  MIN_FILM_MINUTES: 20,    // phim lẻ phải dài từ 20 phút
  HIDE_VERTICAL: false,    // false = có cả phim quay dọc (xem giữa màn hình như YouTube)

  // Loại bỏ video có dấu hiệu là nhiều tập (chỉ giữ phim lẻ 1 tập)
  FILM_EXCLUDE: /(tập\s*\d+|tap\s*\d+|\bep(isode)?\.?\s*\d+|\bpart\s*\d+|phần\s*\d+)/i,

  HOME_QUERY: 'phim ngắn tổng tài full',
  // Hoạt hình: CHỈ lấy hoạt hình AI, loại hẳn hoạt hình 3D
  ANIME_QUERIES: ['hoạt hình AI tập', 'phim hoạt hình AI'],

  SCREENSAVER: 10,  // màn hình chờ: để yên bao nhiêu phút thì hiện ảnh bìa phim mới + đồng hồ (0 = tắt)
  BOOT_SECS: 3,      // màn hình khởi động hiện bao lâu: số giây (1, 2, 3, 5, 8) hoặc 'auto' = đến khi tải xong kênh
  CLOCK_12: true,    // đồng hồ: true = 12 giờ (2:05 PM, mặc định), false = 24 giờ (14:05). Đổi trong Cài đặt → Giao diện
  THEME: 'dark',   // giao diện: 'dark' (tối), 'light' (sáng), 'auto' (theo máy). Đổi trong Cài đặt cũng được.

  AUTHOR: 'Ryan Nguyen',
  VERSION: '2.28.3',
  BUILD: 90,
  UPDATED: '11/11/2026',
  CONTACT: '',
  // Kiểm tra bản mới: địa chỉ file version.json. Để trống = tự dùng PLAYER_HOST + 'app/version.json' (TV)
  // hoặc version.json cạnh trang (bản web). Android không có PLAYER_HOST thì điền địa chỉ đầy đủ ở đây.
  UPDATE_URL: '',

  AUTO_NEXT: true,
  HIDE_WATCHED: true,   // Trang chủ: ẩn phim đã xem hết khỏi Phim mới, Đang hot, Đề xuất, Phim lẻ hay      // hết phim: đếm ngược 30 giây rồi tự phát phim/tập tiếp theo
  ASK_PROFILE: true,    // mở app hỏi "Ai đang xem?"
  AUTO_BACKUP: true,
  MUSIC: 'songs',       // nhạc nền Trang chủ: 'songs' (nhạc của tôi, lần lượt), 'songsx' (nhạc của tôi, trộn bài), 'auto' (5 bản hòa tấu), 'off', hoặc số bài 0–4
  MUSIC_URL: '',
  ADMIN_HASHES: ['95db4e4e635ec618bced1909f3fe20fcbab24956bb52560573ba3d33ea9be03c', 'dfc441d28737366d7329d2264ee8c8f326b77e939d70c2876df2a458308b5772'],  // email quản trị (mã hóa SHA-256, không lộ email). Đồng bộ bằng email này thì trang Thông tin hiện mục Quản trị
  ADMIN_PAGE: 'https://henry4hanna.github.io/tongtai-player/app/admin.html',  // địa chỉ trang quản trị (TV hiện mã QR tới đây)
  STATS_URL: 'https://tongtai-stats.ryannguyen0128.workers.dev/',        // máy chủ thống kê cho trang quản trị (Cloudflare Worker), ví dụ https://tongtai-stats.ten-cua-ban.workers.dev . Để trống = không gửi gì
  MUSIC_VIEW: 'split',  // trang Nhạc: 'split' (Kiểu A: chia đôi) hoặc 'karaoke' (Kiểu B: toàn màn hình)        // địa chỉ trang web có thư mục music/ (GitHub Pages của bạn). Để trống = tự dò theo bản web / PLAYER_HOST
  MUSIC_VOL: 'low',     // âm lượng nhạc nền: 'low', 'mid', 'high'
  SEASON: 'auto',       // chủ đề theo mùa/ngày lễ: 'auto' (tự đổi theo ngày), 'off' (tắt), hoặc mã chủ đề (vd 'noel', 'tet')
  SEASON_FX: true,      // hiệu ứng rơi (tuyết, hoa, lá…). Tắt nếu TV chạy chậm
  PIN: '1234',
  PIN_FORCE: '1028',        // QUÊN MÃ PIN: điền mã mới ở đây (ví dụ '1234'), tải lại app một lần, rồi để trống lại          // mã PIN mặc định (đổi trong Cài đặt → Mã PIN). Dùng cho: tắt lọc lứa tuổi, sửa từ khóa, khôi phục mặc định, đổi PIN    // sao lưu tự động hằng tuần vào Google Drive / GitHub Gist (khi đã đăng nhập)

  // Chỉ chọn phim phù hợp lứa tuổi: ẩn phim có các từ khóa này trong tên/mô tả (sửa trong Cài đặt → Lọc theo lứa tuổi)
  AGE_FILTER: false,
  AGE_WORDS: ['18+', 'cảnh nóng', 'nóng bỏng', 'gợi cảm', 'sexy', 'khỏa thân', 'máu me', 'kinh dị', 'rùng rợn', 'bạo lực', 'tra tấn', 'ma túy', 'cờ bạc'],

  // Kênh YouTube bạn theo dõi. App tự tìm kênh theo tên (chỉ 1 lần, rồi nhớ luôn).
  // Nếu app tìm nhầm kênh: thêm id kênh, ví dụ { name: 'Only Phim', id: 'UCxxxxxxxxxxxxxxxxxxxxxx' }
  CHANNELS: [
    { name: '@ghienphimtongtai-kks19' }, { name: '@NgonTinhDrama-q7n' }, { name: '@phimhaytronbovn' },
    { name: '@NhàhátBánhmì' }, { name: '@SyTV-PhimNgắnViệt' }, { name: '@ccapdramas' },
    { name: '@keosuadrama' }, { name: '@onlyphimccap' }, { name: '@KịchSayNắng' },
    { name: '@nangngotdrama' }, { name: '@tiemngotdrama' }, { name: '@MầmXanhDrama' },
    { name: '@DừaXanhDrama' }, { name: '@SignLanguageoumei7' }, { name: '@RapPhimNgonTinh' },
    { name: '@NhàhátChuối' }, { name: '@vuonmatngot' }, { name: '@nghienhoangu' },
    { name: '@KhoảnhKhắcYêuThương-j4r' }, { name: '@PhimBongBóng' }, { name: '@KKStudio-TieuHaReviewPhim' },
    { name: '@KKStudioTieuVuReview' }, { name: '@GocPhimNgonTinh99' }, { name: '@KKStudio_DaisyTV3979' },
    { name: '@shemei31' }, { name: '@MatchaLatte_KKStudio' }
  ],
  CHANNEL_SET: 3,          // đổi số này khi thay toàn bộ danh sách kênh (xóa kênh tự thêm cũ)
  CHANNEL_VIDEOS: 25,      // số video mới nhất lấy từ mỗi kênh

  // Kênh hoạt hình: hàng/danh mục "Hoạt hình" lấy phim từ các kênh này.
  // Nhãn AI / 2D / 3D tự nhận theo tiêu đề; tag: là nhãn mặc định của kênh khi tiêu đề không ghi.
  ANIME_CHANNELS: [
    { name: '@tusvietsub514', tag: '3D' }, { name: '@Zzzphim', tag: '3D' }, { name: '@GaVangTuTien', tag: '3D' },
    { name: '@tieukhaai-t8e', tag: 'AI' }, { name: '@nautrang79', tag: 'AI' }, { name: '@MễLạcReview', tag: 'AI' },
    { name: '@isTayLamVi', tag: 'AI' }, { name: '@TramMePhim-naohetflopthidoi', tag: 'AI' }, { name: '@mongnureview', tag: 'AI' },
    { name: '@GOCVUIPHET', tag: 'AI' }, { name: '@GócManhuaReview', tag: 'AI' }, { name: '@ĐẬUSUB-l2c', tag: 'AI' },
    { name: '@Reviuuphimai', tag: 'AI' }, { name: '@ponkechuyen', tag: 'AI' }, { name: '@GÓCCHILLPHẾT', tag: 'AI' }
  ],
  // Kênh phim lẻ hay: hàng "Phim lẻ hay" trên Trang chủ
  MOVIE_CHANNELS: [
    { name: '@rapphimso9' }, { name: '@KKStudio-PhimienAnh-zy6kh' }, { name: '@publicmedias' },
    { name: '@KKS-phimlehay' }, { name: '@moviepublic' }, { name: '@MoxiViet' }
  ],
  MIN_ANIME_MINUTES: 5,    // hoạt hình: lấy video dài từ 5 phút

  // Tiết kiệm hạn mức
  // Đăng nhập Google để đồng bộ lịch sử, tiến độ, danh sách, cài đặt giữa các máy (xem README mục ĐỒNG BỘ GOOGLE)
  GOOGLE_TV_CLIENT_ID: '',       // bản web không dùng       // loại "TVs and Limited Input devices" (cho Samsung, Hisense)
  GOOGLE_TV_CLIENT_SECRET: '',   // KHÔNG điền ở bản web công khai
  GOOGLE_WEB_CLIENT_ID: '731796759414-phlt51jepekbfrkft40d1u4rrulajt2r.apps.googleusercontent.com',      // loại "Web application" (cho bản trình duyệt)

  OK2_HOME: true,              // bấm OK 2 lần liên tục để về Trang chủ
  CHANNELS_JSON: '',           // bản trình duyệt: địa chỉ channels.json (để trống = tự tìm cạnh trang)
  NEW_DAYS: 3,                 // video đăng trong 3 ngày gần đây = "video mới" (luôn lấy)
  FULL_REFRESH_HOURS: 6,      // lượt xem của phim cũ làm mới mỗi 6 giờ (phim MỚI vẫn hiện mỗi giờ)
  CAT_MIN_FROM_CHANNELS: 12,  // danh mục/đề xuất: đủ 12 phim từ kênh theo dõi thì không cần tìm kiếm
  IDLE_STOP_HOURS: 3,         // không ai bấm remote 3 giờ (TV để không) -> tạm dừng tự cập nhật

  CATEGORIES: [
    // kw: từ khóa trong tiêu đề/mô tả để gắn nhãn danh mục cho từng phim
    { id: 'xuyenkhong', name: 'Xuyên không', kind: 'film', q: 'phim ngắn xuyên không tổng tài full', kw: /xuyên không|xuyên sách|xuyên về|xuyên thành|xuyen khong/i },
    { id: 'trungsinh',  name: 'Trùng sinh',  kind: 'film', q: 'phim ngắn trùng sinh full', kw: /trùng sinh|trọng sinh|sống lại|trung sinh/i },
    { id: 'giangheo',   name: 'Giả nghèo',   kind: 'film', q: 'phim ngắn tổng tài giả nghèo full', kw: /giả nghèo|ẩn thân|giấu thân phận|che giấu thân phận|ẩn danh|gia ngheo/i },
    { id: 'giachet',    name: 'Giả chết',    kind: 'film', q: 'phim ngắn giả chết bỏ trốn tổng tài full', kw: /giả chết|bỏ trốn|gia chet/i },
    { id: 'hoathinh',   name: 'Hoạt hình', kind: 'anime' },
    { id: 'phimle',     name: 'Phim lẻ hay', kind: 'movie' },
    { id: 'tongtai',    name: 'Tổng tài',    kind: 'film', q: 'phim ngắn tổng tài lạnh lùng full', kw: /tổng tài|chủ tịch|\bceo\b|tong tai/i },
    { id: 'ngotsung',   name: 'Ngọt sủng',   kind: 'film', q: 'phim ngắn ngọt sủng full', kw: /ngọt sủng|cưng chiều|sủng vợ|sủng tận trời|ngot sung/i },
    { id: 'baothu',     name: 'Báo thù',     kind: 'film', q: 'phim ngắn báo thù tổng tài full', kw: /báo thù|trả thù|phản công|trả giá|vả mặt|bao thu/i },
    { id: 'honnhan',    name: 'Hôn nhân',    kind: 'film', q: 'phim ngắn hôn nhân chớp nhoáng full', kw: /hôn nhân|kết hôn|đám cưới|ly hôn|cô dâu|hôn ước|hon nhan/i },
    { id: 'giadinh',    name: 'Gia đình',    kind: 'film', q: 'phim ngắn gia đình mẹ đơn thân full', kw: /gia đình|mẹ đơn thân|mẹ con|bố con|mang bầu|mang thai|gia dinh/i },
    { id: 'cotrang',    name: 'Cổ trang',    kind: 'film', q: 'phim ngắn cổ trang xuyên không full', kw: /cổ trang|cổ đại|vương phi|hoàng hậu|cung đình|thái tử|hoàng thượng|co trang/i },
    { id: 'thienkim',   name: 'Thiên kim',   kind: 'film', q: 'phim ngắn thiên kim thật giả full', kw: /thiên kim|người thừa kế|hào môn|thien kim/i },
    { id: 'treem',      name: 'Trẻ em',      kind: 'film', q: 'phim ngắn em bé thiên tài tổng tài full', kw: /em bé|bé con|bé trai|bé gái|hai bé|bảo bối|thiên tài nhí|manh bảo|trẻ em|cục cưng|con trai nhỏ|con gái nhỏ/i },
    { id: 'sinhdoi',    name: 'Sinh đôi',    kind: 'film', q: 'phim ngắn sinh đôi long phụng tổng tài full', kw: /sinh đôi|song sinh|long phụng|cặp song|sinh ba|tam bảo|hai bé|2 bé|hai đứa (con|trẻ|bé)|2 đứa (con|trẻ|bé)|cặp bảo bối|song bảo|hai thiên tài nhí|sinh doi/i },
    { id: 'langque',    name: 'Làng quê',    kind: 'film', q: 'phim ngắn làng quê nông thôn full', kw: /làng quê|nông thôn|thôn quê|về quê|quê nghèo|nông dân|ruộng đồng|thôn nữ|lang que/i },
    { id: 'hai',        name: 'Hài',         kind: 'film', q: 'phim ngắn hài hước full', kw: /hài hước|phim hài|siêu hài|vui nhộn|cười bể bụng|hai huoc/i }
  ]
};

/* Nhận biết TV 4K: Android (độ phân giải thật của màn hình), Samsung Tizen (tấm nền UHD), trình duyệt (pixel thật). */
(function (w) {
  'use strict';
  var phys = '', uhd = false;
  try { if (w.AndroidApp && w.AndroidApp.displaySize) phys = String(w.AndroidApp.displaySize()); } catch (e) { /* bỏ qua */ }
  try { uhd = !!(w.webapis && w.webapis.productinfo && w.webapis.productinfo.isUdPanelSupported()); } catch (e) { /* bỏ qua */ }
  var m = /^(\d+)x(\d+)$/.exec(phys);
  var pw = m ? Math.max(+m[1], +m[2]) : Math.round(Math.max(w.screen.width, w.screen.height) * (w.devicePixelRatio || 1));
  var is4k = uhd || pw >= 3000;
  w.DEVICE = {
    is4k: is4k,
    label: is4k ? '4K UHD' : (pw >= 1900 ? 'Full HD' : 'HD'),
    size: m ? m[1] + '×' + m[2] : (uhd ? '3840×2160' : '')
  };
})(window);
