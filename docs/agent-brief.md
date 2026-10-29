# Hướng dẫn tiếp tục phát triển

1. Đọc `AGENTS.md`, [quy tắc code](quy-tac-code.md) và [mục lục tài liệu](README.md).
2. Đọc [hiện trạng](planning/current-status.md), [kế hoạch](planning/completion-plan.md), [phạm vi](requirements/scope-and-traceability.md) và [sổ quyết định](requirements/decision-register.md).
3. **Mốc tiếp tục ngày 22/10/2026: 04 đã được người dùng nghiệm thu (giữ F6); bước kế tiếp là đặc tả chi tiết 05 — Công việc.** 01 nghiệm thu kỹ thuật theo ủy quyền; 02 người dùng nghiệm thu 15/10; 03 người dùng nghiệm thu 16/10; 04 người dùng nghiệm thu 22/10 ([biên bản](features/04-contracts-acceptance.md)). Khung đánh giá G1–G10 đã duyệt. Đọc [review 22/10](planning/review-2026-10-22.md) và [kế hoạch](planning/completion-plan.md): đặc tả 05 theo QD04 và mục "Dữ liệu mỗi bước phải cung cấp" của [khung đánh giá](features/10-performance-evaluation.md), xử lý R2/R3 trong 05; chờ người dùng duyệt đặc tả 05 rồi mới code. Sau đó 06–11 theo thứ tự. Không tự mở nhiều chức năng; CI/cloud 00 theo dõi riêng. Yêu cầu lập kế hoạch không phải lệnh tự triển khai mọi gói.
4. Đọc đặc tả tương ứng trong [features](features/README.md); cập nhật theo yêu cầu được duyệt trước code. Xin phạm vi cụ thể nếu phải sửa module khác theo AGENTS.md.
5. Kiểm tra code thực tế; không mặc định schema/màn hình demo đã đủ. Dùng cấu trúc NestJS/Angular và helper chung theo quy tắc, tránh nhân bản nghiệp vụ.
6. Giữ test có khả năng bắt lỗi. Không sửa, bỏ qua hoặc nới lỏng chỉ để pass; ghi lý do khi đặc tả đã duyệt thay đổi hoặc test cũ được chứng minh sai.
7. Chạy lint, unit/test liên quan, e2e trên DB test riêng khi thay nghiệp vụ/migration, build theo thay đổi và `node scripts/check-max-lines.mjs`. Báo chính xác kết quả và cảnh báo. Không dùng database demo cho kiểm thử phá dữ liệu.
8. Cập nhật hiện trạng, bằng chứng và việc còn thiếu. Không commit/push nếu người dùng chưa yêu cầu.

Lệnh chạy/kiểm tra và Docker: [README dự án](../README.md). [Hướng dẫn demo trước đây](archive/2026-10-15/agent-brief.md) chỉ để tra lịch sử, không phải chỉ dẫn đang có hiệu lực.
