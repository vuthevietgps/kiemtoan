# Kiểm chứng chức năng 02 — Khách hàng và kho hồ sơ

Ngày **15/10/2026**. Kết luận: **đã hoàn thiện và kiểm chứng kỹ thuật phạm vi 02 được duyệt; người dùng đã nghiệm thu trong chat ngày 15/10/2026: “Tôi nghiệm thu 02.”** Chưa ghi đã merge; nghiệm thu này không thay UAT với người dùng thật (chị Hà, Nhật Linh, Hoàng Đỗ). [Đặc tả](02-customers-documents.md), [hướng dẫn vận hành](../operations/customer-documents.md), [giải trình test](02-test-policy-changes.md).

Người dùng đã duyệt đặc tả/helper scope, cho phép core/storage và audit preview, sau đó cho phép location PDF worker trong Nginx. Không triển khai module nghiệp vụ tiếp theo hoặc đổi công thức tài chính.

## Phạm vi đã thực hiện

| Gói | Kết quả |
| --- | --- |
| 02-A Thông tin/liên hệ/phân công | Nhiều liên hệ, tối đa một đầu mối chính; đồng bộ phần tóm tắt cũ; phân công trực tiếp; chọn người đang hoạt động trong scope; tìm/lọc/phân trang; audit owner/phân công và bảo vệ đồng thời |
| 02-B Excel | Mẫu có hướng dẫn; XLSX xem trước/lỗi theo dòng, chọn nhập dòng hợp lệ, xác nhận một lần/30 phút; kiểm tra lại quyền và MST, transaction không nhập nửa chừng; export đúng lọc/scope; giữ số 0 đầu, chặn công thức/link ngoài/macro và giới hạn giải nén |
| 02-C Hồ sơ | Tìm/lọc/phân trang; v1 và lịch sử, thêm phiên bản đồng thời không trùng; giữ file cũ; kiểm tra định dạng/kích thước; dọn file mới khi DB lỗi; tải từng phiên bản, preview PDF/PNG/JPEG, xoá mềm cả hồ sơ; storage chặn thư mục anh em trùng tiền tố |
| 02-D KH360/UI | Thông tin/liên hệ/nhân sự/HĐ/hồ sơ và việc đang mở theo quyền; giữ ẩn tiền; bộ lọc owner và tìm theo liên hệ; form/component trình bày không gọi API; trạng thái tải/lỗi/thử lại và chống submit lặp |

Preview PDF ban đầu trả đúng bytes nhưng khung trình duyệt trắng. Đã sửa bằng PDF.js dựng canvas, tải thư viện khi cần, assets cùng ứng dụng; UI đã hiển thị nội dung PDF. Nginx được thử riêng: cấu hình hợp lệ, worker HTTP200 `application/javascript`; khi không có worker trả HTTP404.

## Kiểm thử tự động

| Kiểm tra cuối | Kết quả |
| --- | --- |
| API lint | Exit 0, 0 lỗi; 10 cảnh báo độ dài hàm đã có từ 01 (9 ở test, 1 saveRole) |
| Web lint | Exit 0, 0 lỗi; 1 cảnh báo test hợp đồng |
| API unit | **23 suites / 119 tests đạt** |
| Toàn bộ API e2e | **17 suites / 129 tests đạt**, PostgreSQL 16 riêng |
| Web test | **8 files / 30 tests đạt** |
| Bộ access coverage | **6 suites / 55 tests đạt**, 95,75% dòng, 81% branches; từng service quyền/auth/users trên 70%; helper scope 100% dòng |
| API/web production build | Đạt; initial web khoảng **1,45 MB**; PDF lazy chunk khoảng 433 KB, worker/fonts riêng |
| Max-lines | Không file code vượt 1.000 dòng |
| Dependency audit production | API 0 vulnerabilities; web 0 vulnerabilities khi cài PDF.js; không tuyên bố audit dev API sạch |

API dependency ExcelJS kéo theo UUID cũ; npm cũng phân loại Prisma peer vào runtime. Override UUID 11.1.1 và deepmerge-ts 8.0.0 được kiểm chứng bằng Prisma validate/generate/migrate/build và toàn bộ test; không dùng `audit fix --force` để đổi Prisma/ExcelJS xuống bản khác.

Test mới bao gồm từ chối owner ngoài nhóm/ngừng hoạt động, cấp/gỡ scope, đầu mối chính đồng thời, Excel chưa xác nhận không ghi DB, trùng sau preview rollback cả lô, chặn người khác xác nhận/replay, export đúng scope, file giả/loại cấm, phiên bản đồng thời/bytes cũ, preview đúng header/scope, xoá ẩn lịch sử, cleanup DB lỗi và đường dẫn storage. Bốn test `null` đã fail trước sửa validation rồi đạt sau sửa, tránh lỗi 500 từ Prisma. Không sửa test để che lỗi sản phẩm.

Log cục bộ: `tmp/02-final-e2e.log`, `tmp/02-final-web-tests.log`, `tmp/02-access.log`, `tmp/02-null-red.log`. Kết quả tổng hợp là test cục bộ, không phải CI từ xa.

## Migration và UI

- DB trống riêng áp dụng đủ 7 migration rồi seed thành công. DB nâng cấp từ 01 giữ MST `0001112223`, liên hệ `Legacy contact`/email, đầu mối chính và đường dẫn file `2026/10/legacy.txt` ở cả document/v1. Prisma diff không lệch schema. Không chạy test phá dữ liệu trên DB demo/thật.
- UI dữ liệu giả riêng: tạo KH/liên hệ, thêm liên hệ thứ hai; upload PDF v1/v2 → lịch sử hai bản → preview nội dung; Excel một dòng hợp lệ/một lỗi → xác nhận chỉ nhập dòng hợp lệ; danh sách/liên hệ ở 375px. Seed lại hai lần không tạo hai đầu mối chính.
- Bằng chứng: [lịch sử phiên bản](../../tmp/02-document-versions.png), [preview PDF](../../tmp/02-pdf-preview.png), [Excel xem trước](../../tmp/02-import-preview.png), [danh sách 375px](../../tmp/02-customers-mobile.png), [liên hệ 375px](../../tmp/02-contacts-mobile.png). Đây là artifact kiểm thử có thể tái tạo, không chứa dữ liệu thật.

## Giới hạn và bước tiếp theo

QD08 còn thiếu Excel thật và số liệu để mapping/đối soát/chuyển đổi; giới hạn 2.000 dòng/5 MB là phạm vi nhập hiện tại, không phải bằng chứng tải production. QD00 chưa chốt portal, hiện chỉ có hồ sơ nội bộ. Các tab HĐ/công việc/kho tài khoản nối dữ liệu hiện có, không thay nghiệm thu toàn bộ 04/05/09.

Không triển khai hồ sơ kiểm toán chuyên sâu, quy trình yêu cầu/duyệt hồ sơ, công nợ hoặc tích hợp ngoài trong 02. Những phần đó tiếp tục theo kế hoạch. Cloud, UAT thật, dữ liệu chuyển đổi và vận hành production còn riêng; chưa commit/push/merge.

Bước tiếp theo theo thứ tự là **03 — Dịch vụ, bảng giá và quy trình có phiên bản**; [đặc tả 03](03-service-catalog.md) đã được duyệt, triển khai từ 03-A.
