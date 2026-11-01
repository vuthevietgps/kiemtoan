# 10 — Giải trình thay đổi test cũ

Theo quy tắc mục 8: chỉ đổi test khi đặc tả được duyệt thay đổi hoặc chứng minh test cũ sai; ghi lý do trước khi đổi, giữ mức kiểm chứng tương đương. Đặc tả [10](10-overview-reports.md) và M1–M14 được duyệt ngày 30/10/2026.

## 10-B (30/10/2026) — tổng quan Vận hành / Tài chính

| File | Thay đổi | Lý do | Kiểm chứng giữ nguyên / thay thế |
| --- | --- | --- | --- |
| `test/dashboard.e2e-spec.ts` | Gọi `GET /dashboard/finance` thay `GET /dashboard`; bỏ các khẳng định khối việc (`myTasks`, `myTaskItems`, `upcoming`, `reportDeadlines`); nhân viên chưa có quyền tài chính nhận **403** thay vì JSON đã lược tiền; quản trị 403 ở cả hai đường dẫn | M1: tổng quan tách tab Vận hành (mọi người) và Tài chính (chỉ `finance:view`); khối việc 3 nhóm cũ được thay bằng việc ưu tiên / lịch hạn của tab Vận hành | Giữ nguyên mọi số tài chính (doanh thu 3.000.000 so kỳ trước 500.000 = +500%; thêm: kỳ so sánh bằng 0 → `changePercent` null theo M5, tổng thanh toán, HĐ 3 / mới 2, dịch vụ 1/3, biểu đồ theo loại dịch vụ, đã thu 300.000 không tính phiếu huỷ, HĐ gần đây, phạm vi nhân viên được cấp quyền tài chính, lọc kỳ trước, kỳ ngược 400). Khối việc kiểm ở `dashboard-operations.e2e` mới |
| `test/utils/report-fixtures.ts` | HĐ mẫu HD-T-001 / 002 / 004 thêm `approvedAt` (10:00 giờ VN cùng ngày bắt đầu) | M4: giá trị HĐ trên tổng quan tính theo **ngày duyệt**; dữ liệu mẫu cũ không có ngày duyệt | Không đổi số liệu nào khác; báo cáo demo (`reports.e2e`) vẫn tính theo ngày bắt đầu đến 10-D, kết quả giữ nguyên |
| `test/permissions-financial.e2e-spec.ts` (tổng quan) | Nhân viên: kiểm `GET /dashboard/operations` không có khoá / giá trị tiền và `GET /dashboard/finance` → 403 (thay kiểm JSON `/dashboard` đã lược tiền). Thu tiền: các thẻ / danh sách việc là `null` ở `/dashboard/operations` (thay kiểm thiếu khoá `myTasks`…) | M1, M2: tab Tài chính chỉ người có `finance:view`; người không có `tasks:view` nhận null | Giữ: nhân viên không thấy tiền, thu tiền không thấy dữ liệu việc; các kiểm tra báo cáo / hoá đơn / thu tiền 403 không đổi |
| `test/users-access.e2e-spec.ts` (2 dòng) | `GET /dashboard` → `GET /dashboard/operations` | Đường dẫn cũ bỏ (M1) | Vẫn 403 cho quản trị và vai trò tuỳ chỉnh không có `dashboard:view` |

## 10-D (30/10/2026) — báo cáo tài chính

| File | Thay đổi | Lý do | Kiểm chứng giữ nguyên / thay thế |
| --- | --- | --- | --- |
| `test/reports.e2e-spec.ts` (doanh thu theo khách hàng; nhân viên được cấp quyền tiền) | Đọc `contractValue` thay `subtotal` (dòng và tổng) | M4: báo cáo Doanh thu có 3 thước đo; giá trị HĐ tính theo **ngày duyệt** (dữ liệu mẫu đã có ngày duyệt từ 10-B) | Giữ nguyên mọi số: B 1 HĐ 2.000.000, A 2 HĐ 1.500.000, tổng 3.500.000 (bỏ HĐ nháp); nhân viên được cấp quyền chỉ thấy 2 HĐ / 1.500.000 của mình. Thước đo mới kiểm ở `finance-reports.e2e` |
| `src/modules/reports/utils/report-grouping.util.spec.ts` | Bỏ 3 test `groupRevenue` (theo loại dịch vụ, theo KH / người phụ trách, theo tháng tính theo ngày bắt đầu) | Hàm `groupRevenue` bị thay bằng `revenue-measures` theo M4 (ngày duyệt, 3 thước đo, cùng kỳ năm trước) | Thay bằng `revenue-measures.spec` 4 (cùng kỳ năm trước kể cả 29/02, % thay đổi, 3 thước đo không trộn + nhóm chỉ có ở năm trước, theo loại dịch vụ hoá đơn / phiếu thu null và không sinh nhóm thừa) và `finance-reports.e2e` 4 |

## 10-E (01/11/2026) — đánh giá năng lực

| File | Thay đổi | Lý do | Kiểm chứng giữ nguyên / thay thế |
| --- | --- | --- | --- |
| `test/reports.e2e-spec.ts` (tuân thủ deadline; hiệu suất nhân viên) | Thay 2 test `/reports/task-compliance` và `/reports/staff-performance` bằng 2 test `/reports/capability` | Đặc tả 10 (M9): báo cáo demo theo việc / doanh thu người phụ trách được thay bằng Đánh giá năng lực theo khung G1–G10 (tính theo lần nộp đầu, không có tiền); tuân thủ deadline theo nghĩa vụ đã có ở 10-C | Giữ: việc xong sau hạn là trễ (nhân viên `Test staff` trễ 1, tỷ lệ 0%); nhân viên chỉ thấy chính mình và 403 khi xem người khác; JSON không có doanh thu. Cột "doanh thu HĐ phụ trách" bỏ theo M9 (đánh giá năng lực không có tiền; doanh thu theo người phụ trách đã có ở báo cáo Doanh thu, kiểm ở `reports.e2e` và `finance-reports.e2e`) |
| `test/permissions-financial.e2e-spec.ts` (thu tiền; thu hồi quyền tài chính) | Thu tiền 403 ở `/reports/capability`, `/reports/capability/export`, `/reports/deadline-compliance` (thay 2 đường dẫn cũ + CSV); nhân viên 200 ở `/reports/capability`; KTT bị thu hồi quyền tài chính: JSON 3 tab không có khoá tiền, Excel tải được (thay JSON / CSV hiệu suất không có "Doanh thu") | Đường dẫn cũ bỏ; báo cáo mới không có số tiền ở mọi vai | Giữ: thu tiền không xem báo cáo vận hành; nhân viên xem được; thu hồi quyền tài chính không lộ tiền và `/reports/revenue` vẫn 403 |
| `src/modules/reports/utils/report-grouping.util.spec.ts` | Bỏ 2 test `summarizeCompliance` | Hàm bỏ cùng báo cáo demo (thay bằng `capability.rules` và báo cáo 10-C) | Thay bằng `capability.rules.spec` 15 (nộp 23:30 / 00:30 giờ VN, chờ khách chỉ cộng cho hạn nội bộ, hạn pháp lý, hạn gốc, việc không soát xét, dữ liệu chuyển đổi, gộp khoảng chờ, mẫu số tỷ lệ, kỳ dịch vụ, người giữ vai khi đổi giữa kỳ) và `capability.e2e` 7 |
