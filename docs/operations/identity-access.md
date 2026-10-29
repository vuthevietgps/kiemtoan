# Vận hành tài khoản và phân quyền

Áp dụng chức năng 01 ngày 15/10/2026. [Ma trận quyền](../features/01-users-access-control.md), [biên bản nghiệm thu](../features/01-users-acceptance.md).

## Triển khai

1. Sao lưu DB và bảo quản khoá mã hoá theo hướng dẫn vận hành. Thử migration trên bản sao trước khi triển khai dữ liệu thật.
2. Cập nhật biến môi trường theo `apps/api/.env.example`: JWT_SECRET riêng, CORS_ORIGIN và APP_PUBLIC_URL đúng địa chỉ HTTPS. Cookie production có Secure; web/API cần cấu hình cùng site phù hợp SameSite Strict.
3. Trong `apps/api`, chạy `npm ci`, `npx prisma generate`, `npm run db:migrate:deploy`, `npm run build`. Migration 01 gồm `20261015020000_users_access_sessions` và `20261015030000_refresh_logout_race`; không sửa migration đã áp dụng. DB cũ chưa ghi baseline theo [hướng dẫn migration](database-migration.md).
4. Build web và khởi động ứng dụng theo README. Phiên JWT cũ không có session ID sẽ yêu cầu đăng nhập lại. Tài khoản cũ giữ mật khẩu; mật khẩu mới phải đạt chính sách 10–72 ký tự, tối đa 72 byte UTF-8, đủ hoa/thường/số/ký tự đặc biệt.

## Mời và khôi phục tài khoản

- Admin tạo tài khoản thường, gửi lời mời trong màn hình Người dùng. Link kích hoạt dùng một lần trong 24 giờ; reset trong 30 phút. Chỉ bàn giao qua kênh tin cậy, không dán vào nhật ký hoặc tài liệu công khai.
- Thiết lập SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM và APP_PUBLIC_URL. Với cổng 587 thường dùng STARTTLS (`SMTP_SECURE=false`); cấu hình theo nhà cung cấp. Thử gửi và nhận trên môi trường thử trước dùng thật.
- Không có SMTP: UI hiển thị liên kết bàn giao thủ công, nói rõ chưa gửi email. Tài khoản có quyền tiền/bí mật chỉ giám đốc nhận link thủ công; admin cần SMTP gửi thành công. Admin không reset giám đốc. Quên mật khẩu công khai luôn trả thông báo chung và không trả link.
- Admin đề nghị đổi quyền; giám đốc duyệt/từ chối ở danh sách yêu cầu có bộ lọc và phân trang. Không tự cấp quyền bản thân. Khi thay quyền, phiên và link cũ bị thu hồi; tài khoản đang chờ đổi mật khẩu lần đầu phải được gửi lại lời mời sau khi duyệt.
- Khoá/nghỉ việc giữ dữ liệu để bàn giao và thu hồi phiên. Không vô hiệu admin/giám đốc hoạt động cuối. Không tự chuyển khách hàng/công việc khi đổi nhóm.
- Người dùng xem và thu hồi phiên tại Tài khoản. Sai mật khẩu 5 lần khoá tạm 15 phút. Xem bí mật cần quyền và xác nhận lại mật khẩu trong 5 phút.

## Kiểm chứng và sự cố

Chạy `npm test -- --runInBand`, `npm run lint`, `npm run test:e2e`, `npm run test:access` trong API; hai lệnh sau bắt buộc `TEST_DATABASE_URL` trỏ DB kiểm thử riêng và chạy tuần tự vì dọn dữ liệu. Web chạy lint/test/build theo README; cuối cùng `node scripts/check-max-lines.mjs` tại gốc.

Audit chỉ xem/xuất XLSX; DB chặn UPDATE/DELETE. Không tắt trigger để sửa nhật ký. Khi mất quyền hoặc thu hồi phiên, đăng nhập lại để lấy quyền mới; kiểm tra yêu cầu đã duyệt, trạng thái tài khoản, nhóm và vai trò tuỳ chỉnh. Không chỉnh trực tiếp bảng để bỏ qua kiểm soát tài khoản cuối.

SMTP thật, HTTPS/cloud, giám sát và phục hồi dữ liệu thật chưa được chứng minh bằng bộ kiểm tra cục bộ của 01.
