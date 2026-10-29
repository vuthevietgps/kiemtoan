# Phần mềm quản lý công ty dịch vụ Kế toán & Kiểm toán

- Mục lục tài liệu: [docs/README.md](docs/README.md).
- Mô tả chức năng tích hợp: [PDF](docs/requirements/functional-description-integrated-2026-10-15.pdf).
- Câu hỏi đã có câu trả lời và Phụ lục 1: [DOCX](docs/requirements/sources/clarifications-answered-2026-10-15.docx). Điểm chưa rõ/mâu thuẫn: [sổ quyết định](docs/requirements/decision-register.md).
- Kế hoạch và hiện trạng: [kế hoạch](docs/planning/completion-plan.md), [hiện trạng](docs/planning/current-status.md). Đọc trước khi tiếp tục code; tài liệu demo cũ không thay thế đặc tả được duyệt.
- Stack: NestJS 11 + Angular 21 + PostgreSQL 16 (Prisma 6). Cách chạy: README.md.
- Chuyển máy qua USB (2 chiều, mỗi lúc chỉ làm trên một máy): trước khi rời máy chạy `dong-goi.ps1`, đến máy khác chạy `cai-dat.ps1`; hướng dẫn ở `<ổ USB>\ke-toan-kiem-toan\CAI-DAT-CHO-AI.md`.
- Server thử https://vsademo.smarterp.vn (stack `~/vsademo-smarterp-vn` trên `admin-001@192.168.100.236`): xem trạng thái/triển khai/quay lại bằng `<ổ USB>\ke-toan-kiem-toan\trien-khai.ps1` (mặc định chỉ đọc; triển khai cần `-XacNhan` và chỉ khi người dùng yêu cầu). Khoá SSH cài bằng `<ổ USB>\htxbachgia.shop\cai-dat.ps1 -Buoc ssh`.

## Bắt buộc

Tuân theo toàn bộ quy tắc trong @docs/quy-tac-code.md. Những điểm hay bị quên:

- Không file code nào quá 1.000 dòng. File sắp vượt 800 dòng thì tách trước khi thêm code.
- Chỉ làm một chức năng mỗi lần, đúng thứ tự ở mục 9 của quy tắc. Cần sửa sang module khác thì hỏi trước.
- Trước khi báo xong: chạy lint, test và `node scripts/check-max-lines.mjs`; báo đúng kết quả.
- Không sửa, bỏ qua hoặc nới lỏng test chỉ để test pass; chỉ đổi test khi đặc tả được duyệt thay đổi hoặc chứng minh test cũ sai.
- Trả lời người dùng bằng tiếng Việt. Code, tên biến, commit message bằng tiếng Anh.
- Chỉ commit hoặc push khi người dùng yêu cầu.
