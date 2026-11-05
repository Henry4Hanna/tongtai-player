# Tổng Tài TV – bản xem trên trình duyệt (miễn phí, GitHub Pages)

1. Mở repository **tongtai-player** trên github.com (Public, đang có index.html, kenh.html, channels.json).
2. Add file → Upload files → kéo **thư mục `app`** (trong thư mục này) vào → Commit changes.
   Kết quả: tongtai-player/app/index.html, app/js/…, app/css/…, app/img/…
3. Chờ 1–2 phút, mở: https://TEN-GITHUB-CUA-BAN.github.io/tongtai-player/app/
4. Lần đầu trên mỗi trình duyệt: Cài đặt → Kết nối → YouTube API key → dán (⌘V / Ctrl+V, hoặc nhấn giữ → Dán trên iPhone) → Lưu.
   Key chỉ lưu trong trình duyệt của bạn, KHÔNG nằm trên GitHub.
   Nếu chưa có key, bấm xem phim sẽ hiện thông báo; bấm vào thông báo để mở thẳng Cài đặt.
5. Kênh được đọc từ ../channels.json (cùng repository) nên không tốn hạn mức tìm kênh.

Không cần PLAYER_HOST: bản web chạy trên https nên YouTube cho phát bình thường.

Bảo vệ API key (khuyên làm): tạo một key RIÊNG cho bản web trong Google Cloud → Credentials,
Application restrictions = Websites, thêm `https://TEN-GITHUB-CUA-BAN.github.io/*`; API restrictions = YouTube Data API v3.
Key này chỉ chạy trên trang của bạn. Giữ key cũ (không giới hạn website) cho TV.

Điều khiển: bấm chuột/chạm để mở, lăn chuột/vuốt để di chuyển, nút “‹ Quay lại” góc dưới trái.
Bàn phím: mũi tên, Enter, Esc; Enter 2 lần nhanh = về Trang chủ.

iPhone: mở địa chỉ trên bằng Safari → giao diện điện thoại tự bật. Bấm nút Chia sẻ → “Thêm vào MH chính” để có biểu tượng Tổng Tài TV như một app.

Đăng nhập Google (đồng bộ với TV): điền GOOGLE_WEB_CLIENT_ID trong app/js/config.js (xem README mục ĐỒNG BỘ GOOGLE), rồi tải lại thư mục app lên GitHub.
Client ID không phải bí mật, để công khai được. KHÔNG điền client secret ở bản web.
API key, PLAYER_HOST và lựa chọn giao diện chỉ lưu trên thiết bị này, không đồng bộ lên Google Drive.

Giao diện Tối / Sáng: Cài đặt → Giao diện → bấm để đổi giữa Tối, Sáng, Tự động (theo chế độ của điện thoại/máy tính).
Phụ đề: khi đang xem phim, bấm ▲ 2 lần nhanh để bật/tắt phụ đề tiếng Việt.

Phiên bản 2.9.2 (05/11/2026): bấm ▲ 2 lần nhanh bật/tắt phụ đề; bỏ tên GitHub và đầu API key khỏi mục Hướng dẫn; giữ nguyên phần Client ID như trước.
Phiên bản 2.9.1: số thứ hạng “Đang hot” nằm trong ảnh (điện thoại); sửa lỗi dán key không hiện; nhập API key trong Cài đặt; thêm giao diện Sáng/Tối.
