# 04 — Dịch vụ, Hợp đồng, Thu tiền & công nợ, Hoá đơn

> Đặc tả demo từng gộp nhiều module. Khi hoàn thiện, tách phạm vi theo thứ tự 03 dịch vụ → 04 hợp đồng → 07 thu tiền → 08 hoá đơn; xem [danh mục đặc tả](README.md). Nội dung này chưa thay thế đặc tả theo yêu cầu bổ sung được duyệt.

Module backend: `service-catalog`, `contracts`, `payments`, `invoices` (`apps/api/src/modules/...`).
Frontend: `apps/web/src/app/features/{service-catalog,contracts,payments,invoices}`.
Nhãn tiếng Việt dùng chung: `features/contracts/contract-labels.ts`.

## Dịch vụ & bảng giá (`/service-types`, quyền `service-catalog`)

| Method | Đường dẫn | Ghi chú |
| --- | --- | --- |
| GET | `/service-types` | kèm `taskTemplates` sắp theo `sortOrder` |
| GET | `/service-types/:id` | |
| POST | `/service-types` | `code` (tự viết hoa, trùng → 409), `name`, `cycle`, `defaultPrice` |
| PATCH | `/service-types/:id` | |
| PUT | `/service-types/:id/task-templates` | `{ items: [{ title, sortOrder?, dueDayOffset?, requiresEvidence? }] }` — thay toàn bộ |

## Hợp đồng (`/contracts`, quyền `contracts`, phạm vi `contractScope`)

- Mã tự sinh `HD-YYYY-NNN` (năm hiện tại, số tiếp theo; trùng do tạo đồng thời → thử lại).
- Tiền tính bằng `Prisma.Decimal` (`contract-calculator.ts`): `amount = quantity × unitPrice`,
  `subtotal = Σ amount`, `vatAmount = round(subtotal × vatRate / 100)` (làm tròn đồng), `total = subtotal + vatAmount`.
- Đợt thanh toán: không gửi → 1 đợt "Thanh toán toàn bộ" = `total`, hạn `startDate + 30 ngày`.
  Tổng các đợt ≠ `total` → 400.
- Luồng trạng thái:
  `DRAFT —submit→ PENDING_APPROVAL —approve→ NOT_STARTED → IN_PROGRESS → COMPLETED → LIQUIDATED`;
  `approve` nhận cả DRAFT; huỷ được từ DRAFT/PENDING/NOT_STARTED/IN_PROGRESS; COMPLETED có thể mở lại IN_PROGRESS.
- Sửa (`PATCH`) chỉ khi DRAFT/PENDING_APPROVAL; gửi `services`/`installments` thì thay toàn bộ, tiền tính lại.
  Không gửi đợt mới mà tổng đổi → tạo lại 1 đợt mặc định.
- Khi sửa, bỏ qua trường tuỳ chọn trong request = giữ nguyên; gửi `null` cho `ownerId`, `signedDate`,
  `endDate`, `note` = xoá giá trị đã lưu. Ngày bắt đầu và khách hàng vẫn bắt buộc trên form.
- Duyệt (`POST /:id/approve`, quyền `contracts:approve`): lưu `approvedById/approvedAt`, `AuditService.log('APPROVE')`,
  phát `CONTRACT_APPROVED` (`ContractApprovedEvent`) — module `tasks` nghe để tự sinh công việc từ việc mẫu.
- `GET /contracts`: phân trang, `search` (mã / tên khách hàng), `status`, `customerId`; mỗi dòng có
  `serviceTypes`, `paidAmount`, `paymentStatus` (`UNPAID | PARTIAL | PAID`).
- `GET /contracts/:id`: customer, owner, approvedBy, services (serviceType, assignee), installments (kèm `paidAmount`),
  payments, invoices, `remainingAmount`, `invoicedSubtotal`, `taskProgress {total, done}` (đếm bảng tasks).
- `POST /:id/status { status }`: IN_PROGRESS | COMPLETED | LIQUIDATED | CANCELLED theo bảng chuyển hợp lệ.

## Thu tiền & công nợ (`/payments`, quyền `payments`, phạm vi theo hợp đồng)

- `POST /payments`: mã `PT-YYYY-NNN` (năm của ngày thu); `amount > 0`; hợp đồng DRAFT/CANCELLED → 400;
  tổng đã thu + số mới > `total` → 400 "Số tiền thu vượt quá số còn phải thu".
- `GET /payments`: phân trang, lọc `contractId`, `customerId`, `from`/`to` (ngày thu), `search`.
- `DELETE /payments/:id`: xoá mềm.
- `GET /payments/receivables`: hợp đồng đã duyệt (không tính DRAFT/PENDING/CANCELLED) còn nợ;
  `total, paid, remaining, overdueAmount, overdueDays, ageBucket ('0-30'|'31-60'|'61-90'|'>90' | null)` + `summary`.
  Phân bổ tiền đã thu vào đợt: phiếu gắn đợt tính cho đợt đó, phần còn lại trừ dần theo hạn sớm nhất.
  Đợt quá hạn = hạn trước hôm nay và chưa thu đủ; tuổi nợ tính theo đợt quá hạn lâu nhất.

## Hoá đơn (`/invoices`, quyền `invoices`)

- `POST /invoices { contractId, subtotal?, note }`: đề nghị xuất; mặc định = phần `subtotal` hợp đồng chưa xuất
  (không tính hoá đơn đã huỷ); vượt phần còn lại → 400; VAT theo `vatRate` hợp đồng.
- `PATCH /invoices/:id/issue { number, symbol, issueDate }` (quyền `invoices:update`): REQUESTED → ISSUED.
- `PATCH /invoices/:id/cancel` (quyền `invoices:update`).

## Màn hình

- `/service-catalog`: bảng dịch vụ, modal thêm/sửa + danh sách việc mẫu.
- `/contracts`: danh sách (tìm, lọc trạng thái, tag thanh toán); `/contracts/new`, `/contracts/:id/edit`: form
  (dòng dịch vụ, đợt thanh toán, tổng tự tính); `/contracts/:id`: chi tiết, tiến độ, nút theo trạng thái,
  tab Thu tiền (modal "Thu tiền") và Hoá đơn (modal "Đề nghị xuất hoá đơn").
- Form hợp đồng chỉ cho lưu sau khi tải chi tiết thành công và hợp đồng còn ở trạng thái Nháp / Chờ duyệt.
  Lỗi tải chi tiết hiển thị ngay trên trang; khi đang lưu không gửi thêm request nếu bấm Lưu hoặc Enter lần nữa.
  Xoá ngày ký, ngày kết thúc, người phụ trách hoặc ghi chú trên form sửa sẽ xoá giá trị tương ứng khi lưu.
- `/payments`: tab Phiếu thu (lọc ngày) và Công nợ (tag tuổi nợ, tổng cộng).
- `/invoices`: bảng hoá đơn, lọc trạng thái, Phát hành / Huỷ.

## Seed

`seedCatalog` (6 dịch vụ + việc mẫu), `seedContracts` (HD-2025-011..015 như màn hình mẫu + 016 chờ duyệt, 017 nháp;
chạy sau `seedCustomers`, thiếu khách hàng thì bỏ qua), `seedPayments` (phiếu thu PT-2025-001..007, hoá đơn mẫu).
Chạy lại không lỗi.
