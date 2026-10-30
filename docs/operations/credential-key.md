# Khoá mã hoá kho tài khoản khách hàng (`CREDENTIAL_KEY`)

Áp dụng từ 09 ([đặc tả](../features/09-client-credentials.md), L12). Mật khẩu cổng và mã PIN token của khách hàng
được mã hoá AES-256-GCM bằng `CREDENTIAL_KEY` (đúng 32 ký tự). Database chỉ chứa bản mã; **mất khoá = mất toàn bộ
mật khẩu đã lưu**, không có cách khôi phục.

## Giữ khoá

- Sinh khoá ngẫu nhiên cho mỗi môi trường thật, không dùng giá trị mẫu trong `.env.app.example`:

  ```powershell
  node -e "process.stdout.write(require('crypto').randomBytes(16).toString('hex'))"
  ```

- Khoá chỉ nằm trong file môi trường của máy chủ (`.env.app`, biến `CREDENTIAL_KEY` của `compose.app.yml`) và một
  bản lưu ngoại tuyến do Giám đốc / người được chỉ định giữ (két, trình quản lý mật khẩu của công ty).
- **Không** để khoá cùng nơi với bản sao lưu database: `scripts/backup-app.ps1` không chép file môi trường — giữ nguyên
  như vậy. Ai có cả bản sao lưu lẫn khoá thì đọc được mọi mật khẩu.
- Không gửi khoá qua chat / email, không ghi vào tài liệu, không đưa vào git.

## Kiểm tra khoá

Giải mã thử mọi bí mật (kể cả tài khoản đã xoá mềm), chỉ in số lượng và id bản ghi lỗi, không in mật khẩu:

```powershell
# Máy phát triển (trong apps/api, DATABASE_URL và CREDENTIAL_KEY lấy từ môi trường)
npm run credential-key -- check

# Máy chủ Compose
docker compose --env-file .env.app -p ketoan-app -f compose.app.yml exec api node dist/src/core/crypto/credential-key.cli.js check
```

Exit code `0` = mọi bí mật giải mã được. Exit code `1` = có bản ghi lỗi (khoá sai hoặc dữ liệu hỏng). Chạy sau mỗi
lần khôi phục, chuyển máy chủ hoặc đổi file môi trường.

## Sao lưu và khôi phục

1. Sao lưu theo `scripts/backup-app.ps1` (README dự án).
2. Khôi phục vào project mới bằng `scripts/restore-app.ps1`, với `CREDENTIAL_KEY` **giống nguồn**.
3. Chạy `check` trên project mới. Có lỗi → dừng, không chuyển lưu lượng; kiểm tra lại khoá đã dùng.

Khi khoá sai, API vẫn chạy nhưng nút Xem / Sao chép báo "Không giải mã được — khoá mã hoá trên máy chủ không khớp dữ
liệu" và không ghi nhật ký đã xem.

## Xoay khoá (định kỳ hoặc khi nghi lộ khoá)

1. Sao lưu trước (bước trên) và giữ khoá cũ cho tới khi xong.
2. Sinh khoá mới; chạy với khoá cũ ở `CREDENTIAL_KEY`, khoá mới ở `NEW_CREDENTIAL_KEY` (chỉ qua biến môi trường,
   không truyền khoá làm tham số lệnh):

   ```powershell
   $env:NEW_CREDENTIAL_KEY = '<khoá mới>'
   npm run credential-key -- rotate
   # Compose: thêm -e NEW_CREDENTIAL_KEY=... vào docker compose exec, lệnh node ... credential-key.cli.js rotate
   ```

   Lệnh chỉ chạy khi khoá cũ giải mã được **mọi** bản ghi; mã hoá lại trong một transaction, kiểm tra bằng khoá mới,
   lỗi bất kỳ thì huỷ toàn bộ. Không đổi `updated_at` / `revision`. Ghi một dòng `ROTATE_KEY` vào nhật ký hoạt động.
3. Thay `CREDENTIAL_KEY` trong file môi trường bằng khoá mới, khởi động lại API, chạy `check`.
4. Cập nhật bản lưu ngoại tuyến của khoá; huỷ khoá cũ sau khi bản sao lưu mới (bằng khoá mới) đã được kiểm tra.
   Bản sao lưu cũ vẫn cần **khoá cũ** để đọc — giữ khoá cũ cùng thời hạn lưu của các bản sao lưu đó.

## Bằng chứng đã thử (30/10/2026, máy cục bộ)

Bản sao demo `ketoan_mig_09b` → `pg_dump` (262 KB) → `pg_restore` vào DB mới:

| Bước | Kết quả |
| --- | --- |
| `check` khoá đúng | 4 bí mật, lỗi 0, exit 0 |
| `check` khoá sai | lỗi 4/4 (in id), exit 1 |
| `check` khoá không đủ 32 ký tự | "CREDENTIAL_KEY phải dài đúng 32 byte", exit 1 |
| `rotate` sang khoá ngẫu nhiên mới | mã hoá lại 4, kiểm tra lại lỗi 0; `password_enc` đổi, `updated_at` / tổng `revision` giữ nguyên; nhật ký `ROTATE_KEY {"count": 4}` |
| `check` sau xoay: khoá mới / khoá cũ | lỗi 0 / lỗi 4 |
| `rotate` khi khoá cũ sai | "Khoá cũ không giải mã được 4/4 bản ghi — không xoay khoá", exit 1, không đổi dữ liệu |
