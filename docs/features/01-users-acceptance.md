# Biên bản nghiệm thu kỹ thuật chức năng 01

Ngày **15/10/2026**. Kết luận: **ĐẠT trong phạm vi chức năng 01**, theo ủy quyền trực tiếp của người dùng chốt ma trận và nghiệm thu. Người thực hiện: agent phát triển/kiểm chứng. Không ghi nhận đây là UAT đã ký bởi chị Hà hoặc người dùng thật.

Căn cứ: [đặc tả và ma trận quyền](01-users-access-control.md), QD01–02 trong [sổ quyết định](../requirements/decision-register.md). Phạm vi tích hợp quyền sang hợp đồng/dashboard/báo cáo và các điểm liên quan được người dùng cho phép; không sửa công thức tiền. Không commit/push/merge.

## Kết quả tiêu chí

| Tiêu chí | Bằng chứng và kết quả |
| --- | --- |
| Ma trận 5 vai trò, quyền hành động/phạm vi/trường | Đạt: Director, Manager, Staff, Cashier, Admin; vai trò tuỳ chỉnh bị giới hạn quyền và scope; API 403, ngoài phạm vi 404 |
| Tài khoản/nhóm | Đạt: tìm/lọc/phân trang, tạo/sửa, nhóm, khoá/mở/nghỉ việc, không tự vô hiệu hoặc làm mất tài khoản quản trị cuối, kể cả thao tác đồng thời |
| Cấp quyền có phê duyệt | Đạt: admin chỉ đề nghị, director duyệt/từ chối; không tự nâng quyền; transaction một lần; audit trước–sau; danh sách yêu cầu phân trang/lọc |
| Mời/reset và mật khẩu | Đạt: hash token, hết hạn/dùng một lần, mật khẩu mạnh, buộc đổi ban đầu, khoá tạm; không lộ link qua quên mật khẩu; admin không nhận link đặc quyền hoặc reset director |
| Thay quyền tài khoản chưa kích hoạt | Đạt: vô hiệu link và mật khẩu tạm đã biết trước khi được cấp quyền; phải gửi lại lời mời, tránh chiếm tài khoản sau phê duyệt |
| Phiên đăng nhập | Đạt: JWT 15 phút, cookie HttpOnly/SameSite, rotation/replay, thu hồi một/tất cả phiên, logout khi refresh vừa xoay, chống khôi phục trạng thái đăng xuất bởi response cũ |
| Tiền/bí mật/export | Đạt: không trả trường tiền khi thiếu quyền ở API và CSV; Cashier không xem báo cáo vận hành; bí mật cần cấp quyền và xác nhận mật khẩu gần nhất; scope vẫn có hiệu lực |
| Audit | Đạt: trước–sau, sự kiện tài khoản/quyền, download/export và xem bí mật; XLSX mở bằng openpyxl, 7 cột, không công thức; DB từ chối UPDATE/DELETE nhật ký |
| Migration | Đạt: 3 migration trên DB trống; nâng cấp baseline có tài khoản mẫu giữ email/role/active/password, authVersion=0, mustChangePassword=false; Prisma diff không lệch schema |
| UI | Đạt: admin vào Người dùng, không vòng chuyển hướng; tạo người dùng và lời mời thủ công trên dữ liệu giả; trang tài khoản/phiên; kiểm tra desktop và 375px. Kích hoạt/reset/duyệt quyền được kiểm chứng bằng API e2e; chưa xác nhận toàn luồng này bằng thao tác UI của người dùng thật |

## Bộ kiểm tra ngày 15/10/2026

| Lệnh / kiểm tra | Kết quả |
| --- | --- |
| API `npm run lint` | Exit 0; 0 lỗi, 10 cảnh báo độ dài hàm: 9 ở test, 1 ở `UserAccessService.saveRole` (81 dòng) |
| Web `npm run lint` | Exit 0; 0 lỗi, 1 cảnh báo độ dài hàm test hợp đồng |
| API `npm test -- --runInBand` | 17 suites / 95 tests đạt |
| API `npm run test:e2e` | 14 suites / 115 tests đạt; PostgreSQL 16 riêng, không dùng DB demo/thật |
| API `npm run test:access` | 6 suites / 55 tests đạt; threshold ≥70% được cưỡng chế |
| Web `npm test -- --watch=false` | 5 files / 22 tests đạt |
| API và web production build | Đạt; initial web khoảng 1,45 MB |
| `node scripts/check-max-lines.mjs` | Đạt; không file code vượt 1.000 dòng |
| `npm audit --omit=dev` trong API | 0 vulnerabilities; không đồng nghĩa audit cả công cụ dev sạch |

Coverage bộ `test:access`: **95,75% dòng; 94,49% statements; 81% branches; 94,36% functions**.

| Service / nhóm | Coverage dòng |
| --- | --- |
| access-control: permissions, data-scope, financial-fields/interceptor | 100% |
| AccountTokensService | 95,34% |
| AuthMailerService | 100% |
| AuthSessionsService | 97,29% |
| AuthService | 95,65% |
| UserAccessService | 92,50% |
| UsersService | 93,33% |

Kết quả cục bộ lưu ở `tmp/01-final-e2e.log`, `tmp/01-final-access.log`, `apps/api/coverage/access-control/`. Ảnh UI: [desktop](../../tmp/01-users-desktop.png), [375px](../../tmp/01-users-mobile.png), [tài khoản 375px](../../tmp/01-account-mobile.png); chỉ có dữ liệu giả của DB kiểm thử. Các artifact tmp/coverage có thể được tạo lại, không phải dữ liệu nguồn yêu cầu.

Test cũ thay đổi theo chính sách được duyệt có [giải trình](01-test-policy-changes.md); giữ kiểm chứng tương đương và thêm tình huống từ chối. Không skip/nới test để pass.

## Giới hạn và bàn giao

- Chưa cấu hình/gửi SMTP thật; transport chỉ được giả lập trong unit test. Dùng link bàn giao thủ công theo [hướng dẫn](../operations/identity-access.md), không báo email đã gửi khi chưa gửi.
- Chưa triển khai HTTPS/cloud, CI từ xa, kiểm thử tải hoặc chuyển đổi dữ liệu thật. Tồn đọng 00 theo dõi riêng theo chỉ đạo mới, không ảnh hưởng kết luận kỹ thuật 01 cục bộ.
- Các module nghiệp vụ khác chưa được nghiệm thu toàn bộ. Lỗi phân bổ/quá hạn và coverage service tiền vẫn thuộc 07; không dùng số tiền demo làm số liệu chính thức.
- Bước phát triển tiếp theo là **02 — khách hàng và hồ sơ**, cập nhật đặc tả theo yêu cầu tích hợp trước triển khai. Không mở đồng thời nhiều chức năng.
