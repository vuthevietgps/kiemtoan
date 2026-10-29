# Kế hoạch tiếp tục hoàn thiện hệ thống

Cập nhật **22/10/2026**, theo yêu cầu lập kế hoạch sau [review 22/10](review-2026-10-22.md). Đây là kế hoạch đề xuất, không phải nghiệm thu, phê duyệt nghiệp vụ mới hay cam kết lịch/chi phí. Thay thế chỉ dẫn tiến độ cũ trong bản 15/10; giữ toàn bộ yêu cầu chưa hoàn thành.

Căn cứ: [quy tắc code](../quy-tac-code.md), [hiện trạng](current-status.md), [YC01–24](../requirements/scope-and-traceability.md), [sổ quyết định](../requirements/decision-register.md), [04](../features/04-contracts-lifecycle.md), [04-F](../features/04-audit-engagement-tracking.md), [khung đánh giá G1–G10](../features/10-performance-evaluation.md). PDF/DOCX nguồn và quyết định được duyệt vẫn là căn cứ nghiệp vụ; đặc tả demo không được dùng để thu hẹp phạm vi.

## 1. Điểm xuất phát và nguyên tắc

| Phần | Trạng thái để lập kế hoạch |
| --- | --- |
| 00 | Có nền tảng, migration, Compose, backup/restore cục bộ và file CI; chưa có Git trong workspace, chưa chứng minh CI từ xa/cloud/UAT thật |
| 01 | Nghiệm thu kỹ thuật theo ủy quyền 15/10; tiếp tục hồi quy quyền/phiên/audit ở mỗi chức năng |
| 02 | Người dùng nghiệm thu 15/10; Excel thật/chuyển đổi và portal còn theo QD08/QD00 |
| 03 | Người dùng nghiệm thu 16/10; có bảng giá, quy trình phiên bản, hồ sơ yêu cầu; QD07 đầu vào thật còn thiếu |
| 04 | E1–E6 và F1–F11 đã duyệt; A–E và F1/F2 đã kiểm chứng. **F3 đang dở, chưa nghiệm thu toàn chức năng 04** |
| 05–11 | Có phần demo nhưng chưa hoàn thiện theo yêu cầu tích hợp; khung G1–G10 đã duyệt là đầu vào bắt buộc |

Review 22/10: 229 API unit, 196 e2e, 82 web test, 57 access test (95,75% dòng); build/max-lines đạt. API lint 1 lỗi/40 cảnh báo, web 1 cảnh báo; typecheck đầy đủ API 6 lỗi trong spec. Đây là kết quả review, không thay lượt kiểm chứng các gói sau.

- Triển khai **một chức năng mỗi lần**, theo **04 → 05 → 06 → 07 → 08 → 09 → 10 → 11**. Không làm lại 01–03 vì chỉ dẫn bàn giao cũ.
- Mỗi chức năng: đặc tả chi tiết được duyệt → migration/dữ liệu → backend/test → frontend → kiểm chứng → nghiệm thu và merge theo quy tắc. Chia gói không thay thế nghiệm thu chức năng.
- Kế thừa quyết định E/F/G, không hỏi lại như chưa chốt. Đặc tả chi tiết 05–11 vẫn cần duyệt trước code; kế hoạch này không tự phê duyệt.
- Chạm module khác phải nằm trong phạm vi đã duyệt hoặc xin phạm vi cụ thể: file, lý do, ảnh hưởng và hồi quy. Công việc nền thực hiện phiên riêng hoặc cùng phạm vi được cho phép, không mở nhiều module song song.
- Không sửa/skip/nới test để xanh; lỗi hồi quy phải có test tái hiện trước sửa. Không file code quá 1.000 dòng; gần 800 dòng tách trước khi thêm.
- Không tự init/commit/push/merge. Git/CI theo dõi riêng theo chỉ đạo trước; không ghi đã merge hoặc production-ready khi chưa có bằng chứng.

## 2. Các mốc bàn giao

| Mốc | Phạm vi tuần tự | Giá trị bàn giao | Điều kiện chuyển bước |
| --- | --- | --- | --- |
| M1 | Đóng 04-F3, nghiệm thu 04 | HĐ → kế hoạch → sinh việc; hồ sơ kiểm toán, hạn, nhân sự | Kiểm chứng 04 đủ, biên bản ghi giới hạn E4/QD13, người dùng nghiệm thu |
| M2 | 05 | Nộp việc, soát xét, hồ sơ mở bước, dữ liệu đánh giá | Quyền tùy chỉnh đúng, không tự duyệt, 8 trạng thái và lịch sử đạt; nghiệm thu 05 |
| M3 | 06 | Lịch nghiệp vụ, nhắc việc và soát xét quá SLA | Lịch được xác nhận; restart/retry không mất/trùng gửi; email thử đạt; nghiệm thu 06 |
| M4 | 07 | Thu có duyệt, công nợ thống nhất | Mọi màn hình/export khớp; nghiệm thu 07 |
| M5 | 08 rồi 09 | Sổ hoá đơn/đối chiếu, kho tài khoản/token | Nghiệm thu riêng từng chức năng; phân biệt sổ nội bộ và tích hợp ngoài |
| M6 | 10 rồi 11 | Tổng quan, báo cáo năng lực/tài chính, cấu hình | Chỉ số truy ngược được tới dữ liệu, đúng quyền; cấu hình tác động thật/audit; nghiệm thu từng chức năng |
| M7 | UAT/chuyển đổi/pilot | Nhóm người dùng được chọn vận hành trên hạ tầng đích | Đủ mục 8, có quyết định cho chạy và phương án quay lui |

Mục tiêu tháng 11/2026 là demo quản trị có thể kiểm chứng, ưu tiên M1–M3. Mục tiêu tháng 12/2026 là pilot có kiểm soát sau M4–M7 cho phạm vi đã chốt. Đây là **mục tiêu cần đánh giá lại**, không cam kết toàn bộ hệ thống hoàn tất vào các tháng đó.

## 3. Gói làm ngay: đóng chức năng 04

Các gói dưới đây làm tuần tự; chưa mở 05 khi 04 còn chờ nghiệm thu.

| Gói | Công việc / đầu ra | Điều kiện đóng |
| --- | --- | --- |
| 04-F3.1 | Test tái hiện rồi sửa R4 trong query bảng nhân sự: tập người được xem độc lập với tập hạn trong kỳ; thống kê số hồ sơ hiện tại không phụ thuộc người có hạn hay không | Không có hạn → tỷ lệ “—”; hạn ngoài kỳ/không có hạn không làm mất dòng người và hồ sơ đang giữ; đúng quyền và chi tiết khớp tổng |
| 04-F3.2 | Sửa lint biến `codes` của audit-board và 2 lỗi kiểu spec phụ lục thuộc 04; giữ nguyên kỳ vọng test | Lint 04 không lỗi, spec 04 typecheck được; báo riêng 4 lỗi mock 02 nếu chưa mở phạm vi |
| 04-F3.3 | UI desktop/375px: lọc/URL/phân trang → ngăn chi tiết → nhóm/người ký/hạn → tiến/lùi giai đoạn → gia hạn → phát hành có file → mở lại → gửi/lưu HĐ, BBNT | Đúng vai trò, ẩn tiền, lỗi 409 khi revision cũ, số BCKT không trùng, giữ file cũ/mốc lần đầu; kiểm cả hai tab và tab Kiểm toán của HĐ; ảnh/kịch bản rõ |
| 04-F3.4 | Hồi quy A–F; migration/seed nếu đổi dữ liệu; mở mẫu DOCX bằng Word/LibreOffice thật; cập nhật đặc tả/hiện trạng và tạo `04-contracts-acceptance.md` khi có bằng chứng | Lint/unit/web/e2e/access/build/max-lines; không lấy kiểm chứng cũ thay mới; kiểm đủ quyền, tiền và đồng thời |
| 04-UAT | Demo KH → HĐ → kế hoạch → duyệt → việc → hồ sơ kiểm toán → hạn/phát hành → nhân sự; sửa góp ý trong phạm vi 04 | Người dùng nghiệm thu; ghi rõ phần hoãn E4, QD13 và tồn đọng ngoài module; cập nhật hướng dẫn |

Review mới đã thử đọc tab Theo nhân sự/chi tiết, chưa thay thế kiểm chứng thao tác ghi hoặc viewport 375px.

Việc cần mở phạm vi riêng nếu muốn đóng toàn bộ chất lượng trước nghiệm thu:

- **02:** 4 lỗi kiểu mock trong `customer-relationships.service.spec.ts`; sửa kiểu, không đổi kỳ vọng. Phải giải quyết trước khi nói typecheck toàn dự án đạt.
- **00/core layout:** tái hiện lại 375px trước khi sửa; không mặc định lỗi sider 232px cũ còn xảy ra.
- **01/audit-log:** điều tra thời điểm ghi EXPORT gây test thiếu ổn định đã ghi ở 04-D; không tăng chờ/nới kỳ vọng để che hành vi.

E4 đã cho hoãn sinh PDF sang đợt B; QD13 giá riêng khách hàng còn mở. Cơ chế DOCX với mẫu giả không thay kiểm thử mẫu thật QD07.

## 4. Hoàn thiện các chức năng tiếp theo

### 05 — Công việc, hồ sơ, soát xét (YC10–13; G1–G6)

| Gói | Công việc | Điều kiện nghiệm thu |
| --- | --- | --- |
| 05-A Đặc tả | Cập nhật `05-tasks.md`: 8 trạng thái, quyền chuyển, số cấp duyệt, việc không cần duyệt, mở lại/tạm dừng, kỳ dịch vụ/hoàn tất, mapping 3 trạng thái cũ; chốt QD04 chi tiết | Duyệt đặc tả và phạm vi liên quan: cờ hạn pháp lý 03, nhóm/lịch sử vai dòng dịch vụ 04, kho hồ sơ 02 khi cần; kế thừa G, không bịa lịch sử duyệt |
| 05-B Quyền và dữ liệu | Test R2/R3, dùng quyền hiệu lực, chặn tự duyệt việc cần soát xét; mã/ưu tiên/ngày bắt đầu/người làm/người kiểm tra/kết quả/mốc nộp đầu/chấp nhận; nhóm kế toán theo dòng và lịch sử vai, dùng lại nhóm kiểm toán 04-F | Cấp/thu hồi quyền tùy chỉnh đều đúng; đổi người không chuyển trách nhiệm lịch sử sai; giữ nhãn dữ liệu chuyển đổi |
| 05-C Sinh và phụ thuộc | Sinh kỳ/giai đoạn từ kế hoạch 04 đã chốt, khóa chống trùng theo kỳ/bước; điều kiện mở bước/song song; lỗi và chạy lại | Gọi lại/đồng thời không trùng; quy trình mới không đổi việc cũ; tiến độ kỳ/dòng/HĐ khớp |
| 05-D Hồ sơ/soát xét | Hồ sơ từ snapshot 03/04, 6 trạng thái; nộp/duyệt/trả lại nhiều cấp; bằng chứng/lịch sử; chờ khách gắn yêu cầu hồ sơ và xác nhận; gia hạn có đề nghị/duyệt/lý do/hạn gốc theo G3 | Upload không tự hoàn tất; thiếu hồ sơ không duyệt/mở bước; lần nộp đầu và chấp nhận tách biệt; khoảng chờ không đếm trùng, không trừ hạn pháp lý |
| 05-E UI/nghiệm thu | Việc của tôi 4 tab, bảng/kanban/Gantt theo yêu cầu, lọc, giao/bàn giao hàng loạt, bình luận/@, chi tiết việc | Thống kê khớp danh sách, đúng quyền desktop/375px; test biên ngày, nhiều lần trả lại/gia hạn, đổi người; đủ dữ liệu cho 06/10 |

DONE cũ thiếu `completedAt` không được tự tính đúng hạn. Theo G, chỉ dùng `completedAt` làm mốc thay thế khi thực sự có; mapping cụ thể phải duyệt trong 05-A.

### 06 — Lịch, deadline, nhắc việc (YC14–15; G5–G7)

1. **06-A:** viết/duyệt `06-deadlines-notifications.md`; lịch nghĩa vụ/ngày nghỉ QD07, email QD09; liệt kê trường KH cần cho năm tài chính/kỳ khai/chế độ thuế và xin phạm vi 02. Không coi ví dụ demo là hạn pháp lý.
2. **06-B:** lịch làm việc/nghỉ/bù, hạn theo kỳ/phụ thuộc và nghĩa vụ KH, biên ngày giờ VN; tách hạn nội bộ/pháp lý; SLA soát xét mặc định 2 ngày làm việc theo G7.
3. **06-C:** scheduler/hàng đợi bền vững, log và khóa chống gửi trùng; nhắc 7/3/1/đúng hạn/quá hạn, escalation, nhắc soát xét; app/email, retry/restart, đổi/thu hồi hạn.
4. **06-D:** lịch tháng/tuần theo stack đã chốt, lọc KH/người/loại báo cáo và mở chi tiết. Nghiệm thu bằng bộ ngày mẫu được xác nhận, thử restart và email thật trong môi trường thử. Zalo chưa có OA/API vẫn là đầu ra còn mở; chỉ tách đợt sau khi có xác nhận.

### 07 — Thu tiền/công nợ (YC16–17; QD03/06/09)

1. **07-A:** duyệt `07-payments.md`: người/số cấp duyệt, ngày ghi nhận, đợt chỉ định/không chỉ định, thừa tiền, huỷ/điều chỉnh, HĐ chờ duyệt; xin phạm vi các nơi tính tiền trong contracts/customers/dashboard/reports.
2. **07-B:** test R1 trước sửa, một quy tắc phân bổ dùng mọi API/UI/export. **Bắt buộc:** A quá hạn 1 triệu chưa thu, B chưa đến hạn đã thu chỉ định 1 triệu → quá hạn **1 triệu** ở mọi nơi.
3. **07-C:** vòng đời phiếu, chứng từ/audit, chỉ thu đã duyệt được tính; kiểm soát đồng thời không thu vượt/ghi hai lần; huỷ/điều chỉnh khôi phục số liệu đúng.
4. **07-D:** tuổi nợ/đối soát KH–HĐ–đợt–phiếu, đề nghị thanh toán PDF/QR, nhắc nợ; coverage service tiền ≥70%; bộ số liệu được nghiệp vụ xác nhận và nghiệm thu.
5. **Mở rộng:** Techcombank, khớp/sai lệch/duyệt/chống nhập trùng; hoa hồng sau QD06. Nhập tay/sao kê không thay nghiệm thu tích hợp tự động.

### 08 — Hoá đơn (YC18)

- **08-A:** đặc tả `08-invoices.md`: đề nghị/phát hành/điều chỉnh/thay thế/huỷ; số/ký hiệu/ngày/HĐ; phân biệt sổ thủ công với phát hành điện tử.
- **08-B:** ràng buộc duy nhất theo quy tắc duyệt, kiểm soát đồng thời; PDF/XML/lịch sử, bảo toàn bản cũ; đối soát đã thu chưa xuất/đã xuất chưa thu khớp 07.
- **08-C:** EasyInvoice sau sandbox/quyền API; chống phát hành trùng, timeout/retry/đối soát trạng thái ngoài; nghiệm thu bằng bằng chứng từ môi trường thử. Nếu hoãn tích hợp, chỉ nghiệm thu sổ nội bộ theo phạm vi được chốt, giữ phần còn thiếu.

### 09 — Kho tài khoản/token (YC19)

- **09-A:** đặc tả `09-client-credentials.md`; kế thừa quyền/xác nhận mật khẩu QD02, không hỏi lại MFA/IP như chưa chốt.
- **09-B:** lịch sử thay đổi, log xem/sao chép không chứa mật khẩu; người giữ/mượn/trả/hạn token, nhắc hạn qua 06 trong phạm vi được duyệt.
- **09-C:** kiểm API/log/export không lộ bí mật, đồng thời mượn/trả không mâu thuẫn; backup/restore vẫn giải mã với khóa đúng, hướng dẫn giữ khóa riêng; nghiệm thu.

### 10 — Tổng quan/báo cáo (YC09/20; G1–G10)

- **10-A:** cập nhật đặc tả `10-dashboard-reports.md` theo QD10: 6 chỉ số vận hành, tài chính theo quyền, lọc kỳ/drill-down; danh mục báo cáo truy vết đủ yêu cầu, không chỉ giữ 4 tab demo.
- **10-B:** KH/HĐ/dịch vụ/doanh thu/công nợ/hoá đơn; hoa hồng phụ thuộc QD06; XLSX/PDF, lưu bộ lọc/gửi định kỳ; số tài chính dùng dữ liệu chuẩn hoá 07/08.
- **10-C:** năng lực tách Trợ lý/Trưởng nhóm/Manager và kế toán/kiểm toán; nộp đầu/chấp nhận, hạn gốc/hiện hành, gia hạn, chờ khách, trễ pháp lý, trả lại/SLA. Không tự thêm điểm tổng hợp/lương thưởng/chốt kỳ.
- **10-D:** từng ô có danh sách tái lập được; nhân viên chỉ mình, KTT trong nhóm, GĐ toàn bộ, thu tiền/admin không xem năng lực; không mẫu → “—”. Bỏ phép tính demo DONE thiếu mốc vẫn đúng hạn, giải trình thay test theo G. Nghiệm thu API/UI/export.

### 11 — Cài đặt/trải nghiệm (YC01/21)

- **11-A:** đặc tả `11-settings.md`: menu, công ty, danh mục/mẫu/đánh số, nhắc việc/ngưỡng/SLA/kết nối; duyệt phạm vi layout và các nơi đọc cấu hình.
- **11-B:** gom cấu hình 03–10, quyền/audit; tham số tác động thật, không sửa hồi tố dữ liệu đã cố định nếu không được phép; mặc định G dùng trước khi có cấu hình.
- **11-C:** responsive 375px, chuỗi tiếng Việt tập trung, điều hướng/tìm kiếm toàn cục theo yêu cầu, tải/lỗi/rỗng; hướng dẫn người dùng/quản trị, demo đầu–cuối, nghiệm thu.

## 5. Phân bổ lỗi và công việc nền

| Việc | Gói xử lý | Điều kiện đóng |
| --- | --- | --- |
| R1 Sai quá hạn | 07-B và nơi tính tiền được mở phạm vi | Test A/B khớp API/UI/export; không đợi tới 10 mới sửa reports |
| R2 Quyền, R3 tự duyệt | 05-B | Test cấp/thu hồi quyền, người làm = người duyệt |
| R4 Bảng nhân sự | 04-F3.1 | Người không có hạn vẫn hiện, số hồ sơ hiện tại đúng |
| R5 Lint/typecheck | 04-F3.2; lỗi mock 02 ở phạm vi riêng | Giữ kỳ vọng test; toàn dự án chỉ đạt khi hết lỗi |
| R6 Bàn giao cũ | Lượt lập kế hoạch này; duy trì sau mỗi gói | Agent brief, hiện trạng, kế hoạch/mục lục/QD05 nhất quán; giữ review lịch sử |
| Audit EXPORT thiếu ổn định | 01/audit-log, phiên được mở phạm vi | Tái hiện, chốt thời điểm log, hồi quy; không che bằng tăng chờ |
| Git/CI/phụ thuộc | 00, phiên được phép, QD12 | Repo chính, CI lint/unit/e2e/access/build/typecheck/max-lines và kiểm tra thư viện có bằng chứng chạy; không tự commit/push |
| Core layout 375px | 00 hoặc phạm vi 11 được duyệt | Tái hiện viewport chuẩn; kiểm xuyên trang đã nghiệm thu |
| Cloud/SMTP/backup/tải | 00 vận hành trước M7 | Đạt mục 8 trên hạ tầng đích |

Không dùng chính thức module demo còn P1. Nếu cần sửa R1/R2/R3 trước thứ tự hiện tại, phải có quyết định đổi ưu tiên/phạm vi; kế hoạch chưa tự mở các module đó.

## 6. Đầu vào và phần hoãn cần giữ

| Đầu vào | Cần trước | Việc cần nhận / trạng thái |
| --- | --- | --- |
| QD04 | 05-A | Chi tiết 8 trạng thái/duyệt/mapping, kế thừa G |
| QD03 | 07-A | Người/số cấp duyệt thu, phân bổ, hoàn/huỷ/ngày ghi nhận |
| QD07 | UAT 04, 05/06 | Mẫu Word, quy trình/hồ sơ thật, lịch nghĩa vụ/ngày nghỉ được xác nhận |
| QD08 | Nhập thử/đo tải/M7 | Excel, mapping/trùng, tách số KH/HĐ/năm/người đồng thời/dung lượng; người ký đối soát |
| QD09 | Email 06 và tích hợp 06/07/08 | M365/email, Zalo OA, Techcombank, EasyInvoice: tài liệu, sandbox, quyền kỹ thuật/phí |
| QD10 | 10-A | Bố cục KPI vận hành/tài chính, danh mục báo cáo/menu; G đã duyệt |
| QD11/12 | Lịch cam kết và M7 | Tải/SLA/RPO/RTO/retention, hạ tầng/ngân sách, repo/người làm/reviewer/UAT/vận hành |
| QD00 | Chốt phạm vi cuối | Portal còn mâu thuẫn; hiện hồ sơ nội bộ; không tự tạo portal |
| QD06 | Hoa hồng 07/10 | Công thức/căn cứ/thời điểm/chia/hoàn; 04 đã lưu nguồn |
| QD13 | Giá riêng KH | Cách định giá; đơn giá HĐ sửa riêng không phải bảng giá riêng theo hiệu lực |
| E4 PDF hợp đồng | Pilot đợt B theo phạm vi đã chốt | Đã duyệt hoãn sang B; lập gói bổ sung 04 với converter/mẫu/font/test, thực hiện phiên riêng theo phạm vi mở; DOCX không được báo là PDF |

QD01/02 và QD05/E1 đã chốt, không hỏi lại. Thu thập đầu vào khi chờ phản hồi không đồng nghĩa code song song hoặc tự gửi tin nhắn/email cho các bên.

Zalo, Techcombank, EasyInvoice, hoa hồng vẫn là yêu cầu. Nếu tách khỏi pilot phải có xác nhận hoãn, tiêu chí còn thiếu và mốc quay lại; không gọi toàn hệ thống hoàn thành. Hồ sơ kiểm toán chuyên sâu theo C11 thuộc giai đoạn sau, khác theo dõi hồ sơ/hạn 04-F đã duyệt.

## 7. Lịch, nguồn lực và cập nhật

| Điểm rà soát đề xuất | Nội dung |
| --- | --- |
| Phiên triển khai kế tiếp | 04-F3.1: test R4 trước sửa theo đặc tả đã duyệt |
| Khi đóng 04 | Nghiệm thu, ghi E4/QD13, chuẩn bị/duyệt đặc tả 05 và phạm vi liên quan |
| 30/10/2026 | Dựa kết quả thực tế 04/05 và đầu vào 06 để chốt phạm vi demo tháng 11 |
| Tháng 11/2026 | Demo phần đã kiểm chứng, UAT/lỗi/phần chưa đạt; đánh giá pilot tháng 12 |
| Trước pilot tháng 12/2026 | Rà M4–M7 theo phạm vi; cho chạy, thu hẹp có xác nhận hoặc lùi mốc |

Chưa đặt lịch với người tham gia. Chưa đủ dữ liệu cam kết tổng ngày/chi phí. Mỗi gói cần ước lượng thấp/cao cho đặc tả, dữ liệu, backend, UI, test/sửa sau UAT; ghi riêng thời gian chờ. Sau 04-F3 dùng thời gian thực tế cập nhật kế hoạch; không suy năng lực từ số test/menu hoặc giả định nhiều người làm song song.

Chị Hà là đầu mối duyệt; Nhật Linh/Hoàng Đỗ tham gia UAT theo nguồn. Người làm/reviewer/đối soát/vận hành cần chỉ định theo QD12; không tự phân công nghĩa vụ/gửi thông báo thay người dùng. Chi phí tách ngày công, hạ tầng/lưu trữ/backup/email/tích hợp/hỗ trợ và dự phòng, một lần/định kỳ; không dùng báo giá lưu trữ làm cam kết mới.

## 8. Kiểm chứng, pilot và bàn giao

Theo dõi từng YC/gói: **chưa đặc tả → chờ duyệt → đang làm → đã kiểm tra → chờ nghiệm thu → đã nghiệm thu**. Phân biệt đã code, đã kiểm tra, đã nghiệm thu, đã merge, đã triển khai.

| Nhóm | Bằng chứng bắt buộc |
| --- | --- |
| Chất lượng | Lint, unit/web, e2e quyền, build, max-lines; typecheck đầy đủ sau xử lý tồn đọng; service tiền/quyền coverage ≥70%; cảnh báo có đánh giá; DB test riêng |
| Dữ liệu | Migration DB trống/bản sao có dữ liệu; seed lại không trùng, schema không lệch; import lỗi/trùng/mapping, đối soát số lượng/tổng tiền; không bịa lịch sử chuyển đổi |
| UI | Thao tác thật desktop/375px, lỗi/quyền/xung đột, danh sách/chi tiết; không chỉ chụp trang |
| Tài chính | Chỉ phiếu hợp lệ tính tiền; R1 và bộ mẫu thu/hoá đơn khớp HĐ/KH/dashboard/report/export |
| Năng lực | Đúng F/G, chi tiết tái lập chỉ số, không mẫu “—”, không lộ dữ liệu ngoài phạm vi |
| Vận hành | Repo/CI thật, HTTPS, secret riêng, SMTP thử, log/giám sát/cảnh báo, người chịu trách nhiệm; đo tải theo QD11 với dữ liệu/cấu hình rõ |
| Khôi phục | Backup tự động hằng ngày, retention; thử restore DB/file/khóa trên hạ tầng đích, đo RPO/RTO, bản sao ngoài hệ thống chính |
| UAT | Kịch bản theo YC/phạm vi đợt, người dùng thật thử, lỗi chặn xử lý, người có thẩm quyền xác nhận; phần hoãn ghi rõ |
| Chuyển đổi | Diễn tập nhập/đối soát, khóa nguồn cũ/nhập cuối, người quyết định/quay lui; xuất đủ dữ liệu/file để chuyển cloud |
| Hỗ trợ | Hướng dẫn/đào tạo, kênh báo lỗi, trách nhiệm/thời gian hỗ trợ, bảo hành/chi phí thống nhất |

Trước M7 rà từng YC01–24: đạt/hoãn có duyệt/còn thiếu và bằng chứng. UAT không thay test tự động; kiểm tra/backup cục bộ không chứng minh cloud đạt. Chỉ công bố hoàn tất toàn phạm vi khi phần hoãn còn yêu cầu đã đóng hoặc có quyết định thay đổi phạm vi được duyệt.
