# Tổng Tài TV – bản xem trên trình duyệt (2.17.1, miễn phí, GitHub Pages)

## CÀI ĐẶT LÊN GITHUB PAGES

1. Mở repository **tongtai-player** trên github.com (Public, đang có index.html, kenh.html, channels.json).
2. Add file → Upload files → kéo **thư mục `app`** (trong thư mục này) vào → Commit changes.
   Kết quả: tongtai-player/app/index.html, app/version.json, app/js/…, app/css/…, app/img/…
   Nhớ tải cả file **version.json** (để nút "Kiểm tra bản mới" trên TV biết có bản mới).
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

Cập nhật bản mới: tải đè thư mục app lên GitHub như bước 2 (gồm cả version.json), chờ 1–2 phút rồi tải lại trang (kéo xuống hoặc F5).

## HƯỚNG DẪN SỬ DỤNG (bản 2.17.1)

Phần này dùng chung cho TV (Samsung, Hisense/Android TV) và bản web (máy tính, điện thoại). Trên TV dùng remote; trên máy tính bấm chuột hoặc dùng bàn phím (mũi tên, Enter, Esc); trên điện thoại chạm và vuốt.

### 1. Mở app

- **Màn hình khởi động**: logo vương miện vàng, thanh tiến độ và dòng "Đang lấy phim mới… 3/38 kênh". Mạng chậm thì bấm **OK** để vào ngay, phim vẫn tải tiếp phía sau.
- Hiện bao lâu: Cài đặt → Giao diện → **Màn hình khởi động**: 1, 2, **3 giây** (mặc định), 5, 8 giây, hoặc "Đến khi tải xong".
- **Ai đang xem?**: chọn hồ sơ của mình (Guest hoặc hồ sơ đã tạo). Không muốn bị hỏi: Cài đặt → Hồ sơ người xem → "Hỏi Ai đang xem? khi mở app" → Tắt.
- Lần đầu: Cài đặt → Kết nối → **YouTube API key** → nhập key → Lưu. Samsung điền thêm **PLAYER_HOST**.
- **Đồng hồ** góc trên: Cài đặt → Giao diện → Đồng hồ → **24 giờ** (14:05) hoặc **12 giờ** (2:05 PM, 12:00 AM). Mọi giờ trong app (sao lưu, hạn mức, thống kê) đổi theo.

### 2. Remote

| Nút | Tác dụng |
|---|---|

| Mũi tên | Di chuyển giữa phim, nút, tab. Ô đang chọn có viền trắng |
| OK | Chọn, mở phim, tạm dừng/phát |
| OK 2 lần nhanh | Về Trang chủ từ bất kỳ đâu |
| Giữ lâu OK (1 giây) | Hỏi xóa: phim ở Lịch sử, kênh, hồ sơ |
| Back | Quay lại. Ở Trang chủ bấm 2 lần để thoát |
| Play/Pause, Tua | Dùng khi đang xem phim |

### 3. Hồ sơ người xem

- Mỗi hồ sơ có **lịch sử, phim xem dở, danh sách, phim đã xem, 5 từ khóa tìm gần nhất và thống kê** riêng.
- **Thêm**: màn hình "Ai đang xem?" → "+ Thêm" → gõ tên → Lưu → chọn 1 trong **25 hình thú kawaii** (mèo, chó, gấu trúc, thỏ, capybara, rùa, kỳ lân…). Tối đa 8 hồ sơ.
- **Đổi hồ sơ**: ô tròn hình con thú ở góc trên bên phải (điện thoại: menu ☰ → dòng có hình con thú → Đổi hồ sơ).
- **Cài đặt riêng từng hồ sơ**: giao diện Tối/Sáng, đồng hồ, chủ đề theo mùa, hiệu ứng rơi, tự phát phim tiếp theo, ẩn phim đã xem, các hàng Trang chủ và lọc lứa tuổi là của RIÊNG hồ sơ đang xem (dòng có hình con thú trong Cài đặt). Mỗi người chỉnh theo ý mình, đổi hồ sơ là đổi theo. Các mục khác (API key, kênh, cập nhật, sao lưu, mã PIN người lớn) dùng chung cả máy.
- **Đổi hình**: nút "Đổi hình cho …" ở màn hình Ai đang xem, hoặc Cài đặt → Hồ sơ người xem → Hình đại diện.
- **Xóa hồ sơ**: giữ lâu OK trên hồ sơ (điện thoại, máy tính: giữ lâu để hiện dấu ✕ rồi bấm ✕). Guest không xóa được.
- **Mã PIN riêng từng hồ sơ**: Cài đặt → Hồ sơ người xem → **Mã PIN của hồ sơ này** → nhập mã 4–8 số hai lần. Hồ sơ có 🔒 phải nhập mã mới mở hoặc xóa được. Đổi mã: nhập mã cũ rồi mã mới; để trống mã mới = bỏ mã. Quên mã: dùng mã PIN người lớn (mục 9).

### 3b. Kênh yêu thích
- Mỗi hồ sơ chọn kênh yêu thích riêng. Phim mới của các kênh này hiện ở hàng **"Từ kênh yêu thích của …"** ngay dưới "Tiếp tục xem", ảnh lớn đầu Trang chủ cũng lấy từ đây, và phim tự phát tiếp theo ưu tiên các kênh này.
- Cách chọn: tab **Kênh** → mở một kênh → **"☆ Yêu thích"**; hoặc trang chi tiết phim → **"☆ Thích kênh này"**; hoặc **Cài đặt → Hồ sơ người xem → Kênh yêu thích** (danh sách mọi kênh, OK để bật/tắt ★).
- Ở tab Kênh, kênh yêu thích có ★ và nằm đầu danh sách. Ẩn hàng này: Cài đặt → Trang chủ → "Từ kênh yêu thích".

### 4. Trang chủ

- Ảnh lớn đầu trang là phim mới nhất: "Xem ngay" hoặc "Chi tiết".
- Các hàng: Tiếp tục xem, Từ kênh yêu thích, Phim mới cập nhật, Đang hot, Phim lẻ hay, Đề xuất, Top 10 trong tuần, Hoạt hình.
- **Phim đã xem hết** (từ 92%) không hiện lại ở Phim mới, Đang hot, Đề xuất, Phim lẻ hay. Nơi khác có dấu **"✓ Đã xem"**. Tắt: Cài đặt → Trang chủ → Ẩn phim đã xem hết.

### 5. Xem phim

- OK: tạm dừng/phát. Trái/phải: tua 10 giây (bấm liên tục để tua nhanh).
- Mũi tên **lên**: hiện các nút −10s, +10s, Danh sách, Bỏ phim, Phụ đề, **Hẹn giờ**, Chất lượng. Bấm ▲ 2 lần nhanh: bật/tắt phụ đề tiếng Việt.
- **Hẹn giờ tắt**: mỗi lần OK đổi 30 phút → 60 phút → 90 phút → Hết phim này → Tắt. Còn 1 phút app nhắc; hết giờ phim tạm dừng, OK để xem tiếp. 15 phút không ai bấm thì tự đóng.
- **Tự phát phim tiếp theo**: hết phim hiện phim/tập kế tiếp, đếm ngược 30 giây, nút **"Phát ngay"** và **"Hủy"**. Tắt: Cài đặt → Xem phim.
- Back để thoát phim; app nhớ chỗ đang xem.

### 6. Chi tiết phim

- "Tiếp tục xem" / "Xem từ đầu", "+ Danh sách", **"Đánh dấu đã xem" / "Đã xem ✓"**, "Bình luận".
- Hoạt hình nhiều tập: chọn tập trong "Danh sách tập", hết tập tự sang tập sau.

### 7. Tìm kiếm

- Chọn chữ trên bàn phím màn hình, không cần gõ dấu, rồi "Tìm kiếm".
- **"Tìm gần đây"**: 5 từ khóa vừa tìm, chọn để tìm lại ngay. "Xóa lịch sử tìm" để xóa.

### 8. Lịch sử và Thống kê xem

- Lịch sử: "Đã xem gần đây" và "Danh sách của tôi". Xóa một phim: TV giữ lâu OK; điện thoại, máy tính **giữ lâu** trên ảnh phim để hiện dấu ✕ rồi bấm ✕.
- **Thống kê xem** (nút ở đầu trang Lịch sử, hoặc Cài đặt → Hồ sơ người xem): chọn **7 ngày** hoặc **30 ngày**. Có 4 ô số liệu (tổng, trung bình mỗi ngày, hôm nay, phim xem hết; bản 7 ngày so với 7 ngày trước), biểu đồ cột theo ngày có đường trung bình (chọn từng cột để xem chi tiết ngày đó), **Nhận xét** tự động (ngày xem nhiều nhất, khung giờ cao điểm, chuỗi ngày liên tiếp), **Khung giờ hay xem** trong ngày, 5 kênh xem nhiều nhất và **so sánh các hồ sơ**. Chỉ tính lúc phim đang chạy; mỗi thiết bị tính riêng, giữ 35 ngày. Xóa thống kê cần mã PIN.

### 9. Lọc theo lứa tuổi và mã PIN

- Cài đặt → **Lọc theo lứa tuổi** → "Chỉ hiện phim phù hợp lứa tuổi" (mặc định **Tắt**, bật khi cần): ẩn phim có từ khóa nhạy cảm trong tên/mô tả ở mọi trang.
- **Từ khóa nhạy cảm**: thêm/xóa từ khóa. Gõ không dấu cũng được ("ma tuy" khớp "Ma Túy").
- **Mã PIN** (mặc định **1234**) cần khi: tắt lọc, sửa từ khóa, khôi phục mặc định, xóa thống kê, đổi PIN.
- **Đổi PIN**: Cài đặt → Lọc theo lứa tuổi → Mã PIN → nhập PIN cũ → PIN mới (4–8 số) hai lần. PIN mới đồng bộ sang các máy đã đăng nhập.
- **Quên PIN**: mở `js/config.js`, điền `PIN_FORCE: '1234'`, tải lại bản web / cài lại app TV một lần, rồi để trống lại.

### 10. Chủ đề theo mùa và ngày lễ

- Cài đặt → **Chủ đề theo mùa và ngày lễ** → Chủ đề: **Tự động** (đổi theo ngày), **Tắt**, hoặc chọn tay.
- 17 chủ đề: Tết, Valentine, Năm mới, Giáng sinh, 8/3, 20/10, 1/6, Ngày của Mẹ, Ngày của Cha, Trung thu, Halloween, Lễ Tạ Ơn, Hoa anh đào, Xuân, Hạ, Thu, Đông. Ngày lễ ưu tiên hơn mùa; Tết và Trung thu theo âm lịch.
- Có hiệu ứng rơi (tuyết, hoa, lá, trái tim…), dây đèn, lồng đèn, hình nhỏ trên logo, lời chúc. TV chậm: tắt **"Hiệu ứng rơi"**.

### 11. Đồng bộ, sao lưu

- **Đăng nhập Google** hoặc **Token GitHub** (Cài đặt): lịch sử, danh sách, hồ sơ, cài đặt, mã PIN giống nhau trên mọi máy. API key và PLAYER_HOST giữ riêng từng máy.
- **Sao lưu tự động hằng tuần** (cần đăng nhập ở trên): Google Drive giữ 4 bản gần nhất; GitHub giữ mọi bản trong Revisions của Gist tongtai-sync. App báo "Đã sao lưu lúc…".
- "Sao lưu ngay", "Khôi phục bản sao lưu" (gộp, không xóa gì).
- **Mã sao lưu** (không cần tài khoản): Cài đặt → Xuất mã / Nhập mã, hoặc quét mã QR.

### 12. Khi có lỗi

- Xóa kênh (Cài đặt → Kênh theo dõi): TV giữ lâu OK; điện thoại, máy tính giữ lâu trên dòng kênh để hiện ✕.
- Thông báo lỗi ghi rõ nguyên nhân và cách xử lý: mất mạng, mạng chậm, hết hạn mức YouTube (kèm giờ làm mới, khoảng 15:00 giờ Việt Nam), API key sai, key chưa bật YouTube Data API v3, key bị giới hạn.
- **Nhật ký lỗi**: Cài đặt → Hỗ trợ → Nhật ký lỗi (50 dòng gần nhất, lỗi màu đỏ). **"Sao chép để gửi"**: máy tính/điện thoại chép vào bộ nhớ tạm; TV hiện mã QR để quét bằng điện thoại rồi gửi qua Zalo/Messenger.
- Phim lỗi: nút "Bỏ phim" để ẩn. Hiện lại: Lịch sử hoặc Cài đặt → "Hiện lại phim đã bỏ".

### 13. Thông tin và bản mới

- Tab **Thông tin** → khung **Giới thiệu**: phiên bản, tác giả Ryan Nguyen, lưu ý bản quyền, nút **"Kiểm tra bản mới"**.
- Nút này đọc file `version.json` đi kèm bản web trên GitHub Pages: để nguyên file này khi tải thư mục app lên. Có bản mới: web tải lại trang là xong; TV cài lại theo phần cài đặt bên dưới. Android không có PLAYER_HOST thì điền `UPDATE_URL` trong `config.js`.
- Cũng ở tab Thông tin: hạn mức YouTube đã dùng hôm nay, giờ làm mới, lần sao lưu gần nhất.

## LỊCH SỬ PHIÊN BẢN

- Phiên bản 2.17.1 (09/11/2026): Cài đặt riêng từng hồ sơ (giao diện, đồng hồ, chủ đề, xem phim, các hàng Trang chủ, lọc lứa tuổi); menu ☰ trên điện thoại hiện hình con thú của hồ sơ.
- Phiên bản 2.17.0 (09/11/2026): Mã PIN riêng cho từng hồ sơ (🔒); dấu ✕ xóa (lịch sử, kênh, hồ sơ) chỉ hiện khi giữ lâu, bỏ nút "Xóa từng phim"; lọc lứa tuổi mặc định Tắt; chọn thời gian màn hình khởi động (mặc định 3 giây).
- Phiên bản 2.16.0 (09/11/2026): kênh yêu thích riêng từng hồ sơ; hàng "Từ kênh yêu thích" đầu Trang chủ; nút ☆ Yêu thích ở trang kênh và trang chi tiết phim; Cài đặt → Kênh yêu thích.
- Phiên bản 2.15.2 (09/11/2026): chọn đồng hồ 12 giờ (AM/PM) hoặc 24 giờ trong Cài đặt → Giao diện.
- Phiên bản 2.15.1 (09/11/2026): trang Thống kê xem làm lại kiểu bảng điều khiển: chọn 7/30 ngày, so sánh với 7 ngày trước, biểu đồ có đường trung bình và chi tiết từng ngày, nhận xét tự động, khung giờ hay xem.
- Phiên bản 2.15.0 (09/11/2026):
- Chủ đề theo mùa và ngày lễ (Cài đặt → Chủ đề theo mùa và ngày lễ): Tự động đổi theo ngày, Tắt, hoặc chọn tay. 17 chủ đề: Tết Nguyên Đán, Valentine, Năm mới, Giáng sinh, Quốc tế Phụ nữ 8/3, Phụ nữ Việt Nam 20/10, Quốc tế Thiếu nhi 1/6, Ngày của Mẹ, Ngày của Cha, Trung thu, Halloween, Lễ Tạ Ơn, Hoa anh đào, Mùa xuân, Mùa hè, Mùa thu, Mùa đông. Ngày lễ được ưu tiên hơn mùa.
- Mỗi chủ đề có: hiệu ứng rơi hoặc bay lên (tuyết, hoa mai, hoa anh đào, lá thu, trái tim, bí ngô và dơi, bóng bay, lồng đèn, bong bóng…), dây đèn nhấp nháy dưới thanh trên cùng (Noel, Năm mới, Tết, Halloween, Trung thu, 1/6), lồng đèn treo (Tết, Trung thu), hình nhỏ trên logo, viền màu theo dịp, lời chúc ở màn hình khởi động và một lần mỗi ngày khi mở app.
- Tết và Trung thu tính theo âm lịch (đã có sẵn ngày tới năm 2035). TV chạy chậm: tắt "Hiệu ứng rơi", vẫn giữ dây đèn và hình trên logo.

- Phiên bản 2.14.1 (09/11/2026):
- Màn hình khởi động mới phong cách "tổng tài": nền đen ánh vàng, logo bật ra, vương miện rơi xuống, nút phát hiện lên, ánh kim lướt qua logo, hai vòng vàng xoay quanh, chữ "Tổng Tài TV" ánh kim, hạt vàng lấp lánh, thanh tiến độ có vệt sáng. Vẫn hiện "Đang lấy phim mới… n/N kênh" và bấm OK để vào ngay.

- Phiên bản 2.14.0 (09/11/2026):
- Thống kê xem (Lịch sử → nút "Thống kê xem", hoặc Cài đặt → Hồ sơ người xem → Thống kê xem): số phút xem hôm nay, 7 ngày qua, trung bình mỗi ngày, số phim xem hết; biểu đồ cột 7 ngày; 5 kênh xem nhiều nhất; so sánh thời gian xem của tất cả hồ sơ. Chỉ tính lúc phim đang chạy. Lưu riêng trên từng thiết bị, giữ 35 ngày. Xóa thống kê cần mã PIN.

- Phiên bản 2.13.0 (09/11/2026):
- Đổi mã PIN: Cài đặt → Lọc theo lứa tuổi → Mã PIN. Nhập PIN cũ (mặc định 1234), rồi PIN mới 4–8 số hai lần. PIN dùng cho: tắt lọc lứa tuổi, sửa từ khóa nhạy cảm, khôi phục mặc định. PIN mới được đồng bộ sang các máy cùng tài khoản Google/GitHub, và chỉ lưu dạng mã hóa (không đọc được trong mã sao lưu).
- Quên mã PIN: mở js/config.js, điền PIN_FORCE: '1234' (hoặc mã bạn muốn), tải lại bản web / cài lại app TV một lần; app đặt lại PIN theo mã đó. Sau đó để PIN_FORCE trống lại như cũ.

- Phiên bản 2.12.0 (09/11/2026):
- Hồ sơ người xem có 25 hình thú kawaii (mèo, chó, gấu trúc, thỏ, cáo, capybara, rùa, kỳ lân…). Thêm hồ sơ: gõ tên, rồi chọn hình. Màn hình "Ai đang xem?" có nút "Đổi hình" cho hồ sơ đang xem; hoặc Cài đặt → Hồ sơ người xem → Hình đại diện. Hình được đồng bộ cùng hồ sơ.

- Phiên bản 2.11.0 (09/11/2026):
- Hẹn giờ tắt: đang xem phim bấm ▲, chọn nút "Hẹn giờ" (30 → 60 → 90 phút → Hết phim này → Tắt). Hết giờ phim tạm dừng, OK để xem tiếp; còn 1 phút app nhắc trước. 15 phút không ai bấm thì tự đóng trình phát.
- Đã xem: phim xem hết (từ 92%) có dấu "✓ Đã xem" và không hiện lại ở Phim mới, Đang hot, Đề xuất, Phim lẻ hay (tắt trong Cài đặt → Trang chủ → Ẩn phim đã xem hết). Trang chi tiết có nút "Đánh dấu đã xem" / "Đã xem ✓". Riêng từng hồ sơ.

- Phiên bản 2.10.0 (09/11/2026):
- Màn hình khởi động có logo và tiến độ "Đang lấy phim mới… 3/38 kênh". Bấm OK để vào ngay nếu mạng chậm.
- Hồ sơ người xem: mở app hỏi "Ai đang xem?" (Guest + nút Thêm, tối đa 8 hồ sơ). Mỗi hồ sơ có lịch sử, phim xem dở, danh sách và lịch sử tìm kiếm riêng; đồng bộ Google/GitHub theo từng hồ sơ. Đổi hồ sơ: ô tròn chữ cái góc trên bên phải, hoặc Cài đặt → Hồ sơ người xem. Tắt câu hỏi khi mở app trong Cài đặt.
- Nhật ký lỗi: Cài đặt → Hỗ trợ → Nhật ký lỗi (50 dòng gần nhất, lỗi màu đỏ). "Sao chép để gửi": máy tính/điện thoại chép vào bộ nhớ tạm; TV hiện mã QR để quét bằng điện thoại.
- Sao lưu tự động hằng tuần vào Google Drive (giữ 4 bản) hoặc GitHub Gist (giữ mọi bản trong Revisions), báo "Đã sao lưu lúc…". Có "Sao lưu ngay" và "Khôi phục bản sao lưu" (gộp, không xóa gì).
- Thông báo lỗi tiếng Việt dễ hiểu kèm cách xử lý: mất mạng, mạng chậm, hết hạn mức (giờ làm mới), API key sai, key chưa bật YouTube Data API, key bị giới hạn.
- Trang Thông tin có khung "Giới thiệu": phiên bản, tác giả Ryan Nguyen, nút "Kiểm tra bản mới", lưu ý bản quyền. Nút này đọc file version.json đi kèm bản web (để nguyên file version.json trong thư mục app khi tải lên GitHub). TV tự tìm ở PLAYER_HOST; Android không có PLAYER_HOST thì điền UPDATE_URL trong config.js.
- Lọc theo lứa tuổi: ẩn phim có từ khóa nhạy cảm trong tên/mô tả ở mọi trang (bật sẵn). Từ khóa do bạn tự quản lý trong Cài đặt → Lọc theo lứa tuổi. Tắt lọc và sửa từ khóa cần mã PIN 1234.
- Tìm kiếm nhớ 5 từ khóa gần nhất (riêng từng hồ sơ) để chọn lại nhanh trên TV, có nút "Xóa lịch sử tìm".
- Tự phát phim tiếp theo: hết phim hiện đếm ngược 30 giây với nút "Phát ngay" và "Hủy" (hoạt hình: tập kế tiếp). Tắt trong Cài đặt → Xem phim.

- Phiên bản 2.9.23 (09/11/2026): "Khôi phục mặc định" phải nhập mã PIN 1234 (hiện dấu chấm) mới thực hiện.

- Phiên bản 2.9.22 (09/11/2026): xóa kênh (Cài đặt → Kênh theo dõi: dấu ✕ trên web, giữ lâu OK trên TV; trang Kênh cũng giữ OK để xóa, kể cả kênh dấu "?"); khi đang xem phim có thêm nút "Danh sách" (thêm/bỏ khỏi Danh sách của tôi) cạnh nút Bỏ phim.

- Phiên bản 2.9.21 (09/11/2026): thêm kênh hoạt hình @GÓCCHILLPHẾT.

- Phiên bản 2.9.20 (09/11/2026): trang một kênh báo rõ vì sao chưa có phim (video bị tắt nhúng, quá ngắn...); kênh hoạt hình hiện đúng mức tối thiểu 5 phút; nếu lần trước kênh rỗng thì lần sau đọc lại đầy đủ thay vì chỉ đọc phần mới.

- Phiên bản 2.9.19 (08/11/2026): khi mở phim, app nhắc một lần mỗi lần mở app: nếu có quảng cáo thì chờ nút "Bỏ qua" của YouTube hiện rồi bấm OK.

- Phiên bản 2.9.18 (08/11/2026): lỗi 403 khi đồng bộ Google Drive giờ nói rõ nguyên nhân (chưa bật Drive API, thiếu quyền, hay vượt hạn mức) thay vì chỉ báo "Chưa bật Google Drive API".

- Phiên bản 2.9.17 (07/11/2026): Lịch sử trên TV: giữ lâu nút giữa (OK) của remote trên một phim sẽ hiện hộp hỏi xóa phim đó (remote Samsung không có nút vàng); mã QR sao lưu trở lại dạng chữ thường, bỏ cách dùng đường link.

- Phiên bản 2.9.16 (07/11/2026): Lịch sử: nút vàng trên remote (phím Y trên máy tính) xóa từng phim, ✕ luôn thấy rõ trên máy tính; mã QR sao lưu là đường link (#bk=) mở thẳng bản web và tự nhập; thêm WEB_URL trong config.js cho bản TV.

- Phiên bản 2.9.15 (07/11/2026): đăng nhập Google trên TV hiện mã lỗi gốc và giải thích rõ nguyên nhân; hướng dẫn tạo Client ID loại TV.

- Phiên bản 2.9.14 (07/11/2026): Xuất mã sao lưu có mã QR (bản gọn: phim yêu thích + phim xem gần nhất, quét bằng camera điện thoại); Nhập mã có nút "Quét mã QR" (Chrome trên điện thoại/máy tính có camera) và nhận cả mã TTQR1. Máy nhận cần API key để tải lại tên/ảnh phim.

- Phiên bản 2.9.13 (06/11/2026): sửa video bị cắt dọc trên Hisense (TV Android): không dùng transform phóng khung nữa, để WebView tự phóng; trang Thông tin hiện dòng "Khung hình" để chẩn đoán.

- Phiên bản 2.9.12 (06/11/2026): có đủ cả 3 cách giữ lịch sử: đăng nhập Google, token GitHub (Gist) và Xuất/Nhập mã sao lưu.

- Phiên bản 2.9.11 (06/11/2026): Cài đặt có "Xuất mã sao lưu" và "Nhập mã sao lưu" (chép lịch sử, tiến độ, danh sách sang máy khác, không cần đăng nhập).

- Phiên bản 2.9.10 (06/11/2026): bỏ đồng bộ bằng token GitHub cho đơn giản; chỉ giữ đăng nhập Google để lưu và lấy lại lịch sử, tiến độ, danh sách.

- Phiên bản 2.9.9 (06/11/2026): bấm logo về Trang chủ; thêm 3 kênh phim lẻ (@KKS-phimlehay, @moviepublic, @MoxiViet); trang Kênh có bảng Top 3 kênh trong tuần (phim ngắn, hoạt hình, phim lẻ hay); sửa video bị cắt dọc trên TV Android (Hisense).

- Phiên bản 2.9.8 (06/11/2026): ảnh lớn trang chủ hiện đủ khung 16:9 (không bị cắt/zoom); mỗi hàng phim có nút mũi tên ◀ ▶ khi rê chuột (máy tính) để lướt tới/lui.

- Phiên bản 2.9.7 (06/11/2026): thanh tua trong trình phát kéo được bằng ngón tay / chuột (chạm vào thanh cũng nhảy tới chỗ đó); trên máy tính, bấm ▲ ở hàng đầu một trang sẽ cuộn hẳn lên đầu trang (thấy ảnh, tên phim), bấm lần nữa mới lên menu.
- Phiên bản 2.9.6 (06/11/2026): “Top 10 phim trong tuần” có thêm ở Trang chủ (ngay dưới “Đề xuất cho bạn”); Cài đặt → Trang chủ → Top 10 phim trong tuần để Hiện / Ẩn (áp dụng cho cả Trang chủ và trang chi tiết).
- Phiên bản 2.9.5 (06/11/2026): trang chi tiết phim, dưới hàng “Có thể bạn thích” có thêm “Top 10 phim trong tuần” (phim ra trong 7 ngày, từ tất cả kênh phim ngắn theo dõi, xem nhiều nhất trước).
- Phiên bản 2.9.4 (06/11/2026): thêm đồng bộ bằng token GitHub (Cài đặt → Đồng bộ bằng GitHub), dùng được song song hoặc thay cho đăng nhập Google. Token classic chỉ tick quyền gist; dữ liệu nằm trong Gist riêng tư tên tongtai-sync; token chỉ lưu trên máy.
Lỗi Google “Access blocked … has not completed the Google verification process”: màn hình đồng ý OAuth đang ở chế độ Testing. Vào Google Cloud → Google Auth Platform → Audience → thêm email của bạn vào Test users, hoặc bấm Publish app. Client ID không đổi.

- Phiên bản 2.9.3 (05/11/2026): mọi thẻ phim đều có nhãn Danh mục (kể cả hàng “Đang hot” và trên điện thoại); nhãn AI nhận biết theo cờ “nội dung tổng hợp” của YouTube (đáng tin hơn đoán chữ) và nhiều tên công cụ AI; đổi Chất lượng có tác dụng (app đổi kích thước khung phát, YouTube mất vài giây mới đổi); nút “Bình luận” trong trang chi tiết phim (Hay nhất / Mới nhất, cần API key, 1 đơn vị hạn mức mỗi lần). Sau khi cập nhật, bấm Cài đặt → Cập nhật ngay để nhãn AI được tính lại.
- Phiên bản 2.9.2: bấm ▲ 2 lần nhanh bật/tắt phụ đề; bỏ tên GitHub và đầu API key khỏi mục Hướng dẫn; giữ nguyên phần Client ID như trước.
- Phiên bản 2.9.1: số thứ hạng “Đang hot” nằm trong ảnh (điện thoại); sửa lỗi dán key không hiện; nhập API key trong Cài đặt; thêm giao diện Sáng/Tối.
