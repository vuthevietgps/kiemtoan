# Vận hành dự án

- [README dự án](../../README.md): cài đặt/chạy local, tài khoản demo, Compose ứng dụng, lệnh lint/test/build và backup/restore.
- [Database migration](database-migration.md): tạo DB mới, ghi nhận baseline trên DB đã có dữ liệu, database test riêng và bằng chứng đã thử.
- [Vận hành tài khoản và phân quyền](identity-access.md): migration 01, mời/kích hoạt, SMTP, duyệt quyền và thu hồi phiên.
- [Khách hàng, Excel và hồ sơ](customer-documents.md): migration 02, phân công, nhập/xuất XLSX, phiên bản/preview và assets PDF.
- [Khoá mã hoá kho tài khoản](credential-key.md): giữ `CREDENTIAL_KEY` tách khỏi bản sao lưu, kiểm tra khoá sau khôi phục, xoay khoá (09).
- [Đặc tả nền tảng](../features/00-foundation.md): tiêu chí và kết quả từng gói 00-A…D.
- [Hiện trạng](../planning/current-status.md): giới hạn kiểm chứng và các điều kiện vận hành còn thiếu.

## Tài liệu vận hành cần bổ sung trước dùng thật

IT cần hoàn thiện runbook cloud đã chọn: HTTPS/tên miền, secret và khoá mã hoá, người vận hành, giám sát/cảnh báo, lịch backup hằng ngày/retention, thử restore/RPO/RTO, quy trình chuyển lưu lượng/quay lui, xuất dữ liệu/file khi đổi cloud và xử lý sự cố.

Script backup hiện tạm dừng web/API để giữ nhất quán DB/file; thời gian dừng cần được chấp thuận trong QD11. Không coi script thủ công là lịch backup tự động đã hoạt động. Không dùng database demo để chạy e2e; theo hướng dẫn database test tách biệt.
