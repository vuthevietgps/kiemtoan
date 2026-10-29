# 08 — Biên bản kiểm chứng kỹ thuật (sổ hoá đơn nội bộ)

Ngày 29/10/2026. Phạm vi: [đặc tả 08](08-invoices.md), K1–K11 được duyệt ngày 29/10/2026; làm **sổ nội bộ** (08-B, 08-C, 08-D). **08-E — phát hành qua API EasyInvoice — chưa làm** (chờ QD09), nên **chưa báo hoàn tất phần tích hợp của YC18**.

Trạng thái: **đã hoàn thiện kỹ thuật phần sổ nội bộ, chờ người dùng nghiệm thu.**

## Kết quả theo tiêu chí

| # | Tiêu chí (đặc tả 08) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Đề nghị theo đợt và theo giá trị; không vượt phần chưa xuất (tính đề nghị đang chờ); VAT theo HĐ | **Đạt** | e2e `invoices` (theo đợt: 5.500.000 = 5.000.000 + 500.000; đợt đã có đề nghị → 400; theo giá trị vượt → 400); unit `invoice.rules.spec` (tách tổng đợt, làm tròn đồng) |
| 2 | Ghi nhận xuất đủ thông tin + PDF; chặn trùng; file vào kho 02 nhóm Hoá đơn | **Đạt** | e2e: thiếu PDF / ngày tương lai → 400, trùng (mẫu số + ký hiệu + số, ký hiệu không phân biệt hoa thường) → 409, file nhóm `INVOICE` gắn HĐ; giao diện: ghi nhận 1 · C25TVS · 00000501 kèm PDF |
| 3 | Điều chỉnh / thay thế: giá trị hiệu lực đúng; liên kết hai chiều; lịch sử | **Đạt** | e2e: điều chỉnh giảm → gốc "Đã điều chỉnh", phần đã xuất HĐ 10.000.000 → 9.000.000; giảm quá giá trị còn lại → 400; thay thế → gốc "Bị thay thế", đợt chuyển sang hoá đơn mới; giao diện: điều chỉnh −11.000.000 đ, liên kết gốc |
| 4 | Hai người ghi nhận cùng lúc → một thành công, một 409; không xoá cứng | **Đạt** | e2e duyệt đồng thời [200, 409]; không có API xoá hoá đơn; hoá đơn đã xuất không huỷ được (400) |
| 5 | Đối chiếu thu – xuất khớp từng HĐ; tổng theo KH = tổng các HĐ; Excel cùng số | **Đạt về kỹ thuật** — **còn mở** đối chiếu với bộ số liệu do Kế toán thu tiền xác nhận | e2e `invoice-reconciliation` (đã thu chỉ tính phiếu Đã duyệt; đã xuất gồm điều chỉnh âm, bỏ bị thay thế / huỷ; chờ xuất riêng; đến ngày; chỉ HĐ chênh lệch; Excel); giao diện trên bản sao demo |
| 6 | Bảng theo dõi kiểm toán 04-F và tab HĐ đọc trạng thái mới; hồi quy 04/07 | **Đạt** | `audit-board.e2e`, `contracts.e2e`, toàn bộ e2e 293/293 |
| 7 | Migration K10: số hoá đơn, tổng tiền theo trạng thái không đổi; Prisma diff sạch | **Đạt** | `ketoan_mig_07c`: 2 đề nghị / 341.000.000 đ, 3 đã xuất / 599.500.000 đ giữ nguyên, đánh dấu chuyển đổi, có người mua |
| 8 | Phân quyền; nhân viên không thấy tiền; lint/unit/e2e/build/max-lines; desktop và 375px | **Đạt** | e2e quyền (nhân viên/quản trị 403; KTT đề nghị được, không ghi nhận/huỷ/xuất Excel); access 57/57; giao diện ~537px và 375px không tràn ngang |

## Số liệu kiểm chứng cuối (29/10/2026, máy cục bộ)

| Kiểm tra | Kết quả |
| --- | --- |
| API unit | 321/321 |
| API e2e (chia lô `scripts/run-e2e-batches.mjs`) | 293/293, 10/10 lô (241 giây) |
| API access | 57/57 |
| Web test | 155/155, 43 file |
| Lint, build, typecheck, `check-max-lines` | API/web 0 lỗi; build đạt; typecheck đầy đủ chỉ còn 4 lỗi cũ (02); không file nào vượt 1.000 dòng |

## Còn mở / giới hạn

- **K6** (điều chỉnh / thay thế thay cho huỷ hoá đơn đã xuất): cần KTT / Kế toán thu tiền xác nhận khớp quy trình hoá đơn điện tử công ty đang dùng trên EasyInvoice.
- **Hoá đơn chuyển đổi** (dữ liệu demo cũ) không gắn đợt: đợt tương ứng vẫn hiện "còn trống" trong form đề nghị theo đợt; giới hạn theo giá trị HĐ vẫn chặn xuất vượt.
- **Bộ số liệu đối chiếu thật** (tiêu chí 5): chưa có số liệu do kế toán xác nhận.
- **08-E (QD09):** phát hành qua API EasyInvoice, đồng bộ trạng thái — chờ sandbox / quyền API.
- Báo cáo hoá đơn tổng hợp theo kỳ thuộc 10 (đọc sổ 08).
- Chưa đưa lên vsademo.
