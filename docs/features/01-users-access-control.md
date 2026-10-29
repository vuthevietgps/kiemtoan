# 01 — Tài khoản, người dùng, phân quyền và nhật ký

Chốt ngày **15/10/2026** theo ủy quyền trực tiếp: “Hoàn thiện chức năng người dùng và phân quyền cho tôi. nghiệm thu và ma trận quyền chốt luôn theo cách hợp lý nhất.” Người dùng đã cho phép sửa các điểm phân quyền liên quan trong hợp đồng/dashboard/báo cáo và test, không đổi công thức tiền. Chỉ đạo mới cho phép triển khai 01; tồn đọng CI/cloud của 00 theo dõi riêng. Không tự commit/push.

Phạm vi: auth/access-control/audit/users, schema/migration và UI tương ứng, các điểm phân quyền liên quan đã được cho phép. Không triển khai chức năng nghiệp vụ mới ở module khác.

## Ma trận mặc định đã chọn

| Nhóm | Giám đốc | Trưởng nhóm | Nhân viên | Kế toán thu tiền | Quản trị hệ thống |
| --- | --- | --- | --- | --- | --- |
| Phạm vi nghiệp vụ | Toàn công ty | Nhóm và phần mình phụ trách | KH phân công; việc giao mình | Toàn công ty trong thu/hoá đơn | Không |
| KH/hồ sơ | Quản lý | Quản lý trong nhóm | Xem/tải hồ sơ được giao | Xem phục vụ thu | Không |
| Hợp đồng | Quản lý/duyệt | Xem/tạo/sửa, không duyệt | Xem phần thực hiện, không tiền | Xem gồm tiền | Không |
| Công việc | Quản lý/duyệt | Quản lý/soát xét trong nhóm | Cập nhật việc của mình | Không | Không |
| Tài chính | Toàn bộ | Trong nhóm | Không mặc định; có thể cấp riêng | Thu/công nợ/hoá đơn | Không |
| Thu/hoá đơn | Quản lý | Xem, đề nghị hoá đơn | Không mặc định | Thao tác thu/hoá đơn | Không |
| Báo cáo | Vận hành + tài chính | Vận hành + tài chính trong nhóm | Vận hành trong phạm vi mình | Chỉ tài chính | Không |
| Kho tài khoản KH | Quản lý/bí mật | Quản lý/bí mật trong nhóm | Danh mục; bí mật khi cấp riêng | Không | Không |
| Danh sách người dùng | Toàn bộ | Nhóm, ngoài nhóm 404 | Hồ sơ bản thân | Hồ sơ bản thân | Toàn bộ |
| Quản lý tài khoản | Quản lý và duyệt quyền | Không | Không | Không | Tạo/sửa/khoá/mời; quyền cao xin duyệt |
| Vai trò tuỳ chỉnh | Tạo/sửa và duyệt gán | Xem ma trận | Xem ma trận bản thân | Xem ma trận bản thân | Xem và đề nghị thay đổi |
| Nhật ký | Xem/xuất | Không toàn cục | Không | Không | Xem/xuất, không sửa/xoá |

Bổ sung ngày 15/10/2026 theo [đặc tả 03](03-service-catalog.md) D1 đã duyệt: khoá quyền `workflow-templates` cho quy trình mẫu. Giám đốc toàn quyền và phát hành; trưởng nhóm xem/tạo/sửa bản nháp; nhân viên xem; kế toán thu tiền và quản trị không có quyền. Triển khai cùng chức năng 03.

Giám đốc không dùng wildcard để vượt mọi kiểm soát. Admin không mặc nhiên có quyền tài chính/bí mật. Mọi người được quản lý hồ sơ, mật khẩu và phiên bản thân.

Vai trò tuỳ chỉnh dựa trên MANAGER/STAFF/CASHIER, chọn quyền trong danh mục và scope không rộng hơn vai trò nền; không chứa quyền quản trị users/audit/settings. Chỉ giám đốc quản lý định nghĩa vai trò.

## Cấp quyền và tài khoản

- Admin đổi role/vai trò tuỳ chỉnh/quyền tiền/bí mật phải tạo yêu cầu chờ giám đốc; quyền cũ giữ nguyên. Giám đốc cấp trực tiếp cho người khác; không tự thay quyền bản thân. Duyệt/từ chối có lý do và trước–sau, transaction xử lý đúng một lần.
- Không tự khoá/nghỉ việc hoặc làm mất admin/giám đốc hoạt động cuối cùng; transaction có khoá chung tránh race. Đổi quyền/nhóm hoặc khoá/nghỉ việc thu hồi phiên. Không tự di chuyển KH/việc khi đổi nhóm; giữ dữ liệu để bàn giao ở chức năng sau.
- Tìm/lọc/phân trang người dùng; tạo/sửa nhóm, không xoá nhóm còn thành viên; danh sách options cũng giới hạn theo scope.
- Mật khẩu mới 10–72 ký tự, tối đa 72 byte UTF-8, có hoa/thường/số/ký tự đặc biệt. Mật khẩu cũ vẫn đăng nhập được khi chuyển đổi. Admin đặt mật khẩu ban đầu thì buộc đổi lần đầu.
- 5 lần sai khoá tạm 15 phút; bộ đếm nguyên tử, thông báo chung khi email/mật khẩu sai. Không lộ tài khoản qua quên mật khẩu.
- Access JWT 15 phút, refresh cookie HttpOnly/SameSite 7 ngày; chỉ lưu hash, xoay token, phát hiện replay. Logout thu hồi server; xem thiết bị/IP/thời gian và thu hồi từng/tất cả phiên.
- Lời mời một lần 24 giờ; reset một lần 30 phút. Chỉ lưu hash; đổi mật khẩu vô hiệu link và phiên cũ. SMTP qua biến môi trường; chưa có SMTP thì admin nhận link qua kênh quản trị để bàn giao, UI nói rõ chưa gửi email. Endpoint quên mật khẩu công khai không trả token/link.
- Không bắt buộc 2FA/IP theo câu 20. Xem bí mật cần quyền và xác nhận lại mật khẩu trong 5 phút gắn với phiên; vẫn mã hoá và audit. MFA bổ sung khi có thay đổi yêu cầu.
- Đổi quyền cũng vô hiệu mọi liên kết kích hoạt/reset cũ; tài khoản chưa đổi mật khẩu lần đầu được thay mật khẩu tạm bằng giá trị ngẫu nhiên. Phải gửi lại lời mời sau khi duyệt quyền. Admin không nhận liên kết của tài khoản có quyền tiền/bí mật; khi chưa có SMTP, giám đốc trực tiếp bàn giao liên kết. Admin không reset tài khoản giám đốc.
- Refresh được đồng bộ giữa các tab; logout chấp nhận hash refresh hiện tại hoặc ngay trước đó để thu hồi đúng phiên khi refresh và logout chạy sát nhau. Hash cũ không được dùng để refresh.
- Query token chỉ chấp nhận ở URL download tài liệu/export báo cáo cần link, không dùng cho API tài khoản.

## Trường tiền và báo cáo

- API HĐ không trả giá/tiền/VAT/lịch thu/thanh toán/hoá đơn cho người thiếu `finance:view`. Dashboard giữ vận hành, bỏ dữ liệu tiền và biểu đồ tiền. UI ẩn phần tương ứng dựa quyền server.
- Báo cáo tách quyền tài chính/vận hành; CASHIER không được xem hiệu suất nhân viên hoặc deadline; STAFF không gọi doanh thu/công nợ qua API/export.
- Export chịu cùng quyền/scope. Không đổi công thức công nợ; lỗi phân bổ tiền hiện có vẫn thuộc 07.

## Giao diện và audit

- `/users`: lọc/tìm/phân trang, thêm/sửa/khoá/mở/nghỉ việc, mời/reset/thu hồi phiên; tab nhóm, ma trận/vai trò và yêu cầu cấp quyền. Store quản lý tải/lỗi/thao tác, ngăn submit lặp; chuỗi tiếng Việt trong file ngôn ngữ, template/style riêng.
- `/account`: hồ sơ/mật khẩu/phiên; `/activate`, `/reset-password`, `/forgot-password`. Admin đăng nhập vào users, không vòng redirect dashboard bị cấm.
- Audit có lọc/xuất, ghi trước–sau thay đổi người dùng/quyền đã lọc nhạy cảm; login/thất bại/logout/đổi mật khẩu/thu hồi và GET download/export có log. Không sửa/xoá qua API; DB chặn update/delete audit.

## Tiêu chí nghiệm thu

1. Unit/e2e đủ 5 role, 403, ngoài nhóm/phân công 404, options đúng scope, không dùng query-token ngoài tải file.
2. API/export không lộ trường tiền/bí mật; admin không tự nâng quyền; duyệt hiệu lực ngay, không duyệt hai lần.
3. Lời mời/reset hết hạn/dùng lại; sai 5 lần/khoá tạm; refresh rotation/replay/logout; thu hồi sau khoá/đổi mật khẩu; không lộ hash/token trong danh sách/log.
4. Không tự vô hiệu hoặc vô hiệu tài khoản đặc quyền cuối; có kiểm tra đồng thời.
5. Migration thử DB trống và bản sao trước migration; giữ người dùng cũ, không sửa baseline.
6. Coverage service quyền và các nhánh auth/user chính ≥70%; lint/test/build/max-lines đạt. Không skip/nới test để xanh. Chỉ đổi expectation cũ khi chính sách ở đây thay đổi hành vi, ghi lý do và giữ/bổ sung kiểm chứng tương đương.
7. UI desktop/375px: tạo/mời → kích hoạt → đăng nhập → hồ sơ/phiên; giám đốc duyệt; trưởng nhóm không thấy ngoài nhóm; API tiền đúng quyền.

Ủy quyền nghiệm thu cho agent cho phép báo đạt/chưa đạt theo kết quả thực, không đồng nghĩa SMTP/cloud đã triển khai hoặc người dùng thật đã UAT.
