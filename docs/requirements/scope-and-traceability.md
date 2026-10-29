# Phạm vi và truy vết yêu cầu

Ngày tổng hợp: **15/10/2026**. Trạng thái: bản làm việc để cập nhật đặc tả từng chức năng, chưa phải biên bản nghiệm thu.

Nguồn: [PDF gốc](sources/functional-description-original.pdf) ký hiệu **G**; [DOCX đã trả lời](sources/clarifications-answered-2026-10-15.docx) ký hiệu **C1–C30**, **PL1** là Phụ lục 1 trong DOCX. Có thể đọc chung trong [PDF tích hợp](functional-description-integrated-2026-10-15.pdf).

## 1. Mục tiêu và phạm vi vận hành

Hệ thống quản lý nội bộ công ty dịch vụ kế toán và kiểm toán, liên kết khách hàng → hợp đồng → dịch vụ → quy trình → công việc → hồ sơ → soát xét → hoàn tất; đồng thời theo dõi thu tiền, công nợ và hoá đơn công ty xuất cho khách hàng.

- 50 người dùng theo C1. C2 trả lời “500” cho câu hỏi gồm cả khách hàng và hợp đồng/năm; chưa tách hai con số. Không dùng con số này để kết luận tải đồng thời.
- Một công ty, không nhiều chi nhánh/pháp nhân, không SaaS; bỏ ô chọn doanh nghiệp mẫu (C3, C5).
- Web dùng được trên điện thoại; không phát triển app native (C29).
- Excel/Google Sheets là nguồn dữ liệu cũ; cần import hàng trăm đến hàng nghìn dòng, có khả năng mở rộng; chưa có mẫu và số lượng chính xác (C4).
- Cloud, ưu tiên Việt Nam; backup tự động hằng ngày, khôi phục được DB và hồ sơ, nhật ký truy cập/sửa/tải/xoá; công ty sở hữu và xuất được dữ liệu để chuyển nhà cung cấp (C26).
- Mục tiêu demo quản trị tháng 11/2026, dùng thử và sửa để có thể sử dụng tháng 12/2026 (C27). Phạm vi và lịch bàn giao phải được xác nhận theo kế hoạch, chưa có cam kết toàn hệ thống vào mốc này.

## 2. Danh sách yêu cầu và đầu ra kiểm chứng

“Đầu ra” dưới đây là tiêu chí đề xuất để chi tiết hoá trong `features/`; không có nghĩa đã thực hiện. Tình trạng code xem [hiện trạng](../planning/current-status.md).

| Mã | Nguồn | Yêu cầu cần giữ trong phạm vi | Chức năng / đầu ra kiểm chứng |
| --- | --- | --- | --- |
| YC01 | C3, C5, C29; G §6–8 | Nội bộ một công ty, giao diện tiếng Việt và responsive | 00/11: không có chọn doanh nghiệp giả, thao tác chính ở 375px |
| YC02 | C20–22; G §2, §6 | Tài khoản, email/điện thoại; nhân viên chỉ thấy KH phân công; quản lý/người có quyền xem tài chính | 01: ma trận hành động, phạm vi và trường dữ liệu được duyệt; API không trả trường bị cấm; xử lý QD01/02 |
| YC03 | C26; G §6 | Audit truy cập, sửa, tải xuống, xoá; quản lý phiên và tài khoản | 01 và từng chức năng: log đủ chủ thể/đối tượng/thời điểm, không chứa mật khẩu rõ |
| YC04 | C4, C7; G §3.2 | Hồ sơ KH 360°, liên hệ, phân công; báo giá/HĐ/nghiệm thu/thanh lý/đề nghị thanh toán truy cập từ KH | 02 làm dữ liệu/hồ sơ; 04/07/08 nối nghiệp vụ tương ứng, không tạo các bản sao dữ liệu độc lập |
| YC05 | C4; G §3.2 | Import/export Excel, kiểm tra lỗi và trùng | 02: mẫu nhập, xem trước, báo lỗi theo dòng, đối soát số bản ghi; khối lượng thử theo QD08 |
| YC06 | C10, PL1; G §3.4 | Dịch vụ, giá, quy trình mẫu có mã/phiên bản; thêm/bớt/sắp xếp/sao chép; bước bắt buộc, song song, phụ thuộc | 03: phiên bản dùng ở hợp đồng được cố định; sửa mẫu không đổi công việc đã sinh |
| YC07 | PL1 | Mỗi bước có thời lượng, người làm/người soát xét mặc định, yêu cầu hồ sơ | 03: cấu hình hợp lệ, ngăn vòng phụ thuộc; ví dụ làm lại sổ sách 12 bước là mẫu cấu hình, không phải SLA cố định |
| YC08 | C6–8; G §3.3 | HĐ năm/vụ việc, nhiều dịch vụ; giám đốc duyệt; mẫu Word và bộ hồ sơ thương mại | 04: duyệt đúng quyền, chọn phiên bản quy trình, quản lý rà/chốt kế hoạch trước khi sinh việc; chờ mẫu và QD05/07 |
| YC09 | C9 | Doanh số/hoa hồng cho kinh doanh/người giới thiệu | 04/07/10: cần công thức, căn cứ và thời điểm ghi nhận trước triển khai; QD06 |
| YC10 | PL1; G §4.1 | Sinh dự án/công việc theo dịch vụ, kỳ/giai đoạn; liên kết KH/HĐ, người làm/kiểm tra, ưu tiên, tiến độ, kết quả và ngày thực tế | 05: sinh không trùng khi gọi lại/chạy lại, giữ lịch sử, không nhân bản module hiện có |
| YC11 | C13, PL1 | Soát xét bởi trưởng nhóm; người làm không tự duyệt việc bắt buộc duyệt; trả lại có lịch sử | 05: sơ đồ chuyển 8 trạng thái và quy tắc hoàn tất theo QD04; thiếu điều kiện không được duyệt |
| YC12 | PL1; G §3.2, §4.1 | Hồ sơ yêu cầu theo dịch vụ, tự tạo danh mục; chưa yêu cầu/đã yêu cầu/đã tải/đang kiểm tra/cần bổ sung/đã chấp nhận | 02/03 thiết kế nền; 05 nối vào việc: upload không tự hoàn tất, hồ sơ được chấp nhận mới mở bước liên quan |
| YC13 | PL1; G §4.1–4.2 | Việc của tôi: hôm nay/sắp hạn/quá hạn/đã xong; lọc, lịch sử, giao việc, bàn giao, bằng chứng | 05: từng vai trò chỉ thấy việc trong phạm vi, thống kê khớp danh sách |
| YC14 | PL1; G §4.2–4.3 | Hạn từ ngày bắt đầu/thời lượng/phụ thuộc, ngày làm việc/nghỉ lễ và lịch nghĩa vụ pháp lý | 06: bộ lịch và quy tắc được nghiệp vụ duyệt; sửa hạn có lịch sử; chưa mặc định ví dụ thành quy định pháp luật |
| YC15 | C24–25, PL1 | Nhắc trong app/email/Zalo; mốc 7/3/1 ngày, đến hạn, quá hạn có cấu hình | 06: gửi không trùng, retry có kiểm soát; email cần cấu hình M365; Zalo chờ OA/phí/API (QD09) |
| YC16 | G §4.4; C14, C21 | Đợt thu, phiếu thu được duyệt, công nợ/tuổi nợ thống nhất, chứng từ, đề nghị thanh toán | 07: chốt người duyệt và phân bổ QD03; số liệu khớp HĐ/KH/dashboard/báo cáo |
| YC17 | C17 | Đối soát ngân hàng tự động Techcombank | 07 mở rộng: có tài liệu/quyền API, môi trường thử, quy tắc khớp/sai lệch/duyệt; chưa được thay bằng nhập tay rồi báo hoàn tất |
| YC18 | C14–15; G §4.5 | Hoá đơn của công ty, sổ nội bộ và tích hợp EasyInvoice | 08: đối chiếu thu/xuất, PDF/XML, trạng thái và lịch sử; API phát hành chỉ nghiệm thu sau sandbox/quyền truy cập (QD09) |
| YC19 | C18–20; G §5.2 | Kho thông tin đăng nhập an toàn, không tự đăng nhập cổng ngoài; token ai giữ/mượn/trả/hết hạn | 09: mã hoá, quyền xem/sao chép, log riêng, lịch sử token và nhắc hạn; giải quyết QD02 |
| YC20 | PL1; G §3.1, §5.1 | Tổng quan vận hành 6 chỉ số; báo cáo tài chính, hợp đồng/KH/dịch vụ/nhân sự theo quyền | 10: chốt cách bố trí theo QD10; kỳ lọc và số liệu nhất quán; xuất XLSX/PDF, CSV không thay thế yêu cầu này |
| YC21 | PL1; G §6–7 | Menu đơn giản; cấu hình quy trình/danh mục/người dùng/quyền trong cài đặt | 11: giao diện cấu hình cuối cùng; dữ liệu cấu hình cần cho 03–06 phải có trước trong đúng chức năng |
| YC22 | C26; G §6–8 | Triển khai, sao lưu/khôi phục, giám sát, bảo quản khoá, xuất dữ liệu và chuyển cloud | 00 nền tảng; trước dùng thật: phục hồi trên hạ tầng đích, lịch backup, quyền vận hành, kế hoạch quay lui |
| YC23 | G §8; C1–2, C26 | Hiệu năng, bảo mật, dung lượng và mức dịch vụ | QD11: duyệt tải/độ trễ/RPO/RTO/retention; đo có báo cáo trước khi tuyên bố đạt |
| YC24 | C27–30 | Ưu tiên quản trị, phát triển theo giai đoạn; chị Hà duyệt, 3 người UAT | Kế hoạch: phạm vi demo/pilot rõ; có biên bản nghiệm thu và người hỗ trợ vận hành |

## 3. Phạm vi được yêu cầu nhưng cần phân kỳ hoặc quyết định

- **Được yêu cầu, chưa bỏ:** EasyInvoice, đối soát Techcombank, Zalo và hoa hồng. Đề xuất triển khai phần nâng cao sau luồng quản trị; phải được chị Hà xác nhận phân kỳ. Không đổi thành “không cần”.
- **Triển khai sau theo C11:** hồ sơ kiểm toán chuyên sâu, giấy tờ làm việc/chương trình/soát xét theo chuẩn mực. Vẫn quản lý tiến độ, tài liệu và soát xét công việc cơ bản trong đợt quản trị.
- **Mâu thuẫn cần chốt:** C23 nói không cần portal; PL1 phần V.3 và lộ trình cuối phụ lục lại yêu cầu khách hàng đăng nhập, tải hồ sơ và xem tiến độ. Phương án kế hoạch hiện tại là chưa phát triển portal, ghi QD00; luồng hồ sơ nội bộ vẫn thực hiện.
- **Không yêu cầu theo câu trả lời:** SaaS, nhiều pháp nhân/chi nhánh, timesheet, đẩy dữ liệu MISA/Fast, tự đăng nhập cổng thuế, SSO/đồng bộ lịch M365, app di động riêng. Nếu bổ sung phải ghi thay đổi phạm vi.
- C20 không yêu cầu bắt buộc 2FA/IP văn phòng. QD02 đã chốt theo ủy quyền ngày 15/10: không bắt buộc MFA/IP; xem bí mật cần quyền riêng và xác nhận lại mật khẩu trong 5 phút, vẫn mã hoá và audit. QD01 áp dụng ma trận ở [đặc tả 01](../features/01-users-access-control.md); [biên bản](../features/01-users-acceptance.md) ghi phạm vi đã đạt. YC03/19/20 còn phần nghiệp vụ ở các bước sau, không bị đóng toàn bộ bởi 01.

## 4. Quy tắc cập nhật

Mỗi đặc tả phải dẫn mã YC, quyết định QD liên quan, trạng thái phê duyệt và tiêu chí nghiệm thu. Test chỉ được đổi khi đặc tả đã duyệt thay đổi hoặc có chứng cứ test cũ sai; giữ mức kiểm chứng tương đương. Các yêu cầu gốc chưa có dòng chi tiết trong bảng vẫn phải đối chiếu trong đặc tả module, không coi bảng tổng hợp này là danh sách cắt giảm.

## Tiến độ 02 ngày 15/10/2026

Người dùng đã duyệt [đặc tả 02](../features/02-customers-documents.md); [kiểm chứng](../features/02-customers-acceptance.md) ghi phạm vi liên hệ/phân công, Excel và kho hồ sơ đã đạt kỹ thuật. YC04 còn các hồ sơ nghiệp vụ được tạo ở 04/07/08; YC05 chưa có dữ liệu thật để mapping/đối soát. Không đóng toàn bộ các YC hoặc QD00/08 chỉ bằng kết quả cục bộ 02.
