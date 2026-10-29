# Tiếp nối phần code của Claude — 14/10/2026

> Bàn giao lịch sử. Đọc [hiện trạng mới nhất](../../planning/current-status.md); kết quả và câu hỏi bên dưới phản ánh thời điểm bàn giao cũ.

## Phạm vi đã thực hiện

Tiếp tục luồng tạo/sửa hợp đồng đã có. File được sửa gần nhất khi tiếp nhận là
`apps/web/src/app/features/contracts/pages/contract-form/contract-form.page.html`.
Không bắt đầu chức năng mới, không sửa module nghiệp vụ khác, không thay đổi schema database.
Chưa có xác nhận nghiệm thu của chủ đầu tư.

- `PATCH /api/v1/contracts/:id`: phân biệt trường không gửi (giữ nguyên) và `null`
  (xoá `ownerId`, `signedDate`, `endDate`, `note`).
- `/contracts/new`, `/contracts/:id/edit`: chặn lưu trong khi tải chi tiết, tải lỗi,
  hợp đồng đã duyệt hoặc đang gửi request. Xoá trường tuỳ chọn trên form được lưu đúng.
- Sửa dòng “Trống” thừa trong bảng dịch vụ/đợt thanh toán khi FormArray đã có dữ liệu.
- Chuỗi tiếng Việt của form được chuyển sang `contract-form.vi.ts`.
- Cập nhật đặc tả `docs/features/04-contracts.md`.

## File code đã sửa hoặc tạo

| File | Thay đổi |
| --- | --- |
| `apps/api/src/modules/contracts/contracts-command.service.ts` | Lưu ngày tuỳ chọn theo ngữ nghĩa `undefined`/`null` |
| `apps/api/src/modules/contracts/dto/contract.dto.ts` | Khai báo kiểu nullable cho trường tuỳ chọn |
| `apps/api/src/modules/contracts/contracts-update.service.spec.ts` | 5 unit test hồi quy |
| `apps/api/test/contracts-edit.e2e-spec.ts` | 4 e2e test, gồm 403 và phạm vi 404 |
| `apps/web/src/app/features/contracts/pages/contract-form/contract-form.page.ts` | Trạng thái tải/lưu và payload xoá trường |
| `apps/web/src/app/features/contracts/pages/contract-form/contract-form.page.html` | Chặn nút Lưu, báo lỗi, đồng bộ bảng và nhãn tiếng Việt |
| `apps/web/src/app/features/contracts/pages/contract-form/contract-form.page.spec.ts` | 7 test luồng lưu |
| `apps/web/src/app/features/contracts/pages/contract-form/contract-form.vi.ts` | Chuỗi tiếng Việt của form |

## Kết quả kiểm chứng

| Kiểm tra | Kết quả thực tế |
| --- | --- |
| Backend unit toàn bộ: `npm --prefix apps/api test -- --runInBand` | 13 suites, 71 tests passed |
| Backend unit mới sau khi tách helper fixture | 1 suite, 5 tests passed |
| E2e: `contracts-edit.e2e-spec.ts` và `contracts.e2e-spec.ts` | 2 suites, 19 tests passed |
| E2e mới sau khi tách helper fixture | 1 suite, 4 tests passed |
| Frontend: `npm --prefix apps/web test -- --watch=false` | 1 file, 7 tests passed |
| ESLint backend module contracts và e2e mới | Exit 0, không lỗi/cảnh báo |
| ESLint backend toàn bộ, không dùng `--fix` | Exit 1: 25 lỗi, 9 cảnh báo có từ trước |
| `npm --prefix apps/web run lint` | Exit 1: frontend chưa có script lint |
| Backend `tsc --noEmit -p tsconfig.json` và `npm run build` | Exit 0 |
| Frontend build development | Exit 0, output `tmp/build-codex` |
| Prettier các file code đã sửa/tạo | Passed |
| `node scripts/check-max-lines.mjs` | OK, không file nào vượt 1.000 dòng |
| Thử giao diện thật | Lưu ngày ký/ghi chú, mở lại, xoá ngày ký/người phụ trách/ghi chú, lưu và xác nhận đã xoá |

E2e và thử giao diện dùng PostgreSQL 16 riêng tại `127.0.0.1:5434`, database
`ketoan_codex_contracts`, container `ketoan-codex-contracts-test`.
Đã dừng container và hai server kiểm tra (API 3005, web 4301) sau khi xong.
Không thực hiện thao tác dữ liệu trên database demo `ketoan`.

## Tồn tại cần biết trước khi tiếp tục

- 25 lỗi lint backend nằm trong `core`, `users` và test/helper tương ứng;
  số lỗi và cảnh báo giống hiện trạng trước khi sửa. Báo cáo JSON: `tmp/api-lint-final.json`.
  Cần chốt phạm vi trước khi sửa sang các module này theo `AGENTS.md`.
- Frontend chưa cấu hình ESLint/script lint.
- Thư mục làm việc chưa có `.git`; không có cơ sở xác nhận nhánh, commit hay tình trạng merge.
  Chưa commit/push. Bản gốc của các file đã sửa được giữ tại `tmp/contracts-before-codex`.
- Đã đọc `AGENTS.md`, `CLAUDE.md`, quy tắc code, agent brief, toàn bộ đặc tả cục bộ
  và phần văn bản trong `Cau_hoi_lam_ro_yeu_cau.docx`.
  Hai liên kết artifact trong AGENTS/CLAUDE đều không truy cập được từ công cụ web.
- Các câu hỏi làm rõ nghiệp vụ vẫn chưa có câu trả lời, ngoại trừ quy mô 50 nhân viên/500 khách hàng.
- Chưa kiểm tra giao diện ở độ rộng 375px; chưa chạy toàn bộ e2e của các module khác.
- Chưa đủ điều kiện nghiệm thu toàn dự án vì lint chung chưa đạt.
