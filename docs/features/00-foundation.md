# 00 — Nền tảng và công cụ kiểm tra

Trạng thái: đã triển khai và kiểm tra cục bộ các gói 00-A đến 00-E. Nghiệm thu của chủ đầu tư: chưa có.

Kế hoạch phần tiếp theo và trạng thái tổng hợp: [kế hoạch hiện hành](../planning/completion-plan.md), [hiện trạng](../planning/current-status.md). Các đoạn kết quả theo gói bên dưới giữ bối cảnh tại thời điểm kiểm tra, không thay thế trạng thái tổng hợp mới nhất.

## Gói 00-E — tài nguyên frontend và phụ thuộc production

Tiếp tục theo yêu cầu phát triển code ngày 15/10/2026, trong phạm vi nền tảng 00.

Phạm vi: cấu hình ứng dụng web và tài nguyên dùng chung trong `core/`, dependency manifest/lockfile API, kiểm tra hồi quy cho cấu hình mới và tài liệu. Không thay đổi module nghiệp vụ, API nghiệp vụ, schema hoặc kỳ vọng của test hiện có.

Tiêu chí kiểm tra:

1. Chỉ đăng ký các icon thực tế đang dùng; icon tĩnh, icon menu và icon động trên KPI/công việc vẫn hiển thị, không cần tải SVG từ mạng.
2. ECharts chỉ nạp khi màn hình cần biểu đồ; đăng ký đủ cột, tròn, grid, tooltip, title, legend và label layout đang dùng. Không thay đổi dữ liệu/công thức biểu đồ.
3. Build production giảm bundle ban đầu so với mốc 3,21 MB, giữ nguyên budget Angular; không nâng ngưỡng để hết cảnh báo.
4. Thay bản `js-yaml` bị cảnh báo trong Swagger bằng bản vá cùng major, giữ NestJS/Swagger major hiện tại; kiểm tra audit production và khả năng sinh OpenAPI YAML/JSON.
5. Lint, unit backend/frontend, build backend/frontend và max-lines đạt; thêm kiểm tra cho nguy cơ mất icon/biểu đồ. Không sửa hoặc nới lỏng test hiện có.

CI từ xa, cloud/HTTPS, lịch backup thật và nghiệm thu 00 vẫn là các điều kiện riêng; không báo hoàn tất chúng từ kết quả gói này.

Kết quả **15/10/2026**:

- Thay `import * as AllIcons` bằng danh sách 44 icon đang dùng, có cả icon động của menu/KPI/công việc. Test dựng SVG thật, kiểm tra không phát sinh yêu cầu HTTP tải icon.
- ECharts được nạp bằng dynamic import; chỉ đăng ký bar/pie, grid/legend/title/tooltip, label layout và Canvas renderer. Test SVG SSR kiểm tra cột chồng, donut và thao tác legend; SVG renderer chỉ import trong test, không thêm vào bundle ứng dụng.
- Production build web đạt, tổng bundle ban đầu **1,44 MB**, giảm từ mốc **3,21 MB** khoảng 55%; ECharts nằm ở lazy chunk riêng khoảng **544,78 kB**. Giữ nguyên budget 3 MB warning/5 MB error, không còn cảnh báo vượt budget trong lần build này. Đầu ra thử ở `tmp/00e-web-production`.
- Giữ `@nestjs/swagger@11.4.7`; override riêng dependency con `js-yaml` từ 5.3.0 lên **5.4.3**, không đổi major Swagger/NestJS. Căn cứ [advisory upstream](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm): các phiên bản 5.0.0–5.4.0 bị ảnh hưởng, bản vá từ 5.4.1. `npm audit --omit=dev` trả **0 vulnerabilities** tại thời điểm kiểm tra. Audit toàn bộ dependency (gồm công cụ dev) vẫn có cảnh báo, chưa được xử lý trong gói này.
- Audit đầy đủ chạy tiếp cùng ngày trả exit 1: **23 cảnh báo (20 moderate, 3 high)**; 3 mục high nằm trong chuỗi công cụ `prisma`, `@prisma/config`, `deepmerge-ts`. Công cụ này còn dùng ở image migration, nên audit runtime API bằng 0 không chứng minh image migration không có cảnh báo. Cần xử lý bằng gói riêng có kiểm chứng migration; không chạy `npm audit fix --force` tự động.
- Thêm kiểm tra CI audit production; workflow vẫn chưa chạy trên GitHub do workspace chưa có `.git`/repo chính.
- Unit API **14 suites/73 tests**, frontend **3 files/11 tests** đạt. Các test cũ giữ nguyên; bổ sung 2 test Swagger và 4 test frontend. Lint API **0 lỗi/9 cảnh báo**, web **0 lỗi/1 cảnh báo**; chỉ còn các cảnh báo độ dài hàm test cũ. Backend build, frontend production build và max-lines đạt.
- Đã mở `/login` từ bản production trên trình duyệt. Harness tạm dùng trực tiếp chunk ECharts production dựng được biểu đồ cột chồng và donut bằng Canvas; không coi dữ liệu mẫu này là kiểm chứng số liệu dashboard nghiệp vụ. Server preview và tab thử đã dừng/đóng.
- Không chạy lại e2e có database hoặc Docker image vì Docker Engine không kết nối được tại lần kiểm tra. HTTP test Swagger chạy Nest app tối giản, không cần DB; không thay thế 11 suites/82 e2e trước đây hoặc CI thật.

Khi thêm icon mới, đăng ký ở `apps/web/src/app/core/icons/app-icons.ts`; khi cần loại biểu đồ/component mới, đăng ký trong `core/charts/echarts.ts`. Không quay lại import toàn bộ thư viện chỉ để tránh đăng ký.

## Mục tiêu

Người phát triển và người nghiệm thu có thể kiểm tra code bằng các lệnh không tự sửa file,
chạy bản build backend bằng lệnh được tài liệu hoá và biết chính xác lỗi còn lại.

## Phạm vi gói 00-A

- Thay lệnh lint backend hiện tại bằng lệnh chỉ kiểm tra; nếu cần tự sửa, dùng lệnh `lint:fix` riêng.
- Thiết lập ESLint cho frontend Angular/TypeScript/template và lệnh lint chỉ kiểm tra.
- Sửa các lỗi lint trong `apps/api/src/core/**`, là phần thuộc giai đoạn nền tảng.
- Sửa đường dẫn khởi động backend build nếu kết quả Nest CLI cho thấy lệnh hiện tại sai.
- Ghi lệnh chạy và trạng thái vào README; không thay đổi luồng API, schema hay dữ liệu nghiệp vụ.

Phạm vi mở rộng đã được chủ đầu tư xác nhận: chỉ sửa lỗi lint đã nêu trong test `users`,
test/helper API người dùng và biến không dùng của `client-credentials`. Không sửa nghiệp vụ
của các module này hoặc xử lý cảnh báo độ dài hàm ở các module khác.

## Tiêu chí kiểm tra

1. Chạy lint không thay đổi file đang được kiểm tra.
2. ESLint frontend phân tích được `.ts` và template Angular mà không bỏ qua lỗi cấu hình.
3. `apps/api/src/core/**` không còn lỗi ESLint; không giảm mức nghiêm ngặt của luật hiện có để đạt kết quả.
4. Backend và frontend unit test, typecheck/build và kiểm tra số dòng vẫn chạy được.
5. Báo cáo kết quả lint toàn repo chính xác, kể cả khi chưa thể đạt vì lỗi của module ngoài phạm vi.
6. Không reset database, không chạy `prisma generate` khi schema không thay đổi.

## Giai đoạn 00 còn lại

Sau 00-A: xác định repository chính, baseline migration trên database test có dữ liệu,
CI, Docker cho ứng dụng, quy trình backup và hướng tích hợp store/shared/ngôn ngữ.
Các hạng mục đó cần đặc tả và kiểm chứng riêng trước khi khép giai đoạn 00.

## Kết quả gói 00-A — 14/10/2026

- Backend `lint` hiện chỉ kiểm tra; `lint:fix` là lệnh sửa chủ động. `start:prod`
  trỏ đúng `dist/src/main.js` sinh bởi Nest CLI.
- Frontend có ESLint flat config cho TypeScript và template Angular 21, cùng `lint`/`lint:fix`.
  Bộ cài `angular-eslint@21.4.0` và ESLint 10 chạy được với code hiện tại.
- Các lỗi lint trong `apps/api/src/core/**` đã được xử lý; kiểm tra riêng core đạt.
- Backend typecheck và build đạt. Frontend build development đạt. Unit test đạt:
  backend 13 suites/71 tests; frontend 1 file/7 tests. Kiểm tra giới hạn dòng đạt.
- Sau phạm vi mở rộng được xác nhận, lint toàn backend và frontend đều **exit 0**:
  backend **0 lỗi/9 cảnh báo**, frontend **0 lỗi/1 cảnh báo**. Cảnh báo còn lại là
  `max-lines-per-function` trong các test ngoài gói lint đã được duyệt.
- Test `users` vẫn khẳng định lệnh tạo được gọi đúng một lần, mật khẩu gốc không đi vào
  dữ liệu tạo và hash khác mật khẩu gốc. Test e2e chỉ thêm kiểu phản hồi; helper chỉ được định dạng.
- Không chạy e2e trong gói này vì không sửa API/nghiệp vụ; e2e cần database test riêng
  khi đến phần migration và khi có thay đổi nghiệp vụ.

Gói 00-A đã tạo được cơ chế kiểm tra và đưa lint toàn dự án về exit 0.
**Giai đoạn 00 chưa hoàn tất**: baseline migration/CI/Docker ứng dụng chưa triển khai
và chưa có nghiệm thu. E2e lần này chưa chạy vì Docker Engine không kết nối được;
cần chạy lại với database test riêng khi Docker hoạt động.

## Gói 00-B — baseline migration và kiểm tra tự động

Ngày bắt đầu: **15/10/2026**. Phạm vi: schema migration, test database bootstrap,
script cơ sở dữ liệu, tài liệu triển khai và workflow CI. Không thay đổi model nghiệp vụ.

- Tạo baseline `20261015000000_initial_baseline` bằng `prisma migrate diff` từ schema hiện có.
- Chuyển script e2e sang `migrate deploy`; từ chối tên database không rõ là test.
- Thay hướng dẫn `db push/reset` mặc định bằng `migrate deploy`; viết
  [quy trình áp dụng baseline trên database đã có dữ liệu](../operations/database-migration.md).
- Thêm workflow GitHub Actions chạy lint, unit, build, giới hạn dòng và e2e với PostgreSQL 16 riêng.

Đã kiểm tra baseline trên hai database PostgreSQL 16 tách biệt: database trống tạo bảng
thành công; database có một dòng mẫu sau `db push` đối chiếu schema không khác biệt,
ghi nhận baseline, chạy deploy không có việc chờ, dòng mẫu vẫn còn.
Database e2e thứ ba được tạo từ baseline: toàn bộ **11 suites/82 tests đạt**.
Script bootstrap từ chối tên database `ketoan` trước khi kết nối.
Kiểm tra sau thay đổi: backend/frontend lint exit 0 (tương ứng 9 và 1 cảnh báo
`max-lines-per-function`); 71 unit backend, 7 unit frontend, typecheck backend,
build backend, build frontend development/production và giới hạn dòng đều đạt.
Build frontend production còn cảnh báo kích thước bundle đầu **3,21 MB**, vượt
ngưỡng cảnh báo 3,00 MB nhưng dưới ngưỡng lỗi 5,00 MB; cần tối ưu ở gói UI sau.

Workflow CI chỉ chạy khi source nằm trong GitHub repository; workspace hiện chưa có `.git`
nên chưa có kết quả chạy thực tế trên GitHub. Phần Docker ứng dụng, backup và nghiệm thu
toàn giai đoạn 00 vẫn còn sau 00-B.

## Gói 00-C — Docker cho ứng dụng

Phạm vi: đóng gói API và web production, chạy cùng PostgreSQL 16 trong một Compose riêng.
Gói này không thay đổi nghiệp vụ hoặc database demo hiện có.

Tiêu chí nghiệm thu:

1. Image API build được từ source, sinh Prisma Client cho Linux và chạy bản Nest đã biên dịch.
2. Container migration áp dụng `prisma migrate deploy` thành công trên database mới trước khi API chạy.
3. Web phục vụ ứng dụng Angular và chuyển `/api/` đến API nội bộ; tải lại route giao diện vẫn hoạt động.
4. Database và thư mục upload có volume bền vững; không công khai cổng PostgreSQL hoặc API ra máy chủ.
5. Mật khẩu database, khoá JWT và khoá mã hoá lấy từ biến môi trường, không ghi giá trị thật vào image.
6. Chạy thử trên Compose riêng, không dùng database `ketoan` hoặc cổng 3000/4200 đang dùng cho demo.
7. Lint, unit test và giới hạn dòng vẫn đạt; không chỉnh bài test để đạt kết quả.

Kết quả **15/10/2026**: image API, migration và web build thành công. Stack Compose thử
nghiệm `ketoan-00c-smoke` trên database `appdb` riêng đã áp dụng baseline migration;
API khởi động sau migration. `/login` và `/api/docs` qua cổng 8082 đều trả HTTP 200,
route giao diện tải lại được; API/database không công khai cổng host. User `node` ghi
được vào volume upload. Stack và hai volume thử nghiệm đã được dọn sau kiểm tra.

Backend/frontend lint exit 0 (9/1 cảnh báo độ dài hàm test), unit test 71/7 đạt,
`check-max-lines` đạt. Production build web vẫn cảnh báo bundle đầu 3,21 MB vượt
ngưỡng cảnh báo 3 MB. Lệnh `npm prune --omit=dev` trong build API báo 2 lỗ hổng mức
moderate ở dependencies production; cần rà và cập nhật có kiểm chứng trong gói bảo mật.
Gói 00-C không thay đổi bài test hoặc code nghiệp vụ. Chưa kiểm chứng triển khai HTTPS,
backup/restore và CI trên GitHub; chức năng 00 chưa nghiệm thu.

## Gói 00-D — sao lưu và khôi phục

Phạm vi: script PowerShell để sao lưu `appdb` bằng `pg_dump` định dạng custom và sao chép
file upload, tạo manifest checksum; script khôi phục vào một project Compose **mới, trống**.
Không cho phép script ghi đè project đang có container hoặc volume. Trong lúc sao lưu,
web/API tạm dừng để dữ liệu database và file cùng một thời điểm; script khởi động lại
hai dịch vụ sau đó, kể cả khi sao lưu lỗi.

Tiêu chí kiểm tra: chạy thử trên project nguồn/đích tách biệt, đối chiếu hàng mẫu và
checksum file upload sau khôi phục; thử từ chối đích không trống hoặc bản sao lưu sai
checksum. Không dùng project `ketoan-app` hay database demo trong thử nghiệm.

Kết quả **15/10/2026**: script backup/restore đã chạy với project thử
`ketoan-00d-source` và `ketoan-00d-target`. Bản dump custom chứa hàng
`restore_probe = backup-restore-ok`; sau restore truy vấn lại đúng giá trị.
File `restore-probe.txt` có nội dung đúng và volume upload vẫn ghi được. Web và Swagger
ở project đích trả HTTP 200. Migration chạy lại sau restore không có migration chờ.
Script trả lỗi trước khi ghi nếu project đích đã có container/volume hoặc checksum file
upload sai. Đây là phép thử cục bộ; chưa xác nhận RPO/RTO, lịch backup, lưu trữ ngoại tuyến
hay quy trình chuyển lưu lượng của môi trường thật.
