# Kịch bản demo nghiệm thu 04 — Hợp đồng

Dùng cho buổi nghiệm thu chức năng 04 theo [biên bản kiểm chứng](04-contracts-acceptance.md). Thời lượng khoảng **40 phút**. Mỗi bước ghi vai đăng nhập, thao tác và kết quả mong đợi; người nghiệm thu đánh dấu Đạt/Chưa đạt và ghi góp ý ở cột cuối khi in.

## Chuẩn bị (trước buổi demo 10 phút)

1. Bật Docker Desktop; chạy database dev: `docker compose up -d` (thư mục dự án).
2. Tạo lại DB demo sạch (dữ liệu hạn tính theo ngày hôm nay nên nên tạo lại ngay trước buổi demo):

   ```bash
   docker exec ketoan-postgres psql -U ketoan -d postgres -c "DROP DATABASE IF EXISTS ketoan_demo_04" -c "CREATE DATABASE ketoan_demo_04"
   ```

   ```bash
   cd apps/api && DATABASE_URL="postgresql://ketoan:ketoan_dev@localhost:5433/ketoan_demo_04" npx prisma migrate deploy && DATABASE_URL="postgresql://ketoan:ketoan_dev@localhost:5433/ketoan_demo_04" npx prisma db seed
   ```

3. Chạy API bằng cấu hình `api-demo-04` (`.claude/launch.json`, cổng 3000) và web (`npm --prefix apps/web start`, cổng 4200). Đợi API báo "Nest application successfully started" rồi mới đăng nhập.
4. Tài khoản (mật khẩu `Demo@123`):

   | Email | Người | Vai trò |
   | --- | --- | --- |
   | giamdoc@demo.vn | Trần Văn Minh | Giám đốc |
   | ketoantruong@demo.vn | Nguyễn Thị Linh | Kế toán trưởng (nhóm Thuế 1) |
   | nhanvien3@demo.vn | Đỗ Quang Huy | Nhân viên (nhóm Kiểm toán) |
   | thutien@demo.vn | Vũ Thị Mai | Kế toán thu tiền |

5. Chuẩn bị sẵn một file PDF bất kỳ (làm "bản scan đã ký" và "file BCKT").

Dữ liệu demo có sẵn: HD-2025-016 (Chờ duyệt, Kế toán thuế, XYZ), HD-2025-017 (Nháp, Làm lại sổ sách, ABC), HD-2025-015 (Đang thực hiện, Kế toán thuế, ABC), ba HĐ kiểm toán HD-2025-013 (Đang soát xét, hạn soát xét quá 2 ngày), HD-2025-018 (Đang kiểm toán, sắp đến hạn, hạn phát hành đã gia hạn), HD-2025-019 (đã phát hành số `150425/2025/BCKT-DEMO`); 6 mẫu hồ sơ ví dụ; bảng giá Kế toán thuế theo số chứng từ áp dụng từ 01/01/2026.

## Phần 1 — Tạo HĐ và gợi ý giá (04-E), gửi duyệt (04-A)

| # | Vai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| 1.1 | KTT | Hợp đồng → Tạo hợp đồng; khách hàng Công ty CP ABC; dịch vụ "Kế toán thuế" | Hiện ô "Tiêu chí giá" (Số chứng từ mỗi tháng); dưới đơn giá: "Nhập giá trị tiêu chí để gợi ý giá" |
| 1.2 | KTT | Nhập 150 | Đơn giá tự điền 4.500.000 — "Theo bảng giá" |
| 1.3 | KTT | Sửa tay đơn giá 5.000.000, đổi tiêu chí thành 400 | Giữ 5.000.000; gợi ý 6.000.000 kèm nút "Dùng giá này"; bấm → 6.000.000 |
| 1.4 | KTT | Lưu, rồi "Gửi duyệt" | HĐ mới ở Chờ duyệt |

## Phần 2 — Duyệt, trả lại (04-A) và kế hoạch thực hiện (04-B)

| # | Vai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| 2.1 | GĐ | Mở HD-2025-016 → "Trả lại" với lý do "Bổ sung kỳ áp dụng" | HĐ về Nháp, cảnh báo hiện lý do trả lại |
| 2.2 | KTT | Mở HD-2025-016 → "Gửi duyệt" | Chờ duyệt |
| 2.3 | GĐ | "Duyệt" qua hộp xác nhận | HĐ Chưa thực hiện; dòng dịch vụ "Chờ xác nhận kế hoạch thực hiện"; chưa có việc |
| 2.4 | KTT | Tab Quy trình & Công việc → lập kế hoạch từ QT-KTT-001 | Bảng bước có người đề xuất, lịch dự kiến |
| 2.5 | KTT | Đổi thời lượng một bước, đổi người thực hiện; xem lịch thay đổi (tô xanh) → Lưu → Xác nhận kế hoạch | Kế hoạch khoá; việc được sinh đúng số bước, hạn theo kế hoạch đã sửa |
| 2.6 | KTT | Bấm "Sinh lại việc" (nếu hiện) | Không sinh trùng |

## Phần 3 — Hồ sơ thương mại (04-C)

| # | Vai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| 3.1 | GĐ | Hợp đồng → Mẫu hồ sơ | 6 mẫu ví dụ; xem danh sách trường trộn |
| 3.2 | GĐ | Mở HD-2025-016 → tab Hồ sơ → tạo "Báo giá" từ mẫu | File DOCX tên "Báo giá HD-…", có số tiền và tiền bằng chữ |
| 3.3 | GĐ | Tạo lại báo giá, chọn "Phiên bản mới của …" | Phiên bản 2 |
| 3.4 | GĐ | Tải "bản đã ký" loại Hợp đồng (file PDF) → Xem trước | Xem trước PDF trong trang |

## Phần 4 — Vòng đời: phụ lục, tái ký, huỷ (04-D)

| # | Vai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| 4.1 | KTT | Mở HD-2025-015 → tab Tổng quan → sửa người giới thiệu | Lưu được; tab Lịch sử ghi trường đã đổi |
| 4.2 | KTT | Lập phụ lục tăng đơn giá dòng Kế toán thuế → Gửi duyệt | Phụ lục PL-01 Chờ duyệt; hiện tổng trước/sau và đợt "Bổ sung theo PL-01" |
| 4.3 | GĐ | Duyệt phụ lục | Tổng HĐ tăng; đợt bổ sung xuất hiện; phiếu thu cũ giữ đợt cũ |
| 4.4 | KTT | Thử lập phụ lục bỏ dòng Kế toán thuế | Bị chặn: dòng đã có công việc |
| 4.5 | KTT | "Tạo HĐ năm sau" | Mở HĐ mới ở Nháp, kỳ/ngày dời sang năm sau, liên kết HĐ gốc |
| 4.6 | KTT | Huỷ HĐ năm sau vừa tạo, nhập lý do | HĐ huỷ; HĐ gốc lại hiện nút tái ký |
| 4.7 | KTT | Mở HD-2025-015 → tab Lịch sử | Đủ thao tác: phụ lục, duyệt, tái ký…, không lặp dòng |

## Phần 5 — Theo dõi kiểm toán (04-F)

| # | Vai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| 5.1 | GĐ | Danh sách HĐ → "Theo dõi kiểm toán" | 3 hồ sơ; thẻ đếm: Đang kiểm toán 1, Đang soát xét 1, Đã phát hành 1, Quá hạn 1, Sắp đến hạn 1; thẻ tiền theo HĐ |
| 5.2 | GĐ | Bấm thẻ "Quá hạn"; thử thêm bộ lọc Năm, Trưởng nhóm; sao chép URL mở tab khác | Lọc đúng; URL giữ bộ lọc |
| 5.3 | GĐ | Bấm dòng HD-2025-013 (Tập đoàn DEF) | Ngăn chi tiết: tình trạng hồ sơ HĐ (BBNT Đang chờ ký), nhóm, người ký, bảng hạn (Kết thúc kiểm toán Đúng hạn; Hoàn tất soát xét **Quá hạn**; Phát hành Chưa tới hạn), dòng thời gian, cảnh báo người chưa được phân công KH |
| 5.4 | GĐ | "Gia hạn" hạn soát xét → ngày mới + lý do "Khách bổ sung số liệu" | Hạn hiện hành đổi, ghi "(đã gia hạn)" và dòng lịch sử; hạn gốc giữ nguyên |
| 5.5 | GĐ | "Chuyển sang Chờ phát hành" | Hạn soát xét thành Đúng hạn (theo hạn sau gia hạn), không còn nút gia hạn; bảng tải lại, Quá hạn 0 |
| 5.6 | GĐ | "Phát hành BCKT" với số `150425/2025/bckt-demo ` | Báo lỗi số đã dùng (trùng HD-2025-019 dù khác hoa thường/khoảng trắng) |
| 5.7 | GĐ | Phát hành lại với số `221026/2026/BCKT`, ngày hôm nay, đính kèm PDF | Đã phát hành; số và ngày hiện trên bảng; file nằm trong tab Hồ sơ của HĐ |
| 5.8 | GĐ | "Mở lại" với lý do "Sửa số liệu tồn kho" | Về Chờ phát hành, giữ số BCKT; phát hành lại → kết quả hạn vẫn theo lần phát hành đầu |
| 5.9 | GĐ | Tình trạng hồ sơ: BBNT chọn "Đã ký" | Nút lưu chỉ bật khi có ngày ký và chọn bản BBNT đã ký (tải ở tab Hồ sơ, loại Biên bản nghiệm thu); lưu → "Đã lưu tình trạng hồ sơ" |
| 5.10 | GĐ | Tab "Theo nhân sự" | Mỗi người một dòng: Nguyễn Thị Linh (Manager), Lê Văn An, Phạm Thu Hà (trưởng nhóm), Trần Văn Minh (người ký 1); cột tỷ lệ tô màu; tỷ lệ theo hạn gốc và số lần gia hạn; người chưa có hạn trong kỳ hiện "—" |
| 5.11 | GĐ | Bấm một người | Danh sách các hạn được tính, khớp con số |
| 5.12 | GĐ | Mở chi tiết HD-2025-013 → tab "Kiểm toán"; mở HD-2025-015 | HD-2025-013 có tab Kiểm toán cùng dữ liệu; HD-2025-015 (kế toán thuế) không có |

## Phần 6 — Phân quyền và phạm vi

| # | Vai | Thao tác | Kết quả mong đợi |
| --- | --- | --- | --- |
| 6.1 | Nhân viên (Đỗ Quang Huy) | Theo dõi kiểm toán | Chỉ HĐ thuộc KH mình phụ trách (HD-2025-013, HD-2025-018); **không có cột/thẻ tiền**; không có nút sửa nhóm/giai đoạn (không phải trưởng nhóm) |
| 6.2 | Nhân viên | Tab Theo nhân sự | Chỉ dòng của chính mình (trợ lý không bị tính theo hạn hồ sơ nên có thể trống) |
| 6.3 | Thu tiền | Theo dõi kiểm toán | Thấy bảng có tiền; không có nút sửa/phát hành; tab Theo nhân sự báo không có quyền |
| 6.4 | KTT | Theo dõi kiểm toán | Chỉ HĐ trong phạm vi nhóm Thuế 1 — xem mục "Điểm cần quyết định" |
| 6.5 | Quản trị | Truy cập `/contracts/audit-tracking` | Không có quyền |

## Điểm cần quyết định trong buổi nghiệm thu

1. **Phạm vi xem của người trong nhóm kiểm toán (F6):** KTT Nguyễn Thị Linh là Manager của HD-2025-013/018 nhưng các KH đó thuộc nhóm Kiểm toán nên KTT không thấy. Giữ F6 (phân công KH là nguồn quyền xem duy nhất) hay cho người giữ vai trong nhóm kiểm toán được xem HĐ đó?
2. Ưu tiên sau nghiệm thu 04: tiếp 05 (công việc 8 trạng thái, soát xét, đánh giá theo việc — kèm sửa R2/R3) theo thứ tự quy tắc; hoặc xin cho phép sửa khung menu chung ở màn hẹp trước.
3. Đầu vào còn chờ: mẫu Word thật (QD07), công thức hoa hồng (QD06), cách định giá riêng theo khách (QD13).

## Kết luận buổi nghiệm thu

| Mục | Ghi nhận |
| --- | --- |
| Người nghiệm thu / ngày | |
| Kết quả (Đạt / Đạt có điều kiện / Chưa đạt) | |
| Góp ý cần sửa | |
| Quyết định cho các điểm ở trên | |
