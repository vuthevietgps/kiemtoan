# 08 — Giải trình thay đổi test cũ

Theo quy tắc mục 8: chỉ đổi test khi đặc tả được duyệt thay đổi hoặc chứng minh test cũ sai; ghi lý do trước khi đổi, giữ mức kiểm chứng tương đương. Đặc tả [08](08-invoices.md) và K1–K11 được duyệt ngày 29/10/2026.

## 08-B (29/10/2026) — sổ hoá đơn nội bộ, dữ liệu và API

| File | Thay đổi | Lý do | Kiểm chứng giữ nguyên |
| --- | --- | --- | --- |
| `test/contracts.e2e-spec.ts` (đề nghị xuất hoá đơn mặc định phần chưa xuất, kế toán thu tiền phát hành) | Ghi nhận phát hành đổi từ `PATCH /invoices/:id/issue` (JSON số, ký hiệu, ngày) sang `POST /invoices/:id/issue` multipart có thêm **ký hiệu mẫu số**, **file PDF** và `revision` | K5: ghi nhận xuất bắt buộc mẫu số và file PDF; K9: mọi lệnh ghi kiểm `revision` | Giữ nguyên: đề nghị mặc định 18.000.000 + VAT 1.800.000, trạng thái REQUESTED → ISSUED, nhân viên 403, kế toán thu tiền ghi nhận được, đề nghị lần hai khi đã đủ → 400 |
