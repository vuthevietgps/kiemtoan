# 04-F — Theo dõi hợp đồng kiểm toán và đánh giá đúng hạn

Ngày 22/10/2026. **Đã được người dùng duyệt trong chat ngày 22/10/2026: “Tôi duyệt đặc tả 04-F với phương án đề xuất F1–F11 cùng phạm vi sửa ngoài module đã liệt kê.”** Chưa code. Yêu cầu trong chat ngày 22/10/2026: "Viết đặc tả 04-F theo dõi hợp đồng kiểm toán (nhóm KT, người ký, giai đoạn và số BCKT, hồ sơ gửi/lưu/BBNT, bảng theo dõi) để tôi duyệt." và bổ sung cùng ngày: "quản lý dc tiến độ nhân viên, tỷ lệ đúng deadline, ko đúng deadline để đánh giá năng lực nữa".

Căn cứ: YC04 (nghiệm thu truy cập từ KH), YC08 (HĐ nhiều dịch vụ, bộ hồ sơ thương mại), YC10 (tiến độ, ngày thực tế) trong [phạm vi](../requirements/scope-and-traceability.md); [đặc tả 04](04-contracts-lifecycle.md) (04-A–04-E, E1–E6); quyền theo [ma trận 01](01-users-access-control.md); cách tính đúng hạn của [đặc tả demo 10](10-dashboard-reports.md). Tài liệu tham khảo nghiệp vụ: bảng theo dõi `LTGroup_v9_fixed.html` do người dùng cung cấp ngày 22/10/2026 (tab Hợp đồng, Tiến độ job, Tổng hợp). Chỉ lấy nghiệp vụ và trường dữ liệu; **không** lấy code, cách lưu (localStorage, Google Apps Script công khai), đồng bộ hai chiều job ↔ HĐ theo cùng ID hay đoạn sửa dữ liệu lệch cột của file đó.

## Bối cảnh

Công ty kiểm toán theo dõi mỗi hợp đồng kiểm toán bằng: nhóm kiểm toán (Manager, trưởng nhóm, trợ lý), người ký báo cáo, giai đoạn của báo cáo kiểm toán (BCKT) đến khi phát hành, số báo cáo, và các mốc hồ sơ (gửi HĐ cho khách, lưu bản gốc, hoá đơn, biên bản nghiệm thu — BBNT). Ban giám đốc cần biết ai đang kéo chậm tiến độ, tỷ lệ đúng/trễ hạn của từng người để đánh giá năng lực.

Hệ thống hiện có HĐ, dòng dịch vụ, kế hoạch (04-B), việc có hạn (05), báo cáo demo "Hiệu suất nhân viên" theo việc (10) nhưng chưa có thông tin nhóm/người ký/giai đoạn/hạn ở mức hồ sơ kiểm toán, chưa có bảng nhìn tất cả HĐ kiểm toán, và hạn việc hiện sửa được không để lại hạn gốc nên tỷ lệ đúng hạn chưa đủ tin cậy để đánh giá người.

## Phạm vi

- **Trong phạm vi:** module `contracts` (backend, frontend): hồ sơ kiểm toán theo dòng dịch vụ, hạn và mốc thực tế từng giai đoạn, tình trạng hồ sơ HĐ, bảng theo dõi, bảng đúng hạn theo nhân sự ở mức hồ sơ kiểm toán; schema/migration/seed; test tương ứng.
- **Phạm vi ngoài module xin duyệt cùng đặc tả (ngoài danh sách này phải xin thêm):**
  - `service-catalog`: thêm cột `service_types.issues_audit_report` (boolean, mặc định `false`), ô chọn "Dịch vụ phát hành báo cáo kiểm toán" ở form dịch vụ, DTO và test; seed đánh dấu dịch vụ `KT`. Không đổi bảng giá/quy trình (F1).
  - `documents`: chỉ dùng lại kho hồ sơ 02 để lưu file BCKT đã phát hành (nhóm Tài liệu dịch vụ, gắn HĐ); không đổi quy tắc file/preview.
  - `invoices`, `payments`: chỉ **đọc** để hiển thị trên bảng theo dõi; không sửa.
- **Ngoài phạm vi (giữ cho bước sau):**
  - Đúng hạn theo **từng việc** của mỗi nhân viên (trợ lý) → 05/10, với yêu cầu ghi ở mục "Đánh giá theo việc — yêu cầu chuyển cho 05/10" bên dưới.
  - Mức độ ưu tiên, ghi chú "tình hình cụ thể" của job → 05.
  - Nhắc hạn sắp đến/quá hạn qua email/app → 06 (04-F chỉ tô màu và lọc trên màn hình).
  - Công nợ, quá hạn thu, đối soát → 07 (04-F chỉ cộng phiếu thu hiện có).
  - Lập/xuất hoá đơn → 08.
  - Báo cáo tổng hợp năng lực (gộp hồ sơ kiểm toán + việc), biểu đồ, xuất Excel → 10.
  - Nhập dữ liệu cũ từ Google Sheets/Excel của LT Group → khi có file thật (QD08), theo cơ chế nhập của 02.
  - Sổ đăng ký kiểm toán viên hành nghề (số chứng chỉ, hạn) → `users`/11 (F3).

## Quyết định cần duyệt

Người dùng duyệt ngày 22/10/2026 theo cột "Đề xuất".

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| F1 | Theo dõi ở mức nào? Một HĐ có thể có nhiều dòng dịch vụ (ví dụ kiểm toán BCTC + chuyển giá) | Mỗi **dòng dịch vụ** thuộc dịch vụ được đánh dấu "phát hành BCKT" (cờ mới ở 03) là một **hồ sơ kiểm toán** riêng: nhóm, người ký, giai đoạn, hạn, số BCKT riêng. HĐ không có dòng như vậy không hiện trên bảng | Một hồ sơ cho cả HĐ (giống LTGroup, nhưng HĐ nhiều báo cáo phải ghi chung một số BC) |
| F2 | Ai sửa nhóm kiểm toán và chuyển giai đoạn? | Người có `contracts:plan` trong phạm vi (Giám đốc, Kế toán trưởng — như E2) và **trưởng nhóm của chính hồ sơ đó**. Nhân viên khác, thu tiền, quản trị chỉ xem (theo phạm vi) hoặc không thấy | Chỉ người có `contracts:plan` |
| F3 | Người ký báo cáo chọn từ đâu? | Chọn từ **tài khoản nội bộ đang hoạt động** (không gõ tên tự do). Chưa kiểm tra chứng chỉ KTV hành nghề; sổ chứng chỉ để `users`/11 | Thêm ngay cột số chứng chỉ KTV vào `users` (sửa module 01) |
| F4 | Ai được bấm **Phát hành**? | Chỉ **Giám đốc** (`contracts:approve`). Phát hành bắt buộc: số BCKT, ngày phát hành, người ký 1. File BCKT là tuỳ chọn | Người có `contracts:plan` cũng phát hành được |
| F5 | Số BCKT có được trùng? | **Không**: duy nhất trong toàn công ty (so sánh sau khi bỏ khoảng trắng đầu/cuối, không phân biệt hoa thường), chặn ở DB | Chỉ cảnh báo khi trùng |
| F6 | Thêm người vào nhóm có cho họ thấy KH/HĐ không? | **Không** tự mở rộng phạm vi: quyền xem vẫn theo phân công KH (02). Chọn người chưa được phân công KH thì cảnh báo "chưa được phân công khách hàng này" | Tự thêm phân công KH khi đưa vào nhóm (sửa dữ liệu module 02) |
| F7 | Giai đoạn BCKT có tự đổi trạng thái HĐ hay việc không? | **Không**. Giai đoạn nhập tay; không đồng bộ sang trạng thái HĐ (04-A) hay việc (05). Khi mọi hồ sơ của HĐ đã phát hành, trang HĐ gợi ý "Có thể chuyển HĐ sang Đã hoàn thành" | Tự chuyển HĐ sang Đã hoàn thành khi mọi hồ sơ đã phát hành |
| F8 | BBNT "Đã ký" có cần bằng chứng? | Cần: chọn "Đã ký" phải chọn một **bản đã ký** loại Biên bản nghiệm thu của HĐ đã tải lên qua 04-C (nút tải lên ngay trong hộp) | Cho đánh dấu tay không cần file |
| F9 | Đo đúng/trễ hạn theo hạn nào? (hạn sửa tuỳ ý thì tỷ lệ mất ý nghĩa) | Mỗi hạn có **hạn gốc** (chốt khi hồ sơ chuyển sang Đang kiểm toán) và **hạn hiện hành**. Đổi hạn sau khi chốt là **gia hạn**: chỉ Giám đốc, bắt buộc lý do. Đánh giá theo **hạn hiện hành** nhưng mỗi kết quả kèm cờ "đã gia hạn" và số ngày gia hạn; bảng nhân sự hiện riêng cột "Đúng hạn gốc" | Luôn đánh giá theo hạn gốc (gia hạn chỉ để lập kế hoạch, không cứu tỷ lệ) |
| F10 | Trễ hạn hồ sơ tính cho ai? | Trễ **phát hành** và trễ **kết thúc kiểm toán** tính cho **Manager và trưởng nhóm** của hồ sơ; trễ **soát xét** tính cho **người ký 1** và Manager. Trợ lý **không** bị tính theo hồ sơ — trợ lý được đánh giá theo việc của mình (05/10). Người được tính là người giữ vai **tại thời điểm hạn đến** (đổi người trước hạn thì người mới chịu) | Tính cho cả nhóm, kể cả trợ lý |
| F11 | Ai xem bảng đúng hạn theo nhân sự? | Giám đốc: tất cả. Kế toán trưởng: người trong nhóm mình. Nhân viên: **chỉ dòng của chính mình**. Kế toán thu tiền, quản trị: không | Chỉ Giám đốc |

## Người dùng và câu chuyện

1. Là **Giám đốc**, tôi mở một bảng thấy mọi HĐ kiểm toán: giai đoạn BCKT, hạn, ai làm, ai ký, đã gửi/lưu HĐ chưa, đã có BBNT/hoá đơn chưa, đã thu bao nhiêu, để biết HĐ nào đang kẹt hoặc trễ.
2. Là **Kế toán trưởng / trưởng nhóm**, tôi phân Manager, trưởng nhóm, trợ lý, người ký và đặt hạn cho từng giai đoạn của hồ sơ kiểm toán, rồi cập nhật giai đoạn khi nhóm tiến triển.
3. Là **Giám đốc**, tôi phát hành BCKT: nhập số báo cáo, ngày phát hành, xác nhận người ký, đính kèm file báo cáo; sau đó hồ sơ khoá, chỉ mở lại được kèm lý do.
4. Là **Giám đốc**, tôi gia hạn khi khách chậm cung cấp tài liệu, ghi lý do, để lần sau xem lại biết trễ do đâu.
5. Là **Giám đốc / Kế toán trưởng**, tôi xem theo từng người: đang giữ bao nhiêu hồ sơ, bao nhiêu đúng hạn, bao nhiêu trễ, trễ trung bình bao nhiêu ngày, bao nhiêu đang quá hạn, trong khoảng thời gian tôi chọn — làm căn cứ đánh giá năng lực.
6. Là **người phụ trách HĐ**, tôi ghi đã gửi HĐ cho khách dạng nào, đã lưu bản gốc ở văn phòng chưa, BBNT đang chờ ký hay đã ký.
7. Là **nhân viên** được phân công khách, tôi xem nhóm, giai đoạn, hạn của các hồ sơ kiểm toán thuộc khách của mình, **không** thấy số tiền; tôi xem được tỷ lệ đúng hạn của chính mình.
8. Là **kế toán thu tiền**, tôi lọc các HĐ đã phát hành báo cáo mà chưa có hoá đơn hoặc còn phải thu.

## Nghiệp vụ

### Hồ sơ kiểm toán (theo dòng dịch vụ — F1)

- Dòng dịch vụ có dịch vụ mang cờ `issues_audit_report` có một hồ sơ kiểm toán. Hồ sơ được tạo **khi lưu lần đầu** (chưa lưu thì hiển thị mặc định "Chưa thực hiện", trống nhóm); không tạo hàng loạt cho dữ liệu cũ.
- **Nhóm kiểm toán:** Manager (0–1), trưởng nhóm (0–1), trợ lý (0–10, có thứ tự). Mỗi người là tài khoản nội bộ đang hoạt động, không phải tài khoản quản trị; một người không giữ hai vai trong cùng hồ sơ. Cảnh báo theo F6 nếu người chưa được phân công khách. Mỗi lần đổi người ghi lịch sử vai (ai, vai gì, từ ngày, đến ngày) để tính trách nhiệm theo F10.
- **Người ký:** người ký 1 và người ký 2 (tuỳ chọn), khác nhau, theo F3.
- **Năm kiểm toán:** lấy năm từ kỳ của dòng dịch vụ (`2025`, `2025-12`, `2025-Q4` → 2025); dòng không có kỳ dùng năm ngày bắt đầu HĐ. Dùng cho bộ lọc "Năm".
- **Giai đoạn BCKT:** Chưa thực hiện → Đang kiểm toán → Đang soát xét → Chờ phát hành → Đã phát hành.
  - Chuyển tới hoặc lùi giữa bốn giai đoạn đầu: người theo F2. Lùi giai đoạn bắt buộc ghi lý do (5–500 ký tự).
  - **Phát hành** (chỉ từ Chờ phát hành, theo F4): nhập số BCKT, ngày phát hành (không sau hôm nay, không trước ngày bắt đầu HĐ), người ký 1 bắt buộc; tuỳ chọn tải file BCKT (PDF) vào kho hồ sơ KH, nhóm Tài liệu dịch vụ, gắn HĐ.
  - **Mở lại** (Đã phát hành → Chờ phát hành): chỉ Giám đốc, bắt buộc lý do; giữ số BCKT cũ để sửa, lịch sử ghi trước–sau. Phát hành lại sau khi mở lại: kết quả đúng/trễ hạn tính theo **lần phát hành đầu tiên** (mở lại để sửa sai không làm hồ sơ đang đúng hạn thành trễ, và không cứu hồ sơ đã trễ).
  - Sau phát hành không sửa nhóm, người ký, số BCKT, ngày phát hành, hạn (phải mở lại).
- HĐ ở Nháp/Chờ duyệt: sửa nhóm, người ký, hạn được (chuẩn bị trước), **không** chuyển giai đoạn. HĐ huỷ: chỉ xem, không tính vào tỷ lệ đúng hạn. Dòng dịch vụ bị phụ lục bỏ (04-D): hồ sơ ẩn khỏi bảng, không tính vào tỷ lệ, giữ lịch sử.
- Mọi lần lưu kiểm tra `revision` → 409 nếu người khác đã sửa trước (khoá lạc quan như 04-B).

### Hạn và mốc thực tế

- Ba hạn của mỗi hồ sơ, theo ngày lịch (giờ Việt Nam):

  | Hạn | Đạt khi | Tính trách nhiệm (F10) |
  | --- | --- | --- |
  | Kết thúc kiểm toán | Hồ sơ chuyển sang Đang soát xét lần đầu | Manager, trưởng nhóm |
  | Hoàn tất soát xét | Hồ sơ chuyển sang Chờ phát hành lần đầu | Người ký 1, Manager |
  | Phát hành BCKT | Phát hành lần đầu | Manager, trưởng nhóm |

- **Hạn phát hành bắt buộc** trước khi chuyển sang Đang kiểm toán; hai hạn còn lại tuỳ chọn, nếu có phải theo thứ tự (kết thúc ≤ soát xét ≤ phát hành).
- **Gợi ý hạn**: nếu dòng dịch vụ có kế hoạch 04-B đã xác nhận, gợi ý hạn phát hành = hạn bước cuối của kế hoạch; người dùng vẫn sửa được trước khi chốt.
- **Chốt hạn gốc** khi chuyển sang Đang kiểm toán lần đầu. Trước đó người theo F2 sửa tự do. Sau đó đổi hạn là **gia hạn** theo F9: Giám đốc, lý do 5–500 ký tự, hạn mới khác hạn cũ; ghi lịch sử (hạn cũ, hạn mới, người, lý do). Không gia hạn hạn đã đạt.
- **Mốc thực tế**: mỗi lần chuyển giai đoạn ghi bản ghi sự kiện (từ, đến, thời điểm, người, lý do nếu lùi). Không sửa/xoá sự kiện. Lùi rồi tiến lại không đổi mốc "lần đầu" đã ghi.
- **Kết quả từng hạn:**
  - **Đúng hạn**: ngày đạt (giờ Việt Nam) ≤ hạn hiện hành.
  - **Trễ hạn**: ngày đạt > hạn hiện hành; số ngày trễ = ngày đạt − hạn.
  - **Quá hạn (chưa đạt)**: hôm nay > hạn hiện hành mà chưa đạt; số ngày quá hạn tính đến hôm nay.
  - **Sắp đến hạn**: chưa đạt, còn ≤ 7 ngày (ngưỡng cố định, 11 đưa vào Cài đặt).
  - Mỗi kết quả kèm cờ **đã gia hạn** và kết quả theo **hạn gốc** (F9).

### Đúng hạn theo nhân sự (mức hồ sơ kiểm toán)

- Tab **Theo nhân sự** trên trang theo dõi. Chọn khoảng thời gian (mặc định năm nay); một hạn thuộc khoảng nếu **hạn hiện hành** nằm trong khoảng (giống "việc có hạn trong kỳ" của 10).
- Mỗi người (theo F10, chỉ người được tính trách nhiệm) một dòng:
  - Số hồ sơ đang giữ vai (Manager / trưởng nhóm / người ký 1) hiện tại.
  - Số hạn đến hạn trong kỳ; **đúng hạn**; **trễ hạn**; **quá hạn chưa đạt**.
  - **Tỷ lệ đúng hạn** = đúng hạn / (đúng hạn + trễ hạn + quá hạn chưa đạt), làm tròn 1 chữ số thập phân; không có hạn nào thì hiện "—", không hiện 0%.
  - **Tỷ lệ đúng hạn gốc** (F9) và số lần được gia hạn.
  - **Trễ trung bình** (ngày) của các hạn trễ.
- Bấm một người: danh sách các hạn được tính (hồ sơ, loại hạn, hạn gốc, hạn hiện hành, ngày đạt, kết quả, lý do gia hạn) để người đánh giá đối chiếu, không chỉ nhìn con số.
- Bộ lọc: khoảng thời gian, vai (Manager / trưởng nhóm / người ký), loại hạn, dịch vụ, nhóm (team).
- Phạm vi người và hồ sơ theo F11 và phạm vi HĐ; không có cột tiền.

### Đánh giá theo việc — yêu cầu chuyển cho 05/10

Không làm trong 04-F. Đã gom vào [khung đánh giá năng lực theo vai trò](10-performance-evaluation.md) (người dùng duyệt G1–G10 ngày 22/10/2026); khung dùng lại F9–F11 và không đổi phạm vi 04-F2. Ghi chú gốc:

- Việc phải có **hạn gốc** (lúc sinh/giao) tách khỏi hạn hiện hành; đổi hạn sau khi giao cần người có quyền duyệt và lý do (cùng nguyên tắc F9).
- Việc "Đã làm" phải có `completedAt`; bỏ quy tắc demo 10 "việc DONE không có `completedAt` coi là đúng hạn".
- Đúng hạn của việc tính cho **người thực hiện tại thời điểm hoàn thành**; việc bị trả lại (soát xét 05) tính lần hoàn thành được chấp nhận hay lần nộp đầu — để 05 chốt.
- Báo cáo năng lực ở 10 gộp hai nguồn: đúng hạn theo hồ sơ (04-F) và theo việc (05), hiện tách cột, không cộng chung thành một con số.

### Tình trạng hồ sơ HĐ (theo HĐ)

| Mục | Giá trị | Ghi chú |
| --- | --- | --- |
| Gửi HĐ cho khách | Chưa gửi / Đã gửi bản mềm / Đã gửi bản scan đã ký / Đã gửi bản cứng / Đã gửi đủ bản cứng và mềm | Kèm ngày gửi (bắt buộc khi khác "Chưa gửi") |
| Lưu bản gốc tại văn phòng | Chưa lưu / Đang chờ bản ký / Đã lưu | Kèm ngày lưu khi "Đã lưu"; ghi chú vị trí lưu (tuỳ chọn, tối đa 200 ký tự) |
| Biên bản nghiệm thu | Chưa có / Đang chờ ký / Đã ký | "Đã ký" theo F8 (gắn bản đã ký loại BBNT của 04-C) và ngày ký |

- Sửa: `contracts:update` trong phạm vi; HĐ đã duyệt trở đi (Nháp chỉ được "Gửi HĐ" bản mềm dự thảo); HĐ huỷ không sửa.
- Không có trường hoá đơn ở đây: cột **Hoá đơn** trên bảng **đọc** từ bảng hoá đơn (08): Chưa có / Đã đề nghị / Đã phát hành (bỏ hoá đơn huỷ), tránh ghi hai nơi.

### Bảng theo dõi HĐ kiểm toán

- Trang mới `/contracts/audit-tracking` ("Theo dõi kiểm toán"), nút từ danh sách HĐ; hai tab: **Hồ sơ** (mặc định) và **Theo nhân sự**. Ở tab Hồ sơ mỗi dòng là một hồ sơ kiểm toán (F1).
- **Cột:** STT; Khách hàng (tên, MST); Năm; Dịch vụ; Số HĐ (mở chi tiết HĐ); Ngày ký; Giá trị dòng (trước VAT) và Tổng HĐ; Đã thu; Còn phải thu; Người phụ trách HĐ; Manager; Trưởng nhóm; Trợ lý (rút gọn "+n"); Giai đoạn (nhãn màu); **Hạn phát hành** và **tình trạng hạn** (Đúng hạn / Trễ n ngày / Quá hạn n ngày / Sắp đến hạn / dấu "đã gia hạn"); Số BCKT; Ngày phát hành; Người ký 1/2; Gửi HĐ; Bản gốc; Hoá đơn; BBNT.
  - Cột tiền (Giá trị, Tổng, Đã thu, Còn phải thu) chỉ trả và hiện cho người có quyền tài chính (dùng bộ lọc trường tài chính sẵn có).
  - Đã thu = tổng phiếu thu còn hiệu lực của HĐ; Còn phải thu = Tổng HĐ − Đã thu (không âm). Đây là số theo HĐ, không phải theo dòng; ghi rõ trên tiêu đề cột. Công nợ quá hạn thuộc 07.
- **Bộ lọc:** tìm (tên KH, MST, số HĐ, số BCKT); Năm; Dịch vụ; Giai đoạn; Người phụ trách HĐ; Manager; Trưởng nhóm; Người ký; **Tình trạng hạn** (quá hạn / sắp đến hạn / trễ / đã gia hạn); "Hồ sơ HĐ chưa đủ" (chưa gửi / chưa lưu bản gốc / chưa có BBNT); "Đã phát hành nhưng chưa có hoá đơn"; "Còn phải thu" (chỉ người có quyền tài chính). Bộ lọc giữ trên URL để gửi link cho nhau.
- **Thẻ đếm** theo bộ lọc hiện tại: tổng hồ sơ, Đang kiểm toán, Đang soát xét, Chờ phát hành, Đã phát hành, **Quá hạn**, **Sắp đến hạn**; người có quyền tài chính thấy thêm Tổng giá trị, Đã thu, Còn phải thu (tính trên các HĐ khác nhau, không cộng trùng HĐ nhiều dòng).
- Phân trang phía server (mặc định 50 dòng, tối đa 200), sắp xếp theo ngày ký, số HĐ, giai đoạn, hạn phát hành, ngày phát hành.
- Bấm một dòng mở **ngăn chi tiết** bên phải: sửa nhóm, người ký, hạn, giai đoạn, gia hạn, phát hành/mở lại, tình trạng hồ sơ HĐ, xem dòng thời gian giai đoạn và gia hạn — đúng quyền; không sửa trực tiếp trong ô bảng.
- 375px: bảng cuộn ngang trong khối, cột Khách hàng cố định; ngăn chi tiết chiếm toàn màn hình.

### Trên trang chi tiết HĐ

- Tab mới **Kiểm toán** (chỉ hiện khi HĐ có dòng dịch vụ phát hành BCKT): mỗi hồ sơ một khối (nhóm, người ký, giai đoạn, hạn và tình trạng hạn, dòng thời gian, số BCKT, file BCKT) và khối **Tình trạng hồ sơ HĐ**. Dùng cùng component với ngăn chi tiết của bảng.
- Tab Lịch sử (04-D) hiển thị thêm các thao tác của 04-F.

## Quyền và phạm vi

| Hành động | Giám đốc | Kế toán trưởng | Nhân viên | Kế toán thu tiền | Quản trị |
| --- | --- | --- | --- | --- | --- |
| Xem tab Hồ sơ, tab Kiểm toán (`contracts:view`, theo phạm vi HĐ) | Có | Có (nhóm) | Có (KH được phân công), không thấy tiền | Có (theo phạm vi hiện có), thấy tiền | Không |
| Xem tab Theo nhân sự (F11) | Tất cả | Người trong nhóm | Chỉ chính mình | Không | Không |
| Sửa nhóm, người ký, hạn trước khi chốt, chuyển giai đoạn trước phát hành | Có | Có (`contracts:plan`) | Chỉ khi là trưởng nhóm của hồ sơ (F2) | Không | Không |
| Gia hạn sau khi chốt (F9), phát hành, mở lại (F4) | Có | Không | Không | Không | Không |
| Sửa tình trạng hồ sơ HĐ (`contracts:update`) | Có | Có | Theo quyền `contracts:update` hiện có | Không | Không |

- Không thêm hành động quyền mới; nếu chọn phương án khác ở F2/F4/F9/F11 thì cập nhật bảng này trước khi code.
- Mọi API mới lọc theo `scopedContract`; hồ sơ ngoài phạm vi trả 404 như các API HĐ khác. Tab Theo nhân sự chỉ đếm hồ sơ trong phạm vi HĐ của người xem.

## Dữ liệu và migration (dự kiến)

| Bảng/cột | Nội dung |
| --- | --- |
| `service_types.issues_audit_report` | boolean, mặc định `false` (F1, ngoài module — đã liệt kê) |
| `audit_engagements` | `contract_service_id` (unique), `stage` (enum 5 giá trị), `manager_id`, `lead_id`, `signer1_id`, `signer2_id`, `report_number`, `report_number_key` (chuẩn hoá cho F5, unique một phần khi khác null), `report_date`, `report_document_id` (kho hồ sơ 02, tuỳ chọn), `issued_by_id`, `issued_at`, `deadlines_locked_at`, `revision`, thời điểm tạo/sửa |
| `audit_engagement_members` | `engagement_id`, `user_id`, `sort_order`; unique (`engagement_id`, `user_id`) — trợ lý hiện tại |
| `audit_engagement_role_history` | `engagement_id`, `role` (MANAGER/LEAD/SIGNER1/SIGNER2/ASSISTANT), `user_id`, `from_at`, `to_at` (null = đang giữ) — để tính trách nhiệm theo F10 |
| `audit_engagement_deadlines` | `engagement_id`, `kind` (FIELDWORK_END/REVIEW_END/REPORT_ISSUE), `original_due`, `current_due`, `achieved_at` (lần đầu), unique (`engagement_id`, `kind`) |
| `audit_engagement_deadline_changes` | `deadline_id`, `old_due`, `new_due`, `reason`, `changed_by_id`, `changed_at` — chỉ thêm, không sửa/xoá |
| `audit_engagement_stage_events` | `engagement_id`, `from_stage`, `to_stage`, `reason`, `actor_id`, `occurred_at` — chỉ thêm, không sửa/xoá |
| `contracts` | thêm `client_delivery_status`, `client_delivered_at`, `original_filing_status`, `original_filed_at`, `original_filing_note`, `acceptance_status`, `acceptance_signed_at`, `acceptance_document_id` (bản đã ký 04-C), `dossier_revision` |

- Khoá ngoại người dùng theo cách 04-D (kiểm tra tài khoản còn hoạt động ở service, không thêm quan hệ ngược vào `users.prisma`).
- Migration chỉ thêm cột/bảng/index; HĐ cũ nhận giá trị mặc định (Chưa gửi / Chưa lưu / Chưa có). Không tạo hồ sơ kiểm toán cho dữ liệu cũ. Kiểm chứng trên DB trống và bản sao DB demo có dữ liệu; Prisma diff sạch.
- Seed: đánh dấu dịch vụ `KT`; tạo hồ sơ mẫu ở các giai đoạn khác nhau, có hạn đúng, trễ, quá hạn, sắp đến hạn và một lần gia hạn; một hồ sơ đã phát hành có số BCKT; một HĐ có BBNT "Đang chờ ký". Ngày seed tính tương đối theo hôm nay để demo luôn có đủ các trường hợp.
- Audit: `ENGAGEMENT_UPDATE` (trước–sau các trường nhóm/người ký/hạn trước khi chốt), `ENGAGEMENT_STAGE` (từ, đến, lý do nếu lùi), `DEADLINE_EXTEND` (hạn cũ, hạn mới, lý do), `REPORT_ISSUE`, `REPORT_REOPEN` (lý do), `DOSSIER_UPDATE` (trước–sau).

## API (dự kiến)

| Phương thức | Đường dẫn | Quyền | Ghi chú |
| --- | --- | --- | --- |
| GET | `/contracts/audit-tracking` | `contracts:view` | Tab Hồ sơ: bộ lọc, phân trang, sắp xếp, thẻ đếm |
| GET | `/contracts/audit-tracking/people?from&to` | `contracts:view` + F11 | Tab Theo nhân sự: một dòng mỗi người trong phạm vi được xem |
| GET | `/contracts/audit-tracking/people/:userId?from&to` | `contracts:view` + F11 | Danh sách hạn được tính của một người |
| GET | `/contracts/:id/audit-engagements` | `contracts:view` | Hồ sơ kiểm toán, hạn, dòng thời gian + tình trạng hồ sơ của một HĐ |
| PUT | `/contracts/:id/audit-engagements/:lineId` | F2 | Nhóm, người ký, hạn (trước khi chốt); kèm `revision` |
| POST | `/contracts/:id/audit-engagements/:lineId/stage` | F2 | Giai đoạn mới, lý do khi lùi; lần đầu sang Đang kiểm toán chốt hạn gốc |
| POST | `/contracts/:id/audit-engagements/:lineId/deadlines/:kind/extend` | Giám đốc (F9) | Hạn mới, lý do; kèm `revision` |
| POST | `/contracts/:id/audit-engagements/:lineId/issue` | F4 | Số BCKT, ngày, người ký, file (multipart, tuỳ chọn) |
| POST | `/contracts/:id/audit-engagements/:lineId/reopen` | F4 | Lý do |
| PUT | `/contracts/:id/dossier` | `contracts:update` | Gửi HĐ, bản gốc, BBNT; kèm `dossier_revision` |

## Luồng lỗi chính

- Dòng dịch vụ không thuộc dịch vụ phát hành BCKT → 400 "Dịch vụ này không phát hành báo cáo kiểm toán".
- Người được chọn đã nghỉ, là quản trị, trùng vai trong hồ sơ, hoặc người ký 1 = người ký 2 → 400 theo từng trường.
- Chuyển sang Đang kiểm toán khi chưa có hạn phát hành → 400; hạn sai thứ tự → 400; sửa hạn trực tiếp sau khi chốt → 400 "Dùng chức năng gia hạn"; gia hạn không có lý do, trùng hạn cũ, hoặc hạn đã đạt → 400; người không phải Giám đốc gia hạn → 403.
- Chuyển giai đoạn sai thứ tự (ví dụ nhảy thẳng Đã phát hành), HĐ Nháp/Chờ duyệt/Huỷ → 400; phát hành trùng số BCKT → 409; bấm phát hành đồng thời → một lần thành công, lần sau 409.
- `revision` cũ → 409 "Hồ sơ đã được người khác cập nhật, tải lại để xem".
- BBNT "Đã ký" không có bản đã ký loại BBNT của chính HĐ → 400 (F8).
- Nhân viên không phải trưởng nhóm gọi API sửa → 403; nhân viên xem tab Theo nhân sự của người khác → 403; HĐ ngoài phạm vi → 404.

## Tiêu chí nghiệm thu

1. Chỉ dòng dịch vụ có cờ phát hành BCKT hiện trên bảng và tab Kiểm toán; bật/tắt cờ ở form dịch vụ có audit.
2. Phân nhóm, người ký đúng ràng buộc; cảnh báo người chưa được phân công KH; thêm người vào nhóm không làm họ thấy KH ngoài phạm vi (F6); lịch sử vai ghi đúng từ–đến khi đổi người.
3. Giai đoạn chỉ chuyển theo quy tắc; lùi phải có lý do; phát hành chỉ Giám đốc, đủ số/ngày/người ký; số BCKT trùng (kể cả khác hoa thường/khoảng trắng) bị chặn ở DB; mở lại có lý do; sau phát hành không sửa được nhóm/người ký/số/hạn.
4. Hạn phát hành bắt buộc trước Đang kiểm toán; hạn gốc chốt đúng lúc; chỉ Giám đốc gia hạn, có lý do, lịch sử không sửa được; gợi ý hạn từ kế hoạch 04-B khi có.
5. Kết quả đúng hạn / trễ / quá hạn / sắp đến hạn tính đúng theo giờ Việt Nam ở biên ngày (đạt đúng ngày hạn = đúng hạn); kết quả theo hạn gốc và cờ gia hạn đúng; lùi rồi tiến lại hoặc mở lại rồi phát hành lại không đổi mốc lần đầu.
6. Tab Theo nhân sự: đếm đúng theo F10 (người giữ vai tại thời điểm hạn đến; trợ lý không bị tính); tỷ lệ đúng công thức, "—" khi không có hạn; danh sách chi tiết khớp con số; phạm vi xem đúng F11 (nhân viên chỉ thấy mình, KTT chỉ nhóm mình).
7. Tình trạng hồ sơ HĐ lưu đúng; BBNT "Đã ký" bắt buộc gắn bản đã ký loại BBNT của HĐ; cột Hoá đơn đọc đúng từ 08 (bỏ hoá đơn huỷ).
8. Tab Hồ sơ: bộ lọc (gồm tình trạng hạn), tìm, sắp xếp, phân trang, thẻ đếm đúng; HĐ nhiều dòng không bị cộng trùng tiền; bộ lọc giữ trên URL.
9. Nhân viên không thấy tiền trên bảng, tab và API mới; kế toán thu tiền thấy tiền nhưng không sửa nhóm/giai đoạn/hạn và không xem tab Theo nhân sự; quản trị không truy cập.
10. Khoá lạc quan (409) cho hồ sơ và tình trạng hồ sơ; mọi thao tác có audit trước–sau, hiện ở tab Lịch sử.
11. Migration trên DB trống và DB có dữ liệu không đổi HĐ cũ; Prisma diff sạch; seed chạy lại không tạo trùng.
12. Lint/unit/e2e/build/`check-max-lines` đạt; e2e phân quyền 5 vai trò cho mọi API mới; unit cho chuẩn hoá số BCKT, suy ra năm từ kỳ, máy trạng thái giai đoạn, kết quả hạn ở biên ngày, gán trách nhiệm theo lịch sử vai, công thức tỷ lệ, tính đã thu/còn phải thu không cộng trùng.
13. Giao diện desktop/375px: lọc bảng → mở ngăn → phân nhóm, đặt hạn → chuyển giai đoạn → gia hạn → phát hành (có file) → mở lại → cập nhật gửi HĐ/bản gốc/BBNT; tab Theo nhân sự và danh sách chi tiết một người; tab Kiểm toán trên chi tiết HĐ.

## Test hồi quy

- Không dự kiến sửa test hiện có. Test form dịch vụ (03) được bổ sung cho ô cờ mới, không đổi kỳ vọng cũ. Nếu khi code phát hiện test cũ phải đổi, ghi lý do vào `04-test-policy-changes.md` trước khi đổi.
- Không đổi báo cáo demo 10 (`/reports/staff-performance`, `/reports/task-compliance`) trong 04-F; các thay đổi về hạn gốc/`completedAt` của việc thuộc 05/10 như đã ghi ở trên.
- Chạy lại e2e 04 (duyệt, kế hoạch, hồ sơ thương mại, phụ lục, tái ký) để chắc thêm cột vào `contracts` không ảnh hưởng.

## Phân kỳ triển khai

1. Người dùng duyệt đặc tả và F1–F11 (đã duyệt 22/10/2026).
2. 04-F1: cờ dịch vụ (03), schema/migration/seed, API hồ sơ kiểm toán (nhóm, người ký, giai đoạn, phát hành) và tình trạng hồ sơ HĐ, unit + e2e.
3. 04-F2: hạn, gia hạn, mốc thực tế, lịch sử vai, kết quả hạn; API tab Theo nhân sự; unit + e2e.
4. 04-F3: API và trang `/contracts/audit-tracking` (hai tab), ngăn chi tiết, tab Kiểm toán, test web; kiểm chứng giao diện; cập nhật [hiện trạng](../planning/current-status.md).
5. Thực hiện sau 04-E như kế hoạch, trước biên bản nghiệm thu 04, trừ khi người dùng muốn làm 04-F trước 04-E.

## Tiến độ triển khai

### 04-F1 — Hồ sơ kiểm toán và tình trạng hồ sơ HĐ (đã code và kiểm chứng kỹ thuật ngày 22/10/2026)

- **Cờ dịch vụ (03):** `service_types.issues_audit_report`; DTO, audit `SERVICE_UPDATE` trước–sau; ô "Phát hành báo cáo kiểm toán" ở form dịch vụ (web). Seed bật cho `KT`.
- **Schema** (`prisma/schema/audit-engagements.prisma`, migration `20261022090000_audit_engagements`, chỉ thêm): `audit_engagements` (unique `contract_service_id`, unique `report_number_key` — NULL không trùng nên không cần index một phần), `audit_engagement_members`, `audit_engagement_role_history`, `audit_engagement_stage_events`; cột tình trạng hồ sơ ở `contracts` (khoá ngoại `acceptance_document_id` → `contract_documents`). `report_document_id` lưu id tài liệu kho 02, không khoá ngoại để không sửa `customers.prisma`.
- **Làm sớm hơn phân kỳ:** lịch sử vai và mốc giai đoạn (ghi ở F1 để F2 tính đúng hạn trên dữ liệu đầy đủ từ đầu). Hạn, gia hạn, kết quả hạn và tab Theo nhân sự vẫn thuộc F2.
- **API:** `GET /contracts/:id/audit-engagements` (`contracts:view`, trả hồ sơ từng dòng KT, tình trạng hồ sơ, cảnh báo F6 `unassigned`, cờ `canEdit`/`canIssue`/`canEditDossier`); `PUT .../audit-engagements/:lineId`, `POST .../stage` (F2 — kiểm tra ở service: `contracts:plan` hoặc trưởng nhóm hồ sơ); `POST .../issue` (multipart, file PDF tuỳ chọn), `POST .../reopen` (`contracts:approve`); `PUT /contracts/:id/dossier` (`contracts:update`). Mọi lệnh kiểm tra `revision` (409), ghi audit `ENGAGEMENT_UPDATE`/`ENGAGEMENT_STAGE`/`REPORT_ISSUE`/`REPORT_REOPEN`/`DOSSIER_UPDATE`; lịch sử HĐ bỏ bản ghi chung trùng (đường dẫn chứa `/audit-engagements/` và đuôi `/dossier`).
- **Quy ước khi triển khai (cần người dùng biết):**
  - Chuyển giai đoạn: tiến đúng một bước; lùi bao nhiêu bước cũng được nhưng phải có lý do. HĐ Thanh lý vẫn chuyển giai đoạn/phát hành được (cùng nhóm "đã duyệt").
  - Người ký có thể đồng thời là Manager/trưởng nhóm (đặc tả chỉ cấm trùng vai trong nhóm và ký 1 ≠ ký 2); có ký 2 thì phải có ký 1.
  - Phát hành lại sau khi mở lại giữ số BCKT cũ (có thể sửa); file BCKT mới (nếu tải) thay liên kết, file cũ vẫn ở kho hồ sơ.
  - Tình trạng hồ sơ: ngày gửi/lưu/ký không được sau hôm nay; đổi về "Chưa gửi/Chưa lưu/Chưa có" thì xoá ngày, ghi chú, liên kết bản ký.
  - **Phụ lục (04-D) không bỏ được dòng đã có hồ sơ kiểm toán** (như dòng đã có việc) để giữ mốc giai đoạn và lịch sử vai — sửa nhỏ trong `amendments` cùng module.
- **Seed:** thêm HĐ kiểm toán HD-2025-018 (MNO, Đang kiểm toán) và HD-2025-019 (STU, đã phát hành `150425/2025/BCKT-DEMO`); HD-2025-013 ở Đang soát xét, BBNT "Đang chờ ký", đã gửi đủ bản cứng + mềm, đã lưu bản gốc. Chạy lại không tạo trùng.

### 04-F2 — Hạn, gia hạn, kết quả hạn, tab Theo nhân sự (đã code và kiểm chứng kỹ thuật ngày 22/10/2026)

- **Schema** (migration `20261022120000_audit_deadlines`, chỉ thêm): `audit_engagement_deadlines` (unique hồ sơ + loại hạn; hạn gốc, hạn hiện hành, `achieved_at`), `audit_engagement_deadline_changes` (lịch sử gia hạn, chỉ thêm), `audit_engagements.deadlines_locked_at`.
- **Hạn dự kiến:** gửi kèm khi lưu nhóm (`fieldworkDue`, `reviewDue`, `issueDue`: bỏ trống = giữ nguyên, `null` = bỏ hạn); trước khi chốt sửa cả hạn gốc; phải theo thứ tự. Lần đầu sang Đang kiểm toán bắt buộc có hạn phát hành và chốt hạn gốc; sau đó đổi hạn khi lưu nhóm → 400 "dùng chức năng gia hạn". GET trả `suggestedIssueDue` = hạn bước cuối của kế hoạch 04-B đã xác nhận.
- **Gia hạn:** `POST /contracts/:id/audit-engagements/:lineId/deadlines/:kind/extend` (`contracts:approve` — Giám đốc), lý do 5–500 ký tự, kiểm tra `revision`, giữ thứ tự hạn; không gia hạn hạn đã đạt hoặc khi đã phát hành; được thêm hạn tuỳ chọn còn thiếu sau khi chốt (hạn gốc = hạn được thêm). Audit `DEADLINE_EXTEND`.
- **Mốc đạt:** ghi lần đầu khi sang Đang soát xét / Chờ phát hành / phát hành; lùi rồi tiến lại, mở lại rồi phát hành lại không đổi. GET trả từng hạn: hạn gốc, hạn hiện hành, kết quả theo hạn hiện hành và hạn gốc, cờ đã gia hạn, lịch sử gia hạn; và dòng thời gian giai đoạn.
- **Tab Theo nhân sự:** `GET /contracts/audit-tracking/people?from&to&role&kind&serviceTypeId&teamId` và `GET /contracts/audit-tracking/people/:userId` (danh sách hạn được tính). Cần `contracts:view` + `tasks:view` (thu tiền, quản trị 403). Phạm vi F11: `contracts:approve` xem tất cả; `contracts:plan` xem người cùng nhóm và chính mình; còn lại chỉ chính mình (xem người khác 403). Chỉ đếm hạn của HĐ trong phạm vi dữ liệu, bỏ HĐ huỷ.
- **Quy ước tính (theo khung đánh giá G2, G9):**
  - Người chịu trách nhiệm (F10) = người giữ vai tại thời điểm: lúc đạt nếu đạt trước hạn; cuối ngày hạn (giờ VN) nếu trễ/quá hạn; hiện tại nếu hạn chưa tới. Một người giữ hai vai trong cùng hạn chỉ tính một lần.
  - Tỷ lệ = đúng hạn / (đúng hạn + trễ + quá hạn chưa đạt); hạn chưa tới (kể cả sắp đến hạn ≤ 7 ngày) không vào mẫu số. Có tỷ lệ theo hạn gốc, số lần gia hạn, trễ trung bình; "hồ sơ đang giữ vai" = hồ sơ chưa phát hành người đó đang là Manager/trưởng nhóm/người ký 1 (theo cùng bộ lọc dịch vụ).
- **Seed:** hạn mẫu tính tương đối theo hôm nay (HD-2025-013: đúng hạn, quá hạn soát xét, phát hành sắp tới; HD-2025-018: sắp đến hạn, phát hành đã gia hạn; HD-2025-019: trễ 5 ngày). Chỉ thêm hạn cho hồ sơ chưa có hạn nên áp được lên DB đã seed 04-F1.

### 04-F3 — Bảng theo dõi và giao diện (đã code và kiểm chứng kỹ thuật ngày 22/10/2026)

- **API bảng:** `GET /contracts/audit-tracking` (`contracts:view`, phạm vi HĐ, bỏ HĐ huỷ): lọc `search` (KH, MST, số HĐ, số BCKT), `year`, `serviceTypeId`, `stage`, `ownerId`, `managerId`, `leadId`, `signerId`, `deadline` (OVERDUE/DUE_SOON/LATE/EXTENDED), `dossierIncomplete`, `uninvoiced`, `receivable` (chỉ khi có quyền tài chính); sắp xếp `signedDate` (mặc định mới nhất) / `code` / `stage` / `issueDue` / `reportDate`; phân trang 50 (tối đa 200); `summary` đếm theo giai đoạn, quá hạn, sắp đến hạn và tiền theo HĐ không cộng trùng. Điều kiện đơn giản lọc ở DB, phần suy ra lọc trong bộ nhớ trước khi phân trang (đủ cho số hồ sơ kiểm toán một công ty mỗi năm; nếu dữ liệu lớn hơn nhiều cần chuyển sang SQL). Trường tiền mang tên `amount`, `totalContractValue`, `paidAmount`, `remainingAmount` nên bộ lọc trường tài chính sẵn có tự ẩn. Chi tiết HĐ trả thêm `serviceType.issuesAuditReport` để hiện tab Kiểm toán.
- **Giao diện:** trang `/contracts/audit-tracking` (nút "Theo dõi kiểm toán" ở danh sách HĐ) gồm tab **Hồ sơ** — bộ lọc giữ trên URL, thẻ đếm bấm để lọc, bảng cố định cột Khách hàng, sắp xếp/phân trang phía server, bấm dòng mở ngăn chi tiết — và tab **Theo nhân sự** (`?tab=people`) — lọc kỳ, vai, loại hạn, dịch vụ; tỷ lệ tô màu theo ngưỡng G8 (≥ 95% xanh, 85–95% vàng, < 85% đỏ, "—" khi không có mẫu); bấm người mở danh sách hạn được tính. Ngăn chi tiết và tab **Kiểm toán** trên chi tiết HĐ dùng chung `ContractAuditPanel`: thẻ tình trạng hồ sơ HĐ (BBNT "Đã ký" chọn bản đã ký loại BBNT), thẻ từng hồ sơ kiểm toán (nhóm, người ký, hạn trước khi chốt + gợi ý từ kế hoạch, bảng hạn có kết quả và lịch sử gia hạn, tiến/lùi giai đoạn, phát hành có file PDF, mở lại, gia hạn, dòng thời gian, cảnh báo F6). Lỗi 409 tự tải lại dữ liệu mới và giữ thông báo.
- **Giới hạn:** người dùng đang giữ vai nhưng đã nghỉ vẫn hiện trong ô chọn kèm "(đã nghỉ)"; chưa có xuất Excel bảng (để 10); ở 375px menu trái của khung chung vẫn chiếm chỗ (lỗi core layout đã ghi từ 03) — bảng và ngăn chi tiết cuộn trong khối, ngăn chi tiết chiếm toàn chiều rộng.
- **Sửa theo review 22/10 (R4):** tab Theo nhân sự lập danh sách người theo phạm vi xem, độc lập với tập hạn — người đang giữ vai Manager/trưởng nhóm/người ký 1 ở hồ sơ chưa phát hành mà không có hạn trong kỳ vẫn có một dòng, tỷ lệ "—". "Hồ sơ đang giữ vai" theo bộ lọc vai, và khi lọc loại hạn chỉ tính vai chịu trách nhiệm loại hạn đó (F10).

### 04-F4 — Bám sát bảng LTGroup: mức độ và báo cáo tình hình (yêu cầu 23/10/2026)

Người dùng yêu cầu trong chat ngày 23/10/2026: "bám sát hơn một chút cho tôi" (sau khi được đề xuất bổ sung hai điểm còn thiếu so với `LTGroup_v9_fixed.html`: "Mức độ" và "BC tình hình cụ thể" của job). Bổ sung vào 04-F đã nghiệm thu, chỉ thêm, không đổi quy tắc F1–F11:

- **Mức độ** của hồ sơ kiểm toán: Thấp / Trung bình (mặc định) / Cao / Rất gấp — dùng chung bảng mã mức ưu tiên của việc (05, H10; nhãn hiển thị theo bảng LTGroup). Người sửa: như F2 (`contracts:plan` trong phạm vi hoặc trưởng nhóm của hồ sơ); HĐ huỷ chỉ xem. Đổi mức độ không cần `revision` và ghi lịch sử HĐ (cũ → mới). Bảng theo dõi có cột và bộ lọc "Mức độ", sắp xếp theo mức độ.
- **Báo cáo tình hình cụ thể**: nhật ký theo hồ sơ — mỗi lần cập nhật là một dòng mới (nội dung 2–2000 ký tự, người viết, thời điểm), **không sửa/xoá** (chặt hơn ô văn bản bị ghi đè của file gốc). Người viết: người theo F2 và thành viên nhóm của hồ sơ (Manager, trưởng nhóm, trợ lý, người ký); người xem được hồ sơ thì xem được nhật ký. Bảng theo dõi hiện dòng mới nhất (rút gọn, kèm ngày và người viết); ngăn chi tiết và tab Kiểm toán của HĐ hiện toàn bộ nhật ký. Hồ sơ chưa lưu lần nào thì tự tạo khi đặt mức độ hoặc viết dòng đầu tiên.

- **Đã code và kiểm chứng kỹ thuật 23/10/2026:** migration `20261023120000_audit_priority_notes` (cột `audit_engagements.priority`, bảng `audit_engagement_notes`); API `PUT …/audit-engagements/:lineId/priority`, `POST …/audit-engagements/:lineId/notes`; GET hồ sơ trả `priority`, `notes` (100 dòng mới nhất), `canPrioritize`, `canNote`; bảng theo dõi trả `priority`, `lastNote`, lọc `priority`, sắp `sort=priority`. Giao diện: khối "Mức độ" và "Báo cáo tình hình cụ thể" dưới mỗi hồ sơ (ngăn chi tiết và tab Kiểm toán của HĐ), cột "Mức độ" và "Tình hình gần nhất" cùng bộ lọc trên bảng. Lịch sử HĐ nay có nhãn tiếng Việt cho các thao tác 04-F/04-F4/05-B (trước đây hiện mã như `ENGAGEMENT_UPDATE`) và hiện tên giai đoạn/mức độ.
