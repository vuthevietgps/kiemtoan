# Khung đánh giá năng lực theo vai trò — kế toán dịch vụ và kiểm toán

Ngày 22/10/2026. **Đã được người dùng duyệt trong chat ngày 22/10/2026: “Tôi duyệt khung đánh giá năng lực với phương án đề xuất G1–G10. Làm tiếp 04-F2.”** Yêu cầu trong chat ngày 22/10/2026: "vấn đề Cách đánh giá năng lực, mức độ hoàn thành cv, deadline: về lĩnh việc kế toán dịch vụ: trợ lý, trưởng nhóm, manager. Về kiểm toán: trợ lý, trưởng nhóm, manager như thế nào rồi" và "Viết đặc tả khung đánh giá năng lực theo vai trò cho cả kế toán dịch vụ và kiểm toán (trợ lý, trưởng nhóm, manager) để tôi duyệt, rồi mới làm tiếp 04-F2." Chưa code.

Căn cứ: YC10 (tiến độ, ngày thực tế), YC11 (soát xét, trả lại có lịch sử), YC12 (hồ sơ yêu cầu khách: đã yêu cầu/cần bổ sung), YC15 (nhắc hạn), YC20 (báo cáo nhân sự theo quyền) trong [phạm vi](../requirements/scope-and-traceability.md); QD04 (trạng thái việc), QD07 (lịch nghỉ, quy trình thật), QD10 (bố cục báo cáo) trong [sổ quyết định](../requirements/decision-register.md); [04-F](04-audit-engagement-tracking.md) đã duyệt F9–F11 (hạn gốc/gia hạn, trách nhiệm theo vai, phạm vi xem); [đặc tả demo 10](10-dashboard-reports.md) và [đặc tả demo 05](05-tasks.md) chỉ dùng đối chiếu.

## Mục đích và giới hạn

- Đây là **đặc tả khung**: thống nhất định nghĩa chỉ số, vai trò, nguồn dữ liệu và quy tắc công bằng cho mọi màn hình đánh giá. Phần code nằm ở các bước theo thứ tự quy tắc mục 9: 04-F2 (hạn hồ sơ kiểm toán), 05 (dữ liệu việc), 06 (lịch, nhắc hạn), 10 (báo cáo), 11 (cấu hình ngưỡng). Mỗi bước vẫn có đặc tả chi tiết và nghiệm thu riêng; đặc tả này là đầu vào bắt buộc của chúng.
- Đánh giá **vận hành**: đúng hạn, chất lượng (bị trả lại, mở lại), khối lượng. **Không** gồm: lương/thưởng, hoa hồng (QD06), đánh giá 360°, chấm công/timesheet (đã loại khỏi phạm vi), doanh thu theo người. Số liệu là căn cứ tham khảo cho người quản lý, không tự động kết luận xếp loại.
- Không có số tiền ở bất kỳ chỉ số nào (nhân viên được xem chỉ số của mình mà không cần quyền tài chính).

## Vai trò

| Vai trò | Kế toán dịch vụ (KTT, BCTC, hoàn thuế, làm lại sổ…) | Kiểm toán (dịch vụ có cờ phát hành BCKT, 04-F) |
| --- | --- | --- |
| **Trợ lý** | Người thực hiện việc (bước quy trình) | Trợ lý trong nhóm kiểm toán, người thực hiện việc của kế hoạch kiểm toán |
| **Trưởng nhóm** | Trưởng nhóm của dòng dịch vụ; thường là người soát xét các bước | Trưởng nhóm của hồ sơ kiểm toán (04-F) |
| **Manager** | Manager của dòng dịch vụ (phụ trách danh mục khách hàng) | Manager của hồ sơ kiểm toán (04-F) |
| Người ký BCKT | — | Người ký 1/2 (04-F); chỉ tính hạn soát xét theo F10, không xếp vào ba vai trên |

- **Nhóm thực hiện của dòng dịch vụ (G1):** mỗi dòng dịch vụ của HĐ có Manager, trưởng nhóm, trợ lý — **cùng một cấu trúc** cho cả hai mảng. Với dịch vụ kiểm toán, đó chính là nhóm của hồ sơ kiểm toán 04-F (không nhập hai nơi). Lịch sử vai (ai giữ vai nào, từ–đến) ghi như `audit_engagement_role_history` của 04-F để tính trách nhiệm đúng người tại thời điểm hạn đến.
- Vai trò đánh giá **khác** vai trò tài khoản (Giám đốc / Kế toán trưởng / Nhân viên…): một nhân viên có thể là trưởng nhóm ở dòng này và trợ lý ở dòng khác; báo cáo tách theo vai.

## Định nghĩa chung

- **Đơn vị đo:**
  - **Việc** (05): một bước kế hoạch đã sinh việc, có người thực hiện, có hạn.
  - **Kỳ dịch vụ** (kế toán): một dòng dịch vụ × một kỳ (tháng/quý/năm); hoàn tất khi mọi việc bắt buộc của kỳ được chấp nhận.
  - **Hạn hồ sơ kiểm toán** (04-F): kết thúc kiểm toán, hoàn tất soát xét, phát hành BCKT.
- **Hạn gốc / hạn hiện hành (G2):** hạn gốc chốt khi giao việc (việc) hoặc khi hồ sơ sang Đang kiểm toán (04-F). Đổi hạn sau đó là **gia hạn**: cần lý do và người duyệt (G3), ghi lịch sử, không sửa/xoá. Đánh giá theo hạn hiện hành, kèm cột "đúng hạn gốc" và số lần/ngày gia hạn.
- **Ngày đạt** (giờ Việt Nam, so theo ngày):
  - Trợ lý: **lần nộp đầu** để soát xét (hoặc hoàn tất nếu việc không cần soát xét) (G4).
  - Trưởng nhóm, Manager: ngày việc/kỳ/hồ sơ **được chấp nhận** (duyệt, hoàn tất, phát hành).
- **Kết quả một hạn:** Đúng hạn (đạt ≤ hạn), Trễ (đạt > hạn, số ngày trễ), Quá hạn chưa đạt (hôm nay > hạn), Sắp đến hạn (≤ 7 ngày, cấu hình ở 11). Một hạn thuộc kỳ báo cáo nếu **hạn hiện hành** nằm trong kỳ (như 04-F và báo cáo demo 10).
- **Tỷ lệ đúng hạn** = Đúng hạn / (Đúng hạn + Trễ + Quá hạn chưa đạt); không có hạn nào thì hiện "—", không hiện 0%. Làm tròn 1 chữ số thập phân.
- **Thời gian chờ khách (G5):** khoảng thời gian việc ở trạng thái "Chờ khách hàng" gắn với một yêu cầu hồ sơ gửi khách (YC12) được trưởng nhóm xác nhận; số ngày chờ được cộng vào **hạn nội bộ** khi đánh giá. Không áp dụng cho **hạn pháp lý** (G6): vẫn ghi trễ, gắn nhãn "do khách" để người đánh giá cân nhắc.
- **Hạn pháp lý (G6):** bước quy trình (03) đánh dấu "hạn pháp lý" (nộp tờ khai, nộp BCTC, quyết toán…). Trễ hạn pháp lý đếm riêng, luôn tô đỏ, không bị "pha loãng" trong tỷ lệ chung.
- **Bị trả lại:** việc bị người soát xét trả lại ít nhất một lần (05, YC11); hồ sơ kiểm toán bị lùi giai đoạn từ Đang soát xét/Chờ phát hành (mốc giai đoạn 04-F); báo cáo bị mở lại sau phát hành (04-F).
- **Ngày làm việc:** dùng cho thời gian soát xét; theo lịch làm việc của 03/06 (lịch nghỉ lễ chờ QD07).

## Chỉ số theo vai trò

### Kế toán dịch vụ

| Vai trò | Chỉ số chính | Chỉ số phụ |
| --- | --- | --- |
| **Trợ lý** | Tỷ lệ việc nộp đúng hạn (lần nộp đầu, sau khi trừ thời gian chờ khách); số lần trễ **hạn pháp lý** của việc mình thực hiện | Tỷ lệ bị trả lại; số việc đang quá hạn; khối lượng: số việc được chấp nhận trong kỳ, số khách hàng đang làm |
| **Trưởng nhóm** | Tỷ lệ **kỳ dịch vụ** hoàn tất đúng hạn của các dòng mình làm trưởng nhóm; số lần trễ hạn pháp lý trong nhóm | Thời gian soát xét (ngày làm việc từ nộp → duyệt/trả lại) và tỷ lệ soát xét trong SLA (G7); số việc chờ mình soát xét quá SLA; tỷ lệ gia hạn |
| **Manager** | Tỷ lệ kỳ dịch vụ hoàn tất đúng hạn của danh mục mình quản lý; số lần trễ hạn pháp lý trong danh mục | Số kỳ đang trễ; tỷ lệ gia hạn; số việc phải giao lại do quá hạn |

### Kiểm toán

| Vai trò | Chỉ số chính | Chỉ số phụ |
| --- | --- | --- |
| **Trợ lý** | Tỷ lệ việc nộp đúng hạn trong kế hoạch kiểm toán (như trợ lý kế toán); **không** bị tính theo hạn hồ sơ (F10) | Tỷ lệ bị trả lại; số việc đang quá hạn; khối lượng việc được chấp nhận; số hồ sơ đang tham gia |
| **Trưởng nhóm** | Đúng hạn **kết thúc kiểm toán** và **phát hành BCKT** (04-F, F10) | Thời gian soát xét việc của trợ lý (05, SLA G7); số lần hồ sơ bị trả lại từ soát xét (lùi giai đoạn); tỷ lệ gia hạn |
| **Manager** | Đúng hạn **hoàn tất soát xét** và **phát hành BCKT** (04-F, F10) | Số hồ sơ đang trễ; số báo cáo phải mở lại sau phát hành; tỷ lệ gia hạn |
| Người ký 1 | Đúng hạn hoàn tất soát xét (cùng Manager, F10) | Hiện ở bảng 04-F, không vào báo cáo năng lực ba vai |

## Báo cáo "Đánh giá năng lực" (10)

- Trang trong `/reports`, tab theo vai (Trợ lý / Trưởng nhóm / Manager), lọc: kỳ (tháng, quý, năm, khoảng ngày), mảng (kế toán dịch vụ / kiểm toán / cả hai), nhóm (team), dịch vụ, người.
- Mỗi người một dòng; **từng chỉ số là một cột riêng**, tô màu theo ngưỡng (G8); không cộng chỉ số kế toán và kiểm toán thành một số. Có cột "đúng hạn gốc", "số lần gia hạn", "trễ do khách" để không chỉ nhìn tỷ lệ.
- Bấm một ô: danh sách các việc/kỳ/hạn được tính (khách hàng, HĐ, việc, hạn gốc, hạn hiện hành, ngày đạt, kết quả, lý do gia hạn, thời gian chờ khách, người soát xét) — con số phải tái lập được từ danh sách này.
- Phạm vi xem (G9, như F11 của 04-F): Giám đốc tất cả; Kế toán trưởng người trong nhóm mình; nhân viên **chỉ dòng của chính mình**; kế toán thu tiền, quản trị không xem. Xuất XLSX theo quyền xuất báo cáo và ghi nhật ký `EXPORT`.
- Thay thế phép tính demo hiện có (`/reports/staff-performance`, `/reports/task-compliance`): bỏ quy tắc "việc Đã làm không có `completedAt` coi là đúng hạn"; dùng định nghĩa ở trên. Thay đổi test của báo cáo demo ghi lý do ở `10-test-policy-changes.md` khi làm 10.
- Số liệu tính trực tiếp từ dữ liệu hiện hành (G10); không có "chốt kỳ" ở giai đoạn đầu.

## Dữ liệu mỗi bước phải cung cấp

| Bước | Dữ liệu / chức năng cần có để đánh giá | Ghi chú |
| --- | --- | --- |
| **04-F2** (đã duyệt) | Ba hạn hồ sơ kiểm toán, hạn gốc/gia hạn, mốc đạt, kết quả hạn, tab Theo nhân sự mức hồ sơ | **Không đổi** so với 04-F đã duyệt; khung này dùng lại F9–F11. Lịch sử vai và mốc giai đoạn đã ghi từ 04-F1 |
| **03** | Cờ "hạn pháp lý" trên bước quy trình (G6); vai trò soát xét mặc định đã có | Sửa nhỏ ở `service-catalog`, xin trong đặc tả 05 |
| **05** | Trạng thái việc theo QD04, tối thiểu phân biệt: đang làm → **nộp/chờ soát xét** → **trả lại** / **được chấp nhận**, và **chờ khách hàng**; `originalDueDate`; lịch sử gia hạn (hạn cũ, mới, lý do, người duyệt); mốc nộp đầu, chấp nhận; người soát xét của việc; khoảng chờ khách gắn yêu cầu hồ sơ (YC12); **nhóm thực hiện của dòng dịch vụ kế toán** + lịch sử vai (G1) | `completedAt` bắt buộc khi việc hoàn tất; dữ liệu cũ (3 trạng thái) chuyển đổi: hạn gốc = hạn hiện tại, không có mốc nộp thì dùng `completedAt`, ghi "dữ liệu chuyển đổi" |
| **06** | Lịch làm việc/nghỉ lễ (QD07) cho SLA soát xét; nhắc việc sắp đến hạn/quá hạn, nhắc soát xét quá SLA | Chưa có lịch nghỉ thì tạm tính thứ 2–6 như 03 |
| **10** | Báo cáo "Đánh giá năng lực", danh sách chi tiết, xuất XLSX | Như mục trên |
| **11** | Ngưỡng màu, ngưỡng "sắp đến hạn", SLA soát xét | Trước 11 dùng giá trị mặc định ghi trong đặc tả này |

## Quyết định cần duyệt

Người dùng duyệt ngày 22/10/2026 theo cột "Đề xuất".

| Mã | Câu hỏi | Đề xuất | Phương án khác |
| --- | --- | --- | --- |
| G1 | Nhóm Manager / trưởng nhóm / trợ lý của kế toán dịch vụ gắn ở đâu? | Theo **dòng dịch vụ** của HĐ (như kiểm toán 04-F); tái ký chép nhóm sang HĐ năm sau; danh sách KH của một Manager = các dòng mình làm Manager | Theo **khách hàng** (thêm vai trò vào phân công KH ở 02): một nhóm cho mọi dịch vụ của khách |
| G2 | Đánh giá theo hạn nào? | Hạn hiện hành (sau gia hạn có duyệt) + cột "đúng hạn gốc", số lần/ngày gia hạn — như F9 của 04-F | Chỉ hạn gốc (gia hạn không cứu tỷ lệ) |
| G3 | Ai duyệt gia hạn **việc**? | Manager của dòng dịch vụ hoặc Kế toán trưởng/Giám đốc (`tasks:approve` trong phạm vi); trưởng nhóm và trợ lý chỉ **đề nghị** kèm lý do. Hạn hồ sơ kiểm toán vẫn chỉ Giám đốc (F9) | Trưởng nhóm tự gia hạn việc của trợ lý |
| G4 | Trợ lý đúng hạn tính theo mốc nào? | **Lần nộp đầu** (đo tốc độ); chất lượng đo riêng bằng tỷ lệ bị trả lại. Trưởng nhóm/Manager tính theo ngày **được chấp nhận** | Mọi vai theo ngày được chấp nhận (trợ lý chịu cả thời gian sửa sau khi bị trả lại) |
| G5 | Khách chậm cung cấp chứng từ có trừ cho nhân viên không? | Có, với **hạn nội bộ**: thời gian ở trạng thái "Chờ khách hàng" gắn yêu cầu hồ sơ đã gửi khách, được trưởng nhóm xác nhận, được cộng vào hạn khi đánh giá. **Hạn pháp lý không trừ**, chỉ gắn nhãn "do khách" | Không trừ; người đánh giá tự xem ghi chú |
| G6 | Có tách **hạn pháp lý** không? | Có: cờ trên bước quy trình (03); trễ hạn pháp lý đếm riêng, luôn tô đỏ, là chỉ số chính của cả ba vai bên kế toán | Không tách; tính chung tỷ lệ |
| G7 | SLA soát xét của trưởng nhóm | **2 ngày làm việc** từ lúc nộp đến lúc duyệt hoặc trả lại (cấu hình ở 11) | Không đo thời gian soát xét |
| G8 | Có chấm **điểm tổng hợp** không? | Giai đoạn đầu **không**: hiện từng chỉ số, tô màu theo ngưỡng mặc định — tỷ lệ đúng hạn ≥ 95% xanh, 85–95% vàng, < 85% đỏ; trễ hạn pháp lý > 0 luôn đỏ; tỷ lệ bị trả lại ≤ 10% xanh, 10–25% vàng, > 25% đỏ. Ngưỡng chỉnh ở 11 | Điểm tổng hợp có trọng số (cần người dùng cho trọng số từng chỉ số và từng vai) |
| G9 | Ai xem báo cáo năng lực? | Như F11: Giám đốc tất cả; Kế toán trưởng người trong nhóm; nhân viên chỉ chính mình; thu tiền, quản trị không | Chỉ Giám đốc |
| G10 | Có chốt số liệu theo kỳ không? | Giai đoạn đầu tính trực tiếp (sửa dữ liệu cũ thì số liệu kỳ cũ đổi theo, mọi sửa đều có nhật ký); chốt kỳ để sau khi người dùng dùng thật | Chốt kỳ ngay (lưu ảnh số liệu cuối tháng, sửa sau không đổi) |

## Tiêu chí nghiệm thu của khung (áp dụng cho từng bước khi code)

1. Cùng một việc/hạn cho ra cùng kết quả ở mọi màn hình (04-F Theo nhân sự, 05 danh sách việc, 10 báo cáo); định nghĩa đúng như mục "Định nghĩa chung".
2. Mọi con số trong báo cáo có danh sách chi tiết tái lập được; ô không có dữ liệu hiện "—".
3. Gia hạn chỉ đúng người duyệt, bắt buộc lý do, lịch sử không sửa/xoá; kết quả theo hạn gốc luôn xem được.
4. Trách nhiệm tính cho người giữ vai tại thời điểm hạn đến (lịch sử vai); trợ lý kiểm toán không bị tính theo hạn hồ sơ.
5. Thời gian chờ khách chỉ được trừ khi có yêu cầu hồ sơ đã gửi khách và trưởng nhóm xác nhận; không trừ cho hạn pháp lý.
6. Phạm vi xem đúng G9 ở API và giao diện; nhân viên không xem được chỉ số người khác (403/không có trong danh sách); không có số tiền.
7. Test biên ngày theo giờ Việt Nam (đạt đúng ngày hạn = đúng hạn), đổi người giữa kỳ, gia hạn nhiều lần, trả lại nhiều lần, chờ khách chồng khoảng, dữ liệu chuyển đổi từ 3 trạng thái cũ.

## Thứ tự triển khai

1. Người dùng duyệt khung và G1–G10 (đã duyệt 22/10/2026).
2. **04-F2** như đã duyệt (không đổi phạm vi).
3. 04-F3 (giao diện 04-F), biên bản nghiệm thu 04.
4. **05**: cập nhật đặc tả công việc theo QD04 và mục "Dữ liệu mỗi bước phải cung cấp" (gồm G1, G3–G6), duyệt, code.
5. **06**, **10** (báo cáo năng lực, thay phép tính demo), **11** (ngưỡng) theo thứ tự mục 9 của quy tắc.
