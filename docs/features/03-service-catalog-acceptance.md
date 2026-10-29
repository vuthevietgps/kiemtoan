# Kiểm chứng chức năng 03 — Dịch vụ, bảng giá và quy trình mẫu có phiên bản

Ngày **15/10/2026**. Kết luận: **đã hoàn thiện và kiểm chứng kỹ thuật toàn bộ 03-A → 03-D theo [đặc tả đã duyệt](03-service-catalog.md); người dùng nghiệm thu trong chat ngày 16/10/2026: “Tôi nghiệm thu 03 và duyệt đặc tả 04 với phương án đề xuất E1–E6 cùng phạm vi sửa ngoài module đã liệt kê. Bắt đầu code 04-A.”** Chưa merge (chưa có repo Git), chưa UAT với người dùng thật, chưa có dữ liệu dịch vụ/quy trình/bảng giá thật (QD07). Thay đổi test cũ: [giải trình](03-test-policy-changes.md).

## Phạm vi đã thực hiện

| Gói | Kết quả |
| --- | --- |
| 03-A Dịch vụ, bảng giá | Tiêu chí giá theo bậc; bảng giá có ngày hiệu lực, bậc nửa mở liền mạch, khoá bảng đã/đang áp dụng, một bảng mỗi ngày; báo giá theo ngày/giá trị, dùng giá chuẩn khi không có bảng/bậc; quyền tài chính; audit trước–sau |
| 03-B Quy trình có phiên bản | Mã `QT-<DV>-NNN`; Nháp → Đang hiệu lực → Ngừng; bước có giai đoạn, thời lượng/hạn theo kỳ, vai trò, số cấp duyệt, bằng chứng, phụ thuộc/song song; chặn vòng; khoá lạc quan; phát hành nguyên tử; nhân bản; xem trước theo ngày làm việc; quyền D1; migration việc mẫu cũ; bộ sinh việc đọc phiên bản đang hiệu lực (D3) |
| 03-C Hồ sơ yêu cầu | Danh mục hồ sơ theo phiên bản, gắn bước, bắt buộc/"nếu có", theo kỳ/một lần; bất biến sau phát hành; chép khi nhân bản |
| 03-D Giao diện, nghiệm thu | Chọn người thực hiện/kiểm tra/phê duyệt mặc định (từ `/users/options` theo phạm vi); kéo thả bước (giữ nút lên/xuống); menu "Dịch vụ & quy trình"; ô chọn co giãn ở màn hẹp; test giao diện cho form bước, store trình sửa, form bảng giá, hồ sơ yêu cầu |

## Đối chiếu tiêu chí nghiệm thu của đặc tả

| # | Tiêu chí | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Quyền D1, bảng giá cần quyền tài chính, e2e phân quyền cho API mới | Đạt | `workflow-templates.e2e`, `workflow-requirements.e2e`, `service-price-lists.e2e`, `permissions.spec` |
| 2 | Mẫu 12 bước PL1 cấu hình được, 46 ngày; song song rút ngắn đúng | Đạt (46 → 36 khi 3 bước song song; 41 khi 1 bước) | `workflow-schedule.util.spec`, e2e xem trước, UI |
| 3 | Vòng/tự phụ thuộc/thiếu thời lượng bị từ chối chỉ rõ bước; sửa bản đã phát hành 409; hai người sửa 409; phát hành đồng thời một lần | Đạt | `workflow.util.spec`, `workflow-templates.e2e` |
| 4 | Nhân bản ánh xạ khoá/phụ thuộc, sang dịch vụ khác ra mã mới, bản gốc không đổi | Đạt | e2e nhân bản (kể cả hồ sơ yêu cầu) |
| 5 | Bảng giá: chồng lấn/hở, chọn bảng theo ngày và bậc tại biên, giá chuẩn khi thiếu, khoá bảng đã áp dụng, HĐ giữ đơn giá | Đạt | `price-list.util.spec`, `service-price-lists.e2e` |
| 6 | Sinh việc từ phiên bản đang hiệu lực (theo kỳ, theo dự án); phát hành mới không đổi việc đã sinh; không trùng; hồi quy tasks/contracts/dashboard/reports | Đạt | `task-generator.spec`, `tasks.e2e`, `workflow-templates.e2e`, toàn bộ e2e; UI: duyệt HĐ thử sinh 12 việc theo v2 |
| 7 | Migration trên DB trống và có dữ liệu, chuyển đổi 1–1, Prisma diff sạch | Đạt | Mục kiểm thử dưới |
| 8 | Unit cho phát hiện vòng, lập lịch, kiểm tra, nhân bản, bậc giá; lint/unit/e2e/build/max-lines đạt | Đạt; còn cảnh báo `max-lines-per-function` ở file test | Mục kiểm thử dưới |
| 9 | Giao diện desktop/375px luồng dịch vụ → bảng giá → quy trình → nháp → xem trước → phát hành → v2 → duyệt HĐ thấy việc theo v2 | Đạt chức năng; 375px **có tràn ngang do khung menu chung** (xem Giới hạn) | Ảnh trong `tmp/03a-*`, `03b-*`, `03c-*`, `03d-*` |
| 10 | Không ghi đã cấu hình dữ liệu thật khi chưa có QD07 | Giữ: chỉ có dữ liệu mẫu dev | Seed ghi "Dữ liệu mẫu cho môi trường dev" |

## Kiểm thử tự động (lần chạy cuối 15/10/2026, máy cục bộ, không phải CI)

| Kiểm tra | Kết quả |
| --- | --- |
| API unit | **159/159, 27 suites** |
| API e2e (DB test riêng `ketoan_codex_03_test`, migrate từ trống) | **156/156, 20 suites** |
| API access coverage | **56 test**, **95,75% dòng** (service quyền/auth/users đều > 70%) |
| Web (Vitest) | **45/45, 12 files** |
| Lint | 0 lỗi. API 16 cảnh báo `max-lines-per-function` (file test và `saveRole` cũ); web 1 cảnh báo cũ |
| Build API/web | Đạt; initial web 1,45 MB (không đổi so với 02) |
| `check-max-lines` | Đạt |
| Độ phủ unit logic tiền mới | `price-list.util.ts` 100% dòng, `price-lists.service.ts` 76% dòng |

Migration: 3 migration mới (`20261016000000_service_price_lists`, `20261016010000_workflow_templates`, `20261016020000_document_requirements`) áp được trên DB trống và DB có dữ liệu cũ; DB có việc mẫu cũ chuyển đúng thứ tự/tên/số ngày/bằng chứng; seed chạy hai lần không nhân đôi; `prisma migrate diff` không lệch. Không chạy test trên DB demo `ketoan`.

## Kiểm tra giao diện (dữ liệu giả, DB tạm, đã xoá sau khi thử)

- Giám đốc: danh sách dịch vụ/lọc, tạo bảng giá 2 bậc, lỗi "đến" ≤ "từ", ngày quá khứ bị khoá; tạo nháp QT-LLSS-001 v2, chọn người thực hiện mặc định cho bước 1, kéo thả đổi thứ tự, đặt bước song song, xem trước, phát hành qua hộp xác nhận; duyệt HĐ thử HD-2025-017 (Làm lại sổ sách, bắt đầu 01/11/2025) → sinh 12 việc theo v2, bước 1 hạn 04/11, bước cuối 05/01/2026.
- Trưởng nhóm: tạo nháp QT-HT-001 v2 (chép 7 hồ sơ), thêm hồ sơ, lưu; không có nút phát hành.
- Lỗi phát hiện và đã sửa trong quá trình: lưu nháp bị 400 do API trả trường nội bộ (có test hồi quy); ngày xem trước lệch −1 ngày; hộp xác nhận tràn màn hẹp (đổi sang modal); bảng dịch vụ lệch cột khi ẩn cột giá bằng chỉ thị cấu trúc; ô chọn `min-width` làm tràn ở màn hẹp.

## Giới hạn và việc chuyển sang bước sau

- **Khung giao diện chung (core layout) ở 375px:** menu trái vẫn rộng 232px dù ở trạng thái thu gọn, vùng nội dung còn ~143px nên mọi trang (kể cả Khách hàng của 02 đã nghiệm thu) tràn ngang. Không sửa trong 03 vì thuộc khung chung; đề xuất xử lý riêng sau khi được cho phép.
- Popconfirm "Duyệt/Huỷ hợp đồng" ở trang hợp đồng tràn ra ngoài màn hẹp — thuộc 04.
- Thuộc 04: chọn phiên bản cho dòng dịch vụ, xác nhận kế hoạch, áp người mặc định của bước khi sinh việc, gợi ý giá từ bảng giá, giá riêng theo khách (QD13), duyệt HĐ nguyên tử.
- Thuộc 05: liên kết việc ↔ bước/phiên bản, 8 trạng thái, phê duyệt nhiều cấp theo số cấp đã cấu hình (QD04), danh sách hồ sơ cho từng KH và 6 trạng thái, xoá bảng `task_templates`.
- Thuộc 06: lịch nghỉ lễ cho tính ngày làm việc.
- QD07 (danh mục dịch vụ, quy trình, hồ sơ, bảng giá thật) vẫn thiếu.
