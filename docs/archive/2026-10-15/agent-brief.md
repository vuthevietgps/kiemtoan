# Hướng dẫn chung cho agent phát triển bản demo

> Hướng dẫn demo đã lưu trữ, không còn là chỉ dẫn hiện hành. Đọc [hướng dẫn tiếp tục](../../agent-brief.md) và quy tắc code hiện hành trước khi làm việc.

Mục tiêu: bản demo cơ bản chạy được từ đầu đến cuối (giao diện → API → PostgreSQL), có test.
Trường chi tiết và tiểu tiết bổ sung sau — ưu tiên luồng chính chạy đúng.

## Đọc trước khi code

- `CLAUDE.md`, `docs/quy-tac-code.md` (bắt buộc: mỗi file ≤ 1.000 dòng, chuẩn NestJS/Angular).
- Tài liệu chức năng: https://claude.ai/code/artifact/7171c7f5-b837-4e07-9dd2-3a88a339daa9 (đã tóm tắt trong đề bài của bạn; không cần mở).
- **Mẫu chuẩn phải làm theo**:
  - Backend: `apps/api/src/modules/users/*` (module, controller, service, dto, unit test), `apps/api/src/core/**`
    (guard, `@RequirePermission`, `@CurrentUser`, `data-scope.ts`, `permissions.ts`, `AuditService`, `StorageService`, `CryptoService`),
    `apps/api/src/common/**` (`PaginationQueryDto`, `paginated()`, sự kiện `app-events.ts`).
  - e2e test: `apps/api/test/utils/test-app.ts` (`createTestContext()` cho sẵn người dùng mỗi vai trò + `ctx.api(user)`), mẫu `apps/api/test/auth-users.e2e-spec.ts`.
  - Frontend: `apps/web/src/app/core/**`, `apps/web/src/app/shared/**` (`VndPipe`, `CanDirective` `*appCan`, `PageHeaderComponent`),
    `core/api/api.ts` (`API_URL`, `Paginated`, `toParams`, `errorMessage`).
- Database: `apps/api/prisma/schema/*.prisma` **đã đầy đủ cho mọi module**. Đọc kỹ model của bạn.

## Quy ước

Backend (NestJS 11, Prisma 6, PostgreSQL):
- Module của bạn đã có file rỗng `src/modules/<tên>/<tên>.module.ts` và đã đăng ký trong `app.module.ts` — chỉ việc điền vào.
- Controller mỏng, nghiệp vụ trong service; DTO dùng class-validator, thông báo lỗi tiếng Việt.
- Mọi endpoint gắn `@RequirePermission('<module>', '<action>')` theo `core/access-control/permissions.ts`.
- Lọc dữ liệu theo phạm vi bằng `customerScope / contractScope / taskScope` trong `core/access-control/data-scope.ts`.
  Truy cập bản ghi ngoài phạm vi → 404 (không lộ là có tồn tại).
- Tiền dùng `Prisma.Decimal`, không tính bằng `number`. API trả tiền dạng chuỗi (Decimal tự serialize) — frontend dùng `| vnd`.
- Ngày nghiệp vụ nhận dạng `'YYYY-MM-DD'` (`@IsDateString()`), lưu `new Date(str)`.
- Xoá = xoá mềm (`deletedAt`), mọi truy vấn lọc `deletedAt: null`.
- Thao tác POST/PATCH/DELETE tự được ghi nhật ký bởi interceptor; hành động đặc biệt (duyệt, xem mật khẩu) gọi thêm `AuditService.log`.
- Kiểu dùng trong tham số có decorator phải `import type` (ví dụ `import type { AuthUser } ...`).
- Không import module của agent khác; cần báo cho module khác thì phát sự kiện trong `common/events/app-events.ts`.
- Upload file: `FileInterceptor('file')` (multer bộ nhớ) + `StorageService.save(file)` → tạo bản ghi `Document`.

Frontend (Angular 21 zoneless, standalone, signals, NG-ZORRO 21, ngx-echarts):
- Thư mục của bạn: `apps/web/src/app/features/<tên>/` với `<tên>.routes.ts` (đã có bản tạm — thay bằng thật), `data-access/<tên>.api.ts`, `pages/`, `components/`.
- Route đã đăng ký và chặn theo quyền trong `app.routes.ts`, menu đã có trong `core/layout/menu.ts`. Đường dẫn trang chi tiết: `<tên>/:id`.
- Component: `ChangeDetectionStrategy.OnPush`, `inject()`, `input()/output()`, signals, `@if/@for`, Typed Reactive Forms. Không gọi `HttpClient` trong component — qua `data-access`.
- Bảng có phân trang phía server: `nz-table [nzFrontPagination]="false" [nzTotal] [nzPageIndex] [nzPageSize]`.
- Mọi chữ hiển thị tiếng Việt. Ngày hiển thị `| date: 'dd/MM/yyyy'`. Tiền `| vnd`.
- Ẩn nút theo quyền bằng `*appCan="'module:action'"`; lỗi API hiện bằng `NzMessageService.error(errorMessage(err))`.
- Link tải file: `/api/v1/documents/<id>/download?token=<AuthService.token()>`.
- Giao diện dùng được ở màn hình 375px (bảng bọc `nzScroll` ngang).

## Kiểm thử và kiểm tra (bắt buộc trước khi báo xong)

- Mỗi agent có **database test riêng**, KHÔNG dùng database khác:
  `cd apps/api && TEST_DATABASE_URL=postgresql://ketoan:ketoan_dev@localhost:5433/<db_của_bạn> npm run test:e2e -- <file-spec-của-bạn>`
- Unit test: `npx jest src/modules/<tên>` (trong `apps/api`).
- e2e của bạn: luồng chính + **ít nhất một test 403** (vai trò không có quyền) + **một test phạm vi dữ liệu** (nhân viên không thấy dữ liệu ngoài phân công).
- Typecheck backend: `npx tsc --noEmit -p tsconfig.json`; lint: `npx eslint <các file của bạn>`.
- Build frontend: `cd apps/web && npx ng build --configuration development --output-path ../../tmp/build-<agent>` (đường dẫn riêng để không đè nhau).
- `node scripts/check-max-lines.mjs` ở thư mục gốc.

## Không được làm

- Không chạy dev server (cổng 3000, 4200 dành cho người điều phối). Không đụng database `ketoan` (dữ liệu demo).
- Không sửa file ngoài phạm vi được giao. Nếu thật sự bắt buộc (ví dụ thêm 1 trường vào schema), làm tối thiểu và ghi rõ trong báo cáo.
- Không chạy `prisma generate` trừ khi bạn đã sửa schema. Không commit git.

## Báo cáo cuối

Liệt kê: file đã tạo/sửa, endpoint, màn hình, kết quả thật của test/typecheck/lint/build (dán dòng tổng kết),
việc chưa làm, mọi thay đổi ngoài phạm vi.
