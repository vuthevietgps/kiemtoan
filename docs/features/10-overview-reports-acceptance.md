# 10 — Biên bản kiểm chứng kỹ thuật (tổng quan và báo cáo)

Ngày 01/11/2026. Phạm vi: [đặc tả 10](10-overview-reports.md), M1–M14 được duyệt ngày 30/10/2026 (“Duyệt, làm 10-B”);
gói 10-B (tổng quan), 10-C (báo cáo vận hành), 10-D (báo cáo tài chính), 10-E (đánh giá năng lực), 10-F (lưu bộ lọc, gửi định kỳ).

Trạng thái: **đã hoàn thiện kỹ thuật, chờ người dùng nghiệm thu.** Chưa có bộ số liệu do Kế toán xác nhận; chưa có SMTP thật (QD09).

## Kết quả theo tiêu chí

| # | Tiêu chí (đặc tả 10) | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | 6 thẻ đúng M2 và đúng phạm vi từng vai; số trên thẻ = số dòng danh sách mở ra | **Đạt** | e2e `dashboard-operations` (so số thẻ với `/tasks`, `/contracts`, hồ sơ KH, hàng chờ soát xét theo nhân viên / KTT / GĐ) |
| 2 | Không có `finance:view` thì không nhận số tiền nào từ API / file xuất (JSON và Excel); tab Tài chính không hiện | **Đạt** | e2e `reports-access-sweep`: bảng quyền 15 đường dẫn × 5 vai; quét khoá tiền trong JSON của nhân viên và KTT bị thu hồi; Excel không có cột tiền, có lại quyền thì có; `permissions-financial`; giao diện nhân viên không có tab tài chính |
| 3 | Cùng số liệu khớp giữa tổng quan, báo cáo, màn hình nguồn, Excel | **Đạt về kỹ thuật** — chưa đối chiếu bộ số liệu thật | `finance-reports` (đã thu khớp đối chiếu 08), Công nợ / Hoá đơn dùng lại đúng màn hình 07 / 08, đánh giá năng lực kiểm toán dùng lại 04-F, mã HĐ trong Excel khớp JSON; bản sao demo khớp truy vấn DB |
| 4 | Doanh thu 3 thước đo đúng ngày tính, so cùng kỳ; kỳ so sánh 0 → "—" | **Đạt** | `revenue-measures.spec`, e2e `finance-reports`, `dashboard` |
| 5 | Tuân thủ deadline, Hợp đồng, Khách hàng đúng M6–M8, có ca biên | **Đạt** | `operations-report.rules.spec` (nộp đúng ngày hạn, tái ký, KH ngừng rồi quay lại), e2e `operations-reports` |
| 6 | Đánh giá năng lực đạt 7 tiêu chí khung G; phạm vi G9 | **Đạt** | `capability.rules.spec`, e2e `capability`: đổi người giữa kỳ, gia hạn 2 lần, trả lại 2 lần, chờ khách (chồng khoảng, chưa xác nhận không cộng), biên ngày VN, dữ liệu chuyển đổi, 403 ngoài phạm vi |
| 7 | Bộ lọc lưu / mở lại đúng; gửi định kỳ đúng lịch, không trùng, quyền tại lúc gửi, không SMTP thì báo trong ứng dụng | **Đạt về kỹ thuật** — email thật chờ SMTP (QD09) | e2e `report-saved-filters` 17 (gồm gửi qua SMTP giả cục bộ có file đính kèm, hai tiến trình cùng lúc, mất quyền dừng lịch, thử lại rồi thất bại); `report-schedule.rules.spec` 6; web `saved-filters.component.spec` 6 |
| 8 | Lint / unit / e2e / access / web / build / max-lines; desktop và 375px; Excel mở được, bản in đọc được | **Đạt**, trừ phần in bằng tay | Bảng dưới. Excel: e2e mở cả 5 file bằng thư viện ExcelJS. Bản in: web test `print-report`; **chưa bấm In trên trình duyệt thật** |

## Số liệu kiểm chứng cuối (01/11/2026, máy cục bộ)

| Kiểm tra | Kết quả |
| --- | --- |
| API unit | **362/362, 56 suites** (gồm ca "KH ngừng rồi quay lại") |
| API e2e (chia lô) | **363/363, 58 file, 12/12 lô**; thêm `report-saved-filters` 17, `reports-access-sweep` 18. Sau lượt đầy đủ, bộ dữ liệu `capability` đổi thành gia hạn 2 lần, trả lại 2 lần; chạy lại riêng file đó 7/7 |
| API access | **57/57** ngay sau e2e |
| Web test | **188/188, 55 file** (+`saved-filters.component.spec` 6) |
| Lint, build, `check-max-lines` | API / web 0 lỗi; build web đạt (1 cảnh báo NG8102 có sẵn ở `task-documents`); không file nào vượt 1.000 dòng |
| Migration | `20261101090000_report_saved_filters_schedules` chỉ thêm bảng; áp lên DB test và bản sao `ketoan_mig_09b` |
| Giao diện (`ketoan_mig_09b`, Giám đốc) | Lưu bộ lọc Trưởng nhóm 2026 → đổi vai → hẹn gửi hằng tuần; link thông báo mở đúng tab, vai, kỳ 26/10–01/11, có nút Tải Excel. 375px không tràn ngang. Dữ liệu thử đã xoá |

## Quyết định khi làm (đề nghị người dùng xác nhận khi nghiệm thu)

- **Kỳ số liệu của lượt gửi định kỳ:** đặc tả M12 chưa nêu. Đã làm: hằng tuần gửi số liệu **tuần trước** (thứ 2 – Chủ nhật), hằng tháng gửi số liệu **tháng trước**; kỳ lưu trong bộ lọc chỉ dùng khi mở lại trên màn hình.
- **Máy dừng đúng 07:30:** gửi bù khi chạy lại, trong cùng tuần / tháng. Bật lịch sau mốc gửi thì không gửi bù, chờ mốc sau.
- **Đã tắt nhận email cá nhân (I10):** coi như chưa gửi email, báo trong ứng dụng kèm link tải.

## Giới hạn còn lại

- Lưu bộ lọc / hẹn gửi có ở 5 báo cáo: Doanh thu, Tuân thủ deadline, Hợp đồng, Khách hàng, Đánh giá năng lực. **Công nợ, Hoá đơn** dùng màn hình và bộ lọc riêng của 07 / 08, chưa lưu được; Nhật ký hoạt động giữ như 01.
- Việc chuyển đổi đang mở đã quá hạn không vào đánh giá năng lực tới khi được nộp (H9).
- Bản sao demo chưa có nhóm thực hiện dòng kế toán: cột kỳ dịch vụ chỉ kiểm bằng e2e.
- Chỉ số "việc phải giao lại do quá hạn" (Manager) chưa có nguồn dữ liệu.
- Bấm cột biểu đồ ở tab Tài chính của Tổng quan chưa mở thẳng báo cáo đã lọc.
- Ngưỡng màu G8 và SLA chỉnh tay: 11. Hoa hồng: QD06. Email thật: QD09.

## Người dùng cần làm để nghiệm thu

1. Xem các tab Báo cáo, thử bấm **Xuất Excel** và **In / PDF**.
2. Xác nhận quy tắc kỳ số liệu của lượt gửi định kỳ ở trên.
3. Khi có số liệu Kế toán xác nhận và SMTP thử: đối chiếu số, thử gửi email thật.
