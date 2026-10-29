# 06 — Lịch nghiệp vụ, hạn pháp lý theo khách hàng, nhắc việc

Ngày 23/10/2026. **Đã được người dùng duyệt trong chat ngày 23/10/2026: “Tôi nghiệm thu 05 và duyệt đặc tả 06 với phương án đề xuất I1–I14 cùng phạm vi sửa ngoài module đã liệt kê. Bắt đầu code 06-B.”**

Căn cứ: YC14 (hạn từ ngày bắt đầu/thời lượng/phụ thuộc, ngày làm việc/nghỉ lễ, lịch nghĩa vụ pháp lý), YC15 (nhắc trong app/email/Zalo, mốc 7/3/1 ngày, đến hạn, quá hạn có cấu hình) trong [phạm vi](../requirements/scope-and-traceability.md); PDF tích hợp mục 3.2 (trường thuế–kế toán của KH dùng để tự sinh hạn), 4.2 (nhắc việc, báo quản lý khi quá X ngày, bản tin buổi sáng), 4.3 (lịch tháng/tuần, bộ lịch pháp lý mặc định, tự sinh hạn theo kỳ khai/năm tài chính, lùi/đẩy khi trùng ngày nghỉ, trạng thái báo cáo), 5.3 (cài đặt nhắc việc); **Phụ lục 1** mục IV.1–2 (căn cứ xác định hạn, bảng 5 mốc cảnh báo, "có thể thay đổi thời điểm nhắc việc"); câu 24 (app, email, Zalo; chưa có Zalo OA); QD07 (lịch nghỉ, hạn pháp lý được nghiệp vụ xác nhận), QD09 (M365/email, Zalo OA) trong [sổ quyết định](../requirements/decision-register.md); D2 của [03](03-service-catalog.md); H4–H8, H12 của [05](05-tasks-workflow.md); G5–G7 của [khung đánh giá](10-performance-evaluation.md). Đã chốt từ trước: **không đồng bộ lịch Google/Outlook** (sổ quyết định, "Các câu trả lời đã đủ để định hướng").

## Hiện trạng cần thay

- Ngày làm việc tính cứng thứ 2–6 (`workflow-schedule.util.ts` 03, `review-sla.ts` 05); chưa có ngày lễ, nghỉ bù, làm bù.
- Hạn của bước có cờ hạn pháp lý = cuối kỳ + số ngày lệch cấu hình ở bước (03) — không theo kỳ khai/năm tài chính của từng KH, không lùi khi trùng ngày nghỉ.
- Không có danh mục nghĩa vụ pháp lý, không có "lịch báo cáo" theo KH (trạng thái Chưa đến hạn / Đang chuẩn bị / Đã nộp / Trễ hạn).
- Hồ sơ KH chỉ có kỳ khai GTGT (tháng/quý); thiếu năm tài chính, phương pháp tính thuế, chế độ kế toán, cơ quan thuế (PDF 3.2).
- Thông báo chỉ phát theo sự kiện (giao việc, 05-D); **không có nhắc theo lịch**, không email nhắc việc, không leo thang quá hạn, không nhắc SLA soát xét, không bản tin buổi sáng. Thông báo chưa có loại/mức độ, không có nhật ký gửi.
- Trang Lịch (`features/calendar`) chỉ là lịch tháng `nz-calendar` hiện việc theo hạn; chưa gộp hạn pháp lý, chưa có tuần, chưa lọc theo KH/nhân viên/loại báo cáo.
- Mức gấp tự động theo dịch vụ và thời gian còn lại (người dùng nêu 23/10) chưa có đặc tả — đưa vào I11.

## Câu chuyện người dùng

1. **Kế toán trưởng** soạn danh mục nghĩa vụ (tờ khai GTGT tháng/quý, quyết toán TNDN…) với quy tắc hạn và nhập lịch nghỉ lễ của năm; **Giám đốc** xác nhận trước khi hệ thống dùng.
2. **Nhân viên phụ trách KH** cập nhật năm tài chính, kỳ khai, phương pháp thuế của KH; hệ thống tự sinh lịch báo cáo của KH theo các dịch vụ trong HĐ.
3. **Nhân viên** nhận nhắc 7/3/1 ngày trước hạn, đúng hạn và khi quá hạn trong ứng dụng và email; mỗi sáng nhận bản tin việc trong ngày.
4. **Trưởng nhóm/Manager** được báo khi việc của nhóm quá hạn quá số ngày cấu hình hoặc lượt soát xét quá SLA.
5. **Giám đốc/KTT** xem lịch tháng/tuần gộp hạn pháp lý và việc nội bộ, lọc theo KH, nhân viên, loại báo cáo; thấy ngay báo cáo nào trễ.
6. **Nhân viên** đánh dấu báo cáo đã nộp kèm biên nhận — hoặc hệ thống tự đánh dấu khi việc giao nộp gắn với báo cáo hoàn thành.

## Phạm vi

- **Trong phạm vi (module `deadlines`, `notifications`):** lịch làm việc theo năm; danh mục loại nghĩa vụ và quy tắc hạn; nghĩa vụ (lịch báo cáo) theo KH × loại × kỳ; tác vụ nhắc theo lịch, leo thang, nhắc SLA, bản tin sáng; kênh trong ứng dụng và email; nhật ký gửi, chống gửi trùng, thử lại; tuỳ chọn nhận email của từng người; mức gấp; màn hình lịch, lịch báo cáo, cấu hình 06; schema/migration/seed; test.
- **Phạm vi ngoài module xin duyệt cùng đặc tả (ngoài danh sách phải xin thêm):**
  - `customers` (02, đã nghiệm thu): thêm trường thuế–kế toán (I5) vào schema, form, chi tiết KH, mẫu nhập/xuất Excel; hồi quy e2e 02.
  - `service-catalog` (03, đã nghiệm thu): bước quy trình có cờ hạn pháp lý được chọn **loại nghĩa vụ** (I6), chép khi nhân bản phiên bản; `workflow-schedule.util.ts` nhận lịch làm việc (I2) mà không đổi chữ ký các hàm đang gọi (tham số tuỳ chọn).
  - `contracts` (04, đã nghiệm thu): bước kế hoạch chép loại nghĩa vụ; lịch xem trước và bộ sinh việc dùng lịch làm việc 06 và hạn nghĩa vụ của KH cho bước pháp lý; HĐ/dòng huỷ thì nghĩa vụ chưa nộp của kỳ sau chuyển "Không áp dụng". Hồi quy e2e 04.
  - `tasks` (05, chờ nghiệm thu): việc gắn nghĩa vụ; `review-sla.ts`, "Việc của tôi" dùng lịch làm việc 06; đổi hạn theo lịch pháp lý ghi `task_due_changes` loại mới (I8); hiện mức gấp (I11). Hồi quy e2e 05.
  - `access-control` (01): thêm hành động `deadlines:approve`; cấp `deadlines:create/update` cho MANAGER, `deadlines:update` cho STAFF (mục Quyền). E2e phân quyền 5 vai trò + vai trò tuỳ chỉnh.
  - `dashboard` (10): khối "Lịch các báo cáo (Chưa đến / Đã gửi)" và "Nhắc việc đến hạn" đọc dữ liệu 06; không đổi công thức tiền.
  - Thư viện mới: `@nestjs/schedule` (API, tác vụ định kỳ — I12), `@fullcalendar/angular` + plugin daygrid/timegrid/list (web — đúng stack đã chốt ở quy tắc mục 1, I14). Chạy `npm audit --omit=dev` khi thêm.
- **Ngoài phạm vi:** Zalo (chưa có OA, phí chưa xác minh — QD09; xem I10); SMS; đồng bộ Google/Outlook (đã chốt không làm); nộp tờ khai qua cổng thuế; cấu hình hoàn chỉnh mọi ngưỡng (11 — 06 chỉ làm màn hình cấu hình tối thiểu của chính nó); báo cáo tuân thủ deadline và xuất file (10, dùng dữ liệu 06); Redis/BullMQ (quy tắc mục 1: giai đoạn sau).

## Quyết định cần duyệt

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| I1 | Hạn pháp lý lấy từ đâu? | **Danh mục loại nghĩa vụ** trong hệ thống: mã, tên, nhóm (thuế/BCTC/khác), chu kỳ (tháng/quý/năm), quy tắc hạn (ngày N của tháng sau kỳ; ngày cuối tháng thứ K sau kỳ; ngày cố định trong năm), điều kiện áp dụng theo hồ sơ KH, căn cứ pháp lý (văn bản). Có phiên bản **Nháp → Đã xác nhận → Ngừng**; KTT soạn, GĐ xác nhận; **chỉ loại đã xác nhận mới sinh hạn**. Seed dev là ví dụ gắn nhãn "ví dụ — chưa xác nhận", không phải quy định | Viết cứng quy tắc trong code (sửa phải phát hành phần mềm) |
| I2 | Ngày làm việc, nghỉ lễ | **Lịch theo năm**: ngày nghỉ (lễ, Tết, nghỉ bù) và ngày làm bù (thứ 7/CN đi làm), mỗi năm Nháp → Đã xác nhận (GĐ). Năm **chưa xác nhận** tính thứ 2–6 như hiện tại và hiện cảnh báo "Lịch năm YYYY chưa xác nhận". Không seed ngày lễ thật (QD07); KTT nhập theo thông báo của Chính phủ | Seed sẵn ngày lễ dương lịch, coi là đã đúng |
| I3 | Hạn trùng ngày nghỉ | Hạn **pháp lý** rơi vào ngày nghỉ → **ngày làm việc kế tiếp** (mặc định của loại nghĩa vụ, KTT xác nhận khi duyệt danh mục; có tuỳ chọn "về ngày làm việc trước"). Hạn **nội bộ theo kỳ** (ngày lịch, D2) rơi vào ngày nghỉ → **ngày làm việc trước** để không sát hạn pháp lý. Thời lượng bước tiếp tục tính ngày làm việc (D2) theo lịch 06. Chỉ áp cho việc/kế hoạch sinh **sau** khi bật; việc đã sinh giữ hạn (trừ việc gắn nghĩa vụ — I8) | Mọi hạn đều sang ngày làm việc kế tiếp |
| I4 | Sinh lịch báo cáo cho KH nào? | KH **Đang phục vụ** có **dòng HĐ đã duyệt, còn hiệu lực** mà dịch vụ được gắn loại nghĩa vụ (bảng dịch vụ ↔ loại nghĩa vụ trong module 06); chỉ các kỳ trong thời hạn dòng; điều kiện hồ sơ KH chọn đúng biến thể (tháng/quý, khấu trừ/trực tiếp). Nhân viên phụ trách **bật/tắt** từng loại cho riêng KH kèm lý do (ví dụ KH tự nộp TNCN). Sinh khi HĐ duyệt/kế hoạch xác nhận và tác vụ đêm bổ sung kỳ mới; khoá duy nhất (KH, loại, kỳ) | Sinh cho mọi KH Đang phục vụ, không cần dịch vụ |
| I5 | Trường KH bổ sung (02) | **Tháng kết thúc năm tài chính** (mặc định 12), **phương pháp tính thuế GTGT** (Khấu trừ / Trực tiếp / Không kê khai), **kỳ khai TNCN** (Tháng / Quý / Không khấu trừ), **chế độ kế toán** (TT200 / TT133 / Khác), **cơ quan thuế quản lý** (văn bản). Kỳ khai GTGT có sẵn. Đổi trường chỉ áp cho kỳ **chưa bắt đầu**; nghĩa vụ đã sinh của kỳ cũ giữ nguyên, ghi lịch sử | Chỉ thêm năm tài chính; các trường khác để ghi chú |
| I6 | Việc ↔ nghĩa vụ | Bước quy trình có cờ hạn pháp lý (03) **chọn loại nghĩa vụ**; khi sinh việc, hạn gốc của việc = **hạn nghĩa vụ của KH cùng kỳ** (thay "cuối kỳ + lệch"), việc gắn nghĩa vụ. Bước pháp lý chưa chọn loại giữ cách tính cũ và hiện cảnh báo ở quy trình. Việc gắn **bắt đầu** → nghĩa vụ "Đang chuẩn bị"; việc **Hoàn thành** có kết quả giao nộp (H1) → nghĩa vụ "Đã nộp", biên nhận = file kết quả | Nghĩa vụ độc lập, nhân viên cập nhật tay hoàn toàn |
| I7 | Trạng thái lịch báo cáo (PDF 4.3) | **Chưa đến hạn → Đang chuẩn bị → Đã nộp** (ngày nộp, **biên nhận bắt buộc**); **Trễ hạn** = quá hạn (giờ VN) mà chưa nộp; nộp sau hạn lưu cờ "nộp trễ". Thêm **Không áp dụng** (bị tắt cho KH hoặc HĐ huỷ) có lý do. Mở lại "Đã nộp" khi nộp bổ sung/sai: người có `deadlines:approve`, lý do bắt buộc. Lịch sử không sửa/xoá | Biên nhận không bắt buộc |
| I8 | Lịch/quy tắc đổi sau khi đã sinh | Tính lại hạn các nghĩa vụ **chưa nộp và chưa tới hạn**; việc **chưa Hoàn thành** gắn nghĩa vụ đó đổi hạn hiện hành theo, ghi `task_due_changes` loại **"Theo lịch pháp lý"** (không phải gia hạn H7, không đếm vào số lần gia hạn), giữ hạn gốc ban đầu, báo người làm. Việc nội bộ đã sinh không tính lại | Không tính lại; người quản lý tự đề nghị gia hạn từng việc |
| I9 | Mốc nhắc và người nhận | Mốc mặc định theo PL1 IV.2: **−7, −3, −1 ngày, đúng hạn, quá hạn +1 ngày**; sửa danh sách mốc ở cấu hình 06. Gửi lúc **07:30 giờ VN** ngày của mốc. Người nhận: **người làm**; khi việc ở Chờ kiểm tra → **người kiểm tra/phê duyệt cấp hiện tại**; nghĩa vụ không gắn việc → nhân viên phụ trách KH. Không nhắc việc **Tạm dừng** và việc Hoàn thành. **Leo thang:** quá hạn **3 ngày làm việc** chưa xong → báo Manager dòng dịch vụ (H8/04-F), không có thì người có `tasks:approve` phụ trách KH; một lần cho mỗi hạn | Nhắc quá hạn lặp lại hằng ngày |
| I10 | Kênh gửi | **Trong ứng dụng**: mọi nhắc. **Email** (SMTP; M365 khi IT cấp — QD09): mặc định bật cho mốc −1, đúng hạn, quá hạn, leo thang, SLA và bản tin sáng; mỗi người tự bật/tắt email (không tắt được thông báo trong ứng dụng). **Zalo: không làm trong 06** — ghi là yêu cầu hoãn, quay lại khi có OA/API/phí được xác nhận (QD09); thiết kế kênh để thêm sau không đổi dữ liệu | Email cho mọi mốc; hoặc chờ Zalo rồi mới làm 06 |
| I11 | Mức gấp tự động (người dùng nêu 23/10) | **Nhãn mức gấp** tính từ số ngày còn lại tới hạn hiện hành theo bảng PL1 IV.2: > 7 ngày *Bình thường*; ≤ 7 *Sắp đến hạn*; ≤ 3 *Cần ưu tiên*; ≤ 1 *Gần đến hạn*; 0 *Đến hạn hôm nay*; < 0 *Quá hạn* (đỏ). Ngưỡng mặc định toàn công ty; **từng dịch vụ đặt được ngưỡng riêng** (ví dụ quyết toán năm 15/7/3) trong cấu hình 06; mốc nhắc I9 của việc dùng cùng ngưỡng. **Không ghi đè mức ưu tiên** do người quản lý đặt (H10): hiển thị cạnh nhau, "Việc của tôi"/lịch sắp theo mức gấp rồi ưu tiên | Tự nâng mức ưu tiên (H10) theo thời gian còn lại |
| I12 | Chạy nền, chống trùng, thử lại | Tác vụ định kỳ trong tiến trình API (`@nestjs/schedule`) mỗi **15 phút** và khi khởi động; **khoá advisory PostgreSQL** để chỉ một tiến trình chạy. Mỗi lần gửi ghi `notification_deliveries` với **khoá duy nhất** (đối tượng, mốc, hạn tại thời điểm, kênh, người nhận) → restart/chạy lại không gửi trùng; đổi hạn sinh mốc mới, mốc cũ chưa gửi bị huỷ. Bỏ lỡ do tắt máy: khi chạy lại chỉ gửi **mốc gần nhất** chưa gửi (không dồn 7/3/1 một lúc). Email lỗi thử lại tối đa **5 lần** (1, 5, 15, 60, 240 phút) rồi **Thất bại**, hiện ở nhật ký gửi | Dùng Redis + BullMQ ngay (thêm hạ tầng) |
| I13 | SLA soát xét và bản tin sáng | Lượt soát xét vượt **2 ngày làm việc** (G7, theo lịch 06) → nhắc người soát xét **một lần**; thêm 2 ngày làm việc nữa → báo Manager dòng. **Bản tin sáng** 07:30 mỗi **ngày làm việc**: việc hạn hôm nay, quá hạn, chờ tôi soát xét, báo cáo pháp lý đến hạn trong 3 ngày — chỉ gửi khi có ít nhất một mục; trong ứng dụng + email (tắt được) | Không làm bản tin sáng |
| I14 | Màn hình lịch | **FullCalendar** (stack đã chốt): tháng / tuần / danh sách; gộp **hạn pháp lý** (lịch báo cáo) và **việc nội bộ** (hạn hiện hành); lọc KH, nhân viên, loại nghĩa vụ, loại hạn (pháp lý/nội bộ), trạng thái; màu theo mức gấp; ngày nghỉ tô xám; bấm mục mở chi tiết việc/nghĩa vụ. Thay trang Lịch `nz-calendar` hiện tại. 375px: mặc định dạng danh sách | Giữ `nz-calendar`, thêm hạn pháp lý |

## Quyền

| Thao tác | Quyền | GĐ | Manager (KTT/trưởng nhóm) | Nhân viên | Thu tiền | Quản trị |
| --- | --- | --- | --- | --- | --- | --- |
| Xem lịch, lịch báo cáo (theo phạm vi KH) | `deadlines:view` | Toàn công ty | Phạm vi | KH được phân công | — | — |
| Cập nhật nghĩa vụ: Đang chuẩn bị, Đã nộp + biên nhận, bật/tắt loại cho KH | `deadlines:update` (trong phạm vi) | ✓ | **thêm** | **thêm** | — | — |
| Soạn loại nghĩa vụ, lịch năm, gắn dịch vụ ↔ loại (nháp) | `deadlines:create` | ✓ | **thêm** | — | — | — |
| Xác nhận/ngừng loại nghĩa vụ, xác nhận lịch năm, mở lại "Đã nộp" | `deadlines:approve` (**hành động mới**) | ✓ | — | — | — | — |
| Cấu hình mốc nhắc, giờ gửi, ngưỡng mức gấp, leo thang; xem nhật ký gửi | `settings:update` / `settings:view` | ✓ | — | — | — | ✓ |
| Tuỳ chọn nhận email của mình; xem thông báo của mình | `notifications:view` | ✓ | ✓ | ✓ | ✓ | ✓ |

- Kiểm tra theo **quyền hiệu lực** (vai trò tuỳ chỉnh, như R2 ở 05); phạm vi KH theo phân công 02 (giữ F6). Ngoài phạm vi → 404.
- Vai trò tuỳ chỉnh không được nhận `deadlines:approve` nếu vai trò nền không có (quy tắc 01).
- Người không có `deadlines:view` không nhận nhắc lịch báo cáo, nhưng vẫn nhận nhắc việc của mình (quyền `tasks`).

## Dữ liệu (dự kiến)

| Bảng | Nội dung chính |
| --- | --- |
| `business_calendar_years` | năm, trạng thái Nháp/Đã xác nhận, người/lúc xác nhận |
| `business_calendar_days` | ngày (duy nhất), loại Nghỉ / Làm bù, tên (ví dụ "Nghỉ bù Quốc khánh") |
| `obligation_types` + `obligation_type_versions` | mã duy nhất, tên, nhóm; phiên bản: chu kỳ, quy tắc hạn (`kind`, tham số), điều kiện áp dụng (JSONB theo trường KH I5), lùi/đẩy khi trùng ngày nghỉ, căn cứ pháp lý, áp dụng từ kỳ, trạng thái |
| `service_obligation_types` | dịch vụ ↔ loại nghĩa vụ (I4) |
| `customer_obligation_settings` | KH × loại: bật/tắt, lý do, người, lúc |
| `customer_obligations` | KH, loại, phiên bản quy tắc, kỳ, **hạn pháp lý**, trạng thái, ngày nộp, tài liệu biên nhận (kho 02), cờ nộp trễ, việc gắn; duy nhất (KH, loại, kỳ) |
| `customer_obligation_events` | lịch sử trạng thái/hạn: từ–đến, lý do, người, lúc |
| `reminder_settings` | mốc nhắc, giờ gửi, ngưỡng mức gấp mặc định, số ngày leo thang (một dòng, ghi audit trước–sau) |
| `service_urgency_thresholds` | dịch vụ → ngưỡng mức gấp riêng (I11) |
| `notifications` (sửa) | thêm loại, mức độ (thường/cảnh báo/đỏ), đối tượng (việc/nghĩa vụ/lượt soát xét) |
| `notification_deliveries` | đối tượng, mốc, hạn tại thời điểm, kênh, người nhận, trạng thái Chờ/Đã gửi/Lỗi-thử lại/Thất bại/Huỷ, số lần thử, lỗi cuối; **duy nhất** (đối tượng, mốc, hạn, kênh, người nhận) |
| `notification_preferences` | người dùng: nhận email nhắc việc, nhận bản tin sáng |

Cột thêm ở module khác: `customers` (I5), `workflow_steps.obligation_type_id` (03), bước kế hoạch (04), `tasks.obligation_id` (05). Chỉ thêm cột/bảng; dữ liệu cũ nhận mặc định (năm tài chính tháng 12, các trường khác trống), không sinh nghĩa vụ cho tới khi có loại đã xác nhận.

## Quy tắc tính

- **Hạn pháp lý** của kỳ = quy tắc của phiên bản loại nghĩa vụ áp cho kỳ đó; kỳ năm tính theo **tháng kết thúc năm tài chính** của KH; rồi lùi/đẩy theo lịch làm việc (I3). Hàm thuần, unit test biên: tháng 2, năm nhuận, kỳ quý, năm tài chính kết thúc tháng 3/6/9, ngày nghỉ liên tiếp (Tết), ngày làm bù.
- **Ngày làm việc** = thứ 2–6, trừ ngày Nghỉ, cộng ngày Làm bù — chỉ với năm đã xác nhận (I2). Dùng chung cho thời lượng bước (03/04), SLA soát xét (05), leo thang (I9).
- **Ngày còn lại / mức gấp** tính theo ngày lịch giờ VN tới hạn hiện hành (I11).
- Thời điểm "quá hạn": hết 23:59 giờ VN của ngày hạn (như `deadline.rules` 04-F).

## Màn hình

- **Lịch & Deadline** (`/calendar`, I14): lịch tháng/tuần/danh sách; bộ lọc; chú thích màu; cảnh báo năm chưa xác nhận lịch.
- **Lịch báo cáo** (`/deadlines`): bảng nghĩa vụ theo KH/loại/kỳ/trạng thái/người phụ trách, ô đếm Chưa đến hạn / Đang chuẩn bị / Trễ hạn / Đã nộp trong tháng; đánh dấu Đang chuẩn bị, Đã nộp (tải biên nhận), Không áp dụng; mở việc gắn.
- **Tab "Lịch báo cáo" ở chi tiết KH** (02): nghĩa vụ của KH, bật/tắt loại; khối trường thuế–kế toán I5 trên form KH.
- **Cấu hình 06** (trong Cài đặt): danh mục loại nghĩa vụ (soạn/xác nhận/ngừng, xem trước hạn 12 kỳ cho một KH mẫu), lịch năm (thêm ngày nghỉ/làm bù, xác nhận), gắn dịch vụ ↔ loại, mốc nhắc/giờ gửi/ngưỡng mức gấp/leo thang, nhật ký gửi (lọc lỗi, gửi lại thủ công cho bản Thất bại).
- **Hồ sơ cá nhân**: bật/tắt email nhắc việc, bản tin sáng.
- **Chuông thông báo**: nhãn mức độ (đỏ cho quá hạn/leo thang), lọc chưa đọc.
- "Việc của tôi"/kanban/chi tiết việc (05) và quy trình (03): hiện mức gấp; bước pháp lý chọn loại nghĩa vụ. Dashboard (10): khối lịch báo cáo, nhắc việc đến hạn đọc dữ liệu 06.

## API (dự kiến)

| Phương thức | Đường dẫn | Ai |
| --- | --- | --- |
| GET | `/calendar/events?from&to&customerId&userId&obligationTypeId&kind&status` | `deadlines:view` hoặc `tasks:view` (chỉ phần được xem) |
| GET | `/customer-obligations` (phân trang, lọc), `/customer-obligations/:id` | `deadlines:view` |
| POST | `/customer-obligations/:id/prepare`, `/file` (multipart biên nhận), `/not-applicable`, `/reopen` | `deadlines:update`; `reopen` cần `deadlines:approve` |
| PUT | `/customers/:id/obligation-settings/:typeId` | `deadlines:update` |
| GET/POST/PATCH | `/obligation-types…`, `/obligation-types/:id/versions/:v/confirm`, `/retire`, `/preview?customerId` | xem `deadlines:view`; soạn `deadlines:create`; xác nhận/ngừng `deadlines:approve` |
| GET/PUT/POST | `/business-calendar/:year` (ngày), `/business-calendar/:year/confirm` | xem mọi người đăng nhập; sửa `deadlines:create`; xác nhận `deadlines:approve` |
| GET/PUT | `/reminder-settings`, `/service-urgency-thresholds` | `settings:view` / `settings:update` |
| GET/POST | `/notification-deliveries` (lọc), `/notification-deliveries/:id/retry` | `settings:view` / `settings:update` |
| GET/PUT | `/notifications/preferences` | Chính mình |

Mọi thao tác ghi kiểm tra `revision`/điều kiện trạng thái (bấm đồng thời → 409) và ghi audit.

## Luồng lỗi chính

- Đánh dấu Đã nộp thiếu biên nhận, ngày nộp sau hôm nay → 400; nghĩa vụ đã ở trạng thái khác (đồng thời) → 409.
- Xác nhận loại nghĩa vụ có quy tắc không hợp lệ (ngày > 31, tháng ngoài 1–12, thiếu điều kiện) hoặc trùng mã/điều kiện với loại đang hiệu lực → 400.
- Sửa lịch năm đã xác nhận → phải mở lại bằng `deadlines:approve` có lý do; sau khi lưu chạy tính lại I8 và báo số nghĩa vụ/việc bị đổi hạn.
- Tắt loại nghĩa vụ cho KH không lý do → 400. Người ngoài phạm vi → 404; thiếu quyền → 403.
- SMTP chưa cấu hình: email ghi trạng thái "Không gửi — chưa cấu hình", thông báo trong ứng dụng vẫn gửi; trang nhật ký hiện cảnh báo.

## Tiêu chí nghiệm thu

1. Lịch năm: ngày nghỉ/làm bù; năm chưa xác nhận tính thứ 2–6 và có cảnh báo; sau khi xác nhận, thời lượng bước (04-B xem trước), SLA soát xét, leo thang tính đúng ngày làm việc mới (unit + e2e).
2. Loại nghĩa vụ chỉ sinh hạn khi đã xác nhận; quy tắc tháng/quý/năm và năm tài chính lệch đúng trên **bộ ngày mẫu do KTT xác nhận** (QD07); trùng ngày nghỉ lùi/đẩy đúng I3.
3. Lịch báo cáo sinh đúng KH × loại × kỳ theo I4/I5, không trùng khi gọi lại/đồng thời; bật/tắt theo KH có lý do; HĐ huỷ → kỳ sau Không áp dụng.
4. Việc bước pháp lý nhận hạn của nghĩa vụ; việc bắt đầu → Đang chuẩn bị; việc Hoàn thành có kết quả → Đã nộp kèm biên nhận; quá hạn chưa nộp → Trễ hạn; nộp sau hạn có cờ nộp trễ.
5. Đổi lịch/quy tắc tính lại đúng phạm vi I8; việc gắn nghĩa vụ đổi hạn có dòng lịch sử "Theo lịch pháp lý", không đếm là gia hạn; hạn gốc giữ nguyên.
6. Nhắc đúng mốc I9 cho đúng người (người làm / người soát xét cấp hiện tại / phụ trách KH); không nhắc việc Tạm dừng/Hoàn thành; leo thang đúng một lần.
7. **Không gửi trùng** khi chạy lại tác vụ, khởi động lại API giữa chừng, hai tiến trình cùng chạy; đổi hạn huỷ mốc cũ và tạo mốc mới; bỏ lỡ mốc chỉ gửi mốc gần nhất (e2e với đồng hồ giả lập).
8. Email gửi được qua **SMTP thử** do IT cấp (QD09) — có bằng chứng thư nhận được; lỗi SMTP thử lại theo I12 rồi Thất bại, gửi lại thủ công được; tắt email cá nhân thì chỉ còn thông báo trong ứng dụng.
9. SLA soát xét và bản tin sáng theo I13; không gửi bản tin rỗng; không gửi vào ngày nghỉ.
10. Mức gấp I11 hiển thị nhất quán ở Việc của tôi, kanban, chi tiết việc, lịch; ngưỡng riêng theo dịch vụ có hiệu lực; mức ưu tiên H10 không bị đổi.
11. Lịch tháng/tuần/danh sách gộp đúng hạn pháp lý + việc nội bộ trong phạm vi quyền; lọc KH/nhân viên/loại/trạng thái; mở chi tiết; desktop và 375px.
12. Phân quyền theo bảng Quyền cho 5 vai trò + vai trò tuỳ chỉnh (cấp và thu hồi); hồi quy e2e 02/03/04/05/10; lint/unit/e2e/build/max-lines đạt; migration trên DB trống và bản sao demo, Prisma diff sạch.

## Test hồi quy và thay đổi test cũ

- Test ngày làm việc hiện có (`workflow-schedule.util.spec`, `review-sla.spec`, e2e kế hoạch 04-B) giữ nguyên kỳ vọng vì năm chưa xác nhận vẫn tính thứ 2–6; thêm test mới cho năm đã xác nhận. Không dự kiến sửa test cũ; nếu phải sửa sẽ ghi lý do ở `06-test-policy-changes.md` trước khi đổi.
- Bộ sinh việc 04/05: thêm test bước pháp lý có/không có loại nghĩa vụ; chạy lại toàn bộ e2e 04, 05.
- Tác vụ nền: unit với đồng hồ giả lập (mốc, bỏ lỡ, đổi hạn), e2e hai lần chạy liên tiếp và chạy đồng thời → số bản ghi gửi không đổi.

## Đầu vào cần từ người dùng

- **QD07:** KTT rà và xác nhận danh mục nghĩa vụ thật (tên, quy tắc, điều kiện áp dụng, lùi/đẩy) và lịch nghỉ năm 2026–2027 kèm bộ ngày mẫu để nghiệm thu. Trước khi có, hệ thống chạy với ví dụ "chưa xác nhận" và không sinh hạn thật.
- **QD09:** hộp thư/SMTP thử (M365 hoặc tương đương) để nghiệm thu email; xác nhận **hoãn Zalo** sang đợt sau (I10) cùng mốc quay lại.

## Phân kỳ triển khai

1. **06-A:** người dùng duyệt đặc tả và I1–I14 (sau khi nghiệm thu 05).
2. **06-B Lịch và hạn pháp lý:** lịch năm; loại nghĩa vụ + phiên bản; trường KH (02); gắn dịch vụ/bước (03/04); sinh lịch báo cáo; liên kết việc (05); tính lại I8; quyền mới.
3. **06-C Nhắc việc:** tác vụ nền + khoá; nhật ký gửi chống trùng; mốc I9, leo thang, SLA, bản tin sáng; email + thử lại; tuỳ chọn cá nhân; mức gấp I11.
4. **06-D Giao diện và nghiệm thu:** lịch FullCalendar, lịch báo cáo, tab KH, cấu hình 06, chuông thông báo; kiểm chứng (gồm restart và email thử) và biên bản `06-deadlines-acceptance.md`.

## Tiến độ triển khai

### 06-B Lịch và hạn pháp lý — đã code và kiểm chứng kỹ thuật (23/10/2026)

- **Schema** (migration `20261024090000_deadlines_obligations`): `business_calendar_years/days`, `obligation_types` + `obligation_type_versions` (một bản nháp mỗi loại — unique một phần), `service_obligation_types`, `customer_obligation_settings`, `customer_obligations` (duy nhất KH × loại × kỳ) + `customer_obligation_events`; cột mới: 5 trường thuế–kế toán của KH (CHECK tháng 1–12), `workflow_steps`/`contract_plan_steps.obligation_type_id`, `tasks.obligation_id`, `task_due_changes.calendar_adjusted`. Chỉ thêm cột/bảng; Prisma diff sạch trên DB trống và bản sao demo `ketoan_mig_05b`.
- **Lịch làm việc (I2/I3):** `common/working-calendar.ts` (hàm thuần) + `working-calendar.loader.ts`; các hàm ngày làm việc của 03 nhận lịch qua tham số tuỳ chọn (mặc định thứ 2–6, không đổi chữ ký). Dùng ở xem trước quy trình (03), lập/tính lại/xem trước kế hoạch (04), bộ sinh việc và SLA soát xét (05). Hạn nội bộ theo kỳ chỉ lùi về ngày làm việc trước khi năm đã xác nhận. API `GET/PUT /business-calendar/:year`, `POST …/confirm`.
- **Loại nghĩa vụ (I1):** `/obligation-types` — tạo (kèm nháp v1), sửa tên/nhóm/nhóm thay thế, lưu nháp quy tắc (revision), xác nhận (GĐ), ngừng (GĐ, lý do), gắn dịch vụ, xem trước hạn các kỳ tới cho một KH. Quy tắc: ngày N của tháng thứ K sau cuối kỳ (N = 31 → ngày cuối tháng) hoặc ngày cố định trong năm; điều kiện theo kỳ khai GTGT, phương pháp GTGT, kỳ TNCN, chế độ kế toán.
- **Lịch báo cáo (I4/I5/I7):** đồng bộ theo KH khi HĐ duyệt/huỷ, khi đổi trường thuế/trạng thái KH, khi xác nhận/ngừng loại, gắn dịch vụ, bật/tắt riêng. `/customer-obligations` (lọc KH/loại/kỳ/trạng thái gồm "Trễ hạn"/khoảng hạn, phạm vi KH theo 02), đánh dấu Đang chuẩn bị, Đã nộp (multipart, biên nhận vào kho 02 nhóm Tài liệu dịch vụ, ngày nộp ≤ hôm nay, cờ nộp trễ), Không áp dụng (lý do), mở lại (GĐ). `GET/PUT /customers/:id/obligation-settings/:typeId`.
- **Việc ↔ nghĩa vụ (I6):** bộ sinh việc gắn nghĩa vụ cho bước pháp lý có loại nghĩa vụ, hạn gốc = hạn nghĩa vụ; việc bắt đầu → Đang chuẩn bị; Hoàn thành có file bằng chứng → Đã nộp (biên nhận = file mới nhất); Hoàn thành không có file → ghi lịch sử "chưa có file biên nhận".
- **Tính lại (I8):** xác nhận/sửa lịch năm và xác nhận phiên bản quy tắc tính lại hạn nghĩa vụ chưa nộp, chưa tới hạn; việc gắn chưa Hoàn thành đổi hạn hiện hành qua `task_due_changes` (`calendarAdjusted`, đã duyệt, không phải gia hạn), giữ hạn gốc, báo người làm.
- **Quyền:** thêm `deadlines:approve` (GĐ); MANAGER thêm `deadlines:create/update`, STAFF thêm `deadlines:update` (theo bảng Quyền). Vai trò tùy chỉnh không vượt vai trò nền.
- **Giao diện tối thiểu 06-B:** form/chi tiết KH có nhóm "Thuế – kế toán"; form bước quy trình có ô Hạn pháp lý, Cần xác nhận giao nộp (mặc định bật khi bật hạn pháp lý — H1) và chọn loại nghĩa vụ. Màn hình lịch, lịch báo cáo, cấu hình thuộc 06-D.
- **Làm rõ khi code (không đổi quyết định đã duyệt):**
  - Nhóm thay thế (`family`): bước gắn một loại (ví dụ GTGT tháng) vẫn tìm đúng biến thể theo hồ sơ KH (GTGT quý) trong cùng nhóm; việc tháng chỉ gắn nghĩa vụ quý khi cùng ngày cuối kỳ (việc tháng 3 ↔ quý 1).
  - Đồng bộ **không sinh bù kỳ đã quá hạn** (tránh báo "Trễ hạn" cho kỳ đã nộp ngoài hệ thống); kỳ đã qua chỉ được tạo khi có việc gắn. Tầm sinh trước ~400 ngày; tác vụ hằng đêm nối dài thuộc 06-C.
  - Phiên bản áp cho kỳ có ngày cuối kỳ ≥ ngày hiệu lực (bản mới nhất thắng) — KTT đặt ngày hiệu lực để không sinh kỳ cũ.
  - Sửa lịch năm đã xác nhận: GĐ sửa trực tiếp kèm lý do (thay cho "mở lại" rồi xác nhận lại) để không có khoảng thời gian hệ thống tạm tính thứ 2–6; mỗi lần sửa ghi audit và tính lại.
  - Phụ lục thêm dòng dịch vụ sau khi HĐ đã duyệt chưa phát sự kiện riêng → lịch báo cáo của dòng mới được bổ sung ở lần đồng bộ kế tiếp (tác vụ hằng đêm 06-C).
  - Chưa seed loại nghĩa vụ/ngày nghỉ (QD07): DB xem thử chỉ có một loại ví dụ "VD-GTGT-THANG" ở trạng thái nháp, tên ghi rõ "chưa xác nhận".
- Thay đổi test cũ: [06-test-policy-changes.md](06-test-policy-changes.md).

### 06-C Nhắc việc, email, mức gấp — đã code và kiểm chứng kỹ thuật (23/10/2026)

- **Schema** (migration `20261024120000_reminders`): `notification_deliveries` (khoá duy nhất đối tượng × mốc × hạn × kênh × người nhận), `notification_preferences`, `reminder_settings` (một dòng, mặc định 7/3/1, 07:30, 3 ngày làm việc), `service_urgency_thresholds`, `scheduler_leases`; `notifications` thêm loại, mức độ, đối tượng.
- **Mức gấp (I11):** `deadlines/urgency.ts` — Sắp đến hạn / Cần ưu tiên / Gần đến hạn / Đến hạn hôm nay / Quá hạn theo ngưỡng chung hoặc riêng của dịch vụ; trả `urgency` ở danh sách, Việc của tôi (trong trang sắp gấp nhất rồi ưu tiên), chi tiết việc; nhãn trên bảng, kanban, chi tiết, Việc của tôi. Không đổi mức ưu tiên H10.
- **Mốc nhắc (I9):** trước hạn theo ngưỡng (mặc định 7/3/1), đúng hạn, quá hạn +1; gửi từ giờ cấu hình (07:30 VN). Người nhận: người làm; Chờ kiểm tra → người kiểm tra/phê duyệt cấp hiện tại; lịch báo cáo không có việc gắn → nhân viên phụ trách KH. Không nhắc việc Tạm dừng/Hoàn thành. **Leo thang** khi quá hạn đủ số ngày làm việc cấu hình → Manager nhóm dòng dịch vụ, không có thì người phụ trách/phân công KH có `tasks:approve`.
- **SLA và bản tin (I13):** chờ soát xét quá 2 ngày làm việc → nhắc người soát xét; quá 4 → báo quản lý. Bản tin sáng ngày làm việc (theo lịch 06-B) cho người có việc hôm nay/quá hạn/chờ soát xét/báo cáo pháp lý trong 3 ngày; không gửi bản tin rỗng.
- **Kênh (I10):** trong ứng dụng luôn gửi; email cho mốc gần nhất trước hạn, đúng hạn, quá hạn, leo thang, SLA, bản tin. Mỗi người tắt email/bản tin ở trang Tài khoản (khối "Nhắc việc"). Zalo hoãn (QD09).
- **Chạy nền (I12):** `@nestjs/schedule` 6.1.3, mỗi 15 phút và 5 giây sau khởi động; `REMINDERS_ENABLED=false` để tắt; tắt khi chạy test. Khoá thuê trong DB (10 phút). Email lỗi thử lại sau 1/5/15/60 phút, lần 5 lỗi → Thất bại; chưa cấu hình SMTP → "Không gửi". Email chờ của việc đổi hạn/xong/tạm dừng, nghĩa vụ đã nộp → Huỷ. API: `GET/PUT /reminder-settings`, `GET/PUT/DELETE /service-urgency-thresholds/:id`, `GET /notification-deliveries`, `POST /notification-deliveries/:id/retry`, `POST /reminders/run` (`settings:view/update`); `GET/PUT /notifications/preferences` (chính mình).
- **Làm rõ khi code (không đổi quyết định đã duyệt):**
  - Khoá chạy một tiến trình dùng **dòng khoá thuê** trong DB thay cho advisory lock của PostgreSQL (advisory lock gắn với một kết nối, không giữ được qua pool của Prisma); mục tiêu I12 giữ nguyên, có e2e chạy song song.
  - Cửa sổ gửi bù **7 ngày**: mốc bỏ lỡ quá 7 ngày không gửi (tránh dồn nhắc cho việc quá hạn lâu khi mới bật). Leo thang cũng chỉ một lần trong cửa sổ này.
  - Email dùng mốc **gần nhất trước hạn** (ngưỡng nhỏ nhất, mặc định −1 ngày); ngưỡng riêng theo dịch vụ đổi luôn mốc nhắc của việc thuộc dịch vụ đó.
  - Liên kết trong nhắc lịch báo cáo tạm trỏ trang khách hàng; 06-D2 đã đổi sang màn hình Lịch báo cáo.
  - Cấu hình SMTP gửi nhắc dùng chung biến `SMTP_*` với email tài khoản (01) nhưng có lớp gửi riêng trong module thông báo để không sửa 01; gộp hai lớp khi mở phạm vi 01.
- Test: không sửa test cũ; thêm `urgency.spec` (4), `reminder.rules.spec` (5), `reminders.e2e-spec` (7); web `urgency-tag.component.spec` (1), `notification-preferences.component.spec` (2).

### 06-D Giao diện và nghiệm thu — đã code và kiểm chứng kỹ thuật (28/10/2026); chờ QD07, QD09 để nghiệm thu — [biên bản](06-deadlines-acceptance.md)

06-D chia nhỏ: **D1** lịch FullCalendar (I14); **D2** màn hình Lịch báo cáo `/deadlines` + tab "Lịch báo cáo" ở chi tiết KH; **D3** cấu hình 06 (loại nghĩa vụ, lịch năm, gắn dịch vụ, mốc nhắc/ngưỡng, nhật ký gửi); **D4** chuông thông báo (mức độ, lọc chưa đọc), đổi liên kết nhắc lịch báo cáo sang `/deadlines`, kiểm chứng restart/email thử và biên bản `06-deadlines-acceptance.md`.

**D1 Lịch & Deadline — đã code và kiểm chứng kỹ thuật (28/10/2026):**

- **API** `GET /calendar/events?from&to&customerId&userId&obligationTypeId&kind&status` (module `deadlines`): gộp **nghĩa vụ** (hạn pháp lý, theo phạm vi KH 02) và **việc** (hạn hiện hành, theo phạm vi việc 05). Có `tasks:view` thì thấy việc, có `deadlines:view` thì thấy nghĩa vụ, không có cả hai → 403. Trả kèm mức gấp (I11, ngưỡng riêng dịch vụ cho việc), trạng thái hiển thị "Trễ hạn" của nghĩa vụ (I7), việc gắn của nghĩa vụ, ngày nghỉ/làm bù của năm đã xác nhận và danh sách năm chưa xác nhận trong khoảng. Khoảng tối đa 100 ngày; mỗi loại tối đa 1.500 mục (cờ `truncated`).
- **Giao diện** `/calendar` thay `nz-calendar`: FullCalendar 6.1.21 (`@fullcalendar/angular`, `core`, `daygrid`, `list` — 0 lỗ hổng `npm audit --omit=dev`), tháng / tuần / danh sách, tiếng Việt, tuần bắt đầu thứ 2; màu theo mức gấp, viền trái tím = hạn pháp lý, xanh ngọc = việc nội bộ, đã xong/đã nộp xám gạch; thứ 7/CN và ngày Nghỉ tô xám (ngày Làm bù không), rê chuột thấy tên ngày; cảnh báo "Lịch năm … chưa xác nhận". Lọc KH, nhân viên (người có `tasks:approve`), loại báo cáo và loại hạn (người có `deadlines:view`), trạng thái (chưa xong / quá hạn / đã xong). Bấm mục mở ngăn chi tiết: việc → "Mở việc"; nghĩa vụ → trạng thái, người phụ trách KH, danh sách việc gắn (bấm mở việc), "Mở khách hàng" (màn hình nghĩa vụ ở D2). Màn hẹp (< 768px) mặc định dạng danh sách, ngăn chi tiết toàn chiều rộng.
- **Làm rõ khi code (không đổi quyết định đã duyệt):**
  - Dạng **tuần** dùng lưới ngày (`dayGridWeek`) thay cho `timegrid` vì mọi hạn là cả ngày; không cài `@fullcalendar/timegrid`.
  - Nghĩa vụ "Không áp dụng" không lên lịch. Lọc **nhân viên** với nghĩa vụ = KH do người đó phụ trách hoặc có việc gắn giao cho người đó. Lọc **loại báo cáo** với việc = việc gắn nghĩa vụ loại đó.
- Test: không sửa test cũ; thêm e2e `calendar-events.e2e-spec` (6), web `calendar-events.spec` (4), `calendar.store.spec` (4), `calendar-event-drawer.component.spec` (1).
**D2 Lịch báo cáo — đã code và kiểm chứng kỹ thuật (28/10/2026):**

- **API:** `GET /customer-obligations/summary` (ô đếm Chưa đến hạn / Đang chuẩn bị / Trễ hạn / Đã nộp trong tháng — tháng theo giờ VN; cùng bộ lọc KH/loại/người phụ trách/tìm kiếm, theo phạm vi KH); danh sách trả thêm **người phụ trách KH** và lọc `ownerId`. Nhắc lịch báo cáo không có việc gắn (06-C) nay trỏ `/deadlines?id=…` thay cho trang KH.
- **Màn hình `/deadlines`** (menu "Lịch báo cáo", quyền `deadlines:view`): 4 ô đếm bấm để lọc; tìm KH, lọc loại báo cáo, trạng thái (gồm Trễ hạn), người phụ trách (người có `tasks:approve`); bảng KH / loại / kỳ / hạn nộp (dấu * khi hạn đã đổi theo lịch) / trạng thái + "Nộp trễ" / phụ trách / số việc gắn. Ngăn chi tiết: thông tin, căn cứ, việc gắn (bấm mở việc), biên nhận (tải về), lịch sử; thao tác **Đang chuẩn bị**, **Đánh dấu đã nộp** (ngày nộp không sau hôm nay + file biên nhận bắt buộc), **Không áp dụng** (lý do) với `deadlines:update`; **Mở lại** (lý do) với `deadlines:approve`. 409 hiện lỗi và tải lại chi tiết. `?id=` mở thẳng một nghĩa vụ; ngăn chi tiết ở trang Lịch có nút "Mở lịch báo cáo".
- **Tab "Lịch báo cáo" ở chi tiết KH (02):** loại báo cáo đã xác nhận áp dụng cho KH (theo dịch vụ HĐ hay không, đang áp dụng / đã tắt + lý do), tắt/bật lại kèm lý do (5–500 ký tự) và báo số kỳ thêm/chuyển Không áp dụng; bảng nghĩa vụ của KH và cùng ngăn chi tiết.
- **Lỗi tìm thấy và đã sửa (có test tái hiện trước):**
  - `/customer-obligations?search=` **vượt phạm vi KH**: điều kiện tìm (`OR`) ghi đè điều kiện phạm vi (`OR`) trong cùng object → nhân viên/trưởng nhóm tìm kiếm thấy nghĩa vụ của KH ngoài phạm vi. Nay ghép bằng `AND` (e2e `customer-obligations-board`).
  - **"Bật lại" loại đã có dịch vụ trong HĐ sinh kỳ vượt thời hạn HĐ** (tới tầm sinh 400 ngày): khoảng "bật tay" chỉ còn dùng khi KH không có dịch vụ gắn loại đó, đúng chú thích sẵn có của hàm (unit `obligation-sync.spec`).
- **Phạm vi ngoài module đã dùng (theo màn hình đã duyệt):** `customers` (02) thêm tab và chuỗi "Lịch báo cáo"; `core` thêm route `/deadlines` và mục menu; `calendar` (06-D1) thêm nút "Mở lịch báo cáo".
- Test: không sửa test cũ; thêm e2e `customer-obligations-board.e2e-spec` (4), unit `obligation-sync.spec` +1; web `obligations.store.spec` (4), `obligation-drawer.component.spec` (4), `obligation-settings.component.spec` (2).
**D3 Cấu hình 06 — đã code và kiểm chứng kỹ thuật (28/10/2026):**

- **Màn hình `/deadline-settings`** (menu "Cấu hình lịch & nhắc"; vào được khi có `deadlines:view` **hoặc** `settings:view`), 4 tab theo quyền — chỉ giao diện, dùng API 06-B/06-C sẵn có, không đổi backend:
  - **Loại nghĩa vụ** (`deadlines:view`): danh sách (mã, tên, nhóm, chu kỳ, đã xác nhận vN / chưa xác nhận / nháp / đã ngừng, dịch vụ gắn); **thêm loại** (mã, tên, nhóm, chu kỳ, nhóm thay thế + quy tắc) với `deadlines:create`. Ngăn chi tiết: mô tả quy tắc bằng lời (bản xác nhận và bản nháp), **sửa quy tắc → lưu nháp** (`create`), **xác nhận nháp** và **ngừng dùng** có lý do (`approve`) — báo số kỳ thêm/chuyển Không áp dụng/đổi hạn; **gắn dịch vụ** (`create`); **xem trước hạn 12 kỳ** cho một KH mẫu (thoả điều kiện hay không, hạn theo quy tắc và hạn sau khi dời ngày nghỉ — tô màu khi khác).
  - **Lịch năm**: chọn năm, danh sách ngày Nghỉ / Làm bù, thêm/xoá (`create`), lưu; **xác nhận** (`approve`); năm đã xác nhận chỉ GĐ sửa, bắt buộc lý do, báo số nghĩa vụ đổi hạn.
  - **Nhắc việc** (`settings:view`, sửa với `settings:update`): 3 ngưỡng mức gấp/mốc nhắc (1–90, giảm dần), giờ gửi (24 giờ), số ngày làm việc leo thang; ngưỡng riêng theo dịch vụ (thêm/sửa/xoá); nút **Chạy nhắc ngay** (dùng khi UAT).
  - **Nhật ký gửi** (`settings:view`): lọc trạng thái/kênh/tiêu đề, lỗi cuối, số lần thử; **gửi lại** email Thất bại/Không gửi (`settings:update`); cảnh báo khi có email "Không gửi" (thường do chưa cấu hình SMTP).
- **Phạm vi ngoài module:** `core` — `AuthService.can('a|b')` = có một trong các quyền (dùng cho route và menu của màn hình này; có test), thêm route và mục menu; `shared/utils/date-key.ts` gom hàm đổi ngày ↔ `YYYY-MM-DD` trước đây lặp ở `calendar` và `deadlines` (06-D1/D2).
- **Làm rõ khi code:** chưa làm sửa tên/nhóm/nhóm thay thế của loại đã tạo trên giao diện (API `PATCH /obligation-types/:id` có sẵn) — tạo loại mới nếu cần đổi; xem trước liệt kê các kỳ tới kể cả kỳ kết thúc trước ngày hiệu lực của quy tắc (hành vi API 06-B).
- Test: không sửa test cũ; web `rule-summary.spec` (2), `settings-stores.spec` (4), `obligation-rule-form.component.spec` (2), `auth.service.spec` +1.

**D4 Chuông thông báo và kiểm chứng — đã code và kiểm chứng kỹ thuật (28/10/2026):**

- API `GET /notifications?unread=true` (chỉ thông báo chưa đọc; số chưa đọc giữ nguyên). Chuông: lọc Tất cả / Chưa đọc (menu giữ mở khi đổi lọc), nhãn loại nhắc việc theo màu mức độ; template/style tách file, chuỗi vào `notifications.text.ts`.
- Kiểm chứng khởi động lại và đường email bằng hộp thư SMTP giả cục bộ — xem [biên bản](06-deadlines-acceptance.md).
- Test: e2e `notifications-bell.e2e-spec` (2), web `notification-bell.component.spec` (2).

- Còn lại của D1: phương thức `TasksApi.calendar` và kiểu `CalendarTask` (web, module tasks 05) không còn dùng sau khi thay trang; API cũ `GET /tasks/calendar` giữ nguyên — xoá khi được duyệt sửa module 05.
