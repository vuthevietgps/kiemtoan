# 09 — Giải trình thay đổi test cũ

Theo quy tắc mục 8: chỉ đổi test khi đặc tả được duyệt thay đổi hoặc chứng minh test cũ sai; ghi lý do trước khi đổi, giữ mức kiểm chứng tương đương. Đặc tả [09](09-client-credentials.md) và L1–L12 được duyệt ngày 30/10/2026.

## 09-B (30/10/2026) — dữ liệu và API kho tài khoản

| File | Thay đổi | Lý do | Kiểm chứng giữ nguyên |
| --- | --- | --- | --- |
| `test/customers-credentials.e2e-spec.ts` (tạo tài khoản, đổi mật khẩu khi sửa) | Token tạo bằng **nhà cung cấp + số serial** thay cho tên đăng nhập; `PATCH` gửi thêm `revision` | L2: token bắt buộc nhà cung cấp, serial, hạn; không dùng tên đăng nhập. Kiểm soát đồng thời (đặc tả 09): mọi lệnh ghi kiểm `revision` | Giữ nguyên: không trả `passwordEnc`, không chứa bản rõ, DB lưu bản mã; xem trả đúng mật khẩu và ghi `VIEW_SECRET`; đổi mật khẩu rồi xem ra mật khẩu mới; thu tiền 403, nhân viên ngoài phân công 404 |
| `test/permissions-financial.e2e-spec.ts` (chuẩn bị dữ liệu) | Tài khoản loại `OTHER` thêm `label` | L1: loại "Khác" bắt buộc nhập tên | Không đổi kiểm tra nào: chặn nhân viên mặc định, bắt xác nhận lại 5 phút, cấp riêng có hiệu lực, ngoài phân công 404 |
| `src/modules/client-credentials/client-credentials.service.spec.ts` | Viết lại theo cấu trúc mới: xem mật khẩu chuyển sang `CredentialSecretsService`, `CREDENTIAL_PUBLIC_SELECT` sang service đọc; tạo chạy trong transaction có sự kiện | Tách service theo đặc tả 09 (L5–L8) | Giữ cả 4 kiểm tra cũ (không chọn `passwordEnc`; mã hoá khi tạo, không lưu bản rõ; xem trả bản rõ + `VIEW_SECRET`; ngoài phạm vi 404 không ghi log); thêm sao chép `COPY_SECRET`, token/loại Khác thiếu trường → 400, khoá sai không ghi log |
