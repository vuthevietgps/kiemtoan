# 06 — Thay đổi test hiện có

Theo quy tắc mục 8: chỉ đổi test khi đặc tả được duyệt thay đổi; không nới kỳ vọng.

| Test | Thay đổi | Lý do | Mức kiểm chứng |
| --- | --- | --- | --- |
| `apps/api/src/modules/tasks/task-generator.spec.ts` | Mock Prisma thêm `businessCalendarYear.findMany → []` | Bộ sinh việc đọc lịch làm việc 06 (I2/I3, đặc tả duyệt 23/10). Mock trả "chưa có năm xác nhận" = thứ 2–6 như trước | Không đổi kỳ vọng nào; mọi hạn/kỳ/người làm vẫn kiểm như cũ |
| `apps/api/src/modules/customers/customers.service.spec.ts` | Thêm provider `EventEmitter2` (mock) | `CustomersService` phát sự kiện đổi hồ sơ thuế (I5) | Không đổi kỳ vọng |
| `apps/api/src/modules/customers/customer-workbook.util.spec.ts` | Dòng mẫu round-trip thêm 5 cột thuế–kế toán có giá trị thật | Mẫu Excel thêm 5 cột (phạm vi 02 được duyệt cùng 06) | Mạnh hơn: kiểm thêm 5 cột đọc/ghi đúng |

Thêm mới (không sửa test cũ): `working-calendar.spec.ts` (5), `obligation.rules.spec.ts` (8), `obligation-sync.spec.ts` (4), `deadlines-obligations.e2e-spec.ts` (7), `deadlines-access.e2e-spec.ts` (3); web: `workflow-editor.store.spec.ts` +1 (hồi quy, đỏ trước khi sửa), `workflow-step-form.component.spec.ts` +3, `customer-form.component.spec.ts` +1.
