# Quy tắc code

Áp dụng cho toàn bộ mã nguồn phần mềm quản lý công ty dịch vụ Kế toán & Kiểm toán.
Người và AI (Claude) viết code đều phải tuân theo. Có ngoại lệ thì ghi rõ lý do trong Pull Request.

## 1. Công nghệ đã chốt

| Tầng | Công nghệ |
| --- | --- |
| Backend | NestJS 11 + TypeScript (strict) |
| Frontend | Angular 21 (standalone components, signals, zoneless) + NG-ZORRO 21 (Ant Design cho Angular) |
| Biểu đồ / lịch | ngx-echarts, FullCalendar for Angular |
| Cơ sở dữ liệu | PostgreSQL 16 + Prisma ORM 6 |
| Hàng đợi / cache | Redis + BullMQ (giai đoạn sau; bản demo dùng sự kiện trong tiến trình) |
| Lưu file | Object storage chuẩn S3 (bản demo lưu ổ đĩa qua `StorageService`) |
| Kho code | Một repo, hai ứng dụng độc lập: `apps/api` (Nest CLI), `apps/web` (Angular CLI); `libs/shared` bổ sung khi cần dùng chung kiểu dữ liệu |
| Test | Jest (backend), Vitest qua Angular CLI (frontend), Supertest (API e2e trên database test riêng) |
| Chất lượng code | ESLint + Prettier, husky + lint-staged chạy trước mỗi commit |

## 2. Giới hạn kích thước file

- **Bắt buộc: mỗi file code không quá 1.000 dòng**, tính cả dòng trống và comment.
  Áp dụng cho `.ts`, `.html`, `.scss`, `.prisma`, `.sql`, `.mjs`.
  Ngoại trừ file sinh tự động (migration Prisma, `package-lock.json`, file build).
- Mục tiêu: dưới 400 dòng. File vượt 800 dòng phải tách **trước khi** thêm code mới.
- Khuyến nghị: mỗi hàm không quá 80 dòng.
- Cách tách khi file quá dài:
  - Service lớn → tách theo nhóm nghiệp vụ: `contracts-query.service.ts` (đọc, lọc, báo cáo) và `contracts-command.service.ts` (tạo, sửa, duyệt).
  - Logic tính toán thuần → `*.util.ts` hoặc `*.calculator.ts`.
  - Hằng số, enum → `*.constants.ts`.
  - Component lớn → tách thành component con trong thư mục `components/`.
- Cưỡng chế:
  - ESLint: `'max-lines': ['error', { max: 1000, skipBlankLines: false, skipComments: false }]`
    và `'max-lines-per-function': ['warn', { max: 80, skipBlankLines: true, skipComments: true }]`.
  - Script `node scripts/check-max-lines.mjs` kiểm tra mọi loại file, chạy trong pre-commit và CI.

## 3. Quy tắc chung

- TypeScript `strict: true`. Không dùng `any`; dùng `unknown` + kiểm tra kiểu.
- Code, tên biến, tên file, commit message: **tiếng Anh**. Chuỗi hiển thị cho người dùng: **tiếng Việt**, đặt trong file ngôn ngữ, không viết cứng trong code. Comment giải thích nghiệp vụ được viết tiếng Việt.
- Đặt tên theo chuẩn Angular/NestJS:
  - File: `kebab-case.<loại>.ts` — ví dụ `customer-list.component.ts`, `contracts.service.ts`, `create-contract.dto.ts`.
  - Class: `PascalCase`; biến, hàm: `camelCase`; hằng số: `UPPER_SNAKE_CASE`.
  - Bảng, cột trong database: `snake_case`, tên bảng số nhiều.
- Không lặp code: logic dùng ở 2 nơi trở lên → đưa vào `common/` (backend), `shared/` (frontend) hoặc `libs/shared`.
- Không commit mật khẩu, khoá API, file `.env`. Chỉ commit `.env.example`.
- Không để code chết, code bị comment, `console.log` khi merge.

## 4. Cấu trúc thư mục

```
/
├─ apps/
│  ├─ api/                          # NestJS
│  │  ├─ prisma/
│  │  │  ├─ schema/                 # mỗi module một file .prisma
│  │  │  ├─ migrations/
│  │  │  └─ seed/
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ app.module.ts
│  │     ├─ core/                   # config, prisma, auth guard, interceptor, exception filter, logger
│  │     ├─ common/                 # decorator, pipe, util, DTO dùng chung (phân trang, lọc)
│  │     └─ modules/
│  │        └─ contracts/           # ví dụ một module
│  │           ├─ contracts.module.ts
│  │           ├─ contracts.controller.ts
│  │           ├─ contracts.service.ts
│  │           ├─ contracts.repository.ts      # chỉ khi truy vấn phức tạp
│  │           ├─ dto/
│  │           ├─ entities/                    # kiểu dữ liệu trả về
│  │           ├─ events/                      # sự kiện phát cho module khác
│  │           ├─ jobs/                        # job BullMQ
│  │           └─ contracts.service.spec.ts
│  └─ web/                          # Angular
│     └─ src/app/
│        ├─ core/                   # đăng nhập, interceptor, guard, layout (sidebar, header)
│        ├─ shared/                 # component UI dùng chung, pipe (tiền VND, ngày), directive
│        └─ features/
│           └─ contracts/           # ví dụ một tính năng
│              ├─ contracts.routes.ts
│              ├─ data-access/      # contracts.api.ts, contracts.store.ts
│              ├─ pages/            # contract-list/, contract-detail/ (gắn với route)
│              └─ components/       # contract-form/, contract-status-tag/
├─ libs/shared/                     # type, enum, hằng số dùng chung giữa api và web
├─ scripts/
├─ docs/
│  ├─ quy-tac-code.md
│  └─ features/                     # đặc tả từng chức năng
└─ docker-compose.yml               # PostgreSQL, Redis, MinIO cho môi trường dev
```

Tên module (dùng thống nhất ở backend, frontend và database):

| Chức năng | Tên module |
| --- | --- |
| Đăng nhập | `auth` |
| Quản lý người dùng | `users` |
| Vai trò, phân quyền | `access-control` |
| Nhật ký hoạt động | `audit-log` |
| Khách hàng | `customers` |
| Hồ sơ, tài liệu | `documents` |
| Dịch vụ & bảng giá | `service-catalog` |
| Hợp đồng | `contracts` |
| Công việc, tiến độ, bằng chứng | `tasks` |
| Lịch & Deadline | `deadlines` |
| Thông báo, nhắc việc | `notifications` |
| Thu tiền, công nợ | `payments` |
| Hoá đơn | `invoices` |
| Tài khoản công ty khách hàng | `client-credentials` |
| Tổng quan | `dashboard` |
| Báo cáo | `reports` |
| Cài đặt | `settings` |

## 5. Backend – NestJS

- **Một chức năng = một module** trong `src/modules/<tên-module>`. Module chỉ `export` service mà module khác thật sự cần.
- **Không import vòng tròn giữa các module.** Khi module A cần báo cho module B, phát sự kiện (`@nestjs/event-emitter`).
  Ví dụ: `contracts` phát `contract.approved` → `tasks` nghe và tự sinh việc.
- **Controller mỏng**: nhận request, validate DTO, gọi service, trả kết quả. Không truy vấn database trong controller.
- **Service** chứa nghiệp vụ. Truy vấn phức tạp (báo cáo, lọc nhiều điều kiện) đặt trong `*.repository.ts`.
- **DTO** dùng `class-validator` + `class-transformer`. `ValidationPipe` toàn cục với `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`. DTO có decorator Swagger để sinh tài liệu API.
- **Phân quyền**:
  - Mọi endpoint mặc định yêu cầu đăng nhập (guard toàn cục). Endpoint công khai phải đánh dấu `@Public()`.
  - Quyền khai báo bằng decorator, ví dụ `@RequirePermission('contracts', 'approve')`.
  - Phạm vi dữ liệu (cá nhân / nhóm / chi nhánh / toàn công ty) áp dụng qua một helper chung trong `common/`, không tự viết lại ở từng module.
- **Tiền**: dùng `Prisma.Decimal`, không tính tiền bằng `number` của JavaScript.
- **Ngày giờ**: thời điểm lưu UTC (`timestamptz`), hiển thị theo `Asia/Ho_Chi_Minh`. Ngày nghiệp vụ (hạn nộp, ngày ký) lưu kiểu `date`.
- **Xoá mềm** (`deleted_at`) cho dữ liệu nghiệp vụ. Thao tác thêm/sửa/xoá/duyệt/xuất file ghi vào `audit-log` qua interceptor chung.
- **Lỗi**: dùng exception chuẩn của Nest (`NotFoundException`, `ForbiddenException`…), kèm mã lỗi và thông báo tiếng Việt cho người dùng.
- **Danh sách**: mọi API danh sách có phân trang (`page`, `pageSize` tối đa 100), sắp xếp, bộ lọc.
- **Cấu hình** qua `@nestjs/config`, kiểm tra biến môi trường khi khởi động; thiếu biến bắt buộc thì không chạy.
- Đường dẫn API có phiên bản: `/api/v1/...`.

## 6. Frontend – Angular

- **Standalone components**, không tạo `NgModule` mới. Mỗi tính năng lazy-load qua file `<feature>.routes.ts`.
- `ChangeDetectionStrategy.OnPush` cho mọi component. Dùng control flow mới (`@if`, `@for` có `track`).
- **Ba lớp trong mỗi tính năng**:
  - `pages/`: component gắn với route, lấy dữ liệu từ store.
  - `components/`: component hiển thị, chỉ nhận `input()` và phát `output()`, không gọi API.
  - `data-access/`: service gọi API (`*.api.ts`) và state bằng signals (`*.store.ts`).
- Component **không gọi `HttpClient` trực tiếp**.
- Template và style để file riêng khi dài quá 30 dòng.
- Form dùng **Typed Reactive Forms**; thông báo lỗi validate bằng tiếng Việt.
- Dùng component có sẵn của NG-ZORRO trước khi tự viết. Định dạng tiền (`1.000.000 đ`) và ngày (`dd/MM/yyyy`) qua pipe dùng chung trong `shared/`.
- Ẩn/hiện nút theo quyền bằng directive dùng chung (ví dụ `*appCan="'contracts:approve'"`). Đây chỉ là trải nghiệm người dùng — **backend luôn là nơi kiểm tra quyền chính**.
- Giao diện phải dùng được ở màn hình điện thoại (từ 375px).

## 7. Database – PostgreSQL + Prisma

- Mỗi module một file trong `prisma/schema/`. Tên model `PascalCase` số ít, map sang bảng `snake_case` số nhiều (`@@map("contracts")`).
- Khoá chính UUID. Mọi bảng nghiệp vụ có `created_at`, `updated_at`, `created_by`, `deleted_at`.
- **Mọi thay đổi cấu trúc qua migration** (`prisma migrate`). Không sửa database bằng tay. Migration đã merge thì không sửa lại, chỉ tạo migration mới.
- Ràng buộc đầy đủ: khoá ngoại, `unique` (ví dụ mã số thuế khách hàng, mã hợp đồng), index cho cột hay lọc (`customer_id`, `assignee_id`, `due_date`, `status`).
- Tiền: `Decimal @db.Decimal(18, 2)`. Trạng thái: `enum`.
- Trường tuỳ biến theo dịch vụ (checklist, thông tin thêm) dùng `Json` (JSONB), không tạo cột tràn lan.
- Mật khẩu tài khoản của khách hàng mã hoá AES-256-GCM ở tầng ứng dụng, khoá đặt trong biến môi trường, không lưu cùng database.
- Dữ liệu mẫu cho môi trường dev đặt trong `prisma/seed/`.

## 8. Kiểm thử

- Mỗi service có unit test cho nghiệp vụ chính, nhất là phần tính tiền, công nợ, sinh việc, sinh deadline.
- Mỗi module có e2e test cho các API chính, **gồm cả test phân quyền**: người không có quyền phải nhận 403, nhân viên không thấy khách hàng ngoài phân công.
- Độ phủ test tối thiểu 70% cho các service tiền và phân quyền.
- **Không sửa, xoá, bỏ qua hoặc nới lỏng bài test chỉ để test pass.** Khi test thất bại,
  phải tìm nguyên nhân và sửa code/thiết lập gây lỗi. Không đổi dữ liệu mẫu, mock,
  điều kiện chờ hay kỳ vọng để che hành vi sai.
- Chỉ cập nhật test khi đặc tả hoặc hành vi được chủ đầu tư duyệt thay đổi, hoặc chứng minh
  được test cũ sai so với đặc tả. Ghi rõ lý do và giữ hoặc bổ sung mức kiểm chứng tương đương;
  lỗi hồi quy phải có test tái hiện trước khi sửa. Chỉnh kiểu dữ liệu/định dạng trong test
  không được làm yếu điều kiện kiểm tra.
- Báo trung thực test đang fail và nguyên nhân; không đánh dấu hoàn thành hay merge bằng cách
  sửa test cho xanh mà chưa xử lý lỗi sản phẩm.
- Không merge khi test hoặc lint lỗi.

## 9. Phát triển từng chức năng một

Chỉ làm **một chức năng tại một thời điểm**. Chức năng sau chỉ bắt đầu khi chức năng trước đã nghiệm thu và merge.

Thứ tự:

| # | Chức năng | Module |
| --- | --- | --- |
| 0 | Nền tảng: dựng monorepo, Docker, CI, layout giao diện | `core`, `shared` |
| 1 | Đăng nhập, người dùng, vai trò, phân quyền, nhật ký | `auth`, `users`, `access-control`, `audit-log` |
| 2 | Khách hàng và kho hồ sơ | `customers`, `documents` |
| 3 | Dịch vụ, bảng giá, mẫu công việc | `service-catalog` |
| 4 | Hợp đồng | `contracts` |
| 5 | Công việc: tự sinh, trạng thái, bằng chứng, bộ lọc | `tasks` |
| 6 | Lịch & deadline, nhắc việc | `deadlines`, `notifications` |
| 7 | Thu tiền, công nợ | `payments` |
| 8 | Hoá đơn | `invoices` |
| 9 | Tài khoản công ty khách hàng | `client-credentials` |
| 10 | Tổng quan và báo cáo | `dashboard`, `reports` |
| 11 | Cài đặt hoàn chỉnh | `settings` |

Mỗi chức năng đi qua 6 bước:

1. **Đặc tả**: viết `docs/features/NN-<module>.md` gồm câu chuyện người dùng, tiêu chí nghiệm thu, quyền theo vai trò, màn hình. Chủ đầu tư duyệt trước khi code.
2. **Database**: schema + migration + seed.
3. **Backend**: module, API, unit test, e2e test.
4. **Frontend**: route, màn hình, form, kết nối API.
5. **Kiểm tra**: lint, test, `check-max-lines` đều qua; tự chạy thử luồng chính trên giao diện.
6. **Nghiệm thu và merge**: demo cho chủ đầu tư, sửa theo góp ý, merge vào `main`.

Git:

- Mỗi chức năng một nhánh: `feature/NN-<module>`, ví dụ `feature/04-contracts`.
- Commit nhỏ, theo Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Không sửa module khác trong nhánh chức năng, trừ khi bắt buộc — khi đó ghi rõ trong Pull Request.

## 10. Danh sách kiểm tra trước khi merge

- [ ] Không file nào vượt 1.000 dòng (`node scripts/check-max-lines.mjs`)
- [ ] `lint` và `test` đều qua
- [ ] Không có test bị bỏ qua hoặc nới lỏng chỉ để qua kiểm tra; mọi thay đổi test có lý do theo đặc tả
- [ ] Có e2e test phân quyền cho API mới
- [ ] Migration mới chạy được trên database trống và database có dữ liệu
- [ ] Chuỗi giao diện tiếng Việt nằm trong file ngôn ngữ
- [ ] Không có secret, `console.log`, code bị comment
- [ ] Đặc tả `docs/features/` đã cập nhật nếu có thay đổi so với ban đầu
