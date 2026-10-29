# Kiểm chứng chức năng 04 — Hợp đồng: duyệt, kế hoạch, hồ sơ thương mại, vòng đời, gợi ý giá, theo dõi kiểm toán

Ngày **22/10/2026**. Kết luận: **đã hoàn thiện và kiểm chứng kỹ thuật toàn bộ 04-A → 04-F theo [đặc tả 04](04-contracts-lifecycle.md) (E1–E6, duyệt 16/10/2026) và [đặc tả 04-F](04-audit-engagement-tracking.md) (F1–F11, duyệt 22/10/2026); người dùng nghiệm thu trong chat ngày 22/10/2026: “Tôi nghiệm thu 04. Giữ F6 như đã duyệt.”** [Kịch bản demo](04-contracts-demo.md) dùng cho buổi nghiệm thu. Chưa merge (thư mục chưa có repo Git), chưa UAT với người dùng thật, chưa có mẫu Word/quy trình/bảng giá thật (QD07). Thay đổi test cũ: [giải trình](04-test-policy-changes.md). Review độc lập ngày 22/10: [review-2026-10-22](../planning/review-2026-10-22.md) — R4 (bảng nhân sự) và phần R5 thuộc 04 đã sửa.

## Phạm vi đã thực hiện

| Gói | Kết quả |
| --- | --- |
| 04-A Duyệt an toàn | Gửi duyệt kiểm tra dịch vụ/đợt/tổng; duyệt chỉ từ Chờ duyệt, nguyên tử (đồng thời một lần thành công); trả lại có lý do; trạng thái sinh việc từng dòng và "Sinh lại việc"; hộp xác nhận dạng modal |
| 04-B Kế hoạch thực hiện (E1, E2) | Kế hoạch theo dòng dịch vụ chép bước từ phiên bản quy trình; gợi ý người theo thứ tự đặc tả; sửa người/thời lượng/hạn, bỏ bước tuỳ chọn, xem trước lịch; xác nhận khoá kế hoạch; chỉ sinh việc khi HĐ đã duyệt **và** kế hoạch đã xác nhận; `plan_step_id` unique chống sinh trùng |
| 04-C Hồ sơ thương mại (E4) | Quản lý 6 loại mẫu Word có phiên bản; sinh DOCX từ mẫu (tiền bằng chữ), lưu kho hồ sơ 02 có phiên bản; tải bản scan đã ký; chặn trường/lệnh lạ, macro, file sai loại |
| 04-D Vòng đời (E5, E6) | Thông tin kinh doanh/người giới thiệu; sửa sau duyệt không chạm tiền; phụ lục (Nháp → Chờ duyệt → Đã duyệt) cập nhật tiền/đợt bằng Decimal, chặn lập trên số liệu cũ; tái ký "Tạo HĐ năm sau"; sắp hết hạn, tỷ lệ tái ký; huỷ có lý do; tab chi tiết HĐ và Lịch sử |
| 04-E Gợi ý giá | Form HĐ gợi ý đơn giá từ bảng giá 03 theo ngày bắt đầu và giá trị tiêu chí; tự điền khi đơn giá trống, giữ giá người dùng sửa, nút "Dùng giá này"; giá riêng theo khách chờ QD13 |
| 04-F1 Hồ sơ kiểm toán | Cờ dịch vụ phát hành BCKT (03); nhóm Manager/trưởng nhóm/trợ lý, người ký 1/2; giai đoạn BCKT; phát hành (số duy nhất, file PDF), mở lại có lý do; tình trạng hồ sơ HĐ (gửi khách, bản gốc, BBNT có bằng chứng); lịch sử vai, mốc giai đoạn |
| 04-F2 Hạn và đúng hạn | Ba hạn mỗi hồ sơ, chốt hạn gốc khi bắt đầu kiểm toán, gia hạn chỉ Giám đốc kèm lý do; kết quả đúng/trễ/quá hạn/sắp đến hạn theo giờ VN; tỷ lệ theo người chịu trách nhiệm (F10), phạm vi xem (F11) |
| 04-F3 Bảng theo dõi | Trang "Theo dõi kiểm toán" (Hồ sơ + Theo nhân sự), ngăn chi tiết, tab Kiểm toán trên chi tiết HĐ; bộ lọc trên URL; tiền theo HĐ không cộng trùng, ẩn khi thiếu quyền tài chính |

## Đối chiếu tiêu chí nghiệm thu — đặc tả 04 (04-A → 04-E)

| # | Tiêu chí | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Chỉ giám đốc duyệt; duyệt từ Chờ duyệt, đồng thời chỉ một lần; trả lại có lý do; nhân viên/thu tiền/quản trị 403 với duyệt, kế hoạch, mẫu; nhân viên không thấy tiền ở mọi tab/API mới | Đạt | `contracts-approval.e2e`, `contract-plans.e2e`, `contract-documents.e2e`, `contract-amendments.e2e` (phân quyền 5 vai trò, ẩn tiền), bộ access 57 test |
| 2 | Kế hoạch lấy đúng phiên bản, gợi ý người đúng thứ tự, không bỏ bước bắt buộc; xác nhận khoá; sửa quy trình sau đó không đổi kế hoạch | Đạt | `contract-plan.builder.spec`, `contract-plans.e2e`, `contract-plans.store.spec`; giao diện HD-2025-017 (12 bước) |
| 3 | Sinh việc chỉ khi đã duyệt + đã xác nhận; gọi lại/đồng thời không trùng (ràng buộc DB); lỗi hiển thị và sinh lại được | Đạt | `task-generator.spec`, `contracts-approval.e2e`, `contract-plans.e2e`; unique `tasks.plan_step_id` |
| 4 | DOCX đúng trường trộn, tiền bằng chữ đúng; lưu kho có phiên bản; scan đã ký xem trước được; trường không hợp lệ bị chặn | Đạt (chưa mở DOCX bằng Word/LibreOffice thật) | `docx-engine.spec`, `vnd-words.util.spec`, `contract-documents.e2e`, `contract-documents.panel.spec` |
| 5 | Phụ lục cập nhật tổng/đợt đúng (Decimal), giữ lịch sử; không xoá dòng có việc; gia hạn tạo HĐ năm sau đúng kỳ; sắp hết hạn đúng ngày | Đạt; chặt hơn đặc tả: không bỏ dòng đã có việc (kể cả chưa bắt đầu) hoặc đã có hồ sơ kiểm toán | `amendment.calculator.spec`, `contract-amendments.e2e`, `renewal.util.spec`, `contract-lifecycle.e2e` |
| 6 | Migration HĐ cũ không sinh việc mới, không mất việc/lịch sử; Prisma diff sạch | Đạt | Mục Migration dưới |
| 7 | Lint/unit/e2e/build/max-lines đạt; e2e phân quyền mọi API mới; giao diện desktop/375px luồng tạo → gửi duyệt → duyệt → kế hoạch → xác nhận → việc → DOCX → phụ lục → gia hạn | Đạt chức năng; 375px còn hạn chế của khung menu chung | Mục Kiểm thử, [hiện trạng](../planning/current-status.md) các mục 04-A → 04-D |
| 8 | Không ghi đã có mẫu Word thật, công thức hoa hồng, giá riêng khi chưa có QD07/QD06/QD13 | Giữ | Seed ghi "mẫu ví dụ"; không có trường/phép tính hoa hồng; gợi ý giá ghi "chờ QD13" |
| 04-E | Gợi ý giá theo bảng giá 03; người lập vẫn sửa được; lưu đơn giá như cũ | Đạt | `price-suggestions.spec` (7), `contract-form.page.spec` (thêm 6); giao diện: KTT 150 chứng từ → 4.500.000; 400 → gợi ý 6.000.000; trước ngày hiệu lực → giá chuẩn |

## Đối chiếu tiêu chí nghiệm thu — đặc tả 04-F

| # | Tiêu chí | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Chỉ dòng có cờ phát hành BCKT hiện ở bảng/tab; bật/tắt cờ có audit | Đạt | `audit-engagements.e2e` |
| 2 | Ràng buộc nhóm/người ký; cảnh báo chưa phân công KH, không mở rộng phạm vi (F6); lịch sử vai | Đạt | `audit-engagement.rules.spec`, `audit-engagements.e2e` |
| 3 | Giai đoạn đúng quy tắc, lùi có lý do; phát hành chỉ GĐ, đủ số/ngày/người ký; số BCKT trùng bị chặn ở DB; mở lại có lý do; sau phát hành không sửa | Đạt | `audit-engagements.e2e` (gồm đồng thời [200, 409]) |
| 4 | Hạn phát hành bắt buộc trước khi bắt đầu; chốt hạn gốc; chỉ GĐ gia hạn, có lý do, lịch sử bất biến; gợi ý từ kế hoạch 04-B | Đạt | `audit-deadlines.e2e`, `audit-engagement-card.component.spec`; giao diện gia hạn HD-2025-013 |
| 5 | Kết quả hạn đúng ở biên ngày giờ VN; hạn gốc, cờ gia hạn; mốc lần đầu không đổi khi lùi–tiến/mở lại | Đạt | `deadline.rules.spec`, `audit-deadlines.e2e` |
| 6 | Theo nhân sự: F10, công thức tỷ lệ, "—", danh sách chi tiết khớp, phạm vi F11 | Đạt (đã sửa R4: người chưa có hạn trong kỳ vẫn có dòng) | `audit-deadlines.e2e` (5 test), giao diện tab Theo nhân sự |
| 7 | Tình trạng hồ sơ HĐ; BBNT "Đã ký" cần bản ký đúng loại; cột Hoá đơn đọc từ 08 | Đạt | `audit-engagements.e2e`, `audit-board.e2e`; giao diện lưu vị trí bản gốc |
| 8 | Bảng: lọc, tìm, sắp xếp, phân trang, thẻ đếm; không cộng trùng tiền; bộ lọc trên URL | Đạt | `audit-board.e2e` (3 test, 12 bộ lọc) |
| 9 | Nhân viên không thấy tiền; thu tiền thấy tiền nhưng không sửa và không xem Theo nhân sự; quản trị không truy cập | Đạt | `audit-board.e2e`, `audit-deadlines.e2e`; chạy thử API trên DB demo `ketoan_demo_04` |
| 10 | Khoá lạc quan 409; audit trước–sau, hiện ở Lịch sử, không lặp | Đạt | `audit-engagements.e2e`, `audit-deadlines.e2e`, `audit-engagements.store.spec` |
| 11 | Migration không đổi HĐ cũ; Prisma diff sạch; seed chạy lại không trùng | Đạt | Mục Migration dưới |
| 12 | Lint/unit/e2e/build/max-lines; e2e phân quyền 5 vai trò; unit cho các quy tắc | Đạt | Mục Kiểm thử dưới |
| 13 | Giao diện desktop/375px các luồng chính | Đạt các thao tác đã thử (xem dưới); chưa thử trên giao diện: phát hành có file, mở lại, đăng nhập vai nhân viên/KTT (đã có e2e) | [Hiện trạng](../planning/current-status.md) mục 04-F3 |

## Kiểm thử tự động (lần chạy cuối 22/10/2026, máy cục bộ, không phải CI)

| Kiểm tra | Kết quả |
| --- | --- |
| API unit | **229/229, 35 suites** |
| API e2e (DB test riêng `ketoan_codex_04f_test`) | **197/197, 28 suites** |
| API access | **57/57, 6 suites**; 95,75% dòng |
| Web (Vitest) | **82/82, 20 files** |
| Lint | 0 lỗi; API 38 cảnh báo `max-lines-per-function` (chủ yếu file test), web 1 cảnh báo cũ |
| Typecheck đầy đủ API (`tsc -p tsconfig.json`) | 4 lỗi cũ ở `customer-relationships.service.spec.ts` (02, ngoài phạm vi 04, chưa sửa); build (`tsconfig.build.json`) đạt |
| Build API/web, `check-max-lines` | Đạt |

## Migration

6 migration của 04: `20261016030000_contract_approval_generation`, `20261016040000_contract_service_plans`, `20261016050000_contract_document_templates`, `20261016060000_contract_lifecycle`, `20261022090000_audit_engagements`, `20261022120000_audit_deadlines` (04-E không có migration). Mỗi gói đã áp trên DB trống và DB có dữ liệu (bản sao DB demo); HĐ/việc cũ giữ nguyên, dòng đã có việc được gắn trạng thái/kế hoạch chuyển đổi, không sinh việc mới; seed chạy hai lần không nhân đôi; `prisma migrate diff` sạch. DB demo cho buổi nghiệm thu: `ketoan_demo_04` (migrate + seed mới ngày 22/10, cấu hình `api-demo-04` trong `.claude/launch.json`).

## Kiểm tra giao diện

Chi tiết từng gói ở [hiện trạng](../planning/current-status.md). Tóm tắt: 04-A trả lại/duyệt qua modal; 04-B lập, sửa, xác nhận kế hoạch HD-2025-017 sinh 12 việc theo kế hoạch đã sửa; 04-C tạo báo giá DOCX, phiên bản 2, tải scan PDF; 04-D sửa người giới thiệu, phụ lục 25 → 27 triệu, tái ký HD-2026-014, huỷ HĐ nháp; 04-E gợi ý giá theo bậc và giá chuẩn; 04-F gia hạn, chuyển giai đoạn, lưu tình trạng hồ sơ, tab Theo nhân sự, tab Kiểm toán. Lỗi phát hiện khi thử đều đã sửa và ghi ở hiện trạng.

## Giới hạn và việc chuyển sang bước sau

- **Khung giao diện chung ở 375px:** menu trái vẫn chiếm chỗ khi thu gọn (lỗi core layout ghi từ 03). Bảng và ngăn chi tiết của 04 cuộn trong khối; cần cho phép sửa khung chung.
- **Kế toán trưởng không thấy hồ sơ kiểm toán mình làm Manager khi khách hàng ngoài phạm vi nhóm** — đúng quyết định F6 (đưa vào nhóm không tự mở quyền xem), nhưng dữ liệu demo xếp KTT nhóm Thuế 1 làm Manager cho HĐ của nhóm Kiểm toán nên KTT thấy rất ít trên bảng. **Người dùng quyết định ngày 22/10/2026: giữ F6** — phân công khách hàng vẫn là nguồn quyền xem duy nhất; muốn KTT thấy hồ sơ thì phân công KH (02) cho người đó.
- **Chưa có:** PDF cho hồ sơ thương mại (E4 giai đoạn B, cần LibreOffice/Gotenberg); mẫu Word thật (QD07); công thức hoa hồng (QD06); giá riêng theo khách (QD13); sửa tay lịch đợt của phụ lục trên giao diện (API đã nhận); xuất Excel bảng theo dõi (10).
- **Chặt hơn đặc tả (ghi ở đặc tả):** phụ lục không bỏ dòng đã có việc hoặc đã có hồ sơ kiểm toán — 05 sẽ nới khi có huỷ việc.
- **Bảng theo dõi** lọc phần suy ra trong bộ nhớ trước khi phân trang — đủ cho quy mô một công ty; cần chuyển sang SQL nếu số hồ sơ kiểm toán tăng nhiều (QD08/QD11 chưa có số liệu khối lượng).
- **Thuộc 05/07 (review 22/10, chưa sửa):** R2 quyền quản lý việc dùng vai trò gốc, R3 tự duyệt việc (05); R1 công nợ quá hạn khi thu chỉ định đợt (07). Đánh giá theo việc của trợ lý theo [khung G1–G10](10-performance-evaluation.md) làm ở 05/10.
- **Ngoài phạm vi 04:** 4 lỗi typecheck ở spec của 02; test `permissions-financial` "exports a real Excel workbook" (01) có lúc lỗi ngẫu nhiên do nhật ký EXPORT ghi sau khi gửi file — lần chạy cuối đạt.
- **Vận hành:** chưa có Git/CI thật, SMTP thật, UAT, dữ liệu thật, HTTPS/cloud chính thức.
