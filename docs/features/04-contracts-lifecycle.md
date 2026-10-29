# 04 — Hợp đồng: duyệt, kế hoạch thực hiện, hồ sơ thương mại và vòng đời

Ngày 16/10/2026. **Đã được người dùng duyệt trong chat: “Tôi nghiệm thu 03 và duyệt đặc tả 04 với phương án đề xuất E1–E6 cùng phạm vi sửa ngoài module đã liệt kê. Bắt đầu code 04-A.”**

Căn cứ: YC04, YC08, YC09 (lưu nguồn), YC10 (phần kế hoạch) trong [phạm vi](../requirements/scope-and-traceability.md); G §3.3; C6–C9; PL1 III.1, VII.3, VIII.2; QD05, QD06, QD07, QD13 trong [sổ quyết định](../requirements/decision-register.md); [review 15/10](../planning/review-2026-10-15.md) mục 4.4; [biên bản 03](03-service-catalog-acceptance.md) mục Giới hạn. Quyền kế thừa [ma trận 01](01-users-access-control.md). [Đặc tả demo 04](04-contracts.md) chỉ dùng đối chiếu; phần thu tiền/hoá đơn trong đó thuộc 07/08.

## Phạm vi

- **Trong phạm vi:** module `contracts` (backend, frontend), schema/migration/seed hợp đồng, kế hoạch thực hiện, mẫu hồ sơ thương mại, gia hạn; test tương ứng.
- **Phạm vi ngoài module đã được duyệt cùng đặc tả (ngoài danh sách này phải xin thêm):**
  - `tasks/task-generator.ts`, `tasks/tasks.service.ts` và test: sinh việc từ **kế hoạch đã xác nhận** thay vì đọc thẳng quy trình (E1); thêm cột `plan_step_id` (unique) vào `tasks` để chống sinh trùng ở mức DB. Không đổi trạng thái, duyệt việc (thuộc 05).
  - `core/access-control/permissions.ts`: thêm hành động `contracts:plan` (E2).
  - `documents`: dùng lại kho hồ sơ 02 để lưu file sinh từ mẫu và bản scan đã ký (nhóm Hợp đồng); không đổi quy tắc file/preview.
  - `service-catalog`: chỉ đọc phiên bản quy trình và báo giá qua hàm/API sẵn có; không sửa.
- **Ngoài phạm vi:** 8 trạng thái/soát xét/hồ sơ theo việc (05); nhắc hạn qua email/app (06); thu tiền, công nợ, đề nghị thanh toán có QR (07); hoá đơn (08); tính hoa hồng (QD06, 07/10); giá riêng theo khách (QD13 — chờ đầu vào, xem 04-E); sửa khung menu 375px (00, phiên riêng).
- **Đầu vào còn thiếu:** QD07 mẫu Word báo giá/HĐ/phụ lục/nghiệm thu/thanh lý/đề nghị thanh toán; QD06 công thức hoa hồng; QD13 cách định giá riêng. Gói này làm cơ chế, thử bằng mẫu giả.

## Quyết định đã duyệt cùng đặc tả

Người dùng duyệt ngày 16/10/2026 theo cột "Đề xuất".

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| E1 | Khi nào sinh việc? (QD05: hiện sinh ngay khi duyệt; PL1 III.1 yêu cầu quản lý rà/xác nhận quy trình) | Sinh việc khi **cả hai** điều kiện đạt: giám đốc đã duyệt HĐ **và** kế hoạch thực hiện của dòng dịch vụ đã được xác nhận. Mỗi dòng dịch vụ xác nhận độc lập | Giữ như hiện nay: sinh ngay khi duyệt từ quy trình mặc định, chỉnh sau trong 05 |
| E2 | Ai xác nhận kế hoạch? | Quyền mới `contracts:plan`: trưởng nhóm/KTT trong phạm vi nhóm và giám đốc; nhân viên và kế toán thu tiền không có | Chỉ giám đốc |
| E3 | Duyệt thẳng từ Nháp? (hiện cho phép) | Chỉ duyệt từ **Chờ duyệt**; giám đốc tự tạo HĐ vẫn phải bấm "Gửi duyệt" rồi "Duyệt". Có nút **Trả lại** kèm lý do (về Nháp) | Giữ cho duyệt từ Nháp |
| E4 | Xuất mẫu hồ sơ dạng gì? | Sinh **DOCX** từ mẫu Word có trường trộn (`docx-templates`), lưu vào kho hồ sơ. **PDF** để giai đoạn B (cần LibreOffice/Gotenberg chạy kèm Docker) | Làm cả PDF ngay ở 04 (thêm hạ tầng) |
| E5 | Người bán/giới thiệu (QD06 chưa có công thức) | Lưu **người phụ trách kinh doanh** (tài khoản nội bộ) và **người giới thiệu** (tên, điện thoại, ghi chú) trên HĐ; chưa tính tiền hoa hồng | Hoãn toàn bộ tới khi có QD06 |
| E6 | Sửa HĐ đã duyệt | Sau duyệt không sửa trực tiếp tiền/dịch vụ; thay đổi qua **phụ lục** (bản ghi riêng: nội dung, thêm/bớt dòng dịch vụ, chênh lệch tiền), cần giám đốc duyệt; giữ lịch sử. Thông tin không ảnh hưởng tiền (ghi chú, ngày ký, người phụ trách) sửa được, có audit | Cho sửa trực tiếp kèm audit |

## 04-A — Trạng thái và duyệt an toàn

- Luồng: Nháp → Chờ duyệt → (Duyệt) Chưa thực hiện → Đang thực hiện → Đã hoàn thành → Thanh lý; Huỷ từ Nháp/Chờ duyệt/Chưa thực hiện/Đang thực hiện. **Trả lại** Chờ duyệt → Nháp với lý do (E3).
- Gửi duyệt kiểm tra: có ít nhất một dòng dịch vụ, dịch vụ đang dùng, tổng đợt thanh toán = tổng HĐ, ngày hợp lệ.
- Duyệt **nguyên tử**: cập nhật có điều kiện trạng thái (bấm hai lần/đồng thời chỉ một lần thành công, lần sau 409); lưu người/thời điểm duyệt; audit `APPROVE`. Không phát sự kiện sinh việc trực tiếp nữa (E1).
- Sửa lỗi review 4.4: lỗi sinh việc không bị nuốt im lặng — trạng thái sinh việc của từng dòng (chưa sinh/đã sinh/lỗi + thông báo) hiển thị trên HĐ và có nút **Sinh lại** an toàn.
- Hộp xác nhận Duyệt/Huỷ/Trả lại dùng modal giữa màn hình (popconfirm hiện tràn ở màn hẹp).

## 04-B — Kế hoạch thực hiện theo quy trình (PL1 III.1, QD05)

- Mỗi dòng dịch vụ có **kế hoạch**: chọn phiên bản quy trình (mặc định = phiên bản đang hiệu lực của quy trình mặc định; được chọn quy trình khác cùng dịch vụ), ngày bắt đầu, kỳ (theo kỳ).
- Kế hoạch chép (snapshot) các bước của phiên bản vào `contract_service_plan_steps`: tên, giai đoạn, thời lượng/hạn, phụ thuộc, cần bằng chứng, số cấp duyệt, **người thực hiện** và **người kiểm tra** đề xuất. Thứ tự gợi ý người thực hiện: người mặc định của bước (nếu còn hoạt động) → người phụ trách dòng dịch vụ → người phụ trách HĐ → người phụ trách KH. Người mặc định đã nghỉ thì cảnh báo trên màn hình rà soát.
- Người có `contracts:plan` rà soát: đổi người, đổi thời lượng/hạn, bỏ bước **tuỳ chọn** (bước bắt buộc không bỏ được), xem trước lịch (dùng hàm lập lịch 03). Sau đó **Xác nhận kế hoạch** (khoá kế hoạch, ghi người/thời điểm, audit).
- Khi HĐ đã duyệt và kế hoạch đã xác nhận (E1): sinh việc từ các bước kế hoạch, mỗi bước một việc, `plan_step_id` unique nên gọi lại/đồng thời không sinh trùng. Việc giữ liên kết bước → phiên bản gốc (PL1 VIII.2). Sửa quy trình mẫu sau đó không ảnh hưởng kế hoạch đã chốt.
- Dịch vụ chưa có quy trình đang hiệu lực: không xác nhận được kế hoạch, báo rõ cần phát hành quy trình ở 03.
- Hồ sơ yêu cầu (03-C) của phiên bản được chép vào kế hoạch để 05 sinh danh sách hồ sơ cho KH; 04 chỉ hiển thị.

## 04-C — Hồ sơ thương mại và mẫu Word (C7, C8, G §3.3)

- Quản lý **mẫu** theo loại: Báo giá, Hợp đồng, Phụ lục, Biên bản nghiệm thu, Biên bản thanh lý, Đề nghị thanh toán. Mẫu là file `.docx` có trường trộn (danh sách trường công bố: thông tin công ty, KH, HĐ, dòng dịch vụ, đợt thanh toán, tổng tiền bằng số và chữ). Tải mẫu lên/thay phiên bản/ngừng dùng; chỉ giám đốc (quyền cài đặt mẫu).
- Trên HĐ: **Tạo hồ sơ** từ mẫu → DOCX lưu vào kho hồ sơ của KH, nhóm Hợp đồng, gắn HĐ, có phiên bản (dùng 02). PDF theo E4.
- **Bản scan đã ký**: tải lên vào cùng nhóm, đánh dấu "bản đã ký"; xem trước PDF/ảnh theo 02.
- Báo giá có thể tạo cho HĐ ở trạng thái Nháp (trước ký). Truy cập từ KH360 theo C7 (tab hồ sơ HĐ của KH).
- Chặn trường trộn không có trong danh sách; file mẫu kiểm tra như 02 (không macro, giới hạn dung lượng).

## 04-D — Vòng đời và thông tin kinh doanh

- **Phụ lục** theo E6: tạo phụ lục (Nháp → Chờ duyệt → Đã duyệt), thêm/bớt dòng dịch vụ hoặc đổi giá; khi duyệt, cập nhật tổng tiền và đợt thanh toán theo phụ lục, giữ lịch sử trước–sau; dòng dịch vụ mới đi qua 04-B. Dòng đã có việc đang làm không xoá được.
- **Gia hạn/tái ký**: "Tạo HĐ năm sau" sao chép KH, dòng dịch vụ (kỳ dời sang năm sau), người phụ trách, điều khoản; HĐ mới ở Nháp, liên kết HĐ cũ. Danh sách **HĐ sắp hết hạn** trong N ngày (mặc định 30, tham số để 11 hoàn thiện) và tỷ lệ tái ký để 10 dùng.
- **Huỷ HĐ đã có việc**: bắt buộc lý do; việc chưa bắt đầu chuyển trạng thái huỷ theo 05 (04 phát sự kiện, không tự xoá việc); việc đã làm giữ nguyên lịch sử.
- **Người phụ trách kinh doanh và người giới thiệu** theo E5; lọc/báo cáo nguồn ở 10.
- **Chi tiết HĐ theo PL1 VII.3**: tab Tổng quan | Quy trình & Công việc (kế hoạch theo giai đoạn thu gọn/mở rộng, % tiến độ) | Hồ sơ | Thanh toán & Hoá đơn (dữ liệu hiện có, ẩn với người thiếu quyền tài chính) | Lịch sử (audit HĐ, phụ lục, duyệt).

## 04-E — Gợi ý giá

- Form HĐ gợi ý đơn giá từ báo giá 03 (bảng giá theo ngày bắt đầu và giá trị tiêu chí nhập trên dòng); người lập vẫn sửa được; lưu đơn giá vào dòng HĐ như hiện nay.
- **Giá riêng theo khách (QD13)**: chỉ triển khai khi chị Hà cho biết cách định giá; khi đó báo giá ưu tiên giá riêng → bảng giá chung → giá chuẩn. Trước đó ghi "chờ QD13", không tự đoán mô hình.

## 04-F — Theo dõi hợp đồng kiểm toán và đánh giá đúng hạn

Đặc tả riêng: [04-audit-engagement-tracking.md](04-audit-engagement-tracking.md) (người dùng duyệt cùng F1–F11 ngày 22/10/2026).

## Dữ liệu và migration (dự kiến)

| Bảng/cột | Nội dung |
| --- | --- |
| `contracts` | thêm `sales_owner_id`, `referrer_name/phone/note`, `renewed_from_id`, `returned_reason`, `cancel_reason` |
| `contract_service_plans` | dòng dịch vụ, phiên bản quy trình, ngày bắt đầu/kỳ, trạng thái (nháp/đã xác nhận), người/thời điểm xác nhận, trạng thái sinh việc + lỗi |
| `contract_service_plan_steps` | snapshot bước, người thực hiện/kiểm tra, bỏ qua (tuỳ chọn), phụ thuộc theo khoá bước, liên kết bước gốc |
| `contract_amendments` (+ dòng) | phụ lục, trạng thái, nội dung trước–sau, người duyệt |
| `document_templates` | loại, tên, file mẫu (kho lưu trữ), phiên bản, đang dùng |
| `tasks.plan_step_id` | unique, liên kết việc ↔ bước kế hoạch |

Migration với HĐ cũ: HĐ đã duyệt và dòng dịch vụ đã có việc → tạo kế hoạch trạng thái "đã xác nhận (chuyển đổi)" theo phiên bản đang hiệu lực, **không** sinh việc mới, không gắn `plan_step_id` cho việc cũ (giữ nguyên). HĐ Nháp/Chờ duyệt → kế hoạch nháp. Kiểm chứng trên DB trống và bản sao có dữ liệu.

## Phân kỳ triển khai

1. Duyệt đặc tả và E1–E6 → 04-A (duyệt an toàn, trả lại, trạng thái sinh việc).
2. 04-B kế hoạch thực hiện và sinh việc từ kế hoạch (sửa `tasks` trong phạm vi xin ở trên).
3. 04-C mẫu Word và hồ sơ thương mại (cần thêm thư viện `docx-templates`).
4. 04-D phụ lục, gia hạn, huỷ, thông tin kinh doanh, tab chi tiết HĐ.
5. 04-E gợi ý giá; giá riêng khi có QD13. Kiểm chứng toàn bộ và biên bản `04-contracts-acceptance.md`.

Thay đổi test cũ (dự kiến): test e2e/unit đang kỳ vọng sinh việc ngay khi duyệt (`tasks.e2e`, `workflow-templates.e2e`, `contracts-command.service.spec`) và test duyệt từ Nháp sẽ đổi theo E1/E3 — ghi vào `04-test-policy-changes.md`, giữ kiểm chứng tương đương (sinh việc đúng, không trùng).

## Tiêu chí nghiệm thu

1. Chỉ giám đốc duyệt; duyệt từ Chờ duyệt, đồng thời chỉ một lần; trả lại có lý do; nhân viên/thu tiền/quản trị 403 với duyệt, kế hoạch, mẫu; nhân viên không thấy tiền trên mọi tab/API mới.
2. Kế hoạch lấy đúng phiên bản đang hiệu lực, gợi ý người đúng thứ tự, không bỏ được bước bắt buộc; xác nhận khoá kế hoạch; sửa quy trình sau đó không đổi kế hoạch.
3. Sinh việc chỉ khi đã duyệt + đã xác nhận; gọi lại/đồng thời không trùng (ràng buộc DB); lỗi sinh việc hiển thị và sinh lại được.
4. Tạo DOCX từ mẫu đúng trường trộn (tiền bằng chữ đúng), lưu kho hồ sơ có phiên bản; scan đã ký xem trước được; trường không hợp lệ bị chặn.
5. Phụ lục duyệt cập nhật tổng tiền/đợt đúng (Decimal), giữ lịch sử; không xoá dòng có việc đang làm; gia hạn tạo HĐ năm sau đúng kỳ; danh sách sắp hết hạn đúng ngày.
6. Migration HĐ cũ không sinh việc mới, không mất việc/lịch sử; Prisma diff sạch.
7. Lint/unit/e2e/build/max-lines đạt; e2e phân quyền cho mọi API mới; giao diện desktop/375px cho luồng tạo HĐ → gửi duyệt → duyệt → rà kế hoạch → xác nhận → thấy việc → tạo DOCX → phụ lục → gia hạn.
8. Không ghi đã có mẫu Word thật, công thức hoa hồng hay giá riêng khi chưa có QD07/QD06/QD13.

## Tiến độ triển khai

### 04-A — Trạng thái và duyệt an toàn (đã code và kiểm chứng kỹ thuật ngày 16/10/2026)

- Gửi duyệt kiểm tra có dòng dịch vụ, dịch vụ còn cung cấp, tổng đợt = tổng HĐ. Duyệt chỉ từ Chờ duyệt, cập nhật có điều kiện; lần bấm sau (đồng thời hoặc sau khi đã duyệt) trả 409, chỉ một bản ghi `APPROVE`. Trả lại (`POST /contracts/:id/return`, quyền `contracts:approve`) lưu lý do 5–500 ký tự, ghi `RETURN`. Gửi duyệt ghi `SUBMIT`.
- Mỗi dòng dịch vụ có trạng thái sinh việc (Chưa sinh/Đang sinh/Đã sinh/Bỏ qua/Lỗi + thông báo). Bộ sinh việc khoá từng dòng bằng cập nhật có điều kiện (dòng "Đang sinh" quá 10 phút được nhận lại), sinh trong transaction; lỗi một dòng không chặn dòng khác. `POST /contracts/:id/generate-tasks` (quyền `contracts:update`) sinh lại cho dòng chưa sinh/bỏ qua/lỗi của HĐ đã duyệt; gọi đồng thời không sinh trùng.
- **Thứ tự triển khai E1:** trong 04-A việc vẫn sinh ngay khi duyệt (như trước) nhưng có trạng thái và sinh lại; điểm chuyển sang "chỉ sinh sau khi xác nhận kế hoạch" đã làm ở 04-B (xem dưới).
- Giao diện: nút Duyệt chỉ ở Chờ duyệt; nút Trả lại với hộp nhập lý do; cảnh báo lý do khi HĐ ở Nháp; cột "Sinh việc" và nút "Sinh lại việc"; xác nhận Duyệt/chuyển trạng thái bằng modal giữa màn hình (bỏ popconfirm tràn màn hẹp). Chuỗi mới trong `contracts.text.ts`.
- Migration `20261016030000_contract_approval_generation`: dòng đã có việc → Đã sinh; dòng còn lại Chưa sinh. Thay đổi test: [giải trình](04-test-policy-changes.md).

### 04-B — Kế hoạch thực hiện (đã code và kiểm chứng kỹ thuật ngày 16/10/2026)

- Bảng `contract_service_plans` (một kế hoạch/dòng, Nháp/Đã xác nhận, `revision`), `contract_plan_steps` (chép bước: giai đoạn, thời lượng/hạn, phụ thuộc, bằng chứng, cấp duyệt, người thực hiện/kiểm tra, ngày bắt đầu/hạn, bỏ qua), `contract_plan_requirements` (chép hồ sơ yêu cầu 03-C). `tasks.plan_step_id` unique. Migration `20261016040000_contract_service_plans`: dòng đã có việc được gắn kế hoạch "Đã xác nhận" không bước (ghi chú chuyển đổi) để không sinh lại.
- API: `GET /contracts/:id/plans` (`contracts:view`); `POST /contracts/:id/services/:lineId/plan`, `PUT /contract-plans/:planId`, `POST .../confirm`, `POST .../reopen` (`contracts:plan` — Giám đốc, Kế toán trưởng theo E2). Lập kế hoạch: phiên bản đang hiệu lực của quy trình mặc định hoặc phiên bản đã phát hành khác của cùng dịch vụ; gợi ý người theo thứ tự đặc tả. Sửa: đổi người, thời lượng/hạn, bỏ bước tuỳ chọn (bước sau nối thẳng, lịch tính lại theo ngày làm việc); kiểm tra `revision` → 409. Xác nhận: có điều kiện Nháp → Đã xác nhận, ghi `PLAN_CONFIRM`; HĐ đã duyệt thì sinh việc ngay. Mở lại chỉ khi dòng chưa có việc.
- Sinh việc (E1): chỉ dòng có kế hoạch đã xác nhận của HĐ đã duyệt; mỗi bước không bỏ qua một việc, hạn/người lấy từ kế hoạch, gắn `plan_step_id`. Dòng chưa xác nhận ghi "Chờ xác nhận kế hoạch thực hiện"; "Sinh lại việc" chỉ hiện/chạy khi có dòng đã xác nhận. Duyệt HĐ nay chờ sinh việc xong rồi mới trả kết quả.
- Giao diện: khối "Kế hoạch thực hiện" ở trang chi tiết HĐ — chọn quy trình, bảng bước (sửa thời lượng/hạn, người thực hiện, bỏ bước tuỳ chọn), lưu, xác nhận qua modal, lập lại từ quy trình, mở lại; danh sách hồ sơ cần thu. Seed demo lập và xác nhận kế hoạch mặc định trước khi sinh việc.
- **Bổ sung cùng ngày:** cảnh báo trên bảng bước khi người thực hiện/kiểm tra mặc định của bước quy trình đã nghỉ (chỉ khi kế hoạch còn nháp; người được đề xuất thay theo thứ tự đặc tả); `POST /contract-plans/:planId/preview` (`contracts:plan`) trả lịch khi áp thay đổi chưa lưu, không ghi DB — giao diện xin lịch sau mỗi thay đổi và tô xanh ngày bị dời; ô người kiểm tra, ngày bắt đầu (lịch theo dự án), kỳ (lịch theo kỳ), ghi chú và nút "Bỏ thay đổi"; danh sách chọn người bỏ tài khoản quản trị.

### 04-C — Hồ sơ thương mại và mẫu Word (đã code và kiểm chứng kỹ thuật ngày 16/10/2026)

- Bảng `document_templates` + `document_template_versions` (loại: Báo giá, Hợp đồng, Phụ lục, Biên bản nghiệm thu, Biên bản thanh lý, Đề nghị thanh toán; tên, mô tả, đang dùng, phiên bản, trường dùng) và `contract_documents` (gắn tài liệu trong kho 02 với HĐ: loại, nguồn Sinh từ mẫu/Bản đã ký, mẫu và phiên bản mẫu dùng lần gần nhất). Migration `20261016050000_contract_document_templates` chỉ thêm bảng; không đổi bảng `documents` (Prisma thêm quan hệ ngược ở `customers.prisma`, không sinh SQL).
- Trường trộn viết `{{customer.name}}`; bảng lặp `{{FOR item IN services}}…{{END-FOR item}}` (danh sách `services`, `installments`). Danh sách công bố: công ty, KH, HĐ, ngày lập, dòng dịch vụ, đợt thanh toán, tiền bằng số (`13.200.000`) và chữ (`Mười ba triệu hai trăm nghìn đồng`, hàm `vndInWords` trong `common/utils`). Mẫu bị chặn khi có trường/lệnh ngoài danh sách (IF, EXEC, biểu thức JS…), vòng lặp không đóng, file không phải .docx, có macro/đối tượng nhúng hoặc quá 20 MB (dùng lại kiểm tra file của 02). Khi trộn không chạy JavaScript trong mẫu (chỉ tra đường dẫn trường); dữ liệu người dùng nhập được thoát XML.
- **Thông tin công ty** tạm đọc từ biến môi trường `COMPANY_*` (`.env.example`); 11 chuyển sang màn hình Cài đặt.
- **Quyền:** quản lý mẫu (tải lên, thay file, ngừng/dùng lại, lịch sử, tải mẫu ví dụ) dùng `contracts:approve` — chỉ Giám đốc trong vai trò gốc; không thêm quyền mới. Xem danh sách mẫu/trường: `contracts:view`. Tạo hồ sơ: `contracts:update` + `documents:create` + quyền xem tài chính (hồ sơ có số tiền). Tải bản scan đã ký: `contracts:update` + `documents:create`, chỉ PDF/PNG/JPEG. Danh sách hồ sơ của HĐ: `contracts:view` theo phạm vi HĐ.
- **Trạng thái HĐ:** báo giá và hợp đồng (dự thảo) tạo được từ Nháp/Chờ duyệt trở đi; phụ lục, nghiệm thu, thanh lý, đề nghị thanh toán chỉ sau khi HĐ đã duyệt; HĐ huỷ không tạo hồ sơ.
- Hồ sơ sinh ra lưu vào kho hồ sơ của KH (02), nhóm Hợp đồng, gắn HĐ, tên `<Loại> <Số HĐ>.docx`; chọn "Phiên bản mới của …" để thêm phiên bản thay vì tạo hồ sơ mới. Bản scan đã ký cũng vậy, xem trước bằng trình xem PDF/ảnh của 02. Ghi audit `TEMPLATE_UPLOAD`, `TEMPLATE_VERSION`, `TEMPLATE_UPDATE` (trước–sau), `GENERATE_DOCUMENT`, `UPLOAD_SIGNED_DOCUMENT`.
- API: `GET/POST /document-templates`, `GET /document-templates/fields`, `GET /document-templates/samples/:type/download`, `PATCH /document-templates/:id`, `GET/POST /document-templates/:id/versions`, `GET /document-templates/:id/versions/:version/download`; `GET /contracts/:id/documents`, `POST /contracts/:id/documents/generate`, `POST /contracts/:id/documents/signed`.
- Giao diện: trang **Mẫu hồ sơ** (`/contracts/templates`, nút ở danh sách HĐ cho người có quyền): tải mẫu, lọc loại, thay file, ngừng/dùng lại, lịch sử phiên bản, tải mẫu ví dụ, danh sách trường trộn. Trang chi tiết HĐ có khối **Hồ sơ thương mại**: chọn mẫu hợp lệ theo trạng thái HĐ, tạo hồ sơ mới hoặc phiên bản mới, tải bản đã ký, tải về/xem trước. KH360 truy cập qua tab Hồ sơ (lọc nhóm Hợp đồng/HĐ) như 02.
- Seed tạo 6 **mẫu ví dụ** (ghi rõ là mẫu giả, chưa phải mẫu QD07); chạy lại không tạo trùng.
- **Giới hạn/điểm cần chốt:** chưa có mẫu Word thật (QD07) và chưa làm PDF (E4, giai đoạn B). Hồ sơ HĐ nằm trong kho hồ sơ 02 nên nhân viên được phân công KH vẫn tải được file (đã như vậy với bản scan HĐ tải tay ở 02), dù màn hình/API mới không trả số tiền — người dùng quyết định ngày 16/10/2026: **giữ quy tắc kho hồ sơ như 02** (nhân viên được phân công KH vẫn tải được hồ sơ HĐ).

### 04-D — Vòng đời và thông tin kinh doanh (đã code và kiểm chứng kỹ thuật ngày 16/10/2026)

- **Thông tin kinh doanh (E5):** `contracts.sales_owner_id` (tài khoản nội bộ, kiểm tra còn hoạt động ở service — không khoá ngoại sang module users để không sửa `users.prisma`), `referrer_name/phone/note`. Nhập ở form tạo/sửa HĐ nháp; sau duyệt sửa qua `PATCH /contracts/:id/business-info` (`contracts:update`) cùng người phụ trách, ngày ký, ghi chú — không nhận trường tiền (400), HĐ huỷ không sửa; audit `UPDATE_INFO` ghi tên trường và trước–sau. Chưa tính hoa hồng (QD06).
- **Phụ lục (E6):** bảng `contract_amendments` (PL-01, PL-02… theo HĐ; Nháp → Chờ duyệt → Đã duyệt/Huỷ; tổng tiền sau phụ lục; lịch đợt sau phụ lục; ảnh trước–sau) và `contract_amendment_lines` (Thêm/Sửa số lượng–đơn giá–diễn giải/Bỏ dòng). Lập/sửa/gửi/huỷ: `contracts:update`; duyệt/trả lại (lý do 5–500 ký tự): `contracts:approve`. Chỉ lập cho HĐ Chưa thực hiện/Đang thực hiện/Đã hoàn thành. Tiền tính bằng Decimal; lịch thanh toán không gửi thì hệ thống đề xuất: tăng tiền thêm một đợt "Bổ sung theo PL-xx" (hạn = ngày hiệu lực hoặc +30 ngày), giảm tiền trừ vào phần chưa thu của các đợt cuối; đợt đã thu không bỏ/giảm dưới số đã thu. Khi duyệt: khoá HĐ, tính lại, áp dòng/đợt/tổng trong một transaction, phiếu thu giữ liên kết đợt; bấm đồng thời chỉ một lần thành công (409). Phụ lục lập trên số liệu cũ (HĐ đã đổi dòng/đợt sau khi lập — "dấu" trạng thái `base_fingerprint`) không gửi/duyệt được (409), phải cập nhật lại. Dòng mới ở trạng thái Chưa sinh việc và đi qua kế hoạch 04-B. API dưới `/contracts/:id/amendments` để bộ lọc tài chính ẩn tiền với người không có quyền.
- **Quyết định khi triển khai (cần người dùng biết):** phụ lục **không bỏ được dòng đã có công việc** (kể cả việc chưa bắt đầu) vì 05 chưa có trạng thái huỷ việc — chặt hơn đặc tả ("dòng có việc đang làm"); 05 sẽ nới khi có huỷ việc. Đổi giá/số lượng dòng có việc vẫn được. Giao diện chưa sửa tay lịch đợt của phụ lục (dùng lịch đề xuất); API đã nhận lịch tuỳ chỉnh.
- **Gia hạn/tái ký:** `POST /contracts/:id/renew` (`contracts:create`) cho HĐ đã duyệt (kể cả đã thanh lý): HĐ mới ở Nháp, chép KH, dòng dịch vụ (kỳ YYYY/YYYY-MM/YYYY-Qn +1 năm), đơn giá hiện hành (đã gồm phụ lục), người phụ trách/kinh doanh còn hoạt động, người giới thiệu, ghi chú; ngày bắt đầu/kết thúc và hạn đợt +1 năm (29/02 → 28/02); `renewed_from_id` trỏ HĐ gốc. Mỗi HĐ gốc chỉ một HĐ tái ký còn hiệu lực (unique một phần trên DB, bấm đồng thời 201/409); huỷ HĐ tái ký thì tái ký lại được. Audit `RENEW`.
- **Sắp hết hạn và tỷ lệ tái ký:** `GET /contracts/expiring?days=30` (1–365, mặc định 30; 11 đưa vào Cài đặt) — HĐ Chưa thực hiện/Đang thực hiện/Đã hoàn thành hết hạn từ hôm nay (giờ Việt Nam) đến N ngày, kèm HĐ tái ký; `GET /contracts/renewal-stats?from&to` — số HĐ đã duyệt hết hạn trong khoảng, số đã tái ký, tỷ lệ (để 10 dùng). Theo phạm vi dữ liệu người xem.
- **Huỷ HĐ:** `POST /contracts/:id/status` với `CANCELLED` bắt buộc `reason` khi HĐ đã có việc; lưu `cancel_reason/cancelled_at/cancelled_by_id`, cập nhật có điều kiện, huỷ phụ lục đang mở, audit `CANCEL`, phát sự kiện `contract.cancelled` cho 05 — 04 không xoá/đổi việc (đã kiểm chứng việc giữ nguyên).
- **Chi tiết HĐ theo PL1 VII.3:** tab Tổng quan (thông tin, kinh doanh, tái ký, dịch vụ, phụ lục) | Quy trình & Công việc (tiến độ chung, kế hoạch; kế hoạch đã sinh việc hiện tiến độ theo giai đoạn thu gọn/mở rộng — API kế hoạch trả trạng thái việc của từng bước) | Hồ sơ (04-C) | Thanh toán & Hoá đơn (chỉ người có quyền tài chính) | Lịch sử (`GET /contracts/:id/history`, `contracts:view`, phân trang; chỉ trả khoá không có tiền; bỏ bản ghi chung của interceptor trùng thao tác đã có bản ghi nghiệp vụ). Danh sách HĐ có khối "Hợp đồng hết hạn trong 30 ngày". Nút "Tạo HĐ năm sau" mở HĐ mới; huỷ HĐ qua hộp nhập lý do.
- Migration `20261016060000_contract_lifecycle` chỉ thêm cột/bảng/index (HĐ cũ giữ nguyên, các cột mới rỗng).

### 04-E — Gợi ý giá (đã code và kiểm chứng kỹ thuật ngày 22/10/2026)

- Chỉ sửa frontend `contracts`; dùng API báo giá sẵn có của 03 (`GET /service-types/:id/price-quote?value=&date=`, cần `service-catalog:view` + `finance:view`) qua `contracts/data-access/price-quote.api.ts`; không sửa backend, schema hay module 03.
- Form HĐ: chọn dịch vụ, đổi **ngày bắt đầu HĐ** hoặc nhập **giá trị tiêu chí** → gọi báo giá theo ngày bắt đầu. Dịch vụ tính giá theo bậc hiện thêm ô "Tiêu chí giá" (nhãn theo tiêu chí và đơn vị của dịch vụ); chưa nhập thì báo "Nhập giá trị tiêu chí để gợi ý giá", không gọi API. Dưới ô đơn giá hiện "Theo bảng giá: …" hoặc "Giá chuẩn (chưa có bảng giá áp dụng / không có bậc giá phù hợp): …", lỗi API hiện tại chỗ.
- **Tự điền** giá gợi ý khi đơn giá còn 0 hoặc vẫn bằng giá đã tự điền lần trước; giá người dùng tự sửa được giữ, kèm nút "Dùng giá này". Mở HĐ đã lưu chỉ hiện gợi ý để so sánh, không ghi đè đơn giá đã lưu. HĐ đã duyệt (form khoá) không gọi báo giá. Mỗi dòng một luồng `switchMap` nên kết quả cũ về muộn không đè kết quả mới.
- Người thiếu `finance:view` giữ cách cũ (điền giá chuẩn nếu có và đơn giá trống), không thấy ô tiêu chí.
- Giá trị tiêu chí chỉ dùng để gợi ý, **không lưu** vào HĐ (đặc tả: "lưu đơn giá vào dòng HĐ như hiện nay"); mở lại HĐ phải nhập lại nếu muốn xem gợi ý theo bậc. Phụ lục (04-D) chưa có gợi ý giá.
- **Giá riêng theo khách (QD13):** vẫn chờ chị Hà cho biết cách định giá; chưa triển khai.
