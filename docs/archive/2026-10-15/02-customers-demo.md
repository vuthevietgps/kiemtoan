# 02 – Khách hàng, Hồ sơ tài liệu, Tài khoản công ty khách hàng

> Đặc tả demo từng gộp nhiều module. Khi hoàn thiện: khách hàng/hồ sơ thuộc 02, kho tài khoản thuộc 09; xem [danh mục đặc tả](README.md). Nội dung này chưa thay thế đặc tả theo yêu cầu bổ sung được duyệt.

Module: `customers`, `documents`, `client-credentials` (backend `apps/api/src/modules/…`, frontend `apps/web/src/app/features/customers`, `features/client-credentials`).

## User story

- Là **kế toán trưởng / giám đốc**, tôi thêm, sửa, xoá (mềm) khách hàng và giao người phụ trách, để mỗi khách hàng có đầu mối rõ ràng.
- Là **nhân viên**, tôi chỉ thấy khách hàng mình phụ trách / được giao việc, xem hợp đồng, hồ sơ và tài khoản đăng nhập của họ.
- Là **nhân viên**, tôi tải lên hồ sơ theo thư mục (pháp lý, hợp đồng, tài liệu dịch vụ theo kỳ, bằng chứng công việc, khác) và tải về khi cần.
- Là **người được phép**, tôi xem mật khẩu tài khoản công ty khách hàng (thuế điện tử, BHXH, hoá đơn điện tử, chữ ký số…); mỗi lần xem đều được ghi nhật ký.
- Là **trưởng nhóm**, tôi được cảnh báo chữ ký số sắp hết hạn (≤ 30 ngày).

## Quy tắc nghiệp vụ

- Mã số thuế: 10 chữ số, hoặc 10 số + `-xxx` (chi nhánh); duy nhất → trùng trả **409 "Mã số thuế đã tồn tại"**
  (kể cả khách hàng đã xoá mềm, do ràng buộc unique trong DB).
- Không chọn người phụ trách khi tạo → mặc định là người tạo.
- Phạm vi dữ liệu dùng `customerScope(user)`: giám đốc / thu ngân thấy tất cả; trưởng nhóm thấy khách hàng của nhóm;
  nhân viên thấy khách hàng mình phụ trách, phụ trách hợp đồng, được phân công dịch vụ hoặc công việc. Ngoài phạm vi → **404**.
- Tài liệu và tài khoản kế thừa phạm vi của khách hàng. File tối đa 20MB, lưu qua `StorageService`.
- Mật khẩu mã hoá AES-256-GCM (`CryptoService`, khoá `CREDENTIAL_KEY`); API không bao giờ trả `passwordEnc`.
  Sửa tài khoản: chỉ đổi mật khẩu khi có gửi `password`.
- Xoá = xoá mềm (`deletedAt`).

## API (`/api/v1`)

| Phương thức | Đường dẫn | Quyền | Ghi chú |
| --- | --- | --- | --- |
| GET | `/customers?page&pageSize&search&status&ownerId` | customers:view | Phân trang; kèm `owner {id, fullName}`, `contractCount` |
| GET | `/customers/options` | customers:view | `[{id, name, taxCode}]` cho ô chọn ở module khác |
| GET | `/customers/:id` | customers:view | Kèm `owner`, `contracts [{id, code, status, total, startDate}]`, `documentCount`, `openTaskCount` |
| POST | `/customers` | customers:create | 409 khi trùng MST |
| PATCH | `/customers/:id` | customers:update | |
| DELETE | `/customers/:id` | customers:delete | Xoá mềm |
| GET | `/customers/:customerId/documents?category&contractId` | documents:view | Kèm `uploadedBy`, `contract.code`, `task.title` |
| POST | `/customers/:customerId/documents` | documents:create | multipart: `file`, `category`, `contractId?`, `period?` (YYYY-MM / YYYY-Q1), `note?` |
| GET | `/documents/:id/download` | documents:view | Trả file với tên gốc; token qua header hoặc `?token=`; dùng chung cho file bằng chứng (EVIDENCE) |
| DELETE | `/documents/:id` | documents:delete | Xoá mềm |
| GET | `/client-credentials?customerId&type&search&page&pageSize` | client-credentials:view | Không có mật khẩu; kèm `customer {id, name, taxCode}` |
| POST | `/client-credentials` | client-credentials:create | `customerId, type, label?, url?, username, password, expiresAt?, status?, note?` |
| PATCH | `/client-credentials/:id` | client-credentials:update | Đổi mật khẩu nếu gửi `password`; `expiresAt: null` = xoá ngày hết hạn |
| DELETE | `/client-credentials/:id` | client-credentials:delete | Xoá mềm |
| POST | `/client-credentials/:id/reveal` | client-credentials:view_secret | Trả `{password}`, ghi `AuditService.log(user, 'VIEW_SECRET', 'client-credentials', id)` |

## Quyền mặc định (tóm tắt)

| Vai trò | Khách hàng | Tài liệu | Tài khoản công ty |
| --- | --- | --- | --- |
| Giám đốc | toàn quyền | toàn quyền | toàn quyền |
| Kế toán trưởng | toàn quyền (nhóm) | toàn quyền | toàn quyền |
| Nhân viên | xem | xem, tải lên | xem, xem mật khẩu |
| Thu ngân | xem (tất cả) | xem | — |

## Màn hình

- `/customers`: danh sách, tìm theo tên / MST, lọc trạng thái, nút "Thêm khách hàng" (modal form).
- `/customers/:id`: tab Thông tin (xem / sửa), Hợp đồng (link `/contracts/:id`), Hồ sơ tài liệu (nhóm theo thư mục, tải lên / tải về / xoá),
  Tài khoản đăng nhập (thêm / sửa / xoá, xem mật khẩu + sao chép).
- `/client-credentials`: mọi tài khoản trong phạm vi, lọc khách hàng / loại, cảnh báo chữ ký số hết hạn ≤ 30 ngày.

## Kiểm thử

- Unit: `npx jest src/modules/customers src/modules/documents src/modules/client-credentials`.
- e2e: `test/customers.e2e-spec.ts`, `test/customers-documents.e2e-spec.ts`, `test/customers-credentials.e2e-spec.ts`.
