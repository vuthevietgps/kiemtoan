# Kiểm chứng chức năng 06 — Lịch nghiệp vụ, hạn pháp lý theo khách hàng, nhắc việc

Ngày **28/10/2026**. Kết luận: **đã hoàn thiện và kiểm chứng kỹ thuật 06-B → 06-D theo [đặc tả 06](06-deadlines-notifications.md) (I1–I14, người dùng duyệt 23/10/2026)**. **Chưa nghiệm thu nghiệp vụ**: hai tiêu chí phụ thuộc đầu vào của công ty còn mở — **QD07** (danh mục nghĩa vụ thật, lịch nghỉ thật và bộ ngày mẫu do KTT xác nhận — tiêu chí 2) và **QD09** (hộp thư/SMTP thử do IT cấp — tiêu chí 8). Chưa merge (thư mục chưa có repo Git), chưa UAT với người dùng thật, chưa đẩy 06 lên vsademo.smarterp.vn. Thay đổi test cũ: [giải trình](06-test-policy-changes.md).

**28/10/2026: người dùng nghiệm thu tạm thời (có điều kiện)** (“Tạm thời nghiệm thu 06 để bắt đầu làm tiếp các phần còn lại cho hợp lý đối với nghiệp vụ công ty cung cấp dịch vụ kế toán kiểm toán”). Trước đó cùng ngày người dùng chọn chờ đủ QD07/QD09; nay đổi sang nghiệm thu có điều kiện để bắt đầu 07. **Điều kiện còn mở:** tiêu chí 2 (bộ ngày mẫu — QD07) và 8 (SMTP thử — QD09) kiểm lại khi có đầu vào và ghi bổ sung vào biên bản này; nếu khi đó phát hiện sai, sửa trong module 06 theo quy tắc lỗi hồi quy.

### Đầu vào cần nhận để kiểm lại tiêu chí 2 và 8

| Mã | Ai cung cấp | Nội dung | Dùng để |
| --- | --- | --- | --- |
| QD07 | KTT (chị Hà + trưởng nhóm) | Danh mục nghĩa vụ thật: tên, chu kỳ, quy tắc hạn (ngày, số tháng sau kỳ hoặc ngày cố định), điều kiện áp dụng theo hồ sơ KH, cách dời khi trùng ngày nghỉ, căn cứ pháp lý, ngày hiệu lực; dịch vụ nào gắn loại nào | Nhập và xác nhận ở Cấu hình → Loại nghĩa vụ |
| QD07 | KTT / hành chính | Lịch nghỉ lễ, nghỉ bù, làm bù năm 2026 và 2027 theo thông báo của Chính phủ | Nhập và xác nhận ở Cấu hình → Lịch năm |
| QD07 | KTT | **Bộ ngày mẫu**: với vài KH mẫu (tháng/quý, năm tài chính khác tháng 12), các kỳ và hạn nộp đúng mà KTT xác nhận — gồm kỳ có hạn rơi vào ngày nghỉ/Tết | Đối chiếu với "Xem trước 12 kỳ" và lịch báo cáo sinh ra (tiêu chí 2) |
| QD09 | IT | Máy chủ SMTP thử hoặc M365: host, cổng, bảo mật (TLS), tài khoản/mật khẩu ứng dụng, địa chỉ gửi; 1–2 hộp thư nhận để kiểm | Đặt biến `SMTP_*` trên môi trường thử, gửi nhắc thật, chụp thư nhận được (tiêu chí 8) |

## Phạm vi đã thực hiện

| Gói | Kết quả |
| --- | --- |
| 06-B Lịch và hạn pháp lý | Lịch năm Nháp → Đã xác nhận (ngày Nghỉ/Làm bù); loại nghĩa vụ có phiên bản, quy tắc tháng/quý/năm theo năm tài chính, lùi/đẩy ngày nghỉ; trường thuế–kế toán của KH (02); bước quy trình/kế hoạch gắn loại nghĩa vụ (03/04); lịch báo cáo theo KH × loại × kỳ; việc gắn nghĩa vụ (05); tính lại hạn I8; quyền `deadlines:approve` |
| 06-C Nhắc việc | Mốc −7/−3/−1, đúng hạn, quá hạn; leo thang; SLA soát xét; bản tin sáng; trong ứng dụng + email, thử lại 5 lần, gửi lại thủ công; tuỳ chọn cá nhân; mức gấp I11 theo ngưỡng chung/dịch vụ; khoá thuê chống chạy song song |
| 06-D1 Lịch & Deadline | FullCalendar tháng/tuần/danh sách, gộp hạn pháp lý + việc theo quyền, lọc KH/nhân viên/loại/loại hạn/trạng thái, màu mức gấp, ngày nghỉ tô xám, ngăn chi tiết |
| 06-D2 Lịch báo cáo | Màn hình `/deadlines` (ô đếm, bảng, Đang chuẩn bị / Đã nộp + biên nhận / Không áp dụng / Mở lại), tab Lịch báo cáo ở chi tiết KH (bật/tắt loại có lý do); nhắc lịch báo cáo trỏ `/deadlines?id=` |
| 06-D3 Cấu hình 06 | `/deadline-settings`: loại nghĩa vụ (soạn, xác nhận, ngừng, gắn dịch vụ, xem trước 12 kỳ), lịch năm, nhắc việc (ngưỡng, giờ gửi, leo thang, ngưỡng theo dịch vụ, chạy ngay), nhật ký gửi (lọc, gửi lại) |
| 06-D4 Chuông, kiểm chứng | Chuông: lọc Tất cả / Chưa đọc (`GET /notifications?unread=true`), nhãn loại nhắc việc (Nhắc hạn, Quá hạn, Leo thang, Quá SLA, Bản tin sáng) theo màu mức độ; kiểm chứng khởi động lại và đường email (mục dưới) |

## Đối chiếu tiêu chí nghiệm thu

| # | Tiêu chí | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Lịch năm: nghỉ/làm bù; năm chưa xác nhận tính thứ 2–6 và có cảnh báo; sau xác nhận, thời lượng bước, SLA, leo thang tính theo lịch mới | Đạt | `working-calendar.spec`, `deadlines-obligations.e2e`, `reminders.e2e`; giao diện D3 (thêm ngày, lưu, xác nhận), D1 (cảnh báo "Lịch năm … chưa xác nhận") |
| 2 | Loại nghĩa vụ chỉ sinh hạn khi đã xác nhận; quy tắc tháng/quý/năm, năm tài chính lệch đúng trên **bộ ngày mẫu do KTT xác nhận**; trùng ngày nghỉ lùi/đẩy đúng I3 | **Đạt kỹ thuật, chưa nghiệm thu nghiệp vụ** — chưa có bộ ngày mẫu và danh mục thật (QD07) | `obligation.rules.spec` (tháng 2, năm nhuận, quý, năm tài chính kết thúc 3/6/9, Tết, làm bù), `deadlines-obligations.e2e`; xem trước 12 kỳ ở D3 |
| 3 | Lịch báo cáo đúng KH × loại × kỳ, không trùng khi gọi lại/đồng thời; bật/tắt theo KH có lý do; HĐ huỷ → kỳ sau Không áp dụng | Đạt (sửa lỗi "bật lại" sinh kỳ vượt HĐ ở D2) | `obligation-sync.spec`, `deadlines-obligations.e2e`; tab Lịch báo cáo của KH (D2) |
| 4 | Việc bước pháp lý nhận hạn nghĩa vụ; bắt đầu → Đang chuẩn bị; Hoàn thành có kết quả → Đã nộp + biên nhận; quá hạn → Trễ hạn; nộp sau hạn có cờ | Đạt | `deadlines-obligations.e2e`, `calendar-events.e2e`, `customer-obligations-board.e2e`; giao diện D2 (nộp kèm biên nhận, tải biên nhận) |
| 5 | Đổi lịch/quy tắc tính lại đúng phạm vi I8; việc gắn đổi hạn "Theo lịch pháp lý", không đếm gia hạn, giữ hạn gốc | Đạt | `deadlines-obligations.e2e`; giao diện D3: xác nhận quy tắc v2 → "đổi hạn 1" |
| 6 | Nhắc đúng mốc cho đúng người; không nhắc Tạm dừng/Hoàn thành; leo thang đúng một lần | Đạt | `reminder.rules.spec`, `reminders.e2e` |
| 7 | Không gửi trùng khi chạy lại, khởi động lại giữa chừng, hai tiến trình; đổi hạn huỷ mốc cũ; bỏ lỡ chỉ gửi mốc gần nhất | Đạt | `reminders.e2e` (đồng hồ giả lập, chạy song song); kiểm chứng khởi động lại thật (dưới) |
| 8 | Email qua **SMTP thử do IT cấp** có bằng chứng thư nhận; lỗi thử lại rồi Thất bại, gửi lại thủ công; tắt email cá nhân | **Chưa đạt phần SMTP thật (QD09)**; đường gửi, thử lại, gửi lại thủ công đã kiểm bằng hộp thư SMTP giả cục bộ | `reminders.e2e` (5 lần → Thất bại, gửi lại, tắt email); kiểm chứng email (dưới) |
| 9 | SLA soát xét và bản tin sáng; không gửi bản tin rỗng; không gửi vào ngày nghỉ | Đạt | `reminders.e2e` |
| 10 | Mức gấp nhất quán ở Việc của tôi, kanban, chi tiết việc, lịch; ngưỡng riêng theo dịch vụ có hiệu lực; không đổi ưu tiên H10 | Đạt | `urgency.spec`, `reminders.e2e`, `calendar-events.e2e`; giao diện: nhãn mức gấp (05-E/06-C), màu trên lịch (D1), ngưỡng KTT (D3) |
| 11 | Lịch tháng/tuần/danh sách gộp hạn pháp lý + việc trong phạm vi; lọc; mở chi tiết; desktop và 375px | Đạt | `calendar-events.e2e`, web `calendar-*.spec`; giao diện D1, D2 (hạn pháp lý hiện trên lịch, mở sang Lịch báo cáo) |
| 12 | Phân quyền 5 vai trò + vai trò tuỳ chỉnh; hồi quy 02/03/04/05/10; lint/unit/e2e/build/max-lines; migration DB trống và bản sao demo | Đạt | `deadlines-access.e2e`, `calendar-events.e2e`, `customer-obligations-board.e2e`, `notifications-bell.e2e`; toàn bộ e2e (dưới); migration 06-B/06-C (xem [hiện trạng](../planning/current-status.md)) |

## Kiểm thử tự động (lần chạy cuối 28/10/2026, máy cục bộ, không phải CI)

| Hạng mục | Kết quả |
| --- | --- |
| API unit | 294/294 (44 suite) |
| API e2e | 265/265 (41 suite; DB test riêng `ketoan_codex_06_test`) |
| API phân quyền (access) | 57/57, 95,75% dòng |
| Web unit | 126/126 (34 file) |
| Lint | API 0 lỗi (63 cảnh báo, chủ yếu độ dài hàm test), web 0 lỗi (1 cảnh báo cũ) |
| Build web, typecheck build API, `check-max-lines`, `npm audit --omit=dev` (web) | Đạt; 0 lỗ hổng. Typecheck đầy đủ API còn 4 lỗi cũ ở spec của 02 |

## Kiểm chứng khởi động lại và email (06-D4, bản sao `ketoan_ui_06d2`)

Không có SMTP thử của công ty (QD09), nên dùng **hộp thư SMTP giả cục bộ** (script Node chỉ nhận và ghi thư ra file, không chuyển tiếp) trên `127.0.0.1:2525`; API chạy với `REMINDERS_ENABLED=true` (cấu hình `api-ui-06d2-smtp`).

1. **Gửi lại thủ công:** email "Không gửi" đã bấm "Gửi lại" ở D3 được lượt chạy lúc khởi động gửi đi → trạng thái Đã gửi, hộp thư giả nhận thư (bản tin sáng của nhân viên 1).
2. **Mốc nhắc + email:** tạo việc hạn 29/10 cho nhân viên 1, chạy nhắc → 1 thông báo trong ứng dụng + 1 email "Gần đến hạn…" tới hộp thư giả.
3. **Khởi động lại:** trước khi khởi động lại API: 34 bản ghi gửi, 30 thông báo, 2 thư. Sau khởi động lại (lượt chạy tự động 5 giây sau khởi động) và thêm một lượt chạy tay: **vẫn 34 / 30 / 2**, lượt chạy tay báo 0 mục mới.
4. **SMTP lỗi → thử lại:** tắt hộp thư giả, tạo việc mới, chạy nhắc → email "Chờ gửi", lần thử 1, lỗi `connect ECONNREFUSED 127.0.0.1:2525`, hẹn thử lại sau 1 phút; bật lại hộp thư, chạy lượt kế tiếp sau giờ hẹn → Đã gửi (lần thử 2), hộp thư nhận thư.

Chưa kiểm: gửi qua máy chủ SMTP/M365 thật, thư vào hộp thư thật và hiển thị tiếng Việt trên ứng dụng đọc thư (QD09).

## Kiểm tra giao diện (tóm tắt; chi tiết ở [hiện trạng](../planning/current-status.md))

- **D1:** lịch tháng/tuần/danh sách, lọc, ngăn chi tiết, 375px dạng danh sách.
- **D2:** Lịch báo cáo: Đang chuẩn bị → Đã nộp kèm biên nhận → tải biên nhận → ô đếm cập nhật; tab KH tắt/bật có lý do; mở từ lịch sang `/deadlines?id=`.
- **D3:** loại nghĩa vụ (xem trước, sửa nháp, xác nhận), lịch năm (thêm, lưu, xác nhận), nhắc việc, nhật ký gửi (gửi lại); Quản trị chỉ thấy Nhắc việc + Nhật ký gửi, KTT chỉ thấy Loại nghĩa vụ + Lịch năm.
- **D4:** chuông của nhân viên 1: nhãn "Nhắc hạn", "Bản tin sáng"; lọc "Chưa đọc (9)" gọi `?unread=true`, menu giữ mở; 375px menu nằm trong khung. Lỗi tìm thấy và đã sửa: lớp toàn cục `.filters`/`.panel` làm hai nút lọc giãn rộng và xếp dọc (đổi tên lớp của chuông).

## Kịch bản demo nghiệm thu (gợi ý)

1. **KTT** mở Cấu hình lịch & nhắc → Lịch năm 2027: nhập ngày nghỉ theo thông báo của Chính phủ → lưu; **GĐ** xác nhận.
2. **KTT** thêm loại nghĩa vụ thật (ví dụ GTGT tháng), gắn dịch vụ Kế toán thuế, xem trước 12 kỳ cho một KH; **GĐ** xác nhận → báo số kỳ sinh.
3. Mở KH: tab Lịch báo cáo hiện các kỳ; tắt một loại "KH tự nộp" có lý do → kỳ chưa nộp chuyển Không áp dụng.
4. **Nhân viên**: Lịch & Deadline thấy hạn pháp lý + việc; Lịch báo cáo → Đang chuẩn bị → Đã nộp kèm biên nhận.
5. **GĐ**: Nhắc việc → chạy nhắc ngay; Nhật ký gửi xem trạng thái email; chuông của nhân viên lọc Chưa đọc.

## Giới hạn và việc chuyển sang bước sau

- **Chờ đầu vào:** QD07 (danh mục nghĩa vụ thật, lịch nghỉ 2026–2027, bộ ngày mẫu để đối chiếu tiêu chí 2); QD09 (SMTP/M365 thử cho tiêu chí 8; Zalo hoãn theo I10).
- Chưa sửa tên/nhóm loại nghĩa vụ đã tạo trên giao diện (API có sẵn). Xem trước liệt kê cả kỳ kết thúc trước ngày hiệu lực của quy tắc.
- `TasksApi.calendar`/`CalendarTask` (web, module 05) không còn dùng sau khi thay trang Lịch — cần duyệt sửa module 05 để xoá.
- Rủi ro kiểm thử: trình nghe sự kiện bất đồng bộ của `ObligationEngine` có thể còn chạy khi app đóng (đã gây treo khi dừng test giữa chừng); không ảnh hưởng khi chạy thật.
- Ô ngày ng-zorro không nhận ngày gõ tay (đã biết từ 04-E) — chọn qua bảng lịch.
- Ngoài phạm vi: menu trái khung chung chiếm chỗ ở 375px (lỗi core layout ghi từ 03); dashboard (10) đọc dữ liệu 06 thuộc chức năng 10.
- Môi trường: Docker Desktop trên máy này thường tắt giữa các phiên; trước khi chạy e2e cần khởi động lại `ketoan-postgres`.
