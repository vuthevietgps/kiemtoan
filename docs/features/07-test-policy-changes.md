# 07 — Giải trình thay đổi test cũ

Theo quy tắc mục 8: chỉ đổi test khi đặc tả được duyệt thay đổi hoặc chứng minh test cũ sai; ghi lý do trước khi đổi, giữ mức kiểm chứng tương đương. Đặc tả [07](07-payments.md) và J1–J15 được duyệt ngày 28/10/2026.

## 07-B (28/10/2026) — quy tắc công nợ chung, sửa R1

| File | Thay đổi | Lý do | Kiểm chứng giữ nguyên |
| --- | --- | --- | --- |
| `src/modules/contracts/contract-calculator.spec.ts` | Bỏ test "phân bổ phiếu thu: gắn đợt trước, phần dư theo hạn sớm nhất" | Hàm `allocatePayments` (tính lại khi đọc) được thay bằng phân bổ lưu theo J4 (`common/receivables.ts` → `allocateContract`) và đã xoá | Test chuyển sang `src/common/receivables.spec.ts` với **cùng dữ liệu và cùng kỳ vọng** (b = 50, a = 30) |
| `src/modules/payments/receivables.util.spec.ts` (xoá file) | 3 test (`agingBucket`, quá hạn + tuổi nợ, chưa quá hạn) | `receivables.util.ts` chuyển thành quy tắc chung `common/receivables.ts` (dùng cho thu tiền, HĐ, báo cáo, dashboard) | Chuyển sang `common/receivables.spec.ts`, **cùng dữ liệu, cùng kỳ vọng** (80; 45 ngày; 31–60; không quá hạn → null) |
| `src/modules/reports/utils/report-grouping.util.spec.ts` | Bỏ 3 test `overdueAmount` | `overdueAmount` (quá hạn = tổng đợt quá hạn − **toàn bộ** tiền thu) chính là nguyên nhân **R1**; bị thay bằng quy tắc chung theo phân bổ | 3 tình huống chuyển sang `common/receivables.spec.ts` với phiếu không chỉ định đợt — **cùng kỳ vọng** (250, 0, 0); thêm test R1 (1.000.000) ở unit và e2e `receivables-consistency` (đỏ trước khi sửa: báo cáo trả 0) |
| `src/modules/payments/payments.service.spec.ts` | Thêm mock hạ tầng `$transaction`, `$queryRaw`, `paymentInstallment.findMany`, `paymentAllocation.*`; mock `payment.findMany` của mã phiếu đổi sang `mockResolvedValueOnce`; giá trị trả về của `payment.create` thêm `contractId` | Ghi phiếu nay chạy trong transaction có khoá HĐ và phân bổ lại (J4); `payment.findMany` được gọi lần hai khi phân bổ | Không đổi kỳ vọng nào: chặn thu vượt, HĐ nháp, ngoài phạm vi 404, mã `PT-2025-005` |
| `src/modules/contracts/contracts-update.service.spec.ts` | Thêm mock hạ tầng `$queryRaw`, `payment.findMany`, `paymentInstallment.findMany`, `paymentAllocation.*` trong transaction | Sửa HĐ tạo lại đợt rồi phân bổ lại phiếu đã thu (J4) | Không đổi kỳ vọng |
| `test/utils/report-fixtures.ts` | Sau khi ghi phiếu mẫu thẳng vào DB, gọi `reallocateContract` | Phiếu ghi trực tiếp (không qua service) chưa có phân bổ; dữ liệu mới yêu cầu phân bổ lưu | Không đổi số liệu mẫu hay kỳ vọng của `reports.e2e`, `dashboard.e2e` |

## 07-C (29/10/2026) — vòng đời phiếu thu

Đặc tả đã duyệt đổi hành vi: phiếu mới là **Nháp**, chỉ phiếu **Đã duyệt** tính đã thu (J2); **không xoá** phiếu — rút phiếu chưa duyệt / huỷ phiếu đã duyệt có lý do (J5, `DELETE` trả 410); chứng từ khi gửi duyệt (J8); người lập không tự duyệt (J1).

| File | Thay đổi | Lý do | Kiểm chứng giữ nguyên |
| --- | --- | --- | --- |
| `test/utils/payments.ts` (mới) | Hàm `collectPayment`: Kế toán thu tiền lập phiếu tiền mặt có số phiếu giấy → gửi duyệt → GĐ duyệt | Theo J1/J2/J8, phiếu chỉ được tính đã thu sau khi duyệt; các test cũ "thu tiền rồi kiểm tra số đã thu" cần đi đủ vòng đời | Số tiền, ngày, đợt chỉ định giữ nguyên như test cũ |
| `test/contracts.e2e-spec.ts` | Test thu tiền thêm bước gửi duyệt + duyệt trước khi kiểm số đã thu; test "xoá mềm phiếu thu" thay bằng "không xoá phiếu thu: huỷ có lý do" | J2 (Nháp không tính), J5 (không xoá — `DELETE` 410) | Cùng kỳ vọng đã thu / trạng thái thanh toán sau khi duyệt; huỷ phiếu đưa đã thu về `0` như xoá trước đây, thêm kiểm 410 và trạng thái Đã huỷ |
| `test/receivables-consistency.e2e-spec.ts` | Thu qua `collectPayment`; bước "xoá phiếu" thay bằng huỷ phiếu đã duyệt (revision 3, có lý do) | J2, J5 | Cùng kỳ vọng R1 (1.000.000 ở báo cáo, thu tiền, HĐ) và khôi phục quá hạn sau khi bỏ phiếu |
| `test/audit-board.e2e-spec.ts`, `test/contract-amendments.e2e-spec.ts` | Phiếu ghi thẳng vào DB đặt `status: 'APPROVED'`; phụ lục gọi `reallocateContract` sau khi ghi phiếu | Phiếu mặc định là Nháp (không tính); dữ liệu mẫu của các test này là phiếu **đã thu** | Không đổi số liệu mẫu hay kỳ vọng |
| `test/utils/report-fixtures.ts` | Phiếu đã thu `APPROVED`; phiếu xoá mềm mẫu `PT-T-002` thêm `CANCELLED` | Như migration J15 (còn hiệu lực → Đã duyệt, đã xoá mềm → Đã huỷ) | Không đổi kỳ vọng `reports.e2e`, `dashboard.e2e` |
| `src/modules/payments/payments.service.spec.ts` | Thêm mock hạ tầng `AuditService`, `DocumentsService`, `paymentEvent.create` | Lập phiếu ghi sự kiện lịch sử và nhật ký; service nhận thêm phụ thuộc chứng từ | Không đổi kỳ vọng (chặn thu vượt, HĐ nháp, ngoài phạm vi 404, mã phiếu) |
| `apps/web/.../contract-form.page.spec.ts` | Fixture `ContractDetail` thêm `pendingAmount: '0'` | Kiểu dữ liệu chi tiết HĐ có trường mới (J2) | Không đổi kỳ vọng |

Test mới (không thay test cũ): `test/payments-lifecycle.e2e-spec.ts` (5), thêm kiểm cấp `payments:approve` trong `test/users-access.e2e-spec.ts`, `payment.rules.spec.ts` (5); web `payments.store.spec.ts` (6), `payment-drawer.component.spec.ts` (4).

## 07-D1 (29/10/2026) — công nợ, tuổi nợ

Không sửa hay nới test cũ. Thêm một kiểm tra vào `test/payments-lifecycle.e2e-spec.ts` (duyệt lại trên `revision` cũ sau khi phiếu đã duyệt → 409) để giữ cố định lỗi 07-C vừa sửa: trước đây test "duyệt đồng thời" có lúc nhận [200, 400] tuỳ thứ tự đọc phiếu. Test mới: e2e `receivables-aging` (4), unit `common/receivables.spec` (+5), web `receivables.store.spec` (3), `due-installment-table.component.spec` (2).

Công cụ test (không đổi kỳ vọng nào): `test/utils/test-app.ts` — chờ trình nghe sự kiện đang chạy trước khi `app.close()`, xoá DB có `lock_timeout` 10 giây và báo phiên giữ khoá, đóng app khi dựng dữ liệu lỗi. Lý do: sự kiện huỷ HĐ chạy ngầm sau khi test đóng app, để lại transaction giữ khoá làm bộ test sau treo/hỏng (xem current-status, Kiểm chứng 07-D1).

## 07-D2 (29/10/2026) — hạn theo phát hành BCKT, "Còn nợ quá hạn"

| File | Thay đổi | Lý do | Kiểm chứng giữ nguyên |
| --- | --- | --- | --- |
| `test/contracts.e2e-spec.ts` (danh sách HĐ có trạng thái thanh toán) | `paymentStatus` kỳ vọng `PARTIAL` → `OVERDUE` | Đặc tả 07 đã duyệt (Quy tắc tính) thêm trạng thái **Còn nợ quá hạn**; dữ liệu mẫu có đợt hạn 15/01/2025 mới thu 5/9,9 triệu nên đúng là quá hạn | Giữ nguyên `paidAmount` 5.000.000, dịch vụ, khách hàng; test công nợ ngay sau vẫn kiểm số quá hạn |

Khác: `apps/web/.../contract-form.page.spec.ts`: fixture `ContractDetail` thêm các trường mới của đợt (`dueRule`, `dueOffsetDays`, `milestoneDate`, `awaitingMilestone`, `overdueDays`) và `overdueAmount` — chỉ do kiểu dữ liệu đổi (J10). Test mới: e2e `installment-milestone` (4), unit `common/receivables.spec` (+2), `contract-calculator.spec` (+1), web `contract-form.page.spec` (+1).

## 07-D3 (29/10/2026) — đề nghị thanh toán DOCX + VietQR

Không sửa kỳ vọng test cũ. `src/modules/contracts/commercial-documents/docx-engine.spec.ts`: fixture thêm `bankBin` cho công ty và `id`, `allocations` cho đợt — chỉ do kiểu dữ liệu đổi (tính số còn thiếu của đợt, mã BIN cho VietQR); `buildTemplateData` giữ được cách gọi cũ (nhóm `payment` tuỳ chọn). Test mới: unit `common/utils/vietqr.spec` (4), `payment-request.builder.spec` (4); e2e `payment-requests` (4); web `payment-request.store.spec` (3).
