# Giải trình thay đổi test — chức năng 03

Căn cứ: [đặc tả 03](03-service-catalog.md) quyết định **D3** (người dùng duyệt 15/10/2026): bộ sinh việc đọc phiên bản quy trình đang hiệu lực, bỏ API `PUT /service-types/:id/task-templates`. Hành vi thay đổi theo đặc tả, không phải để làm test xanh. Mỗi thay đổi giữ hoặc tăng mức kiểm chứng.

| Test | Thay đổi | Kiểm chứng giữ lại / bổ sung |
| --- | --- | --- |
| `test/service-catalog.e2e-spec.ts` — "thay danh sách việc mẫu, trả về theo thứ tự" | Thay bằng "API việc mẫu cũ đã bỏ; nhân viên đọc quy trình đang hiệu lực theo thứ tự bước" | Vẫn kiểm tra thứ tự bước và quyền đọc của nhân viên; thêm: endpoint cũ trả 404, danh sách dịch vụ có `defaultWorkflow` |
| `src/modules/tasks/task-generator.spec.ts` | Dữ liệu giả đổi từ `serviceType.taskTemplates` sang phiên bản quy trình cùng nội dung (tên, số ngày lệch, bằng chứng) | Giữ nguyên mọi kỳ vọng cũ (hạn, kỳ, người làm, chống trùng, HĐ không tồn tại); thêm lập lịch theo dự án và trường hợp dịch vụ chưa có quy trình |
| `test/tasks.e2e-spec.ts` | Phần dựng dữ liệu tạo quy trình mặc định + phiên bản đang hiệu lực thay cho việc mẫu | Không đổi bất kỳ kỳ vọng nào về việc được sinh |

Không có test nào bị xoá, bỏ qua hoặc nới điều kiện. Test hồi quy mới cho lỗi phát hiện khi chạy giao diện: đọc phiên bản rồi gửi lại nguyên bước phải lưu được (`workflow-templates.e2e-spec.ts`).
