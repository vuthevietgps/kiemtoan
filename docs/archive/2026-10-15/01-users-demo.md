# Quản lý người dùng

> Đặc tả demo, chưa cập nhật đủ yêu cầu bổ sung 15/10/2026. Đọc [danh mục đặc tả](README.md) và [sổ quyết định](../requirements/decision-register.md); cần duyệt đặc tả 01 mới trước khi mở rộng nghiệp vụ.

Module backend: `users` (đã có). Frontend: `features/users`. Quyền: `users:view|create|update` (quản trị hệ thống có `users:*`, trưởng nhóm chỉ xem).

## API (không đổi)

| Endpoint | Quyền | Ghi chú |
| --- | --- | --- |
| `GET /users?page&pageSize&search&role` | users:view | Tìm theo họ tên / email, lọc vai trò |
| `GET /users/options` | đăng nhập | Danh sách gọn người dùng đang hoạt động |
| `GET /users/teams` | đăng nhập | Danh sách nhóm |
| `GET /users/:id` | users:view | |
| `POST /users` | users:create | Email không trùng, mật khẩu ban đầu ≥ 6 ký tự (lưu bcrypt) |
| `PATCH /users/:id` | users:update | Không đổi email; mật khẩu để trống = giữ nguyên |
| `PATCH /users/:id/lock`, `/unlock` | users:update | Không tự khoá được tài khoản của mình. Tài khoản khoá không đăng nhập được, token cũ bị từ chối |

Không bao giờ trả `passwordHash`. Thao tác thêm/sửa/khoá được ghi nhật ký tự động (module `users`).

## Giao diện `/users`

- Thẻ "Quyền của từng vai trò" (thu gọn được) mô tả quyền mặc định của Giám đốc, Kế toán trưởng / Trưởng nhóm, Nhân viên nghiệp vụ, Kế toán thu tiền, Quản trị hệ thống.
- Bảng phân trang phía server: họ tên (+ chức danh), email, vai trò (nhãn `ROLE_LABELS`), nhóm, trạng thái, đăng nhập gần nhất.
- Bộ lọc: ô tìm kiếm (trễ 300 ms), chọn vai trò.
- Modal thêm/sửa: họ tên, email (chỉ khi thêm), mật khẩu ban đầu / đặt lại mật khẩu, vai trò, nhóm, chức danh, điện thoại.
- Nút Thêm (`users:create`), Sửa và Khoá / Mở khoá có xác nhận (`users:update`).
