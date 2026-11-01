# 10 — Tổng quan và báo cáo

Ngày 30/10/2026. **Đã được người dùng duyệt trong chat ngày 30/10/2026 (“Duyệt, làm 10-B”) — đặc tả, M1–M14 theo phương án đề xuất và phạm vi sửa ngoài module đã liệt kê.**
[Đặc tả demo cũ](10-dashboard-reports.md) chỉ dùng đối chiếu. [Khung đánh giá năng lực](10-performance-evaluation.md)
(G1–G10, đã duyệt 22/10/2026) là một phần của 10 và **không duyệt lại**.

Căn cứ:
- **YC20** trong [phạm vi](../requirements/scope-and-traceability.md): tổng quan vận hành 6 chỉ số; báo cáo tài chính, hợp đồng / KH / dịch vụ / nhân sự theo quyền; lọc kỳ; số liệu nhất quán; xuất XLSX / PDF.
- PDF tích hợp mục **3.1**: tổng quan, 5 thẻ tài chính, 3 biểu đồ, hợp đồng gần đây, việc và hạn.
- PDF tích hợp mục **5.1**: 7 báo cáo; lọc kỳ, xuất Excel / PDF, lưu bộ lọc, hẹn gửi email định kỳ.
- Phụ lục **PL1** mục VII.2:
  - chỉ 6 thẻ chỉ tiêu vận hành, bên dưới là việc ưu tiên, tiến độ HĐ, lịch hạn, thông báo;
  - "các chỉ tiêu doanh thu, VAT, tạm ứng, công nợ và hoá đơn … không cần lặp lại toàn bộ trên Dashboard công việc".
- **QD10**: mâu thuẫn bố cục G và PL1.
- **QD06**: chưa có công thức hoa hồng.
- **QD09**: SMTP, chưa có.
- Số liệu tài chính dùng quy tắc chuẩn hoá của 07 (thu có duyệt, công nợ) và 08 (sổ hoá đơn, đối chiếu).

## Hiện trạng (mức demo)

- **`/dashboard`:**
  - 5 thẻ tài chính kiểu G, nhưng nhân viên vẫn thấy khung tài chính, với số 0.
  - Biểu đồ doanh thu và hợp đồng gần đây.
  - Khối việc / hạn tính theo 3 trạng thái cũ.
  - Không có 6 thẻ PL1.
  - Không bấm được vào số để xem danh sách.
- **`/reports`:**
  - 4 tab: Doanh thu, Công nợ, Tuân thủ deadline (tính theo việc), Hiệu suất nhân viên.
  - Phép tính demo: "việc xong không có ngày hoàn thành coi là đúng hạn"; doanh thu theo người.
  - Chỉ xuất CSV.
  - Không có các báo cáo Hợp đồng, Khách hàng, Hoá đơn.
  - Không lưu bộ lọc, không hẹn gửi.
  - Công nợ đã được sửa ở 07 nhưng tab vẫn là bản rút gọn.

## Phạm vi

- **Trong phạm vi (module `dashboard`, `reports`):**
  - Trang tổng quan vận hành và tab tài chính.
  - Trung tâm báo cáo gồm 8 báo cáo.
  - Danh sách chi tiết cho từng số.
  - Xuất Excel / PDF; lưu bộ lọc; hẹn gửi định kỳ.
  - Schema, migration (bộ lọc đã lưu, lịch gửi), test.
  - Thay phép tính demo, có giải trình test cũ.
- **Phạm vi ngoài module xin duyệt cùng đặc tả:**
  - **Chỉ đọc:**
    - `tasks` (05): trạng thái, mốc nộp / chấp nhận, trả lại, gia hạn, chờ khách, yêu cầu hồ sơ.
    - `contracts` (04, 04-F): hợp đồng, dòng dịch vụ, nhóm thực hiện, hạn hồ sơ kiểm toán, tái ký.
    - `deadlines` (06): nghĩa vụ, ngày nộp, lịch làm việc.
    - `payments` (07) và `invoices` (08): dùng lại service truy vấn sẵn có, không viết lại phép tính.
  - **Giao diện 04 / 05 / 06 / 08:** danh sách Hợp đồng, Công việc, Lịch báo cáo, Hoá đơn nhận thêm bộ lọc từ URL để mở thẳng danh sách khi bấm số trên tổng quan (M3). Chỉ đọc tham số, không đổi API. Có hồi quy web.
  - **`notifications` (06):** dùng `NotificationMailer` và cơ chế khoá chống chạy trùng để gửi báo cáo định kỳ (M12).
  - **`access-control` (01):** không thêm hành động mới; dùng `dashboard:view`, `reports:view`, `reports:view_financial`, `reports:view_operations`, `reports:export`, `finance:view`.
- **Ngoài phạm vi 10:**
  - Doanh số / hoa hồng (YC09): chờ QD06.
  - Sắp xếp lại menu 9 mục PL1: thuộc 11 / nền 00.
  - Ngưỡng màu và SLA chỉnh tay: 11. Trước đó dùng mặc định G8.
  - Chốt số liệu theo kỳ: G10.
  - Báo cáo token / tài khoản: chưa có yêu cầu.
  - Gửi báo cáo cho người khác ngoài chính mình (M12).

## Câu chuyện người dùng

1. **Nhân viên** mở Tổng quan, thấy:
   - việc của mình cần làm, quá hạn, chờ mình duyệt;
   - yêu cầu hồ sơ đang chờ khách;
   - lịch hạn sắp tới và thông báo quan trọng.

   Bấm vào số nào cũng ra đúng danh sách. Không thấy tiền.
2. **Kế toán trưởng** thấy cùng 6 thẻ cho cả nhóm, tiến độ các HĐ đang thực hiện; mở báo cáo Tuân thủ deadline, Hợp đồng, Đánh giá năng lực của nhóm.
3. **Giám đốc** thấy thêm tab **Tài chính**: doanh thu, tổng thanh toán, đã thu, công nợ, hoá đơn, so với kỳ trước. Mở các báo cáo Doanh thu (so cùng kỳ năm trước), Công nợ, Hoá đơn, Khách hàng; xuất Excel / PDF.
4. **Kế toán thu tiền** dùng tab Tài chính và các báo cáo Công nợ, Hoá đơn, Doanh thu.
5. Người hay dùng một bộ lọc thì **lưu bộ lọc**; người cần báo cáo hằng tuần / tháng thì **hẹn gửi** Excel vào email của mình.

## Quyết định cần duyệt

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| M1 | Bố cục tổng quan (QD10) | **Tab "Vận hành"** (mặc định, mọi người có `dashboard:view`): 6 thẻ PL1 + việc cần ưu tiên + tiến độ HĐ đang thực hiện (trái) + lịch hạn 14 ngày + thông báo quan trọng (phải). **Tab "Tài chính"** chỉ hiện với người có `finance:view` (GĐ, KTT, Thu tiền): 5 thẻ G + 3 biểu đồ + HĐ gần đây. Không lặp số tiền trên tab Vận hành (PL1) | Chỉ làm theo PL1 (bỏ phần tài chính); giữ nguyên G |
| M2 | Định nghĩa 6 thẻ PL1 | **HĐ đang thực hiện:** trạng thái Đang thực hiện. **Công việc cần làm:** chưa Hoàn thành. **Công việc quá hạn:** chưa Hoàn thành, hạn hiện hành < hôm nay (giờ VN). **Chờ khách cung cấp hồ sơ:** yêu cầu hồ sơ Đã yêu cầu / Cần bổ sung. **Chờ phê duyệt:** việc đang chờ **chính người xem** kiểm tra / phê duyệt. **Dịch vụ hoàn thành:** dòng dịch vụ hoàn thành trong kỳ / tổng dịch vụ đang chạy, kèm % (thẻ duy nhất theo kỳ lọc). Phạm vi: nhân viên chỉ việc của mình / KH được giao; KTT nhóm; GĐ, Thu tiền toàn công ty | "Chờ phê duyệt" = mọi việc chờ duyệt trong phạm vi |
| M3 | Bấm vào số (drill-down) | Thẻ / ô / cột biểu đồ mở **trang danh sách của module** (Công việc, Hợp đồng, Lịch báo cáo, Hoá đơn, Công nợ) với bộ lọc tương ứng trên URL; số trên thẻ = số dòng của danh sách đó. Báo cáo: bấm ô → ngăn danh sách chi tiết ngay trong báo cáo | Chỉ hiện số, không bấm được |
| M4 | "Doanh thu" là số nào? | Báo cáo Doanh thu có **3 thước đo** song song, không trộn: **Giá trị HĐ** (trước VAT, theo ngày duyệt HĐ, trừ HĐ huỷ); **Đã xuất hoá đơn** (trước VAT, hoá đơn hiệu lực theo ngày lập — 08); **Đã thu** (gồm VAT, phiếu Đã duyệt theo ngày tiền về — 07). Nhóm theo loại dịch vụ / KH / nhân viên phụ trách / tháng. Thẻ "Doanh thu" tab Tài chính = Giá trị HĐ (như G, đổi ngày tính từ ngày bắt đầu sang **ngày duyệt**) | Chỉ một thước đo (giá trị HĐ theo ngày bắt đầu như demo) |
| M5 | So sánh | Tab Tài chính: % so **kỳ liền trước** cùng số ngày (G 3.1, giữ như demo). Báo cáo Doanh thu: so **cùng kỳ năm trước** (G 5.1). Kỳ so sánh = 0 → "—" | Chỉ một kiểu so sánh |
| M6 | Báo cáo Tuân thủ deadline | Theo **lịch báo cáo của 06** (nghĩa vụ pháp lý của KH): đúng hạn / trễ (ngày nộp > hạn) / quá hạn chưa nộp / chưa đến hạn; theo tháng của hạn và theo KH; kèm số do khách chậm. Việc có cờ hạn pháp lý không gắn nghĩa vụ tính thêm. Thay tab demo (đang tính mọi việc) | Giữ cách tính theo mọi việc |
| M7 | Báo cáo Hợp đồng | **Mới ký** (duyệt trong kỳ), **đang thực hiện** (cuối kỳ), **sắp hết hạn** (ngưỡng như danh sách sắp hết hạn 04-D), **tỷ lệ tái ký** = HĐ kết thúc trong kỳ có HĐ tái ký liên kết / HĐ kết thúc trong kỳ. Giá trị tiền chỉ hiện với `finance:view` | Không tính tái ký |
| M8 | Báo cáo Khách hàng (chưa có lịch sử trạng thái KH) | Tính theo hợp đồng: **KH mới** = HĐ đầu tiên được duyệt trong kỳ; **KH ngừng** = HĐ hiệu lực cuối cùng kết thúc trong kỳ, không có HĐ hiệu lực / tái ký sau đó; **tỷ lệ giữ chân** = KH có HĐ hiệu lực đầu kỳ vẫn có HĐ hiệu lực cuối kỳ / KH có HĐ hiệu lực đầu kỳ. Không thêm lịch sử trạng thái KH | Thêm lịch sử trạng thái KH ở 02 rồi tính theo trạng thái |
| M9 | Đánh giá năng lực | Làm đúng khung **G1–G10 đã duyệt**: tab Trợ lý / Trưởng nhóm / Manager, mảng kế toán / kiểm toán, từng chỉ số một cột, ô bấm ra danh sách, phạm vi G9, không tiền. **Thay** báo cáo demo "Hiệu suất nhân viên" (bỏ doanh thu theo người — đã có ở báo cáo Doanh thu theo nhân viên phụ trách, cần quyền tài chính) | — |
| M10 | Xuất PDF | Mỗi báo cáo có **bản in** (trang in riêng: tiêu đề, bộ lọc, ngày in, người in, bảng). "Xuất PDF" mở bản in để lưu PDF từ trình duyệt. Không thêm thư viện tạo PDF trên máy chủ. Excel tạo trên máy chủ (`exceljs` sẵn có), ghi nhật ký `EXPORT` | Tạo PDF trên máy chủ (thêm thư viện; cần gửi PDF qua email) |
| M11 | Lưu bộ lọc | Mỗi người lưu bộ lọc **riêng** (tên, báo cáo, tham số) và mở lại nhanh; không chia sẻ | Bộ lọc dùng chung do GĐ tạo |
| M12 | Hẹn gửi email định kỳ | Người có `reports:export` hẹn gửi **cho chính mình** một bộ lọc đã lưu: hằng tuần (thứ 2) hoặc hằng tháng (ngày 1), 07:30; file Excel đính kèm, quyền / phạm vi tính **tại lúc gửi**; mất quyền thì dừng gửi. Chưa có SMTP (QD09) → thông báo trong ứng dụng kèm link tải, ghi rõ "chưa gửi email". Chống gửi trùng như 06 | Hoãn tính năng gửi định kỳ |
| M13 | Hoa hồng / doanh số theo người giới thiệu (YC09) | **Chưa làm** ở 10 — chờ QD06 (công thức, căn cứ, thời điểm ghi nhận). Báo cáo Doanh thu đã nhóm được theo nhân viên phụ trách / nguồn KH | Làm báo cáo doanh số không có hoa hồng |
| M14 | Menu 9 mục PL1 | Không đổi menu ở 10; ghi đầu vào cho 11 | Sắp xếp menu ngay ở 10 |

## Danh mục báo cáo (`/reports`)

| Báo cáo | Nội dung | Quyền xem | Nguồn |
| --- | --- | --- | --- |
| Doanh thu | M4, M5; nhóm theo loại dịch vụ / KH / nhân viên phụ trách / tháng | `reports:view_financial` | 04, 07, 08 |
| Công nợ phải thu | Số dư theo KH, tuổi nợ, khoản quá hạn, sắp đến hạn | `reports:view_financial` | 07-D1 (dùng lại, không tính lại) |
| Hoá đơn | Hoá đơn đã xuất theo kỳ; đã thu chưa xuất / đã xuất chưa thu | `reports:view_financial` | 08 (dùng lại đối chiếu) |
| Hợp đồng | M7 | `reports:view_operations` (tiền cần `finance:view`) | 04 |
| Khách hàng | M8 | `reports:view_operations` | 02, 04 |
| Tuân thủ deadline | M6 | `reports:view_operations` | 06, 05 |
| Đánh giá năng lực | M9 (G1–G10) | `reports:view_operations` + phạm vi G9 | 04-F, 05, 06 |
| Nhật ký hoạt động | Giữ như 01 (`/audit-log`) | `audit-log:view` | 01 |

Mọi báo cáo: lọc kỳ (tháng / quý / năm / khoảng ngày, giờ VN), lọc nhóm / KH / dịch vụ / người khi phù hợp, phạm vi
dữ liệu theo vai trò, ô không có dữ liệu hiện "—", danh sách chi tiết tái lập được con số, Excel / bản in, lưu bộ lọc.

## Dữ liệu

- Bảng mới `report_saved_filters` (người dùng, báo cáo, tên, tham số JSON).
- Bảng mới `report_schedules` (người dùng, bộ lọc đã lưu, tần suất, bật / tắt, lần gửi gần nhất).
- Lượt gửi dùng `notification_deliveries` của 06 (đối tượng `REPORT`) để chống gửi trùng.
- Không đổi dữ liệu nghiệp vụ; không chốt số liệu (G10).

## Gói thực hiện

1. **10-B — Tổng quan:**
   - Tab Vận hành (6 thẻ, việc ưu tiên, tiến độ HĐ, lịch hạn, thông báo) và tab Tài chính.
   - Bấm số mở danh sách module có bộ lọc trên URL (M3).
   - Thay khối việc demo.
2. **10-C — Báo cáo vận hành:** Tuân thủ deadline (M6), Hợp đồng (M7), Khách hàng (M8); khung trung tâm báo cáo chung (bộ lọc kỳ, danh sách chi tiết, Excel, bản in).
3. **10-D — Báo cáo tài chính:** Doanh thu 3 thước đo, so cùng kỳ (M4, M5); Công nợ và Hoá đơn đọc lại 07 / 08; so khớp số với các màn hình 07 / 08.
4. **10-E — Đánh giá năng lực:** theo G1–G10; thay báo cáo demo "Hiệu suất nhân viên" / "Tuân thủ deadline"; ghi giải trình test cũ.
5. **10-F — Lưu bộ lọc, gửi định kỳ, nghiệm thu:** M11, M12; quét quyền / phạm vi trên mọi API và file xuất; biên bản `10-overview-reports-acceptance.md`.

## Tiêu chí nghiệm thu

1. 6 thẻ đúng định nghĩa M2 và đúng phạm vi từng vai; số trên thẻ = số dòng của danh sách mở ra.
2. Nhân viên / người không có `finance:view` không nhận bất kỳ số tiền nào từ API tổng quan / báo cáo / file xuất (kiểm tra cả JSON lẫn Excel); tab Tài chính không hiện.
3. Cùng một số liệu khớp giữa tổng quan, báo cáo, màn hình nguồn (07 công nợ, 08 đối chiếu, 06 lịch báo cáo, 04-F) và file Excel.
4. Báo cáo Doanh thu: 3 thước đo đúng ngày tính, so cùng kỳ năm trước; kỳ so sánh 0 → "—".
5. Tuân thủ deadline, Hợp đồng, Khách hàng đúng M6–M8 trên bộ dữ liệu mẫu có ca biên (nộp đúng ngày hạn, tái ký, KH ngừng rồi quay lại).
6. Đánh giá năng lực đạt 7 tiêu chí của khung G (đổi người giữa kỳ, gia hạn, trả lại, chờ khách, biên ngày VN, dữ liệu chuyển đổi); phạm vi G9.
7. Bộ lọc lưu / mở lại đúng; gửi định kỳ: đúng lịch, không trùng khi chạy lại / khởi động lại, tính quyền tại lúc gửi, không SMTP thì báo trong ứng dụng.
8. Lint / unit / e2e (chia lô) / access / web / build / max-lines đạt; giao diện desktop và 375px; Excel mở được, bản in đọc được.

## Còn mở sau 10

- Hoa hồng / doanh số (QD06).
- Menu PL1 và ngưỡng chỉnh tay (11).
- Chốt số liệu kỳ (sau khi dùng thật).
- Email thật (QD09).
- Bộ số liệu đối chiếu do Kế toán xác nhận (07 / 08).

## Tiến độ triển khai

- **10-B — Tổng quan: đã code và kiểm chứng kỹ thuật 30/10/2026** (xem mục Kiểm chứng 10-B ở [hiện trạng](../planning/current-status.md)).
  - API: `GET /dashboard/operations` (6 thẻ M2, việc ưu tiên, tiến độ HĐ đang thực hiện, lịch hạn 14 ngày gồm kỳ báo cáo 06 chưa có việc gắn, thông báo quan trọng chưa đọc; phần cần `tasks:view` / `deadlines:view` là null khi không có quyền), `GET /dashboard/operations/services?state=done|open` (danh sách thẻ dịch vụ), `GET /dashboard/finance` (403 khi không có `finance:view`; giá trị HĐ theo ngày duyệt — M4). Bỏ `GET /dashboard` cũ ([giải trình test](10-test-policy-changes.md)).
  - Định nghĩa đếm dùng chung với trang đích (`baseTaskWhere`, `OPEN_WHERE`, `overdueWhere` của 05; phạm vi KH như trang Hồ sơ KH; hàng chờ soát xét như Việc của tôi). Dịch vụ hoàn thành trong kỳ = ngày việc cuối cùng hoàn thành (giờ VN) thuộc kỳ; tổng = hoàn thành trong kỳ + đang chạy (HĐ chưa bắt đầu / đang thực hiện).
  - Giao diện: tab Vận hành / Tài chính; thẻ mở `/contracts?status=IN_PROGRESS`, `/tasks?card=remaining|overdue`, `/tasks/documents?status=WAITING` (gộp đã yêu cầu + cần bổ sung), `/tasks/my?tab=review`; thẻ dịch vụ mở danh sách trên trang. Các trang 04 / 05 chỉ thêm đọc tham số URL.
  - **Chưa làm:** bấm cột "Doanh thu theo loại dịch vụ" mở danh sách HĐ theo loại — API hợp đồng (04) chưa có bộ lọc loại dịch vụ, phạm vi đã duyệt không đổi API 04; làm cùng báo cáo Doanh thu 10-D (danh sách chi tiết trong báo cáo).
- **10-C — Báo cáo vận hành: đã code và kiểm chứng kỹ thuật 30/10/2026.**
  - API (`reports:view_operations`; Excel `…/export` cần thêm `reports:export`, nhật ký ghi EXPORT): `GET /reports/deadline-compliance`, `/reports/contracts`, `/reports/customers` — `from`, `to`, `customerId`; mỗi báo cáo trả `summary`, nhóm và `items` (danh sách tái lập con số).
  - **M6:** kỳ báo cáo 06 có hạn trong kỳ (bỏ "Không áp dụng") + việc pháp lý không gắn nghĩa vụ; đúng hạn = ngày nộp / hoàn thành (giờ VN) không sau hạn; "do khách" = việc gắn có khoảng chờ khách đã được xác nhận (G5), chỉ đếm khi trễ / quá hạn; tỷ lệ không tính "chưa đến hạn"; theo tháng của hạn và theo KH.
  - **M7:** NEW (ngày duyệt trong kỳ), ACTIVE (hiệu lực ngày cuối kỳ), EXPIRING (kết thúc trong 30 ngày sau cuối kỳ, chưa tái ký — ngưỡng 04-D), ENDED, RENEWED (có HĐ tái ký không huỷ); giá trị trước VAT chỉ khi `finance:view`.
  - **M8:** theo HĐ đã duyệt; KH mới / ngừng / có HĐ đầu kỳ / còn cuối kỳ / giữ được, tỷ lệ giữ chân.
  - Giao diện `/reports`: tab "Tuân thủ deadline" mới (thay tab demo tính theo mọi việc), "Hợp đồng", "Khách hàng"; ô tổng hợp bấm để lọc danh sách chi tiết; "Xuất Excel" và "In / PDF" (cửa sổ in riêng). API demo `/reports/task-compliance` bỏ ở 10-E.
- **10-D — Báo cáo tài chính: đã code và kiểm chứng kỹ thuật 30/10/2026.**
  - `GET /reports/revenue` (`reports:view_financial`; `groupBy` loại dịch vụ / KH / người phụ trách / tháng; `customerId`; `format=csv` giữ cho link tải) và `GET /reports/revenue/export` (Excel, cần `reports:export`): 3 thước đo — giá trị HĐ (trước VAT, ngày duyệt; theo loại dịch vụ = thành tiền dòng dịch vụ), đã xuất hoá đơn (trước VAT, hoá đơn Đã xuất / Đã điều chỉnh theo ngày lập, gồm điều chỉnh âm), đã thu (gồm VAT, phiếu Đã duyệt theo ngày tiền về) — so cùng kỳ năm trước (kỳ so sánh 0 → null); theo loại dịch vụ hai thước đo sau là null (không gắn dịch vụ). Trả `details` (HĐ / hoá đơn / phiếu thu trong kỳ) để bấm nhóm ra đúng các dòng.
  - Thay báo cáo doanh thu demo (tính theo ngày bắt đầu). `/reports/receivables` (đã theo quy tắc chung 07-B) giữ cho kiểm tra nhất quán; tab Công nợ dùng màn hình công nợ 07, tab Hoá đơn dùng màn hình đối chiếu thu – xuất 08 (cùng số, cùng Excel).
  - Giao diện: tab Doanh thu mới (biểu đồ 3 cột, bảng có năm trước và ±%, bấm cột / dòng → chi tiết HĐ / hoá đơn / phiếu thu), Excel, bản in.
  - **Còn để sau:** bấm cột biểu đồ ở tab Tài chính của Tổng quan mở thẳng báo cáo Doanh thu đã lọc (hiện người dùng vào Báo cáo → Doanh thu → nhóm theo loại dịch vụ → bấm cột).
- **10-E — Đánh giá năng lực: đã code và kiểm chứng kỹ thuật 01/11/2026** (khung [G1–G10](10-performance-evaluation.md); xem mục Kiểm chứng 10-E ở [hiện trạng](../planning/current-status.md)).
  - API (`reports:view_operations`): `GET /reports/capability` (`from`, `to`, `role` = ASSISTANT / LEAD / MANAGER, `domain` = ALL / ACCOUNTING / AUDIT, `teamId`), `GET /reports/capability/:userId` (danh sách tái lập con số; 403 ngoài phạm vi), `GET /reports/capability/export` (Excel, cần `reports:export`). Phạm vi G9: Giám đốc tất cả; người có quyền lập kế hoạch HĐ (KTT) người trong nhóm và chính mình; nhân viên chỉ chính mình; không có thu tiền, quản trị. Không có số tiền.
  - **Trợ lý** (kế toán và kiểm toán): việc có hạn hiện hành trong kỳ; đúng hạn theo **lần nộp đầu** (G4; việc không cần soát xét: lúc chấp nhận / hoàn thành); hạn nội bộ cộng ngày chờ khách đã được xác nhận (G5, gộp khoảng chồng nhau theo ngày VN), hạn pháp lý không cộng và đếm "trễ hạn pháp lý" riêng (G6); cột hạn gốc, số lần gia hạn đã duyệt (đổi hạn theo lịch I8 không tính), trễ do khách, tỷ lệ bị trả lại, số việc được chấp nhận, số KH đang làm. Dữ liệu chuyển đổi thiếu mốc nộp hiện trong danh sách nhưng không tính (H9) — kể cả việc cũ đang mở đã quá hạn, cho tới khi được nộp.
  - **Trưởng nhóm / Manager:** mảng kế toán tính theo **kỳ dịch vụ** (dòng dịch vụ có nhóm thực hiện × kỳ; hạn = hạn muộn nhất, đạt khi mọi việc được chấp nhận / hoàn thành), gán cho người giữ vai lúc hạn đến theo lịch sử vai (G1); tỷ lệ gia hạn, trễ hạn pháp lý. Mảng kiểm toán dùng đúng số "Theo nhân sự" của 04-F (hạn hồ sơ). Trưởng nhóm thêm số lượt soát xét, trung bình ngày làm việc, tỷ lệ trong SLA 2 ngày (G7), số việc đang chờ mình quá SLA. Hai mảng ở hai nhóm cột riêng, không cộng thành một số.
  - Giao diện: tab "Đánh giá năng lực" thay tab demo "Hiệu suất nhân viên" (bỏ doanh thu theo người — đã có ở Doanh thu theo người phụ trách, cần quyền tài chính); chọn vai, mảng, nhóm; mỗi chỉ số một cột tô màu theo ngưỡng G8; bấm ô (trợ lý) mở danh sách việc lọc đúng ô đó, bấm dòng (trưởng nhóm / Manager) mở kỳ dịch vụ, hạn hồ sơ kiểm toán, lượt soát xét; Excel, bản in. API demo `/reports/task-compliance`, `/reports/staff-performance` đã bỏ ([giải trình test](10-test-policy-changes.md)).
  - **Chưa có nguồn dữ liệu:** "việc phải giao lại do quá hạn" (manager) — 05 không ghi lý do giao lại; để sau khi người dùng xác nhận cần chỉ số này.
- **10-F — Lưu bộ lọc, gửi định kỳ, nghiệm thu: đã code và kiểm chứng kỹ thuật 01/11/2026** — [biên bản](10-overview-reports-acceptance.md).
  - Dữ liệu: `report_saved_filters`, `report_schedules` (migration `20261101090000_report_saved_filters_schedules`, chỉ thêm bảng); lượt gửi dùng `notification_deliveries` của 06, đối tượng `REPORT`, khoá theo (lịch, tần suất, ngày gửi).
  - API `/reports/saved-filters`: danh sách, tạo, đọc, sửa, xoá (riêng từng người, người khác 404; tham số lạ như `token` bị từ chối), `PUT|DELETE /:id/schedule`, `GET /:id/export`. Áp dụng cho Doanh thu, Tuân thủ deadline, Hợp đồng, Khách hàng, Đánh giá năng lực.
  - Gửi định kỳ (M12): thứ 2 / ngày 1, 07:30 giờ VN; chạy mỗi 15 phút, khoá thuê DB; quyền và phạm vi tính tại lúc gửi, mất quyền hoặc tài khoản ngừng thì dừng lịch và báo chủ lịch; chưa có SMTP / đã tắt email → thông báo trong ứng dụng kèm link, ghi rõ "chưa gửi email"; lỗi SMTP thử lại theo I12, hết lượt thì báo trong ứng dụng. Gửi thành công ghi nhật ký `EXPORT`.
  - **Quyết định khi làm, chờ xác nhận lúc nghiệm thu:** kỳ số liệu lượt gửi là tuần trước / tháng trước (M12 chưa nêu); kỳ lưu trong bộ lọc chỉ dùng khi mở lại trên màn hình.
  - Ngoài module (đã xin trong đặc tả): `NotificationMailer.send` thêm tham số file đính kèm, `NotificationsModule` export mailer; bộ gửi email của nhắc việc bỏ qua dòng `REPORT`.
  - Quét quyền: e2e `reports-access-sweep` (15 đường dẫn × 5 vai; không tiền ở JSON / Excel khi không có `finance:view`).
