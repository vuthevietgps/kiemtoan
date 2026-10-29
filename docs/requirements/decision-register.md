# Sổ quyết định và đầu vào còn thiếu

Cập nhật **22/10/2026**. C1–C30 và PL1 dẫn tới [DOCX đã trả lời](sources/clarifications-answered-2026-10-15.docx); G là [PDF gốc](sources/functional-description-original.pdf). Đồng bộ trạng thái theo quyết định đã ghi dưới đây; không có quyết định nghiệp vụ mới trong lượt lập kế hoạch 22/10.

Đã nhận câu trả lời cho 30 câu; không tiếp tục ghi chung là “chưa trả lời”. Ngày 15/10 người dùng trực tiếp ủy quyền agent chốt ma trận và nghiệm thu chức năng 01; QD01/02 đã chốt theo [đặc tả 01](../features/01-users-access-control.md). Các mục khác giữ trạng thái như bảng, không suy diễn thành chị Hà đã ký nghiệm thu toàn hệ thống.

| Mã / trạng thái | Điểm cần quyết định hoặc cung cấp | Phương án làm việc / đầu ra cần nhận | Trước bước | Đầu mối đề nghị |
| --- | --- | --- | --- | --- |
| QD00 — Mâu thuẫn | C23 không portal; PL1 V.3 và lộ trình yêu cầu portal | Chưa triển khai portal trong đợt quản trị. Chị Hà xác nhận bỏ hay để đợt sau; nếu bổ sung phải có đặc tả/quyền khách ngoài | 02 thiết kế hồ sơ; trước cam kết lịch | Chị Hà |
| QD01 — Đã chốt 15/10 | 5 vai trò mặc định, vai trò nghiệp vụ tuỳ chỉnh và cấp quyền nhạy cảm có duyệt | Theo ma trận đặc tả 01: director toàn công ty; manager trong nhóm; staff được phân công, mặc định không tiền/bí mật; cashier chỉ tài chính; admin quản lý tài khoản/audit, không dữ liệu nghiệp vụ. Admin đề nghị, director duyệt; API/export áp cùng quyền | Triển khai/kiểm chứng 01 | Người dùng ủy quyền agent chốt trong chat |
| QD02 — Đã chốt 15/10 | Không bắt buộc MFA/IP; tăng bảo vệ phiên và truy cập bí mật | Mật khẩu mới mạnh, mời/reset dùng một lần; sai 5 lần khoá 15 phút; JWT15 phút, refresh xoay 7 ngày, thu hồi server. Xem bí mật cần quyền và xác nhận mật khẩu 5 phút. Không bỏ mã hoá/audit | Triển khai 01; 09 dùng lại chính sách | Người dùng ủy quyền agent chốt trong chat |
| QD03 — Chưa đủ chi tiết | G có duyệt phiếu thu nhưng mô tả và ma trận khác người duyệt | Chọn giám đốc/trưởng kế toán, số cấp; phiếu chờ không tính đã thu; quy tắc đợt chỉ định, không chỉ định, thừa tiền, huỷ/điều chỉnh, ngày ghi nhận | 07 | Chị Hà + người phụ trách thu tiền |
| QD04 — Cần đặc tả chuyển trạng thái | G có 3 trạng thái; PL1 có 8; C13 trưởng nhóm soát xét | Lập bảng chuyển trạng thái, phân biệt “đã duyệt”/“hoàn tất”, mở lại/tạm dừng, điều kiện hồ sơ và người duyệt; ánh xạ dữ liệu cũ không tự coi DONE là đã duyệt | 05, chuẩn bị mô hình từ 03 | Chị Hà + trưởng nhóm |
| QD05 — Đã chốt điểm sinh việc 16/10 qua E1/E2 | PL1 yêu cầu quản lý rà/chỉnh/xác nhận quy trình | Sinh khi HĐ đã duyệt **và** kế hoạch dòng dịch vụ đã xác nhận; quyền `contracts:plan` cho KTT/trưởng nhóm trong phạm vi và GĐ. 04-A/B đã kiểm chứng; sinh kỳ tiếp theo thuộc đặc tả 05, không hỏi lại điểm sinh đã chốt | 04 đã triển khai; 05 kế thừa | Người dùng duyệt E1–E6 trong chat, dẫn bên dưới |
| QD06 — Thiếu công thức | C9 cần doanh số/hoa hồng | Căn cứ HĐ/thu tiền, tỷ lệ/bậc, chia người giới thiệu, thời điểm ghi nhận, hoàn/huỷ; xác nhận phân kỳ nếu chưa có công thức | 04 lưu nguồn; 07/10 tính và báo cáo | Chị Hà |
| QD07 — Thiếu tài liệu | C8 có mẫu Word; C10/PL1 mới có mẫu 12 bước minh hoạ | Cung cấp mẫu báo giá/HĐ/nghiệm thu/thanh lý/đề nghị thanh toán; danh mục dịch vụ thực, quy trình, hồ sơ bắt buộc; ngày làm việc/lịch nghỉ và hạn pháp lý được nghiệp vụ xác nhận | 03, 04, 06 theo đầu vào | Chị Hà + trưởng nhóm |
| QD08 — Thiếu dữ liệu mẫu | C2 “500” gồm hai câu hỏi; C4 chưa thống kê dữ liệu nhập | Tách số KH/HĐ năm, số người đồng thời, tăng trưởng, dung lượng file; Excel mẫu đã ẩn dữ liệu nhạy cảm, mapping/trùng và người ký đối soát | 02 import, trước đo tải và chuyển đổi | Nhật Linh/Hoàng Đỗ phối hợp, chị Hà xác nhận |
| QD09 — Phụ thuộc bên ngoài | EasyInvoice, Techcombank, app/email/Zalo được yêu cầu; chưa có Zalo OA | IT thu thập tài liệu/quyền API, sandbox, tài khoản kỹ thuật, hạn mức/phí; M365 phương án gửi mail; chị Hà xác nhận ngân sách và phân kỳ. Không ghi giá Zalo khi chưa xác minh | 06 email/Zalo, 07 ngân hàng, 08 HĐĐT | IT + đầu mối nhà cung cấp do công ty chỉ định |
| QD10 — Mâu thuẫn bố cục | G có 5 KPI và tài chính; PL1 có 6 chỉ số vận hành, không lặp thẻ tài chính, 9 menu | Đề xuất tổng quan vận hành riêng và tài chính theo quyền; xác nhận nội dung/mapping menu, bộ lọc kỳ và drill-down | 10; cấu trúc điều hướng thống nhất ở 00 | Chị Hà + nhóm UAT |
| QD11 — Cần duyệt mức dịch vụ | G đề xuất 100 đồng thời/5.000 KH/50.000 task năm, <2 giây, RPO24h/RTO4h, giữ backup30 ngày, uptime99,5%; C26 chỉ chốt backup hằng ngày/cloud | Chốt tải thực, cách đo p95 hoặc tiêu chí khác, dung lượng/retention, thời gian dừng backup, ngân sách cloud và trách nhiệm giám sát | 00 thiết kế; trước pilot dùng thật | Chị Hà + IT vận hành |
| QD12 — Chưa đủ điều kiện quản lý dự án | Workspace chưa có `.git`; CI mới có file; chưa có đội/khả dụng/ngân sách duyệt | Xác định repo chính, người thực hiện/reviewer, lịch UAT, phạm vi demo/pilot, dự toán theo giai đoạn. Không tự init/commit/push khi chưa yêu cầu | Đóng 00; trước cam kết tháng 11/12 | Chủ dự án + IT |

## Quyết định chốt trong đặc tả chức năng

**03 — D1–D5, người dùng duyệt trong chat ngày 15/10/2026:** “Duyệt đặc tả 03 với phương án đề xuất D1–D5 và phạm vi sửa ngoài module đã liệt kê.” Chi tiết ở [đặc tả 03](../features/03-service-catalog.md).

- **D1 — mở rộng ma trận QD01:** thêm khoá quyền `workflow-templates`. Giám đốc toàn quyền và là người duy nhất phát hành; trưởng nhóm/KTT xem, tạo và sửa bản nháp; nhân viên chỉ xem; kế toán thu tiền và quản trị không có quyền. Dịch vụ và bảng giá giữ như ma trận 01. Test: e2e phân quyền cho 5 vai trò và vai trò tuỳ chỉnh.
- **D2:** thời lượng bước tính theo ngày làm việc; hạn theo kỳ tính ngày lịch. Lịch nghỉ lễ vẫn chờ QD07 và triển khai ở 06.
- **D3:** từ 03, việc được sinh từ phiên bản quy trình đang hiệu lực; không đổi thời điểm sinh, nên QD05 vẫn mở. Migration chuyển việc mẫu cũ thành phiên bản v1.
- **D4:** một dịch vụ có nhiều quy trình, đúng một quy trình mặc định; mỗi quy trình có tối đa một bản nháp và một bản đang hiệu lực.
- **D5:** lưu được cả bước kiểm tra/phê duyệt và số cấp duyệt từng bước; cách áp dụng vẫn thuộc QD04, chưa chốt.

Không có thay đổi lịch/chi phí được ghi nhận cùng quyết định này.

**QD13 — Chờ chốt (ghi ngày 15/10, đồng bộ 22/10/2026):** người dùng cho biết sau này giá dịch vụ có thể khác nhau theo từng công ty khách hàng. Đơn giá trên từng dòng HĐ đã nhập riêng được; 04-E đã triển khai gợi ý từ bảng giá chung/giá chuẩn, chưa có bảng giá riêng theo KH. Phương án bổ sung đề xuất: dịch vụ × KH có ngày hiệu lực, ưu tiên giá riêng → bảng giá chung → giá chuẩn. Cần chị Hà cho biết cách định giá thực tế (theo HĐ năm, nhóm khách hay chiết khấu %) trước khi duyệt gói bổ sung; không chặn lại đặc tả E1–E6 đã duyệt và không coi gợi ý giá là đã đóng QD13.

**04 — E1–E6, người dùng duyệt trong chat ngày 16/10/2026** (“Tôi nghiệm thu 03 và duyệt đặc tả 04 với phương án đề xuất E1–E6 cùng phạm vi sửa ngoài module đã liệt kê. Bắt đầu code 04-A.”): đề xuất trong [đặc tả 04](../features/04-contracts-lifecycle.md). E1 trả lời QD05 (sinh việc khi đã duyệt HĐ và đã xác nhận kế hoạch); E5 lưu nguồn cho QD06 nhưng chưa tính hoa hồng; giá riêng theo khách vẫn chờ QD13.

**04-F — F1–F11, người dùng duyệt trong chat ngày 22/10/2026** (“Tôi duyệt đặc tả 04-F với phương án đề xuất F1–F11 cùng phạm vi sửa ngoài module đã liệt kê.”): đề xuất trong [đặc tả 04-F](../features/04-audit-engagement-tracking.md). Theo dõi hồ sơ kiểm toán theo dòng dịch vụ có cờ phát hành BCKT (sửa `service-catalog` thêm cờ); số BCKT duy nhất; chỉ Giám đốc phát hành, mở lại và gia hạn; đánh giá đúng hạn theo hạn hiện hành kèm kết quả theo hạn gốc; trễ hạn hồ sơ tính cho Manager/trưởng nhóm/người ký 1, trợ lý đánh giá theo việc ở 05/10; nhân viên chỉ xem tỷ lệ của chính mình.

**04 — nghiệm thu, người dùng xác nhận trong chat ngày 22/10/2026** (“Tôi nghiệm thu 04. Giữ F6 như đã duyệt.”): [biên bản](../features/04-contracts-acceptance.md). Giữ F6: đưa người vào nhóm kiểm toán không mở quyền xem khách hàng; phân công KH (02) vẫn là nguồn quyền xem duy nhất — KTT/nhân viên giữ vai trong hồ sơ của KH ngoài phạm vi sẽ không thấy hồ sơ đó cho tới khi được phân công KH.

**05 — H1–H12, người dùng duyệt trong chat ngày 22/10/2026** (“Tôi duyệt đặc tả 05 với phương án đề xuất H1–H12 cùng phạm vi sửa ngoài module đã liệt kê. Bắt đầu code 05-B.”): đề xuất trong [đặc tả 05](../features/05-tasks-workflow.md). Trả lời **QD04**: 8 trạng thái PL1; Đã phê duyệt (qua đủ cấp, còn giao nộp) khác Hoàn thành; soát xét 0/1/2 cấp theo bước; không tự duyệt (R3), quyền hiệu lực (R2); chờ khách tự động theo hồ sơ; tạm dừng không trừ hạn; phụ thuộc thoả khi bước trước Đã phê duyệt/Hoàn thành; gia hạn qua đề nghị–duyệt, hạn pháp lý không gia hạn; nhóm dịch vụ kế toán bảng riêng, kiểm toán dùng nhóm 04-F; chuyển đổi Đã làm chưa duyệt về Chờ kiểm tra; sinh việc mọi kỳ khi xác nhận kế hoạch.

**05 — nghiệm thu và 06 — I1–I14, người dùng xác nhận trong chat ngày 23/10/2026** (“Tôi nghiệm thu 05 và duyệt đặc tả 06 với phương án đề xuất I1–I14 cùng phạm vi sửa ngoài module đã liệt kê. Bắt đầu code 06-B.”): [biên bản 05](../features/05-tasks-acceptance.md), [đặc tả 06](../features/06-deadlines-notifications.md). Trả lời một phần **QD07** về cơ chế (danh mục nghĩa vụ có phiên bản do KTT soạn, GĐ xác nhận; lịch năm Nháp → Đã xác nhận) — dữ liệu thật (danh mục, ngày nghỉ) vẫn chờ KTT cung cấp. **QD09:** hoãn Zalo khỏi 06 (I10), email qua SMTP; còn chờ SMTP thử. Phạm vi ngoài module được duyệt: 02 (trường thuế–kế toán KH), 03 (loại nghĩa vụ trên bước quy trình, lịch làm việc trong `workflow-schedule.util`), 04 (bước kế hoạch, bộ sinh việc), 05 (việc gắn nghĩa vụ, SLA theo lịch, mức gấp), 01 (`deadlines:approve`, cấp `deadlines:create/update`), 10 (khối lịch báo cáo), thư viện `@nestjs/schedule`, FullCalendar.

**07 — J1–J15, người dùng duyệt trong chat ngày 28/10/2026** (“Duyệt, làm 07-B”): [đặc tả 07](../features/07-payments.md). Trả lời **QD03** về cơ chế: một cấp duyệt (mặc định GĐ, quyền `payments:approve`), không tự duyệt, phiếu chưa duyệt không tính đã thu, ngày ghi nhận = ngày tiền về, phân bổ chỉ định đợt rồi đợt hạn sớm nhất (lưu), chặn thu vượt, huỷ có lý do; bộ số liệu mẫu công nợ vẫn chờ Kế toán thu tiền xác nhận. QD06 (hoa hồng) và QD09 (Techcombank) giữ nguyên chờ.

**06 — nghiệm thu tạm thời (có điều kiện), người dùng xác nhận trong chat ngày 28/10/2026** (“Tạm thời nghiệm thu 06 để bắt đầu làm tiếp các phần còn lại cho hợp lý đối với nghiệp vụ công ty cung cấp dịch vụ kế toán kiểm toán”): thay cho lựa chọn trước đó cùng ngày “Chờ đủ QD07/QD09”. Được bắt đầu 07; tiêu chí 2 và 8 của 06 kiểm lại khi có QD07/QD09. Lựa chọn trước:

**06 — người dùng chọn chờ đủ QD07/QD09 trước khi nghiệm thu, trong chat ngày 28/10/2026** (“Chờ đủ QD07/QD09”): 06 đã hoàn thiện kỹ thuật ([biên bản kiểm chứng](../features/06-deadlines-acceptance.md)); không nghiệm thu có điều kiện, không bắt đầu 07 cho tới khi kiểm lại tiêu chí 2 (bộ ngày mẫu — QD07) và 8 (SMTP thử — QD09) và người dùng nghiệm thu 06.

**Khung đánh giá năng lực — G1–G10, người dùng duyệt trong chat ngày 22/10/2026** (“Tôi duyệt khung đánh giá năng lực với phương án đề xuất G1–G10. Làm tiếp 04-F2.”): đề xuất trong [khung đánh giá](../features/10-performance-evaluation.md). Nhóm Manager/trưởng nhóm/trợ lý theo dòng dịch vụ cho cả kế toán và kiểm toán; đánh giá theo hạn hiện hành kèm hạn gốc; gia hạn việc do Manager/KTT/GĐ duyệt; trợ lý tính theo lần nộp đầu, trưởng nhóm/Manager theo ngày chấp nhận; trừ thời gian chờ khách cho hạn nội bộ (không cho hạn pháp lý); tách hạn pháp lý; SLA soát xét 2 ngày làm việc; chỉ số rời tô màu, chưa có điểm tổng hợp; phạm vi xem như F11; tính trực tiếp, chưa chốt kỳ. Ảnh hưởng đặc tả 05, 06, 10, 11 và cờ hạn pháp lý ở 03.

## Các câu trả lời đã đủ để định hướng

- Nội bộ một công ty, bỏ ô doanh nghiệp mẫu; không timesheet/native app/MISA/SSO/đồng bộ lịch; kho đăng nhập không kết nối cổng ngoài.
- Hợp đồng năm/vụ việc và nhiều dịch vụ; giám đốc duyệt HĐ; trưởng nhóm soát xét công việc.
- Hoá đơn công ty xuất cho KH để quản lý công nợ; cần quản lý token mượn/trả/hết hạn.
- Nhân viên chỉ thấy KH được phân công; cloud ưu tiên Việt Nam; dữ liệu thuộc công ty; có import Excel và backup hằng ngày.
- Mục tiêu demo tháng 11 và sử dụng tháng 12/2026; ưu tiên quản trị, nâng cao triển khai theo giai đoạn. Đầu mối duyệt: chị Hà; UAT: chị Hà, Nhật Linh, Hoàng Đỗ.

Những câu trả lời này vẫn cần được đưa vào đặc tả có tiêu chí nghiệm thu trước khi code; không yêu cầu người dùng trả lời lại cùng một câu.

## Mẫu ghi quyết định

Ghi ngay dưới mã QD tương ứng khi có xác nhận: nội dung quyết định; người duyệt; ngày; liên kết/bằng chứng; YC/đặc tả ảnh hưởng; dữ liệu cần chuyển; test cần bổ sung/cập nhật; thay đổi lịch/chi phí. Nếu quyết định khác phương án trên, cập nhật kế hoạch và đặc tả trước khi sửa hành vi.

**04 — sửa ngoài phạm vi 07, người dùng đồng ý trong chat ngày 29/10/2026** (“Sửa module 04”): sự kiện huỷ hợp đồng (`contracts-command.service.ts`) chờ trình nghe xử lý xong (`await emitAsync`) như các sự kiện HĐ khác, thay vì chạy ngầm sau khi trả kết quả. Lý do: trình đồng bộ lịch báo cáo (06) chạy ngầm để lại transaction dở dang khi tắt ứng dụng, làm e2e treo/hỏng chập chờn. Không đổi nghiệp vụ huỷ HĐ.
