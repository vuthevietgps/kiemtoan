# 05 — Công việc: 8 trạng thái, soát xét nhiều cấp, hồ sơ khách hàng, hạn và dữ liệu đánh giá

Ngày 22/10/2026. **Đã được người dùng duyệt trong chat ngày 22/10/2026: “Tôi duyệt đặc tả 05 với phương án đề xuất H1–H12 cùng phạm vi sửa ngoài module đã liệt kê. Bắt đầu code 05-B.”**

Căn cứ: YC10 (sinh việc theo kỳ/giai đoạn, người làm/kiểm tra, ưu tiên, ngày thực tế), YC11 (soát xét, không tự duyệt, trả lại có lịch sử), YC12 (hồ sơ yêu cầu 6 trạng thái), YC13 (việc của tôi) trong [phạm vi](../requirements/scope-and-traceability.md); **Phụ lục 1** của [câu trả lời 15/10](../requirements/sources/clarifications-answered-2026-10-15.docx) mục III.2–3 (trường và 8 trạng thái), IV.3 (Công việc của tôi 4 tab), V.2–4 (trạng thái hồ sơ, liên kết hồ sơ–việc), VI (phê duyệt nhiều cấp, lịch sử); C13 (trưởng nhóm soát xét); QD04, QD00 (chưa có cổng khách hàng) trong [sổ quyết định](../requirements/decision-register.md); [khung đánh giá G1–G10](10-performance-evaluation.md) (đã duyệt); [review 22/10](../planning/review-2026-10-22.md) R2, R3; [04-B kế hoạch](04-contracts-lifecycle.md), [04-F](04-audit-engagement-tracking.md). [Đặc tả demo 05](05-tasks.md) chỉ dùng đối chiếu.

## Hiện trạng cần thay

- Việc chỉ có 3 trạng thái (Chưa làm/Đang làm/Đã làm) và một nút "duyệt" sau Đã làm; không có người kiểm tra trên việc, không có lịch sử soát xét, không có trả lại có nội dung.
- **R2:** `isManager` dùng vai trò gốc (`hasPermission(user.role, …)`), bỏ qua quyền tùy chỉnh — người bị thu quyền duyệt vẫn được coi là quản lý và ngược lại.
- **R3:** người có `tasks:approve` duyệt được chính việc mình làm.
- Hạn sửa trực tiếp, không giữ hạn gốc; "Đã làm" thiếu `completedAt` bị báo cáo coi là đúng hạn; chưa có trạng thái chờ khách, tạm dừng, hồ sơ yêu cầu theo việc; mỗi dòng dịch vụ chỉ sinh việc cho một kỳ.

## Phạm vi

- **Trong phạm vi:** module `tasks` (backend, frontend): trạng thái, soát xét, gia hạn, chờ khách, tạm dừng, hồ sơ yêu cầu của khách theo dòng dịch vụ/kỳ, việc của tôi, hàng đợi soát xét; schema/migration/seed; test.
- **Phạm vi ngoài module xin duyệt cùng đặc tả (ngoài danh sách phải xin thêm):**
  - `service-catalog` (03): cờ **hạn pháp lý** (G6) và cờ **cần xác nhận giao nộp** (H1) trên bước quy trình + ô chọn ở form bước; chép khi nhân bản phiên bản.
  - `contracts` (04, đã nghiệm thu): chép hai cờ trên và người phê duyệt mặc định vào bước kế hoạch; **nhóm thực hiện cho dòng dịch vụ không phải kiểm toán** (G1, xem H8) và lịch sử vai; bộ sinh việc sinh **nhiều kỳ** (H12) với khoá chống trùng mới; ô người phê duyệt trên bảng bước kế hoạch. Hồi quy toàn bộ e2e 04.
  - `documents` (02): lưu file hồ sơ khách hàng nộp (nhóm Tài liệu dịch vụ) và bằng chứng/kết quả việc qua API sẵn có; không đổi quy tắc file.
  - `dashboard`, `reports` (10): đổi các chỗ đọc `DONE` sang trạng thái mới để số liệu không sai (Hoàn thành = xong); **không** làm báo cáo năng lực ở 05 (thuộc 10).
  - `notifications`: thêm loại thông báo (gửi kiểm tra, trả lại, chờ khách, hồ sơ đã nộp, đề nghị gia hạn) dùng cơ chế sẵn có; nhắc hạn theo lịch thuộc 06.
- **Ngoài phạm vi:** lịch nghỉ lễ/hạn pháp lý theo khách hàng và nhắc 7/3/1 ngày (06); cổng khách hàng tự tải hồ sơ (QD00 — nhân viên tải thay); báo cáo đánh giá năng lực và xuất (10); ngưỡng/cấu hình (11); Gantt (H11).

## Quyết định cần duyệt

Người dùng duyệt ngày 22/10/2026 theo cột "Đề xuất". Các quyết định G1–G10 đã duyệt được áp dụng.

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| H1 | "Đã phê duyệt" khác "Hoàn thành" thế nào? (QD04) | **Đã phê duyệt** = qua đủ các cấp soát xét nội bộ nhưng còn bước giao nộp (nộp tờ khai, gửi khách…); **Hoàn thành** = đã giao nộp xong, có kết quả (biên nhận/ghi chú). Bước không cần giao nộp: phê duyệt cấp cuối thì chuyển thẳng Hoàn thành. Bước quy trình có cờ "cần xác nhận giao nộp" (mặc định bật cho bước có hạn pháp lý) | Không tách: phê duyệt cấp cuối = Hoàn thành; "Đã phê duyệt" chỉ là trạng thái trung gian khi còn cấp phê duyệt sau |
| H2 | Số cấp duyệt áp dụng thế nào? | Theo `reviewLevels` của bước kế hoạch: **0** không soát xét (người làm tự hoàn thành, vẫn cần bằng chứng nếu bước yêu cầu); **1** người kiểm tra (mặc định trưởng nhóm dòng dịch vụ); **2** người kiểm tra rồi người phê duyệt (mặc định Manager dòng dịch vụ). Người kiểm tra/phê duyệt cụ thể được chọn ở kế hoạch 04-B, đổi được trên việc bởi người quản lý việc | Người phê duyệt là bất kỳ ai có `tasks:approve` trong phạm vi (không chỉ định trước) |
| H3 | Chống tự duyệt (R3) | Người thực hiện **không** được kiểm tra hay phê duyệt việc của chính mình ở bất kỳ cấp nào; một người không vừa kiểm tra vừa phê duyệt cùng một việc. Lập kế hoạch/giao việc vi phạm thì cảnh báo và chặn gửi kiểm tra cho tới khi đổi người. Việc 0 cấp không bị ràng buộc này | Cho cùng một người kiểm tra và phê duyệt khi đội ít người |
| H4 | Chờ khách hàng: tự động hay tay? | **Tự động** khi bước có hồ sơ yêu cầu bắt buộc chưa "Đã chấp nhận" (việc không bắt đầu được, hiện "Chờ khách hàng cung cấp hồ sơ"); khi mọi hồ sơ bắt buộc của bước được chấp nhận thì tự về **Chưa bắt đầu** và báo người làm. Người làm cũng chuyển tay việc **đang làm** sang Chờ khách nhưng phải chọn hoặc tạo yêu cầu hồ sơ gửi khách. Thời gian chờ chỉ trừ hạn nội bộ khi trưởng nhóm **xác nhận** khoảng chờ (G5); không trừ hạn pháp lý | Chỉ chuyển tay, không tự động theo hồ sơ |
| H5 | Tạm dừng | Chỉ người quản lý việc (`tasks:approve` trong phạm vi hoặc Manager dòng dịch vụ), bắt buộc lý do; tiếp tục về trạng thái trước khi dừng. Thời gian tạm dừng **không** tự trừ hạn — muốn dời hạn thì gia hạn (G3) | Tạm dừng tự cộng thời gian dừng vào hạn |
| H6 | Phụ thuộc giữa bước | Việc có bước phụ thuộc chưa xong vẫn ở Chưa bắt đầu nhưng gắn nhãn **"Chưa đủ điều kiện"** và không bắt đầu được; điều kiện thoả khi bước trước ở **Đã phê duyệt** hoặc **Hoàn thành** | Bước trước phải Hoàn thành mới mở bước sau |
| H7 | Gia hạn việc (G3) | Người làm hoặc trưởng nhóm **đề nghị** (hạn mới + lý do); Manager dòng dịch vụ hoặc KTT/GĐ trong phạm vi **duyệt/từ chối**. **Hạn pháp lý không gia hạn được** trong hệ thống; nếu cơ quan cho lùi hạn thì GĐ ghi nhận kèm văn bản (đếm riêng là "gia hạn theo văn bản") | Cho Manager tự đổi hạn không cần đề nghị |
| H8 | Nhóm thực hiện cho dịch vụ kế toán (G1) lưu ở đâu? | Bảng nhóm riêng cho **dòng dịch vụ không phát hành BCKT** (Manager, trưởng nhóm, trợ lý + lịch sử vai như 04-F); dòng kiểm toán **dùng nhóm của 04-F**, không nhập hai nơi; giao diện việc đọc chung qua một hàm | Gộp cả kiểm toán vào bảng nhóm chung mới (phải chuyển dữ liệu và sửa 04-F đã nghiệm thu) |
| H9 | Chuyển đổi dữ liệu cũ (3 trạng thái) | Chưa làm → **Chưa bắt đầu**; Đang làm → **Đang thực hiện**; Đã làm **đã duyệt** → **Hoàn thành** (giữ người/ngày duyệt, ghi 1 dòng lịch sử "chuyển đổi"); Đã làm **chưa duyệt**: bước cần soát xét → **Chờ kiểm tra**, bước không cần → **Hoàn thành**. Hạn gốc = hạn hiện tại; lần nộp đầu = `completedAt` nếu có, không có thì để trống (không tính đúng hạn) — mọi bản ghi gắn nhãn "dữ liệu chuyển đổi" | Đã làm chưa duyệt → Hoàn thành (bỏ qua soát xét cho dữ liệu cũ) |
| H10 | Mức ưu tiên và tỷ lệ hoàn thành | Ưu tiên **Thấp/Bình thường/Cao/Khẩn cấp** (mặc định Bình thường; người quản lý việc đổi). Tỷ lệ % do người làm nhập để tham khảo, tự 100% khi Hoàn thành; không dùng để đánh giá | Bỏ tỷ lệ % |
| H11 | Phạm vi giao diện 05 | Việc của tôi 4 tab (Hôm nay / Sắp đến hạn / Quá hạn / Đã hoàn thành), bảng + kanban theo trạng thái, **hàng đợi Chờ tôi kiểm tra/phê duyệt**, chi tiết việc (hồ sơ, bằng chứng, kết quả, lịch sử soát xét, gia hạn, chờ khách), giao lại hàng loạt, **bình luận** trên việc (không @). Gantt và @nhắc tên để sau | Làm thêm Gantt và @ ngay trong 05 |
| H12 | Sinh việc cho dịch vụ theo kỳ (tháng/quý) | Khi kế hoạch được xác nhận, sinh việc cho **mọi kỳ trong thời hạn HĐ** (ví dụ 12 tháng) theo lịch của kế hoạch dời theo kỳ; khoá chống trùng theo **(bước kế hoạch, kỳ)**. Dịch vụ theo năm/dự án giữ một kỳ | Sinh từng kỳ trước N ngày bằng tác vụ định kỳ (cần 06) |

## Trạng thái việc (8 trạng thái — PL1 III.3)

| Mã | Trạng thái | Ý nghĩa |
| --- | --- | --- |
| `NOT_STARTED` | Chưa bắt đầu | Đã giao, chưa làm (kèm nhãn "Chưa đủ điều kiện" khi bước phụ thuộc chưa xong — H6) |
| `IN_PROGRESS` | Đang thực hiện | Người làm đang xử lý |
| `WAITING_CLIENT` | Chờ khách hàng cung cấp hồ sơ | Thiếu hồ sơ bắt buộc của bước hoặc người làm báo chờ (H4) |
| `IN_REVIEW` | Chờ kiểm tra | Đã gửi kiểm tra; lưu cấp hiện tại (1 = trưởng nhóm, 2 = quản lý) |
| `CHANGES_REQUESTED` | Yêu cầu chỉnh sửa | Bị trả lại kèm nội dung; quay về người làm |
| `APPROVED` | Đã phê duyệt | Qua đủ cấp soát xét, còn bước giao nộp (H1) |
| `COMPLETED` | Hoàn thành | Xong, có kết quả |
| `ON_HOLD` | Tạm dừng | Quản lý dừng có lý do (H5); lưu trạng thái trước để tiếp tục |

**Bảng chuyển trạng thái** (người được phép; mọi chuyển ghi lịch sử từ–đến–người–thời điểm–ghi chú):

| Từ → Đến | Ai | Điều kiện |
| --- | --- | --- |
| Chưa bắt đầu → Đang thực hiện | Người làm | Không còn hồ sơ bắt buộc chưa chấp nhận; bước phụ thuộc đã thoả (H6). Ghi `startedAt` lần đầu |
| Chưa bắt đầu/Đang thực hiện → Chờ khách | Hệ thống (H4) hoặc người làm | Người làm phải gắn yêu cầu hồ sơ gửi khách |
| Chờ khách → Chưa bắt đầu/Đang thực hiện | Hệ thống khi hồ sơ bắt buộc đủ "Đã chấp nhận"; người làm khi chờ tay xong | Đóng khoảng chờ (ngày bắt đầu–kết thúc) |
| Đang thực hiện/Yêu cầu chỉnh sửa → Chờ kiểm tra ("Gửi kiểm tra") | Người làm | Bước có `reviewLevels ≥ 1`; có kết quả/bằng chứng nếu bước yêu cầu; người kiểm tra hợp lệ (H3). Lần đầu ghi **mốc nộp đầu** (G4) |
| Đang thực hiện → Hoàn thành | Người làm | Bước `reviewLevels = 0`; có bằng chứng nếu yêu cầu |
| Chờ kiểm tra cấp 1 → Chờ kiểm tra cấp 2 | Người kiểm tra | Bước 2 cấp |
| Chờ kiểm tra (cấp cuối) → Đã phê duyệt / Hoàn thành | Người kiểm tra (1 cấp) hoặc người phê duyệt (2 cấp) | Theo H1; ghi **mốc chấp nhận** |
| Chờ kiểm tra → Yêu cầu chỉnh sửa ("Trả lại") | Người kiểm tra/phê duyệt của cấp hiện tại | Bắt buộc nội dung (5–2000 ký tự); đếm số lần trả lại |
| Đã phê duyệt → Hoàn thành | Người làm (hoặc người phê duyệt) | Có kết quả giao nộp (file hoặc ghi chú) |
| Bất kỳ (trừ Hoàn thành) ⇄ Tạm dừng | Người quản lý việc (H5) | Lý do bắt buộc; tiếp tục về trạng thái trước |
| Hoàn thành → Đang thực hiện ("Mở lại") | Người quản lý việc | Lý do bắt buộc; giữ mốc nộp đầu/chấp nhận cũ, đếm "mở lại sau hoàn thành" (chất lượng) |

Không ai đặt thẳng Đã phê duyệt/Hoàn thành cho việc cần soát xét ngoài luồng trên (PL1: "không cho phép nhân viên tự đánh dấu đã phê duyệt").

## Quyền (sửa R2)

- Mọi kiểm tra dùng **quyền hiệu lực** của người dùng (`AuthUser.permissions`, gồm vai trò tùy chỉnh), không dùng vai trò gốc. Bỏ hàm `isManager(user.role)`.
- **Người quản lý việc** = người có `tasks:approve` hiệu lực **và** việc trong phạm vi dữ liệu của họ, hoặc Manager của dòng dịch vụ (G1). Được: giao lại, đổi người kiểm tra/phê duyệt, tạm dừng/tiếp tục, mở lại, duyệt gia hạn, xác nhận khoảng chờ khách, sửa ưu tiên.
- **Kiểm tra/phê duyệt** dựa vào người được chỉ định trên việc ở cấp hiện tại (cần `tasks:update` hiệu lực), không dựa vào vai trò — nhân viên làm trưởng nhóm vẫn kiểm tra được; người quản lý việc có thể nhận thay khi người được chỉ định nghỉ.
- Người làm: chuyển trạng thái việc của mình theo bảng trên, tải bằng chứng/kết quả, đề nghị gia hạn, bình luận.
- Phạm vi dữ liệu giữ như hiện tại (`taskScope`); người được chỉ định kiểm tra/phê duyệt thấy việc đó dù ngoài phạm vi khách hàng? **Không** — giữ đúng nguyên tắc F6: phân công KH là nguồn quyền xem; khi chỉ định người ngoài phạm vi thì cảnh báo như 04-F.
- E2e phân quyền bắt buộc cho cả **cấp** và **thu hồi** quyền trên vai trò tùy chỉnh (R2).

## Dữ liệu trên mỗi việc (PL1 III.2 + G)

Mã việc tự sinh (`CV-YYYY-NNNNN`); tên; KH, HĐ, dòng dịch vụ, kỳ, bước kế hoạch; người làm; người kiểm tra; người phê duyệt; số cấp duyệt; ngày bắt đầu (dự kiến/thực tế); **hạn gốc**, **hạn hiện hành**, cờ **hạn pháp lý**; mức ưu tiên; tỷ lệ %; trạng thái (+ trạng thái trước khi tạm dừng, cấp soát xét hiện tại); **mốc nộp đầu**, **mốc chấp nhận**, ngày hoàn thành; số lần trả lại; kết quả (file/ghi chú); hồ sơ liên quan; nhãn "dữ liệu chuyển đổi".

Bảng mới (dự kiến): `task_status_events` (lịch sử chuyển), `task_reviews` (cấp, người, quyết định chấp nhận/trả lại, nội dung, thời điểm — PL1 VI.5), `task_due_changes` (đề nghị/duyệt gia hạn: hạn cũ, mới, lý do, người đề nghị, người duyệt, trạng thái), `task_client_waits` (khoảng chờ: bắt đầu, kết thúc, yêu cầu hồ sơ, người xác nhận), `task_comments`; `customer_document_requests` (hồ sơ yêu cầu theo dòng dịch vụ × kỳ, 6 trạng thái, gắn bước, tài liệu kho 02, lịch sử). Nhóm dòng dịch vụ kế toán theo H8. Chỉ thêm cột/bảng; `TaskStatus` cũ chuyển đổi theo H9.

## Hồ sơ yêu cầu của khách (YC12, PL1 V)

- Khi kế hoạch được xác nhận, sinh danh sách hồ sơ từ hồ sơ yêu cầu đã chép trong kế hoạch (04-B): hồ sơ "theo kỳ" sinh cho từng kỳ, hồ sơ "một lần" sinh một bản.
- 6 trạng thái: **Chưa yêu cầu → Đã yêu cầu → Khách hàng đã tải lên → Đang kiểm tra → Cần bổ sung / Đã chấp nhận**. Chưa có cổng khách hàng (QD00): nhân viên ghi nhận "đã yêu cầu" (ngày, cách gửi) và tải file thay khách vào kho hồ sơ 02.
- Tải file **không** tự hoàn tất việc (PL1 V.4); chỉ "Đã chấp nhận" mới mở bước (H4). "Cần bổ sung" bắt buộc ghi nội dung, đưa việc về Chờ khách.
- Màn hình hồ sơ theo KH/HĐ/kỳ với lọc trạng thái; số "Chờ khách hàng cung cấp hồ sơ" cho dashboard (10).

## Hạn, gia hạn, chờ khách (G2–G7)

- Hạn gốc chốt khi việc được sinh/giao; đổi sau đó qua **đề nghị gia hạn** (H7), lịch sử không sửa/xoá. Bước có cờ hạn pháp lý: hạn = hạn pháp lý của kỳ, không gia hạn (H7).
- Khoảng chờ khách: mở khi vào Chờ khách, đóng khi ra; trưởng nhóm **xác nhận** khoảng chờ thì số ngày chờ được cộng vào hạn **nội bộ khi đánh giá** (không đổi hạn hiện hành hiển thị; báo cáo 10 dùng). Không đếm trùng khi các khoảng chồng nhau. Hạn pháp lý không trừ, chỉ gắn nhãn "do khách".
- Thời gian soát xét của từng cấp (từ lúc vào cấp đến lúc chấp nhận/trả lại, ngày làm việc thứ 2–6 cho tới khi 06 có lịch nghỉ) lưu để tính SLA 2 ngày (G7) ở 10.
- Kết quả đúng/trễ dùng chung định nghĩa với 04-F (`deadline.rules`): trợ lý theo **mốc nộp đầu**, trưởng nhóm/Manager theo **mốc chấp nhận** (G4).

## Màn hình (H11)

- **Việc của tôi** (`/tasks/my`): 4 tab Hôm nay / Sắp đến hạn (≤ 7 ngày) / Quá hạn / Đã hoàn thành; mỗi dòng: KH, tên việc, hạn (nhãn pháp lý), trạng thái, ưu tiên; nút hành động theo trạng thái.
- **Chờ tôi kiểm tra / phê duyệt**: hàng đợi theo cấp, thời gian đã chờ (cảnh báo quá SLA 2 ngày làm việc).
- **Danh sách/kanban** (`/tasks`): lọc KH, HĐ, dịch vụ, kỳ, trạng thái, người làm/kiểm tra, ưu tiên, hạn pháp lý, quá hạn; kanban 8 cột (kéo thả chỉ khi chuyển hợp lệ); giao lại hàng loạt (người quản lý việc).
- **Chi tiết việc**: thông tin, hồ sơ yêu cầu của bước và trạng thái, bằng chứng/kết quả (phiên bản 02), dòng soát xét (ai, cấp, quyết định, nội dung), gia hạn (đề nghị/duyệt), khoảng chờ, bình luận, lịch sử.
- **Hồ sơ khách hàng** (`/tasks/documents` hoặc tab ở KH360): danh sách hồ sơ yêu cầu theo kỳ, cập nhật trạng thái, tải thay khách.
- Trang HĐ (04) tab Quy trình & Công việc hiện trạng thái mới; 375px không tràn ngang trong khối (giới hạn khung menu chung vẫn còn).

## Tiến độ dòng dịch vụ và HĐ

- **Kỳ dịch vụ hoàn tất** khi mọi việc bắt buộc của dòng × kỳ Hoàn thành; dòng dịch vụ hoàn thành khi mọi kỳ hoàn tất; HĐ hoàn thành khi mọi dòng hoàn thành (giữ cơ chế 04, đổi điều kiện từ `DONE` sang `COMPLETED`). Mở lại việc đưa dòng/HĐ về Đang thực hiện như hiện nay.
- Dashboard/báo cáo (10) đọc Hoàn thành thay cho Đã làm; các số "chờ phê duyệt", "chờ khách" lấy từ trạng thái mới. Không đổi công thức tiền.

## API (dự kiến)

| Phương thức | Đường dẫn | Ai |
| --- | --- | --- |
| GET | `/tasks`, `/tasks/my?tab=`, `/tasks/review-queue`, `/tasks/:id` | Theo phạm vi |
| POST | `/tasks/:id/start`, `/submit`, `/complete`, `/wait-client`, `/resume` | Người làm (điều kiện theo bảng) |
| POST | `/tasks/:id/review` `{decision: ACCEPT\|RETURN, note}` | Người kiểm tra/phê duyệt cấp hiện tại |
| POST | `/tasks/:id/hold`, `/unhold`, `/reopen`, `/reassign`, PATCH người kiểm tra/phê duyệt/ưu tiên | Người quản lý việc |
| POST | `/tasks/:id/due-changes` (đề nghị), `/tasks/:id/due-changes/:changeId/decide` | Người làm/trưởng nhóm; người quản lý việc |
| POST | `/tasks/:id/client-waits/:waitId/confirm` | Trưởng nhóm của dòng |
| POST | `/tasks/:id/evidence`, `/result`, `/comments` | Người làm (bằng chứng/kết quả); người xem được việc (bình luận) |
| GET/POST/PATCH | `/customer-document-requests…` (danh sách, đánh dấu đã yêu cầu, tải thay khách, kiểm tra, cần bổ sung, chấp nhận) | Nhân viên phụ trách KH; người quản lý việc |
| PUT | `/contracts/:id/services/:lineId/team` | Nhóm dòng dịch vụ kế toán (H8) — `contracts:plan` |

API cũ `POST /tasks/:id/status` và `/approve` được thay; giữ trả lỗi rõ ràng cho client cũ trong một phiên bản rồi bỏ.

## Luồng lỗi chính

- Gửi kiểm tra khi thiếu bằng chứng/kết quả bắt buộc, chưa có người kiểm tra, hoặc người kiểm tra = người làm → 400 nêu rõ.
- Người không phải người kiểm tra/phê duyệt cấp hiện tại xử lý → 403; xử lý khi việc đã chuyển cấp/trạng thái (bấm đồng thời) → 409.
- Bắt đầu việc còn hồ sơ bắt buộc chưa chấp nhận hoặc bước phụ thuộc chưa thoả → 400 kèm danh sách thiếu.
- Gia hạn hạn pháp lý, gia hạn không lý do, hạn mới không sau hạn hiện hành → 400; người không phải người quản lý việc duyệt → 403.
- Trả lại/tạm dừng/mở lại không lý do → 400. Việc ngoài phạm vi → 404.

## Tiêu chí nghiệm thu

1. 8 trạng thái chuyển đúng bảng; lịch sử đầy đủ người–thời điểm–nội dung (PL1 VI.5); không ai tự đặt Đã phê duyệt/Hoàn thành cho việc cần soát xét.
2. **R2:** quyền hiệu lực — cấp và thu hồi `tasks:approve`/`tasks:update` trên vai trò tùy chỉnh đều có hiệu lực ngay ở mọi thao tác việc (e2e cả hai chiều).
3. **R3:** người làm không kiểm tra/phê duyệt việc của mình; một người không giữ hai cấp; chặn ở API (e2e).
4. Soát xét 0/1/2 cấp theo bước; trả lại nhiều lần đếm đúng; mốc nộp đầu và mốc chấp nhận tách biệt (G4); H1 phân biệt Đã phê duyệt/Hoàn thành.
5. Hồ sơ yêu cầu sinh đúng theo kỳ/một lần; 6 trạng thái; tải file không tự hoàn tất; chỉ Đã chấp nhận mới mở bước; Cần bổ sung đưa việc về Chờ khách.
6. Chờ khách tự động/tay; khoảng chờ không đếm trùng; chỉ khoảng đã xác nhận được trừ hạn nội bộ; không trừ hạn pháp lý.
7. Gia hạn qua đề nghị/duyệt, giữ hạn gốc, lịch sử bất biến; hạn pháp lý không gia hạn.
8. Sinh việc nhiều kỳ không trùng khi gọi lại/đồng thời (khoá bước + kỳ); kế hoạch mới không đổi việc đã sinh; tiến độ kỳ/dòng/HĐ khớp.
9. Chuyển đổi dữ liệu cũ đúng H9 trên DB có dữ liệu (bản sao demo): không mất việc, không bịa lịch sử duyệt, nhãn "dữ liệu chuyển đổi"; Prisma diff sạch.
10. Dashboard/báo cáo hiện tại vẫn đúng sau đổi trạng thái (hồi quy e2e 10); dữ liệu đủ cho báo cáo năng lực 10 (mốc, cấp soát xét, trả lại, gia hạn, chờ khách).
11. Giao diện desktop/375px: việc của tôi 4 tab, hàng đợi soát xét, luồng làm → gửi → trả lại → sửa → gửi → kiểm tra → phê duyệt → hoàn thành; chờ khách và hồ sơ; gia hạn; tạm dừng; giao lại hàng loạt.
12. Lint/unit/e2e/build/max-lines đạt; e2e phân quyền 5 vai trò + vai trò tùy chỉnh cho mọi API mới; unit cho máy trạng thái, khoảng chờ chồng nhau, biên ngày giờ VN.

## Test hồi quy và thay đổi test cũ

- Test hiện có kỳ vọng 3 trạng thái (`task-status.rules.spec`, `tasks.e2e`, các e2e/unit của dashboard/reports đọc `DONE`, web `tasks`) sẽ viết lại theo trạng thái mới, giữ kiểm chứng tương đương (phạm vi, bằng chứng bắt buộc, tiến độ HĐ, thống kê) — ghi lý do ở `05-test-policy-changes.md` trước khi đổi.
- Thêm test tái hiện R2/R3 **trước** khi sửa (đỏ → xanh).
- Chạy lại toàn bộ e2e 04 (kế hoạch, sinh việc, phụ lục, 04-F) vì đổi bộ sinh việc và tiến độ.

## Phân kỳ triển khai

1. Người dùng duyệt đặc tả và H1–H12 (đã duyệt 22/10/2026).
2. **05-B Quyền và dữ liệu:** test R2/R3 rồi sửa; trạng thái mới + chuyển đổi H9; lịch sử, soát xét nhiều cấp, mốc; cờ hạn pháp lý 03 → 04 → việc; nhóm dòng dịch vụ kế toán (H8).
3. **05-C Sinh nhiều kỳ và phụ thuộc:** bộ sinh việc theo kỳ, khoá (bước, kỳ), điều kiện phụ thuộc (H6), tiến độ kỳ/dòng/HĐ.
4. **05-D Hồ sơ, chờ khách, gia hạn:** hồ sơ yêu cầu 6 trạng thái, chờ khách tự động/tay + xác nhận, đề nghị/duyệt gia hạn, tạm dừng/mở lại, thông báo.
5. **05-E Giao diện và nghiệm thu:** việc của tôi, hàng đợi soát xét, kanban, chi tiết việc, hồ sơ khách hàng, bình luận, giao lại hàng loạt; cập nhật dashboard/báo cáo đọc trạng thái mới; kiểm chứng và biên bản `05-tasks-acceptance.md`.

## Tiến độ triển khai

### 05-B Quyền và dữ liệu — đã code và kiểm chứng kỹ thuật (22/10/2026)

- **R2/R3:** test tái hiện viết trước (`tasks-permissions.e2e-spec.ts`, đỏ), sau khi sửa thì xanh. Mọi kiểm tra quyền trên việc dùng quyền hiệu lực (`hasPermission(user, …)`, gồm vai trò tùy chỉnh) qua `TaskAccess`; bỏ `isManager(user.role)`. Người quản lý việc = `tasks:approve` hiệu lực hoặc Manager nhóm dòng dịch vụ (dòng kiểm toán đọc nhóm 04-F) — một hàm `lineTeam()` dùng chung.
- **8 trạng thái + máy trạng thái** (`task-status.rules.ts`, hàm thuần): Bắt đầu, Gửi kiểm tra, Hoàn thành (0 cấp), Chấp nhận/Trả lại theo cấp, Giao nộp (Đã phê duyệt → Hoàn thành, H1). Đổi trạng thái có điều kiện theo trạng thái + cấp (bấm đồng thời → 409). Mỗi lần chuyển ghi `task_status_events`; mỗi lượt soát xét ghi `task_reviews` (cấp, người, quyết định, nội dung, lúc vào cấp, lúc quyết định). Mốc nộp đầu và mốc chấp nhận chỉ ghi lần đầu (G4).
- **API mới:** `POST /tasks/:id/start|submit|complete|review|deliver`, `GET /tasks/review-queue`; `PATCH /tasks/:id` thêm người kiểm tra/phê duyệt, số cấp, ưu tiên (người quản lý việc) và tỷ lệ % (người làm). API cũ `/status`, `/approve` trả **410** kèm hướng dẫn.
- **Chuyển đổi H9** (migration `20261022150000_task_workflow`): kiểm chứng trên bản sao `ketoan_demo_04` (30 việc: 10 Chưa bắt đầu, 3 Đang thực hiện, 17 Đã làm chưa duyệt ở bước có soát xét → Chờ kiểm tra cấp 1 với mốc nộp đầu = ngày đã làm cũ, bỏ ngày hoàn thành), bản sao `ketoan_demo_03` (141 việc; 12 Đã làm ở bước không soát xét → Hoàn thành) và bản sao có 5 việc giả lập đã duyệt (→ Hoàn thành, giữ người/ngày duyệt). Không mất việc, mỗi việc một dòng lịch sử "chuyển đổi", không tạo lượt soát xét giả, mọi việc cũ gắn `legacy`; Prisma diff sạch. Mã việc `CV-YYYY-NNNNN` cấp theo thứ tự tạo.
- **Cờ 03 → 04 → việc:** bước quy trình có `isStatutory`, `requiresDelivery` (mặc định theo cờ hạn pháp lý); bước kế hoạch chép cờ và người phê duyệt mặc định (`approverId`, sửa được khi lập kế hoạch); việc sinh ra mang số cấp, người kiểm tra/phê duyệt, cờ, hạn gốc, ngày bắt đầu dự kiến.
- **Nhóm dòng dịch vụ kế toán (H8):** bảng `service_teams` (+ thành viên, lịch sử vai); `GET/PUT /contracts/:id/services/:lineId/team` (`contracts:view` / `contracts:plan`), khoá `revision`, dòng kiểm toán → 400 (dùng nhóm 04-F), ghi lịch sử HĐ `SERVICE_TEAM_UPDATE`.
- **Hồi quy:** tiến độ dòng/HĐ, dashboard, báo cáo, chi tiết KH/HĐ đọc Hoàn thành thay Đã làm; dashboard giữ 3 khoá nhóm `TODO/IN_PROGRESS/DONE` (Chưa làm / Đang làm gồm soát xét / Hoàn thành) cho giao diện hiện tại tới 05-E. Web chỉnh tối thiểu: nhãn 8 trạng thái, nút theo vai trên bảng/kanban 3 nhóm, drawer có soát xét/trả lại/giao nộp, lịch sử trạng thái và soát xét.
- **Làm rõ khi code (không đổi quyết định đã duyệt):** nhân viên phạm vi OWN chỉ thấy việc giao cho mình nên không thấy việc mình phải kiểm tra. Cách làm: người được chỉ định kiểm tra/phê duyệt thấy việc đó **khi khách hàng nằm trong phạm vi khách hàng của họ**; ngoài phạm vi vẫn 404 (giữ F6, có e2e). Chỉ áp ở module công việc, không đổi `taskScope` chung.
- **Để lại cho bước sau:** sửa `dueDate` qua PATCH vẫn như cũ cho tới khi có đề nghị/duyệt gia hạn (05-D, H7); tạm dừng, mở lại, chờ khách, thông báo gửi kiểm tra/trả lại thuộc 05-D; sinh nhiều kỳ và phụ thuộc thuộc 05-C; hàng đợi, kanban 8 cột, giao diện nhóm dòng dịch vụ thuộc 05-E.
- Thay đổi test cũ: [05-test-policy-changes.md](05-test-policy-changes.md).

### 05-C Sinh nhiều kỳ và phụ thuộc — đã code và kiểm chứng kỹ thuật (23/10/2026)

- **Sinh mọi kỳ (H12)** — `task-periods.ts` (hàm thuần) + bộ sinh việc: dịch vụ theo tháng/quý, lập lịch theo kỳ, HĐ có ngày kết thúc → sinh số kỳ bằng số tháng/quý thời hạn HĐ phủ, bắt đầu từ kỳ của kế hoạch; kỳ của kế hoạch giữ đúng ngày đã lập, kỳ sau hạn = cuối kỳ + số ngày lệch của bước. Giữ **một kỳ** khi: dịch vụ theo năm/một lần, lập lịch theo dự án, HĐ chưa có ngày kết thúc, hoặc kỳ kế hoạch khác loại chu kỳ dịch vụ (ví dụ dịch vụ theo quý mà kế hoạch ghi tháng). Giới hạn 120 kỳ khi ngày kết thúc nhập nhầm.
- **Khoá (bước, kỳ):** migration `20261023090000_task_period_key` thay unique `plan_step_id` bằng unique (`plan_step_id`, `period`); kiểm chứng trên bản sao demo đã chuyển đổi, Prisma diff sạch. Gọi lại/đồng thời vẫn chỉ sinh một lần (khoá dòng 04-A + khoá DB).
- **Thông báo:** chỉ báo người được giao cho việc của **kỳ đầu**; kỳ sau để nhắc hạn (06) báo khi tới gần — tránh dồn hàng chục thông báo một lúc.
- **Phụ thuộc (H6)** — `task-dependencies.ts`: việc chỉ bắt đầu khi việc **cùng kỳ** của các bước nó chờ ở Đã phê duyệt/Hoàn thành; bước bỏ qua được nối thẳng tới bước nó chờ (như lập lịch 04-B); bước chờ chưa có việc (dữ liệu cũ) không chặn. Bắt đầu sớm → 400 "Chưa đủ điều kiện: bước trước chưa xong — …"; danh sách/chi tiết trả `waitingFor`, giao diện gắn nhãn "Chưa đủ điều kiện" và ẩn nút Bắt đầu.
- **Tiến độ:** kỳ hoàn tất khi mọi việc **bắt buộc** của kỳ Hoàn thành (kỳ chỉ có việc tuỳ chọn thì xét mọi việc); dòng hoàn thành khi mọi kỳ hoàn tất; HĐ như 04. `GET /contracts/:id/plans` trả `periods` cho từng dòng; tab kế hoạch HĐ hiện tiến độ theo kỳ và "x/y kỳ hoàn thành" cho từng bước.
- Việc sinh từ kế hoạch có dòng lịch sử đầu "Sinh từ kế hoạch thực hiện".
- **Chưa làm (ngoài 05-C):** phụ lục gia hạn ngày kết thúc HĐ chưa tự sinh thêm kỳ; chờ hồ sơ khách (H4) thuộc 05-D.

### 05-D Hồ sơ, chờ khách, gia hạn, tạm dừng/mở lại — đã code và kiểm chứng kỹ thuật (23/10/2026)

- **Schema** (migration `20261023150000_task_follow_up`): `customer_document_requests` (+ lịch sử trạng thái, file gắn kho 02), `task_client_waits`, `task_due_changes`. Hạn gốc của việc không đổi.
- **Hồ sơ yêu cầu (PL1 V, H4):** sinh cùng lúc sinh việc từ hồ sơ yêu cầu của kế hoạch — "theo kỳ" mỗi kỳ một bản, "một lần" một bản (áp mọi kỳ). 6 trạng thái: Chưa yêu cầu → Đã yêu cầu (ngày, cách gửi, hạn khách gửi) → Khách đã tải lên (nhân viên tải thay, file vào kho hồ sơ 02) → Đang kiểm tra → Cần bổ sung (bắt buộc nội dung) / Đã chấp nhận. API `/customer-document-requests` (xem `tasks:view`, thao tác `tasks:update`, phạm vi theo khách hàng); đổi trạng thái có điều kiện (bấm đồng thời → 409), lịch sử không sửa/xoá. Tải lên **không** tự hoàn tất việc.
- **Chờ khách tự động (H4):** việc của bước có hồ sơ bắt buộc (cùng kỳ, hoặc hồ sơ một lần) vào **Chờ khách** ngay khi sinh, mở khoảng chờ tự động; hồ sơ được **chấp nhận** đủ thì việc tự về trạng thái trước khi chờ và báo người làm. **Cần bổ sung** đưa việc chưa nộp soát xét (Chưa bắt đầu/Đang thực hiện/Yêu cầu chỉnh sửa) về Chờ khách. Bắt đầu việc còn thiếu hồ sơ → 400 kèm danh sách.
- **Chờ khách tay:** người làm chuyển việc Chưa bắt đầu/Đang thực hiện sang Chờ khách, bắt buộc chọn hồ sơ có sẵn hoặc tạo hồ sơ mới gửi khách (tạo ở Đã yêu cầu, **không bắt buộc** để người làm tự tiếp tục khi xong — chấp nhận hồ sơ đó cũng tự mở lại việc). Tiếp tục: người làm hoặc người quản lý việc, khi không còn hồ sơ bắt buộc thiếu.
- **Khoảng chờ (G5):** trưởng nhóm của dòng (H8) hoặc người quản lý việc **xác nhận** khoảng chờ đã kết thúc; số ngày chờ đã xác nhận tính theo ngày lịch giờ VN, các khoảng chồng nhau không đếm trùng (`confirmedWaitDays`, trả ở chi tiết việc cho báo cáo 10). Không đổi hạn hiển thị.
- **Tạm dừng/tiếp tục (H5):** người quản lý việc, lý do 5–500 ký tự, mọi trạng thái trừ Hoàn thành; tiếp tục về trạng thái trước. Tạm dừng đóng khoảng chờ đang mở (không trừ hạn), tiếp tục về Chờ khách thì mở khoảng chờ mới.
- **Mở lại:** người quản lý việc, lý do bắt buộc; Hoàn thành → Đang thực hiện, giữ mốc nộp đầu/chấp nhận, đếm `reopenCount`, đưa dòng/HĐ về Đang thực hiện.
- **Gia hạn (H7, G3):** người làm, trưởng nhóm của dòng hoặc người quản lý việc đề nghị (hạn mới sau hạn hiện hành, lý do 5–500); mỗi việc tối đa một đề nghị chờ duyệt (409). Người quản lý việc duyệt/từ chối, **không tự duyệt đề nghị của mình**; duyệt thì đổi hạn hiện hành có điều kiện (409 nếu hạn đã đổi). Hạn pháp lý: không đề nghị được; Giám đốc (`contracts:approve`) ghi nhận **gia hạn theo văn bản** (áp ngay, đếm riêng). `PATCH /tasks/:id` không đổi hạn nữa (400 — phải qua đề nghị).
- **Thông báo** (cơ chế sẵn có, sự kiện `task.notify`, không báo cho chính người thao tác): gửi kiểm tra → người kiểm tra; lên cấp → người phê duyệt; trả lại (kèm nội dung) / phê duyệt → người làm; khách nộp hồ sơ, cần bổ sung, đủ hồ sơ → người làm; đề nghị gia hạn → Manager của dòng; quyết định gia hạn → người đề nghị; tạm dừng/tiếp tục/mở lại → người làm.
- **Giao diện tối thiểu** trong chi tiết việc: khối "Hồ sơ cần thu của khách" (thao tác theo trạng thái, tải thay khách), khối "Theo dõi" (chờ khách/tiếp tục, tạm dừng/tiếp tục/mở lại có lý do, đề nghị/duyệt gia hạn, khoảng chờ và xác nhận). Màn hình hồ sơ theo KH/HĐ, hàng đợi soát xét, kanban 8 cột thuộc 05-E.
- **Làm rõ khi code:** khoảng chờ tự động của các kỳ sau bắt đầu từ lúc sinh việc; chỉ khoảng **đã xác nhận** mới dùng để đánh giá nên không ảnh hưởng tỷ lệ. Việc không có nhóm dòng dịch vụ thì đề nghị gia hạn không gửi thông báo (người quản lý việc xem trong chi tiết việc).
- Test: không đổi test cũ; thêm `tasks-follow-up.e2e-spec.ts` (7), `document-request.rules.spec.ts` (5), 1 test H4 trong `task-status.rules.spec.ts`.

### 05-E Giao diện và nghiệm thu — đã code và kiểm chứng kỹ thuật (23/10/2026)

- **Việc của tôi** (`/tasks/my`, API `GET /tasks/my?tab=today|upcoming|overdue|done`): 4 tab kèm số đếm; mỗi dòng KH, tên việc (kỳ), hạn (nhãn PL), trạng thái (+ "Chưa đủ điều kiện"), ưu tiên, nút hành động theo trạng thái. Sắp đến hạn = sau hôm nay đến 7 ngày; Đã hoàn thành sắp theo ngày hoàn thành.
- **Chờ tôi kiểm tra / phê duyệt** (tab thứ 5, `GET /tasks/review-queue`): cấp, người làm, **số ngày làm việc đã chờ** từ lúc vào cấp (thứ 2–6, giờ VN), nhãn **Quá SLA** khi > 2 ngày làm việc (G7); lâu nhất trước.
- **Danh sách/kanban** (`/tasks`): thêm lọc ưu tiên, người kiểm tra/phê duyệt, hạn pháp lý (cùng KH, trạng thái, hạn, thiếu bằng chứng, tìm kiếm sẵn có; HĐ/dòng/kỳ qua tham số API); kanban **8 cột**, người làm **kéo thả** thẻ sang đúng cột của thao tác hợp lệ (bắt đầu, gửi kiểm tra, hoàn thành) — cột khác không nhận; soát xét, chờ khách, tạm dừng làm trong chi tiết việc. **Giao lại hàng loạt** (`POST /tasks/reassign`, tối đa 200): chọn nhiều dòng trên bảng; từng việc kiểm quyền người quản lý việc (R2), việc đã hoàn thành/không đủ quyền bỏ qua kèm lý do; người mới nhận thông báo. Ô đếm thêm "Chờ kiểm tra" và "Chờ khách hàng" (đọc trạng thái mới).
- **Chi tiết việc**: thêm **bình luận** (`POST /tasks/:id/comments`; ai xem được việc thì bình luận; chỉ thêm; báo người làm/kiểm tra/phê duyệt; không @nhắc tên — H11).
- **Hồ sơ khách hàng** (`/tasks/documents`): danh sách hồ sơ cần thu lọc theo khách hàng, trạng thái, kỳ; cùng thao tác như trong chi tiết việc.
- Tab Quy trình & Công việc của HĐ đọc 8 trạng thái và tiến độ theo kỳ (05-B/05-C). 375px: trang không tràn ngang, bảng/kanban cuộn trong khối.
- Dashboard (10): giữ 3 nhóm Chưa làm / Đang làm (gồm soát xét) / Hoàn thành; không đổi công thức tiền.
- Schema: migration `20261023180000_task_comments`.
- Biên bản: [05-tasks-acceptance.md](05-tasks-acceptance.md).
