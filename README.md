# Phần mềm quản lý công ty dịch vụ Kế toán & Kiểm toán — bản demo

- Backend: `apps/api` — NestJS 11, Prisma 6, PostgreSQL 16
- Frontend: `apps/web` — Angular 21, NG-ZORRO, ngx-echarts
- Quy tắc code: [docs/quy-tac-code.md](docs/quy-tac-code.md) · Đặc tả từng chức năng: [docs/features/](docs/features/)
- Tài liệu dự án: [mục lục](docs/README.md) · [đặc tả tích hợp PDF](docs/requirements/functional-description-integrated-2026-10-15.pdf) · [kế hoạch hoàn thiện](docs/planning/completion-plan.md) · [hiện trạng](docs/planning/current-status.md).

## Yêu cầu

Node.js 22, Docker Desktop (đang chạy).

## Chạy lần đầu

```bash
docker compose up -d
```

```bash
cd apps/api && npm install --legacy-peer-deps && npm run db:migrate:deploy && npm run db:seed
```

```bash
cd apps/web && npm install --legacy-peer-deps
```

`db:migrate:deploy` tạo cấu trúc bảng bằng migration; `db:seed` nạp dữ liệu mẫu.
Cấu hình nằm trong `apps/api/.env` (mẫu: `.env.example`). Với database đã có dữ liệu từ
`prisma db push`, xem [hướng dẫn chuyển sang migration](docs/operations/database-migration.md)
trước khi chạy `db:migrate:deploy`.

## Chạy hằng ngày

```bash
npm --prefix apps/api run start:dev
```

```bash
npm --prefix apps/web start
```

- Giao diện: http://localhost:4200
- Tài liệu API (Swagger): http://localhost:3000/api/docs

## Chạy bản đóng gói Docker (tách biệt bản demo)

Sao chép `.env.app.example` thành `.env.app`, đặt mật khẩu database và khoá bí mật mới,
đồng bộ mật khẩu trong `APP_DATABASE_URL`. File `.env.app` đã được loại khỏi Git.
`APP_DATABASE_URL` phải trỏ đến host `database`, database `appdb` của Compose này.
`CREDENTIAL_KEY` phải là đúng 32 byte UTF-8; thay giá trị mẫu bằng khoá riêng và giữ an toàn
vì dữ liệu đã mã hoá cần chính khoá đó để giải mã.

```bash
docker compose --env-file .env.app -p ketoan-app -f compose.app.yml up -d --build
```

Giao diện ở `http://localhost:8082`; API đi qua cùng địa chỉ tại `/api/`.
Compose dùng database và volume riêng, không công khai cổng database/API. Container
`migrate` chạy migration trước API. Thư mục upload và dữ liệu PostgreSQL nằm trên volume;
không dùng `down -v` nếu cần giữ dữ liệu. Kiểm tra trạng thái bằng:

```bash
docker compose --env-file .env.app -p ketoan-app -f compose.app.yml ps -a
```

Nếu triển khai ra máy khác, đặt `APP_BIND_ADDRESS`, `APP_WEB_PORT`, `APP_ORIGIN` phù hợp
và cấu hình HTTPS tại lớp reverse proxy của hạ tầng. Không dùng tài khoản demo hoặc
giá trị bí mật trong file mẫu ở môi trường thật.

### Sao lưu và khôi phục Compose

Trên PowerShell 7, sao lưu project đang chạy vào một thư mục mới:

```powershell
pwsh -File scripts/backup-app.ps1 -Project ketoan-app -EnvFile .env.app -OutputDir C:\secure-backups\ketoan-2026-10-15
```

Script tạm dừng web/API, sao lưu PostgreSQL và upload, tạo checksum trong `manifest.json`,
rồi khởi động lại dịch vụ. Thư mục backup chứa dữ liệu nhạy cảm; đặt trên ổ lưu trữ
được bảo vệ và kiểm tra bản sao ngoại tuyến theo chính sách vận hành.

Chỉ khôi phục vào **project Compose mới, trống**, với file môi trường riêng có
`APP_DATABASE_URL` trỏ host `database`/`appdb`, `APP_WEB_PORT` và `APP_ORIGIN` mới.
Giữ nguyên `CREDENTIAL_KEY` của nguồn để đọc được dữ liệu đã mã hoá:

```powershell
pwsh -File scripts/restore-app.ps1 -Project ketoan-restored -EnvFile .env.restored -BackupDir C:\secure-backups\ketoan-2026-10-15
```

Restore đối chiếu checksum trước khi tạo project và từ chối đích đã có container/volume.
Kiểm tra dữ liệu, đăng nhập và chạy kiểm tra khoá mã hoá kho tài khoản
([hướng dẫn](docs/operations/credential-key.md)) ở project mới trước khi chuyển lưu lượng; script không tự
chuyển tên miền hay xoá project cũ.

## Tài khoản demo (mật khẩu `Demo@123`)

| Email | Vai trò |
| --- | --- |
| giamdoc@demo.vn | Giám đốc |
| ketoantruong@demo.vn | Kế toán trưởng / Trưởng nhóm |
| nhanvien1@demo.vn, nhanvien2@demo.vn, nhanvien3@demo.vn | Nhân viên nghiệp vụ |
| thutien@demo.vn | Kế toán thu tiền |
| admin@demo.vn | Quản trị hệ thống |

## Kiểm thử

```bash
npm --prefix apps/api run lint
npm --prefix apps/web run lint
npm --prefix apps/api test -- --runInBand
npm --prefix apps/web test -- --watch=false
npm --prefix apps/api run build
npm --prefix apps/web run build
node scripts/check-max-lines.mjs
```

Các lệnh `lint` chỉ kiểm tra và không tự sửa file. Khi chủ động sửa định dạng, dùng
`npm --prefix apps/api run lint:fix` hoặc `npm --prefix apps/web run lint:fix` rồi xem lại thay đổi.

```bash
cd apps/api && npm run test:e2e
```

E2e chạy trên database riêng `ketoan_test` (tự áp dụng migration trước khi chạy),
không đụng dữ liệu demo. Để máy không bị quá tải, chạy e2e theo lô nhỏ (mỗi lô 5 file, nghỉ 5 giây,
ép Jest thoát, tối đa 10 phút/lô; có thể lọc theo tên file):

```bash
node scripts/run-e2e-batches.mjs --size 5 --pause 5
```

Không chạy song song e2e, `test:access`, test web hay build. Backend build chạy từ `apps/api/dist/src/main.js`
qua `npm --prefix apps/api run start:prod`; cần cấu hình database trước khi khởi động.

Trạng thái hoàn thiện và các kiểm tra còn thiếu: [kế hoạch](docs/planning/completion-plan.md)
và [đặc tả nền tảng](docs/features/00-foundation.md).

## Tài khoản và phân quyền (01)

Ma trận và chức năng 01 đã được chốt theo ủy quyền ngày 15/10/2026. Xem [đặc tả](docs/features/01-users-access-control.md), [biên bản nghiệm thu](docs/features/01-users-acceptance.md) và [hướng dẫn SMTP, lời mời, duyệt quyền, migration](docs/operations/identity-access.md). Bộ coverage riêng: chạy npm run test:access trong apps/api với TEST_DATABASE_URL của DB kiểm thử riêng, tuần tự với e2e. Không chạy trên DB demo/thật.


## Khách hàng và kho hồ sơ (02)

Đã triển khai liên hệ/phân công, Excel xem trước/xác nhận/xuất, phiên bản hồ sơ và preview PDF/ảnh. Xem [đặc tả 02](docs/features/02-customers-documents.md), [kiểm chứng](docs/features/02-customers-acceptance.md) và [hướng dẫn migration/Excel/hồ sơ](docs/operations/customer-documents.md). Migration đã thử trên DB riêng; khi cập nhật môi trường chính, sao lưu và chạy migrate deploy theo hướng dẫn. PDF worker/font/CMap/WASM phải đi cùng web build.

