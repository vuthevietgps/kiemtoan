# Đặc tả theo chức năng

Đọc [phạm vi mới](../requirements/scope-and-traceability.md) và [sổ quyết định](../requirements/decision-register.md) trước khi dùng các file dưới đây. Quy trình: cập nhật đặc tả → chủ đầu tư duyệt → code → kiểm tra → nghiệm thu. Chưa có bằng chứng rằng toàn bộ các đặc tả demo dưới đây đã được duyệt theo DOCX bổ sung.

Mốc tiếp tục **22/10/2026**: 04-F3 đã đóng kỹ thuật (đã sửa R4, lint/spec phần 04, kiểm chứng thao tác chính trên giao diện); 04 đã được người dùng nghiệm thu ([biên bản](04-contracts-acceptance.md)); tiếp đặc tả 05. Các gói 04–11 và đầu vào cần duyệt nằm trong [kế hoạch cập nhật](../planning/completion-plan.md); không tự coi kế hoạch là duyệt đặc tả 05–11.

| Bước | File | Trạng thái tài liệu |
| --- | --- | --- |
| 00 | [Nền tảng](00-foundation.md) | Có tiêu chí/bằng chứng các gói A–E; còn CI thật, phần quy ước nền và nghiệm thu |
| 01 | [Người dùng và phân quyền](01-users-access-control.md) | Đã hoàn thiện, nghiệm thu kỹ thuật theo ủy quyền ngày 15/10; [biên bản](01-users-acceptance.md), [vận hành](../operations/identity-access.md); SMTP/UAT thật còn ở vận hành |
| 02 | [Khách hàng và hồ sơ](02-customers-documents.md) | Đặc tả đã duyệt; code/kiểm chứng kỹ thuật A–D hoàn tất; [biên bản](02-customers-acceptance.md); người dùng nghiệm thu 15/10; QD00/08 còn mở |
| 03 | [Dịch vụ, bảng giá, quy trình](03-service-catalog.md) | Đặc tả và D1–D5 đã duyệt 15/10; code/kiểm chứng kỹ thuật A–D hoàn tất; [biên bản](03-service-catalog-acceptance.md); người dùng nghiệm thu 16/10; QD07 còn thiếu |
| 04 | [Hợp đồng — vòng đời](04-contracts-lifecycle.md) | **Đã nghiệm thu 22/10.** Đặc tả và E1–E6 đã duyệt 16/10; 04-A–04-E đã code/kiểm chứng kỹ thuật (04-E ngày 22/10; giá riêng chờ QD13). [Đặc tả demo cũ](04-contracts.md) chỉ đối chiếu. [04-F theo dõi HĐ kiểm toán và đúng hạn](04-audit-engagement-tracking.md): đặc tả và F1–F11 đã duyệt 22/10; 04-F1–F3 đã code/kiểm chứng kỹ thuật 22/10. [Biên bản 04](04-contracts-acceptance.md), [kịch bản demo](04-contracts-demo.md); **người dùng nghiệm thu 04 ngày 22/10** (giữ F6) |
| 05 | [Công việc — 8 trạng thái, soát xét, hồ sơ](05-tasks-workflow.md) | Đặc tả và H1–H12 đã duyệt 22/10 (gồm sửa R2/R3, dữ liệu cho khung G1–G10); 05-B (quyền, 8 trạng thái, soát xét, H8) đã code 22/10; 05-C (nhiều kỳ, phụ thuộc, tiến độ kỳ) 05-D (hồ sơ, chờ khách, gia hạn, tạm dừng) và 05-E (giao diện) 23/10 — [biên bản kiểm chứng](05-tasks-acceptance.md); **người dùng nghiệm thu 05 ngày 23/10**. [Thay đổi test](05-test-policy-changes.md). [Đặc tả demo cũ](05-tasks.md) chỉ đối chiếu |
| 06 | [Lịch nghiệp vụ, hạn pháp lý, nhắc việc](06-deadlines-notifications.md) | Đặc tả và I1–I14 đã duyệt 23/10; 06-B → 06-D đã code và kiểm chứng kỹ thuật 28/10; [biên bản](06-deadlines-acceptance.md); **người dùng nghiệm thu tạm thời 28/10** — tiêu chí 2 (QD07) và 8 (QD09) kiểm lại khi có đầu vào. [Thay đổi test](06-test-policy-changes.md) |
| 07 | [Thu tiền, công nợ phải thu](07-payments.md) | **Đặc tả và J1–J15 đã duyệt 28/10**; 07-B (quy tắc công nợ chung, sửa R1) xong 28/10; 07-C (vòng đời phiếu thu, duyệt, chứng từ, J15) xong 29/10; 07-D chia D1–D4, **07-D1 (công nợ, tuổi nợ, sắp đến hạn/quá hạn, Excel) và 07-D2 (hạn theo phát hành BCKT, "Còn nợ quá hạn") xong 29/10**; tiếp 07-D3; [thay đổi test](07-test-policy-changes.md); đối soát Techcombank 07-E (QD09); hoa hồng chờ QD06 |
| 08 | `08-invoices.md` | Chưa có file riêng; demo đang gộp trong 04. Cần sổ hoá đơn và phân kỳ EasyInvoice |
| 09 | `09-client-credentials.md` | Chưa có file riêng; demo đang gộp trong 02. Cần kho bí mật và token mượn/trả |
| 10 | [Dashboard/báo cáo](10-dashboard-reports.md) | Đặc tả demo, cần 6 chỉ số vận hành, quyền tài chính và xuất file. [Khung đánh giá năng lực theo vai trò](10-performance-evaluation.md) (kế toán dịch vụ + kiểm toán, đầu vào cho 04-F2, 05, 06, 10, 11): đã duyệt G1–G10 ngày 22/10 |
| 11 | `11-settings.md` | Chưa có; cần giao diện cấu hình hoàn chỉnh |

Tên file chưa có là đầu ra của kế hoạch, không phải liên kết đến đặc tả đã tồn tại. Không tạo hàng loạt đặc tả trống rồi coi là đã hoàn thành.

Mỗi đặc tả cập nhật phải có: mã YC/QD, người/ngày/bằng chứng duyệt, phạm vi module/file cần chạm, user stories, màn hình, quyền hành động/phạm vi/trường, dữ liệu và migration, luồng thành công/thất bại, tiêu chí nghiệm thu, test hồi quy, phần hoãn được duyệt. Không sửa test hiện có chỉ để khớp bản nháp chưa duyệt.
