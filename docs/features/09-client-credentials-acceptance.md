# 09 — Biên bản kiểm chứng kỹ thuật (kho tài khoản khách hàng và chữ ký số)

Ngày 30/10/2026. Phạm vi: [đặc tả 09](09-client-credentials.md), L1–L12 được duyệt ngày 30/10/2026 (“Duyệt, làm 09-B”);
gói 09-B (dữ liệu, API), 09-C (nhắc hạn qua 06), 09-D (giao diện), 09-E (bảo mật, khoá, sao lưu / khôi phục).

Trạng thái: **đã hoàn thiện kỹ thuật, chờ người dùng nghiệm thu.**

## Kết quả theo tiêu chí

| # | Tiêu chí (đặc tả 09) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Thêm / sửa / xoá đúng quyền, phạm vi; "Khác" bắt buộc tên; token bắt buộc nhà cung cấp, serial, hạn; trùng serial → 409 | **Đạt** | e2e `client-credentials-vault` (400 theo loại, serial khác hoa thường / khoảng trắng → 409, nhân viên 403, xoá thiếu lý do 400); unit `credential.rules.spec`; web `credential-form.component.spec` |
| 2 | Mật khẩu / PIN không có trong phản hồi API nào ngoài xem / sao chép, nhật ký chung, lịch sử, thông báo, email, log máy chủ | **Đạt** | e2e `client-credentials-security`: đi hết vòng đời (tạo, đổi mật khẩu, 400 / 409 có gửi mật khẩu, xem, sao chép, báo lỗi, mượn / trả, chạy nhắc hạn, danh sách, chi tiết, nhật ký, thông báo, `/audit-logs`, xoá) rồi quét mọi phản hồi, stdout / stderr của máy chủ và các bảng `credential_events`, `audit_logs`, `notifications`, `notification_deliveries`, `client_credentials` — không chứa bí mật nào |
| 3 | Mỗi lần Xem / Sao chép đúng một dòng nhật ký; thiếu quyền hoặc quá 5 phút chưa xác nhận → 403; ngoài phân công → 404 | **Đạt** | e2e `client-credentials-vault` (VIEW_SECRET + COPY_SECRET, nhật ký riêng, nhân viên không xem nhật ký); `permissions-financial`, `customers-credentials` (403 mặc định, xác nhận 5 phút, 404); giao diện: hỏi xác nhận rồi hiện PIN, tab nhật ký đủ Xem + Sao chép |
| 4 | Đổi mật khẩu ghi ai / lúc; không còn cách đọc mật khẩu cũ | **Đạt** | e2e: sự kiện SECRET_CHANGED, `secretChangedBy`; không lưu bản mã cũ (đặc tả L5) |
| 5 | Token: mượn / trả / giao / trả khách đúng quyền; mượn đồng thời → 200 + 409; luôn một nơi giữ; lịch sử đủ | **Đạt** | e2e `client-credentials-tokens` 6; web `credential-drawer.component.spec` (nút theo nơi giữ / người mượn / quyền); giao diện: cất tại văn phòng → mượn → trả |
| 6 | Nhắc hạn token và mượn quá hạn đúng người, đúng mốc, không trùng; trả / gia hạn dừng nhắc mốc cũ | **Đạt** về kỹ thuật — email thật chờ SMTP (QD09) | e2e `credential-reminders` 2 (đồng hồ giả lập), unit `credential-reminders.spec` 3; `reminders.e2e` (06) vẫn đạt |
| 7 | Migration giữ số bản ghi, token cũ chuyển đúng trường, `credential-key check` đạt; dump → restore → check đạt với khoá đúng, báo lỗi với khoá sai; rotate xong check đạt | **Đạt** | `ketoan_mig_09b`: 4 tài khoản, token → serial / VNPT-CA / "Chưa xác định", 4 sự kiện chuyển đổi, Prisma diff rỗng; [thử sao lưu / khôi phục / xoay khoá](../operations/credential-key.md#bằng-chứng-đã-thử-30102026-máy-cục-bộ); unit `credential-key.spec` 4 |
| 8 | Lint / unit / e2e / access / web / build / max-lines; desktop và 375px | **Đạt** | Bảng dưới; giao diện ~800px và 375px không tràn ngang |

## Số liệu kiểm chứng cuối (30/10/2026, máy cục bộ)

| Kiểm tra | Kết quả |
| --- | --- |
| API unit | 336/336, 51 suites |
| API e2e (chia lô `scripts/run-e2e-batches.mjs`) | **309/309, 52 file, 11/11 lô** (thêm `client-credentials-security` 2) |
| API access | **57/57** ngay sau e2e |
| Web test | 166/166, 47 file |
| Lint, build, typecheck, `check-max-lines` | API / web 0 lỗi; build API / web đạt (lệnh `dist/src/core/crypto/credential-key.cli.js` có trong bản build); typecheck chỉ còn 4 lỗi cũ (02); không file nào vượt 1.000 dòng |

## Thay đổi ngoài module đã duyệt

- `notifications` (06): nguồn nhắc `CREDENTIAL` (`credential-reminders.ts`, một dòng trong `ReminderService.plan`, huỷ email chờ trong `reminder-cancel.ts`).
- `customers` (02): tab "Tài khoản đăng nhập" của hồ sơ KH dùng thành phần kho mới (chỉ giao diện).
- `core/crypto`: tách hàm AES-GCM sang `aes-gcm.ts` để `CryptoService` và lệnh khoá dùng chung (định dạng bản mã không đổi — dữ liệu cũ vẫn giải mã được, đã kiểm trên bản sao demo); thêm `credential-key.ts` / `.cli.ts` (L12).
- Nhật ký chung: thêm giá trị hành động `COPY_SECRET`, `ROTATE_KEY`.

## Còn mở / giới hạn

- **Người dùng nghiệm thu 09** trên dữ liệu thật: nhập tài khoản / token thật, xác định nơi giữ cho token chuyển đổi.
- Email nhắc hạn thật cần SMTP (QD09); Zalo chưa có (QD09).
- Đã thấy mật khẩu thì người xem vẫn có thể tự ghi lại — hệ thống chỉ bảo đảm mọi lần lấy ra đều có nhật ký (L6).
- Sao chép phụ thuộc trình duyệt cho phép ghi bộ nhớ tạm; không cho phép thì báo "Trình duyệt không cho phép sao chép" (vẫn đã ghi nhật ký lần lấy bí mật).
- Khoá thật trên máy chủ, người giữ bản ngoại tuyến và lịch xoay khoá: IT / Giám đốc chốt khi triển khai (QD11).
- Danh mục loại tài khoản tuỳ biến (11); báo cáo token / ô cảnh báo trên tổng quan (10).
- Chưa đưa lên vsademo.
