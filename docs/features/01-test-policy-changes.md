# Lý do cập nhật test trong chức năng 01

Ngày 15/10/2026. Căn cứ: [đặc tả 01 được người dùng ủy quyền chốt](01-users-access-control.md). Không đổi công thức tiền, không skip test, không giảm số khẳng định về số tiền, scope hoặc audit để che lỗi.

| File | Hành vi cũ thay đổi do chính sách mới | Cách giữ kiểm chứng |
| --- | --- | --- |
| `users.service.spec.ts`, `auth-users.e2e-spec.ts` | Mật khẩu mới tối thiểu 10 ký tự, service thêm dependency kiểm tra quyền | Đổi mật khẩu tạo mới sang giá trị mạnh; giữ kiểm tra tạo đúng một lần/không lưu hoặc trả plaintext/hash; thêm provider đúng dependency mới; mật khẩu login fixture cũ giữ để kiểm tra tương thích |
| `customers-credentials.e2e-spec.ts` | STAFF không mặc định xem bí mật; phải xác nhận lại mật khẩu | Cấp quyền bằng API giám đốc, đăng nhập lại và xác nhận mật khẩu trước luồng reveal; giữ kiểm tra mã hoá, nội dung bí mật, log và 404 ngoài phân công. Suite mới kiểm tra mặc định 403, thiếu/hết hạn xác nhận 403 |
| `contracts.e2e-spec.ts` | STAFF không mặc định đề nghị hoá đơn hoặc nhận trường tiền | Dùng trưởng nhóm có quyền để giữ mọi khẳng định số tiền/đợt/hoá đơn; giữ STAFF 403, STAFF GET ngoài phân công 404 và thêm MANAGER tạo hoá đơn ngoài nhóm 404; suite mới kiểm tra API STAFF không có trường tiền |
| `dashboard.e2e-spec.ts` | Số tiền chỉ trả khi có quyền | Thêm kiểm tra ẩn tiền mặc định, cấp quyền qua API và đăng nhập lại để giữ các phép đối chiếu tiền/phạm vi đã có |
| `reports.e2e-spec.ts` | Quyền tài chính tách vận hành | Cấp/thu hồi quyền tài chính qua API để giữ kiểm tra doanh thu STAFF đúng phạm vi; hiệu suất STAFF không có revenue, đồng thời giữ đối chiếu 1.500.000 đ ở response trưởng nhóm có quyền |
| `customers.e2e-spec.ts` | HĐ trong KH360 không lộ tổng tiền cho STAFF | Giữ mã HĐ và bộ đếm, kiểm tra STAFF không có total và tổng 11.000.000 đ vẫn đúng với trưởng nhóm |
| `test/utils/setup-env.ts` | Test lời mời/reset có khả năng gọi SMTP | Tắt gửi email thật trong e2e để không liên lạc ra ngoài; kiểm tra dịch vụ SMTP riêng bằng mock transport, không mock phân quyền hoặc dữ liệu tài chính |

Hai lỗi ban đầu ở **test mới** được sửa tại test harness: dùng import tĩnh Supertest cho Jest CommonJS; yêu cầu parser nhị phân đúng cho response XLSX. Giữ kiểm tra workbook/ZIP/nội dung và log, không đổi thành kiểm tra rỗng hoặc bỏ test.
