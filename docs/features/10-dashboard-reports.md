# Tổng quan, Báo cáo, Nhật ký hoạt động

> Đặc tả demo, dashboard/báo cáo thuộc 10; audit thuộc 01 khi hoàn thiện. Bố cục, quyền tài chính và phép tính cần cập nhật theo [phạm vi mới](../requirements/scope-and-traceability.md), [sổ quyết định](../requirements/decision-register.md).

Module backend: `dashboard`, `reports`, `audit-log`. Frontend: `features/dashboard`, `features/reports`, `features/audit-log`.
Mọi số liệu đọc trực tiếp từ bảng bằng Prisma và lọc theo phạm vi dữ liệu
(`contractScope / taskScope / customerScope`): giám đốc, kế toán thu tiền thấy toàn công ty; trưởng nhóm thấy nhóm;
nhân viên thấy khách hàng/hợp đồng/công việc được phân công; quản trị hệ thống không có phạm vi (số 0, và không có quyền `dashboard:view`, `reports:view`).

## Quy ước tính

- **Hợp đồng tính doanh thu trong kỳ**: chưa xoá, trạng thái khác Nháp / Chờ duyệt / Huỷ, `startDate` thuộc kỳ.
- **Doanh thu** = tổng `subtotal` (chưa VAT); **Tổng giá trị thanh toán** = tổng `total`.
- **% so kỳ trước**: kỳ liền trước có cùng số ngày (01–31/10 → 31/08–30/09). Kỳ trước = 0 → `null` (giao diện ghi "Kỳ trước chưa có số liệu").
- **Tổng số hợp đồng** = hợp đồng còn hiệu lực trong kỳ (bắt đầu ≤ cuối kỳ, chưa kết thúc trước đầu kỳ); **mới** = bắt đầu trong kỳ.
- **Dịch vụ** = các dòng `ContractService` của hợp đồng trong kỳ; hoàn thành = `COMPLETED`.
- **Thanh toán**: đã thu = tổng `Payment` chưa xoá; còn lại = tổng `total` − đã thu (không âm).
- **Đúng hạn**: ngày hoàn thành (giờ Việt Nam) ≤ hạn. Việc DONE không có `completedAt` coi là đúng hạn.
- **Quá hạn công nợ** (mỗi hợp đồng): tổng các đợt `PaymentInstallment` có hạn trước hôm nay − đã thu, không âm.

## API

| Endpoint | Quyền | Ghi chú |
| --- | --- | --- |
| `GET /dashboard?from&to` | dashboard:view | Mặc định tháng hiện tại. Trả `kpis`, `revenueByServiceType`, `serviceStatus`, `paymentStatus`, `recentContracts` (5 HĐ mới nhất), `myTasks` (đếm theo trạng thái của người đăng nhập), `myTaskItems` (5 việc mỗi trạng thái), `upcoming` (việc của mình/phạm vi, hạn trong 14 ngày, chưa xong), `reportDeadlines` (5 việc chưa xong gần hạn nhất trong phạm vi, gồm cả quá hạn) |
| `GET /reports/revenue?from&to&groupBy=serviceType\|customer\|owner\|month` | reports:view | Mặc định năm hiện tại. Theo loại dịch vụ: cộng thành tiền dòng dịch vụ (tổng thanh toán = × (1 + VAT)) |
| `GET /reports/receivables` | reports:view | Công nợ theo khách hàng: tổng, đã thu, còn lại, quá hạn |
| `GET /reports/task-compliance?from&to` | reports:view | Việc có hạn trong kỳ: đúng hạn / trễ hạn / chưa xong đã quá hạn, theo tháng và theo nhân viên |
| `GET /reports/staff-performance?from&to` | reports:view | Nhân viên (STAFF, MANAGER) trong phạm vi: việc hoàn thành trong kỳ, tỷ lệ đúng hạn, số KH phụ trách, doanh thu HĐ phụ trách |
| `…?format=csv` | thêm reports:export | CSV UTF-8 có BOM, `Content-Disposition: attachment`. Tải trực tiếp bằng `&token=<jwt>` |
| `GET /audit-logs?page&pageSize&userId&entity&action&from&to&search` | audit-log:view | Mới nhất trước, kèm `user {fullName, email}` |
| `GET /audit-logs/entities` | audit-log:view | Danh sách module đã có nhật ký (cho bộ lọc) |

## Giao diện

- `/dashboard`: lời chào, chọn khoảng ngày, 5 thẻ KPI (tiền rút gọn "2,85 tỷ"/"120 tr"), cột doanh thu theo loại dịch vụ,
  donut tình trạng dịch vụ, donut tình hình thanh toán (ẩn nếu không có `payments:view`), bảng hợp đồng gần đây (ẩn cột "Đã thu" nếu không có `payments:view`),
  khối Công việc & Deadline (3 tab + việc sắp đến hạn), khối Nhắc việc đến hạn. Lưới 5 → 3 → 2 → 1 cột theo độ rộng màn hình.
- `/reports`: 4 tab (Doanh thu, Công nợ, Tuân thủ deadline, Hiệu suất nhân viên), chung bộ chọn khoảng ngày (mặc định năm nay), nút "Xuất CSV" theo quyền.
- `/audit-log`: bảng nhật ký, lọc người dùng / module / hành động / khoảng ngày; nhãn hành động tiếng Việt.

## Kiểm thử

- Unit: `src/modules/reports/utils/*.spec.ts` (% thay đổi, kỳ trước, gom nhóm doanh thu, quá hạn, đúng hạn/trễ hạn, CSV).
- e2e: `test/dashboard.e2e-spec.ts`, `test/reports.e2e-spec.ts` (dữ liệu tạo trong `test/utils/report-fixtures.ts`).
