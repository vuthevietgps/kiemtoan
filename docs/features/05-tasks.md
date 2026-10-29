# 05 – Công việc, Lịch & Deadline, Thông báo

> **Từ 22/10/2026:** đặc tả thay thế là [05-tasks-workflow.md](05-tasks-workflow.md) (8 trạng thái, soát xét nhiều cấp, hồ sơ, hạn). File này chỉ giữ để đối chiếu hành vi demo hiện có.

> Đặc tả demo, công việc thuộc 05; lịch/deadline/thông báo thuộc 06 khi hoàn thiện. Luồng trạng thái và soát xét cần cập nhật theo PL1 và QD04 trước code; xem [danh mục đặc tả](README.md), [sổ quyết định](../requirements/decision-register.md).

Module backend: `tasks`, `notifications` (`apps/api/src/modules/…`). Frontend: `features/tasks`, `features/calendar`,
`features/notifications/notification-bell.component.ts`. Quyền: `tasks:*` (quản lý), `tasks:view|update` (nhân viên),
`deadlines:view` (trang lịch), `notifications:view` (mọi vai trò).

## User story

- Là **nhân viên**, tôi xem các việc được giao (cần làm hôm nay, còn phải làm, quá hạn, thiếu bằng chứng), chuyển
  Chưa làm → Đang làm → Đã làm và tải file bằng chứng lên.
- Là **kế toán trưởng / giám đốc**, tôi lọc việc của cả nhóm theo khách hàng / nhân viên, xem thống kê theo khách hàng và
  khối lượng từng nhân viên, duyệt hoặc trả lại việc đã làm, giao lại việc, thêm việc phát sinh.
- Khi hợp đồng được duyệt, hệ thống tự sinh danh sách việc của từng dịch vụ và báo cho người được giao.

## Quy tắc nghiệp vụ

- **Tự sinh việc** (`task-generator.ts`, hàm `generateTasksForContract(prisma, contractId)`), chạy khi nhận sự kiện
  `CONTRACT_APPROVED`: mỗi dòng dịch vụ × mỗi công việc mẫu của loại dịch vụ.
  - Kỳ = `contractService.period` ('YYYY-MM', 'YYYY-Qn' hoặc 'YYYY'), không có thì lấy tháng của `contract.startDate`.
  - Hạn = ngày cuối kỳ + `dueDayOffset`. Người làm = người phụ trách dòng dịch vụ → người phụ trách HĐ → người phụ trách KH.
  - Dòng dịch vụ đã có việc thì bỏ qua (chạy lại không sinh trùng). Mỗi việc có người làm → phát `TASK_ASSIGNED`.
- **Phạm vi**: `taskScope(user)` — nhân viên chỉ thấy việc giao cho mình; trưởng nhóm thấy việc của nhóm và của khách hàng
  trong nhóm; giám đốc thấy tất cả. Ngoài phạm vi → **404**.
- **Chuyển trạng thái** (`task-status.rules.ts`): đi tới / lùi tự do giữa 3 trạng thái, nhưng
  - nhân viên chỉ đổi việc giao cho mình (**403**); chỉ quản lý (`tasks:approve`) được lùi từ Đã làm ("Trả lại", xoá thông tin duyệt);
  - sang Đã làm khi việc bắt buộc bằng chứng mà chưa có file → **400** "Vui lòng tải lên file bằng chứng trước khi chuyển sang Đã làm";
  - ghi `startedAt` (lần đầu bắt đầu), `completedAt` (khi Đã làm). Mỗi lần chuyển ghi nhật ký `STATUS {from, to}`.
- **Tiến độ** (`task-progress.ts`): có việc bắt đầu → dòng dịch vụ và HĐ (nếu đang Chưa thực hiện) sang Đang thực hiện;
  mọi việc của dòng dịch vụ Đã làm → dòng dịch vụ hoàn thành; mọi dòng hoàn thành → HĐ Đã hoàn thành. Trả lại việc thì quay về Đang thực hiện.
- **Bằng chứng**: file ≤ 20MB lưu bằng `StorageService`, tạo `Document` loại `EVIDENCE` gắn KH / HĐ / việc / kỳ.
  Tải về qua `GET /documents/:id/download?token=` (module documents).
- **Duyệt**: chỉ việc Đã làm, chưa duyệt; lưu `approvedById/approvedAt`, nhật ký `APPROVE`.
- **Giao lại** (đổi `assigneeId`): chỉ quản lý; người mới nhận thông báo.
- Bộ lọc hạn: `overdue` = quá hạn chưa xong; `today` = hạn hôm nay; `week` = hạn trong 7 ngày tới; `month` = hạn trong tháng này.
  "Thiếu bằng chứng" = việc bắt buộc bằng chứng chưa có file nào.

## API (`/api/v1`)

| Phương thức | Đường dẫn | Quyền | Ghi chú |
| --- | --- | --- | --- |
| GET | `/tasks?page&pageSize&status&customerId&contractId&contractServiceId&assigneeId&period&due&missingEvidence&completedThisMonth&mine&search` | tasks:view | `status` thêm `OPEN` (chưa Đã làm). Sắp theo hạn. Mỗi dòng kèm `customer`, `contract`, `serviceTypeName`, `assignee`, `evidenceCount`, `isOverdue` |
| GET | `/tasks/summary?mine` | tasks:view | `{dueToday, remaining, overdue, doneThisMonth, missingEvidence, byStatus}` |
| GET | `/tasks/by-customer` | tasks:approve | Mỗi KH: todo / inProgress / done / overdue / missingEvidence |
| GET | `/tasks/workload` | tasks:approve | Mỗi nhân viên: open / overdue / doneThisMonth |
| GET | `/tasks/calendar?from&to&mine` | tasks:view | Việc có hạn trong khoảng, trường gọn |
| GET | `/tasks/:id` | tasks:view | Chi tiết + `documents` (bằng chứng) + `history` (nhật ký) |
| POST | `/tasks` | tasks:create | Việc phát sinh: customerId, contractId?, title, dueDate, assigneeId?, requiresEvidence, note |
| PATCH | `/tasks/:id` | tasks:update | title, dueDate, note; `assigneeId` chỉ quản lý |
| POST | `/tasks/:id/status` | tasks:update | `{status}` theo quy tắc trên |
| POST | `/tasks/:id/evidence` | tasks:update | multipart `file` + `note` |
| POST | `/tasks/:id/approve` | tasks:approve | |
| GET | `/notifications` | notifications:view | 20 thông báo mới nhất của tôi + `unreadCount` |
| POST | `/notifications/:id/read`, `/notifications/read-all` | notifications:view | Chỉ thông báo của mình (khác → 404) |

## Giao diện

- `/tasks` – "Công việc": 5 ô đếm (bấm để lọc), bộ lọc khách hàng / trạng thái / hạn / thiếu bằng chứng / tìm kiếm; quản lý có thêm
  chọn nhân viên và công tắc "Việc của tôi / Tất cả trong phạm vi". Hai chế độ Bảng (phân trang server) và Kanban 3 cột (nút chuyển).
  Drawer chi tiết: nút trạng thái (thiếu bằng chứng thì mở ô upload, tải xong tự chuyển Đã làm), file bằng chứng có link tải,
  Duyệt / Trả lại (quản lý), giao lại, lịch sử. Tab "Theo khách hàng" và "Khối lượng nhân viên" cho quản lý.
  Query `?id=` mở sẵn drawer, `?customerId=` lọc sẵn.
- `/calendar` – lịch tháng, màu theo trạng thái / quá hạn, bấm ngày xem danh sách, bấm việc mở `/tasks?id=`.
- Chuông thông báo: badge chưa đọc, danh sách, bấm → đánh dấu đã đọc + điều hướng, "Đánh dấu đã đọc tất cả", tự tải lại mỗi 60 giây.

## Seed (`prisma/seed/tasks.seed.ts`)

Chạy sau `seedContracts`. Với HĐ khác Nháp / Chờ duyệt / Huỷ: sinh việc; HĐ hoàn thành / thanh lý → mọi việc Đã làm kèm file bằng chứng giả;
HĐ đang thực hiện → khoảng nửa số việc Đã làm / Đang làm, còn lại Chưa làm (một việc quá hạn, một việc hạn hôm nay, một việc hạn trong tuần);
tạo vài thông báo. Không có HĐ thì bỏ qua.
