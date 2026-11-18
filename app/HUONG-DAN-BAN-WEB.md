# Tổng Tài TV – bản xem trên trình duyệt (2.26.2, miễn phí, GitHub Pages)

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

## HƯỚNG DẪN SỬ DỤNG (bản 2.26.2)

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
- **Cài đặt riêng từng hồ sơ**: giao diện Tối/Sáng, đồng hồ, nhạc nền, chủ đề theo mùa, hiệu ứng rơi, tự phát phim tiếp theo, ẩn phim đã xem, các hàng Trang chủ và lọc lứa tuổi là của RIÊNG hồ sơ đang xem (dòng có hình con thú trong Cài đặt). Mỗi người chỉnh theo ý mình, đổi hồ sơ là đổi theo. Các mục khác (API key, kênh, cập nhật, sao lưu, mã PIN người lớn) dùng chung cả máy.
- **Giữ lâu trên một hồ sơ** (TV: giữ lâu OK) ở màn hình Ai đang xem để mở menu: **Đặt / Đổi / Bỏ mã PIN**, **Đổi hình**, **Xóa hồ sơ** (Guest không xóa được). Đổi hình cũng làm được ở Cài đặt → Hồ sơ người xem → Hình đại diện.
- Khi đang ở màn hình Ai đang xem, thanh tab (Lịch sử, Kênh, Thể loại, Cài đặt…) bị khóa: chỉ bấm được trong khung chọn hồ sơ. Lúc mở app phải chọn một hồ sơ; mở từ ô hình hồ sơ thì có nút "‹ Quay lại" trong khung.
- **Mã PIN riêng từng hồ sơ**: giữ lâu trên hồ sơ → **Đặt mã PIN** (hoặc Cài đặt → Hồ sơ người xem → **Mã PIN của hồ sơ này**) → nhập mã 4–8 số hai lần. Hồ sơ có 🔒 phải nhập mã mới mở hoặc xóa được. **Bỏ mã PIN khi không cần**: giữ lâu trên hồ sơ ở màn hình Ai đang xem → **🔓 Bỏ mã PIN**, hoặc mở hồ sơ đó rồi vào Cài đặt → Hồ sơ người xem → **Mã PIN của hồ sơ này** → **Bỏ mã PIN**; nhập mã cũ là xong, dấu 🔒 biến mất. Đổi mã cũng ở hai chỗ này. Quên mã: dùng mã PIN người lớn (mục 9).

- **Xem chung**: màn hình Ai đang xem? → **👥 Xem chung** → chọn 2 đến 4 người → **▶ Xem chung: …**. Góc trên hiện hình của mọi người. Phim, phim xem dở và thời gian xem ghi cho tất cả; hàng Đề xuất gợi ý theo sở thích chung. Thôi xem chung: chọn lại một hồ sơ.

### 3a. Giới hạn giờ xem
- Cài đặt → Hồ sơ người xem → **Giới hạn giờ xem** (cần mã PIN người lớn) → chọn hồ sơ. Đặt **giờ xem mỗi ngày** (T2–T6), **cuối tuần**, **khung giờ được xem** (ví dụ 18:00–21:00) và **nhắc trước** 5 hoặc 10 phút.
- Sắp hết giờ: góc màn hình nhắc "còn 5 phút". Hết giờ hoặc ngoài khung giờ: phim dừng, hiện màn hình "Hết giờ xem phim hôm nay"; vẫn **nghe nhạc** hoặc **đổi hồ sơ** được.
- **Người lớn: thêm giờ** → nhập mã PIN → cho thêm 15 / 30 / 60 phút trong hôm nay.
- Giới hạn đồng bộ qua Google nên dùng chung trên mọi máy. Xem chung thì người có giới hạn chặt nhất quyết định.

### 3b. Kênh yêu thích
- Mỗi hồ sơ chọn kênh yêu thích riêng. Phim mới của các kênh này hiện ở hàng **"Từ kênh yêu thích của …"** (mặc định **ẩn**, bật trong Cài đặt → Trang chủ), ảnh lớn đầu Trang chủ cũng lấy từ đây, và phim tự phát tiếp theo ưu tiên các kênh này.
- Cách chọn: tab **Kênh** → mở một kênh → **"☆ Yêu thích"**; hoặc trang chi tiết phim → **"☆ Thích kênh này"**; hoặc **Cài đặt → Hồ sơ người xem → Kênh yêu thích** (danh sách mọi kênh, OK để bật/tắt ★).
- Ở tab Kênh, kênh yêu thích có ★ và nằm đầu danh sách. Hiện/ẩn hàng này: Cài đặt → Trang chủ → "Từ kênh yêu thích".
- **Phim mới của kênh yêu thích**: tab Kênh có **chấm đỏ** với tổng số phim mới; mỗi kênh yêu thích có số đỏ và dòng "3 phim mới" (tính từ lần bạn mở kênh đó gần nhất). Mở kênh là số được đặt lại.

### 4. Trang chủ
- **Tổng tài của tuần**: khi không có phim xem dở, ảnh lớn đầu Trang chủ là phim cả nhà xem nhiều nhất 7 ngày qua, kèm một câu thoại tổng tài.
- **Có tập mới**: phim bộ (nhiều tập) bạn đang theo dõi ra tập mới thì hiện ở hàng riêng, có nhãn đỏ "Tập 13 mới".
- **Câu đố tổng tài**: dải tím trên Trang chủ → "Chơi ngay". Mỗi câu che một chữ trong câu thoại, chọn 1 trong 4 chữ; 10 câu mỗi lượt, đúng +10 điểm, bảng điểm hôm nay theo hồ sơ.
- **Báo cáo tuần**: thứ Hai đến thứ Tư, hồ sơ người lớn (chọn ở Cài đặt → Hồ sơ người xem → Hồ sơ xem báo cáo tuần, cần PIN) thấy thẻ báo cáo tuần trước của cả nhà. Bấm "Đã xem" để ẩn đến tuần sau.
- **Xem tiếp**: phim bạn xem dở gần nhất (trong 4 ngày) lên ảnh lớn đầu Trang chủ, ghi "còn 12 phút" kèm thanh tiến độ; nút **Xem tiếp** hoặc **Xem từ đầu**.

- Ảnh lớn đầu trang là phim mới nhất: "Xem ngay" hoặc "Chi tiết".
- Các hàng: Tiếp tục xem, Từ kênh yêu thích (mặc định ẩn), Phim mới cập nhật, Đang hot, **Đề xuất cho <tên hồ sơ>**, Top 10 trong tuần, Phim lẻ hay, Hoạt hình.
- **Đề xuất theo hồ sơ**: app xem lịch sử, danh sách và phim đã xem hết của hồ sơ đang xem, chọn 2 thể loại người đó hay xem nhất (ví dụ "Theo thể loại hay xem: Xuyên không · Trùng sinh"). Hồ sơ mới chưa xem gì thì gợi ý 2 thể loại đổi theo ngày.
- **Sắp xếp các hàng** (riêng từng hồ sơ): Cài đặt → Trang chủ → **Sắp xếp các hàng**. TV: chọn một hàng, nhấn OK để nhấc lên, ▲ ▼ để di chuyển, nhấn OK để đặt xuống. Điện thoại / máy tính: bấm ▲ ▼. Thay đổi **chưa lưu ngay**: bấm **👁 Xem trước** để xem Trang chủ mới (ảnh lớn đầu trang và từng hàng theo thứ tự mới), thấy ưng thì **Lưu thứ tự này**, chưa ưng thì **Sửa tiếp**. Có **Bỏ thay đổi** và **Mặc định**. Chưa lưu mà bấm Quay lại thì app nhắc; bấm Quay lại lần nữa là bỏ thay đổi. Các dòng Hiện/Ẩn bên dưới cũng xếp theo đúng thứ tự này. Ảnh lớn đầu trang luôn ở trên cùng.
- **Phim đã xem hết** (từ 92%) không hiện lại ở Phim mới, Đang hot, Đề xuất, Phim lẻ hay. Nơi khác có dấu **"✓ Đã xem"**. Tắt: Cài đặt → Trang chủ → Ẩn phim đã xem hết.

### 5. Xem phim
- **Đánh giá phim**: hết phim, phía trên thẻ "Phim tiếp theo" có ❤ Thích / 😐 Bình thường / 👎 Không thích (bấm ▲ để chọn). Trang chi tiết phim cũng có nút ♡ Thích và 👎 Không thích. Đề xuất học từ đánh giá.
- **Gửi sang điện thoại**: đang xem, bấm ▲ → "Gửi sang điện thoại", quét mã QR bằng camera. Phim mở đúng chỗ, cùng hồ sơ, không cần đăng nhập. Mã thứ hai mở phim bằng ứng dụng YouTube, đúng chỗ đang xem.

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
- **Tìm bằng giọng nói**: bấm nút **micro đỏ** trong ô tìm rồi nói tên phim (ví dụ "tổng tài giả nghèo"), app tự tìm. Có trên Android TV (hộp giọng nói của Google; remote có nút Tìm kiếm thì bấm nút đó cũng được), điện thoại và máy tính (lần đầu chọn **Cho phép** dùng micro). TV Samsung không cho app dùng micro nên không có nút này.

### 8. Lịch sử và Thống kê xem

- Lịch sử: "Đã xem gần đây" và "Danh sách của tôi". Xóa một phim: TV giữ lâu OK; điện thoại, máy tính **giữ lâu** trên ảnh phim để hiện dấu ✕ rồi bấm ✕.
- **Thống kê xem** (nút ở đầu trang Lịch sử, hoặc Cài đặt → Hồ sơ người xem): chọn **7 ngày** hoặc **30 ngày**. Có 4 ô số liệu (tổng, trung bình mỗi ngày, hôm nay, phim xem hết; bản 7 ngày so với 7 ngày trước), biểu đồ cột theo ngày có đường trung bình (chọn từng cột để xem chi tiết ngày đó), **Nhận xét** tự động (ngày xem nhiều nhất, khung giờ cao điểm, chuỗi ngày liên tiếp), **Khung giờ hay xem** trong ngày, 5 kênh xem nhiều nhất và **so sánh các hồ sơ**. Chỉ tính lúc phim đang chạy; mỗi thiết bị tính riêng, giữ 35 ngày. Xóa thống kê cần mã PIN.

### 9. Lọc theo lứa tuổi và mã PIN

- Cài đặt → **Lọc theo lứa tuổi** → "Chỉ hiện phim phù hợp lứa tuổi" (mặc định **Tắt**, bật khi cần): ẩn phim có từ khóa nhạy cảm trong tên/mô tả ở mọi trang.
- **Từ khóa nhạy cảm**: thêm/xóa từ khóa. Gõ không dấu cũng được ("ma tuy" khớp "Ma Túy").
- **Mã PIN** (mặc định **1234**) cần khi: tắt lọc, sửa từ khóa, khôi phục mặc định, xóa thống kê, đổi PIN.
- **Đổi PIN**: Cài đặt → Lọc theo lứa tuổi → Mã PIN → nhập PIN cũ → PIN mới (4–8 số) hai lần. PIN mới đồng bộ sang các máy đã đăng nhập.
- **Quên PIN**: mở `js/config.js`, điền `PIN_FORCE: '1234'`, tải lại bản web / cài lại app TV một lần, rồi để trống lại.

### 9b. Nhạc nền Trang chủ
- **Nhạc của tôi** (mặc định): 20 bài hát của Ryan Nguyen trong thư mục `music/` của bản web: Chủ Tịch Giả Nghèo, Đêm Mưa Trên Mái Nhà Hào Môn, Một Mái Nhà Có Em, Hợp Đồng Hôn Nhân Trăm Tỷ, Tổng Tài Lạnh Lùng, Chỉ Cần Em Ở Lại, Cưng Chiều Vợ Nhỏ, Ly Hôn Rồi Mới Biết, Thiên Kim Thật Trở Về, Tổng Tài Cũng Biết Đau, Gặp Lại Sau Năm Năm, Báo Thù Kiêu Hãnh, Tim Em Vẫn Chọn Anh, Trùng Sinh Giữa Hào Môn, Vợ Yêu Đừng Chạy, Thư Ký Nhỏ Của Tổng Tài, Tổng Tài Ở Rể, Tổng Tài Bá Đạo Yêu Em, Tổng Tài Yếu Lòng Vì Em, Vợ Cũ Kiêu Hãnh (khoảng 82 phút).
- Chỉ phát ở Trang chủ. Mở phim hoặc sang trang khác thì nhạc nhỏ dần rồi tạm dừng; quay lại Trang chủ thì **phát tiếp đúng chỗ**. Hết bài tự sang bài kế.
- Ô **"♪ tên bài"** ở góc dưới bên phải; điện thoại/máy tính bấm vào để qua bài.
- Cài đặt → **Nhạc nền Trang chủ**:
  - **Nhạc nền**: Nhạc của tôi (lần lượt) / Nhạc của tôi (trộn bài) / Hòa tấu (5 bản hòa tấu tự sáng tác) / Tắt / một bản hòa tấu. Riêng từng hồ sơ.
  - **Chọn bài**: danh sách 20 bài, chọn bài nào nghe bài đó ngay (ở màn hình này cũng phát để nghe thử).
  - **Âm lượng**: **Ngưỡng** (rất nhỏ, vừa đủ nghe) / Nhỏ / Vừa / To. iPhone luôn phát theo nút âm lượng của máy.
- **Nhạc nằm ở đâu**: bản web lấy `music/` cùng chỗ với app (chép cả thư mục `music/` lên GitHub Pages). TV không chứa nhạc trong file cài, mà tải từ GitHub Pages: TV Samsung tự dò theo PLAYER_HOST; Android TV (hoặc khi dò không được) vào Cài đặt → Kết nối → **Địa chỉ nhạc**, gõ địa chỉ GitHub Pages của bản web (dạng `https://tên-của-bạn.github.io/…/`). Địa chỉ này đồng bộ qua tài khoản Google, đặt một lần cho mọi máy.
- **Thêm / bớt bài**: chép file mp3 vào `music/`, rồi sửa `music/list.json` (mỗi bài một dòng: tên bài, tên file, số giây). Không cần cài lại TV.
- Chưa tải được nhạc của tôi (mất mạng, sai địa chỉ) thì app tự phát 5 bản hòa tấu.
- Trình duyệt / iPhone chỉ cho phát nhạc sau lần chạm/bấm đầu tiên; app TV phát ngay.

### 9c. Trang Nhạc (nghe nhạc có lời chạy theo bài)
- Tab **Nhạc** (sau Danh mục; điện thoại: ô **Nhạc** ở đầu trang). Mở ra là phát ngay 20 bài hát của bạn, kể cả khi nhạc nền Trang chủ đang tắt.
- **Lời bài hát chạy theo nhạc**: câu đang hát to và tô vàng dần như karaoke, có ghi đang ở đoạn nào (Lời 1, Điệp khúc, Đoạn chuyển…). Lời lấy từ chính file nhạc.
- **Ảnh phim tổng tài** đổi chậm mỗi 8 giây (ảnh bìa các phim tổng tài trong kho phim); mỗi bài bắt đầu bằng ảnh khác nhau.
- **Hai kiểu**, đổi bằng nút ⛶ trên trang hoặc Cài đặt → Nhạc nền Trang chủ → **Kiểu trang Nhạc** (riêng từng hồ sơ):
  - **Kiểu A, chia đôi**: bên trái ảnh lớn, tên bài, thanh thời gian, nút; bên phải lời bài hát; dưới cùng 5 bài **Tiếp theo** (chọn để nghe ngay).
  - **Kiểu B, toàn màn hình**: ảnh phủ cả màn hình, lời to ở giữa (câu trước, câu đang hát, câu sau), đồng hồ góc trên.
- Nút: Trộn bài · Bài trước · Phát/Dừng · Bài kế · Đổi kiểu · ⏱ Chỉnh lời · Tất cả bài. Remote có nút ⏯ ⏮ ⏭ thì dùng được luôn.
- Dừng trên trang Nhạc rồi sang trang khác thì Trang chủ phát nhạc lại như thường. Ở trang Nhạc không hiện màn hình chờ.
- **Chỉnh lời theo nhạc** (⏱): giờ của từng câu lúc đầu do app tự ước lượng nên có thể lệch vài giây. Bấm ⏱, bài hát phát lại từ đầu; mỗi khi câu tô vàng **bắt đầu** được hát thì bấm OK (hoặc chạm nút lớn). Nhầm thì **Lùi 1 câu**. Xong câu cuối app tự lưu, và đồng bộ sang các máy khác qua tài khoản. **Dùng giờ tự động** để bỏ phần đã chỉnh.

### 10. Chủ đề theo mùa và ngày lễ

- Cài đặt → **Chủ đề theo mùa và ngày lễ** → Chủ đề: **Tự động** (đổi theo ngày), **Tắt**, hoặc chọn tay.
- 17 chủ đề: Tết, Valentine, Năm mới, Giáng sinh, 8/3, 20/10, 1/6, Ngày của Mẹ, Ngày của Cha, Trung thu, Halloween, Lễ Tạ Ơn, Hoa anh đào, Xuân, Hạ, Thu, Đông. Ngày lễ ưu tiên hơn mùa; Tết và Trung thu theo âm lịch.
- Có hiệu ứng rơi (tuyết, hoa, lá, trái tim…), dây đèn, lồng đèn, hình nhỏ trên logo, lời chúc. TV chậm: tắt **"Hiệu ứng rơi"**.

### 10a. Chế độ ngủ, sinh nhật, tải sẵn ảnh
- **Chế độ ngủ** (Cài đặt → Giao diện): chọn giờ (21:00–23:00) và áp dụng cho cả nhà hoặc chỉ hồ sơ có giới hạn giờ xem. Tới giờ: màn hình tối dần, âm lượng nhỏ lại, hết phim không tự phát tiếp; 30 giây sau app tắt (TV) hoặc màn hình tối (trình duyệt). Có nút "Xem thêm 15 phút".
- **Sinh nhật** (Cài đặt → Hồ sơ người xem → Ngày sinh của hồ sơ, gõ 1411 cho 14/11): hôm đó app chúc mừng, pháo bông, nhạc sinh nhật, và thêm 30 phút xem phim nếu hồ sơ có giới hạn.
- **Tải sẵn ảnh bìa** (Cài đặt → Giao diện, mặc định Bật): khi rảnh app tải trước ảnh bìa phim mới để TV mở nhanh; đang xem phim thì tạm dừng.

### 10b. Màn hình chờ
- Để app yên **10 phút** (không bấm remote, không chạm) thì hiện màn hình chờ giống Netflix: ảnh bìa các phim mới trượt chậm, đổi phim mỗi 12 giây, kèm tên phim, kênh và đồng hồ lớn với thứ, ngày.
- Bấm **phím bất kỳ** (hoặc chạm / bấm chuột) để quay lại đúng chỗ cũ; phím đó không làm gì khác.
- Đang chiếu phim thì không hiện. Phim đang tạm dừng thì sau 10 phút vẫn hiện, quay lại phim vẫn dừng đúng chỗ. Nhạc nền tạm im khi đang ở màn hình chờ.
- Đồng hồ đổi góc trên/dưới sau mỗi ảnh để màn TV không bị in hình. Chỉ hiện phim đã qua bộ lọc lứa tuổi.
- Cài đặt → Giao diện → **Màn hình chờ**: Tắt / 5 / 10 / 15 / 30 phút; **Xem thử màn hình chờ** để xem ngay.
- **Câu thoại tổng tài**: mỗi lần màn hình chờ hiện là một câu mới (250 câu, 5 chủ đề: Bá đạo, Ngọt sủng, Hào môn & thương trường, Hối hận & tái hợp, Hài hước & đời thường; đi hết 250 câu mới lặp lại), hiện phía trên tên phim. Tắt ở Cài đặt → Giao diện → **Câu thoại tổng tài**.

### 11. Đồng bộ, sao lưu

- **Đăng nhập Google** hoặc **Token GitHub** (Cài đặt): lịch sử, danh sách, hồ sơ, cài đặt, mã PIN giống nhau trên mọi máy. API key và PLAYER_HOST giữ riêng từng máy.
- **Sao lưu tự động hằng tuần** (cần đăng nhập ở trên): Google Drive giữ 4 bản gần nhất; GitHub giữ mọi bản trong Revisions của Gist tongtai-sync. App báo "Đã sao lưu lúc…".
- "Sao lưu ngay", "Khôi phục bản sao lưu" (gộp, không xóa gì).
- **Mã sao lưu** (không cần tài khoản): Cài đặt → Xuất mã / Nhập mã, hoặc quét mã QR.

**Giữ hết hồ sơ khi cập nhật hay cài lại**
- **Cập nhật bản mới** (bản web: chép đè file lên GitHub Pages cùng địa chỉ; TV: cài đè cùng ứng dụng): hồ sơ, hình, mã PIN, lịch sử, cài đặt **còn nguyên**, không cần làm gì.
- **Cài lại từ đầu, gỡ app, xóa dữ liệu trình duyệt, đổi máy, đổi địa chỉ web**: dữ liệu trong máy mất, nên sao lưu TRƯỚC:
  - Cách tốt nhất: **đăng nhập Google** (hoặc Token GitHub) trong Cài đặt. Cài lại xong đăng nhập lại cùng tài khoản là mọi hồ sơ về đủ.
  - Không có tài khoản: Cài đặt → **Xuất mã** (mã đầy đủ bắt đầu bằng TTBK1:) → gửi mã vào email / tin nhắn cho chính mình. Cài lại xong: Cài đặt → **Nhập mã**.
- Thứ được giữ: danh sách hồ sơ, hình con thú, mã PIN từng hồ sơ, lịch sử, phim xem dở, danh sách, từ khóa tìm, thống kê xem, kênh yêu thích, cài đặt riêng từng hồ sơ (thứ tự hàng Trang chủ…). API key giữ riêng từng máy, phải nhập lại.
- Khôi phục chỉ **gộp thêm**, không xóa gì trong máy; hồ sơ đã xóa thì không bị mang về lại. Mã QR gọn chỉ mang danh sách và lịch sử của hồ sơ đang xem; muốn đủ mọi hồ sơ, dùng mã đầy đủ hoặc tài khoản.

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

- Phiên bản 2.26.2 (12/11/2026): Đồng hồ mặc định 12 giờ; sửa chữ ô nhanh và tiêu đề trang trên điện thoại.
- Phiên bản 2.26.1 (11/11/2026): Gửi sang điện thoại có thêm mã QR mở phim trên YouTube.
- Phiên bản 2.26.0 (11/11/2026): Đánh giá phim ❤/👎. Có tập mới. Chế độ ngủ. Báo cáo tuần. Tổng tài của tuần. Câu đố tổng tài. Sinh nhật có pháo bông. Tải sẵn ảnh bìa. Gửi phim sang điện thoại bằng mã QR.
- Phiên bản 2.25.1 (11/11/2026): 250 câu thoại tổng tài, mỗi lần màn hình chờ hiện một câu mới.
- Phiên bản 2.25.0 (11/11/2026): Giới hạn giờ xem theo hồ sơ. Xem chung nhiều hồ sơ. Tìm bằng giọng nói. Xem tiếp trên banner Trang chủ. Số phim mới của kênh yêu thích. Câu thoại tổng tài trên màn hình chờ.
- Phiên bản 2.24.4 (11/11/2026): Ai đang xem có "3 Không".
- Phiên bản 2.24.3 (11/11/2026): Quản trị: mỗi hồ sơ một màu riêng theo hình thú.
- Phiên bản 2.24.2 (11/11/2026): Quản trị xem được ngay trên TV bằng remote.
- Phiên bản 2.24.1 (11/11/2026): Mục Quản trị trong trang Thông tin (chỉ email quản trị thấy); Báo cáo PDF trong trang quản trị.
- Phiên bản 2.24.0 (11/11/2026): Trang quản trị cho phụ huynh (tùy chọn): app gửi thiết bị, hồ sơ, thời gian xem và đơn vị YouTube về máy chủ riêng (Cloudflare Worker) khi đã điền Máy chủ thống kê; trang Thông tin ghi rõ việc này. Hướng dẫn trong HUONG-DAN-ADMIN.
- Phiên bản 2.23.0 (11/11/2026): Trang Nhạc mới: nghe 20 bài hát với lời chạy theo nhạc (tô vàng kiểu karaoke) và ảnh phim tổng tài đổi chậm; Kiểu A chia đôi và Kiểu B toàn màn hình; Chỉnh lời theo nhạc bằng cách bấm OK theo từng câu.
- Phiên bản 2.22.0 (11/11/2026): Sắp xếp các hàng: thay đổi chưa lưu ngay, bấm “Xem trước” để xem Trang chủ mới rồi “Lưu” (có Bỏ thay đổi, Mặc định; chưa lưu mà quay lại thì app hỏi). Âm lượng nhạc nền thêm mức Ngưỡng (nhỏ hơn Nhỏ). Trang Thông tin viết lại chuyên nghiệp hơn.
- Phiên bản 2.21.1 (10/11/2026): Sửa tên bài: Tổng Tài Lạnh Lùng, Đêm Mưa Trên Mái Nhà Hào Môn.
- Phiên bản 2.21.0 (10/11/2026): Nhạc của tôi: 20 bài hát của Ryan Nguyen làm nhạc nền Trang chủ (lần lượt hoặc trộn bài, chọn bài, phát tiếp đúng chỗ khi quay lại Trang chủ). Sửa lỗi file cài TV bản 2.20.0–2.20.3 (config.xml và build.gradle.kts bị rỗng).
- Phiên bản 2.20.3 (10/11/2026): Bỏ mã PIN hồ sơ ngay trong Cài đặt → Hồ sơ người xem → Mã PIN của hồ sơ này (trước đây chỉ đổi được).
- Phiên bản 2.20.2 (10/11/2026): Lời chúc theo mùa / ngày lễ ở màn hình khởi động to, sáng hơn: từng chữ bay lên, có làn sáng vàng chạy qua và hình biểu tượng hai bên.
- Phiên bản 2.20.1 (10/11/2026): Guest và hồ sơ cũ tự có hình con thú. Sao lưu / đồng bộ giữ đủ mọi hồ sơ (cả khi cài lại), thêm thống kê xem và từ khóa tìm của từng hồ sơ.
- Phiên bản 2.20.0 (10/11/2026): Màn hình chờ giống Netflix: để yên 10 phút thì hiện ảnh bìa phim mới chạy chậm kèm đồng hồ; bấm phím bất kỳ để quay lại. Chỉnh trong Cài đặt → Giao diện.
- Phiên bản 2.19.0 (10/11/2026): Mỗi hồ sơ tự sắp xếp thứ tự các hàng Trang chủ (Cài đặt → Trang chủ → Sắp xếp các hàng). "Đề xuất cho bạn" đổi thành Đề xuất theo hồ sơ (theo thể loại người đó hay xem). Hàng "Từ kênh yêu thích" mặc định ẩn.
- Phiên bản 2.18.1 (10/11/2026): Màn hình "Ai đang xem?" khóa thanh tab, chỉ bấm trong khung; giữ lâu trên hồ sơ mở menu Đặt/Đổi/Bỏ mã PIN, Đổi hình, Xóa.
- Phiên bản 2.18.0 (09/11/2026): Nhạc nền Trang chủ: 5 bản hòa tấu phong cách tổng tài tự sáng tác, Tự động / Tắt / chọn bài, 3 mức âm lượng, riêng từng hồ sơ.
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

## Điện thoại làm remote và “Còn xem không?” (bản 2.34.0)
- Bấm nút **Xanh lá** trên remote TV (hoặc Cài đặt → Remote → **Điều khiển bằng điện thoại**), quét mã QR bằng điện thoại. Cả nhà quét cùng lúc được. Bấm phím bất kỳ trên remote để đóng mã.
- Trên điện thoại: mũi tên, OK, Quay lại, Trang chủ, tạm dừng, tua ±10 giây, phụ đề, tập sau, đóng phim, Lịch sử, Thể loại, Nhạc, gõ chữ để tìm phim. Màn hình điện thoại hiện phim đang phát trên TV.
- **Còn xem không?**: xem liên tục nhiều giờ mà không bấm phím nào, phim tự tạm dừng và hỏi. 60 giây không ai trả lời thì phim tự tắt (đỡ chạy cả đêm khi ngủ quên). Chỉnh trong Cài đặt → Xem phim: Tắt / 1 / 2 / 3 giờ (mặc định 2 giờ).

- **Vuốt (2.35.0):** trên trang remote bấm công tắc **Vuốt** để dùng như touchpad: vuốt = mũi tên, vuốt rồi giữ = chạy liên tục, chạm = OK, chạm 2 ngón = Quay lại.

## Sáng / Tối theo giờ (bản 2.35.0)
- Cài đặt → Giao diện → **Giao diện Tối / Sáng** chọn **Theo giờ**: ban ngày sáng, buổi tối tự chuyển tối. Dòng **Giờ đổi giao diện** chọn 6:00→18:00, 6:00→19:00, 7:00→18:00, 7:00→19:00 hoặc 5:30→17:30. TV mặc định Theo giờ.
- Nút ☀/🌙 có chữ **A** khi đang tự động. Bấm nút là đổi tạm tới mốc giờ kế tiếp, rồi tự quay lại theo giờ. Đang xem phim thì chờ đóng phim mới đổi.

## Bản 2.36.0
- **Tìm theo cảnh trong phim:** Tìm kiếm → công tắc **Cảnh trong phim**, gõ “bị tát”, “mang thai”, “giả nghèo”… App tìm trong tên và mô tả từng tập đã tải về, gom theo phim, phim khớp nhiều tập lên đầu. Không tốn đơn vị YouTube.
- **Chế độ khách:** hồ sơ Guest thành **Khách** (nhãn KHÔNG LƯU). Khách xem xong không để lại lịch sử, xem dở, tìm kiếm; không tính vào thống kê, huy hiệu, thi đua. Lọc lứa tuổi và giới hạn giờ vẫn áp dụng. Lịch sử cũ của Guest không bị xóa: tắt Chế độ khách (Cài đặt → Hồ sơ người xem, cần mã PIN) là thấy lại.
- **Báo phim mới lên điện thoại:** trên trang remote (quét mã QR trên TV) → **🔔 Báo phim mới lên điện thoại** → chọn hồ sơ → Bật. Kênh yêu thích ra tập mới hoặc có lời nhắn gia đình thì điện thoại báo; bấm **Mở trên TV** là TV đang mở app phát trong khoảng 1 phút. iPhone: iOS 16.4 trở lên, phải Thêm vào MH chính rồi mở từ biểu tượng đó.
- **Bản 2.36.1:** tìm phim mới trên YouTube mặc định **tắt**. Người quản lý bật trong trang quản trị → Tổng quan → ô Tìm kiếm. Khi tắt, trang Tìm kiếm tìm trong phim đã có (theo tên và cảnh), không tốn đơn vị.
- **Bản 2.36.2:** trên điện thoại, ở trang Nhạc màn hình luôn sáng (iPhone tự khóa màn hình là dừng nhạc). Chạm nhãn **☀ Màn hình luôn sáng** để tắt, hoặc Cài đặt → Nhạc → Giữ màn hình sáng ở trang Nhạc. Bấm nút khóa bên hông thì nhạc vẫn dừng.
- **Bản 2.37.0:** **Nghe nhạc khi khóa máy** (điện thoại, trang Nhạc; Cài đặt → Nhạc). **Xem tiếp trên máy khác:** cùng hồ sơ, đang xem dở trên TV thì mở điện thoại thấy khung “Đang xem trên TV…”, bấm Xem tiếp ở đây; ngược lại TV hiện khung nhỏ 10 giây, bấm OK.
- **Bản 2.37.1:** điện thoại có **Remote TV** trong menu ☰ (dưới Cài đặt). Nối 1 lần: trên TV bấm nút **Xanh lá** để hiện mã 4 chữ, nhập mã đó trên điện thoại (hoặc chọn TV trong danh sách). Sau đó bấm Remote TV là điều khiển được ngay trong app.
- **Bản 2.38.0:** 🎲 **Bốc thăm phim** (TV: nút cạnh Xem ngay; điện thoại: nút 🎲 cạnh nút tìm). **Hẹn giờ tắt phim** (nút Hẹn giờ khi xem phim): Tắt → 15 → 30 → 60 → 90 phút → Hết tập này → Hết 2 tập; 30 giây cuối nhỏ tiếng dần, góc màn hình có đồng hồ đếm ngược. **Dán link YouTube** vào Tìm kiếm để mở phim (playlist ra cả bộ). Điện thoại: **Tiết kiệm dữ liệu di động** trong Cài đặt → Xem phim.
- **Bản 2.38.1:** điện thoại có **phim thu nhỏ**: đang xem bấm nút **⌄** (cạnh ✕ Đóng) hoặc vuốt xuống. Phim thu vào góc, vẫn chạy khi lướt app. Chạm để phóng to, kéo để dời góc, ✕ để tắt.
- **Bản 2.38.3:** trang Nhạc kiểu karaoke: câu đang hát ở giữa màn hình giờ **màu vàng** như logo (trước là chữ trắng).
- **Bản 2.38.4:** màn hình chờ nét hơn (ảnh bìa lớn nhất), sửa chiếc lá trên logo có lúc hiện to, bỏ báo lỗi webapis.js. Bản Samsung đổi mã gói thành **TongTaiTV2** (`config.xml`).
- **Bản 2.47.6:** iPhone tự tải lại giao diện mới nếu còn giữ file cũ.
- **Bản 2.47.5:** iPhone xoay ngang: khung phim nhỏ không bị lệch.
- **Bản 2.47.4:** Ông bà xem phim: vòng tròn vàng không đụng chữ thời gian.
- **Bản 2.47.3:** Ông bà xem phim: nút Phát rộng đều, vạch vàng thẳng hàng thanh thời gian.
- **Bản 2.47.2:** Ông bà TV: mục lục trái hẹp lại, khung vàng không bị cắt.
- **Bản 2.47.1:** TV: sửa nút Tóm tắt, Bốc thăm có nút Đóng, ◀ ▶ tua phim và nhạc; ông bà: Thể loại có ảnh phim.
- **Bản 2.47.0:** Nghe nhạc: vuốt ngang hoặc kéo thanh thời gian để tua bài.
- **Bản 2.46.10:** iPhone xoay ngang: phim không còn lệch / mất khúc.
- **Bản 2.46.9:** Thể loại **Hành động** cho phim lẻ; phim lẻ không còn gắn nhãn Tổng tài.
- **Bản 2.46.8:** Giao diện mặc định **Tối** cho cả TV và điện thoại.
- **Bản 2.46.7:** iPhone xoay ngang: phim nằm giữa, không bị lệch phải.
- **Bản 2.46.6:** Bản web tự lấy giao diện mới ngay khi đổi BUILD (cần chép `index.html` một lần).
- **Bản 2.46.5:** Trang Hướng dẫn trong app bỏ mục Có gì mới.
- **Bản 2.46.4:** iPhone xoay ngang: phim nằm giữa, thấy đủ hình.
- **Bản 2.46.3:** Nhãn thể loại nằm dưới nút ⓘ, ngang hàng nhãn **MỚI**.
- **Bản 2.46.2:** iPhone xoay ngang xem phim không bị lệch/cắt; xoay lại dọc bấm **Đóng** được.
- **Bản 2.46.1:** Nhãn **★ AI** trở lại như cũ (dưới thời lượng).
- **Bản 2.46.0:** Điện thoại: nhãn **★ AI** ở góc dưới bên phải ảnh phim, không còn đè nút ⓘ.
- **Bản 2.45.9:** Điện thoại: hồ sơ + Remote bên trái, tên trang ở giữa; bỏ chữ “Trang chủ” đen khi bấm logo; sửa nút ⓘ đè nhãn trong Lịch sử.
- **Bản 2.45.8:** Điện thoại: **vuốt ngang trên phim để tua** (phải: tới, trái: lùi).
- **Bản 2.45.7:** Ông bà: không thu nhỏ phim khi vuốt, chữ khi xem vừa phải, Nghe nhạc xoay ngang gọn, nút Tìm kiếm cạnh Hẹn giờ, cỡ chữ mặc định Vừa. Sửa nút Quay lại sau khi xoay máy.
- **Bản 2.45.6:** Mục lục điện thoại ông bà kiểu ô icon màu, nhỏ gọn. Cài đặt có mục **🚗 Xe Tesla** (Tự động / Bật / Tắt) ở đầu trang.
- **Bản 2.45.5:** Điện thoại ông bà: ảnh phim rộng tự đổi, mục lục icon gọn, xoay ngang không bị cắt. Sửa Cài đặt ông bà bị tràn, nút Quay lại, nhãn thể loại ở ĐANG HOT.
- **Bản 2.45.4:** Tạo hồ sơ chọn **Kiểu thường / Kiểu ông bà**; giữ OK trên hồ sơ (màn hình Ai đang xem) để đổi kiểu.
- **Bản 2.45.3:** Ông bà thích có thêm **👯 Sinh đôi** và **🌾 Làng quê**.
- **Bản 2.45.2:** TV chế độ ông bà: nút **Remote** cạnh nút Sáng/Tối, các ô trên cùng viền bằng nhau.
- **Bản 2.45.1:** Cài đặt ông bà có ô **Giao diện thường** (về Trang chủ bình thường, cần mã PIN) và ô **Giữ lâu xem thử phim** (Bật / Tắt).
- **Bản 2.45.0:** Chế độ ông bà: mục **💛 Ông bà thích** (Trẻ em · Hài · Ông bà · Gia đình), nút **⚙ Cài đặt** đơn giản cạnh Tìm kiếm (cỡ chữ, phụ đề, giờ đi ngủ…), **Thống kê xem** và **Thống kê nghe nhạc**. Cài đặt đầy đủ cần mã PIN.
- **Bản 2.44.0:** Trang chính ông bà trên TV kiểu mới: mục lục bên trái, nội dung mục hiện bên phải, **Hẹn giờ tắt** cho phim và nhạc, câu nói tổng tài, ô **Tìm kiếm** cạnh tên người xem, trang trí theo mùa, giao diện sáng / tối. Rời mục Nghe nhạc là nhạc tắt.
- **Bản 2.43.0:** **👵 Chế độ ông bà** (Cài đặt → Hồ sơ người xem → Chế độ ông bà): chữ to, nút lớn, Xem tiếp + 8 nút (Phim mới, Phim hot, Top 10, Thể loại, Phim lẻ, Hoạt hình, Nghe nhạc, Lịch sử). **Mở app vào thẳng hồ sơ** (riêng từng máy). Thoát: giữ OK trên hình hồ sơ (điện thoại: chạm giữ tên 2 giây), nhập mã PIN người lớn.
- **Bản 2.42.0:** **Thống kê xem** có 7 · 30 · 90 · 180 ngày (90/180 ngày: biểu đồ theo tuần), giữ dữ liệu 180 ngày. Nút **Xuất PDF** (điện thoại, máy tính): báo cáo 1 trang A4.
- **Bản 2.41.4:** Hiệu ứng rơi chia đều khắp màn hình, không còn dồn bên trái.
- **Bản 2.41.3:** Điện thoại: ⓘ góc trên phải ảnh phim, ★ AI cạnh thời lượng. Thanh trên cùng: hình người đang xem (bấm để đổi), Remote có viền, 🎲 cùng cỡ.
- **Bản 2.41.2:** Điện thoại: nhãn ★ AI và nhãn thể loại không còn bị nút ⓘ đè; Xem chung không còn hiện 2 hình thú to ở đầu trang.
- **Bản 2.41.1:** Hình trang trí mùa / ngày lễ gắn ngay góc logo (bỏ chiếc lá lơ lửng bên trái trên điện thoại). Điện thoại có nút **Remote TV** cạnh xí ngầu 🎲. **Thi đua tuần** mặc định Tắt.
- **Bản 2.41.0:** **Màu riêng cho từng hồ sơ** (chọn ở màn hình Ai đang xem → giữ OK trên hồ sơ → 🎨 Màu riêng) · **↗ Chia sẻ** trong Tóm tắt: gửi link YouTube gốc + câu giới thiệu (TV hiện mã QR).
- **Bản 2.40.0:** **Chế độ xe hơi** (tự bật trên xe Tesla: nút to, 🎧 Chỉ nghe tiếng) · **Phim tương tự** trong Tóm tắt (không tốn đơn vị YouTube) · **Tải / Mở file sao lưu** (Cài đặt, điện thoại & máy tính) · Remote **nhớ nhiều TV**, đổi 1 chạm · **🔔 Theo dõi tập mới** ở trang phim bộ (cần bật thông báo trên điện thoại). Cần deploy lại máy chủ quản trị.
- **Bản 2.39.7:** màn hình cảm ứng lớn (xe Tesla, máy tính bảng xoay ngang): vuốt ở danh sách nào thì cuộn danh sách đó, vuốt dài đi nhiều phim.
- **Bản 2.39.6:** tên phim lớn ở đầu Trang chủ giãn dòng, dấu tiếng Việt (Ô, ộ, ị…) không còn chồng.
- **Bản 2.39.5:** trang Nhạc kiểu karaoke: chữ **NHẠC DẠO** không còn chồng lên phần giới thiệu bài hát.
- **Bản 2.39.4:** **Nhạc nền Trang chủ mặc định Tắt** (TV và điện thoại); muốn nghe thì Cài đặt → Nhạc nền Trang chủ → Bật.
- **Bản 2.39.3:** sửa chiếc lá trang trí hiện rất to che logo trên TV (hình trang trí luôn có cỡ sẵn).
- **Bản 2.39.2:** điện thoại: nút **ⓘ** ở góc ô phim mở bảng **Tóm tắt** trượt lên (Xem phim · ＋ Danh sách · 📺 Lên TV · ✕ Xóa khỏi hàng); giữ lâu vẫn xem trước 20 giây.
- **Bản 2.39.1:** hiệu ứng rơi Ít 2 · Vừa 4 · Nhiều 6 hình; **Nhạc nền Trang chủ** bật/tắt trong Cài đặt; **mã remote TV giữ cố định** (TV Samsung cài lại app vẫn giữ mã; mã giữ 1 năm). TV đã lỡ đổi mã: Cài đặt → Kết nối → **Mã remote của TV này** → nhập mã cũ. Cần deploy lại máy chủ quản trị.
- **Bản 2.39.0:** phím màu (đỏ Yêu thích · xanh lá Remote · vàng Bốc thăm · xanh dương Tìm kiếm), giữ OK trên ô phim = **Tóm tắt**, ◀ 2 lần = xem lại có phụ đề tạm, giữ ◀/▶ = dải ảnh tua nhanh, màn hình **Tập tiếp** lớn (đếm 10 giây). Remote điện thoại: nút 🎤 nói tên phim, ô dán link **Mở trên TV / Xem sau**, Android Chia sẻ → Remote TV. Hàng **Xem sau** trên Trang chủ TV. Cần deploy lại máy chủ quản trị.
- **Bản 2.38.5:** **Đồng bộ Google trên TV chạy được.** Dữ liệu chuyển từ thư mục ẩn sang thư mục **Tổng Tài TV** trên Google Drive (file `TongTaiTV-dongbo.json` + 4 bản sao lưu). Bản web/điện thoại hỏi đăng nhập Google lại **một lần** để cho phép quyền mới, rồi tự chép dữ liệu cũ sang. Đừng xóa thư mục này trên Drive.
