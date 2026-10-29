# 03 — Dịch vụ, bảng giá và quy trình mẫu có phiên bản

Ngày 15/10/2026. **Đã được người dùng duyệt trong chat: “Duyệt đặc tả 03 với phương án đề xuất D1–D5 và phạm vi sửa ngoài module đã liệt kê.”** Chưa code. Theo mục 9 quy tắc, code bắt đầu sau khi 02 được nghiệm thu.

Căn cứ: YC06, YC07, phần nền của YC12 và YC21 trong [phạm vi](../requirements/scope-and-traceability.md); G §3.4, §4.1 (việc mẫu), §5.3; C10, C13; PL1 mục I, II, V.1, VII.1, VIII (xem [đặc tả tích hợp](../requirements/functional-description-integrated-2026-10-15.pdf)); QD04/05/07 trong [sổ quyết định](../requirements/decision-register.md); [review 15/10](../planning/review-2026-10-15.md) mục 3–5. Quyền kế thừa [ma trận 01](01-users-access-control.md). [Đặc tả demo 04](04-contracts.md) phần "Dịch vụ & bảng giá" chỉ dùng để đối chiếu.

## Phạm vi

- **Trong phạm vi:** module `service-catalog` (backend, frontend), schema/migration/seed của dịch vụ, bảng giá, quy trình mẫu, bước, phụ thuộc và danh mục hồ sơ yêu cầu; test tương ứng.
- **Phạm vi ngoài module đã được duyệt cùng đặc tả (ngoài danh sách này phải xin thêm):**
  - `core/access-control/permissions.ts` và test quyền: thêm khoá quyền theo D1.
  - `tasks/task-generator.ts` và `task-generator.spec.ts`, phần dựng dữ liệu trong `test/tasks.e2e-spec.ts`: đổi nguồn bước theo D3; không đổi thời điểm sinh, người làm, trạng thái hay cách chống trùng.
  - `prisma/schema/contracts.prisma`: chuyển model `ServiceType`, `TaskTemplate` sang file mới `service-catalog.prisma` (không đổi SQL).
  - `prisma/seed/catalog.seed.ts`; `web/.../core/layout/menu.ts` (đổi nhãn menu).
- **Ngoài phạm vi, để bước sau:**
  - 04: chọn phiên bản cho dòng dịch vụ, quản lý xác nhận kế hoạch, áp người làm/người kiểm tra mặc định khi sinh việc, gợi ý giá từ bảng giá trên form hợp đồng, chặn dịch vụ ngừng dùng khi tạo HĐ.
  - 05: liên kết việc ↔ bước/phiên bản, 8 trạng thái, phê duyệt nhiều cấp, phụ thuộc giữa việc, trạng thái hồ sơ yêu cầu của từng KH, xoá bảng `task_templates`.
  - 06: lịch ngày nghỉ lễ, deadline pháp lý, nhắc việc.
  - 11: đưa màn hình vào menu Cài đặt.
- **Đầu vào còn thiếu (QD07):** danh mục dịch vụ thật, quy trình từng dịch vụ, hồ sơ bắt buộc, bảng giá. Gói này làm cấu trúc dữ liệu và màn hình cấu hình chung, thử bằng dữ liệu mẫu. Không ghi đã cấu hình xong dữ liệu thật khi chưa có đầu vào.

## Quyết định đã duyệt cùng đặc tả

Người dùng duyệt ngày 15/10/2026 theo cột "Đề xuất". Cột "Phương án khác" giữ lại để truy vết, không áp dụng.

| Mã | Câu hỏi | Đề xuất (đã duyệt) | Phương án khác |
| --- | --- | --- | --- |
| D1 | Ai soạn và ai phát hành quy trình? G §2: trưởng nhóm chỉ **xem** dịch vụ/bảng giá; PL1 II.2: "người quản lý" tuỳ chỉnh quy trình | Tách khoá quyền `workflow-templates` (view/create/update/approve). Giám đốc: toàn quyền, là người duy nhất phát hành. Trưởng nhóm/KTT: xem, tạo và sửa bản nháp. Nhân viên: chỉ xem. Kế toán thu tiền, quản trị: không có quyền. Dịch vụ và bảng giá giữ như ma trận 01 (chỉ giám đốc sửa) | Giữ nguyên ma trận 01: chỉ giám đốc làm mọi thao tác quy trình, không thêm khoá quyền |
| D2 | "Ngày" trong thời lượng là ngày gì? | Ngày làm việc. Ở 03 tính tạm theo thứ 2–6; 06 bổ sung lịch nghỉ lễ. Hạn theo kỳ vẫn tính ngày lịch như hiện tại | Ngày lịch cho mọi trường hợp |
| D3 | Khi nào bộ sinh việc đọc quy trình mới? | Ngay trong 03, sửa hẹp `task-generator.ts` để đọc phiên bản đang hiệu lực, bỏ API sửa việc mẫu cũ. Có một nguồn dữ liệu duy nhất và demo được ngay | Để 04 mới chuyển. Trong lúc chờ, quy trình mới không ảnh hưởng việc được sinh, màn hình việc mẫu cũ vẫn tồn tại song song |
| D4 | Một dịch vụ có mấy quy trình? | Nhiều quy trình (mã `QT-<mã DV>-NNN`, khớp ví dụ QT-LSS-001), đúng một quy trình mặc định. Mỗi quy trình có nhiều phiên bản, tối đa một bản nháp và một bản đang hiệu lực | Mỗi dịch vụ đúng một quy trình |
| D5 | Bước "Kiểm tra nội bộ" và "Phê duyệt" trong ví dụ PL1 là bước công việc hay cấp duyệt? | 03 cho cả hai: mẫu ví dụ giữ chúng là bước như PL1, mỗi bước có thêm số cấp duyệt. Cách áp dụng do QD04 quyết ở 05 | — |

## 03-A — Dịch vụ và bảng giá

- Giữ các trường dịch vụ hiện có: mã (tự viết hoa, trùng thì 409), tên, mô tả, chu kỳ tính phí (tháng/quý/năm/một lần), giá chuẩn, đang dùng. Thêm **tiêu chí bảng giá**: không bậc / số chứng từ mỗi tháng / doanh thu năm / số lao động / khác (có nhập đơn vị).
- Ngừng dùng dịch vụ (`isActive=false`) không xoá, không đổi HĐ/việc đã có; danh sách hỗ trợ lọc theo trạng thái. Không có API xoá dịch vụ.
- **Bảng giá có ngày hiệu lực:** mỗi bảng giá gồm ngày bắt đầu hiệu lực và các bậc (từ giá trị, đến giá trị hoặc không giới hạn, đơn giá Decimal(18,2) ≥ 0, ghi chú).
  - Các bậc không chồng lấn, không hở trong một bảng; lỗi trả 400 kèm vị trí bậc.
  - Chỉ sửa/xoá được bảng giá có ngày hiệu lực sau hôm nay; bảng đã hoặc đang hiệu lực thì chỉ được tạo bảng mới. Như vậy lịch sử giá được giữ lại.
  - Đổi giá không làm thay đổi đơn giá đã lưu trên HĐ.
- **Báo giá:** `GET /service-types/:id/price-quote?value=&date=` chọn bảng có ngày hiệu lực gần nhất ≤ ngày, rồi bậc chứa giá trị. Không có bảng hoặc bậc phù hợp thì trả giá chuẩn kèm cờ `fallback`. Đây là API cho 04 dùng, chưa gắn vào form HĐ.
- **Quyền:** bảng giá và báo giá yêu cầu `service-catalog:view` + `finance:view`; thiếu quyền trả 403. Giá chuẩn trong danh sách dịch vụ tiếp tục bị ẩn khi thiếu `finance:view` như hiện tại. Thao tác tạo/sửa bảng giá có audit trước–sau.

## 03-B — Quy trình mẫu có phiên bản

### Dữ liệu

| Bảng | Nội dung chính |
| --- | --- |
| `workflow_templates` | Mã duy nhất `QT-<mã DV>-NNN` sinh nguyên tử, dịch vụ, tên, mô tả, mặc định của dịch vụ, đang dùng, cột chuẩn `created_*`/`updated_at`/`deleted_at` |
| `workflow_template_versions` | Số phiên bản (duy nhất trong quy trình), trạng thái Nháp / Đang hiệu lực / Ngừng, cách lập lịch (theo kỳ / theo dự án), `revision` để khoá lạc quan, người và thời điểm phát hành, ngừng, nhân bản từ phiên bản nào |
| `workflow_steps` | Khoá bước ổn định trong phiên bản (B01…), thứ tự, giai đoạn, tên, hướng dẫn, bắt buộc/tuỳ chọn, thời lượng (ngày làm việc), hạn theo kỳ (số ngày sau cuối kỳ, −365..365), vai trò thực hiện mặc định, người thực hiện mặc định (tuỳ chọn), số cấp duyệt 0–2, người kiểm tra và người phê duyệt mặc định (tuỳ chọn), cần bằng chứng, gợi ý loại bằng chứng |
| `workflow_step_dependencies` | Bước → bước phải xong trước (kết thúc–bắt đầu), cùng phiên bản |

- Ràng buộc trong DB: unique một-phần bảo đảm mỗi quy trình có tối đa **một** bản Nháp và **một** bản Đang hiệu lực; mỗi dịch vụ có tối đa một quy trình mặc định. Có khoá ngoại và index theo dịch vụ/trạng thái.
- Vai trò thực hiện dùng nhãn nghiệp vụ map vào vai trò hệ thống: Nhân viên/Kế toán (STAFF), Trưởng nhóm/Kế toán trưởng (MANAGER), Giám đốc (DIRECTOR). Ánh xạ "Trưởng nhóm/Quản lý" của PL1 được chốt ở QD04.
- Người mặc định phải là tài khoản đang hoạt động khi lưu và khi phát hành. Nếu sau đó người này nghỉ, phiên bản vẫn giữ tham chiếu; 04 sẽ cảnh báo khi xác nhận kế hoạch.

### Cách lập lịch

- **Theo kỳ** (dịch vụ định kỳ như kế toán thuế, BCTC): hạn mỗi bước = ngày cuối kỳ + số ngày lệch, tính ngày lịch. Giữ đúng công thức của bộ sinh việc hiện tại.
- **Theo dự án** (làm lại sổ sách, hoàn thuế): bước không có phụ thuộc bắt đầu từ ngày bắt đầu; bước có phụ thuộc bắt đầu ngày làm việc kế tiếp sau khi bước phụ thuộc muộn nhất kết thúc; kết thúc = bắt đầu + thời lượng − 1 ngày làm việc. Ngày bắt đầu rơi vào cuối tuần thì dời sang thứ 2.
- **Song song** là các bước không phụ thuộc nhau. Trên giao diện có nút "Làm song song với bước trước" để chép phụ thuộc của bước trước thay vì phụ thuộc vào chính bước đó.
- **Điều kiện bắt đầu** gồm các bước phụ thuộc phải xong và các hồ sơ yêu cầu gắn với bước (03-C). Ở 03 chỉ lưu cấu hình; 05 mới chặn khi thực hiện.
- Hàm lập lịch là hàm thuần trong `service-catalog`, dùng chung cho màn hình xem trước, bộ sinh việc (D3) và sau này 04/06. 06 chỉ thay lịch ngày làm việc, không viết lại hàm.

### Kiểm tra hợp lệ (400, chỉ rõ bước lỗi)

- Phiên bản phải có 1–100 bước để phát hành, mỗi bước tối đa 20 phụ thuộc. Tên bước 2–200 ký tự, hướng dẫn ≤ 2.000 ký tự.
- Phụ thuộc không được trỏ vào chính bước đó, sang phiên bản khác, hoặc tạo vòng. Khi có vòng, báo tên các bước trong vòng.
- Theo dự án: thời lượng 1–365. Theo kỳ: phải có số ngày lệch.
- Số cấp duyệt ≥ 1 thì phải có vai trò người kiểm tra.
- Lưu bản nháp được khi còn thiếu trường; phát hành chạy toàn bộ kiểm tra.

### Vòng đời và API (`/api/v1`)

| Method | Đường dẫn | Quyền | Ghi chú |
| --- | --- | --- | --- |
| GET | `/workflow-templates?serviceTypeId&active&search&page&pageSize` | `workflow-templates:view` | Kèm phiên bản đang hiệu lực, có bản nháp hay không, cập nhật gần nhất |
| POST | `/workflow-templates` | `…:create` | Tạo quy trình kèm bản nháp v1 rỗng, hoặc chép từ một phiên bản có sẵn |
| GET/PATCH | `/workflow-templates/:id` | `…:view` / `…:update` | Sửa tên, mô tả, đang dùng. Đặt mặc định chỉ khi quy trình có bản đang hiệu lực, và cần quyền `approve` |
| GET | `/workflow-versions/:id` | `…:view` | Toàn bộ bước, phụ thuộc, hồ sơ yêu cầu và lịch xem trước |
| PUT | `/workflow-versions/:id` | `…:update` | Ghi đè toàn bộ nội dung bản nháp, kèm `revision`. Lệch revision trả 409 "đã có người sửa". Bản không phải nháp trả 409 |
| POST | `/workflow-versions/:id/clone` | `…:create` | Tạo bản nháp mới trong cùng quy trình, hoặc tạo quy trình mới cho dịch vụ khác ("nhân bản"). Ánh xạ lại khoá bước và phụ thuộc. Quy trình đã có bản nháp trả 409 |
| POST | `/workflow-versions/:id/publish` | `…:approve` | Transaction có điều kiện trạng thái: bản nháp thành Đang hiệu lực, bản đang hiệu lực cũ thành Ngừng. Hai lần bấm đồng thời chỉ một lần thành công, lần sau trả 409 |
| DELETE | `/workflow-versions/:id` | `…:update` | Xoá mềm bản nháp chưa từng phát hành. Phiên bản khác trả 409 |
| GET | `/workflow-versions/:id/preview?startDate&period` | `…:view` | Lịch dự kiến từng bước và tổng thời lượng |
| GET | `/service-types/:id/effective-workflow` | `service-catalog:view` | Phiên bản đang hiệu lực của quy trình mặc định, để 04/05 dùng |

- **Không sửa ngầm:** phiên bản Đang hiệu lực hoặc Ngừng là bất biến, kể cả các bước, phụ thuộc và hồ sơ yêu cầu. Muốn thay đổi thì nhân bản thành bản nháp mới. Phát hành phiên bản mới không thay đổi việc đã sinh; phiên bản Ngừng vẫn xem được.
- **Audit:** tạo/sửa/xoá đi qua interceptor chung. Phát hành, ngừng, đổi quy trình mặc định ghi `APPROVE` kèm mã quy trình, số phiên bản cũ/mới và số bước — không ghi toàn bộ nội dung.
- Danh sách và lựa chọn tuân theo quyền D1. Quy trình là dữ liệu dùng chung toàn công ty, không lọc theo nhóm.

### Bộ sinh việc (theo D3)

- `generateTasks` lấy phiên bản đang hiệu lực của quy trình mặc định cho từng dòng dịch vụ. Mỗi bước tạo một việc gồm tên bước, cần bằng chứng, hạn tính theo cách lập lịch ở trên (theo dự án thì lấy ngày bắt đầu HĐ làm ngày bắt đầu).
- Dòng dịch vụ không có quy trình đang hiệu lực thì không sinh việc và ghi log cảnh báo, như hiện nay khi dịch vụ chưa có việc mẫu.
- Giữ nguyên: thời điểm sinh khi duyệt HĐ, thứ tự chọn người làm, cách chống trùng theo dòng dịch vụ. Việc chưa lưu liên kết tới bước/phiên bản; phần này thuộc 05 (PL1 VIII.2).
- Xoá `PUT /service-types/:id/task-templates`. Bảng `task_templates` giữ chỉ-đọc để có thể quay lui; 05 xoá bằng migration riêng.

### Migration

- Thêm bảng mới, không sửa baseline hay migration 01/02.
- Với mỗi dịch vụ có `task_templates`, migration tạo:
  - quy trình `QT-<mã>-001`, đặt làm mặc định;
  - phiên bản v1 Đang hiệu lực, lập lịch theo kỳ, người phát hành để trống, ghi "chuyển đổi từ việc mẫu";
  - bước tương ứng theo `sortOrder`, giữ nguyên tên, số ngày lệch, cần bằng chứng; số cấp duyệt = 1, người kiểm tra là Trưởng nhóm (theo C13).
  - Không tự tạo phụ thuộc, vì dữ liệu cũ không có thứ tự ràng buộc.
- Kiểm chứng trên DB trống và trên bản sao có dữ liệu demo: bước sau chuyển đổi khớp 1–1 với việc mẫu cũ; việc sinh trước và sau migration có cùng tên và hạn; Prisma diff không lệch.

## 03-C — Danh mục hồ sơ yêu cầu

- `document_requirements` thuộc **phiên bản** quy trình (cùng bất biến sau khi phát hành). Mỗi hồ sơ gồm: tên, hướng dẫn, bắt buộc hay "nếu có", nhóm hồ sơ dùng chung danh mục 02, theo kỳ hay một lần, thứ tự, bước cần hồ sơ (tuỳ chọn, cùng phiên bản).
- Tối đa 100 hồ sơ mỗi phiên bản. Bước được gắn hồ sơ bắt buộc thì hồ sơ đó trở thành điều kiện bắt đầu của bước.
- 03 chỉ cấu hình danh mục. Danh sách hồ sơ cần thu cho từng KH/HĐ và 6 trạng thái (chưa yêu cầu → đã chấp nhận) do 05 sinh từ đây. Không thay bằng danh sách file đã upload ở kho hồ sơ 02.

## 03-D — Giao diện

- Menu đổi nhãn "Dịch vụ" → "Dịch vụ & quy trình" (`/service-catalog`). 11 mới chuyển vào mục Cài đặt theo PL1 VII.1.
- **Tab Dịch vụ:** bảng mã/tên/chu kỳ/giá chuẩn (theo quyền)/quy trình mặc định/trạng thái; modal thêm/sửa. Phần bảng giá chỉ hiện khi có `finance:view`: danh sách bảng giá theo ngày hiệu lực và form bậc giá. Bỏ phần sửa "việc mẫu" cũ.
- **Tab Quy trình mẫu** (`workflow-templates:view`): lọc theo dịch vụ/trạng thái/có bản nháp. Trang quy trình có lịch sử phiên bản và các nút nhân bản / tạo bản nháp / phát hành / đặt mặc định theo quyền.
- **Trình sửa phiên bản** (`/service-catalog/workflows/:id/versions/:versionId`):
  - Bảng bước nhóm theo giai đoạn, kéo thả để đổi thứ tự (`@angular/cdk`), drawer sửa từng bước.
  - Chọn phụ thuộc trong danh sách bước hiện có; nút "Làm song song với bước trước".
  - Tab Hồ sơ yêu cầu; tab Xem trước lịch hiển thị ngày bắt đầu/kết thúc từng bước và tổng "N ngày làm việc (chưa trừ ngày lễ)".
  - Bản đã phát hành chỉ đọc. Lỗi kiểm tra hiển thị ngay tại bước bị lỗi. Lệch `revision` thì báo và cho tải lại, không ghi đè. Ngăn bấm lưu/phát hành nhiều lần.
- Store/API đặt trong `data-access`; component trình bày chỉ nhận input và phát output; chuỗi giao diện trong `service-catalog.text.ts`. Ở 375px dùng được xem/sửa với bảng cuộn ngang; kéo thả có nút lên/xuống thay thế.

## Seed (dữ liệu mẫu cho môi trường dev)

- Chuyển 6 dịch vụ mẫu sang quy trình v1 Đang hiệu lực, lập lịch theo kỳ, giữ nguyên các bước hiện có. Riêng "Làm lại sổ sách" dùng mẫu 12 bước, lập lịch theo dự án, thời lượng lấy từ PL1 II.1:
  - các bước: tiếp nhận 2 · kiểm tra dữ liệu 3 · lập danh sách hồ sơ thiếu 2 · đối chiếu số dư 5 · kiểm tra hoá đơn 5 · lương/BHXH 5 · hàng tồn kho 5 · hoàn thiện sổ 10 · lập BCTC 3 · kiểm tra nội bộ 3 · phê duyệt 2 · bàn giao 1;
  - các bước nối tiếp nhau, tổng 46 ngày làm việc.
- "Hoàn thuế" có 7 hồ sơ yêu cầu theo PL1 V.1; hai hồ sơ hải quan/xuất khẩu đánh dấu "nếu có".
- Seed chạy lại không lỗi và chỉ tạo khi dịch vụ chưa có quy trình. DB demo đã chạy migration giữ dữ liệu đã chuyển đổi; mẫu 12 bước được tạo lại qua giao diện trong bước kiểm tra UAT.

## Phân kỳ triển khai

1. Duyệt đặc tả và D1–D5 → 03-A: schema/migration bảng giá, API, UI tab Dịch vụ, test.
2. 03-B: schema/migration quy trình và chuyển đổi dữ liệu, hàm kiểm tra và lập lịch, API vòng đời, đổi nguồn bộ sinh việc (D3), test.
3. 03-C: hồ sơ yêu cầu (schema/API/test).
4. 03-D: hoàn thiện trình sửa và xem trước, seed, kiểm tra hồi quy toàn dự án, demo, biên bản `03-service-catalog-acceptance.md`.

Các gói làm lần lượt trong cùng chức năng 03. Thay đổi test cũ ghi vào `03-test-policy-changes.md`, mỗi thay đổi có lý do và kiểm chứng tương đương. Dự kiến:

- e2e "thay danh sách việc mẫu" được thay bằng test vòng đời phiên bản, kèm test endpoint cũ trả 404.
- Phần dựng dữ liệu của `tasks.e2e-spec.ts` và `task-generator.spec.ts` chuyển sang phiên bản đang hiệu lực, giữ nguyên các kiểm tra tên, hạn, bằng chứng và chống trùng.

## Tiêu chí nghiệm thu

1. **Quyền theo D1:** giám đốc phát hành được; trưởng nhóm tạo/sửa bản nháp được nhưng phát hành bị 403; nhân viên chỉ xem; kế toán thu tiền và quản trị bị 403 với quy trình; bảng giá và báo giá bị 403 khi thiếu `finance:view`; vai trò tuỳ chỉnh áp đúng quyền đã cấp. Mỗi API mới có e2e phân quyền.
2. **Mẫu ví dụ:** cấu hình được mẫu 12 bước "Làm lại sổ sách" của PL1 qua API và giao diện, xem trước ra 46 ngày làm việc. Khi đặt 3 bước kiểm tra hoá đơn / lương / tồn kho song song, tổng thời lượng giảm đúng theo đường dài nhất.
3. **Kiểm tra hợp lệ:** vòng phụ thuộc, tự phụ thuộc, phụ thuộc khác phiên bản, thiếu thời lượng hoặc số ngày lệch đều bị từ chối và chỉ rõ bước lỗi. Sửa phiên bản đã phát hành trả 409. Hai người sửa cùng bản nháp: người lưu sau nhận 409. Phát hành đồng thời: đúng một phiên bản Đang hiệu lực.
4. **Nhân bản:** tạo bản nháp mới có khoá bước và phụ thuộc ánh xạ đúng; nhân bản sang dịch vụ khác ra mã quy trình mới; bản gốc không đổi.
5. **Bảng giá:** bậc chồng lấn hoặc hở bị từ chối; báo giá chọn đúng bảng theo ngày và đúng bậc tại biên; không có bậc phù hợp thì trả giá chuẩn; bảng đã hiệu lực không sửa được; HĐ cũ giữ nguyên đơn giá.
6. **Bộ sinh việc (D3):** duyệt HĐ sinh việc đúng từ phiên bản đang hiệu lực, cả theo kỳ và theo dự án. Phát hành phiên bản mới không đổi việc đã sinh. Gọi sinh việc lại không tạo trùng. Hồi quy `tasks`/`contracts`/`dashboard`/`reports` đều đạt.
7. **Migration:** đạt trên DB trống và bản sao có dữ liệu demo, chuyển đổi khớp 1–1, Prisma diff sạch.
8. **Chất lượng:** unit test cho hàm phát hiện vòng, lập lịch (song song, cuối tuần, biên kỳ), kiểm tra hợp lệ, ánh xạ khi nhân bản, chọn bậc giá. Lint, unit, e2e, build và `check-max-lines` đều đạt; mọi cảnh báo báo đúng thực tế; không skip hoặc nới lỏng test.
9. **Giao diện desktop/375px:** tạo dịch vụ → bảng giá → quy trình → sửa bản nháp (kéo thả, phụ thuộc, hồ sơ) → xem trước → phát hành → nhân bản thành v2 → duyệt HĐ thử và thấy việc sinh theo v2.
10. Không ghi đã cấu hình xong dữ liệu dịch vụ, quy trình hay bảng giá thật khi chưa có đầu vào QD07.

## Tiến độ triển khai

### 03-A — Dịch vụ và bảng giá (đã code và kiểm chứng kỹ thuật ngày 15/10/2026)

Kết quả kiểm tra ghi trong [hiện trạng](../planning/current-status.md). Quy ước chi tiết đã chọn khi triển khai, trong khuôn khổ đặc tả đã duyệt:

- **Bậc giá là khoảng nửa mở** `từ ≤ giá trị < đến`; ô "đến" để trống chỉ ở bậc cuối (không giới hạn). Màn hình tự lấy "từ" của bậc sau bằng "đến" của bậc trước nên người dùng không nhập được bậc hở/chồng lấn; backend vẫn kiểm tra lại, database có ràng buộc giá trị không âm và "đến" > "từ".
- **Tiêu chí được chụp vào từng bảng giá** khi tạo. Đổi tiêu chí của dịch vụ chỉ áp dụng cho bảng giá tạo sau, không làm sai nghĩa bảng cũ. Dịch vụ "một mức giá" chỉ có một bậc từ 0, không giới hạn.
- **Ngày hiệu lực** không được trước hôm nay (giờ Việt Nam). Bảng có ngày hiệu lực sau hôm nay mới sửa/xoá được; điều kiện ngày nằm trong câu lệnh cập nhật để không sửa được bảng vừa đến ngày áp dụng. Mỗi dịch vụ có tối đa một bảng giá còn hiệu lực cho mỗi ngày (unique một phần); xoá mềm thì dùng lại được ngày đó.
- **API:** `GET/POST /service-types/:id/price-lists`, `PUT/DELETE /service-types/:id/price-lists/:priceListId`, `GET /service-types/:id/price-quote?value=&date=`. Báo giá trả `fallback` và lý do `NO_PRICE_LIST`/`NO_TIER` khi dùng giá chuẩn; bảng giá theo bậc thiếu `value` trả 400. `GET /service-types` nhận thêm `active=true|false` và `search`, vẫn trả cả danh sách vì danh mục nhỏ và form hợp đồng đang dùng.
- **Quyền:** đọc cần `service-catalog:view`, ghi cần `service-catalog:update`; cả hai cần thêm `finance:view` (kiểm tra trong service, không sửa guard chung). Theo ma trận 01: giám đốc ghi; trưởng nhóm và kế toán thu tiền chỉ xem; nhân viên và quản trị bị 403.
- **Audit:** `PRICE_LIST_CREATE/UPDATE/DELETE` ghi ngày, tiêu chí và các bậc trước–sau; sửa dịch vụ ghi `SERVICE_UPDATE` với các trường thay đổi (mã, tên, chu kỳ, giá chuẩn, tiêu chí, đơn vị, trạng thái).
- **Giao diện:** bộ lọc trạng thái/từ khoá, cột tiêu chí; ngăn "Bảng giá" chỉ hiện với người có quyền tài chính. Form dịch vụ chuyển thành component chỉ nhận input/phát output, lưu qua store; chuỗi giao diện trong `service-catalog.text.ts`. Phần sửa việc mẫu cũ giữ nguyên tới 03-B.
- Model dịch vụ chuyển sang `prisma/schema/service-catalog.prisma` (không đổi SQL). Migration `20261016000000_service_price_lists` chỉ thêm cột/bảng; seed thêm bảng giá mẫu cho dịch vụ KTT (dữ liệu dev, không phải giá thật).
- Không thay đổi test cũ nào trong 03-A.

### 03-B — Quy trình mẫu có phiên bản (đã code và kiểm chứng kỹ thuật ngày 15/10/2026)

- **Dữ liệu:** `workflow_templates`, `workflow_template_versions`, `workflow_steps`, `workflow_step_dependencies` trong `service-catalog.prisma`. Unique một phần: một quy trình mặc định mỗi dịch vụ, một bản nháp và một bản đang hiệu lực mỗi quy trình; ràng buộc giá trị (cấp duyệt 0–2, thời lượng 1–365, số ngày lệch ±365, không tự phụ thuộc). Người mặc định lưu id và được kiểm tra đang hoạt động khi lưu/phát hành (không thêm khoá ngoại sang `users` để không sửa schema 01).
- **Migration** `20261016010000_workflow_templates` chuyển việc mẫu cũ thành `QT-<mã>-001` v1 đang hiệu lực, theo kỳ, đúng thứ tự, 1 cấp soát xét của trưởng nhóm; dịch vụ không có việc mẫu không tạo quy trình. Bảng `task_templates` giữ nguyên, không còn được ghi.
- **API** như bảng đặc tả. Cụ thể hoá khi triển khai: tạo quy trình kèm bản nháp v1 (dịch vụ một lần mặc định lập lịch theo dự án); lần phát hành đầu tự thành quy trình mặc định nếu dịch vụ chưa có; ngừng dùng quy trình thì bỏ mặc định; lỗi cấu trúc (trùng khoá, phụ thuộc không tồn tại/chính nó, vòng) chặn cả khi lưu nháp; bước trả về API cùng dạng với nội dung gửi lên.
- **Quyền D1:** khoá `workflow-templates`; nhãn thêm ở màn hình người dùng/nhật ký.
- **Bộ sinh việc D3:** đọc phiên bản đang hiệu lực của quy trình mặc định; theo kỳ giữ công thức cũ, theo dự án lấy ngày kết thúc dự kiến từ ngày bắt đầu HĐ; dịch vụ chưa có quy trình ghi cảnh báo, không sinh việc.
- **Giao diện:** `/service-catalog/workflows` (lọc theo dịch vụ, tạo quy trình) và trang quy trình (chọn phiên bản, bảng bước có lên/xuống thay kéo thả, ngăn sửa bước, nút "Làm song song với bước trước", xem trước lịch, lưu nháp/phát hành/tạo nháp/xoá nháp/đặt mặc định theo quyền, xác nhận bằng hộp thoại giữa màn hình). Form dịch vụ bỏ phần việc mẫu; danh sách dịch vụ hiện quy trình mặc định. Chưa có chọn người mặc định cụ thể trên giao diện (API đã hỗ trợ) — làm ở 03-D.
- Seed tạo quy trình cho 6 dịch vụ mẫu; "Làm lại sổ sách" là mẫu 12 bước PL1 theo dự án (46 ngày làm việc).
- Thay đổi test: [giải trình](03-test-policy-changes.md).

### 03-C — Danh mục hồ sơ yêu cầu (đã code và kiểm chứng kỹ thuật ngày 15/10/2026)

- Bảng `document_requirements` thuộc phiên bản (xoá theo phiên bản), gắn bước tuỳ chọn (bước bị xoá thì bỏ gắn), dùng nhóm hồ sơ của 02; migration `20261016020000_document_requirements`.
- Lưu cùng bản nháp qua `PUT /workflow-versions/:id` trường `requirements`; **không gửi trường này thì giữ nguyên danh sách hiện có** (gắn lại theo khoá bước). Tên không trùng (không phân biệt hoa thường), bước phải có trong phiên bản; kiểm tra lại khi phát hành. Phiên bản đã phát hành không sửa được; nhân bản chép hồ sơ và gắn sang bước của phiên bản mới.
- Giao diện: tab "Hồ sơ yêu cầu" trên trang quy trình (thêm/sửa/xoá/sắp xếp, bắt buộc hay "nếu có", theo kỳ hay một lần, bước cần hồ sơ); xoá bước thì hồ sơ gắn bước đó chuyển thành không gắn.
- Seed: "Hoàn thuế" có 7 hồ sơ theo PL1 V.1; 4 hồ sơ bắt buộc gắn bước "Lập hồ sơ đề nghị hoàn thuế", 3 hồ sơ "nếu có".
- Chưa sinh danh sách hồ sơ cho từng KH/HĐ và 6 trạng thái hồ sơ — thuộc 05 theo đặc tả. Không thay đổi test cũ.

### 03-D — Hoàn thiện giao diện và kiểm chứng (15/10/2026)

Chọn người mặc định cho bước, kéo thả thứ tự bước, đổi nhãn menu, ô chọn co giãn ở màn hẹp, test giao diện; kiểm chứng toàn bộ tiêu chí trong [biên bản 03](03-service-catalog-acceptance.md). **Chức năng 03 chờ người dùng nghiệm thu.**
