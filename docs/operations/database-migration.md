# Baseline migration cho database hiện có

Ngày kiểm tra: **15/10/2026**. Prisma 6 dùng schema nhiều file trong
`apps/api/prisma/schema/`; migration phải nằm trong
`apps/api/prisma/schema/migrations/` để lệnh Prisma nhận ra.

Baseline `20261015000000_initial_baseline` mô tả toàn bộ cấu trúc đã có trong schema.
Nó tạo bảng trên database trống. Trên database đã có cấu trúc từ `prisma db push`,
phải kiểm tra schema và **ghi nhận baseline đã áp dụng**; không chạy SQL tạo bảng lần nữa.

## Database trống

Đặt `DATABASE_URL` tới database cần khởi tạo, sau đó chạy trong `apps/api`:

```powershell
npm run db:migrate:deploy
npm run db:migrate:status
```

Chỉ với database dev cần dữ liệu mẫu, chạy tiếp `npm run db:seed`.
Không seed trên database dùng thật.

## Database đã có dữ liệu từ `db push`

1. Xác nhận đúng URL và tạo bản sao lưu có thể phục hồi, gồm database và file upload.
2. Chạy trong `apps/api`, với `DATABASE_URL` trỏ đúng database cần chuyển:

```powershell
node node_modules/prisma/build/index.js migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema --exit-code
```

Chỉ tiếp tục nếu công cụ báo `No difference detected.` và exit code **0**.
Exit code **2** nghĩa là schema khác: phải xác định nguyên nhân và chuẩn bị migration thích hợp;
không đánh dấu baseline đã áp dụng.

3. Khi schema khớp, ghi nhận baseline và kiểm tra lại:

```powershell
node node_modules/prisma/build/index.js migrate resolve --applied 20261015000000_initial_baseline
npm run db:migrate:status
npm run db:migrate:deploy
```

`migrate resolve` chỉ ghi vào `_prisma_migrations`; nó không chạy `CREATE TABLE` lên bảng
đã tồn tại. Giữ nguyên thư mục migration sau khi ghi nhận; những thay đổi schema tiếp theo
được tạo thành migration mới, không sửa baseline.

## Database test e2e

`npm run test:e2e` áp dụng migrations lên database do `TEST_DATABASE_URL` chỉ định,
rồi từng suite test có thể xoá dữ liệu trong database đó. Tên database phải kết thúc `_test`
hoặc bắt đầu `ketoan_codex_`. Không dùng database demo `ketoan`.

Nếu database test cũ đã được tạo bằng `db push`, chuyển nó theo quy trình baseline ở trên
hoặc tạo database test mới. Script test không tự đánh dấu một schema chưa được đối chiếu.

## Bằng chứng kiểm tra của baseline

- Database PostgreSQL 16 test trống: `migrate deploy` áp dụng 1 migration; `migrate status`
  báo schema mới nhất.
- Database test mô phỏng hiện trạng: `db push` tạo schema, sau đó thêm một dòng mẫu
  vào `teams`; `migrate diff --exit-code` báo không khác biệt; `migrate resolve` thành công;
  `migrate deploy` không có migration chờ và dòng mẫu vẫn còn.
- Hai database trên đều nằm trong container test riêng `ketoan-codex-foundation-20261015`
  tại `127.0.0.1:5435`; không dùng database demo của dự án.
- Database test thứ ba `ketoan_codex_e2e` được khởi tạo bằng baseline khi chạy
  `npm run test:e2e`; **11 suites/82 tests đạt**. Thử tên `ketoan` bị chặn trước khi kết nối.
- Container test riêng đã được dừng và xoá sau kiểm tra.

Việc chạy quy trình với dữ liệu thật vẫn cần kiểm tra schema và bản sao lưu của chính môi trường đó.
